import { NextRequest, NextResponse } from "next/server";
import { BUCKET, erro, exigirUsuario } from "@/lib/pos-obra/server";

// Módulo Pós-obra: sobe UMA foto de pendência (multipart: "id" = código da foto no módulo, "arquivo" = JPEG).
// A foto já precisa estar registrada pela gravação da vistoria (POST /api/pos-obra/vistorias).
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const u = await exigirUsuario();
  if ("erro" in u) return u.erro;
  const form = await req.formData().catch(() => null);
  const id = String(form?.get("id") || "");
  const arquivo = form?.get("arquivo");
  if (!/^[\w-]{1,80}$/.test(id) || !arquivo || typeof arquivo === "string") return erro("Foto inválida", 400);

  const { data: foto, error } = await u.supabase
    .from("posobra_fotos")
    .select("id, caminho, posobra_pendencias(vistoria_id)")
    .eq("id", id)
    .maybeSingle();
  if (error) return erro(error.message);
  if (!foto) return erro("Foto não registrada em nenhuma vistoria", 404);
  if (foto.caminho) return NextResponse.json({ ok: true, caminho: foto.caminho });

  const vid = (foto as any).posobra_pendencias?.vistoria_id;
  const caminho = `fotos/${vid}/${id}.jpg`;
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const up = await u.supabase.storage.from(BUCKET).upload(caminho, bytes, { contentType: arquivo.type || "image/jpeg", upsert: true });
  if (up.error) return erro(up.error.message);

  const { error: e2 } = await u.supabase.from("posobra_fotos").update({ caminho }).eq("id", id);
  if (e2) return erro(e2.message);
  // a vistoria "mudou" para os outros aparelhos receberem a foto
  await u.supabase.from("posobra_vistorias").update({ atualizado_em: new Date().toISOString() }).eq("id", vid);

  return NextResponse.json({ ok: true, caminho });
}
