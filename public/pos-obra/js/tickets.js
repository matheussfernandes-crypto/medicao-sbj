/* ---------- Utilidades de chamado ---------- */

function getOperatorName() { return localStorage.getItem("posvenda_operator_name") || ""; }
function setOperatorName(name) { localStorage.setItem("posvenda_operator_name", name || ""); }

function ensureOperatorName() {
  return getOperatorName() || "Atendimento";
}

function addHistoryEntry(ticket, action, note, statusFrom, statusTo) {
  ticket.history.push({
    date: new Date().toISOString(),
    user: ensureOperatorName(),
    action,
    note: note || "",
    statusFrom: statusFrom || "",
    statusTo: statusTo || "",
  });
  ticket.dataUltimaAcao = todayISODate();
}

/* "Data de acompanhamento" é um lembrete, não um prazo de execução — por isso não
   chamamos de "atrasado". Quando a data chega/passa e ninguém atualizou o chamado
   ainda, ele aparece como "⏰ Acompanhamento pendente". */
/* Quando o chamado já usa Plano de Atendimento, "próxima ação" deixa de ser um
   campo digitado e passa a ser derivada da ATIVIDADE aberta mais próxima (pela
   data da sua próxima execução pendente) — chamados que ainda não têm nenhuma
   atividade continuam usando os campos manuais. Devolve a atividade inteira
   (não uma execução solta): "aberta" aqui significa que atividadeStatus() dela
   não é "concluida" nem "cancelada" — ver essa função mais abaixo, é ela quem
   decide se uma atividade com execuções não realizadas ainda conta como
   pendente ou já foi resolvida por uma execução posterior. */
function chaveOrdenacaoAtividade(atividade) {
  const pend = (atividade.execucoes || []).filter(e => e.resultado === "pendente" && e.data);
  if (!pend.length) return "9999-99-99";
  return pend.slice().sort((a, b) => a.data.localeCompare(b.data))[0].data;
}
function proximaAtividadePendente(t) {
  const abertas = (t.plano || []).filter(a => !["concluida", "cancelada"].includes(atividadeStatus(a)));
  if (!abertas.length) return null;
  return abertas.slice().sort((a, b) => chaveOrdenacaoAtividade(a).localeCompare(chaveOrdenacaoAtividade(b)))[0];
}
/* A execução pendente mais próxima dentro de uma atividade — usada onde antes
   se lia etapa.data/horario direto (agora isso mora dentro de cada execução). */
function proximaExecucaoDaAtividade(atividade) {
  const pend = (atividade.execucoes || []).filter(e => e.resultado === "pendente");
  if (!pend.length) return null;
  return pend.slice().sort((a, b) => (a.data || "9999-99-99").localeCompare(b.data || "9999-99-99"))[0];
}
/* Status do chamado deixou de ser algo que o usuário escolhe numa caixa — é
   sempre derivado do que está acontecendo no Plano de Atendimento. Chamados
   fechados nunca são recalculados (encerramento é decisão humana, via
   Resolução). Atividade de nome livre que não bate com a tabela abaixo não
   muda o status — evita rotular errado algo que o sistema não reconhece. */
function statusCalculadoPeloPlano(t) {
  if (CLOSED_STATUSES.includes(t.status)) return t.status;

  const linkAguardando = (t.fornecedores || []).find(f => !f.dataExecutada);
  if (linkAguardando) return "aguardando_fornecedor";

  if (t.clienteAguardando) return "aguardando_cliente";

  const NOME_STATUS = { "Realizar vistoria": "aguardando_vistoria", "Realizar reparo": "aguardando_reparo", "Conferir reparo": "aguardando_conferencia" };
  const prox = proximaAtividadePendente(t);
  if (prox && NOME_STATUS[prox.nome]) return NOME_STATUS[prox.nome];

  const concluidas = (t.plano || []).filter(a => atividadeStatus(a) === "concluida")
    .sort((a, b) => ((ultimaExecucaoRealizada(b) || {}).dataConclusao || "").localeCompare((ultimaExecucaoRealizada(a) || {}).dataConclusao || ""));
  if (concluidas[0] && concluidas[0].nome === "Solicitar orçamento") return "aguardando_orcamento";

  return "novo";
}
/* Substitui persist() em qualquer handler que mexa em plano/fornecedores/
   encerramento do chamado — mantém t.status sempre coerente com os fatos. */
function persistTicket(t) {
  t.status = statusCalculadoPeloPlano(t);
  persist();
}

function planoProgresso(t) {
  const total = (t.plano || []).length;
  const concluidas = (t.plano || []).filter(a => atividadeStatus(a) === "concluida").length;
  return { total, concluidas, pct: total ? Math.round((concluidas / total) * 100) : 0 };
}
function proximaAcaoDisplay(t) {
  if (t.plano && t.plano.length) {
    const prox = proximaAtividadePendente(t);
    if (!prox) return { texto: "Todas as atividades do plano concluídas.", responsavel: "", data: "" };
    const exec = proximaExecucaoDaAtividade(prox);
    return { texto: prox.nome, responsavel: prox.responsavel, data: exec ? exec.data : "" };
  }
  return { texto: t.proximaAcao || "", responsavel: t.responsavelProximaAcao || "", data: t.dataAcompanhamento || "" };
}

function isAcompanhamentoPendente(t) {
  if (CLOSED_STATUSES.includes(t.status)) return false;
  if (t.plano && t.plano.length) {
    const prox = proximaAtividadePendente(t);
    if (!prox) return false;
    if (atividadeStatus(prox) === "nao_realizada") return true;
    const exec = proximaExecucaoDaAtividade(prox);
    return !!exec && !!exec.data && exec.data <= todayISODate();
  }
  return !!t.dataAcompanhamento && t.dataAcompanhamento <= todayISODate();
}
function isActionToday(t) {
  if (CLOSED_STATUSES.includes(t.status)) return false;
  if (t.plano && t.plano.length) {
    const prox = proximaAtividadePendente(t);
    const exec = prox ? proximaExecucaoDaAtividade(prox) : null;
    return !!exec && exec.data === todayISODate();
  }
  return t.dataAcompanhamento === todayISODate();
}

/* Reincidência: mesmo prédio+unidade+categoria, chamado anterior já encerrado. */
function findSameUnitReincidence(ticket) {
  return state.tickets
    .filter(t => t.id !== ticket.id && t.buildingId === ticket.buildingId && t.unit === ticket.unit
      && ticketSistema(t) === ticketSistema(ticket) && CLOSED_STATUSES.includes(t.status) && t.openedAt < ticket.openedAt)
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0] || null;
}
/* Mesmo problema (categoria+local) em outras unidades do mesmo prédio. */
function findSimilarInBuilding(ticket) {
  if (!ticket.local) return [];
  return state.tickets.filter(t => t.id !== ticket.id && t.buildingId === ticket.buildingId && t.unit !== ticket.unit
    && ticketSistema(t) === ticketSistema(ticket) && (t.local || "").trim().toLowerCase() === ticket.local.trim().toLowerCase());
}

function ticketProblemLabel(t) { return t.title || t.analiseTecnica?.problemaRelatado?.slice(0, 60) || "(sem título)"; }

/* Critério objetivo de "crítico" pra Home — reaproveita sinais que já
   existem, não inventa campo novo no chamado. */
function isTicketCritico(t) {
  if (CLOSED_STATUSES.includes(t.status)) return false;
  if (t.priority === "alta" || t.priority === "critica") return true;
  if (isAcompanhamentoPendente(t)) return true;
  const semRetornoHaMuito = (t.fornecedores || []).some(f => isFornecedorSemRetorno(t, f) && daysDiff(f.dataAcionamento, todayISODate()) >= 10);
  if (semRetornoHaMuito) return true;
  if (findSameUnitReincidence(t)) return true;
  return false;
}

/* ---------- Campo "selecione ou adicione" reutilizável ---------- */
/* Dropdown com lista pré-definida + opção "+ Adicionar..." que cadastra um item novo
   na hora, sem sair do formulário. Usado para Responsável interno/próxima ação
   (state.teamInternal/teamNextAction) e para Ambiente/elemento (por prédio+local). */

function inlineAddSelectHTML({ label, fieldName, options, selected, required, disabled, addLabel, kind, extraData }) {
  const dataAttrs = Object.entries(extraData || {}).map(([k, v]) => `data-${k}="${escapeHtml(v)}"`).join(" ");
  return `
  <div class="field">
    <label>${label}${required ? " *" : ""}</label>
    <select name="${fieldName}" data-kind="${kind}" ${dataAttrs} ${required ? "required" : ""} ${disabled ? "disabled" : ""}>
      <option value="">Selecione...</option>
      ${options.map(o => `<option value="${escapeHtml(o)}" ${o === selected ? "selected" : ""}>${escapeHtml(o)}</option>`).join("")}
      ${selected && !options.includes(selected) ? `<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>` : ""}
      <option value="__add__">+ ${addLabel}...</option>
    </select>
    <div class="add-person-row" style="display:none;">
      <input type="text" class="add-person-input" placeholder="${addLabel}">
      <button type="button" class="btn ghost small add-person-btn">Adicionar</button>
    </div>
  </div>`;
}

function personFieldHTML(label, fieldName, teamKey, selected, required, disabled) {
  return inlineAddSelectHTML({
    label, fieldName, selected, required, disabled,
    options: state[teamKey] || [], addLabel: "Adicionar pessoa",
    kind: "team", extraData: { "team-key": teamKey },
  });
}

/* Um chamado pode envolver vários ambientes ao mesmo tempo (ex: "porta não fecha"
   em quarto + banheiro) — por isso é um grupo de checkboxes, não um select único.
   A lista de opções continua vindo de getAmbientesForLocal (por prédio+local). */
function ambientesMultiFieldHTML(buildingId, localTipoId, selectedList, disabled) {
  const building = getBuilding(buildingId);
  const options = (building && localTipoId) ? getAmbientesForLocal(building, localTipoId) : [];
  const sel = selectedList || [];
  const checkable = options.filter(o => o.toLowerCase() !== "outro");
  return `
  <div class="field full">
    <label>Ambiente(s) envolvido(s)</label>
    <div class="checkbox-group" data-ambientes-group data-building-id="${buildingId || ""}" data-local-tipo="${localTipoId || ""}">
      ${checkable.length ? checkable.map(o => `<label class="checkbox-inline"><input type="checkbox" name="ambientes" value="${escapeHtml(o)}" ${sel.includes(o) ? "checked" : ""} ${disabled ? "disabled" : ""}> ${escapeHtml(o)}</label>`).join("") : '<span class="empty-hint">Selecione o local do chamado primeiro.</span>'}
    </div>
    ${!disabled ? `
    <div class="add-person-row" style="display:flex;">
      <input type="text" class="add-ambiente-input" placeholder="Adicionar ambiente">
      <button type="button" class="btn ghost small add-ambiente-btn">Adicionar</button>
    </div>` : ""}
  </div>`;
}
function wireAmbientesMultiField(root) {
  root.querySelectorAll("[data-ambientes-group]").forEach(group => {
    const row = group.parentElement.querySelector(".add-person-row");
    if (!row) return;
    const input = row.querySelector(".add-ambiente-input");
    const btn = row.querySelector(".add-ambiente-btn");
    function confirmAdd() {
      const name = input.value.trim();
      if (!name) return;
      const building = getBuilding(group.dataset.buildingId);
      if (building && group.dataset.localTipo) { addAmbienteToBuilding(building, group.dataset.localTipo, name); persist(); }
      const existing = group.querySelector(`input[value="${CSS.escape(name)}"]`);
      if (existing) {
        existing.checked = true;
      } else {
        group.querySelector(".empty-hint")?.remove();
        const label = document.createElement("label");
        label.className = "checkbox-inline";
        label.innerHTML = `<input type="checkbox" name="ambientes" value="${escapeHtml(name)}" checked> ${escapeHtml(name)}`;
        group.appendChild(label);
      }
      input.value = "";
    }
    btn.addEventListener("click", confirmAdd);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); confirmAdd(); } });
  });
}

/* Hierarquia Sistema -> Material/Tipo -> Elemento (SISTEMA_ESTRUTURA em data.js).
   Só aparece quando o sistema escolhido tem essa estrutura cadastrada — sistemas
   simples (ex: Hidráulica) não mostram esses campos. */
function materialFieldHTML(sistema, selected, disabled) {
  const estrutura = SISTEMA_ESTRUTURA[sistema];
  if (!estrutura || !estrutura.materiais) return "";
  return inlineAddSelectHTML({
    label: "Material / tipo", fieldName: "material", selected, disabled,
    options: estrutura.materiais.map(m => m.label), addLabel: "Adicionar material",
    kind: "material_custom",
  });
}
function elementoOptionsForSistema(sistema, materialLabel) {
  const estrutura = SISTEMA_ESTRUTURA[sistema];
  if (!estrutura) return [];
  if (estrutura.materiais) {
    const m = estrutura.materiais.find(x => x.label === materialLabel);
    return m ? (m.elementos || []) : [];
  }
  return estrutura.elementos || [];
}
function elementoFieldHTML(sistema, materialLabel, selected, disabled) {
  const options = elementoOptionsForSistema(sistema, materialLabel);
  if (!options.length) return "";
  return inlineAddSelectHTML({
    label: "Elemento", fieldName: "elemento", selected, disabled,
    options, addLabel: "Adicionar elemento",
    kind: "elemento_custom",
  });
}

function wireInlineAddSelects(root) {
  root.querySelectorAll("select[data-kind]").forEach(sel => {
    const row = sel.parentElement.querySelector(".add-person-row");
    const input = row.querySelector(".add-person-input");
    const btn = row.querySelector(".add-person-btn");
    let previousValue = sel.value === "__add__" ? "" : sel.value;

    function persistNewValue(name) {
      if (sel.dataset.kind === "team") {
        const teamKey = sel.dataset.teamKey;
        if (!state[teamKey].includes(name)) { state[teamKey].push(name); persist(); }
      }
      /* kind "material_custom"/"elemento_custom": valor livre por chamado, não
         persiste numa lista compartilhada — só entra como opção deste select. */
    }

    function confirmAdd() {
      const name = input.value.trim();
      if (!name) { row.style.display = "none"; sel.value = previousValue; return; }
      persistNewValue(name);
      const addOpt = sel.querySelector('option[value="__add__"]');
      if (!sel.querySelector(`option[value="${CSS.escape(name)}"]`)) {
        const opt = document.createElement("option");
        opt.value = name; opt.textContent = name;
        sel.insertBefore(opt, addOpt);
      }
      sel.value = name;
      previousValue = name;
      row.style.display = "none";
      input.value = "";
      sel.dispatchEvent(new Event("item-added"));
    }

    sel.addEventListener("change", () => {
      if (sel.value === "__add__") {
        row.style.display = "flex";
        input.focus();
      } else {
        previousValue = sel.value;
        row.style.display = "none";
      }
    });
    btn.addEventListener("click", confirmAdd);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); confirmAdd(); }
      if (e.key === "Escape") { row.style.display = "none"; sel.value = previousValue; }
    });
  });
}

/* ---------- Lista de chamados ---------- */

let ticketTypeFilter = "todos";
/* Dimensão de filtro extra, só pra tornar os cards da Home clicáveis —
   cobre combinações que o <select> de status sozinho não expressa (ex.:
   "aberto" é vários status ao mesmo tempo). Nada nos filtros que já
   existiam foi alterado, só uma camada a mais no encadeamento. */
let ticketQuickFilter = "abertos"; // "atencao" | "abertos" | "andamento" | "atrasados" | "hoje" | "criticos" | "concluidos" | null (= todos)
const TICKET_QUICK_FILTER_LABELS = {
  abertos: "Chamados abertos", andamento: "Em andamento", atrasados: "Atrasados",
  hoje: "Agendados hoje", criticos: "Chamados críticos",
  atencao: "Precisam de atenção", concluidos: "Concluídos",
};
/* Botões da barra de filtros rápidos da lista (um toque, com contagem). */
const TICKET_QF_CHIPS = [["atencao", "Precisam de atenção"], ["abertos", "Abertos"], ["hoje", "Hoje"], ["concluidos", "Concluídos"], [null, "Todos"]];
function ticketQuickFilterMatch(t, kind) {
  if (kind === "abertos") return OPEN_STATUSES.includes(t.status);
  if (kind === "andamento") return OPEN_STATUSES.includes(t.status) && t.status !== "novo";
  if (kind === "atrasados") return isAcompanhamentoPendente(t);
  if (kind === "hoje") return isActionToday(t);
  if (kind === "criticos") return isTicketCritico(t);
  if (kind === "atencao") return OPEN_STATUSES.includes(t.status) && (isAcompanhamentoPendente(t) || isActionToday(t));
  if (kind === "concluidos") return CLOSED_STATUSES.includes(t.status);
  return true;
}
/* Chamado a partir dos cards/chips da Home — troca de tela e já deixa a
   lista de Chamados filtrada certa, sem misturar com filtros antigos. */
function abrirChamadosComFiltro(kind, statusId) {
  ticketQuickFilter = statusId ? null : kind;
  ticketTypeFilter = "todos";
  showView("tickets"); // já roda renderAll() -> populateFilterSelects(), que recria as <option> e zeraria um value setado antes dele
  document.getElementById("filter-building").value = "";
  document.getElementById("filter-status").value = statusId || "";
  document.getElementById("filter-category").value = "";
  document.getElementById("filter-priority").value = "";
  document.getElementById("filter-overdue").checked = false;
  document.querySelectorAll("#ticket-type-filter .chip").forEach(c => c.classList.toggle("active", c.dataset.type === "todos"));
  renderTickets();
}

function populateFilterSelects() {
  const bSel = document.getElementById("filter-building");
  bSel.innerHTML = `<option value="">Todos os prédios</option>` + state.buildings.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");

  const sSel = document.getElementById("filter-status");
  sSel.innerHTML = `<option value="">Todos os status</option>` + TICKET_STATUS.map(s => `<option value="${s.id}">${s.label}</option>`).join("");

  const cSel = document.getElementById("filter-category");
  cSel.innerHTML = `<option value="">Todas as categorias</option>` + CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");

  const pSel = document.getElementById("filter-priority");
  pSel.innerHTML = `<option value="">Todas as prioridades</option>` + PRIORITIES.map(p => `<option value="${p.id}">${p.label}</option>`).join("");
}

function currentTicketFilters() {
  return {
    building: document.getElementById("filter-building").value,
    status: document.getElementById("filter-status").value,
    category: document.getElementById("filter-category").value,
    priority: document.getElementById("filter-priority").value,
    overdue: document.getElementById("filter-overdue").checked,
    type: ticketTypeFilter,
    search: (document.getElementById("global-search").value || "").trim().toLowerCase(),
  };
}

/* ---------- Ordenação clicável da lista de chamados ---------- */
/* Puramente de tela — nunca persistida (nem em state, nem em localStorage).
   Some ao recarregar a página, igual ticketQuickFilter/ticketTypeFilter acima. */
let ticketSort = { key: null, dir: null }; // dir: "asc" | "desc" | null (null = ordenação padrão)

const TICKET_SORT_LABELS = {
  id: "Chamado", building: "Empreendimento", unit: "Unidade", client: "Cliente",
  problem: "Problema", priority: "Prioridade", status: "Status",
  responsavel: "Responsável", proximaAcao: "Próxima ação", data: "Acompanhamento",
};
/* Texto do sentido pra cada coluna no indicador "Ordenando por" — cada tipo de
   dado tem um jeito natural de descrever crescente/decrescente. */
const TICKET_SORT_DIR_LABELS = {
  id: { asc: "↑", desc: "↓" },
  building: { asc: "A–Z", desc: "Z–A" },
  unit: { asc: "menor→maior", desc: "maior→menor" },
  client: { asc: "A–Z", desc: "Z–A" },
  problem: { asc: "A–Z", desc: "Z–A" },
  priority: { asc: "baixa→crítica", desc: "crítica→baixa" },
  status: { asc: "↑", desc: "↓" },
  responsavel: { asc: "A–Z", desc: "Z–A" },
  proximaAcao: { asc: "A–Z", desc: "Z–A" },
  data: { asc: "mais antiga→mais recente", desc: "mais recente→mais antiga" },
};

function ticketSortValue(key, t) {
  switch (key) {
    case "id": return t.id;
    case "building": { const b = getBuilding(t.buildingId); return b ? b.name : ""; }
    case "unit": return t.unit || "";
    case "client": return t.requesterName || "";
    case "problem": return ticketProblemLabel(t);
    case "responsavel": return t.responsavelInterno || "";
    case "proximaAcao": return proximaAcaoDisplay(t).texto || "";
    case "data": return proximaAcaoDisplay(t).data || "";
    default: return "";
  }
}
/* Comparação de texto (vazio sempre por último, nas duas direções — igual
   Excel). Números (unidade) e ranks (prioridade/status) têm tratamento à parte. */
function compareEmptyLast(va, vb, mult, cmpFn) {
  const aEmpty = !va, bEmpty = !vb;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  return cmpFn(va, vb) * mult;
}
function ticketUnitRank(t) {
  const n = parseInt(t.unit, 10);
  return isNaN(n) ? null : n;
}
function compareTicketsByKey(key, dir, a, b) {
  const mult = dir === "desc" ? -1 : 1;
  if (key === "priority") {
    return (PRIORITIES.findIndex(p => p.id === a.priority) - PRIORITIES.findIndex(p => p.id === b.priority)) * mult;
  }
  if (key === "status") {
    const r = (TICKET_STATUS.findIndex(s => s.id === a.status) - TICKET_STATUS.findIndex(s => s.id === b.status)) * mult;
    if (r !== 0) return r;
    // desempate: dentro do mesmo status, data mais relevante primeiro (mesmo critério da ordenação padrão)
    return compareEmptyLast(ticketSortValue("data", a), ticketSortValue("data", b), 1, (x, y) => x.localeCompare(y));
  }
  if (key === "unit") {
    const ra = ticketUnitRank(a), rb = ticketUnitRank(b);
    const r = compareEmptyLast(ra, rb, mult, (x, y) => x - y);
    if (r !== 0) return r;
    const rBuilding = ticketSortValue("building", a).localeCompare(ticketSortValue("building", b), "pt-BR") * mult;
    if (rBuilding !== 0) return rBuilding;
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  }
  if (key === "data") {
    return compareEmptyLast(ticketSortValue("data", a), ticketSortValue("data", b), mult, (x, y) => x.localeCompare(y));
  }
  const va = ticketSortValue(key, a), vb = ticketSortValue(key, b);
  const r = compareEmptyLast(va, vb, mult, (x, y) => x.localeCompare(y, "pt-BR", { numeric: true }));
  if (r !== 0) return r;
  if (key === "building") {
    const ra = ticketUnitRank(a), rb = ticketUnitRank(b);
    const ru = compareEmptyLast(ra, rb, 1, (x, y) => x - y);
    if (ru !== 0) return ru;
  }
  return a.id.localeCompare(b.id, undefined, { numeric: true });
}
/* Não-fechados primeiro, depois por data mais relevante (mais urgente/antiga
   primeiro) dentro de cada grupo — igual pedido: "chamados que precisam de
   atenção" aparecem no topo sem precisar clicar em nada. */
function compareTicketsDefault(a, b) {
  const ca = CLOSED_STATUSES.includes(a.status) ? 1 : 0;
  const cb = CLOSED_STATUSES.includes(b.status) ? 1 : 0;
  if (ca !== cb) return ca - cb;
  const da = proximaAcaoDisplay(a).data || a.openedAt.slice(0, 10);
  const db = proximaAcaoDisplay(b).data || b.openedAt.slice(0, 10);
  return da.localeCompare(db);
}
function sortTicketsList(list) {
  if (!ticketSort.key) return list.sort(compareTicketsDefault);
  return list.sort((a, b) => compareTicketsByKey(ticketSort.key, ticketSort.dir, a, b));
}
function updateTicketSortHeaderUI() {
  document.querySelectorAll('#tickets-table th[data-sort-key]').forEach(th => {
    const key = th.dataset.sortKey;
    const active = ticketSort.key === key;
    th.classList.toggle("sort-active", active);
    const arrow = th.querySelector(".sort-arrow");
    arrow.textContent = active ? (ticketSort.dir === "asc" ? "↑" : "↓") : "↕";
  });
  const indicator = document.getElementById("ticket-sort-indicator");
  if (!indicator) return;
  if (!ticketSort.key) {
    indicator.innerHTML = "";
    return;
  }
  const dirLabel = TICKET_SORT_DIR_LABELS[ticketSort.key][ticketSort.dir];
  indicator.innerHTML = `Ordenando por: <strong>${TICKET_SORT_LABELS[ticketSort.key]} ${dirLabel}</strong> <span class="sort-clear" id="btn-limpar-sort" title="Voltar à ordenação padrão">&times;</span>`;
  document.getElementById("btn-limpar-sort").addEventListener("click", () => { ticketSort = { key: null, dir: null }; renderTickets(); });
}
function wireTicketsSortHeaders() {
  document.querySelectorAll('#tickets-table th[data-sort-key]').forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      if (ticketSort.key !== key) ticketSort = { key, dir: "asc" };
      else if (ticketSort.dir === "asc") ticketSort = { key, dir: "desc" };
      else ticketSort = { key: null, dir: null };
      renderTickets();
    });
  });
}

function renderTickets() {
  const chip = document.getElementById("ticket-quick-filter-chip");
  if (chip) {
    const extra = ticketQuickFilter && !TICKET_QF_CHIPS.some(c => c[0] === ticketQuickFilter) ? [[ticketQuickFilter, TICKET_QUICK_FILTER_LABELS[ticketQuickFilter] || ticketQuickFilter]] : [];
    chip.innerHTML = [...TICKET_QF_CHIPS, ...extra].map(([kind, rot]) => {
      const n = kind ? state.tickets.filter(t => ticketQuickFilterMatch(t, kind)).length : state.tickets.length;
      const ativo = (ticketQuickFilter || null) === kind;
      const aviso = kind === "atencao" && n > 0 && !ativo ? " qf-alerta" : "";
      return `<button type="button" class="qf-chip${ativo ? " ativo" : ""}${aviso}" data-qf="${kind || ""}">${escapeHtml(rot)} <span class="qf-n">${n}</span></button>`;
    }).join("");
    chip.querySelectorAll("[data-qf]").forEach(btn => btn.addEventListener("click", () => {
      ticketQuickFilter = btn.dataset.qf || null;
      document.getElementById("filter-status").value = "";
      renderTickets();
    }));
  }

  const f = currentTicketFilters();
  let list = state.tickets.slice();
  if (ticketQuickFilter) list = list.filter(t => ticketQuickFilterMatch(t, ticketQuickFilter));
  if (f.building) list = list.filter(t => t.buildingId === f.building);
  if (f.status) list = list.filter(t => t.status === f.status);
  if (f.category) list = list.filter(t => t.category === f.category);
  if (f.priority) list = list.filter(t => t.priority === f.priority);
  if (f.overdue) list = list.filter(isAcompanhamentoPendente);
  if (f.type !== "todos") list = list.filter(t => t.type === f.type);
  if (f.search) {
    list = list.filter(t => {
      const b = getBuilding(t.buildingId);
      return t.id.toLowerCase().includes(f.search)
        || (t.unit || "").toLowerCase().includes(f.search)
        || ticketProblemLabel(t).toLowerCase().includes(f.search)
        || (t.outrosDescricao || "").toLowerCase().includes(f.search)
        || (b && b.name.toLowerCase().includes(f.search));
    });
  }
  sortTicketsList(list);
  updateTicketSortHeaderUI();

  const tbody = document.querySelector("#tickets-table tbody");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-hint">Nenhum chamado aqui. Troque o filtro acima para ver outros.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(t => {
    const b = getBuilding(t.buildingId);
    const pendente = isAcompanhamentoPendente(t);
    const fechado = CLOSED_STATUSES.includes(t.status);
    const prox = proximaAcaoDisplay(t);
    const urgente = ["alta", "critica"].includes(t.priority) && !fechado;
    const classe = fechado ? "tk-fechado" : pendente ? "tk-atrasado" : isActionToday(t) ? "tk-hoje" : "";
    const proxTxt = fechado ? '<span class="empty-hint">—</span>'
      : /^Todas as atividades/.test(prox.texto) ? '<strong>Pronto para concluir</strong>'
      : prox.texto ? `<strong>${escapeHtml(prox.texto.slice(0, 40))}</strong>${prox.data ? `<div class="hint">${ckRotuloDia(prox.data)}${pendente ? " ⏰" : ""}</div>` : ""}`
      : '<span class="empty-hint">Nada agendado</span>';
    return `
    <tr data-open-ticket="${t.id}" class="${classe}">
      <td>${t.id}${t.type === "obra" ? ' <span class="badge outline" style="font-size:10px;">OBRA</span>' : ""}${garantiaMarcaNaLista(t)}${urgente ? `<div><span class="badge pr-${t.priority}">${PRIORITY_MAP[t.priority].label}</span></div>` : ""}</td>
      <td><strong>${escapeHtml(t.unit)}</strong><div class="hint">${b ? escapeHtml(b.name) : "—"}</div></td>
      <td>${escapeHtml(t.requesterName || "—")}</td>
      <td>${escapeHtml(ticketProblemLabel(t))}</td>
      <td>${proxTxt}</td>
      <td><span class="badge status-${t.status}">${TICKET_STATUS_MAP[t.status]}</span></td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll("[data-open-ticket]").forEach(el => {
    el.addEventListener("click", (e) => { e.stopPropagation(); goToTicketDetail(el.dataset.openTicket); });
  });
}

/* ---------- Novo chamado ---------- */

/* Título gerado a partir dos campos já escolhidos (sistema/elemento + onde é o
   problema). Não é um resumo "inteligente" do texto livre — o site não roda IA
   para isso. */
function generateTicketTitle(category, elemento, ambientes, localTipoId, outrosDescricao) {
  const ambientesList = ambientes || [];
  const place = ambientesList.length ? (ambientesList.slice(0, 2).join(", ") + (ambientesList.length > 2 ? "…" : "")) : (LOCAL_TIPO_MAP[localTipoId] || "");
  const what = elemento || (category === "Outros" && outrosDescricao ? outrosDescricao : category) || "Chamado";
  return place ? `${what} · ${place}` : what;
}

function openTicketForm() {
  if (!state.buildings.length) {
    toast("Cadastre um empreendimento antes de abrir um chamado.", "error");
    return;
  }
  openModal(`
    <div class="modal-header">
      <h2>Novo chamado</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <form id="ticket-form">
        <h4 class="form-section-title">Identificação</h4>
        <div class="form-grid">
          <div class="field">
            <label>Tipo</label>
            <select name="type">
              <option value="posvenda">Chamado de pós-venda</option>
              <option value="obra">Pendência de obra</option>
            </select>
          </div>
          <div class="field">
            <label>Empreendimento</label>
            <select name="buildingId" required>
              ${state.buildings.map(b => `<option value="${b.id}" data-status="${b.status}">${escapeHtml(b.name)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Local do chamado</label>
            <select name="localTipo" required>
              <option value="">Selecione...</option>
              ${LOCAL_TIPOS.map(l => `<option value="${l.id}">${l.label}</option>`).join("")}
            </select>
          </div>
          <div class="field" id="field-unidade" style="display:none;">
            <label>Unidade</label>
            <input type="text" name="unit" list="ticket-unit-list" placeholder="Ex: 101">
            <datalist id="ticket-unit-list"></datalist>
          </div>
          <div class="field">
            <label>Origem da solicitação</label>
            <select name="origemSolicitacao">${ORIGENS_SOLICITACAO.map(o => `<option value="${o}">${o}</option>`).join("")}</select>
          </div>
        </div>

        <h4 class="form-section-title">Classificação</h4>
        <div class="form-grid">
          <div class="field">
            <label>Sistema / elemento com problema</label>
            <select name="category">${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("")}</select>
          </div>
          <div class="field full" id="field-outros-descricao" style="display:none;">
            <label>Descreva o sistema/material *</label>
            <input type="text" name="outrosDescricao" placeholder="Ex: Piso laminado">
          </div>
          <div id="field-material"></div>
          <div id="field-elemento"></div>
          <div id="field-ambiente">${ambientesMultiFieldHTML(null, "", [], true)}</div>
          <div class="field full" id="sistema-suggestion" style="display:none;">
            <div class="hint">Sistemas possivelmente relacionados: <span id="sistema-suggestion-text"></span></div>
          </div>
          <div class="field full" id="ticket-supplier-suggestion" style="display:none;"></div>
          <div class="field">
            <label>Prioridade</label>
            <select name="priority">${PRIORITIES.map(p => `<option value="${p.id}" ${p.id === "media" ? "selected" : ""}>${p.label}</option>`).join("")}</select>
          </div>
        </div>

        <h4 class="form-section-title">Solicitação</h4>
        <div class="form-grid">
          <div class="field full">
            <label>Descrição da solicitação</label>
            <textarea name="descricaoSolicitacao" required placeholder="Ex: O síndico informa que existe vazamento de água próximo à casa de máquinas da piscina."></textarea>
            <span class="hint">O título do chamado é gerado a partir do sistema e dos ambientes selecionados, e pode ser editado depois na ficha.</span>
          </div>
          <div class="field">
            <label>Cliente / solicitante</label>
            <input type="text" name="requesterName" placeholder="Nome">
          </div>
          <div class="field">
            <label>Contato</label>
            <input type="text" name="requesterContact" placeholder="Telefone ou e-mail">
          </div>
        </div>
      </form>
      <p class="hint">Responsável, próxima ação e datas de acompanhamento não são mais definidos aqui — depois de salvar, o chamado já nasce com uma primeira etapa no Plano de Atendimento, onde isso é controlado.</p>
    </div>
    <div class="modal-footer">
      <button class="btn ghost" data-close>Cancelar</button>
      <button class="btn primary" id="btn-save-ticket">Abrir chamado</button>
    </div>
  `, true);
  wireModalClose();

  const typeSelect = document.querySelector("#ticket-form select[name=type]");
  const buildingSelect = document.querySelector("#ticket-form select[name=buildingId]");
  const localTipoSelect = document.querySelector("#ticket-form select[name=localTipo]");
  const unidadeField = document.getElementById("field-unidade");
  const unitInput = document.querySelector("#ticket-form input[name=unit]");
  const ambienteField = document.getElementById("field-ambiente");
  const categorySelect = document.querySelector("#ticket-form select[name=category]");
  const outrosField = document.getElementById("field-outros-descricao");
  const materialField = document.getElementById("field-material");
  const elementoField = document.getElementById("field-elemento");
  const origemSelect = document.querySelector("#ticket-form select[name=origemSolicitacao]");
  const requesterNameInput = document.querySelector("#ticket-form input[name=requesterName]");
  const requesterContactInput = document.querySelector("#ticket-form input[name=requesterContact]");
  const unitList = document.getElementById("ticket-unit-list");
  const sugBox = document.getElementById("sistema-suggestion");
  const sugText = document.getElementById("sistema-suggestion-text");
  const supplierSugBox = document.getElementById("ticket-supplier-suggestion");

  function refreshUnitList() {
    const roster = state.clients.filter(c => c.buildingId === buildingSelect.value);
    unitList.innerHTML = roster.map(c => `<option value="${escapeHtml(c.unit)}">`).join("");
  }
  function autofillRequester() {
    if (origemSelect.value !== "Cliente" && origemSelect.value !== "") return;
    const match = state.clients.find(c => c.buildingId === buildingSelect.value && c.unit.toLowerCase() === unitInput.value.trim().toLowerCase());
    if (match) {
      if (!requesterNameInput.value && match.name) requesterNameInput.value = match.name;
      if (!requesterContactInput.value && (match.phone || match.email)) requesterContactInput.value = match.phone || match.email;
    }
  }
  function autofillSindico() {
    if (origemSelect.value !== "Síndico") return;
    const b = getBuilding(buildingSelect.value);
    if (b && b.sindico && b.sindico.nome) {
      requesterNameInput.value = b.sindico.nome;
      requesterContactInput.value = b.sindico.telefone || b.sindico.email || "";
    } else if (b) {
      toast("Este empreendimento ainda não tem síndico cadastrado — preencha manualmente ou cadastre em Empreendimentos.", "");
    }
  }
  function syncTypeFromBuilding() {
    const opt = buildingSelect.selectedOptions[0];
    typeSelect.value = opt && opt.dataset.status === "andamento" ? "obra" : "posvenda";
  }
  function syncUnidadeVisibility() {
    const isUnidade = localTipoSelect.value === "unidade_privativa";
    unidadeField.style.display = isUnidade ? "" : "none";
    unitInput.required = isUnidade;
    if (!isUnidade) unitInput.value = "";
  }
  function checkedAmbientes() {
    return Array.from(document.querySelectorAll('#ticket-form input[name=ambientes]:checked')).map(el => el.value);
  }
  function showSuggestions() {
    const checked = checkedAmbientes();
    const term = checked[0] || LOCAL_TIPO_MAP[localTipoSelect.value] || "";
    const suggestions = suggestSistemasForLocal(term).filter(s => s !== categorySelect.value);
    if (suggestions.length) { sugBox.style.display = ""; sugText.textContent = suggestions.join(", "); }
    else { sugBox.style.display = "none"; }
  }
  function refreshAmbienteField() {
    ambienteField.innerHTML = ambientesMultiFieldHTML(buildingSelect.value, localTipoSelect.value, [], !localTipoSelect.value);
    wireAmbientesMultiField(document.getElementById("ticket-form"));
  }
  function refreshSupplierSuggestion() {
    const buildingId = buildingSelect.value;
    const category = categorySelect.value;
    const materialSelect = document.querySelector('#ticket-form select[name=material]');
    const material = materialSelect ? materialSelect.value : "";
    const match = state.suppliers
      .map(s => ({ s, link: s.buildings.find(b => b.buildingId === buildingId && b.categoria === category) }))
      .filter(x => x.link && supplierLinkMatchesMaterial(x.link, material))[0];
    if (!match) { supplierSugBox.style.display = "none"; supplierSugBox.dataset.supplierId = ""; return; }
    supplierSugBox.style.display = "";
    supplierSugBox.dataset.supplierId = match.s.id;
    supplierSugBox.dataset.selected = "false";
    supplierSugBox.innerHTML = `
      <div class="supplier-link-card suggestion">
        <div class="supplier-link-head"><strong>Fornecedor sugerido: ${escapeHtml(supplierDisplayName(match.s))}</strong></div>
        <div class="hint">Atuação: ${escapeHtml(match.link.categoria)}${match.link.materiais.length ? " · " + escapeHtml(match.link.materiais.slice(0, 3).join(", ")) : ""}</div>
        <div class="supplier-link-actions"><button type="button" class="btn ghost small" id="btn-select-suggested-supplier">Selecionar</button></div>
      </div>`;
    document.getElementById("btn-select-suggested-supplier").addEventListener("click", (e) => {
      const selected = supplierSugBox.dataset.selected === "true";
      supplierSugBox.dataset.selected = selected ? "false" : "true";
      e.target.textContent = selected ? "Selecionar" : "✓ Selecionado";
    });
  }
  function refreshElementoField() {
    const materialSelect = document.querySelector('#ticket-form select[name=material]');
    const materialLabel = materialSelect ? materialSelect.value : "";
    elementoField.innerHTML = elementoFieldHTML(categorySelect.value, materialLabel, "", false);
    wireInlineAddSelects(elementoField);
  }
  function refreshSistemaFields() {
    materialField.innerHTML = materialFieldHTML(categorySelect.value, "", false);
    wireInlineAddSelects(materialField);
    const newMaterialSelect = document.querySelector('#ticket-form select[name=material]');
    if (newMaterialSelect) newMaterialSelect.addEventListener("change", () => { refreshElementoField(); refreshSupplierSuggestion(); });
    refreshElementoField();
    refreshSupplierSuggestion();
  }
  function refreshOutrosField() {
    const isOutros = categorySelect.value === "Outros";
    outrosField.style.display = isOutros ? "" : "none";
    const input = outrosField.querySelector('input[name=outrosDescricao]');
    input.required = isOutros;
    if (!isOutros) input.value = "";
  }

  refreshUnitList();
  syncTypeFromBuilding();
  syncUnidadeVisibility();
  refreshSistemaFields();
  refreshOutrosField();

  buildingSelect.addEventListener("change", () => { refreshUnitList(); syncTypeFromBuilding(); refreshAmbienteField(); autofillSindico(); refreshSupplierSuggestion(); });
  localTipoSelect.addEventListener("change", () => { syncUnidadeVisibility(); refreshAmbienteField(); showSuggestions(); });
  categorySelect.addEventListener("change", () => { refreshSistemaFields(); refreshOutrosField(); showSuggestions(); });
  ambienteField.addEventListener("change", (e) => { if (e.target.name === "ambientes") showSuggestions(); });
  unitInput.addEventListener("change", autofillRequester);
  origemSelect.addEventListener("change", () => { autofillRequester(); autofillSindico(); });

  document.getElementById("btn-save-ticket").addEventListener("click", () => {
    const form = document.getElementById("ticket-form");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const buildingId = fd.get("buildingId");
    const localTipo = fd.get("localTipo");
    const ambientes = fd.getAll("ambientes").map(a => a.trim()).filter(Boolean);
    const category = fd.get("category");
    const material = (fd.get("material") || "").trim();
    const elemento = (fd.get("elemento") || "").trim();
    const outrosDescricao = category === "Outros" ? (fd.get("outrosDescricao") || "").trim() : "";
    const isUnidade = localTipo === "unidade_privativa";
    const unit = isUnidade ? fd.get("unit").trim() : (ambientes.join(", ") || LOCAL_TIPO_MAP[localTipo] || "—");
    const clientMatch = isUnidade ? state.clients.find(c => c.buildingId === buildingId && c.unit.toLowerCase() === unit.toLowerCase()) : null;
    const opened = new Date();

    const ticket = {
      id: nextTicketCode(),
      openedAt: opened.toISOString(),
      buildingId, unit,
      clientId: clientMatch ? clientMatch.id : "",
      origemSolicitacao: fd.get("origemSolicitacao"),
      type: fd.get("type"),
      category, material, elemento, outrosDescricao,
      subcategory: "",
      localTipo, ambientes,
      ambienteDetalhe: ambientes[0] || "",
      local: ambientes.join(", "), ambiente: ambientes.join(", "),
      priority: fd.get("priority"),
      title: generateTicketTitle(category, elemento, ambientes, localTipo, outrosDescricao),
      status: "novo",
      responsavelInterno: "",
      responsavelProximaAcao: "",
      proximaAcao: "",
      dataLimiteProximaAcao: "",
      dataAcompanhamento: "",
      dataUltimaAcao: todayISODate(),
      dataUltimaCobranca: "",
      proximaCobranca: "",
      descricaoSolicitacao: fd.get("descricaoSolicitacao").trim(),
      analiseTecnica: { ...blankAnaliseTecnica(), problemaRelatado: fd.get("descricaoSolicitacao").trim() },
      fornecedor: blankFornecedor(),
      fornecedores: [],
      encerramento: blankEncerramento(),
      plano: [],
      anexos: [],
      relatorios: [],
      requesterName: fd.get("requesterName").trim(),
      requesterContact: fd.get("requesterContact").trim(),
      history: [],
      _fornecedorMigrated: true,
    };
    addHistoryEntry(ticket, "Chamado aberto", `Origem: ${ticket.origemSolicitacao}.`, "", "novo");

    if (supplierSugBox.dataset.selected === "true" && supplierSugBox.dataset.supplierId) {
      const supplierId = supplierSugBox.dataset.supplierId;
      linkSupplierToTicketIfNeeded(ticket, supplierId);
      addHistoryEntry(ticket, "Fornecedor vinculado", `${supplierDisplayName(getSupplier(supplierId))} (sugestão aceita na abertura).`);
    }

    state.tickets.push(ticket);
    persist();
    closeModal();
    renderAll();
    toast(`Chamado ${ticket.id} aberto com sucesso.`, "success");
    goToTicketDetail(ticket.id);
  });
}

/* ---------- Ficha completa do chamado ---------- */

function goToTicketDetail(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-ticket-detail").classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === "tickets"));
  document.getElementById("view-title").textContent = "Ficha do chamado";
  document.getElementById("view-subtitle").textContent = id;
  renderTicketDetailView(id);
}

function situacaoAtualText(t) {
  if (CLOSED_STATUSES.includes(t.status)) return `Chamado encerrado como ${TICKET_STATUS_MAP[t.status].toLowerCase()}.`;
  return `Chamado em andamento — status atual: ${TICKET_STATUS_MAP[t.status]}.`;
}
function ultimaAcaoText(t) {
  const last = t.history[t.history.length - 1];
  if (!last) return "—";
  return last.action + (last.note ? " — " + last.note : "");
}
function fornecedorPrincipal(t) {
  const link = (t.fornecedores || []).find(f => f.principal) || (t.fornecedores || [])[0];
  if (!link) return null;
  const supplier = getSupplier(link.supplierId);
  return supplier ? { link, supplier } : null;
}

/* Badge compacto de garantia pro Resumo — reaproveita a mesma análise usada no
   painel completo da seção "03. Análise Técnica" (js/warranty.js). Só apoio
   visual, nunca decide/fecha nada sozinho. */
function garantiaResumoBadge(t) {
  const g = garantiaAlertaDoChamado(t);
  return `${g.icone} ${g.titulo}`;
}

/* Timeline "Andamento" do Resumo: chamado aberto + uma linha por EXECUÇÃO de
   cada atividade do plano (não uma linha por atividade — cada visita/tentativa
   é seu próprio evento cronológico), na ordem em que as atividades foram
   criadas. Atividade ainda sem nenhuma execução cadastrada aparece como uma
   linha só, "sem data definida". ✓ realizada · ● próxima pendente ·
   ○ demais pendentes/a agendar · ✗ não realizada/cancelada. */
function renderAndamentoTimeline(t) {
  const abertura = t.history[0];
  const prox = proximaAtividadePendente(t);
  const proxExec = prox ? proximaExecucaoDaAtividade(prox) : null;
  const itens = [
    { icone: "✓", titulo: "Chamado aberto", meta: `${fmtDate(t.openedAt)} — ${escapeHtml(abertura ? abertura.user : "")}` },
  ];
  (t.plano || []).forEach(a => {
    const execs = a.execucoes || [];
    if (!execs.length) {
      itens.push({
        icone: a.cancelada ? "✗" : (prox && a.id === prox.id ? "●" : "○"),
        titulo: escapeHtml(a.nome || "(sem nome)"),
        meta: a.cancelada ? "cancelada" : "sem data definida",
        destaque: prox && a.id === prox.id,
      });
      return;
    }
    execs.forEach(e => {
      let icone = "○";
      if (e.resultado === "realizada") icone = "✓";
      else if (e.resultado === "nao_realizada") icone = "✗";
      else if (proxExec && e.id === proxExec.id) icone = "●";
      const metaPartes = [];
      if (e.resultado !== "pendente" && e.dataConclusao) metaPartes.push(fmtDate(e.dataConclusao));
      else if (e.data) metaPartes.push(fmtDate(e.data) + (e.horario ? " " + e.horario : ""));
      else metaPartes.push("sem data definida");
      if (a.responsavel) metaPartes.push(escapeHtml(a.responsavel));
      if (e.resultado !== "pendente" && e.observacao) metaPartes.push(escapeHtml(e.observacao));
      itens.push({ icone, titulo: escapeHtml(a.nome || "(sem nome)"), meta: metaPartes.join(" — "), destaque: proxExec && e.id === proxExec.id });
    });
  });
  return `<ul class="andamento-timeline">
    ${itens.map(i => `<li class="${i.destaque ? "current" : ""}"><span class="andamento-icone">${i.icone}</span><div><div class="andamento-titulo">${i.titulo}</div><div class="hint">${i.meta}</div></div></li>`).join("")}
  </ul>`;
}

/* Card "Próxima atividade" em destaque — some quando não há nenhuma pendente. */
function renderProximaEtapaCard(t) {
  const prox = proximaAtividadePendente(t);
  if (!prox) return "";
  const exec = proximaExecucaoDaAtividade(prox);
  return `
  <div class="proxima-etapa-card">
    <div class="di-label">Próxima etapa</div>
    <div class="proxima-etapa-nome">${escapeHtml(prox.nome)}</div>
    <div class="hint">${exec && exec.data ? fmtDate(exec.data) + (exec.horario ? " às " + exec.horario : "") : "Sem data definida"}${prox.responsavel ? " · Responsável: " + escapeHtml(prox.responsavel) : ""}</div>
    <button class="btn ghost small" data-ver-proxima-etapa="${prox.id}" style="margin-top:8px;">Ver detalhes</button>
  </div>`;
}

function renderAmbienteTags(list) {
  if (!list || !list.length) return '<span class="empty-hint">—</span>';
  return list.map(a => `<span class="badge outline ambiente-tag">${escapeHtml(a)}</span>`).join(" ");
}

/* "Retorno da vistoria" só aparece de verdade quando alguém já registrou algo —
   chamado não é obrigado a passar por vistoria (item 3 do pedido). */
function hasAnaliseTecnica(t) {
  const a = t.analiseTecnica;
  return !!(a.constatacao || a.causaProvavel || a.causaConfirmada || a.responsabilidade || a.observacoes);
}

function analiseFormMarkup(t) {
  return `
  <form id="analise-form">
    <div class="form-grid">
      <div class="field full"><label>Constatação (o que a equipe observou)</label><textarea name="constatacao">${escapeHtml(t.analiseTecnica.constatacao || "")}</textarea></div>
      <div class="field"><label>Causa provável</label><input type="text" name="causaProvavel" value="${escapeHtml(t.analiseTecnica.causaProvavel || "")}"></div>
      <div class="field"><label>Causa confirmada</label><input type="text" name="causaConfirmada" value="${escapeHtml(t.analiseTecnica.causaConfirmada || "")}"></div>
      <div class="field"><label>Responsabilidade</label><select name="responsabilidade"><option value="">—</option>${RESPONSABILIDADE_OPTIONS.map(r => `<option value="${r}" ${t.analiseTecnica.responsabilidade === r ? "selected" : ""}>${r}</option>`).join("")}</select></div>
      <div class="field full"><label>Observação / orientação</label><textarea name="observacoes">${escapeHtml(t.analiseTecnica.observacoes || "")}</textarea></div>
    </div>
    <div style="margin-top:12px;"><button type="button" class="btn primary" id="btn-save-analise">Salvar retorno da vistoria</button></div>
  </form>`;
}

function solicitacaoFormMarkup(t, isClosed) {
  return `
  <form id="solicitacao-form">
    <div class="form-grid">
      <div class="field"><label>Sistema / elemento com problema</label><select name="category" ${isClosed ? "disabled" : ""}>${CATEGORIES.map(c => `<option value="${c}" ${t.category === c ? "selected" : ""}>${c}</option>`).join("")}${t.category && !CATEGORIES.includes(t.category) ? `<option value="${escapeHtml(t.category)}" selected>${escapeHtml(t.category)} (antiga)</option>` : ""}</select></div>
      <div class="field full" id="field-outros-descricao-edit" style="${t.category === "Outros" ? "" : "display:none;"}"><label>Descreva o sistema/material *</label><input type="text" name="outrosDescricao" value="${escapeHtml(t.outrosDescricao || "")}" ${isClosed ? "disabled" : ""}></div>
      <div id="field-material-edit">${materialFieldHTML(t.category, t.material || "", isClosed)}</div>
      <div id="field-elemento-edit">${elementoFieldHTML(t.category, t.material || "", t.elemento || "", isClosed)}</div>
      <div class="field"><label>Local do chamado</label><select name="localTipo" ${isClosed ? "disabled" : ""}><option value="">Selecione...</option>${LOCAL_TIPOS.map(l => `<option value="${l.id}" ${t.localTipo === l.id ? "selected" : ""}>${l.label}</option>`).join("")}</select></div>
      <div id="field-ambiente-edit">${ambientesMultiFieldHTML(t.buildingId, t.localTipo, t.ambientes || [], isClosed)}</div>
      <div class="field"><label>Prioridade</label><select name="priority" ${isClosed ? "disabled" : ""}>${PRIORITIES.map(p => `<option value="${p.id}" ${t.priority === p.id ? "selected" : ""}>${p.label}</option>`).join("")}</select></div>
      <div class="field"><label>Origem da solicitação</label><select name="origemSolicitacao" ${isClosed ? "disabled" : ""}>${ORIGENS_SOLICITACAO.map(o => `<option value="${o}" ${t.origemSolicitacao === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>
      <div class="field"><label>Cliente / solicitante</label><input type="text" name="requesterName" value="${escapeHtml(t.requesterName || "")}" ${isClosed ? "disabled" : ""}></div>
      <div class="field"><label>Contato</label><input type="text" name="requesterContact" value="${escapeHtml(t.requesterContact || "")}" ${isClosed ? "disabled" : ""}></div>
      <div class="field full"><label>Problema relatado</label><textarea name="problemaRelatado" ${isClosed ? "disabled" : ""}>${escapeHtml(t.analiseTecnica.problemaRelatado || t.descricaoSolicitacao || "")}</textarea></div>
    </div>
    ${!isClosed ? `<div style="margin-top:12px;"><button type="button" class="btn primary" id="btn-save-solicitacao">Salvar informações</button></div>` : ""}
  </form>`;
}

/* Opções rápidas de "próxima ação" — escolher uma cria a etapa na hora, sem
   forçar vistoria como passo obrigatório (item 3 do pedido). "Outro" abre o
   modal de etapa completo pra nome livre. */
const PROXIMA_ACAO_OPCOES = [
  { nome: "Realizar vistoria", modo: "agendavel" },
  { nome: "Realizar reparo", modo: "agendavel" },
  { nome: "Conferir reparo", modo: "agendavel" },
  { nome: "Acionar fornecedor", modo: "especial" },
  { nome: "Solicitar orçamento", modo: "instantanea" },
  { nome: "Retornar cliente", modo: "instantanea" },
  { nome: "Finalizar atendimento", modo: "especial" },
];

/* Poucas opções relevantes ao estado atual, não a lista inteira sempre — o
   restante fica atrás de "+ mais opções", nunca escondido de vez. Enquanto há
   fornecedor aguardando retorno, esta função nem chega a ser chamada — quem
   decide isso é renderProximoPasso, que mostra o card de espera no lugar. */
function proximaAcaoOpcoesContextuais(t) {
  const nomes = (lista) => PROXIMA_ACAO_OPCOES.filter(o => lista.includes(o.nome));
  const link = (t.fornecedores || [])[0];
  if (link && link.dataExecutada) return nomes(["Conferir reparo", "Finalizar atendimento"]);
  const execConcluida = (t.plano || []).some(a => a.tipo === "execucao" && atividadeStatus(a) === "concluida");
  if (execConcluida) return nomes(["Conferir reparo", "Finalizar atendimento"]);
  return nomes(["Realizar vistoria", "Realizar reparo", "Acionar fornecedor", "Solicitar orçamento"]);
}

function renderProximaAcaoQuickPick(t) {
  const contextuais = proximaAcaoOpcoesContextuais(t);
  const contextuaisNomes = new Set(contextuais.map(o => o.nome));
  const resto = PROXIMA_ACAO_OPCOES.filter(o => !contextuaisNomes.has(o.nome));
  return `
  <div class="proxima-acao-quickpick">
    <div class="hint" style="margin-bottom:8px;">Nenhuma etapa pendente. O que vem a seguir?</div>
    <div class="quickpick-buttons">
      ${contextuais.map(o => `<button type="button" class="btn ghost small" data-quickpick-acao="${escapeHtml(o.nome)}" data-quickpick-modo="${o.modo}">${escapeHtml(o.nome)}</button>`).join("")}
    </div>
    <details class="quickpick-mais" style="margin-top:8px;">
      <summary class="hint">+ mais opções</summary>
      <div class="quickpick-buttons" style="margin-top:8px;">
        ${resto.map(o => `<button type="button" class="btn ghost small" data-quickpick-acao="${escapeHtml(o.nome)}" data-quickpick-modo="${o.modo}">${escapeHtml(o.nome)}</button>`).join("")}
        <button type="button" class="btn ghost small" id="btn-quickpick-outro">Outro...</button>
      </div>
    </details>
    <div id="quickpick-instant-panel"></div>
  </div>`;
}

/* Ação instantânea: nasce como uma atividade já com uma execução "realizada"
   hoje — nunca pede agendamento pra algo que o usuário acabou de fazer. */
function registrarAcaoInstantanea(t, nome, obs) {
  const hoje = todayISODate();
  const novaAtividade = {
    ...blankAtividade(),
    id: "et" + Date.now() + Math.random().toString(36).slice(2, 6),
    nome,
    responsavel: ensureOperatorName(),
    execucoes: [{
      ...blankExecucao(),
      id: "exec" + Date.now() + Math.random().toString(36).slice(2, 6),
      data: hoje, resultado: "realizada", dataConclusao: hoje, registradoEm: hoje, observacao: obs,
    }],
  };
  t.plano.push(novaAtividade);
  if (nome === "Retornar cliente" && !t.clienteAguardando) {
    t.clienteAguardando = { desde: todayISODate() };
  }
  const oldStatus = t.status;
  t.status = statusCalculadoPeloPlano(t);
  addHistoryEntry(t, nome, obs, oldStatus, t.status !== oldStatus ? t.status : "");
  persist();
  renderAll();
  goToTicketDetail(t.id);
  toast(`"${nome}" registrado.`, "success");
}

function wireProximaAcaoQuickPick(t) {
  document.querySelectorAll("[data-quickpick-acao]").forEach(btn => {
    btn.addEventListener("click", () => {
      const nome = btn.dataset.quickpickAcao;
      const modo = btn.dataset.quickpickModo;

      if (nome === "Acionar fornecedor") {
        const sug = matchingSupplierLinks(t)[0];
        openLinkSupplierModal(t.id, sug ? sug.s.id : undefined);
        return;
      }
      if (nome === "Finalizar atendimento") {
        const alvo = document.getElementById("resolucao-section");
        if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (modo === "agendavel") {
        openEtapaModal(t.id, null, nome);
        return;
      }

      // instantânea: mini-painel inline com observação opcional, sem pedir data
      const panel = document.getElementById("quickpick-instant-panel");
      panel.innerHTML = `
        <div class="form-grid" style="margin-top:10px;">
          <div class="field full"><label>Observação (opcional)</label><input type="text" id="qp-obs" placeholder="Ex: orçamento solicitado, retorno em até 3 dias"></div>
        </div>
        <button type="button" class="btn primary small" id="btn-confirmar-qp-instant" style="margin-top:8px;">Confirmar "${escapeHtml(nome)}"</button>`;
      document.getElementById("btn-confirmar-qp-instant").addEventListener("click", () => {
        const obs = document.getElementById("qp-obs").value.trim();
        registrarAcaoInstantanea(t, nome, obs);
      });
    });
  });
  const outroBtn = document.getElementById("btn-quickpick-outro");
  if (outroBtn) outroBtn.addEventListener("click", () => openEtapaModal(t.id, null));
}

/* "Próximo Passo" da seção principal: enquanto há fornecedor aguardando
   retorno, isso É o próximo passo — não faz sentido oferecer o seletor de
   ações junto. Os botões aqui só encontram e clicam o botão real já existente
   no card do fornecedor mais abaixo (mesma lógica, sem duplicar nada). */
/* Nunca pede prazo pro cliente (diferente do fornecedor) — fica aguardando
   até alguém registrar que ele respondeu, sem cobrança automática. */
function registrarRespostaCliente(t, obs) {
  t.clienteAguardando = null;
  const hoje = todayISODate();
  t.plano.push({
    ...blankAtividade(),
    id: "et" + Date.now() + Math.random().toString(36).slice(2, 6),
    nome: "Resposta do cliente registrada",
    responsavel: ensureOperatorName(),
    execucoes: [{
      ...blankExecucao(),
      id: "exec" + Date.now() + Math.random().toString(36).slice(2, 6),
      data: hoje, resultado: "realizada", dataConclusao: hoje, registradoEm: hoje, observacao: obs,
    }],
  });
  addHistoryEntry(t, "Resposta do cliente registrada", obs);
  t.status = statusCalculadoPeloPlano(t);
  persist();
}

function renderProximoPasso(t) {
  const linkAguardando = (t.fornecedores || []).find(f => !f.dataExecutada);
  if (!linkAguardando && t.clienteAguardando) {
    const dias = daysDiff(t.clienteAguardando.desde, todayISODate());
    return `
    <div class="proxima-etapa-card">
      <div class="di-label">🔵 Aguardando retorno do cliente</div>
      <div class="hint">
        Desde ${fmtDate(t.clienteAguardando.desde)}
        ${dias > 0 ? " — há " + dias + " dia" + (dias > 1 ? "s" : "") : ""}
      </div>
      <div class="quickpick-buttons" style="margin-top:8px;">
        <button type="button" class="btn ghost small" id="btn-registrar-resposta-cliente">Registrar resposta do cliente</button>
      </div>
      <div id="cliente-resposta-panel"></div>
    </div>`;
  }
  if (!linkAguardando) return renderProximaAcaoQuickPick(t);
  const supplier = getSupplier(linkAguardando.supplierId);
  const semRetorno = isFornecedorSemRetorno(t, linkAguardando);
  const dias = linkAguardando.dataAcionamento ? daysDiff(linkAguardando.dataAcionamento, todayISODate()) : 0;
  return `
  <div class="proxima-etapa-card ${semRetorno ? "atrasado" : ""}">
    <div class="di-label">${semRetorno ? "🔴 Retorno do fornecedor atrasado" : "🟠 Aguardando retorno do fornecedor"}</div>
    <div class="proxima-etapa-nome">${escapeHtml(supplier ? supplierDisplayName(supplier) : "Fornecedor")}</div>
    <div class="hint">
      Acionado em ${fmtDate(linkAguardando.dataAcionamento)}${linkAguardando.horaAcionamento ? " " + linkAguardando.horaAcionamento : ""}
      ${dias > 0 ? " — sem retorno há " + dias + " dia" + (dias > 1 ? "s" : "") : ""}
      ${linkAguardando.dataAgendada ? " · previsão: " + fmtDate(linkAguardando.dataAgendada) : ""}
    </div>
    <div class="quickpick-buttons" style="margin-top:8px;">
      ${!linkAguardando.dataAgendada ? `<button type="button" class="btn ghost small" data-goto-fornecedor-action="prevista" data-goto-link="${linkAguardando.id}">Registrar data prevista</button>` : ""}
      <button type="button" class="btn ghost small" data-goto-fornecedor-action="retorno" data-goto-link="${linkAguardando.id}">Registrar retorno</button>
      ${semRetorno ? `<button type="button" class="btn danger small" data-goto-fornecedor-action="cobrar" data-goto-link="${linkAguardando.id}">Cobrar fornecedor</button>` : ""}
    </div>
  </div>`;
}

function wireProximoPasso(t) {
  const map = { prevista: "data-set-data-prevista", retorno: "data-set-data-executada", cobrar: "data-cobrar-fornecedor" };
  document.querySelectorAll("[data-goto-fornecedor-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const linkId = btn.dataset.gotoLink;
      const attr = map[btn.dataset.gotoFornecedorAction];
      const alvo = document.querySelector(`[${attr}="${linkId}"]`);
      if (!alvo) return;
      alvo.scrollIntoView({ behavior: "smooth", block: "center" });
      alvo.click();
    });
  });
  const btnResposta = document.getElementById("btn-registrar-resposta-cliente");
  if (btnResposta) {
    btnResposta.addEventListener("click", () => {
      const panel = document.getElementById("cliente-resposta-panel");
      panel.innerHTML = `
        <div class="form-grid" style="margin-top:10px;">
          <div class="field full"><label>Observação (opcional)</label><input type="text" id="cr-obs" placeholder="O que o cliente respondeu"></div>
        </div>
        <button type="button" class="btn primary small" id="btn-confirmar-resposta-cliente" style="margin-top:8px;">Confirmar</button>`;
      document.getElementById("btn-confirmar-resposta-cliente").addEventListener("click", () => {
        const obs = document.getElementById("cr-obs").value.trim();
        registrarRespostaCliente(t, obs);
        renderAll();
        goToTicketDetail(t.id);
        toast("Resposta do cliente registrada.", "success");
      });
    });
  }
}

function renderTicketDetailView(id) {
  const t = getTicket(id);
  const root = document.getElementById("ticket-detail-root");
  if (!t) { root.innerHTML = `<div class="empty-hint">Chamado não encontrado.</div>`; return; }
  const b = getBuilding(t.buildingId);
  const client = t.clientId ? getClient(t.clientId) : null;
  const pendente = isAcompanhamentoPendente(t);
  const isClosed = CLOSED_STATUSES.includes(t.status);
  const reincidence = findSameUnitReincidence(t);
  const similar = findSimilarInBuilding(t);
  const principal = fornecedorPrincipal(t);

  const proxEtapa = proximaAtividadePendente(t);
  const hasPlano = t.plano && t.plano.length;
  const temFornecedor = (t.fornecedores && t.fornecedores.length) || matchingSupplierLinks(t).length;

  root.innerHTML = `
    <h2 class="ticket-page-title">${t.id} — ${escapeHtml(t.title)}</h2>
    <div class="ticket-toolbar">
      <button class="btn ghost" id="btn-back-ticket">← Voltar</button>
      <div class="ticket-toolbar-badges">
        <span class="badge status-${t.status}">${TICKET_STATUS_MAP[t.status]}</span>
        <span class="badge pr-${t.priority}">${PRIORITY_MAP[t.priority].label}</span>
        ${t.type === "obra" ? '<span class="badge outline">Pendência de obra</span>' : ""}
        ${pendente ? '<span class="followup-tag">⏰ Acompanhamento pendente</span>' : ""}
      </div>
      <button class="btn danger" id="btn-delete-ticket" style="margin-left:auto;">Excluir chamado</button>
    </div>

    ${renderGarantiaBanner(t)}

    ${reincidence || similar.length ? `
    <div class="ticket-section warn-banner">
      ${reincidence ? `<div>⚠️ <strong>POSSÍVEL REINCIDÊNCIA</strong> — já houve um chamado de "${escapeHtml(t.category)}" nesta unidade: <a href="#" data-open-ticket-inline="${reincidence.id}">${reincidence.id}</a> (${TICKET_STATUS_MAP[reincidence.status]}, aberto em ${fmtDate(reincidence.openedAt)}).</div>` : ""}
      ${similar.length ? `<div style="margin-top:${reincidence ? "8px" : "0"};">ℹ️ Problema semelhante ("${escapeHtml(t.category)}" em "${escapeHtml(t.local)}") em outra(s) unidade(s) deste empreendimento: ${similar.map(s => `<a href="#" data-open-ticket-inline="${s.id}">${s.id} (${escapeHtml(s.unit)})</a>`).join(", ")}.</div>` : ""}
    </div>` : ""}

    ${(() => {
      const unitMods = modificationsForUnit(t.buildingId, t.unit);
      if (!unitMods.length) return "";
      return `<div class="ticket-section warn-banner">
        <div>⚠️ Esta unidade possui ${unitMods.length} modificação${unitMods.length > 1 ? "ões" : ""} registrada${unitMods.length > 1 ? "s" : ""}: ${unitMods.map(m => `<a href="#" data-open-modification-inline="${m.id}">${m.code}${m.itensMapa.length ? " (" + m.itensMapa.map(escapeHtml).join(", ") + ")" : ""}</a>`).join(", ")}. Vale conferir antes de diagnosticar o chamado.</div>
      </div>`;
    })()}

    ${renderCockpitChamado(t)}

    <div class="ck-mais-titulo">Mais detalhes</div>

    <details class="mod-details">
      <summary class="mod-summary"><span class="mod-summary-title">Plano de atendimento</span><span class="mod-summary-resumo">${(t.plano || []).length} atividade(s) · ${planoProgresso(t).pct}% concluído</span></summary>
      <div class="mod-details-body">
        <div id="plano-atendimento">${renderPlanoAtendimento(t)}</div>
        <button class="btn ghost small" id="btn-add-etapa">+ Adicionar etapa</button>
      </div>
    </details>

    ${temFornecedor ? `
    <details class="mod-details">
      <summary class="mod-summary"><span class="mod-summary-title">Fornecedor</span><span class="mod-summary-resumo">${principal ? escapeHtml(supplierDisplayName(principal.supplier)) : "Nenhum acionado"}</span></summary>
      <div class="mod-details-body">
        <div id="fornecedores-vinculados">${renderFornecedoresVinculados(t)}</div>
        ${renderSupplierSuggestion(t)}
        <button class="btn ghost small" id="btn-add-fornecedor">Acionar fornecedor</button>
      </div>
    </details>
    ` : ""}

    <details class="mod-details">
      <summary class="mod-summary"><span class="mod-summary-title">Fotos</span><span class="mod-summary-resumo">${(t.anexos || []).filter(a => a.momento).length} foto(s)</span></summary>
      <div class="mod-details-body">${renderFotosChamado(t)}</div>
    </details>

    <details class="mod-details">
      <summary class="mod-summary"><span class="mod-summary-title">Documentos e relatórios</span><span class="mod-summary-resumo">${(t.relatorios || []).length} relatório(s)</span></summary>
      <div class="mod-details-body">${renderDocumentosChamado(t)}</div>
    </details>

        <details class="mod-details resumo-card">
          <summary class="mod-summary">
            <span class="mod-summary-title">Resumo do Chamado</span>
            <span class="mod-summary-resumo">${escapeHtml(t.origemSolicitacao || "—")} · Elemento: ${escapeHtml(t.elemento || "—")}</span>
          </summary>
          <div class="mod-details-body">
    <div class="ticket-header-strip detail-info-grid">
      <div><div class="di-label">Empreendimento</div>${b ? escapeHtml(b.name) : "—"}</div>
      <div><div class="di-label">Unidade</div>${escapeHtml(t.unit)}</div>
      <div><div class="di-label">Cliente</div>${escapeHtml(t.requesterName || "—")}</div>
      <div><div class="di-label">Sistema</div>${escapeHtml(t.category)}${t.category === "Outros" && t.outrosDescricao ? " — " + escapeHtml(t.outrosDescricao) : ""}${t.material ? " · " + escapeHtml(t.material) : ""}</div>
      <div class="full"><div class="di-label">Ambientes</div>${renderAmbienteTags(t.ambientes)}</div>
      <div><div class="di-label">Responsabilidade</div>${escapeHtml(t.analiseTecnica.responsabilidade || "Em análise")}</div>
      <div><div class="di-label">Fornecedor</div>${principal ? escapeHtml(supplierDisplayName(principal.supplier)) : "—"}</div>
      <div><div class="di-label">Garantia</div>${garantiaResumoBadge(t)}</div>
    </div>
          <div id="resumo-chamado-locked">
            <div class="detail-info-grid">
              <div><div class="di-label">Elemento</div>${escapeHtml(t.elemento || "—")}</div>
              <div><div class="di-label">Local</div>${escapeHtml(LOCAL_TIPO_MAP[t.localTipo] || "—")}</div>
              <div><div class="di-label">Origem da solicitação</div>${escapeHtml(t.origemSolicitacao || "—")}</div>
              <div><div class="di-label">Contato</div>${escapeHtml(t.requesterContact || "—")}</div>
              <div class="full"><div class="di-label">Descrição do problema</div>${escapeHtml(t.descricaoSolicitacao || t.analiseTecnica.problemaRelatado || "—")}</div>
            </div>
            ${!isClosed ? `<button class="btn ghost small" id="btn-edit-resumo-chamado" style="margin-top:10px;">✎ Editar informações</button>` : ""}
          </div>
          <div id="resumo-chamado-edit" style="display:none;">${solicitacaoFormMarkup(t, isClosed)}</div>
          </div>
        </details>

        <details class="mod-details">
          <summary class="mod-summary">
            <span class="mod-summary-title">Retorno da Vistoria</span>
            <span class="mod-summary-resumo">${hasAnaliseTecnica(t) ? escapeHtml(t.analiseTecnica.causaConfirmada || t.analiseTecnica.causaProvavel || "Vistoria registrada") : "Sem retorno de vistoria"} · ${garantiaResumoBadge(t)}</span>
          </summary>
          <div class="mod-details-body">
          ${hasAnaliseTecnica(t) ? `
            <div id="vistoria-locked">
              <div class="detail-info-grid">
                <div class="full"><div class="di-label">Constatação</div>${escapeHtml(t.analiseTecnica.constatacao || "—")}</div>
                <div><div class="di-label">Causa provável</div>${escapeHtml(t.analiseTecnica.causaProvavel || "—")}</div>
                <div><div class="di-label">Causa confirmada</div>${escapeHtml(t.analiseTecnica.causaConfirmada || "—")}</div>
                <div><div class="di-label">Responsabilidade</div>${escapeHtml(t.analiseTecnica.responsabilidade || "—")}</div>
                <div class="full"><div class="di-label">Observação / orientação</div>${escapeHtml(t.analiseTecnica.observacoes || "—")}</div>
              </div>
              ${!isClosed ? `<button class="btn ghost small" id="btn-edit-vistoria" style="margin-top:10px;">✎ Editar</button>` : ""}
            </div>
            <div id="vistoria-edit" style="display:none;">${analiseFormMarkup(t)}</div>
          ` : (!isClosed ? `
            <button class="btn ghost small" id="btn-add-vistoria">+ Registrar retorno da vistoria</button>
            <div id="vistoria-edit" style="display:none;">${analiseFormMarkup(t)}</div>
          ` : `<div class="empty-hint">Nenhum retorno de vistoria registrado.</div>`)}
          <h4 class="form-section-title" style="margin-top:14px;">Garantia</h4>
          ${renderGarantiaPanel(t)}
          <button class="btn ghost small" style="margin-top:10px;" id="btn-edit-warranty-matrix">Editar matriz de garantia do empreendimento</button>
          </div>
        </details>

    <details class="mod-details">
      <summary class="mod-summary"><span class="mod-summary-title">Responsável e nota interna</span><span class="mod-summary-resumo">${escapeHtml(t.responsavelInterno || "Sem responsável")}</span></summary>
      <div class="mod-details-body">
          <form id="resumo-form">
            <div class="form-grid">
              ${personFieldHTML("Responsável interno", "responsavelInterno", "teamInternal", t.responsavelInterno || "", false, isClosed)}
              <div class="field full">
                <label>Nota interna</label>
                <input type="text" name="obs" placeholder="Opcional" ${isClosed ? "disabled" : ""}>
                <span class="hint">${proxEtapa
                  ? `Existe uma etapa pendente ("${escapeHtml(proxEtapa.nome)}") — atualize o status dela no Plano de Atendimento para registrar o andamento. Use esta nota só para observações à parte.`
                  : `Registra um comentário no histórico. Para atualizar o andamento do atendimento, edite ou adicione uma etapa no Plano de Atendimento.`}</span>
              </div>
            </div>
            ${!isClosed ? `<div style="margin-top:12px;"><button type="button" class="btn primary" id="btn-save-resumo">Salvar atualização</button></div>` : `<p class="hint" style="margin-top:10px;">Chamado encerrado — reabra na seção de Resolução para editar.</p>`}
          </form>
      </div>
    </details>
  `;

  document.getElementById("btn-back-ticket").addEventListener("click", () => showView("tickets"));
  root.querySelectorAll("[data-garantia-acao]").forEach(btn => btn.addEventListener("click", () => {
    const ac = btn.dataset.garantiaAcao;
    if (ac === "editar-predio") openBuildingForm(t.buildingId);
    else if (ac === "matriz") openWarrantyMatrixModal(t.buildingId);
    else if (ac === "importar-manual") openManualImport(t.buildingId);
  }));
  document.getElementById("btn-delete-ticket").addEventListener("click", () => {
    if (!confirm(`Excluir o chamado ${t.id}? Esta ação não pode ser desfeita.`)) return;
    state.tickets = state.tickets.filter(x => x.id !== t.id);
    persist();
    showView("tickets");
    toast("Chamado excluído.");
  });
  root.querySelectorAll("[data-open-ticket-inline]").forEach(el => {
    el.addEventListener("click", (e) => { e.preventDefault(); goToTicketDetail(el.dataset.openTicketInline); });
  });
  root.querySelectorAll("[data-open-modification-inline]").forEach(el => {
    el.addEventListener("click", (e) => { e.preventDefault(); goToModificationDetail(el.dataset.openModificationInline); });
  });

  wireInlineAddSelects(document.getElementById("solicitacao-form"));
  wireAmbientesMultiField(document.getElementById("solicitacao-form"));
  const solLocalTipoSelect = document.querySelector("#solicitacao-form select[name=localTipo]");
  if (solLocalTipoSelect) {
    solLocalTipoSelect.addEventListener("change", () => {
      const slot = document.getElementById("field-ambiente-edit");
      slot.innerHTML = ambientesMultiFieldHTML(t.buildingId, solLocalTipoSelect.value, [], false);
      wireAmbientesMultiField(document.getElementById("solicitacao-form"));
    });
  }
  const solCategorySelect = document.querySelector("#solicitacao-form select[name=category]");
  function wireSolicitacaoMaterialChange() {
    const materialSelect = document.querySelector('#solicitacao-form select[name=material]');
    if (!materialSelect) return;
    materialSelect.addEventListener("change", () => {
      const elSlot = document.getElementById("field-elemento-edit");
      elSlot.innerHTML = elementoFieldHTML(solCategorySelect.value, materialSelect.value, "", false);
      wireInlineAddSelects(elSlot);
    });
  }
  function refreshSolicitacaoOutrosField() {
    const field = document.getElementById("field-outros-descricao-edit");
    const input = field.querySelector('input[name=outrosDescricao]');
    const isOutros = solCategorySelect.value === "Outros";
    field.style.display = isOutros ? "" : "none";
    input.required = isOutros;
    if (!isOutros) input.value = "";
  }
  function refreshSolicitacaoSistemaFields() {
    const category = solCategorySelect.value;
    const matSlot = document.getElementById("field-material-edit");
    const elSlot = document.getElementById("field-elemento-edit");
    matSlot.innerHTML = materialFieldHTML(category, "", false);
    elSlot.innerHTML = elementoFieldHTML(category, "", "", false);
    wireInlineAddSelects(matSlot);
    wireInlineAddSelects(elSlot);
    wireSolicitacaoMaterialChange();
    refreshSolicitacaoOutrosField();
  }
  if (solCategorySelect) solCategorySelect.addEventListener("change", refreshSolicitacaoSistemaFields);
  wireSolicitacaoMaterialChange();
  if (solCategorySelect) refreshSolicitacaoOutrosField();
  document.getElementById("btn-edit-resumo-chamado")?.addEventListener("click", () => {
    document.getElementById("resumo-chamado-locked").style.display = "none";
    document.getElementById("resumo-chamado-edit").style.display = "";
  });
  document.getElementById("btn-save-solicitacao")?.addEventListener("click", () => {
    const form = document.getElementById("solicitacao-form");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    t.category = fd.get("category");
    t.material = (fd.get("material") || "").trim();
    t.elemento = (fd.get("elemento") || "").trim();
    t.outrosDescricao = t.category === "Outros" ? (fd.get("outrosDescricao") || "").trim() : "";
    t.localTipo = fd.get("localTipo");
    t.ambientes = fd.getAll("ambientes").map(a => a.trim()).filter(Boolean);
    t.ambienteDetalhe = t.ambientes[0] || "";
    t.local = t.ambientes.join(", ");
    t.ambiente = t.local;
    t.title = generateTicketTitle(t.category, t.elemento, t.ambientes, t.localTipo, t.outrosDescricao);
    t.priority = fd.get("priority");
    t.origemSolicitacao = fd.get("origemSolicitacao");
    t.requesterName = fd.get("requesterName").trim();
    t.requesterContact = fd.get("requesterContact").trim();
    t.analiseTecnica.problemaRelatado = fd.get("problemaRelatado").trim();
    t.descricaoSolicitacao = t.analiseTecnica.problemaRelatado;
    addHistoryEntry(t, "Informações do chamado atualizadas", "");
    persist();
    renderAll();
    goToTicketDetail(t.id);
    toast("Informações salvas.", "success");
  });

  wireInlineAddSelects(document.getElementById("resumo-form"));
  if (!isClosed) {
    document.getElementById("btn-save-resumo").addEventListener("click", () => {
      const fd = new FormData(document.getElementById("resumo-form"));
      t.responsavelInterno = fd.get("responsavelInterno").trim();
      const obs = fd.get("obs").trim();

      if (obs) {
        addHistoryEntry(t, "Atualização registrada", obs);
      } else {
        addHistoryEntry(t, "Resumo atualizado", "");
      }
      persist();
      renderAll();
      goToTicketDetail(t.id);
      toast("Chamado atualizado.", "success");
    });
  }

  document.getElementById("btn-edit-warranty-matrix").addEventListener("click", () => openWarrantyMatrixModal(t.buildingId));

  document.getElementById("btn-edit-vistoria")?.addEventListener("click", () => {
    document.getElementById("vistoria-locked").style.display = "none";
    document.getElementById("vistoria-edit").style.display = "";
  });
  document.getElementById("btn-add-vistoria")?.addEventListener("click", () => {
    document.getElementById("btn-add-vistoria").style.display = "none";
    document.getElementById("vistoria-edit").style.display = "";
  });
  document.getElementById("btn-save-analise")?.addEventListener("click", () => {
    const fd = new FormData(document.getElementById("analise-form"));
    Object.assign(t.analiseTecnica, {
      constatacao: fd.get("constatacao").trim(),
      causaProvavel: fd.get("causaProvavel").trim(),
      causaConfirmada: fd.get("causaConfirmada").trim(),
      responsabilidade: fd.get("responsabilidade"),
      observacoes: fd.get("observacoes").trim(),
    });
    addHistoryEntry(t, "Retorno da vistoria registrado", t.analiseTecnica.responsabilidade ? `Responsabilidade: ${t.analiseTecnica.responsabilidade}.` : "");
    persist();
    renderAll();
    goToTicketDetail(t.id);
    toast("Retorno da vistoria salvo.", "success");
  });

  document.getElementById("btn-add-fornecedor")?.addEventListener("click", () => openLinkSupplierModal(t.id));
  wireFornecedoresVinculadosEvents(t);
  wireFotosChamado(t);
  wireDocumentosChamado(t);
  wirePlanoAtendimentoEvents(t);
  wireProximaAcaoQuickPick(t);
  wireProximoPasso(t);
  wireCockpitChamado(t);
  const verProximaEtapaBtn = document.querySelector("[data-ver-proxima-etapa]");
  if (verProximaEtapaBtn) verProximaEtapaBtn.addEventListener("click", () => openEtapaModal(t.id, verProximaEtapaBtn.dataset.verProximaEtapa));

  if (isClosed) {
    wireEncerramentoFechado(t);
  } else {
    wireResolucaoAberta(t);
  }
}

/* ---------- Fotos do chamado (só inicial/final, ligadas ao chamado) ---------- */
/* Nada de foto por etapa nem categorias soltas — só "antes" (situação do
   problema) e "depois" (resultado do reparo). anexo.momento carrega isso;
   anexos antigos (etapa/planoItemId) foram migrados pra momento em data.js,
   sem apagar os campos originais. */

function fotosChamadoPorMomento(ticket, momento) {
  return (ticket.anexos || []).filter(a => a.momento === momento);
}

function renderFotosChamado(ticket) {
  const momentos = [
    { id: "inicial", label: "📷 Foto inicial", hint: "Situação do problema antes do reparo." },
    { id: "final", label: "📷 Foto final", hint: "Resultado depois da conclusão." },
  ];
  return `
  <div class="fotos-chamado">
    ${momentos.map(m => `
      <div class="fotos-momento" data-momento="${m.id}">
        <div class="fotos-momento-head">
          <strong>${m.label}</strong>
          <span class="hint">${m.hint}</span>
        </div>
        <div class="attach-upload-row">
          <input type="file" class="foto-momento-input" multiple accept="image/*">
          <button type="button" class="btn ghost small foto-momento-upload-btn">+ Adicionar foto</button>
        </div>
        <div class="attach-gallery foto-momento-gallery">Carregando fotos…</div>
      </div>`).join("")}
  </div>`;
}

function wireFotosChamado(ticket) {
  document.querySelectorAll(".fotos-momento").forEach(block => {
    const momento = block.dataset.momento;
    const gallery = block.querySelector(".foto-momento-gallery");
    renderFotoMomentoGallery(ticket, momento, gallery);
    block.querySelector(".foto-momento-upload-btn").addEventListener("click", () => {
      const fileInput = block.querySelector(".foto-momento-input");
      const files = Array.from(fileInput.files || []);
      if (!files.length) { toast("Selecione ao menos uma foto.", "error"); return; }
      Promise.all(files.map(async file => {
        const attachmentId = await saveAttachment(file);
        ticket.anexos.push({ id: "an" + Date.now() + Math.random().toString(36).slice(2, 6), etapa: "", planoItemId: "", momento, attachmentId, fileName: file.name, uploadedAt: new Date().toISOString() });
      })).then(() => {
        addHistoryEntry(ticket, momento === "inicial" ? "Foto inicial adicionada" : "Foto final adicionada", `${files.length} foto(s).`);
        persist();
        fileInput.value = "";
        renderFotoMomentoGallery(ticket, momento, gallery);
        toast("Foto(s) enviada(s).", "success");
      });
    });
  });
}

async function renderFotoMomentoGallery(ticket, momento, gallery) {
  if (!gallery) return;
  const items = fotosChamadoPorMomento(ticket, momento);
  if (!items.length) { gallery.innerHTML = `<div class="empty-hint">Nenhuma foto ainda.</div>`; return; }
  gallery.innerHTML = `<div class="attach-items">${items.map(a => `
    <div class="attach-item" data-att="${a.id}">
      <div class="attach-thumb" data-thumb="${a.attachmentId}">…</div>
      <div class="attach-name" title="${escapeHtml(a.fileName)}">${escapeHtml(a.fileName)}</div>
      <button class="attach-remove" data-remove-foto="${a.id}" title="Remover">&times;</button>
    </div>`).join("")}</div>`;
  gallery.querySelectorAll("[data-remove-foto]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const anexoId = btn.dataset.removeFoto;
      const anexo = ticket.anexos.find(a => a.id === anexoId);
      if (!anexo) return;
      if (!confirm("Remover esta foto?")) return;
      await deleteAttachment(anexo.attachmentId);
      ticket.anexos = ticket.anexos.filter(a => a.id !== anexoId);
      addHistoryEntry(ticket, "Foto removida", anexo.fileName);
      persist();
      renderFotoMomentoGallery(ticket, momento, gallery);
    });
  });
  for (const a of items) {
    const rec = await getAttachment(a.attachmentId);
    const thumbEl = gallery.querySelector(`[data-thumb="${a.attachmentId}"]`);
    if (!thumbEl || !rec) continue;
    if (isImageType(rec.type)) {
      const url = URL.createObjectURL(rec.blob);
      thumbEl.innerHTML = `<img src="${url}" alt="">`;
    } else {
      thumbEl.textContent = "📄";
    }
  }
}

/* ---------- Fornecedores vinculados ao chamado ---------- */

function renderFornecedoresVinculados(t) {
  const links = t.fornecedores || [];
  if (!links.length) return `<div class="empty-hint">Nenhum fornecedor vinculado ainda.</div>`;
  return `<div class="supplier-link-list">${links.map(link => {
    const supplier = getSupplier(link.supplierId);
    if (!supplier) return "";
    const semRetorno = isFornecedorSemRetorno(t, link);
    const prazoAuto = prazoAutomaticoFornecedor(link);
    return `
    <div class="supplier-link-card">
      <div class="supplier-link-head">
        <strong>${escapeHtml(supplierDisplayName(supplier))}</strong>
        ${link.principal ? '<span class="badge outline">Principal</span>' : ""}
        ${semRetorno ? '<span class="followup-tag">⚠️ Fornecedor sem retorno</span>' : ""}
        <button class="attach-remove" data-unlink-supplier="${link.id}" title="Desvincular">&times;</button>
      </div>
      <div class="hint">${supplier.specialties.length ? escapeHtml(supplier.specialties.join(" · ")) : "Sem especialidades cadastradas"}</div>
      <div class="detail-info-grid" style="margin-top:8px;">
        <div><div class="di-label">Serviço</div>${escapeHtml(link.servico || "—")}</div>
        <div><div class="di-label">Acionado em</div>${link.dataAcionamento ? fmtDate(link.dataAcionamento) + (link.horaAcionamento ? " " + link.horaAcionamento : "") : "—"}</div>
        <div><div class="di-label">Data prevista pelo fornecedor</div>${link.dataAgendada ? fmtDate(link.dataAgendada) : (prazoAuto ? `— (prazo automático: ${fmtDate(prazoAuto)})` : "—")}</div>
        <div><div class="di-label">Retorno do fornecedor</div>${fmtDate(link.dataExecutada)}</div>
      </div>
      <div id="link-action-panel-${link.id}" style="display:none;"></div>
      <div class="supplier-link-actions">
        <button class="btn ghost small" data-view-supplier="${supplier.id}">Ver cadastro do fornecedor</button>
        <button class="btn ghost small" data-supplier-tickets="${supplier.id}">Ver todos os chamados deste fornecedor</button>
        ${!link.dataExecutada ? `<button class="btn ghost small" data-set-data-prevista="${link.id}">Registrar data prevista</button>` : ""}
        ${!link.dataExecutada ? `<button class="btn ghost small" data-set-data-executada="${link.id}">Registrar retorno</button>` : ""}
        ${semRetorno ? `<button class="btn danger small" data-cobrar-fornecedor="${link.id}">Cobrar fornecedor</button>` : ""}
      </div>
    </div>`;
  }).join("")}</div>`;
}

/* Sugestão (nunca vínculo automático): fornecedores que já atuaram nesse
   empreendimento na mesma categoria do chamado, ainda não vinculados a ele. */
/* Um vínculo fornecedor+obra sem materiais discriminados atua no sistema inteiro
   (comportamento de antes, preservado). Com materiais preenchidos, só bate se um
   deles corresponder ao material do chamado — evita sugerir "Esquadrias" cego
   sem saber se é alumínio ou madeira. */
function supplierLinkMatchesMaterial(link, material) {
  if (!material) return true;
  if (!link.materiais.length) return true;
  const m = material.toLowerCase();
  return link.materiais.some(x => x.toLowerCase().includes(m) || m.includes(x.toLowerCase()));
}

function matchingSupplierLinks(t) {
  const alreadyLinked = new Set((t.fornecedores || []).map(f => f.supplierId));
  return state.suppliers
    .filter(s => !alreadyLinked.has(s.id))
    .map(s => ({ s, link: s.buildings.find(b => b.buildingId === t.buildingId && b.categoria === t.category) }))
    .filter(x => x.link && supplierLinkMatchesMaterial(x.link, t.material));
}

/* Prazo de retorno do fornecedor: o usuário nunca digita isso — o sistema
   calcula. Sem "data prevista" informada, conta 5 dias corridos a partir do
   acionamento; com data prevista, é essa data que passa a valer. */
function prazoAutomaticoFornecedor(link) {
  if (!link.dataAcionamento || link.dataAgendada || link.dataExecutada) return null;
  const d = toLocalDate(link.dataAcionamento);
  d.setDate(d.getDate() + 5);
  return toISODateString(d);
}
function isFornecedorSemRetorno(t, link) {
  if (CLOSED_STATUSES.includes(t.status)) return false;
  if (link.dataExecutada) return false;
  const today = todayISODate();
  if (link.dataAgendada) return link.dataAgendada < today;
  const prazo = prazoAutomaticoFornecedor(link);
  return !!prazo && prazo <= today;
}
/* Varre todos os chamados — usado no painel geral. */
function fornecedoresSemRetorno() {
  const out = [];
  state.tickets.forEach(t => {
    (t.fornecedores || []).forEach(link => {
      if (isFornecedorSemRetorno(t, link)) out.push({ t, link });
    });
  });
  return out;
}
/* Todo fornecedor ainda aguardando retorno, vencido ou não — usado na Home
   pra mostrar os 3 estágios (dentro do prazo / próximo do vencimento /
   vencido), não só os já vencidos como fornecedoresSemRetorno(). */
function todosFornecedoresAguardando() {
  const out = [];
  state.tickets.forEach(t => {
    if (CLOSED_STATUSES.includes(t.status)) return;
    (t.fornecedores || []).forEach(link => {
      if (!link.dataExecutada) out.push({ t, link });
    });
  });
  return out;
}

function renderSupplierSuggestion(t) {
  const matches = matchingSupplierLinks(t);
  if (!matches.length) return "";
  return `<div class="supplier-suggestion">
    <div class="hint">Fornecedor relacionado ao empreendimento (categoria "${escapeHtml(t.category)}"${t.material ? ` · material "${escapeHtml(t.material)}"` : ""}):</div>
    ${matches.map(({ s, link }) => `
      <div class="supplier-link-card suggestion">
        <div class="supplier-link-head"><strong>${escapeHtml(supplierDisplayName(s))}</strong></div>
        <div class="hint">Atuação: ${escapeHtml(link.categoria)}${link.materiais.length ? " · " + escapeHtml(link.materiais.slice(0, 2).join(", ")) : ""}</div>
        <div class="supplier-link-actions">
          <button class="btn ghost small" data-suggest-link-supplier="${s.id}">Vincular fornecedor</button>
        </div>
      </div>`).join("")}
  </div>`;
}

/* Acionar fornecedor é 1 clique: data e hora são sempre automáticas, nunca
   pedidas ao usuário. Prazo/previsão não são perguntados aqui — o sistema
   calcula um prazo automático de 5 dias corridos (prazoAutomaticoFornecedor);
   "data prevista"/"execução" viram ações rápidas no card do fornecedor
   vinculado, só quando a informação existir de verdade. */
function openLinkSupplierModal(ticketId, presetSupplierId) {
  const t = getTicket(ticketId);
  const activeSuppliers = state.suppliers.filter(s => s.status === "ativo");
  if (!activeSuppliers.length) {
    toast("Cadastre um fornecedor em Fornecedores antes de acionar.", "error");
    return;
  }
  openModal(`
    <div class="modal-header">
      <h2>Acionar fornecedor</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <form id="link-supplier-form">
        <div class="form-grid">
          <div class="field full"><label>Fornecedor</label><select name="supplierId" required>${activeSuppliers.map(s => `<option value="${s.id}" ${s.id === presetSupplierId ? "selected" : ""}>${escapeHtml(supplierDisplayName(s))}</option>`).join("")}</select></div>
          <div class="field full"><label>Serviço solicitado (opcional)</label><input type="text" name="servico" placeholder="Ex: Reparo do motor da piscina"></div>
          <div class="field"><label>Data do acionamento</label><input type="date" name="dataAcionamento" value="${todayISODate()}"></div>
          <div class="field full"><label class="checkbox-inline"><input type="checkbox" name="principal" ${(!t.fornecedores || !t.fornecedores.length) ? "checked" : ""}> Definir como fornecedor principal</label></div>
        </div>
        <p class="hint">Deixe a data como está se está acionando agora. Mude só se estiver cadastrando um chamado antigo.</p>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn ghost" data-close>Cancelar</button>
      <button class="btn primary" id="btn-confirm-link-supplier">Acionar fornecedor</button>
    </div>
  `);
  wireModalClose();
  document.getElementById("btn-confirm-link-supplier").addEventListener("click", () => {
    const form = document.getElementById("link-supplier-form");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const supplierId = fd.get("supplierId");
    const servico = fd.get("servico").trim();
    const dataAcionamento = fd.get("dataAcionamento") || todayISODate();
    const principal = fd.get("principal") === "on";
    if (principal) (t.fornecedores || []).forEach(f => f.principal = false);
    t.fornecedores.push({
      id: "tf" + Date.now() + Math.random().toString(36).slice(2, 6),
      supplierId,
      servico,
      dataAcionamento,
      horaAcionamento: dataAcionamento === todayISODate() ? new Date().toTimeString().slice(0, 5) : "",
      prazoInformado: "",
      dataAgendada: "",
      dataExecutada: "",
      principal,
    });
    const oldStatus = t.status;
    t.status = statusCalculadoPeloPlano(t);
    const supplier = getSupplier(supplierId);
    addHistoryEntry(t, "Fornecedor acionado", `${supplierDisplayName(supplier)}${servico ? " — " + servico : ""}.`, oldStatus, t.status);
    t.plano.push({
      ...blankAtividade(),
      id: "et" + Date.now() + Math.random().toString(36).slice(2, 6),
      nome: "Acionar fornecedor",
      responsavel: ensureOperatorName(),
      execucoes: [{
        ...blankExecucao(),
        id: "exec" + Date.now() + Math.random().toString(36).slice(2, 6),
        data: dataAcionamento, resultado: "realizada", dataConclusao: dataAcionamento, registradoEm: todayISODate(),
        observacao: `Fornecedor: ${supplierDisplayName(supplier)}${servico ? " — " + servico : ""}`,
      }],
    });
    persist();
    closeModal();
    renderAll();
    goToTicketDetail(t.id);
    toast("Fornecedor acionado.", "success");
  });
}

function wireFornecedoresVinculadosEvents(t) {
  document.querySelectorAll("[data-unlink-supplier]").forEach(btn => {
    btn.addEventListener("click", () => {
      const linkId = btn.dataset.unlinkSupplier;
      const link = t.fornecedores.find(f => f.id === linkId);
      if (!link) return;
      const supplier = getSupplier(link.supplierId);
      if (!confirm(`Desvincular ${supplier ? supplierDisplayName(supplier) : "este fornecedor"} deste chamado?`)) return;
      t.fornecedores = t.fornecedores.filter(f => f.id !== linkId);
      addHistoryEntry(t, "Fornecedor desvinculado", supplier ? supplierDisplayName(supplier) : "");
      t.status = statusCalculadoPeloPlano(t);
      persist();
      renderAll();
      goToTicketDetail(t.id);
      toast("Fornecedor desvinculado.");
    });
  });
  document.querySelectorAll("[data-view-supplier]").forEach(btn => {
    btn.addEventListener("click", () => openSupplierDetail(btn.dataset.viewSupplier));
  });
  document.querySelectorAll("[data-supplier-tickets]").forEach(btn => {
    btn.addEventListener("click", () => openSupplierTicketsModal(btn.dataset.supplierTickets));
  });
  document.querySelectorAll("[data-suggest-link-supplier]").forEach(btn => {
    btn.addEventListener("click", () => openLinkSupplierModal(t.id, btn.dataset.suggestLinkSupplier));
  });

  document.querySelectorAll("[data-set-data-prevista]").forEach(btn => {
    btn.addEventListener("click", () => {
      const linkId = btn.dataset.setDataPrevista;
      const panel = document.getElementById(`link-action-panel-${linkId}`);
      panel.style.display = "";
      panel.innerHTML = `
        <div class="form-grid" style="margin-top:8px;">
          <div class="field"><label>Data prevista pelo fornecedor</label><input type="date" id="ea-data-prevista-${linkId}" value="${todayISODate()}"></div>
        </div>
        <button type="button" class="btn primary small" id="btn-confirmar-data-prevista-${linkId}" style="margin-top:8px;">Confirmar</button>`;
      document.getElementById(`btn-confirmar-data-prevista-${linkId}`).addEventListener("click", () => {
        const data = document.getElementById(`ea-data-prevista-${linkId}`).value;
        if (!data) { toast("Informe a data.", "error"); return; }
        const link = t.fornecedores.find(f => f.id === linkId);
        const supplier = getSupplier(link.supplierId);
        link.dataAgendada = data;
        addHistoryEntry(t, "Fornecedor informou data", `${supplierDisplayName(supplier)} — previsão para ${fmtDate(data)}.`);
        t.status = statusCalculadoPeloPlano(t);
        persist(); renderAll(); goToTicketDetail(t.id);
        toast("Data prevista registrada.", "success");
      });
    });
  });

  document.querySelectorAll("[data-set-data-executada]").forEach(btn => {
    btn.addEventListener("click", () => {
      const linkId = btn.dataset.setDataExecutada;
      const panel = document.getElementById(`link-action-panel-${linkId}`);
      panel.style.display = "";
      panel.innerHTML = `
        <div class="form-grid" style="margin-top:8px;">
          <div class="field"><label>Data de retorno do fornecedor</label><input type="date" id="ea-data-exec-${linkId}" value="${todayISODate()}"></div>
          <div class="field full"><label>Parecer (opcional)</label><input type="text" id="ea-parecer-${linkId}" placeholder="Ex: Necessário substituir componente"></div>
        </div>
        <button type="button" class="btn primary small" id="btn-confirmar-data-exec-${linkId}" style="margin-top:8px;">Confirmar</button>`;
      document.getElementById(`btn-confirmar-data-exec-${linkId}`).addEventListener("click", () => {
        const data = document.getElementById(`ea-data-exec-${linkId}`).value;
        if (!data) { toast("Informe a data.", "error"); return; }
        const parecer = document.getElementById(`ea-parecer-${linkId}`).value.trim();
        const link = t.fornecedores.find(f => f.id === linkId);
        const supplier = getSupplier(link.supplierId);
        link.dataExecutada = data;
        addHistoryEntry(t, "Retorno do fornecedor registrado", `${supplierDisplayName(supplier)} — retorno em ${fmtDate(data)}.${parecer ? " " + parecer : ""}`);
        t.plano.push({
          ...blankAtividade(),
          id: "et" + Date.now() + Math.random().toString(36).slice(2, 6),
          nome: "Retorno do fornecedor",
          responsavel: ensureOperatorName(),
          supplierId: link.supplierId,
          execucoes: [{
            ...blankExecucao(),
            id: "exec" + Date.now() + Math.random().toString(36).slice(2, 6),
            data, resultado: "realizada", dataConclusao: data, registradoEm: todayISODate(), observacao: parecer,
          }],
        });
        t.status = statusCalculadoPeloPlano(t);
        persist(); renderAll(); goToTicketDetail(t.id);
        toast("Retorno registrado.", "success");
      });
    });
  });

  document.querySelectorAll("[data-cobrar-fornecedor]").forEach(btn => {
    btn.addEventListener("click", () => {
      const linkId = btn.dataset.cobrarFornecedor;
      const link = t.fornecedores.find(f => f.id === linkId);
      cobrarFornecedor(t, link);
      persist(); renderAll(); goToTicketDetail(t.id);
      toast("Cobrança registrada no histórico.", "success");
    });
  });
}

/* Miolo puro (sem navegação/toast) pra poder ser chamado tanto de dentro do
   chamado quanto direto da Home, sem sair da página. */
function cobrarFornecedor(t, link) {
  const supplier = getSupplier(link.supplierId);
  addHistoryEntry(t, "Fornecedor cobrado", `${supplierDisplayName(supplier)} — cobrado por ausência de retorno.`);
  const hoje = todayISODate();
  t.plano.push({
    ...blankAtividade(),
    id: "et" + Date.now() + Math.random().toString(36).slice(2, 6),
    nome: "Cobrar fornecedor",
    responsavel: ensureOperatorName(),
    supplierId: link.supplierId,
    execucoes: [{
      ...blankExecucao(),
      id: "exec" + Date.now() + Math.random().toString(36).slice(2, 6),
      data: hoje, resultado: "realizada", dataConclusao: hoje, registradoEm: hoje,
      observacao: "Fornecedor cobrado por ausência de retorno.",
    }],
  });
  t.status = statusCalculadoPeloPlano(t);
}

/* ---------- Plano de Atendimento: Atividade -> Execuções ---------- */
/* Uma atividade (vistoria, reparo, retorno de fornecedor...) fica em t.plano,
   e pode ter zero, uma ou várias execuções (visitas/tentativas com data
   própria) dentro de atividade.execucoes. Não confundir com
   anexo.etapa/ANEXO_ETAPAS, que é só a categoria fixa de anexo. Toda mutação
   também registra uma entrada no histórico do chamado (t.history), que já é a
   fonte única de verdade cronológica — não existe um sub-histórico por
   atividade/execução (a lista de execuções em si já preserva tudo). */

/* A execução mais recentemente marcada "realizada" dentro de uma atividade —
   usada tanto pro status agregado quanto pra auto-preencher o encerramento do
   chamado com "quando/quem" da última coisa feita. */
function ultimaExecucaoRealizada(atividade) {
  const realizadas = (atividade.execucoes || []).filter(e => e.resultado === "realizada");
  if (!realizadas.length) return null;
  return realizadas.slice().sort((a, b) => (b.dataConclusao || "").localeCompare(a.dataConclusao || ""))[0];
}
/* Status agregado da ATIVIDADE — nunca gravado, sempre calculado a partir de
   todas as suas execuções (regra principal do ajuste: analisa o histórico
   completo da atividade, não só a primeira data cadastrada):
   - cancelada explicitamente -> "cancelada"
   - nenhuma execução ainda -> "a_agendar"
   - existe execução pendente com data futura (ou sem data) -> "agendada"
     (mesmo que outra execução tenha vencido sem acontecer — uma execução
     futura já resolve a atividade, não é atraso)
   - existe execução pendente VENCIDA e nenhuma pendente futura -> "atrasada"
   - pelo menos uma "realizada" e nada pendente -> "concluida"
   - só "nao_realizada" e nada pendente -> "nao_realizada" (tentativas
     esgotadas, ninguém agendou de novo ainda) */
function atividadeStatus(atividade) {
  if (atividade.cancelada) return "cancelada";
  const execs = atividade.execucoes || [];
  if (!execs.length) return "a_agendar";
  const hoje = todayISODate();
  const pendentesFuturas = execs.filter(e => e.resultado === "pendente" && (!e.data || e.data >= hoje));
  const pendentesAtrasadas = execs.filter(e => e.resultado === "pendente" && e.data && e.data < hoje);
  if (pendentesAtrasadas.length && !pendentesFuturas.length) return "atrasada";
  if (pendentesFuturas.length) return "agendada";
  if (ultimaExecucaoRealizada(atividade)) return "concluida";
  return "nao_realizada";
}
function atividadeStatusInfo(atividade) {
  return ETAPA_STATUS[atividadeStatus(atividade)] || ETAPA_STATUS.a_agendar;
}
function atividadeStatusBadge(atividade) {
  const info = atividadeStatusInfo(atividade);
  return `<span class="badge etapa-status" data-etapa-status="${atividadeStatus(atividade)}">${info.icon} ${info.label}</span>`;
}
/* Mesma lógica de atraso, mas por execução isolada (usado na Agenda, onde cada
   execução é seu próprio evento). */
function execucaoEffectiveStatus(exec) {
  if (exec.resultado === "pendente" && exec.data && exec.data < todayISODate()) return "atrasada";
  if (exec.resultado === "pendente") return "agendada";
  if (exec.resultado === "realizada") return "concluida"; // ETAPA_STATUS usa "concluida", não "realizada"
  return exec.resultado; // "nao_realizada" já bate direto
}
function execucaoChip(exec) {
  const info = ETAPA_STATUS[execucaoEffectiveStatus(exec)] || ETAPA_STATUS.a_agendar;
  const dataTxt = exec.data ? fmtDate(exec.data) : "sem data";
  const obsTxt = exec.resultado !== "pendente" && exec.observacao ? " — " + escapeHtml(exec.observacao) : "";
  return `<span class="exec-chip" title="${info.label}">${dataTxt} ${info.icon}${obsTxt}</span>`;
}

function renderPlanoAtendimento(t) {
  const plano = t.plano || [];
  const prog = planoProgresso(t);
  const progressoHTML = plano.length ? `
    <div class="plano-progresso">
      <div class="plano-progresso-chips">
        ${plano.map((a, i) => `${i > 0 ? '<span class="plano-progresso-arrow">→</span>' : ""}<span title="${escapeHtml(a.nome)} — ${atividadeStatusInfo(a).label}">${atividadeStatusInfo(a).icon}</span>`).join("")}
      </div>
      <div class="plano-progresso-bar"><div class="plano-progresso-fill" style="width:${prog.pct}%;"></div></div>
      <div class="hint">${prog.concluidas} de ${prog.total} atividade(s) concluída(s) — ${prog.pct}%</div>
    </div>` : "";

  const listHTML = plano.length ? `<div class="plano-etapa-list">${plano.map(a => {
    const supplier = a.supplierId ? getSupplier(a.supplierId) : null;
    const execs = a.execucoes || [];
    return `
    <div class="plano-etapa-card" data-open-etapa="${a.id}">
      <div class="plano-etapa-head">
        <strong>${escapeHtml(a.nome || "(sem nome)")}</strong>
        ${atividadeStatusBadge(a)}
      </div>
      <div class="hint">
        ${a.responsavel ? "Responsável: " + escapeHtml(a.responsavel) : "Sem responsável definido"}
        ${supplier ? " · Fornecedor: " + escapeHtml(supplierDisplayName(supplier)) : ""}
        ${execs.length ? " · Execuções: " + execs.length : ""}
      </div>
      ${execs.length ? `<div class="plano-execucoes-chips">${execs.map(execucaoChip).join("")}</div>` : `<div class="empty-hint" style="margin-top:6px;">Nenhuma execução agendada ainda.</div>`}
    </div>`;
  }).join("")}</div>` : `<div class="empty-hint">Nenhuma atividade cadastrada ainda.</div>`;

  return progressoHTML + listHTML;
}

function wirePlanoAtendimentoEvents(t) {
  const btnAdd = document.getElementById("btn-add-etapa");
  if (btnAdd) btnAdd.addEventListener("click", () => openEtapaModal(t.id, null));
  document.querySelectorAll("[data-open-etapa]").forEach(el => {
    el.addEventListener("click", () => openEtapaModal(t.id, el.dataset.openEtapa));
  });
}

/* Quando uma etapa é vinculada a um fornecedor que ainda não está no chamado,
   cria o vínculo automaticamente (não-principal) — assim a ficha do fornecedor
   continua mostrando esse chamado no histórico, sem duplicar mecanismo. */
function linkSupplierToTicketIfNeeded(t, supplierId) {
  if (!supplierId) return;
  if ((t.fornecedores || []).some(f => f.supplierId === supplierId)) return;
  t.fornecedores.push({
    id: "tf" + Date.now() + Math.random().toString(36).slice(2, 6),
    supplierId, servico: "", dataAcionamento: todayISODate(),
    prazoInformado: "", dataAgendada: "", dataExecutada: "",
    principal: !t.fornecedores || !t.fornecedores.length,
  });
}

function openEtapaModal(ticketId, etapaId, presetNome) {
  const t = getTicket(ticketId);
  const isNew = !etapaId;
  const atividade = isNew ? { ...blankAtividade(), nome: presetNome || "", tipo: presetNome === "Realizar reparo" ? "execucao" : "acao" } : t.plano.find(e => e.id === etapaId);
  if (!isNew && !atividade) return;
  const activeSuppliers = state.suppliers.filter(s => s.status === "ativo");
  const execs = (atividade.execucoes || []).slice();

  openModal(`
    <div class="modal-header">
      <h2>${isNew ? "Nova atividade" : "Atividade: " + escapeHtml(atividade.nome || "")}</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      ${!isNew ? `<div class="plano-etapa-status-row">${atividadeStatusBadge(atividade)}</div>` : ""}
      <form id="etapa-form">
        <div class="form-grid">
          <div class="field full">
            <label>Nome da atividade *</label>
            <input type="text" name="nome" required value="${escapeHtml(atividade.nome || "")}" placeholder="Ex: Realizar reparo" list="etapa-nome-list">
            <datalist id="etapa-nome-list">${ETAPA_NOME_SUGESTOES.map(n => `<option value="${n}">`).join("")}</datalist>
          </div>
          ${personFieldHTML("Responsável", "responsavel", "teamEtapas", atividade.responsavel || "", false, false)}
          <div class="field">
            <label>Fornecedor (quando aplicável)</label>
            <select name="supplierId">
              <option value="">Nenhum</option>
              ${activeSuppliers.map(s => `<option value="${s.id}" ${atividade.supplierId === s.id ? "selected" : ""}>${escapeHtml(supplierDisplayName(s))}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Necessita acesso à unidade?</label>
            <select name="acessoUnidade">
              <option value="nao" ${atividade.acessoUnidade !== "sim" ? "selected" : ""}>Não</option>
              <option value="sim" ${atividade.acessoUnidade === "sim" ? "selected" : ""}>Sim</option>
            </select>
          </div>
          <div class="field" id="campo-cliente-presente" style="${atividade.acessoUnidade === "sim" ? "" : "display:none;"}">
            <label>Cliente precisa estar presente?</label>
            <select name="clientePresente">
              <option value="nao" ${atividade.clientePresente !== "sim" ? "selected" : ""}>Não</option>
              <option value="sim" ${atividade.clientePresente === "sim" ? "selected" : ""}>Sim</option>
            </select>
          </div>
          <div class="field full"><label>Observações gerais</label><textarea name="observacoes">${escapeHtml(atividade.observacoes || "")}</textarea></div>
          ${isNew ? `
          <div class="field"><label>Primeira execução — data (opcional)</label><input type="date" name="primeiraData"></div>
          <div class="field"><label>Horário</label><input type="time" name="primeiroHorario"></div>
          <p class="hint full">Pode deixar em branco e salvar só a atividade — dá pra adicionar quantas execuções precisar depois de salvar.</p>
          ` : ""}
        </div>
      </form>
      ${!isNew ? `
        <h4 class="form-section-title" style="margin-top:16px;">Execuções${execs.length ? " (" + execs.length + ")" : ""}</h4>
        ${execs.length ? `
        <div class="table-wrap">
          <table class="mini-table">
            <thead><tr><th>Data</th><th>Horário</th><th>Situação</th><th>Observação</th><th></th></tr></thead>
            <tbody>
              ${execs.map(exec => {
                const info = ETAPA_STATUS[execucaoEffectiveStatus(exec)] || ETAPA_STATUS.a_agendar;
                return `<tr data-execucao-row="${exec.id}">
                  <td>${exec.data ? fmtDate(exec.data) : "—"}</td>
                  <td>${exec.horario || "—"}</td>
                  <td>${info.icon} ${info.label}</td>
                  <td>${escapeHtml(exec.observacao || "—")}</td>
                  <td style="white-space:nowrap;">
                    ${exec.resultado === "pendente" ? `
                      <button type="button" class="btn ghost small" data-exec-action="realizada" data-execucao-id="${exec.id}">✓ Realizada</button>
                      <button type="button" class="btn ghost small" data-exec-action="nao_realizada" data-execucao-id="${exec.id}">✕ Não realizada</button>
                      <button type="button" class="btn ghost small" data-exec-action="reagendar" data-execucao-id="${exec.id}">✎ Reagendar</button>
                    ` : ""}
                    ${exec.resultado === "realizada" ? `<button type="button" class="btn ghost small" data-exec-action="corrigir" data-execucao-id="${exec.id}">✎ Corrigir data</button>` : ""}
                  </td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>` : `<div class="empty-hint">Nenhuma execução cadastrada ainda.</div>`}
        ${!atividade.cancelada ? `<button type="button" class="btn ghost small" id="btn-add-execucao" style="margin-top:8px;">+ Adicionar execução</button>` : ""}
        <div id="execucao-action-panel" style="display:none;"></div>
      ` : ""}
      ${!isNew && !atividade.cancelada ? `
        <h4 class="form-section-title" style="margin-top:16px;">Ações</h4>
        <button type="button" class="btn ghost small" id="btn-cancelar-atividade">Cancelar atividade</button>
      ` : ""}
      <div id="etapa-conflict-panel" style="display:none;"></div>
    </div>
    <div class="modal-footer">
      ${!isNew ? `<button class="btn danger" id="btn-remove-etapa" style="margin-right:auto;">Remover atividade</button>` : ""}
      <button class="btn ghost" data-close>Cancelar</button>
      <button class="btn primary" id="btn-save-etapa">${isNew ? "Adicionar atividade" : "Salvar dados da atividade"}</button>
    </div>
  `, true);
  wireModalClose();
  wireInlineAddSelects(document.getElementById("etapa-form"));

  const acessoSelect = document.querySelector('#etapa-form select[name=acessoUnidade]');
  acessoSelect.addEventListener("change", () => {
    document.getElementById("campo-cliente-presente").style.display = acessoSelect.value === "sim" ? "" : "none";
  });

  document.getElementById("btn-save-etapa").addEventListener("click", () => {
    const form = document.getElementById("etapa-form");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const dados = {
      nome: fd.get("nome").trim(),
      tipo: atividade.tipo || "acao",
      responsavel: fd.get("responsavel").trim(),
      supplierId: fd.get("supplierId") || "",
      acessoUnidade: fd.get("acessoUnidade"),
      clientePresente: fd.get("acessoUnidade") === "sim" ? fd.get("clientePresente") : "nao",
      observacoes: fd.get("observacoes").trim(),
    };
    const primeiraData = isNew ? fd.get("primeiraData") : "";
    const primeiroHorario = isNew ? fd.get("primeiroHorario") : "";

    const commit = () => {
      linkSupplierToTicketIfNeeded(t, dados.supplierId);
      if (isNew) {
        const novaAtividade = {
          ...blankAtividade(), ...dados, id: "et" + Date.now() + Math.random().toString(36).slice(2, 6),
          execucoes: primeiraData ? [{ ...blankExecucao(), id: "exec" + Date.now() + Math.random().toString(36).slice(2, 6), data: primeiraData, horario: primeiroHorario }] : [],
        };
        t.plano.push(novaAtividade);
        addHistoryEntry(t, "Atividade adicionada ao plano de atendimento", novaAtividade.nome);
        persistTicket(t);
        closeModal();
        renderAll();
        goToTicketDetail(t.id);
        openEtapaModal(t.id, novaAtividade.id); // reabre já na tela de execuções, pra quem quer cadastrar várias datas de uma vez
      } else {
        Object.assign(atividade, dados);
        addHistoryEntry(t, "Atividade do plano atualizada", atividade.nome);
        persistTicket(t);
        closeModal();
        renderAll();
        goToTicketDetail(t.id);
      }
      toast(isNew ? "Atividade adicionada." : "Atividade atualizada.", "success");
    };

    if (primeiraData) {
      const conflito = execucaoConflitante(primeiraData, primeiroHorario, dados.responsavel, null);
      if (conflito) { mostrarAvisoConflitoAgenda(dados.responsavel, conflito, commit); return; }
    }
    commit();
  });

  if (!isNew) {
    document.getElementById("btn-remove-etapa").addEventListener("click", () => {
      if (!confirm(`Remover a atividade "${atividade.nome}" do plano de atendimento?`)) return;
      t.plano = t.plano.filter(e => e.id !== atividade.id);
      addHistoryEntry(t, "Atividade removida do plano de atendimento", atividade.nome);
      persistTicket(t);
      closeModal();
      renderAll();
      goToTicketDetail(t.id);
      toast("Atividade removida.");
    });

    document.getElementById("btn-cancelar-atividade")?.addEventListener("click", () => {
      if (!confirm(`Cancelar a atividade "${atividade.nome}"?`)) return;
      atividade.cancelada = true;
      addHistoryEntry(t, "Atividade cancelada", atividade.nome);
      persistTicket(t); closeModal(); renderAll(); goToTicketDetail(t.id);
      toast("Atividade cancelada.");
    });

    wireAtividadeExecucoes(t, atividade);
  }
}

/* Aviso não bloqueante, inline no próprio modal — não abre um segundo modal por
   cima (perderia o que já foi digitado no formulário). "Voltar" só esconde o
   aviso; o formulário continua aberto e intacto. */
function mostrarAvisoConflitoAgenda(responsavel, conflito, onConfirm) {
  const { atividade: atividadeConf, execucao: execucaoConf, ticket: ticketConf, building: buildingConf } = conflito;
  const panel = document.getElementById("etapa-conflict-panel");
  panel.style.display = "";
  panel.innerHTML = `
    <div class="resolucao-banner warn" style="margin-top:14px;">
      <strong>⚠️ Conflito de agenda</strong><br>
      ${escapeHtml(responsavel)} já possui um compromisso agendado para este horário:
      <div class="detail-info-grid" style="margin-top:8px;">
        <div><div class="di-label">Compromisso existente</div>${escapeHtml(atividadeConf.nome || "(sem nome)")}</div>
        <div><div class="di-label">Quando</div>${fmtDate(execucaoConf.data)} às ${escapeHtml(execucaoConf.horario)}</div>
        <div><div class="di-label">Chamado</div>${ticketConf.id}${buildingConf ? " — " + escapeHtml(buildingConf.name) : ""}${ticketConf.unit ? " / " + escapeHtml(ticketConf.unit) : ""}</div>
      </div>
      <div style="margin-top:10px;">
        <button type="button" class="btn ghost small" id="btn-conflict-voltar">Voltar</button>
        <button type="button" class="btn primary small" id="btn-conflict-salvar">Salvar mesmo assim</button>
      </div>
    </div>`;
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
  document.getElementById("btn-conflict-voltar").addEventListener("click", () => {
    panel.style.display = "none";
    panel.innerHTML = "";
  });
  document.getElementById("btn-conflict-salvar").addEventListener("click", onConfirm);
}

/* Ações por execução (linha da tabela) + "Adicionar execução" da atividade
   inteira. Cada uma registra uma entrada em t.history — ao reagendar, a data
   antiga entra no texto antes de ser sobrescrita, então nada se perde mesmo a
   execução guardando só o valor atual. "Adicionar execução" não fecha o modal
   (reabre a mesma atividade) — é o fluxo de cadastrar várias datas de uma vez
   sem precisar reabrir a ficha a cada clique. */
function wireAtividadeExecucoes(t, atividade) {
  const panel = document.getElementById("execucao-action-panel");

  document.getElementById("btn-add-execucao")?.addEventListener("click", () => {
    panel.style.display = "";
    panel.innerHTML = `
      <div class="form-grid" style="margin-top:10px;">
        <div class="field"><label>Data *</label><input type="date" id="ea-nova-exec-data"></div>
        <div class="field"><label>Horário</label><input type="time" id="ea-nova-exec-horario"></div>
      </div>
      <button type="button" class="btn primary small" id="btn-confirmar-nova-execucao" style="margin-top:8px;">Adicionar execução</button>`;
    document.getElementById("btn-confirmar-nova-execucao").addEventListener("click", () => {
      const data = document.getElementById("ea-nova-exec-data").value;
      if (!data) { toast("Informe a data.", "error"); return; }
      const horario = document.getElementById("ea-nova-exec-horario").value;
      const commit = () => {
        atividade.execucoes.push({ ...blankExecucao(), id: "exec" + Date.now() + Math.random().toString(36).slice(2, 6), data, horario });
        addHistoryEntry(t, "Execução adicionada", `"${atividade.nome}": ${fmtDate(data)}${horario ? " " + horario : ""}.`);
        persistTicket(t); renderAll(); goToTicketDetail(t.id);
        openEtapaModal(t.id, atividade.id);
        toast("Execução adicionada.", "success");
      };
      const conflito = execucaoConflitante(data, horario, atividade.responsavel, null);
      if (conflito) { mostrarAvisoConflitoAgenda(atividade.responsavel, conflito, commit); return; }
      commit();
    });
  });

  document.querySelectorAll("[data-exec-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.execAction;
      const exec = atividade.execucoes.find(e => e.id === btn.dataset.execucaoId);
      if (!exec) return;

      /* Data real (quando aconteceu) sempre separada da data de registro (hoje,
         automática, nunca editável) — mesmo padrão já usado em "Acionar
         fornecedor". Pré-preenchida com hoje pro caso comum (dando baixa na
         hora), só precisa mexer quando for uma execução feita antes. */
      if (action === "realizada") {
        panel.style.display = "";
        panel.innerHTML = `
          <div class="form-grid" style="margin-top:10px;">
            <div class="field"><label>Quando foi realizado?</label><input type="date" id="ea-data-real" value="${todayISODate()}" max="${todayISODate()}"></div>
            <div class="field full"><label>Observação (opcional)</label><input type="text" id="ea-obs-realizada" placeholder="Ex: Pintura concluída"></div>
          </div>
          <p class="hint">Deixe a data como está se aconteceu agora. Mude só se estiver dando baixa em algo que já foi feito antes.</p>
          <button type="button" class="btn primary small" id="btn-confirmar-exec-realizada" style="margin-top:8px;">Marcar como realizada</button>`;
        document.getElementById("btn-confirmar-exec-realizada").addEventListener("click", () => {
          const registro = todayISODate();
          const dataReal = document.getElementById("ea-data-real").value || registro;
          const obs = document.getElementById("ea-obs-realizada").value.trim();
          exec.resultado = "realizada";
          exec.dataConclusao = dataReal;
          exec.registradoEm = registro;
          exec.observacao = obs;
          const nota = dataReal !== registro
            ? `"${atividade.nome}" (${fmtDate(exec.data || dataReal)}) registrada como realizada. Data real informada: ${fmtDate(dataReal)}.`
            : `"${atividade.nome}" realizada em ${fmtDate(dataReal)}.`;
          addHistoryEntry(t, "Execução realizada", nota);
          persistTicket(t); closeModal(); renderAll(); goToTicketDetail(t.id);
          toast("Execução marcada como realizada.", "success");
        });
        return;
      }

      if (action === "nao_realizada") {
        panel.style.display = "";
        panel.innerHTML = `
          <div class="form-grid" style="margin-top:10px;">
            <div class="field full"><label>Motivo (opcional)</label><input type="text" id="ea-motivo-nr" placeholder="Ex: Parede ainda úmida"></div>
          </div>
          <button type="button" class="btn primary small" id="btn-confirmar-exec-nao-realizada" style="margin-top:8px;">Confirmar</button>`;
        document.getElementById("btn-confirmar-exec-nao-realizada").addEventListener("click", () => {
          const motivo = document.getElementById("ea-motivo-nr").value.trim();
          const registro = todayISODate();
          exec.resultado = "nao_realizada";
          exec.registradoEm = registro;
          exec.observacao = motivo;
          addHistoryEntry(t, "Execução não realizada", `"${atividade.nome}" (${fmtDate(exec.data)})${motivo ? ": " + motivo : "."}`);
          persistTicket(t); closeModal(); renderAll(); goToTicketDetail(t.id);
          toast("Execução marcada como não realizada.");
        });
        return;
      }

      /* Só move a data/horário DESSA execução — pro caso do cliente pedir pra
         mudar uma data já programada (diferente de "não aconteceu, criar
         outra execução depois", que usa Não realizada + Adicionar execução). */
      if (action === "reagendar") {
        panel.style.display = "";
        panel.innerHTML = `
          <div class="form-grid" style="margin-top:10px;">
            <div class="field"><label>Nova data *</label><input type="date" id="ea-nova-data"></div>
            <div class="field"><label>Novo horário</label><input type="time" id="ea-novo-horario"></div>
            <div class="field full"><label>Motivo</label><input type="text" id="ea-motivo" placeholder="Ex: Cliente pediu pra mudar"></div>
          </div>
          <button type="button" class="btn primary small" id="btn-confirmar-reagendamento" style="margin-top:8px;">Confirmar reagendamento</button>`;
        document.getElementById("btn-confirmar-reagendamento").addEventListener("click", () => {
          const novaData = document.getElementById("ea-nova-data").value;
          if (!novaData) { toast("Informe a nova data.", "error"); return; }
          const novoHorario = document.getElementById("ea-novo-horario").value;
          const motivo = document.getElementById("ea-motivo").value.trim();
          const commit = () => {
            const dataAntigaTxt = exec.data ? fmtDate(exec.data) : "sem data definida";
            addHistoryEntry(t, "Execução reagendada", `"${atividade.nome}": de ${dataAntigaTxt} para ${fmtDate(novaData)}.${motivo ? " Motivo: " + motivo : ""}`);
            exec.data = novaData;
            exec.horario = novoHorario || exec.horario;
            persistTicket(t); closeModal(); renderAll(); goToTicketDetail(t.id);
            toast("Execução reagendada.", "success");
          };
          const conflito = execucaoConflitante(novaData, novoHorario, atividade.responsavel, exec.id);
          if (conflito) { mostrarAvisoConflitoAgenda(atividade.responsavel, conflito, commit); return; }
          commit();
        });
        return;
      }

      if (action === "corrigir") {
        panel.style.display = "";
        panel.innerHTML = `
          <div class="form-grid" style="margin-top:10px;">
            <div class="field"><label>Data realizada correta</label><input type="date" id="ea-data-corrigida" value="${exec.dataConclusao || todayISODate()}" max="${todayISODate()}"></div>
          </div>
          <button type="button" class="btn primary small" id="btn-salvar-data-corrigida" style="margin-top:8px;">Salvar correção</button>`;
        document.getElementById("btn-salvar-data-corrigida").addEventListener("click", () => {
          const novaData = document.getElementById("ea-data-corrigida").value;
          if (!novaData) { toast("Informe a data.", "error"); return; }
          const antiga = exec.dataConclusao;
          if (novaData === antiga) { closeModal(); return; }
          exec.dataConclusao = novaData;
          addHistoryEntry(t, "Data de execução corrigida", `"${atividade.nome}": ${fmtDate(antiga)} → ${fmtDate(novaData)}.`);
          persistTicket(t); closeModal(); renderAll(); goToTicketDetail(t.id);
          toast("Data corrigida.", "success");
        });
        return;
      }
    });
  });
}

/* ---------- Resolução do chamado (decisão rápida, não formulário) ---------- */
/* Datas/responsável de execução não são perguntados de novo aqui — vêm da
   própria atividade tipo "Execução" já com uma execução realizada no Plano de
   Atendimento. Devolve {atividade, execucao} (a execução realizada mais
   recente, entre as atividades tipo "execucao"), ou null. */
function ultimaEtapaExecucaoConcluida(t) {
  const candidatas = (t.plano || [])
    .filter(a => a.tipo === "execucao")
    .map(a => ({ atividade: a, execucao: ultimaExecucaoRealizada(a) }))
    .filter(x => x.execucao);
  if (!candidatas.length) return null;
  return candidatas.sort((a, b) => (b.execucao.dataConclusao || "").localeCompare(a.execucao.dataConclusao || ""))[0];
}

/* Só um aviso — a decisão de encerrar continua sempre humana, nunca bloqueia. */
function resolucaoBanner(t) {
  if (!t.plano || !t.plano.length) return "";
  const pendentes = t.plano.filter(a => !["concluida", "cancelada"].includes(atividadeStatus(a)));
  return pendentes.length
    ? `<div class="resolucao-banner warn">⚠️ Existem etapas pendentes neste atendimento.</div>`
    : `<div class="resolucao-banner ok">✓ Atendimento pronto para encerramento.</div>`;
}

/* Causas já registradas, da mais usada pra menos — alimenta o autocompletar do
   campo "causa" pra que a mesma causa seja escrita sempre do mesmo jeito e o
   relatório de Engenharia consiga contar. */
function causasConhecidas() {
  const m = new Map();
  state.tickets.forEach(t => {
    const c = ticketCausaReal(t);
    if (!c) return;
    const k = causaChave(c);
    const e = m.get(k) || { texto: c, n: 0 };
    e.n++;
    m.set(k, e);
  });
  return Array.from(m.values()).sort((a, b) => b.n - a.n).map(e => e.texto);
}

const RESOLUCAO_CARDS = [
  { id: "reparo_concluido", icon: "🟢", label: "Reparo concluído" },
  { id: "reparo_parcial", icon: "🟡", label: "Reparo parcial" },
  { id: "sem_necessidade", icon: "🔵", label: "Sem necessidade de reparo" },
  { id: "nao_solucionado", icon: "🔴", label: "Não solucionado" },
  { id: "improcedente", icon: "⚪", label: "Improcedente" },
];

function renderResolucaoAberta(t) {
  return `
    ${resolucaoBanner(t)}
    <div class="resolucao-pergunta">O que aconteceu com este atendimento?</div>
    <div class="resolucao-cards">
      ${RESOLUCAO_CARDS.map(c => `<button type="button" class="resolucao-card-btn rc-${c.id}" data-resultado="${c.id}"><span class="resolucao-card-icon">${typeof ckIco === "function" ? ckIco("res_" + c.id, 22) : ""}</span><span>${c.label}</span></button>`).join("")}
    </div>
    <div id="resolucao-panel"></div>`;
}

function renderEncerramentoFechado(t) {
  const enc = t.encerramento;
  if (enc.resultadoTipo) {
    const rows = [];
    if (enc.resultadoTipo === "reparo_concluido") {
      const comoLabel = (COMO_RESOLVIDO_OPTIONS.find(o => o.id === enc.comoResolvido) || {}).label;
      if (enc.sistemaReal) {
        const mudou = enc.sistemaConfirmado === "nao" && enc.sistemaReal !== t.category;
        rows.push(`<div><div class="di-label">Sistema real</div>${escapeHtml(enc.sistemaReal)}${mudou ? ` <span class="hint">(informado: ${escapeHtml(t.category || "—")})</span>` : ""}</div>`);
        if (enc.causaReal) rows.push(`<div><div class="di-label">Causa</div>${escapeHtml(enc.causaReal)}</div>`);
      }
      rows.push(`<div><div class="di-label">Como foi resolvido</div>${escapeHtml(enc.comoResolvido === "outro" ? (enc.comoResolvidoOutro || "Outro") : (comoLabel || "—"))}</div>`);
      rows.push(`<div><div class="di-label">Cliente confirmou</div>${escapeHtml({ sim: "Sim", nao: "Não", sem_contato: "Não foi possível contato" }[enc.clienteConfirmou] || "—")}</div>`);
      rows.push(`<div><div class="di-label">Data de execução</div>${fmtDate(enc.dataExecucao)}</div>`);
      rows.push(`<div><div class="di-label">Responsável pela execução</div>${escapeHtml(enc.responsavelExecucao || "—")}</div>`);
    } else if (enc.resultadoTipo === "sem_necessidade") {
      rows.push(`<div><div class="di-label">Motivo</div>${escapeHtml(enc.motivoSemNecessidade || "—")}</div>`);
      rows.push(`<div><div class="di-label">Cliente foi informado</div>${enc.clienteInformado === "sim" ? "Sim" : "Não"}</div>`);
    } else if (enc.resultadoTipo === "improcedente") {
      rows.push(`<div><div class="di-label">Motivo</div>${escapeHtml(enc.motivoImprocedente || "—")}</div>`);
      rows.push(`<div><div class="di-label">Cliente foi informado</div>${enc.clienteInformado === "sim" ? "Sim" : "Não"}</div>`);
    }
    if (enc.observacaoFinal) rows.push(`<div class="full"><div class="di-label">Observação</div>${escapeHtml(enc.observacaoFinal)}</div>`);
    return `
      <div class="detail-info-grid">
        <div><div class="di-label">Resultado</div>${escapeHtml((RESOLUCAO_CARDS.find(c => c.id === enc.resultadoTipo) || {}).label || TICKET_STATUS_MAP[t.status])}</div>
        ${rows.join("")}
      </div>
      <button class="btn ghost small" style="margin-top:10px;" id="btn-reopen-ticket">↩️ Reabrir atendimento</button>`;
  }
  return `
    <div class="detail-info-grid">
      <div><div class="di-label">Resultado</div>${TICKET_STATUS_MAP[t.status]}</div>
      <div><div class="di-label">Data de execução</div>${fmtDate(t.encerramento.dataExecucao)}</div>
      <div><div class="di-label">Responsável pela execução</div>${escapeHtml(t.encerramento.responsavelExecucao || "—")}</div>
      <div><div class="di-label">Validação do cliente</div>${escapeHtml((VALIDACAO_CLIENTE_OPTIONS.find(v => v.id === t.encerramento.validacaoCliente) || {}).label || "—")}</div>
      <div class="full"><div class="di-label">Solução registrada</div>${escapeHtml(t.encerramento.solucaoRegistrada || "—")}</div>
      <div class="full"><div class="di-label">Observação final</div>${escapeHtml(t.encerramento.observacaoFinal || "—")}</div>
    </div>
    <button class="btn ghost small" style="margin-top:10px;" id="btn-reopen-ticket">↩️ Reabrir atendimento</button>`;
}

function wireEncerramentoFechado(t) {
  document.getElementById("btn-reopen-ticket").addEventListener("click", () => {
    const oldStatus = t.status;
    t.status = "novo"; // sai do fechado antes de recalcular, senão o motor mantém o status fechado
    t.status = statusCalculadoPeloPlano(t);
    addHistoryEntry(t, "Chamado reaberto", "", oldStatus, t.status);
    persist();
    renderAll();
    goToTicketDetail(t.id);
    toast("Chamado reaberto.");
  });
}

function wireResolucaoAberta(t) {
  const panel = document.getElementById("resolucao-panel");
  if (!panel) return;
  document.querySelectorAll(".resolucao-card-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".resolucao-card-btn").forEach(b => b.classList.toggle("active", b === btn));
      const resultado = btn.dataset.resultado;

      if (resultado === "reparo_concluido") {
        const sisInformado = t.category || "Outros";
        let sisEscolha = "";
        panel.innerHTML = `
          <div class="sis-pergunta" id="sis-box">
            <h4>O problema era mesmo em <strong>${escapeHtml(sisInformado)}</strong>?</h4>
            <div class="sis-opcoes">
              <button type="button" class="sis-opcao" data-sis="sim">✓ Sim, era isso</button>
              <button type="button" class="sis-opcao" data-sis="nao">✗ Não, era outro sistema</button>
            </div>
            <div class="sis-detalhe" id="sis-detalhe"></div>
          </div>
          <div class="form-grid" style="margin-top:12px;">
            <div class="field"><label>Como foi resolvido?</label><select id="rc-como">${COMO_RESOLVIDO_OPTIONS.map(o => `<option value="${o.id}">${o.label}</option>`).join("")}</select></div>
            <div class="field full" id="rc-como-outro-field" style="display:none;"><label>Descreva</label><input type="text" id="rc-como-outro"></div>
            <div class="field"><label>Cliente confirmou a solução?</label><select id="rc-confirmou"><option value="sim">Sim</option><option value="nao">Não</option><option value="sem_contato">Não foi possível contato</option></select></div>
          </div>
          <button type="button" class="btn primary small" id="btn-finalizar-reparo-concluido" style="margin-top:10px;">✓ Finalizar chamado</button>`;
        document.getElementById("rc-como").addEventListener("change", (e) => {
          document.getElementById("rc-como-outro-field").style.display = e.target.value === "outro" ? "" : "none";
        });
        const detalhe = document.getElementById("sis-detalhe");
        const listaCausas = `<datalist id="sis-causas-list">${causasConhecidas().map(c => `<option value="${escapeHtml(c)}"></option>`).join("")}</datalist>`;
        document.querySelectorAll("#sis-box .sis-opcao").forEach(b => b.addEventListener("click", () => {
          sisEscolha = b.dataset.sis;
          document.getElementById("sis-box").classList.remove("sis-faltando");
          document.querySelectorAll("#sis-box .sis-opcao").forEach(x => x.classList.toggle("ativo", x === b));
          detalhe.innerHTML = sisEscolha === "nao" ? `
            <div class="form-grid">
              <div class="field"><label>Qual era o sistema real? *</label><select id="sis-real"><option value="">Escolha o sistema…</option>${CATEGORIES.filter(c => c !== sisInformado).map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}</select></div>
              <div class="field full"><label>Qual era a causa? *</label><input type="text" id="sis-causa" list="sis-causas-list" placeholder="Ex: falta de vedação da janela" autocomplete="off">${listaCausas}</div>
            </div>` : `
            <div class="form-grid">
              <div class="field full"><label>Causa / origem do problema (opcional)</label><input type="text" id="sis-causa" list="sis-causas-list" placeholder="Ex: registro com defeito" autocomplete="off">${listaCausas}</div>
            </div>`;
        }));
        document.getElementById("btn-finalizar-reparo-concluido").addEventListener("click", () => {
          const box = document.getElementById("sis-box");
          if (!sisEscolha) {
            box.classList.add("sis-faltando");
            box.scrollIntoView({ behavior: "smooth", block: "center" });
            toast("Responda se o problema era mesmo em " + sisInformado + ".", "error");
            return;
          }
          const sisRealSel = sisEscolha === "nao" ? document.getElementById("sis-real").value : sisInformado;
          const causaReal = (document.getElementById("sis-causa").value || "").trim();
          if (sisEscolha === "nao" && (!sisRealSel || !causaReal)) {
            box.classList.add("sis-faltando");
            toast("Informe o sistema real e a causa do problema.", "error");
            return;
          }
          const comoResolvido = document.getElementById("rc-como").value;
          const comoResolvidoOutro = document.getElementById("rc-como-outro").value.trim();
          const clienteConfirmou = document.getElementById("rc-confirmou").value;
          const ultimaExecucao = ultimaEtapaExecucaoConcluida(t);
          const oldStatus = t.status;
          t.encerramento = {
            ...blankEncerramento(),
            resultadoTipo: "reparo_concluido", comoResolvido, comoResolvidoOutro, clienteConfirmou,
            sistemaConfirmado: sisEscolha, sistemaReal: sisRealSel, causaReal,
            dataExecucao: ultimaExecucao ? ultimaExecucao.execucao.dataConclusao : "",
            responsavelExecucao: ultimaExecucao ? ultimaExecucao.atividade.responsavel : "",
          };
          t.status = "concluido";
          const comoLabel = (COMO_RESOLVIDO_OPTIONS.find(o => o.id === comoResolvido) || {}).label;
          const diag = sisEscolha === "nao"
            ? ` Diagnóstico corrigido: informado ${sisInformado}, real ${sisRealSel} — ${causaReal}.`
            : ` Sistema confirmado: ${sisInformado}${causaReal ? " — " + causaReal : ""}.`;
          addHistoryEntry(t, "Chamado encerrado", `Reparo concluído — ${comoResolvido === "outro" ? comoResolvidoOutro : comoLabel}.${diag}`, oldStatus, "concluido");
          persist(); renderAll(); goToTicketDetail(t.id);
          toast("Chamado encerrado.", "success");
        });
        return;
      }

      if (resultado === "reparo_parcial") {
        const etapas = t.plano || [];
        panel.innerHTML = `
          <div class="hint" style="margin:10px 0 6px;">Quais atividades foram concluídas?</div>
          <div class="checkbox-group" id="rp-etapas">
            ${etapas.length ? etapas.map(e => `<label class="checkbox-inline"><input type="checkbox" value="${e.id}" ${atividadeStatus(e) === "concluida" ? "checked" : ""}> ${escapeHtml(e.nome)}</label>`).join("") : '<span class="empty-hint">Nenhuma atividade cadastrada.</span>'}
          </div>
          <div class="form-grid" style="margin-top:10px;">
            <div class="field"><label>Data real da execução</label><input type="date" id="rp-data-real" value="${todayISODate()}" max="${todayISODate()}"></div>
            <div class="field full"><label>Por que não foi concluído?</label><input type="text" id="rp-motivo" placeholder="Ex: Aguardando secagem"></div>
          </div>
          <p class="hint">Data aplicada às atividades marcadas acima como concluídas agora. Mude só se elas já tiverem sido feitas antes.</p>
          <button type="button" class="btn primary small" id="btn-salvar-parcial" style="margin-top:10px;">Salvar e continuar atendimento</button>`;
        document.getElementById("btn-salvar-parcial").addEventListener("click", () => {
          const registro = todayISODate();
          const dataReal = document.getElementById("rp-data-real").value || registro;
          const motivo = document.getElementById("rp-motivo").value.trim();
          document.querySelectorAll("#rp-etapas input[type=checkbox]").forEach(chk => {
            const atividade = etapas.find(e => e.id === chk.value);
            if (atividade && chk.checked && atividadeStatus(atividade) !== "concluida") {
              const pendente = (atividade.execucoes || []).find(e => e.resultado === "pendente");
              const exec = pendente || { ...blankExecucao(), id: "exec" + Date.now() + Math.random().toString(36).slice(2, 6) };
              if (!pendente) atividade.execucoes.push(exec);
              exec.resultado = "realizada";
              exec.dataConclusao = dataReal;
              exec.registradoEm = registro;
              const nota = dataReal !== registro
                ? `"${atividade.nome}" registrada como concluída. Data real da execução informada: ${fmtDate(dataReal)}.`
                : `"${atividade.nome}" em ${fmtDate(dataReal)}.`;
              addHistoryEntry(t, "Execução concluída", nota);
            }
          });
          addHistoryEntry(t, "Reparo parcial registrado", motivo);
          persistTicket(t); renderAll(); goToTicketDetail(t.id);
          toast("Atendimento atualizado.", "success");
        });
        return;
      }

      if (resultado === "nao_solucionado") {
        panel.innerHTML = `
          <div class="form-grid" style="margin-top:10px;">
            <div class="field"><label>Motivo</label><select id="ns-motivo">${MOTIVOS_NAO_SOLUCIONADO.map(m => `<option value="${m}">${m}</option>`).join("")}</select></div>
            <div class="field full"><label>Observação</label><input type="text" id="ns-obs"></div>
          </div>
          <button type="button" class="btn primary small" id="btn-salvar-nao-solucionado" style="margin-top:10px;">Continuar atendimento</button>`;
        document.getElementById("btn-salvar-nao-solucionado").addEventListener("click", () => {
          const motivo = document.getElementById("ns-motivo").value;
          const obs = document.getElementById("ns-obs").value.trim();
          addHistoryEntry(t, "Chamado não solucionado", `${motivo}.${obs ? " " + obs : ""}`);
          persist(); renderAll(); goToTicketDetail(t.id);
          toast("Atendimento atualizado.");
        });
        return;
      }

      if (resultado === "improcedente") {
        panel.innerHTML = `
          <div class="form-grid" style="margin-top:10px;">
            <div class="field"><label>Motivo</label><select id="imp-motivo">${MOTIVOS_IMPROCEDENTE.map(m => `<option value="${m}">${m}</option>`).join("")}</select></div>
            <div class="field"><label>Cliente foi informado?</label><select id="imp-informado"><option value="sim">Sim</option><option value="nao">Não</option></select></div>
            <div class="field full"><label>Observação</label><input type="text" id="imp-obs"></div>
          </div>
          <button type="button" class="btn primary small" id="btn-salvar-improcedente" style="margin-top:10px;">Registrar e encerrar chamado</button>`;
        document.getElementById("btn-salvar-improcedente").addEventListener("click", () => {
          const motivo = document.getElementById("imp-motivo").value;
          const clienteInformado = document.getElementById("imp-informado").value;
          const obs = document.getElementById("imp-obs").value.trim();
          const oldStatus = t.status;
          t.encerramento = { ...blankEncerramento(), resultadoTipo: "improcedente", motivoImprocedente: motivo, clienteInformado, observacaoFinal: obs };
          t.status = "improcedente";
          addHistoryEntry(t, "Chamado encerrado", `Improcedente — ${motivo}.`, oldStatus, "improcedente");
          persist(); renderAll(); goToTicketDetail(t.id);
          toast("Chamado encerrado.", "success");
        });
        return;
      }

      if (resultado === "sem_necessidade") {
        panel.innerHTML = `
          <div class="form-grid" style="margin-top:10px;">
            <div class="field"><label>Motivo</label><select id="sn-motivo">${MOTIVOS_SEM_NECESSIDADE.map(m => `<option value="${m}">${m}</option>`).join("")}</select></div>
            <div class="field"><label>Cliente foi informado?</label><select id="sn-informado"><option value="sim">Sim</option><option value="nao">Não</option></select></div>
            <div class="field full"><label>Observação (opcional)</label><input type="text" id="sn-obs"></div>
          </div>
          <button type="button" class="btn primary small" id="btn-salvar-sem-necessidade" style="margin-top:10px;">Registrar e encerrar chamado</button>`;
        document.getElementById("btn-salvar-sem-necessidade").addEventListener("click", () => {
          const motivo = document.getElementById("sn-motivo").value;
          const clienteInformado = document.getElementById("sn-informado").value;
          const obs = document.getElementById("sn-obs").value.trim();
          const oldStatus = t.status;
          t.encerramento = { ...blankEncerramento(), resultadoTipo: "sem_necessidade", motivoSemNecessidade: motivo, clienteInformado, observacaoFinal: obs };
          t.status = "concluido";
          addHistoryEntry(t, "Chamado encerrado", `Sem necessidade de reparo — ${motivo}.`, oldStatus, "concluido");
          persist(); renderAll(); goToTicketDetail(t.id);
          toast("Chamado encerrado.", "success");
        });
        return;
      }
    });
  });
}

/* ---------- Pendência de obra → Pós-venda (migração ao concluir prédio) ---------- */

function migrateObraPendenciesToPosVenda(buildingId) {
  const pendencies = state.tickets.filter(t => t.buildingId === buildingId && t.type === "obra" && !CLOSED_STATUSES.includes(t.status));
  pendencies.forEach(t => {
    t.type = "posvenda";
    addHistoryEntry(t, "Migrado para pós-venda", "Empreendimento entregue — pendência de obra passou a ser acompanhada como chamado de pós-venda.");
  });
  return pendencies.length;
}

/* ---------- Documentos do chamado: Relatório de Atendimento ---------- */
/* Documento voltado ao cliente, gerado 100% a partir do que já está registrado
   no chamado — não é uma nova etapa de preenchimento. Fica claramente separado
   do Histórico interno (t.history), que continua completo e intocado; o
   relatório é uma leitura curada dele, nunca o histórico bruto. Mesmo padrão de
   versionamento/arquivamento em m.documentos já usado em js/modifications.js,
   só que numa lista própria (t.relatorios) por causa dos campos específicos de
   assinatura (assinadoEm/assinaturaAttachmentId). */

function renderDocumentosChamado(t) {
  const relatorios = t.relatorios || [];
  return `
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
      <button type="button" class="btn ghost small" id="btn-gerar-relatorio-preview">Gerar Relatório de Atendimento</button>
      <button type="button" class="btn primary small" id="btn-gerar-relatorio-assinatura">Gerar Relatório para Assinatura</button>
    </div>
    ${relatorios.length ? `
    <div class="table-wrap">
      <table class="mini-table">
        <thead><tr><th>Versão</th><th>Gerado em</th><th>Status</th><th>Arquivo</th><th></th></tr></thead>
        <tbody>${relatorios.slice().reverse().map(r => `<tr>
          <td>V${r.numero}</td>
          <td>${fmtDate(r.geradoEm.slice(0, 10))} ${new Date(r.geradoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
          <td><span class="badge ${r.status === "assinado" ? "outline" : ""}">${r.status === "assinado" ? "Assinado" : "Aguardando assinatura"}</span></td>
          <td><a href="#" data-open-attachment="${r.attachmentId}">${escapeHtml(r.fileName)}</a></td>
          <td>${r.status === "assinado"
            ? (r.assinaturaAttachmentId ? `<a href="#" data-open-attachment="${r.assinaturaAttachmentId}">Ver assinado</a>` : "")
            : `<button type="button" class="btn ghost small" data-anexar-relatorio="${r.id}">Anexar assinado</button>`}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>` : `<div class="empty-hint">Nenhum relatório gerado ainda.</div>`}
  `;
}

function wireDocumentosChamado(t) {
  document.getElementById("btn-gerar-relatorio-preview")?.addEventListener("click", () => gerarRelatorioAtendimentoPDF(t, false));
  document.getElementById("btn-gerar-relatorio-assinatura")?.addEventListener("click", () => gerarRelatorioAtendimentoPDF(t, true));
  document.querySelectorAll("[data-anexar-relatorio]").forEach(el => el.addEventListener("click", () => anexarRelatorioAssinado(t, el.dataset.anexarRelatorio)));
  document.querySelectorAll("[data-open-attachment]").forEach(el => el.addEventListener("click", async (e) => {
    e.preventDefault();
    const url = await getAttachmentUrl(el.dataset.openAttachment);
    if (url) window.open(url, "_blank");
  }));
}

/* Dimensão natural de uma imagem a partir do dataURL — usado pra escalar a foto
   no PDF sem distorcer (largura máxima fixa, altura proporcional). */
function loadImageDims(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}

/* Linha do tempo em linguagem simples pro cliente — nunca usa termos do sistema
   como "etapa concluída"/"ação"/"execução". Junta a abertura do chamado com
   cada item do Plano de Atendimento que já foi concluído, em ordem cronológica. */
function timelineAtendimentoCliente(t) {
  const linhas = [{ data: t.openedAt.slice(0, 10), texto: "Chamado registrado" + (t.title ? ": " + t.title : ".") }];
  (t.plano || []).forEach(a => {
    (a.execucoes || []).forEach(e => {
      if (e.resultado === "pendente") return; // só o que já aconteceu entra no relatório
      let texto = a.nome || "Atendimento realizado";
      if (e.resultado === "nao_realizada") texto += " — não realizado" + (e.observacao ? ": " + e.observacao : "");
      else if (e.observacao) texto += " — " + e.observacao;
      linhas.push({ data: e.dataConclusao || e.data || "", texto });
    });
  });
  return linhas.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
}

/* Texto de solução em linguagem de cliente, reaproveitando os mesmos campos que
   já alimentam renderEncerramentoFechado — nunca pede pra reescrever nada. */
function textoSolucaoCliente(t) {
  const enc = t.encerramento;
  if (enc.resultadoTipo) {
    const comoLabel = (COMO_RESOLVIDO_OPTIONS.find(o => o.id === enc.comoResolvido) || {}).label;
    const partes = [];
    if (enc.resultadoTipo === "reparo_concluido") {
      partes.push("Foi realizado o seguinte reparo: " + (enc.comoResolvido === "outro" ? (enc.comoResolvidoOutro || "reparo") : (comoLabel || "reparo")) + ".");
    } else if (enc.resultadoTipo === "sem_necessidade") {
      partes.push("Após avaliação, não foi identificada necessidade de reparo" + (enc.motivoSemNecessidade ? " (" + enc.motivoSemNecessidade + ")" : "") + ".");
    } else if (enc.resultadoTipo === "improcedente") {
      partes.push("O atendimento foi considerado improcedente" + (enc.motivoImprocedente ? " (" + enc.motivoImprocedente + ")" : "") + ".");
    } else if (enc.resultadoTipo === "nao_solucionado") {
      partes.push("O problema não foi solucionado neste atendimento" + (enc.motivoNaoSolucionado ? " (" + enc.motivoNaoSolucionado + ")" : "") + ".");
    } else {
      partes.push((RESOLUCAO_CARDS.find(c => c.id === enc.resultadoTipo) || {}).label || "");
    }
    if (enc.observacaoFinal) partes.push(enc.observacaoFinal);
    return partes.join(" ");
  }
  if (t.analiseTecnica.solucaoExecutada) return t.analiseTecnica.solucaoExecutada;
  if (enc.solucaoRegistrada) return enc.solucaoRegistrada;
  return "";
}

/* Rótulo do resultado final, mesma fonte usada internamente (RESOLUCAO_CARDS /
   status do chamado), só que sem termos técnicos de sistema. */
function resultadoFinalCliente(t) {
  const enc = t.encerramento;
  if (enc.resultadoTipo) return (RESOLUCAO_CARDS.find(c => c.id === enc.resultadoTipo) || {}).label || TICKET_STATUS_MAP[t.status];
  if (CLOSED_STATUSES.includes(t.status)) return TICKET_STATUS_MAP[t.status];
  return "Atendimento em andamento — " + TICKET_STATUS_MAP[t.status];
}

async function gerarRelatorioAtendimentoPDF(t, arquivar) {
  if (!window.jspdf) { toast("Biblioteca de PDF não carregada.", "error"); return; }
  const b = getBuilding(t.buildingId);
  const principal = fornecedorPrincipal(t);
  const fotosIniciais = fotosChamadoPorMomento(t, "inicial");
  const fotosFinais = fotosChamadoPorMomento(t, "final");
  const temFotos = fotosIniciais.length || fotosFinais.length;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 15;
  let y = 20;
  let secao = 0;

  function checkBreak(alturaNecessaria) {
    if (y + alturaNecessaria > pageHeight - 18) { doc.addPage(); y = 20; }
  }
  function tituloSecao(texto) {
    secao++;
    checkBreak(12);
    doc.setFont(undefined, "bold"); doc.setFontSize(11.5); doc.setTextColor(16, 32, 61);
    doc.text(`${secao}. ${texto}`, marginX, y); y += 7;
    doc.setDrawColor(220); doc.line(marginX, y - 4, pageWidth - marginX, y - 4);
  }
  function paragrafo(texto, opts) {
    doc.setFont(undefined, (opts && opts.bold) ? "bold" : "normal"); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    const linhas = doc.splitTextToSize(String(texto || "—"), pageWidth - marginX * 2);
    checkBreak(linhas.length * 5 + 2);
    doc.text(linhas, marginX, y);
    y += linhas.length * 5 + 3;
  }
  function campo(label, valor) {
    checkBreak(6);
    doc.setFont(undefined, "bold"); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    doc.text(label + ":", marginX, y);
    doc.setFont(undefined, "normal");
    const linhas = doc.splitTextToSize(String(valor || "—"), pageWidth - marginX - 62);
    doc.text(linhas, marginX + 47, y);
    y += Math.max(6, linhas.length * 5);
  }

  doc.setFont(undefined, "bold"); doc.setFontSize(14); doc.setTextColor(16, 32, 61);
  doc.text("RELATÓRIO DE ATENDIMENTO", pageWidth / 2, y, { align: "center" }); y += 6;
  doc.setFont(undefined, "normal"); doc.setFontSize(10); doc.setTextColor(110, 110, 110);
  doc.text("Pós-venda — " + (b ? b.name : "—"), pageWidth / 2, y, { align: "center" }); y += 12;

  tituloSecao("Identificação");
  campo("Empreendimento", b ? b.name : "—");
  campo("Unidade", t.unit);
  campo("Cliente", t.requesterName || "—");
  campo("Chamado", t.id);
  campo("Data de abertura", fmtDate(t.openedAt.slice(0, 10)));
  y += 4;

  tituloSecao("Solicitação");
  paragrafo(t.descricaoSolicitacao || t.analiseTecnica.problemaRelatado || "—");
  if (t.ambientes && t.ambientes.length) campo("Ambiente(s)", t.ambientes.join(", "));
  y += 2;

  tituloSecao("Atendimento realizado");
  timelineAtendimentoCliente(t).forEach(item => {
    checkBreak(6);
    doc.setFont(undefined, "bold"); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    doc.text(item.data ? fmtDate(item.data) : "—", marginX, y);
    doc.setFont(undefined, "normal");
    const linhas = doc.splitTextToSize(item.texto, pageWidth - marginX - 32);
    doc.text(linhas, marginX + 27, y);
    y += Math.max(6, linhas.length * 5);
  });
  y += 2;

  tituloSecao("Solução");
  paragrafo(textoSolucaoCliente(t) || "Atendimento ainda em andamento.");
  y += 2;

  if (principal) {
    tituloSecao("Fornecedor");
    campo("Fornecedor", supplierDisplayName(principal.supplier));
    campo("Serviço realizado", principal.link.servico || "—");
    y += 2;
  }

  if (temFotos) {
    tituloSecao("Registro fotográfico");
    const larguraFoto = (pageWidth - marginX * 2 - 6) / 2;
    for (const [label, lista] of [["Foto inicial", fotosIniciais], ["Foto final", fotosFinais]]) {
      if (!lista.length) continue;
      const anexo = lista[0];
      const rec = await getAttachment(anexo.attachmentId);
      if (!rec || !rec.blob) continue;
      const base64 = await blobToBase64(rec.blob);
      const dataUrl = `data:${rec.type};base64,${base64}`;
      const dims = await loadImageDims(dataUrl);
      const alturaFoto = dims.width ? Math.min(larguraFoto * (dims.height / dims.width), 90) : 60;
      checkBreak(alturaFoto + 12);
      doc.setFont(undefined, "bold"); doc.setFontSize(9.5); doc.setTextColor(40, 40, 40);
      doc.text(label, marginX, y); y += 4;
      try {
        const formato = /png/i.test(rec.type) ? "PNG" : "JPEG";
        doc.addImage(dataUrl, formato, marginX, y, larguraFoto, alturaFoto);
      } catch (err) { /* formato não suportado — segue sem travar o relatório */ }
      y += alturaFoto + 8;
    }
    y += 2;
  }

  tituloSecao("Resultado");
  paragrafo(resultadoFinalCliente(t), { bold: true });
  y += 4;

  tituloSecao("Ciência do cliente");
  paragrafo("Declaro que acompanhei o atendimento descrito neste relatório e que fui informado sobre os serviços realizados.");
  y += 10;
  checkBreak(30);
  doc.setFont(undefined, "normal"); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
  doc.text("Cliente: " + (t.requesterName || "_______________________________________"), marginX, y); y += 10;
  doc.text("Data: ___/___/______", marginX, y); y += 10;
  doc.text("Assinatura: _______________________________________", marginX, y); y += 6;

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont(undefined, "normal"); doc.setFontSize(8.5); doc.setTextColor(140, 140, 140);
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - marginX, pageHeight - 10, { align: "right" });
    doc.text(`Chamado ${t.id} — gerado em ${new Date().toLocaleDateString("pt-BR")}`, marginX, pageHeight - 10);
  }

  const numero = (t.relatorios || []).length + 1;
  const fileName = `Relatorio-Atendimento-${t.id}-V${numero}.pdf`;

  if (!arquivar) {
    doc.save(fileName);
    toast("Relatório gerado.", "success");
    return;
  }

  const blob = doc.output("blob");
  const file = new File([blob], fileName, { type: "application/pdf" });
  const attachmentId = await saveAttachment(file);
  t.relatorios.push({
    id: "rel" + Date.now() + Math.random().toString(36).slice(2, 6),
    numero, geradoEm: new Date().toISOString(), attachmentId, fileName,
    status: "aguardando_assinatura", assinadoEm: "", assinaturaAttachmentId: "",
  });
  addHistoryEntry(t, "Relatório de atendimento gerado (V" + numero + ")", "");
  persist();
  doc.save(fileName);
  toast("Relatório gerado e arquivado no chamado.", "success");
  goToTicketDetail(t.id);
}

/* A assinatura anexada É a confirmação — mesmo espírito do termo de aprovação
   de modificações: uma ação só faz tudo (anexa e marca "Assinado"). */
function anexarRelatorioAssinado(t, relatorioId) {
  const rel = (t.relatorios || []).find(r => r.id === relatorioId);
  if (!rel) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/pdf,image/*";
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    const attachmentId = await saveAttachment(file);
    rel.status = "assinado";
    rel.assinadoEm = new Date().toISOString();
    rel.assinaturaAttachmentId = attachmentId;
    addHistoryEntry(t, "Relatório de atendimento assinado (V" + rel.numero + ")", "");
    persist();
    toast("Relatório assinado anexado.", "success");
    goToTicketDetail(t.id);
  });
  input.click();
}
