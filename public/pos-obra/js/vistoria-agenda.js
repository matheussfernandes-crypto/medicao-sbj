/* ---------- Agenda de vistorias de entrega ----------
   Marcar a vistoria de cada apartamento (dia, hora, proprietário), ver o mês e copiar uma imagem do mês para
   mandar no WhatsApp. A agenda é compartilhada (fica no servidor: /api/pos-obra/agenda); o que já foi carregado
   fica guardado no aparelho para consulta sem internet. Não altera vistorias nem pendências.
   "Realizar vistoria" lista as agendadas; ao salvar a vistoria, a agendada vira "realizada". */

const VA_API = "/api/pos-obra/agenda";
const VA_CACHE = "posobra_va_cache";
const VA_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const VA_DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const va = { lista: [], mes: "", obra: "", ok: false, erro: "", carregando: false };
(function () {
  try { va.lista = JSON.parse(localStorage.getItem(VA_CACHE) || "[]") || []; } catch (e) { va.lista = []; }
  /* o mês aberto só é definido quando a tela é desenhada (este arquivo carrega antes do app.js) */
})();

function vaGuardarCache() { try { localStorage.setItem(VA_CACHE, JSON.stringify(va.lista)); } catch (e) { /* sem armazenamento */ } }

async function vaPedir(url, opc) {
  let r;
  try { r = await fetch(url, { credentials: "include", cache: "no-store", ...(opc || {}) }); } catch (e) { throw new Error("Sem conexão com o servidor"); }
  if (r.status === 401 || r.status === 403) throw new Error("Sessão expirada: entre no site de novo");
  let j = null; try { j = await r.json(); } catch (e) { /* sem JSON */ }
  if (!r.ok || !j) throw new Error((j && j.error) || "Erro do servidor (" + r.status + ")");
  return j;
}

async function vaCarregar() {
  if (va.carregando) return;
  va.carregando = true;
  try {
    const j = await vaPedir(VA_API);
    va.lista = Array.isArray(j.itens) ? j.itens : [];
    va.ok = true; va.erro = "";
    vaGuardarCache();
  } catch (e) { va.erro = e.message || "Não foi possível atualizar a agenda."; }
  va.carregando = false;
  if (typeof renderVtAgenda === "function") renderVtAgenda();
}

async function vaGravar(item) {
  const { id, ...dados } = item;
  await vaPedir(VA_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, dados }) });
  const i = va.lista.findIndex(x => x.id === id);
  if (i >= 0) va.lista[i] = item; else va.lista.push(item);
  vaGuardarCache();
}

async function vaApagar(id) {
  await vaPedir(VA_API + "?id=" + encodeURIComponent(id), { method: "DELETE" });
  va.lista = va.lista.filter(x => x.id !== id);
  vaGuardarCache();
}

/* ---------- pequenos formatadores ---------- */
const vaHoraTxt = (h) => { const m = /^(\d{2}):(\d{2})$/.exec(h || ""); if (!m) return ""; return String(Number(m[1])) + "h" + (m[2] === "00" ? "" : m[2]); };
const vaPrimeiroNome = (n) => String(n || "").trim().split(/\s+/)[0] || "";
const vaNomeObra = (it) => { const b = getBuilding(it.buildingId); return b ? b.name : (it.buildingNome || ""); };
const vaObraCurta = (nome) => (typeof vtObraCurta === "function" ? vtObraCurta(nome) : nome);
const vaOrdem = (a, b) => (a.date + (a.hora || "99:99")).localeCompare(b.date + (b.hora || "99:99")) || String(a.unit).localeCompare(String(b.unit), "pt-BR", { numeric: true });

function vaDoMes() {
  return va.lista.filter(x => String(x.date || "").startsWith(va.mes) && (!va.obra || x.buildingId === va.obra)).sort(vaOrdem);
}

/* ---------- tela ---------- */
function renderVtAgenda() {
  const root = document.getElementById("view-vtagenda");
  if (!root || !root.classList.contains("active")) return;
  if (!va.mes) va.mes = todayISODate().slice(0, 7);
  if (!va.ok && !va.carregando && !va.erro) vaCarregar();

  const [ano, mes] = va.mes.split("-").map(Number);
  const itens = vaDoMes();
  const porDia = {};
  itens.forEach(x => { (porDia[x.date] = porDia[x.date] || []).push(x); });
  const obrasNoMes = new Set(itens.map(x => x.buildingId));
  const mostrarObra = !va.obra && obrasNoMes.size > 1;
  const hoje = todayISODate();

  const primeiro = new Date(ano, mes - 1, 1);
  const desloc = (primeiro.getDay() + 6) % 7;            // semana começa na segunda
  const dias = new Date(ano, mes, 0).getDate();
  const total = Math.ceil((desloc + dias) / 7) * 7;
  let celulas = "";
  for (let i = 0; i < total; i++) {
    const d = new Date(ano, mes - 1, 1 - desloc + i);
    const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const dentro = d.getMonth() === mes - 1;
    const evs = dentro ? (porDia[iso] || []) : [];
    const fds = i % 7 >= 5;
    celulas += `<div class="va-cel ${dentro ? "" : "fora"} ${fds ? "fds" : ""} ${iso === hoje ? "hoje" : ""} ${evs.length ? "" : "vazia"}" ${dentro ? `data-va-dia="${iso}"` : ""}>
      <div class="va-dia-n"><span>${d.getDate()}</span><em>${VA_DIAS[i % 7]}</em></div>
      ${evs.map(x => `<button type="button" class="va-ev ${x.status}" data-va-id="${escapeHtml(x.id)}" title="${escapeHtml(vaNomeObra(x) + " · apto " + x.unit + (x.nome ? " · " + x.nome : "") + (x.obs ? " · " + x.obs : ""))}">
        <b>${vaHoraTxt(x.hora) || "—"}</b> ${escapeHtml(x.unit)} ${escapeHtml(vaPrimeiroNome(x.nome))}${mostrarObra ? ` <small>${escapeHtml(vaObraCurta(vaNomeObra(x)))}</small>` : ""}
      </button>`).join("")}
    </div>`;
  }
  const obrasLista = state.buildings.filter(b => va.lista.some(x => x.buildingId === b.id) || b.id === va.obra);
  const totalAg = itens.filter(x => x.status === "agendada").length, totalRe = itens.filter(x => x.status === "realizada").length;

  root.innerHTML = `
    <form class="va-rapido" id="va-rapido-f" autocomplete="off">
      <input type="text" id="va-rapido" aria-label="Agendar escrevendo" placeholder="Escreva e aperte Enter. Ex.: agendar vistoria 804 ilha do campeche 19/11 às 9h">
      <button type="submit" class="btn primary">Preencher</button>
    </form>
    <div class="va-barra">
      <div class="va-mes">
        <button type="button" class="btn ghost" id="va-ant" aria-label="Mês anterior">‹</button>
        <h2>${VA_MESES[mes - 1]} de ${ano}</h2>
        <button type="button" class="btn ghost" id="va-prox" aria-label="Próximo mês">›</button>
        <button type="button" class="btn ghost" id="va-hoje">Hoje</button>
      </div>
      <div class="va-acoes">
        <label class="vt-campo">Obra<select id="va-obra"><option value="">Todas as obras</option>${obrasLista.map(b => `<option value="${b.id}" ${b.id === va.obra ? "selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}</select></label>
        <button type="button" class="btn ghost" id="va-copiar" ${itens.some(x => x.status !== "cancelada") ? "" : "disabled"}>Copiar imagem do mês</button>
        <button type="button" class="btn ghost" id="va-baixar" ${itens.some(x => x.status !== "cancelada") ? "" : "disabled"}>Baixar</button>
        <button type="button" class="btn primary" id="va-nova">Agendar vistoria</button>
      </div>
    </div>
    <div class="va-resumo"><strong>${totalAg}</strong> agendada${totalAg === 1 ? "" : "s"} · <strong>${totalRe}</strong> realizada${totalRe === 1 ? "" : "s"} neste mês
      <span class="va-estado">${va.carregando ? "atualizando…" : va.erro ? "sem conexão: mostrando o que já estava salvo neste aparelho" : ""}</span></div>
    <div class="va-grade-wrap"><div class="va-cab">${VA_DIAS.map(n => `<div>${n}</div>`).join("")}</div><div class="va-grade">${celulas}</div></div>`;

  const $ = id => root.querySelector("#" + id);
  $("va-rapido-f").addEventListener("submit", e => { e.preventDefault(); const v = $("va-rapido").value.trim(); if (!v) { $("va-rapido").focus(); return; } vaPreencherRapido(v); });
  $("va-ant").onclick = () => { vaMudaMes(-1); };
  $("va-prox").onclick = () => { vaMudaMes(1); };
  $("va-hoje").onclick = () => { va.mes = todayISODate().slice(0, 7); renderVtAgenda(); };
  $("va-obra").addEventListener("change", e => { va.obra = e.target.value; renderVtAgenda(); });
  $("va-nova").onclick = () => vaAbrirModal(null, hoje.startsWith(va.mes) ? hoje : va.mes + "-01");
  $("va-copiar").onclick = () => vaCopiarImagem();
  $("va-baixar").onclick = () => vaBaixarImagem();
  root.querySelectorAll("[data-va-id]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); const it = va.lista.find(x => x.id === b.dataset.vaId); if (it) vaAbrirModal(it); }));
  root.querySelectorAll("[data-va-dia]").forEach(c => c.addEventListener("click", () => vaAbrirModal(null, c.dataset.vaDia)));
}

function vaMudaMes(delta) {
  const [a, m] = va.mes.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  va.mes = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  renderVtAgenda();
}

/* ---------- escrever e preencher: "agendar vistoria 804 ilha do campeche 19/11 às 9h" ---------- */
const VA_SEMANA = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const vaIso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

function vaEntender(texto) {
  const orig = String(texto || "").replace(/\s+/g, " ").trim();
  let t = typeof vtNorm === "function" ? vtNorm(orig) : orig.toLowerCase();
  const achado = { buildingId: "", unit: "", date: "", hora: "", nome: "", resp: "" };
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);

  // responsável pela vistoria e proprietário (pelo texto original, para manter maiúsculas e acentos)
  const nomeApos = (re) => { const m = re.exec(orig); return m ? m[1].trim().replace(/\s+/g, " ").split(" ").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ") : ""; };
  const FIM = "(?=\\s+(?:respons[aá]vel|propriet[aá]rio|cliente|dono|com|[àa]s|dia|ap(?:to|artamento)?\\b|\\d)|$)";
  achado.resp = nomeApos(new RegExp("respons[aá]vel(?:\\s+pela\\s+vistoria)?(?:\\s+[ée])?\\s*:?\\s*([A-Za-zÀ-ÿ' ]+?)" + FIM, "i"));
  achado.nome = nomeApos(new RegExp("(?:propriet[aá]rio|cliente|dono|com\\s+o\\s+cliente|com)\\s*:?\\s+([A-Za-zÀ-ÿ' ]+?)" + FIM, "i"));
  if (/^(pela|vistoria)\b/i.test(achado.nome)) achado.nome = "";

  // data: 19/11, 19/11/2026, hoje, amanhã, dia da semana, "dia 19"
  let m = /(?<!\d)(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?(?!\d)/.exec(t);
  if (m) {
    const dia = Number(m[1]), mes = Number(m[2]);
    let ano = m[3] ? Number(m[3]) : hoje.getFullYear();
    if (ano < 100) ano += 2000;
    let d = new Date(ano, mes - 1, dia, 12);
    if (!m[3] && d < new Date(hoje.getTime() - 60 * 86400000)) d = new Date(ano + 1, mes - 1, dia, 12);   // sem ano e já passou faz tempo: ano que vem
    if (d.getMonth() === mes - 1) achado.date = vaIso(d);
    t = t.replace(m[0], " ");
  } else if (/\bdepois de amanha\b/.test(t)) { const d = new Date(hoje); d.setDate(d.getDate() + 2); achado.date = vaIso(d); }
  else if (/\bamanha\b/.test(t)) { const d = new Date(hoje); d.setDate(d.getDate() + 1); achado.date = vaIso(d); }
  else if (/\bhoje\b/.test(t)) achado.date = vaIso(hoje);
  else {
    const sem = Object.keys(VA_SEMANA).find(k => new RegExp("\\b" + k + "(?:-feira)?\\b").test(t));
    const dm = /\bdia\s+(\d{1,2})\b/.exec(t);
    if (sem) { const d = new Date(hoje); const falta = (VA_SEMANA[sem] - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + falta); achado.date = vaIso(d); }
    else if (dm) { let d = new Date(hoje.getFullYear(), hoje.getMonth(), Number(dm[1]), 12); if (d < new Date(hoje.getTime() - 86400000)) d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, Number(dm[1]), 12); achado.date = vaIso(d); t = t.replace(dm[0], " "); }
  }

  // horário: 9h, 14h30, 14:30, "às 9"
  m = /(?<!\d)(\d{1,2})\s*(?:h\s*(\d{2})?|:(\d{2}))(?!\d)/.exec(t) || /\bas\s+(\d{1,2})(?!\d)/.exec(t);
  if (m) {
    const hh = Number(m[1]), mm = Number(m[2] || m[3] || 0);
    if (hh <= 23 && mm <= 59) achado.hora = String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
    t = t.replace(m[0], " ");
  }

  // apartamento: 3 ou 4 dígitos (com ou sem "apto")
  m = /(?:\bap(?:to|artamento)?\s*)?(?<!\d)(\d{3,4})(?!\d)/.exec(t);
  if (m) { achado.unit = m[1]; t = t.replace(m[0], " "); }

  // obra: a que tem mais palavras do nome no texto (ex.: "campeche" em "Residencial Ilha do Campeche")
  const solta = new Set(["residencial", "ilha", "ilhas", "de", "do", "da", "dos", "das", "edificio", "condominio"]);
  let melhor = null, pontos = 0;
  state.buildings.forEach(b => {
    const palavras = vtNorm(b.name).split(" ").filter(p => p.length > 2 && !solta.has(p));
    const n = palavras.filter(p => t.includes(p)).length;
    if (n > pontos) { pontos = n; melhor = b; }
  });
  if (melhor) achado.buildingId = melhor.id;
  return achado;
}

function vaPreencherRapido(texto) {
  const a = vaEntender(texto);
  const faltam = [];
  if (!a.unit) faltam.push("apartamento");
  if (!a.date) faltam.push("data");
  if (!a.buildingId) faltam.push("obra");
  vaAbrirModal(null, a.date || (todayISODate().startsWith(va.mes) ? todayISODate() : va.mes + "-01"), a);
  toast(faltam.length ? "Preenchi o que entendi. Falta conferir: " + faltam.join(", ") + "." : "Preenchi pelo texto: confira e agende.", faltam.length ? "" : "success");
}

/* ---------- marcar / editar ---------- */
function vaAbrirModal(item, dataPref, pref) {
  const novo = !item;
  const base = { buildingId: va.obra || localStorage.getItem("posvenda_last_building") || (state.buildings[0] && state.buildings[0].id) || "", unit: "", date: dataPref || todayISODate(), hora: "", nome: "", resp: localStorage.getItem("posvenda_vf_resp") || "", obs: "", status: "agendada" };
  if (pref) Object.keys(pref).forEach(k => { if (pref[k]) base[k] = pref[k]; });
  const it = item || base;
  openModal(`
    <div class="modal-header"><h3>${novo ? "Agendar vistoria" : "Vistoria agendada"}</h3><button class="modal-close" id="va-x" aria-label="Fechar">×</button></div>
    <div class="modal-body vt-form">
      <label>Empreendimento<select id="va-m-obra">${state.buildings.map(b => `<option value="${b.id}" ${b.id === it.buildingId ? "selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}</select></label>
      <div class="vt-linha2">
        <label>Apartamento<input type="text" id="va-m-unit" placeholder="ex: 804" value="${escapeHtml(it.unit)}" autocomplete="off"></label>
        <label>Proprietário<input type="text" id="va-m-nome" placeholder="nome do dono" value="${escapeHtml(it.nome)}" autocomplete="off"></label>
      </div>
      <div class="vt-linha2">
        <label>Data<input type="date" id="va-m-data" value="${it.date}"></label>
        <label>Horário<input type="time" id="va-m-hora" value="${escapeHtml(it.hora || "")}"></label>
      </div>
      <div class="vt-linha2">
        <label>Responsável pela vistoria<input type="text" id="va-m-resp" placeholder="ex: Carlucia" value="${escapeHtml(it.resp || "")}" autocomplete="off"></label>
        <label>Observação (opcional)<input type="text" id="va-m-obs" value="${escapeHtml(it.obs || "")}" autocomplete="off"></label>
      </div>
      ${it.status === "cancelada" ? `<div class="va-aviso">Esta vistoria está cancelada.</div>` : it.status === "realizada" ? `<div class="va-aviso ok">Vistoria realizada.</div>` : ""}
    </div>
    <div class="modal-footer va-rodape">
      ${novo ? "" : `<button class="btn ghost" id="va-m-excluir">Excluir</button>`}
      ${novo || it.status === "realizada" ? "" : `<button class="btn ghost" id="va-m-cancelar">${it.status === "cancelada" ? "Reativar" : "Cancelar vistoria"}</button>`}
      <span class="va-esp"></span>
      ${novo || it.status !== "agendada" ? "" : `<button class="btn ghost" id="va-m-fazer">Realizar vistoria</button>`}
      <button class="btn primary" id="va-m-ok">${novo ? "Agendar" : "Salvar"}</button>
    </div>`);
  const $ = id => document.getElementById(id);
  $("va-x").onclick = closeModal;

  // o nome do proprietário vem do cadastro de clientes quando o campo está vazio
  const sugerir = () => {
    const n = $("va-m-nome");
    if (n.dataset.manual === "1" && n.value.trim()) return;
    const nome = vtNomeCliente($("va-m-obra").value, $("va-m-unit").value.trim());
    if (nome) n.value = nome;
  };
  $("va-m-nome").addEventListener("input", () => { $("va-m-nome").dataset.manual = "1"; });
  $("va-m-unit").addEventListener("input", sugerir);
  $("va-m-obra").addEventListener("change", sugerir);
  if (novo) {
    if (pref && pref.nome) $("va-m-nome").dataset.manual = "1";
    sugerir();   // proprietário vem do cadastro de clientes quando o apartamento já foi digitado
    setTimeout(() => { const f = !$("va-m-unit").value ? $("va-m-unit") : !$("va-m-resp").value ? $("va-m-resp") : null; if (f) f.focus(); }, 60);
  }

  const ler = () => ({
    ...it,
    id: it.id || ("va" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)),
    buildingId: $("va-m-obra").value,
    buildingNome: (getBuilding($("va-m-obra").value) || {}).name || "",
    unit: $("va-m-unit").value.trim(),
    nome: $("va-m-nome").value.trim(),
    date: $("va-m-data").value,
    hora: $("va-m-hora").value || "",
    obs: $("va-m-obs").value.trim(),
    resp: $("va-m-resp").value.trim(),
    criadoEm: it.criadoEm || new Date().toISOString(),
    criadoPor: it.criadoPor || (typeof getOperatorName === "function" ? getOperatorName() : ""),
  });
  const salvar = async (extra, msg) => {
    const novoIt = Object.assign(ler(), extra || {});
    if (!novoIt.unit) { toast("Informe o apartamento.", "error"); $("va-m-unit").focus(); return null; }
    if (!novoIt.date) { toast("Informe a data.", "error"); return null; }
    try { await vaGravar(novoIt); } catch (e) { toast(e.message || "Não foi possível salvar.", "error"); return null; }
    closeModal(); va.mes = novoIt.date.slice(0, 7); renderVtAgenda(); toast(msg || "Agenda atualizada.", "success");
    return novoIt;
  };
  $("va-m-ok").onclick = () => salvar(null, novo ? "Vistoria agendada." : "Agenda atualizada.");
  $("va-m-unit").addEventListener("keydown", e => { if (e.key === "Enter") $("va-m-ok").click(); });
  const bc = $("va-m-cancelar");
  if (bc) bc.onclick = () => salvar({ status: it.status === "cancelada" ? "agendada" : "cancelada" }, it.status === "cancelada" ? "Vistoria reativada." : "Vistoria cancelada.");
  const bx = $("va-m-excluir");
  if (bx) bx.onclick = () => vtConfirmar({ titulo: "Excluir da agenda?", texto: `A vistoria do apto ${it.unit} sai da agenda. As vistorias já feitas e as pendências não são afetadas.`, botao: "Excluir", aoConfirmar: async () => {
    try { await vaApagar(it.id); renderVtAgenda(); toast("Removida da agenda.", "success"); } catch (e) { toast(e.message || "Não foi possível excluir.", "error"); }
  } });
  const bf = $("va-m-fazer");
  if (bf) bf.onclick = async () => { const s = await salvar(null, "Agenda atualizada."); if (s) vaRealizar(s); };
}

/* abre "Realizar vistoria" já com a obra e o apartamento da agendada */
function vaRealizar(item) {
  if (typeof vfIniciarAgendada !== "function") return;
  if (typeof showView === "function") showView("vistorias");
  vfIniciarAgendada(item);
}

/* agendadas que ainda dá para fazer (para a tela "Realizar vistoria") */
function vaAgendadasParaFazer() {
  const hoje = todayISODate();
  const limite = new Date(); limite.setDate(limite.getDate() + 21);
  const ate = limite.getFullYear() + "-" + String(limite.getMonth() + 1).padStart(2, "0") + "-" + String(limite.getDate()).padStart(2, "0");
  return va.lista.filter(x => x.status === "agendada" && x.date <= ate && x.date >= vaAddDias(hoje, -30)).sort(vaOrdem);
}
function vaAddDias(iso, n) { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

/* quando a vistoria é salva, a agendada correspondente vira "realizada" */
async function vaMarcarRealizada(agendaId, vistoriaId) {
  const it = va.lista.find(x => x.id === agendaId);
  if (!it || it.status === "realizada") return;
  try { await vaGravar({ ...it, status: "realizada", vistoriaId: vistoriaId || "", realizadaEm: new Date().toISOString() }); } catch (e) { /* a agenda se acerta na próxima vez */ }
  if (typeof renderVtAgenda === "function") renderVtAgenda();
}
function vaAutoRealizada(v) {
  const it = va.lista.find(x => x.status === "agendada" && x.buildingId === v.buildingId && String(x.unit).toLowerCase() === String(v.unit).toLowerCase() && x.date === v.date);
  if (it) vaMarcarRealizada(it.id, v.id);
}

/* ---------- imagem do mês (para o WhatsApp) ---------- */
function vaCarregarImagem(src) {
  return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
}

async function vaGerarImagem() {
  const [ano, mes] = va.mes.split("-").map(Number);
  const itens = vaDoMes().filter(x => x.status !== "cancelada");
  const porDia = {};
  itens.forEach(x => { (porDia[x.date] = porDia[x.date] || []).push(x); });
  const obras = Array.from(new Set(itens.map(x => x.buildingId)));
  const mostrarObra = !va.obra && obras.length > 1;
  const tituloObra = va.obra ? vaNomeObra({ buildingId: va.obra }) : (obras.length === 1 ? vaNomeObra(itens[0]) : "Todas as obras");

  const W = 1600, PAD = 40, FONTE = '"Segoe UI", system-ui, -apple-system, Arial, sans-serif';
  const desloc = (new Date(ano, mes - 1, 1).getDay() + 6) % 7;
  const dias = new Date(ano, mes, 0).getDate();
  const semanas = Math.ceil((desloc + dias) / 7);
  const larg = (W - PAD * 2) / 7;
  const maxPorSemana = [];
  for (let s = 0; s < semanas; s++) {
    let m = 0;
    for (let c = 0; c < 7; c++) {
      const n = s * 7 + c - desloc + 1;
      if (n >= 1 && n <= dias) m = Math.max(m, (porDia[va.mes + "-" + String(n).padStart(2, "0")] || []).length);
    }
    maxPorSemana.push(m);
  }
  const altLinha = n => Math.max(118, 52 + n * 34 + 14);
  const HEAD = 170, SEMANA = 52, RODAPE = 56;
  const H = PAD + HEAD + 24 + SEMANA + maxPorSemana.reduce((a, n) => a + altLinha(n), 0) + RODAPE + PAD;

  const cv = document.createElement("canvas");
  cv.width = W * 2; cv.height = H * 2;
  const g = cv.getContext("2d");
  g.scale(2, 2);
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.fillStyle = "#f4f6f9"; g.fillRect(0, 0, W, H);

  // faixa do título
  g.fillStyle = "#0C6B76"; rr(PAD, PAD, W - PAD * 2, HEAD, 22); g.fill();
  g.fillStyle = "#F5E400"; g.fillRect(PAD + 22, PAD + HEAD - 8, W - PAD * 2 - 44, 6);
  g.fillStyle = "#cfe6e9"; g.font = `600 24px ${FONTE}`; g.textBaseline = "alphabetic";
  g.fillText("VISTORIAS DE ENTREGA", PAD + 40, PAD + 52);
  g.fillStyle = "#ffffff"; g.font = `800 58px ${FONTE}`;
  g.fillText(VA_MESES[mes - 1].charAt(0).toUpperCase() + VA_MESES[mes - 1].slice(1) + " de " + ano, PAD + 40, PAD + 116);
  g.fillStyle = "#F5E400"; g.font = `700 26px ${FONTE}`;
  g.fillText(tituloObra, PAD + 40, PAD + 150);
  const logo = await vaCarregarImagem("assets/logo-sbj-claro.png");
  if (logo) { const h = 118, w = h * (logo.width / logo.height); g.drawImage(logo, W - PAD - 40 - w, PAD + 22, w, h); }

  // dias da semana
  let y = PAD + HEAD + 24;
  g.fillStyle = "#e3edef"; rr(PAD, y, W - PAD * 2, SEMANA - 6, 12); g.fill();
  g.fillStyle = "#094F58"; g.font = `700 24px ${FONTE}`; g.textAlign = "center";
  VA_DIAS.forEach((n, i) => g.fillText(n.toUpperCase(), PAD + larg * i + larg / 2, y + 33));
  y += SEMANA;

  // semanas
  for (let s = 0; s < semanas; s++) {
    const alt = altLinha(maxPorSemana[s]);
    for (let c = 0; c < 7; c++) {
      const n = s * 7 + c - desloc + 1;
      const x = PAD + larg * c;
      const dentro = n >= 1 && n <= dias;
      g.fillStyle = !dentro ? "#eef1f4" : c >= 5 ? "#f7f9fa" : "#ffffff";
      g.fillRect(x + 1, y + 1, larg - 2, alt - 2);
      g.strokeStyle = "#dfe5ea"; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, larg - 1, alt - 1);
      const d = new Date(ano, mes - 1, n);
      g.textAlign = "left"; g.fillStyle = dentro ? "#5b6775" : "#b4bcc6"; g.font = `600 24px ${FONTE}`;
      g.fillText(String(d.getDate()), x + 14, y + 34);
      if (!dentro) continue;
      const evs = porDia[va.mes + "-" + String(n).padStart(2, "0")] || [];
      evs.forEach((e, k) => {
        const txt = `${vaHoraTxt(e.hora) || "—"} - ${e.unit} ${vaPrimeiroNome(e.nome)}` + (mostrarObra ? ` · ${vaObraCurta(vaNomeObra(e))}` : "");
        g.font = `700 25px ${FONTE}`;
        g.fillStyle = e.status === "realizada" ? "#1f8a4c" : "#094F58";
        let t = txt;
        while (t.length > 3 && g.measureText(t).width > larg - 26) t = t.slice(0, -2);
        if (t !== txt) t = t.trimEnd() + "…";
        g.fillText(t, x + 14, y + 66 + k * 34);
      });
    }
    y += alt;
  }

  // rodapé
  g.textAlign = "left"; g.fillStyle = "#6b7686"; g.font = `500 22px ${FONTE}`;
  g.fillText("SBJ Construtora e Incorporadora · horário - apartamento e proprietário", PAD, y + 38);
  g.textAlign = "right";
  g.fillText("Atualizado em " + fmtDate(todayISODate()), W - PAD, y + 38);
  return new Promise(res => cv.toBlob(b => res(b), "image/png"));
}

async function vaCopiarImagem() {
  const botao = document.getElementById("va-copiar");
  if (botao) botao.disabled = true;
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": vaGerarImagem() })]);
      toast("Imagem copiada: é só colar no WhatsApp.", "success");
    } else {
      await vaBaixarImagem();
      toast("Este navegador não copia imagens: a imagem foi baixada.", "success");
    }
  } catch (e) {
    await vaBaixarImagem();
    toast("Não consegui copiar; a imagem foi baixada.", "success");
  }
  if (botao) botao.disabled = false;
}

async function vaBaixarImagem() {
  const blob = await vaGerarImagem();
  if (!blob) { toast("Não foi possível gerar a imagem.", "error"); return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "agenda-vistorias-" + va.mes + ".png";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
