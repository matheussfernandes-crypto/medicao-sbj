"use server";

import { createClient as createSupabaseJs } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export async function solicitarRecuperacaoSenha(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!email) {
    redirect(`/esqueci-senha?erro=${encodeURIComponent("Informe o seu email.")}`);
  }

  // Cliente "implícito" só para este envio: o link do e-mail volta com a sessão no próprio link
  // (#access_token=...), então funciona em QUALQUER aparelho/navegador. O cliente padrão do site
  // usa PKCE, que só aceita o link no mesmo navegador em que o pedido foi feito — se a pessoa
  // pedia no computador e abria o e-mail no celular, dava "link inválido".
  const supabase = createSupabaseJs(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );

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
