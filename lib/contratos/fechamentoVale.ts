import type { Perfil } from "./server";
import { arred } from "./util";

export type ValeDoMes = {
  id: string;
  numero: number;
  data: string;
  valor: number;
  observacao: string | null;
  aprovado_em: string | null;
};

export type FechamentoVale = {
  contrato: any;
  mes: string;
  fechamento: any | null;
  vales: ValeDoMes[];
  total: number;
  pendentesNoMes: number;
};

/**
 * Relatório de vales (adiantamentos) pagos num mês do contrato — separado do boletim de medição.
 * Mês fechado: usa os vales marcados por esse fechamento; aberto: os vales aprovados do mês.
 */
export async function calcularFechamentoVale(
  supabase: Perfil["supabase"],
  contratoId: string,
  mes: string
): Promise<FechamentoVale | null> {
  const [{ data: contrato }, { data: fechamento }, { data: lancs }] = await Promise.all([
    supabase
      .from("contratos")
      .select("id, numero, objeto, status, obra_id, empresa_id, obras(nome), empresas_terceirizadas(nome, nome_empresarial, cnpj)")
      .eq("id", contratoId)
      .single(),
    supabase.from("contrato_fechamentos_vale").select("*").eq("contrato_id", contratoId).eq("mes_referencia", mes).maybeSingle(),
    supabase
      .from("contrato_lancamentos")
      .select("id, numero, data, status, valor_vale, observacao, aprovado_em, fechamento_vale_id")
      .eq("contrato_id", contratoId)
      .eq("tipo", "VALE")
      .eq("mes_referencia", mes),
  ]);
  if (!contrato) return null;

  const vales = (lancs ?? [])
    .filter((l: any) => (fechamento ? l.fechamento_vale_id === fechamento.id : l.status === "APROVADO"))
    .sort((a: any, b: any) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.numero - b.numero))
    .map((l: any) => ({
      id: l.id,
      numero: l.numero,
      data: l.data,
      valor: Number(l.valor_vale),
      observacao: l.observacao,
      aprovado_em: l.aprovado_em,
    }));

  return {
    contrato,
    mes,
    fechamento: fechamento ?? null,
    vales,
    total: arred(vales.reduce((s, v) => s + v.valor, 0)),
    pendentesNoMes: (lancs ?? []).filter((l: any) => l.status === "PENDENTE").length,
  };
}
