import type { ItemMedicao, ResumoMedicao } from "@/lib/pdf/FolhaPdf";

// Regra do fechamento mensal (vales acumulados e Vale + Medição):
//  - Vale + Medição lançado do dia 21 em diante entra no relatório de MEDIÇÃO do mês (não no de vale): a medição complementar
//    (bruto, com retenção) aparece como item e o valor do vale é pago agora, ficando no saldo da pessoa.
//  - Os vales (vale real e a parte de vale do Vale + Medição) se acumulam por pessoa. Quando a pessoa tem uma medição no
//    fechamento, TODO o saldo que ainda não foi descontado (de meses anteriores e deste) é descontado de uma vez, e cada vale
//    só é descontado uma vez (vale_descontado_em). Quem não tem medição no fechamento segue acumulando.
export const DIA_CORTE_VALE_MEDICAO = 21;

type Lanc = {
  id: string;
  tipo: string;
  data: string;
  pessoa_id: string | null;
  servico: string | null;
  local: string | null;
  detalhe_texto: string | null;
  valor_unitario_usado: number | null;
  quantidade: number | null;
  total_reais: number | null;
  valor_vale_hibrido: number | null;
  retencao_pct_usado: number | null;
  vale_real: boolean;
  criado_por: string | null;
  mes_referencia: string;
};

const COLUNAS = "id, tipo, data, pessoa_id, servico, local, detalhe_texto, valor_unitario_usado, quantidade, total_reais, valor_vale_hibrido, retencao_pct_usado, vale_real, criado_por, mes_referencia";

// Vale + Medição do dia 21 em diante: vai para o relatório de medição
export const valeMedicaoDeMedicao = (l: { tipo: string; data: string }) => l.tipo === "VALE_MEDICAO" && Number(String(l.data).slice(8, 10)) >= DIA_CORTE_VALE_MEDICAO;
// Vale + Medição antes do dia 21: continua no relatório de vale
export const valeMedicaoDeVale = (l: { tipo: string; data: string }) => l.tipo === "VALE_MEDICAO" && !valeMedicaoDeMedicao(l);

const valorDoVale = (l: { tipo: string; total_reais: number | null; valor_vale_hibrido: number | null }) => (l.tipo === "VALE_MEDICAO" ? Number(l.valor_vale_hibrido ?? 0) : Number(l.total_reais ?? 0));

export type ResultadoMedicao = {
  temAlgo: boolean; // há medição ou Vale + Medição do dia 21 em diante para fechar
  qtdItens: number;
  itens: ItemMedicao[];
  resumo: ResumoMedicao[];
  somaTotal: number;
  somaRetido: number;
  somaVale: number; // vale descontado
  somaValeAgora: number; // vale pago agora (Vale + Medição do dia 21 em diante)
  somaPagar: number;
  lancadoresIds: string[];
  idsDescontados: string[]; // vales que este fechamento desconta (marcados ao finalizar)
};

export async function calcularMedicao(supabase: any, obraId: string, mes: string): Promise<ResultadoMedicao> {
  const { data: lista } = await supabase.from("lancamentos").select(COLUNAS).eq("obra_id", obraId).eq("mes_referencia", mes).eq("status", "APROVADO");
  const todos = (lista ?? []) as Lanc[];
  const medicoes = todos.filter((l) => l.tipo === "MEDICAO");
  const valesMedicao = todos.filter(valeMedicaoDeMedicao);
  const idsValesMedicao = new Set(valesMedicao.map((l) => l.id));

  // saldo de vales ainda não descontados, até este mês, só de quem tem medição neste fechamento
  const comMedicao = Array.from(new Set(medicoes.map((l) => l.pessoa_id).filter(Boolean))) as string[];
  let pendentes: Lanc[] = [];
  if (comMedicao.length) {
    const { data: p } = await supabase
      .from("lancamentos")
      .select(COLUNAS)
      .eq("obra_id", obraId)
      .eq("status", "APROVADO")
      .lte("mes_referencia", mes)
      .is("vale_descontado_em", null)
      .in("pessoa_id", comMedicao)
      .or("and(tipo.eq.VALE,vale_real.eq.true),tipo.eq.VALE_MEDICAO");
    pendentes = ((p ?? []) as Lanc[]).filter((l) => !idsValesMedicao.has(l.id));
  }

  const pessoaIds = Array.from(new Set([...medicoes, ...valesMedicao, ...pendentes].map((l) => l.pessoa_id).filter(Boolean))) as string[];
  const { data: pessoas } = pessoaIds.length ? await supabase.from("pessoas").select("id, nome").in("id", pessoaIds) : { data: [] as any[] };
  const nomePessoa: Record<string, string> = {};
  for (const p of pessoas ?? []) nomePessoa[p.id] = p.nome;

  const itens: ItemMedicao[] = [
    ...medicoes.map((l) => ({
      empreiteiro: nomePessoa[l.pessoa_id ?? ""] ?? "—",
      servico: l.servico ?? "—",
      local: l.local ?? "—",
      valorUnitario: Number(l.valor_unitario_usado ?? 0),
      quantidadeTexto: l.detalhe_texto ?? String(l.quantidade ?? ""),
      total: Number(l.total_reais),
    })),
    // Vale + Medição do dia 21 em diante: a medição complementar entra como item (com retenção) e o vale é pago agora
    ...valesMedicao.map((l) => ({
      empreiteiro: nomePessoa[l.pessoa_id ?? ""] ?? "—",
      servico: "Vale + Medição",
      local: l.local ?? "—",
      valorUnitario: 0,
      quantidadeTexto: `${l.detalhe_texto ?? "Medição complementar"} · vale pago agora R$ ${Number(l.valor_vale_hibrido ?? 0).toFixed(2).replace(".", ",")}`,
      total: Number(l.total_reais),
    })),
  ];

  const porPessoa: Record<string, { nome: string; total: number; pct: number; vale: number; valeAgora: number }> = {};
  const pega = (pid: string | null, pct: number) => {
    const k = pid ?? "—";
    if (!porPessoa[k]) porPessoa[k] = { nome: nomePessoa[k] ?? "—", total: 0, pct, vale: 0, valeAgora: 0 };
    return porPessoa[k];
  };
  for (const l of medicoes) {
    const p = pega(l.pessoa_id, Number(l.retencao_pct_usado ?? 0));
    p.total += Number(l.total_reais);
  }
  for (const l of valesMedicao) {
    const p = pega(l.pessoa_id, Number(l.retencao_pct_usado ?? 0));
    p.total += Number(l.total_reais);
    p.valeAgora += Number(l.valor_vale_hibrido ?? 0);
  }
  for (const l of pendentes) {
    const p = pega(l.pessoa_id, 0);
    p.vale += valorDoVale(l);
  }

  const resumo: ResumoMedicao[] = Object.values(porPessoa).map((p) => {
    const retido = p.total * p.pct;
    return { nome: p.nome, retido, pct: p.pct, total: p.total, vale: p.vale, valeAgora: p.valeAgora, totalPagar: p.total - retido - p.vale + p.valeAgora };
  });

  return {
    temAlgo: medicoes.length > 0 || valesMedicao.length > 0,
    qtdItens: medicoes.length + valesMedicao.length,
    itens,
    resumo,
    somaTotal: resumo.reduce((s, r) => s + r.total, 0),
    somaRetido: resumo.reduce((s, r) => s + r.retido, 0),
    somaVale: resumo.reduce((s, r) => s + r.vale, 0),
    somaValeAgora: resumo.reduce((s, r) => s + (r.valeAgora ?? 0), 0),
    somaPagar: resumo.reduce((s, r) => s + r.totalPagar, 0),
    lancadoresIds: Array.from(new Set([...medicoes, ...valesMedicao].map((l) => l.criado_por).filter(Boolean))) as string[],
    idsDescontados: pendentes.map((l) => l.id),
  };
}

// saldo de vales acumulado por pessoa (ainda não descontado), para a tela de fechamento
export async function saldoDeVales(supabase: any, obraId: string) {
  const { data } = await supabase
    .from("lancamentos")
    .select("id, tipo, pessoa_id, total_reais, valor_vale_hibrido, mes_referencia")
    .eq("obra_id", obraId)
    .eq("status", "APROVADO")
    .is("vale_descontado_em", null)
    .or("and(tipo.eq.VALE,vale_real.eq.true),tipo.eq.VALE_MEDICAO");
  const linhas = (data ?? []) as Lanc[];
  const ids = Array.from(new Set(linhas.map((l) => l.pessoa_id).filter(Boolean))) as string[];
  const { data: pessoas } = ids.length ? await supabase.from("pessoas").select("id, nome").in("id", ids) : { data: [] as any[] };
  const nome: Record<string, string> = {};
  for (const p of pessoas ?? []) nome[p.id] = p.nome;
  const por: Record<string, { nome: string; valor: number; n: number; desde: string }> = {};
  for (const l of linhas) {
    const k = l.pessoa_id ?? "—";
    por[k] ??= { nome: nome[k] ?? "—", valor: 0, n: 0, desde: l.mes_referencia };
    por[k].valor += valorDoVale(l);
    por[k].n++;
    if (l.mes_referencia < por[k].desde) por[k].desde = l.mes_referencia;
  }
  return Object.values(por).sort((a, b) => a.nome.localeCompare(b.nome));
}
