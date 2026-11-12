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

// Marca como lida sem recarregar a página (o pop-up já atualizou a tela antes).
export async function POST(req: Request) {
  const user = await getUsuarioAtual();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const supabase = createClient();
  const corpo = (await req.json().catch(() => ({}))) as { id?: string; todas?: boolean };
  let q = supabase.from("notificacoes").update({ lida: true }).eq("usuario_id", user.id);
  if (corpo.todas) q = q.eq("lida", false);
  else if (corpo.id) q = q.eq("id", corpo.id);
  else return NextResponse.json({ error: "Nada para marcar" }, { status: 400 });
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
