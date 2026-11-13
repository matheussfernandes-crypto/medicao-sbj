/* ---------- Estado ---------- */
let state = loadData();

function persist() { saveData(state); }

function getBuilding(id) { return state.buildings.find(b => b.id === id); }
function getTicket(id) { return state.tickets.find(t => t.id === id); }
function getClient(id) { return state.clients.find(c => c.id === id); }
function nextClientId() { return "c" + (state.clientSeq++); }

/* ---------- Utilitários ---------- */
/* Datas "YYYY-MM-DD" (sem hora) precisam ser lidas como data local, senão o fuso
   horário (ex: UTC-3) faz o dia aparecer um a menos do que o cadastrado. */
function toLocalDate(iso) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(iso);
}
function fmtDate(iso) {
  if (!iso) return "—";
  return toLocalDate(iso).toLocaleDateString("pt-BR");
}
function toISODateString(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function todayISODate() { return toISODateString(new Date()); }
function daysDiff(fromISO, toISO) {
  const a = new Date(fromISO); const b = new Date(toISO);
  return Math.round((b - a) / 86400000);
}
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function nextTicketCode() {
  const code = "OS-" + String(state.ticketSeq).padStart(4, "0");
  state.ticketSeq++;
  return code;
}
function toast(msg, type = "") {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = "toast" + (type ? " " + type : "");
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ---------- Modal helpers ---------- */
function openModal(html, wide = false) {
  const root = document.getElementById("modal-root");
  document.body.classList.add("modal-aberto");
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay"><div class="modal ${wide ? "wide" : ""}">${html}</div></div>`;
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeModal();
  });
}
function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
  document.body.classList.remove("modal-aberto");
}

/* ---------- Navegação ---------- */
const viewTitles = {
  dashboard: ["Painel Geral", "O que precisa da sua atenção hoje"],
  buildings: ["Empreendimentos", "Prédios concluídos e em andamento"],
  clients: ["Clientes", "Proprietários cadastrados por unidade"],
  suppliers: ["Fornecedores", "Cadastro mestre de fornecedores e prestadores"],
  tickets: ["Chamados", "Cadastro, status e acompanhamento das solicitações"],
  agenda: ["Agenda", "Etapas do Plano de Atendimento de todos os chamados, por data"],
  vistorias: ["Vistorias", "Pendências da entrega dos apartamentos, por ambiente"],
  vtagenda: ["Agenda", "Vistorias de entrega marcadas, por dia"],
  modifications: ["Modificações", "Solicitações de modificação de apartamento, da análise à finalização"],
  reports: ["Relatórios", "Por empreendimento, painel gerencial e exportação para Excel"],
};

/* A busca do topo só aparece onde ela filtra alguma coisa, com o texto da tela. */
const BUSCA_POR_TELA = {
  tickets: "Buscar chamado (nº, prédio, unidade)...",
  clients: "Buscar cliente, unidade, telefone ou prédio...",
  suppliers: "Buscar fornecedor...",
};
let buscaTela = "";
function atualizarBuscaDoTopo(name) {
  const box = document.getElementById("global-search-box");
  const input = document.getElementById("global-search");
  const ph = BUSCA_POR_TELA[name];
  box.hidden = !ph;
  if (!ph) return;
  input.placeholder = ph;
  if (buscaTela !== name) { input.value = ""; buscaTela = name; }
}

function showView(name) {
  atualizarBuscaDoTopo(name);
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  const bt = document.getElementById("btn-new-ticket"); if (bt) bt.style.display = (name === "dashboard" || name === "tickets") ? "" : "none";
  const bm = document.getElementById("btn-new-modification"); if (bm) bm.style.display = name === "modifications" ? "" : "none";
  document.getElementById("view-title").textContent = viewTitles[name][0];
  document.getElementById("view-subtitle").textContent = viewTitles[name][1];
  renderAll();
}

/* ---------- Render: Dashboard ---------- */
function ticketClosedAt(t) { return CLOSED_STATUSES.includes(t.status) ? (t.encerramento?.dataExecucao || t.history[t.history.length - 1]?.date.slice(0, 10)) : null; }

function renderDashboard() {
  const tickets = state.tickets;
  const openTickets = tickets.filter(t => OPEN_STATUSES.includes(t.status));
  const andamentoTickets = openTickets.filter(t => t.status !== "novo");
  const atrasadosTickets = tickets.filter(isAcompanhamentoPendente);
  const hojeTickets = tickets.filter(isActionToday);
  const fornecedorCount = tickets.filter(t => t.status === "aguardando_fornecedor").length;
  const clienteCount = tickets.filter(t => t.status === "aguardando_cliente").length;

  const hojeISO = todayISODate();
  const semana = tickets.filter(t => CLOSED_STATUSES.includes(t.status) && (ticketClosedAt(t) || "") >= toISODateString(new Date(Date.now() - 30 * 86400000))).length;
  const tiles = [
    { label: "Atrasados", value: atrasadosTickets.length, kind: "atrasados", tom: atrasadosTickets.length ? "ruim" : "bom", dica: atrasadosTickets.length ? "pedem ação agora" : "tudo em dia" },
    { label: "Para hoje", value: hojeTickets.length, kind: "hoje", tom: hojeTickets.length ? "aten" : "", dica: "visitas e serviços" },
    { label: "Abertos", value: openTickets.length, kind: "abertos", dica: `${andamentoTickets.length} em andamento` },
    { label: "Com fornecedor", value: fornecedorCount, status: "aguardando_fornecedor", dica: "aguardando retorno" },
    { label: "Com o cliente", value: clienteCount, status: "aguardando_cliente", dica: "aguardando resposta" },
    { label: "Concluídos", value: semana, kind: "concluidos", tom: "bom-suave", dica: "nos últimos 30 dias" },
  ];
  const glance = document.getElementById("dash-glance");
  if (glance) {
    glance.innerHTML = tiles.map(k => `
      <button type="button" class="gl-tile ${k.tom || ""}" data-quick-filter="${k.kind || ""}" data-status-filter="${k.status || ""}">
        <span class="gl-valor">${k.value}</span>
        <span class="gl-rotulo">${k.label}</span>
        <span class="gl-dica">${k.dica}</span>
      </button>`).join("");
    glance.querySelectorAll(".gl-tile").forEach(card => card.addEventListener("click", () => abrirChamadosComFiltro(card.dataset.quickFilter || null, card.dataset.statusFilter || null)));
  }
  renderModificationsHomeKpis();
  renderAtencaoList();
  renderAgendaHojeHome();
  renderFornecedorAtencaoHome();
}

/* ---------- "Precisa da minha atenção" — um motivo por chamado, o mais
   urgente primeiro. Nenhum campo novo além de clienteAguardando (aprovado). */
function motivoAcaoEtapa(nome) {
  if (nome === "Realizar reparo") return "REALIZAR REPARO";
  if (nome === "Conferir reparo") return "CONFERIR REPARO";
  if (nome === "Realizar vistoria") return "REALIZAR VISTORIA";
  return "VERIFICAR PRAZO";
}
function motivoAtencaoDoChamado(t, hoje) {
  const b = getBuilding(t.buildingId);
  const local = `${b ? b.name : "—"}${t.unit ? " / " + t.unit : ""}`;

  const linkSemRetorno = (t.fornecedores || []).find(f => isFornecedorSemRetorno(t, f));
  if (linkSemRetorno) {
    const dias = Math.max(0, daysDiff(linkSemRetorno.dataAcionamento, hoje));
    return { t, local, motivo: `Fornecedor sem retorno há ${dias} dia${dias === 1 ? "" : "s"}`, dias, acaoLabel: "COBRAR FORNECEDOR", acaoDireta: () => cobrarFornecedor(t, linkSemRetorno) };
  }

  /* proxStatus vem da mesma atividadeStatus() usada no badge da ficha — nunca
     compara "primeira data cadastrada" com hoje direto, sempre olha o
     histórico completo de execuções da atividade (regra principal do ajuste
     de atrasos). Uma atividade com execução futura pendente nunca aparece
     aqui como atrasada, mesmo tendo uma execução anterior vencida. */
  const prox = proximaAtividadePendente(t);
  const proxStatus = prox ? atividadeStatus(prox) : null;
  if (prox && proxStatus === "nao_realizada") {
    return { t, local, motivo: `Atividade não realizada: ${prox.nome}`, dias: 0, acaoLabel: "VERIFICAR PRAZO" };
  }
  if (prox && proxStatus === "atrasada") {
    const exec = proximaExecucaoDaAtividade(prox);
    const dias = daysDiff(exec.data, hoje);
    return { t, local, motivo: `${prox.nome} atrasado(a) há ${dias} dia${dias === 1 ? "" : "s"}`, dias, acaoLabel: motivoAcaoEtapa(prox.nome) };
  }
  if (prox) {
    const exec = proximaExecucaoDaAtividade(prox);
    if (exec && exec.data === hoje) {
      return { t, local, motivo: `${prox.nome} agendado(a) para hoje`, dias: 0, acaoLabel: motivoAcaoEtapa(prox.nome) };
    }
  }

  if (t.status === "aguardando_orcamento") {
    const ultimaRealizada = (t.plano || [])
      .filter(a => a.nome === "Solicitar orçamento" && atividadeStatus(a) === "concluida")
      .map(ultimaExecucaoRealizada).filter(Boolean)
      .sort((a, c) => (c.dataConclusao || "").localeCompare(a.dataConclusao || ""))[0];
    const dias = ultimaRealizada ? daysDiff(ultimaRealizada.dataConclusao, hoje) : 0;
    if (dias >= 3) return { t, local, motivo: `Orçamento aguardando aprovação há ${dias} dias`, dias, acaoLabel: "CONFIRMAR ORÇAMENTO" };
  }

  if (t.clienteAguardando) {
    const dias = daysDiff(t.clienteAguardando.desde, hoje);
    if (dias >= 1) return { t, local, motivo: `Aguardando retorno do cliente há ${dias} dia${dias === 1 ? "" : "s"}`, dias, acaoLabel: "REGISTRAR RESPOSTA" };
  }

  // sem pendência de prazo, mas prioridade alta/crítica ou reincidência não podem passar batido
  if (t.priority === "alta" || t.priority === "critica") {
    const dias = Math.max(0, daysDiff(t.openedAt.slice(0, 10), hoje));
    return { t, local, motivo: `Prioridade ${t.priority === "critica" ? "crítica" : "alta"} em aberto há ${dias} dia${dias === 1 ? "" : "s"}`, dias, acaoLabel: "ABRIR CHAMADO" };
  }
  const anterior = findSameUnitReincidence(t);
  if (anterior) return { t, local, motivo: `Possível reincidência — ${anterior.id} (mesma unidade e categoria) já foi encerrado`, dias: 0, acaoLabel: "ABRIR CHAMADO" };

  return null;
}
function montarListaAtencao() {
  const hoje = todayISODate();
  const out = [];
  state.tickets.forEach(t => {
    if (CLOSED_STATUSES.includes(t.status)) return;
    const item = motivoAtencaoDoChamado(t, hoje);
    if (item) out.push({ ...item, modulo: "posvenda", codigo: t.id });
  });
  state.modifications.forEach(m => {
    if (MODIFICATION_CLOSED_STATUSES.includes(m.status)) return;
    const item = motivoAtencaoDaModificacao(m, hoje);
    if (item) out.push({ ...item, modulo: "modificacao", codigo: m.code });
  });
  return out.sort((a, b) => b.dias - a.dias);
}
const ATENCAO_MODULO_LABEL = { posvenda: "Pós-venda", modificacao: "Modificação" };
function renderAtencaoList() {
  const root = document.getElementById("atencao-list");
  const lista = montarListaAtencao();
  if (!lista.length) { root.innerHTML = `<div class="empty-hint">Nada exige atenção imediata.</div>`; return; }
  root.innerHTML = lista.map((item, i) => `
    <div class="atencao-row" data-atencao-row="${i}">
      <div class="atencao-info">
        <span class="badge outline" style="margin-right:6px;">${ATENCAO_MODULO_LABEL[item.modulo]}</span>${item.modulo === "posvenda" && (item.t.priority === "alta" || item.t.priority === "critica") ? `<span class="badge atencao-critico status-cancelado">${item.t.priority === "critica" ? "Crítico" : "Alta"}</span>` : ""}
        <strong>${item.codigo}</strong>
        <span class="hint">${escapeHtml(item.local)}</span>
        <span class="atencao-motivo">${escapeHtml(item.motivo)}</span>
      </div>
      <button type="button" class="btn ${item.acaoDireta ? "danger" : "primary"} small" data-atencao-acao="${i}">${item.acaoLabel}</button>
    </div>`).join("");

  root.querySelectorAll("[data-atencao-row]").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-atencao-acao]")) return;
      const item = lista[Number(row.dataset.atencaoRow)];
      if (item.modulo === "posvenda") goToTicketDetail(item.t.id);
      else goToModificationDetail(item.m.id);
    });
  });
  root.querySelectorAll("[data-atencao-acao]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const item = lista[Number(btn.dataset.atencaoAcao)];
      if (item.acaoDireta) {
        item.acaoDireta();
        persist();
        renderAll();
        toast("Ação registrada.", "success");
      } else if (item.modulo === "posvenda") {
        goToTicketDetail(item.t.id);
      } else {
        goToModificationDetail(item.m.id);
      }
    });
  });
}

/* ---------- Agenda de hoje — mesma fonte de dados da tela de Agenda. ---------- */
function renderAgendaHojeHome() {
  const root = document.getElementById("agenda-hoje-list");
  const hoje = todayISODate();
  const eventos = agendaEventos({}).filter(x => x.execucao.data === hoje).sort((a, b) => a.execucao.horario.localeCompare(b.execucao.horario));
  if (!eventos.length) { root.innerHTML = `<div class="empty-hint">Nada agendado para hoje.</div>`; return; }
  root.innerHTML = eventos.map(x => `
    <div class="agenda-hoje-row" data-open-ticket="${x.ticket.id}">
      <div class="agenda-hoje-hora">${x.execucao.horario}</div>
      <div>
        <div class="agenda-hoje-titulo">${escapeHtml(x.atividade.nome || "")}</div>
        <div class="hint">${x.ticket.id} · ${x.building ? escapeHtml(x.building.name) : "—"}${x.ticket.unit ? " / " + escapeHtml(x.ticket.unit) : ""}</div>
        <div class="hint">${x.atividade.responsavel ? "Responsável: " + escapeHtml(x.atividade.responsavel) : ""}${x.atividade.acessoUnidade === "sim" ? " · " + (x.atividade.clientePresente === "sim" ? "Cliente presente" : "Cliente ausente") : ""}</div>
      </div>
    </div>`).join("");
  root.querySelectorAll("[data-open-ticket]").forEach(row => row.addEventListener("click", () => goToTicketDetail(row.dataset.openTicket)));
}

/* ---------- Fornecedores sem retorno — 3 estágios, sem alterar o cálculo do
   prazo (isFornecedorSemRetorno/prazoAutomaticoFornecedor continuam intactos). */
function renderFornecedorAtencaoHome() {
  const root = document.getElementById("fornecedor-atencao-list");
  const lista = todosFornecedoresAguardando();
  const vencidos = lista.filter(({ t, link }) => isFornecedorSemRetorno(t, link)).length;
  document.getElementById("fornecedor-atencao-resumo").textContent = lista.length
    ? `Fornecedores acionados — ${lista.length} aguardando${vencidos ? `, ${vencidos} com prazo vencido` : ""}`
    : "Fornecedores acionados — nenhum aguardando";
  if (!lista.length) { root.innerHTML = `<div class="empty-hint">Nenhum fornecedor sem retorno.</div>`; return; }
  const hoje = todayISODate();
  root.innerHTML = lista
    .sort((a, b) => (a.link.dataAcionamento || "").localeCompare(b.link.dataAcionamento || ""))
    .map(({ t, link }) => {
      const b = getBuilding(t.buildingId);
      const supplier = getSupplier(link.supplierId);
      const dias = link.dataAcionamento ? daysDiff(link.dataAcionamento, hoje) : 0;
      const vencido = isFornecedorSemRetorno(t, link);
      const prazo = link.dataAgendada || prazoAutomaticoFornecedor(link);
      const diasParaPrazo = prazo ? daysDiff(hoje, prazo) : null;
      const estagio = vencido ? "vencido" : (diasParaPrazo !== null && diasParaPrazo <= 1) ? "proximo" : "dentro";
      const estagioLabel = { vencido: "🔴 Prazo vencido", proximo: "🟡 Próximo do vencimento", dentro: "🟢 Dentro do prazo" }[estagio];
      return `
      <div class="fornecedor-atencao-row estagio-${estagio}" data-open-ticket="${t.id}">
        <div>
          <strong>${supplier ? escapeHtml(supplierDisplayName(supplier)) : "—"}</strong>
          <span class="hint">${t.id} · ${b ? escapeHtml(b.name) : "—"}${t.unit ? " / " + escapeHtml(t.unit) : ""}</span>
          <span class="hint">Acionado em ${fmtDate(link.dataAcionamento)} · ${estagioLabel}${dias > 0 ? " · há " + dias + " dia" + (dias === 1 ? "" : "s") : ""}</span>
        </div>
        ${vencido ? `<button type="button" class="btn danger small" data-cobrar-home="${t.id}|${link.id}">Cobrar</button>` : ""}
      </div>`;
    }).join("");

  root.querySelectorAll("[data-open-ticket]").forEach(row => {
    row.addEventListener("click", (e) => { if (e.target.closest("[data-cobrar-home]")) return; goToTicketDetail(row.dataset.openTicket); });
  });
  root.querySelectorAll("[data-cobrar-home]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const [ticketId, linkId] = btn.dataset.cobrarHome.split("|");
      const t = getTicket(ticketId);
      const link = t.fornecedores.find(f => f.id === linkId);
      cobrarFornecedor(t, link);
      persist();
      renderAll();
      toast("Cobrança registrada.", "success");
    });
  });
}

/* ---------- Render: Empreendimentos ---------- */
let buildingFilter = "todos";

function renderBuildings() {
  const grid = document.getElementById("building-grid");
  const list = state.buildings.filter(b => buildingFilter === "todos" || b.status === buildingFilter);
  if (!list.length) {
    grid.innerHTML = `<div class="empty-hint">Nenhum empreendimento cadastrado.</div>`;
    return;
  }
  grid.innerHTML = list.map(b => {
    const openCount = state.tickets.filter(t => t.buildingId === b.id && OPEN_STATUSES.includes(t.status)).length;
    const totalCount = state.tickets.filter(t => t.buildingId === b.id).length;
    return `
    <div class="building-card" data-building="${b.id}">
      <div class="bc-top">
        <div>
          <h4>${escapeHtml(b.name)}</h4>
          <div class="bc-address">${escapeHtml(b.address || "Endereço não informado")}</div>
        </div>
        <span class="badge outline status-tag ${b.status}">${BUILDING_STATUS[b.status]}</span>
      </div>
      <div class="bc-resumo">
        <span class="bc-abertos ${openCount ? "tem" : ""}"><strong>${openCount}</strong> aberto${openCount === 1 ? "" : "s"}</span>
        <span class="bc-detalhe">${totalCount} no total · ${b.units || "—"} unidades${b.status === "andamento" ? ` · obra ${b.progress || 0}%` : b.deliveryDate ? ` · entregue ${fmtDate(b.deliveryDate)}` : ""}</span>
      </div>
    </div>`;
  }).join("");

  grid.querySelectorAll(".building-card").forEach(card => {
    card.addEventListener("click", () => openBuildingDetail(card.dataset.building));
  });
}

/* A ficha do empreendimento (tela própria com abas) mora em js/building-detail.js — openBuildingDetail(id, aba). */

/* Resolve o caso A da Bíblia do Sistema (Modificações): uma unidade deve
   "permanecer cadastrada" mesmo não vendida, sem exigir criar cada uma na mão.
   Gera linhas em branco (unidade preenchida, sem cliente) seguindo o padrão
   andar+sequência já usado nos dados reais importados (ex: 201-204, 301-304).
   Unidades que já existem pro empreendimento nunca são duplicadas. */
function openGerarUnidadesForm(buildingId) {
  const b = getBuilding(buildingId);
  if (!b) return;
  openModal(`
    <div class="modal-header">
      <h2>Gerar unidades — ${escapeHtml(b.name)}</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <p class="hint">Cria uma linha por unidade (número preenchido, sem cliente) — elas aparecem como "Não vendido" no Mapa de Modificações até alguém cadastrar o comprador. Unidades já existentes nunca são duplicadas.</p>
      <form id="gerar-unidades-form">
        <div class="form-grid">
          <div class="field"><label>Andar inicial *</label><input type="number" name="andarInicio" required min="1" value="1"></div>
          <div class="field"><label>Andar final *</label><input type="number" name="andarFim" required min="1"></div>
          <div class="field"><label>Unidades por andar *</label><input type="number" name="porAndar" required min="1" value="4"></div>
        </div>
        <p class="hint">Exemplo: andares 2 a 12, 4 por andar → gera 201–204, 301–304 … 1201–1204.</p>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn ghost" data-close>Cancelar</button>
      <button class="btn primary" id="btn-confirmar-gerar-unidades">Gerar unidades</button>
    </div>
  `);
  wireModalClose();
  document.getElementById("btn-confirmar-gerar-unidades").addEventListener("click", () => {
    const form = document.getElementById("gerar-unidades-form");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const andarInicio = Number(fd.get("andarInicio"));
    const andarFim = Number(fd.get("andarFim"));
    const porAndar = Number(fd.get("porAndar"));
    if (andarFim < andarInicio) { toast("Andar final não pode ser menor que o inicial.", "error"); return; }
    const existentes = new Set(state.clients.filter(c => c.buildingId === buildingId).map(c => c.unit));
    let criadas = 0, jaExistiam = 0;
    for (let andar = andarInicio; andar <= andarFim; andar++) {
      for (let i = 1; i <= porAndar; i++) {
        const unit = String(andar) + String(i).padStart(2, "0");
        if (existentes.has(unit)) { jaExistiam++; continue; }
        state.clients.push({
          id: nextClientId(), buildingId, unit, garage: "", name: "", phone: "", email: "", escritura: "", notes: "",
        });
        existentes.add(unit);
        criadas++;
      }
    }
    persist();
    closeModal();
    toast(`${criadas} unidade(s) gerada(s)${jaExistiam ? ` — ${jaExistiam} já existiam.` : "."}`, "success");
    openBuildingDetail(buildingId, "unidades");
  });
}

function openSindicoAdminForm(buildingId) {
  const b = getBuilding(buildingId);
  if (!b) return;
  const s = b.sindico || blankSindico();
  const a = b.administradora || blankAdministradora();
  const historico = b.sindicoHistorico || [];
  openModal(`
    <div class="modal-header">
      <h2>Síndico e Administradora — ${escapeHtml(b.name)}</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <form id="sindico-admin-form">
        <h4 class="form-section-title">Síndico atual</h4>
        <div class="form-grid">
          <div class="field"><label>Nome</label><input type="text" name="sindicoNome" value="${escapeHtml(s.nome || "")}"></div>
          <div class="field"><label>Telefone</label><input type="text" name="sindicoTelefone" value="${escapeHtml(s.telefone || "")}"></div>
          <div class="field"><label>E-mail</label><input type="text" name="sindicoEmail" value="${escapeHtml(s.email || "")}"></div>
          <div class="field"><label>Data de início</label><input type="date" name="sindicoDataInicio" value="${s.dataInicio || ""}"></div>
          <div class="field full"><label>Observações</label><textarea name="sindicoObservacoes">${escapeHtml(s.observacoes || "")}</textarea></div>
        </div>

        <h4 class="form-section-title">Administradora</h4>
        <div class="form-grid">
          <div class="field"><label>Empresa</label><input type="text" name="admNome" value="${escapeHtml(a.nomeEmpresa || "")}"></div>
          <div class="field"><label>Responsável</label><input type="text" name="admResponsavel" value="${escapeHtml(a.responsavel || "")}"></div>
          <div class="field"><label>Telefone</label><input type="text" name="admTelefone" value="${escapeHtml(a.telefone || "")}"></div>
          <div class="field"><label>E-mail</label><input type="text" name="admEmail" value="${escapeHtml(a.email || "")}"></div>
        </div>
      </form>

      ${historico.length ? `
        <h4 class="form-section-title">Síndicos anteriores</h4>
        <div class="table-wrap">
          <table class="mini-table">
            <thead><tr><th>Nome</th><th>Período</th><th>Contato</th></tr></thead>
            <tbody>
              ${historico.slice().reverse().map(h => `<tr><td>${escapeHtml(h.nome || "—")}</td><td>${fmtDate(h.dataInicio)} – ${fmtDate(h.dataFim)}</td><td>${escapeHtml(h.telefone || h.email || "—")}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>` : ""}
    </div>
    <div class="modal-footer">
      <button class="btn ghost" id="btn-trocar-sindico" style="margin-right:auto;">Trocar síndico</button>
      <button class="btn ghost" data-close>Cancelar</button>
      <button class="btn primary" id="btn-save-sindico-admin">Salvar</button>
    </div>
  `, true);
  wireModalClose();

  document.getElementById("btn-save-sindico-admin").addEventListener("click", () => {
    const fd = new FormData(document.getElementById("sindico-admin-form"));
    const nome = fd.get("sindicoNome").trim();
    b.sindico = nome ? {
      nome, telefone: fd.get("sindicoTelefone").trim(), email: fd.get("sindicoEmail").trim(),
      dataInicio: fd.get("sindicoDataInicio") || "", observacoes: fd.get("sindicoObservacoes").trim(),
    } : null;
    const admNome = fd.get("admNome").trim();
    b.administradora = admNome ? {
      nomeEmpresa: admNome, responsavel: fd.get("admResponsavel").trim(),
      telefone: fd.get("admTelefone").trim(), email: fd.get("admEmail").trim(),
    } : null;
    persist();
    closeModal();
    toast("Síndico/administradora atualizados.", "success");
    openBuildingDetail(buildingId);
  });

  document.getElementById("btn-trocar-sindico").addEventListener("click", () => {
    if (b.sindico && b.sindico.nome) {
      if (!confirm(`Arquivar "${b.sindico.nome}" no histórico e cadastrar um novo síndico?`)) return;
      if (!b.sindicoHistorico) b.sindicoHistorico = [];
      b.sindicoHistorico.push(blankSindicoHistEntry(b.sindico, todayISODate()));
    }
    b.sindico = blankSindico();
    persist();
    toast("Síndico anterior arquivado. Preencha os dados do novo síndico.", "success");
    openSindicoAdminForm(buildingId);
  });
}

function openBuildingForm(id) {
  const editing = id ? getBuilding(id) : null;
  openModal(`
    <div class="modal-header">
      <h2>${editing ? "Editar empreendimento" : "Novo empreendimento"}</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <form id="building-form">
        <div class="form-grid">
          <div class="field full">
            <label>Nome do empreendimento</label>
            <input type="text" name="name" required value="${editing ? escapeHtml(editing.name) : ""}">
          </div>
          <div class="field full">
            <label>Endereço</label>
            <input type="text" name="address" value="${editing ? escapeHtml(editing.address || "") : ""}">
          </div>
          <div class="field">
            <label>Status</label>
            <select name="status">
              <option value="concluido" ${editing?.status === "concluido" ? "selected" : ""}>Concluído</option>
              <option value="andamento" ${editing?.status === "andamento" ? "selected" : ""}>Em andamento</option>
            </select>
          </div>
          <div class="field">
            <label>Unidades</label>
            <input type="number" min="1" name="units" value="${editing ? editing.units || "" : ""}">
          </div>
          <div class="field">
            <label>Data de entrega</label>
            <input type="date" name="deliveryDate" value="${editing ? editing.deliveryDate || "" : ""}">
          </div>
          <div class="field">
            <label>Progresso da obra (%) — se em andamento</label>
            <input type="number" min="0" max="100" name="progress" value="${editing ? editing.progress || 0 : 0}">
          </div>
          <div class="field">
            <label>Possui Manual do Proprietário?</label>
            <select name="possuiManual">
              <option value="" ${!editing || editing.possuiManual === null ? "selected" : ""}>Não classificado</option>
              <option value="sim" ${editing?.possuiManual === true ? "selected" : ""}>Sim</option>
              <option value="nao" ${editing?.possuiManual === false ? "selected" : ""}>Não — usar base normativa</option>
            </select>
          </div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      ${editing ? `<button class="btn danger" id="btn-delete-building" style="margin-right:auto;">Excluir</button>` : ""}
      <button class="btn ghost" data-close>Cancelar</button>
      <button class="btn primary" id="btn-save-building">Salvar</button>
    </div>
  `);
  wireModalClose();

  document.getElementById("btn-save-building").addEventListener("click", () => {
    const form = document.getElementById("building-form");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const payload = {
      name: fd.get("name").trim(),
      address: fd.get("address").trim(),
      status: fd.get("status"),
      units: Number(fd.get("units")) || 0,
      deliveryDate: fd.get("deliveryDate") || "",
      progress: Math.max(0, Math.min(100, Number(fd.get("progress")) || 0)),
      possuiManual: fd.get("possuiManual") === "sim" ? true : fd.get("possuiManual") === "nao" ? false : null,
    };
    const wasAndamento = editing && editing.status === "andamento";
    if (editing) {
      Object.assign(editing, payload);
      toast("Empreendimento atualizado.", "success");
    } else {
      state.buildings.push({ id: "b" + Date.now(), responsible: "", ...payload });
      toast("Empreendimento cadastrado.", "success");
    }
    persist();
    closeModal();
    renderAll();

    if (wasAndamento && payload.status === "concluido") {
      const openPendencies = state.tickets.filter(t => t.buildingId === editing.id && t.type === "obra" && !CLOSED_STATUSES.includes(t.status));
      if (openPendencies.length && confirm(`Este empreendimento tem ${openPendencies.length} pendência(s) de obra ainda em aberto. Migrar para acompanhamento de pós-venda (mantendo o histórico)?`)) {
        migrateObraPendenciesToPosVenda(editing.id);
        persist();
        renderAll();
        toast(`${openPendencies.length} pendência(s) migrada(s) para pós-venda.`, "success");
      }
    }
  });

  const delBtn = document.getElementById("btn-delete-building");
  if (delBtn) {
    delBtn.addEventListener("click", () => {
      const hasTickets = state.tickets.some(t => t.buildingId === editing.id);
      if (hasTickets) {
        toast("Não é possível excluir: há chamados vinculados a este empreendimento.", "error");
        return;
      }
      if (!confirm("Excluir este empreendimento?")) return;
      state.buildings = state.buildings.filter(b => b.id !== editing.id);
      persist();
      closeModal();
      renderAll();
      toast("Empreendimento excluído.");
    });
  }
}

/* ---------- Render: Clientes ---------- */
function populateClientFilterSelect() {
  const sel = document.getElementById("filter-client-building");
  const current = sel.value;
  sel.innerHTML = `<option value="">Todos os prédios</option>` + state.buildings.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");
  sel.value = current;
}

const CLIENTES_POR_VEZ = 50;
let clientsLimit = CLIENTES_POR_VEZ;
let clientsSig = "";

function renderClients() {
  const buildingFilterVal = document.getElementById("filter-client-building").value;
  const onlyMissing = document.getElementById("filter-client-missing").checked;
  const search = (document.getElementById("global-search").value || "").trim().toLowerCase();

  let list = state.clients.slice();
  if (buildingFilterVal) list = list.filter(c => c.buildingId === buildingFilterVal);
  if (onlyMissing) list = list.filter(c => !c.phone && !c.email);
  if (search) {
    list = list.filter(c => {
      const b = getBuilding(c.buildingId);
      return String(c.unit).toLowerCase().includes(search)
        || (c.name || "").toLowerCase().includes(search)
        || (c.phone || "").toLowerCase().includes(search)
        || (c.email || "").toLowerCase().includes(search)
        || (b && b.name.toLowerCase().includes(search));
    });
  }
  list.sort((a, b) => {
    const ba = getBuilding(a.buildingId), bb = getBuilding(b.buildingId);
    const nameA = ba ? ba.name : "", nameB = bb ? bb.name : "";
    if (nameA !== nameB) return nameA.localeCompare(nameB, "pt-BR");
    return a.unit.localeCompare(b.unit, "pt-BR", { numeric: true });
  });

  const sig = [buildingFilterVal, onlyMissing, search].join("|");
  if (sig !== clientsSig) { clientsSig = sig; clientsLimit = CLIENTES_POR_VEZ; }
  const footer = document.getElementById("clients-footer");
  const tbody = document.querySelector("#clients-table tbody");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-hint">Nenhum cliente encontrado com os filtros atuais.</td></tr>`;
    footer.innerHTML = "";
    return;
  }
  const visiveis = list.slice(0, clientsLimit);
  footer.innerHTML = `<span>Mostrando ${visiveis.length} de ${list.length} unidades.</span>` + (list.length > visiveis.length
    ? ` <button type="button" class="btn ghost small" data-clients-mais="50">Mostrar mais 50</button> <button type="button" class="btn ghost small" data-clients-mais="all">Mostrar todas</button>` : "");
  tbody.innerHTML = visiveis.map(c => {
    const b = getBuilding(c.buildingId);
    return `
    <tr data-open-client="${c.id}">
      <td>${b ? escapeHtml(b.name) : "—"}</td>
      <td>${escapeHtml(c.unit)}</td>
      <td>${escapeHtml(c.garage || "—")}</td>
      <td>${c.name ? escapeHtml(c.name) : '<span class="empty-hint">sem cliente cadastrado</span>'}</td>
      <td>${escapeHtml(c.phone || "—")}</td>
      <td>${escapeHtml(c.email || "—")}</td>
      <td><button class="btn ghost small" data-open-client="${c.id}">Editar</button></td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll("[data-open-client]").forEach(el => {
    el.addEventListener("click", (e) => { e.stopPropagation(); openClientForm(el.dataset.openClient); });
  });
}

function openClientForm(id, presetBuildingId) {
  const editing = id ? getClient(id) : null;
  if (!editing && !state.buildings.length) {
    toast("Cadastre um empreendimento antes de adicionar um cliente.", "error");
    return;
  }
  const selectedBuildingId = editing ? editing.buildingId : (presetBuildingId || state.buildings[0].id);
  openModal(`
    <div class="modal-header">
      <h2>${editing ? "Editar cliente" : "Novo cliente"}</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <form id="client-form">
        <div class="form-grid">
          <div class="field">
            <label>Empreendimento</label>
            <select name="buildingId" required>
              ${state.buildings.map(b => `<option value="${b.id}" ${b.id === selectedBuildingId ? "selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Unidade</label>
            <input type="text" name="unit" required value="${editing ? escapeHtml(editing.unit) : ""}" placeholder="Ex: 101, Sala Comercial">
          </div>
          <div class="field">
            <label>Vaga / garagem</label>
            <input type="text" name="garage" value="${editing ? escapeHtml(editing.garage || "") : ""}">
          </div>
          <div class="field">
            <label>Nome do cliente</label>
            <input type="text" name="name" value="${editing ? escapeHtml(editing.name || "") : ""}" placeholder="Proprietário / cliente">
          </div>
          <div class="field">
            <label>Telefone</label>
            <input type="text" name="phone" value="${editing ? escapeHtml(editing.phone || "") : ""}">
          </div>
          <div class="field">
            <label>E-mail</label>
            <input type="text" name="email" value="${editing ? escapeHtml(editing.email || "") : ""}">
          </div>
          <div class="field full">
            <label>Situação da escritura</label>
            <input type="text" name="escritura" value="${editing ? escapeHtml(editing.escritura || "") : ""}">
          </div>
          <div class="field full">
            <label>Observações</label>
            <textarea name="notes">${editing ? escapeHtml(editing.notes || "") : ""}</textarea>
          </div>
        </div>
      </form>
      ${editing ? (() => {
        const unitTickets = state.tickets.filter(t => t.buildingId === editing.buildingId && t.unit === editing.unit).sort((a, c) => c.openedAt.localeCompare(a.openedAt));
        const unitMods = modificationsForUnit(editing.buildingId, editing.unit);
        return `
        <h3 style="font-size:13.5px;margin:18px 0 10px;">Chamados desta unidade (${unitTickets.length})</h3>
        <div class="table-wrap">
          <table class="mini-table">
            <thead><tr><th>OS</th><th>Categoria</th><th>Status</th></tr></thead>
            <tbody>
              ${unitTickets.length ? unitTickets.map(t => `
                <tr data-open-ticket="${t.id}" style="cursor:pointer;">
                  <td>${t.id}${findSameUnitReincidence(t) ? " ⚠️" : ""}</td><td>${t.category}</td>
                  <td><span class="badge status-${t.status}">${TICKET_STATUS_MAP[t.status]}</span></td>
                </tr>`).join("") : `<tr><td colspan="3" class="empty-hint">Nenhum chamado registrado para esta unidade.</td></tr>`}
            </tbody>
          </table>
        </div>
        <h3 style="font-size:13.5px;margin:18px 0 10px;">Modificações desta unidade (${unitMods.length})</h3>
        <div class="table-wrap">
          <table class="mini-table">
            <thead><tr><th>Nº</th><th>Data</th><th>Categorias</th><th>Status</th></tr></thead>
            <tbody>
              ${unitMods.length ? unitMods.map(m => `
                <tr data-open-modification="${m.id}" style="cursor:pointer;">
                  <td>${m.code}</td><td>${fmtDate(m.dataSolicitacao)}</td><td>${m.categorias.map(escapeHtml).join(", ") || "—"}</td>
                  <td><span class="badge mod-status-${m.status}">${MODIFICATION_STATUS_MAP[m.status].label}</span></td>
                </tr>`).join("") : `<tr><td colspan="4" class="empty-hint">Nenhuma modificação registrada para esta unidade.</td></tr>`}
            </tbody>
          </table>
        </div>`;
      })() : ""}
    </div>
    <div class="modal-footer">
      ${editing ? `<button class="btn danger" id="btn-delete-client" style="margin-right:auto;">Excluir</button>` : ""}
      <button class="btn ghost" data-close>Cancelar</button>
      <button class="btn primary" id="btn-save-client">Salvar</button>
    </div>
  `, true);
  wireModalClose();
  document.querySelectorAll("[data-open-ticket]").forEach(el => el.addEventListener("click", () => { closeModal(); goToTicketDetail(el.dataset.openTicket); }));
  document.querySelectorAll("[data-open-modification]").forEach(el => el.addEventListener("click", () => { closeModal(); goToModificationDetail(el.dataset.openModification); }));

  document.getElementById("btn-save-client").addEventListener("click", () => {
    const form = document.getElementById("client-form");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const payload = {
      buildingId: fd.get("buildingId"),
      unit: fd.get("unit").trim(),
      garage: fd.get("garage").trim(),
      name: fd.get("name").trim(),
      phone: fd.get("phone").trim(),
      email: fd.get("email").trim(),
      escritura: fd.get("escritura").trim(),
      notes: fd.get("notes").trim(),
    };
    if (editing) {
      Object.assign(editing, payload);
      toast("Cliente atualizado.", "success");
    } else {
      state.clients.push({ id: nextClientId(), ...payload });
      toast("Cliente cadastrado.", "success");
    }
    persist();
    closeModal();
    renderAll();
  });

  const delBtn = document.getElementById("btn-delete-client");
  if (delBtn) {
    delBtn.addEventListener("click", () => {
      if (!confirm("Excluir este cliente?")) return;
      state.clients = state.clients.filter(c => c.id !== editing.id);
      persist();
      closeModal();
      renderAll();
      toast("Cliente excluído.");
    });
  }
}

/* ---------- Modal close wiring ---------- */
function wireModalClose() {
  document.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", closeModal));
}

/* ---------- Render dispatcher ---------- */
function renderAll() {
  populateFilterSelects();
  populateClientFilterSelect();
  populateSupplierFilterSelects();
  populateAgendaFilterSelects();
  renderDashboard();
  renderBuildings();
  renderClients();
  renderSuppliers();
  renderTickets();
  renderAgenda();
  renderModificationsList();
  if (typeof renderVistorias === "function") renderVistorias();
  if (typeof renderVtAgenda === "function") renderVtAgenda();
  renderBuildingDetailIfActive();
  renderReportsIfActive();
}

/* ---------- Wire up UI (executa uma vez) ---------- */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });

  const operatorInput = document.getElementById("operator-name");
  operatorInput.value = getOperatorName();
  operatorInput.addEventListener("change", () => setOperatorName(operatorInput.value.trim()));

  document.getElementById("btn-new-ticket").addEventListener("click", openTicketFormRapido);
  document.getElementById("btn-import-tickets").addEventListener("click", () => openImportModal("chamados"));
  document.getElementById("btn-ver-agenda").addEventListener("click", () => showView("agenda"));
  document.getElementById("btn-new-building").addEventListener("click", () => openBuildingForm(null));
  document.getElementById("btn-new-client").addEventListener("click", () => openClientForm(null));
  document.getElementById("btn-new-supplier").addEventListener("click", () => openSupplierForm(null));
  document.getElementById("btn-new-modification").addEventListener("click", () => openModificationForm());
  document.getElementById("btn-open-price-table").addEventListener("click", () => openPriceTableModal());
  document.getElementById("btn-open-modifications-map").addEventListener("click", () => goToModificationsMap());
  ["filter-mod-building", "filter-mod-status", "filter-mod-item"].forEach(id => {
    document.getElementById(id).addEventListener("change", renderModificationsList);
  });
  document.getElementById("filter-mod-search").addEventListener("input", renderModificationsList);

  document.getElementById("building-status-filter").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    buildingFilter = btn.dataset.status;
    document.querySelectorAll("#building-status-filter .chip").forEach(c => c.classList.toggle("active", c === btn));
    renderBuildings();
  });

  ["filter-building", "filter-status", "filter-category", "filter-priority"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {
      if (id === "filter-status" && document.getElementById(id).value) ticketQuickFilter = null; // status escolhido à mão manda mais que o botão rápido
      renderTickets();
    });
  });
  document.getElementById("filter-overdue").addEventListener("change", renderTickets);
  wireTicketsSortHeaders();
  initQuickCapture();
  document.getElementById("ticket-type-filter").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    ticketTypeFilter = btn.dataset.type;
    document.querySelectorAll("#ticket-type-filter .chip").forEach(c => c.classList.toggle("active", c === btn));
    renderTickets();
  });
  document.getElementById("filter-client-building").addEventListener("change", renderClients);
  document.getElementById("filter-client-missing").addEventListener("change", renderClients);
  document.getElementById("filter-supplier-specialty").addEventListener("change", renderSuppliers);
  document.getElementById("filter-supplier-building").addEventListener("change", renderSuppliers);
  document.getElementById("filter-supplier-status").addEventListener("change", renderSuppliers);
  document.getElementById("global-search").addEventListener("input", () => {
    renderTickets();
    renderClients();
    renderSuppliers();
  });

  document.getElementById("agenda-btn-hoje").addEventListener("click", agendaIrParaHoje);
  document.getElementById("agenda-btn-anterior").addEventListener("click", agendaAnterior);
  document.getElementById("agenda-btn-proxima").addEventListener("click", agendaProxima);
  document.getElementById("agenda-view-mode").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    agendaSetViewMode(btn.dataset.mode);
  });
  ["filter-agenda-building", "filter-agenda-responsavel", "filter-agenda-fornecedor",
    "filter-agenda-tipo", "filter-agenda-status", "filter-agenda-minha"].forEach(id => {
    document.getElementById(id).addEventListener("change", renderAgenda);
  });

  document.getElementById("btn-backup").addEventListener("click", openBackupModal);
  document.getElementById("clients-footer").addEventListener("click", (e) => {
    const b = e.target.closest("[data-clients-mais]");
    if (!b) return;
    clientsLimit = b.dataset.clientsMais === "all" ? Infinity : clientsLimit + Number(b.dataset.clientsMais);
    renderClients();
  });
  // a busca do topo acompanha a tela ativa mesmo quando a tela troca sem passar por showView (fichas)
  const trocaDeTela = new MutationObserver(() => {
    const v = document.querySelector(".view.active");
    if (v) atualizarBuscaDoTopo(v.id.replace("view-", ""));
  });
  document.querySelectorAll(".view").forEach(v => trocaDeTela.observe(v, { attributes: true, attributeFilter: ["class"] }));

  document.getElementById("file-import").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.buildings || !parsed.tickets) throw new Error("formato inválido");
        const attachments = parsed.attachments || [];
        delete parsed.attachments;
        state = migrateData(parsed);
        state.clients = state.clients || [];
        state.ticketSeq = state.ticketSeq || (state.tickets.length + 1);
        state.clientSeq = state.clientSeq || (state.clients.length + 1);
        persist();
        if (attachments.length) {
          toast(`Importando ${attachments.length} anexo(s)...`);
          await importAttachments(attachments);
        }
        renderAll();
        toast("Backup importado com sucesso.", "success");
      } catch (err) {
        toast("Arquivo inválido. Verifique o backup selecionado.", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  renderAll();
});

/* ---------- Backup e dados ---------- */
async function exportarBackup() {
  toast("Preparando backup (incluindo anexos)...");
  const attachments = await exportAllAttachments();
  const payload = { ...state, attachments };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `posvenda-backup-${todayISODate()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Backup exportado (dados + fotos/documentos).", "success");
}

function openBackupModal() {
  openModal(`
    <div class="modal-header">
      <h2>Backup e dados</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <p class="hint">Os dados ficam só neste navegador. Baixe um backup de vez em quando — é a única cópia de segurança.</p>
      <div class="bk-acao">
        <div><strong>Baixar backup</strong><p class="hint">Um arquivo com tudo: chamados, modificações, cadastros, fotos e documentos.</p></div>
        <button type="button" class="btn primary" id="bk-exportar">Baixar backup</button>
      </div>
      <div class="bk-acao">
        <div><strong>Restaurar backup</strong><p class="hint">Escolha um arquivo de backup baixado antes. Substitui o que está no sistema agora.</p></div>
        <button type="button" class="btn ghost" id="bk-restaurar">Escolher arquivo…</button>
      </div>
      <details class="bk-perigo">
        <summary>Apagar tudo</summary>
        <p class="hint">Apaga todas as alterações e chamados e volta aos dados originais das planilhas (empreendimentos e clientes). Não tem como desfazer — baixe um backup antes.</p>
        <div class="field"><label>Para confirmar, digite APAGAR</label><input type="text" id="bk-confirma" autocomplete="off"></div>
        <button type="button" class="btn danger" id="bk-apagar" disabled style="margin-top:10px;">Apagar tudo</button>
      </details>
    </div>
    <div class="modal-footer"><button class="btn ghost" data-close>Fechar</button></div>`);
  wireModalClose();
  document.getElementById("bk-exportar").addEventListener("click", exportarBackup);
  document.getElementById("bk-restaurar").addEventListener("click", () => { closeModal(); document.getElementById("file-import").click(); });
  const campo = document.getElementById("bk-confirma"), btn = document.getElementById("bk-apagar");
  campo.addEventListener("input", () => { btn.disabled = campo.value.trim() !== "APAGAR"; });
  btn.addEventListener("click", () => {
    if (campo.value.trim() !== "APAGAR") return;
    localStorage.removeItem(STORAGE_KEY);
    state = loadData();
    closeModal();
    renderAll();
    toast("Dados reiniciados.");
  });
}

/* rolagem: se nenhuma janela está aberta, tira a trava (evita a tela não rolar depois de fechar uma janela) */
(function () {
  function confere() {
    const m = document.getElementById("modal-root");
    if (document.body.classList.contains("modal-aberto") && (!m || !m.firstElementChild)) document.body.classList.remove("modal-aberto");
    const sb = document.querySelector(".sidebar.aberto");
    if (document.body.classList.contains("mn-aberto") && !sb) document.body.classList.remove("mn-aberto");
  }
  const ini = () => new MutationObserver(confere).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  if (document.body) ini(); else document.addEventListener("DOMContentLoaded", ini);
})();
