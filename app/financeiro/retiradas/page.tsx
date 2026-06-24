import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { salvarSaldoInicial, lancarRetirada, excluirRetirada } from "./actions";
import Topbar from "../../components/Topbar";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function RetiradasPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: meuPerfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (meuPerfil?.setor !== "FINANCEIRO" && meuPerfil?.setor !== "ADMIN") redirect("/dashboard");

  const { data: obras } = await supabase.from("obras").select("id, nome");
  const { data: pessoas } = await supabase
    .from("pessoas")
    .select("id, nome, obra_id, admissao, papel, saldo_inicial_retido")
    .neq("papel", "MESTRE")
    .order("nome");

  const { data: medicoesAprovadas } = await supabase
    .from("lancamentos")
    .select("pessoa_id, total_reais, retencao_pct_usado")
    .eq("tipo", "MEDICAO")
    .eq("status", "APROVADO");

  const { data: retiradas } = await supabase
    .from("retiradas_retido")
    .select("id, pessoa_id, obra_id, valor, data, observacao, lancado_por")
    .order("data", { ascending: false });

  const nomeObra: Record<string, string> = {};
  for (const o of obras ?? []) nomeObra[o.id] = o.nome;

  const nomePessoa: Record<string, string> = {};
  for (const p of pessoas ?? []) nomePessoa[p.id] = p.nome;

  const retidoCalculado: Record<string, number> = {};
  for (const l of medicoesAprovadas ?? []) {
    const pct = l.retencao_pct_usado != null ? Number(l.retencao_pct_usado) : 0;
    retidoCalculado[l.pessoa_id] = (retidoCalculado[l.pessoa_id] ?? 0) + Number(l.total_reais) * pct;
  }

  const retiradoPorPessoa: Record<string, number> = {};
  for (const r of retiradas ?? []) {
    retiradoPorPessoa[r.pessoa_id] = (retiradoPorPessoa[r.pessoa_id] ?? 0) + Number(r.valor);
  }

  function totalRetido(pessoaId: string, saldoInicial: number) {
    return saldoInicial + (retidoCalculado[pessoaId] ?? 0);
  }
  function totalRetirado(pessoaId: string) {
    return retiradoPorPessoa[pessoaId] ?? 0;
  }
  function saldoDisponivel(pessoaId: string, saldoInicial: number) {
    return totalRetido(pessoaId, saldoInicial) - totalRetirado(pessoaId);
  }

  return (
    <main className="min-h-screen">
      <Topbar setor="FINANCEIRO" />
      <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold text-primaryDark">Financeiro — Retiradas de retido</h1>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold text-primaryDark mb-2">Lançar retirada de valor retido</h2>
        <p className="text-xs text-gray-400 mb-2">
          Use quando um empreiteiro solicita receber, antes da hora, uma parte do que está retido com ele. O valor lançado aqui é abatido do saldo disponível dessa pessoa.
        </p>
        {pessoas && pessoas.length > 0 ? (
          <form action={lancarRetirada} className="flex flex-wrap gap-2">
            <select name="pessoaId" className="border rounded px-2 py-1 flex-1 min-w-[160px]" required>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>{p.nome} — {nomeObra[p.obra_id] ?? "?"}</option>
              ))}
            </select>
            <input type="date" name="data" defaultValue={hojeISO()} className="border rounded px-2 py-1" />
            <input type="number" step="0.01" name="valor" placeholder="Valor (R$)" className="border rounded px-2 py-1 w-32" required />
            <input name="observacao" placeholder="Observação (opcional)" className="border rounded px-2 py-1 flex-1 min-w-[160px]" />
            <button className="bg-primary text-white rounded px-4 py-2">Lançar retirada</button>
          </form>
        ) : (
          <p className="text-sm text-gray-400">Nenhum empreiteiro cadastrado ainda.</p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">
        <h2 className="font-semibold text-primaryDark mb-2">Saldo de retenção por pessoa</h2>
        <p className="text-xs text-gray-400 mb-2">
          Total retido (saldo inicial + medições aprovadas) menos o que já foi retirado — é o que ainda está disponível.
        </p>
        {pessoas && pessoas.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400">
              <tr>
                <th className="p-1">Pessoa</th><th className="p-1">Obra</th><th className="p-1">Saldo inicial</th>
                <th className="p-1">Total retido</th><th className="p-1">Total retirado</th><th className="p-1">Saldo disponível</th>
              </tr>
            </thead>
            <tbody>
              {pessoas.map((p) => {
                const inicial = Number(p.saldo_inicial_retido ?? 0);
                return (
                  <tr key={p.id} className="border-t">
                    <td className="p-1">{p.nome}</td>
                    <td className="p-1">{nomeObra[p.obra_id] ?? "—"}</td>
                    <td className="p-1">
                      <form action={salvarSaldoInicial} className="flex items-center gap-1">
                        <input type="hidden" name="pessoaId" value={p.id} />
                        <span className="text-gray-400">R$</span>
                        <input type="number" step="0.01" name="saldoInicial" defaultValue={inicial} className="border rounded px-2 py-1 w-24" />
                        <button className="bg-gray-200 rounded px-2 py-1 text-xs">Salvar</button>
                      </form>
                    </td>
                    <td className="p-1">R$ {totalRetido(p.id, inicial).toFixed(2)}</td>
                    <td className="p-1">R$ {totalRetirado(p.id).toFixed(2)}</td>
                    <td className="p-1 font-semibold">R$ {saldoDisponivel(p.id, inicial).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400">Nenhuma pessoa cadastrada ainda.</p>
        )}
        <p className="text-xs text-gray-400 mt-2">
          Use &quot;Saldo inicial&quot; para lançar quanto a pessoa já tinha de retido antes de começar a usar o sistema.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">
        <h2 className="font-semibold text-primaryDark mb-2">Retiradas já lançadas</h2>
        {retiradas && retiradas.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400">
              <tr>
                <th className="p-1">Data</th><th className="p-1">Pessoa</th><th className="p-1">Obra</th>
                <th className="p-1">Valor</th><th className="p-1">Observação</th><th className="p-1">Ações</th>
              </tr>
            </thead>
            <tbody>
              {retiradas.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-1">{new Date(r.data).toLocaleDateString("pt-BR")}</td>
                  <td className="p-1">{nomePessoa[r.pessoa_id] ?? "—"}</td>
                  <td className="p-1">{r.obra_id ? (nomeObra[r.obra_id] ?? "—") : "—"}</td>
                  <td className="p-1">R$ {Number(r.valor).toFixed(2)}</td>
                  <td className="p-1">{r.observacao || "—"}</td>
                  <td className="p-1">
                    <form action={excluirRetirada}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="bg-red-100 text-red-700 rounded px-2 py-0.5 text-xs">Excluir</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400">Nenhuma retirada de retido lançada ainda.</p>
        )}
      </div>
      </div>
    </main>
  );
}
