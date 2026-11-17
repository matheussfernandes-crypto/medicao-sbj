// Nomes de arquivo dos PDFs no padrão que a engenharia já usava nas pastas do Dropbox:
//   MEDIÇÃO 01 - GESSO - TENERIFE - JANEIRO - COM RETIDO.pdf
//   MEDIÇÃO 02 - CERAMICA - TENERIFE - MARÇO - VALE.pdf
//   MED - TENERIFE - FEVEREIRO - 2026.pdf   /   VALE - TENERIFE - FEVEREIRO - 2026.pdf

const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

/** "2026-11" → "NOVEMBRO - 2026" */
export function mesAno(mes: string) {
  const [a, m] = mes.split("-");
  return `${MESES[Number(m) - 1] ?? m} - ${a}`;
}

/** "2026-11" → "NOVEMBRO" */
export function mesNome(mes: string) {
  const m = mes.split("-")[1];
  return MESES[Number(m) - 1] ?? m;
}

/** "ILHA DE SAN BLAS" → "SANBLAS", "Ilha Capri" → "CAPRI" */
export function obraCurta(nome: string | null | undefined) {
  const n = (nome ?? "").toUpperCase().trim().replace(/^ILHA\s+(DE\s+|DO\s+|DA\s+)?/, "").replace(/\s+/g, "");
  return n || "OBRA";
}

/** "MO REVESTIMENTO CERÂMICO" → "REVESTIMENTO CERÂMICO" (tira o "MO" de mão de obra) */
export function servicoCurto(objeto: string | null | undefined) {
  return (objeto ?? "").toUpperCase().trim().replace(/^M\.?\s*O\.?\s+/, "").replace(/\s+/g, " ") || "SERVIÇO";
}

const limpa = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Medição e vale do contrato seguem a mesma numeração:
 *   MEDIÇÃO 01 - CERAMICA - TENERIFE - MARÇO - VALE.pdf
 *   MEDIÇÃO 02 - CERAMICA - TENERIFE - MARÇO - COM RETIDO.pdf
 */
export function nomeMedicaoContrato(o: { numero: number; objeto: string; obra: string; mes: string; final: "VALE" | "COM RETIDO" | "SEM RETIDO"; previa?: boolean }) {
  const n = String(o.numero).padStart(2, "0");
  return limpa(`${o.previa ? "PRÉVIA - " : ""}MEDIÇÃO ${n} - ${servicoCurto(o.objeto)} - ${obraCurta(o.obra)} - ${mesNome(o.mes)} - ${o.final}`) + ".pdf";
}

/**
 * Nº na sequência do contrato: contam os fechamentos (medição e vale) anteriores; no mesmo mês o vale vem antes.
 * Se o documento ainda não foi fechado, recebe o próximo número.
 */
export async function numeroDocumentoContrato(supabase: any, contratoId: string, mes: string, tipo: "MEDICAO" | "VALE") {
  const [{ count: meds }, { count: vales }] = await Promise.all([
    supabase.from("contrato_fechamentos").select("id", { count: "exact", head: true }).eq("contrato_id", contratoId).lt("mes_referencia", mes),
    tipo === "MEDICAO"
      ? supabase.from("contrato_fechamentos_vale").select("id", { count: "exact", head: true }).eq("contrato_id", contratoId).lte("mes_referencia", mes)
      : supabase.from("contrato_fechamentos_vale").select("id", { count: "exact", head: true }).eq("contrato_id", contratoId).lt("mes_referencia", mes),
  ]);
  return (meds ?? 0) + (vales ?? 0) + 1;
}

export function nomeObra(o: { tipo: "MED" | "VALE"; obra: string; mes: string; previa?: boolean }) {
  return limpa(`${o.previa ? "PRÉVIA - " : ""}${o.tipo} - ${obraCurta(o.obra)} - ${mesAno(o.mes)}`) + ".pdf";
}

/** Content-Disposition com acento (filename*) e versão sem acento para navegadores antigos. */
export function disposicao(nome: string, tipo: "inline" | "attachment" = "inline") {
  const ascii = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}
