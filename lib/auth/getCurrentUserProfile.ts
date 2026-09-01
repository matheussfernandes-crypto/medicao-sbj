import { createClient } from "@/lib/supabase/server";

export type CurrentUserProfile = {
  id: string;
  nome: string | null;
  setor: string | null;
  status: string | null;
  naoLidas: number;
};

// Busca usuário + perfil + contagem de notificações em uma só chamada,
// para o layout de (app) não repetir o que cada página + o Topbar antigo
// faziam separadamente (3-4 idas ao Supabase por página).
export async function getCurrentUserProfile(): Promise<CurrentUserProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [perfilRes, notifRes] = await Promise.all([
    supabase.from("perfis").select("nome_completo, setor, status").eq("id", user.id).single(),
    supabase
      .from("notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", user.id)
      .eq("lida", false),
  ]);

  return {
    id: user.id,
    nome: perfilRes.data?.nome_completo ?? null,
    setor: perfilRes.data?.setor ?? null,
    status: perfilRes.data?.status ?? null,
    naoLidas: notifRes.count ?? 0,
  };
}
