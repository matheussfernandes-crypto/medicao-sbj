import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { retencaoVigente, mesAtual } from "@/lib/contratos/util";
import { ContratoTipoPdf } from "@/lib/pdf/ContratoTipoPdf";

// PDF de 1 folha com os preços unitários acordados com o fornecedor de um contrato.
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { data: perfil } = await supabase.from("perfis").select("setor, status, nome_completo").eq("id", user.id).single();
  if (!perfil || perfil.status !== "aprovado" || !["ADMIN", "FINANCEIRO"].includes(perfil.setor)) {
    return NextResponse.json({ erro: "Acesso restrito." }, { status: 403 });
  }

  const contratoId = new URL(request.url).searchParams.get("contrato") || "";
  if (!contratoId) return NextResponse.json({ erro: "Informe o contrato." }, { status: 400 });

  const [{ data: c }, { data: precos }, { data: retencoes }] = await Promise.all([
    supabase
      .from("contratos")
      .select("numero, objeto, data_inicio, data_termino, observacoes, obras(nome), empresas_terceirizadas(nome, nome_empresarial, cnpj, contato, telefone, endereco, bairro, municipio, uf, cep)")
      .eq("id", contratoId)
      .maybeSingle(),
    supabase.from("contrato_precos").select("servico, unidade, valor_unitario").eq("contrato_id", contratoId).order("ordem"),
    supabase.from("contrato_retencoes").select("vigente_desde, percent").eq("contrato_id", contratoId),
  ]);
  if (!c) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });

  const e: any = (c as any).empresas_terceirizadas ?? {};
  const endereco = [e.endereco, e.bairro, [e.municipio, e.uf].filter(Boolean).join("/"), e.cep ? `CEP ${e.cep}` : null]
    .filter(Boolean)
    .join(" · ");

  const buffer = await renderToBuffer(
    ContratoTipoPdf({
      d: {
        numero: c.numero,
        obra: (c as any).obras?.nome ?? "",
        objeto: c.objeto,
        dataInicio: c.data_inicio,
        dataTermino: c.data_termino,
        retencaoPct: retencaoVigente((retencoes ?? []) as any, mesAtual()),
        observacoes: c.observacoes,
        empresa: {
          nome: e.nome ?? "",
          nomeEmpresarial: e.nome_empresarial ?? null,
          cnpj: e.cnpj ?? null,
          contato: e.contato ?? null,
          telefone: e.telefone ?? null,
          endereco: endereco || null,
        },
        precos: (precos ?? []).map((p) => ({ servico: p.servico, unidade: p.unidade, valor_unitario: Number(p.valor_unitario) })),
      },
      engenheiroNome: perfil.nome_completo ?? "",
      dataGeracao: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    })
  );
  const nome = `contrato-tipo-${c.numero}-${(c as any).obras?.nome ?? ""}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nome}"` },
  });
}
