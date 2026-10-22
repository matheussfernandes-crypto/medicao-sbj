"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Filtros, Formato, FotosSel, Montagem, MontagemDados, MontagemSalva } from "./modelo";

async function logado() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user!.id };
}

export async function salvarPredefinicao(obraId: string, nome: string, filtros: Filtros, formato: Formato, montagem: Montagem) {
  const { supabase, userId } = await logado();
  const { data, error } = await supabase
    .from("an_predefinicao")
    .insert({ obra_id: obraId, usuario_id: userId, nome: nome.trim(), filtros, formatacao: formato, montagem })
    .select("id, nome, filtros, formatacao, montagem")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/andamento-novo/relatorio");
  return data;
}

export async function excluirPredefinicao(id: string) {
  const { supabase } = await logado();
  const { error } = await supabase.from("an_predefinicao").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/andamento-novo/relatorio");
}

// ---- fotos do resumo (relatório simples): uma escolha por obra ----
export async function salvarFotosRelatorio(obraId: string, fotos: FotosSel) {
  const { supabase } = await logado();
  const { error } = await supabase.from("an_relatorio_cfg").upsert({ obra_id: obraId, fotos, atualizado_em: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// ---- montagens salvas com nome (por obra) ----
export async function criarMontagem(obraId: string, nome: string, dados: MontagemDados): Promise<MontagemSalva> {
  const { supabase, userId } = await logado();
  const { data, error } = await supabase.from("an_montagem").insert({ obra_id: obraId, usuario_id: userId, nome: nome.trim() || "Nova montagem", dados }).select("id, nome, dados").single();
  if (error) throw new Error(error.message);
  return { id: data.id, nome: data.nome, dados: data.dados as MontagemDados };
}

export async function atualizarMontagem(id: string, nome: string, dados: MontagemDados) {
  const { supabase } = await logado();
  const { error } = await supabase.from("an_montagem").update({ nome: nome.trim() || "Montagem", dados, atualizado_em: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function excluirMontagem(id: string) {
  const { supabase } = await logado();
  const { error } = await supabase.from("an_montagem").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
