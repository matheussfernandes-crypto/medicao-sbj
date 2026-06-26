"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export async function solicitarRecuperacaoSenha(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!email) {
    redirect(`/esqueci-senha?erro=${encodeURIComponent("Informe o seu email.")}`);
  }

  const supabase = createClient();

  // Descobre a origem (https://medicao-sbj.vercel.app ou localhost) para montar o link de volta.
  const headerList = headers();
  const origemForwardedHost = headerList.get("x-forwarded-host");
  const origemHost = headerList.get("host");
  const protocolo = headerList.get("x-forwarded-proto") ?? "https";
  const origem = origemForwardedHost
    ? `${protocolo}://${origemForwardedHost}`
    : `${protocolo}://${origemHost}`;

  // Por segurança, não revelamos se o email existe ou não — sempre mostramos a mesma mensagem de sucesso.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origem}/redefinir-senha`,
  });

  redirect(
    `/esqueci-senha?sucesso=${encodeURIComponent(
      "Se este email tiver um cadastro aprovado, enviamos um link para redefinir a senha."
    )}`
  );
}
