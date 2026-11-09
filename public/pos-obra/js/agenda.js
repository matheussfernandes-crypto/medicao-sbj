/* ---------- Agenda ---------- */
/* Lente sobre as etapas do Plano de Atendimento de todos os chamados — não é
   uma tela de edição paralela, nem guarda dado próprio. Clicar num evento leva
   direto pra ficha do chamado; a etapa continua sendo criada/editada só em
   openEtapaModal (js/tickets.js). Como renderAgenda() roda dentro de
   renderAll() (chamado depois de qualquer mutação de etapa), a Agenda já
   atualiza sozinha quando data/horário mudam no chamado — não precisa de
   nenhuma sincronização extra. */

let agendaViewMode = (window.matchMedia && window.matchMedia("(max-width: 720px)").matches) ? "dia" : "semana"; // "dia" | "semana" | "mes" (no celular, começa no dia)
/* Fica vazio até a primeira renderização de verdade — não dá pra chamar
   todayISODate() aqui em cima porque agenda.js carrega antes de app.js
   (onde ela é definida); qualquer chamada no nível do módulo quebraria. */
let agendaAnchorDate = "";

const AGENDA_HORA_MIN_PADRAO = 7;
const AGENDA_HORA_MAX_PADRAO = 19;
const AGENDA_ALTURA_LINHA = 56; // px por hora na grade

/* Cor por responsável só pra bater o olho na grade (quem está onde) — paleta
   nova, fixa, não usa/mexe nas cores de status ou prioridade. */
const AGENDA_RESPONSAVEL_CORES = ["#2f6fed", "#e8862c", "#0d9488", "#9b51e0", "#e2504a", "#0891b2", "#64748b", "#c2410c"];
function corDoResponsavel(nome) {
  if (!nome) return AGENDA_RESPONSAVEL_CORES[AGENDA_RESPONSAVEL_CORES.length - 1];
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
  return AGENDA_RESPONSAVEL_CORES[hash % AGENDA_RESPONSAVEL_CORES.length];
}

/* Título do evento na agenda é sempre Unidade + Empreendimento curto +
   Responsável — nunca o nome da etapa (isso vira "Atividade", visível só ao
   abrir o evento). Mantém a agenda como visualização rápida, no padrão
   Google Agenda, independente de qual etapa do Plano gerou o compromisso. */
function nomeCurtoEmpreendimento(nomeCompleto) {
  return (nomeCompleto || "")
    .replace(/^residencial\s+/i, "")
    .replace(/^ilha\s+(do|da|de|dos|das)\s+/i, "")
    .trim();
}
function primeiroNome(nomeCompleto) {
  return (nomeCompleto || "").trim().split(/\s+/)[0] || "";
}
function tituloEventoAgenda(x) {
  const partes = [
    x.ticket.unit || "",
    x.building ? nomeCurtoEmpreendimento(x.building.name) : "",
    primeiroNome(x.atividade.responsavel),
  ].filter(Boolean);
  return partes.join(" ") || (x.atividade.nome || "(sem nome)");
}

/* Achata TODO chamado -> atividade -> execução num só nível — cada execução é
   seu próprio evento na Agenda (uma atividade com 5 execuções aparece como 5
   compromissos, não 1). */
function collectAllExecucoes() {
  const out = [];
  state.tickets.forEach(t => {
    (t.plano || []).forEach(atividade => {
      (atividade.execucoes || []).forEach(execucao => {
        out.push({ execucao, atividade, ticket: t, building: getBuilding(t.buildingId) });
      });
    });
  });
  return out;
}

function startOfWeekISO(d) {
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return toISODateString(monday);
}
function endOfWeekISO(d) {
  const day = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() + (7 - ((day + 6) % 7) - 1));
  return toISODateString(sunday);
}
function addDaysISO(iso, n) {
  const d = toLocalDate(iso);
  d.setDate(d.getDate() + n);
  return toISODateString(d);
}
function addMonthsISO(iso, n) {
  const d = toLocalDate(iso);
  d.setMonth(d.getMonth() + n);
  return toISODateString(d);
}

/* Uma execução só vira evento de agenda quando tem data E horário reais — é
   assim que "Acionar fornecedor", "Cobrar fornecedor", "Retorno do
   fornecedor" e "Solicitar orçamento" (que nascem já realizadas, sem
   data/horário) ficam de fora automaticamente, sem precisar de lista de
   nomes proibidos. Execução de atividade cancelada também não aparece. */
function agendaEventos(filters) {
  const operator = getOperatorName().trim().toLowerCase();
  let items = collectAllExecucoes().filter(x => x.execucao.data && x.execucao.horario && !x.atividade.cancelada);
  if (filters.building) items = items.filter(x => x.ticket.buildingId === filters.building);
  if (filters.responsavel) items = items.filter(x => x.atividade.responsavel === filters.responsavel);
  if (filters.supplier) items = items.filter(x => x.atividade.supplierId === filters.supplier);
  if (filters.tipo) items = items.filter(x => x.ticket.type === filters.tipo);
  if (filters.status) items = items.filter(x => execucaoEffectiveStatus(x.execucao) === filters.status);
  if (filters.minhaAgenda) items = items.filter(x => operator && (x.atividade.responsavel || "").trim().toLowerCase() === operator);
  return items;
}

/* Mesmo responsável + mesma data + mesmo horário exato = conflito (é o
   próprio exemplo do pedido, 08:00 vs 08:00). execucaoIdExcluir evita que
   reagendar/adicionar uma execução acuse conflito com ela mesma. */
function execucaoConflitante(data, horario, responsavel, execucaoIdExcluir) {
  if (!data || !horario || !responsavel) return null;
  const alvo = responsavel.trim().toLowerCase();
  if (!alvo) return null;
  return collectAllExecucoes().find(x =>
    x.execucao.id !== execucaoIdExcluir && !x.atividade.cancelada &&
    x.execucao.data === data && x.execucao.horario === horario &&
    (x.atividade.responsavel || "").trim().toLowerCase() === alvo
  ) || null;
}

function populateAgendaFilterSelects() {
  const bSel = document.getElementById("filter-agenda-building");
  if (!bSel) return;
  const currentB = bSel.value;
  bSel.innerHTML = `<option value="">Todos os empreendimentos</option>` + state.buildings.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");
  bSel.value = currentB;

  const rSel = document.getElementById("filter-agenda-responsavel");
  const currentR = rSel.value;
  rSel.innerHTML = `<option value="">Todos os responsáveis</option>` + (state.teamEtapas || []).map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  rSel.value = currentR;

  const fSel = document.getElementById("filter-agenda-fornecedor");
  const currentF = fSel.value;
  fSel.innerHTML = `<option value="">Todos os fornecedores</option>` + state.suppliers.map(s => `<option value="${s.id}">${escapeHtml(supplierDisplayName(s))}</option>`).join("");
  fSel.value = currentF;
}

function currentAgendaFilters() {
  return {
    building: document.getElementById("filter-agenda-building")?.value || "",
    responsavel: document.getElementById("filter-agenda-responsavel")?.value || "",
    supplier: document.getElementById("filter-agenda-fornecedor")?.value || "",
    tipo: document.getElementById("filter-agenda-tipo")?.value || "",
    status: document.getElementById("filter-agenda-status")?.value || "",
    minhaAgenda: document.getElementById("filter-agenda-minha")?.checked || false,
  };
}

/* ---------- Rótulo e navegação do período ---------- */

const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function agendaPeriodoLabel() {
  const anchor = toLocalDate(agendaAnchorDate);
  if (agendaViewMode === "dia") return `${anchor.getDate()} de ${MESES_PT[anchor.getMonth()]} de ${anchor.getFullYear()}`;
  if (agendaViewMode === "mes") return `${MESES_PT[anchor.getMonth()][0].toUpperCase()}${MESES_PT[anchor.getMonth()].slice(1)} de ${anchor.getFullYear()}`;
  const inicio = toLocalDate(startOfWeekISO(anchor));
  const fim = toLocalDate(endOfWeekISO(anchor));
  const mesmoMes = inicio.getMonth() === fim.getMonth();
  return mesmoMes
    ? `${inicio.getDate()}–${fim.getDate()} de ${MESES_PT[fim.getMonth()]} de ${fim.getFullYear()}`
    : `${inicio.getDate()} de ${MESES_PT[inicio.getMonth()]} – ${fim.getDate()} de ${MESES_PT[fim.getMonth()]} de ${fim.getFullYear()}`;
}

function agendaIrParaHoje() { agendaAnchorDate = todayISODate(); renderAgenda(); }
function agendaAnterior() {
  if (agendaViewMode === "dia") agendaAnchorDate = addDaysISO(agendaAnchorDate, -1);
  else if (agendaViewMode === "mes") agendaAnchorDate = addMonthsISO(agendaAnchorDate, -1);
  else agendaAnchorDate = addDaysISO(agendaAnchorDate, -7);
  renderAgenda();
}
function agendaProxima() {
  if (agendaViewMode === "dia") agendaAnchorDate = addDaysISO(agendaAnchorDate, 1);
  else if (agendaViewMode === "mes") agendaAnchorDate = addMonthsISO(agendaAnchorDate, 1);
  else agendaAnchorDate = addDaysISO(agendaAnchorDate, 7);
  renderAgenda();
}
function agendaSetViewMode(mode) { agendaViewMode = mode; renderAgenda(); }

/* ---------- Render ---------- */

function renderAgenda() {
  if (!agendaAnchorDate) agendaAnchorDate = todayISODate();
  const root = document.getElementById("agenda-grid-root");
  if (!root) return;

  const label = document.getElementById("agenda-periodo-label");
  if (label) label.textContent = agendaPeriodoLabel();
  document.querySelectorAll("#agenda-view-mode .chip").forEach(c => c.classList.toggle("active", c.dataset.mode === agendaViewMode));

  const filters = currentAgendaFilters();
  const eventos = agendaEventos(filters);

  if (agendaViewMode === "mes") {
    root.innerHTML = renderAgendaMes(eventos);
  } else {
    const dates = agendaViewMode === "dia" ? [agendaAnchorDate] : diasDaSemana(agendaAnchorDate);
    root.innerHTML = renderAgendaGrid(dates, eventos);
  }
  wireAgendaEventClicks(root);
}

function diasDaSemana(anchorIso) {
  const inicio = startOfWeekISO(toLocalDate(anchorIso));
  return Array.from({ length: 7 }, (_, i) => addDaysISO(inicio, i));
}

function wireAgendaEventClicks(root) {
  root.querySelectorAll("[data-open-agenda-evento]").forEach(el => {
    el.addEventListener("click", () => {
      const [ticketId, atividadeId, execucaoId] = el.dataset.openAgendaEvento.split("|");
      abrirDetalheEventoAgenda(ticketId, atividadeId, execucaoId);
    });
  });
}

/* Clicar num evento não pula direto pro chamado — mostra primeiro um resumo
   rápido (padrão Google Agenda: clicar no evento abre um preview, não a
   página inteira). "Abrir chamado" leva pra ficha completa (e já abre direto
   na atividade correspondente). */
function abrirDetalheEventoAgenda(ticketId, atividadeId, execucaoId) {
  const t = getTicket(ticketId);
  if (!t) return;
  const atividade = (t.plano || []).find(a => a.id === atividadeId);
  if (!atividade) return;
  const execucao = (atividade.execucoes || []).find(e => e.id === execucaoId);
  if (!execucao) return;
  const b = getBuilding(t.buildingId);
  const supplier = atividade.supplierId ? getSupplier(atividade.supplierId) : null;
  const x = { execucao, atividade, ticket: t, building: b };

  openModal(`
    <div class="modal-header">
      <h2>${escapeHtml(tituloEventoAgenda(x))}</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <div class="detail-info-grid">
        <div><div class="di-label">Data</div>${fmtDate(execucao.data)}</div>
        <div><div class="di-label">Horário</div>${escapeHtml(execucao.horario || "—")}</div>
        <div class="full"><div class="di-label">Atividade</div>${escapeHtml(atividade.nome || "—")}</div>
        <div><div class="di-label">Chamado</div>${t.id}${t.code ? " · " + escapeHtml(t.code) : ""}</div>
        <div><div class="di-label">Responsável</div>${escapeHtml(atividade.responsavel || "—")}</div>
        <div><div class="di-label">Empreendimento</div>${b ? escapeHtml(b.name) : "—"}</div>
        <div><div class="di-label">Unidade</div>${escapeHtml(t.unit || "—")}</div>
        ${supplier ? `<div><div class="di-label">Fornecedor</div>${escapeHtml(supplierDisplayName(supplier))}</div>` : ""}
        <div><div class="di-label">Sistema</div>${escapeHtml(t.category || "—")}</div>
        ${atividade.acessoUnidade === "sim" ? `<div><div class="di-label">Acesso à unidade</div>${atividade.clientePresente === "sim" ? "Necessário · cliente presente" : "Necessário · cliente ausente"}</div>` : ""}
        ${atividade.observacoes ? `<div class="full"><div class="di-label">Observações</div>${escapeHtml(atividade.observacoes)}</div>` : ""}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn ghost" data-close>Fechar</button>
      <button class="btn primary" id="btn-abrir-chamado-agenda">Abrir chamado</button>
    </div>
  `);
  wireModalClose();
  document.getElementById("btn-abrir-chamado-agenda").addEventListener("click", () => {
    closeModal();
    goToTicketDetail(t.id);
  });
}

const DIAS_SEMANA_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/* Grade de horários — usada tanto pra Dia (1 coluna) quanto Semana (7
   colunas). Intervalo de horas se expande automaticamente se algum evento
   ficar fora do padrão 07h–19h, nunca corta um compromisso real. */
function renderAgendaGrid(dates, eventos) {
  const today = todayISODate();
  const porDia = {};
  dates.forEach(d => porDia[d] = []);
  eventos.forEach(x => { if (porDia[x.execucao.data]) porDia[x.execucao.data].push(x); });

  let horaMin = AGENDA_HORA_MIN_PADRAO, horaMax = AGENDA_HORA_MAX_PADRAO;
  eventos.forEach(x => {
    const h = parseInt((x.execucao.horario || "0").split(":")[0], 10);
    if (!isNaN(h)) { horaMin = Math.min(horaMin, h); horaMax = Math.max(horaMax, h + 1); }
  });
  const totalHoras = horaMax - horaMin;

  const horasHTML = Array.from({ length: totalHoras }, (_, i) => {
    const h = horaMin + i;
    return `<div class="agenda-hora-label" style="height:${AGENDA_ALTURA_LINHA}px;">${String(h).padStart(2, "0")}:00</div>`;
  }).join("");

  const colunas = dates.map(iso => {
    const d = toLocalDate(iso);
    const isHoje = iso === today;
    const linhasBg = Array.from({ length: totalHoras }, () => `<div class="agenda-linha-hora" style="height:${AGENDA_ALTURA_LINHA}px;"></div>`).join("");
    const grupos = agruparConflitos(porDia[iso] || []);
    const eventosHTML = grupos.map(grupo => grupo.map((x, i) => {
      const [hh, mm] = x.execucao.horario.split(":").map(Number);
      const top = (hh - horaMin) * AGENDA_ALTURA_LINHA + (mm / 60) * AGENDA_ALTURA_LINHA;
      const largura = 100 / grupo.length;
      const esquerda = largura * i;
      const cor = corDoResponsavel(x.atividade.responsavel);
      return `
      <div class="agenda-evento" data-open-agenda-evento="${x.ticket.id}|${x.atividade.id}|${x.execucao.id}"
           style="top:${top}px; height:${AGENDA_ALTURA_LINHA - 4}px; left:calc(${esquerda}% + 2px); width:calc(${largura}% - 4px); border-left-color:${cor};">
        <div class="agenda-evento-titulo">${escapeHtml(tituloEventoAgenda(x))}</div>
        <div class="agenda-evento-sub">${x.execucao.horario}</div>
      </div>`;
    }).join("")).join("");
    return `
    <div class="agenda-coluna-dia">
      <div class="agenda-coluna-header ${isHoje ? "hoje" : ""}">${DIAS_SEMANA_ABREV[d.getDay()]} <strong>${d.getDate()}</strong></div>
      <div class="agenda-coluna-corpo" style="height:${totalHoras * AGENDA_ALTURA_LINHA}px;">
        ${linhasBg}
        ${eventosHTML}
      </div>
    </div>`;
  }).join("");

  return `
  <div class="agenda-grid ${dates.length === 1 ? "agenda-grid-dia" : ""}">
    <div class="agenda-coluna-horas">
      <div class="agenda-coluna-header">&nbsp;</div>
      ${horasHTML}
    </div>
    ${colunas}
  </div>`;
}

/* Agrupa eventos do mesmo dia que colidem (mesmo horário exato) pra
   desenhar lado a lado, como no Google Agenda. */
function agruparConflitos(lista) {
  const porHorario = {};
  lista.forEach(x => { (porHorario[x.execucao.horario] = porHorario[x.execucao.horario] || []).push(x); });
  return Object.values(porHorario);
}

function renderAgendaMes(eventos) {
  const anchor = toLocalDate(agendaAnchorDate);
  const primeiroDoMes = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const inicioGrade = toLocalDate(startOfWeekISO(primeiroDoMes));
  const today = todayISODate();

  const porDia = {};
  eventos.forEach(x => { (porDia[x.execucao.data] = porDia[x.execucao.data] || []).push(x); });

  const celulas = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicioGrade);
    d.setDate(inicioGrade.getDate() + i);
    const iso = toISODateString(d);
    const foraDoMes = d.getMonth() !== anchor.getMonth();
    const doDia = (porDia[iso] || []).sort((a, b) => a.execucao.horario.localeCompare(b.execucao.horario));
    const visiveis = doDia.slice(0, 3);
    const resto = doDia.length - visiveis.length;
    return `
    <div class="agenda-mes-celula ${foraDoMes ? "fora-do-mes" : ""} ${iso === today ? "hoje" : ""}">
      <div class="agenda-mes-numero">${d.getDate()}</div>
      ${visiveis.map(x => `
        <div class="agenda-mes-pilula" data-open-agenda-evento="${x.ticket.id}|${x.atividade.id}|${x.execucao.id}" style="border-left-color:${corDoResponsavel(x.atividade.responsavel)};">
          ${x.execucao.horario} ${escapeHtml(tituloEventoAgenda(x))}
        </div>`).join("")}
      ${resto > 0 ? `<div class="agenda-mes-mais">+${resto} mais</div>` : ""}
    </div>`;
  }).join("");

  return `
  <div class="agenda-mes-semana-header">${DIAS_SEMANA_ABREV.map(d => `<div>${d}</div>`).join("")}</div>
  <div class="agenda-mes-grid">${celulas}</div>`;
}
