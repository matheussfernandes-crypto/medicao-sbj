import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual, perfilDaRequisicao } from "@/lib/auth/getCurrentUserProfile";

/** Páginas de Arquitetura: só ADMIN e ARQUITETO (os outros voltam para o painel). */
export async function exigirArquiteturaPagina() {
  const user = await getUsuarioAtual();
  if (!user) redirect("/login");
  const { data: perfil } = await perfilDaRequisicao(user.id);
  if (!["ADMIN", "ARQUITETO"].includes(perfil?.setor ?? "")) redirect("/dashboard");
  return createClient();
}
