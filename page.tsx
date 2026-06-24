import { createClient } from "@/lib/supabase/server";
import { criarLancamento, aprovarLancamento, rejeitarLancamento } from "./actions";
import Topbar from "../components/Topbar";

const TIPO_LABEL: Record<string, string> = {
  area: "Por m² (comprimento × altura)",
  linear: "Por m",
  unidade: "Por unidade",
  diaria: "Por diária",
};

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: { obra?: string };
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

  const { data: lancamentos } = obraId
    ? await supabase
        .from("lancamentos")
        .select("id, tipo, data, mes_referencia, pessoa_id, servico, detalhe_texto, total_reais, retencao_pct_usado, status, vale_real")
        .eq("obra_id", obraId)
        .order("criado_em", { ascending: false })
        .limit(50)
    : { data: [] };

  const nomesPessoas: Record<string, string> = {};
  for (const p of pessoas ?? []) nomesPessoas[p.id] = p.nome;

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
            <form action={criarLancamento} className="space-y-2">
              <input type="hidden" name="obraId" value={obraId} />
              <div className="flex flex-wrap gap-2">
                <select name="pessoaId" className="border rounded px-2 py-1 flex-1 min-w-[150px]" required>
                  {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <select name="tipoLancamento" className="border rounded px-2 py-1">
                  <option value="MEDICAO">Medição</option>
                  <option value="VALE">Vale</option>
                </select>
                <input type="date" name="data" defaultValue={hojeISO()} className="border rounded px-2 py-1" />
              </div>

              <div className="flex items-center gap-2 text-sm">
                <label className="flex items-center gap-1">
                  <input type="checkbox" name="valeReal" value="1" /> Vale real (valor fixo, sem cálculo de serviço)
                </label>
                <input type="number" step="0.01" name="valorValeReal" placeholder="Valor do vale (R$)" className="border rounded px-2 py-1 w-40" />
              </div>

              <div className="flex flex-wrap gap-2">
                <select name="servicoId" className="border rounded px-2 py-1 flex-1 min-w-[180px]">
                  {(servicos ?? []).map((s) => (
                    <option key={s.id} value={s.id} data-tipo={s.tipo}>
                      {s.nome} — {TIPO_LABEL[s.tipo]} (R$ {Number(s.valor_unitario).toFixed(2)})
                    </option>
                  ))}
                </select>
                <input name="local" placeholder="Local (ex: bloco A, 3º pavimento)" className="border rounded px-2 py-1 flex-1 min-w-[150px]" />
              </div>

              <div className="flex flex-wrap gap-2">
                <input type="number" step="0.01" name="comprimento" placeholder="Comprimento (m)" className="border rounded px-2 py-1 w-36" />
                <input type="number" step="0.01" name="altura" placeholder="Altura (m) — só p/ m²" className="border rounded px-2 py-1 w-44" />
                <input type="number" step="0.01" name="qtd" placeholder="Quantidade — diária/unidade" className="border rounded px-2 py-1 w-52" />
                <input type="number" step="0.01" name="adicional" placeholder="Adicional R$" className="border rounded px-2 py-1 w-32" />
              </div>

              <button className="bg-primary text-white rounded px-4 py-2">Lançar</button>
              <p className="text-xs text-gray-400">
                Preencha comprimento/altura para serviços por m², só comprimento para metro linear, ou quantidade para diária/unidade.
                A % de retenção e o valor unitário usados ficam congelados neste lançamento — não mudam se a tabela de preços ou a retenção mudar depois.
              </p>
            </form>
          ) : (
            <p className="text-sm text-gray-400">Nenhuma pessoa ativa nesta obra. Cadastre em RH &amp; Pessoas.</p>
          )}
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
                  <th className="p-1">Detalhe</th><th className="p-1">Total</th><th className="p-1">Status</th>
                  {ehAdmin && <th className="p-1">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-1">{new Date(l.data).toLocaleDateString("pt-BR")}</td>
                    <td className="p-1">{l.tipo === "VALE" ? "Vale" : "Medição"}</td>
                    <td className="p-1">{nomesPessoas[l.pessoa_id] ?? "—"}</td>
                    <td className="p-1">{l.vale_real ? "Vale real" : `${l.servico ?? ""} ${l.detalhe_texto ?? ""}`}</td>
                    <td className="p-1">R$ {Number(l.total_reais).toFixed(2)}</td>
                    <td className="p-1">
                      <span className={
                        "badge " + (l.status === "APROVADO" ? "badge-aprovado" : l.status === "REJEITADO" ? "badge-rejeitado" : "badge-pendente")
                      }>{l.status}</span>
                    </td>
                    {ehAdmin && (
                      <td className="p-1 space-x-1">
                        {l.status === "PENDENTE" && (
                          <>
                            <form action={aprovarLancamento} className="inline">
                              <input type="hidden" name="id" value={l.id} />
                              <button className="bg-primary text-white rounded px-2 py-0.5 text-xs">Aprovar</button>
                            </form>
                            <form action={rejeitarLancamento} className="inline">
                              <input type="hidden" name="id" value={l.id} />
                              <button className="bg-gray-200 rounded px-2 py-0.5 text-xs">Rejeitar</button>
                            </form>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
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
