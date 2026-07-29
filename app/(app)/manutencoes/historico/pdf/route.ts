import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { buscarDadosRelatorio } from "../relatorio-dados";
import { HistoricoManutencoesPdf } from "@/lib/pdf/HistoricoManutencoesPdf";
import {
  CATEGORIA_LABEL,
  PROBLEMA_LABEL,
  STATUS_LABEL,
  GARANTIA_LABEL,
  ORIGEM_LABEL,
  PRIORIDADE_LABEL,
} from "../../constants";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const resultado = await buscarDadosRelatorio(searchParams);

  if (!resultado.autorizado) {
    return NextResponse.json({ erro: "Acesso restrito." }, { status: 403 });
  }

  const partesFiltro: string[] = [];
  if (resultado.filtros.categoria) partesFiltro.push(`Categoria: ${CATEGORIA_LABEL[resultado.filtros.categoria] ?? resultado.filtros.categoria}`);
  if (resultado.filtros.problema) partesFiltro.push(`Problema: ${PROBLEMA_LABEL[resultado.filtros.problema] ?? resultado.filtros.problema}`);
  if (resultado.filtros.status) partesFiltro.push(`Situação: ${STATUS_LABEL[resultado.filtros.status] ?? resultado.filtros.status}`);
  if (resultado.filtros.garantia) partesFiltro.push(`Garantia: ${GARANTIA_LABEL[resultado.filtros.garantia] ?? resultado.filtros.garantia}`);
  if (resultado.filtros.origem) partesFiltro.push(`Origem: ${ORIGEM_LABEL[resultado.filtros.origem] ?? resultado.filtros.origem}`);
  if (resultado.filtros.prioridade) partesFiltro.push(`Prioridade: ${PRIORIDADE_LABEL[resultado.filtros.prioridade] ?? resultado.filtros.prioridade}`);
  if (resultado.filtros.de || resultado.filtros.ate) partesFiltro.push(`Período: ${resultado.filtros.de ?? "início"} a ${resultado.filtros.ate ?? "hoje"}`);
  if (resultado.filtros.q) partesFiltro.push(`Busca: "${resultado.filtros.q}"`);

  const buffer = await renderToBuffer(
    HistoricoManutencoesPdf({
      linhas: resultado.linhas,
      resumo: resultado.resumo,
      filtrosTexto: partesFiltro.join(" · "),
      dataEmissao: new Date().toLocaleString("pt-BR"),
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="historico-manutencoes.pdf"`,
    },
  });
}
