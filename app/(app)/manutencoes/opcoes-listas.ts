import { createClient } from "@/lib/supabase/server";
import { CATEGORIA_LABEL, PROBLEMA_LABEL } from "./constants";

export type Opcao = { valor: string; label: string };

// Categoria/Problema deixaram de ser listas fixas no código — agora vêm das
// tabelas manutencao_categorias/manutencao_problemas, editáveis pelo ADM em
// /manutencoes/opcoes. CATEGORIA_LABEL/PROBLEMA_LABEL seguem servindo só como
// tradução mais bonita pros valores antigos (ex: HIDRAULICA -> "Hidráulica");
// itens novos cadastrados pelo ADM usam o próprio nome digitado como label.
export async function listarCategoriasEProblemas(): Promise<{ categorias: Opcao[]; problemas: Opcao[] }> {
  const supabase = createClient();
  const [{ data: categoriasDb }, { data: problemasDb }] = await Promise.all([
    supabase.from("manutencao_categorias").select("nome").eq("ativo", true).order("nome"),
    supabase.from("manutencao_problemas").select("nome").eq("ativo", true).order("nome"),
  ]);

  return {
    categorias: (categoriasDb ?? []).map((c) => ({ valor: c.nome, label: CATEGORIA_LABEL[c.nome] ?? c.nome })),
    problemas: (problemasDb ?? []).map((p) => ({ valor: p.nome, label: PROBLEMA_LABEL[p.nome] ?? p.nome })),
  };
}
