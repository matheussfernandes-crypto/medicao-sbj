import { createClient } from "@/lib/supabase/server";
import { ITENS, MODULOS, ehGestorAcessos, itensLiberados, rotuloItem } from "@/lib/acessos/modulos";
import { responderSolicitacao } from "./actions";
import ListaAcessos from "./ListaAcessos";

const SETOR_LABEL: Record<string, string> = {
  ESTAGIARIO: "Estagiário",
  ADMIN: "Engenheiro / ADM",
  ARQUITETO: "Arquiteto",
  ENGENHEIRO: "Engenheiro",
  MESTRE_GERAL: "Mestre Geral",
  RH: "RH",
  FINANCEIRO: "Financeiro",
};

// Painel de acessos: pedidos pendentes + módulos marcados por pessoa. Só deve ser exibido ao gestor.
export default async function PainelAcessos() {
  const supabase = createClient();
  const [{ data: pessoas }, { data: pedidos }] = await Promise.all([
    supabase.from("perfis").select("id, nome_completo, email, setor, acessos").eq("status", "aprovado").order("nome_completo"),
    supabase.from("solicitacoes_acesso").select("id, perfil_id, modulo, criado_em").is("resolvido_em", null).order("criado_em", { ascending: true }),
  ]);

  const nomePorId = new Map((pessoas ?? []).map((p) => [p.id, p.nome_completo ?? p.email ?? "Sem nome"]));

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-primaryDark">Pedidos de acesso</h2>
        {(pedidos ?? []).length === 0 && <p className="text-sm text-ink-500">Nenhum pedido em aberto.</p>}
        {(pedidos ?? []).map((p) => {
          const rotulo = rotuloItem(p.modulo);
          return (
            <div key={p.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-ink-900">{nomePorId.get(p.perfil_id) ?? "Usuário"}</p>
                <p className="text-sm text-ink-500">pede acesso a <b className="text-primaryDark">{rotulo}</b></p>
              </div>
              <div className="flex gap-2">
                <form action={responderSolicitacao.bind(null, p.id, true)}>
                  <button className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-primaryDark transition-colors duration-200">Liberar</button>
                </form>
                <form action={responderSolicitacao.bind(null, p.id, false)}>
                  <button className="border border-border rounded-lg px-4 py-2 text-sm text-ink-700 hover:bg-surface-subtle transition-colors duration-200">Negar</button>
                </form>
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-primaryDark">Acessos por usuário</h2>
        <p className="text-sm text-ink-500">Marque os módulos que cada pessoa pode usar. Você pode acrescentar ou retirar a qualquer momento.</p>
        <ListaAcessos pessoas={pessoas ?? []} />
      </section>
    </div>
  );
}
