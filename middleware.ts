import { NextResponse, type NextRequest } from "next/server";

// Middleware 100% síncrono — zero chamadas de rede, zero timeout.
// Segurança real fica em cada página via supabase.auth.getUser() no servidor.
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Módulo Pós-obra (site estático em public/pos-obra). Ele usa caminhos relativos (css/, js/...),
  // então precisa abrir com a barra no fim: /pos-obra/ (o next.config desliga o redirecionamento
  // automático de barra; aqui ele é refeito para o resto do site, igual era antes).
  if (path === "/pos-obra") {
    return NextResponse.redirect(new URL("/pos-obra/" + request.nextUrl.search, request.url), 308);
  }
  if (path.length > 1 && path.endsWith("/") && !path.startsWith("/pos-obra/")) {
    const url = new URL(request.url);
    url.pathname = path.replace(/\/+$/, "") || "/";
    return NextResponse.redirect(url, 308);
  }

  const rotasPublicas = ["/login", "/cadastro", "/esqueci-senha", "/redefinir-senha", "/privacidade"];
  const isPublica = rotasPublicas.some((r) => path.startsWith(r));

  // Supabase armazena a sessão neste cookie (leitura local, sem rede)
  const projectRef = "orezzjumiofwutbqzeir";
  const cookieSession =
    request.cookies.get(`sb-${projectRef}-auth-token`) ??
    request.cookies.get(`sb-${projectRef}-auth-token.0`);
  const logado = !!cookieSession?.value;

  if (!logado && !isPublica) {
    // API do Pós-obra: responde 401 em vez de mandar a página de login (o módulo entende e espera)
    if (path.startsWith("/api/pos-obra/")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    // arquivos do módulo pedidos pelo service worker: 401, para ele não guardar a página de login no lugar deles
    if (path.startsWith("/pos-obra/") && path !== "/pos-obra/") {
      return new NextResponse("Não autenticado", { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (logado && isPublica && path !== "/privacidade") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (path === "/pos-obra/") {
    return NextResponse.rewrite(new URL("/pos-obra/index.html", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon-|apple-touch-icon|manifest|sw\\.js|logo-|intro-sbj/).*)",
  ],
};
