/* ---------- Relatórios ---------- */
/* Três visões na mesma tela: Por empreendimento, Painel gerencial e Exportar
   (CSV). Tela e PDF usam a MESMA função de cálculo (calcRelatorioEmpreendimento
   / calcPainelGerencial) — nunca duas lógicas — pra os números não divergirem.
   Só LÊ dados existentes, não cria nem altera nada. */

let rpTab = "engenharia";
let rpPeriodoTipo = "ultimos90";
let rpDe = "", rpAte = "";
let rpBuildingId = "";

const RP_PERIODOS = [
  ["mes_atual", "Este mês"], ["mes_passado", "Mês passado"], ["ultimos90", "Últimos 90 dias"],
  ["ano", "Este ano"], ["personalizado", "Personalizado"], ["tudo", "Tudo"],
];
const RP_TABS = [
  { id: "engenharia", label: "Causas dos problemas (Engenharia)" },
  { id: "empreendimento", label: "Por empreendimento" },
  { id: "gerencial", label: "Painel gerencial" },
  { id: "exportar", label: "Exportar (Excel/CSV)" },
];

/* ---------- Período ---------- */

function rpCap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function rpIso(y, m, d) { return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }

function rpIntervalo() {
  const hoje = todayISODate();
  const [y, m] = hoje.split("-").map(Number);
  const ultimoDia = (yy, mm) => new Date(yy, mm, 0).getDate();
  if (rpPeriodoTipo === "mes_atual") return { de: rpIso(y, m, 1), ate: rpIso(y, m, ultimoDia(y, m)), label: `${rpCap(MESES_PT[m - 1])} de ${y}` };
  if (rpPeriodoTipo === "mes_passado") {
    const mm = m === 1 ? 12 : m - 1, yy = m === 1 ? y - 1 : y;
    return { de: rpIso(yy, mm, 1), ate: rpIso(yy, mm, ultimoDia(yy, mm)), label: `${rpCap(MESES_PT[mm - 1])} de ${yy}` };
  }
  if (rpPeriodoTipo === "ultimos90") {
    const d = toLocalDate(hoje); d.setDate(d.getDate() - 89);
    return { de: toISODateString(d), ate: hoje, label: `Últimos 90 dias (${fmtDate(toISODateString(d))} a ${fmtDate(hoje)})` };
  }
  if (rpPeriodoTipo === "ano") return { de: rpIso(y, 1, 1), ate: rpIso(y, 12, 31), label: `Ano de ${y}` };
  if (rpPeriodoTipo === "personalizado") return { de: rpDe, ate: rpAte, label: `${rpDe ? fmtDate(rpDe) : "início"} a ${rpAte ? fmtDate(rpAte) : "hoje"}` };
  return { de: "", ate: "", label: "Todo o período" };
}
function rpNoPeriodo(iso, p) {
  if (!iso) return false;
  return (!p.de || iso >= p.de) && (!p.ate || iso <= p.ate);
}
function rpDias(n) { return n === null ? "—" : n.toFixed(1).replace(".", ",") + " dias"; }

/* ---------- Cálculo (fonte única de números) ---------- */

/* Chamado importado de planilha como "concluído" sem data de encerramento fica
   com a data de abertura no lugar — não pode entrar no tempo médio (daria 0 dias). */
function rpTemDataEncerramento(t) { return !(t.encerramento && t.encerramento.semDataEncerramento); }

function rpContar(lista, chaveFn) {
  const m = new Map();
  lista.forEach(x => { const k = chaveFn(x); m.set(k, (m.get(k) || 0) + 1); });
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

function calcRelatorioEmpreendimento(buildingId, p) {
  const b = getBuilding(buildingId);
  const todos = state.tickets.filter(t => t.buildingId === buildingId);
  const abertosPeriodo = todos.filter(t => rpNoPeriodo(t.openedAt.slice(0, 10), p));
  const encerradosPeriodo = todos.filter(t => { const c = ticketClosedAt(t); return c && rpNoPeriodo(c, p); });
  const emAberto = todos.filter(t => OPEN_STATUSES.includes(t.status));
  const atrasados = emAberto.filter(isAcompanhamentoPendente);
  const duracoes = encerradosPeriodo.filter(rpTemDataEncerramento)
    .map(t => daysDiff(t.openedAt.slice(0, 10), ticketClosedAt(t))).filter(n => n >= 0);
  const tempoMedio = duracoes.length ? duracoes.reduce((a, c) => a + c, 0) / duracoes.length : null;
  const reincidencias = abertosPeriodo.filter(t => findSameUnitReincidence(t));
  const idsLista = new Set([...abertosPeriodo, ...encerradosPeriodo].map(t => t.id));
  const lista = todos.filter(t => idsLista.has(t.id)).sort((a, c) => c.openedAt.localeCompare(a.openedAt));
  const pendencias = emAberto.slice().sort((a, c) =>
    (isAcompanhamentoPendente(c) ? 1 : 0) - (isAcompanhamentoPendente(a) ? 1 : 0) || a.openedAt.localeCompare(c.openedAt));
  const mods = state.modifications.filter(m => m.buildingId === buildingId);
  const modsPeriodo = mods.filter(m => rpNoPeriodo(m.dataSolicitacao, p)).sort((a, c) => (c.dataSolicitacao || "").localeCompare(a.dataSolicitacao || ""));
  const modsAtivas = mods.filter(m => !MODIFICATION_CLOSED_STATUSES.includes(m.status));
  return {
    b, p, todos, abertosPeriodo, encerradosPeriodo, emAberto, atrasados, tempoMedio, reincidencias, lista, pendencias,
    porCategoria: rpContar(abertosPeriodo, ticketSistema),
    porStatus: rpContar(abertosPeriodo, t => TICKET_STATUS_MAP[t.status] || t.status),
    modsPeriodo, modsAtivas,
    modsPorStatus: rpContar(modsPeriodo, m => MODIFICATION_STATUS_MAP[m.status].label),
    anotacoes: (b.anotacoes || []).filter(a => rpNoPeriodo(a.data, p)).slice().reverse(),
    mapa: buildingMapSummary(buildingId),
  };
}

function calcPainelGerencial(p) {
  const linhas = state.buildings.map(b => {
    const r = calcRelatorioEmpreendimento(b.id, p);
    return {
      b, unidades: r.mapa.total, vendidas: r.mapa.vendidas, abertosPeriodo: r.abertosPeriodo.length,
      encerrados: r.encerradosPeriodo.length, emAberto: r.emAberto.length, atrasados: r.atrasados.length,
      tempoMedio: r.tempoMedio, modsAtivas: r.modsAtivas.length, r,
    };
  });
  const todosAbertosPeriodo = linhas.flatMap(l => l.r.abertosPeriodo);
  const duracoes = linhas.flatMap(l => l.r.encerradosPeriodo.filter(rpTemDataEncerramento).map(t => daysDiff(t.openedAt.slice(0, 10), ticketClosedAt(t)))).filter(n => n >= 0);
  const totais = {
    unidades: linhas.reduce((a, l) => a + l.unidades, 0),
    abertosPeriodo: linhas.reduce((a, l) => a + l.abertosPeriodo, 0),
    encerrados: linhas.reduce((a, l) => a + l.encerrados, 0),
    emAberto: linhas.reduce((a, l) => a + l.emAberto, 0),
    atrasados: linhas.reduce((a, l) => a + l.atrasados, 0),
    modsAtivas: linhas.reduce((a, l) => a + l.modsAtivas, 0),
    tempoMedio: duracoes.length ? duracoes.reduce((a, c) => a + c, 0) / duracoes.length : null,
  };
  // fornecedores: acionamentos no período + quantos estão sem retorno hoje
  const forn = new Map();
  state.tickets.forEach(t => (t.fornecedores || []).forEach(link => {
    const e = forn.get(link.supplierId) || { acionamentos: 0, semRetorno: 0 };
    if (rpNoPeriodo(link.dataAcionamento, p)) e.acionamentos++;
    if (isFornecedorSemRetorno(t, link)) e.semRetorno++;
    forn.set(link.supplierId, e);
  }));
  const fornecedores = Array.from(forn.entries())
    .map(([id, e]) => ({ s: getSupplier(id), ...e })).filter(x => x.s && (x.acionamentos || x.semRetorno))
    .sort((a, c) => c.semRetorno - a.semRetorno || c.acionamentos - a.acionamentos).slice(0, 10);
  return {
    p, linhas, totais, fornecedores,
    porCategoria: rpContar(todosAbertosPeriodo, ticketSistema).slice(0, 10),
    reincidencias: todosAbertosPeriodo.filter(t => findSameUnitReincidence(t)),
  };
}

/* Engenharia: só conta chamado concluído como "Reparo concluído" com o sistema
   real confirmado no encerramento (data de encerramento dentro do período).
   Chamado ainda aberto aparece à parte, pelo sistema INFORMADO, nunca misturado. */
function calcRelatorioEngenharia(buildingId, p) {
  const b = buildingId ? getBuilding(buildingId) : null;
  const pool = state.tickets.filter(t => !buildingId || t.buildingId === buildingId);
  const itens = [];
  pool.forEach(t => {
    const e = t.encerramento || {};
    const fechado = ticketClosedAt(t);
    if (e.resultadoTipo !== "reparo_concluido" || !e.sistemaReal || !fechado || !rpNoPeriodo(fechado, p)) return;
    itens.push({ t, sistema: e.sistemaReal, informado: t.category || "Outros", causa: ticketCausaReal(t),
      divergente: e.sistemaConfirmado === "nao", predio: (getBuilding(t.buildingId) || {}).name || "—", fechado });
  });

  const mc = new Map();
  itens.forEach(i => {
    const k = (i.causa ? causaChave(i.causa) : "?") + "|" + i.sistema;
    let e = mc.get(k);
    if (!e) { e = { causa: i.causa || "Causa não informada", sistema: i.sistema, n: 0, predios: new Map() }; mc.set(k, e); }
    e.n++;
    e.predios.set(i.predio, (e.predios.get(i.predio) || 0) + 1);
  });
  const porCausa = Array.from(mc.values()).sort((a, c) => c.n - a.n);
  const porSistema = rpContar(itens, i => i.sistema);

  const colunasTop = porSistema.slice(0, 7).map(x => x[0]);
  const colunas = porSistema.length > 7 ? [...colunasTop, "Demais"] : colunasTop;
  const mp = new Map();
  itens.forEach(i => {
    let e = mp.get(i.predio);
    if (!e) { e = { nome: i.predio, cel: new Map(), total: 0 }; mp.set(i.predio, e); }
    const col = colunasTop.includes(i.sistema) ? i.sistema : "Demais";
    e.cel.set(col, (e.cel.get(col) || 0) + 1);
    e.total++;
  });
  const linhasMatriz = Array.from(mp.values()).sort((a, c) => c.total - a.total);
  const maxCel = Math.max(1, ...linhasMatriz.flatMap(l => Array.from(l.cel.values())));

  const mf = new Map();
  itens.filter(i => i.divergente).forEach(i => {
    const k = i.informado + "\u0001" + i.sistema;
    const e = mf.get(k) || { de: i.informado, para: i.sistema, n: 0 };
    e.n++; mf.set(k, e);
  });
  const fluxos = Array.from(mf.values()).sort((a, c) => c.n - a.n);

  const abertos = pool.filter(t => OPEN_STATUSES.includes(t.status));
  const custoMap = new Map(); let custoTotal = 0;
  pool.forEach(t => { const c = typeof ckTotalDespesas === "function" ? ckTotalDespesas(t) : 0; if (c > 0) { const k = ticketSistema(t) || "Outros"; custoMap.set(k, (custoMap.get(k) || 0) + c); custoTotal += c; } });
  const custoPorSistema = Array.from(custoMap.entries()).sort((x, y) => y[1] - x[1]);
  const proc = { sim: 0, nao: 0, aval: 0 };
  pool.forEach(t => { if (t.procedente === "sim") proc.sim++; else if (t.procedente === "nao") proc.nao++; else proc.aval++; });
  return {
    custoPorSistema, custoTotal, proc,
    b, p, itens, porCausa, porSistema, colunas, linhasMatriz, maxCel, fluxos,
    divergentes: itens.filter(i => i.divergente).length,
    emInvestigacao: rpContar(abertos, t => t.category || "Outros"), totalAbertos: abertos.length,
    lista: itens.slice().sort((a, c) => c.fechado.localeCompare(a.fechado)),
  };
}

/* ---------- Tela ---------- */

function rpBuildingAtual() {
  if (!rpBuildingId || !getBuilding(rpBuildingId)) rpBuildingId = state.buildings.length ? state.buildings[0].id : "";
  return rpBuildingId;
}
function renderReportsIfActive() {
  const v = document.getElementById("view-reports");
  if (v && v.classList.contains("active")) renderReports();
}

function rpTodosOsPredios() { return rpTab === "exportar" || rpTab === "engenharia"; }

function rpFiltrosHTML() {
  const mostraPredio = rpTab !== "gerencial";
  return `
  <div class="panel rp-filtros">
    <div class="field"><label>Período</label>
      <select id="rp-periodo">${RP_PERIODOS.map(([id, l]) => `<option value="${id}" ${id === rpPeriodoTipo ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    ${rpPeriodoTipo === "personalizado" ? `
      <div class="field"><label>De</label><input type="date" id="rp-de" value="${rpDe}"></div>
      <div class="field"><label>Até</label><input type="date" id="rp-ate" value="${rpAte}"></div>` : ""}
    ${mostraPredio ? `<div class="field rp-f-predio"><label>Empreendimento</label>
      <select id="rp-predio">${rpTodosOsPredios() ? `<option value="">Todos os empreendimentos</option>` : ""}${state.buildings.map(b => `<option value="${b.id}" ${(rpTodosOsPredios() ? rpBuildingId : rpBuildingAtual()) === b.id ? "selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}</select></div>` : ""}
  </div>`;
}

function renderReports() {
  const root = document.getElementById("reports-root");
  if (!root) return;
  if (!state.buildings.length) { root.innerHTML = `<div class="panel"><div class="empty-hint">Cadastre um empreendimento para gerar relatórios.</div></div>`; return; }
  const p = rpIntervalo();
  const corpo = rpTab === "engenharia" ? rpHTMLEngenharia(calcRelatorioEngenharia(rpBuildingId && getBuilding(rpBuildingId) ? rpBuildingId : "", p))
    : rpTab === "gerencial" ? rpHTMLGerencial(calcPainelGerencial(p))
    : rpTab === "exportar" ? rpHTMLExportar(p)
    : rpHTMLEmpreendimento(calcRelatorioEmpreendimento(rpBuildingAtual(), p));
  root.innerHTML = `
    <div class="bd-tabs">${RP_TABS.map(t => `<button type="button" class="bd-tab ${t.id === rpTab ? "active" : ""}" data-rp-tab="${t.id}">${t.label}</button>`).join("")}</div>
    ${rpFiltrosHTML()}
    <div class="rp-corpo">${corpo}</div>`;
  rpWireOnce(root);
}

function rpKpi(label, valor, sub, cls) {
  return `<div class="kpi-card ${cls || ""}"><div class="kpi-label">${label}</div><div class="kpi-value">${valor}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ""}</div>`;
}
function rpBarras(pares) {
  if (!pares.length) return `<div class="empty-hint">Nenhum chamado no período.</div>`;
  const max = Math.max(...pares.map(x => x[1]));
  return `<div class="rp-barras">${pares.map(([nome, n]) => `
    <div class="rp-barra-linha"><span class="rp-barra-nome">${escapeHtml(nome)}</span>
      <span class="rp-barra-trilho"><span class="rp-barra-fill" style="width:${Math.max(4, Math.round(n / max * 100))}%"></span></span>
      <strong>${n}</strong></div>`).join("")}</div>`;
}
function rpTabela(head, linhas, vazio) {
  if (!linhas.length) return `<div class="empty-hint">${vazio}</div>`;
  return `<div class="table-wrap"><table class="mini-table"><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${linhas.map(l => `<tr ${l.attr || ""}>${l.cells.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function rpLinhasChamados(lista) {
  return lista.map(t => ({
    attr: `data-open-ticket="${t.id}" style="cursor:pointer;"`,
    cells: [t.id, escapeHtml(t.unit), escapeHtml(ticketProblemLabel(t)),
      `<span class="badge status-${t.status}">${TICKET_STATUS_MAP[t.status]}</span>`,
      fmtDate(t.openedAt.slice(0, 10)), ticketClosedAt(t) ? fmtDate(ticketClosedAt(t)) : "—"],
  }));
}

function rpHTMLEmpreendimento(r) {
  const nota = `<p class="hint rp-legenda">Tempo médio = média entre abertura e encerramento dos chamados encerrados no período. Atrasado = acompanhamento pendente hoje. Reincidência = problema repetido na mesma unidade e categoria depois de um chamado já encerrado.</p>`;
  return `
  <div class="rp-acoes">
    <div><h2 class="rp-titulo">${escapeHtml(r.b.name)}</h2><span class="hint">${r.p.label}</span></div>
    <div class="rp-botoes"><button type="button" class="btn primary" data-rp-acao="pdf-predio">Gerar PDF</button>
      <button type="button" class="btn ghost" data-rp-acao="csv-chamados-predio">Exportar chamados (CSV)</button></div>
  </div>
  <div class="kpi-grid">
    ${rpKpi("Abertos no período", r.abertosPeriodo.length)}
    ${rpKpi("Encerrados no período", r.encerradosPeriodo.length)}
    ${rpKpi("Em aberto hoje", r.emAberto.length)}
    ${rpKpi("Atrasados", r.atrasados.length, "", r.atrasados.length ? "warn" : "good")}
    ${rpKpi("Tempo médio de resolução", rpDias(r.tempoMedio))}
    ${rpKpi("Reincidências", r.reincidencias.length, "", r.reincidencias.length ? "warn" : "")}
  </div>
  ${nota}
  <div class="rp-grid">
    <div class="panel"><h3>Chamados por categoria</h3>${rpBarras(r.porCategoria)}</div>
    <div class="panel"><h3>Chamados por status</h3>${rpBarras(r.porStatus)}</div>
  </div>
  <div class="panel rp-bloco"><h3>Chamados do período (${r.lista.length})</h3>
    ${rpTabela(["OS", "Unidade", "Problema", "Status", "Abertura", "Encerramento"], rpLinhasChamados(r.lista), "Nenhum chamado aberto ou encerrado neste período.")}</div>
  <div class="panel rp-bloco"><h3>Pendências em aberto hoje (${r.pendencias.length})</h3>
    ${rpTabela(["OS", "Unidade", "Problema", "Status", "Próxima ação", "Data"], r.pendencias.map(t => { const px = proximaAcaoDisplay(t); return {
      attr: `data-open-ticket="${t.id}" style="cursor:pointer;"`,
      cells: [t.id, escapeHtml(t.unit), escapeHtml(ticketProblemLabel(t)), `<span class="badge status-${t.status}">${TICKET_STATUS_MAP[t.status]}</span>`,
        escapeHtml(px.texto || "—"), (px.data ? fmtDate(px.data) : "—") + (isAcompanhamentoPendente(t) ? " ⏰" : "")],
    }; }), "Nenhuma pendência em aberto.")}</div>
  <div class="panel rp-bloco"><h3>Modificações (${r.modsPeriodo.length} solicitadas no período · ${r.modsAtivas.length} em andamento)</h3>
    ${rpTabela(["Nº", "Unidade", "Solicitação", "Status", "Data"], r.modsPeriodo.map(m => ({
      attr: `data-open-mod="${m.id}" style="cursor:pointer;"`,
      cells: [m.code, escapeHtml(m.unit), escapeHtml((m.solicitacaoTexto || "").slice(0, 80)),
        `<span class="badge mod-status-${m.status}">${MODIFICATION_STATUS_MAP[m.status].label}</span>`, fmtDate(m.dataSolicitacao)],
    })), "Nenhuma modificação solicitada neste período.")}</div>
  <div class="rp-grid">
    <div class="panel"><h3>Anotações do período (${r.anotacoes.length})</h3>
      ${r.anotacoes.length ? `<div class="bd-lista">${r.anotacoes.map(a => `<div class="bd-evento"><span class="bd-evento-icone">📝</span><div><div>${escapeHtml(a.texto)}</div><div class="hint">${fmtDate(a.data)}${a.unit ? " · unidade " + escapeHtml(a.unit) : ""}</div></div></div>`).join("")}</div>` : `<div class="empty-hint">Nenhuma anotação no período.</div>`}</div>
    <div class="panel"><h3>Unidades</h3><div class="detail-info-grid">
      <div><div class="di-label">Cadastradas</div>${r.mapa.total}</div><div><div class="di-label">Vendidas</div>${r.mapa.vendidas}</div>
      <div><div class="di-label">Não vendidas</div>${r.mapa.naoVendidas}</div><div><div class="di-label">Com modificação</div>${r.mapa.comModificacao}</div></div></div>
  </div>`;
}

function rpPct(n, total) { return total ? Math.round(n / total * 100) : 0; }

function rpHTMLEngenharia(r) {
  const escopo = r.b ? escapeHtml(r.b.name) : "Todos os empreendimentos";
  const total = r.itens.length;
  const topo = r.porCausa[0];
  const topoSis = r.porSistema[0];
  const acoes = `
  <div class="rp-acoes">
    <div><h2 class="rp-titulo">Causas dos problemas — ${escopo}</h2><span class="hint">${r.p.label} · chamados concluídos com a causa confirmada</span></div>
    <div class="rp-botoes"><button type="button" class="btn primary" data-rp-acao="pdf-engenharia" ${total ? "" : "disabled"}>Gerar PDF</button></div>
  </div>`;
  const decididos = r.proc.sim + r.proc.nao;
  const extraHTML = `
  <div class="panel rp-bloco"><h3>Garantia: procedentes e improcedentes</h3>
    ${decididos ? `<p><strong>${Math.round(r.proc.sim / decididos * 100)}%</strong> dos ${decididos} chamados avaliados são procedentes (${r.proc.sim} sim, ${r.proc.nao} não). ${r.proc.aval} ainda sem avaliação.</p>` : `<div class="empty-hint">Marque “Procedente / Improcedente” dentro do chamado para ver a proporção aqui.</div>`}</div>
  <div class="panel rp-bloco"><h3>Gastos com visitas por sistema${r.custoTotal ? " — total " + ckBRL(r.custoTotal) : ""}</h3>
    ${r.custoPorSistema.length ? `<div class="eng-fluxos">${r.custoPorSistema.map(([k, v]) => `<div class="eng-fluxo"><span>${escapeHtml(k)}</span><span></span><strong>${ckBRL(v)}</strong></div>`).join("")}</div>` : `<div class="empty-hint">Nenhum gasto registrado ainda. Ao marcar “Foi feito”, informe quanto gastou.</div>`}</div>`;
  const abertosHTML = extraHTML + `
  <div class="panel rp-bloco"><h3>Ainda em aberto (${r.totalAbertos}) — sistema informado, causa ainda não confirmada</h3>
    ${rpBarras(r.emInvestigacao)}</div>`;
  if (!total) {
    return `${acoes}
    <div class="panel"><div class="empty-hint">Nenhum chamado concluído com causa confirmada neste período. A causa é registrada ao encerrar um chamado como “Reparo concluído”.</div></div>
    ${abertosHTML}`;
  }
  const max = Math.max(...r.porCausa.map(c => c.n));
  const causasHTML = r.porCausa.slice(0, 12).map((c, i) => {
    const prediosOrd = Array.from(c.predios.entries()).sort((a, d) => d[1] - a[1]);
    const mostra = r.b ? [] : prediosOrd.slice(0, 4);
    const resto = r.b ? 0 : prediosOrd.length - mostra.length;
    return `
    <div class="eng-causa">
      <div class="eng-pos">${i + 1}</div>
      <div>
        <div class="eng-causa-nome">${escapeHtml(rpCap(c.causa))}</div>
        <div class="eng-causa-meta"><span class="eng-tag">${escapeHtml(c.sistema)}</span>
          ${mostra.map(([nome, n]) => `<span class="eng-tag pred">${escapeHtml(nome)} · ${n}</span>`).join("")}
          ${resto > 0 ? `<span class="eng-tag pred">+${resto} empreend.</span>` : ""}</div>
      </div>
      <div class="eng-barra"><span class="rp-barra-trilho"><span class="rp-barra-fill" style="width:${Math.max(4, Math.round(c.n / max * 100))}%"></span></span><strong>${c.n}</strong></div>
    </div>`;
  }).join("");

  const matrizHTML = r.b ? rpBarras(r.porSistema) : `
    <div class="table-wrap"><table class="eng-heat">
      <thead><tr><th>Empreendimento</th>${r.colunas.map(c => `<th>${escapeHtml(c)}</th>`).join("")}<th>Total</th></tr></thead>
      <tbody>${r.linhasMatriz.map(l => `<tr><td>${escapeHtml(l.nome)}</td>${r.colunas.map(c => {
        const n = l.cel.get(c) || 0;
        if (!n) return `<td></td>`;
        const a = 0.14 + 0.78 * (n / r.maxCel);
        return `<td class="eng-heat-cell" style="background:rgba(226,80,74,${a.toFixed(2)});color:${a > 0.55 ? "#fff" : "var(--text)"};">${n}</td>`;
      }).join("")}<td class="eng-heat-total">${l.total}</td></tr>`).join("")}</tbody></table></div>`;

  const fluxoHTML = r.fluxos.length ? r.fluxos.map(f => `
    <div class="eng-fluxo"><span>${escapeHtml(f.de)}</span><span class="eng-seta">→</span><span><strong style="text-align:left;">${escapeHtml(f.para)}</strong></span><strong>${f.n}</strong></div>`).join("")
    : `<div class="empty-hint">Em todos os chamados do período o sistema informado na abertura estava certo.</div>`;

  return `${acoes}
  <div class="kpi-grid">
    ${rpKpi("Problemas confirmados", total, "chamados com causa registrada")}
    ${rpKpi("Diagnóstico inicial errado", r.divergentes, `${rpPct(r.divergentes, total)}% dos confirmados`, r.divergentes ? "warn" : "good")}
    ${rpKpi("Causa nº 1", topo ? topo.n + (topo.n === 1 ? " chamado" : " chamados") : "—", topo ? escapeHtml(rpCap(topo.causa)) : "")}
    ${rpKpi("Sistema mais afetado", topoSis ? escapeHtml(topoSis[0]) : "—", topoSis ? topoSis[1] + " chamados" : "")}
  </div>
  <div class="panel rp-bloco"><h3>Principais causas dos problemas</h3><div class="eng-causas">${causasHTML}</div>
    ${r.porCausa.length > 12 ? `<p class="hint">Mostrando as 12 principais de ${r.porCausa.length} causas. O PDF traz a lista completa.</p>` : ""}</div>
  <div class="panel rp-bloco"><h3>${r.b ? "Sistemas com problema" : "Onde acontece: empreendimento × sistema"}</h3>${matrizHTML}</div>
  <div class="rp-grid">
    <div class="panel"><h3>Informado na abertura → o que era de verdade</h3>${fluxoHTML}</div>
    ${abertosHTML.replace('panel rp-bloco', 'panel')}
  </div>
  <div class="panel rp-bloco"><h3>Chamados confirmados (${total})</h3>
    ${rpTabela(["OS", "Empreendimento", "Unidade", "Informado", "Sistema real", "Causa", "Encerrado"], r.lista.map(i => ({
      attr: `data-open-ticket="${i.t.id}" style="cursor:pointer;"`,
      cells: [i.t.id, escapeHtml(i.predio), escapeHtml(i.t.unit), escapeHtml(i.informado), i.divergente ? `<strong>${escapeHtml(i.sistema)}</strong>` : escapeHtml(i.sistema), escapeHtml(i.causa || "—"), fmtDate(i.fechado)],
    })), "Nenhum chamado.")}</div>
  <p class="hint rp-legenda">Só entram chamados encerrados como “Reparo concluído” no período. O sistema real é o confirmado no encerramento; quando ele difere do informado na abertura, aparece em negrito na lista.</p>`;
}

function rpHTMLGerencial(g) {
  const t = g.totais;
  return `
  <div class="rp-acoes">
    <div><h2 class="rp-titulo">Painel gerencial — todos os empreendimentos</h2><span class="hint">${g.p.label}</span></div>
    <div class="rp-botoes"><button type="button" class="btn primary" data-rp-acao="pdf-gerencial">Gerar PDF</button></div>
  </div>
  <div class="kpi-grid">
    ${rpKpi("Empreendimentos", g.linhas.length, `${t.unidades} unidades`)}
    ${rpKpi("Abertos no período", t.abertosPeriodo)}
    ${rpKpi("Encerrados no período", t.encerrados)}
    ${rpKpi("Em aberto hoje", t.emAberto)}
    ${rpKpi("Atrasados", t.atrasados, "", t.atrasados ? "warn" : "good")}
    ${rpKpi("Tempo médio de resolução", rpDias(t.tempoMedio))}
  </div>
  <div class="panel rp-bloco"><h3>Por empreendimento</h3>
    ${rpTabela(["Empreendimento", "Unid.", "Abertos no período", "Encerrados", "Em aberto hoje", "Atrasados", "Tempo médio", "Modif. em andamento"],
      g.linhas.slice().sort((a, c) => c.emAberto - a.emAberto || c.abertosPeriodo - a.abertosPeriodo).map(l => ({
        attr: `data-open-building="${l.b.id}" style="cursor:pointer;"`,
        cells: [escapeHtml(l.b.name), l.unidades, l.abertosPeriodo, l.encerrados, l.emAberto, l.atrasados ? `<strong>${l.atrasados}</strong>` : 0, rpDias(l.tempoMedio), l.modsAtivas],
      })), "Nenhum empreendimento.")}</div>
  <div class="rp-grid">
    <div class="panel"><h3>Categorias que mais se repetem</h3>${rpBarras(g.porCategoria)}</div>
    <div class="panel"><h3>Fornecedores</h3>
      ${rpTabela(["Fornecedor", "Acionamentos no período", "Sem retorno hoje"], g.fornecedores.map(f => ({ cells: [escapeHtml(supplierDisplayName(f.s)), f.acionamentos, f.semRetorno ? `<strong>${f.semRetorno}</strong>` : 0] })), "Nenhum fornecedor acionado.")}</div>
  </div>
  <div class="panel rp-bloco"><h3>Reincidências no período (${g.reincidencias.length})</h3>
    ${rpTabela(["OS", "Empreendimento", "Unidade", "Categoria", "Abertura"], g.reincidencias.map(x => ({
      attr: `data-open-ticket="${x.id}" style="cursor:pointer;"`,
      cells: [x.id, escapeHtml((getBuilding(x.buildingId) || {}).name || "—"), escapeHtml(x.unit), escapeHtml(ticketSistema(x)), fmtDate(x.openedAt.slice(0, 10))],
    })), "Nenhuma reincidência no período.")}</div>`;
}

function rpHTMLExportar(p) {
  const b = rpBuildingId ? getBuilding(rpBuildingId) : null;
  const escopo = `${b ? escapeHtml(b.name) : "Todos os empreendimentos"} · ${p.label}`;
  const card = (titulo, desc, acao) => `<div class="panel rp-export"><h3>${titulo}</h3><p class="hint">${desc}</p>
    <button type="button" class="btn primary" data-rp-acao="${acao}">Baixar CSV</button></div>`;
  return `
  <p class="hint rp-legenda">Os arquivos abrem direto no Excel (separador ponto e vírgula, acentos corretos). Escopo atual: <strong>${escopo}</strong>.</p>
  <div class="rp-grid rp-grid-3">
    ${card("Chamados", "Um chamado por linha: unidade, cliente, categoria, problema, prioridade, status, datas e próxima ação. O período filtra pela data de abertura.", "csv-chamados")}
    ${card("Unidades e clientes", "Uma unidade por linha: situação (vendido / não vendido), cliente, contatos, vaga, escritura e quantos chamados/modificações em aberto. Não usa o período.", "csv-unidades")}
    ${card("Modificações", "Uma modificação por linha: unidade, cliente, solicitação, itens do mapa, status e datas. O período filtra pela data da solicitação.", "csv-modificacoes")}
  </div>`;
}

/* ---------- Eventos ---------- */

function rpWireOnce(root) {
  if (root.dataset.wired) return;
  root.dataset.wired = "1";
  root.addEventListener("change", (e) => {
    if (e.target.id === "rp-periodo") { rpPeriodoTipo = e.target.value; renderReports(); }
    else if (e.target.id === "rp-de") { rpDe = e.target.value; renderReports(); }
    else if (e.target.id === "rp-ate") { rpAte = e.target.value; renderReports(); }
    else if (e.target.id === "rp-predio") { rpBuildingId = e.target.value; renderReports(); }
  });
  root.addEventListener("click", (e) => {
    const el = e.target.closest("[data-rp-tab],[data-rp-acao],[data-open-ticket],[data-open-mod],[data-open-building]");
    if (!el || !root.contains(el)) return;
    if (el.dataset.rpTab) { rpTab = el.dataset.rpTab; renderReports(); return; }
    if (el.dataset.openTicket) { goToTicketDetail(el.dataset.openTicket); return; }
    if (el.dataset.openMod) { goToModificationDetail(el.dataset.openMod); return; }
    if (el.dataset.openBuilding) { openBuildingDetail(el.dataset.openBuilding); return; }
    const p = rpIntervalo();
    switch (el.dataset.rpAcao) {
      case "pdf-engenharia": rpPdfEngenharia(calcRelatorioEngenharia(rpBuildingId && getBuilding(rpBuildingId) ? rpBuildingId : "", p)); break;
      case "pdf-predio": rpPdfEmpreendimento(calcRelatorioEmpreendimento(rpBuildingAtual(), p)); break;
      case "pdf-gerencial": rpPdfGerencial(calcPainelGerencial(p)); break;
      case "csv-chamados-predio": rpCsvChamados(rpBuildingAtual(), p); break;
      case "csv-chamados": rpCsvChamados(rpBuildingId, p); break;
      case "csv-unidades": rpCsvUnidades(rpBuildingId); break;
      case "csv-modificacoes": rpCsvModificacoes(rpBuildingId, p); break;
    }
  });
}

/* ---------- CSV ---------- */

function rpBaixarCSV(rows, nomeBase, nomeCompleto) {
  const csv = rows.map(r => r.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeCompleto ? nomeBase : `${nomeBase}_${todayISODate()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`${rows.length - 1} linha(s) exportada(s).`, "success");
}
function rpEscopoNome(buildingId) { return buildingId ? nomeArquivoSeguro((getBuilding(buildingId) || {}).name) : "Todos"; }

function rpCsvChamados(buildingId, p) {
  const lista = state.tickets.filter(t => (!buildingId || t.buildingId === buildingId) && rpNoPeriodo(t.openedAt.slice(0, 10), p))
    .sort((a, c) => c.openedAt.localeCompare(a.openedAt));
  const rows = [["OS", "Empreendimento", "Unidade", "Cliente", "Sistema informado", "Sistema real", "Causa real", "Problema", "Prioridade", "Status", "Abertura", "Encerramento", "Responsável interno", "Fornecedores", "Próxima ação", "Data da próxima ação"]];
  lista.forEach(t => {
    const px = proximaAcaoDisplay(t);
    rows.push([t.id, (getBuilding(t.buildingId) || {}).name || "", t.unit, t.requesterName || "", t.category, (t.encerramento && t.encerramento.sistemaReal) || "", ticketCausaReal(t), ticketProblemLabel(t),
      (PRIORITY_MAP[t.priority] || {}).label || t.priority, TICKET_STATUS_MAP[t.status] || t.status, fmtDate(t.openedAt.slice(0, 10)),
      ticketClosedAt(t) ? fmtDate(ticketClosedAt(t)) : "", t.responsavelInterno || "",
      (t.fornecedores || []).map(l => { const s = getSupplier(l.supplierId); return s ? supplierDisplayName(s) : ""; }).filter(Boolean).join(", "),
      px.texto || "", px.data ? fmtDate(px.data) : ""]);
  });
  rpBaixarCSV(rows, `Chamados_${rpEscopoNome(buildingId)}`);
}
function rpCsvUnidades(buildingId) {
  const units = state.clients.filter(c => !buildingId || c.buildingId === buildingId)
    .sort((a, c) => (getBuilding(a.buildingId) || {}).name?.localeCompare((getBuilding(c.buildingId) || {}).name || "") || String(a.unit).localeCompare(String(c.unit), "pt-BR", { numeric: true }));
  const rows = [["Empreendimento", "Unidade", "Situação", "Cliente", "Telefone", "E-mail", "Vaga", "Escritura", "Chamados abertos", "Modificações em andamento"]];
  units.forEach(c => {
    rows.push([(getBuilding(c.buildingId) || {}).name || "", c.unit, unitIsVendida(c.buildingId, c.unit) ? "Vendido" : "Não vendido", c.name || "", c.phone || "", c.email || "", c.garage || "", c.escritura || "",
      state.tickets.filter(t => t.buildingId === c.buildingId && t.unit === c.unit && OPEN_STATUSES.includes(t.status)).length,
      state.modifications.filter(m => m.buildingId === c.buildingId && m.unit === c.unit && !MODIFICATION_CLOSED_STATUSES.includes(m.status)).length]);
  });
  rpBaixarCSV(rows, `Unidades_${rpEscopoNome(buildingId)}`);
}
function rpCsvModificacoes(buildingId, p) {
  const lista = state.modifications.filter(m => (!buildingId || m.buildingId === buildingId) && rpNoPeriodo(m.dataSolicitacao, p))
    .sort((a, c) => (c.dataSolicitacao || "").localeCompare(a.dataSolicitacao || ""));
  const rows = [["Código", "Empreendimento", "Unidade", "Cliente", "Solicitação", "Itens do mapa", "Status", "Data da solicitação", "Recebido por"]];
  lista.forEach(m => {
    const cl = m.clientId ? getClient(m.clientId) : null;
    rows.push([m.code, (getBuilding(m.buildingId) || {}).name || "", m.unit, cl ? cl.name || "" : "", m.solicitacaoTexto || "",
      (m.itensMapa || []).join(", "), MODIFICATION_STATUS_MAP[m.status].label, fmtDate(m.dataSolicitacao), m.recebidoPor || ""]);
  });
  rpBaixarCSV(rows, `Modificacoes_${rpEscopoNome(buildingId)}`);
}

/* ---------- PDF (mesmo padrão do Mapa de Modificações) ---------- */

function rpPdfNovo(orientation, titulo, subtitulo) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const now = new Date();
  const emitido = now.toLocaleDateString("pt-BR") + " às " + now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const desenhadas = new Set();
  const cabecalho = () => {
    const n = doc.internal.getCurrentPageInfo().pageNumber;
    if (desenhadas.has(n)) return;
    desenhadas.add(n);
    doc.setFont(undefined, "bold"); doc.setFontSize(13); doc.setTextColor(16, 32, 61);
    doc.text("GESTÃO DE ARQUITETURA", 12, 12);
    doc.setFont(undefined, "normal"); doc.setFontSize(10); doc.setTextColor(70, 70, 70);
    doc.text(titulo, 12, 17.5);
    doc.setFontSize(8.5); doc.text(subtitulo, 12, 22.5);
    doc.setFontSize(8); doc.text("Emitido em: " + emitido, pw - 12, 12, { align: "right" });
  };
  cabecalho();
  const cur = { y: 28 };
  const secao = (tituloSecao, head, body, columnStyles) => {
    if (cur.y > ph - 36) { doc.addPage(); cabecalho(); cur.y = 28; }
    doc.setFont(undefined, "bold"); doc.setFontSize(10.5); doc.setTextColor(16, 32, 61);
    doc.text(tituloSecao, 12, cur.y + 4);
    cur.y += 7;
    if (!body.length) {
      doc.setFont(undefined, "normal"); doc.setFontSize(8.5); doc.setTextColor(120, 120, 120);
      doc.text("Nenhum registro no período.", 12, cur.y + 3);
      cur.y += 11;
      return;
    }
    doc.autoTable({
      head: [head], body, startY: cur.y, margin: { top: 28, left: 12, right: 12, bottom: 16 },
      styles: { fontSize: 8, cellPadding: 1.6, textColor: [40, 40, 40], lineColor: [222, 222, 222], lineWidth: 0.1, overflow: "linebreak" },
      headStyles: { fillColor: [16, 32, 61], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 249, 251] },
      columnStyles: columnStyles || {},
      didDrawPage: cabecalho,
    });
    cur.y = doc.lastAutoTable.finalY + 7;
  };
  const nota = (texto) => {
    doc.setFont(undefined, "normal"); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
    const linhas = doc.splitTextToSize(texto, pw - 24);
    doc.text(linhas, 12, cur.y);
    cur.y += linhas.length * 3.6 + 4;
  };
  const finalizar = (arquivo) => {
    const total = doc.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5); doc.setTextColor(130, 130, 130);
      doc.text("Gestão de Arquitetura — " + titulo, 12, ph - 7);
      doc.text(`Página ${i} de ${total}`, pw - 12, ph - 7, { align: "right" });
    }
    doc.save(arquivo);
    toast("PDF gerado.", "success");
  };
  return { doc, secao, nota, finalizar };
}

function rpArquivoPDF(prefixo, nome, p) {
  const sufixo = p.de || p.ate ? `${p.de || "inicio"}_a_${p.ate || "hoje"}` : "tudo";
  return `${prefixo}_${nome ? nomeArquivoSeguro(nome) + "_" : ""}${sufixo}.pdf`;
}

function rpPdfEngenharia(r) {
  if (!window.jspdf) { toast("Biblioteca de PDF não carregada.", "error"); return; }
  const escopo = r.b ? r.b.name : "Todos os empreendimentos";
  const total = r.itens.length;
  const { secao, nota, finalizar } = rpPdfNovo("landscape", `Causas dos problemas (Engenharia) — ${escopo}`, `Período: ${r.p.label}`);
  secao("Resumo", ["Indicador", "Valor"], [
    ["Problemas confirmados (reparo concluído com causa registrada)", String(total)],
    ["Diagnóstico inicial errado", `${r.divergentes} (${rpPct(r.divergentes, total)}%)`],
    ["Chamados ainda em aberto (causa não confirmada)", String(r.totalAbertos)],
  ], { 1: { halign: "right", cellWidth: 50 } });
  secao("Causas dos problemas", ["#", "Causa", "Sistema", "Chamados", r.b ? "" : "Onde"].filter((h, i) => r.b ? i < 4 : true),
    r.porCausa.map((c, i) => {
      const onde = Array.from(c.predios.entries()).sort((a, d) => d[1] - a[1]).map(([n, q]) => `${n} (${q})`).join(", ");
      return r.b ? [String(i + 1), rpCap(c.causa), c.sistema, String(c.n)] : [String(i + 1), rpCap(c.causa), c.sistema, String(c.n), onde];
    }), { 0: { cellWidth: 10 }, 3: { halign: "right", cellWidth: 22 } });
  if (!r.b) {
    secao("Empreendimento × sistema", ["Empreendimento", ...r.colunas, "Total"],
      r.linhasMatriz.map(l => [l.nome, ...r.colunas.map(c => String(l.cel.get(c) || "")), String(l.total)]), { 0: { cellWidth: 60 } });
  }
  secao("Informado na abertura → o que era de verdade", ["Informado", "Sistema real", "Chamados"],
    r.fluxos.map(f => [f.de, f.para, String(f.n)]), { 2: { halign: "right", cellWidth: 26 } });
  secao(`Chamados confirmados (${total})`, ["OS", "Empreendimento", "Unidade", "Informado", "Sistema real", "Causa", "Encerrado"],
    r.lista.map(i => [i.t.id, i.predio, i.t.unit, i.informado, i.sistema, i.causa || "—", fmtDate(i.fechado)]), { 0: { cellWidth: 22 }, 2: { cellWidth: 20 }, 6: { cellWidth: 24 } });
  nota("Só entram chamados encerrados como “Reparo concluído” no período, com o sistema real confirmado no encerramento. Chamados em aberto não são contados como causa.");
  finalizar(rpArquivoPDF("Causas_Engenharia", r.b ? r.b.name : "", r.p));
}

function rpPdfEmpreendimento(r) {
  if (!window.jspdf) { toast("Biblioteca de PDF não carregada.", "error"); return; }
  const { secao, nota, finalizar } = rpPdfNovo("portrait", `Relatório de Pós-venda — ${r.b.name}`, `Período: ${r.p.label}`);
  secao("Resumo do período", ["Indicador", "Valor"], [
    ["Chamados abertos no período", String(r.abertosPeriodo.length)],
    ["Chamados encerrados no período", String(r.encerradosPeriodo.length)],
    ["Em aberto hoje", String(r.emAberto.length)],
    ["Atrasados (acompanhamento pendente)", String(r.atrasados.length)],
    ["Tempo médio de resolução", rpDias(r.tempoMedio)],
    ["Reincidências", String(r.reincidencias.length)],
    ["Unidades (cadastradas / vendidas / não vendidas)", `${r.mapa.total} / ${r.mapa.vendidas} / ${r.mapa.naoVendidas}`],
  ], { 1: { halign: "right", cellWidth: 50 } });
  secao("Chamados por categoria", ["Categoria", "Chamados"], r.porCategoria.map(([k, n]) => [k, String(n)]), { 1: { halign: "right", cellWidth: 30 } });
  secao("Chamados por status", ["Status", "Chamados"], r.porStatus.map(([k, n]) => [k, String(n)]), { 1: { halign: "right", cellWidth: 30 } });
  secao(`Chamados do período (${r.lista.length})`, ["OS", "Unidade", "Problema", "Status", "Abertura", "Encerramento"],
    r.lista.map(t => [t.id, t.unit, ticketProblemLabel(t), TICKET_STATUS_MAP[t.status], fmtDate(t.openedAt.slice(0, 10)), ticketClosedAt(t) ? fmtDate(ticketClosedAt(t)) : "—"]),
    { 0: { cellWidth: 20 }, 1: { cellWidth: 20 }, 4: { cellWidth: 22 }, 5: { cellWidth: 24 } });
  secao(`Pendências em aberto hoje (${r.pendencias.length})`, ["OS", "Unidade", "Problema", "Status", "Próxima ação", "Data"],
    r.pendencias.map(t => { const px = proximaAcaoDisplay(t); return [t.id, t.unit, ticketProblemLabel(t), TICKET_STATUS_MAP[t.status], px.texto || "—", (px.data ? fmtDate(px.data) : "—") + (isAcompanhamentoPendente(t) ? " (atrasado)" : "")]; }),
    { 0: { cellWidth: 20 }, 1: { cellWidth: 20 }, 5: { cellWidth: 30 } });
  secao(`Modificações (${r.modsPeriodo.length} solicitadas no período · ${r.modsAtivas.length} em andamento)`, ["Nº", "Unidade", "Solicitação", "Status", "Data"],
    r.modsPeriodo.map(m => [m.code, m.unit, (m.solicitacaoTexto || "").slice(0, 90), MODIFICATION_STATUS_MAP[m.status].label, fmtDate(m.dataSolicitacao)]),
    { 0: { cellWidth: 20 }, 1: { cellWidth: 20 }, 4: { cellWidth: 22 } });
  secao(`Anotações do período (${r.anotacoes.length})`, ["Data", "Unidade", "Anotação"],
    r.anotacoes.map(a => [fmtDate(a.data), a.unit || "—", a.texto]), { 0: { cellWidth: 22 }, 1: { cellWidth: 20 } });
  nota("Tempo médio = média entre abertura e encerramento dos chamados encerrados no período. Atrasado = acompanhamento pendente na data de emissão. Reincidência = problema repetido na mesma unidade e categoria após um chamado já encerrado.");
  finalizar(rpArquivoPDF("Relatorio_Posvenda", r.b.name, r.p));
}

function rpPdfGerencial(g) {
  if (!window.jspdf) { toast("Biblioteca de PDF não carregada.", "error"); return; }
  const { secao, nota, finalizar } = rpPdfNovo("landscape", "Painel gerencial — todos os empreendimentos", `Período: ${g.p.label}`);
  const t = g.totais;
  secao("Por empreendimento", ["Empreendimento", "Unid.", "Abertos no período", "Encerrados", "Em aberto hoje", "Atrasados", "Tempo médio", "Modif. em andamento"],
    [...g.linhas.slice().sort((a, c) => c.emAberto - a.emAberto || c.abertosPeriodo - a.abertosPeriodo)
      .map(l => [l.b.name, String(l.unidades), String(l.abertosPeriodo), String(l.encerrados), String(l.emAberto), String(l.atrasados), rpDias(l.tempoMedio), String(l.modsAtivas)]),
    ["TOTAL", String(t.unidades), String(t.abertosPeriodo), String(t.encerrados), String(t.emAberto), String(t.atrasados), rpDias(t.tempoMedio), String(t.modsAtivas)]],
    { 0: { cellWidth: 70 } });
  secao("Categorias que mais se repetem", ["Categoria", "Chamados abertos no período"], g.porCategoria.map(([k, n]) => [k, String(n)]), { 1: { halign: "right", cellWidth: 60 } });
  secao("Fornecedores", ["Fornecedor", "Acionamentos no período", "Sem retorno hoje"],
    g.fornecedores.map(f => [supplierDisplayName(f.s), String(f.acionamentos), String(f.semRetorno)]), { 1: { halign: "right", cellWidth: 50 }, 2: { halign: "right", cellWidth: 40 } });
  secao(`Reincidências no período (${g.reincidencias.length})`, ["OS", "Empreendimento", "Unidade", "Categoria", "Abertura"],
    g.reincidencias.map(x => [x.id, (getBuilding(x.buildingId) || {}).name || "—", x.unit, ticketSistema(x), fmtDate(x.openedAt.slice(0, 10))]), { 0: { cellWidth: 24 } });
  nota("Tempo médio = média entre abertura e encerramento dos chamados encerrados no período. Atrasado = acompanhamento pendente na data de emissão.");
  finalizar(rpArquivoPDF("Painel_Gerencial", "", g.p));
}
