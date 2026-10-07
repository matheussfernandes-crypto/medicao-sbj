import type { Perfil } from "./server";
import { compararCodigo, arred } from "./util";

export type LinhaBoletim = {
  item_id: string;
  codigo: string | null;
  descricao: string;
  unidade: string;
  valor_unitario: number;
  qtd_contratada: number;
  qtd_anterior: number;
  qtd_atual: number;
  qtd_acumulada: number;
  qtd_saldo: number;
  valor_contratado: number;
  valor_anterior: number;
  valor_atual: number;
  valor_acumulado: number;
  perc_executado: number;
  antecipado: boolean; // houve vale de medição neste mês para o item
};

export type ValeDesconto = {
  vale_id: string;
  numero: number;
  data: string;
  mes_referencia: string;
  observacao: string | null;
  valor_vale: number;
  ja_descontado: number; // em outros fechamentos
  descontar_agora: number;
  restante_depois: number;
};

export type Boletim = {
  contrato: any;
  mes: string;
  fechamento: any | null;
  linhas: LinhaBoletim[];
  medicoes: any[];        // MEDICAO aprovadas no mês
  valesMedicao: any[];    // VALE_MEDICAO aprovados no mês (informativo)
  vales: ValeDesconto[];  // VALEs com saldo a descontar
  pendentesNoMes: number;
  bruto: number;
  retido: number;
  retencoesDispensadas: { numero: number; motivo: string | null }[];
  valesDescontados: number;
  liquido: number;
  valeMedicaoBruto: number;
  valeMedicaoRetido: number;
  valeMedicaoLiquido: number;
  glosas: { numero: number; codigo: string | null; descricao: string; medido: number; aprovado: number; unidade: string; motivo: string | null }[];
  valorContrato: number;
  valorAcumuladoTotal: number;
};

/**
 * Monta o boletim de medição de um contrato num mês: planilha anterior/atual/
 * acumulado por item, retenção, vales a descontar e líquido a pagar.
 * Se o mês já estiver fechado, usa os descontos de vale gravados no fechamento.
 */
export async function calcularBoletim(supabase: Perfil["supabase"], contratoId: string, mes: string): Promise<Boletim | null> {
  const { data: contrato } = await supabase
    .from("contratos")
    .select("id, numero, objeto, status, data_inicio, data_termino, obra_id, empresa_id, obras(nome), empresas_terceirizadas(nome, nome_empresarial, cnpj)")
    .eq("id", contratoId)
    .single();
  if (!contrato) return null;

  const [{ data: itens }, { data: lancs }, { data: fechamento }] = await Promise.all([
    supabase.from("contrato_itens").select("id, codigo, descricao, unidade, quantidade, valor_unitario, ordem").eq("contrato_id", contratoId),
    supabase
      .from("contrato_lancamentos")
      .select("id, numero, tipo, data, mes_referencia, status, valor_bruto, retencao_aplicada, retencao_pct, retencao_valor, retencao_dispensa_motivo, valor_vale, valor_liquido, observacao, criado_por, aprovado_por, fechamento_id, contrato_lancamento_itens(item_id, quantidade_medida, quantidade_aprovada, valor_unitario, motivo_glosa)")
      .eq("contrato_id", contratoId),
    supabase.from("contrato_fechamentos").select("*").eq("contrato_id", contratoId).eq("mes_referencia", mes).maybeSingle(),
  ]);

  const aprovados = (lancs ?? []).filter((l: any) => l.status === "APROVADO");
  const comItens = aprovados.filter((l: any) => l.tipo !== "VALE");

  const linhas: LinhaBoletim[] = (itens ?? [])
    .map((i: any) => {
      let anterior = 0, atual = 0, vAnterior = 0, vAtual = 0, antecipado = false;
      for (const l of comItens as any[]) {
        for (const li of l.contrato_lancamento_itens ?? []) {
          if (li.item_id !== i.id) continue;
          const q = Number(li.quantidade_aprovada ?? li.quantidade_medida);
          const v = q * Number(li.valor_unitario);
          if (l.mes_referencia < mes) { anterior += q; vAnterior += v; }
          else if (l.mes_referencia === mes) {
            atual += q; vAtual += v;
            if (l.tipo === "VALE_MEDICAO" && q > 0) antecipado = true;
          }
        }
      }
      const contratada = Number(i.quantidade);
      const vu = Number(i.valor_unitario);
      const acumulada = anterior + atual;
      return {
        item_id: i.id,
        codigo: i.codigo,
        descricao: i.descricao,
        unidade: i.unidade,
        valor_unitario: vu,
        qtd_contratada: contratada,
        qtd_anterior: anterior,
        qtd_atual: atual,
        qtd_acumulada: acumulada,
        qtd_saldo: contratada - acumulada,
        valor_contratado: contratada * vu,
        valor_anterior: vAnterior,
        valor_atual: vAtual,
        valor_acumulado: vAnterior + vAtual,
        perc_executado: contratada > 0 ? (acumulada / contratada) * 100 : 0,
        antecipado,
        _ordem: i.ordem,
      } as LinhaBoletim & { _ordem: number };
    })
    .sort((a: any, b: any) => a._ordem - b._ordem || compararCodigo(a.codigo, b.codigo));

  const medicoes = aprovados.filter((l: any) => l.tipo === "MEDICAO" && l.mes_referencia === mes);
  const valesMedicao = aprovados.filter((l: any) => l.tipo === "VALE_MEDICAO" && l.mes_referencia === mes);
  const pendentesNoMes = (lancs ?? []).filter((l: any) => l.status === "PENDENTE" && l.mes_referencia === mes).length;

  const bruto = medicoes.reduce((s: number, l: any) => s + Number(l.valor_bruto), 0);
  const retido = medicoes.reduce((s: number, l: any) => s + Number(l.retencao_valor), 0);
  const retencoesDispensadas = [...medicoes, ...valesMedicao]
    .filter((l: any) => !l.retencao_aplicada)
    .map((l: any) => ({ numero: l.numero, motivo: l.retencao_dispensa_motivo }));

  // Vales (adiantamentos) aprovados até o mês, com o que já foi descontado.
  const valesAprov = aprovados
    .filter((l: any) => l.tipo === "VALE" && l.mes_referencia <= mes)
    .sort((a: any, b: any) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.numero - b.numero));
  const valeIds = valesAprov.map((v: any) => v.id);
  const { data: descontos } = valeIds.length
    ? await supabase.from("contrato_vale_descontos").select("vale_id, fechamento_id, valor").in("vale_id", valeIds)
    : { data: [] as any[] };

  let disponivel = arred(bruto - retido);
  const vales: ValeDesconto[] = [];
  for (const v of valesAprov as any[]) {
    const desc = (descontos ?? []).filter((d: any) => d.vale_id === v.id);
    const desteFechamento = fechamento ? desc.filter((d: any) => d.fechamento_id === fechamento.id) : [];
    const outros = desc.filter((d: any) => !fechamento || d.fechamento_id !== fechamento.id);
    const jaDescontado = outros.reduce((s: number, d: any) => s + Number(d.valor), 0);
    const valor = Number(v.valor_vale);
    let agora: number;
    if (fechamento) {
      agora = desteFechamento.reduce((s: number, d: any) => s + Number(d.valor), 0);
    } else {
      const restante = Math.max(0, arred(valor - jaDescontado));
      agora = Math.min(restante, Math.max(0, disponivel));
      disponivel = arred(disponivel - agora);
    }
    const restanteDepois = arred(valor - jaDescontado - agora);
    if (agora > 0 || restanteDepois > 0.004) {
      vales.push({
        vale_id: v.id,
        numero: v.numero,
        data: v.data,
        mes_referencia: v.mes_referencia,
        observacao: v.observacao,
        valor_vale: valor,
        ja_descontado: jaDescontado,
        descontar_agora: arred(agora),
        restante_depois: Math.max(0, restanteDepois),
      });
    }
  }
  const valesDescontados = arred(vales.reduce((s, v) => s + v.descontar_agora, 0));

  const glosas: Boletim["glosas"] = [];
  for (const l of [...medicoes, ...valesMedicao] as any[]) {
    for (const li of l.contrato_lancamento_itens ?? []) {
      if (li.quantidade_aprovada !== null && Number(li.quantidade_aprovada) !== Number(li.quantidade_medida)) {
        const it = (itens ?? []).find((i: any) => i.id === li.item_id);
        glosas.push({
          numero: l.numero,
          codigo: it?.codigo ?? null,
          descricao: it?.descricao ?? "—",
          unidade: it?.unidade ?? "",
          medido: Number(li.quantidade_medida),
          aprovado: Number(li.quantidade_aprovada),
          motivo: li.motivo_glosa,
        });
      }
    }
  }

  const valorContrato = linhas.reduce((s, l) => s + l.valor_contratado, 0);
  const valorAcumuladoTotal = linhas.reduce((s, l) => s + l.valor_acumulado, 0);

  return {
    contrato,
    mes,
    fechamento: fechamento ?? null,
    linhas,
    medicoes,
    valesMedicao,
    vales,
    pendentesNoMes,
    bruto: arred(bruto),
    retido: arred(retido),
    retencoesDispensadas,
    valesDescontados,
    liquido: arred(bruto - retido - valesDescontados),
    valeMedicaoBruto: arred(valesMedicao.reduce((s: number, l: any) => s + Number(l.valor_bruto), 0)),
    valeMedicaoRetido: arred(valesMedicao.reduce((s: number, l: any) => s + Number(l.retencao_valor), 0)),
    valeMedicaoLiquido: arred(valesMedicao.reduce((s: number, l: any) => s + Number(l.valor_liquido), 0)),
    glosas,
    valorContrato,
    valorAcumuladoTotal,
  };
}
