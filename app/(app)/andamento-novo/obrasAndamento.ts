import type { SupabaseClient } from "@supabase/supabase-js";
import type { ObraInfo } from "./types";

// Lista de obras do Andamento de Obra (novo). Vem SÓ da tabela própria do módulo (andamento_novo_obras), nunca da tabela geral de obras:
// excluir ou cadastrar obra aqui não mexe em medição, financeiro, andamento antigo nem em nenhuma outra tela.
// obra_geral_id = ligação opcional (somente leitura) com a obra do cadastro geral; as fotos usam essa ligação.
export async function listarObrasAndamento(supabase: SupabaseClient): Promise<ObraInfo[]> {
  const { data } = await supabase.from("andamento_novo_obras").select("id, nome, data_inicio, data_entrega_prevista, obra_id").is("excluida_em", null).order("nome");
  return (data ?? []).map((o: any) => ({ id: o.id, nome: o.nome, data_inicio: o.data_inicio, data_entrega_prevista: o.data_entrega_prevista, obra_geral_id: o.obra_id ?? null }));
}

export type ObraExcluida = { id: string; nome: string; excluida_em: string };
// obras excluídas há menos de 30 dias (podem ser restauradas)
export async function listarObrasExcluidas(supabase: SupabaseClient): Promise<ObraExcluida[]> {
  const { data } = await supabase.from("andamento_novo_obras").select("id, nome, excluida_em").not("excluida_em", "is", null).order("excluida_em", { ascending: false });
  return (data ?? []) as ObraExcluida[];
}
