import { NextResponse } from "next/server";
import { exigirPosvenda } from "@/lib/posvenda/server";

// Pós-venda: quem está logado (id e nome), para registrar autoria no histórico.
export const dynamic = "force-dynamic";

export async function GET() {
  const r = await exigirPosvenda();
  if ("erro" in r) return r.erro;
  return NextResponse.json({ id: r.user.id, nome: r.nome });
}
