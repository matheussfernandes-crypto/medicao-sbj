"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");
  // só um destino é aceito: o módulo Pós-obra aberto pelo ícone "sem internet"
  const volta = formData.get("volta") === "pos-obra";

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    redirect(`/login?erro=${encodeURIComponent("Email ou senha incorretos.")}${volta ? "&volta=pos-obra" : ""}`);
  }

  redirect(volta ? "/pos-obra/?app=1" : "/dashboard");
}
