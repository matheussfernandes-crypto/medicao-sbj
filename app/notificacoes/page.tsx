import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Topbar from "../components/Topbar";
import { marcarComoLida, marcarTodasComoLidas } from "./actions";

export default async function NotificacoesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user.id).single();

  const { data: notificacoes } = await supabase
    .from("notificacoes")
    .select("id, titulo, corpo, url, lida, criado_em")
    .eq("usuario_id", user.id)
    .order("criado_em", { ascending: false })
    .limit(100);

  const naoLidas = (notificacoes ?? []).filter((n) => !n.lida).length;

  function formatarData(iso: string) {
    const d = new Date(iso);
    const agora = new Date();
    const diff = agora.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const dias = Math.floor(hrs / 24);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins} min atrás`;
    if (hrs < 24) return `${hrs}h atrás`;
    if (dias === 1) return "ontem";
    if (dias < 7) return `${dias} dias atrás`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  return (
    <main className="min-h-screen">
      <Topbar setor={perfil?.setor} />
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-primaryDark">
            🔔 Notificações
            {naoLidas > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                {naoLidas} nova{naoLidas > 1 ? "s" : ""}
              </span>
            )}
          </h1>
          {naoLidas > 0 && (
            <form action={marcarTodasComoLidas}>
              <button type="submit" className="text-sm text-primaryDark underline">
                Marcar todas como lidas
              </button>
            </form>
          )}
        </div>

        {(!notificacoes || notificacoes.length === 0) && (
          <div className="card text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🔕</p>
            <p className="text-sm">Nenhuma notificação ainda.</p>
            <p className="text-xs mt-1">As notificações do sistema aparecerão aqui.</p>
          </div>
        )}

        <div className="space-y-2">
          {(notificacoes ?? []).map((n) => (
            <div
              key={n.id}
              className={`card flex gap-3 ${
                !n.lida ? "border-l-4 border-l-primary bg-primary/5" : "opacity-70"
              }`}
            >
              {/* Ícone */}
              <div className="flex-shrink-0 mt-0.5">
                <span className="text-xl">
                  {!n.lida ? "🔔" : "🔕"}
                </span>
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-medium ${!n.lida ? "text-primaryDark" : "text-gray-600"}`}>
                    {n.titulo}
                  </p>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    {formatarData(n.criado_em)}
                  </span>
                </div>
                {n.corpo && (
                  <p className="text-sm text-gray-600 mt-0.5 break-words">{n.corpo}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  {n.url && (
                    <Link
                      href={n.url}
                      className="text-xs text-primary font-medium underline"
                    >
                      Ver →
                    </Link>
                  )}
                  {!n.lida && (
                    <form action={marcarComoLida} className="inline">
                      <input type="hidden" name="id" value={n.id} />
                      <button type="submit" className="text-xs text-gray-400 hover:text-gray-600 underline">
                        Marcar como lida
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center pt-2">
          <Link href="/dashboard" className="text-sm text-gray-400 underline">
            ← Voltar ao painel
          </Link>
        </div>
      </div>
    </main>
  );
}
