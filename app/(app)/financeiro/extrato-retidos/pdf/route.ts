import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { ExtratoIndividualPdf, ExtratoGeralPdf, type MovimentacaoRetido, type PessoaExtrato } from "@/lib/pdf/ExtratoRetidosPdf";
import React from "react";

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
): MovimentacaoRetido[] {
  const movs: Omit<MovimentacaoRetido, "saldo">[] = [];

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

  for (const l of lancamentos) {
    const d = String(l.data ?? l.criado_em ?? "").slice(0, 10);
    if (dataInicio && d < dataInicio) continue;
    if (dataFim && d > dataFim) continue;
    if (obraId && l.obra_id !== obraId) continue;
    const pct = Number(l.retencao_pct_usado ?? 0);
    const entrada = Number(l.total_reais) * pct;
    if (entrada <= 0) continue;
    const desc = [l.servico, l.local].filter(Boolean).join(" – ") || l.detalhe_texto || "Medição";
    movs.push({
      data: d,
      tipo: l.tipo,
      referencia: l.tipo === "VALE_MEDICAO" ? "Vale+Medição" : "Medição",
      descricao: desc,
      obra: obras[l.obra_id] ?? null,
      entrada,
      saida: 0,
      responsavel: perfis[l.criado_por] ?? null,
    });
  }

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

  movs.sort((a, b) => a.data.localeCompare(b.data));
  let saldo = 0;
  return movs.map((m) => {
    saldo += m.entrada - m.saida;
    return { ...m, saldo };
  });
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data: meuPerfil } = await supabase.from("perfis").select("setor").eq("id", user.id).single();
  if (meuPerfil?.setor !== "FINANCEIRO" && meuPerfil?.setor !== "ADMIN") {
    return NextResponse.json({ erro: "Acesso restrito." }, { status: 403 });
  }

  const sp = new URL(request.url).searchParams;
  const pessoaId = sp.get("pessoaId") ?? "";
  const obraId = sp.get("obraId") ?? "";
  const dataInicio = sp.get("dataInicio") ?? "";
  const dataFim = sp.get("dataFim") ?? "";
  const situacao = sp.get("situacao") ?? "";

  const { data: obras } = await supabase.from("obras").select("id, nome");
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
    .select("id, pessoa_id, obra_id, valor, data, observacao, lancado_por");
  const { data: perfisData } = await supabase.from("perfis").select("id, nome_completo");

  const obraMap: Record<string, string> = {};
  for (const o of obras ?? []) obraMap[o.id] = o.nome;
  const perfilMap: Record<string, string> = {};
  for (const p of perfisData ?? []) perfilMap[p.id] = p.nome_completo ?? "—";

  const dataGeracao = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const periodoLabel = dataInicio || dataFim
    ? `${dataInicio ? dataInicio.split("-").reverse().join("/") : "início"} a ${dataFim ? dataFim.split("-").reverse().join("/") : "hoje"}`
    : "Todos os períodos";

  let pessoasFiltradas = pessoaId
    ? (pessoas ?? []).filter((p) => p.id === pessoaId)
    : (pessoas ?? []);

  const extratos: PessoaExtrato[] = pessoasFiltradas.map((p) => {
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
    return { id: p.id, nome: p.nome, movimentacoes: movs, totalEntradas, totalSaidas, saldoAtual };
  });

  let extratosFinal = extratos;
  if (situacao === "com_saldo") extratosFinal = extratos.filter((e) => e.saldoAtual > 0.005);
  if (situacao === "zerados") extratosFinal = extratos.filter((e) => e.saldoAtual <= 0.005);

  let pdfElement: React.ReactElement;
  if (pessoaId && extratosFinal.length === 1) {
    pdfElement = React.createElement(ExtratoIndividualPdf, {
      pessoa: extratosFinal[0],
      periodo: periodoLabel,
      dataGeracao,
    });
  } else {
    pdfElement = React.createElement(ExtratoGeralPdf, {
      pessoas: extratosFinal,
      periodo: periodoLabel,
      dataGeracao,
    });
  }

  const buffer = await renderToBuffer(pdfElement);
  const nomeArquivo = pessoaId && extratosFinal[0]
    ? `extrato-retidos-${extratosFinal[0].nome.replace(/\s+/g, "-").toLowerCase()}.pdf`
    : "extrato-retidos-geral.pdf";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nomeArquivo}"`,
    },
  });
}
