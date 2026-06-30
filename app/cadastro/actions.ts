"use server";

import { createClient } from "@/lib/supabase/server";
import { notificarAdmins } from "@/lib/push/send";
import { redirect } from "next/navigation";

const SETORES_VALIDOS = ["ESTAGIARIO", "ADMIN", "RH", "FINANCEIRO"];

export async function solicitarCadastro(formData: FormData) {
  const nomeCompleto = String(formData.get("nomeCompleto") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");
  const setor = String(formData.get("setor") || "");

  if (!nomeCompleto || !email || !senha || !SETORES_VALIDOS.includes(setor)) {
    redirect(`/cadastro?erro=${encodeURIComponent("Preencha todos os campos.")}`);
  }

  const supabase = createClient();

  // Cria o usuário no Supabase Auth. O gatilho `handle_new_user` (ver supabase/schema.sql)
  // cria automaticamente a linha correspondente em `perfis` com status = 'pendente'.
  const { error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: { nome_completo: nomeCompleto, setor },
    },
  });

  if (error) {
    redirect(`/cadastro?erro=${encodeURIComponent(error.message)}`);
  }

  notificarAdmins({ title: "Novo usuário aguardando aprovação", body: `${nomeCompleto} (${setor}) solicitou acesso.`, url: "/admin/aprovacoes" }).catch(() => null);
  redirect("/aguardando-aprovacao?novo=1");
}
