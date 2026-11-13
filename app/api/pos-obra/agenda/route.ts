import { NextRequest, NextResponse } from "next/server";
import { erro, exigirUsuario } from "@/lib/pos-obra/server";

// Pós-obra: agenda de vistorias de entrega (marcar o dia/horário/apartamento/proprietário).
// Guarda na tabela genérica posvenda_docs, coleção "vistoria_agenda" (nenhuma tabela nova; não toca nas
// vistorias, pendências nem nos outros dados). GET lista, POST grava/atualiza um item, DELETE remove um item.
export const dynamic = "force-dynamic";

const COLECAO = "vistoria_agenda";
const STATUS = ["agendada", "realizada", "cancelada"];

export async function GET() {
  const u = await exigirUsuario();
  if ("erro" in u) return u.erro;
  const itens: { id: string; dados: Record<string, unknown> }[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await u.supabase.from("posvenda_docs").select("id, dados").eq("colecao", COLECAO).order("id").range(de, de + 999);
    if (error) return erro("Não foi possível ler a agenda.");
    itens.push(...((data ?? []) as { id: string; dados: Record<string, unknown> }[]));
    if (!data || data.length < 1000) break;
  }
  return NextResponse.json({ itens: itens.map((i) => ({ ...i.dados, id: i.id })) });
}

export async function POST(req: NextRequest) {
  const u = await exigirUsuario();
  if ("erro" in u) return u.erro;
  const corpo = await req.json().catch(() => null);
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  const d = corpo?.dados;
  if (!id || !/^[\w-]{3,60}$/.test(id) || !d || typeof d !== "object") return erro("Dados inválidos", 400);
  if (!d.buildingId || !String(d.unit || "").trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(d.date || ""))) return erro("Informe obra, apartamento e data.", 400);
  if (d.hora && !/^\d{2}:\d{2}$/.test(String(d.hora))) return erro("Horário inválido", 400);
  const dados = {
    buildingId: String(d.buildingId),
    buildingNome: String(d.buildingNome || "").slice(0, 120),
    unit: String(d.unit).trim().slice(0, 20),
    date: String(d.date),
    hora: String(d.hora || ""),
    nome: String(d.nome || "").slice(0, 120),
    obs: String(d.obs || "").slice(0, 500),
    status: STATUS.includes(String(d.status)) ? String(d.status) : "agendada",
    vistoriaId: d.vistoriaId ? String(d.vistoriaId).slice(0, 60) : "",
    resp: String(d.resp || "").slice(0, 80),
    realizadaEm: d.realizadaEm ? String(d.realizadaEm).slice(0, 40) : "",
    criadoEm: d.criadoEm ? String(d.criadoEm).slice(0, 40) : new Date().toISOString(),
    criadoPor: d.criadoPor ? String(d.criadoPor).slice(0, 80) : "",
  };
  const { error } = await u.supabase.rpc("posvenda_gravar", { p_colecao: COLECAO, p_id: id, p_dados: dados, p_modo: "set" });
  if (error) return erro("Não foi possível gravar na agenda.");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const u = await exigirUsuario();
  if ("erro" in u) return u.erro;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return erro("Falta o id", 400);
  const { error } = await u.supabase.from("posvenda_docs").delete().eq("colecao", COLECAO).eq("id", id);
  if (error) return erro("Não foi possível excluir.");
  return NextResponse.json({ ok: true });
}
