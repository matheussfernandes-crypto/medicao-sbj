import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ItemCapa = { obra: string; detalhe: string };

// Junta vários PDFs num só, com uma capa simples (A4) listando as obras. Cada obra mantém o próprio cabeçalho e a própria numeração.
export async function juntarComCapa(pdfs: Uint8Array[], capa: { titulo: string; subtitulo: string; itens: ItemCapa[] }): Promise<Uint8Array> {
  const saida = await PDFDocument.create();
  const fonte = await saida.embedFont(StandardFonts.Helvetica);
  const negrito = await saida.embedFont(StandardFonts.HelveticaBold);
  const pg = saida.addPage([595.28, 841.89]);
  const verde = rgb(0.12, 0.29, 0.32);
  pg.drawRectangle({ x: 0, y: 841.89 - 120, width: 595.28, height: 120, color: verde });
  pg.drawRectangle({ x: 0, y: 841.89 - 124, width: 595.28, height: 4, color: rgb(0.96, 0.78, 0.3) });
  pg.drawText("SBJ Construtora e Incorporadora", { x: 48, y: 841.89 - 52, size: 11, font: fonte, color: rgb(0.8, 0.89, 0.9) });
  pg.drawText(capa.titulo, { x: 48, y: 841.89 - 88, size: 24, font: negrito, color: rgb(1, 1, 1) });
  pg.drawText(capa.subtitulo, { x: 48, y: 841.89 - 170, size: 11, font: fonte, color: rgb(0.4, 0.44, 0.48) });
  let y = 841.89 - 210;
  capa.itens.forEach((it, i) => {
    if (y < 60) return;
    pg.drawText(`${i + 1}. ${it.obra}`, { x: 48, y, size: 14, font: negrito, color: verde });
    pg.drawText(it.detalhe, { x: 66, y: y - 16, size: 10.5, font: fonte, color: rgb(0.35, 0.39, 0.43) });
    y -= 46;
  });
  for (const bytes of pdfs) {
    const doc = await PDFDocument.load(bytes);
    const paginas = await saida.copyPages(doc, doc.getPageIndices());
    paginas.forEach((p) => saida.addPage(p));
  }
  return saida.save();
}
