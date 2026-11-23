// Desenho esquemático (SVG) do box / sacada / guarda-corpo, montado pelos campos do item de vidros.
// Trazido da Torre FG (esquemaVidro). Devolve o texto do SVG; só entram números e cores das tabelas abaixo.
import { fold, numPt, type Vidro } from "./regras";

const COR_PERFIL: Record<string, string> = {
  cromado: "#aab1b8", "preto fosco": "#1d1d1d", niquel: "#8b8f94", "dourado escovado": "#b79858", "grafite escovado": "#474a4f", branco: "#e6e6e6",
  bronze: "#7a5a3e", "aluminio natural": "#b3b5b8",
};
const COR_VIDRO: Record<string, [string, number]> = {
  incolor: ["#e0f2f5", 0.9], fume: ["#8c989d", 0.65], bronze: ["#c2a082", 0.65], verde: ["#b6dac8", 0.8], jateado: ["#e9ecee", 1], canelado: ["#dff1f4", 0.9],
  serigrafado: ["#dde6e8", 0.9], espelhado: ["#c5cacf", 0.95],
};
const r1 = (n: number) => Math.round(n * 10) / 10;

export function esquemaVidro(material: string, d: Vidro): string {
  const tipo = fold(material || "");
  const alt = numPt(d.altura), larg = numPt(d.largura);
  const abrir = /abrir|pivot|porta/.test(tipo), canto = /canto/.test(tipo), guarda = /guarda/.test(tipo);
  const n = Math.max(1, Math.min(10, parseInt(String(d.folhas ?? ""), 10) || (guarda ? 3 : 2)));
  const cor = Math.min(n, parseInt(String(d.correr ?? ""), 10) || 0);
  const perfil = COR_PERFIL[fold(d.perfil || "")] || "#8c9196";
  const [vf, va] = COR_VIDRO[fold(d.vidro || "")] || COR_VIDRO.incolor;
  const asp = alt && larg ? Math.min(1.7, Math.max(0.3, alt / larg)) : 0.62;
  let W = 170, H = 105;
  if (asp >= 1) { H = 110; W = Math.max(60, H / asp); } else { W = 170; H = Math.max(42, W * asp); }
  const X = 14 + (170 - W) / 2, Y = 16 + (110 - H) / 2, pw = W / n;
  const esq = Math.ceil((n - cor) / 2), dir = n - cor - esq, sem = /^sem/.test(fold(d.puxador || ""));
  const seta = (x: number, y: number, para: number) =>
    `<g stroke="#c0392b" fill="#c0392b" stroke-width="1.6"><line x1="${r1(x - 9 * para)}" y1="${r1(y)}" x2="${r1(x + 7 * para)}" y2="${r1(y)}"/><polygon points="${r1(x + 11 * para)},${r1(y)} ${r1(x + 5 * para)},${r1(y - 3.4)} ${r1(x + 5 * para)},${r1(y + 3.4)}" stroke="none"/></g>`;
  let g = "";
  for (let i = 0; i < n; i++) {
    const x0 = X + i * pw, desliza = i >= esq && i < esq + cor && !abrir, porta = abrir && i === n - 1;
    g += `<rect x="${r1(x0)}" y="${r1(Y)}" width="${r1(pw)}" height="${r1(H)}" fill="${vf}" fill-opacity="${va}" stroke="${perfil}" stroke-width="2.4"/>`;
    g += `<path d="M${r1(x0 + pw * 0.2)},${r1(Y + H * 0.08)} L${r1(x0 + pw * 0.55)},${r1(Y + H * 0.08)} L${r1(x0 + pw * 0.2)},${r1(Y + H * 0.5)} Z" fill="#fff" fill-opacity=".35"/>`;
    if (desliza) {
      const rel = cor === n ? (i % 2 ? 1 : -1) : cor === 1 ? (esq > dir ? -1 : 1) : i - esq < cor / 2 ? -1 : 1;
      g += seta(x0 + pw / 2, Y + H * 0.62, rel);
      if (!sem) g += `<circle cx="${r1(rel < 0 ? x0 + 5 : x0 + pw - 5)}" cy="${r1(Y + H * 0.45)}" r="2.6" fill="${perfil === "#1d1d1d" ? "#111" : "#444"}"/>`;
    } else if (porta) {
      g += `<path d="M${r1(x0 + pw * 0.75)},${r1(Y + H * 0.7)} C${r1(x0 + pw * 0.25)},${r1(Y + H * 0.95)} ${r1(x0 + pw * 0.2)},${r1(Y + H * 0.45)} ${r1(x0 + pw * 0.55)},${r1(Y + H * 0.5)}" fill="none" stroke="#c0392b" stroke-width="1.6"/><polygon points="${r1(x0 + pw * 0.55)},${r1(Y + H * 0.5)} ${r1(x0 + pw * 0.66)},${r1(Y + H * 0.43)} ${r1(x0 + pw * 0.66)},${r1(Y + H * 0.58)}" fill="#c0392b"/>`;
      if (!sem) g += `<circle cx="${r1(x0 + 5)}" cy="${r1(Y + H * 0.45)}" r="2.6" fill="#444"/>`;
    } else if (pw > 24) g += `<text x="${r1(x0 + pw / 2)}" y="${r1(Y + H - 5)}" text-anchor="middle" font-size="6.5" font-family="Arial" fill="#6b7a80">FIXO</text>`;
  }
  g += `<rect x="${r1(X - 2)}" y="${r1(Y - 5)}" width="${r1(W + 4)}" height="5" rx="1" fill="${perfil}"/>`;
  if (guarda && /bot/.test(fold(d.sistema || ""))) for (let i = 0; i <= n; i++) for (const yy of [Y + 7, Y + H - 7]) g += `<circle cx="${r1(X + i * pw)}" cy="${r1(yy)}" r="2.2" fill="${perfil}"/>`;
  if (canto) g += `<line x1="${r1(X + W / 2)}" y1="${r1(Y - 5)}" x2="${r1(X + W / 2)}" y2="${r1(Y + H)}" stroke="${perfil}" stroke-width="4"/><text x="${r1(X + W / 2)}" y="${r1(Y - 8)}" text-anchor="middle" font-size="7" font-family="Arial" fill="#6b7a80">CANTO</text>`;
  if (larg) g += `<g stroke="#c0392b" stroke-width=".9" fill="#c0392b"><line x1="${r1(X)}" y1="${r1(Y + H + 11)}" x2="${r1(X + W)}" y2="${r1(Y + H + 11)}"/><line x1="${r1(X)}" y1="${r1(Y + H + 7)}" x2="${r1(X)}" y2="${r1(Y + H + 15)}"/><line x1="${r1(X + W)}" y1="${r1(Y + H + 7)}" x2="${r1(X + W)}" y2="${r1(Y + H + 15)}"/><text x="${r1(X + W / 2)}" y="${r1(Y + H + 23)}" text-anchor="middle" font-size="8.5" font-family="Arial" stroke="none">${larg}</text></g>`;
  if (alt) g += `<g stroke="#c0392b" stroke-width=".9" fill="#c0392b"><line x1="${r1(X + W + 11)}" y1="${r1(Y)}" x2="${r1(X + W + 11)}" y2="${r1(Y + H)}"/><line x1="${r1(X + W + 7)}" y1="${r1(Y)}" x2="${r1(X + W + 15)}" y2="${r1(Y)}"/><line x1="${r1(X + W + 7)}" y1="${r1(Y + H)}" x2="${r1(X + W + 15)}" y2="${r1(Y + H)}"/><text transform="translate(${r1(X + W + 24)},${r1(Y + H / 2)}) rotate(-90)" text-anchor="middle" font-size="8.5" font-family="Arial" stroke="none">${d.ateTeto ? "PD " : ""}${alt}</text></g>`;
  return `<svg viewBox="0 0 240 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%" role="img">${g}</svg>`;
}
