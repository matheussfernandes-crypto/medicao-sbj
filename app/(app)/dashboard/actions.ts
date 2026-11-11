"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ehGestorAcessos } from "@/lib/acessos/modulos";
import { navItemsForSetor } from "@/components/nav-items";

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

// Atalhos da página inicial escolhidos por cada pessoa. Só aceita telas que a própria pessoa acessa.
export async function salvarAtalhos(hrefs: string[]) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada.");
  const { data: perfil } = await supabase.from("perfis").select("setor, acessos, email").eq("id", user.id).single();
  const extras = [...((perfil?.acessos as string[] | null) ?? []), ...(ehGestorAcessos(user.email) ? ["gestor_acessos"] : [])];
  const permitidos = new Set(navItemsForSetor(perfil?.setor ?? "ESTAGIARIO", extras).map((i) => i.href));
  const limpos = Array.from(new Set(hrefs.filter((h) => permitidos.has(h) && h !== "/dashboard"))).slice(0, 8);
  const { error } = await supabase.from("perfis").update({ atalhos_home: limpos }).eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}
