import { NextRequest, NextResponse } from "next/server";
import { gravarEmpreendimento, listarEmpreendimentos } from "@/lib/posvenda/empreendimentos";
import { erro, exigirPosvenda } from "@/lib/posvenda/server";

// Pós-venda: empreendimentos são as obras do Pós-obra (uma lista só).
export const dynamic = "force-dynamic";

export async function GET() {
  const r = await exigirPosvenda();
  if ("erro" in r) return r.erro;
  try {
    return NextResponse.json(await listarEmpreendimentos(r.supabase));
  } catch (e: any) {
    return erro(e?.message || "Não foi possível ler os empreendimentos.");
  }
}

export async function POST(req: NextRequest) {
  const r = await exigirPosvenda();
  if ("erro" in r) return r.erro;
  const corpo = await req.json().catch(() => null);
  if (!corpo || typeof corpo.id !== "string" || !corpo.id || !corpo.dados || typeof corpo.dados !== "object") return erro("Dados inválidos", 400);
  try {
    await gravarEmpreendimento(r.supabase, r.user.id, corpo.id, corpo.dados);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return erro(e?.message || "Não foi possível gravar o empreendimento.");
  }
}

export async function DELETE() {
  return erro("Empreendimentos são cadastrados em Pós-obra e não podem ser excluídos por aqui.", 400);
}
