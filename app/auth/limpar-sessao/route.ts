import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Route Handler dedicado só pra limpar um cookie de sessão inválido/expirado.
// Server Components (como app/(app)/layout.tsx) NÃO conseguem gravar/limpar
// cookies no Next.js — só Server Actions e Route Handlers conseguem. Por isso
// o signOut() precisa acontecer aqui, e não direto no layout, senão o cookie
// nunca é realmente removido e o middleware continua vendo "logado" e manda
// de volta pro dashboard, causando ERR_TOO_MANY_REDIRECTS.
export async function GET(request: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
