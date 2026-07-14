import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const path = request.nextUrl.pathname;
  const rotasPublicas = ["/login", "/cadastro", "/esqueci-senha", "/redefinir-senha"];
  const isPublica = rotasPublicas.some((r) => path.startsWith(r));

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

  // getSession() lê o JWT do cookie — sem chamada de rede, sem timeout
  const { data: { session } } = await supabase.auth.getSession();
  const logado = !!session?.user;

  if (!logado && !isPublica) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (logado && isPublica) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon-|apple-touch-icon|manifest|sw\\.js).*)"],
};
