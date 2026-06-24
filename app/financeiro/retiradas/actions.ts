"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function exigirFinanceiroOuAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase.from("perfis").select("setor,status").eq("id", user.id).single();
  if (!perfil || perfil.status !== "aprovado" || (perfil.setor !== "FINANCEIRO" && perfil.setor !== "ADMIN")) {
    throw new Error("Apenas Financeiro ou ADM podem gerenciar retiradas de retido.");
  }
  return { supabase, user };
}

export async function salvarSaldoInicial(formData: FormData) {
  const { supabase } = await exigirFinanceiroOuAdmin();
  const pessoaId = String(formData.get("pessoaId"));
  const valor = parseFloat(String(formData.get("saldoInicial") || "0")) || 0;
  await supabase.from("pessoas").update({ saldo_inicial_retido: valor }).eq("id", pessoaId);
  revalidatePath("/financeiro/retiradas");
}

export async function lancarRetirada(formData: FormData) {
  const { supabase, user } = await exigirFinanceiroOuAdmin();
  const pessoaId = String(formData.get("pessoaId"));
  const data = String(formData.get("data") || new Date().toISOString().slice(0, 10));
  const valor = parseFloat(String(formData.get("valor") || "0")) || 0;
  const observacao = String(formData.get("observacao") || "").trim() || null;
  if (!pessoaId || valor <= 0) return;

  const { data: pessoa } = await supabase.from("pessoas").select("obra_id").eq("id", pessoaId).single();

  await supabase.from("retiradas_retido").insert({
    pessoa_id: pessoaId,
    obra_id: pessoa?.obra_id ?? null,
    valor,
    data,
    observacao,
    lancado_por: user.id,
  });

  revalidatePath("/financeiro/retiradas");
}

export async function excluirRetirada(formData: FormData) {
  const { supabase } = await exigirFinanceiroOuAdmin();
  const id = String(formData.get("id"));
  await supabase.from("retiradas_retido").delete().eq("id", id);
  revalidatePath("/financeiro/retiradas");
}
