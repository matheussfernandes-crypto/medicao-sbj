import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUserProfile = {
  id: string;
  nome: string | null;
  setor: string | null;
  status: string | null;
  naoLidas: number;
  contratosPendentes: number;
  acessoAndamentoNovo: boolean; // permissão específica (ex.: estagiário que também configura a tela nova do Andamento)
};

/**
 * Usuário autenticado da requisição atual. Envolvido em cache() do React para
 * que layout + página + actions da MESMA requisição façam uma única chamada
 * ao Supabase Auth (antes cada um chamava getUser() de novo).
 */
export const getUsuarioAtual = cache(async () => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Perfil do usuário, também deduplicado por requisição. */
export const getPerfilAtual = cache(async (userId: string) => {
  const supabase = createClient();
  const { data } = await supabase
    .from("perfis")
    .select("nome_completo, setor, status, acesso_andamento_novo")
    .eq("id", userId)
    .single();
  return data;
});

// Busca usuário + perfil + contagens em paralelo, uma vez por requisição.
export const getCurrentUserProfile = cache(async (): Promise<CurrentUserProfile | null> => {
  const user = await getUsuarioAtual();
  if (!user) return null;
  const supabase = createClient();

  const [perfil, notifRes, lancRes, solRes] = await Promise.all([
    getPerfilAtual(user.id),
    supabase
      .from("notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", user.id)
      .eq("lida", false),
    supabase.from("contrato_lancamentos").select("id", { count: "exact", head: true }).eq("status", "PENDENTE"),
    supabase.from("contrato_solicitacoes").select("id", { count: "exact", head: true }).eq("status", "AGUARDANDO"),
  ]);

  return {
    id: user.id,
    nome: perfil?.nome_completo ?? null,
    setor: perfil?.setor ?? null,
    status: perfil?.status ?? null,
    acessoAndamentoNovo: perfil?.acesso_andamento_novo === true,
    naoLidas: notifRes.count ?? 0,
    contratosPendentes: perfil?.setor === "ADMIN" ? (lancRes.count ?? 0) + (solRes.count ?? 0) : 0,
  };
});

/** Mesmo formato de `supabase.from("perfis").select(...).single()`, mas reaproveitando o cache da requisição. */
export async function perfilDaRequisicao(userId: string) {
  return { data: await getPerfilAtual(userId) };
}
