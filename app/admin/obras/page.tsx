import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarObra, criarServico, editarValorServico, salvarRetencao } from "./actions";
import Topbar from "../../components/Topbar";

const TIPO_LABEL: Record<string, string> = {
  area: "Por m²",
  linear: "Por metro linear",
  unidade: "Por unidade",
  diaria: "Por diária",
};

function mesAtual() {
  return new Date().toISOString().slice(0, 7);
}

export default async function ObrasPage({
  searchParams,
}: {
  searchParams: { obra?: string; mes?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: meuPerfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (meuPerfil?.setor !== "ADMIN") redirect("/dashboard");

  const { data: obras } = await supabase.from("obras").select("id, nome").order("nome");
  const obraSelecionada = searchParams.obra || obras?.[0]?.id || null;
  const mes = searchParams.mes || mesAtual();

  const { data: servicos } = obraSelecionada
    ? await supabase.from("servicos").select("id, nome, tipo, valor_unitario").eq("obra_id", obraSelecionada).order("criado_em")
    : { data: [] };

  const { data: pessoas } = obraSelecionada
    ? await supabase.from("pessoas").select("id, nome").eq("obra_id", obraSelecionada).eq("status", "ATIVO").eq("papel", "EMPREITEIRO").order("nome")
    : { data: [] };

  const retencoesPorPessoa: Record<string, number> = {};
  if (pessoas && pessoas.length) {
    for (const p of pessoas) {
      const { data: vigente } = await supabase
        .from("retencoes_pessoa")
        .select("percent")
        .eq("pessoa_id", p.id)
        .lte("mes", mes)
        .order("mes", { ascending: false })
        .limit(1);
      retencoesPorPessoa[p.id] = vigente && vigente[0] ? Number(vigente[0].percent) * 100 : 0;
    }
  }

  const { data: log } = obraSelecionada
    ? await supabase
        .from("log_alteracoes_retencao")
        .select("alterado_em, percent_anterior, percent_novo, mes_aplicacao, pessoa_id")
        .eq("obra_id", obraSelecionada)
        .order("alterado_em", { ascending: false })
        .limit(30)
    : { data: [] };

  const nomesPessoas: Record<string, string> = {};
  for (const p of pessoas ?? []) nomesPessoas[p.id] = p.nome;

  return (
    <main className="min-h-screen">
      <Topbar setor="ADMIN" />
      <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold text-primaryDark">Obras &amp; Pessoas</h1>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold text-primaryDark mb-2">Cadastrar nova obra</h2>
        <form action={criarObra} className="flex gap-2">
          <input name="nome" placeholder="Nome da obra (ex: Residencial Aurora)" className="border rounded px-3 py-2 flex-1" required />
          <button className="bg-primary text-white rounded px-4 py-2">Criar obra</button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold text-primaryDark mb-2">Selecionar obra</h2>
        <form method="get" className="flex gap-2">
          <select name="obra" defaultValue={obraSelecionada ?? ""} className="border rounded px-3 py-2 flex-1" onChange={undefined}>
            {(obras ?? []).map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
          <input type="hidden" name="mes" value={mes} />
          <button className="bg-gray-200 rounded px-4 py-2">Ver</button>
        </form>
        {(!obras || obras.length === 0) && <p className="text-sm text-gray-400 mt-2">Nenhuma obra cadastrada ainda.</p>}
      </div>

      {obraSelecionada && (
        <>
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold text-primaryDark mb-2">Retenção mensal por pessoa</h2>
            <form method="get" className="flex items-center gap-2 mb-3">
              <input type="hidden" name="obra" value={obraSelecionada} />
              <label className="text-sm text-gray-500">Mês de referência</label>
              <input type="month" name="mes" defaultValue={mes} className="border rounded px-2 py-1" />
              <button className="bg-gray-200 rounded px-3 py-1 text-sm">Atualizar</button>
            </form>
            <p className="text-xs text-gray-400 mb-3">
              O % informado vale a partir deste mês até você cadastrar um novo valor. Medições já lançadas em meses anteriores mantêm a % que estava em vigor na época.
            </p>
            {pessoas && pessoas.length ? (
              <div className="space-y-2">
                {pessoas.map((p) => (
                  <form key={p.id} action={salvarRetencao} className="flex items-center gap-2">
                    <input type="hidden" name="pessoaId" value={p.id} />
                    <input type="hidden" name="obraId" value={obraSelecionada} />
                    <input type="hidden" name="mes" value={mes} />
                    <span className="flex-1 text-sm">{p.nome}</span>
                    <input
                      type="number"
                      name="percent"
                      min={0}
                      max={100}
                      defaultValue={retencoesPorPessoa[p.id] ?? 0}
                      className="border rounded px-2 py-1 w-20 text-right"
                    />
                    <span className="text-sm text-gray-500">%</span>
                    <button className="bg-gray-200 rounded px-3 py-1 text-sm">Salvar</button>
                  </form>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Nenhuma pessoa ativa nesta obra ainda. Cadastre em RH &amp; Pessoas.</p>
            )}

            {log && log.length > 0 && (
              <details className="mt-4">
                <summary className="text-sm font-semibold text-primaryDark cursor-pointer">
                  ▶ Histórico de alterações de % de retenção ({log.length})
                </summary>
                <table className="w-full text-xs mt-2">
                  <thead className="text-left text-gray-400">
                    <tr><th className="p-1">Data</th><th className="p-1">Pessoa</th><th className="p-1">Antes</th><th className="p-1">Depois</th><th className="p-1">Vale a partir de</th></tr>
                  </thead>
                  <tbody>
                    {log.map((l, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1">{new Date(l.alterado_em).toLocaleDateString("pt-BR")}</td>
                        <td className="p-1">{nomesPessoas[l.pessoa_id] ?? l.pessoa_id}</td>
                        <td className="p-1">{(Number(l.percent_anterior) * 100).toFixed(0)}%</td>
                        <td className="p-1 font-semibold">{(Number(l.percent_novo) * 100).toFixed(0)}%</td>
                        <td className="p-1">{l.mes_aplicacao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold text-primaryDark mb-2">Tabela de serviços e valores</h2>
            {servicos && servicos.length > 0 && (
              <table className="w-full text-sm mb-3">
                <thead className="text-left text-gray-400">
                  <tr><th className="p-1">Serviço</th><th className="p-1">Tipo</th><th className="p-1">Valor unitário</th></tr>
                </thead>
                <tbody>
                  {servicos.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="p-1">{s.nome}</td>
                      <td className="p-1">{TIPO_LABEL[s.tipo] ?? s.tipo}</td>
                      <td className="p-1">
                        <form action={editarValorServico} className="flex items-center gap-1">
                          <input type="hidden" name="servicoId" value={s.id} />
                          <span className="text-gray-400">R$</span>
                          <input type="number" step="0.01" name="valor" defaultValue={s.valor_unitario} className="border rounded px-2 py-1 w-24" />
                          <button className="bg-gray-200 rounded px-2 py-1 text-xs">Salvar</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <form action={criarServico.bind(null, obraSelecionada)} className="flex gap-2 flex-wrap">
              <input name="nome" placeholder="Novo serviço" className="border rounded px-2 py-1" required />
              <select name="tipo" className="border rounded px-2 py-1">
                <option value="area">Por m²</option>
                <option value="linear">Por metro linear</option>
                <option value="unidade">Por unidade</option>
                <option value="diaria">Por diária</option>
              </select>
              <input name="valor" type="number" step="0.01" placeholder="Valor unitário" className="border rounded px-2 py-1 w-32" required />
              <button className="bg-primary text-white rounded px-3 py-1">Adicionar serviço</button>
            </form>
          </div>
        </>
      )}
      </div>
    </main>
  );
}
