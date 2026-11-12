import { NextResponse } from "next/server";
import { exigirArquitetura } from "@/lib/google-agenda-acesso";
import { configGoogle, decifra, revoga } from "@/lib/google-agenda";

// Desliga a ligação: o site perde o acesso na hora. A agenda "SBJ · Pós-venda" continua no Google
// da pessoa (ela pode apagar por lá, se quiser); nada do site é apagado.
export const dynamic = "force-dynamic";

export async function POST() {
  const r = await exigirArquitetura();
  if ("erro" in r) return r.erro;
  const { data: con } = await r.supabase.from("google_agenda_conexoes").select("token_cifrado").eq("usuario_id", r.user.id).maybeSingle();
  if (con && configGoogle()) {
    try {
      await revoga(decifra(con.token_cifrado));
    } catch {}
  }
  await r.supabase.from("google_agenda_conexoes").delete().eq("usuario_id", r.user.id);
  return NextResponse.json({ ok: true });
}
