import { createClient } from "@/lib/supabase/server";
import {
  criarLancamento,
  aprovarLancamento,
  rejeitarLancamento,
  editarLancamento,
  excluirLancamento,
  excluirLancamentoProprio,
} from "./actions";
import Topbar from "../components/Topbar";
import NovoLancamentoForm from "./NovoLancamentoForm";
import LinhaLancamento from "./LinhaLancamento";

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: { obra?: string; erro?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: meuPerfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  const ehAdmin = meuPerfil?.setor === "ADMIN";

  const { data: obras } = await supabase.from("obras").select("id, nome").order("nome");
  const obraId = searchParams.obra || obras?.[0]?.id || null;

  const { data: pessoas } = obraId
    ? await supabase.from("pessoas").select("id, nome").eq("obra_id", obraId).eq("status", "ATIVO").order("nome")
    : { data: [] };

  const { data: servicos } = obraId
    ? await supabase.from("servicos").select("id, nome, tipo, valor_unitario").eq("obra_id", obraId).order("criado_em")
    : { data: [] };

  // Local entra na seleção (campo já existia no banco, mas não aparecia na tela)
  // e criado_por entra para o estagiário poder identificar e editar/excluir só
  // os lançamentos que ele mesmo criou, conforme a regra de pendência.
  const { data: lancamentos } = obraId
    ? await supabase
        .from("lancamentos")
        .select(
          "id, tipo, data, mes_referencia, pessoa_id, servico, local, detalhe_texto, total_reais, valor_vale_hibrido, retencao_pct_usado, status, vale_real, observacao_medicao, quantidade, criado_por"
        )
        .eq("obra_id", obraId)
        .order("criado_em", { ascending: false })
        .limit(50)
    : { data: [] };

  const nomesPessoas: Record<string, string> = {};
  for (const p of pessoas ?? []) nomesPessoas[p.id] = p.nome;

  const { data: fechamentosObra } = obraId
    ? await supabase.from("fechamentos").select("tipo, mes_referencia").eq("obra_id", obraId)
    : { data: [] };
  const mesesFechados = new Set((fechamentosObra ?? []).map((f) => `${f.tipo}-${f.mes_referencia}`));

  return (
    <main className="min-h-screen">
      <Topbar setor={meuPerfil?.setor} />
      <div className="p-8 space-y-4">
      <h1 className="text-xl font-semibold text-primaryDark">Lançamentos — Medição &amp; Vale</h1>

      <div className="card">
        <form method="get" className="flex gap-2">
          <select name="obra" defaultValue={obraId ?? ""} className="border rounded px-3 py-2 flex-1">
            {(obras ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          <button className="bg-gray-200 rounded px-4 py-2">Ver obra</button>
        </form>
      </div>

      {obraId && (
        <div className="card">
          <h2 className="font-semibold text-primaryDark mb-2">Novo lançamento</h2>
          {pessoas && pessoas.length > 0 ? (
            <NovoLancamentoForm
              obraId={obraId}
              pessoas={pessoas}
              servicos={servicos ?? []}
              criarLancamento={criarLancamento}
            />
          ) : (
            <p className="text-sm text-gray-400">Nenhuma pessoa ativa nesta obra. Cadastre em RH &amp; Pessoas.</p>
          )}
        </div>
      )}

      {searchParams.erro && (
        <div className="card bg-red-50 border border-red-200 text-red-700 text-sm">
          {searchParams.erro}
        </div>
      )}

      {obraId && (
        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-primaryDark mb-2">Histórico de lançamentos</h2>
          {lancamentos && lancamentos.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="text-left text-gray-400">
                <tr>
                  <th className="p-1">Data</th><th className="p-1">Tipo</th><th className="p-1">Pessoa</th>
                  <th className="p-1">Detalhe</th><th className="p-1">Local</th><th className="p-1">Total</th>
                  <th className="p-1">Status</th><th className="p-1">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l) => {
                  const isOwner = l.criado_por === user!.id;
                  const jaFechado =
                    l.tipo === "VALE_MEDICAO"
                      ? mesesFechados.has(`MEDICAO-${l.mes_referencia}`) || mesesFechados.has(`VALE-${l.mes_referencia}`)
                      : mesesFechados.has(`${l.tipo}-${l.mes_referencia}`);
                  return (
                    <LinhaLancamento
                      key={l.id}
                      l={l as any}
                      obraId={obraId}
                      nomePessoa={nomesPessoas[l.pessoa_id] ?? "—"}
                      pessoas={pessoas ?? []}
                      servicos={servicos ?? []}
                      ehAdmin={ehAdmin}
                      isOwner={isOwner}
                      jaFechado={jaFechado}
                      aprovarLancamento={aprovarLancamento}
                      rejeitarLancamento={rejeitarLancamento}
                      editarLancamento={editarLancamento}
                      excluirLancamento={excluirLancamento}
                      excluirLancamentoProprio={excluirLancamentoProprio}
                    />
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400">Nenhum lançamento encontrado para esta obra.</p>
          )}
        </div>
      )}
      </div>
    </main>
  );
}
