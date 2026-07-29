import { NextResponse, type NextRequest } from "next/server";

// Middleware 100% síncrono — zero chamadas de rede, zero timeout.
// Segurança real fica em cada página via supabase.auth.getUser() no servidor.
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const rotasPublicas = ["/login", "/cadastro", "/esqueci-senha", "/redefinir-senha"];
  const isPublica = rotasPublicas.some((r) => path.startsWith(r));

  // Supabase armazena a sessão neste cookie (leitura local, sem rede)
  const projectRef = "orezzjumiofwutbqzeir";
  const cookieSession =
    request.cookies.get(`sb-${projectRef}-auth-token`) ??
    request.cookies.get(`sb-${projectRef}-auth-token.0`);
  const logado = !!cookieSession?.value;

  if (!logado && !isPublica) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (logado && isPublica) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon-|apple-touch-icon|manifest|sw\\.js|logo-).*)",
  ],
};
