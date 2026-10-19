import { createClient } from "@/lib/supabase/server";
import { buscarStatusDasUnidades } from "./status-query";
import { linhasServicosPadrao, type DadosObra, type CelulaStatus, type HistoricoItem, type FotoObra } from "./types";

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

  const { data: servicosRows } = await supabase
    .from("andamento_servicos")
    .select("id, obra_id, torre_id, nome, ordem, peso")
    .eq("obra_id", obraId)
    .order("ordem");
  let servicos = servicosRows ?? [];

  // Torre ainda sem nenhum serviço: pré-popula com o fluxograma padrão da SBJ
  // (e os pesos padrão), pra não precisar montar a lista do zero.
  const comServico = new Set(servicos.map((s) => s.torre_id));
  const semServico = (torres ?? []).filter((t) => !comServico.has(t.id));
  if (semServico.length) {
    const linhas = semServico.flatMap((t) => linhasServicosPadrao(obraId, t.id, t.nome));
    const { data: inseridos } = await supabase
      .from("andamento_servicos")
      .upsert(linhas, { onConflict: "torre_id,nome", ignoreDuplicates: true })
      .select("id, obra_id, torre_id, nome, ordem, peso");
    servicos = [...servicos, ...(inseridos ?? [])];
  }

  const unidadeIds = (unidades ?? []).map((u) => u.id);

  const statusRows = await buscarStatusDasUnidades<{
    unidade_id: string;
    servico_id: string;
    status: CelulaStatus["status"];
    observacao: string | null;
    atualizado_em: string | null;
    atualizado_por: string | null;
  }>(supabase, unidadeIds, "unidade_id, servico_id, status, observacao, atualizado_em, atualizado_por");

  const { data: historicoRows } = unidadeIds.length
    ? await supabase
        .from("andamento_historico")
        .select("id, unidade_id, servico_id, tipo, de, para, observacao, criado_em, autor_id")
        .in("unidade_id", unidadeIds)
        .order("criado_em", { ascending: false })
        .limit(500)
    : { data: [] };

  const { data: fotosRows } = await supabase
    .from("obra_fotos")
    .select("id, data_foto, legenda, storage_path, criado_por")
    .eq("obra_id", obraId)
    .order("data_foto", { ascending: false })
    .order("criado_em", { ascending: false });
  const caminhos = (fotosRows ?? []).map((f) => f.storage_path);
  const { data: assinadas } = caminhos.length
    ? await supabase.storage.from("obra-fotos").createSignedUrls(caminhos, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlPorCaminho = new Map((assinadas ?? []).map((a) => [a.path, a.signedUrl]));

  const idsAutores = Array.from(
    new Set([...(statusRows ?? []).map((r) => r.atualizado_por), ...(historicoRows ?? []).map((r) => r.autor_id), ...(fotosRows ?? []).map((f) => f.criado_por)].filter(Boolean))
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

  const fotos: FotoObra[] = (fotosRows ?? [])
    .filter((f) => urlPorCaminho.get(f.storage_path))
    .map((f) => ({
      id: f.id,
      data_foto: f.data_foto,
      legenda: f.legenda,
      storage_path: f.storage_path,
      url: urlPorCaminho.get(f.storage_path)!,
      autor_nome: f.criado_por ? nomePorId.get(f.criado_por) ?? null : null,
    }));

  return {
    obraId,
    torres: torres ?? [],
    pavimentos: pavimentos ?? [],
    unidades: unidades ?? [],
    servicos,
    celulas,
    historico,
    fotos,
  };
}
