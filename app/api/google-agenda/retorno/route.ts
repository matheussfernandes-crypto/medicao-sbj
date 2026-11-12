import { NextRequest, NextResponse } from "next/server";
import { exigirArquitetura } from "@/lib/google-agenda-acesso";
import { agendaExiste, carregaBase, cifra, configGoogle, criaAgenda, decifra, origemDa, reconcilia, trocaCodigo } from "@/lib/google-agenda";

// O Google devolve a pessoa para cá depois que ela autoriza: guarda a autorização (cifrada),
// cria a agenda "SBJ · Pós-venda" na conta dela e copia as visitas do site.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    if (!t.escopos.includes("calendar.app.created")) return volta("sem-permissao");
    const { data: antiga } = await r.supabase.from("google_agenda_conexoes").select("token_cifrado, calendario_id, google_email").eq("usuario_id", r.user.id).maybeSingle();
    const refresh = t.refresh ?? (antiga ? decifra(antiga.token_cifrado) : "");
    if (!refresh) return volta("erro");
    // mesma conta Google de antes e a agenda ainda existe: reaproveita (não duplica a agenda)
    let cal = antiga && antiga.google_email === t.email && (await agendaExiste(t.acesso, antiga.calendario_id)) ? antiga.calendario_id : "";
    if (!cal) cal = await criaAgenda(t.acesso);
    const con = { usuario_id: r.user.id, google_email: t.email, token_cifrado: cifra(refresh), calendario_id: cal, ultimo_erro: null };
    const { error } = await r.supabase.from("google_agenda_conexoes").upsert(con);
    if (error) return volta("erro");
    try {
      await reconcilia(con, await carregaBase(r.supabase));
      await r.supabase.rpc("google_agenda_registrar", { p_usuario: r.user.id, p_erro: null });
    } catch (e) {
      await r.supabase.rpc("google_agenda_registrar", { p_usuario: r.user.id, p_erro: String((e as Error).message).slice(0, 300) });
    }
    return volta("ok");
  } catch {
    return volta("erro");
  }
}
