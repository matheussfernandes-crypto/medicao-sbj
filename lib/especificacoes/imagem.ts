// Onde está cada foto do módulo Especificações:
//   "catalogo/x.jpg" e "torre/x.jpg" -> fotos que vêm com o site (public/especificacoes/...)
//   "arq/x.jpg"                       -> enviada pelo site, no bucket privado "especificacoes" (precisa de URL assinada)
//   "data:image/..."                  -> foto embutida (só aparece durante a importação)
export const BUCKET_ESP = "especificacoes";

export const ehDoBucket = (img: string | null | undefined) => !!img && img.startsWith("arq/");

export function urlImg(img: string | null | undefined, assinadas: Record<string, string> = {}) {
  if (!img) return "";
  if (img.startsWith("data:")) return img;
  if (ehDoBucket(img)) return assinadas[img] ?? "";
  return "/especificacoes/" + img;
}

/** Gera as URLs assinadas (1 h) das fotos que estão no bucket. */
export async function assinarImagens(supabase: any, imgs: (string | null | undefined)[]) {
  const caminhos = Array.from(new Set(imgs.filter(ehDoBucket))) as string[];
  const out: Record<string, string> = {};
  if (!caminhos.length) return out;
  const { data } = await supabase.storage.from(BUCKET_ESP).createSignedUrls(caminhos, 3600);
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

/** Reduz a foto (lado maior 900 px, JPEG) antes de enviar. Roda no navegador. */
export async function reduzirFoto(arquivo: Blob, lado = 900): Promise<Blob> {
  const bmp = await createImageBitmap(arquivo);
  const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise((ok) => c.toBlob((b) => ok(b ?? arquivo), "image/jpeg", 0.85));
}

/** Envia a foto para o bucket e devolve o valor que vai no campo img ("arq/..."). Roda no navegador. */
export async function enviarFoto(supabase: any, arquivo: Blob): Promise<string> {
  const blob = await reduzirFoto(arquivo);
  const caminho = `arq/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET_ESP).upload(caminho, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error("Não foi possível enviar a foto: " + error.message);
  return caminho;
}
