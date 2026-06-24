"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function exigirRhOuAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase.from("perfis").select("setor,status").eq("id", user.id).single();
  if (!perfil || perfil.status !== "aprovado" || (perfil.setor !== "RH" && perfil.setor !== "ADMIN")) {
    throw new Error("Apenas RH ou ADM podem gerenciar pessoas.");
  }
  return { supabase, user };
}

export async function criarPessoa(formData: FormData) {
  const { supabase } = await exigirRhOuAdmin();
  const nome = String(formData.get("nome") || "").trim();
  const papel = String(formData.get("papel") || "EMPREITEIRO");
  const obraId = String(formData.get("obraId") || "");
  const admissao = String(formData.get("admissao") || new Date().toISOString().slice(0, 10));
  const retencaoPct = parseFloat(String(formData.get("retencao") || "0")) || 0;
  if (!nome || !obraId) return;

  const { data: pessoa, error } = await supabase
    .from("pessoas")
    .insert({ nome, papel, obra_id: obraId, admissao, status: "ATIVO" })
    .select("id")
    .single();
  if (error || !pessoa) return;

  await supabase.from("retencoes_pessoa").insert({
    pessoa_id: pessoa.id,
    mes: admissao.slice(0, 7),
    percent: retencaoPct / 100,
  });

  revalidatePath("/rh/pessoas");
}

export async function transferirObra(formData: FormData) {
  const { supabase } = await exigirRhOuAdmin();
  const pessoaId = String(formData.get("pessoaId"));
  const novaObraId = String(formData.get("obraId"));
  await supabase.from("pessoas").update({ obra_id: novaObraId }).eq("id", pessoaId);
  revalidatePath("/rh/pessoas");
}

export async function darBaixa(formData: FormData) {
  const { supabase } = await exigirRhOuAdmin();
  const pessoaId = String(formData.get("pessoaId"));
  const dataSaida = String(formData.get("saida") || new Date().toISOString().slice(0, 10));
  await supabase.from("pessoas").update({ status: "INATIVO", saida: dataSaida }).eq("id", pessoaId);
  revalidatePath("/rh/pessoas");
}

export async function reativarPessoa(formData: FormData) {
  const { supabase } = await exigirRhOuAdmin();
  const pessoaId = String(formData.get("pessoaId"));
  await supabase.from("pessoas").update({ status: "ATIVO", saida: null }).eq("id", pessoaId);
  revalidatePath("/rh/pessoas");
}
