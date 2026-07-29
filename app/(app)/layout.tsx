import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUserProfile";
import AppShell from "@/components/AppShell";

// Shell único para todas as páginas autenticadas: busca o perfil UMA vez aqui
// (em vez de cada página + o Topbar antigo repetirem a mesma consulta) e
// garante a barra lateral em todo lugar, sem precisar copiar <Topbar/> em
// cada página.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    // O middleware só checa se existe cookie de sessão, não se ela ainda é
    // válida. Se getUser() falhou mesmo com o cookie presente (sessão
    // expirada/inválida), é preciso limpar o cookie de verdade antes de ir
    // pro /login — mas Server Components não conseguem gravar/limpar cookies
    // no Next.js, só Server Actions e Route Handlers. Por isso passamos por
    // /auth/limpar-sessao (Route Handler) em vez de redirecionar direto —
    // senão o middleware continua vendo "logado" e manda de volta pro
    // dashboard, causando ERR_TOO_MANY_REDIRECTS.
    redirect("/auth/limpar-sessao");
  }
  if (profile.status !== "aprovado") redirect("/aguardando-aprovacao");

  return (
    <AppShell setor={profile.setor} nome={profile.nome} naoLidas={profile.naoLidas}>
      {children}
    </AppShell>
  );
}
