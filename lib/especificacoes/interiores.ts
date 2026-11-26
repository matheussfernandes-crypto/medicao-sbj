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
// Ponto único: a partir do grupo e dos campos, o que vai para o banco e para a folha.
// =====================================================================
export type Gerado = { campos: Record<string, unknown>; material: string; referencia: string; medidas: string; falta: string[] };

export function gerarInterior(grupo: GrupoInterior, bruto: unknown): Gerado {
  switch (grupo) {
    case "cortinas": {
      const c = limparCortina(bruto);
      return { campos: c, material: (c.tipo || "Cortina").toUpperCase(), referencia: textoCortina(c), medidas: medidasCortina(c), falta: faltaCortina(c) };
    }
    default:
      return { campos: {}, material: "", referencia: "", medidas: "", falta: ["campos"] };
  }
}
