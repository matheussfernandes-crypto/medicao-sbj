import { NextResponse } from "next/server";
import { exigirPosvenda } from "@/lib/posvenda/server";

// Pós-venda: id e nome dos usuários aprovados (sem e-mail), para mostrar quem fez cada registro.
export const dynamic = "force-dynamic";

export async function GET() {
  const r = await exigirPosvenda();
  if ("erro" in r) return r.erro;
  const { data } = await r.supabase.from("perfis").select("id, nome_completo, email").eq("status", "aprovado");
  return NextResponse.json((data ?? []).map((p) => ({ id: p.id, nome: p.nome_completo || p.email || "Sem nome" })));
}
