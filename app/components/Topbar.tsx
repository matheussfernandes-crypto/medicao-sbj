import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { sair } from "../auth-actions";

const SETOR_LABEL: Record<string, string> = {
  ESTAGIARIO: "Estagiário",
  ADMIN: "Engenheiro / ADM",
  RH: "RH",
  FINANCEIRO: "Financeiro",
};

export default async function Topbar({
  setor,
  voltar = true,
}: {
  setor?: string | null;
  voltar?: boolean;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let nome: string | null = null;
  if (user) {
    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome_completo")
      .eq("id", user.id)
      .single();
    nome = perfil?.nome_completo ?? null;
  }

  return (
    <div className="bg-primaryDark text-white px-6 py-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <img src="/logo-topbar.png" alt="SBJ" className="h-10 w-auto" />
        <div className="flex flex-col">
          <span className="font-semibold leading-tight">
            Medição de Empreiteiros{setor ? ` — ${SETOR_LABEL[setor] ?? setor}` : ""}
          </span>
          {voltar && (
            <Link href="/dashboard" className="text-xs text-accent underline">
              Voltar ao painel
            </Link>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm">
        {nome && (
          <Link href="/perfil" className="underline hover:text-accent" title="Editar meu cadastro">
            {nome}
          </Link>
        )}
        <form action={sair}>
          <button type="submit" className="underline">Sair</button>
        </form>
      </div>
    </div>
  );
}
