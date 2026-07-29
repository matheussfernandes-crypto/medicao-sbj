import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUserProfile";
import { createClient } from "@/lib/supabase/server";
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
    // expirada/inválida), é preciso limpar o cookie aqui antes de redirecionar
    // — senão o middleware manda de volta pro dashboard e isso vira um loop
    // infinito de redirecionamento entre /login e /dashboard.
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }
  if (profile.status !== "aprovado") redirect("/aguardando-aprovacao");

  return (
    <AppShell setor={profile.setor} nome={profile.nome} naoLidas={profile.naoLidas}>
      {children}
    </AppShell>
  );
}
