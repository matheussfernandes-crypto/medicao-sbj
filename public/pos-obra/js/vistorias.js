/* ---------- Vistorias: pendências da entrega do apartamento ----------
   Uma vistoria = um apartamento + uma data + várias pendências.
   Cada pendência tem ambiente, tipo (pintura, limpeza…), descrição e "resolvido".
   Cadastro rápido: escolhe ambiente e tipo UMA vez e digita (ou cola) várias linhas;
   a escolha fica valendo para as próximas linhas. */

const VT_AMBIENTES = ["Sala de estar", "Cozinha", "Lavanderia", "Sacada", "Circulação", "Entrada", "Lavabo", "Suíte 01", "BWC Suíte 01", "Suíte 02", "BWC Suíte 02", "Dormitório 01", "Dormitório 02", "Banheiro Demi", "Área técnica"];
const VT_TIPOS = ["Pintura", "Porta", "Esquadria", "Limpeza", "Pedreiro", "Revestimento", "Laminado", "Rodapé", "Silicone", "Rejunte", "Instalações elétricas", "Instalações hidráulicas", "Vaso sanitário", "Gesso", "Piso/Vinílico", "Churrasqueira", "Guarda-corpo", "Interfone", "Antena", "Outros"];

let vtAbertaId = null;      // vistoria aberta no detalhe
let vtFiltroPredio = "";
let vtAbaDet = "lista";          // aba da vistoria: "lista" (pendências) | "lancar"
let vtFiltroDet = "pendentes";   // filtro da lista: "pendentes" | "resolvidos" | "todas"
/* Itens cuja situação foi trocada AGORA continuam na lista, mesmo que o filtro os escondesse,
   para dar tempo de desfazer. Só saem quando a pessoa muda de filtro, de tela ou de apartamento. */
const vtPlanMantem = new Set();
const vtDetMantem = new Set();
let vtDetMantemDe = null;
let vtAmbienteAtual = VT_AMBIENTES[0];
let vtTipoAtual = VT_TIPOS[0];

/* nome do cliente (proprietário) da unidade, do cadastro de Clientes */
/* confirmação com botão claro (no lugar do confirm() do navegador, que fica feio e fácil de passar sem ler) */
function vtConfirmar({ titulo, texto, botao, aoConfirmar }) {
  openModal(`
    <div class="modal-header"><h3>${escapeHtml(titulo)}</h3><button class="modal-close" id="vc-x" aria-label="Fechar">×</button></div>
    <div class="modal-body"><p class="vt-confirma-txt">${escapeHtml(texto)}</p></div>
    <div class="modal-footer"><button class="btn ghost" id="vc-nao">Cancelar</button><button class="btn primary vt-perigo" id="vc-sim">${escapeHtml(botao)}</button></div>`);
  const $ = id => document.getElementById(id);
  $("vc-x").onclick = $("vc-nao").onclick = closeModal;
  $("vc-sim").onclick = () => { closeModal(); aoConfirmar(); };
}

/* cliente cadastrado (lista importada) de um apartamento, ou null */
function vtClienteDe(buildingId, unit) {
  return (state.clients || []).find(x => x.buildingId === buildingId && String(x.unit).toLowerCase() === String(unit).toLowerCase()) || null;
}
function vtNomeCliente(buildingId, unit) {
  const c = state.clients.find(x => x.buildingId === buildingId && String(x.unit).toLowerCase() === String(unit).toLowerCase());
  return c && c.name ? String(c.name).replace(/\s+/g, " ").trim() : "";
}
/* nomes de arquivo: "Pendências - Pintura - Campeche - 09-11-2026" */
function vtObraCurta(nome) {
  return String(nome || "").replace(/^Residencial\s+/i, "").replace(/^Ilhas?\s+(?:d[oae]s?)\s+/i, "").trim();
}
function vtNomeArquivo(partes, ext) {
  const limpa = (x) => String(x).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return partes.map(limpa).filter(Boolean).join(" - ") + "." + ext;
}
function vtDataArquivo(iso) { return fmtDate(iso).replace(/\//g, "-"); }

function vtCorta(texto, max) { return texto.length > max ? texto.slice(0, max - 1).trimEnd() + "…" : texto; }

function vtLista() { return state.vistorias || (state.vistorias = []); }
function vtId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function vtResumo(v) {
  const total = v.items.length, feitos = v.items.filter(i => i.feito).length;
  return { total, feitos, abertas: total - feitos, pct: total ? Math.round(feitos / total * 100) : 0 };
}

/* ---------- Lista de apartamentos ---------- */
let vtStatus = "pendentes";   // "pendentes" | "todos" | "resolvidos"
let vtBusca = "";
let vtModo = "aptos";        // "aptos" | "planilha"
let vtLimitePlanilha = 300;
let vtColDesc = "";   // filtro de texto da planilha
const vtSelApto = new Set(), vtSelData = new Set(), vtSelTipo = new Set(), vtSelAmb = new Set();   // filtros de várias opções (cabeçalhos da planilha)

function vtFiltrada() {
  const q = vtBusca.trim().toLowerCase();
  return vtLista().filter(v => (!vtFiltroPredio || v.buildingId === vtFiltroPredio)
      && (!q || v.unit.toLowerCase().includes(q))
      && (vtStatus === "todos" || (vtStatus === "pendentes" ? vtResumo(v).abertas > 0 : vtResumo(v).abertas === 0)))
    .sort((a, b) => ((getBuilding(a.buildingId) || {}).name || "").localeCompare((getBuilding(b.buildingId) || {}).name || "", "pt-BR")
      || a.unit.localeCompare(b.unit, "pt-BR", { numeric: true }));
}

function vtRenderGrade(root) {
  const lista = vtFiltrada();
  const grade = root.querySelector("#vt-grade");
  if (!lista.length) {
    grade.innerHTML = vtLista().length
      ? `<div class="vt-vazio pequeno">Nenhum apartamento com esses filtros.</div>`
      : `<div class="vt-vazio"><h3>Nenhuma vistoria ainda</h3><p>Faça a vistoria de um apartamento na hora, cadastre as pendências de uma vez ou importe a planilha da obra.</p><button type="button" class="btn primary" id="vt-nova2">+ Cadastrar pendências</button></div>`;
    const n2 = grade.querySelector("#vt-nova2"); if (n2) n2.addEventListener("click", vtAbrirNova);
    return;
  }
  const grupos = new Map();
  lista.forEach(v => { if (!grupos.has(v.buildingId)) grupos.set(v.buildingId, []); grupos.get(v.buildingId).push(v); });
  grade.innerHTML = Array.from(grupos.entries()).map(([bid, vs]) => {
    const b = getBuilding(bid), abertas = vs.reduce((n, v) => n + vtResumo(v).abertas, 0);
    return `<section class="vt-obra">
      <h3 class="vt-obra-titulo">${b ? escapeHtml(b.name) : "Sem empreendimento"}<span>${vs.length} apto${vs.length === 1 ? "" : "s"} · ${abertas} a resolver</span></h3>
      <div class="vt-grid">${vs.map(v => {
        const r = vtResumo(v), feito = !r.abertas;
        return `<button type="button" class="vt-card ${feito ? "pronto" : ""}" data-vt="${v.id}">
          <span class="vt-unidade">${escapeHtml(v.unit)}</span>
          <span class="vt-trilho"><span style="width:${feito ? 100 : r.pct}%"></span></span>
          <span class="vt-meta">${!r.total ? "Sem pendências" : feito ? "Tudo resolvido" : `<strong>${r.abertas}</strong> a resolver`}${r.total ? ` · ${r.total} no total` : ""}</span>
          <span class="vt-meta">vistoria ${fmtDate(v.date)}</span>
        </button>`;
      }).join("")}</div>
    </section>`;
  }).join("");
  grade.querySelectorAll("[data-vt]").forEach(b => b.addEventListener("click", () => { vtAbertaId = b.dataset.vt; renderVistorias(); window.scrollTo({ top: 0 }); }));
}

// o menu "Controle de entregas" abre a tela de Vistorias já no modo controle; "Vistorias" volta ao modo Apartamentos
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest('.nav-btn[data-view="vistorias"]');
  if (!b) return;
  vtModo = b.dataset.modo || "aptos";
  // ao abrir o controle, busca de novo no Andamento (para refletir o que acabou de ser marcado)
  if (vtModo === "controle") vtCtrl.lista = null;
  setTimeout(() => document.querySelectorAll(".nav-btn").forEach(x => x.classList.toggle("active", x === b)), 0);
}, true);

document.addEventListener("click", e => { document.querySelectorAll("details.vt-mais[open]").forEach(d => { if (!d.contains(e.target) || e.target.closest(".vt-mais-p button")) d.open = false; }); });

// chamados pelo menu do site (/posobra/controle e /posobra/vistorias)
window.vtAbrirControle = () => { vtModo = "controle"; vtCtrl.lista = null; showView("vistorias"); };
window.vtAbrirVistorias = () => { if (vtModo === "controle") vtModo = "aptos"; showView("vistorias"); };

function renderVistorias() {
  const root = document.getElementById("view-vistorias");
  if (!root) return;
  if (typeof vfAtiva === "function" && vfAtiva()) { vfRender(root); return; }
  if (vtAbertaId && vtLista().some(v => v.id === vtAbertaId)) { renderVistoriaDetalhe(root); return; }
  vtAbertaId = null; vtDetMantemDe = null;
  if (typeof vfAtiva === "function" && vfAtiva()) { vfRender(root); return; }

  const todas = vtLista();
  const predios = state.buildings.filter(b => todas.some(v => v.buildingId === b.id));
  const baseObra = todas.filter(v => !vtFiltroPredio || v.buildingId === vtFiltroPredio);
  const plan = vtModo === "planilha";
  const controle = vtModo === "controle";
  const itensBase = baseObra.flatMap(v => v.items.filter(i => (!vtSelApto.size || vtSelApto.has(v.unit)) && (!vtSelData.size || vtSelData.has(v.date)) && (!vtSelTipo.size || vtSelTipo.has(i.tipo)) && (!vtSelAmb.size || vtSelAmb.has(i.ambiente))));
  const nPend = plan ? itensBase.filter(i => !i.feito).length : baseObra.filter(v => vtResumo(v).abertas > 0).length;
  const nRes = plan ? itensBase.filter(i => i.feito).length : baseObra.filter(v => vtResumo(v).abertas === 0).length;
  const nTodos = plan ? itensBase.length : baseObra.length;
  const totalAbertas = baseObra.reduce((n, v) => n + vtResumo(v).abertas, 0);
  const tiposDisp = Array.from(new Set(baseObra.flatMap(v => v.items.map(i => i.tipo)))).sort((a, b) => a.localeCompare(b, "pt-BR"));

  root.innerHTML = `
    <div class="vt-modos" role="group" aria-label="Forma de ver">
      <button type="button" class="vt-modo ${!plan && !controle ? "ativo" : ""}" data-vt-modo="aptos">Apartamentos</button>
      <button type="button" class="vt-modo ${plan ? "ativo" : ""}" data-vt-modo="planilha">Planilha</button>
    </div>
    <div class="vt-barra">
      <label class="vt-campo">Obra<select id="vt-predio"><option value="">Todas as obras</option>${predios.map(b => `<option value="${b.id}" ${b.id === vtFiltroPredio ? "selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}</select></label>
      ${plan || controle ? "" : `
      <label class="vt-campo">Apartamento<input type="search" id="vt-busca" placeholder="ex: 404" value="${escapeHtml(vtBusca)}" autocomplete="off"></label>
      <label class="vt-campo">Situação<select id="vt-status"><option value="pendentes" ${vtStatus === "pendentes" ? "selected" : ""}>${plan ? "A resolver" : "Com pendência"} (${nPend})</option><option value="resolvidos" ${vtStatus === "resolvidos" ? "selected" : ""}>${plan ? "Resolvidas" : "Tudo resolvido"} (${nRes})</option><option value="todos" ${vtStatus === "todos" ? "selected" : ""}>Todos (${nTodos})</option></select></label>
      `}
      <div class="vt-acoes">
        <button type="button" class="btn ghost" id="vt-agenda">Agenda</button>
        <button type="button" class="btn ghost" id="vt-relatorio">Gerar relatório</button>
        <button type="button" class="btn ghost" id="vt-importar" title="Importar planilha">Importar</button>
        <button type="button" class="btn ghost" id="vt-nova">Cadastrar pendências</button>
        <button type="button" class="btn primary" id="vt-folha">Realizar vistoria</button>
      </div>
    </div>
    <div class="vt-total"><strong>${totalAbertas}</strong> pendência${totalAbertas === 1 ? "" : "s"} a resolver${vtFiltroPredio ? " nesta obra" : " no total"} <span id="vt-sync-estado" class="vt-sync-estado"></span></div>
    <div id="vt-grade"></div>`;

  if (controle) { const m = root.querySelector(".vt-modos"); if (m) m.remove(); }
  root.querySelector("#vt-predio").addEventListener("change", e => { vtFiltroPredio = e.target.value; renderVistorias(); });
  const campoBusca = root.querySelector("#vt-busca"); if (campoBusca) campoBusca.addEventListener("input", e => { vtBusca = e.target.value; root.classList.add("vt-sem-anim"); vtRenderGrade(root); });
  const selStatus = root.querySelector("#vt-status"); if (selStatus) selStatus.addEventListener("change", e => { vtStatus = e.target.value; renderVistorias(); });
  root.querySelectorAll("[data-vt-st]").forEach(b => b.addEventListener("click", () => { vtStatus = b.dataset.vtSt; renderVistorias(); }));
  root.querySelector("#vt-nova").addEventListener("click", vtAbrirNova);
  root.querySelector("#vt-importar").addEventListener("click", vtEscolherPlanilha);
  root.querySelector("#vt-relatorio").addEventListener("click", vtAbrirRelatorio);
  root.querySelector("#vt-folha").addEventListener("click", vfAbrir);
  root.querySelector("#vt-agenda").addEventListener("click", () => showView("vtagenda"));
  root.querySelectorAll("[data-vt-modo]").forEach(b => b.addEventListener("click", () => { vtModo = b.dataset.vtModo; vtLimitePlanilha = 300; renderVistorias(); }));
  if (controle) vtRenderControle(root); else if (plan) vtRenderPlanilha(root); else vtRenderGrade(root);
  if (window.SBJSync) SBJSync.avisar();
}

/* ---------- Controle de entregas: quem já pode ser agendado, quem espera obra ou financiamento ---------- */
const VTC_FIN = { "": "—", nao: "Não financia", analise: "Financiando", aprovado: "Aprovado" };
// Andamento de Obra: % de cada empreendimento e Pintura Final de cada apartamento (vem de /api/posvenda/andamento)
const vtChaveEmp = (nome) => String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/^residencial\s+/, "").replace(/^ilhas?\s+(de|do|da|dos|das)\s+/, "").replace(/^ilhas?\s+/, "").trim();
let vtCtrl = { lista: null, carregando: false, erro: "", emp: "" };
async function vtCtrlCarregar() {
  vtCtrl.carregando = true;
  try {
    const r = await fetch("/api/posvenda/andamento", { credentials: "include", cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.erro || "Não foi possível ler o Andamento de Obra.");
    await vtCadCarregar();
    vtCtrl.lista = j.empreendimentos || [];
    vtCtrl.erro = "";
    // abre sempre no empreendimento com maior % (a lista já vem ordenada assim)
    if (!vtCtrl.lista.some(e => e.id === vtCtrl.emp)) vtCtrl.emp = vtCtrl.lista[0] ? vtCtrl.lista[0].id : "";
  } catch (e) { vtCtrl.lista = []; vtCtrl.erro = String(e.message || e); }
  finally { vtCtrl.carregando = false; }
  renderVistorias();
}
function vtEmpSel() { return (vtCtrl.lista || []).find(e => e.id === vtCtrl.emp) || null; }
// true = Pintura Final finalizada · false = não · null = ainda não ligado ao Andamento
function vtObraPronta(c) {
  const b = getBuilding(c.buildingId) || {};
  const emp = (vtCtrl.lista || []).find(e => e.chave === vtChaveEmp(b.name));
  if (!emp || !emp.temPintura) return null;
  const ap = emp.aptos.find(a => String(a.unit) === String(c.unit));
  if (!ap) return null;
  return ap.pintura === 2;
}
function vtControleDados() {
  const ag = (typeof va !== "undefined" && va.lista) || [];
  // só apartamentos (número): salas comerciais e outras unidades com nome não entram no controle
  return vtCadBase().filter(c => c.unit && /^\d/.test(String(c.unit).trim())).map(c => {
    const b = getBuilding(c.buildingId) || {};
    const itens = ag.filter(x => x.buildingId === c.buildingId && String(x.unit).toLowerCase() === String(c.unit).toLowerCase() && x.status !== "cancelada");
    const feita = itens.find(x => x.status === "realizada");
    const marcada = itens.filter(x => x.status === "agendada").sort((p, q) => (p.date + (p.hora || "")).localeCompare(q.date + (q.hora || "")))[0];
    const fin = c.financiamento || "";
    const obra = vtObraPronta(c);
    let st, cls;
    if (feita) { st = "Vistoria realizada"; cls = "feita"; }
    else if (marcada) { st = "Agendada"; cls = "agendada"; }
    else if (c.situacaoVistoria === "financiamento") { st = "Financiamento — não agendar"; cls = "fin"; }
    else if (c.situacaoVistoria === "obra") { st = "Aguardando obra"; cls = "obra"; }
    else if (c.situacaoVistoria === "liberado") { st = "Liberado p/ agendar"; cls = "ok"; }
    else if (fin === "analise") { st = "Financiamento — não agendar"; cls = "fin"; }
    else if (obra !== true) { st = "Aguardando obra"; cls = "obra"; }
    else { st = "Liberado p/ agendar"; cls = "ok"; }
    const data = marcada ? fmtDate(marcada.date) + (marcada.hora ? " · " + marcada.hora : "") : feita ? fmtDate(feita.date) : "";
    const iso = marcada ? marcada.date + (marcada.hora ? " " + marcada.hora : "") : feita ? feita.date : "";
    return { c, b, st, cls, data, iso, fin, obra, feita: !!feita, marcada: !!marcada };
  });
}
/* filtros e ordem no título de cada coluna, e páginas da tabela do controle (20 por página, como na Medição) */
const vtcF = { apto: [], cliente: [], vaga: [], fin: [], pintura: [], sit: [], data: [] };
let vtcOrd = null;   // { k, d } — sem escolha: ordem crescente de apartamento
let vtcPag = 0;
const VTC_POR = 20;
const VTC_SIT = { ok: "Liberado p/ agendar", agendada: "Agendada", feita: "Vistoria realizada", fin: "Financiamento — não agendar", obra: "Aguardando obra" };
const VTC_COLS = {
  apto: { rot: "Apto", val: l => String(l.c.unit), ord: [["asc", "Menor → maior"], ["desc", "Maior → menor"]] },
  cliente: { rot: "Cliente", val: l => l.c.name || "", lab: v => v || "Sem cliente", ord: [["asc", "A → Z"], ["desc", "Z → A"]] },
  vaga: { rot: "Vaga", val: l => l.c.garage || "", lab: v => v || "—", ord: [["asc", "Menor → maior"], ["desc", "Maior → menor"]] },
  fin: { rot: "Financiamento", val: l => l.fin || "", lab: v => VTC_FIN[v] || "—", ord: null },
  pintura: { rot: "Pintura final", val: l => l.obra === null ? "ligar" : l.obra ? "pronta" : "nao", lab: v => ({ ligar: "a ligar", pronta: "Pronta", nao: "Não pronta" })[v] || v, ord: null },
  sit: { rot: "Situação", val: l => l.cls, lab: v => VTC_SIT[v] || v, ord: null },
  data: { rot: "Data", val: l => (l.iso || "").slice(0, 10), lab: v => v ? fmtDate(v) : "Sem data", ordv: l => l.iso || "~", ord: [["asc", "Mais antigas"], ["desc", "Mais recentes"]] }
};
function vtcPassa(l, excluir) {
  for (const k in vtcF) { if (k !== excluir && vtcF[k].length && !vtcF[k].includes(VTC_COLS[k].val(l))) return false; }
  return true;
}
let vtcAtual = null;   // { grade, linhas } da tabela na tela (para o menu do título)
function vtcCabecalho(grade) {
  const tr = grade.querySelector("#vtc-cab"); if (!tr) return;
  tr.innerHTML = "<th>Obra</th>" + Object.keys(VTC_COLS).map(k => `<th>${tfcBotao("vtc:" + k, VTC_COLS[k].rot, vtcF[k].length, vtcOrd && vtcOrd.k === k ? vtcOrd.d : null)}</th>`).join("");
}
document.addEventListener("click", e => {
  const h = e.target.closest && e.target.closest('[data-tfc^="vtc:"]'); if (!h || !vtcAtual) return;
  e.preventDefault(); e.stopPropagation();
  const k = h.dataset.tfc.slice(4), def = VTC_COLS[k], { grade, linhas } = vtcAtual;
  const base = linhas.filter(l => vtcPassa(l, k));
  let valores = tfcContar(base, def.val, def.lab, false);
  vtcF[k].forEach(v => { if (!valores.some(x => x.v === v)) valores.push({ v, l: def.lab ? def.lab(v) : v, n: 0 }); });
  valores.sort((a, b) => k === "data" ? String(a.v || "~").localeCompare(String(b.v || "~")) : a.l.localeCompare(b.l, "pt-BR", { numeric: true }));
  tfcAbrir(h, { chave: h.dataset.tfc, ord: def.ord, ordAtual: vtcOrd && vtcOrd.k === k ? vtcOrd.d : null, valores, marcados: vtcF[k],
    onOrdem: d => { vtcOrd = d ? { k, d } : null; vtcDesenharLinhas(grade, linhas); tfcReancorar(); },
    onMarcar: arr => { vtcF[k] = arr; vtcPag = 0; vtcDesenharLinhas(grade, linhas); tfcReancorar(); } });
}, true);
function vtcDesenharLinhas(grade, linhas) {
  const vis = linhas.filter(l => vtcPassa(l));
  if (vtcOrd) {
    const def = VTC_COLS[vtcOrd.k], m = vtcOrd.d === "desc" ? -1 : 1, v = def.ordv || def.val;
    vis.sort((a, b) => String(v(a)).localeCompare(String(v(b)), "pt-BR", { numeric: true }) * m || String(a.c.unit).localeCompare(String(b.c.unit), "pt-BR", { numeric: true }));
  }
  vtcCabecalho(grade);
  const pags = Math.max(1, Math.ceil(vis.length / VTC_POR));
  if (vtcPag > pags - 1) vtcPag = pags - 1;
  const pagina = vis.slice(vtcPag * VTC_POR, vtcPag * VTC_POR + VTC_POR);
  const sitOpc = [["", "Automática"], ["financiamento", "Financiamento — não agendar"], ["obra", "Aguardando obra"], ["liberado", "Liberado p/ agendar"]];
  grade.querySelector("#vtc-corpo").innerHTML = pagina.map(l => `<tr class="vtc-l">
      <td>${escapeHtml(l.b.name || "")}</td>
      <td><strong>${escapeHtml(l.c.unit)}</strong></td>
      <td>${l.c.name ? escapeHtml(l.c.name) : '<span class="empty-hint">sem cliente</span>'}</td>
      <td>${l.c.garage ? escapeHtml(l.c.garage) : "—"}</td>
      <td>${VTC_FIN[l.fin] || "—"}</td>
      <td>${l.obra === null ? "a ligar" : l.obra ? "Pronta" : "Não pronta"}</td>
      <td>${l.feita || l.marcada ? `<span class="vtc-tag vtc-${l.cls}">${l.st}</span>` : `<select class="vtc-sit" data-id="${escapeHtml(l.c.id)}">${sitOpc.map(([v, t]) => `<option value="${v}" ${(l.c.situacaoVistoria || "") === v ? "selected" : ""}>${t}</option>`).join("")}</select>`}</td>
      <td>${l.data || "—"}</td></tr>`).join("")
    || `<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--text-muted)">${linhas.length ? "Nenhum apartamento com esses filtros." : "Nenhum apartamento deste empreendimento."}</td></tr>`;
  grade.querySelectorAll(".vtc-sit").forEach(s => s.onchange = () => vtSituacaoSalvar(s.dataset.id, s.value));
  const filtrando = Object.values(vtcF).some(a => a.length) || !!vtcOrd;
  grade.querySelector("#vtc-conta").textContent = filtrando ? `${vis.length} de ${linhas.length} apartamentos` : `${linhas.length} apartamento${linhas.length === 1 ? "" : "s"}`;
  grade.querySelector("#vtc-limpar").hidden = !filtrando;
  grade.querySelector("#vtc-limpar").textContent = "Limpar filtros";
  // páginas: 1 … atual-1 atual atual+1 … última
  const pager = grade.querySelector("#vtc-pager");
  if (pags < 2) { pager.innerHTML = ""; return; }
  const nums = [];
  for (let i = 0; i < pags; i++) {
    if (i === 0 || i === pags - 1 || Math.abs(i - vtcPag) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  pager.innerHTML = `<span>${vtcPag * VTC_POR + 1}–${Math.min(vis.length, vtcPag * VTC_POR + VTC_POR)} de ${vis.length}</span>
    <div class="vtc-pg">
      <button type="button" data-pg="${vtcPag - 1}" ${vtcPag === 0 ? "disabled" : ""} aria-label="Página anterior">‹</button>
      ${nums.map(n => n === "…" ? `<span style="padding:0 4px">…</span>` : `<button type="button" data-pg="${n}" class="${n === vtcPag ? "atual" : ""}">${n + 1}</button>`).join("")}
      <button type="button" data-pg="${vtcPag + 1}" ${vtcPag === pags - 1 ? "disabled" : ""} aria-label="Próxima página">›</button>
    </div>`;
  pager.querySelectorAll("[data-pg]").forEach(b => b.onclick = () => {
    vtcPag = +b.dataset.pg; vtcDesenharLinhas(grade, linhas);
    const q = grade.querySelector(".vtc-quadro"); if (q) q.scrollIntoView({ block: "start", behavior: "smooth" });
  });
}
function vtRenderControle(root) {
  const grade = root.querySelector("#vt-grade");
  if (!vtCtrl.lista && !vtCtrl.carregando) vtCtrlCarregar();
  const emp = vtEmpSel();
  const seletor = `<style>.vtc-emp{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0 4px}.vtc-emp select{min-width:280px;padding:8px 10px;border-radius:10px;border:1px solid var(--border,#e2e6ec);font:inherit;background:var(--surface,#fff)}.vtc-msg{font-size:13px;color:var(--text-muted,#64748b)}.vtc-erro{color:#b91c1c}.vtc-ov{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:9000;padding:16px}.vtc-box{background:#fff;border-radius:14px;padding:18px;max-width:520px;width:100%}.vtc-box textarea{width:100%;font:13px monospace;margin:8px 0;padding:8px;border:1px solid #e2e6ec;border-radius:8px}.vtc-acoes2{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}</style>
    <div class="vtc-emp"><label>Empreendimento <select id="vtc-emp">${(vtCtrl.lista || []).map(e => `<option value="${escapeHtml(e.id)}" ${emp && e.id === emp.id ? "selected" : ""}>${escapeHtml(e.nome)} · ${e.pct}%</option>`).join("")}</select></label>${vtCtrl.carregando ? `<span class="vtc-msg">Carregando do Andamento…</span>` : ""}${vtCtrl.erro ? `<span class="vtc-msg vtc-erro">${escapeHtml(vtCtrl.erro)}</span>` : ""}</div>`;
  // cada empreendimento tem a sua tabela; um novo empreendimento aparece aqui sozinho quando entrar no Andamento
  let linhas = vtControleFiltradas(); // já vem em ordem crescente de apartamento
  const cont = k => linhas.filter(l => l.cls === k).length;
  const cartoes = [["ok", "Liberado p/ agendar"], ["agendada", "Agendadas"], ["feita", "Realizadas"], ["fin", "Financiamento"], ["obra", "Aguardando obra"]]
    .map(([k, t]) => `<div class="vtc-card vtc-${k}"><strong>${cont(k)}</strong><span>${t}</span></div>`).join("");
  grade.innerHTML = `
    <style>
      .vtc-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 12px 0 16px; }
      .vtc-card { background: var(--surface, #fff); border: 1px solid var(--border, #e2e6ec); border-left: 4px solid #94a3b8; border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; }
      .vtc-card strong { font-size: 26px; line-height: 1; }
      .vtc-card span { font-size: 13px; color: var(--text-muted, #64748b); }
      .vtc-card.vtc-ok { border-left-color: #1f8a4c; } .vtc-card.vtc-agendada { border-left-color: #0C6B76; }
      .vtc-card.vtc-feita { border-left-color: #16a34a; } .vtc-card.vtc-fin { border-left-color: #dc2626; } .vtc-card.vtc-obra { border-left-color: #f59e0b; }
      .vtc-quadro { background: var(--panel, #fff); border: 1px solid var(--border, #e2e6ec); border-radius: 14px; padding: 6px 6px 4px; }
      .vtc-wrap { overflow-x: auto; }
      .vtc-tab { width: 100%; border-collapse: collapse; font-size: 14px; background: var(--panel, #fff); }
      .vtc-tab th { text-align: left; font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted, #64748b); padding: 12px 12px 10px; background: var(--panel, #fff); border-bottom: 1px solid var(--border, #e2e6ec); }
      .vtc-tab tr.vtc-filtros th { padding: 0 6px 10px; border-bottom: 1px solid var(--border, #e2e6ec); text-transform: none; letter-spacing: 0; }
      .vtc-filtros input, .vtc-filtros select { width: 100%; min-width: 70px; box-sizing: border-box; height: 32px; padding: 0 8px; border: 1px solid var(--border, #e2e6ec); border-radius: 8px; font: inherit; font-size: 12.5px; font-weight: 400; color: var(--text, #14242a); background-color: var(--panel, #fff); }
      .vtc-filtros input:focus, .vtc-filtros select:focus { outline: none; border-color: var(--primary, #00687a); box-shadow: 0 0 0 3px rgba(0,104,122,.15); }
      .vtc-tab td { padding: 9px 12px; border-bottom: 1px solid var(--ps-linha, #e8eef0); vertical-align: middle; }
      .vtc-tab tbody tr:last-child td { border-bottom: 0; }
      .vtc-tab tbody tr:hover td { background: rgba(0, 104, 122, .04); }
      .vtc-topo { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 4px 8px 8px; font-size: 12.5px; color: var(--text-muted, #64748b); }
      .vtc-limpar { border: 0; background: none; color: var(--primary, #00687a); font: inherit; font-weight: 600; cursor: pointer; padding: 0; }
      .vtc-pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 8px 6px; border-top: 1px solid var(--border, #e2e6ec); font-size: 12px; color: var(--text-muted, #64748b); }
      .vtc-pager:empty { display: none; }
      .vtc-pg { display: flex; align-items: center; gap: 4px; }
      .vtc-pg button { min-width: 32px; height: 32px; padding: 0 8px; border-radius: 9px; border: 1px solid var(--border, #dfe5e7); background: var(--panel, #fff); color: var(--text, #33424a); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
      .vtc-pg button:hover:not(:disabled) { border-color: var(--primary, #00687a); color: var(--primary, #00687a); }
      .vtc-pg button:disabled { opacity: .4; cursor: default; }
      .vtc-pg button.atual { background: var(--primary, #00687a); border-color: var(--primary, #00687a); color: #fff; }
      .vtc-tag { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
      .vtc-tag.vtc-ok { background: #dcfce7; color: #15803d; } .vtc-tag.vtc-agendada { background: #cffafe; color: #0e7490; }
      .vtc-tag.vtc-feita { background: #bbf7d0; color: #166534; } .vtc-tag.vtc-fin { background: #fee2e2; color: #b91c1c; } .vtc-tag.vtc-obra { background: #fef3c7; color: #b45309; }
    </style>
    ${seletor}
    <div class="vtc-cards">${cartoes}</div>
    <div class="vtc-quadro">
      <div class="vtc-topo"><span id="vtc-conta"></span><button type="button" class="vtc-limpar" id="vtc-limpar" hidden>Limpar filtros</button></div>
      <div class="vtc-wrap"><table class="vtc-tab"><thead><tr id="vtc-cab"></tr></thead>
      <tbody id="vtc-corpo"></tbody></table></div>
      <div class="vtc-pager" id="vtc-pager"></div>
    </div>`;
  const sel = grade.querySelector("#vtc-emp");
  if (sel) sel.onchange = e => { vtCtrl.emp = e.target.value; vtcPag = 0; renderVistorias(); };
  grade.querySelector("#vtc-limpar").onclick = () => { tfcFechar(); Object.keys(vtcF).forEach(k => vtcF[k] = []); vtcOrd = null; vtcPag = 0; renderVistorias(); };
  vtcAtual = { grade, linhas };
  vtcDesenharLinhas(grade, linhas);
  // no controle, as ações da tela Vistorias são trocadas por estas duas
  const acoes = root.querySelector(".vt-acoes");
  if (acoes) {
    acoes.innerHTML = `<button type="button" class="btn ghost" id="vtc-imp">Importar financiamento</button><button type="button" class="btn primary" id="vtc-rel">Gerar relatório (PDF)</button>`;
    acoes.querySelector("#vtc-imp").onclick = vtControleImportarFin;
    acoes.querySelector("#vtc-rel").onclick = vtControlePdf;
  }
}

/* relatório em PDF do controle de entregas (A4 paisagem), no mesmo padrão dos relatórios de vistoria */
async function vtControlePdf() {
  if (!window.jspdf) { toast("Biblioteca de PDF não carregada.", "error"); return; }
  const emp = vtEmpSel();
  if (!emp) return;
  const linhas = vtControleFiltradas().slice().sort((a, b) => String(a.c.unit).localeCompare(String(b.c.unit), "pt-BR", { numeric: true }));
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
  const M = 10, TEAL = [12, 107, 118], INK = [6, 27, 30], CINZA = [105, 115, 125];
  const logo = await vtLogoDataUrl();
  const emitido = new Date().toLocaleDateString("pt-BR");
  const CORES = { ok: [22, 128, 61], agendada: [12, 107, 118], feita: [21, 128, 61], fin: [185, 28, 28], obra: [180, 83, 9] };

  const topo = (primeira) => {
    if (logo) doc.addImage(logo, "PNG", M, primeira ? 7 : 5, primeira ? 19 : 11, primeira ? 16.5 : 9.5);
    const x = M + (logo ? (primeira ? 23 : 14) : 0);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...INK);
    if (primeira) {
      doc.setFontSize(16); doc.text("Controle de entregas", x, 14);
      doc.setFontSize(11); doc.setTextColor(...TEAL); doc.text(emp.nome, x, 20);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.8); doc.setTextColor(...CINZA);
      doc.text(`${linhas.length} apartamento(s) · pintura final conforme o Andamento de Obra`, x, 25.3);
      doc.text(`Emitido em ${emitido}`, pw - M, 12, { align: "right" });
      doc.setDrawColor(...TEAL); doc.setLineWidth(0.6); doc.line(M, 29, pw - M, 29);
    } else {
      doc.setFontSize(10.5); doc.text(`Controle de entregas · ${emp.nome}`, x, 11);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...CINZA);
      doc.text(`Emitido em ${emitido}`, pw - M, 11, { align: "right" });
      doc.setDrawColor(...TEAL); doc.setLineWidth(0.4); doc.line(M, 15.5, pw - M, 15.5);
    }
  };

  // resumo: quantos em cada situação
  const cards = [["ok", "Liberado p/ agendar"], ["agendada", "Agendadas"], ["feita", "Realizadas"], ["fin", "Financiamento"], ["obra", "Aguardando obra"]];
  const cw = (pw - 2 * M - 4 * 3) / 5;
  cards.forEach(([k, t], i) => {
    const x = M + i * (cw + 3), y = 33;
    doc.setFillColor(246, 248, 250); doc.setDrawColor(...LINHA_CARD());
    doc.roundedRect(x, y, cw, 16, 2, 2, "FD");
    doc.setFillColor(...CORES[k]); doc.rect(x, y, 1.6, 16, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...INK);
    doc.text(String(linhas.filter(l => l.cls === k).length), x + 6, y + 9.5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.8); doc.setTextColor(...CINZA);
    doc.text(t, x + 6, y + 13.8);
  });

  const corpo = linhas.map(l => [
    l.c.unit, l.c.name || "sem cliente", l.c.garage || "—", VTC_FIN[l.fin] || "—",
    l.obra === null ? "a ligar" : l.obra ? "Pronta" : "Não pronta", l.st, l.data || "—",
  ]);
  doc.autoTable({
    startY: 52,
    tableWidth: pw - 2 * M, // a tabela ocupa a largura da folha (deitada), sem cortar colunas
    margin: { left: M, right: M, top: 20, bottom: 14 },
    head: [["Apto", "Cliente", "Vaga", "Financiamento", "Pintura final", "Situação", "Data"]],
    body: corpo,
    theme: "striped",
    styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 1.1, bottom: 1.1, left: 1.8, right: 1.8 }, textColor: [30, 35, 40], valign: "middle", overflow: "linebreak" },
    headStyles: { fillColor: TEAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [247, 249, 250] },
    columnStyles: { 0: { cellWidth: 13, fontStyle: "bold" }, 1: { cellWidth: "auto" }, 2: { cellWidth: 20 }, 3: { cellWidth: 25 }, 4: { cellWidth: 21 }, 5: { cellWidth: 32, fontStyle: "bold" }, 6: { cellWidth: 17 } },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 5) { const l = linhas[d.row.index]; if (l) d.cell.styles.textColor = CORES[l.cls] || INK; }
      if (d.section === "body" && d.column.index === 4) { const t = d.cell.raw; d.cell.styles.textColor = t === "Pronta" ? CORES.ok : t === "Não pronta" ? CORES.obra : CINZA; }
    },
    didDrawPage: (d) => topo(d.pageNumber === 1),
  });
  const paginas = doc.internal.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...CINZA);
    doc.text(`SBJ Construtora e Incorporadora · Controle de entregas · Página ${i} de ${paginas}`, M, ph - 7);
  }
  doc.save(`controle-entregas-${emp.chave.replace(/\s+/g, "-")}.pdf`);
}
const LINHA_CARD = () => [214, 220, 226];

/* situação escolhida no controle: fica salva no cadastro do cliente daquela obra.
   "Financiamento" marca o financiamento como "Financiando"; "Liberado" marca como "Aprovado" (se estava financiando). */
function vtSituacaoSalvar(id, v) {
  const r = (vtCad || []).find(x => x.id === id);
  if (!r) { if (typeof toast === "function") toast("Cadastro indisponível agora. Recarregue a página.", "error"); return; }
  r.situacao_vistoria = v;
  if (v === "financiamento") r.financiamento = "analise";
  if (v === "liberado" && r.financiamento === "analise") r.financiamento = "aprovado";
  vtCadSalvar([r]).then(() => { if (typeof toast === "function") toast("Situação salva no Cadastro de unidades.", "success"); renderVistorias(); })
    .catch(e => { if (typeof toast === "function") toast("Não consegui salvar: " + e.message, "error"); renderVistorias(); });
}

/* ---- cadastro único de unidades (Cadastros do pós-venda, no Supabase) ---- */
let vtCad = null; // linhas do cadastro; null = não carregou
async function vtCadCarregar() {
  try {
    const r = await fetch("/api/cadastro-unidades", { credentials: "include", cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.erro || "erro");
    vtCad = j.unidades || [];
  } catch (e) {
    vtCad = null; // mostra a cópia antiga do módulo enquanto o cadastro não responde
    vtCtrl.erro = "Cadastro de unidades indisponível: mostrando a cópia antiga.";
  }
}
function vtCadBase() {
  if (!vtCad) return state.clients || [];
  return vtCad.map(r => ({ id: r.id, buildingId: r.obra_id, unit: r.numero, name: r.proprietario, phone: r.telefone, garage: r.vaga, email: r.email, financiamento: r.financiamento, situacaoVistoria: r.situacao_vistoria }));
}
async function vtCadSalvar(linhas) {
  for (let i = 0; i < linhas.length; i += 200) {
    const r = await fetch("/api/cadastro-unidades", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unidades: linhas.slice(i, i + 200) }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.erro || ("HTTP " + r.status));
  }
}

/* linhas do controle do empreendimento escolhido */
function vtControleFiltradas() {
  const emp = vtEmpSel();
  return vtControleDados().filter(l => emp && vtChaveEmp(l.b.name) === emp.chave)
    .sort((a, b) => String(a.c.unit).localeCompare(String(b.c.unit), "pt-BR", { numeric: true })); // sempre em ordem crescente de apartamento
}
/* gera a planilha do controle (CSV separado por ponto e vírgula, abre direto no Excel) */
function vtControleRelatorio() {
  const emp = vtEmpSel();
  const cab = ["Obra", "Apto", "Cliente", "Vaga", "Financiamento", "Pintura final", "Situação", "Data"];
  const esc = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const corpo = vtControleFiltradas().map(l => [l.b.name || "", l.c.unit, l.c.name || "", l.c.garage || "", VTC_FIN[l.fin] || "", l.obra === null ? "a ligar" : l.obra ? "Pronta" : "Não pronta", l.st, l.data || ""].map(esc).join(";"));
  const csv = "﻿" + [cab.map(esc).join(";"), ...corpo].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `controle-entregas-${(emp ? emp.chave : "obra").replace(/\s+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
/* importa a planilha de financiamento: colunas Apto e Financiamento (colar do Excel) */
function vtControleImportarFin() {
  const emp = vtEmpSel();
  if (!emp) return;
  const ov = document.createElement("div");
  ov.className = "vtc-ov";
  ov.innerHTML = `<div class="vtc-box">
    <h3>Importar financiamento · ${escapeHtml(emp.nome)}</h3>
    <p>No Excel, copie as colunas <b>Apto</b> e <b>Financiamento</b> (com ou sem cabeçalho) e cole abaixo.<br>
    Valores aceitos: <b>Sim</b> (financiando, aguardando aprovação) · <b>Aprovado</b> · <b>Não</b> ou <b>—</b> (não financia).</p>
    <textarea id="vtc-cola" rows="10" placeholder="804&#9;Sim&#10;901&#9;Aprovado"></textarea>
    <div id="vtc-res" class="vtc-msg"></div>
    <div class="vtc-acoes2"><button type="button" class="btn ghost" id="vtc-cancela">Fechar</button><button type="button" class="btn primary" id="vtc-aplica">Aplicar</button></div>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector("#vtc-cancela").onclick = () => ov.remove();
  ov.querySelector("#vtc-aplica").onclick = () => {
    let ok = 0; const naoAchou = []; const alterados = [];
    document.getElementById("vtc-cola").value.split(/\r?\n/).forEach(ln => {
      const cols = ln.split(/\t|;/).map(c => c.trim());
      if (cols.length < 2 || !cols[0]) return;
      const apto = cols[0].replace(/^(apto|apartamento)\.?\s*/i, "").trim();
      const v = cols[1].toLowerCase();
      if (/apto|apartamento/i.test(cols[0]) && /financ/i.test(cols[1])) return; // cabeçalho
      let fin = null;
      if (/aprov/.test(v)) fin = "aprovado";
      else if (/^sim|financ|analis|aguard/.test(v)) fin = "analise";
      else if (/^(n[aã]o|-+|—)$/.test(v)) fin = "nao";
      if (!fin) return;
      const c = (vtCad || []).find(x => vtChaveEmp((getBuilding(x.obra_id) || {}).name) === emp.chave && String(x.numero).trim().toLowerCase() === apto.toLowerCase());
      if (!c) { naoAchou.push(apto); return; }
      c.financiamento = fin; alterados.push(c); ok++;
    });
    vtCadSalvar(alterados).catch(e => { if (typeof toast === "function") toast("Não consegui salvar: " + e.message, "error"); });
    document.getElementById("vtc-res").textContent = `${ok} apartamento(s) atualizado(s).` + (naoAchou.length ? ` Não encontrados neste empreendimento: ${naoAchou.join(", ")}.` : "");
    renderVistorias();
  };
}

/* ---------- Visão em planilha: todas as pendências em linhas, como a planilha da obra, mas com filtros ---------- */
/* menu com várias opções marcáveis (usado nos cabeçalhos da planilha) */
function vtMultiSel(btn, titulo, opcoes, sel, aoMudar) {
  const rotulo = () => { btn.textContent = !sel.size ? "Todos" : sel.size === 1 ? (opcoes.find(o => o.v === Array.from(sel)[0]) || { t: Array.from(sel)[0] }).t : `${sel.size} selecionados`; btn.classList.toggle("vp-multi-on", sel.size > 0); };
  rotulo();
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".vm-menu").forEach(m => m.remove());
    const menu = document.createElement("div"); menu.className = "dd-menu vm-menu";
    menu.innerHTML = `<div class="vm-topo"><strong>${escapeHtml(titulo)}</strong><button type="button" class="vm-limpar">Limpar</button></div>
      ${opcoes.length > 8 ? `<input type="search" class="dd-busca" placeholder="Buscar…" autocomplete="off">` : ""}
      <div class="dd-lista">${opcoes.map(o => `<label class="vm-op"><input type="checkbox" value="${escapeHtml(o.v)}" ${sel.has(o.v) ? "checked" : ""}><span>${escapeHtml(o.t)}</span></label>`).join("")}</div>`;
    document.body.appendChild(menu);
    const r = btn.getBoundingClientRect();
    menu.style.minWidth = Math.max(r.width, 200) + "px";
    menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8)) + "px";
    const abaixo = window.innerHeight - r.bottom - 12;
    menu.style.maxHeight = Math.max(180, Math.min(360, abaixo > 220 ? abaixo : r.top - 20)) + "px";
    menu.style.top = (abaixo > 220 ? r.bottom + 6 : Math.max(8, r.top - menu.offsetHeight - 6)) + "px";
    const busca = menu.querySelector(".dd-busca");
    if (busca) { busca.addEventListener("input", () => { const q = busca.value.trim().toLowerCase(); menu.querySelectorAll(".vm-op").forEach(l => { l.hidden = q && !l.textContent.toLowerCase().includes(q); }); }); setTimeout(() => busca.focus(), 0); }
    menu.addEventListener("change", (ev) => { const c = ev.target; if (c.checked) sel.add(c.value); else sel.delete(c.value); rotulo(); aoMudar(); });
    menu.querySelector(".vm-limpar").addEventListener("click", () => { sel.clear(); menu.querySelectorAll("input[type=checkbox]").forEach(c => { c.checked = false; }); rotulo(); aoMudar(); });
    const fechar = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("mousedown", fechar, true); document.removeEventListener("touchstart", fechar, true); window.removeEventListener("scroll", rolou, true); } };
    const rolou = (ev) => { if (!menu.contains(ev.target)) fechar({ target: document.body }); };
    setTimeout(() => { document.addEventListener("mousedown", fechar, true); document.addEventListener("touchstart", fechar, true); window.addEventListener("scroll", rolou, true); }, 0);
  });
  return rotulo;
}

function vtRenderPlanilha(root) {
  vtPlanMantem.clear();
  const grade = root.querySelector("#vt-grade");
  const base = vtLista().filter(v => !vtFiltroPredio || v.buildingId === vtFiltroPredio);
  const unicos = (f) => Array.from(new Set(base.flatMap(v => v.items.map(i => f(v, i))))).filter(Boolean);
  const aptos = Array.from(new Set(base.map(v => v.unit))).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const tipos = unicos((v, i) => i.tipo).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const ambs = unicos((v, i) => i.ambiente).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const datas = unicos((v) => v.date).sort().reverse();
  /* ao trocar de obra, escolhas que não existem mais saem */
  [[vtSelApto, aptos], [vtSelTipo, tipos], [vtSelAmb, ambs], [vtSelData, datas]].forEach(([s, l]) => Array.from(s).forEach(x => { if (!l.includes(x)) s.delete(x); }));
  grade.innerHTML = `
    <div class="vp-card">
      <div class="vp-busca"><input type="search" id="vc-desc" placeholder="Buscar na descrição…" value="${escapeHtml(vtColDesc)}" autocomplete="off" aria-label="Buscar na descrição"></div>
      <div class="vp-rolagem"><table class="vp-tabela">
        <thead><tr class="vp-tit" id="vp-cab"></tr></thead>
        <tbody></tbody>
      </table></div>
      <div class="vp-rodape"></div>
    </div>`;
  vpAtual = { root, aptos, datas, tipos, ambs };
  const $ = id => grade.querySelector("#" + id);
  const mudou = () => { vtLimitePlanilha = 300; vtPlanMantem.clear(); vtPlanCorpo(root); };
  $("vc-desc").addEventListener("input", e => { vtColDesc = e.target.value; mudou(); });
  vtPlanCorpo(root);
}

/* Planilha: filtro no título de cada coluna */
let vpAtual = null;
const VP_SIT = () => vtStatus === "pendentes" ? ["pend"] : vtStatus === "resolvidos" ? ["res"] : [];
const VP_COLS = {
  apto: { rot: "Apto", sel: () => vtSelApto, val: (v) => v.unit },
  data: { rot: "Data", sel: () => vtSelData, val: (v) => v.date, lab: x => fmtDate(x) },
  tipo: { rot: "Serviço", sel: () => vtSelTipo, val: (v, i) => i.tipo },
  amb: { rot: "Ambiente", sel: () => vtSelAmb, val: (v, i) => i.ambiente },
  desc: { rot: "Descrição" },
  sit: { rot: "Situação", val: (v, i) => i.feito ? "res" : "pend", lab: x => x === "res" ? "Resolvidas" : "A resolver" }
};
function vpItens(excluir) {
  const qd = vtColDesc.trim().toLowerCase(), out = [];
  vtLista().forEach(v => {
    if (vtFiltroPredio && v.buildingId !== vtFiltroPredio) return;
    if (excluir !== "apto" && vtSelApto.size && !vtSelApto.has(v.unit)) return;
    if (excluir !== "data" && vtSelData.size && !vtSelData.has(v.date)) return;
    v.items.forEach(i => {
      if (excluir !== "tipo" && vtSelTipo.size && !vtSelTipo.has(i.tipo)) return;
      if (excluir !== "amb" && vtSelAmb.size && !vtSelAmb.has(i.ambiente)) return;
      if (qd && !i.descricao.toLowerCase().includes(qd)) return;
      if (excluir !== "sit") {
        if (vtStatus === "pendentes" && i.feito && !vtPlanMantem.has(i.id)) return;
        if (vtStatus === "resolvidos" && !i.feito && !vtPlanMantem.has(i.id)) return;
      }
      out.push({ v, i });
    });
  });
  return out;
}
function vpCabecalho(grade) {
  const tr = grade.querySelector("#vp-cab"); if (!tr) return;
  tr.innerHTML = Object.keys(VP_COLS).map(k => {
    const def = VP_COLS[k];
    if (k === "desc") return `<th>Descrição</th>`;
    const n = k === "sit" ? VP_SIT().length : def.sel().size;
    return `<th>${tfcBotao("vp:" + k, def.rot, n, null)}</th>`;
  }).join("");
}
document.addEventListener("click", e => {
  const h = e.target.closest && e.target.closest('[data-tfc^="vp:"]'); if (!h || !vpAtual) return;
  e.preventDefault(); e.stopPropagation();
  const k = h.dataset.tfc.slice(3), def = VP_COLS[k], { root } = vpAtual;
  const base = vpItens(k);
  // apartamento e data contam apartamentos; os outros contam pendências
  let valores;
  if (k === "apto" || k === "data") { const vs = Array.from(new Map(base.map(x => [x.v.id, x.v])).values()); valores = tfcContar(vs, v => def.val(v), def.lab, false); }
  else valores = tfcContar(base, x => def.val(x.v, x.i), def.lab, false);
  const marcados = k === "sit" ? VP_SIT() : Array.from(def.sel());
  marcados.forEach(v => { if (!valores.some(x => x.v === v)) valores.push({ v, l: def.lab ? def.lab(v) : v, n: 0 }); });
  if (k === "sit") { const ordem = ["pend", "res"]; valores = ordem.map(v => valores.find(x => x.v === v) || { v, l: def.lab(v), n: 0 }); }
  else if (k === "data") valores.sort((a, b) => String(b.v).localeCompare(String(a.v)));
  else valores.sort((a, b) => a.l.localeCompare(b.l, "pt-BR", { numeric: true }));
  tfcAbrir(h, { chave: h.dataset.tfc, ord: null, valores, marcados,
    onMarcar: arr => {
      if (k === "sit") vtStatus = arr.length === 1 ? (arr[0] === "pend" ? "pendentes" : "resolvidos") : "todos";
      else { const s = def.sel(); s.clear(); arr.forEach(x => s.add(x)); }
      vtLimitePlanilha = 300; vtPlanMantem.clear(); vtPlanCorpo(root); tfcReancorar();
    } });
}, true);

/* só o corpo e o rodapé: assim, digitar num filtro não perde o foco */
function vtPlanCorpo(root) {
  const grade = root.querySelector("#vt-grade");
  const linhas = vpItens(null);
  vpCabecalho(grade);
  linhas.sort((a, b) => (((getBuilding(a.v.buildingId) || {}).name || "").localeCompare((getBuilding(b.v.buildingId) || {}).name || "", "pt-BR"))
    || a.v.unit.localeCompare(b.v.unit, "pt-BR", { numeric: true }) || a.i.ambiente.localeCompare(b.i.ambiente, "pt-BR"));
  const multiObra = new Set(linhas.map(l => l.v.buildingId)).size > 1;
  const mostra = linhas.slice(0, vtLimitePlanilha);
  let grupo = 0, anterior = null;
  const corpo = mostra.map(({ v, i }) => {
    const novo = v.id !== anterior; if (novo) { grupo++; anterior = v.id; }
    const b = getBuilding(v.buildingId);
    const nf = (i.fotos || []).length;
    return `<tr class="${novo ? "vp-novo" : ""} ${grupo % 2 ? "vp-a" : "vp-b"} ${i.feito ? "vp-feito" : ""}">
      <td class="vp-apto">${novo ? `<button type="button" class="vp-abrir" data-vt-abrir="${v.id}" title="Abrir o apartamento">${escapeHtml(v.unit)}</button>${multiObra && b ? `<span class="vp-obra">${escapeHtml(b.name.replace(/^Residencial /, ""))}</span>` : ""}` : ""}</td>
      <td class="vp-data">${novo ? fmtDate(v.date) : ""}</td>
      <td><span class="vt-tag">${escapeHtml(i.tipo)}</span></td>
      <td class="vp-amb">${escapeHtml(i.ambiente)}</td>
      <td class="vp-desc">${escapeHtml(i.descricao)}${nf ? ` <button type="button" class="vp-fotos" data-vp-fotos="${i.id}" data-vp-v="${v.id}" title="Ver fotos">${ckIco("camera", 14)} ${nf}</button>` : ""}</td>
      <td class="vp-sit"><button type="button" class="vp-pill ${i.feito ? "ok" : "pend"}" data-vp-toggle="${i.id}" data-vp-v="${v.id}" aria-pressed="${i.feito}" aria-label="${i.feito ? "Resolvido" : "Pendente"}" title="${i.feito ? "Resolvido. Clique para reabrir" : "Pendente. Clique para marcar como resolvido"}"><span class="vp-bola ${i.feito ? "ok" : ""}">${i.feito ? ckIco("feito", 13) : ""}</span></button></td>
    </tr>`;
  }).join("");
  const tbody = grade.querySelector("tbody");
  tbody.innerHTML = corpo || `<tr><td colspan="6" class="vp-vazio">Nenhuma pendência com esses filtros.</td></tr>`;
  const ativos = !!(vtSelApto.size || vtSelData.size || vtSelTipo.size || vtSelAmb.size || vtColDesc || vtStatus !== "pendentes");
  grade.querySelector(".vp-rodape").innerHTML = `<span>${linhas.length} linha${linhas.length === 1 ? "" : "s"} · ${new Set(linhas.map(l => l.v.id)).size} apartamento(s)</span>
    <span class="vp-acoes">${ativos ? `<button type="button" class="btn ghost small" id="vp-limpar">Limpar filtros</button>` : ""}${linhas.length > mostra.length ? `<button type="button" class="btn ghost small" id="vp-mais">Mostrar mais ${Math.min(300, linhas.length - mostra.length)}</button>` : ""}</span>`;
  tbody.querySelectorAll("[data-vt-abrir]").forEach(b => b.addEventListener("click", () => { vtAbertaId = b.dataset.vtAbrir; renderVistorias(); window.scrollTo({ top: 0 }); }));
  tbody.querySelectorAll("[data-vp-fotos]").forEach(b => b.addEventListener("click", () => {
    const v = vtLista().find(x => x.id === b.dataset.vpV), it = v.items.find(x => x.id === b.dataset.vpFotos);
    vtfGaleria({ titulo: `Apto ${v.unit} · ${it.ambiente} · ${it.tipo}`, ids: it.fotos, aoMudar: () => { persist(); vtPlanCorpo(root); } });
  }));
  tbody.querySelectorAll("[data-vp-toggle]").forEach(b => b.addEventListener("click", () => {
    const v = vtLista().find(x => x.id === b.dataset.vpV), it = v.items.find(x => x.id === b.dataset.vpToggle);
    it.feito = !it.feito; it.feitoEm = it.feito ? todayISODate() : ""; persist();
    vtPlanMantem.add(it.id);
    const rol = grade.querySelector(".vp-rolagem"), y = rol ? rol.scrollTop : 0; vtPlanCorpo(root); if (rol) rol.scrollTop = y;
  }));
  const limpar = grade.querySelector("#vp-limpar");
  if (limpar) limpar.addEventListener("click", () => { tfcFechar(); vtPlanMantem.clear(); vtSelApto.clear(); vtSelData.clear(); vtSelTipo.clear(); vtSelAmb.clear(); vtColDesc = ""; vtStatus = "pendentes"; renderVistorias(); });
  const mais = grade.querySelector("#vp-mais"); if (mais) mais.addEventListener("click", () => { vtLimitePlanilha += 300; vtPlanCorpo(root); });
}

/* ---------- Nova vistoria ---------- */
function vtAbrirNova() {
  openModal(`
    <div class="modal-header"><h3>Cadastrar pendências</h3><button class="modal-close" id="vt-x" aria-label="Fechar">×</button></div>
    <div class="modal-body vt-form">
      <label>Empreendimento<select id="vt-n-predio">${state.buildings.map(b => `<option value="${b.id}" ${b.id === (vtFiltroPredio || localStorage.getItem("posvenda_last_building")) ? "selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}</select></label>
      <div class="vt-linha2">
        <label>Apartamento<input type="text" id="vt-n-unit" placeholder="ex: 404" autocomplete="off"></label>
        <label>Data da vistoria<input type="date" id="vt-n-data" value="${todayISODate()}"></label>
      </div>
    </div>
    <div class="modal-footer"><button class="btn ghost" id="vt-n-cancelar">Cancelar</button><button class="btn primary" id="vt-n-ok">Criar e lançar pendências</button></div>`);
  const $ = id => document.getElementById(id);
  $("vt-x").onclick = $("vt-n-cancelar").onclick = closeModal;
  setTimeout(() => $("vt-n-unit").focus(), 50);
  const criar = () => {
    const unit = $("vt-n-unit").value.trim();
    if (!unit) { toast("Informe o apartamento.", "error"); $("vt-n-unit").focus(); return; }
    const buildingId = $("vt-n-predio").value, date = $("vt-n-data").value || todayISODate();
    let v = vtLista().find(x => x.buildingId === buildingId && x.unit === unit && x.date === date);
    if (!v) { v = { id: vtId("vt"), buildingId, unit, date, items: [] }; vtLista().push(v); persist(); }
    vtAbertaId = v.id; closeModal(); renderVistorias();
  };
  $("vt-n-ok").onclick = criar;
  $("vt-n-unit").addEventListener("keydown", e => { if (e.key === "Enter") criar(); });
}

/* ---------- Detalhe ---------- */
function vtLinhaParaItem(linha) {
  let ambiente = vtAmbienteAtual, texto = linha.trim();
  const achou = VT_AMBIENTES.find(a => texto.toLowerCase().startsWith(a.toLowerCase()) && /^[\s]*[:\-–—]/.test(texto.slice(a.length)));
  if (achou) { ambiente = achou; texto = texto.slice(achou.length).replace(/^[\s:\-–—]+/, ""); }
  return { id: vtId("it"), ambiente, tipo: vtTipoAtual, descricao: texto, feito: false };
}

function renderVistoriaDetalhe(root) {
  const v = vtLista().find(x => x.id === vtAbertaId), b = getBuilding(v.buildingId), r = vtResumo(v);
  if (vtDetMantemDe !== v.id) { vtDetMantem.clear(); vtDetMantemDe = v.id; }
  const ambientes = Array.from(new Set([...VT_AMBIENTES, vtAmbienteAtual]));
  const tipos = Array.from(new Set([...VT_TIPOS, vtTipoAtual]));
  const opcoes = (lista, atual) => lista.map(x => `<option value="${escapeHtml(x)}" ${x === atual ? "selected" : ""}>${escapeHtml(x)}</option>`).join("");
  const ordemAmb = a => { const k = VT_AMBIENTES.indexOf(a); return k < 0 ? 99 : k; };
  /* "mantém" o item que acabou de ser marcado, para ele não sumir da lista na hora */
  const filtrados = v.items
    .filter(i => vtFiltroDet === "todas" || vtDetMantem.has(i.id) || (vtFiltroDet === "pendentes" ? !i.feito : i.feito))
    .slice().sort((x, y) => ordemAmb(x.ambiente) - ordemAmb(y.ambiente));
  const msgVazio = !v.items.length ? "Nenhuma pendência lançada ainda. Use a aba “Lançar pendências”."
    : vtFiltroDet === "pendentes" ? "Nenhuma pendência em aberto. Tudo resolvido neste apartamento."
    : "Nenhuma pendência resolvida ainda.";
  const seg = (k, rotulo, n) => `<button type="button" class="vt-seg-op ${vtFiltroDet === k ? "ativo" : ""}" data-vt-f="${k}" aria-pressed="${vtFiltroDet === k}">${rotulo} <b>${n}</b></button>`;

  root.innerHTML = `
    <div class="vt-topo">
      <button type="button" class="btn ghost small" id="vt-voltar">← Apartamentos</button>
      <div class="vt-titulo"><h2>Apto ${escapeHtml(v.unit)}</h2><span>${b ? escapeHtml(b.name) : "—"} · vistoria de ${fmtDate(v.date)}</span></div>
      <div class="vt-prog"><span class="vt-trilho grande"><span style="width:${r.pct}%"></span></span><strong>${r.feitos}/${r.total}</strong> resolvidas</div>
    </div>

    <div class="vt-abas" role="tablist">
      <button type="button" role="tab" class="vt-aba ${vtAbaDet === "lista" ? "ativa" : ""}" data-vt-aba="lista">Pendências <span>${v.items.length}</span></button>
      <button type="button" role="tab" class="vt-aba ${vtAbaDet === "lancar" ? "ativa" : ""}" data-vt-aba="lancar">+ Lançar pendências</button>
      <span class="vt-espaco"></span>
      ${v.folha ? `<button type="button" class="btn ghost small" id="vt-doc">PDF e e-mail</button>` : ""}
      <button type="button" class="btn ghost small danger-txt" id="vt-excluir">Excluir vistoria</button>
    </div>

    ${vtAbaDet === "lancar" ? `
      <div class="panel vt-add">
        <div class="vt-form-lin">
          <label class="vt-campo">Ambiente<select id="vt-sel-amb">${opcoes(ambientes, vtAmbienteAtual)}</select></label>
          <label class="vt-campo">O que é<select id="vt-sel-tipo">${opcoes(tipos, vtTipoAtual)}</select></label>
        </div>
        <input type="text" id="vt-outro-amb" class="vt-mini" placeholder="Outro ambiente (digite e aperte Enter)" autocomplete="off">
        <label class="vt-campo">Pendência<textarea id="vt-texto" rows="3" placeholder="Descreva o problema. Enter adiciona. Para várias, cole uma pendência por linha."></textarea></label>
        <div class="vt-form-acao">
          <span class="hint">Vai para <strong>${escapeHtml(vtAmbienteAtual)}</strong> · <strong>${escapeHtml(vtTipoAtual)}</strong></span>
          <button type="button" class="btn primary" id="vt-add">Adicionar pendência</button>
        </div>
      </div>` : `
      <div class="vt-seg" role="group" aria-label="Filtrar pendências">
        ${seg("pendentes", "Pendentes", r.abertas)}${seg("resolvidos", "Resolvidos", r.feitos)}${seg("todas", "Todas", r.total)}
      </div>
      ${filtrados.length ? `<ul class="vt-lista">${filtrados.map(i => `
        <li class="vt-row ${i.feito ? "feito" : ""}" data-item="${i.id}">
          <div class="vt-row-corpo">
            <div class="vt-row-tags"><span class="vt-amb-tag">${escapeHtml(i.ambiente)}</span><span class="vt-tag">${escapeHtml(i.tipo)}</span><span class="vt-status ${i.feito ? "ok" : "aberto"}">${i.feito ? "Resolvida" : "Pendente"}</span></div>
            <div class="vt-desc">${escapeHtml(i.descricao)}</div>
            ${vtfThumbs(i.fotos, i.id)}
          </div>
          <button type="button" class="vt-resolver ${i.feito ? "ok" : ""}" data-vt-toggle="${i.id}" aria-pressed="${i.feito}" title="${i.feito ? "Desfazer: voltar para pendente" : "Marcar esta pendência como resolvida"}">${ckIco("feito", 18)} <span>${i.feito ? "Resolvida" : "Marcar resolvida"}</span></button>
          <button type="button" class="vt-cam" data-vt-cam="${i.id}" aria-label="Tirar foto desta pendência" title="Tirar foto">${ckIco("camera", 20)}</button>
          <button type="button" class="vt-rem" data-vt-rem="${i.id}" aria-label="Remover">${ckIco("naofeito", 15)}</button>
        </li>`).join("")}</ul>` : `<div class="vt-vazio pequeno">${msgVazio}</div>`}`}`;

  const $ = s => root.querySelector(s);
  $("#vt-voltar").onclick = () => { vtAbertaId = null; renderVistorias(); };
  root.querySelectorAll("[data-vt-aba]").forEach(b => b.onclick = () => { vtAbaDet = b.dataset.vtAba; renderVistorias(); });
  root.querySelectorAll("[data-vt-f]").forEach(b => b.onclick = () => { vtFiltroDet = b.dataset.vtF; vtDetMantem.clear(); renderVistorias(); });

  /* aba "Lançar pendências" */
  const selAmb = $("#vt-sel-amb"), selTipo = $("#vt-sel-tipo"), texto = $("#vt-texto");
  if (selAmb) {
    const adicionar = () => {
      vtAmbienteAtual = selAmb.value; vtTipoAtual = selTipo.value;
      const linhas = texto.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (!linhas.length) { texto.focus(); return; }
      linhas.forEach(l => v.items.push(vtLinhaParaItem(l)));
      persist(); renderVistorias();
      const n = document.getElementById("vt-texto"); if (n) n.focus();
      toast(linhas.length === 1 ? "Pendência lançada." : `${linhas.length} pendências lançadas.`, "success");
    };
    selAmb.onchange = () => { vtAmbienteAtual = selAmb.value; };
    selTipo.onchange = () => { vtTipoAtual = selTipo.value; };
    $("#vt-outro-amb").addEventListener("keydown", e => {
      if (e.key !== "Enter") return; e.preventDefault();
      const x = e.target.value.trim(); if (!x) return;
      vtAmbienteAtual = x; renderVistorias(); document.getElementById("vt-texto").focus();
    });
    $("#vt-add").onclick = adicionar;
    texto.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); adicionar(); } });
    texto.addEventListener("paste", () => setTimeout(() => { if (texto.value.includes("\n")) adicionar(); }, 0));
  }

  /* aba "Pendências" */
  root.querySelectorAll("[data-vt-toggle]").forEach(b => b.onclick = () => {
    const it = v.items.find(i => i.id === b.dataset.vtToggle); it.feito = !it.feito; it.feitoEm = it.feito ? todayISODate() : "";
    vtDetMantem.add(it.id); persist();
    const y = window.scrollY; renderVistorias(); window.scrollTo({ top: y });
  });
  root.querySelectorAll("[data-vt-rem]").forEach(b => b.onclick = () => { const it = v.items.find(i => i.id === b.dataset.vtRem); if (it && it.fotos && it.fotos.length && !confirm("Esta pendência tem foto(s). Remover mesmo assim?")) return; (it && it.fotos || []).forEach(vtfDel); v.items = v.items.filter(i => i.id !== b.dataset.vtRem); persist(); renderVistorias(); });
  root.querySelectorAll("[data-vt-cam]").forEach(b => b.onclick = async () => { const it = v.items.find(i => i.id === b.dataset.vtCam); const id = await vtfTirarFoto(); if (id && it) { (it.fotos = it.fotos || []).push(id); persist(); renderVistorias(); } });
  root.querySelectorAll("[data-vtf-abrir]").forEach(b => b.onclick = () => { const it = v.items.find(i => i.id === b.dataset.vtfAbrir); if (!it) return; vtfGaleria({ titulo: `Apto ${v.unit} · ${it.ambiente} · ${it.tipo}`, ids: it.fotos = it.fotos || [], aoMudar: () => { persist(); renderVistorias(); } }); });
  vtfHidratar(root);

  const docBtn = root.querySelector("#vt-doc"); if (docBtn) docBtn.onclick = () => { vtAbertaId = null; vfAbrirFinal(v.id); };
  $("#vt-excluir").onclick = () => vtConfirmar({
    titulo: "Excluir esta vistoria?",
    texto: `A vistoria do apto ${v.unit}, com suas ${v.items.length} pendência(s) e fotos, será apagada. Não dá para desfazer.`,
    botao: "Sim, excluir a vistoria",
    aoConfirmar: () => {
      v.items.forEach(i => (i.fotos || []).forEach(vtfDel));
      state.vistorias = vtLista().filter(x => x.id !== v.id); persist(); vtAbertaId = null; renderVistorias();
    } });
}

/* ---------- Importar planilha (.xlsx) ----------
   Formato da planilha da obra: colunas APTO, DATA VISTORIA, PENDÊNCIA, AMBIENTE, DESCRIÇÃO, SITUAÇÃO.
   Cada apartamento + data vira uma vistoria; "RESOLVIDO" entra como resolvida. Importar de novo não duplica. */
function vtNorm(x) { return String(x == null ? "" : x).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
function vtLimpa(x) { return String(x == null ? "" : x).replace(/\s+/g, " ").trim(); }
function vtDataISO(v) {
  if (typeof v === "number" && v > 30000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  if (v instanceof Date) return toISODateString(v);
  const m = String(v || "").match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2]}-${m[1]}`;
  return /^\d{4}-\d{2}-\d{2}/.test(String(v || "")) ? String(v).slice(0, 10) : "";
}

/* Lê as linhas da planilha e devolve { itens: [...], semData: n }. Função pura, fácil de testar. */
function vtLerLinhas(wb) {
  const out = [];
  for (const nome of wb.SheetNames) {
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: "" });
    const hi = linhas.findIndex(l => l.some(c => vtNorm(c) === "apto"));
    if (hi < 0) continue;
    const col = {};
    linhas[hi].forEach((c, i) => {
      const n = vtNorm(c);
      if (n === "apto") col.apto = i; else if (n.startsWith("data")) col.data = i; else if (n.startsWith("pend")) col.tipo = i;
      else if (n.startsWith("ambiente")) col.amb = i; else if (n.startsWith("descri")) col.desc = i; else if (n.startsWith("situa")) col.sit = i;
    });
    if (col.apto == null || col.desc == null) continue;
    linhas.slice(hi + 1).forEach(l => {
      const unit = vtLimpa(l[col.apto]); const desc = vtLimpa(l[col.desc]);
      if (!unit || !desc || vtNorm(unit) === "apto") return;
      out.push({ unit, data: vtDataISO(l[col.data]), tipo: vtLimpa(l[col.tipo]) || "Outros", ambiente: vtLimpa(l[col.amb]) || "Sem ambiente", desc, feito: vtNorm(l[col.sit]) === "resolvido" });
    });
  }
  return out;
}

function vtImportarLinhas(linhas, buildingId) {
  const primeiraData = {};
  linhas.forEach(l => { if (l.data && (!primeiraData[l.unit] || l.data < primeiraData[l.unit])) primeiraData[l.unit] = l.data; });
  let novos = 0, ignorados = 0, aptos = 0;
  linhas.forEach(l => {
    const data = l.data || primeiraData[l.unit] || todayISODate();
    let v = vtLista().find(x => x.buildingId === buildingId && x.unit === l.unit && x.date === data);
    if (!v) { v = { id: vtId("vt"), buildingId, unit: l.unit, date: data, items: [] }; vtLista().push(v); aptos++; }
    if (v.items.some(i => i.ambiente === l.ambiente && i.tipo === l.tipo && i.descricao === l.desc)) { ignorados++; return; }
    v.items.push({ id: vtId("it"), ambiente: l.ambiente, tipo: l.tipo, descricao: l.desc, feito: l.feito, feitoEm: l.feito ? data : "" });
    novos++;
  });
  persist();
  return { novos, ignorados, aptos };
}

function vtEscolherPlanilha() {
  if (typeof XLSX === "undefined") { toast("Não consegui carregar o leitor de planilhas (precisa de internet na primeira vez).", "error"); return; }
  const campeche = state.buildings.find(b => /campeche/i.test(b.name));
  openModal(`
    <div class="modal-header"><h3>Importar planilha de vistorias</h3><button class="modal-close" id="vti-x" aria-label="Fechar">×</button></div>
    <div class="modal-body vt-form">
      <label>De qual empreendimento é a planilha?<select id="vti-predio">${state.buildings.map(b => `<option value="${b.id}" ${campeche && b.id === campeche.id ? "selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}</select></label>
      <label>Arquivo (.xlsx)<input type="file" id="vti-arq" accept=".xlsx,.xls"></label>
      <div class="hint">Colunas esperadas: APTO, DATA VISTORIA, PENDÊNCIA, AMBIENTE, DESCRIÇÃO e SITUAÇÃO. Itens “RESOLVIDO” entram como resolvidos. Importar o mesmo arquivo duas vezes não duplica.</div>
      <div id="vti-res" class="vt-import-res"></div>
    </div>
    <div class="modal-footer"><button class="btn ghost" id="vti-fechar">Fechar</button><button class="btn primary" id="vti-ok">Importar</button></div>`);
  const $ = id => document.getElementById(id);
  $("vti-x").onclick = $("vti-fechar").onclick = closeModal;
  $("vti-ok").onclick = async () => {
    const f = $("vti-arq").files[0];
    if (!f) { toast("Escolha o arquivo da planilha.", "error"); return; }
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const linhas = vtLerLinhas(wb);
      if (!linhas.length) { $("vti-res").textContent = "Não achei linhas com APTO e DESCRIÇÃO nessa planilha."; return; }
      const r = vtImportarLinhas(linhas, $("vti-predio").value);
      closeModal(); renderVistorias();
      toast(`${r.novos} pendência(s) importada(s) em ${r.aptos} apartamento(s)${r.ignorados ? `; ${r.ignorados} já existiam` : ""}.`, "success");
    } catch (e) { $("vti-res").textContent = "Erro ao ler o arquivo: " + e.message; }
  };
}

/* Carga inicial: as pendências da Ilha do Campeche (planilha da obra) entram uma única vez neste navegador. */
async function vtCargaInicial() {
  try {
    if (localStorage.getItem("posvenda_vt_campeche")) return;
    const b = state.buildings.find(x => /campeche/i.test(x.name));
    if (!b) return;
    const linhas = await (await fetch("data/vistorias-ilha-do-campeche.json")).json();
    const r = vtImportarLinhas(linhas, b.id);
    localStorage.setItem("posvenda_vt_campeche", "1");
    if (typeof renderVistorias === "function") renderVistorias();
    if (r.novos) toast(`Vistorias da Ilha do Campeche carregadas: ${r.novos} pendências em ${r.aptos} apartamentos.`, "success");
  } catch (e) { /* sem o arquivo de dados, segue sem a carga inicial */ }
}
window.addEventListener("load", vtCargaInicial);


/* ---------- Relatório por serviço (limpeza, elétrica, pintura…) ----------
   Escolhe a obra, um ou mais serviços e a situação; sai um PDF (ou planilha) com as pendências
   por apartamento e ambiente, pronto para mandar a quem executa o serviço. */
function vtItensRelatorio(buildingId, tipos, sit) {
  const out = [];
  vtLista().filter(v => v.buildingId === buildingId).forEach(v => v.items.forEach(i => {
    if (tipos.size && !tipos.has(i.tipo)) return;
    if (sit === "pendentes" && i.feito) return;
    if (sit === "resolvidas" && !i.feito) return;
    out.push({ unit: v.unit, date: v.date, ambiente: i.ambiente, tipo: i.tipo, desc: i.descricao, feito: i.feito, fotos: i.fotos || [] });
  }));
  return out.sort((a, b) => a.unit.localeCompare(b.unit, "pt-BR", { numeric: true }) || a.ambiente.localeCompare(b.ambiente, "pt-BR"));
}

function vtAbrirRelatorio() {
  const comDados = state.buildings.filter(b => vtLista().some(v => v.buildingId === b.id));
  if (!comDados.length) { toast("Cadastre ou importe vistorias antes de gerar relatório.", "error"); return; }
  let predio = vtFiltroPredio && comDados.some(b => b.id === vtFiltroPredio) ? vtFiltroPredio : comDados[0].id;
  let sit = "pendentes";
  const tiposSel = new Set();
  openModal(`
    <div class="modal-header"><h3>Gerar relatório</h3><button class="modal-close" id="vr-x" aria-label="Fechar">×</button></div>
    <div class="modal-body vt-form">
      <label>Obra<select id="vr-predio">${comDados.map(b => `<option value="${b.id}" ${b.id === predio ? "selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}</select></label>
      <div class="vt-rot">Serviço <span class="hint">(escolha um ou vários; sem escolher, vale todos)</span></div>
      <div class="vt-chips" id="vr-tipos"></div>
      <div class="vt-rot">Situação</div>
      <div class="vt-chips" id="vr-sit"></div>
      <label style="margin-top:14px;">Responsável pelo serviço <span class="hint">(opcional, sai no cabeçalho)</span><input type="text" id="vr-resp" placeholder="ex: Limpeza — equipe do João"></label>
      <label style="margin-top:12px;">Enviar por e-mail <span class="hint">(opcional)</span><input type="email" id="vr-email" placeholder="nome@empresa.com" autocomplete="off"></label>
      <div class="vt-import-res" id="vr-resumo"></div>
    </div>
    <div class="modal-footer"><button class="btn ghost" id="vr-csv">Planilha (CSV)</button><button class="btn ghost" id="vr-mail">Gerar PDF e abrir e-mail</button><button class="btn primary" id="vr-pdf">Gerar PDF</button></div>`);
  const $ = id => document.getElementById(id);
  const contagem = () => {
    const m = new Map();
    vtLista().filter(v => v.buildingId === predio).forEach(v => v.items.forEach(i => { if (sit === "pendentes" && i.feito) return; if (sit === "resolvidas" && !i.feito) return; m.set(i.tipo, (m.get(i.tipo) || 0) + 1); }));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  };
  const desenhar = () => {
    const c = contagem();
    Array.from(tiposSel).forEach(t => { if (!c.some(x => x[0] === t)) tiposSel.delete(t); });
    $("vr-tipos").innerHTML = c.length ? c.map(([t, n]) => `<button type="button" class="vt-chip ${tiposSel.has(t) ? "ativo" : ""}" data-t="${escapeHtml(t)}">${escapeHtml(t)} · ${n}</button>`).join("") : `<span class="hint">Nenhuma pendência nessa situação.</span>`;
    $("vr-sit").innerHTML = [["pendentes", "A resolver"], ["resolvidas", "Resolvidas"], ["todas", "Todas"]].map(([k, r]) => `<button type="button" class="vt-chip ${sit === k ? "ativo" : ""}" data-s="${k}">${r}</button>`).join("");
    const itens = vtItensRelatorio(predio, tiposSel, sit);
    const aptos = new Set(itens.map(i => i.unit)).size;
    $("vr-resumo").innerHTML = itens.length ? `<strong>${itens.length}</strong> item(ns) em <strong>${aptos}</strong> apartamento(s)` : "Nada para listar com essa escolha.";
    $("vr-tipos").querySelectorAll("[data-t]").forEach(b => b.onclick = () => { tiposSel.has(b.dataset.t) ? tiposSel.delete(b.dataset.t) : tiposSel.add(b.dataset.t); desenhar(); });
    $("vr-sit").querySelectorAll("[data-s]").forEach(b => b.onclick = () => { sit = b.dataset.s; desenhar(); });
  };
  $("vr-x").onclick = closeModal;
  $("vr-predio").onchange = e => { predio = e.target.value; tiposSel.clear(); desenhar(); };
  desenhar();

  const titulo = () => {
    const b = getBuilding(predio), nomes = tiposSel.size ? Array.from(tiposSel).join(", ") : "todos os serviços";
    return { b, nomes, sitTxt: { pendentes: "a resolver", resolvidas: "resolvidas", todas: "todas as situações" }[sit] };
  };
  $("vr-csv").onclick = () => {
    const itens = vtItensRelatorio(predio, tiposSel, sit); if (!itens.length) { toast("Nada para exportar.", "error"); return; }
    const { b, nomes } = titulo();
    rpBaixarCSV([["Obra", "Apto", "Cliente", "Ambiente", "Serviço", "Descrição", "Situação", "Data da vistoria"], ...itens.map(i => [b.name, i.unit, vtNomeCliente(b.id, i.unit), i.ambiente, i.tipo, i.desc, i.feito ? "Resolvido" : "Pendente", fmtDate(i.date)])], vtNomeArquivo(["Pendências", tiposSel.size ? nomes : "Todos os serviços", vtObraCurta(b.name), vtDataArquivo(todayISODate())], "csv"), true);
  };
  const gerarPdf = async (retornar) => {
    if (!window.jspdf) { toast("Biblioteca de PDF não carregada.", "error"); return null; }
    const itens = vtItensRelatorio(predio, tiposSel, sit); if (!itens.length) { toast("Nada para listar.", "error"); return null; }
    const { b, nomes, sitTxt } = titulo();
    const r = await vtPdfRelatorio({ b, itens, nomes, sitTxt, resp: $("vr-resp").value.trim(), varios: tiposSel.size !== 1, retornar: retornar === true });
    return { b, nomes, sitTxt, itens, ...(r || {}) };
  };
  $("vr-pdf").onclick = () => gerarPdf(false);
  $("vr-mail").onclick = async () => {
    const email = $("vr-email").value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast("Digite um e-mail válido para enviar.", "error"); $("vr-email").focus(); return; }
    const r = await gerarPdf(true); if (!r) return;
    const resp = $("vr-resp").value.trim();
    const corpo = `Prezados,\n\nEncaminhamos, em anexo, o relatório de pendências de vistoria do ${r.b.name}${r.nomes ? " (" + r.nomes + ")" : ""}.\n\nPermanecemos à disposição para quaisquer esclarecimentos.\n\nAtenciosamente,\n${resp ? resp + "\n" : ""}SBJ Construtora e Incorporadora`;
    await vtEnviarPdfPorEmail(r.doc, r.nomeArquivo, email, "Pendências de vistoria — " + r.b.name + " — " + r.nomes, corpo);
  };
}


/* ---------- PDF do relatório: layout próprio, pensado para imprimir e levar à obra ---------- */
let vtLogoCache = null;
async function vtLogoDataUrl() {
  if (vtLogoCache) return vtLogoCache;
  vtLogoCache = (async () => { try {
    const blob = await (await fetch("assets/logo-sbj-pdf.png")).blob();
    return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  } catch (e) { return null; } })();
  return vtLogoCache;
}
window.addEventListener("load", () => { vtLogoDataUrl(); });

/* No celular abre a folha de compartilhar (e-mail, WhatsApp, Arquivos...) com o PDF pronto, sem sair do site.
   No computador, baixa o arquivo. */
/* Enviar por e-mail COM o PDF. O link "mailto" não consegue anexar arquivo; por isso, no celular, abre a folha de
   compartilhar (Gmail, Mail...) já com o PDF anexado e o e-mail do cliente copiado para colar.
   No computador, baixa o PDF e abre o e-mail; o arquivo precisa ser anexado à mão. */
async function vtEnviarPdfPorEmail(docOuLista, nome, email, assunto, corpo) {
  const lista = Array.isArray(docOuLista) ? docOuLista : [{ doc: docOuLista, nome }];
  const celular = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (celular && navigator.share && navigator.canShare) {
    try {
      const arqs = lista.map(x => new File([x.doc.output("blob")], x.nome, { type: "application/pdf" }));
      if (navigator.canShare({ files: arqs })) {
        try { await navigator.clipboard.writeText(email); } catch (e) { /* sem área de transferência */ }
        await navigator.share({ files: arqs, title: assunto, text: corpo });
        toast(`PDF compartilhado. E-mail do cliente copiado: ${email}`, "success");
        return;
      }
    } catch (e) { if (e && e.name === "AbortError") return; }
  }
  lista.forEach(x => x.doc.save(x.nome));
  toast(lista.length > 1 ? "PDFs baixados. Anexe os arquivos ao e-mail que vai abrir." : "PDF baixado. Anexe o arquivo ao e-mail que vai abrir.", "success");
  window.location.href = `mailto:${email.split(/[,;]s*/).map(e => encodeURIComponent(e)).join(",")}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}

async function vtEntregarPdf(doc, nome) {
  const celular = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (celular && navigator.share && navigator.canShare) {
    try {
      const arq = new File([doc.output("blob")], nome, { type: "application/pdf" });
      if (navigator.canShare({ files: [arq] })) { await navigator.share({ files: [arq], title: nome }); return "compartilhado"; }
    } catch (e) { if (e && e.name === "AbortError") return "cancelado"; }
  }
  doc.save(nome);
  return "baixado";
}

async function vtPdfRelatorio({ b, itens, nomes, sitTxt, resp, varios, retornar }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
  const M = 14, TEAL = [12, 107, 118], INK = [6, 27, 30], CINZA = [105, 115, 125], LINHA = [214, 220, 226];
  const logo = await vtLogoDataUrl();
  const emitido = new Date().toLocaleDateString("pt-BR");
  const paginasComCabecalho = new Set();
  let mostrarFaixa = true;
  const COL = { ok: 11, amb: 30, srv: varios ? 34 : 0 };
  const faixaColunas = (yf) => {
    doc.setFillColor(226, 236, 238); doc.rect(M, yf, pw - 2 * M, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.6); doc.setTextColor(...INK);
    doc.text("Visto", M + 1.8, yf + 4.2);
    doc.text("Ambiente", M + COL.ok + 1.8, yf + 4.2);
    doc.text("Observação", M + COL.ok + COL.amb + 1.8, yf + 4.2);
    if (varios) doc.text("Serviço", pw - M - COL.srv + 1.8, yf + 4.2);
  };

  const cabecalho = () => {
    const n = doc.internal.getCurrentPageInfo().pageNumber;
    if (paginasComCabecalho.has(n)) return; paginasComCabecalho.add(n);
    if (mostrarFaixa) faixaColunas(n === 1 ? 35 : 18);
    if (n === 1) {
      if (logo) doc.addImage(logo, "PNG", M, 8, 19, 16.5);
      const x = M + (logo ? 24 : 0);
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...INK);
      doc.text("Pendências de vistoria", x, 14.5);
      doc.setFontSize(10.5); doc.setTextColor(...TEAL); doc.text(b.name, x, 20);
      doc.setFontSize(11.5); doc.setTextColor(...INK); doc.text(nomes.charAt(0).toUpperCase() + nomes.slice(1), x, 25.5);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...CINZA);
      doc.text(sitTxt.charAt(0).toUpperCase() + sitTxt.slice(1), x, 29.8);
      doc.setFontSize(8.5); doc.text(`Emitido em ${emitido}`, pw - M, 11, { align: "right" });
      if (resp) { doc.setFontSize(9); doc.text(`Responsável: ${resp}`, pw - M, 25.5, { align: "right" }); }
      doc.setDrawColor(...TEAL); doc.setLineWidth(0.6); doc.line(M, 33, pw - M, 33);
    } else {
      if (logo) doc.addImage(logo, "PNG", M, 6.5, 9, 7.8);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...INK);
      doc.text(`${b.name}  —  ${nomes.charAt(0).toUpperCase() + nomes.slice(1)}`, M + 12, 11.5);
      doc.setDrawColor(...TEAL); doc.setLineWidth(0.4); doc.line(M, 16.5, pw - M, 16.5);
    }
  };
  cabecalho();

  const aptosMap = new Map(); itens.forEach(i => { if (!aptosMap.has(i.unit)) aptosMap.set(i.unit, { date: i.date, itens: [] }); aptosMap.get(i.unit).itens.push(i); });
  let y = 43;

  const limite = () => ph - 22;
  Array.from(aptosMap.entries()).forEach(([unit, ap]) => {
    const alturaMin = 9 + Math.min(ap.itens.length, 2) * 7;
    if (y + alturaMin > limite()) { doc.addPage(); cabecalho(); y = 26; }
    doc.setFillColor(236, 243, 244); doc.roundedRect(M, y, pw - 2 * M, 6.8, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...INK); doc.text(`Apartamento ${unit}`, M + 3, y + 4.8);
    const cli = vtNomeCliente(b.id, unit);
    if (cli) { const larg = doc.getTextWidth(`Apartamento ${unit}`); doc.setFont("helvetica", "normal"); doc.setFontSize(9.2); doc.setTextColor(60, 70, 78); doc.text(vtCorta(cli, 52), M + 3 + larg + 4, y + 4.7); }
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.3); doc.setTextColor(...CINZA);
    doc.text(`vistoria ${fmtDate(ap.date)}`, pw - M - 3, y + 4.6, { align: "right" });
    y += 7.6;
    doc.autoTable({
      startY: y, theme: "plain", margin: { left: M, right: M, top: 26, bottom: 20 },
      head: [], body: ap.itens.map(i => ["", i.ambiente, i.desc, varios ? i.tipo : ""]),
      styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 1.5, bottom: 1.5, left: 1.8, right: 1.8 }, textColor: [30, 35, 40], overflow: "linebreak", valign: "middle" },
      columnStyles: { 0: { cellWidth: COL.ok }, 1: { cellWidth: COL.amb, fontStyle: "bold" }, 3: { cellWidth: COL.srv, textColor: TEAL, fontStyle: "bold", fontSize: 10 } },
      didDrawPage: cabecalho,
      didDrawCell: (d) => {
        if (d.section !== "body") return;
        doc.setDrawColor(...LINHA); doc.setLineWidth(0.15); doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
        if (d.column.index === 0) {
          const it = ap.itens[d.row.index], bx = d.cell.x + 1.8, by = d.cell.y + (d.cell.height - 3.6) / 2;
          doc.setDrawColor(90, 100, 110); doc.setLineWidth(0.3); doc.rect(bx, by, 3.6, 3.6);
          if (it.feito) { doc.setDrawColor(...TEAL); doc.setLineWidth(0.6); doc.line(bx + 0.7, by + 2, bx + 1.6, by + 2.9); doc.line(bx + 1.6, by + 2.9, bx + 3.1, by + 0.8); }
        }
      },
    });
    y = doc.lastAutoTable.finalY + 3.5;
  });

  /* rodapé */
  const comFoto = itens.filter(i => i.fotos && i.fotos.length);
  mostrarFaixa = false;
  if (comFoto.length) await vtfPdfFotos(doc, cabecalho, comFoto.map(i => ({ ids: i.fotos, titulo: `Apartamento ${i.unit}  ·  ${i.ambiente}  ·  ${i.tipo}`, texto: i.desc })), { M, pw, ph, topo: 23 });
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINHA); doc.setLineWidth(0.2); doc.line(M, ph - 13, pw - M, ph - 13);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...CINZA);
    doc.text("SBJ Construtora e Incorporadora  |  Pós-obra", M, ph - 8.5);
    doc.text(`Página ${i} de ${total}`, pw - M, ph - 8.5, { align: "right" });
  }
  const nomeArquivo = vtNomeArquivo(["Pendências", varios ? "Todos os serviços" : nomes, vtObraCurta(b.name), vtDataArquivo(todayISODate())], "pdf");
  if (retornar) return { doc, nomeArquivo };
  const feito = await vtEntregarPdf(doc, nomeArquivo);
  if (feito !== "cancelado") toast(feito === "compartilhado" ? "PDF pronto para enviar." : "PDF gerado.", "success");
}


/* ---------- Passar vistorias entre aparelhos (celular <-> computador) ----------
   Cada aparelho guarda os próprios dados. Enquanto não existe um banco compartilhado, as vistorias vão e voltam
   por um arquivo. Ao importar, os dados SE MISTURAM: nada do aparelho é apagado nem duplicado
   (mesma obra + apartamento + data = mesma vistoria; mesmo ambiente + serviço + descrição = mesma pendência;
   resolvida em um dos lados = resolvida). */
function vtChaveVistoria(v) { return [v.buildingId, String(v.unit).toLowerCase(), v.date].join("|"); }
function vtChaveItem(i) { return [i.ambiente, i.tipo, i.descricao].map(x => String(x).toLowerCase().trim()).join("|"); }

function vtMisturar(recebidas) {
  const r = { vistoriasNovas: 0, itensNovos: 0, resolvidos: 0 };
  recebidas.forEach(rv => {
    if (!rv || !rv.buildingId || !rv.unit || !Array.isArray(rv.items)) return;
    let v = vtLista().find(x => vtChaveVistoria(x) === vtChaveVistoria(rv));
    if (!v) { v = { id: rv.id || vtId("vt"), buildingId: rv.buildingId, unit: rv.unit, date: rv.date, items: [] }; vtLista().push(v); r.vistoriasNovas++; }
    ["responsavel", "email", "folha"].forEach(k => { if (rv[k] && !v[k]) v[k] = rv[k]; });
    rv.items.forEach(ri => {
      const local = v.items.find(x => vtChaveItem(x) === vtChaveItem(ri));
      if (!local) { v.items.push({ id: ri.id || vtId("it"), ambiente: ri.ambiente, tipo: ri.tipo, descricao: ri.descricao, feito: !!ri.feito, feitoEm: ri.feitoEm || "", fotos: (ri.fotos || []).slice() }); r.itensNovos++; }
      else {
        if (ri.feito && !local.feito) { local.feito = true; local.feitoEm = ri.feitoEm || local.feitoEm || todayISODate(); r.resolvidos++; }
        (ri.fotos || []).forEach(f => { local.fotos = local.fotos || []; if (!local.fotos.includes(f)) local.fotos.push(f); });
      }
    });
  });
  persist();
  return r;
}

async function vtExportarVistorias() {
  const ids = vtLista().flatMap(v => v.items.flatMap(i => i.fotos || []));
  if (ids.length) toast("Preparando as fotos…", "success");
  const dados = { tipo: "vistorias-sbj", versao: 2, exportadoEm: new Date().toISOString(), vistorias: vtLista(), fotos: await vtfColetar(ids) };
  const nome = vtNomeArquivo(["Vistorias", vtDataArquivo(todayISODate())], "json");
  const arq = new File([JSON.stringify(dados)], nome, { type: "application/json" });
  const celular = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (celular && navigator.share && navigator.canShare && navigator.canShare({ files: [arq] })) {
    try { await navigator.share({ files: [arq], title: nome }); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  const url = URL.createObjectURL(arq), a = document.createElement("a");
  a.href = url; a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast("Arquivo de vistorias baixado.", "success");
}

function vtAbrirSync() {
  const n = vtLista().reduce((s, v) => s + v.items.length, 0);
  openModal(`
    <div class="modal-header"><h3>Passar para outro aparelho</h3><button class="modal-close" id="vs-x" aria-label="Fechar">×</button></div>
    <div class="modal-body vt-form">
      <div class="vs-bloco">
        <strong>1. Neste aparelho: gerar o arquivo</strong>
        <p class="hint">Leva todas as vistorias daqui (${vtLista().length} apartamentos, ${n} pendências). No celular, abre o compartilhar: mande por e-mail ou WhatsApp para si mesmo.</p>
        <button type="button" class="btn primary" id="vs-exp">Gerar arquivo das vistorias</button>
      </div>
      <div class="vs-bloco">
        <strong>2. No outro aparelho: receber o arquivo</strong>
        <p class="hint">Escolha o arquivo recebido. O que já existe aqui é mantido; só entra o que for novo, e itens resolvidos em qualquer um dos lados ficam resolvidos.</p>
        <input type="file" id="vs-arq" accept=".json,application/json">
        <button type="button" class="btn ghost" id="vs-imp">Receber vistorias do arquivo</button>
        <div class="vt-import-res" id="vs-res"></div>
      </div>
    </div>
    <div class="modal-footer"><button class="btn ghost" id="vs-fechar">Fechar</button></div>`);
  const $ = id => document.getElementById(id);
  $("vs-x").onclick = $("vs-fechar").onclick = closeModal;
  $("vs-exp").onclick = vtExportarVistorias;
  $("vs-imp").onclick = async () => {
    const f = $("vs-arq").files[0]; if (!f) { toast("Escolha o arquivo.", "error"); return; }
    try {
      const d = JSON.parse(await f.text());
      if (!d || d.tipo !== "vistorias-sbj" || !Array.isArray(d.vistorias)) { $("vs-res").textContent = "Esse arquivo não é de vistorias do site."; return; }
      const nf = await vtfReceber(d.fotos);
      const r = vtMisturar(d.vistorias); r.fotos = nf;
      renderVistorias();
      $("vs-res").innerHTML = `Pronto: <strong>${r.vistoriasNovas}</strong> apartamento(s) novo(s), <strong>${r.itensNovos}</strong> pendência(s) nova(s), <strong>${r.resolvidos}</strong> marcada(s) como resolvida(s)${r.fotos ? ", <strong>" + r.fotos + "</strong> foto(s)" : ""}.`;
      toast("Vistorias recebidas.", "success");
    } catch (e) { $("vs-res").textContent = "Não consegui ler o arquivo: " + e.message; }
  };
}
