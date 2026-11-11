import { NextRequest, NextResponse } from "next/server";
import { dataUrlParaBytes } from "@/lib/pos-obra/server";
import { erro, exigirPosvenda } from "@/lib/posvenda/server";

// Pós-venda: devolve a foto guardada (usada nas miniaturas dos chamados).
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = await exigirPosvenda();
  if ("erro" in r) return r.erro;
  const { data, error } = await r.supabase.from("posvenda_docs").select("dados").eq("colecao", "fotos").eq("id", params.id).maybeSingle();
  if (error || !data) return erro("Foto não encontrada", 404);
  const pronto = dataUrlParaBytes(((data.dados as { imagem?: string }).imagem) ?? "");
  if (!pronto) return erro("Foto inválida", 500);
  return new NextResponse(new Uint8Array(pronto.bytes), { headers: { "Content-Type": pronto.tipo, "Cache-Control": "private, max-age=86400" } });
}
