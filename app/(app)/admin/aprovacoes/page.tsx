import { getUsuarioAtual, perfilDaRequisicao } from "@/lib/auth/getCurrentUserProfile";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { aprovarConta, rejeitarConta, desativarConta, reativarConta, alterarSetor } from "./actions";
import NotificacaoAvulsaPanel from "./NotificacaoAvulsaPanel";
import { MODULOS, ehGestorAcessos } from "@/lib/acessos/modulos";
import PainelAcessos from "../acessos/PainelAcessos";

const MODULOS_APROVACAO = MODULOS;

const SETOR_LABEL: Record<string, string> = {
  ESTAGIARIO: "Estagiário",
  ADMIN: "Engenheiro / ADM",
  ARQUITETO: "Arquiteto",
  ENGENHEIRO: "Engenheiro",
  MESTRE_GERAL: "Mestre Geral",
  RH: "RH",
  FINANCEIRO: "Financeiro",
};

function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default async function AprovacoesPage() {
  const supabase = createClient();

  const user = await getUsuarioAtual();
  const { data: meuPerfil } = await perfilDaRequisicao(user!.id);
  if (meuPerfil?.setor !== "ADMIN") {
    redirect("/dashboard");
  }
  const meuId = user!.id;
  const ehGestor = ehGestorAcessos(user!.email);

  const { data: pendentes } = await supabase
    .from("perfis")
    .select("id, nome_completo, email, setor, criado_em")
    .eq("status", "pendente")
    .order("criado_em", { ascending: true });

  const { data: decididas } = await supabase
    .from("perfis")
    .select("id, nome_completo, email, setor, status, decidido_em")
    .neq("status", "pendente")
    .order("decidido_em", { ascending: false })
    .limit(50);

  const { data: usuariosAprovados } = await supabase
    .from("perfis")
    .select("id, nome_completo, setor")
    .eq("status", "aprovado")
    .order("nome_completo");

  return (
    <>
      <h1 className="text-xl font-semibold text-primaryDark">Cadastros pendentes de aprovação</h1>
      <p className="text-sm text-gray-500 -mt-4">
        Toda solicitação de cadastro (qualquer setor) precisa ser aprovada aqui antes da pessoa conseguir entrar.
      </p>

      <div className="card !p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Nome completo</th>
              <th className="p-3">Email</th>
              <th className="p-3">Setor</th>
              <th className="p-3">Data do pedido</th>
              <th className="p-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {(pendentes ?? []).map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">{c.nome_completo}</td>
                <td className="p-3">{c.email}</td>
                <td className="p-3">{SETOR_LABEL[c.setor] ?? c.setor}</td>
                <td className="p-3">{fmtData(c.criado_em)}</td>
                <td className="p-3 space-x-2">
                  <form action={aprovarConta.bind(null, c.id)} className="inline-block align-top space-y-2">
                    <div className="flex flex-wrap gap-2 max-w-md">
                      {MODULOS_APROVACAO.map((m) => (
                        <label key={m.key} className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs text-ink-700">
                          <input type="checkbox" name="modulo" value={m.key} className="accent-[#00778A]" />
                          {m.label}
                        </label>
                      ))}
                    </div>
                    <button className="bg-primary text-white rounded px-3 py-1">Aprovar</button>
                  </form>
                  <form action={rejeitarConta.bind(null, c.id)} className="inline">
                    <button className="bg-gray-200 rounded px-3 py-1">Rejeitar</button>
                  </form>
                </td>
              </tr>
            ))}
            {(!pendentes || pendentes.length === 0) && (
              <tr><td className="p-3 text-gray-400" colSpan={5}>Nenhum cadastro pendente no momento.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold text-primaryDark">Cadastros já decididos</h2>
      <p className="text-sm text-gray-500 -mt-4">
        Quando alguém sair da empresa, use &quot;Desativar acesso&quot; na linha da pessoa: o login dela para de
        funcionar, mas o histórico de medições e fechamentos continua intacto.
      </p>
      <div className="card !p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Nome completo</th>
              <th className="p-3">Email</th>
              <th className="p-3">Setor</th>
              <th className="p-3">Status</th>
              <th className="p-3">Data</th>
              <th className="p-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {(decididas ?? []).map((c) => (
              <tr
                key={c.id}
                className={`border-t ${
                  c.status === "rejeitado" || c.status === "desativado" ? "text-red-600" : ""
                }`}
              >
                <td className="p-3">{c.nome_completo}</td>
                <td className="p-3">{c.email}</td>
                <td className="p-3">
                  <form action={alterarSetor.bind(null, c.id)} className="flex items-center gap-1">
                    <select name="setor" defaultValue={c.setor ?? ""} className="border rounded px-2 py-1 text-xs bg-white">
                      {Object.entries(SETOR_LABEL).map(([v, r]) => (
                        <option key={v} value={v}>{r}</option>
                      ))}
                    </select>
                    <button className="bg-gray-200 rounded px-2 py-1 text-xs">Salvar</button>
                  </form>
                </td>
                <td className="p-3">
                  <span
                    className={
                      "badge " +
                      (c.status === "aprovado"
                        ? "badge-aprovado"
                        : c.status === "desativado"
                        ? "badge-desativado"
                        : "badge-rejeitado")
                    }
                  >
                    {c.status === "aprovado" ? "Aprovado" : c.status === "desativado" ? "Desativado" : "Rejeitado"}
                  </span>
                </td>
                <td className="p-3">{fmtData(c.decidido_em)}</td>
                <td className="p-3">
                  {c.status === "aprovado" && c.id !== meuId && (
                    <form action={desativarConta.bind(null, c.id)} className="inline">
                      <button className="bg-gray-200 rounded px-3 py-1 text-xs">Desativar acesso</button>
                    </form>
                  )}
                  {c.status === "desativado" && (
                    <form action={reativarConta.bind(null, c.id)} className="inline">
                      <button className="bg-primary text-white rounded px-3 py-1 text-xs">Reativar</button>
                    </form>
                  )}
                  {!(c.status === "aprovado" || c.status === "desativado") && "—"}
                </td>
              </tr>
            ))}
            {(!decididas || decididas.length === 0) && (
              <tr><td className="p-3 text-gray-400" colSpan={6}>Nenhum cadastro decidido ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {ehGestor && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-primaryDark">Controle de acessos</h2>
          <p className="text-sm text-ink-500 -mt-2">Visível só para você. Libere ou retire módulos de cada pessoa e responda pedidos de acesso.</p>
          <PainelAcessos />
        </section>
      )}

      <NotificacaoAvulsaPanel usuarios={usuariosAprovados ?? []} />
    </>
  );
}
