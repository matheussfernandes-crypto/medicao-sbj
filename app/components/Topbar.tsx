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
  let naoLidas = 0;

  if (user) {
    const [perfilRes, notifRes] = await Promise.all([
      supabase.from("perfis").select("nome_completo").eq("id", user.id).single(),
      supabase
        .from("notificacoes")
        .select("id", { count: "exact", head: true })
        .eq("usuario_id", user.id)
        .eq("lida", false),
    ]);
    nome = perfilRes.data?.nome_completo ?? null;
    naoLidas = notifRes.count ?? 0;
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
        {/* Bell de notificações */}
        {user && (
          <Link
            href="/notificacoes"
            className="relative text-white hover:text-accent transition-colors"
            title={naoLidas > 0 ? `${naoLidas} notificação${naoLidas > 1 ? "ões" : ""} não lida${naoLidas > 1 ? "s" : ""}` : "Notificações"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {naoLidas > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none shadow">
                {naoLidas > 99 ? "99+" : naoLidas}
              </span>
            )}
          </Link>
        )}

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
