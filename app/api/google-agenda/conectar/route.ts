import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { exigirArquitetura } from "@/lib/google-agenda-acesso";
import { ESCOPOS, configGoogle, origemDa, urlRetorno } from "@/lib/google-agenda";

// Leva para a tela de autorização do Google (a pessoa entra com a conta dela; a senha não passa pelo site).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origem = origemDa(req);
  const volta = (motivo: string) => NextResponse.redirect(`${origem}/posvenda/agenda?google=${motivo}`);
  const r = await exigirArquitetura();
  if ("erro" in r) return NextResponse.redirect(`${origem}/login`);
  if (!r.pode) return volta("sem-acesso");
  const c = configGoogle();
  if (!c) return volta("nao-configurado");
  const estado = randomBytes(16).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: urlRetorno(origem),
    response_type: "code",
    scope: ESCOPOS,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: estado,
  }).toString();
  const resp = NextResponse.redirect(url.toString());
  resp.cookies.set("g_agenda_estado", estado, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/google-agenda", maxAge: 600 });
  return resp;
}
