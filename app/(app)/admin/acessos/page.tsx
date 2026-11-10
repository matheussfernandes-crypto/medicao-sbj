import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth/getCurrentUserProfile";
import { ehGestorAcessos } from "@/lib/acessos/modulos";
import PainelAcessos from "./PainelAcessos";

export default async function AcessosPage() {
  const user = await getUsuarioAtual();
  // Só o gestor vê esta tela
  if (!user || !ehGestorAcessos(user.email)) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-primaryDark">Acessos dos usuários</h1>
      <PainelAcessos />
    </div>
  );
}
