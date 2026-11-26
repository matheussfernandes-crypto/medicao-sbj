// Listas de interiores (cortinas e persianas, revestimentos de parede, tapetes).
// Cada item guarda os campos da lista em esp_itens.campos; a referência (texto do PDF) e as medidas saem daqui.
// Arquivo sem dependências do Next: usado pela tela, pelas ações do servidor e pela folha do PDF.
import { fold, type GrupoInterior } from "./regras";

// ---------- medidas ----------
/** Medida digitada em metros com vírgula ("3,20"). Acima de 30 é lida como centímetros (270 → 2,70). */
export function lerMetros(v: unknown): number {
  const t = String(v ?? "").trim().replace(/\s+/g, "").replace(/m$/i, "");
  if (!t) return 0;
  const n = parseFloat(t.replace(",", "."));
  if (!isFinite(n) || n <= 0) return 0;
  return Math.round((n > 30 ? n / 100 : n) * 100) / 100;
}
/** Medida em centímetros (barra, xale). */
export function lerCm(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(/\s+/g, "").replace(/cm$/i, "").replace(",", "."));
  return isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : 0;
}
/** 2,5 → "2,50" */
export const fmtM = (n: number) => n.toFixed(2).replace(".", ",");
/** 20 → "20"; 12,5 → "12,5" */
export const fmtCm = (n: number) => String(n).replace(".", ",");

const minusc = (s: string) => (s || "").trim().toLowerCase();
const frase = (s: string) => {
  const t = (s || "").trim();
  if (!t) return "";
  const m = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(m) ? m : m + ".";
};

// ---------- cores (desenhos) ----------
const CORES: [RegExp, string][] = [
  [/off ?white|cru|marfim|perola/, "#efe8d8"], [/branc/, "#f8f8f5"], [/bege|areia|nude|linho/, "#dcc9a9"], [/cinza|grafite|chumbo/, "#9c9fa2"],
  [/pret/, "#2d2d2d"], [/azul|marinho/, "#5f81a6"], [/verde/, "#7f9b70"], [/terracot|telha/, "#b6654a"], [/rosa/, "#d9a2a8"],
  [/marrom|cafe|chocolate|tabaco/, "#7b5842"], [/dourad|ouro/, "#c9a45c"], [/amarel|mostarda/, "#e2c35a"],
];
export function corDaPalavra(cor: string | undefined, padrao = "#d8d2c6") {
  const f = fold(cor || "");
  return (f && CORES.find(([re]) => re.test(f))?.[1]) || padrao;
}

// =====================================================================
// 1. CORTINAS E PERSIANAS
// =====================================================================
export const CORT = {
  tipos: ["Cortina", "Persiana", "Rolô", "Romana", "Double vision", "Blackout", "Cortina com blackout", "Xale"],
  cabecalho: ["Ponto palito", "Prega macho", "Prega fêmea", "Prega americana", "Prega invertida", "Ondas (wave)", "Ilhós", "Franzido simples"],
  acabamentos: ["Soutache", "Barra arrastão", "Franja", "Passamanaria", "Bordado", "Vivo"],
  xales: [["sem", "Sem xale"], ["direito", "Lado direito"], ["esquerdo", "Lado esquerdo"], ["dois", "Dois lados"]] as [Xale, string][],
};
export type Xale = "sem" | "direito" | "esquerdo" | "dois";
export type Cortina = {
  tipo?: string; emL?: boolean; larg1?: string; larg2?: string; altura?: string; tecido?: string; cor?: string;
  barra?: string; barraAlt?: string; detalhes?: string[]; outroDetalhe?: string; xale?: Xale; xaleMed?: string;
  pingente?: boolean; gesso?: boolean; motorizada?: boolean; obs?: string;
};

export function medidasCortinaNum(c: Cortina) {
  const l1 = lerMetros(c.larg1), l2 = c.emL ? lerMetros(c.larg2) : 0;
  return { l1, l2, total: Math.round((l1 + l2) * 100) / 100, alt: lerMetros(c.altura), barra: lerCm(c.barraAlt), xale: c.xale && c.xale !== "sem" ? lerCm(c.xaleMed) : 0 };
}

export function faltaCortina(c: Cortina): string[] {
  const m = medidasCortinaNum(c), f: string[] = [];
  if (!c.tipo) f.push("tipo");
  if (!m.l1) f.push(c.emL ? "largura do trecho 1" : "largura");
  if (c.emL && !m.l2) f.push("largura do trecho 2");
  if (!m.alt) f.push("altura");
  if (!(c.tecido || "").trim()) f.push("tecido");
  return f;
}

export function textoCortina(c: Cortina): string {
  const m = medidasCortinaNum(c);
  const tipo = c.tipo || "Cortina";
  const p: string[] = [];
  let vao = "";
  if (c.emL) {
    const trechos = [m.l1, m.l2].filter(Boolean).map(fmtM).join(" + ");
    if (trechos) vao = ` para vão de ${trechos} m${m.l1 && m.l2 ? ` (${fmtM(m.total)} m no total)` : ""}`;
  } else if (m.l1) vao = ` para vão de ${fmtM(m.l1)}`;
  if (m.alt) vao += vao ? ` x ${fmtM(m.alt)} m de altura` : ` com ${fmtM(m.alt)} m de altura`;
  else if (vao && !c.emL) vao += " m de largura";
  p.push(`${tipo}${c.emL ? " em L" : ""}${vao}.`);
  const tec = (c.tecido || "").trim(), cor = (c.cor || "").trim();
  if (tec) p.push(`Tecido/produto: ${minusc(tec)}${cor ? `, cor ${minusc(cor)}` : ""}.`);
  else if (cor) p.push(`Cor: ${minusc(cor)}.`);
  if (c.xale && c.xale !== "sem") {
    const lado = { direito: "lado direito", esquerdo: "lado esquerdo", dois: "dois lados" }[c.xale];
    p.push(`Xale: ${lado}${m.xale ? `, medida ${fmtCm(m.xale)} cm` : ""}.`);
  }
  if (c.pingente) p.push("Com pingente.");
  if (c.gesso) p.push("Cortineiro no gesso.");
  const bt = (c.barra || "").trim();
  if (bt || m.barra) p.push(`Barra: ${[bt ? minusc(bt) : "", m.barra ? `${fmtCm(m.barra)} cm de altura` : ""].filter(Boolean).join(", ")}.`);
  const det = [...(c.detalhes ?? []).map(minusc), ...((c.outroDetalhe || "").trim() ? [minusc(c.outroDetalhe!)] : [])];
  if (det.length) p.push(`Detalhes: ${det.join(", ")}.`);
  if (c.motorizada) p.push("Motorizada.");
  if ((c.obs || "").trim()) p.push(frase(c.obs!));
  return p.join(" ");
}

export function medidasCortina(c: Cortina): string {
  const m = medidasCortinaNum(c), l: string[] = [];
  if (c.emL) {
    if (m.l1) l.push(`Trecho 1: ${fmtM(m.l1)} m`);
    if (m.l2) l.push(`Trecho 2: ${fmtM(m.l2)} m`);
    if (m.l1 && m.l2) l.push(`Largura total: ${fmtM(m.total)} m`);
  } else if (m.l1) l.push(`Largura: ${fmtM(m.l1)} m`);
  if (m.alt) l.push(`Altura: ${fmtM(m.alt)} m`);
  if (m.barra) l.push(`Altura da barra: ${fmtCm(m.barra)} cm`);
  if (m.xale) l.push(`Xale: ${fmtCm(m.xale)} cm`);
  return l.join("\n");
}

/** Só os campos conhecidos, com os tipos certos (o servidor grava isto). */
export function limparCortina(x: unknown): Cortina {
  const d = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const s = (k: string) => (typeof d[k] === "string" ? (d[k] as string).slice(0, 300) : undefined);
  const b = (k: string) => (d[k] === true ? true : undefined);
  const validos = [...CORT.cabecalho, ...CORT.acabamentos];
  const xale = ["sem", "direito", "esquerdo", "dois"].includes(d.xale as string) ? (d.xale as Xale) : undefined;
  const tipo = CORT.tipos.find((t) => t === d.tipo);
  return {
    tipo, emL: b("emL"), larg1: s("larg1"), larg2: d.emL === true ? s("larg2") : undefined, altura: s("altura"), tecido: s("tecido"), cor: s("cor"),
    barra: s("barra"), barraAlt: s("barraAlt"), detalhes: Array.isArray(d.detalhes) ? validos.filter((v) => (d.detalhes as unknown[]).includes(v)) : undefined,
    outroDetalhe: s("outroDetalhe"), xale, xaleMed: xale && xale !== "sem" ? s("xaleMed") : undefined,
    pingente: b("pingente"), gesso: b("gesso"), motorizada: b("motorizada"), obs: s("obs"),
  };
}

// =====================================================================
// 2. REVESTIMENTOS DE PAREDE (papel de parede, granilha e outros)
// =====================================================================
export const REV = {
  materiais: ["Papel de parede", "Granilha", "Revestimento"],
  descontos: ["Porta", "Janela", "Móvel", "Outro"] as TipoDesconto[],
  /** atalhos com medida pronta (móvel e outro entram sem medida: a arquitetura informa) */
  padrao: { Porta: ["0,80", "2,10"], Janela: ["1,20", "1,00"] } as Partial<Record<TipoDesconto, [string, string]>>,
};
export type TipoDesconto = "Porta" | "Janela" | "Móvel" | "Outro";
export type Desconto = { tipo: TipoDesconto; larg?: string; alt?: string; esq?: string; chao?: string };
export type Parede = {
  material?: string; parede?: string; larg?: string; altura?: string; rodape?: string; produto?: string; obs?: string; descontos?: Desconto[];
};

/** Rodapé: número ≥ 1 é lido em centímetros (10 → 0,10 m); abaixo de 1, em metros (0,15). */
export function lerRodape(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(/\s+/g, "").replace(/c?m$/i, "").replace(",", "."));
  if (!isFinite(n) || n <= 0) return 0;
  return Math.round((n >= 1 ? n / 100 : n) * 1000) / 1000;
}

/** posição (distância da lateral, altura do chão): como as medidas, mas aceita 0 */
function lerPosicao(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(/\s+/g, "").replace(/m$/i, "").replace(",", "."));
  if (!isFinite(n) || n <= 0) return 0;
  return Math.round((n > 30 ? n / 100 : n) * 100) / 100;
}

export type DescontoCalc = { tipo: TipoDesconto; w: number; h: number; x: number; y: number; area: number; noChao: boolean; fora: boolean; posAuto: boolean };

/** Cálculo da parede. Não calcula sobra, rolos nem tiras: isso é da loja. */
export function calcParede(p: Parede) {
  const L = lerMetros(p.larg), H = lerMetros(p.altura), rod = lerRodape(p.rodape);
  const lista = (p.descontos ?? []).map((d) => {
    const w = lerMetros(d.larg), h = lerMetros(d.alt);
    const temChao = String(d.chao ?? "").trim() !== "";
    // altura a partir do chão: informada, ou janela a 1 m (só para o desenho e para saber se encosta no chão), o resto no chão
    const y = temChao ? lerPosicao(d.chao) : d.tipo === "Janela" ? 1 : 0;
    const temEsq = String(d.esq ?? "").trim() !== "";
    const x = temEsq ? lerPosicao(d.esq) : -1;
    return { tipo: d.tipo, w, h, x, y, area: Math.round(w * h * 10000) / 10000, noChao: y <= 0.001, fora: false, posAuto: !temEsq } as DescontoCalc;
  });
  // sem distância da lateral: distribui na parede, com o mesmo espaço entre elas
  const autos = lista.filter((d) => d.posAuto);
  const livres = L - autos.reduce((s, d) => s + d.w, 0);
  const gap = autos.length ? Math.max(0, livres / (autos.length + 1)) : 0;
  let cur = gap;
  for (const d of autos) { d.x = cur; cur += d.w + gap; }
  for (const d of lista) d.fora = !!L && !!H && (d.x + d.w > L + 0.001 || d.y + d.h > H + 0.001 || (d.posAuto && livres < -0.001));
  const bruta = L * H;
  const aberturas = lista.reduce((s, d) => s + d.area, 0);
  const largChao = lista.filter((d) => d.noChao).reduce((s, d) => s + d.w, 0);
  const faixaRodape = Math.max(0, L - largChao) * rod;
  const descontos = aberturas + faixaRodape;
  const liquida = Math.max(0, bruta - descontos);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { L, H, rod, lista, bruta: r2(bruta), aberturas: r2(aberturas), faixaRodape: r2(faixaRodape), descontos: r2(descontos), liquida: r2(liquida), fora: lista.some((d) => d.fora) };
}

export function faltaParede(p: Parede): string[] {
  const c = calcParede(p), f: string[] = [];
  if (!p.material) f.push("material");
  if (!c.L) f.push("largura");
  if (!c.H) f.push("altura");
  c.lista.forEach((d, k) => { if (!d.w || !d.h) f.push(`medida do desconto ${k + 1} (${d.tipo.toLowerCase()})`); });
  return f;
}

/** Referência (PDF): só a identificação. "Material - Nome da parede. Produto. Observação." */
export function textoParede(p: Parede): string {
  const nome = (p.parede || "").trim();
  const ini = [(p.material || "").trim(), nome ? nome.charAt(0).toUpperCase() + nome.slice(1) : ""].filter(Boolean).join(" - ");
  return [frase(ini), frase(p.produto || ""), frase(p.obs || "")].filter(Boolean).join(" ");
}

export function medidasParede(p: Parede): string {
  const c = calcParede(p), l: string[] = [];
  if (c.L) l.push(`Largura: ${fmtM(c.L)} m`);
  if (c.H) l.push(`Altura: ${fmtM(c.H)} m`);
  if (c.rod) l.push(`Rodapé: ${fmtM(c.rod)} m`);
  if (c.L && c.H) {
    l.push(`Descontos: ${fmtM(c.descontos)} m²`);
    l.push(`Área líquida: ${fmtM(c.liquida)} m²`);
  }
  return l.join("\n");
}

export function limparParede(x: unknown): Parede {
  const d = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const s = (o: Record<string, unknown>, k: string) => (typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string).slice(0, 300) : undefined);
  const descontos = Array.isArray(d.descontos)
    ? (d.descontos as unknown[]).slice(0, 30).map((y) => {
        const o = (y && typeof y === "object" ? y : {}) as Record<string, unknown>;
        const tipo = REV.descontos.find((t) => t === o.tipo) ?? "Outro";
        return { tipo, larg: s(o, "larg"), alt: s(o, "alt"), esq: s(o, "esq"), chao: s(o, "chao") } as Desconto;
      })
    : undefined;
  return {
    material: REV.materiais.find((m) => m === d.material), parede: s(d, "parede"), larg: s(d, "larg"), altura: s(d, "altura"),
    rodape: s(d, "rodape"), produto: s(d, "produto"), obs: s(d, "obs"), descontos: descontos?.length ? descontos : undefined,
  };
}

/** Resumo por material (fim da folha): nº de paredes e área líquida somada. */
export function resumoRevestimentos(lista: unknown[]) {
  const m = new Map<string, { material: string; paredes: number; area: number }>();
  for (const x of lista) {
    const p = limparParede(x), c = calcParede(p), k = p.material || "Revestimento";
    if (!m.has(k)) m.set(k, { material: k, paredes: 0, area: 0 });
    const r = m.get(k)!;
    r.paredes++;
    r.area = Math.round((r.area + c.liquida) * 100) / 100;
  }
  return Array.from(m.values());
}

// =====================================================================
// 3. TAPETES
// =====================================================================
export const TAP = { formatos: ["Retangular", "Quadrado", "Redondo", "Oval", "Orgânico", "Passadeira"] };
export type Tapete = { formato?: string; larg?: string; comp?: string; material?: string; cor?: string; obs?: string };

/** redondo: só o diâmetro; quadrado: só um lado; o resto pede largura e comprimento */
export const tapeteUmaMedida = (f?: string) => f === "Redondo" || f === "Quadrado";

export function medidasTapeteNum(t: Tapete) {
  const l = lerMetros(t.larg);
  const c = tapeteUmaMedida(t.formato) ? l : lerMetros(t.comp);
  return { l, c };
}

export function faltaTapete(t: Tapete): string[] {
  const m = medidasTapeteNum(t), f: string[] = [];
  if (!t.formato) f.push("formato");
  if (!m.l) f.push(t.formato === "Redondo" ? "diâmetro" : t.formato === "Quadrado" ? "lado" : "largura");
  if (!tapeteUmaMedida(t.formato) && !m.c) f.push("comprimento");
  return f;
}

export function textoTapete(t: Tapete): string {
  const m = medidasTapeteNum(t), fm = minusc(t.formato || "");
  let s = "Tapete" + (fm && fm !== "orgânico" ? ` ${fm}` : "");
  if (t.formato === "Redondo") s += m.l ? ` de ${fmtM(m.l)} m de diâmetro` : "";
  else if (t.formato === "Orgânico") s = `Tapete orgânico${m.l && m.c ? `, medida geral de ${fmtM(m.l)} x ${fmtM(m.c)} m` : ""}`;
  else if (m.l && m.c) s += ` de ${fmtM(m.l)} x ${fmtM(m.c)} m`;
  else if (m.l) s += ` com ${fmtM(m.l)} m de largura`;
  const p = [s + "."];
  if ((t.material || "").trim()) p.push(`Material: ${minusc(t.material!)}.`);
  if ((t.cor || "").trim()) p.push(`Cor: ${minusc(t.cor!)}.`);
  if ((t.obs || "").trim()) p.push(frase(t.obs!));
  return p.join(" ");
}

export function medidasTapete(t: Tapete): string {
  const m = medidasTapeteNum(t);
  if (t.formato === "Redondo") return m.l ? `Diâmetro: ${fmtM(m.l)} m` : "";
  if (t.formato === "Orgânico") return m.l && m.c ? `Medida geral: ${fmtM(m.l)} x ${fmtM(m.c)} m` : "";
  const l: string[] = [];
  if (m.l) l.push(`Largura: ${fmtM(m.l)} m`);
  if (m.c) l.push(`Comprimento: ${fmtM(m.c)} m`);
  return l.join("\n");
}

export function limparTapete(x: unknown): Tapete {
  const d = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const s = (k: string) => (typeof d[k] === "string" && (d[k] as string).trim() ? (d[k] as string).slice(0, 300) : undefined);
  const formato = TAP.formatos.find((f) => f === d.formato);
  return { formato, larg: s("larg"), comp: tapeteUmaMedida(formato) ? undefined : s("comp"), material: s("material"), cor: s("cor"), obs: s("obs") };
}

// =====================================================================
// Ponto único: a partir do grupo e dos campos, o que vai para o banco e para a folha.
// =====================================================================
export type Gerado = { campos: Record<string, unknown>; material: string; referencia: string; medidas: string; falta: string[] };

export function gerarInterior(grupo: GrupoInterior, bruto: unknown): Gerado {
  switch (grupo) {
    case "cortinas": {
      const c = limparCortina(bruto);
      return { campos: c, material: (c.tipo || "Cortina").toUpperCase(), referencia: textoCortina(c), medidas: medidasCortina(c), falta: faltaCortina(c) };
    }
    case "revestimentos": {
      const p = limparParede(bruto);
      return { campos: p, material: (p.material || "Revestimento").toUpperCase(), referencia: textoParede(p), medidas: medidasParede(p), falta: faltaParede(p) };
    }
    case "tapetes": {
      const t = limparTapete(bruto);
      return { campos: t, material: "TAPETE", referencia: textoTapete(t), medidas: medidasTapete(t), falta: faltaTapete(t) };
    }
    default:
      return { campos: {}, material: "", referencia: "", medidas: "", falta: ["campos"] };
  }
}
