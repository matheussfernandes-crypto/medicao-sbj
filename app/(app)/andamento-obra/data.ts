import { createClient } from "@/lib/supabase/server";
import { SERVICOS_PADRAO, type DadosObra, type CelulaStatus, type HistoricoItem } from "./types";

export async function buscarDadosObra(obraId: string): Promise<DadosObra> {
  const supabase = createClient();

  const { data: torres } = await supabase
    .from("torres")
    .select("id, obra_id, nome, ordem")
    .eq("obra_id", obraId)
    .order("ordem");

  const torreIds = (torres ?? []).map((t) => t.id);

  const { data: pavimentos } = torreIds.length
    ? await supabase
        .from("pavimentos")
        .select("id, torre_id, nome, ordem, categoria")
        .in("torre_id", torreIds)
        .order("ordem")
    : { data: [] };

  const pavimentoIds = (pavimentos ?? []).map((p) => p.id);

  const { data: unidades } = pavimentoIds.length
    ? await supabase
        .from("unidades")
        .select("id, pavimento_id, nome, ordem")
        .in("pavimento_id", pavimentoIds)
        .order("ordem")
    : { data: [] };

  let { data: servicos } = await supabase
    .from("andamento_servicos")
    .select("id, obra_id, nome, ordem")
    .eq("obra_id", obraId)
    .order("ordem");

  // Obra ainda sem nenhum serviço cadastrado: pré-popula com o fluxograma
  // padrão da SBJ, pra não precisar montar a lista do zero toda vez.
  if (!servicos || servicos.length === 0) {
    const linhas = SERVICOS_PADRAO.map((nome, ordem) => ({ obra_id: obraId, nome, ordem }));
    const { data: inseridos } = await supabase
      .from("andamento_servicos")
      .upsert(linhas, { onConflict: "obra_id,nome", ignoreDuplicates: true })
      .select("id, obra_id, nome, ordem");
    servicos = (inseridos ?? []).sort((a, b) => a.ordem - b.ordem);
  }

  const unidadeIds = (unidades ?? []).map((u) => u.id);

  const { data: statusRows } = unidadeIds.length
    ? await supabase
        .from("andamento_status")
        .select("unidade_id, servico_id, status, observacao, atualizado_em, atualizado_por")
        .in("unidade_id", unidadeIds)
    : { data: [] };

  const { data: historicoRows } = unidadeIds.length
    ? await supabase
        .from("andamento_historico")
        .select("id, unidade_id, servico_id, tipo, de, para, observacao, criado_em, autor_id")
        .in("unidade_id", unidadeIds)
        .order("criado_em", { ascending: false })
        .limit(500)
    : { data: [] };

  const idsAutores = Array.from(
    new Set([...(statusRows ?? []).map((r) => r.atualizado_por), ...(historicoRows ?? []).map((r) => r.autor_id)].filter(Boolean))
  ) as string[];
  const { data: perfisAutores } = idsAutores.length
    ? await supabase.rpc("nomes_perfis", { uids: idsAutores })
    : { data: [] as { id: string; nome_completo: string }[] };
  const nomePorId = new Map((perfisAutores as { id: string; nome_completo: string }[] | null ?? []).map((p) => [p.id, p.nome_completo]));

  const celulas: CelulaStatus[] = (statusRows ?? []).map((r) => ({
    unidade_id: r.unidade_id,
    servico_id: r.servico_id,
    status: r.status,
    observacao: r.observacao,
    atualizado_em: r.atualizado_em,
    atualizado_por_nome: r.atualizado_por ? nomePorId.get(r.atualizado_por) ?? null : null,
  }));

  const historico: HistoricoItem[] = (historicoRows ?? []).map((r) => ({
    id: r.id,
    unidade_id: r.unidade_id,
    servico_id: r.servico_id,
    tipo: r.tipo,
    de: r.de,
    para: r.para,
    observacao: r.observacao,
    criado_em: r.criado_em,
    autor_nome: r.autor_id ? nomePorId.get(r.autor_id) ?? null : null,
  }));

  return {
    obraId,
    torres: torres ?? [],
    pavimentos: pavimentos ?? [],
    unidades: unidades ?? [],
    servicos: servicos ?? [],
    celulas,
    historico,
  };
}
