import { NextRequest, NextResponse } from "next/server";
import { COLECOES, erro, exigirPosvenda } from "@/lib/posvenda/server";
import { propagaVisita, semTravar } from "@/lib/google-agenda";

// Pós-venda: listar, gravar e excluir os documentos de uma coleção.
export const dynamic = "force-dynamic";

type Ctx = { params: { colecao: string } };
const valida = (c: string) => ((COLECOES as readonly string[]).includes(c) ? c : null);

export async function GET(_req: NextRequest, { params }: Ctx) {
  const col = valida(params.colecao);
  if (!col) return erro("Coleção inexistente", 404);
  const r = await exigirPosvenda();
  if ("erro" in r) return r.erro;
  const itens: { id: string; dados: unknown }[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await r.supabase.from("posvenda_docs").select("id, dados").eq("colecao", col).order("id").range(de, de + 999);
    if (error) return erro("Não foi possível ler os dados.");
    itens.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return NextResponse.json(itens);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const col = valida(params.colecao);
  if (!col) return erro("Coleção inexistente", 404);
  const r = await exigirPosvenda();
  if ("erro" in r) return r.erro;
  const corpo = await req.json().catch(() => null);
  if (!corpo || typeof corpo.id !== "string" || !corpo.id || !corpo.dados || typeof corpo.dados !== "object") return erro("Dados inválidos", 400);
  const modo = corpo.modo === "merge" ? "merge" : "set";
  const { error } = await r.supabase.rpc("posvenda_gravar", { p_colecao: col, p_id: corpo.id, p_dados: corpo.dados, p_modo: modo });
  if (error) return erro("Não foi possível gravar.", 500);
  // visita nova ou alterada: vai também para o Google Agenda de quem conectou (sem travar o salvamento)
  if (col === "agenda") await semTravar(propagaVisita(r.supabase, corpo.id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const col = valida(params.colecao);
  if (!col) return erro("Coleção inexistente", 404);
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return erro("Falta o id", 400);
  const r = await exigirPosvenda();
  if ("erro" in r) return r.erro;
  const { error } = await r.supabase.from("posvenda_docs").delete().eq("colecao", col).eq("id", id);
  if (error) return erro("Não foi possível excluir.", 500);
  if (col === "agenda") await semTravar(propagaVisita(r.supabase, id));
  return NextResponse.json({ ok: true });
}
