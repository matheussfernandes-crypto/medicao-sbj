import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  FolhaMedicaoPdf,
  FolhaValePdf,
  type ItemMedicao,
  type ResumoMedicao,
  type ItemVale,
  type ResumoVale,
} from "@/lib/pdf/FolhaPdf";

// Gera o MESMO PDF que seria enviado por email ao finalizar a medição/vale do
// mês, mas só para conferência: não envia email, não salva no Storage e não
// grava registro em "fechamentos" — pode ser chamado várias vezes sem efeito
// colateral, enquanto o ADM ainda não tiver certeza de que os dados estão
// corretos.

function hoje() {
  return new Date().toLocaleDateString("pt-BR");
}

async function obterMestre(supabase: any, obraId: string) {
  const { data } = await supabase
    .from("pessoas")
    .select("nome")
    .eq("obra_id", obraId)
    .eq("papel", "MESTRE")
    .eq("status", "ATIVO")
    .limit(1)
    .maybeSingle();
  return data?.nome ?? null;
}

async function obterNomesLancadores(supabase: any, criadoPorIds: string[]): Promise<string[]> {
  if (!criadoPorIds.length) return [];
  const { data } = await supabase.from("perfis").select("id, nome_completo").in("id", criadoPorIds);
  const nomes: string[] = (data ?? []).map((c: any) => c.nome_completo).filter(Boolean);
  return Array.from(new Set(nomes));
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data: meuPerfil } = await supabase
    .from("perfis")
    .select("setor, status, nome_completo")
    .eq("id", user.id)
    .single();
  if (!meuPerfil || meuPerfil.status !== "aprovado" || meuPerfil.setor !== "ADMIN") {
    return NextResponse.json({ erro: "Acesso restrito ao ADM." }, { status: 403 });
  }
  const engenheiroNome = meuPerfil.nome_completo as string;

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo") === "vale" ? "vale" : "medicao";
  const obraId = searchParams.get("obraId") || "";
  const mes = searchParams.get("mes") || "";
  if (!obraId || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ erro: "Informe obraId e mes (YYYY-MM)." }, { status: 400 });
  }

  const { data: obra } = await supabase.from("obras").select("nome").eq("id", obraId).single();
  if (!obra) return NextResponse.json({ erro: "Obra não encontrada." }, { status: 404 });

  const mestreNome = await obterMestre(supabase, obraId);

  if (tipo === "medicao") {
    const { data: lista } = await supabase
      .from("lancamentos")
      .select(
        "id, tipo, pessoa_id, servico, local, detalhe_texto, valor_unitario_usado, quantidade, total_reais, valor_vale_hibrido, retencao_pct_usado, vale_real, criado_por"
      )
      .eq("obra_id", obraId).eq("mes_referencia", mes).eq("status", "APROVADO");

    const todos = lista ?? [];
    const medicoes = todos.filter((l) => l.tipo === "MEDICAO");
    const valesReais = todos.filter((l) => (l.tipo === "VALE" && l.vale_real) || l.tipo === "VALE_MEDICAO");

    if (!medicoes.length) {
      return NextResponse.json({ erro: "Nenhuma medição aprovada nesse mês/obra para visualizar." }, { status: 404 });
    }

    const pessoaIds = Array.from(new Set(todos.map((l) => l.pessoa_id)));
    const { data: pessoas } = pessoaIds.length
      ? await supabase.from("pessoas").select("id, nome").in("id", pessoaIds)
      : { data: [] as any[] };
    const nomePessoa: Record<string, string> = {};
    for (const p of pessoas ?? []) nomePessoa[p.id] = p.nome;

    const lancadores = await obterNomesLancadores(
      supabase,
      Array.from(new Set(medicoes.map((l) => l.criado_por).filter(Boolean))) as string[]
    );

    const itens: ItemMedicao[] = medicoes.map((l) => ({
      empreiteiro: nomePessoa[l.pessoa_id] ?? "—",
      servico: l.servico ?? "—",
      local: l.local ?? "—",
      valorUnitario: Number(l.valor_unitario_usado ?? 0),
      quantidadeTexto: l.detalhe_texto ?? String(l.quantidade ?? ""),
      total: Number(l.total_reais),
    }));

    const porPessoa: Record<string, { nome: string; total: number; pct: number; vale: number }> = {};
    for (const l of medicoes) {
      const pid = l.pessoa_id;
      if (!porPessoa[pid]) porPessoa[pid] = { nome: nomePessoa[pid] ?? "—", total: 0, pct: Number(l.retencao_pct_usado ?? 0), vale: 0 };
      porPessoa[pid].total += Number(l.total_reais);
    }
    for (const l of valesReais) {
      const pid = l.pessoa_id;
      if (!porPessoa[pid]) porPessoa[pid] = { nome: nomePessoa[pid] ?? "—", total: 0, pct: 0, vale: 0 };
      porPessoa[pid].vale += l.tipo === "VALE_MEDICAO" ? Number(l.valor_vale_hibrido ?? 0) : Number(l.total_reais);
    }

    const resumo: ResumoMedicao[] = Object.values(porPessoa).map((p) => {
      const retido = p.total * p.pct;
      return { nome: p.nome, retido, pct: p.pct, total: p.total, vale: p.vale, totalPagar: p.total - retido - p.vale };
    });

    const somaTotal = resumo.reduce((s, r) => s + r.total, 0);
    const somaRetido = resumo.reduce((s, r) => s + r.retido, 0);
    const somaVale = resumo.reduce((s, r) => s + r.vale, 0);
    const somaPagar = resumo.reduce((s, r) => s + r.totalPagar, 0);

    const buffer = await renderToBuffer(
      FolhaMedicaoPdf({
        obraNome: obra.nome,
        mes,
        itens,
        resumo,
        somaTotal,
        somaRetido,
        somaVale,
        somaPagar,
        mestreNome,
        lancadores,
        engenheiroNome,
        dataGeracao: hoje(),
      })
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="previa-medicao-${obra.nome}-${mes}.pdf"`,
      },
    });
  }

  // tipo === "vale"
  const { data: lista } = await supabase
    .from("lancamentos")
    .select(
      "id, tipo, pessoa_id, servico, detalhe_texto, total_reais, valor_vale_hibrido, valor_bruto, retencao_item, retencao_pct_usado, vale_real, criado_por"
    )
    .eq("obra_id", obraId).eq("mes_referencia", mes).in("tipo", ["VALE", "VALE_MEDICAO"]).eq("status", "APROVADO");

  const vales = lista ?? [];
  if (!vales.length) {
    return NextResponse.json({ erro: "Nenhum vale aprovado nesse mês/obra para visualizar." }, { status: 404 });
  }

  const pessoaIds = Array.from(new Set(vales.map((l) => l.pessoa_id)));
  const { data: pessoas } = pessoaIds.length
    ? await supabase.from("pessoas").select("id, nome").in("id", pessoaIds)
    : { data: [] as any[] };
  const nomePessoa: Record<string, string> = {};
  for (const p of pessoas ?? []) nomePessoa[p.id] = p.nome;

  const lancadores = await obterNomesLancadores(
    supabase,
    Array.from(new Set(vales.map((l) => l.criado_por).filter(Boolean))) as string[]
  );

  const itens: ItemVale[] = vales.map((l) => {
    if (l.tipo === "VALE_MEDICAO") {
      const bruto = Number(l.total_reais);
      const retido = bruto * Number(l.retencao_pct_usado ?? 0);
      const liquido = bruto - retido;
      const valorVale = Number(l.valor_vale_hibrido ?? 0);
      return {
        empreiteiro: nomePessoa[l.pessoa_id] ?? "—",
        descricao: l.detalhe_texto ?? "Vale + Medição",
        ehCorrecao: false,
        hibrido: true,
        valorValeHibrido: valorVale,
        medicaoComplementarBruto: bruto,
        medicaoComplementarRetido: retido,
        medicaoComplementarLiquido: liquido,
        total: valorVale + liquido,
      };
    }
    return {
      empreiteiro: nomePessoa[l.pessoa_id] ?? "—",
      descricao: l.detalhe_texto ?? l.servico ?? "Vale de correção",
      ehCorrecao: !l.vale_real,
      total: Number(l.total_reais),
    };
  });

  const porPessoa: Record<string, { nome: string; valeReal: number; correcaoBruto: number; correcaoRetido: number; correcaoLiquido: number }> = {};
  for (const l of vales) {
    const pid = l.pessoa_id;
    if (!porPessoa[pid]) porPessoa[pid] = { nome: nomePessoa[pid] ?? "—", valeReal: 0, correcaoBruto: 0, correcaoRetido: 0, correcaoLiquido: 0 };
    if (l.tipo === "VALE_MEDICAO") {
      const bruto = Number(l.total_reais);
      const retido = bruto * Number(l.retencao_pct_usado ?? 0);
      porPessoa[pid].valeReal += Number(l.valor_vale_hibrido ?? 0);
      porPessoa[pid].correcaoBruto += bruto;
      porPessoa[pid].correcaoRetido += retido;
      porPessoa[pid].correcaoLiquido += bruto - retido;
    } else if (l.vale_real) {
      porPessoa[pid].valeReal += Number(l.total_reais);
    } else {
      porPessoa[pid].correcaoBruto += Number(l.valor_bruto ?? l.total_reais);
      porPessoa[pid].correcaoRetido += Number(l.retencao_item ?? 0);
      porPessoa[pid].correcaoLiquido += Number(l.total_reais);
    }
  }

  const resumo: ResumoVale[] = Object.values(porPessoa).map((p) => ({
    ...p,
    totalGeral: p.valeReal + p.correcaoLiquido,
  }));

  const somaReal = resumo.reduce((s, r) => s + r.valeReal, 0);
  const somaCorrecaoBruto = resumo.reduce((s, r) => s + r.correcaoBruto, 0);
  const somaCorrecaoRetido = resumo.reduce((s, r) => s + r.correcaoRetido, 0);
  const somaCorrecaoLiquido = resumo.reduce((s, r) => s + r.correcaoLiquido, 0);
  const somaGeral = resumo.reduce((s, r) => s + r.totalGeral, 0);

  const buffer = await renderToBuffer(
    FolhaValePdf({
      obraNome: obra.nome,
      mes,
      itens,
      resumo,
      somaReal,
      somaCorrecaoBruto,
      somaCorrecaoRetido,
      somaCorrecaoLiquido,
      somaGeral,
      mestreNome,
      lancadores,
      engenheiroNome,
      dataGeracao: hoje(),
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="previa-vale-${obra.nome}-${mes}.pdf"`,
    },
  });
}
