import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { calcularBoletim } from "@/lib/contratos/boletim";
import { BoletimContratoPdf } from "@/lib/pdf/BoletimContratoPdf";
import { nomeMedicaoContrato, numeroDocumentoContrato, disposicao } from "@/lib/pdf/nomeArquivo";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { data: perfil } = await supabase.from("perfis").select("setor, status, nome_completo").eq("id", user.id).single();
  if (!perfil || perfil.status !== "aprovado" || !["ADMIN", "FINANCEIRO"].includes(perfil.setor)) {
    return NextResponse.json({ erro: "Acesso restrito." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const contratoId = searchParams.get("contrato") || "";
  const mes = searchParams.get("mes") || "";
  if (!contratoId || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ erro: "Informe contrato e mes (AAAA-MM)." }, { status: 400 });
  }

  const previa = searchParams.get("previa") || undefined;
  const seq = Number(searchParams.get("seq")) || undefined;
  const b = await calcularBoletim(supabase, contratoId, mes, { previaLancamentoId: previa, seq });
  if (!b) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });

  const buffer = await renderToBuffer(
    BoletimContratoPdf({
      b,
      engenheiroNome: perfil.nome_completo ?? "",
      dataGeracao: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    })
  );
  const nome = nomeMedicaoContrato({
    numero: await numeroDocumentoContrato(supabase, contratoId, mes, "MEDICAO", b.sequencia),
    objeto: b.contrato.objeto,
    obra: b.contrato.obras?.nome,
    mes,
    final: b.retido > 0 ? "COM RETIDO" : "SEM RETIDO",
    previa: !b.fechamento,
  });
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": disposicao(nome) },
  });
}
