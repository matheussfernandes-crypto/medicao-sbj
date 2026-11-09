import { NextRequest, NextResponse } from "next/server";
import { BUCKET, agoraComFolga, dataUrlParaBytes, desdeValido, erro, exigirUsuario } from "@/lib/pos-obra/server";

// Módulo Pós-obra: vistorias.
// POST  -> grava UMA vistoria completa (mesmo formato de state.vistorias do módulo). Upsert pela chave
//          natural obra + apartamento + data: mandar de novo só atualiza, nunca duplica. Devolve as fotos
//          que o servidor ainda não tem, para o aparelho subir em /api/pos-obra/fotos.
// GET ?desde=ISO -> vistorias criadas/alteradas depois da data, no formato do módulo, com as assinaturas
//          (data URL) e um mapa { código da foto: link temporário } para o módulo guardar as fotos.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CAMPOS_PROPRIOS = new Set(["id", "buildingId", "unit", "date", "items", "responsavel", "email", "folha", "termo", "nomeProp", "nomeTec", "assin", "sync"]);
const ASSIN: [chave: "prop" | "tec" | "termo", coluna: string][] = [
  ["prop", "assinatura_proprietario"],
  ["tec", "assinatura_tecnico"],
  ["termo", "assinatura_termo"],
];

export async function POST(req: NextRequest) {
  const u = await exigirUsuario();
  if ("erro" in u) return u.erro;
  let v: any;
  try {
    v = await req.json();
  } catch {
    return erro("Corpo inválido", 400);
  }
  if (!v || !v.buildingId || !v.unit || !/^\d{4}-\d{2}-\d{2}/.test(String(v.date || ""))) {
    return erro("Vistoria sem obra, apartamento ou data", 400);
  }

  const extra: Record<string, unknown> = {};
  Object.keys(v).forEach((k) => {
    if (!CAMPOS_PROPRIOS.has(k)) extra[k] = v[k];
  });
  const payload = {
    id: v.id,
    buildingId: String(v.buildingId),
    unit: String(v.unit),
    date: String(v.date).slice(0, 10),
    responsavel: v.responsavel ?? null,
    email: v.email ?? null,
    nomeProp: v.nomeProp ?? null,
    nomeTec: v.nomeTec ?? null,
    folha: v.folha ?? null,
    termo: v.termo ?? null,
    extra,
    items: (Array.isArray(v.items) ? v.items : []).map((i: any) => ({
      id: i.id,
      ambiente: i.ambiente ?? "",
      tipo: i.tipo ?? "",
      descricao: i.descricao ?? "",
      feito: !!i.feito,
      feitoEm: i.feitoEm || "",
      fotos: Array.isArray(i.fotos) ? i.fotos.filter((f: any) => typeof f === "string" && f) : [],
    })),
  };

  const { data: res, error } = await u.supabase.rpc("posobra_salvar_vistoria", { v: payload });
  if (error) return erro(error.message);
  const vid: string = (res as any).id;

  // assinaturas (PNG): vão para o Storage; a tabela guarda o caminho
  const assin = v.assin || {};
  const colunas: Record<string, string> = {};
  for (const [chave, coluna] of ASSIN) {
    const arq = typeof assin[chave] === "string" && assin[chave] ? dataUrlParaBytes(assin[chave]) : null;
    if (!arq) continue;
    const caminho = `assinaturas/${vid}/${chave}.png`;
    const up = await u.supabase.storage.from(BUCKET).upload(caminho, arq.bytes, { contentType: "image/png", upsert: true });
    if (up.error) return erro("Assinatura: " + up.error.message);
    colunas[coluna] = caminho;
  }
  if (Object.keys(colunas).length) {
    const { error: e2 } = await u.supabase.from("posobra_vistorias").update(colunas).eq("id", vid);
    if (e2) return erro(e2.message);
  }

  return NextResponse.json({ ok: true, id: vid, fotosFaltando: (res as any).fotosFaltando ?? [] });
}

async function paraDataUrl(supabase: any, caminho: string | null): Promise<string> {
  if (!caminho) return "";
  const { data, error } = await supabase.storage.from(BUCKET).download(caminho);
  if (error || !data) return "";
  const buf = Buffer.from(await data.arrayBuffer());
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export async function GET(req: NextRequest) {
  const u = await exigirUsuario();
  if ("erro" in u) return u.erro;
  const desde = desdeValido(req.nextUrl.searchParams.get("desde"));
  const agora = agoraComFolga();

  const linhas: any[] = [];
  for (let de = 0; ; de += 200) {
    let q = u.supabase
      .from("posobra_vistorias")
      .select("*, posobra_pendencias(*, posobra_fotos(id, caminho))")
      .order("criado_em")
      .range(de, de + 199);
    if (desde) q = q.gt("atualizado_em", desde);
    const { data, error } = await q;
    if (error) return erro(error.message);
    linhas.push(...(data ?? []));
    if (!data || data.length < 200) break;
  }

  // links temporários das fotos (1 dia), em lotes
  const caminhos: { id: string; caminho: string }[] = [];
  linhas.forEach((l) => (l.posobra_pendencias || []).forEach((p: any) => (p.posobra_fotos || []).forEach((f: any) => f.caminho && caminhos.push({ id: f.id, caminho: f.caminho }))));
  const fotos: Record<string, string> = {};
  for (let i = 0; i < caminhos.length; i += 100) {
    const lote = caminhos.slice(i, i + 100);
    const { data } = await u.supabase.storage.from(BUCKET).createSignedUrls(lote.map((c) => c.caminho), 86400);
    (data ?? []).forEach((s: any, k: number) => {
      if (s?.signedUrl) fotos[lote[k].id] = s.signedUrl;
    });
  }

  const vistorias = await Promise.all(
    linhas.map(async (l) => {
      const [prop, tec, termo] = await Promise.all(ASSIN.map(([, col]) => paraDataUrl(u.supabase, l[col])));
      const v: Record<string, any> = {
        ...(l.dados || {}),
        id: l.id_local || l.id,
        buildingId: l.obra_id,
        unit: l.apartamento,
        date: String(l.data).slice(0, 10),
        items: (l.posobra_pendencias || [])
          .sort((a: any, b: any) => a.ordem - b.ordem)
          .map((p: any) => ({
            id: p.id_local || p.id,
            ambiente: p.ambiente,
            tipo: p.tipo,
            descricao: p.descricao,
            feito: !!p.feito,
            feitoEm: p.feito_em || "",
            fotos: (p.posobra_fotos || []).filter((f: any) => fotos[f.id]).map((f: any) => f.id),
          })),
      };
      if (l.responsavel) v.responsavel = l.responsavel;
      if (l.email) v.email = l.email;
      if (l.folha) v.folha = l.folha;
      if (l.termo) v.termo = l.termo;
      if (l.nome_proprietario !== null) v.nomeProp = l.nome_proprietario;
      if (l.nome_tecnico !== null) v.nomeTec = l.nome_tecnico;
      if (prop || tec || termo) v.assin = { prop, tec, termo };
      return v;
    })
  );

  return NextResponse.json({ agora, vistorias, fotos });
}
