/* ---------- Ficha do empreendimento (tela própria, com abas) ---------- */
/* Substitui a antiga janela única com 8 tabelas empilhadas. Cabeçalho com os
   números principais, abas por assunto e, na aba Unidades, um mapa visual dos
   apartamentos por andar. Nenhum dado novo é criado aqui, exceto o registro de
   anotações do empreendimento (b.anotacoes) — o resto só LÊ o que já existe e
   reaproveita os mesmos formulários/modais de antes. */

let buildingDetailId = null;
let buildingDetailTab = "resumo";
let buildingUnitsMode = "grade"; // "grade" | "lista"
let buildingUnitsFilter = "todas";

function openBuildingDetail(id, tab) {
  const b = getBuilding(id);
  if (!b) return;
  if (id !== buildingDetailId) { buildingUnitsFilter = "todas"; buildingDetailTab = "resumo"; }
  buildingDetailId = id;
  if (tab) buildingDetailTab = tab;
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-building-detail").classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === "buildings"));
  document.getElementById("view-title").textContent = "Ficha do empreendimento";
  document.getElementById("view-subtitle").textContent = b.name;
  renderBuildingDetailView();
}

/* Chamado pelo renderAll(): mantém a ficha aberta em dia depois de qualquer
   edição feita em modal (cliente, empreendimento, matrizes…). */
function renderBuildingDetailIfActive() {
  const v = document.getElementById("view-building-detail");
  if (v && v.classList.contains("active")) renderBuildingDetailView();
}

function bdDados(id) {
  const b = getBuilding(id);
  const units = state.clients.filter(c => c.buildingId === id)
    .sort((a, c) => String(a.unit).localeCompare(String(c.unit), "pt-BR", { numeric: true }));
  const tickets = state.tickets.filter(t => t.buildingId === id).sort((a, c) => c.openedAt.localeCompare(a.openedAt));
  const openTickets = tickets.filter(t => OPEN_STATUSES.includes(t.status));
  const mods = state.modifications.filter(m => m.buildingId === id)
    .sort((a, c) => (c.dataSolicitacao || "").localeCompare(a.dataSolicitacao || ""));
  const modsAtivas = mods.filter(m => !MODIFICATION_CLOSED_STATUSES.includes(m.status));
  const fornecedores = state.suppliers
    .map(s => ({ s, link: (s.buildings || []).find(bl => bl.buildingId === id) })).filter(x => x.link);
  const manut = getMaintenanceRows(id);
  const mapa = buildingMapSummary(id);
  return { b, units, tickets, openTickets, mods, modsAtivas, fornecedores, manut, mapa };
}

function bdInfoUnidade(d, c) {
  return {
    vendida: unitIsVendida(d.b.id, c.unit),
    chamados: d.openTickets.filter(t => t.unit === c.unit).length,
    mods: d.modsAtivas.filter(m => m.unit === c.unit).length,
  };
}

/* ---------- Estrutura geral ---------- */

const BD_TABS = [
  { id: "resumo", label: "Resumo" },
  { id: "unidades", label: "Unidades" },
  { id: "chamados", label: "Chamados" },
  { id: "modificacoes", label: "Modificações" },
  { id: "fornecedores", label: "Fornecedores" },
  { id: "manutencao", label: "Manutenção" },
  { id: "historico", label: "Histórico" },
];

function renderBuildingDetailView() {
  const root = document.getElementById("building-detail-root");
  const b = getBuilding(buildingDetailId);
  if (!b) { buildingDetailId = null; showView("buildings"); return; }
  const d = bdDados(b.id);
  const contagem = {
    unidades: d.units.length, chamados: d.tickets.length, modificacoes: d.mods.length,
    fornecedores: d.fornecedores.length, manutencao: d.manut.length,
  };
  const entregaOuObra = b.status === "andamento"
    ? { rotulo: "Obra", valor: (b.progress || 0) + "%", sub: "em andamento" }
    : { rotulo: "Entrega", valor: b.deliveryDate ? fmtDate(b.deliveryDate) : "—", sub: BUILDING_STATUS[b.status] };

  const conteudo = ({
    resumo: bdTabResumo, unidades: bdTabUnidades, chamados: bdTabChamados, modificacoes: bdTabModificacoes,
    fornecedores: bdTabFornecedores, manutencao: bdTabManutencao, historico: bdTabHistorico,
  }[buildingDetailTab] || bdTabResumo)(d);

  root.innerHTML = `
    <div class="bd-topo">
      <button class="btn ghost" data-bd-action="voltar">← Voltar</button>
      <div class="bd-titulo">
        <h2>${escapeHtml(b.name)}</h2>
        <span class="badge outline status-tag ${b.status}">${BUILDING_STATUS[b.status]}</span>
      </div>
      <button class="btn ghost" data-bd-action="editar">Editar empreendimento</button>
    </div>
    <div class="bd-endereco hint">${escapeHtml(b.address || "Endereço não informado")}</div>

    <div class="kpi-grid bd-kpis">
      <div class="kpi-card clickable" data-bd-tab="unidades">
        <div class="kpi-label">Unidades</div>
        <div class="kpi-value">${d.mapa.total || b.units || 0}</div>
        <div class="kpi-sub">${d.mapa.vendidas} vendidas · ${d.mapa.naoVendidas} não vendidas</div>
      </div>
      <div class="kpi-card clickable ${d.openTickets.length ? "warn" : ""}" data-bd-tab="chamados">
        <div class="kpi-label">Chamados abertos</div>
        <div class="kpi-value">${d.openTickets.length}</div>
        <div class="kpi-sub">${d.tickets.length} no total</div>
      </div>
      <div class="kpi-card clickable" data-bd-tab="modificacoes">
        <div class="kpi-label">Modificações em andamento</div>
        <div class="kpi-value">${d.modsAtivas.length}</div>
        <div class="kpi-sub">${d.mods.length} no total</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${entregaOuObra.rotulo}</div>
        <div class="kpi-value bd-kpi-texto">${entregaOuObra.valor}</div>
        <div class="kpi-sub">${entregaOuObra.sub}</div>
      </div>
    </div>

    <div class="bd-tabs" role="tablist">
      ${BD_TABS.map(t => `<button type="button" role="tab" class="bd-tab ${t.id === buildingDetailTab ? "active" : ""}" data-bd-tab="${t.id}">${t.label}${contagem[t.id] !== undefined ? ` <span class="bd-count">${contagem[t.id]}</span>` : ""}</button>`).join("")}
    </div>
    <div class="bd-conteudo">${conteudo}</div>`;

  bdWireOnce(root);
  bdMontarCaptura();
}

/* Captura rápida da ficha: o elemento é criado uma vez por prédio e só é
   re-encaixado a cada renderização, pra não perder o que a pessoa digitou ou a
   prévia aberta quando um salvamento redesenha a ficha. */
let bdCaptura = null;
function bdMontarCaptura() {
  const slot = document.getElementById("bd-captura-slot");
  if (!slot) return;
  if (!bdCaptura || bdCaptura.id !== buildingDetailId) {
    const el = document.createElement("div");
    criarCapturaRapida(el, { buildingIdPadrao: buildingDetailId });
    bdCaptura = { id: buildingDetailId, el };
  }
  slot.appendChild(bdCaptura.el);
}

/* ---------- Abas ---------- */

function bdVazio(texto) { return `<div class="empty-hint">${texto}</div>`; }

function bdTabResumo(d) {
  const b = d.b;
  const garantia = b.possuiManual === true ? "Manual do Proprietário" : b.possuiManual === false ? "Norma técnica (sem manual)" : "Não classificado";
  const atencao = d.openTickets.slice(0, 5).map(t => `
    <div class="bd-item" data-open-ticket="${t.id}">
      <div><strong>${t.id}</strong> · ${escapeHtml(ticketProblemLabel(t))}<div class="hint">Unidade ${escapeHtml(t.unit)}${isAcompanhamentoPendente(t) ? " · ⏰ acompanhamento pendente" : ""}</div></div>
      <span class="badge status-${t.status}">${TICKET_STATUS_MAP[t.status]}</span>
    </div>`).join("")
    + d.modsAtivas.slice(0, 3).map(m => `
    <div class="bd-item" data-open-mod="${m.id}">
      <div><strong>${m.code}</strong> · ${escapeHtml((m.solicitacaoTexto || "").slice(0, 48))}<div class="hint">Unidade ${escapeHtml(m.unit)} · modificação</div></div>
      <span class="badge mod-status-${m.status}">${MODIFICATION_STATUS_MAP[m.status].label}</span>
    </div>`).join("");
  const maisChamados = d.openTickets.length > 5 ? `<button type="button" class="btn ghost small" data-bd-tab="chamados">Ver todos os ${d.openTickets.length} chamados abertos</button>` : "";
  const recentes = bdEventos(d).slice(0, 4);

  return `
  <div id="bd-captura-slot"></div>
  <div class="bd-grid">
    <div class="panel">
      <h3>Informações gerais</h3>
      <div class="detail-info-grid">
        <div><div class="di-label">Status</div>${BUILDING_STATUS[b.status]}</div>
        <div><div class="di-label">Unidades cadastradas</div>${d.units.length}${b.units ? ` <span class="hint">de ${b.units}</span>` : ""}</div>
        <div><div class="di-label">Base de garantia</div><span class="badge outline">${garantia}</span></div>
        <div><div class="di-label">${b.status === "andamento" ? "Progresso da obra" : "Data de entrega"}</div>${b.status === "andamento" ? (b.progress || 0) + "%" : fmtDate(b.deliveryDate)}</div>
      </div>
    </div>

    <div class="panel">
      <h3>Síndico e administradora <button type="button" class="btn ghost small bd-h3-btn" data-bd-action="sindico">Editar</button></h3>
      <div class="detail-info-grid">
        <div><div class="di-label">Síndico atual</div>${b.sindico?.nome ? escapeHtml(b.sindico.nome) : '<span class="empty-hint">não cadastrado</span>'}</div>
        <div><div class="di-label">Contato do síndico</div>${escapeHtml(b.sindico?.telefone || b.sindico?.email || "—")}</div>
        <div><div class="di-label">Administradora</div>${b.administradora?.nomeEmpresa ? escapeHtml(b.administradora.nomeEmpresa) : '<span class="empty-hint">não cadastrada</span>'}</div>
        <div><div class="di-label">Contato da administradora</div>${escapeHtml(b.administradora?.telefone || b.administradora?.email || "—")}</div>
      </div>
    </div>

    <div class="panel">
      <h3>Precisa de atenção</h3>
      ${atencao ? `<div class="bd-lista">${atencao}</div>${maisChamados}` : bdVazio("Nada em aberto neste prédio.")}
    </div>

    <div class="panel">
      <h3>Atividade recente <button type="button" class="btn ghost small bd-h3-btn" data-bd-tab="historico">Ver tudo</button></h3>
      ${recentes.length ? `<div class="bd-lista">${recentes.map(bdEventoHTML).join("")}</div>` : bdVazio("Nenhum registro ainda.")}
    </div>

    <div class="panel bd-span-2">
      <h3>Cadastros técnicos</h3>
      <div class="bd-atalhos">
        <button type="button" class="bd-atalho" data-bd-action="warranty"><strong>Matriz de Garantia</strong><span class="hint">Prazos de garantia por sistema</span></button>
        <button type="button" class="bd-atalho" data-bd-action="maint"><strong>Manutenção Preventiva</strong><span class="hint">O que verificar e com que frequência</span></button>
        <button type="button" class="bd-atalho" data-bd-action="credit"><strong>Tabela de Créditos</strong><span class="hint">Valores de crédito por item</span></button>
        <button type="button" class="bd-atalho" data-bd-action="import-manual"><strong>Importar do manual (PDF)</strong><span class="hint">Lê garantia e manutenção do Manual do Proprietário</span></button>
      </div>
    </div>
  </div>`;
}

function bdAgruparPorAndar(units) {
  const andares = new Map(), outras = [];
  units.forEach(c => {
    const m = /^(\d{1,2})(\d{2})$/.exec(String(c.unit).trim());
    if (m) { const a = +m[1]; if (!andares.has(a)) andares.set(a, []); andares.get(a).push(c); }
    else outras.push(c);
  });
  const lista = Array.from(andares.entries()).sort((x, y) => y[0] - x[0]).map(([a, us]) => ({ rotulo: `${a}º andar`, units: us }));
  if (outras.length) lista.push({ rotulo: "Outras", units: outras });
  return lista;
}

function bdTabUnidades(d) {
  const infos = new Map(d.units.map(c => [c.id, bdInfoUnidade(d, c)]));
  const filtros = [
    { id: "todas", label: "Todas", n: d.units.length, fn: () => true },
    { id: "vendidas", label: "Vendidas", n: 0, fn: i => i.vendida },
    { id: "nao_vendidas", label: "Não vendidas", n: 0, fn: i => !i.vendida },
    { id: "com_chamado", label: "Com chamado aberto", n: 0, fn: i => i.chamados > 0 },
    { id: "com_mod", label: "Com modificação", n: 0, fn: i => i.mods > 0 },
  ];
  filtros.forEach(f => { f.n = d.units.filter(c => f.fn(infos.get(c.id))).length; });
  const ativo = filtros.find(f => f.id === buildingUnitsFilter) || filtros[0];
  const visiveis = d.units.filter(c => ativo.fn(infos.get(c.id)));

  const barra = `
    <div class="bd-barra">
      <div class="chip-group bd-chips">${filtros.map(f => `<button type="button" class="chip ${f.id === ativo.id ? "active" : ""}" data-bd-filter="${f.id}">${f.label} (${f.n})</button>`).join("")}</div>
      <div class="bd-barra-acoes">
        <div class="chip-group"><button type="button" class="chip ${buildingUnitsMode === "grade" ? "active" : ""}" data-bd-mode="grade">Grade</button><button type="button" class="chip ${buildingUnitsMode === "lista" ? "active" : ""}" data-bd-mode="lista">Lista</button></div>
        <button type="button" class="btn ghost small" data-bd-action="add-client">+ Cliente</button>
        <button type="button" class="btn ghost small" data-bd-action="gen-units">Gerar unidades</button>
        <button type="button" class="btn ghost small" data-bd-action="import-units">Importar planilha</button>
      </div>
    </div>`;

  if (!d.units.length) {
    return barra + bdVazio('Nenhuma unidade cadastrada ainda. Use "Gerar unidades" pra criar os apartamentos de uma vez (andares × unidades por andar).');
  }
  if (!visiveis.length) return barra + bdVazio("Nenhuma unidade neste filtro.");

  if (buildingUnitsMode === "lista") {
    return barra + `
    <div class="table-wrap"><table class="mini-table">
      <thead><tr><th>Unidade</th><th>Cliente</th><th>Telefone</th><th>E-mail</th><th>Situação</th></tr></thead>
      <tbody>${visiveis.map(c => {
        const i = infos.get(c.id);
        return `<tr data-open-client="${c.id}" style="cursor:pointer;">
          <td><strong>${escapeHtml(c.unit)}</strong></td>
          <td>${c.name ? escapeHtml(c.name) : '<span class="empty-hint">não vendido</span>'}</td>
          <td>${escapeHtml(c.phone || "—")}</td><td>${escapeHtml(c.email || "—")}</td>
          <td>${i.chamados ? `🔧 ${i.chamados} ` : ""}${i.mods ? `📐 ${i.mods}` : ""}${!i.chamados && !i.mods ? "—" : ""}</td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>`;
  }

  const grupos = bdAgruparPorAndar(visiveis);
  return barra + `
    <div class="bd-andares">${grupos.map(g => `
      <div class="bd-andar">
        <div class="bd-andar-rotulo">${g.rotulo}</div>
        <div class="bd-tiles">${g.units.map(c => {
          const i = infos.get(c.id);
          const nome = c.name ? c.name.trim().split(/\s+/).slice(0, 2).join(" ") : "";
          const titulo = `${c.unit} — ${c.name || "não vendido"}${c.phone ? " · " + c.phone : ""}`;
          return `<button type="button" class="bd-tile ${i.vendida ? "vendido" : "nao-vendido"}" data-open-client="${c.id}" title="${escapeHtml(titulo)}">
            <strong>${escapeHtml(c.unit)}</strong>
            <span class="nome">${i.vendida ? escapeHtml(nome) : "não vendido"}</span>
            ${(i.chamados || i.mods) ? `<span class="bd-tags">${i.chamados ? `<span title="${i.chamados} chamado(s) aberto(s)">🔧${i.chamados}</span>` : ""}${i.mods ? `<span title="${i.mods} modificação(ões) em andamento">📐${i.mods}</span>` : ""}</span>` : ""}
          </button>`;
        }).join("")}</div>
      </div>`).join("")}
    </div>
    <div class="bd-legenda hint">
      <span><i class="bd-amostra vendido"></i> Vendido</span>
      <span><i class="bd-amostra nao-vendido"></i> Não vendido</span>
      <span>🔧 chamados abertos</span><span>📐 modificações em andamento</span>
    </div>`;
}

function bdTabChamados(d) {
  if (!d.tickets.length) return bdVazio("Nenhum chamado registrado para este empreendimento.");
  return `<div class="table-wrap"><table class="mini-table">
    <thead><tr><th>OS</th><th>Unidade</th><th>Problema</th><th>Prioridade</th><th>Status</th><th>Abertura</th></tr></thead>
    <tbody>${d.tickets.map(t => `<tr data-open-ticket="${t.id}" style="cursor:pointer;">
      <td>${t.id}${t.type === "obra" ? ' <span class="badge outline" style="font-size:10px;">OBRA</span>' : ""}</td>
      <td>${escapeHtml(t.unit)}</td><td>${escapeHtml(ticketProblemLabel(t))}</td>
      <td><span class="badge pr-${t.priority}">${PRIORITY_MAP[t.priority].label}</span></td>
      <td><span class="badge status-${t.status}">${TICKET_STATUS_MAP[t.status]}</span></td>
      <td>${fmtDate(t.openedAt.slice(0, 10))}</td>
    </tr>`).join("")}</tbody></table></div>`;
}

function bdTabModificacoes(d) {
  const topo = `<div class="bd-barra"><span class="hint">Solicitações de modificação de apartamento deste empreendimento.</span>
    <button type="button" class="btn ghost small" data-bd-action="mapa">Abrir Mapa de Modificações</button></div>`;
  if (!d.mods.length) return topo + bdVazio("Nenhuma modificação registrada para este empreendimento.");
  return topo + `<div class="table-wrap"><table class="mini-table">
    <thead><tr><th>Nº</th><th>Unidade</th><th>Solicitação</th><th>Status</th><th>Data</th></tr></thead>
    <tbody>${d.mods.map(m => `<tr data-open-mod="${m.id}" style="cursor:pointer;">
      <td>${m.code}</td><td>${escapeHtml(m.unit)}</td>
      <td>${escapeHtml((m.solicitacaoTexto || "").slice(0, 70))}${(m.solicitacaoTexto || "").length > 70 ? "…" : ""}</td>
      <td><span class="badge mod-status-${m.status}">${MODIFICATION_STATUS_MAP[m.status].label}</span></td>
      <td>${fmtDate(m.dataSolicitacao)}</td>
    </tr>`).join("")}</tbody></table></div>`;
}

function bdTabFornecedores(d) {
  if (!d.fornecedores.length) return bdVazio("Nenhum fornecedor vinculado a este empreendimento ainda.");
  return `<div class="table-wrap"><table class="mini-table">
    <thead><tr><th>Fornecedor</th><th>Categoria</th><th>Materiais/serviços</th><th>Chamados</th></tr></thead>
    <tbody>${d.fornecedores.map(({ s, link }) => {
      const bstats = supplierBuildingStats(s.id, d.b.id);
      const mats = (link.materiais || []);
      const resumo = mats.length ? mats.slice(0, 2).join(", ") + (mats.length > 2 ? "…" : "") : "—";
      return `<tr data-open-supplier-building="${s.id}" style="cursor:pointer;">
        <td>${escapeHtml(supplierDisplayName(s))}</td><td>${escapeHtml(link.categoria || "—")}</td>
        <td>${escapeHtml(resumo)}</td><td>${bstats.total}</td></tr>`;
    }).join("")}</tbody></table></div>`;
}

function bdTabManutencao(d) {
  const topo = `<div class="bd-barra"><span class="hint">Itens de manutenção preventiva do empreendimento.</span>
    <button type="button" class="btn ghost small" data-bd-action="maint">Editar manutenção preventiva</button></div>`;
  if (!d.manut.length) return topo + bdVazio("Nenhum item de manutenção preventiva cadastrado ainda.");
  return topo + `<div class="table-wrap"><table class="mini-table">
    <thead><tr><th>Sistema</th><th>Item</th><th>O que verificar</th><th>Periodicidade</th></tr></thead>
    <tbody>${d.manut.map(r => `<tr>
      <td>${escapeHtml(r.sistema)}</td><td>${escapeHtml(r.componente || "—")}</td>
      <td>${escapeHtml(r.oQueVerificar || "—")}</td><td>${escapeHtml(r.periodicidade || "—")}</td>
    </tr>`).join("")}</tbody></table></div>`;
}

/* Linha do tempo única do prédio: anotações + chamados abertos/encerrados +
   modificações solicitadas, do mais recente pro mais antigo. */
function bdEventos(d) {
  const ev = [];
  (d.b.anotacoes || []).forEach(a => ev.push({
    data: a.data || "", icone: "📝", titulo: a.texto,
    meta: `${a.autor || "—"}${a.unit ? " · unidade " + a.unit : ""}${a.origem ? " · " + a.origem : ""}`,
  }));
  d.tickets.forEach(t => {
    ev.push({ data: t.openedAt.slice(0, 10), icone: "🛠️", titulo: `Chamado ${t.id} aberto — ${ticketProblemLabel(t)}`, meta: `Unidade ${t.unit}`, ticket: t.id });
    const fechado = ticketClosedAt(t);
    if (fechado) ev.push({ data: fechado, icone: "✅", titulo: `Chamado ${t.id} encerrado`, meta: `Unidade ${t.unit}`, ticket: t.id });
  });
  d.mods.forEach(m => ev.push({
    data: m.dataSolicitacao || "", icone: "📐", titulo: `${m.code} solicitada — ${(m.solicitacaoTexto || "").slice(0, 60)}`,
    meta: `Unidade ${m.unit}`, mod: m.id,
  }));
  // mesmo dia: o que foi registrado depois aparece primeiro
  ev.forEach((e, i) => { e.seq = i; });
  return ev.sort((a, c) => (c.data || "").localeCompare(a.data || "") || c.seq - a.seq);
}
function bdEventoHTML(e) {
  const attr = e.ticket ? `data-open-ticket="${e.ticket}"` : e.mod ? `data-open-mod="${e.mod}"` : "";
  return `<div class="bd-evento ${attr ? "clicavel" : ""}" ${attr}>
    <span class="bd-evento-icone">${e.icone}</span>
    <div><div>${escapeHtml(e.titulo)}</div><div class="hint">${e.data ? fmtDate(e.data) : "sem data"}${e.meta ? " · " + escapeHtml(e.meta) : ""}</div></div>
  </div>`;
}

function bdTabHistorico(d) {
  const eventos = bdEventos(d);
  return `
  <div class="panel bd-nova-nota">
    <h3>Registrar anotação</h3>
    <div class="bd-nota-form">
      <input type="text" id="bd-nota-texto" placeholder="Ex: pintores fazendo reparos na fachada">
      <input type="text" id="bd-nota-unit" placeholder="Unidade (opcional)" style="max-width:160px;">
      <button type="button" class="btn primary small" data-bd-action="add-nota">Registrar</button>
    </div>
  </div>
  ${eventos.length ? `<div class="bd-lista bd-timeline">${eventos.map(bdEventoHTML).join("")}</div>` : bdVazio("Nenhum registro ainda.")}`;
}

/* ---------- Eventos (delegados, ligados uma única vez) ---------- */

function bdWireOnce(root) {
  if (root.dataset.wired) return;
  root.dataset.wired = "1";
  root.addEventListener("click", (e) => {
    const el = e.target.closest("[data-bd-tab],[data-bd-action],[data-bd-filter],[data-bd-mode],[data-open-ticket],[data-open-client],[data-open-mod],[data-open-supplier-building]");
    if (!el || !root.contains(el)) return;
    const id = buildingDetailId;
    if (el.dataset.bdTab) { buildingDetailTab = el.dataset.bdTab; renderBuildingDetailView(); return; }
    if (el.dataset.bdFilter) { buildingUnitsFilter = el.dataset.bdFilter; renderBuildingDetailView(); return; }
    if (el.dataset.bdMode) { buildingUnitsMode = el.dataset.bdMode; renderBuildingDetailView(); return; }
    if (el.dataset.openTicket) { goToTicketDetail(el.dataset.openTicket); return; }
    if (el.dataset.openMod) { goToModificationDetail(el.dataset.openMod); return; }
    if (el.dataset.openClient) { openClientForm(el.dataset.openClient); return; }
    if (el.dataset.openSupplierBuilding) { openSupplierBuildingModal(el.dataset.openSupplierBuilding, id); return; }
    switch (el.dataset.bdAction) {
      case "voltar": showView("buildings"); break;
      case "editar": openBuildingForm(id); break;
      case "sindico": openSindicoAdminForm(id); break;
      case "warranty": openWarrantyMatrixModal(id); break;
      case "maint": openMaintenanceMatrixModal(id); break;
      case "credit": openCreditTableModal(id); break;
      case "import-manual": openManualImport(id); break;
      case "add-client": openClientForm(null, id); break;
      case "gen-units": openGerarUnidadesForm(id); break;
      case "import-units": openImportModal("clientes", id); break;
      case "mapa": goToModificationsMap(); break;
      case "add-nota": bdRegistrarNota(id); break;
    }
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.id === "bd-nota-texto") { e.preventDefault(); bdRegistrarNota(buildingDetailId); }
  });
}

function bdRegistrarNota(id) {
  const b = getBuilding(id);
  const texto = (document.getElementById("bd-nota-texto").value || "").trim();
  if (!b || !texto) { toast("Escreva a anotação antes de registrar.", "error"); return; }
  if (!b.anotacoes) b.anotacoes = [];
  b.anotacoes.push({
    id: "an" + Date.now() + Math.random().toString(36).slice(2, 6),
    data: todayISODate(), autor: ensureOperatorName(),
    unit: (document.getElementById("bd-nota-unit").value || "").trim(), texto,
  });
  persist();
  renderBuildingDetailView();
  toast("Anotação registrada.", "success");
}
