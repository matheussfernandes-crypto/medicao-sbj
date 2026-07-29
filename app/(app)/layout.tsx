import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUserProfile";
import AppShell from "@/components/AppShell";

// Shell único para todas as páginas autenticadas: busca o perfil UMA vez aqui
// (em vez de cada página + o Topbar antigo repetirem a mesma consulta) e
// garante a barra lateral em todo lugar, sem precisar copiar <Topbar/> em
// cada página.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUserProfile();

  if (!profile) redirect("/login");
  if (profile.status !== "aprovado") redirect("/aguardando-aprovacao");

  return (
    <AppShell setor={profile.setor} nome={profile.nome} naoLidas={profile.naoLidas}>
      {children}
    </AppShell>
  );
}
