import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { calcularFechamentoVale } from "@/lib/contratos/fechamentoVale";
import { FechamentoValePdf } from "@/lib/pdf/FechamentoValePdf";

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

  const f = await calcularFechamentoVale(supabase, contratoId, mes);
  if (!f) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });

  const buffer = await renderToBuffer(
    FechamentoValePdf({
      f,
      engenheiroNome: perfil.nome_completo ?? "",
      dataGeracao: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    })
  );
  const nome = `${f.fechamento ? "" : "previa-"}vales-contrato-${f.contrato.numero}-${mes}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome}"` },
  });
}
