import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarObra, criarServico, editarValorServico, salvarRetencao } from "./actions";
import { vincularEmpresaObra, editarVinculoEmpresaObra, removerVinculoEmpresaObra } from "./empresa-obra-actions";
import Topbar from "../../components/Topbar";

const TIPO_LABEL: Record<string, string> = {
  area: "Por m²",
  linear: "Por metro linear",
  unidade: "Por unidade",
  diaria: "Por diária",
};

const STATUS_LABEL: Record<string, string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  ENCERRADO: "Encerrado",
};

function mesAtual() {
  return new Date().toISOString().slice(0, 7);
}

export default async function ObrasPage({
  searchParams,
}: {
  searchParams: { obra?: string; mes?: string; editarVinculo?: string };
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

  // Empresas e vínculos da obra
  const { data: todasEmpresas } = await supabase
    .from("empresas_terceirizadas")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  const { data: vinculosObra } = obraSelecionada
    ? await supabase
        .from("empresa_obra")
        .select("id, empresa_id, tipo_servico, data_inicio, data_termino, status, retencao_contratual, retencao_pct, observacoes, empresas_terceirizadas(nome)")
        .eq("obra_id", obraSelecionada)
        .order("criado_em", { ascending: false })
    : { data: [] };

  const editarVinculoId = searchParams.editarVinculo ?? null;
  const vinculoEditando = editarVinculoId
    ? (vinculosObra ?? []).find((v) => v.id === editarVinculoId)
    : null;

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
          <select name="obra" defaultValue={obraSelecionada ?? ""} className="border rounded px-3 py-2 flex-1">
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

          {/* ───────── EMPRESAS CONTRATADAS ───────── */}
          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-primaryDark">Empresas Contratadas nesta Obra</h2>
              <a href="/admin/empresas" className="text-xs text-primary underline">
                Gerenciar empresas →
              </a>
            </div>

            {/* Lista de vínculos */}
            {(vinculosObra ?? []).length > 0 && (
              <div className="mb-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-gray-400 uppercase tracking-wide">
                    <tr>
                      <th className="p-2">Empresa</th>
                      <th className="p-2">Serviço</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Início</th>
                      <th className="p-2">Término</th>
                      <th className="p-2">Retenção</th>
                      <th className="p-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(vinculosObra ?? []).map((v) => (
                      <tr key={v.id} className="border-t">
                        <td className="p-2 font-medium">
                          {(v.empresas_terceirizadas as any)?.nome ?? "—"}
                        </td>
                        <td className="p-2">{v.tipo_servico}</td>
                        <td className="p-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${
                            v.status === "ATIVO" ? "bg-green-100 text-green-700" :
                            v.status === "ENCERRADO" ? "bg-red-100 text-red-700" :
                            "bg-gray-100 text-gray-500"
                          }`}>
                            {STATUS_LABEL[v.status] ?? v.status}
                          </span>
                        </td>
                        <td className="p-2">{v.data_inicio ? new Date(v.data_inicio + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="p-2">{v.data_termino ? new Date(v.data_termino + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="p-2">
                          {v.retencao_contratual ? `${Number(v.retencao_pct).toFixed(0)}%` : "Sem retenção"}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-2">
                            <a
                              href={`/admin/obras?obra=${obraSelecionada}&mes=${mes}&editarVinculo=${v.id}`}
                              className="text-primary underline"
                            >
                              Editar
                            </a>
                            <form action={removerVinculoEmpresaObra}>
                              <input type="hidden" name="id" value={v.id} />
                              <button className="text-red-500 underline">Remover</button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Formulário vincular / editar */}
            <details open={!!vinculoEditando}>
              <summary className="text-sm font-semibold text-primaryDark cursor-pointer mb-3">
                {vinculoEditando ? `✏️ Editar vínculo` : "➕ Vincular empresa à obra"}
              </summary>
              <form
                action={vinculoEditando ? editarVinculoEmpresaObra : vincularEmpresaObra}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3"
              >
                <input type="hidden" name="obraId" value={obraSelecionada} />
                {vinculoEditando && <input type="hidden" name="id" value={vinculoEditando.id} />}

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Empresa *</label>
                  <select
                    name="empresaId"
                    className="border rounded px-2 py-1 w-full"
                    defaultValue={vinculoEditando?.empresa_id ?? ""}
                    required
                  >
                    <option value="">Selecionar empresa…</option>
                    {(todasEmpresas ?? []).map((e) => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tipo de serviço *</label>
                  <input
                    name="tipoServico"
                    defaultValue={vinculoEditando?.tipo_servico ?? ""}
                    className="border rounded px-2 py-1 w-full"
                    placeholder="Ex: Impermeabilização, Instalações Elétricas"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Data início *</label>
                  <input
                    type="date"
                    name="dataInicio"
                    defaultValue={vinculoEditando?.data_inicio ?? ""}
                    className="border rounded px-2 py-1 w-full"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Data término</label>
                  <input
                    type="date"
                    name="dataTermino"
                    defaultValue={vinculoEditando?.data_termino ?? ""}
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Status do contrato</label>
                  <select
                    name="status"
                    defaultValue={vinculoEditando?.status ?? "ATIVO"}
                    className="border rounded px-2 py-1 w-full"
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                    <option value="ENCERRADO">Encerrado</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Retenção contratual</label>
                  <div className="flex items-center gap-2 mt-1">
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        name="retencaoContratual"
                        value="1"
                        defaultChecked={vinculoEditando?.retencao_contratual ?? false}
                      />
                      Tem retenção
                    </label>
                    <input
                      type="number"
                      name="retencaoPct"
                      min={0}
                      max={100}
                      step={0.01}
                      defaultValue={vinculoEditando ? Number(vinculoEditando.retencao_pct) : 0}
                      className="border rounded px-2 py-1 w-20"
                      placeholder="%"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500 block mb-1">Observações</label>
                  <input
                    name="observacoes"
                    defaultValue={vinculoEditando?.observacoes ?? ""}
                    className="border rounded px-2 py-1 w-full"
                    placeholder="Número do contrato, notas…"
                  />
                </div>

                <div className="sm:col-span-2 flex gap-2">
                  <button className="bg-primary text-white rounded px-4 py-2 text-sm">
                    {vinculoEditando ? "Salvar alterações" : "Vincular empresa"}
                  </button>
                  {vinculoEditando && (
                    <a
                      href={`/admin/obras?obra=${obraSelecionada}&mes=${mes}`}
                      className="border rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Cancelar
                    </a>
                  )}
                </div>
              </form>
            </details>

            {(todasEmpresas ?? []).length === 0 && (
              <p className="text-xs text-gray-400 mt-2">
                Nenhuma empresa ativa cadastrada.{" "}
                <a href="/admin/empresas" className="text-primary underline">Cadastrar empresa →</a>
              </p>
            )}
          </div>
        </>
      )}
      </div>
    </main>
  );
}
