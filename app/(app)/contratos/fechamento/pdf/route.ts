import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { calcularBoletim } from "@/lib/contratos/boletim";
import { BoletimContratoPdf } from "@/lib/pdf/BoletimContratoPdf";

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

  const b = await calcularBoletim(supabase, contratoId, mes);
  if (!b) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });

  const buffer = await renderToBuffer(
    BoletimContratoPdf({
      b,
      engenheiroNome: perfil.nome_completo ?? "",
      dataGeracao: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    })
  );
  const nome = `boletim-contrato-${b.contrato.numero}-${mes}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome}"` },
  });
}
