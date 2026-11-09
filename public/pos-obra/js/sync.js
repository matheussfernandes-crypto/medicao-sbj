/* ---------- Fila de envio (sincronização) ----------
   Toda alteração numa vistoria a marca como "pendente". Quando há internet E um servidor configurado
   (js/sync-config.js), as pendentes sobem sozinhas, uma a uma, e ficam marcadas como "enviadas".
   Sem internet, nada se perde: a fila espera e tenta de novo quando a conexão voltar.
   Depois de enviar, recebe o que outras pessoas fizeram (vtMisturar: junta sem apagar nem duplicar).
   Obras, clientes e fornecedores seguem o mesmo modelo: o aparelho grava primeiro; o que mudou sobe;
   o que mudou no servidor desce (o que tem alteração ainda não enviada neste aparelho não é sobrescrito). */

const SBJSync = (() => {
  let rodando = false, timer = null, ultimoErro = "";

  const hash = (txt) => { let h = 5381; for (let i = 0; i < txt.length; i++) h = ((h << 5) + h + txt.charCodeAt(i)) | 0; return String(h); };
  const assinatura = (v) => { const { sync, ...resto } = v; return hash(JSON.stringify(resto)); };
  const lista = () => (typeof state !== "undefined" && state.vistorias) || [];
  const chaveVt = (v) => (typeof vtChaveVistoria === "function" ? vtChaveVistoria(v) : [v.buildingId, String(v.unit).toLowerCase(), v.date].join("|"));

  /* marca como pendente o que mudou desde o último envio */
  function marcar() {
    let mudou = false;
    lista().forEach(v => {
      const sig = assinatura(v);
      if (!v.sync || v.sync.hash !== sig) { v.sync = { estado: "pendente", hash: sig, desde: v.sync && v.sync.estado === "pendente" ? v.sync.desde : Date.now() }; mudou = true; }
    });
    if (mudou && typeof saveData === "function") saveData(state);   // direto, para não disparar a fila de novo
    return mudou;
  }

  function resumo() {
    const l = lista(), pend = l.filter(v => !v.sync || v.sync.estado !== "enviado").length;
    return { total: l.length, pendentes: pend, configurado: !!window.SBJ_ADAPTER, online: navigator.onLine !== false, erro: ultimoErro };
  }

  /* ---------- memória do que o servidor já tem (fica só neste aparelho) ---------- */
  const MEM = "posobra_sync_cadastros";        // { obras: { desde, conhecidos: { id: hash } }, clientes: {...}, fornecedores: {...} }
  const VT_DESDE = "posobra_sync_vt_desde";
  const lerMem = () => { try { return JSON.parse(localStorage.getItem(MEM) || "{}") || {}; } catch (e) { return {}; } };
  const gravarMem = (m) => { try { localStorage.setItem(MEM, JSON.stringify(m)); } catch (e) { /* sem armazenamento */ } };
  /* JSON com as chaves em ordem: o banco não guarda a ordem das chaves, então a comparação não pode depender dela */
  const estavel = (x) => Array.isArray(x) ? "[" + x.map(estavel).join(",") + "]"
    : (x && typeof x === "object") ? "{" + Object.keys(x).filter(k => x[k] !== undefined && k !== "sync").sort().map(k => JSON.stringify(k) + ":" + estavel(x[k])).join(",") + "}"
    : JSON.stringify(x === undefined ? null : x);
  const sigReg = (r) => hash(estavel(r));

  const CADASTROS = [{ tipo: "obras", chave: "buildings" }, { tipo: "clientes", chave: "clients" }, { tipo: "fornecedores", chave: "suppliers" }];

  /* um tipo de cadastro: recebe, aplica, envia. Devolve true se mudou algo na tela. */
  async function syncCadastro(ad, c, mem) {
    const m = mem[c.tipo] || (mem[c.tipo] = { desde: null, conhecidos: {} });
    const locais = state[c.chave] || (state[c.chave] = []);
    const primeira = !m.desde;

    const r = await ad.receberCadastro(c.tipo, m.desde);
    /* banco ainda sem a carga inicial: não sobe nada deste aparelho (evita subir dados de teste como se fossem a base) */
    if (primeira && !(r.registros || []).length) return false;

    const pendente = (x) => m.conhecidos[x.id] !== undefined && m.conhecidos[x.id] !== sigReg(x);
    const porId = new Map(locais.map(x => [x.id, x]));
    let mudou = false;
    (r.registros || []).forEach(reg => {
      const local = porId.get(reg.id);
      const sig = sigReg(reg);
      if (local && pendente(local)) return;                 // alteração deste aparelho ainda não enviada: ela vence
      if (local) {
        if (sigReg(local) !== sig) {                        // troca o conteúdo no mesmo objeto (as telas abertas continuam valendo)
          Object.keys(local).forEach(k => delete local[k]);
          Object.assign(local, reg);
          mudou = true;
        }
      } else { locais.push(reg); porId.set(reg.id, reg); mudou = true; }
      m.conhecidos[reg.id] = sig;
    });
    (r.excluidos || []).forEach(id => {
      const i = locais.findIndex(x => x.id === id);
      if (i >= 0 && !pendente(locais[i])) { locais.splice(i, 1); mudou = true; }
      delete m.conhecidos[id];
    });

    /* envia o que é novo ou mudou aqui, e o que foi apagado aqui */
    const enviar = locais.filter(x => x && x.id && m.conhecidos[x.id] !== sigReg(x));
    const ids = new Set(locais.map(x => x.id));
    const excluidos = Object.keys(m.conhecidos).filter(id => !ids.has(id));
    if (enviar.length || excluidos.length) {
      const sigs = enviar.map(sigReg);
      await ad.enviarCadastro(c.tipo, JSON.parse(JSON.stringify(enviar)), excluidos);
      enviar.forEach((x, i) => { m.conhecidos[x.id] = sigs[i]; });
      excluidos.forEach(id => { delete m.conhecidos[id]; });
    }
    m.desde = r.agora || m.desde;
    return mudou;
  }

  /* números sequenciais (c12, sup3): continuam depois do maior que veio do servidor */
  function ajustarSeq() {
    const maior = (arr, pre) => (arr || []).reduce((mx, x) => { const k = new RegExp("^" + pre + "(\\d+)$").exec(String(x && x.id)); return k ? Math.max(mx, +k[1]) : mx; }, 0);
    state.clientSeq = Math.max(state.clientSeq || 1, maior(state.clients, "c") + 1);
    state.supplierSeq = Math.max(state.supplierSeq || 1, maior(state.suppliers, "sup") + 1);
  }

  async function syncCadastros(ad) {
    if (typeof ad.receberCadastro !== "function" || typeof ad.enviarCadastro !== "function") return;
    const mem = lerMem();
    let mudou = false;
    try {
      for (const c of CADASTROS) { if (await syncCadastro(ad, c, mem)) mudou = true; }
    } finally {
      gravarMem(mem);
      if (mudou) { ajustarSeq(); if (typeof saveData === "function") saveData(state); redesenhar(); }
    }
  }

  /* recebe as vistorias de outras pessoas e junta com as daqui */
  async function receberVistorias(ad) {
    if (typeof ad.receberVistorias !== "function" || typeof vtMisturar !== "function") return;
    let desde = null;
    try { desde = localStorage.getItem(VT_DESDE); } catch (e) { /* sem armazenamento */ }
    const recebidas = await ad.receberVistorias(desde);
    if (recebidas && recebidas.length) {
      const antes = new Set(lista().map(chaveVt));
      const limpas = new Set(lista().filter(v => v.sync && v.sync.estado === "enviado" && v.sync.hash === assinatura(v)).map(chaveVt));
      vtMisturar(recebidas);
      /* o que vtMisturar não copia: termo, nomes e assinaturas (só preenche o que falta aqui) */
      recebidas.forEach(rv => {
        if (!rv || !rv.buildingId) return;
        const v = lista().find(x => chaveVt(x) === chaveVt(rv));
        if (!v) return;
        ["termo", "nomeProp", "nomeTec"].forEach(k => { if (rv[k] !== undefined && rv[k] !== null && v[k] === undefined) v[k] = rv[k]; });
        if (rv.assin) {
          v.assin = v.assin || { prop: "", tec: "", termo: "" };
          ["prop", "tec", "termo"].forEach(k => { if (rv.assin[k] && !v.assin[k]) v.assin[k] = rv.assin[k]; });
        }
        /* veio do servidor (ou estava em dia e só ganhou o que o servidor tinha): já está lá, não precisa subir de novo */
        const k = chaveVt(v);
        if (!antes.has(k) || limpas.has(k)) v.sync = { estado: "enviado", hash: assinatura(v), em: Date.now() };
      });
      if (typeof saveData === "function") saveData(state);
      redesenhar();
    }
    if (ad.ultimaAgora) { try { localStorage.setItem(VT_DESDE, ad.ultimaAgora); } catch (e) { /* sem armazenamento */ } }
  }

  /* redesenha a tela aberta, mas nunca no meio de um formulário, vistoria ou janela aberta */
  function redesenhar() {
    try {
      if (document.querySelector("#modal-root > *")) return;
      const foco = document.activeElement;
      if (foco && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName)) return;
      const ativa = document.querySelector(".view.active"), id = ativa && ativa.id;
      if (id === "view-buildings" && typeof renderBuildings === "function") renderBuildings();
      else if (id === "view-clients" && typeof renderClients === "function") renderClients();
      else if (id === "view-suppliers" && typeof renderSuppliers === "function") renderSuppliers();
      else if (id === "view-vistorias" && typeof renderVistorias === "function" && !(typeof vf !== "undefined" && vf)) renderVistorias();
    } catch (e) { /* a tela se atualiza na próxima navegação */ }
  }

  async function tentar() {
    if (rodando) return;
    marcar();
    const ad = window.SBJ_ADAPTER;
    if (!ad || typeof ad.enviarVistoria !== "function" || navigator.onLine === false) { avisar(); return; }
    rodando = true; avisar();
    let erro = "";
    try {
      for (const v of lista().filter(x => !x.sync || x.sync.estado !== "enviado")) {
        const sig = assinatura(v);
        try {
          await ad.enviarVistoria(JSON.parse(JSON.stringify(v)), (id) => (typeof vtfGet === "function" ? vtfGet(id) : null));
          v.sync = { estado: "enviado", hash: sig, em: Date.now() };
          if (assinatura(v) !== sig) v.sync.estado = "pendente";   // mudou durante o envio: sobe de novo na próxima
          if (typeof saveData === "function") saveData(state);
        } catch (e) { v.sync = { ...(v.sync || {}), estado: "pendente", hash: sig, erro: String(e && e.message || e) }; erro = v.sync.erro; break; }
        avisar();
      }
      if (!erro) {
        try { await receberVistorias(ad); } catch (e) { erro = String(e && e.message || e); }
      }
      if (!erro) {
        try { await syncCadastros(ad); } catch (e) { erro = String(e && e.message || e); }
      }
    } finally { ultimoErro = erro; rodando = false; avisar(); }
  }

  /* agenda uma tentativa logo depois de cada alteração */
  function agendar() { clearTimeout(timer); timer = setTimeout(tentar, 1500); }

  /* mostra o estado na tela (selo da aba Vistorias e aviso de "sem internet") */
  function avisar() {
    const r = resumo();
    document.body.classList.toggle("sem-rede", !r.online);
    const sel = document.getElementById("vt-sync-estado");
    if (sel) {
      let txt, cls;
      if (!r.configurado) { txt = "Salvo só neste aparelho"; cls = "local"; }
      else if (!r.pendentes) { txt = "Tudo enviado ao servidor"; cls = "ok"; }
      else if (!r.online) { txt = `${r.pendentes} aguardando internet para enviar`; cls = "espera"; }
      else if (r.erro && !rodando) { txt = `${r.pendentes} na fila: ${r.erro}`; cls = "espera"; }
      else { txt = `Enviando… (${r.pendentes} na fila)`; cls = "espera"; }
      sel.textContent = txt; sel.className = "vt-sync-estado " + cls;
    }
    const fx = document.getElementById("faixa-offline");
    if (fx) fx.hidden = r.online;
  }

  /* observa gravações: embrulha persist() sem alterá-lo */
  function ligar() {
    if (typeof window.persist === "function" && !window.persist.__sync) {
      const orig = window.persist;
      window.persist = function () { const r = orig.apply(this, arguments); agendar(); return r; };
      window.persist.__sync = true;
    }
    window.addEventListener("online", () => { avisar(); tentar(); });
    window.addEventListener("offline", avisar);
    setInterval(tentar, 60000);
    const faixa = document.createElement("div");
    faixa.id = "faixa-offline"; faixa.hidden = navigator.onLine !== false; faixa.setAttribute("role", "status");
    faixa.textContent = "Sem internet. Pode continuar: tudo é salvo neste aparelho e enviado quando a conexão voltar.";
    document.body.appendChild(faixa);
    setTimeout(tentar, 800);
  }

  return { ligar, tentar, resumo, avisar };
})();

window.addEventListener("load", () => SBJSync.ligar());
