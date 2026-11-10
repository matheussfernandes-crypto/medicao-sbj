/* ---------- Lançar da folha de vistoria ----------
   A folha de papel continua sendo o documento assinado pelo cliente (chaves, ciência das pendências).
   Esta tela é a MESMA folha na tela, para passar a limpo sem digitar ambiente e serviço:
   toca em "Errado" nos itens com problema e escreve só a observação (uma pendência por linha). */

const VF_MODELOS = {
  suite: ["Gesso", "Pintura", "Pisos/Vinílico", "Portas/Vistas", "Rodapés", "Janelas", "Instalações Elétricas"],
  bwc: ["Gesso", "Pisos e Azulejos", "Pintura", "Porta", "Janela", "Instalações Hidráulicas", "Vaso sanitário", "Instalações Elétricas"],
  dorm: ["Gesso", "Pintura", "Pisos/Vinílico", "Portas/Vistas", "Rodapés", "Porta/Janela", "Instalações Elétricas"],
  lavabo: ["Gesso", "Pintura", "Porta", "Janela", "Instalações Hidráulicas", "Vaso sanitário", "Instalações Elétricas"],
  circ: ["Gesso", "Pintura", "Pisos", "Instalações Elétricas"],
  coz: ["Gesso", "Pintura", "Pisos e Azulejos", "Porta/Janela", "Rodapés", "Instalações Hidráulicas", "Instalações Elétricas"],
  lav: ["Gesso", "Pisos e Azulejos", "Pintura", "Janela", "Instalações Hidráulicas", "Instalações Elétricas"],
  sala: ["Gesso", "Pintura", "Pisos e Azulejos", "Portas/Vistas", "Rodapés", "Porta/Janela", "Instalações Elétricas"],
  sacada: ["Gesso", "Pintura", "Pisos e Azulejos", "Rodapés", "Instalações Hidráulicas", "Instalações Elétricas", "Churrasqueira"],
  tec: ["Instalações Hidráulicas", "Instalações Elétricas", "Janela", "Pintura", "Guarda-corpo"],
  outros: ["Interfone", "Antena", "Limpeza"],
};

/* nome do item na folha -> serviço usado nos relatórios */
const VF_TIPO = {
  "Gesso": "Gesso", "Pintura": "Pintura", "Pisos/Vinílico": "Piso/Vinílico", "Pisos": "Piso/Vinílico", "Pisos e Azulejos": "Revestimento",
  "Portas/Vistas": "Porta", "Porta": "Porta", "Rodapés": "Rodapé", "Janelas": "Esquadria", "Janela": "Esquadria", "Porta/Janela": "Esquadria",
  "Instalações Elétricas": "Instalações elétricas", "Instalações Hidráulicas": "Instalações hidráulicas", "Vaso sanitário": "Vaso sanitário",
  "Churrasqueira": "Churrasqueira", "Guarda-corpo": "Guarda-corpo", "Interfone": "Interfone", "Antena": "Antena", "Limpeza": "Limpeza",
};

let vf = null; // estado da tela: { etapa, buildingId, unit, date, resp, suites, dorms, opc:{demi,lavabo,sacada,tec}, ambs:[{nome,modelo}], marcas:{} }

function vfAtiva() { return !!vf; }

/* rascunho: o que foi marcado fica guardado no aparelho; se a página recarregar, nada se perde */
const VF_RASCUNHO = "posvenda_vf_rascunho";
function vfRascunhoSalvar() {
  try {
    if (vf && (vf.etapa === "folha" || vf.etapa === "inicio")) localStorage.setItem(VF_RASCUNHO, JSON.stringify({ vf, t: Date.now() }));
  } catch (e) { /* sem armazenamento */ }
}
function vfRascunhoLer() {
  try {
    const r = JSON.parse(localStorage.getItem(VF_RASCUNHO) || "null");
    if (r && r.vf && Date.now() - r.t < 72 * 3600 * 1000) return r.vf;
  } catch (e) { /* ignora */ }
  return null;
}
function vfRascunhoApagar() { try { localStorage.removeItem(VF_RASCUNHO); } catch (e) { /* ignora */ } }

function vfConstruirAmbientes() {
  const L = [];
  const n2 = n => String(n).padStart(2, "0");
  for (let i = 1; i <= vf.suites; i++) { L.push({ nome: `Suíte ${n2(i)}`, modelo: "suite" }); L.push({ nome: `BWC Suíte ${n2(i)}`, modelo: "bwc" }); }
  for (let i = 1; i <= vf.dorms; i++) L.push({ nome: `Dormitório ${n2(i)}`, modelo: "dorm" });
  if (vf.opc.demi) L.push({ nome: "Banheiro Demi", modelo: "bwc" });
  if (vf.opc.lavabo) L.push({ nome: "Lavabo", modelo: "lavabo" });
  L.push({ nome: "Circulação", modelo: "circ" }, { nome: "Cozinha", modelo: "coz" }, { nome: "Lavanderia", modelo: "lav" }, { nome: "Sala de estar", modelo: "sala" });
  if (vf.opc.sacada) L.push({ nome: "Sacada", modelo: "sacada" });
  if (vf.opc.tec) L.push({ nome: "Área técnica", modelo: "tec" });
  L.push({ nome: "Outros", modelo: "outros" });
  return L;
}

function vfAbrir() {
  const rasc = vfRascunhoLer();
  if (rasc) { vf = rasc; vf.retomado = true; renderVistorias(); toast(`Retomando a vistoria do apto ${vf.unit || "(sem número)"}.`, "success"); return; }
  const comPredio = state.buildings.length;
  if (!comPredio) { toast("Cadastre um empreendimento antes.", "error"); return; }
  const campeche = state.buildings.find(b => b.id === vtFiltroPredio) || state.buildings.find(b => /campeche/i.test(b.name)) || state.buildings[0];
  vf = { etapa: "inicio", buildingId: campeche.id, unit: "", date: todayISODate(), resp: localStorage.getItem("posvenda_vf_resp") || "", suites: 1, dorms: 2, opc: { demi: true, lavabo: true, sacada: true, tec: true }, ambs: [], marcas: {} };
  renderVistorias();
}
function vfSair() { if (vf && vf.etapa !== "final") vfRascunhoSalvar(); vf = null; renderVistorias(); }

function vfChips(grupo, valores, atual) {
  return valores.map(v => `<button type="button" class="vt-chip ${v === atual ? "ativo" : ""}" data-vf-n="${grupo}" data-v="${v}">${v}</button>`).join("");
}

function vfRender(root) {
  vfRascunhoSalvar();
  if (vf.etapa === "final") return vfRenderFinal(root);
  if (vf.etapa === "inicio") return vfRenderInicio(root);
  vfRenderFolha(root);
}

/* ---------- 1) dados do apartamento ---------- */
function vfRenderInicio(root) {
  const b = getBuilding(vf.buildingId);
  root.innerHTML = `
    <div class="vt-topo"><button type="button" class="btn ghost small" id="vf-voltar">← Vistorias</button>
      <div class="vt-titulo"><h2>Realizar vistoria</h2><span>Marque o que está errado em cada ambiente. Ao salvar, cada item errado vira uma pendência.</span></div></div>
    <div class="panel vf-inicio">
      <div class="vt-linha2">
        <label class="vt-campo">Obra<select id="vf-obra">${state.buildings.map(x => `<option value="${x.id}" ${x.id === vf.buildingId ? "selected" : ""}>${escapeHtml(x.name)}</option>`).join("")}</select></label>
        <label class="vt-campo">Apartamento<input type="text" id="vf-unit" placeholder="ex: 704" value="${escapeHtml(vf.unit)}" autocomplete="off"></label>
      </div>
      <div class="vt-linha2" style="margin-top:14px;">
        <label class="vt-campo">Data da vistoria<input type="date" id="vf-data" value="${vf.date}"></label>
        <label class="vt-campo">Responsável pela vistoria<input type="text" id="vf-resp" placeholder="ex: Carlucia" value="${escapeHtml(vf.resp)}"></label>
      </div>
      <div class="vt-rot">Quantas suítes tem o apartamento?</div>
      <div class="vt-chips">${vfChips("suites", [1, 2, 3], vf.suites)}</div>
      <div class="vt-rot">Quantos dormitórios (fora as suítes)?</div>
      <div class="vt-chips">${vfChips("dorms", [0, 1, 2, 3], vf.dorms)}</div>
      <div class="vt-rot">Também tem</div>
      <div class="vt-chips">${[["demi", "Banheiro Demi"], ["lavabo", "Lavabo"], ["sacada", "Sacada"], ["tec", "Área técnica"]].map(([k, r]) => `<button type="button" class="vt-chip ${vf.opc[k] ? "ativo" : ""}" data-vf-o="${k}">${r}</button>`).join("")}</div>
      <div class="vf-rodape-acao">${vf.retomado ? `<button type="button" class="btn ghost" id="vf-descartar">Descartar rascunho</button>` : ""}<button type="button" class="btn primary" id="vf-comecar">Começar a lançar</button></div>
    </div>`;
  const $ = id => root.querySelector("#" + id);
  $("vf-voltar").onclick = vfSair;
  const desc = $("vf-descartar"); if (desc) desc.onclick = () => { if (confirm("Descartar a vistoria em andamento? O que foi marcado será perdido.")) { vfRascunhoApagar(); vf = null; vfAbrir(); } };
  const guarda = () => { vf.buildingId = $("vf-obra").value; vf.unit = $("vf-unit").value.trim(); vf.date = $("vf-data").value || todayISODate(); vf.resp = $("vf-resp").value.trim(); };
  root.querySelectorAll("[data-vf-n]").forEach(c => c.onclick = () => { guarda(); vf[c.dataset.vfN] = Number(c.dataset.v); renderVistorias(); });
  root.querySelectorAll("[data-vf-o]").forEach(c => c.onclick = () => { guarda(); vf.opc[c.dataset.vfO] = !vf.opc[c.dataset.vfO]; renderVistorias(); });
  $("vf-comecar").onclick = () => {
    guarda();
    if (!vf.unit) { toast("Informe o apartamento.", "error"); $("vf-unit").focus(); return; }
    if (vf.resp) localStorage.setItem("posvenda_vf_resp", vf.resp);
    vf.ambs = vfConstruirAmbientes(); vf.etapa = "folha"; renderVistorias(); window.scrollTo({ top: 0 });
  };
  setTimeout(() => { const u = $("vf-unit"); if (u && !vf.unit) u.focus(); }, 60);
}

/* ---------- 2) a folha ---------- */
function vfChave(amb, item) { return amb + "|" + item; }
function vfContagem() { return Object.values(vf.marcas).filter(m => m.errado).length; }

/* cada item "errado" tem uma ou mais LINHAS (cada uma vira uma pendência, com as próprias fotos).
   Também lê o formato antigo (um texto só) dos rascunhos já salvos. */
function vfLinhas(m) {
  if (!Array.isArray(m.linhas)) {
    m.linhas = (m.obs || "").split("\n").map(l => l.trim()).filter(Boolean).map(o => ({ obs: o, fotos: [] }));
    if (m.fotos && m.fotos.length) { if (!m.linhas.length) m.linhas.push({ obs: "", fotos: [] }); m.linhas[0].fotos = m.fotos.slice(); }
    delete m.obs; delete m.fotos;
  }
  if (!m.linhas.length) m.linhas.push({ obs: "", fotos: [] });
  return m.linhas;
}
function vfTextoObs(m) {
  if (!m) return "";
  if (Array.isArray(m.linhas)) return m.linhas.map(l => (l.obs || "").trim()).filter(Boolean).join("  /  ");
  return (m.obs || "").split("\n").map(l => l.trim()).filter(Boolean).join("  /  ");
}

function vfItemHTML(amb, item) {
  const k = vfChave(amb, item), m = vf.marcas[k] || {};
  const ek = escapeHtml(k);
  const linhas = m.errado ? vfLinhas(m) : [];
  return `<div class="vf-item ${m.errado ? "errado" : ""}" data-k="${ek}">
    <div class="vf-linha">
      <span class="vf-nome">${escapeHtml(item)}</span>
      <button type="button" class="vf-errado" data-vf-t="${ek}" aria-pressed="${!!m.errado}">${m.errado ? "Errado" : "Certo"}</button>
    </div>
    ${m.errado ? linhas.map((l, i) => `
      <div class="vf-obslinha">
        <div class="vf-obsrow">
          <input type="text" class="vf-obs" data-vf-obs="${ek}" data-i="${i}" value="${escapeHtml(l.obs || "")}" placeholder="${i === 0 ? "O que está errado? (Enter para outra pendência)" : "Outra pendência deste item"}" enterkeyhint="next" autocomplete="off">
          <button type="button" class="vf-cam" data-vf-cam="${ek}" data-i="${i}" aria-label="Tirar foto desta pendência" title="Tirar foto">${ckIco("camera", 22)}</button>
          ${linhas.length > 1 ? `<button type="button" class="vf-x" data-vf-x="${ek}" data-i="${i}" aria-label="Remover esta linha" title="Remover esta linha">${ckIco("naofeito", 16)}</button>` : ""}
        </div>
        ${vtfThumbs(l.fotos, k + "#" + i)}
      </div>`).join("") : ""}
  </div>`;
}

function vfRenderFolha(root) {
  const b = getBuilding(vf.buildingId);
  root.innerHTML = `
    <div class="vf-barra">
      <button type="button" class="btn ghost small" id="vf-ajustar">← Dados</button>
      <div class="vf-id"><strong>Apto ${escapeHtml(vf.unit)}</strong><span>${b ? escapeHtml(b.name) : ""} · ${fmtDate(vf.date)}${vf.resp ? " · " + escapeHtml(vf.resp) : ""}</span></div>
      <span class="vf-cont" id="vf-cont"></span>
      <button type="button" class="btn primary" id="vf-salvar">Salvar vistoria</button>
    </div>
    <div class="vf-lista">${vf.ambs.map(a => `
      <section class="vf-amb">
        <h3>${escapeHtml(a.nome)}</h3>
        <div class="vf-itens">${VF_MODELOS[a.modelo].map(it => vfItemHTML(a.nome, it)).join("")}</div>
      </section>`).join("")}
    </div>`;
  const cont = () => { const n = vfContagem(); root.querySelector("#vf-cont").innerHTML = n ? `<strong>${n}</strong> ${n === 1 ? "item errado" : "itens errados"}` : "Nada marcado"; };
  cont();
  root.querySelector("#vf-ajustar").onclick = () => { vf.etapa = "inicio"; renderVistorias(); };
  root.querySelector("#vf-salvar").onclick = vfSalvar;
  const refazItem = (k, foco) => {
    const [amb, item] = k.split("|"), cx = root.querySelector(`.vf-item[data-k="${CSS.escape(k)}"]`);
    if (cx) { cx.outerHTML = vfItemHTML(amb, item); vtfHidratar(root); }
    vfRascunhoSalvar(); cont();
    if (foco != null) { const el = root.querySelector(`.vf-item[data-k="${CSS.escape(k)}"] .vf-obs[data-i="${foco}"]`); if (el) { el.focus(); el.scrollIntoView({ block: "center", behavior: "smooth" }); } }
  };
  const lista = root.querySelector(".vf-lista");
  lista.addEventListener("click", async e => {
    const cam = e.target.closest("[data-vf-cam]");
    if (cam) {
      const k = cam.dataset.vfCam, i = Number(cam.dataset.i), m = vf.marcas[k];
      const id = await vtfTirarFoto();
      if (id && m) { vfLinhas(m)[i].fotos.push(id); refazItem(k); }
      return;
    }
    const x = e.target.closest("[data-vf-x]");
    if (x) {
      const k = x.dataset.vfX, i = Number(x.dataset.i), ls = vfLinhas(vf.marcas[k]);
      if (ls[i].fotos.length && !confirm("Esta linha tem foto(s). Remover mesmo assim?")) return;
      ls[i].fotos.forEach(vtfDel); ls.splice(i, 1); refazItem(k, Math.max(0, i - 1));
      return;
    }
    const th = e.target.closest("[data-vtf-abrir]");
    if (th) {
      const [k, i] = th.dataset.vtfAbrir.split("#"), m = vf.marcas[k];
      if (m) vtfGaleria({ titulo: k.replace("|", " · "), ids: vfLinhas(m)[Number(i)].fotos, aoMudar: () => refazItem(k) });
      return;
    }
    const t = e.target.closest("[data-vf-t]"); if (!t) return;
    const k = t.dataset.vfT, m = vf.marcas[k] || (vf.marcas[k] = { errado: false, linhas: [{ obs: "", fotos: [] }] });
    m.errado = !m.errado; vfRascunhoSalvar();
    const caixa = t.closest(".vf-item"), [amb, item] = k.split("|");
    caixa.outerHTML = vfItemHTML(amb, item); vtfHidratar(root);
    cont();
    if (m.errado) { const novo = root.querySelector(`[data-vf-obs="${CSS.escape(k)}"]`); if (novo) novo.focus(); }
  });
  lista.addEventListener("input", e => {
    const el = e.target.closest("[data-vf-obs]"); if (!el) return;
    vfLinhas(vf.marcas[el.dataset.vfObs])[Number(el.dataset.i)].obs = el.value; vfRascunhoSalvar();
  });
  lista.addEventListener("keydown", e => {
    const el = e.target.closest("[data-vf-obs]"); if (!el || e.isComposing) return;
    const k = el.dataset.vfObs, i = Number(el.dataset.i), ls = vfLinhas(vf.marcas[k]);
    if (e.key === "Enter") {
      e.preventDefault();
      if (!ls[i].obs.trim() && !ls[i].fotos.length && i === ls.length - 1) return; // linha vazia no fim: não cria outra
      ls.splice(i + 1, 0, { obs: "", fotos: [] }); refazItem(k, i + 1);
    } else if (e.key === "Backspace" && !el.value && ls.length > 1 && !ls[i].fotos.length) {
      e.preventDefault(); ls.splice(i, 1); refazItem(k, Math.max(0, i - 1));
    } else if (e.key === "Escape") el.blur();
  });
}

function vfSalvar() {
  const itens = [];
  vf.ambs.forEach(a => VF_MODELOS[a.modelo].forEach(it => {
    const m = vf.marcas[vfChave(a.nome, it)]; if (!m || !m.errado) return;
    const ls = vfLinhas(m).filter(l => l.obs.trim() || l.fotos.length);
    (ls.length ? ls : [{ obs: "Ver observação na folha", fotos: [] }]).forEach(l => itens.push({ ambiente: a.nome, tipo: VF_TIPO[it] || it, descricao: l.obs.trim() || "Ver foto", fotos: l.fotos.slice() }));
  }));
  let v = vtLista().find(x => x.buildingId === vf.buildingId && x.unit === vf.unit && x.date === vf.date);
  if (!v) { v = { id: vtId("vt"), buildingId: vf.buildingId, unit: vf.unit, date: vf.date, items: [] }; vtLista().push(v); }
  if (vf.resp) v.responsavel = vf.resp;
  const marcas = {}; Object.entries(vf.marcas).forEach(([k, m]) => { if (m.errado) marcas[k] = { errado: true, linhas: vfLinhas(m).map(l => ({ obs: l.obs })) }; });
  v.folha = { ambs: vf.ambs.map(a => ({ nome: a.nome, modelo: a.modelo })), marcas };
  let novos = 0;
  itens.forEach(i => {
    const ja = v.items.find(x => x.ambiente === i.ambiente && x.tipo === i.tipo && x.descricao === i.descricao);
    if (ja) { i.fotos.forEach(fo => { ja.fotos = ja.fotos || []; if (!ja.fotos.includes(fo)) ja.fotos.push(fo); }); return; }
    v.items.push({ id: vtId("it"), ambiente: i.ambiente, tipo: i.tipo, descricao: i.descricao, feito: false, feitoEm: "", fotos: i.fotos }); novos++;
  });
  persist(); vfRascunhoApagar();
  vf = { etapa: "final", vid: v.id, novos }; renderVistorias(); window.scrollTo({ top: 0 });
  toast(!itens.length ? `Vistoria do apto ${v.unit} salva, sem pendências.` : `${novos} pendência${novos === 1 ? "" : "s"} salva${novos === 1 ? "" : "s"} no apto ${v.unit}.`, "success");
}

/* abre a tela de documento/e-mail de uma vistoria já salva (a que tem folha) */
function vfAbrirFinal(vid) { vf = { etapa: "final", vid, novos: null }; renderVistorias(); window.scrollTo({ top: 0 }); }


/* ---------- 3) fim da vistoria: documento para o cliente assinar + e-mail ---------- */
function vfTextoEmail(v) {
  const b = getBuilding(v.buildingId), cli = vtNomeCliente(v.buildingId, v.unit);
  const doisDocs = !!(v.assin && v.assin.termo);
  return {
    assunto: `Vistoria do imóvel — Apto ${v.unit}${b ? " — " + b.name : ""}`,
    corpo: `Prezado(a)${cli ? " " + cli : ""},\n\nEncaminhamos, em anexo, ${doisDocs ? "os documentos da vistoria e o termo de recebimento do imóvel" : "o documento da vistoria do imóvel"} (apartamento ${v.unit}${b ? " do " + b.name : ""}), realizada em ${fmtDate(v.date)}.\n\nPermanecemos à disposição para quaisquer esclarecimentos.\n\nAtenciosamente,\n${v.responsavel ? v.responsavel + "\n" : ""}SBJ Construtora e Incorporadora`,
  };
}

const VF_DECLARACAO = [
  "Declaro expressamente que recebi nesta data o referido imóvel para uso, em perfeitas condições de habitabilidade, tendo efetuado vistoria através deste check-list específico e constatado que todas as suas instalações estão em perfeito estado de funcionamento, bem como não apresentam nenhum vício ou defeito construtivo aparente.",
  "Declara também que estou ciente de que, a partir de julho de 2026, passa a contar com as garantias que lhe são asseguradas pelo Código Civil Brasileiro e Codigo de Defesa do Consumidor, o qual fixam-se os prazos apresentados no Manual do Proprietário fornecido por esta Construtora.",
  "Concordo que, para prevenir dúvidas, todas as comunicações com a construtora deverão ser feitas por escrito, pela qual se obriga a tanto.",
];
const VF_OBJETOS_PADRAO = [[2, "CHAVE MANUAL PORTA DE ENTRADA DO APTO"], [2, "TAG PORTA DE ENTRADA DO APTO"], [2, "CONTROLE REMOTO PORTÃO"], [1, "PEN DRIVE - MANUAL DO PROPRIETÁRIO"], [6, "CHAVES PORTAS INTERNAS DORMITÓRIOS"]];

/* dados do termo de recebimento: o que já foi preenchido, senão o cliente cadastrado e a lista padrão de chaves/objetos */
function vfDadosTermo(v) {
  if (!v.termo) {
    const cli = vtClienteDe(v.buildingId, v.unit) || {};
    let objetos = VF_OBJETOS_PADRAO.map(o => ({ q: o[0], n: o[1], r: "" }));
    try { const salvo = JSON.parse(localStorage.getItem("posvenda_vf_objetos") || "null"); if (Array.isArray(salvo) && salvo.length) {
      const lido = salvo.map(o => Array.isArray(o) ? { q: o[0], n: o[1], r: "" } : { q: o && o.q, n: o && o.n, r: "" }).filter(o => typeof o.n === "string" && o.n);
      if (lido.length) objetos = lido;   // formato antigo (lista de pares) e novo (objetos) são aceitos
    } } catch (e) { /* padrão */ }
    v.termo = { nome: String(cli.name || "").replace(/\s+/g, " ").trim(), garagem: true, objetos, extra: "" };
  }
  if (!v.assin) v.assin = { prop: "", tec: "", termo: "" };
  return v.termo;
}

function vfRenderFinal(root) {
  const v = vtLista().find(x => x.id === vf.vid);
  if (!v) { vf = null; renderVistorias(); return; }
  const b = getBuilding(v.buildingId), tm = vfDadosTermo(v), cliente = vtClienteDe(v.buildingId, v.unit) || {};
  if (!tm.nome && cliente.name) tm.nome = String(cliente.name).replace(/\s+/g, " ").trim();
  root.innerHTML = `
    <div class="vt-topo"><button type="button" class="btn ghost small" id="vf-fim-voltar">← Vistorias</button>
      <div class="vt-titulo"><h2>Apto ${escapeHtml(v.unit)} — vistoria salva</h2><span>${b ? escapeHtml(b.name) : ""} · ${fmtDate(v.date)}${v.responsavel ? " · " + escapeHtml(v.responsavel) : ""}</span></div></div>
    <div class="vf-final">

      <div class="panel vf-passo">
        <h3>1. Assinatura da vistoria</h3>
        ${VF_DECLARACAO.map(p => `<p class="vf-decl-txt">${escapeHtml(p)}</p>`).join("")}
        <div class="vf-assins">
          <div class="vf-assin"><label>Proprietário(a) e/ou Procurador Legal<input type="text" id="vf-nome-prop" value="${escapeHtml(v.nomeProp !== undefined ? v.nomeProp : tm.nome)}" placeholder="Nome completo" autocomplete="off"></label>
            <canvas id="as-prop" class="vf-canvas" aria-label="Assinatura do proprietário"></canvas><div class="vf-assin-ac"><span class="hint">Assine com o dedo ou a caneta</span><button type="button" class="btn ghost small" data-as-limpar="prop">Limpar</button></div></div>
          <div class="vf-assin"><label>Responsável Técnico da SBJ Construtora<input type="text" id="vf-nome-tec" value="${escapeHtml(v.nomeTec !== undefined ? v.nomeTec : (v.responsavel || ""))}" placeholder="Nome do responsável" autocomplete="off"></label>
            <canvas id="as-tec" class="vf-canvas" aria-label="Assinatura do responsável técnico"></canvas><div class="vf-assin-ac"><span class="hint">Assine com o dedo ou a caneta</span><button type="button" class="btn ghost small" data-as-limpar="tec">Limpar</button></div></div>
        </div>
      </div>

      <div class="panel vf-passo">
        <h3>2. Termo de recebimento do imóvel</h3>
        <p class="hint">O termo da SBJ, com a lista de chaves e objetos entregues. O parágrafo da instalação do reiki sai em todos os termos.</p>
        <label class="vt-campo">Proprietário(a)<input type="text" id="tm-nome" value="${escapeHtml(tm.nome)}" placeholder="Nome completo do proprietário" autocomplete="off"></label>
        <div class="vt-chips" style="margin:12px 0;"><button type="button" class="vt-chip ${tm.garagem ? "ativo" : ""}" id="tm-garagem">Vinculado à garagem</button></div>
        <div class="vt-rot">Chaves e objetos entregues <button type="button" class="vf-todos-sim" id="tm-todos">Marcar todos SIM</button></div>
        <div class="tm-lista">${tm.objetos.map((o, i) => `
          <div class="tm-obj2" data-i="${i}">
            <input type="number" min="0" class="tm-q" data-tm-q="${i}" value="${o.q}" aria-label="Quantidade">
            <input type="text" class="tm-n" data-tm-n="${i}" value="${escapeHtml(o.n)}" aria-label="Objeto">
            <div class="tm-sn" role="group" aria-label="Recebeu?"><button type="button" class="tm-btn ${o.r === "sim" ? "sim" : ""}" data-tm-r="${i}" data-v="sim">SIM</button><button type="button" class="tm-btn ${o.r === "nao" ? "nao" : ""}" data-tm-r="${i}" data-v="nao">NÃO</button></div>
          </div>`).join("")}</div>
        <label class="vt-campo" style="margin-top:10px;">Extra (opcional)<input type="text" id="tm-extra" value="${escapeHtml(tm.extra || "")}" placeholder="outro item entregue" autocomplete="off"></label>
        <div class="vf-assins um" style="margin-top:14px;"><div class="vf-assin"><label>Assinatura do proprietário(a)</label>
          <canvas id="as-termo" class="vf-canvas" aria-label="Assinatura do termo"></canvas><div class="vf-assin-ac"><span class="hint">Navegantes, ${fmtDate(v.date)}</span><button type="button" class="btn ghost small" data-as-limpar="termo">Limpar</button></div></div></div>
      </div>

      <div class="panel vf-passo">
        <h3>3. Documentos e e-mail</h3>
        <div class="vf-botoes"><button type="button" class="btn ghost" id="vf-pdf">PDF da vistoria assinada</button><button type="button" class="btn ghost" id="tm-pdf">PDF do termo de recebimento</button></div>
        <div class="vf-emails" style="margin-top:16px;">
          <label class="vt-campo">E-mail do proprietário<input type="email" id="vf-email" placeholder="nome@email.com" value="${escapeHtml(v.email || cliente.email || "")}" autocomplete="off"></label>
          <label class="vt-campo">Outro e-mail (opcional)<input type="email" id="vf-email2" placeholder="segundo e-mail, se tiver" value="${escapeHtml(v.email2 || "")}" autocomplete="off"></label>
        </div>
        <div class="vf-botoes"><button type="button" class="btn primary" id="vf-mail">Enviar os documentos por e-mail</button></div>
        <p class="hint">No celular e no tablet, abre a folha de compartilhar (Gmail, Mail…) com os PDFs já anexados, e o e-mail do cliente fica copiado para colar em "Para". No computador, baixa os PDFs e abre o e-mail; aí é preciso anexar os arquivos.</p>
      </div>

      <div class="vf-botoes fim"><button type="button" class="btn ghost" id="vf-detalhe">Ver as pendências do apartamento</button><button type="button" class="btn primary" id="vf-nova">Realizar outra vistoria</button></div>
    </div>`;

  const $ = id => root.querySelector("#" + id);
  $("vf-fim-voltar").onclick = vfSair;
  $("vf-detalhe").onclick = () => { vtAbertaId = v.id; vf = null; renderVistorias(); };
  $("vf-nova").onclick = () => { vf = null; vfAbrir(); };

  /* assinaturas na tela */
  const pads = {};
  [["prop", "as-prop", "prop"], ["tec", "as-tec", "tec"], ["termo", "as-termo", "termo"]].forEach(([chave, id, campo]) => {
    pads[chave] = vtAssinatura($(id), v.assin[campo] || "", (png) => { v.assin[campo] = png; persist(); });
  });
  root.querySelectorAll("[data-as-limpar]").forEach(btn => btn.onclick = () => vtConfirmar({
    titulo: "Apagar esta assinatura?",
    texto: "Esta assinatura registra que o cliente recebeu o imóvel e as chaves. Só apague se ela foi feita errada.",
    botao: "Sim, apagar assinatura",
    aoConfirmar: () => pads[btn.dataset.asLimpar].limpar() }));

  /* dados que o PDF usa */
  const salvaTexto = () => { v.nomeProp = $("vf-nome-prop").value.trim(); v.nomeTec = $("vf-nome-tec").value.trim(); tm.nome = $("tm-nome").value.trim(); tm.extra = $("tm-extra").value.trim(); persist(); };
  ["vf-nome-prop", "vf-nome-tec", "tm-nome", "tm-extra"].forEach(id => $(id).addEventListener("change", salvaTexto));
  $("tm-garagem").onclick = (e) => { tm.garagem = !tm.garagem; e.currentTarget.classList.toggle("ativo", tm.garagem); persist(); };
  root.querySelectorAll("[data-tm-q]").forEach(i => i.addEventListener("change", () => { tm.objetos[Number(i.dataset.tmQ)].q = Number(i.value) || 0; salvaObjetos(); }));
  root.querySelectorAll("[data-tm-n]").forEach(i => i.addEventListener("change", () => { tm.objetos[Number(i.dataset.tmN)].n = i.value.trim(); salvaObjetos(); }));
  const salvaObjetos = () => { persist(); try { localStorage.setItem("posvenda_vf_objetos", JSON.stringify(tm.objetos.map(o => ({ q: o.q, n: o.n })))); } catch (e) { /* sem armazenamento */ } };
  const pinta = () => root.querySelectorAll("[data-tm-r]").forEach(b => { const o = tm.objetos[Number(b.dataset.tmR)]; b.classList.toggle("sim", b.dataset.v === "sim" && o.r === "sim"); b.classList.toggle("nao", b.dataset.v === "nao" && o.r === "nao"); });
  root.querySelectorAll("[data-tm-r]").forEach(b => b.onclick = () => { const o = tm.objetos[Number(b.dataset.tmR)]; o.r = o.r === b.dataset.v ? "" : b.dataset.v; pinta(); persist(); });
  $("tm-todos").onclick = () => { tm.objetos.forEach(o => { o.r = "sim"; }); pinta(); persist(); };

  /* documentos */
  $("vf-pdf").onclick = async () => { salvaTexto(); await vfPdfVistoria(v); };
  $("tm-pdf").onclick = async () => { salvaTexto(); if (!tm.nome) { toast("Digite o nome do proprietário no termo.", "error"); $("tm-nome").focus(); return; } const r = await vfMontarTermo(v); if (!r) return; const feito = await vtEntregarPdf(r.doc, r.nome); if (feito !== "cancelado") toast(feito === "compartilhado" ? "PDF pronto para enviar." : "PDF do termo gerado.", "success"); };
  $("vf-mail").onclick = async () => {
    salvaTexto(); v.email = $("vf-email").value.trim(); v.email2 = $("vf-email2").value.trim(); persist();
    if (!/^\S+@\S+\.\S+$/.test(v.email || "")) { toast("Digite um e-mail válido.", "error"); $("vf-email").focus(); return; }
    if (v.email2 && !/^\S+@\S+\.\S+$/.test(v.email2)) { toast("O segundo e-mail não está válido.", "error"); $("vf-email2").focus(); return; }
    const emails = [v.email, v.email2].filter(Boolean);
    const t = vfTextoEmail(v), lista = [];
    const r1 = await vfMontarPdf(v); if (r1) lista.push(r1);
    if (tm.nome && v.assin.termo) { const r2 = await vfMontarTermo(v); if (r2) lista.push(r2); }
    if (!lista.length) { window.location.href = `mailto:${emails.map(e => encodeURIComponent(e)).join(",")}?subject=${encodeURIComponent(t.assunto)}&body=${encodeURIComponent(t.corpo)}`; return; }
    await vtEnviarPdfPorEmail(lista, null, emails.join(", "), t.assunto, t.corpo);
  };
}

async function vfPdfVistoria(v) {
  const r = await vfMontarPdf(v); if (!r) return;
  const feito = await vtEntregarPdf(r.doc, r.nome);
  if (feito !== "cancelado") toast(feito === "compartilhado" ? "PDF pronto para enviar." : "PDF gerado. Anexe ao e-mail do cliente.", "success");
}

async function vfMontarPdf(v) {
  if (!window.jspdf) { toast("Biblioteca de PDF não carregada.", "error"); return null; }
  const { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
  const M = 12, TEAL = [12, 107, 118], INK = [6, 27, 30], CINZA = [105, 115, 125], LINHA = [205, 212, 218];
  const b = getBuilding(v.buildingId), logo = await vtLogoDataUrl();
  const feitas = new Set();
  const cabecalho = () => {
    const n = doc.internal.getCurrentPageInfo().pageNumber; if (feitas.has(n)) return; feitas.add(n);
    if (logo) doc.addImage(logo, "PNG", M, 7, 17, 14.8);
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...INK); doc.text("Vistoria do imóvel", M + 21, 14);
    doc.setFontSize(10); doc.setTextColor(...TEAL); doc.text(b ? b.name : "", M + 21, 19.5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...INK);
    doc.text(`Apto ${v.unit}   |   Data: ${fmtDate(v.date)}${v.responsavel ? "   |   Responsável: " + v.responsavel : ""}`, pw - M, 14, { align: "right" });
    const cli = vtNomeCliente(v.buildingId, v.unit);
    if (cli) { doc.setFontSize(9.5); doc.setTextColor(60, 70, 78); doc.text(`Cliente: ${vtCorta(cli, 60)}`, pw - M, 19.5, { align: "right" }); }
    doc.setDrawColor(...TEAL); doc.setLineWidth(0.5); doc.line(M, 24, pw - M, 24);
  };
  cabecalho();
  let y = 28;
  const marcas = (v.folha && v.folha.marcas) || {};
  const ambs = (v.folha && v.folha.ambs) || [];
  ambs.forEach(a => {
    const itens = VF_MODELOS[a.modelo]; if (!itens) return;
    if (y + 6 + 4 * 4.4 > ph - 18) { doc.addPage(); cabecalho(); y = 28; }
    doc.autoTable({
      startY: y, margin: { left: M, right: M, top: 28, bottom: 16 }, theme: "plain",
      head: [[a.nome, "Certo", "Errado", "Observações"]],
      body: itens.map(it => { const m = marcas[a.nome + "|" + it]; return [it, "", "", vfTextoObs(m)]; }),
      styles: { font: "helvetica", fontSize: 8.6, cellPadding: { top: 1, bottom: 1, left: 1.6, right: 1.6 }, textColor: [30, 35, 40], valign: "middle", overflow: "linebreak" },
      headStyles: { fillColor: [236, 243, 244], textColor: INK, fontStyle: "bold", fontSize: 9.4 },
      columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 16, halign: "center" }, 2: { cellWidth: 17, halign: "center" } },
      didDrawPage: cabecalho,
      didDrawCell: (d) => {
        if (d.section === "head" && d.column.index > 0 && d.column.index < 3) return;
        doc.setDrawColor(...LINHA); doc.setLineWidth(0.12); doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
        if (d.section === "body" && (d.column.index === 1 || d.column.index === 2)) {
          const errado = !!marcas[a.nome + "|" + itens[d.row.index]], marcado = d.column.index === 2 ? errado : false;
          const cx = d.cell.x + d.cell.width / 2 - 1.7, cy = d.cell.y + (d.cell.height - 3.4) / 2;
          doc.setDrawColor(90, 100, 110); doc.setLineWidth(0.3); doc.rect(cx, cy, 3.4, 3.4);
          if (marcado) { doc.setDrawColor(...TEAL); doc.setLineWidth(0.6); doc.line(cx + .5, cy + .5, cx + 2.9, cy + 2.9); doc.line(cx + 2.9, cy + .5, cx + .5, cy + 2.9); }
        }
      },
    });
    y = doc.lastAutoTable.finalY + 3;
  });
  /* declaração e assinaturas (assinadas na tela, se já foram colhidas) */
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.8);
  const paras = VF_DECLARACAO.map(p => doc.splitTextToSize(p, pw - 2 * M - 6));
  const altDecl = paras.reduce((s, l) => s + l.length * 3.9 + 2, 0) + 4;
  if (y + altDecl + 40 > ph - 16) { doc.addPage(); cabecalho(); y = 30; }
  doc.setFillColor(244, 247, 248); doc.roundedRect(M, y, pw - 2 * M, altDecl, 1.5, 1.5, "F");
  let yy = y + 5.5; doc.setTextColor(50, 55, 60);
  paras.forEach(l => { doc.text(l, M + 3, yy, { lineHeightFactor: 1.3 }); yy += l.length * 3.9 + 2; });
  y += altDecl + 8;
  const sx1 = M + 4, sx2 = pw - M - 84, yl = y + 24;
  [[v.assin && v.assin.prop, sx1, "Proprietário(a) e/ou Procurador Legal", v.nomeProp !== undefined ? v.nomeProp : (v.termo && v.termo.nome) || vtNomeCliente(v.buildingId, v.unit)],
   [v.assin && v.assin.tec, sx2, "Responsável Técnico da SBJ Construtora", v.nomeTec !== undefined ? v.nomeTec : (v.responsavel || "")]].forEach(([img, x, rotulo, nome]) => {
    if (img) doc.addImage(img, "PNG", x + 10, y + 2, 60, 20);
    doc.setDrawColor(...CINZA); doc.setLineWidth(0.25); doc.line(x, yl, x + 80, yl);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...CINZA); doc.text(rotulo, x + 40, yl + 4.5, { align: "center" });
    if (nome) { doc.setFontSize(8.8); doc.setTextColor(...INK); doc.text(vtCorta(nome, 48), x + 40, yl + 9, { align: "center" }); }
  });
  y = yl + 14;
  const comFoto = v.items.filter(i => i.fotos && i.fotos.length);
  if (comFoto.length) await vtfPdfFotos(doc, cabecalho, comFoto.map(i => ({ ids: i.fotos, titulo: `${i.ambiente}  ·  ${i.tipo}`, texto: i.descricao })), { M, pw, ph, topo: 28 });
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(...CINZA); doc.setDrawColor(...LINHA); doc.line(M, ph - 11, pw - M, ph - 11); doc.text("SBJ Construtora e Incorporadora  |  Pós-obra", M, ph - 7); doc.text(`Página ${i} de ${total}`, pw - M, ph - 7, { align: "right" }); }
  return { doc, nome: vtNomeArquivo(["Vistoria", "Apto " + v.unit, vtObraCurta(b ? b.name : "obra"), vtDataArquivo(v.date)], "pdf") };
}


/* Termo de recebimento do imóvel (texto do modelo da SBJ; o parágrafo do reiki entra sempre) */
async function vfMontarTermo(v) {
  if (!window.jspdf) { toast("Biblioteca de PDF não carregada.", "error"); return null; }
  const tm = vfDadosTermo(v);
  const { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight(), M = 22, W = pw - 2 * M;
  const b = getBuilding(v.buildingId), logo = await vtLogoDataUrl();
  const edificio = b ? `Edifício ${b.name}` : "Edifício";
  let y = 24;
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(0, 0, 0);
  doc.text("TERMO DE RECEBIMENTO DO IMÓVEL", pw / 2, y, { align: "center" }); y += 11;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.3);
  const par = (texto, recuo) => {
    const linhas = doc.splitTextToSize(texto, W - (recuo || 0));
    doc.text(linhas, M + (recuo || 0), y, { align: "justify", maxWidth: W - (recuo || 0), lineHeightFactor: 1.38 });
    y += linhas.length * 5 + 3.2;
  };
  par(`${tm.nome.toUpperCase()}, proprietário do imóvel localizado no ${edificio}, apto nº. ${v.unit}${tm.garagem ? ", vinculado com sua respectiva garagem estabelecida em contrato" : ""}, declara expressamente que recebeu nesta data o referido imóvel para uso, em perfeitas condições de habitabilidade, tendo efetuado vistoria através de check-list específico e constatado que todas as suas instalações estão em perfeito estado de funcionamento, bem como não apresentam nenhum vício ou defeito construtivo aparente.`);
  par("Declara também que está ciente de que, a partir desta data, passa a contar com as garantias que lhe são asseguradas pelo Código Civil Brasileiro, o qual fixa em seis meses a responsabilidade do construtor pelos vícios ou defeitos redibitórios, isto é, ocultos, e em cinco anos pela solidez e segurança do imóvel contados a partir da data do Habite-se, fornecido pela Prefeitura Municipal de Navegantes/SC.", 8);
  par("Nos apartamentos que realizaram integração e não possuem o reiki instalado, a partir da realização da vistoria a instalação passa a ser de responsabilidade do proprietário. Dessa forma, orientamos que a instalação seja realizada imediatamente, pois a ausência do reiki pode permitir a entrada de água e, consequentemente, ocasionar problemas de infiltração e danos ao apartamento localizado no pavimento inferior. A instalação deve ser executada conforme as orientações e especificações técnicas aplicáveis, garantindo a adequada vedação e o correto escoamento da água.", 8);
  par("Concorda que, para prevenir dúvidas, todas as comunicações com a construtora deverão ser feitas por escrito, pela qual se obriga a tanto.", 8);
  doc.text("Recebe, nesta data, os seguintes documentos e objetos:", M + 8, y + 1); y += 5;
  const corpo = tm.objetos.filter(o => o.n).map(o => [String(o.q), o.n.toUpperCase(), "", ""]);
  corpo.push(["", "EXTRA:" + (tm.extra ? " " + tm.extra.toUpperCase() : ""), "", ""]);
  const respostas = tm.objetos.filter(o => o.n).map(o => o.r).concat([""]);
  doc.autoTable({
    startY: y, margin: { left: M - 4, right: M - 4 }, theme: "grid",
    head: [["QUANT.", "CHAVE/OBJETO", "SIM", "NÃO"]], body: corpo,
    styles: { font: "helvetica", fontSize: 9.3, cellPadding: 1.6, textColor: 0, lineColor: 0, lineWidth: 0.25, valign: "middle" },
    headStyles: { fillColor: 255, textColor: 0, fontStyle: "normal" },
    columnStyles: { 0: { cellWidth: 18, halign: "center" }, 2: { cellWidth: 16 }, 3: { cellWidth: 16 } },
    didDrawCell: (d) => {
      if (d.section !== "body" || (d.column.index !== 2 && d.column.index !== 3)) return;
      const r = respostas[d.row.index];
      if ((d.column.index === 2 && r === "sim") || (d.column.index === 3 && r === "nao")) {
        const cx = d.cell.x + d.cell.width / 2, cy = d.cell.y + d.cell.height / 2;
        doc.setDrawColor(0); doc.setLineWidth(0.55); doc.line(cx - 2, cy - 2, cx + 2, cy + 2); doc.line(cx + 2, cy - 2, cx - 2, cy + 2);
      }
    },
  });
  y = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(10.3); doc.setTextColor(0, 0, 0);
  const d = v.date.split("-");
  doc.text(`NAVEGANTES, ${d[2]} / ${d[1]} / ${d[0]}.`, pw - M, y, { align: "right" }); y += 6;
  if (v.assin && v.assin.termo) doc.addImage(v.assin.termo, "PNG", pw / 2 - 30, y, 60, 20);
  y += 22;
  doc.setDrawColor(0); doc.setLineWidth(0.3); doc.line(pw / 2 - 48, y, pw / 2 + 48, y);
  doc.text("PROPRIETÁRIO", pw / 2, y + 5.5, { align: "center" });
  /* rodapé da empresa */
  const yr = ph - 36;
  if (logo) doc.addImage(logo, "PNG", M - 4, yr - 4, 32, 27.9);
  doc.setFillColor(40, 48, 52); doc.roundedRect(pw - M - 86, yr + 2, 90, 15, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255); doc.setFontSize(8.2);
  doc.text("Rua Manoel Izidro, 75 • Centro • Navegantes • SC • Brasil", pw - M - 41, yr + 8, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.text("47 3319.8016", pw - M - 63, yr + 13, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.text("• sbjconstrutora.com.br", pw - M - 36, yr + 13, { align: "center" });
  return { doc, nome: vtNomeArquivo(["Termo de recebimento", "Apto " + v.unit, vtObraCurta(b ? b.name : "obra"), vtDataArquivo(v.date)], "pdf") };
}
