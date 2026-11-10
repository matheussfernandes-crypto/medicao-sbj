import { createClient } from "@/lib/supabase/server";
import { ITENS, MODULOS, itensLiberados, rotuloItem } from "@/lib/acessos/modulos";
import { salvarAcessos, responderSolicitacao } from "./actions";

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
        {(pessoas ?? []).map((p) => {
          const liberados = itensLiberados((p.acessos as string[] | null) ?? []);
          return (
            <form key={p.id} action={salvarAcessos.bind(null, p.id)} className="card space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink-900">{p.nome_completo ?? p.email}</p>
                  <p className="text-xs text-ink-500">{SETOR_LABEL[p.setor ?? ""] ?? p.setor}</p>
                </div>
                <button className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-primaryDark transition-colors duration-200">Salvar</button>
              </div>
              {MODULOS.map((mod) => (
                <div key={mod.key} className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{mod.label}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {ITENS.filter((i) => i.modulo === mod.key).map((i) => (
                      <label key={i.key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-ink-700 cursor-pointer hover:bg-surface-subtle transition-colors duration-200">
                        <input type="checkbox" name="modulo" value={i.key} defaultChecked={liberados.has(i.key)} className="accent-[#00778A]" />
                        {i.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </form>
          );
        })}
      </section>
    </div>
  );
}
