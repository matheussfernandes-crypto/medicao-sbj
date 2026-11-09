/* ---------- Importar planilha (colar do Excel) ---------- */
/* Duas importações, sempre com PRÉVIA editável antes de gravar (mesmo princípio
   da captura rápida): 1) clientes/unidades de um empreendimento; 2) chamados
   antigos. Nada é sobrescrito: unidade que já tem cliente não é mexida, e os
   campos vazios só são completados se a pessoa marcar a opção. Chamado
   importado nasce no mesmo formato dos chamados normais, com a data de abertura
   da planilha e o histórico "Chamado importado de planilha". */

const IMP_CAMPOS_CLIENTE = [
  ["unit", ["unidade", "apto", "apartamento", "ap", "unid", "numero", "no"]],
  ["name", ["cliente", "nome", "proprietario", "comprador", "adquirente", "morador"]],
  ["phone", ["telefone", "fone", "celular", "contato", "whatsapp", "tel"]],
  ["email", ["email", "e mail", "mail"]],
  ["garage", ["vaga", "vagas", "garagem"]],
  ["escritura", ["escritura"]],
  ["notes", ["observacoes", "observacao", "obs", "notas", "nota"]],
];
const IMP_ORDEM_CLIENTE = ["unit", "name", "phone", "email", "garage", "escritura", "notes"];

const IMP_CAMPOS_CHAMADO = [
  ["dataFim", ["data de encerramento", "encerramento", "data de conclusao", "conclusao", "fechamento", "data de fechamento", "concluido em", "resolvido em"]],
  ["building", ["empreendimento", "predio", "edificio", "obra", "condominio"]],
  ["unit", ["unidade", "apto", "apartamento", "ap", "unid"]],
  ["desc", ["descricao", "problema", "solicitacao", "ocorrencia", "chamado", "assunto", "relato"]],
  ["data", ["data", "data de abertura", "data abertura", "abertura", "aberto em", "data do chamado", "data da solicitacao"]],
  ["status", ["status", "situacao"]],
  ["category", ["categoria", "tipo", "sistema"]],
  ["priority", ["prioridade", "urgencia"]],
  ["requester", ["solicitante", "cliente", "nome", "requerente"]],
];
const IMP_ORDEM_CHAMADO = ["building", "unit", "desc", "data", "status", "category", "priority", "requester"];

/* ---------- Leitura da tabela colada ---------- */

function impParseTabela(texto) {
  const t = String(texto).replace(/^﻿/, "");
  if (!t.trim()) return [];
  const primeira = t.split(/\r?\n/).find(l => l.trim()) || "";
  const delim = t.includes("\t") ? "\t"
    : primeira.split(";").length > 1 ? ";"
    : primeira.split(",").length > 2 ? "," : "\t";
  const rows = [];
  let row = [], cell = "", aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else aspas = false; }
      else cell += c;
    } else if (c === '"' && cell === "") aspas = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(cell); cell = ""; rows.push(row); row = [];
    } else cell += c;
  }
  row.push(cell); rows.push(row);
  return rows.map(r => r.map(c => c.replace(/\s+/g, " ").trim())).filter(r => r.some(c => c));
}

function impNormCabecalho(s) { return qcNorm(s).replace(/[^a-z0-9]+/g, " ").trim(); }

/* Devolve { cols: [campo|null por coluna], temCabecalho }. Sem cabeçalho, assume a ordem padrão. */
function impMapearColunas(linha1, campos, ordemPadrao) {
  const cols = linha1.map(cel => {
    const n = impNormCabecalho(cel);
    if (!n) return null;
    for (const [campo, sins] of campos) {
      if (sins.some(s => n === s || (campo !== "data" && n.startsWith(s + " ")))) return campo;
    }
    return null;
  });
  const distintos = new Set(cols.filter(Boolean));
  const temCabecalho = distintos.size >= 2 || (linha1.length === 1 && distintos.size === 1);
  if (temCabecalho) return { cols, temCabecalho };
  return { cols: linha1.map((_, i) => ordemPadrao[i] || null), temCabecalho: false };
}

function impLinhasComoObjetos(tabela, campos, ordemPadrao) {
  if (!tabela.length) return [];
  const { cols, temCabecalho } = impMapearColunas(tabela[0], campos, ordemPadrao);
  const dados = temCabecalho ? tabela.slice(1) : tabela;
  return dados.map(cells => {
    const o = {};
    cols.forEach((campo, i) => { if (campo && !(campo in o)) o[campo] = cells[i] || ""; });
    return o;
  });
}

/* "" = vazia, null = inválida, senão "YYYY-MM-DD". Aceita dd/mm/aaaa, dd-mm-aa, aaaa-mm-dd e número serial do Excel. */
function impParseData(s) {
  s = String(s || "").trim();
  if (!s) return "";
  let m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?:\D.*)?$/.exec(s);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return qcValidDate(y, +m[2], +m[1]) ? qcISO(y, +m[2], +m[1]) : null; }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return qcValidDate(+m[1], +m[2], +m[3]) ? qcISO(+m[1], +m[2], +m[3]) : null;
  if (/^\d{5}$/.test(s) && +s > 20000 && +s < 70000) {
    const d = new Date(Math.round((+s - 25569) * 86400000));
    return qcISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return null;
}

function impLimparUnidade(s) {
  return String(s || "").trim().replace(/^(apartamento|apto|apt|ap|unidade|unid)\.?\s*(n[o°º]?\s*)?/i, "").trim();
}

/* ---------- Clientes / unidades ---------- */

function impClienteLinha(o) {
  return {
    checked: true,
    unit: impLimparUnidade(o.unit), name: o.name || "", phone: o.phone || "", email: o.email || "",
    garage: o.garage || "", escritura: o.escritura || "", notes: o.notes || "",
    acao: "", existing: null,
  };
}

/* Classifica cada linha contra o que já existe no prédio e contra a própria planilha. */
function impClientesRecalcular(S) {
  const existentes = new Map();
  state.clients.filter(c => c.buildingId === S.buildingId).forEach(c => {
    const k = String(c.unit).trim().toLowerCase();
    if (!existentes.has(k)) existentes.set(k, c);
  });
  const vistos = new Set();
  S.rows.forEach(r => {
    const k = r.unit.trim().toLowerCase();
    r.existing = null;
    if (!k) { r.acao = "sem_unidade"; return; }
    if (vistos.has(k)) { r.acao = "repetida"; return; }
    vistos.add(k);
    const ex = existentes.get(k);
    if (!ex) { r.acao = "nova"; return; }
    r.existing = ex;
    r.acao = ex.name ? "existe" : "preencher";
  });
}
const IMP_CAMPOS_CLI_FILL = ["name", "phone", "email", "garage", "escritura", "notes"];
/* Campos da planilha que preenchem algo vazio no cadastro existente. */
function impClienteVaiPreencher(r) {
  return r.existing ? IMP_CAMPOS_CLI_FILL.filter(f => r[f] && !String(r.existing[f] || "").trim()) : [];
}
function impClienteEfetiva(S, r) {
  if (!r.checked) return false;
  if (r.acao === "nova") return true;
  if (r.acao === "preencher") return impClienteVaiPreencher(r).length > 0;
  if (r.acao === "existe") return S.atualizarVazios && impClienteVaiPreencher(r).length > 0;
  return false;
}
function impClienteSituacao(S, r) {
  switch (r.acao) {
    case "nova": return r.name ? "Nova unidade · vendida" : "Nova unidade · não vendida";
    case "preencher": return impClienteVaiPreencher(r).length ? "Preenche unidade sem cliente" : "Já existe, sem dados novos";
    case "existe": return S.atualizarVazios && impClienteVaiPreencher(r).length ? "Já tem cliente · completa campos vazios" : "Já tem cliente · não mexe";
    case "repetida": return "Repetida na planilha";
    default: return "Falta a unidade";
  }
}

function impClientesPreviaHTML(S) {
  if (!S.rows) return "";
  if (!S.rows.length) return `<div class="empty-hint">Nenhuma linha encontrada. Cole as células do Excel na caixa acima.</div>`;
  const inp = (i, f, v, cls) => `<input type="text" class="${cls || ""}" data-i="${i}" data-f="${f}" value="${escapeHtml(v)}">`;
  return `
    <div class="imp-resumo hint" id="imp-resumo"></div>
    <div class="table-wrap"><table class="mini-table imp-table">
      <thead><tr><th></th><th>Unidade</th><th>Cliente</th><th>Telefone</th><th>E-mail</th><th>Vaga</th><th>Situação</th></tr></thead>
      <tbody>${S.rows.map((r, i) => `<tr data-row="${i}">
        <td><input type="checkbox" data-i="${i}" data-f="checked" ${r.checked ? "checked" : ""}></td>
        <td>${inp(i, "unit", r.unit, "imp-sm")}</td><td>${inp(i, "name", r.name)}</td><td>${inp(i, "phone", r.phone, "imp-md")}</td>
        <td>${inp(i, "email", r.email)}</td><td>${inp(i, "garage", r.garage, "imp-sm")}</td>
        <td class="imp-sit"></td></tr>`).join("")}</tbody></table></div>`;
}

/* ---------- Chamados antigos ---------- */

function impStatusChamado(txt) {
  const n = qcNorm(txt || "");
  if (!n.trim()) return { status: "aberto", aviso: "" };
  if (/conclu|encerr|resolv|finaliz|fechad|feito|executad/.test(n)) return { status: "encerrado", aviso: "" };
  if (/abert|pendente|andamento|novo|aguard|agend|analise/.test(n)) return { status: "aberto", aviso: "" };
  return { status: "aberto", aviso: `Situação “${txt}” tratada como aberto.` };
}
function impCategoria(txt, desc) {
  const n = qcNorm(txt || "").trim();
  if (n) {
    const c = CATEGORIES.find(c => qcNorm(c) === n) || CATEGORIES.find(c => n.length >= 4 && (n.includes(qcNorm(c)) || qcNorm(c).includes(n)));
    if (c) return c;
  }
  const nd = qcNorm(desc || "");
  for (const [re, cat] of QC_CATEGORIAS) if (re.test(nd)) return cat;
  return "Outros";
}
function impPrioridade(txt) {
  const n = qcNorm(txt || "");
  if (/critic|emergenc/.test(n)) return "critica";
  if (/urgent|alta/.test(n)) return "alta";
  if (/baix/.test(n)) return "baixa";
  return "media";
}

function impChamadoLinha(o, S) {
  const st = impStatusChamado(o.status);
  const dt = impParseData(o.data), fim = impParseData(o.dataFim);
  let buildingId = S.buildingId || "", candidatos = [];
  if (o.building) {
    const m = qcMatchBuilding(qcNorm(o.building));
    buildingId = m.id || ""; candidatos = m.candidates;
  }
  const avisos = [];
  if (o.building && !buildingId) avisos.push(candidatos.length > 1 ? "Mais de um empreendimento combina." : `Empreendimento “${o.building}” não encontrado.`);
  if (dt === null) avisos.push(`Data inválida: “${o.data}”.`);
  if (st.aviso) avisos.push(st.aviso);
  return {
    checked: true, buildingId, buildingTexto: o.building || "", unit: impLimparUnidade(o.unit), desc: o.desc || "",
    data: dt || "", dataInvalida: dt === null, status: st.status, dataFim: fim || "", fimInvalida: fim === null,
    category: impCategoria(o.category, o.desc), priority: impPrioridade(o.priority), requester: o.requester || "",
    avisos,
  };
}
function impChamadoFaltando(r) {
  const f = [];
  if (!r.buildingId) f.push("empreendimento");
  if (!String(r.desc).trim()) f.push("descrição");
  if (!r.data) f.push("data de abertura");
  if (r.status === "encerrado" && r.dataFim && r.data && r.dataFim < r.data) f.push("encerramento anterior à abertura");
  return f;
}

function impChamadosPreviaHTML(S) {
  if (!S.rows) return "";
  if (!S.rows.length) return `<div class="empty-hint">Nenhuma linha encontrada. Cole as células do Excel na caixa acima.</div>`;
  const opt = (v, l, sel) => `<option value="${escapeHtml(v)}" ${sel ? "selected" : ""}>${escapeHtml(l)}</option>`;
  const txt = (i, f, v, cls) => `<input type="text" class="${cls || ""}" data-i="${i}" data-f="${f}" value="${escapeHtml(v)}">`;
  return `
    <div class="imp-resumo hint" id="imp-resumo"></div>
    <div class="table-wrap"><table class="mini-table imp-table imp-table-chamados">
      <thead><tr><th></th><th>Empreendimento</th><th>Unidade</th><th>Descrição</th><th>Abertura</th><th>Situação</th><th>Encerrado em</th><th>Categoria</th><th>Prioridade</th><th>Solicitante</th><th>Conferência</th></tr></thead>
      <tbody>${S.rows.map((r, i) => `<tr data-row="${i}">
        <td><input type="checkbox" data-i="${i}" data-f="checked" ${r.checked ? "checked" : ""}></td>
        <td><select data-i="${i}" data-f="buildingId"><option value="">Escolha…</option>${state.buildings.map(b => opt(b.id, b.name, b.id === r.buildingId)).join("")}</select></td>
        <td>${txt(i, "unit", r.unit, "imp-sm")}</td>
        <td>${txt(i, "desc", r.desc, "imp-lg")}</td>
        <td><input type="date" data-i="${i}" data-f="data" value="${escapeHtml(r.data)}"></td>
        <td><select data-i="${i}" data-f="status">${opt("aberto", "Aberto", r.status === "aberto")}${opt("encerrado", "Encerrado", r.status === "encerrado")}</select></td>
        <td><input type="date" data-i="${i}" data-f="dataFim" value="${escapeHtml(r.dataFim)}" ${r.status === "encerrado" ? "" : "disabled"}></td>
        <td><select data-i="${i}" data-f="category">${CATEGORIES.map(c => opt(c, c, c === r.category)).join("")}</select></td>
        <td><select data-i="${i}" data-f="priority">${PRIORITIES.map(p => opt(p.id, p.label, p.id === r.priority)).join("")}</select></td>
        <td>${txt(i, "requester", r.requester)}</td>
        <td class="imp-sit"></td></tr>`).join("")}</tbody></table></div>`;
}

function impCriarChamado(r) {
  const unit = r.unit.trim();
  const client = qcAcharCliente(r.buildingId, unit);
  const category = r.category;
  const loc = !unit ? QC_LOCAIS.find(([re]) => re.test(qcNorm(r.desc))) : null;
  const localTipo = unit ? "unidade_privativa" : (loc ? loc[1] : "area_comum");
  const ambientes = loc && qcNorm(loc[2]) !== qcNorm(category) ? [loc[2]] : [];
  const unitLabel = unit || (ambientes.join(", ") || LOCAL_TIPO_MAP[localTipo] || "—");
  const outrosDescricao = category === "Outros" ? r.desc.slice(0, 80) : "";
  const abertura = `${r.data}T12:00:00.000Z`;
  const t = {
    id: nextTicketCode(),
    openedAt: abertura,
    buildingId: r.buildingId, unit: unitLabel,
    clientId: client ? client.id : "",
    origemSolicitacao: "Outro",
    type: "posvenda",
    category, material: "", elemento: "", outrosDescricao,
    subcategory: "",
    localTipo, ambientes,
    ambienteDetalhe: ambientes[0] || "",
    local: ambientes.join(", "), ambiente: ambientes.join(", "),
    priority: r.priority,
    title: generateTicketTitle(category, "", ambientes, localTipo, outrosDescricao),
    status: "novo",
    responsavelInterno: "", responsavelProximaAcao: "", proximaAcao: "",
    dataLimiteProximaAcao: "", dataAcompanhamento: "",
    dataUltimaAcao: r.dataFim || r.data, dataUltimaCobranca: "", proximaCobranca: "",
    descricaoSolicitacao: r.desc,
    analiseTecnica: { ...blankAnaliseTecnica(), problemaRelatado: r.desc },
    fornecedor: blankFornecedor(), fornecedores: [],
    encerramento: blankEncerramento(),
    plano: [], anexos: [], relatorios: [],
    requesterName: r.requester || (client ? (client.name || "") : ""),
    requesterContact: client ? (client.phone || "") : "",
    history: [],
    _fornecedorMigrated: true,
  };
  t.history.push({
    date: abertura, user: ensureOperatorName(), action: "Chamado importado de planilha",
    note: `Importado de planilha em ${fmtDate(todayISODate())}. Data de abertura original: ${fmtDate(r.data)}.`, statusFrom: "", statusTo: "novo",
  });
  if (r.status === "encerrado") {
    const fim = r.dataFim || r.data;
    t.status = "concluido";
    t.encerramento = {
      ...blankEncerramento(), resultadoTipo: "reparo_concluido", comoResolvido: "outro",
      comoResolvidoOutro: "Importado de planilha (resolução não detalhada)", clienteConfirmou: "sem_contato",
      dataExecucao: fim, semDataEncerramento: !r.dataFim,
    };
    t.history.push({
      date: `${fim}T12:00:00.000Z`, user: ensureOperatorName(), action: "Chamado encerrado",
      note: r.dataFim ? "Importado de planilha como concluído." : "Importado de planilha como concluído, sem data de encerramento (usada a data de abertura; não entra no tempo médio de resolução).",
      statusFrom: "novo", statusTo: "concluido",
    });
  }
  state.tickets.push(t);
  return t.id;
}

/* ---------- Janela ---------- */

let impS = null;

function openImportModal(tab, buildingId) {
  const padrao = buildingId || "";
  impS = {
    tab: tab || "clientes",
    clientes: { buildingId: padrao || (state.buildings[0] || {}).id || "", texto: "", rows: null, atualizarVazios: false },
    chamados: { buildingId: padrao, texto: "", rows: null },
  };
  openModal(`
    <div class="modal-header">
      <h2>Importar planilha</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body" id="imp-root"></div>
    <div class="modal-footer">
      <button class="btn ghost" data-close>Cancelar</button>
      <button class="btn primary" id="imp-confirmar" disabled>Importar</button>
    </div>`, true);
  wireModalClose();
  impWire();
  impRender();
}

function impRender() {
  const S = impS[impS.tab];
  const root = document.getElementById("imp-root");
  const opt = (v, l, sel) => `<option value="${escapeHtml(v)}" ${sel ? "selected" : ""}>${escapeHtml(l)}</option>`;
  const ehCli = impS.tab === "clientes";
  root.innerHTML = `
    <div class="chip-group imp-tabs">
      <button type="button" class="chip ${ehCli ? "active" : ""}" data-imp-tab="clientes">Clientes e unidades</button>
      <button type="button" class="chip ${ehCli ? "" : "active"}" data-imp-tab="chamados">Chamados antigos</button>
    </div>
    ${ehCli ? `
      <p class="hint">Selecione as células no Excel, copie e cole abaixo. Colunas aceitas: Unidade, Cliente, Telefone, E-mail, Vaga, Escritura, Observações. Sem cabeçalho, vale a ordem Unidade · Cliente · Telefone · E-mail. Linha sem cliente entra como unidade <strong>não vendida</strong>. Nada que já está cadastrado é sobrescrito.</p>
      <div class="form-grid">
        <div class="field"><label>Empreendimento</label><select id="imp-predio">${state.buildings.map(b => opt(b.id, b.name, b.id === S.buildingId)).join("")}</select></div>
      </div>
      <label class="checkbox-inline imp-opcao"><input type="checkbox" id="imp-atualizar" ${S.atualizarVazios ? "checked" : ""}> Completar campos vazios de unidades que já têm cliente (nunca troca um dado existente)</label>`
    : `
      <p class="hint">Cole as células do Excel com os chamados antigos. Colunas aceitas: Empreendimento, Unidade, Descrição, Data de abertura, Status, Data de encerramento, Categoria, Prioridade, Solicitante. Status concluído/encerrado/resolvido entra como chamado já encerrado; qualquer outro entra como aberto. A data de abertura vem da planilha.</p>
      <div class="form-grid">
        <div class="field"><label>Empreendimento padrão (se a planilha não trouxer a coluna)</label><select id="imp-predio"><option value="">Nenhum — a planilha informa</option>${state.buildings.map(b => opt(b.id, b.name, b.id === S.buildingId)).join("")}</select></div>
      </div>`}
    <div class="field imp-colar"><label>Planilha colada</label><textarea id="imp-texto" rows="6" placeholder="${ehCli ? "Unidade\tCliente\tTelefone\tE-mail\n101\tMaria Silva\t(48) 99999-0000\tmaria@email.com" : "Empreendimento\tUnidade\tDescrição\tData de abertura\tStatus\nIbiza\t302\tVazamento no banheiro\t12/03/2026\tConcluído"}">${escapeHtml(S.texto)}</textarea></div>
    <div class="imp-barra"><button type="button" class="btn primary small" id="imp-analisar">Conferir planilha</button></div>
    <div id="imp-preview">${ehCli ? impClientesPreviaHTML(S) : impChamadosPreviaHTML(S)}</div>`;
  impRefreshPrev();
}

function impRefreshPrev() {
  const S = impS[impS.tab];
  const btn = document.getElementById("imp-confirmar");
  const resumo = document.getElementById("imp-resumo");
  if (!S.rows || !S.rows.length) { btn.disabled = true; btn.textContent = "Importar"; if (resumo) resumo.textContent = ""; return; }
  const ehCli = impS.tab === "clientes";
  const sit = document.querySelectorAll("#imp-preview tbody tr");
  let efetivas = 0, bloqueadas = 0;
  S.rows.forEach((r, i) => {
    const cel = sit[i] && sit[i].querySelector(".imp-sit");
    if (ehCli) {
      const ef = impClienteEfetiva(S, r);
      if (ef) efetivas++;
      if (r.checked && r.acao === "sem_unidade") bloqueadas++;
      if (cel) { cel.textContent = impClienteSituacao(S, r); cel.classList.toggle("imp-erro", r.acao === "sem_unidade"); }
    } else {
      const falta = impChamadoFaltando(r);
      if (r.checked) { efetivas++; if (falta.length) bloqueadas++; }
      if (cel) {
        const av = [...r.avisos];
        if (r.status === "encerrado" && !r.dataFim) av.push("Sem data de encerramento: não entra no tempo médio.");
        cel.innerHTML = (falta.length && r.checked ? `<strong class="imp-erro">Falta: ${escapeHtml(falta.join(", "))}.</strong> ` : "") + escapeHtml(av.join(" "));
      }
    }
    if (sit[i]) sit[i].classList.toggle("imp-off", !r.checked);
  });
  const total = S.rows.length;
  if (resumo) resumo.textContent = ehCli
    ? `${total} linhas lidas · ${efetivas} serão importadas${bloqueadas ? ` · ${bloqueadas} sem unidade (corrija ou desmarque)` : ""}.`
    : `${total} linhas lidas · ${efetivas} marcadas${bloqueadas ? ` · ${bloqueadas} com dado faltando (corrija ou desmarque)` : ""}.`;
  btn.disabled = efetivas === 0 || bloqueadas > 0;
  btn.textContent = `Importar ${efetivas} ${efetivas === 1 ? "linha" : "linhas"}`;
}

function impAnalisar() {
  const S = impS[impS.tab];
  S.texto = document.getElementById("imp-texto").value;
  const tabela = impParseTabela(S.texto);
  if (impS.tab === "clientes") {
    S.rows = impLinhasComoObjetos(tabela, IMP_CAMPOS_CLIENTE, IMP_ORDEM_CLIENTE).map(impClienteLinha);
    impClientesRecalcular(S);
    S.rows.forEach(r => { r.checked = r.acao === "nova" || (r.acao === "preencher" && impClienteVaiPreencher(r).length > 0); });
  } else {
    S.rows = impLinhasComoObjetos(tabela, IMP_CAMPOS_CHAMADO, IMP_ORDEM_CHAMADO).map(o => impChamadoLinha(o, S));
  }
  document.getElementById("imp-preview").innerHTML = impS.tab === "clientes" ? impClientesPreviaHTML(S) : impChamadosPreviaHTML(S);
  impRefreshPrev();
}

function impConfirmar() {
  const S = impS[impS.tab];
  if (!S.rows) return;
  if (impS.tab === "clientes") {
    let novas = 0, preenchidas = 0;
    S.rows.forEach(r => {
      if (!impClienteEfetiva(S, r)) return;
      if (r.acao === "nova") {
        state.clients.push({
          id: nextClientId(), buildingId: S.buildingId, unit: r.unit.trim(),
          garage: r.garage, name: r.name, phone: r.phone, email: r.email, escritura: r.escritura, notes: r.notes,
        });
        novas++;
      } else {
        impClienteVaiPreencher(r).forEach(f => { r.existing[f] = r[f]; });
        preenchidas++;
      }
    });
    persist(); closeModal(); renderAll();
    toast(`${novas} unidade(s) nova(s)${preenchidas ? ` e ${preenchidas} completada(s)` : ""}.`, "success");
    return;
  }
  const marcadas = S.rows.filter(r => r.checked);
  if (!marcadas.length || marcadas.some(r => impChamadoFaltando(r).length)) return;
  marcadas.slice().sort((a, b) => a.data.localeCompare(b.data)).forEach(impCriarChamado);
  persist(); closeModal(); renderAll();
  toast(`${marcadas.length} chamado(s) importado(s).`, "success");
}

function impWire() {
  const root = document.getElementById("imp-root");
  document.getElementById("imp-confirmar").addEventListener("click", impConfirmar);
  root.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-imp-tab]");
    if (tab) { const S = impS[impS.tab]; const t = document.getElementById("imp-texto"); if (t) S.texto = t.value; impS.tab = tab.dataset.impTab; impRender(); return; }
    if (e.target.id === "imp-analisar") impAnalisar();
  });
  root.addEventListener("input", (e) => {
    const S = impS[impS.tab];
    if (e.target.id === "imp-texto") { S.texto = e.target.value; return; }
    const f = e.target.dataset && e.target.dataset.f;
    if (!f || e.target.type === "checkbox" || e.target.tagName === "SELECT" || e.target.type === "date") return;
    S.rows[Number(e.target.dataset.i)][f] = e.target.value;
    if (impS.tab === "clientes" && f === "unit") impClientesRecalcular(S);
    impRefreshPrev();
  });
  root.addEventListener("change", (e) => {
    const S = impS[impS.tab];
    if (e.target.id === "imp-predio") {
      S.buildingId = e.target.value;
      if (S.rows && impS.tab === "clientes") { impClientesRecalcular(S); S.rows.forEach(r => { r.checked = r.acao === "nova" || (r.acao === "preencher" && impClienteVaiPreencher(r).length > 0); }); document.getElementById("imp-preview").innerHTML = impClientesPreviaHTML(S); }
      impRefreshPrev();
      return;
    }
    if (e.target.id === "imp-atualizar") { S.atualizarVazios = e.target.checked; impRefreshPrev(); return; }
    const f = e.target.dataset && e.target.dataset.f;
    if (!f) return;
    const r = S.rows[Number(e.target.dataset.i)];
    r[f] = f === "checked" ? e.target.checked : e.target.value;
    if (impS.tab === "chamados" && f === "status") {
      document.getElementById("imp-preview").innerHTML = impChamadosPreviaHTML(S);
    }
    if (impS.tab === "chamados" && f === "data") r.avisos = r.avisos.filter(a => !/^Data inválida/.test(a));
    if (impS.tab === "chamados" && f === "buildingId") r.avisos = r.avisos.filter(a => !/^Empreendimento|^Mais de um/.test(a));
    impRefreshPrev();
  });
}
