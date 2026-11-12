import { exigirPosvenda } from "@/lib/posvenda/server";
import { ehGestorAcessos } from "@/lib/acessos/modulos";

// Quem pode ligar a Agenda do Pós-venda ao Google: setor de arquitetura (e o gestor, para testar).
export async function exigirArquitetura() {
  const r = await exigirPosvenda();
  if ("erro" in r && r.erro) return { erro: r.erro } as const;
  const { supabase, user } = r as { supabase: typeof r.supabase & {}; user: NonNullable<typeof r.user> };
  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user.id).single();
  const pode = perfil?.setor === "ARQUITETO" || ehGestorAcessos(user.email);
  return { supabase, user, pode } as const;
}
