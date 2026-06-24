"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

export async function aprovarConta(perfilId: string) {
  const { supabase, user } = await exigirAdmin();
  await supabase
    .from("perfis")
    .update({ status: "aprovado", decidido_por: user.id, decidido_em: new Date().toISOString() })
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
