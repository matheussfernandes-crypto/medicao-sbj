import { redirect } from "next/navigation";
import { DraftingCompass } from "lucide-react";
import { getUsuarioAtual, perfilDaRequisicao } from "@/lib/auth/getCurrentUserProfile";

// Obras › Arquitetura. Por enquanto só a página de entrada; os itens desta área entram depois.
export default async function ArquiteturaPage() {
  const user = await getUsuarioAtual();
  if (!user) redirect("/login");
  const { data: perfil } = await perfilDaRequisicao(user.id);
  if (!["ADMIN", "ARQUITETO"].includes(perfil?.setor ?? "")) redirect("/dashboard");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-primaryDark">Arquitetura</h1>
        <p className="text-sm text-ink-500">Área da arquitetura das obras.</p>
      </div>
      <div className="card flex items-center gap-3 text-sm text-ink-500">
        <DraftingCompass className="h-5 w-5 shrink-0" />
        Os itens da Arquitetura vão aparecer aqui.
      </div>
    </div>
  );
}
