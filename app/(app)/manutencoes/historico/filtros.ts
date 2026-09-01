// Monta e aplica os filtros do Histórico de Manutenções — compartilhado entre
// a página, o PDF e o Excel, pra garantir que os três batam com os mesmos dados.

import type { SupabaseClient } from "@supabase/supabase-js";

export type FiltrosHistorico = {
  q?: string;
  obra?: string;
  categoria?: string;
  problema?: string;
  status?: string;
  garantia?: string;
  origem?: string;
  prioridade?: string;
  de?: string;
  ate?: string;
};

export function lerFiltros(searchParams: URLSearchParams): FiltrosHistorico {
  const get = (k: string) => searchParams.get(k) || undefined;
  return {
    q: get("q"),
    obra: get("obra"),
    categoria: get("categoria"),
    problema: get("problema"),
    status: get("status"),
    garantia: get("garantia"),
    origem: get("origem"),
    prioridade: get("prioridade"),
    de: get("de"),
    ate: get("ate"),
  };
}

export function aplicarFiltros(supabase: SupabaseClient, filtros: FiltrosHistorico) {
  let query = supabase
    .from("manutencao_os")
    .select(
      "id, numero_os, obra_id, torre_id, pavimento_id, unidade_id, area_comum_texto, categoria, problema, descricao, prioridade, status, garantia_classificacao, servico_executado, observacao_tecnica, solicitante_nome, origem, responsavel_tipo, responsavel_perfil_id, responsavel_empresa_id, criado_em, finalizado_em"
    )
    .order("criado_em", { ascending: false })
    .limit(500);

  if (filtros.obra) query = query.eq("obra_id", filtros.obra);
  if (filtros.categoria) query = query.eq("categoria", filtros.categoria);
  if (filtros.problema) query = query.eq("problema", filtros.problema);
  if (filtros.status) query = query.eq("status", filtros.status);
  if (filtros.garantia) query = query.eq("garantia_classificacao", filtros.garantia);
  if (filtros.origem) query = query.eq("origem", filtros.origem);
  if (filtros.prioridade) query = query.eq("prioridade", filtros.prioridade);
  if (filtros.de) query = query.gte("criado_em", `${filtros.de}T00:00:00`);
  if (filtros.ate) query = query.lte("criado_em", `${filtros.ate}T23:59:59`);
  if (filtros.q) {
    const termo = filtros.q.trim();
    if (termo) {
      query = query.or(
        [
          `solicitante_nome.ilike.%${termo}%`,
          `descricao.ilike.%${termo}%`,
          `area_comum_texto.ilike.%${termo}%`,
          `observacao_tecnica.ilike.%${termo}%`,
        ].join(",")
      );
    }
  }

  return query;
}
