import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/auth/getCurrentUserProfile";
import { createClient } from "@/lib/supabase/server";

// Notificações do usuário logado, para o pop-up do sininho (as 15 mais recentes e o total não lido).
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUsuarioAtual();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const supabase = createClient();
  const { data } = await supabase
    .from("notificacoes")
    .select("id, titulo, corpo, url, lida, criado_em")
    .eq("usuario_id", user.id)
    .order("criado_em", { ascending: false })
    .limit(15);
  const { count } = await supabase
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", user.id)
    .eq("lida", false);
  return NextResponse.json({ itens: data ?? [], naoLidas: count ?? 0 });
}
