import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Protege as rotas: sem sessão -> /login; perfil pendente/rejeitado -> /aguardando-aprovacao.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const rotasPublicas = ["/login", "/cadastro", "/esqueci-senha", "/redefinir-senha"];
  const isPublica = rotasPublicas.some((r) => path.startsWith(r));

  if (!user && !isPublica) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && !isPublica && path !== "/aguardando-aprovacao") {
    const { data: perfil } = await supabase
      .from("perfis")
      .select("status")
      .eq("id", user.id)
      .single();

    if (!perfil || perfil.status !== "aprovado") {
      return NextResponse.redirect(new URL("/aguardando-aprovacao", request.url));
    }
  }

  if (user && isPublica) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
