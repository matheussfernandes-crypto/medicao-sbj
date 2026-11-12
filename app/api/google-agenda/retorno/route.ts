import { NextRequest, NextResponse } from "next/server";
import { exigirArquitetura } from "@/lib/google-agenda-acesso";
import { cifra, configGoogle, decifra, origemDa, trocaCodigo } from "@/lib/google-agenda";

// O Google devolve a pessoa para cá depois que ela autoriza: guarda a autorização (cifrada) e
// volta para a Agenda, onde ela escolhe em qual agenda do Google as visitas entram.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origem = origemDa(req);
  const volta = (motivo: string) => {
    const resp = NextResponse.redirect(`${origem}/posvenda/agenda?google=${motivo}`);
    resp.cookies.set("g_agenda_estado", "", { path: "/api/google-agenda", maxAge: 0 });
    return resp;
  };
  const p = req.nextUrl.searchParams;
  if (p.get("error")) return volta("cancelado");
  const estado = req.cookies.get("g_agenda_estado")?.value;
  if (!estado || estado !== p.get("state") || !p.get("code")) return volta("erro");
  const r = await exigirArquitetura();
  if ("erro" in r) return NextResponse.redirect(`${origem}/login`);
  if (!r.pode || !configGoogle()) return volta("sem-acesso");

  try {
    const t = await trocaCodigo(p.get("code")!, origem);
    if (!t.escopos.includes("calendar.events") || !t.escopos.includes("calendar.calendarlist")) return volta("sem-permissao");
    const { data: antiga } = await r.supabase.from("google_agenda_conexoes").select("token_cifrado, calendario_id, calendario_nome, google_email").eq("usuario_id", r.user.id).maybeSingle();
    const refresh = t.refresh ?? (antiga ? decifra(antiga.token_cifrado) : "");
    if (!refresh) return volta("erro");
    // mesma conta de antes: mantém a agenda escolhida; conta nova: pede para escolher
    const mesma = antiga && antiga.google_email === t.email;
    const { error } = await r.supabase.from("google_agenda_conexoes").upsert({
      usuario_id: r.user.id,
      google_email: t.email,
      token_cifrado: cifra(refresh),
      calendario_id: mesma ? antiga.calendario_id : "",
      calendario_nome: mesma ? antiga.calendario_nome : "",
      ultimo_erro: null,
    });
    if (error) return volta("erro");
    return volta(mesma && antiga.calendario_id ? "ok" : "escolher");
  } catch {
    return volta("erro");
  }
}
