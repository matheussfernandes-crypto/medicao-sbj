/* ---------- Captura rápida ---------- */
/* Caixa de texto na tela inicial: frases soltas -> prévia editável -> grava.
   Interpretação 100% local (regras e palavras-chave, sem IA externa). Nada é
   gravado antes do usuário conferir a prévia e clicar em "Salvar". Na dúvida o
   parser escolhe o tipo mais simples (chamado) e deixa o campo vazio/destacado
   em vez de chutar — erra pro lado seguro. Os registros criados usam exatamente
   os mesmos formatos dos formulários normais (chamado, modificação, atividade
   com execução, anotação do empreendimento). */

const QC_TIPOS = [
  { id: "chamado", label: "Chamado" },
  { id: "modificacao", label: "Modificação" },
  { id: "compromisso", label: "Compromisso / visita" },
  { id: "anotacao", label: "Anotação" },
];
/* Campos que fazem sentido (aparecem) / são obrigatórios (travam o Salvar) por tipo. */
const QC_RELEVANTES = {
  chamado: ["sistema", "unit", "data", "horario", "prioridade"],
  modificacao: ["unit", "data"],
  compromisso: ["sistema", "unit", "data", "horario"],
  anotacao: ["unit", "data"],
};
const QC_OBRIGATORIOS = {
  chamado: ["buildingId", "sistema", "desc"],
  modificacao: ["buildingId", "unit", "desc"],
  compromisso: ["buildingId", "sistema", "desc", "data"],
  anotacao: ["buildingId", "desc"],
};
const QC_CAMPO_LABEL = { buildingId: "empreendimento", sistema: "sistema do problema", unit: "unidade", desc: "descrição", data: "data" };
/* Atalhos de um toque; a lista completa (CATEGORIES) fica no select. */
const QC_SISTEMAS_RAPIDOS = ["Hidráulica", "Elétrica", "Esquadrias", "Impermeabilização", "Pintura", "Revestimentos", "Portas", "Estrutural"];

const QC_STOP_PREDIO = new Set(["residencial", "ilha", "ilhas", "de", "do", "da", "dos", "das", "edificio", "ed", "condominio", "torre", "bloco"]);
const QC_PALAVRAS_LIGACAO = new Set(["residencial", "ilha", "ilhas", "de", "do", "da", "dos", "das", "no", "na", "nos", "nas", "em", "ao", "edificio", "ed", "condominio", "predio"]);

const QC_CATEGORIAS = [
  /* Infiltração, umidade, mofo, goteira, vazamento e trinca/fissura NÃO sugerem sistema:
     a causa pode estar em outro (ex.: infiltração por falta de vedação da janela). */
  [/\bimpermeabiliza\w*/, "Impermeabilização"],
  [/\b(cano|torneira|registro|esgoto|entupi\w*|descarga|ralo|hidraulic\w*|bomba|caixa d agua)\b/, "Hidráulica"],
  [/\b(lampada\w*|luminaria\w*|tomada\w*|interruptor\w*|disjuntor\w*|fiacao|quadro de luz|eletric\w*|iluminacao|curto)\b/, "Elétrica"],
  [/\belevador\w*/, "Elevadores"],
  [/\b(portao|portoes|motor do portao)\b/, "Portões"],
  [/\b(fechadura\w*|macaneta\w*)\b/, "Fechaduras"],
  [/\bporta(s)?\b/, "Portas"],
  [/\b(janela\w*|esquadria\w*|persiana\w*)\b/, "Esquadrias"],
  [/\bvidro\w*/, "Vidros"],
  [/\b(pintura|pintar|tinta|descascando)\b/, "Pintura"],
  [/\b(gesso|forro)\b/, "Gesso"],
  [/\brodape\w*/, "Rodapés"],
  [/\b(porcelanato|ceramica|azulejo\w*|revestimento\w*)\b/, "Revestimentos"],
  [/\bpiso\w*/, "Pisos"],
  [/\bfachada\b/, "Fachada"],
  [/\b(incendio|extintor\w*|hidrante\w*|alarme)\b/, "Sistemas de Incêndio"],
  [/\bgas\b/, "Gás"],
  [/\b(marcenaria|armario\w*)\b/, "Marcenaria"],
  [/\b(ar condicionado|split)\b/, "Climatização"],
  [/\bcobertura\b/, "Cobertura"],
];
/* [regex, localTipo, ambiente] — só usado quando não há unidade na frase. */
const QC_LOCAIS = [
  [/\bcorredor\w*/, "area_comum", "Corredores"],
  [/\bhall\b/, "area_comum", "Hall de entrada"],
  [/\belevador\w*/, "area_comum", "Elevadores"],
  [/\bescada\w*/, "area_comum", "Escadaria"],
  [/\bportaria\b/, "area_comum", "Portaria"],
  [/\brecepcao\b/, "area_comum", "Recepção"],
  [/\blixeira\b/, "area_comum", "Lixeira"],
  [/\bpiscina\b/, "area_lazer", "Piscina"],
  [/\bsalao de festas\b/, "area_lazer", "Salão de festas"],
  [/\bchurrasqueira\b/, "area_lazer", "Churrasqueira"],
  [/\bacademia\b/, "area_lazer", "Academia"],
  [/\bplayground\b/, "area_lazer", "Playground"],
  [/\bgaragem\b/, "garagem", ""],
  [/\bportao\b/, "garagem", "Portão"],
  [/\bfachada\b/, "fachada", ""],
  [/\bcobertura\b/, "cobertura", ""],
  [/\b(jardim|jardins)\b/, "area_externa", "Jardins"],
  [/\bcalcada\w*/, "area_externa", "Calçadas"],
  [/\bcasa de (bombas|maquinas)\b/, "area_tecnica", ""],
  [/\breservatorio\w*/, "area_tecnica", "Reservatórios"],
];
const QC_ALIASES_ITEM = [
  [/\bparede\w*/, "Alvenaria"],
  [/\b(ponto de luz|tomada\w*|interruptor\w*)\b/, "Elétrica"],
  [/\b(ar condicionado)\b/, "Split"],
  [/\b(pia|torneira|ponto de agua)\b/, "Hidráulica"],
  [/\b(pintura|pintar)\b/, "Tinta"],
];


/* ---------- Normalização e utilidades ---------- */

/* Minúsculas e sem acento, MANTENDO o mesmo comprimento do texto original
   (cada caractere vira exatamente um caractere) — assim as posições achadas no
   texto normalizado valem também pro original, e dá pra recortar trechos. */
function qcNorm(str) {
  return Array.from(String(str)).map(ch => {
    if (ch.length !== 1) return " ".repeat(ch.length);
    const b = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return b.length === 1 ? b : ch.toLowerCase();
  }).join("");
}
function qcMask(n, spans) {
  const arr = n.split("");
  spans.forEach(([s, e]) => { for (let i = s; i < e && i < arr.length; i++) arr[i] = " "; });
  return arr.join("");
}
function qcMergeSpans(spans) {
  const sorted = spans.slice().sort((a, b) => a[0] - b[0]);
  const out = [];
  sorted.forEach(sp => {
    const last = out[out.length - 1];
    if (last && sp[0] <= last[1] + 1) last[1] = Math.max(last[1], sp[1]);
    else out.push([sp[0], sp[1]]);
  });
  return out;
}
function qcAddDays(iso, n) { const d = toLocalDate(iso); d.setDate(d.getDate() + n); return toISODateString(d); }
function qcValidDate(y, m, d) { const dt = new Date(y, m - 1, d); return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d; }
function qcISO(y, m, d) { return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
function qcCap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/* ---------- Data e horário ---------- */

function qcExtractDate(nm, hoje, spans) {
  const [hy, hm, hd] = hoje.split("-").map(Number);
  let m = /\b(?:dia\s+)?(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/.exec(nm);
  if (m) {
    const d = +m[1], mo = +m[2];
    let y = m[3] ? +m[3] : hy;
    if (y < 100) y += 2000;
    if (mo >= 1 && mo <= 12 && qcValidDate(y, mo, d)) { spans.push([m.index, m.index + m[0].length]); return qcISO(y, mo, d); }
  }
  m = /\bdepois\s+de\s+amanha\b/.exec(nm);
  if (m) { spans.push([m.index, m.index + m[0].length]); return qcAddDays(hoje, 2); }
  m = /\bamanha\b/.exec(nm);
  if (m) { spans.push([m.index, m.index + m[0].length]); return qcAddDays(hoje, 1); }
  m = /\bhoje\b/.exec(nm);
  if (m) { spans.push([m.index, m.index + m[0].length]); return hoje; }
  m = /\bontem\b/.exec(nm);
  if (m) { spans.push([m.index, m.index + m[0].length]); return qcAddDays(hoje, -1); }
  m = /\b(?:daqui\s+a|em)\s+(\d{1,3})\s+dias?\b/.exec(nm);
  if (m) { spans.push([m.index, m.index + m[0].length]); return qcAddDays(hoje, +m[1]); }
  m = /\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?(?!\s+(?:via|demao|mao|vez|etapa|opcao))(?:\s+(?:que\s+vem|proxima))?\b/.exec(nm);
  if (m) {
    const alvo = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 }[m[1]];
    const delta = ((alvo - toLocalDate(hoje).getDay() + 7) % 7) || 7;
    spans.push([m.index, m.index + m[0].length]);
    return qcAddDays(hoje, delta);
  }
  m = /\bdia\s+(\d{1,2})\b/.exec(nm);
  if (m) {
    const d = +m[1];
    let y = hy, mo = hm;
    if (d < hd) { mo++; if (mo > 12) { mo = 1; y++; } }
    if (!qcValidDate(y, mo, d)) { mo++; if (mo > 12) { mo = 1; y++; } }
    if (qcValidDate(y, mo, d)) { spans.push([m.index, m.index + m[0].length]); return qcISO(y, mo, d); }
  }
  return "";
}

function qcExtractTime(nm, spans) {
  let m, h = null, min = 0, start, end;
  if ((m = /\b(?:as\s+)?(\d{1,2})\s*(?:h|hs)(?:\s*(\d{2}))?\b/.exec(nm))) { h = +m[1]; min = m[2] ? +m[2] : 0; }
  else if ((m = /\bas\s+(\d{1,2})\s*horas?\b/.exec(nm))) { h = +m[1]; }
  else if ((m = /\b(\d{1,2}):(\d{2})\b/.exec(nm))) { h = +m[1]; min = +m[2]; }
  else if ((m = /\bas\s+(\d{1,2})(?=\s*(?:da\s+(?:manha|tarde|noite)|[,.;]|$))/.exec(nm))) { h = +m[1]; }
  if (h === null || h > 23 || min > 59) return "";
  start = m.index; end = m.index + m[0].length;
  const per = /^\s*da\s+(manha|tarde|noite)\b/.exec(nm.slice(end));
  if (per) { end += per[0].length; if (per[1] !== "manha" && h < 12) h += 12; }
  spans.push([start, end]);
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/* ---------- Empreendimento ---------- */

function qcMatchBuilding(nm) {
  const words = Array.from(nm.matchAll(/[a-z0-9]+/g)).map(x => ({ w: x[0], s: x.index, e: x.index + x[0].length }));
  const wordSet = new Set(words.map(x => x.w));
  const scored = state.buildings.map(b => {
    const toks = (qcNorm(b.name).match(/[a-z0-9]+/g) || []).filter(t => t.length >= 3 && !QC_STOP_PREDIO.has(t));
    const matched = toks.filter(t => wordSet.has(t));
    return { b, toks, matched, frac: toks.length ? matched.length / toks.length : 0, chars: matched.reduce((a, t) => a + t.length, 0) };
  }).filter(x => x.matched.length > 0);
  if (!scored.length) return { id: "", candidates: [], tokens: [] , words };
  scored.sort((a, b) => b.matched.length - a.matched.length || b.frac - a.frac || b.chars - a.chars);
  const top = scored[0];
  const empatados = scored.filter(x => x.matched.length === top.matched.length && x.frac === top.frac && x.chars === top.chars);
  if (empatados.length > 1) return { id: "", candidates: empatados.map(x => x.b.id), tokens: [], words };
  return { id: top.b.id, candidates: [], tokens: top.matched, words };
}
/* Recorta o nome do prédio (e as palavras de ligação "no", "do", "Residencial
   Ilha de"… logo antes) da descrição, pra sobrar só o essencial. */
function qcSpansDoPredio(match, nm) {
  const spans = [];
  match.tokens.forEach(tok => {
    match.words.filter(w => w.w === tok).forEach(w => {
      let s = w.s;
      for (;;) {
        const prev = match.words.filter(x => x.e <= s && nm.slice(x.e, s).trim() === "").pop();
        if (prev && QC_PALAVRAS_LIGACAO.has(prev.w)) s = prev.s; else break;
      }
      spans.push([s, w.e]);
    });
  });
  return spans;
}

/* ---------- Unidade ---------- */

function qcExtractUnit(nm, spans) {
  let m = /\b(?:(apartamento|apto|apt|ap|unidade)\.?\s*(?:n[o°º]?\s*)?|(?:sala|loja|cobertura|casa)\s+)(\d{2,4}[a-z]?)\b/.exec(nm);
  if (m) {
    const num = m[2];
    const numStart = m.index + m[0].lastIndexOf(num);
    spans.push([numStart, numStart + num.length]);
    if (m[1]) spans.push([m.index, numStart]);
    return num.toUpperCase();
  }
  const re = /\b(\d{3,4})\b/g;
  while ((m = re.exec(nm))) {
    const antes = nm.slice(Math.max(0, m.index - 3), m.index);
    const depois = nm.slice(m.index + m[0].length, m.index + m[0].length + 8);
    if (/r\$\s*$/.test(antes) || /^\s*(reais|mil|m2|metros|kg)/.test(depois)) continue;
    spans.push([m.index, m.index + m[0].length]);
    return m[0];
  }
  return "";
}

/* ---------- Prioridade, filler e limpeza do texto ---------- */

function qcExtractPriority(nm, spans) {
  const regras = [
    [/\b(urgente|urgencia|emergencia|emergencial|imediato|imediata)\b/, "critica"],
    [/\b(prioritario|prioritaria|prioridade alta|importante)\b/, "alta"],
    [/\b(sem pressa|quando puder|quando der|prioridade baixa)\b/, "baixa"],
  ];
  for (const [re, p] of regras) {
    const m = re.exec(nm);
    if (m) { spans.push([m.index, m.index + m[0].length]); return p; }
  }
  return "";
}
function qcExtractFillers(nm, spans) {
  const re = /\b(?:por favor|favor|coloca(?:r)?(?:\s+isso)?\s+na\s+agenda|coloque\s+na\s+agenda|poe\s+na\s+agenda|na\s+agenda|agendar|marcar|preciso\s+de|precisamos\s+de|preciso|precisamos|tenho\s+que|temos\s+que|anota\s+ai)\b/g;
  let m;
  while ((m = re.exec(nm))) spans.push([m.index, m.index + m[0].length]);
}
function qcLimpar(o, spans) {
  const merged = qcMergeSpans(spans);
  let out = "", pos = 0;
  merged.forEach(([s, e]) => { out += o.slice(pos, s) + " "; pos = e; });
  out += o.slice(pos);
  out = out.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1");
  out = out.replace(/(^|\s)[,;:.\-–]+(?=\s|$)/g, "$1");
  const sobra = /^(?:a|o|as|os|de|do|da|dos|das|no|na|nos|nas|em|ao|para|pra|pro|ate|e|com|que|dia)$/i;
  let ws = out.trim().split(" ").filter(Boolean);
  while (ws.length && (sobra.test(qcNorm(ws[ws.length - 1]).replace(/[^a-z]/g, "")) || /^[,;:.\-–]+$/.test(ws[ws.length - 1]))) ws.pop();
  const sobraInicio = /^(?:de|do|da|dos|das|no|na|nos|nas|em|ao|para|pra|pro|ate|e|com|que|dia)$/i;
  while (ws.length && sobraInicio.test(qcNorm(ws[0]).replace(/[^a-z]/g, ""))) ws.shift();
  out = ws.join(" ").replace(/[,;:.\-–\s]+$/, "").replace(/^[,;:.\-–\s]+/, "");
  return qcCap(out);
}

/* Relato do que está acontecendo/aconteceu ("pintores fazendo reparos na
   fachada", "o técnico terminou o serviço") não é um pedido de conserto: vai
   pro histórico do empreendimento como anotação. Só vale se a frase não tiver
   cara de demanda (problema, trocar, consertar, urgente…). */
function qcEhRelato(n) {
  const relato = /\b(fazendo|executando|realizando|instalando|pintando|consertando|reparando|trocando|limpando|em obra|esta(?:o)? fazendo|fez|fizeram|foi feito|foram feitos|concluiu|concluiram|terminou|terminaram|finalizou|finalizaram|entregou|chegou|chegaram|compareceu|compareceram)\b/;
  const demanda = /\b(precisa|precisam|preciso|precisamos|trocar|consertar|arrumar|verificar|resolver|problema|quebrad\w*|defeito|urgente|pedir|solicitar|vazamento|vazando|entupid\w*)\b/;
  return relato.test(n) && !demanda.test(n);
}

/* ---------- Interpretação de uma linha ---------- */

function qcParseLine(line, refISO) {
  const o = String(line).replace(/\s+/g, " ").trim();
  const n = qcNorm(o);
  const spans = [];
  const hoje = refISO || todayISODate();
  let tipo = "";

  const mNota = /^(anotacao|anotar|anota|observacao|obs|lembrete|nota)\s*[:\-–]\s*/.exec(n) || /^(anotacao|anotar|anota|lembrete)\b\s*/.exec(n);
  if (mNota) { spans.push([0, mNota[0].length]); tipo = "anotacao"; }

  let nm = qcMask(n, spans);
  const data = qcExtractDate(nm, hoje, spans);
  nm = qcMask(n, spans);
  const horario = qcExtractTime(nm, spans);
  nm = qcMask(n, spans);
  const prioridade = qcExtractPriority(nm, spans);
  qcExtractFillers(qcMask(n, spans), spans);
  nm = qcMask(n, spans);
  const unit = qcExtractUnit(nm, spans);
  nm = qcMask(n, spans);

  const predio = qcMatchBuilding(nm);
  if (predio.id) spans.push(...qcSpansDoPredio(predio, nm));

  // itens do mapa de modificações citados (usado só se o tipo for modificação)
  const itensMapa = [];
  (state.mapItems || []).forEach(item => {
    const palavras = (qcNorm(item).match(/[a-z]+/g) || []).filter(w => w.length >= 4);
    if (palavras.some(w => new RegExp("\\b" + w + "\\w*").test(n))) itensMapa.push(item);
  });
  QC_ALIASES_ITEM.forEach(([re, item]) => { if (re.test(n) && (state.mapItems || []).includes(item) && !itensMapa.includes(item)) itensMapa.push(item); });

  if (!tipo) {
    const querCliente = /\b(cliente|proprietari[oa]|dono)\b/.test(n) && /\b(quer|querem|pediu|solicitou|solicita|deseja|gostaria)\b/.test(n);
    if (/\bmodific\w*/.test(n) || (querCliente && itensMapa.length)) tipo = "modificacao";
    else if (/\b(visita|vistoria|reuniao|agendar|agenda|marcar|compromisso)\b/.test(n)) tipo = "compromisso";
    else if (qcEhRelato(n)) tipo = "anotacao";
    else if (/\btecnico\b/.test(n) && (data || horario)) tipo = "compromisso";
    else tipo = "chamado";
  }

  let sugestao = "";
  for (const [re, cat] of QC_CATEGORIAS) { if (re.test(n) && !(cat === "Cobertura" && unit)) { sugestao = cat; break; } }

  let localTipo = unit ? "unidade_privativa" : "area_comum";
  let ambiente = "";
  if (!unit) {
    const loc = QC_LOCAIS.find(([re]) => re.test(n));
    if (loc) { localTipo = loc[1]; ambiente = loc[2]; }
  }

  const desc = qcLimpar(o, spans);
  return {
    tipo, buildingId: predio.id, candidatos: predio.candidates, unit, data, horario,
    prioridade: prioridade || "media", prioridadeDetectada: !!prioridade,
    desc: desc || qcCap(o), raw: o,
    sistema: "", meta: { sugestao, localTipo, ambiente, itensMapa },
  };
}

/* ---------- Prévia ---------- */

function qcCampoCompleto(r, campo) { return !!String(r[campo] || "").trim(); }
function qcFaltando(r) {
  return (QC_OBRIGATORIOS[r.tipo] || []).filter(c => !qcCampoCompleto(r, c));
}
function qcDica(r) {
  const dicas = [];
  if (r.candidatos && r.candidatos.length > 1 && !r.buildingId) {
    dicas.push("Mais de um empreendimento combina: " + r.candidatos.map(id => (getBuilding(id) || {}).name).filter(Boolean).join(", ") + ".");
  }
  if (r.tipo === "chamado" && r.data) dicas.push("Com data, o chamado já nasce com a atividade “Realizar reparo” agendada.");
  if (r.tipo === "compromisso" && r.data && !r.horario) dicas.push("Sem horário, a visita fica no chamado mas não aparece na grade da Agenda.");
  if (r.tipo === "compromisso") dicas.push("Cria um chamado no empreendimento com a visita agendada.");
  if (r.tipo === "anotacao") dicas.push("Fica no histórico do empreendimento (ficha do prédio), sem abrir chamado.");
  if (r.tipo === "modificacao" && r.meta.itensMapa.length) dicas.push("Itens do mapa: " + r.meta.itensMapa.join(", ") + ".");
  if (r.origem) {
    dicas.push(`Veio do ${qcOrigemTexto(r.origem)}; a mensagem original fica no histórico.`);
    if (r.tipo === "anotacao" && !r.data) dicas.push("Sem data na frase: a anotação entra com a data da mensagem.");
  }
  return dicas.join(" ");
}

function qcRowHTML(r, i) {
  const opt = (v, l, sel) => `<option value="${escapeHtml(v)}" ${sel ? "selected" : ""}>${escapeHtml(l)}</option>`;
  return `
  <div class="qc-row" data-i="${i}">
    <label class="qc-check"><input type="checkbox" data-f="checked" ${r.checked ? "checked" : ""}></label>
    <div class="qc-body">
      <div class="qc-raw hint">${r.origem ? `<strong>${escapeHtml(qcOrigemTexto(r.origem))}</strong> · ` : ""}“${escapeHtml(r.raw)}”</div>
      <div class="qc-fields">
        <div class="field qc-f qc-f-tipo"><label>Tipo</label><select data-f="tipo">${QC_TIPOS.map(t => opt(t.id, t.label, t.id === r.tipo)).join("")}</select></div>
        <div class="field qc-f qc-f-buildingId"><label>Empreendimento</label><select data-f="buildingId"><option value="">Escolha o empreendimento…</option>${state.buildings.map(b => opt(b.id, b.name, b.id === r.buildingId)).join("")}</select></div>
        <div class="field qc-f qc-f-sistema">
          <label>Sistema / área do problema</label>
          <div class="qc-chips">
            ${r.meta.sugestao && r.meta.sugestao !== r.sistema ? `<button type="button" class="qc-chip qc-chip-sug" data-sistema="${escapeHtml(r.meta.sugestao)}">Sugestão: ${escapeHtml(r.meta.sugestao)}</button>` : ""}
            ${QC_SISTEMAS_RAPIDOS.map(s => `<button type="button" class="qc-chip ${s === r.sistema ? "ativo" : ""}" data-sistema="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}
          </div>
          <select data-f="sistema"><option value="">Escolha o sistema…</option>${CATEGORIES.map(c => opt(c, c, c === r.sistema)).join("")}</select>
        </div>
        <div class="field qc-f qc-f-unit"><label>Unidade</label><input type="text" data-f="unit" value="${escapeHtml(r.unit)}" placeholder="Ex: 302"></div>
        <div class="field qc-f qc-f-data"><label>Data</label><input type="date" data-f="data" value="${escapeHtml(r.data)}"></div>
        <div class="field qc-f qc-f-horario"><label>Horário</label><input type="time" data-f="horario" value="${escapeHtml(r.horario)}"></div>
        <div class="field qc-f qc-f-prioridade"><label>Prioridade</label><select data-f="prioridade">${PRIORITIES.map(p => opt(p.id, p.label, p.id === r.prioridade)).join("")}</select></div>
        <div class="field qc-f qc-f-desc"><label>Descrição</label><input type="text" data-f="desc" value="${escapeHtml(r.desc)}"></div>
      </div>
      <div class="qc-status hint"></div>
    </div>
  </div>`;
}

/* ---------- Conversa do WhatsApp colada inteira ---------- */
/* Reconhece a exportação do WhatsApp (Android: "21/10/2026 08:11 - Nome: texto";
   iPhone: "[21/10/2026 08:11:35] Nome: texto"), junta as linhas de continuação à
   mensagem anterior e separa o que é ruído (mídia sem legenda, mensagem apagada,
   aviso do sistema, "ok"/saudação). Cada mensagem útil vira uma linha da prévia
   normal — mesmo parser, mesma conferência. A data da mensagem NÃO vira data de
   agendamento: só serve de referência pra "hoje/ontem" e pro histórico. */

const QC_WA_ANDROID = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(?:[ap]\.?m\.?)?\s+-\s+([\s\S]*)$/i;
const QC_WA_IOS = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(?:[ap]\.?m\.?)?\]\s+([\s\S]*)$/i;

function qcParseWhatsApp(texto) {
  const limpo = String(texto).replace(/[‎‏‪-‬ ]/g, " ").replace(/ /g, " ");
  const mensagens = [];
  limpo.split(/\r?\n/).forEach(bruta => {
    const l = bruta.trim();
    let m = QC_WA_ANDROID.exec(l) || QC_WA_IOS.exec(l);
    if (m) {
      const ano = +m[3] < 100 ? 2000 + +m[3] : +m[3];
      if (!qcValidDate(ano, +m[2], +m[1])) m = null;
    }
    if (m) {
      const ano = +m[3] < 100 ? 2000 + +m[3] : +m[3];
      const resto = m[6];
      const i = resto.indexOf(": ");
      const ehMensagem = i > 0 && i <= 60;
      mensagens.push({
        dataISO: qcISO(ano, +m[2], +m[1]),
        autor: ehMensagem ? resto.slice(0, i).trim() : "",
        texto: ehMensagem ? resto.slice(i + 2) : resto,
        sistema: !ehMensagem,
      });
    } else if (mensagens.length && l) {
      mensagens[mensagens.length - 1].texto += "\n" + l;
    }
  });
  if (!mensagens.length) return null;
  mensagens.forEach(m => {
    m.texto = m.texto
      .replace(/<mensagem editada>/ig, " ")
      .replace(/<anexado:[^>]*>/ig, " ")
      .replace(/\S+\.(?:jpe?g|png|webp|mp4|opus|m4a|pdf|docx?|xlsx?)\s*\((?:arquivo anexado|file attached)\)/ig, " ")
      .replace(/\s+/g, " ").trim();
  });
  return mensagens;
}

/* Devolve o motivo de descarte ("" quando a mensagem é útil). */
function qcMotivoRuido(m) {
  if (m.sistema) return "aviso do sistema";
  const n = qcNorm(m.texto);
  if (!n.trim()) return m.texto.trim() ? "só emoji" : "mídia sem texto";
  if (/<?midia oculta>?|<media omitted>|\b(imagem|video|audio|figurinha|documento|gif|contato)\s+(omitid[oa]|ocultad[oa])\b|\bsticker omitted\b/.test(n)) return "mídia sem texto";
  if (/mensagem apagada|voce apagou esta mensagem/.test(n)) return "mensagem apagada";
  if (/aguardando esta mensagem|\b(ligacao|chamada) (perdida|de voz|de video)\b/.test(n)) return "ligação / aviso";
  if (n.replace(/[^a-z0-9]/g, "").length < 4) return "muito curta";
  const s = n.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (/^((ok|okay|blz|beleza|certo|show|perfeito|combinado|valeu|vlw|obrigad[oa]|obg|opa|oi|ola|sim|nao|tudo bem|ta bom|bom dia|boa tarde|boa noite|boa|bora|de nada|fechado|entendi|ciente|ate mais|abraco|abracos)\s?)+$/.test(s)) return "saudação / confirmação";
  return "";
}

function qcOrigemTexto(o) {
  return `WhatsApp — ${o.autor || "sem nome"}, ${fmtDate(o.dataISO).slice(0, 5)}`;
}

/* ---------- Caixa de captura (uma por tela: Painel Geral e ficha do prédio) ---------- */
/* Fábrica: cada caixa tem seu próprio estado e seus próprios eventos (nada de ids
   fixos), então pode existir uma no Painel Geral e outra na ficha do empreendimento.
   Com buildingIdPadrao, frases sem empreendimento claro caem nesse prédio; se a
   frase citar outro prédio com clareza, vale o citado. */

function criarCapturaRapida(container, opts = {}) {
  const padrao = opts.buildingIdPadrao || "";
  let rows = [];
  let ignoradas = [];
  let resumoWA = null;
  let ignoradasAbertas = false;

  container.innerHTML = `
    <div class="panel qc-panel" style="margin-bottom:16px;">
      <div class="qc-topo"><span class="qc-raio">${typeof ckIco === "function" ? ckIco("raio", 18) : ""}</span><div><h3>Captura rápida</h3><div class="hint">Escreva ou cole a mensagem do cliente. O site separa os chamados e você confere antes de salvar.</div></div></div>
      <textarea class="qc-input" rows="2" placeholder="${padrao ? "Escreva do seu jeito, uma frase por linha — ex: vazamento na 302, urgente" : "Escreva do seu jeito, uma frase por linha — ex: vazamento na cobertura 302 do Ibiza, urgente"}"></textarea>
      <div class="qc-barra">
        <span class="hint">Enter analisa · Shift+Enter quebra a linha · aceita conversa inteira do WhatsApp</span>
        <button type="button" class="btn primary small qc-analisar">Analisar</button>
      </div>
      <div class="qc-preview"></div>
      <div class="qc-result"></div>
    </div>`;
  const q = (s) => container.querySelector(s);
  const input = q(".qc-input"), prev = q(".qc-preview"), result = q(".qc-result");

  function aplicarPadrao(r) {
    if (!r.buildingId && padrao) { r.buildingId = padrao; r.candidatos = []; }
    return r;
  }
  function linhaDeTexto(l) { return aplicarPadrao({ ...qcParseLine(l), checked: true }); }
  function linhaDeMensagem(m) {
    const r = qcParseLine(m.texto, m.dataISO);
    r.origem = { autor: m.autor, dataISO: m.dataISO };
    r.checked = true;
    return aplicarPadrao(r);
  }

  function refreshRow(i) {
    const r = rows[i];
    const el = prev.querySelector(`.qc-row[data-i="${i}"]`);
    if (!el) return;
    const relevantes = QC_RELEVANTES[r.tipo] || [];
    const obrigatorios = QC_OBRIGATORIOS[r.tipo] || [];
    ["sistema", "unit", "data", "horario", "prioridade"].forEach(c => {
      el.querySelector(`.qc-f-${c}`).style.display = relevantes.includes(c) ? "" : "none";
    });
    ["tipo", "buildingId", "sistema", "unit", "data", "horario", "prioridade", "desc"].forEach(c => {
      const f = el.querySelector(`.qc-f-${c}`);
      const faltando = r.checked && obrigatorios.includes(c) && !qcCampoCompleto(r, c);
      f.classList.toggle("qc-missing", faltando);
    });
    el.classList.toggle("qc-off", !r.checked);
    const faltam = qcFaltando(r);
    el.querySelector(".qc-status").innerHTML =
      (r.checked && faltam.length ? `<strong class="qc-aviso">Falta: ${faltam.map(c => QC_CAMPO_LABEL[c]).join(", ")}.</strong> ` : "") + escapeHtml(qcDica(r));
  }
  function refreshSave() {
    const btn = q(".qc-salvar");
    if (!btn) return;
    const marcadas = rows.filter(r => r.checked);
    btn.disabled = !(marcadas.length > 0 && marcadas.every(r => qcFaltando(r).length === 0));
    btn.textContent = `Salvar ${marcadas.length} ${marcadas.length === 1 ? "item" : "itens"}`;
  }

  function render() {
    const ignHTML = ignoradas.length ? `
      <details class="qc-ignoradas" ${ignoradasAbertas ? "open" : ""}>
        <summary>${ignoradas.length} ${ignoradas.length === 1 ? "mensagem ignorada" : "mensagens ignoradas"} — ver e incluir se quiser</summary>
        ${ignoradas.map((x, k) => `
          <div class="qc-ign">
            <div><span class="hint">${escapeHtml(x.motivo)} · ${escapeHtml(qcOrigemTexto({ autor: x.m.autor, dataISO: x.m.dataISO }))}</span>
              <div>${x.m.texto ? "“" + escapeHtml(x.m.texto) + "”" : "<em>(sem texto)</em>"}</div></div>
            ${x.m.texto ? `<button type="button" class="btn ghost small" data-incluir="${k}">Incluir</button>` : ""}
          </div>`).join("")}
      </details>` : "";
    prev.innerHTML = `
      ${resumoWA ? `<div class="qc-wa hint">Conversa do WhatsApp: ${resumoWA.total} mensagens · ${rows.length} aproveitadas · ${ignoradas.length} ignoradas.</div>` : ""}
      ${rows.length ? `<div class="qc-lista">${rows.map(qcRowHTML).join("")}</div>` : `<div class="empty-hint">Nenhuma mensagem útil encontrada.</div>`}
      ${ignHTML}
      <div class="qc-rodape">
        <button type="button" class="btn ghost qc-descartar">Descartar</button>
        <button type="button" class="btn primary qc-salvar">Salvar</button>
      </div>`;
    rows.forEach((_, i) => refreshRow(i));
    refreshSave();
  }

  function limpar() {
    rows = []; ignoradas = []; resumoWA = null; ignoradasAbertas = false;
    prev.innerHTML = "";
  }

  function analisar() {
    result.innerHTML = "";
    ignoradas = []; resumoWA = null; ignoradasAbertas = false;
    if (!input.value.trim()) { rows = []; prev.innerHTML = ""; return; }
    if (!state.buildings.length) { toast("Cadastre um empreendimento antes de usar a captura rápida.", "error"); return; }
    const msgs = qcParseWhatsApp(input.value);
    if (msgs) {
      rows = [];
      msgs.forEach(m => {
        const motivo = qcMotivoRuido(m);
        if (motivo) ignoradas.push({ m, motivo }); else rows.push(linhaDeMensagem(m));
      });
      resumoWA = { total: msgs.length };
    } else {
      rows = input.value.split("\n").map(l => l.trim()).filter(Boolean).map(linhaDeTexto);
    }
    render();
  }

  function salvar() {
    const marcadas = rows.filter(r => r.checked);
    if (!marcadas.length || marcadas.some(r => qcFaltando(r).length)) return;
    const criados = [];
    marcadas.forEach(r => {
      if (r.tipo === "modificacao") criados.push(qcCriarModificacao(r));
      else if (r.tipo === "anotacao") criados.push(qcCriarAnotacao(r));
      else criados.push(qcCriarChamado(r, r.tipo === "chamado"));
    });
    persist();
    input.value = "";
    limpar();
    const nAnot = criados.filter(c => c === "anotação").length;
    const codigos = criados.filter(c => c !== "anotação");
    const partes = [];
    if (codigos.length) partes.push(codigos.join(", "));
    if (nAnot) partes.push(`${nAnot} ${nAnot === 1 ? "anotação" : "anotações"}`);
    result.innerHTML = `<div class="qc-ok">✓ ${criados.length} ${criados.length === 1 ? "item salvo" : "itens salvos"}: ${escapeHtml(partes.join(" · "))}</div>`;
    toast(`${criados.length} ${criados.length === 1 ? "item salvo" : "itens salvos"}.`, "success");
    renderAll();
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); analisar(); }
  });
  q(".qc-analisar").addEventListener("click", analisar);
  const onEdit = (e) => {
    const f = e.target.dataset && e.target.dataset.f;
    if (!f) return;
    const i = Number(e.target.closest(".qc-row").dataset.i);
    const r = rows[i];
    r[f] = f === "checked" ? e.target.checked : e.target.value;
    if (f === "buildingId") r.candidatos = [];
    refreshRow(i);
    refreshSave();
  };
  prev.addEventListener("input", onEdit);
  prev.addEventListener("change", onEdit);
  prev.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.sistema !== undefined) {
      const row = b.closest(".qc-row");
      if (row) { rows[Number(row.dataset.i)].sistema = b.dataset.sistema; render(); }
    }
    else if (b.classList.contains("qc-descartar")) limpar();
    else if (b.classList.contains("qc-salvar")) salvar();
    else if (b.dataset.incluir !== undefined) {
      const x = ignoradas.splice(Number(b.dataset.incluir), 1)[0];
      if (x) { rows.push(linhaDeMensagem(x.m)); ignoradasAbertas = true; render(); }
    }
  });
  prev.addEventListener("toggle", (e) => { if (e.target.classList && e.target.classList.contains("qc-ignoradas")) ignoradasAbertas = e.target.open; }, true);

  return { analisar, limpar };
}

/* Painel Geral: caixa sem prédio padrão. */
function initQuickCapture() {
  const c = document.getElementById("quick-capture");
  if (c) criarCapturaRapida(c);
}


/* ---------- Gravação ---------- */

function qcAcharCliente(buildingId, unit) {
  if (!unit) return null;
  return state.clients.find(c => c.buildingId === buildingId && String(c.unit).toLowerCase() === unit.toLowerCase()) || null;
}

function qcCriarChamado(r, comAtividade) {
  const b = getBuilding(r.buildingId);
  const unit = r.unit.trim();
  const client = qcAcharCliente(r.buildingId, unit);
  const ehCompromisso = r.tipo === "compromisso";
  const category = r.sistema || "Outros";
  const localTipo = unit ? "unidade_privativa" : r.meta.localTipo;
  const ambientes = !unit && r.meta.ambiente && qcNorm(r.meta.ambiente) !== qcNorm(category) ? [r.meta.ambiente] : [];
  const unitLabel = unit || (ambientes.join(", ") || LOCAL_TIPO_MAP[localTipo] || "—");
  const outrosDescricao = category === "Outros" ? r.desc.slice(0, 80) : "";
  const t = {
    id: nextTicketCode(),
    openedAt: new Date().toISOString(),
    buildingId: r.buildingId, unit: unitLabel,
    clientId: client ? client.id : "",
    origemSolicitacao: "Equipe interna",
    type: "posvenda",
    category, material: "", elemento: "", outrosDescricao,
    subcategory: "",
    localTipo, ambientes,
    ambienteDetalhe: ambientes[0] || "",
    local: ambientes.join(", "), ambiente: ambientes.join(", "),
    priority: ehCompromisso ? "media" : r.prioridade,
    title: generateTicketTitle(category, "", ambientes, localTipo, outrosDescricao),
    status: "novo",
    responsavelInterno: "", responsavelProximaAcao: "", proximaAcao: "",
    dataLimiteProximaAcao: "", dataAcompanhamento: "",
    dataUltimaAcao: todayISODate(), dataUltimaCobranca: "", proximaCobranca: "",
    descricaoSolicitacao: r.desc,
    analiseTecnica: { ...blankAnaliseTecnica(), problemaRelatado: r.desc },
    fornecedor: blankFornecedor(), fornecedores: [],
    encerramento: blankEncerramento(),
    plano: [], anexos: [], relatorios: [],
    requesterName: client ? (client.name || "") : "",
    requesterContact: client ? (client.phone || "") : "",
    history: [],
    _fornecedorMigrated: true,
  };
  addHistoryEntry(t, "Chamado aberto", r.origem
    ? `Origem: ${qcOrigemTexto(r.origem)} (captura rápida). Mensagem original: “${r.raw}”`
    : "Origem: Equipe interna (captura rápida).", "", "novo");
  if (r.data && (comAtividade || ehCompromisso)) {
    const vistoria = /vistoria/.test(qcNorm(r.desc));
    const nome = ehCompromisso ? (vistoria ? "Realizar vistoria" : r.desc.slice(0, 70)) : "Realizar reparo";
    const tipoAtv = ehCompromisso ? "acao" : "execucao";
    t.plano.push({
      ...blankAtividade(),
      id: "et" + Date.now() + Math.random().toString(36).slice(2, 6),
      nome, tipo: tipoAtv,
      execucoes: [{ ...blankExecucao(), id: "exec" + Date.now() + Math.random().toString(36).slice(2, 6), data: r.data, horario: r.horario || "" }],
    });
    addHistoryEntry(t, "Atividade adicionada ao plano de atendimento", nome);
    t.status = statusCalculadoPeloPlano(t);
  }
  state.tickets.push(t);
  return t.id;
}

function qcCriarModificacao(r) {
  const unit = r.unit.trim();
  const client = qcAcharCliente(r.buildingId, unit);
  const itensMapa = r.meta.itensMapa.slice();
  const m = {
    ...blankModification(),
    id: "mod" + Date.now() + Math.random().toString(36).slice(2, 6),
    code: nextModificationCode(),
    buildingId: r.buildingId, unit, clientId: client ? client.id : "",
    dataSolicitacao: r.data || todayISODate(),
    recebidoPor: getOperatorName(),
    categorias: deriveCategoriasFromItens(itensMapa),
    itensMapa,
    solicitacaoTexto: r.desc,
  };
  addModificationHistoryEntry(m, "Solicitação criada", r.origem
    ? `Captura rápida (${qcOrigemTexto(r.origem)}). Mensagem original: “${r.raw}”`
    : "Captura rápida.", "", m.status);
  state.modifications.push(m);
  return m.code;
}

function qcCriarAnotacao(r) {
  const b = getBuilding(r.buildingId);
  if (!b.anotacoes) b.anotacoes = [];
  b.anotacoes.push({
    id: "an" + Date.now() + Math.random().toString(36).slice(2, 6),
    data: r.data || (r.origem ? r.origem.dataISO : todayISODate()),
    autor: ensureOperatorName(),
    unit: r.unit.trim(),
    texto: r.desc,
    ...(r.origem ? { origem: qcOrigemTexto(r.origem) } : {}),
  });
  return "anotação";
}
