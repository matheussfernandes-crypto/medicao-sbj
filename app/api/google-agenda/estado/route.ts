import { NextResponse } from "next/server";
import { exigirArquitetura } from "@/lib/google-agenda-acesso";
import { configGoogle } from "@/lib/google-agenda";

// Situação da ligação com o Google Agenda para a pessoa logada (o botão da Agenda usa isso).
export const dynamic = "force-dynamic";

export async function GET() {
  const r = await exigirArquitetura();
  if ("erro" in r) return r.erro;
  if (!r.pode) return NextResponse.json({ mostrar: false });
  const { data } = await r.supabase.from("google_agenda_conexoes").select("google_email, calendario_id, calendario_nome, ultimo_sync, ultimo_erro").eq("usuario_id", r.user.id).maybeSingle();
  return NextResponse.json({
    mostrar: true,
    configurado: !!configGoogle(),
    conectado: !!data,
    email: data?.google_email ?? "",
    escolher: !!data && !data.calendario_id,
    agenda: data?.calendario_nome ?? "",
    ultimoSync: data?.ultimo_sync ?? null,
    erro: data?.ultimo_erro ?? null,
  });
}
