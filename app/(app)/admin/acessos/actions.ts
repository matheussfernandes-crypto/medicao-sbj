"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ehGestorAcessos, MODULOS } from "@/lib/acessos/modulos";

// Só o gestor (Matheus) altera permissões.
async function exigirGestor() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !ehGestorAcessos(user.email)) throw new Error("Apenas o gestor pode alterar acessos.");
  return { supabase };
}

const modulosValidos = new Set(MODULOS.map((m) => m.key as string));

// Grava exatamente os módulos marcados para a pessoa (acrescenta ou retira).
export async function salvarAcessos(perfilId: string, formData: FormData) {
  const { supabase } = await exigirGestor();
  const escolhidos = Array.from(new Set(formData.getAll("modulo").map(String))).filter((m) => modulosValidos.has(m));
  const { error } = await supabase.from("perfis").update({ acessos: escolhidos }).eq("id", perfilId);
  if (error) throw new Error("Não foi possível salvar os acessos.");
  revalidatePath("/admin/acessos");
}

// Aprova ou nega um pedido de acesso. Aprovar acrescenta o módulo à pessoa.
export async function responderSolicitacao(solicitacaoId: string, aprovado: boolean) {
  const { supabase } = await exigirGestor();
  const { data: sol } = await supabase
    .from("solicitacoes_acesso")
    .select("perfil_id, modulo")
    .eq("id", solicitacaoId)
    .is("resolvido_em", null)
    .maybeSingle();
  if (!sol) return;

  if (aprovado) {
    const { data: perfil } = await supabase.from("perfis").select("acessos").eq("id", sol.perfil_id).single();
    const atuais: string[] = (perfil?.acessos as string[] | null) ?? [];
    const novos = Array.from(new Set([...atuais, sol.modulo]));
    await supabase.from("perfis").update({ acessos: novos }).eq("id", sol.perfil_id);
  }

  await supabase
    .from("solicitacoes_acesso")
    .update({ resolvido_em: new Date().toISOString(), aprovado })
    .eq("id", solicitacaoId);
  revalidatePath("/admin/acessos");
}
