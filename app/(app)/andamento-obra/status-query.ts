import type { SupabaseClient } from "@supabase/supabase-js";

// O PostgREST devolve no máximo 1000 linhas por consulta e uma lista enorme de
// ids no .in() estoura o tamanho da URL. Uma obra grande (80 unidades x 33
// serviços) passa fácil de 1000 linhas de status, então buscamos em lotes de
// ids e paginamos cada lote.
export async function buscarStatusDasUnidades<T = Record<string, any>>(
  supabase: SupabaseClient,
  unidadeIds: string[],
  colunas: string
): Promise<T[]> {
  const LOTE = 100;
  const PAGINA = 1000;
  const resultado: T[] = [];
  for (let i = 0; i < unidadeIds.length; i += LOTE) {
    const ids = unidadeIds.slice(i, i + LOTE);
    for (let de = 0; ; de += PAGINA) {
      const { data } = await supabase
        .from("andamento_status")
        .select(colunas)
        .in("unidade_id", ids)
        .order("unidade_id")
        .order("servico_id")
        .range(de, de + PAGINA - 1);
      const linhas = (data ?? []) as T[];
      resultado.push(...linhas);
      if (linhas.length < PAGINA) break;
    }
  }
  return resultado;
}
