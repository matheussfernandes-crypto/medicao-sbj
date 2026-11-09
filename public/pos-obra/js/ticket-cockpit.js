/* ---------- Painel de ação do chamado ("cockpit") ---------- */
/* Substitui "Próximo Passo + Fluxo + Plano de Atendimento" no topo da ficha do
   chamado por: situação atual + botões de um toque (Foi feito / Agendar /
   Remarcar / Não deu certo / Anotar / Fornecedor / Concluir) + uma linha de texto
   livre ("pintor volta dia 20 às 9h"). Tudo grava nas MESMAS estruturas de antes
   (plano -> atividade -> execuções, histórico, status calculado pelo plano), então
   agenda, relatórios e o resto do site continuam enxergando os mesmos dados. */

const CK_O_QUE = [
  { label: "Vistoria", nome: "Realizar vistoria" },
  { label: "Reparo", nome: "Realizar reparo" },
  { label: "Conferência", nome: "Conferir reparo" },
  { label: "Retorno ao cliente", nome: "Retornar cliente" },
];
const CK_MOTIVOS_NAO_FEITO = ["Cliente ausente", "Sem acesso à unidade", "Fornecedor não veio", "Problema continua", "Outro"];
const CK_MOTIVOS_REMARCAR = ["Cliente pediu", "Fornecedor não pôde", "Chuva", "Equipe sem agenda", "Outro"];
const CK_NOTAS_RAPIDAS = ["Falei com o cliente", "Cliente confirmou que está ok", "Cliente não atendeu", "Aguardando retorno do cliente"];
const CK_DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/* Ícones desenhados (traço único de 1.75) no lugar de emojis. */
const CK_ICONES = {
  feito: '<path d="M4 12.5l5 5L20 6.5"/>',
  agendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  remarcar: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>',
  naofeito: '<path d="M6 6l12 12M18 6L6 18"/>',
  anotar: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4A1.5 1.5 0 0 1 4 14.5z"/>',
  fornecedor: '<path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z"/>',
  concluir: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.8 2.8L16 9.5"/>',
  copiar: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  dinheiro: '<path d="M12 4v16M16 8c0-1.7-1.8-2.5-4-2.5S8 6.5 8 8s1.5 2.2 4 3 4 1.5 4 3-1.8 2.5-4 2.5-4-.8-4-2.5"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.3"/>',
  raio: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  res_reparo_concluido: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.8 2.8L16 9.5"/>',
  res_reparo_parcial: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M12 3.5a8.5 8.5 0 0 1 0 17" fill="currentColor" fill-opacity=".25"/>',
  res_sem_necessidade: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>',
  res_nao_solucionado: '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>',
  res_improcedente: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
};
function ckIco(nome, tam) {
  return `<svg class="ck-svg" width="${tam || 18}" height="${tam || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CK_ICONES[nome] || ""}</svg>`;
}
const CK_DESPESAS = ["Mão de obra", "Insumos", "Outras"];
function ckBRL(v) { return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
/* Total gasto no chamado, somando as despesas de todas as execuções. */
function ckTotalDespesas(t) {
  let total = 0;
  (t.plano || []).forEach(a => (a.execucoes || []).forEach(e => (e.despesas || []).forEach(d => { total += Number(d.valor) || 0; })));
  return total;
}
/* Mensagem pronta para colar no WhatsApp (o cliente não usa o site). */
function ckMensagemCliente(t) {
  const alvo = ckPendentes(t)[0];
  const nome = (t.requesterName || "").split(" ")[0];
  const b = getBuilding(t.buildingId);
  const oi = `Olá${nome ? ", " + nome : ""}! Aqui é do pós-obra${b ? " do " + b.name : ""}.`;
  if (!alvo || !alvo.ex.data) return `${oi} Sobre o chamado da unidade ${t.unit} (${ticketProblemLabel(t)}): já estamos cuidando e entraremos em contato com a data da visita.`;
  const dia = ckRotuloDia(alvo.ex.data);
  const hora = alvo.ex.horario ? ` às ${alvo.ex.horario}` : "";
  return `${oi} Estamos confirmando a visita para ${alvo.a.nome.replace(/^Realizar /, "").toLowerCase()} na unidade ${t.unit}: ${dia}${hora}. Podemos confirmar? Se esse horário não for bom, é só responder aqui que remarcamos.`;
}

/* Quando uma ação "não deu certo" termina, a tela já abre o painel de reagendar. */
let ckAbrirApos = null;

function ckRotuloDia(iso) {
  return CK_DIAS[toLocalDate(iso).getDay()] + " " + fmtDate(iso).slice(0, 5);
}
function ckId(prefixo) { return prefixo + Date.now() + Math.random().toString(36).slice(2, 6); }

/* Se a atividade de mesmo nome já tentou e "não aconteceu", a nova ida é mais uma
   EXECUÇÃO dela (é assim que o plano modela reagendamento) — não uma atividade
   nova, que deixaria a antiga pendurada como "não realizada" pra sempre. */
function ckAtividadeReaproveitavel(t, nome) {
  return (t.plano || []).find(a => !a.cancelada && a.nome === nome && atividadeStatus(a) === "nao_realizada") || null;
}

/* Execuções ainda pendentes do chamado, da mais próxima pra mais distante. */
function ckPendentes(t) {
  return (t.plano || []).filter(a => !a.cancelada)
    .map(a => ({ a, ex: proximaExecucaoDaAtividade(a) })).filter(x => x.ex)
    .sort((x, y) => (x.ex.data || "9999-99-99").localeCompare(y.ex.data || "9999-99-99"));
}

/* ---------- Peças de HTML ---------- */

function ckChip(grupo, valor, rotulo, ativo) {
  return `<button type="button" class="ck-chip ${ativo ? "ativo" : ""}" data-ck-chip="${escapeHtml(grupo)}" data-valor="${escapeHtml(valor)}">${escapeHtml(rotulo)}</button>`;
}
function ckChipsDatas(passado) {
  const hoje = todayISODate();
  const itens = passado
    ? [[0, "Hoje"], [-1, "Ontem"], [-2, null]]
    : [[1, "Amanhã"], [2, null], [3, null], [7, "Em 1 semana"]];
  return itens.map(([d, nome]) => {
    const iso = qcAddDays(hoje, d);
    const rot = nome ? `${nome} · ${ckRotuloDia(iso)}` : ckRotuloDia(iso);
    return `<button type="button" class="ck-chip" data-ck-chip="data" data-valor="${iso}">${escapeHtml(rot)}</button>`;
  }).join("");
}
function ckSelectQual(pend, selecionadoId) {
  if (pend.length < 2) return "";
  return `<div class="field"><label>Qual atividade?</label><select id="ck-qual">${pend.map(x =>
    `<option value="${x.a.id}" ${x.a.id === selecionadoId ? "selected" : ""}>${escapeHtml(x.a.nome)}${x.ex.data ? " — " + fmtDate(x.ex.data) : ""}</option>`).join("")}</select></div>`;
}
function ckOpcoesResp(t, sel) {
  const lista = Array.from(new Set([...(state.teamEtapas || []), ...(state.teamInternal || [])]));
  return `<option value="">Responsável (opcional)</option>` + lista.map(p => `<option value="${escapeHtml(p)}" ${p === sel ? "selected" : ""}>${escapeHtml(p)}</option>`).join("");
}
function ckBotoes(tipo, rotulo) {
  return `<div class="ck-painel-botoes"><button type="button" class="btn primary" data-ck-confirmar="${tipo}">${rotulo}</button><button type="button" class="btn ghost" data-ck-cancelar>Cancelar</button></div>`;
}

function ckPainelHTML(t, tipo, pre) {
  const hoje = todayISODate();
  const pend = ckPendentes(t);
  const alvo = pend[0];
  const entendi = pre.msg ? `<div class="ck-entendi">${escapeHtml(pre.msg)}</div>` : "";

  if (tipo === "agendar") {
    const nomeInicial = pre.nome || (ckPendentes(t).length ? "" : (t.plano || []).length ? "Realizar reparo" : "Realizar vistoria");
    const ehPadrao = CK_O_QUE.some(o => o.nome === nomeInicial);
    return `${entendi}
    <div class="ck-painel-titulo">${ckIco("agendar")}Agendar uma ida / serviço</div>
    <div class="ck-rotulo">O que vai ser feito?</div>
    <div class="ck-chips" data-ck-grupo="oque">
      ${CK_O_QUE.map(o => ckChip("oque", o.nome, o.label, o.nome === nomeInicial)).join("")}
      ${ckChip("oque", "__outro__", "Outro…", !!nomeInicial && !ehPadrao)}
    </div>
    <input type="text" id="ck-outro" class="ck-input" placeholder="Escreva o que vai ser feito" value="${!ehPadrao ? escapeHtml(nomeInicial) : ""}" style="${!ehPadrao && nomeInicial ? "" : "display:none;"}">
    <div class="ck-rotulo">Quando?</div>
    <div class="ck-chips" data-ck-grupo="data">${ckChipsDatas(false)}</div>
    <div class="ck-linha">
      <input type="date" id="ck-data" value="${escapeHtml(pre.data || "")}" min="${hoje}">
      <input type="time" id="ck-hora" value="${escapeHtml(pre.horario || "")}">
      <select id="ck-resp">${ckOpcoesResp(t, pre.resp || t.responsavelInterno || "")}</select>
    </div>
    ${ckBotoes("agendar", "Agendar")}`;
  }

  if (tipo === "remarcar") {
    if (!alvo) return `<div class="ck-vazio">Não há nada agendado para remarcar. Use <strong>Agendar</strong>.</div>`;
    return `${entendi}
    <div class="ck-painel-titulo">${ckIco("remarcar")}Remarcar</div>
    ${ckSelectQual(pend, alvo.a.id)}
    <div class="ck-atual" id="ck-atual">Hoje está em <strong>${alvo.ex.data ? fmtDate(alvo.ex.data) + (alvo.ex.horario ? " às " + alvo.ex.horario : "") : "sem data"}</strong>: ${escapeHtml(alvo.a.nome)}</div>
    <div class="ck-rotulo">Nova data</div>
    <div class="ck-chips" data-ck-grupo="data">${ckChipsDatas(false)}</div>
    <div class="ck-linha">
      <input type="date" id="ck-data" value="${escapeHtml(pre.data || "")}" min="${hoje}">
      <input type="time" id="ck-hora" value="${escapeHtml(pre.horario || alvo.ex.horario || "")}">
    </div>
    <div class="ck-rotulo">Por quê?</div>
    <div class="ck-chips" data-ck-grupo="motivo">${CK_MOTIVOS_REMARCAR.map(m => ckChip("motivo", m, m, false)).join("")}</div>
    ${ckBotoes("remarcar", "Remarcar")}`;
  }

  if (tipo === "feito") {
    const dataFeito = pre.data && pre.data <= hoje ? pre.data : hoje;
    const quem = alvo
      ? `${ckSelectQual(pend, alvo.a.id)}<div class="ck-atual">Marcar como feito: <strong>${escapeHtml(alvo.a.nome)}</strong>${alvo.ex.data ? " (era para " + fmtDate(alvo.ex.data) + ")" : ""}</div>`
      : `<div class="ck-rotulo">O que foi feito?</div><div class="ck-chips" data-ck-grupo="oque">${CK_O_QUE.map(o => ckChip("oque", o.nome, o.label, o.nome === pre.nome)).join("")}${ckChip("oque", "__outro__", "Outro…", false)}</div>
         <input type="text" id="ck-outro" class="ck-input" placeholder="Escreva o que foi feito" style="display:none;">`;
    return `${entendi}
    <div class="ck-painel-titulo">${ckIco("feito")}Foi feito</div>
    ${quem}
    <div class="ck-rotulo">Quando foi?</div>
    <div class="ck-chips" data-ck-grupo="data">${ckChipsDatas(true)}</div>
    <div class="ck-linha"><input type="date" id="ck-data" value="${dataFeito}" max="${hoje}"></div>
    <input type="text" id="ck-obs" class="ck-input" placeholder="Observação (opcional) — ex: só falta o acabamento" value="${escapeHtml(pre.obs || "")}">
    <div class="ck-rotulo">Gastou algo nessa visita? (opcional)</div>
    <div class="ck-linha ck-despesa">
      <select id="ck-desp-tipo">${CK_DESPESAS.map(d => `<option>${d}</option>`).join("")}</select>
      <input type="number" id="ck-desp-valor" min="0" step="0.01" inputmode="decimal" placeholder="R$ 0,00">
    </div>
    ${ckBotoes("feito", "Registrar como feito")}`;
  }

  if (tipo === "naofeito") {
    return `${entendi}
    <div class="ck-painel-titulo">${ckIco("naofeito")}Não deu certo</div>
    ${alvo ? ckSelectQual(pend, alvo.a.id) + `<div class="ck-atual">Não aconteceu: <strong>${escapeHtml(alvo.a.nome)}</strong>${alvo.ex.data ? " (" + fmtDate(alvo.ex.data) + ")" : ""}</div>` : `<div class="ck-atual">Nada estava agendado — será registrado no histórico.</div>`}
    <div class="ck-rotulo">O que houve?</div>
    <div class="ck-chips" data-ck-grupo="motivo">${CK_MOTIVOS_NAO_FEITO.map(m => ckChip("motivo", m, m, false)).join("")}</div>
    <input type="text" id="ck-obs" class="ck-input" placeholder="Detalhe (opcional)" value="${escapeHtml(pre.obs || "")}">
    ${ckBotoes("naofeito", alvo ? "Registrar e reagendar" : "Registrar")}`;
  }

  /* anotar */
  return `${entendi}
    <div class="ck-painel-titulo">${ckIco("anotar")}Anotar no chamado</div>
    <div class="ck-chips" data-ck-grupo="nota">${CK_NOTAS_RAPIDAS.map(n => ckChip("nota", n, n, false)).join("")}</div>
    <input type="text" id="ck-obs" class="ck-input" placeholder="Escreva o que aconteceu" value="${escapeHtml(pre.obs || "")}">
    ${ckBotoes("anotar", "Salvar anotação")}`;
}

/* ---------- Situação ---------- */

function ckSituacaoHTML(t) {
  const hoje = todayISODate();
  const aguardaForn = (t.fornecedores || []).some(f => !f.dataExecutada);
  if (aguardaForn || t.clienteAguardando) return `<div class="ck-situacao aguardando">${renderProximoPasso(t)}</div>`;

  const pend = ckPendentes(t);
  if (pend.length) {
    const { a, ex } = pend[0];
    const atrasada = ex.data && ex.data < hoje;
    const ehHoje = ex.data === hoje;
    const quando = ex.data ? `${ckRotuloDia(ex.data)}${ex.horario ? " às " + ex.horario : ""}` : "sem data definida";
    const classe = atrasada ? "atrasado" : ehHoje ? "hoje" : "ok";
    const selo = atrasada ? `<span class="ck-selo atrasado">Atrasado ${daysDiff(ex.data, hoje)} dia(s)</span>` : ehHoje ? `<span class="ck-selo hoje">É hoje</span>` : "";
    return `<div class="ck-situacao ${classe}">
      <div class="ck-sit-rotulo">Próximo passo</div>
      <div class="ck-sit-titulo">${escapeHtml(a.nome)} ${selo}</div>
      <div class="ck-sit-sub">${quando}${a.responsavel ? " · " + escapeHtml(a.responsavel) : ""}${pend.length > 1 ? ` · +${pend.length - 1} agendado(s)` : ""}</div>
      <div class="ck-sit-acoes"><button type="button" class="btn ghost small" data-ck-copiar>${ckIco("copiar", 15)} Copiar mensagem p/ cliente</button></div>
    </div>`;
  }

  const prox = proximaAtividadePendente(t);
  if (prox && atividadeStatus(prox) === "nao_realizada") {
    return `<div class="ck-situacao atrasado">
      <div class="ck-sit-rotulo">Falta reagendar</div>
      <div class="ck-sit-titulo">${escapeHtml(prox.nome)} não aconteceu</div>
      <div class="ck-sit-acoes"><button type="button" class="btn primary small" data-ck-abrir="agendar" data-ck-nome="${escapeHtml(prox.nome)}">Reagendar</button></div>
    </div>`;
  }

  if ((t.plano || []).length) {
    return `<div class="ck-situacao ok">
      <div class="ck-sit-rotulo">Tudo o que foi agendado já foi feito</div>
      <div class="ck-sit-titulo">E agora?</div>
      <div class="ck-sit-acoes">
        <button type="button" class="btn ghost small" data-ck-abrir="agendar" data-ck-nome="Conferir reparo">Agendar conferência</button>
        <button type="button" class="btn ghost small" data-ck-abrir="agendar">Agendar outra ida</button>
        <button type="button" class="btn primary small" data-ck-concluir>Concluir chamado</button>
      </div>
    </div>`;
  }

  const aberto = daysDiff(t.openedAt.slice(0, 10), hoje);
  return `<div class="ck-situacao nova">
    <div class="ck-sit-rotulo">Nada agendado ainda · aberto há ${aberto <= 0 ? "menos de 1 dia" : aberto + " dia" + (aberto > 1 ? "s" : "")}</div>
    <div class="ck-sit-titulo">Qual é o primeiro passo?</div>
    <div class="ck-sit-acoes">
      <button type="button" class="btn primary small" data-ck-abrir="agendar" data-ck-nome="Realizar vistoria">Agendar vistoria</button>
      <button type="button" class="btn ghost small" data-ck-abrir="agendar" data-ck-nome="Realizar reparo">Agendar reparo direto</button>
    </div>
  </div>`;
}

/* ---------- Linha do tempo ---------- */

function ckIcone(acao) {
  const a = qcNorm(acao);
  if (/nao realizado|nao solucionado|nao resolvido/.test(a)) return ckIco("naofeito", 14);
  if (/remarcad/.test(a)) return ckIco("remarcar", 14);
  if (/agendad|atividade adicionada/.test(a)) return ckIco("agendar", 14);
  if (/encerrad|conclu|realizad|feito/.test(a)) return ckIco("concluir", 14);
  if (/anotac|contato|cliente|atualiza/.test(a)) return ckIco("anotar", 14);
  if (/fornecedor|acionad/.test(a)) return ckIco("fornecedor", 14);
  return '<span class="ck-ponto"></span>';
}
function ckTimelineHTML(t, tudo) {
  const lista = t.history.slice().reverse();
  const mostra = tudo ? lista : lista.slice(0, 6);
  return `<ul class="ck-timeline">${mostra.map(h => `
    <li><span class="ck-ico">${ckIcone(h.action)}</span>
      <div class="ck-t-corpo">
        <div class="ck-t-acao">${escapeHtml(h.action)}${h.statusTo ? ` <span class="ck-t-status" style="background:${statusColor(h.statusTo)}">${escapeHtml(TICKET_STATUS_MAP[h.statusTo] || h.statusTo)}</span>` : ""}</div>
        ${h.note ? `<div class="ck-t-nota">${escapeHtml(h.note)}</div>` : ""}
        <div class="ck-t-meta">${fmtDate(h.date)} ${new Date(h.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · ${escapeHtml(h.user || "")}</div>
      </div></li>`).join("")}</ul>
    ${lista.length > 6 ? `<button type="button" class="btn ghost small" data-ck-vertudo>${tudo ? "Mostrar só os últimos" : `Ver os ${lista.length} registros`}</button>` : ""}`;
}

/* ---------- Bloco principal ---------- */

function renderCockpitChamado(t) {
  const b = getBuilding(t.buildingId);
  const fechado = CLOSED_STATUSES.includes(t.status);
  const sistema = t.category === "Outros" && t.outrosDescricao ? t.outrosDescricao : t.category;
  const hojeISO = todayISODate();
  const idade = Math.max(0, daysDiff(t.openedAt.slice(0, 10), hojeISO));
  const primeira = (t.plano || []).flatMap(x => x.execucoes || []).filter(e => e.resultado === "realizada" && e.dataConclusao).map(e => e.dataConclusao).sort()[0];
  const ate1 = primeira ? Math.max(0, daysDiff(t.openedAt.slice(0, 10), primeira)) : null;
  const custo = ckTotalDespesas(t);
  const proc = t.procedente || "";
  const info = `
    <div class="ck-info">
      <span><b>${b ? escapeHtml(b.name) : "—"}</b> · unidade ${escapeHtml(t.unit)}</span>
      <span>${escapeHtml(t.requesterName || "Sem cliente")}${t.requesterContact ? " · " + escapeHtml(t.requesterContact) : ""}</span>
      <span>${escapeHtml(ticketSistema(t) || "—")}</span>
    </div>
    <div class="ck-metricas">
      <span class="ck-metrica">${ckIco("relogio", 15)} Aberto há <b>${idade}</b> dia${idade === 1 ? "" : "s"}${ate1 !== null ? ` · 1ª visita feita em <b>${ate1}</b> dia${ate1 === 1 ? "" : "s"}` : ""}</span>
      ${custo ? `<span class="ck-metrica">${ckIco("dinheiro", 15)} Gasto: <b>${ckBRL(custo)}</b></span>` : ""}
      <span class="ck-proc" role="group" aria-label="Está na garantia?"><span class="ck-proc-rot">Garantia:</span>
        ${[["sim", "Procedente"], ["nao", "Improcedente"]].map(([v, r]) => `<button type="button" class="ck-proc-btn ${proc === v ? "ativo " + v : ""}" data-ck-proc="${v}" aria-pressed="${proc === v}">${r}</button>`).join("")}
      </span>
    </div>`;

  if (fechado) {
    return `<div class="ck">
      ${info}
      <div class="ck-fechado" id="resolucao-section">
        <div class="ck-sit-rotulo">Chamado encerrado</div>
        ${renderEncerramentoFechado(t)}
      </div>
      <div class="ck-bloco"><h3 class="ck-h">Histórico</h3><div id="ck-timeline">${ckTimelineHTML(t, false)}</div></div>
    </div>`;
  }

  return `<div class="ck">
    ${info}
    ${ckSituacaoHTML(t)}
    <div class="ck-bloco">
      <h3 class="ck-h">O que aconteceu?</h3>
      <div class="ck-acoes">
        <button type="button" class="ck-acao feito" data-ck-abrir="feito"><span class="ck-acao-ico">${ckIco("feito", 22)}</span>Foi feito</button>
        <button type="button" class="ck-acao" data-ck-abrir="agendar"><span class="ck-acao-ico">${ckIco("agendar", 22)}</span>Agendar</button>
        <button type="button" class="ck-acao" data-ck-abrir="remarcar"><span class="ck-acao-ico">${ckIco("remarcar", 22)}</span>Remarcar</button>
        <button type="button" class="ck-acao ruim" data-ck-abrir="naofeito"><span class="ck-acao-ico">${ckIco("naofeito", 22)}</span>Não deu certo</button>
        <button type="button" class="ck-acao" data-ck-abrir="anotar"><span class="ck-acao-ico">${ckIco("anotar", 22)}</span>Anotar</button>
        <button type="button" class="ck-acao" data-ck-fornecedor><span class="ck-acao-ico">${ckIco("fornecedor", 22)}</span>Fornecedor</button>
        <button type="button" class="ck-acao concluir" data-ck-concluir><span class="ck-acao-ico">${ckIco("concluir", 22)}</span>Concluir chamado</button>
      </div>
      <div class="ck-livre">
        <input type="text" id="ck-livre" placeholder="Ou escreva e aperte Enter — ex: pintor volta dia 20 às 9h · cliente não estava · pintor já fez">
      </div>
      <div class="ck-painel" id="ck-painel"></div>
    <details class="mod-details ck-resolucao" id="resolucao-section">
      <summary class="mod-summary"><span class="mod-summary-title">Concluir chamado</span><span class="mod-summary-resumo">Reparo concluído, sem necessidade, improcedente…</span></summary>
      <div class="mod-details-body">
        ${(t.analiseTecnica.solucaoProposta || t.analiseTecnica.solucaoExecutada) ? `
        <div class="detail-info-grid" style="margin-bottom:14px;">
          ${t.analiseTecnica.solucaoProposta ? `<div class="full"><div class="di-label">Solução proposta (registro anterior)</div>${escapeHtml(t.analiseTecnica.solucaoProposta)}</div>` : ""}
          ${t.analiseTecnica.solucaoExecutada ? `<div class="full"><div class="di-label">Solução executada (registro anterior)</div>${escapeHtml(t.analiseTecnica.solucaoExecutada)}</div>` : ""}
        </div>` : ""}
        ${renderResolucaoAberta(t)}
      </div>
    </details>
    </div>
    <div class="ck-bloco"><h3 class="ck-h">Histórico</h3><div id="ck-timeline">${ckTimelineHTML(t, false)}</div></div>
  </div>`;
}

/* ---------- Texto livre -> painel pré-preenchido ---------- */

function ckInterpretar(t, texto) {
  const n = qcNorm(texto);
  const spans = [];
  const data = qcExtractDate(n, todayISODate(), spans);
  const horario = qcExtractTime(qcMask(n, spans), spans);
  const falhou = /\b(nao compareceu|nao compareceram|faltou|nao veio|nao vieram|nao foi|nao estava|ausente|ninguem|nao atendeu|sem acesso|nao conseguiu|nao resolveu|nao resolveram|continua|persiste|voltou a)\b/.test(n);
  const feito = /\b(ja foi|ja fez|ja fizeram|fez|fizeram|feito|concluiu|concluiram|terminou|terminaram|finalizou|finalizaram|resolveu|resolveram|compareceu|esteve|executou)\b/.test(n);
  const temPendente = ckPendentes(t).length > 0;
  let tipo, msg;
  if (falhou) { tipo = "naofeito"; msg = "Entendi: não deu certo — escolha o motivo e já reagende."; }
  else if (feito) { tipo = "feito"; msg = "Entendi: foi feito" + (data ? ` em ${fmtDate(data)}` : "") + " — confira e registre."; }
  else if (data || horario) {
    tipo = temPendente ? "remarcar" : "agendar";
    msg = `Entendi: ${temPendente ? "remarcar" : "agendar"} para ${data ? fmtDate(data) : "?"}${horario ? " às " + horario : ""} — confira e confirme.`;
  } else { tipo = "anotar"; msg = "Entendi: uma anotação — confira e salve."; }
  let nome = "";
  if (/\bvistoria\b/.test(n)) nome = "Realizar vistoria";
  else if (/\bconfer\w*/.test(n)) nome = "Conferir reparo";
  else if (/\b(reparo|conserto|pintor|pintura|pintar|trocar|troca|instal\w*|encanador|eletricista)\b/.test(n)) nome = "Realizar reparo";
  return { tipo, data, horario, nome, obs: texto, msg };
}

/* ---------- Ações ---------- */

function ckSalvar(t, acao, nota, statusAntes, msg) {
  t.status = statusCalculadoPeloPlano(t);
  addHistoryEntry(t, acao, nota, statusAntes, t.status !== statusAntes ? t.status : "");
  persist();
  renderAll();
  goToTicketDetail(t.id);
  toast(msg, "success");
}

function ckGrupoAtivo(root, grupo) {
  const el = root.querySelector(`.ck-chips[data-ck-grupo="${grupo}"] .ck-chip.ativo`);
  return el ? el.dataset.valor : "";
}
function ckAlvoSelecionado(t, root) {
  const pend = ckPendentes(t);
  const sel = root.querySelector("#ck-qual");
  return (sel && pend.find(x => x.a.id === sel.value)) || pend[0] || null;
}

function ckLerDespesa(root) {
  const v = parseFloat((root.querySelector("#ck-desp-valor") || {}).value);
  if (!(v > 0)) return null;
  return { tipo: root.querySelector("#ck-desp-tipo").value, valor: Math.round(v * 100) / 100 };
}

function ckConfirmar(t, tipo, root) {
  const hoje = todayISODate();
  const val = (id) => { const el = root.querySelector("#" + id); return el ? el.value.trim() : ""; };
  const antes = t.status;

  if (tipo === "agendar") {
    let nome = ckGrupoAtivo(root, "oque");
    if (nome === "__outro__") nome = val("ck-outro");
    const data = val("ck-data");
    if (!nome) { toast("Escolha o que vai ser feito.", "error"); return; }
    if (!data) { toast("Escolha a data.", "error"); return; }
    const hora = val("ck-hora"), resp = val("ck-resp");
    const velha = ckAtividadeReaproveitavel(t, nome);
    if (velha) {
      velha.execucoes.push({ ...blankExecucao(), id: ckId("exec"), data, horario: hora });
      if (resp) velha.responsavel = resp;
    } else {
      t.plano.push({
        ...blankAtividade(), id: ckId("et"), nome, tipo: nome === "Realizar reparo" ? "execucao" : "acao", responsavel: resp,
        execucoes: [{ ...blankExecucao(), id: ckId("exec"), data, horario: hora }],
      });
    }
    ckSalvar(t, "Agendado: " + nome, `${fmtDate(data)}${hora ? " às " + hora : ""}${resp ? " · " + resp : ""}`, antes, "Agendado.");
    return;
  }

  if (tipo === "remarcar") {
    const alvo = ckAlvoSelecionado(t, root);
    const data = val("ck-data");
    if (!alvo) { toast("Não há nada agendado para remarcar.", "error"); return; }
    if (!data) { toast("Escolha a nova data.", "error"); return; }
    const hora = val("ck-hora");
    const motivo = ckGrupoAtivo(root, "motivo");
    const de = alvo.ex.data, deHora = alvo.ex.horario;
    alvo.ex.remarcacoes = alvo.ex.remarcacoes || [];
    alvo.ex.remarcacoes.push({ de, deHora, motivo, em: hoje });
    alvo.ex.data = data; alvo.ex.horario = hora;
    ckSalvar(t, "Remarcado: " + alvo.a.nome,
      `${de ? fmtDate(de) + (deHora ? " " + deHora : "") : "sem data"} → ${fmtDate(data)}${hora ? " às " + hora : ""}${motivo ? " — " + motivo : ""}`, antes, "Remarcado.");
    return;
  }

  if (tipo === "feito") {
    const data = val("ck-data") || hoje;
    const obs = val("ck-obs");
    const alvo = ckPendentes(t).length ? ckAlvoSelecionado(t, root) : null;
    if (alvo) {
      alvo.ex.resultado = "realizada"; alvo.ex.dataConclusao = data; alvo.ex.registradoEm = hoje; alvo.ex.observacao = obs;
      const dsp = ckLerDespesa(root); if (dsp) alvo.ex.despesas = [...(alvo.ex.despesas || []), dsp];
      ckSalvar(t, "Feito: " + alvo.a.nome, `${fmtDate(data)}${obs ? " — " + obs : ""}${dsp ? " — " + dsp.tipo + " " + ckBRL(dsp.valor) : ""}`, antes, "Registrado como feito.");
      return;
    }
    let nome = ckGrupoAtivo(root, "oque");
    if (nome === "__outro__") nome = val("ck-outro");
    if (!nome) { toast("Escolha o que foi feito.", "error"); return; }
    const execFeita = { ...blankExecucao(), id: ckId("exec"), data, resultado: "realizada", dataConclusao: data, registradoEm: hoje, observacao: obs };
    const dsp2 = ckLerDespesa(root); if (dsp2) execFeita.despesas = [dsp2];
    const velhaFeito = ckAtividadeReaproveitavel(t, nome);
    if (velhaFeito) velhaFeito.execucoes.push(execFeita);
    else t.plano.push({ ...blankAtividade(), id: ckId("et"), nome, tipo: nome === "Realizar reparo" ? "execucao" : "acao", responsavel: ensureOperatorName(), execucoes: [execFeita] });
    ckSalvar(t, "Feito: " + nome, `${fmtDate(data)}${obs ? " — " + obs : ""}`, antes, "Registrado como feito.");
    return;
  }

  if (tipo === "naofeito") {
    const motivo = ckGrupoAtivo(root, "motivo");
    const obs = val("ck-obs");
    if (!motivo && !obs) { toast("Diga o que houve (um dos botões ou um detalhe).", "error"); return; }
    const alvo = ckPendentes(t).length ? ckAlvoSelecionado(t, root) : null;
    const nota = [motivo, obs].filter(Boolean).join(" — ");
    if (alvo) {
      alvo.ex.resultado = "nao_realizada"; alvo.ex.dataConclusao = hoje; alvo.ex.registradoEm = hoje; alvo.ex.observacao = nota;
      ckAbrirApos = { ticketId: t.id, tipo: "agendar", nome: alvo.a.nome };
      ckSalvar(t, "Não realizado: " + alvo.a.nome, nota, antes, "Registrado. Agora é só reagendar.");
    } else {
      ckSalvar(t, "Problema não resolvido", nota, antes, "Registrado.");
    }
    return;
  }

  if (tipo === "anotar") {
    const texto = val("ck-obs");
    if (!texto) { toast("Escreva a anotação.", "error"); return; }
    addHistoryEntry(t, "Anotação", texto);
    persist(); renderAll(); goToTicketDetail(t.id);
    toast("Anotação salva.", "success");
  }
}

/* ---------- Eventos ---------- */

function wireCockpitChamado(t) {
  const ck = document.querySelector("#ticket-detail-root .ck");
  if (!ck) return;
  const box = ck.querySelector("#ck-painel");
  let tudo = false;

  function marcarBotao(tipo) {
    ck.querySelectorAll(".ck-acao[data-ck-abrir]").forEach(b => b.classList.toggle("aberto", b.dataset.ckAbrir === tipo));
  }
  function abrir(tipo, pre = {}) {
    if (!box) return;
    const dr = document.getElementById("resolucao-section"); if (dr && !dr.hasAttribute("data-fechado")) { dr.open = false; ck.querySelectorAll("[data-ck-concluir]").forEach(b => b.classList.remove("aberto")); }
    box.innerHTML = ckPainelHTML(t, tipo, pre);
    box.dataset.tipo = tipo;
    marcarBotao(tipo);
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const primeiro = box.querySelector("input:not([type=time]):not([style*='display:none']), select");
    if (primeiro && tipo === "anotar") primeiro.focus();
  }
  function fechar() { if (box) { box.innerHTML = ""; delete box.dataset.tipo; } marcarBotao(""); }

  ck.addEventListener("click", (e) => {
    const el = e.target.closest("button");
    if (!el || !ck.contains(el)) return;

    if (el.dataset.ckAbrir) {
      if (box && box.dataset.tipo === el.dataset.ckAbrir && !el.dataset.ckNome) { fechar(); return; }
      abrir(el.dataset.ckAbrir, { nome: el.dataset.ckNome || "" });
      return;
    }
    if (el.hasAttribute("data-ck-concluir")) {
      const det = document.getElementById("resolucao-section");
      if (det) {
        det.open = !det.open;
        el.classList.toggle("aberto", det.open);
        if (det.open) { fechar(); det.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
      }
      return;
    }
    if (el.hasAttribute("data-ck-copiar")) {
      const txt = ckMensagemCliente(t);
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast("Mensagem copiada. Cole no WhatsApp.", "success"), () => { window.prompt("Copie a mensagem:", txt); });
      return;
    }
    if (el.dataset.ckProc) {
      const novo = t.procedente === el.dataset.ckProc ? "" : el.dataset.ckProc;
      t.procedente = novo;
      addHistoryEntry(t, "Garantia: " + (novo === "sim" ? "procedente" : novo === "nao" ? "improcedente" : "limpo"), "");
      persist(); renderAll(); goToTicketDetail(t.id);
      return;
    }
    if (el.hasAttribute("data-ck-fornecedor")) { openLinkSupplierModal(t.id); return; }
    if (el.hasAttribute("data-ck-cancelar")) { fechar(); return; }
    if (el.dataset.ckConfirmar) { ckConfirmar(t, el.dataset.ckConfirmar, box); return; }
    if (el.hasAttribute("data-ck-vertudo")) {
      tudo = !tudo;
      document.getElementById("ck-timeline").innerHTML = ckTimelineHTML(t, tudo);
      return;
    }
    if (el.dataset.ckChip) {
      const grupo = el.dataset.ckChip, valor = el.dataset.valor;
      const wrap = el.closest(".ck-chips");
      if (grupo === "data") {
        box.querySelector("#ck-data").value = valor;
        wrap.querySelectorAll(".ck-chip").forEach(c => c.classList.toggle("ativo", c === el));
      } else if (grupo === "nota") {
        box.querySelector("#ck-obs").value = valor;
        wrap.querySelectorAll(".ck-chip").forEach(c => c.classList.toggle("ativo", c === el));
      } else {
        const jaAtivo = el.classList.contains("ativo") && grupo === "motivo";
        wrap.querySelectorAll(".ck-chip").forEach(c => c.classList.toggle("ativo", c === el && !jaAtivo));
        if (grupo === "oque") {
          const outro = box.querySelector("#ck-outro");
          if (outro) { outro.style.display = valor === "__outro__" ? "" : "none"; if (valor === "__outro__") outro.focus(); }
        }
      }
    }
  });

  /* digitar uma data à mão desmarca os atalhos de data */
  ck.addEventListener("input", (e) => {
    if (e.target.id === "ck-data") box.querySelectorAll('.ck-chips[data-ck-grupo="data"] .ck-chip').forEach(c => c.classList.toggle("ativo", c.dataset.valor === e.target.value));
  });
  /* trocar a atividade escolhida atualiza o "hoje está em…" */
  ck.addEventListener("change", (e) => {
    if (e.target.id !== "ck-qual") return;
    const alvo = ckPendentes(t).find(x => x.a.id === e.target.value);
    const atual = box.querySelector("#ck-atual");
    if (alvo && atual && box.dataset.tipo === "remarcar") atual.innerHTML = `Hoje está em <strong>${alvo.ex.data ? fmtDate(alvo.ex.data) + (alvo.ex.horario ? " às " + alvo.ex.horario : "") : "sem data"}</strong>: ${escapeHtml(alvo.a.nome)}`;
  });

  const livre = ck.querySelector("#ck-livre");
  if (livre) livre.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing) return;
    e.preventDefault();
    const texto = livre.value.trim();
    if (!texto) return;
    const r = ckInterpretar(t, texto);
    abrir(r.tipo, r);
    livre.value = "";
  });

  if (ckAbrirApos && ckAbrirApos.ticketId === t.id) {
    const x = ckAbrirApos; ckAbrirApos = null;
    abrir(x.tipo, { nome: x.nome });
  }
}
