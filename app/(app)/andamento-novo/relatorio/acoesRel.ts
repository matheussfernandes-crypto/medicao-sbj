"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Filtros, Formato, Montagem } from "./modelo";

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
