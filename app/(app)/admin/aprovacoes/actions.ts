"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { notificarUsuarios } from "@/lib/push/send";

async function exigirAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");
  const { data: perfil } = await supabase.from("perfis").select("setor, status").eq("id", user.id).single();
  if (!perfil || perfil.setor !== "ADMIN" || perfil.status !== "aprovado") {
    throw new Error("Apenas o ADM pode aprovar ou rejeitar cadastros.");
  }
  return { supabase, user };
}

export async function aprovarConta(perfilId: string, formData?: FormData) {
  const { supabase, user } = await exigirAdmin();
  // módulos marcados na hora da aprovação (podem ser alterados depois em Administração → Acessos)
  const modulos = formData ? Array.from(new Set(formData.getAll("modulo").map(String))) : [];
  await supabase
    .from("perfis")
    .update({ status: "aprovado", decidido_por: user.id, decidido_em: new Date().toISOString(), acessos: modulos })
    .eq("id", perfilId);
  revalidatePath("/admin/aprovacoes");
}

export async function rejeitarConta(perfilId: string) {
  const { supabase, user } = await exigirAdmin();
  await supabase
    .from("perfis")
    .update({ status: "rejeitado", decidido_por: user.id, decidido_em: new Date().toISOString() })
    .eq("id", perfilId);
  revalidatePath("/admin/aprovacoes");
}

// Usado quando a pessoa sai da empresa: bloqueia o login dela sem apagar o
// histórico (lançamentos, fechamentos etc. continuam vinculados ao perfil).
export async function desativarConta(perfilId: string) {
  const { supabase, user } = await exigirAdmin();
  if (perfilId === user.id) {
    throw new Error("Você não pode desativar o seu próprio acesso.");
  }
  await supabase
    .from("perfis")
    .update({ status: "desativado", decidido_por: user.id, decidido_em: new Date().toISOString() })
    .eq("id", perfilId);
  revalidatePath("/admin/aprovacoes");
}

const SETORES_VALIDOS = ["ESTAGIARIO", "ADMIN", "ARQUITETO", "ENGENHEIRO", "MESTRE_GERAL", "RH", "FINANCEIRO"];

// Troca o setor (cargo) de uma pessoa. Não permite tirar o próprio acesso de ADM.
export async function alterarSetor(perfilId: string, formData: FormData) {
  const { supabase, user } = await exigirAdmin();
  const setor = String(formData.get("setor") || "");
  if (!SETORES_VALIDOS.includes(setor)) throw new Error("Setor inválido.");
  if (perfilId === user.id && setor !== "ADMIN") {
    throw new Error("Você não pode tirar o seu próprio perfil de ADM.");
  }
  await supabase.from("perfis").update({ setor }).eq("id", perfilId);
  revalidatePath("/admin/aprovacoes");
}

// Exclui a conta sem apagar o histórico: o perfil continua existindo (lançamentos, fechamentos e
// vistorias ficam ligados a ele), mas a pessoa perde o acesso e some das listas.
export async function excluirConta(perfilId: string) {
  const { supabase, user } = await exigirAdmin();
  if (perfilId === user.id) throw new Error("Você não pode excluir o seu próprio acesso.");
  await supabase
    .from("perfis")
    .update({ status: "excluido", decidido_por: user.id, decidido_em: new Date().toISOString() })
    .eq("id", perfilId);
  revalidatePath("/admin/aprovacoes");
}

export async function reativarConta(perfilId: string) {
  const { supabase, user } = await exigirAdmin();
  await supabase
    .from("perfis")
    .update({ status: "aprovado", decidido_por: user.id, decidido_em: new Date().toISOString() })
    .eq("id", perfilId);
  revalidatePath("/admin/aprovacoes");
}

export async function enviarNotificacaoAvulsa(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const titulo = String(formData.get("titulo") || "").trim();
  const mensagem = String(formData.get("mensagem") || "").trim();
  const idsRaw = formData.getAll("destinatarios");
  const ids = idsRaw.map(String).filter(Boolean);

  if (!titulo || !mensagem || ids.length === 0) {
    throw new Error("Preencha título, mensagem e selecione ao menos um destinatário.");
  }

  try {
    await notificarUsuarios(ids, { title: titulo, body: mensagem, url: "/dashboard" });
  } catch {
    // silencioso — push não deve quebrar a action
  }
}
