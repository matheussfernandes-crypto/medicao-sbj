import { NextRequest, NextResponse } from "next/server";
import { exigirArquitetura } from "@/lib/google-agenda-acesso";
import { carregaBase, configGoogle, reconcilia } from "@/lib/google-agenda";

// Confere a agenda Google da pessoa com a do site (ao abrir a Agenda e no "Sincronizar agora").
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const r = await exigirArquitetura();
  if ("erro" in r) return r.erro;
  if (!r.pode || !configGoogle()) return NextResponse.json({ ok: false });
  const { data: con } = await r.supabase.from("google_agenda_conexoes").select("usuario_id, token_cifrado, calendario_id, conectado_em, ultimo_sync").eq("usuario_id", r.user.id).maybeSingle();
  if (!con) return NextResponse.json({ ok: false, conectado: false });
  if (!con.calendario_id) return NextResponse.json({ ok: false, erro: "Escolha a agenda do Google primeiro." });
  const forcar = req.nextUrl.searchParams.get("agora") === "1";
  // ao abrir a Agenda: no máximo uma conferência completa a cada 2 minutos
  if (!forcar && con.ultimo_sync && Date.now() - new Date(con.ultimo_sync).getTime() < 120000) return NextResponse.json({ ok: true, pulou: true });
  try {
    const res = await reconcilia(con, await carregaBase(r.supabase));
    await r.supabase.rpc("google_agenda_registrar", { p_usuario: r.user.id, p_erro: null });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    const msg = String((e as Error).message).slice(0, 300);
    await r.supabase.rpc("google_agenda_registrar", { p_usuario: r.user.id, p_erro: msg });
    return NextResponse.json({ ok: false, erro: msg });
  }
}
