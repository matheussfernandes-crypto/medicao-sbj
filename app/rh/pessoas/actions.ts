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

async function exigirAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase.from("perfis").select("setor,status").eq("id", user.id).single();
  if (!perfil || perfil.status !== "aprovado" || perfil.setor !== "ADMIN") {
    throw new Error("Apenas ADM pode excluir cadastros de pessoas.");
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

  // Bloqueia nome duplicado (case-insensitive): evita cadastrar a mesma pessoa
  // duas vezes por engano, seja ela ativa ou já inativa.
  const { data: existentes } = await supabase
    .from("pessoas")
    .select("status, obras(nome)")
    .ilike("nome", nome)
    .limit(1);

  if (existentes && existentes.length > 0) {
    const existente = existentes[0] as any;
    const obraTxt = existente.obras?.nome ?? "—";
    const statusTxt = existente.status === "ATIVO" ? "ativo" : "inativo";
    redirect(
      `/rh/pessoas?erro=${encodeURIComponent(
        `Já existe uma pessoa cadastrada com o nome "${nome}" (obra: ${obraTxt}, status: ${statusTxt}). Verifique antes de cadastrar de novo.`
      )}`
    );
  }

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

export async function excluirPessoa(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const pessoaId = String(formData.get("pessoaId"));

  const { data: pessoa } = await supabase.from("pessoas").select("status").eq("id", pessoaId).single();
  if (!pessoa || pessoa.status !== "INATIVO") {
    redirect(
      `/rh/pessoas?erro=${encodeURIComponent("Só é possível excluir pessoas que já foram desativadas. Dê baixa antes de excluir.")}`
    );
  }

  const { error } = await supabase.from("pessoas").delete().eq("id", pessoaId);
  if (error) {
    redirect(
      `/rh/pessoas?erro=${encodeURIComponent(
        "Não foi possível excluir: essa pessoa já tem lançamentos, retiradas ou outro histórico vinculado. Mantenha-a inativa para preservar o histórico."
      )}`
    );
  }

  revalidatePath("/rh/pessoas");
  redirect(`/rh/pessoas?sucesso=${encodeURIComponent("Cadastro excluído com sucesso.")}`);
}
