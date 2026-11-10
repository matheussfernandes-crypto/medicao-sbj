"use server";

import { createClient } from "@/lib/supabase/server";
import { ITENS } from "@/lib/acessos/modulos";

// Pessoa pede acesso a um módulo. Fica registrado para o gestor aprovar em Administração → Acessos.
export async function solicitarAcesso(modulo: string) {
  if (!ITENS.some((i) => i.key === modulo)) throw new Error("Módulo desconhecido.");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data: pendente } = await supabase
    .from("solicitacoes_acesso")
    .select("id")
    .eq("perfil_id", user.id)
    .eq("modulo", modulo)
    .is("resolvido_em", null)
    .maybeSingle();
  if (pendente) return { ok: true, jaExistia: true };

  const { error } = await supabase.from("solicitacoes_acesso").insert({ perfil_id: user.id, modulo });
  if (error) throw new Error("Não foi possível enviar o pedido.");
  return { ok: true, jaExistia: false };
}
