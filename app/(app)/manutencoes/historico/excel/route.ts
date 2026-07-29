import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { buscarDadosRelatorio } from "../relatorio-dados";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const resultado = await buscarDadosRelatorio(searchParams);

  if (!resultado.autorizado) {
    return NextResponse.json({ erro: "Acesso restrito." }, { status: 403 });
  }

  const linhas = resultado.linhas.map((l) => ({
    Data: l.data,
    "Nº OS": l.numeroOS,
    Local: l.local,
    Categoria: l.categoria,
    Problema: l.problema,
    "Serviço executado": l.servicoExecutado,
    Responsável: l.responsavel,
    Situação: l.situacao,
    Garantia: l.garantia,
  }));

  const worksheet = XLSX.utils.json_to_sheet(linhas);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Histórico");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="historico-manutencoes.xlsx"`,
    },
  });
}
