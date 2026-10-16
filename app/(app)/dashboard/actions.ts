"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Escolhe quais obras aparecem no carrossel do painel (só ADMIN).
export async function definirObraNoPainel(obraId: string, exibir: boolean) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");
  const { data: perfil } = await supabase.from("perfis").select("setor, status").eq("id", user.id).single();
  if (perfil?.setor !== "ADMIN" || perfil?.status !== "aprovado") throw new Error("Só o administrador escolhe as obras do painel.");
  const { error } = await supabase.from("obras").update({ exibir_no_painel: exibir }).eq("id", obraId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}
