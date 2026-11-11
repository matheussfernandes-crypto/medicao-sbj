import { NextRequest, NextResponse } from "next/server";
import { erro, exigirPosvenda } from "@/lib/posvenda/server";

// Pós-venda: guarda uma foto (já reduzida no navegador) e devolve o id.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const r = await exigirPosvenda();
  if ("erro" in r) return r.erro;
  const corpo = await req.json().catch(() => null);
  const imagem = typeof corpo?.imagem === "string" ? corpo.imagem : "";
  if (!imagem.startsWith("data:image/") || imagem.length > 4000000) return erro("Foto inválida ou grande demais", 400);
  const id = crypto.randomUUID().replace(/-/g, "");
  const { error } = await r.supabase.from("posvenda_docs").insert({ colecao: "fotos", id, dados: { imagem }, atualizado_por: r.user.id });
  if (error) return erro("Não foi possível salvar a foto.", 500);
  return NextResponse.json({ id });
}
