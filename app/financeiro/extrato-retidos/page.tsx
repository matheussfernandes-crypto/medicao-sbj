import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Topbar from "../../components/Topbar";
import FiltrosExtrato from "./FiltrosExtrato";
import { Suspense } from "react";

function fmtData(s: string) {
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function fmtReais(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildMovs(
  saldoInicial: number,
  admissao: string | null,
  lancamentos: any[],
  retiradas: any[],
  obras: Record<string, string>,
  perfis: Record<string, string>,
  obraId?: string,
  dataInicio?: string,
  dataFim?: string,
) {
  type Mov = {
    data: string; tipo: string; referencia: string; descricao: string;
    obra: string | null; entrada: number; saida: number; saldo: number; responsavel: string | null;
  };
  const movs: Omit<Mov, "saldo">[] = [];

  // Saldo inicial — inclui sempre se > 0 (não sofre filtro de data/obra)
  if (saldoInicial > 0) {
    movs.push({
      data: admissao ?? "2000-01-01",
      tipo: "SALDO_INICIAL",
      referencia: "Saldo Inicial",
      descricao: "Saldo retido anterior ao sistema",
      obra: null,
      entrada: saldoInicial,
      saida: 0,
      responsavel: null,
    });
  }

  // Medições
  for (const l of lancamentos) {
    const d = String(l.data ?? l.criado_em ?? "").slice(0, 10);
    if (dataInicio && d < dataInicio) continue;
    if (dataFim && d > dataFim) continue;
    if (obraId && l.obra_id !== obraId) continue;
    const pct = Number(l.retencao_pct_usado ?? 0);
    const entrada = Number(l.total_reais) * pct;
    if (entrada <= 0) continue;
    const tipoLabel = l.tipo === "VALE_MEDICAO" ? "Vale+Medição" : "Medição";
    const desc = [l.servico, l.local].filter(Boolean).join(" – ") || l.detalhe_texto || tipoLabel;
    movs.push({
      data: d,
      tipo: l.tipo,
      referencia: tipoLabel,
      descricao: desc,
      obra: obras[l.obra_id] ?? null,
      entrada,
      saida: 0,
      responsavel: perfis[l.criado_por] ?? null,
    });
  }

  // Retiradas
  for (const r of retiradas) {
    const d = String(r.data ?? "").slice(0, 10);
    if (dataInicio && d < dataInicio) continue;
    if (dataFim && d > dataFim) continue;
    if (obraId && r.obra_id && r.obra_id !== obraId) continue;
    movs.push({
      data: d,
      tipo: "RETIRADA",
      referencia: "Retirada",
      descricao: r.observacao || "Retirada de valor retido",
      obra: r.obra_id ? (obras[r.obra_id] ?? null) : null,
      entrada: 0,
      saida: Number(r.valor),
      responsavel: perfis[r.lancado_por] ?? null,
    });
  }

  // Ordena por data
  movs.sort((a, b) => a.data.localeCompare(b.data));

  // Calcula saldo acumulado
  let saldo = 0;
  return movs.map((m) => {
    saldo += m.entrada - m.saida;
    return { ...m, saldo };
  });
}

export default async function ExtratoRetidosPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: meuPerfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (meuPerfil?.setor !== "FINANCEIRO" && meuPerfil?.setor !== "ADMIN") redirect("/dashboard");

  const pessoaId = searchParams.pessoaId ?? "";
  const obraId = searchParams.obraId ?? "";
  const dataInicio = searchParams.dataInicio ?? "";
  const dataFim = searchParams.dataFim ?? "";
  const situacao = searchParams.situacao ?? "";

  // Dados base
  const { data: obras } = await supabase.from("obras").select("id, nome").order("nome");
  const { data: pessoas } = await supabase
    .from("pessoas")
    .select("id, nome, obra_id, admissao, saldo_inicial_retido")
    .not("papel", "in", "(MESTRE,MESTRE_GERAL)")
    .order("nome");

  const { data: lancamentos } = await supabase
    .from("lancamentos")
    .select("id, tipo, pessoa_id, obra_id, data, criado_em, criado_por, servico, local, detalhe_texto, total_reais, retencao_pct_usado")
    .in("tipo", ["MEDICAO", "VALE_MEDICAO"])
    .eq("status", "APROVADO");

  const { data: retiradas } = await supabase
    .from("retiradas_retido")
    .select("id, pessoa_id, obra_id, valor, data, observacao, lancado_por")
    .order("data", { ascending: true });

  const { data: perfisData } = await supabase.from("perfis").select("id, nome_completo");

  const obraMap: Record<string, string> = {};
  for (const o of obras ?? []) obraMap[o.id] = o.nome;
  const perfilMap: Record<string, string> = {};
  for (const p of perfisData ?? []) perfilMap[p.id] = p.nome_completo ?? "—";

  // Monta extrato por pessoa
  const extratos = (pessoas ?? []).map((p) => {
    const lacs = (lancamentos ?? []).filter((l) => l.pessoa_id === p.id);
    const rets = (retiradas ?? []).filter((r) => r.pessoa_id === p.id);
    const movs = buildMovs(
      Number(p.saldo_inicial_retido ?? 0),
      p.admissao,
      lacs, rets, obraMap, perfilMap,
      obraId || undefined, dataInicio || undefined, dataFim || undefined,
    );
    const totalEntradas = movs.reduce((a, m) => a + m.entrada, 0);
    const totalSaidas = movs.reduce((a, m) => a + m.saida, 0);
    const saldoAtual = movs.length > 0 ? movs[movs.length - 1].saldo : Number(p.saldo_inicial_retido ?? 0);
    return { id: p.id, nome: p.nome, movs, totalEntradas, totalSaidas, saldoAtual };
  });

  // Filtros de situação
  let extratosFiltrados = pessoaId
    ? extratos.filter((e) => e.id === pessoaId)
    : extratos;

  if (situacao === "com_saldo") extratosFiltrados = extratosFiltrados.filter((e) => e.saldoAtual > 0.005);
  if (situacao === "zerados") extratosFiltrados = extratosFiltrados.filter((e) => e.saldoAtual <= 0.005);

  const pessoaSelecionada = pessoaId ? extratosFiltrados[0] : null;

  // Labels de período para exibição
  const periodoLabel = dataInicio || dataFim
    ? `${dataInicio ? fmtData(dataInicio) : "início"} a ${dataFim ? fmtData(dataFim) : "hoje"}`
    : "Todos os períodos";

  // Monta params da URL para link do PDF
  const pdfParams = new URLSearchParams();
  if (pessoaId) pdfParams.set("pessoaId", pessoaId);
  if (obraId) pdfParams.set("obraId", obraId);
  if (dataInicio) pdfParams.set("dataInicio", dataInicio);
  if (dataFim) pdfParams.set("dataFim", dataFim);
  if (situacao) pdfParams.set("situacao", situacao);

  return (
    <main className="min-h-screen bg-gray-50">
      <Topbar setor={meuPerfil?.setor} />
      <div className="max-w-7xl mx-auto p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-semibold text-primaryDark">Extrato de Retidos</h1>
          <a
            href={`/financeiro/extrato-retidos/pdf?${pdfParams.toString()}`}
            target="_blank"
            className="bg-primaryDark text-white rounded px-4 py-2 text-sm font-medium hover:opacity-90 transition"
          >
            📄 Exportar PDF
          </a>
        </div>

        <Suspense>
          <FiltrosExtrato
            pessoas={(pessoas ?? []).map((p) => ({ id: p.id, nome: p.nome }))}
            obras={(obras ?? []).map((o) => ({ id: o.id, nome: o.nome }))}
          />
        </Suspense>

        {/* MODO INDIVIDUAL */}
        {pessoaSelecionada && (
          <div className="bg-white rounded-xl shadow p-5 space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-bold text-primaryDark">{pessoaSelecionada.nome}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{periodoLabel}</p>
              </div>
              <div className="flex gap-4 text-right">
                <div>
                  <div className="text-xs text-gray-400">Entradas</div>
                  <div className="text-sm font-semibold text-green-700">{fmtReais(pessoaSelecionada.totalEntradas)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Saídas</div>
                  <div className="text-sm font-semibold text-red-700">{fmtReais(pessoaSelecionada.totalSaidas)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Saldo Atual</div>
                  <div className="text-base font-bold text-primaryDark">{fmtReais(pessoaSelecionada.saldoAtual)}</div>
                </div>
              </div>
            </div>

            {pessoaSelecionada.movs.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma movimentação encontrada para os filtros selecionados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-primaryDark text-white text-xs">
                      <th className="p-2 text-left">Data</th>
                      <th className="p-2 text-left">Obra</th>
                      <th className="p-2 text-left">Referência</th>
                      <th className="p-2 text-left">Descrição</th>
                      <th className="p-2 text-right">Entrada</th>
                      <th className="p-2 text-right">Saída</th>
                      <th className="p-2 text-right">Saldo</th>
                      <th className="p-2 text-left">Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pessoaSelecionada.movs.map((m, i) => (
                      <tr key={i} className={i % 2 === 1 ? "bg-gray-50" : ""}>
                        <td className="p-2 whitespace-nowrap">{fmtData(m.data)}</td>
                        <td className="p-2 text-xs">{m.obra ?? "—"}</td>
                        <td className="p-2 whitespace-nowrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            m.tipo === "RETIRADA"
                              ? "bg-red-100 text-red-700"
                              : m.tipo === "SALDO_INICIAL"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-green-100 text-green-700"
                          }`}>{m.referencia}</span>
                        </td>
                        <td className="p-2 text-xs text-gray-700 max-w-xs truncate" title={m.descricao}>{m.descricao}</td>
                        <td className="p-2 text-right font-medium text-green-700">
                          {m.entrada > 0 ? fmtReais(m.entrada) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="p-2 text-right font-medium text-red-700">
                          {m.saida > 0 ? fmtReais(m.saida) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="p-2 text-right font-bold">{fmtReais(m.saldo)}</td>
                        <td className="p-2 text-xs text-gray-500">{m.responsavel ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MODO GERAL */}
        {!pessoaId && (
          <div className="space-y-4">
            {/* Resumo geral */}
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-base font-semibold text-primaryDark mb-3">
                Resumo Geral — {periodoLabel}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-primaryDark text-white text-xs">
                      <th className="p-2 text-left">Empreiteiro</th>
                      <th className="p-2 text-right">Movimentações</th>
                      <th className="p-2 text-right">Total Entradas</th>
                      <th className="p-2 text-right">Total Saídas</th>
                      <th className="p-2 text-right">Saldo Atual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extratosFiltrados.map((e, i) => (
                      <tr key={e.id} className={i % 2 === 1 ? "bg-gray-50" : ""}>
                        <td className="p-2 font-medium">
                          <a
                            href={`/financeiro/extrato-retidos?pessoaId=${e.id}${obraId ? `&obraId=${obraId}` : ""}${dataInicio ? `&dataInicio=${dataInicio}` : ""}${dataFim ? `&dataFim=${dataFim}` : ""}`}
                            className="text-primary underline hover:text-primaryDark"
                          >
                            {e.nome}
                          </a>
                        </td>
                        <td className="p-2 text-right text-gray-500">{e.movs.length}</td>
                        <td className="p-2 text-right text-green-700 font-medium">{fmtReais(e.totalEntradas)}</td>
                        <td className="p-2 text-right text-red-700 font-medium">{fmtReais(e.totalSaidas)}</td>
                        <td className="p-2 text-right font-bold">
                          <span className={e.saldoAtual > 0 ? "text-primaryDark" : "text-gray-400"}>
                            {fmtReais(e.saldoAtual)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {extratosFiltrados.length === 0 && (
                      <tr><td colSpan={5} className="p-4 text-center text-gray-400 text-sm">Nenhum empreiteiro encontrado.</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold text-sm border-t-2 border-primaryDark">
                      <td className="p-2">TOTAL</td>
                      <td className="p-2 text-right text-gray-500">
                        {extratosFiltrados.reduce((a, e) => a + e.movs.length, 0)}
                      </td>
                      <td className="p-2 text-right text-green-700">
                        {fmtReais(extratosFiltrados.reduce((a, e) => a + e.totalEntradas, 0))}
                      </td>
                      <td className="p-2 text-right text-red-700">
                        {fmtReais(extratosFiltrados.reduce((a, e) => a + e.totalSaidas, 0))}
                      </td>
                      <td className="p-2 text-right text-primaryDark">
                        {fmtReais(extratosFiltrados.reduce((a, e) => a + e.saldoAtual, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Extratos individuais expandidos */}
            {extratosFiltrados.filter((e) => e.movs.length > 0).map((e) => (
              <div key={e.id} className="bg-white rounded-xl shadow p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-primaryDark">{e.nome}</h3>
                  <div className="flex gap-4 text-right text-xs">
                    <span className="text-green-700 font-medium">↑ {fmtReais(e.totalEntradas)}</span>
                    <span className="text-red-700 font-medium">↓ {fmtReais(e.totalSaidas)}</span>
                    <span className="font-bold text-primaryDark">= {fmtReais(e.saldoAtual)}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b">
                        <th className="p-1 text-left">Data</th>
                        <th className="p-1 text-left">Obra</th>
                        <th className="p-1 text-left">Ref.</th>
                        <th className="p-1 text-left">Descrição</th>
                        <th className="p-1 text-right">Entrada</th>
                        <th className="p-1 text-right">Saída</th>
                        <th className="p-1 text-right font-semibold">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {e.movs.map((m, i) => (
                        <tr key={i} className={i % 2 === 1 ? "bg-gray-50" : ""}>
                          <td className="p-1 whitespace-nowrap">{fmtData(m.data)}</td>
                          <td className="p-1">{m.obra ?? "—"}</td>
                          <td className="p-1 whitespace-nowrap">
                            <span className={`px-1 py-0.5 rounded text-xs ${
                              m.tipo === "RETIRADA" ? "bg-red-100 text-red-700" :
                              m.tipo === "SALDO_INICIAL" ? "bg-gray-100 text-gray-500" :
                              "bg-green-100 text-green-700"
                            }`}>{m.referencia}</span>
                          </td>
                          <td className="p-1 max-w-[200px] truncate" title={m.descricao}>{m.descricao}</td>
                          <td className="p-1 text-right text-green-700">{m.entrada > 0 ? fmtReais(m.entrada) : "—"}</td>
                          <td className="p-1 text-right text-red-700">{m.saida > 0 ? fmtReais(m.saida) : "—"}</td>
                          <td className="p-1 text-right font-bold">{fmtReais(m.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
