"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function salvarPerfil(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const nome = String(formData.get("nome") || "").trim();
  const novaSenha = String(formData.get("novaSenha") || "");
  const confirmarSenha = String(formData.get("confirmarSenha") || "");

  if (!nome) {
    redirect(`/perfil?erro=${encodeURIComponent("Informe seu nome.")}`);
  }

  // Senha é opcional aqui: só troca se o usuário preencher os dois campos.
  if (novaSenha || confirmarSenha) {
    if (novaSenha.length < 6) {
      redirect(`/perfil?erro=${encodeURIComponent("A nova senha precisa ter pelo menos 6 caracteres.")}`);
    }
    if (novaSenha !== confirmarSenha) {
      redirect(`/perfil?erro=${encodeURIComponent("As senhas não coincidem.")}`);
    }
  }

  const { error: erroNome } = await supabase
    .from("perfis")
    .update({ nome_completo: nome })
    .eq("id", user!.id);

  if (erroNome) {
    redirect(`/perfil?erro=${encodeURIComponent("Não foi possível salvar o nome: " + erroNome.message)}`);
  }

  if (novaSenha) {
    const { error: erroSenha } = await supabase.auth.updateUser({ password: novaSenha });
    if (erroSenha) {
      redirect(`/perfil?erro=${encodeURIComponent("Nome salvo, mas a senha não foi alterada: " + erroSenha.message)}`);
    }
  }

  revalidatePath("/perfil");
  redirect(
    `/perfil?sucesso=${encodeURIComponent(
      novaSenha ? "Dados e senha atualizados com sucesso." : "Dados atualizados com sucesso."
    )}`
  );
}
