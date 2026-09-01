"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function exigirAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase.from("perfis").select("setor,status").eq("id", user.id).single();
  if (!perfil || perfil.setor !== "ADMIN" || perfil.status !== "aprovado") {
    throw new Error("Apenas o ADM pode gerenciar categorias e problemas de manutenção.");
  }
  return { supabase, user };
}

export async function criarCategoria(formData: FormData) {
  const { supabase, user } = await exigirAdmin();
  const nome = String(formData.get("nome") || "").trim();
  if (!nome) return;
  await supabase.from("manutencao_categorias").insert({ nome, criado_por: user.id });
  revalidatePath("/manutencoes/opcoes");
}

export async function criarProblema(formData: FormData) {
  const { supabase, user } = await exigirAdmin();
  const nome = String(formData.get("nome") || "").trim();
  if (!nome) return;
  await supabase.from("manutencao_problemas").insert({ nome, criado_por: user.id });
  revalidatePath("/manutencoes/opcoes");
}

export async function alternarAtivoCategoria(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(formData.get("id"));
  const ativo = formData.get("ativo") === "1";
  await supabase.from("manutencao_categorias").update({ ativo }).eq("id", id);
  revalidatePath("/manutencoes/opcoes");
}

export async function alternarAtivoProblema(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(formData.get("id"));
  const ativo = formData.get("ativo") === "1";
  await supabase.from("manutencao_problemas").update({ ativo }).eq("id", id);
  revalidatePath("/manutencoes/opcoes");
}
