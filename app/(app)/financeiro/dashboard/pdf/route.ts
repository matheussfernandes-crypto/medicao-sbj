import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { RelatorioGastosPdf } from "@/lib/pdf/RelatorioGastosPdf";

function mesAtualISO() {
  return new Date().toISOString().slice(0, 7);
}

function mesLabelFmt(mes: string) {
  const [ano, m] = mes.split("-");
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[Number(m) - 1] ?? m}/${ano}`;
}

function ultimosMeses(qtd: number, mesFinalISO: string): string[] {
  const meses: string[] = [];
  const [anoStr, mesStr] = mesFinalISO.split("-");
  const d = new Date(Number(anoStr), Number(mesStr) - 1, 1);
  for (let i = 0; i < qtd; i++) {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    meses.unshift(`${ano}-${mes}`);
    d.setMonth(d.getMonth() - 1);
  }
  return meses;
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data: meuPerfil } = await supabase.from("perfis").select("setor").eq("id", user.id).single();
  if (meuPerfil?.setor !== "FINANCEIRO" && meuPerfil?.setor !== "ADMIN") {
    return NextResponse.json({ erro: "Acesso restrito ao Financeiro e ADM." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const mesParam = searchParams.get("mes") || "";
  const mesSelecionado = /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : mesAtualISO();

  const { data: obras } = await supabase.from("obras").select("id, nome");
  const nomeObra: Record<string, string> = {};
  for (const o of obras ?? []) nomeObra[o.id] = o.nome;

  const { data: lancamentos } = await supabase
    .from("lancamentos")
    .select(
      "obra_id, pessoa_id, mes_referencia, tipo, total_reais, valor_vale_hibrido, valor_bruto, retencao_item, retencao_pct_usado, vale_real, status"
    )
    .eq("status", "APROVADO");

  const todos = lancamentos ?? [];
  const meses6 = ultimosMeses(6, mesSelecionado);

  // Mesma regra do Dashboard Financeiro: "valeReal" é só o adiantamento puro,
  // que não entra no gasto da obra (já é descontado no fechamento da medição
  // do mesmo mês). "valeHibrido" é a parte de Vale + Medição complementar, que
  // é gasto extra de fato e entra no total.
  type Resumo = { medicao: number; valeReal: number; valeHibrido: number; valeCorrecao: number };
  const porObraMes: Record<string, Resumo> = {};
  for (const obraId of Object.keys(nomeObra)) porObraMes[obraId] = { medicao: 0, valeReal: 0, valeHibrido: 0, valeCorrecao: 0 };

  const porMes: Record<string, number> = {};
  for (const m of meses6) porMes[m] = 0;

  // Mesma lógica de composição (pizza) e contagem de empreiteiros por obra usada
  // no Dashboard Financeiro — replicada aqui para que o PDF da diretoria mostre os
  // mesmos dois indicadores, e não só a tabela de gasto por obra.
  let compMedicoesLiquido = 0;
  let compRetidos = 0;
  let compVales = 0;
  let compCorrecoes = 0;
  const empreiteirosPorObra: Record<string, Set<string>> = {};
  const empreiteirosTotalMes = new Set<string>();

  for (const l of todos) {
    const valor = Number(l.total_reais ?? 0);
    // "Vale + Medição": a parte de medição (valor, = total_reais) entra no balde
    // "medicao"; a parte de vale (valorValeHibrido) entra no balde "valeReal" — os
    // dois contam normalmente no total do mês, como qualquer medição/vale aprovado.
    const valorValeHibrido = l.tipo === "VALE_MEDICAO" ? Number(l.valor_vale_hibrido ?? 0) : 0;
    if (l.mes_referencia === mesSelecionado) {
      if (!porObraMes[l.obra_id]) porObraMes[l.obra_id] = { medicao: 0, valeReal: 0, valeHibrido: 0, valeCorrecao: 0 };
      if (l.tipo === "MEDICAO") porObraMes[l.obra_id].medicao += valor;
      else if (l.tipo === "VALE_MEDICAO") {
        porObraMes[l.obra_id].medicao += valor;
        porObraMes[l.obra_id].valeHibrido += valorValeHibrido;
      } else if (l.vale_real) porObraMes[l.obra_id].valeReal += valor;
      else porObraMes[l.obra_id].valeCorrecao += valor;

      if (!empreiteirosPorObra[l.obra_id]) empreiteirosPorObra[l.obra_id] = new Set();
      if (l.pessoa_id) {
        empreiteirosPorObra[l.obra_id].add(l.pessoa_id);
        empreiteirosTotalMes.add(l.pessoa_id);
      }

      const pct = Number(l.retencao_pct_usado ?? 0);
      if (l.tipo === "MEDICAO") {
        const retido = valor * pct;
        compRetidos += retido;
        compMedicoesLiquido += valor - retido;
      } else if (l.tipo === "VALE_MEDICAO") {
        const retido = valor * pct;
        compRetidos += retido;
        compCorrecoes += valor - retido;
        compVales += valorValeHibrido;
      } else if (l.vale_real) {
        compVales += valor;
      } else {
        compRetidos += Number(l.retencao_item ?? 0);
        compCorrecoes += valor;
      }
    }
    if (l.mes_referencia in porMes) {
      porMes[l.mes_referencia] += valor + valorValeHibrido;
    }
  }

  const totalComposicao = compMedicoesLiquido + compRetidos + compVales + compCorrecoes;
  const composicao = [
    { categoria: "Medições", valor: compMedicoesLiquido },
    { categoria: "Vales", valor: compVales },
    { categoria: "Correções", valor: compCorrecoes },
    { categoria: "Retidos", valor: compRetidos },
  ].map((c) => ({ ...c, pct: totalComposicao > 0 ? (c.valor / totalComposicao) * 100 : 0 }));

  const linhasEmpreiteiros = Object.keys(nomeObra)
    .map((id) => ({ nome: nomeObra[id], qtd: empreiteirosPorObra[id]?.size ?? 0 }))
    .filter((o) => o.qtd > 0)
    .sort((a, b) => b.qtd - a.qtd);
  const totalEmpreiteiros = empreiteirosTotalMes.size;

  const obraIds = Object.keys(nomeObra).filter((id) => {
    const r = porObraMes[id];
    return r && (r.medicao + r.valeReal + r.valeHibrido + r.valeCorrecao) > 0;
  });

  const linhasObra = obraIds
    .map((id) => {
      const r = porObraMes[id];
      // Vale real puro fica fora do total (já embutido na medição); o vale
      // híbrido (vale + medição complementar) entra junto com a coluna de
      // vale de correção, já que ambos são pagos integralmente no fechamento
      // de vale, sem desconto posterior.
      const valeCorrecaoExibido = r.valeHibrido + r.valeCorrecao;
      const total = r.medicao + valeCorrecaoExibido;
      return { nome: nomeObra[id], medicao: r.medicao, valeReal: r.valeReal, valeCorrecao: valeCorrecaoExibido, total };
    })
    .sort((a, b) => b.total - a.total);

  const totalGeral = linhasObra.reduce((s, l) => s + l.total, 0);
  const linhasMes = meses6.map((m) => ({ mes: mesLabelFmt(m), total: porMes[m] }));

  const dataGeracao = new Date().toLocaleDateString("pt-BR");

  const buffer = await renderToBuffer(
    RelatorioGastosPdf({
      mesLabel: mesLabelFmt(mesSelecionado),
      linhasObra,
      totalGeral,
      linhasMes,
      composicao,
      linhasEmpreiteiros,
      totalEmpreiteiros,
      dataGeracao,
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-gastos-${mesSelecionado}.pdf"`,
    },
  });
}
