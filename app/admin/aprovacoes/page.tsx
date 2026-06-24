import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { aprovarConta, rejeitarConta } from "./actions";
import Topbar from "../../components/Topbar";

const SETOR_LABEL: Record<string, string> = {
  ESTAGIARIO: "Estagiário",
  ADMIN: "Engenheiro / ADM",
  RH: "RH",
  FINANCEIRO: "Financeiro",
};

function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default async function AprovacoesPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: meuPerfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (meuPerfil?.setor !== "ADMIN") {
    redirect("/dashboard");
  }

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

  return (
    <main className="min-h-screen">
      <Topbar setor="ADMIN" />
      <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold text-primaryDark">Cadastros pendentes de aprovação</h1>
      <p className="text-sm text-gray-500 -mt-4">
        Toda solicitação de cadastro (qualquer setor) precisa ser aprovada aqui antes da pessoa conseguir entrar.
      </p>

      <div className="bg-white rounded-xl shadow overflow-hidden">
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
                  <form action={aprovarConta.bind(null, c.id)} className="inline">
                    <button className="bg-primary text-white rounded px-3 py-1">✅ Aprovar</button>
                  </form>
                  <form action={rejeitarConta.bind(null, c.id)} className="inline">
                    <button className="bg-gray-200 rounded px-3 py-1">❌ Rejeitar</button>
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
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Nome completo</th>
              <th className="p-3">Email</th>
              <th className="p-3">Setor</th>
              <th className="p-3">Status</th>
              <th className="p-3">Data</th>
            </tr>
          </thead>
          <tbody>
            {(decididas ?? []).map((c) => (
              <tr key={c.id} className={`border-t ${c.status === "rejeitado" ? "text-red-600" : ""}`}>
                <td className="p-3">{c.nome_completo}</td>
                <td className="p-3">{c.email}</td>
                <td className="p-3">{SETOR_LABEL[c.setor] ?? c.setor}</td>
                <td className="p-3 font-semibold">{c.status === "aprovado" ? "Aprovado" : "Rejeitado"}</td>
                <td className="p-3">{fmtData(c.decidido_em)}</td>
              </tr>
            ))}
            {(!decididas || decididas.length === 0) && (
              <tr><td className="p-3 text-gray-400" colSpan={5}>Nenhum cadastro decidido ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
    </main>
  );
}
