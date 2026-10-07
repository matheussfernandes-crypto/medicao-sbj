// Funções puras do módulo Contratos — usadas tanto no servidor quanto no navegador.

export const SETORES_LANCAM_CONTRATO = ["ADMIN", "ENGENHEIRO", "ESTAGIARIO"];
export const SETORES_VEEM_CONTRATO = ["ADMIN", "ENGENHEIRO", "ESTAGIARIO", "FINANCEIRO"];

export const TIPO_LANC_LABEL: Record<string, string> = {
  MEDICAO: "Medição",
  VALE: "Vale",
  VALE_MEDICAO: "Vale de medição",
};

export const STATUS_LANC_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
};

export const TIPO_ADITIVO_LABEL: Record<string, string> = {
  ACRESCIMO: "Acréscimo de quantidade",
  SUPRESSAO: "Supressão de quantidade",
  ITEM_NOVO: "Serviço novo",
  PRECO: "Alteração de preço",
};

export const UNIDADES = ["m²", "m³", "m", "un", "vb", "kg", "h", "dia", "mês", "pt", "cj"];

export function brl(n: number | string | null | undefined) {
  return Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function num(n: number | string | null | undefined, casas = 2) {
  return Number(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
}

export function pct(n: number | string | null | undefined) {
  return `${Number(n ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export function mesAtual() {
  const d = new Date();
  d.setHours(d.getHours() - 3); // America/Sao_Paulo
  return d.toISOString().slice(0, 7);
}

export function hojeISO() {
  const d = new Date();
  d.setHours(d.getHours() - 3);
  return d.toISOString().slice(0, 10);
}

export function mesLabel(mes: string) {
  const [a, m] = mes.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(m) - 1] ?? m}/${a}`;
}

export function dataBR(d: string | null | undefined) {
  if (!d) return "—";
  const s = d.slice(0, 10);
  const [a, m, dia] = s.split("-");
  return `${dia}/${m}/${a}`;
}

export function dataHoraBR(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

/** Aceita "1.234,56", "1234,56", "1234.56". */
export function parseNum(v: FormDataEntryValue | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** % de retenção vigente num mês, a partir do histórico (vigente_desde = YYYY-MM). */
export function retencaoVigente(historico: { vigente_desde: string; percent: number | string }[], mes: string) {
  const validos = historico
    .filter((h) => h.vigente_desde <= mes)
    .sort((a, b) => (a.vigente_desde < b.vigente_desde ? 1 : -1));
  return validos.length ? Number(validos[0].percent) : 0;
}

export const EPS = 1e-6;

export function arred(n: number, casas = 2) {
  const f = 10 ** casas;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** Ordena códigos de item tipo "1.2" < "1.10" < "2.1". */
export function compararCodigo(a: string | null, b: string | null) {
  const pa = (a ?? "").split(".").map((x) => Number(x) || 0);
  const pb = (b ?? "").split(".").map((x) => Number(x) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
