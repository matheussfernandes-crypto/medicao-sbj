import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Topbar from "../../components/Topbar";

const TABELA_LABEL: Record<string, string> = {
  lancamentos: "Lançamentos (medição/vale)",
  fechamentos: "Fechamentos mensais",
  retencoes_pessoa: "Retenção por pessoa",
  retiradas_retido: "Retiradas de retido",
};

const ACAO_LABEL: Record<string, string> = {
  INSERT: "Criou",
  UPDATE: "Editou",
  DELETE: "Excluiu",
};

const ACAO_COR: Record<string, string> = {
  INSERT: "bg-green-100 text-green-700",
  UPDATE: "bg-yellow-100 text-yellow-700",
  DELETE: "bg-red-100 text-red-700",
};

function resumoLinha(
  tabela: string,
  dados: any,
  nomeObra: Record<string, string>,
  nomePessoa: Record<string, string>
): string {
  if (!dados) return "—";
  switch (tabela) {
    case "lancamentos": {
      const pessoa = nomePessoa[dados.pessoa_id] ?? "—";
      const obra = nomeObra[dados.obra_id] ?? "—";
      const tipo = dados.tipo === "MEDICAO" ? "Medição" : "Vale";
      return `${tipo} de ${pessoa} (${obra}), ${dados.mes_referencia} — R$ ${Number(dados.total_reais ?? 0).toFixed(2)}, status ${dados.status}`;
    }
    case "fechamentos": {
      const obra = nomeObra[dados.obra_id] ?? "—";
      return `${dados.tipo === "MEDICAO" ? "Medição" : "Vale"} de ${obra}, ${dados.mes_referencia}`;
    }
    case "retencoes_pessoa": {
      const pessoa = nomePessoa[dados.pessoa_id] ?? "—";
      return `${pessoa} — ${dados.mes}: ${(Number(dados.percent ?? 0) * 100).toFixed(1)}%`;
    }
    case "retiradas_retido": {
      const pessoa = nomePessoa[dados.pessoa_id] ?? "—";
      return `${pessoa} — R$ ${Number(dados.valor ?? 0).toFixed(2)} em ${dados.data ?? "—"}`;
    }
    default:
      return JSON.stringify(dados);
  }
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: { tabela?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: meuPerfil } = await supabase.from("perfis").select("setor, nome_completo").eq("id", user!.id).single();
  if (meuPerfil?.setor !== "ADMIN") redirect("/dashboard");

  const filtroTabela = searchParams.tabela;

  let query = supabase
    .from("log_auditoria")
    .select("id, tabela, acao, dados_anteriores, dados_novos, feito_por, feito_em")
    .order("feito_em", { ascending: false })
    .limit(200);
  if (filtroTabela) query = query.eq("tabela", filtroTabela);

  const { data: logs } = await query;

  const { data: obras } = await supabase.from("obras").select("id, nome");
  const nomeObra: Record<string, string> = {};
  for (const o of obras ?? []) nomeObra[o.id] = o.nome;

  const { data: pessoas } = await supabase.from("pessoas").select("id, nome");
  const nomePessoa: Record<string, string> = {};
  for (const p of pessoas ?? []) nomePessoa[p.id] = p.nome;

  const autorIds = Array.from(new Set((logs ?? []).map((l) => l.feito_por).filter(Boolean))) as string[];
  const { data: autores } = autorIds.length
    ? await supabase.from("perfis").select("id, nome_completo").in("id", autorIds)
    : { data: [] as any[] };
  const nomeAutor: Record<string, string> = {};
  for (const a of autores ?? []) nomeAutor[a.id] = a.nome_completo;

  const tabelasDisponiveis = Object.keys(TABELA_LABEL);

  return (
    <main className="min-h-screen">
      <Topbar setor="ADMIN" nome={meuPerfil?.nome_completo} />
      <div className="p-8 space-y-4">
        <h1 className="text-xl font-semibold text-primaryDark">Log de auditoria</h1>
        <p className="text-sm text-gray-500">
          Histórico de criação, edição e exclusão registrado automaticamente pelo banco de dados. Mostra os últimos 200 registros.
        </p>

        <div className="flex gap-2 flex-wrap text-sm">
          <Link
            href="/admin/auditoria"
            className={`px-3 py-1 rounded border ${!filtroTabela ? "bg-primary text-white border-primary" : "border-gray-300 text-gray-600"}`}
          >
            Todos
          </Link>
          {tabelasDisponiveis.map((t) => (
            <Link
              key={t}
              href={`/admin/auditoria?tabela=${t}`}
              className={`px-3 py-1 rounded border ${filtroTabela === t ? "bg-primary text-white border-primary" : "border-gray-300 text-gray-600"}`}
            >
              {TABELA_LABEL[t]}
            </Link>
          ))}
        </div>

        <div className="card overflow-x-auto">
          {logs && logs.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="text-left text-gray-400">
                <tr>
                  <th className="p-1">Data/hora</th>
                  <th className="p-1">Quem</th>
                  <th className="p-1">Ação</th>
                  <th className="p-1">Tabela</th>
                  <th className="p-1">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const dados = l.acao === "DELETE" ? l.dados_anteriores : l.dados_novos;
                  return (
                    <tr key={l.id} className="border-t align-top">
                      <td className="p-1 whitespace-nowrap">
                        {new Date(l.feito_em).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-1 whitespace-nowrap">{l.feito_por ? (nomeAutor[l.feito_por] ?? "—") : "—"}</td>
                      <td className="p-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ACAO_COR[l.acao] ?? ""}`}>
                          {ACAO_LABEL[l.acao] ?? l.acao}
                        </span>
                      </td>
                      <td className="p-1 whitespace-nowrap">{TABELA_LABEL[l.tabela] ?? l.tabela}</td>
                      <td className="p-1">{resumoLinha(l.tabela, dados, nomeObra, nomePessoa)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400">Nenhum registro de auditoria ainda.</p>
          )}
        </div>
      </div>
    </main>
  );
}
