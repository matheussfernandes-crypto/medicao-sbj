/* ---------- Importar do manual do proprietário (PDF) ---------- */
/* Lê o PDF no próprio navegador (pdf.js, nada sai do computador), localiza as
   tabelas "Plano de manutenção preventiva" e "Prazos de garantia" e PROPÕE linhas
   para as duas matrizes do empreendimento. Nada é gravado antes da pessoa conferir
   a prévia e confirmar; cada linha leva a página e o trecho do manual como fonte.
   Não inventa prazo: se o manual não traz prazo (ex.: "Fabricante"), a linha vem
   sem prazo e marcada como garantia do fabricante. */

const MP_CATEGORIAS = [
  [/\b(impermeabiliz)/, "Impermeabilização"],
  [/\b(eletric|tomada|interruptor|disjuntor|fiacao|cabos?\b|eletroduto|quadro)/, "Elétrica"],
  [/\b(hidraulic|hidrossanit|esgoto|agua\b|tubula|louca|vaso sanit|metais|registro|ralo\b|sifao|hidrometro|caixa de gordura|tanque\b|bancada)/, "Hidráulica"],
  [/\bgas\b/, "Gás"],
  [/\b(elevador)/, "Elevadores"],
  [/\b(portao|portoes|automacao de port)/, "Portões"],
  [/\b(incendio|corta.?fogo|extintor|hidrante|alarme|spda|descargas atmosf|pressuriza|iluminacao de emerg)/, "Sistemas de Incêndio"],
  [/\b(esquadria|janela|persiana|aluminio|pvc)/, "Esquadrias"],
  [/\b(fechadura|ferragem)/, "Fechaduras"],
  [/\bporta/, "Portas"],
  [/\b(vidro)/, "Vidros"],
  [/\b(forro|gesso|drywall)/, "Gesso"],
  [/\b(pintura|verniz|tinta\b)/, "Pintura"],
  [/\b(rodape)/, "Rodapés"],
  [/\b(piso|ceramica|azulejo|pastilha|porcelanato|revestiment|rejunt|marmore|granito|argamassa|reboco)/, "Revestimentos"],
  [/\b(fachada)/, "Fachada"],
  [/\b(cobertura|telhado)/, "Cobertura"],
  [/\b(marcenaria|armario)/, "Marcenaria"],
  [/\b(climatiza|ar condicionado|split\b)/, "Climatização"],
  [/\b(estrutur|funda[cç]|viga|laje|pilar|alvenaria|concreto|solidez|conten[cç]|arrimo)/, "Estrutural"],
  [/\b(equipamento|motobomba|interfone|bomba\b|filtro|aquecedor)/, "Equipamentos"],
];

/* Tenta cada texto na ordem dada e fica com o primeiro que casa com uma categoria
   específica; "Equipamentos" é genérico demais, então só vale se nada melhor casar. */
function mpSistemaPorTexto(...candidatos) {
  let generico = "";
  for (const txt of candidatos) {
    const t = qcNorm(txt || "");
    if (!t.trim()) continue;
    const achou = MP_CATEGORIAS.find(([re]) => re.test(t));
    if (!achou) continue;
    if (achou[1] === "Equipamentos") { generico = generico || achou[1]; continue; }
    return achou[1];
  }
  return generico || "Outros";
}

/* ---------- Leitura do PDF ---------- */

function mpLimparTexto(s) {
  return String(s || "").replace(/\u0000|Ɵ/g, "ti").replace(/ﬁ|å(?=n)/g, "fi").replace(/ﬂ/g, "fl").replace(/\s+/g, " ").trim();
}

/* Junta os pedaços de texto da mesma linha em "runs" (um por trecho contínuo). */
function mpMontarRuns(items, alturaPagina) {
  const runs = [];
  items.forEach(it => {
    if (!it.str || !it.str.trim()) return;
    const x = it.transform[4], y = alturaPagina - it.transform[5], w = it.width;
    const ult = runs[runs.length - 1];
    if (ult && Math.abs(ult.y - y) <= 2 && x - (ult.x + ult.w) < 9 && x - (ult.x + ult.w) > -3) {
      ult.s += (x - (ult.x + ult.w) > 1.5 ? " " : "") + it.str;
      ult.w = x + w - ult.x;
    } else runs.push({ s: it.str, x, y, w });
  });
  runs.forEach(r => { r.s = mpLimparTexto(r.s); });
  return runs.filter(r => r.s);
}

function mpCarregarPdfjs() {
  if (window.pdfjsLib) return Promise.resolve();
  return new Promise((ok, erro) => {
    const s = document.createElement("script");
    s.src = "js/lib/pdf.min.js";
    s.onload = ok;
    s.onerror = () => erro(new Error("Não consegui carregar a biblioteca de leitura de PDF (js/lib/pdf.min.js)."));
    document.head.appendChild(s);
  });
}

async function mpLerPdf(arquivo, aoProgredir) {
  await mpCarregarPdfjs();
  pdfjsLib.GlobalWorkerOptions.workerSrc = "js/lib/pdf.worker.min.js";
  const buf = await arquivo.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const paginas = [];
  let chars = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const pg = await pdf.getPage(i);
    const vp = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent();
    const runs = mpMontarRuns(tc.items, vp.height);
    chars += runs.reduce((a, r) => a + r.s.replace(/\s/g, "").length, 0);
    // página dupla (duas folhas lado a lado, paisagem): trata cada metade como uma página
    if (vp.width > 700) {
      const meio = vp.width / 2;
      const esq = runs.filter(r => r.x < meio), dir = runs.filter(r => r.x >= meio).map(r => ({ ...r, x: r.x - meio }));
      [esq, dir].forEach((rs, k) => paginas.push({ n: i, lado: k ? "dir" : "esq", w: meio, h: vp.height, runs: rs, texto: rs.map(r => r.s).join(" ") }));
    } else {
      paginas.push({ n: i, w: vp.width, h: vp.height, runs, texto: runs.map(r => r.s).join(" ") });
    }
    if (aoProgredir) aoProgredir(i, pdf.numPages);
  }
  return { nome: arquivo.name.replace(/\.pdf$/i, ""), numPages: pdf.numPages, paginas, chars };
}

/* ---------- Onde estão as tabelas ---------- */

const mpSemEspaco = (s) => qcNorm(s).replace(/[^a-z]/g, "");
function mpEhSumario(p) { return (p.texto.match(/\.{4,}|(\.\s){6,}/g) || []).length >= 4; }

function mpDetectarSecoes(paginas) {
  const out = { garantia: null, manutencao: null };
  const gIdx = paginas.findIndex(p => !mpEhSumario(p) && /prazos?degarantia/.test(mpSemEspaco(p.texto)) && /(\d+\s*anos?|um ano|fabricante)/i.test(p.texto));
  if (gIdx < 0) {
    // título presente numa página quase sem texto: a tabela é imagem no PDF
    const img = paginas.filter(p => p.texto.length < 900 && /prazos?degarantia/.test(mpSemEspaco(p.texto))).pop();
    if (img) out.garantiaImagem = img.n;
  }
  const mIdx = paginas.findIndex(p => !mpEhSumario(p) && p.runs.some(r => /^(categoria|[aá]rea)$/i.test(r.s)) && p.runs.some(r => /^provid[eê]ncia$/i.test(r.s)) && p.runs.some(r => /^(per[ií]odo|periodicidade)$/i.test(r.s)));
  if (gIdx >= 0) {
    let fim = gIdx;
    while (fim + 1 < paginas.length && fim - gIdx < 3) {
      const prox = paginas[fim + 1];
      if (/listademateriaisefornecedores|esquemashidraulicos/.test(mpSemEspaco(prox.texto.slice(0, 600)))) break;
      if (!/(\d+\s*anos?|fabricante|funcionamento|acabamento|fixa[cç][aã]o|estanqueidade)/i.test(prox.texto)) break;
      fim++;
    }
    out.garantia = { de: paginas[gIdx].n, ate: paginas[fim].n };
  }
  if (mIdx >= 0) {
    let fim = mIdx;
    const limite = gIdx >= 0 ? gIdx : paginas.length;
    while (fim + 1 < limite && fim - mIdx < 5) {
      if (!/(anual|semestral|trimestral|mensal|bienal|bianual|quinquenal|preventiva|corretiva)/i.test(paginas[fim + 1].texto)) break;
      fim++;
    }
    out.manutencao = { de: paginas[mIdx].n, ate: paginas[fim].n };
  }
  return out;
}

/* ---------- Filtros de cabeçalho/rodapé ---------- */

function mpEhRuidoDePagina(r, pg) {
  if (r.y < 95 || r.y > pg.h - 40) return true;
  return /^MANUAL DO PROPRIETÁRIO|^Vers[aã]o|^Revis[aã]o|^\d{1,3}$/i.test(r.s);
}

/* ---------- Prazo ---------- */

const MP_NUM_EXTENSO = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, "três": 3, quatro: 4, cinco: 5, seis: 6, dez: 10 };
function mpLerPrazo(texto) {
  const t = qcNorm(texto);
  const m = /(\d+|um|uma|dois|duas|tres|quatro|cinco|seis|dez)\s*(anos?|mes(?:es)?|dias?)\b/.exec(t);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : MP_NUM_EXTENSO[m[1]];
  if (!n) return null;
  const un = m[2].startsWith("ano") ? "anos" : m[2].startsWith("mes") ? "meses" : "dias";
  return { valor: n, unidade: un, menorOuIgual: /[≤<]|ate\s/.test(texto.slice(0, m.index + 3) + t.slice(0, m.index)) };
}
const mpEhPrazoOuFabricante = (s) => !!mpLerPrazo(s) || /^fabricante$/i.test(s.trim());

/* ---------- Garantia ---------- */

const MP_CAB_PRAZO = /^(≤\s*)?(\d+|um|dois|tr[eê]s|cinco)\s*anos?$/i;

function mpParseGarantia(doc, de, ate) {
  const pgs = doc.paginas.filter(p => p.n >= de && p.n <= ate);
  if (!pgs.length) return { layout: null, linhas: [], aviso: "Nenhuma página no intervalo informado." };
  const todos = pgs.flatMap(p => p.runs.map(r => ({ ...r, pg: p })));

  const hDesc = todos.find(r => /^descri[cç][aã]o dos prazos/i.test(r.s));
  const hSis = todos.find(r => /^sistemas,?$|^sistemas,? elementos/i.test(r.s));
  // lista: o prazo vem escrito no fim de cada linha, todos na mesma coluna (x parecido, y diferentes)
  const curtos = todos.filter(r => r.w < 70 && (/^(≤\s*)?\d+\s*(anos?|meses)$/i.test(r.s) || /^fabricante$/i.test(r.s)));
  const colunaDePrazos = curtos.some(a => curtos.filter(b => Math.abs(b.x - a.x) < 14 && Math.abs(b.y - a.y) > 10).length >= 3);
  if (hDesc && hSis && colunaDePrazos) return mpGarantiaLista(doc, pgs, hSis, hDesc);
  // matriz: cabeçalho com as colunas de prazo lado a lado na mesma linha
  const cab = todos.filter(r => MP_CAB_PRAZO.test(r.s) && r.w < 80);
  const linhaCab = cab.find(a => cab.filter(b => Math.abs(b.y - a.y) < 4).length >= 3);
  if (linhaCab) return mpGarantiaMatriz(doc, pgs, linhaCab.y);
  return { layout: null, linhas: [], aviso: "Encontrei a página, mas o formato da tabela de garantia não é um dos que o painel reconhece. Cadastre manualmente ou ajuste as páginas." };
}

function mpLinhaGarantia(doc, pagina, o) {
  const p = o.prazo;
  const fab = !p && /fabricante/i.test(o.celulaPrazo || "");
  // louça/vaso/torneira são "Louças e Metais" mesmo quando o manual os agrupa em "Instalações hidráulicas"
  const ehLouca = /\b(louca|vaso sanit|metais|torneira|lavatorio|cuba)/.test(qcNorm([o.elemento, o.descricao].join(" ")));
  const sistema = ehLouca ? "Louças e Metais" : mpSistemaPorTexto(o.elemento, o.rotulo, [o.rotulo, o.elemento].join(" "), o.descricao);
  const componente = [o.rotulo, o.elemento].filter(Boolean).join(" — ") + (o.descricao ? ` — ${o.descricao}` : "");
  const obs = [];
  if (p && p.unidade === "dias") obs.push(`Prazo no manual: ${p.valor} dias (a matriz aceita meses ou anos — ajuste se quiser).`);
  if (p && p.menorOuIgual) obs.push(`O manual indica “≤ ${p.valor} ${p.unidade === "anos" ? "ano(s)" : "mês(es)"}”.`);
  return {
    checked: true, sistema, componente: componente.slice(0, 220),
    prazoValor: p && p.unidade !== "dias" ? p.valor : "", prazoUnidade: p && p.unidade === "meses" ? "meses" : "anos",
    fonteTipo: fab ? "fabricante" : "manual", fonteDocumento: doc.nome, fontePagina: `pág. ${pagina}`,
    fonteTrecho: [o.rotulo, o.elemento, o.descricao, o.celulaPrazo].filter(Boolean).join(" | ").slice(0, 300),
    normasRelacionadas: o.nbr ? ["ABNT NBR 15575"] : [],
    condicoes: fab ? "Garantia do fabricante: ver termo de garantia e manual de operação do fornecedor." : "",
    observacoes: obs.join(" "), labelIncerto: !!o.labelIncerto,
  };
}

/* Agrupamento de células mescladas: cada rótulo (centralizado na vertical) cobre uma
   sequência contínua de linhas. Escolhe a divisão que deixa cada rótulo mais perto do
   meio do seu grupo — programação dinâmica simples (poucas linhas, poucos rótulos). */
function mpAgrupar(rotulos, ancoras) {
  const m = rotulos.length, n = ancoras.length;
  const porAncora = new Array(n).fill(0);
  if (!m || !n) return porAncora;
  if (n < m) { ancoras.forEach((a, i) => { porAncora[i] = rotulos.reduce((b, r, j) => (Math.abs(r.y - a.y) < Math.abs(rotulos[b].y - a.y) ? j : b), 0); }); return porAncora; }
  const custo = (j, i, k) => Math.abs((ancoras[i].y + ancoras[k].y) / 2 - rotulos[j].y);
  const INF = 1e12;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(INF)), corte = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  dp[0][0] = 0;
  for (let j = 1; j <= m; j++) for (let k = j; k <= n; k++) for (let i = j - 1; i < k; i++) {
    const c = dp[j - 1][i] + custo(j - 1, i, k - 1);
    if (c < dp[j][k]) { dp[j][k] = c; corte[j][k] = i; }
  }
  let fim = n;
  for (let j = m; j >= 1; j--) { const ini = corte[j][fim]; for (let i = ini; i < fim; i++) porAncora[i] = j - 1; fim = ini; }
  return porAncora;
}
/* Junta linhas seguidas (mesma coluna, y próximo) num bloco de rótulo. */
function mpBlocosDeRotulo(runs) {
  const blocos = [];
  runs.slice().sort((a, b) => a.y - b.y).forEach(r => {
    const u = blocos[blocos.length - 1];
    if (u && r.y - u.yUlt <= 14) { u.s += " " + r.s; u.yUlt = r.y; u.ys.push(r.y); }
    else blocos.push({ s: r.s, yUlt: r.y, ys: [r.y] });
  });
  blocos.forEach(b => { b.y = (b.ys[0] + b.ys[b.ys.length - 1]) / 2; });
  return blocos;
}

/* Formato: Sistema | Elemento | Descrição | Prazo — o prazo fica em texto no fim da linha. */
function mpGarantiaLista(doc, pgs, hSis, hDesc) {
  const linhas = [];
  let rotuloAtual = "", elementoAtual = "";
  let labelsEmbaralhados = false;
  const sysX = hSis.x, descEsq = hDesc.x - hDesc.w * 0.1;

  pgs.forEach((pg, ip) => {
    const corpo = pg.runs.filter(r => !mpEhRuidoDePagina(r, pg) && r !== hSis && r !== hDesc)
      .filter(r => !(ip === 0 && r.y <= Math.max(hSis.y, hDesc.y) + 28 && /sistemas|componentes|instala[cç][oõ]es$|descri[cç][aã]o|prazos/i.test(r.s)))
      .filter(r => !(ip === 0 && r.y < Math.min(hSis.y, hDesc.y) + 6));
    // coluna do prazo: runs de prazo/Fabricante mais à direita
    const candidatos = corpo.filter(r => mpEhPrazoOuFabricante(r.s) && r.x >= descEsq);
    const xPrazo = candidatos.length ? Math.max(...candidatos.map(r => r.x)) - 12 : Infinity;
    const anc = candidatos.filter(r => r.x >= xPrazo);
    const col = (r) => (anc.includes(r) ? "prazo" : Math.abs(r.x - sysX) <= 22 ? "rotulo" : r.x >= descEsq ? "desc" : "elem");

    // rótulos embaralhados: vários rótulos antes do primeiro prazo no fluxo
    const idxPrimeiroPrazo = corpo.findIndex(r => anc.includes(r));
    const rotulosAntes = corpo.slice(0, idxPrimeiroPrazo < 0 ? 0 : idxPrimeiroPrazo).filter(r => col(r) === "rotulo");
    const gruposRotulo = rotulosAntes.reduce((n, r, i) => n + (i === 0 || Math.abs(r.y - rotulosAntes[i - 1].y) > 14 ? 1 : 0), 0);
    if (gruposRotulo >= 3) labelsEmbaralhados = true;

    const descPorAncora = new Map(anc.map(a => [a, []]));
    corpo.filter(r => col(r) === "desc").forEach(r => {
      if (!anc.length) return;
      const a = anc.reduce((m, x) => (Math.abs(x.y - r.y) < Math.abs(m.y - r.y) ? x : m), anc[0]);
      descPorAncora.get(a).push(r);
    });

    // rótulos fora de ordem: cada rótulo é distribuído pelas linhas pela posição (célula mesclada)
    let rotuloPorAncora = null;
    if (labelsEmbaralhados && anc.length) {
      const ancOrd = anc.slice().sort((a, b) => a.y - b.y);
      const blocos = mpBlocosDeRotulo(corpo.filter(r => col(r) === "rotulo"));
      const idx = mpAgrupar(blocos, ancOrd);
      rotuloPorAncora = new Map(ancOrd.map((a, i) => [a, blocos[idx[i]] ? blocos[idx[i]].s : ""]));
    }

    let ultimoRotuloY = null, ultimoElemY = null;
    corpo.forEach(r => {
      const c = col(r);
      if (c === "rotulo") {
        if (!labelsEmbaralhados) {
          if (ultimoRotuloY !== null && Math.abs(r.y - ultimoRotuloY) <= 14) rotuloAtual += " " + r.s; else { rotuloAtual = r.s; elementoAtual = ""; }
          ultimoRotuloY = r.y;
        }
      } else if (c === "elem") {
        if (ultimoElemY !== null && Math.abs(r.y - ultimoElemY) <= 14) elementoAtual += " " + r.s; else elementoAtual = r.s;
        ultimoElemY = r.y;
      } else if (c === "prazo") {
        const desc = descPorAncora.get(r).sort((a, b) => a.y - b.y).map(d => d.s).join(" ");
        linhas.push(mpLinhaGarantia(doc, pg.n, {
          rotulo: labelsEmbaralhados ? (rotuloPorAncora && rotuloPorAncora.get(r)) || "" : rotuloAtual.replace(/\s*\(continua.*\)/i, ""), elemento: elementoAtual, descricao: desc,
          prazo: mpLerPrazo(r.s), celulaPrazo: r.s, labelIncerto: labelsEmbaralhados,
        }));
      }
    });
  });
  const aviso = labelsEmbaralhados ? "Neste manual o PDF não guardou a ordem das linhas; o agrupamento por sistema foi deduzido pela posição na página — confira a coluna Sistema." : "";
  return { layout: "lista", linhas, aviso };
}

/* Formato da NBR 15575: colunas "Um ano / Dois anos / Três anos / Cinco anos". */
function mpGarantiaMatriz(doc, pgs, yCab) {
  const cabecalhos = [];
  pgs.forEach(pg => pg.runs.forEach(r => {
    if (Math.abs(r.y - yCab) < 6 && MP_CAB_PRAZO.test(r.s) && r.w < 80) cabecalhos.push({ x: r.x + r.w / 2, prazo: mpLerPrazo(r.s) });
  }));
  if (cabecalhos.length < 3) return { layout: null, linhas: [], aviso: "Não consegui identificar as colunas de prazo da tabela." };
  const xMin = Math.min(...cabecalhos.map(c => c.x)) - 60;
  const linhas = [];
  let rotulo = "", cel = new Map(), paginaDaLinha = pgs[0].n, ultimoRotuloY = null;

  const fechar = () => {
    cel.forEach((txt, col) => {
      const t = txt.trim();
      if (!t) return;
      linhas.push(mpLinhaGarantia(doc, paginaDaLinha, { rotulo: rotulo.replace(/\s*\(continua.*\)/i, ""), elemento: "", descricao: t, prazo: cabecalhos[col].prazo, celulaPrazo: cabecalhos[col].prazo ? `${cabecalhos[col].prazo.valor} ano(s)` : "", nbr: true }));
    });
    cel = new Map();
  };

  let parar = false;
  pgs.forEach((pg, ip) => {
    if (parar) return;
    pg.runs.forEach(r => {
      if (parar || mpEhRuidoDePagina(r, pg)) return;
      if (ip === 0 && r.y <= yCab + 4) return;
      if (/^NOTA\b/i.test(r.s)) { parar = true; return; }
      if (r.x < xMin) {
        if (cel.size) { fechar(); rotulo = ""; ultimoRotuloY = null; paginaDaLinha = pg.n; }
        if (ultimoRotuloY !== null && Math.abs(r.y - ultimoRotuloY) <= 14 && rotulo) rotulo += " " + r.s; else rotulo = r.s;
        ultimoRotuloY = r.y;
      } else {
        const c = cabecalhos.reduce((m, h, i) => (Math.abs(h.x - (r.x + r.w / 2)) < Math.abs(cabecalhos[m].x - (r.x + r.w / 2)) ? i : m), 0);
        cel.set(c, (cel.get(c) || "") + " " + r.s);
      }
    });
  });
  fechar();
  return { layout: "matriz", linhas, aviso: "Tabela da NBR 15575: cada linha traz o texto da célula como foi escrito no manual." };
}

/* ---------- Manutenção preventiva ---------- */

function mpParseManutencao(doc, de, ate) {
  const pgs = doc.paginas.filter(p => p.n >= de && p.n <= ate);
  if (!pgs.length) return { linhas: [], aviso: "Nenhuma página no intervalo informado." };
  const todos = pgs.flatMap(p => p.runs.map(r => ({ ...r, pg: p })));
  const acha = (re) => todos.find(r => re.test(r.s));
  const hCat = acha(/^(categoria|[aá]rea)$/i), hProv = acha(/^provid[eê]ncia$/i), hPer = acha(/^(per[ií]odo|periodicidade)$/i);
  // as demais colunas do cabeçalho são achadas pela posição entre as conhecidas (o texto varia de manual pra manual)
  const faixa = hCat ? todos.filter(r => r.pg === hCat.pg && Math.abs(r.y - hCat.y) < 18) : [];
  const entre = (a, b) => faixa.filter(r => r.x > a.x + 20 && r.x < b.x - 20).sort((p, q) => p.x - q.x);
  const hItem = hCat && hProv ? entre(hCat, hProv).find(r => /^[ií]tem$/i.test(r.s)) : null;
  const meio = hCat && hProv ? entre(hItem || hCat, hProv) : [];
  const hInsp = meio[0] || null;
  const hTipo = hPer ? faixa.filter(r => r.x > hPer.x + 20).sort((p, q) => p.x - q.x)[0] || null : null;
  if (!hCat || !hInsp || !hProv || !hPer) return { linhas: [], aviso: "Encontrei a página, mas não reconheci as colunas da tabela de manutenção (Categoria, Itens de inspeção, Providência, Período). Cadastre manualmente ou ajuste as páginas." };
  const xs = [hCat.x, hItem ? hItem.x : null, hInsp.x, hProv.x, hPer.x, hTipo ? hTipo.x : null];
  const nomes = ["cat", "item", "insp", "prov", "per", "tipo"];
  const colunas = nomes.map((n, i) => ({ n, x: xs[i] })).filter(c => c.x !== null);
  const colDe = (r) => { let c = colunas[0].n; colunas.forEach(k => { if (r.x >= k.x - 8) c = k.n; }); return c; };
  const yCab = Math.max(hCat.y, hPer.y) + 14;

  const linhas = [];
  let catAtual = "", itemAtual = "";
  let corrente = null, ultimaFechada = null;
  const novaLinha = (pg) => ({ pg: pg.n, cat: "", item: "", insp: "", prov: "", per: "", tipo: "" });
  const acrescenta = (obj, col, s) => { obj[col] = (obj[col] ? obj[col] + " " : "") + s; };

  pgs.forEach((pg, ip) => {
    const corpo = pg.runs.filter(r => !mpEhRuidoDePagina(r, pg) && !(ip === 0 && r.y <= yCab));
    // sobra de texto de uma linha que já fechou na página anterior: itens de inspeção/providência
    // no topo da página, seguidos de uma Categoria/Item (linha nova) em vez de um Período
    if (!corrente && ultimaFechada) {
      let k = 0;
      while (k < corpo.length && ["insp", "prov"].includes(colDe(corpo[k]))) k++;
      if (k > 0 && k < corpo.length && ["cat", "item"].includes(colDe(corpo[k]))) {
        corpo.splice(0, k).forEach(r => acrescenta(ultimaFechada, colDe(r), r.s));
      }
    }
    corpo.forEach(r => {
      const c = colDe(r);
      if (c === "tipo" && !/^(preventiva|corretiva|preditiva)/i.test(r.s)) { return; }
      if (!corrente) corrente = novaLinha(pg);
      if (c === "cat") { if (corrente.insp || corrente.per) { /* categoria nova no meio de uma linha em montagem */ } corrente.cat += (corrente.cat ? " " : "") + r.s; }
      else acrescenta(corrente, c, r.s);
      if (c === "tipo") {
        if (corrente.cat) { catAtual = corrente.cat; itemAtual = ""; }
        if (corrente.item) itemAtual = corrente.item;
        const finalizada = { ...corrente, cat: corrente.cat || catAtual, item: corrente.item || (corrente.cat ? "" : itemAtual) };
        linhas.push(finalizada);
        ultimaFechada = finalizada; corrente = null;
      }
    });
  });

  // Leitura por posição (plano B): quando o PDF guarda o texto coluna por coluna em vez de linha por
  // linha, a leitura acima fica com bem menos linhas do que há de "Preventiva/Corretiva" na página.
  const geo = [];
  pgs.forEach((pg, ip) => {
    const corpo = pg.runs.filter(r => !mpEhRuidoDePagina(r, pg) && !(ip === 0 && r.y <= yCab));
    const anc = corpo.filter(r => colDe(r) === "tipo" && /^(preventiva|corretiva|preditiva)/i.test(r.s)).sort((a, b) => a.y - b.y);
    if (!anc.length) return;
    const linhasPg = anc.map(a => ({ pg: pg.n, cat: "", item: "", insp: [], prov: [], per: [], tipo: a.s }));
    const proxima = (r) => anc.reduce((b, a, i) => (Math.abs(a.y - r.y) < Math.abs(anc[b].y - r.y) ? i : b), 0);
    corpo.forEach(r => { const c = colDe(r); if (["insp", "prov", "per"].includes(c)) linhasPg[proxima(r)][c].push(r); });
    ["cat", "item"].forEach(c => {
      const blocos = mpBlocosDeRotulo(corpo.filter(r => colDe(r) === c));
      mpAgrupar(blocos, anc).forEach((j, i) => { linhasPg[i][c] = blocos[j] ? blocos[j].s : ""; });
    });
    linhasPg.forEach(l => {
      ["insp", "prov", "per"].forEach(c => { l[c] = l[c].sort((a, b) => a.y - b.y || a.x - b.x).map(r => r.s).join(" "); });
      geo.push(l);
    });
  });
  const usarGeo = geo.length > linhas.filter(l => l.insp || l.prov).length * 1.5;

  const saida = (usarGeo ? geo : linhas).filter(l => l.insp || l.prov).map(l => {
    const periodicidade = l.per.replace(/\s*\|\s*/g, " | ");
    return {
      checked: true, sistema: mpSistemaPorTexto(l.cat, [l.cat, l.item].join(" "), l.insp), componente: [l.cat, l.item].filter(Boolean).join(" — ").slice(0, 200),
      oQueVerificar: l.insp, procedimento: l.prov, periodicidade, tipoInspecao: l.tipo,
      fonteTipo: "manual", fonteDocumento: doc.nome, fontePagina: `pág. ${l.pg}`,
      fonteTrecho: [l.cat, l.item, l.insp, l.prov, l.per, l.tipo].filter(Boolean).join(" | ").slice(0, 300),
      condicoes: "", observacoes: l.tipo ? `Tipo no manual: ${l.tipo}.` : "",
    };
  });
  return { linhas: saida, aviso: !saida.length ? "Não encontrei linhas na tabela de manutenção." : usarGeo ? "Neste manual o PDF não guardou a ordem das linhas; o agrupamento por categoria foi deduzido pela posição na página — confira com atenção." : "" };
}

/* ---------- Análise completa ---------- */

function mpAnalisar(doc, intervalos) {
  const sec = intervalos || mpDetectarSecoes(doc.paginas);
  const garantia = sec.garantia ? mpParseGarantia(doc, sec.garantia.de, sec.garantia.ate)
    : sec.garantiaImagem ? { layout: null, linhas: [], aviso: `A tabela de prazos de garantia (pág. ${sec.garantiaImagem}) está como imagem neste PDF — não há texto para o painel ler. Cadastre a garantia manualmente.` }
    : { layout: null, linhas: [], aviso: "Não encontrei a tabela de prazos de garantia neste manual. Informe as páginas ou cadastre manualmente." };
  const manutencao = sec.manutencao ? mpParseManutencao(doc, sec.manutencao.de, sec.manutencao.ate) : { linhas: [], aviso: "Não encontrei o plano de manutenção preventiva neste manual. Informe as páginas ou cadastre manualmente." };
  return { secoes: sec, garantia, manutencao };
}

/* ---------- Janela ---------- */

let mpS = null;

function openManualImport(buildingId) {
  const b = getBuilding(buildingId);
  if (!b) return;
  mpS = { buildingId, doc: null, res: null, tab: "garantia", incluirExistentes: false };
  openModal(`
    <div class="modal-header">
      <h2>Importar do manual (PDF) — ${escapeHtml(b.name)}</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body" id="mp-root"></div>
    <div class="modal-footer">
      <button class="btn ghost" data-close>Cancelar</button>
      <button class="btn primary" id="mp-confirmar" disabled>Importar</button>
    </div>`, true);
  wireModalClose();
  mpWire();
  mpRender();
}

function mpExiste(tipo, l) {
  const lista = tipo === "garantia" ? state.warrantyMatrix : state.maintenanceMatrix;
  return lista.some(r => r.buildingId === mpS.buildingId && r.sistema === l.sistema && (r.componente || "") === (l.componente || "")
    && r.fonteTipo === l.fonteTipo && (r.fonteDocumento || "") === (l.fonteDocumento || "")
    && (tipo === "garantia" ? String(r.prazoValor) === String(l.prazoValor)
      : (r.periodicidade || "") === (l.periodicidade || "") && (r.oQueVerificar || "") === (l.oQueVerificar || "") && (r.procedimento || "") === (l.procedimento || "")));
}

function mpAvisoPredio() {
  const b = getBuilding(mpS.buildingId);
  const toks = (qcNorm(b.name).match(/[a-z0-9]+/g) || []).filter(t => t.length >= 3 && !QC_STOP_PREDIO.has(t));
  const alvo = qcNorm(mpS.doc.nome + " " + mpS.doc.paginas.slice(0, 3).map(p => p.texto).join(" "));
  if (toks.length && !toks.some(t => alvo.includes(t))) return `Este PDF não parece ser do ${b.name} (não achei “${toks.join(" ")}” no nome nem nas primeiras páginas). Confira se escolheu o manual certo antes de importar.`;
  return "";
}

function mpRender() {
  const root = document.getElementById("mp-root");
  if (!mpS.doc) {
    root.innerHTML = `
      <p class="hint">Escolha o PDF do Manual do Proprietário deste empreendimento. O painel lê o arquivo aqui mesmo (nada é enviado para a internet), encontra a tabela de <strong>prazos de garantia</strong> e o <strong>plano de manutenção preventiva</strong> e mostra o que achou. <strong>Nada é salvo antes de você conferir e confirmar.</strong></p>
      <div class="mp-escolher">
        <button type="button" class="btn primary" id="mp-escolher">Escolher PDF…</button>
        <input type="file" id="mp-arquivo" accept="application/pdf" hidden>
        <span class="hint" id="mp-status"></span>
      </div>`;
    document.getElementById("mp-confirmar").disabled = true;
    return;
  }
  const r = mpS.res, s = r.secoes;
  const aviso = mpAvisoPredio();
  const lista = mpS.tab === "garantia" ? r.garantia.linhas : r.manutencao.linhas;
  const nG = r.garantia.linhas.length, nM = r.manutencao.linhas.length;
  root.innerHTML = `
    <div class="mp-arquivo"><strong>${escapeHtml(mpS.doc.nome)}</strong><span class="hint"> · ${mpS.doc.numPages} páginas</span>
      <button type="button" class="btn ghost small" id="mp-trocar">Trocar PDF</button></div>
    ${aviso ? `<div class="mp-alerta">${escapeHtml(aviso)}</div>` : ""}
    <div class="mp-paginas">
      <div class="field"><label>Garantia: da página</label><input type="number" min="1" max="${mpS.doc.numPages}" id="mp-g-de" value="${s.garantia ? s.garantia.de : ""}"></div>
      <div class="field"><label>até</label><input type="number" min="1" max="${mpS.doc.numPages}" id="mp-g-ate" value="${s.garantia ? s.garantia.ate : ""}"></div>
      <div class="field"><label>Manutenção: da página</label><input type="number" min="1" max="${mpS.doc.numPages}" id="mp-m-de" value="${s.manutencao ? s.manutencao.de : ""}"></div>
      <div class="field"><label>até</label><input type="number" min="1" max="${mpS.doc.numPages}" id="mp-m-ate" value="${s.manutencao ? s.manutencao.ate : ""}"></div>
      <button type="button" class="btn ghost small" id="mp-reler">Reler com estas páginas</button>
    </div>
    <div class="chip-group mp-tabs">
      <button type="button" class="chip ${mpS.tab === "garantia" ? "active" : ""}" data-mp-tab="garantia">Garantia (${nG})</button>
      <button type="button" class="chip ${mpS.tab === "manutencao" ? "active" : ""}" data-mp-tab="manutencao">Manutenção preventiva (${nM})</button>
    </div>
    ${(mpS.tab === "garantia" ? r.garantia.aviso : r.manutencao.aviso) ? `<p class="hint mp-aviso">${escapeHtml(mpS.tab === "garantia" ? r.garantia.aviso : r.manutencao.aviso)}</p>` : ""}
    <div id="mp-previa">${mpPreviaHTML(lista)}</div>`;
  mpRefresh();
}

function mpPreviaHTML(lista) {
  if (!lista.length) return `<div class="empty-hint">Nada encontrado nesta parte. Ajuste as páginas acima ou cadastre manualmente.</div>`;
  const opt = (v, l, sel) => `<option value="${escapeHtml(v)}" ${sel ? "selected" : ""}>${escapeHtml(l)}</option>`;
  const sistemas = CATEGORIES.map(c => c);
  if (mpS.tab === "garantia") {
    return `<div class="mp-resumo hint" id="mp-resumo"></div><div class="table-wrap"><table class="mini-table imp-table mp-table">
      <thead><tr><th></th><th>Sistema</th><th>Componente / o que cobre</th><th>Prazo</th><th>Fonte</th><th>Situação</th></tr></thead>
      <tbody>${lista.map((l, i) => `<tr data-i="${i}">
        <td><input type="checkbox" data-f="checked" ${l.checked ? "checked" : ""}></td>
        <td><select data-f="sistema">${sistemas.map(c => opt(c, c, c === l.sistema)).join("")}</select></td>
        <td><input type="text" class="imp-lg" data-f="componente" value="${escapeHtml(l.componente)}"></td>
        <td class="mp-prazo"><input type="number" min="0" class="imp-sm" data-f="prazoValor" value="${escapeHtml(l.prazoValor)}"><select data-f="prazoUnidade">${opt("anos", "anos", l.prazoUnidade === "anos")}${opt("meses", "meses", l.prazoUnidade === "meses")}</select></td>
        <td class="hint">${escapeHtml(FONTE_TIPO_MAP[l.fonteTipo].label.replace("Manual do Proprietário", "Manual"))}<br>${escapeHtml(l.fontePagina)}</td>
        <td class="mp-sit"></td></tr>`).join("")}</tbody></table></div>`;
  }
  return `<div class="mp-resumo hint" id="mp-resumo"></div><div class="table-wrap"><table class="mini-table imp-table mp-table">
      <thead><tr><th></th><th>Sistema</th><th>Item</th><th>O que verificar</th><th>Providência</th><th>Periodicidade</th><th>Fonte</th><th>Situação</th></tr></thead>
      <tbody>${lista.map((l, i) => `<tr data-i="${i}">
        <td><input type="checkbox" data-f="checked" ${l.checked ? "checked" : ""}></td>
        <td><select data-f="sistema">${sistemas.map(c => opt(c, c, c === l.sistema)).join("")}</select></td>
        <td><input type="text" data-f="componente" value="${escapeHtml(l.componente)}"></td>
        <td><input type="text" class="imp-lg" data-f="oQueVerificar" value="${escapeHtml(l.oQueVerificar)}"></td>
        <td><input type="text" class="imp-lg" data-f="procedimento" value="${escapeHtml(l.procedimento)}"></td>
        <td><input type="text" class="imp-md" data-f="periodicidade" value="${escapeHtml(l.periodicidade)}"></td>
        <td class="hint">${escapeHtml(l.fontePagina)}</td>
        <td class="mp-sit"></td></tr>`).join("")}</tbody></table></div>`;
}

function mpRefresh() {
  const btn = document.getElementById("mp-confirmar");
  if (!mpS.doc) { btn.disabled = true; btn.textContent = "Importar"; return; }
  const total = { garantia: 0, manutencao: 0 };
  ["garantia", "manutencao"].forEach(tipo => {
    const lista = tipo === "garantia" ? mpS.res.garantia.linhas : mpS.res.manutencao.linhas;
    lista.forEach(l => { l.existe = mpExiste(tipo, l); if (l.checked && !l.existe) total[tipo]++; });
  });
  const linhasTab = mpS.tab === "garantia" ? mpS.res.garantia.linhas : mpS.res.manutencao.linhas;
  document.querySelectorAll("#mp-previa tbody tr").forEach((tr, i) => {
    const l = linhasTab[i]; if (!l) return;
    tr.classList.toggle("imp-off", !l.checked);
    const sit = tr.querySelector(".mp-sit");
    const partes = [];
    if (l.existe) partes.push("Já cadastrada (não duplica)");
    if (mpS.tab === "garantia") {
      if (l.prazoValor === "" && l.fonteTipo !== "fabricante") partes.push("Sem prazo: o manual não informa");
      if (l.fonteTipo === "fabricante") partes.push("Garantia do fabricante");
      if (l.labelIncerto) partes.push("Confira o sistema");
    }
    sit.textContent = partes.join(" · ");
  });
  const resumo = document.getElementById("mp-resumo");
  if (resumo) resumo.textContent = `${linhasTab.length} linhas encontradas · ${linhasTab.filter(l => l.checked && !l.existe).length} serão importadas.`;
  const n = total.garantia + total.manutencao;
  btn.disabled = n === 0;
  btn.textContent = `Importar ${n} ${n === 1 ? "item" : "itens"} (${total.garantia} garantia · ${total.manutencao} manutenção)`;
}

async function mpAbrirArquivo(arquivo) {
  const st = document.getElementById("mp-status");
  try {
    st.textContent = "Lendo o PDF…";
    const doc = await mpLerPdf(arquivo, (i, n) => { st.textContent = `Lendo página ${i} de ${n}…`; });
    if (doc.chars < 400 || doc.chars / doc.numPages < 120) {
      st.textContent = "";
      document.getElementById("mp-root").insertAdjacentHTML("beforeend", `<div class="mp-alerta">Este PDF não tem texto selecionável (parece ser um documento escaneado, só imagem), então o painel não consegue ler. Use o cadastro manual de garantia e manutenção deste empreendimento.</div>`);
      return;
    }
    mpS.doc = doc;
    mpS.res = mpAnalisar(doc);
    mpS.tab = mpS.res.garantia.linhas.length || !mpS.res.manutencao.linhas.length ? "garantia" : "manutencao";
    mpRender();
  } catch (e) {
    st.textContent = "";
    toast("Não consegui ler este PDF: " + (e.message || e), "error");
  }
}

function mpConfirmar() {
  let nG = 0, nM = 0;
  mpS.res.garantia.linhas.forEach(l => {
    if (!l.checked || mpExiste("garantia", l)) return;
    state.warrantyMatrix.push({
      id: nextWarrantyId(), buildingId: mpS.buildingId, sistema: l.sistema, componente: l.componente,
      prazoValor: l.prazoValor === "" ? "" : Number(l.prazoValor), prazoUnidade: l.prazoUnidade,
      fonteTipo: l.fonteTipo, fonteDocumento: l.fonteDocumento, fontePagina: l.fontePagina, fonteTrecho: l.fonteTrecho,
      inicioContagemCriterio: "entrega_unidade", inicioContagemData: "",
      normasRelacionadas: l.normasRelacionadas || [], condicoes: l.condicoes, observacoes: l.observacoes,
    });
    nG++;
  });
  mpS.res.manutencao.linhas.forEach(l => {
    if (!l.checked || mpExiste("manutencao", l)) return;
    state.maintenanceMatrix.push({
      id: nextMaintenanceId(), buildingId: mpS.buildingId, sistema: l.sistema, componente: l.componente,
      oQueVerificar: l.oQueVerificar, procedimento: l.procedimento, periodicidade: l.periodicidade,
      fonteTipo: l.fonteTipo, fonteDocumento: l.fonteDocumento, fontePagina: l.fontePagina, fonteTrecho: l.fonteTrecho,
      condicoes: l.condicoes, observacoes: l.observacoes,
    });
    nM++;
  });
  persist();
  const id = mpS.buildingId;
  closeModal();
  renderAll();
  toast(`${nG} regra(s) de garantia e ${nM} item(ns) de manutenção importados.`, "success");
  const predio = getBuilding(id);
  if (nG && predio && !predio.deliveryDate) {
    setTimeout(() => toast("Falta a data de entrega deste empreendimento — sem ela o sistema não calcula o fim das garantias nem avisa quando vencem.", "error"), 600);
  }
  if (nG >= nM) openWarrantyMatrixModal(id); else openMaintenanceMatrixModal(id);
}

function mpWire() {
  const root = document.getElementById("mp-root");
  document.getElementById("mp-confirmar").addEventListener("click", mpConfirmar);
  root.addEventListener("click", (e) => {
    if (e.target.id === "mp-escolher") document.getElementById("mp-arquivo").click();
    else if (e.target.id === "mp-trocar") { mpS.doc = null; mpS.res = null; mpRender(); }
    else if (e.target.dataset && e.target.dataset.mpTab) { mpS.tab = e.target.dataset.mpTab; mpRender(); }
    else if (e.target.id === "mp-reler") {
      const n = (id) => Number(document.getElementById(id).value) || 0;
      const trecho = (a, b) => (n(a) && n(b) && n(a) <= n(b) ? { de: n(a), ate: n(b) } : null);
      mpS.res = mpAnalisar(mpS.doc, { garantia: trecho("mp-g-de", "mp-g-ate"), manutencao: trecho("mp-m-de", "mp-m-ate") });
      mpRender();
    }
  });
  root.addEventListener("change", (e) => {
    if (e.target.id === "mp-arquivo") { if (e.target.files[0]) mpAbrirArquivo(e.target.files[0]); return; }
    const f = e.target.dataset && e.target.dataset.f;
    if (!f) return;
    const lista = mpS.tab === "garantia" ? mpS.res.garantia.linhas : mpS.res.manutencao.linhas;
    const l = lista[Number(e.target.closest("tr").dataset.i)];
    l[f] = f === "checked" ? e.target.checked : e.target.value;
    mpRefresh();
  });
  root.addEventListener("input", (e) => {
    const f = e.target.dataset && e.target.dataset.f;
    if (!f || e.target.type === "checkbox" || e.target.tagName === "SELECT") return;
    const lista = mpS.tab === "garantia" ? mpS.res.garantia.linhas : mpS.res.manutencao.linhas;
    lista[Number(e.target.closest("tr").dataset.i)][f] = e.target.value;
    mpRefresh();
  });
}
