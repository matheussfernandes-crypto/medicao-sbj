// Desenhos automáticos (SVG) das listas de interiores, montados só pelos campos do item.
// Devolvem o texto do SVG; só entram números, cores das tabelas e textos curtos escapados.
import { fold, type GrupoInterior } from "./regras";
import { calcParede, corDaPalavra, fmtCm, fmtM, limparCortina, limparParede, medidasCortinaNum, type Cortina, type Parede } from "./interiores";

const r1 = (n: number) => Math.round(n * 10) / 10;
const VERM = "#c0392b";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** escurece (f < 0) ou clareia (f > 0) uma cor #rrggbb */
export function tom(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** cota horizontal abaixo de y (linha, traços nas pontas e texto) */
export function cotaH(x1: number, x2: number, y: number, txt: string, fs = 8.5) {
  return `<g stroke="${VERM}" stroke-width=".9" fill="${VERM}"><line x1="${r1(x1)}" y1="${r1(y)}" x2="${r1(x2)}" y2="${r1(y)}"/><line x1="${r1(x1)}" y1="${r1(y - 4)}" x2="${r1(x1)}" y2="${r1(y + 4)}"/><line x1="${r1(x2)}" y1="${r1(y - 4)}" x2="${r1(x2)}" y2="${r1(y + 4)}"/><text x="${r1((x1 + x2) / 2)}" y="${r1(y + fs + 2)}" text-anchor="middle" font-size="${fs}" font-family="Arial" stroke="none">${esc(txt)}</text></g>`;
}
/** cota vertical à direita de x */
export function cotaV(x: number, y1: number, y2: number, txt: string, fs = 8.5) {
  return `<g stroke="${VERM}" stroke-width=".9" fill="${VERM}"><line x1="${r1(x)}" y1="${r1(y1)}" x2="${r1(x)}" y2="${r1(y2)}"/><line x1="${r1(x - 4)}" y1="${r1(y1)}" x2="${r1(x + 4)}" y2="${r1(y1)}"/><line x1="${r1(x - 4)}" y1="${r1(y2)}" x2="${r1(x + 4)}" y2="${r1(y2)}"/><text transform="translate(${r1(x + fs + 2)},${r1((y1 + y2) / 2)}) rotate(-90)" text-anchor="middle" font-size="${fs}" font-family="Arial" stroke="none">${esc(txt)}</text></g>`;
}
export const svg = (g: string, w = 240, h = 160) =>
  `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%" role="img">${g}</svg>`;

/** caixa de desenho em escala: cabe em (maxW × maxH) mantendo a proporção largura/altura */
export function caixa(larg: number, alt: number, maxW: number, maxH: number, padrao = 0.75) {
  const asp = larg && alt ? Math.min(3, Math.max(0.25, alt / larg)) : padrao;
  let W = maxW, H = maxW * asp;
  if (H > maxH) { H = maxH; W = maxH / asp; }
  return { W, H };
}

// ---------- 1. cortinas e persianas (vista frontal do vão) ----------
/** uma folha de cortina com pregas: retângulo com bainha ondulada e linhas de prega */
function folha(x: number, y: number, w: number, h: number, cor: string, juntaDir: boolean) {
  if (w < 2) return "";
  const n = Math.max(3, Math.round(w / 7)), passo = w / n, esc2 = tom(cor, -0.22);
  // contorno: topo reto e bainha ondulada (da direita para a esquerda)
  let g = `<path d="M${r1(x)},${r1(y)} L${r1(x + w)},${r1(y)} L${r1(x + w)},${r1(y + h)}`;
  for (let i = n - 1; i >= 0; i--) g += ` Q${r1(x + passo * (i + 0.5))},${r1(y + h + 3)} ${r1(x + passo * i)},${r1(y + h)}`;
  g += ` Z" fill="${cor}" stroke="${esc2}" stroke-width=".6"/>`;
  for (let i = 1; i < n; i++) {
    const px = x + passo * i, curva = juntaDir ? passo * 0.18 : -passo * 0.18;
    g += `<path d="M${r1(px)},${r1(y + 1)} Q${r1(px + curva)},${r1(y + h * 0.5)} ${r1(px)},${r1(y + h - 1)}" fill="none" stroke="${esc2}" stroke-width=".7" opacity=".75"/>`;
  }
  return g;
}

export function desenhoCortina(c: Cortina): string {
  const m = medidasCortinaNum(c);
  const t = fold(c.tipo || "cortina");
  const larg = c.emL ? m.total : m.l1;
  const { W, H } = caixa(larg, m.alt, 160, 100);
  const X = 22 + (160 - W) / 2, Y = 26 + (100 - H) / 2;
  const cor = corDaPalavra(c.cor, t.includes("blackout") && !t.includes("cortina com") ? "#4a4d52" : "#d8d2c6");
  const escura = tom(cor, -0.25);
  let g = "";
  // vão (janela) ao fundo
  g += `<rect x="${r1(X)}" y="${r1(Y)}" width="${r1(W)}" height="${r1(H)}" fill="#eef4f7" stroke="#9aa6ad" stroke-width="1"/>`;
  g += `<line x1="${r1(X + W / 2)}" y1="${r1(Y)}" x2="${r1(X + W / 2)}" y2="${r1(Y + H)}" stroke="#c7d1d6" stroke-width=".8"/>`;
  // cortineiro no gesso: caixa cinza acima
  if (c.gesso) g += `<rect x="${r1(X - 8)}" y="${r1(Y - 13)}" width="${r1(W + 16)}" height="10" fill="#d4d6d8" stroke="#a5a9ad" stroke-width=".7"/><text x="${r1(X + W / 2)}" y="${r1(Y - 5.6)}" text-anchor="middle" font-size="6.5" font-family="Arial" font-weight="bold" fill="#6b7277">GESSO</text>`;
  // trilho / varão
  g += `<rect x="${r1(X - 5)}" y="${r1(Y - 3)}" width="${r1(W + 10)}" height="3" rx="1.2" fill="#7c7f83"/>`;

  const xL = c.emL && m.l1 && m.l2 ? X + (W * m.l1) / m.total : 0; // posição do canto (em L)
  const barraH = m.barra && m.alt ? Math.max(2.5, Math.min(H * 0.4, (H * m.barra) / (m.alt * 100))) : 0;

  if (/persiana|double/.test(t)) {
    const n = Math.max(8, Math.round(H / 5)), dv = /double/.test(t);
    g += `<rect x="${r1(X)}" y="${r1(Y)}" width="${r1(W)}" height="${r1(H)}" fill="${dv ? tom(cor, 0.35) : cor}" opacity="${dv ? 0.85 : 1}"/>`;
    for (let i = 0; i < n; i++) {
      const y = Y + (H / n) * i;
      g += dv
        ? (i % 2 ? "" : `<rect x="${r1(X)}" y="${r1(y)}" width="${r1(W)}" height="${r1(H / n)}" fill="${cor}"/>`)
        : `<line x1="${r1(X)}" y1="${r1(y)}" x2="${r1(X + W)}" y2="${r1(y)}" stroke="${escura}" stroke-width=".8"/>`;
    }
    g += `<rect x="${r1(X)}" y="${r1(Y)}" width="${r1(W)}" height="${r1(H)}" fill="none" stroke="${escura}" stroke-width=".8"/>`;
  } else if (/rolo/.test(t)) {
    g += `<rect x="${r1(X)}" y="${r1(Y)}" width="${r1(W)}" height="${r1(H)}" fill="${cor}" stroke="${escura}" stroke-width=".8"/>`;
    g += `<rect x="${r1(X - 3)}" y="${r1(Y - 2)}" width="${r1(W + 6)}" height="7" rx="3.5" fill="${tom(cor, -0.35)}"/>`;
    g += `<rect x="${r1(X)}" y="${r1(Y + H - 3)}" width="${r1(W)}" height="3" fill="${tom(cor, -0.45)}"/>`;
  } else if (/romana/.test(t)) {
    const n = Math.max(3, Math.round(H / 18)), passo = H / n;
    g += `<rect x="${r1(X)}" y="${r1(Y)}" width="${r1(W)}" height="${r1(H)}" fill="${cor}" stroke="${escura}" stroke-width=".8"/>`;
    for (let i = 1; i <= n; i++) {
      const y = Y + passo * i;
      g += `<path d="M${r1(X)},${r1(y - 1)} Q${r1(X + W / 2)},${r1(y + 3.5)} ${r1(X + W)},${r1(y - 1)}" fill="none" stroke="${escura}" stroke-width=".9"/>`;
    }
  } else {
    // cortina (e blackout, xale): folhas com pregas abrindo no centro; em L, uma folha por trecho
    if (t.includes("com blackout")) g += `<rect x="${r1(X + 1)}" y="${r1(Y)}" width="${r1(W - 2)}" height="${r1(H)}" fill="#4a4d52" opacity=".85"/>`;
    if (xL) {
      const w1 = xL - X, w2 = X + W - xL;
      g += folha(X, Y, w1 * 0.86, H, cor, true) + folha(xL + w2 * 0.14, Y, w2 * 0.86, H, cor, false);
    } else if (!t.startsWith("xale")) {
      g += folha(X, Y, W * 0.4, H, cor, true) + folha(X + W * 0.6, Y, W * 0.4, H, cor, false);
    }
  }
  // barra: faixa mais escura na base
  if (barraH) g += `<rect x="${r1(X)}" y="${r1(Y + H - barraH)}" width="${r1(W)}" height="${r1(barraH)}" fill="${tom(cor, -0.3)}" opacity=".75"/>`;
  // em L: linha grossa do canto
  if (xL) g += `<line x1="${r1(xL)}" y1="${r1(Y - 4)}" x2="${r1(xL)}" y2="${r1(Y + H)}" stroke="#3b3f44" stroke-width="3.2"/><text x="${r1(xL)}" y="${r1(Y - (c.gesso ? 16 : 7))}" text-anchor="middle" font-size="7" font-family="Arial" font-weight="bold" fill="#3b3f44">CANTO</text>`;
  // xale: tecido caído no topo, do lado escolhido, altura proporcional à medida
  const lados = c.xale === "dois" || t.startsWith("xale") && (!c.xale || c.xale === "sem") ? ["e", "d"] : c.xale === "esquerdo" ? ["e"] : c.xale === "direito" ? ["d"] : [];
  if (lados.length) {
    const xh = m.xale && m.alt ? Math.max(8, Math.min(H * 0.9, (H * m.xale) / (m.alt * 100))) : H * 0.3;
    const xw = Math.min(W * 0.32, 40), cx = tom(cor, -0.12);
    for (const l of lados) {
      const x0 = l === "e" ? X - 2 : X + W + 2, s = l === "e" ? 1 : -1;
      g += `<path d="M${r1(x0)},${r1(Y - 2)} L${r1(x0 + s * xw)},${r1(Y - 2)} Q${r1(x0 + s * xw * 0.55)},${r1(Y + xh * 0.55)} ${r1(x0 + s * xw * 0.18)},${r1(Y + xh)} L${r1(x0)},${r1(Y + xh)} Z" fill="${cx}" stroke="${tom(cor, -0.35)}" stroke-width=".7"/>`;
    }
    if (m.xale) g += `<text x="${r1(lados[0] === "e" ? X + 2 : X + W - 2)}" y="${r1(Y + xh + 9)}" text-anchor="${lados[0] === "e" ? "start" : "end"}" font-size="6.5" font-family="Arial" fill="${VERM}">xale ${fmtCm(m.xale)} cm</text>`;
  }
  // pingente: dois pingentes dourados
  if (c.pingente)
    for (const px of [X + W * 0.22, X + W * 0.78])
      g += `<line x1="${r1(px)}" y1="${r1(Y)}" x2="${r1(px)}" y2="${r1(Y + 9)}" stroke="#a8843c" stroke-width=".8"/><path d="M${r1(px)},${r1(Y + 9)} q3,4 0,8 q-3,-4 0,-8 Z" fill="#c9a45c" stroke="#a8843c" stroke-width=".6"/>`;
  // cotas
  if (xL) {
    g += cotaH(X, xL, Y + H + 9, fmtM(m.l1), 7.5) + cotaH(xL, X + W, Y + H + 9, fmtM(m.l2), 7.5);
    g += cotaH(X, X + W, Y + H + 24, `${fmtM(m.total)} total`, 7.5);
  } else if (m.l1) g += cotaH(X, X + W, Y + H + 10, fmtM(m.l1));
  if (m.alt) g += cotaV(X + W + (lados.includes("d") ? 18 : 10), Y, Y + H, fmtM(m.alt));
  if (c.motorizada) g += `<text x="${r1(X - 4)}" y="${r1(Y + H + 10)}" text-anchor="end" font-size="6.5" font-family="Arial" fill="#6b7277">⚡ motor</text>`;
  return svg(g, 240, 160);
}

// ---------- 2. revestimentos (vista frontal da parede) ----------
const COR_DESC: Record<string, { fill: string; stroke: string; letra: string }> = {
  Porta: { fill: "#e9dcc3", stroke: "#a88f66", letra: "P" },
  Janela: { fill: "#cfe4f3", stroke: "#6f9bbd", letra: "J" },
  "Móvel": { fill: "#ffffff", stroke: "#7d7f82", letra: "M" },
  Outro: { fill: "#ffffff", stroke: "#7d7f82", letra: "" },
};
export function desenhoParede(p: Parede): string {
  const c = calcParede(p);
  const { W, H } = caixa(c.L, c.H, 170, 96, 0.55);
  const X = 18 + (170 - W) / 2, Y = 12 + (96 - H) / 2, kx = c.L ? W / c.L : 0, ky = c.H ? H / c.H : 0;
  const base = Y + H;
  const corParede = p.material === "Granilha" ? "#e4ddd2" : p.material === "Papel de parede" ? "#efe6da" : "#e9e6e1";
  let g = `<defs><pattern id="hach" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#9a9c9f" stroke-width="1"/></pattern></defs>`;
  g += `<rect x="${r1(X)}" y="${r1(Y)}" width="${r1(W)}" height="${r1(H)}" fill="${corParede}"/>`;
  if (p.material === "Papel de parede") for (let x = X + 10; x < X + W; x += 10) g += `<line x1="${r1(x)}" y1="${r1(Y)}" x2="${r1(x)}" y2="${r1(base)}" stroke="#ffffff" stroke-width=".6" opacity=".7"/>`;
  if (p.material === "Granilha") for (let i = 0; i < Math.min(140, Math.round((W * H) / 40)); i++) {
    // sequência que espalha os pontos por igual (sem formar linhas)
    const px = X + ((i * 0.7548776662) % 1) * W, py = Y + ((i * 0.5698402910 + 0.5) % 1) * H;
    g += `<circle cx="${r1(px)}" cy="${r1(py)}" r=".7" fill="#a79f93"/>`;
  }
  // rodapé: faixa na base
  if (c.rod && ky) g += `<rect x="${r1(X)}" y="${r1(base - Math.max(1.5, c.rod * ky))}" width="${r1(W)}" height="${r1(Math.max(1.5, c.rod * ky))}" fill="#b9b4ac"/>`;
  // descontos
  if (kx && ky)
    for (const d of c.lista) {
      if (!d.w || !d.h) continue;
      const s = COR_DESC[d.tipo], x = X + d.x * kx, w = d.w * kx, h = d.h * ky, y = base - (d.y + d.h) * ky;
      const traco = d.tipo === "Outro" ? ` stroke-dasharray="3 2"` : "";
      g += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" fill="${d.tipo === "Móvel" ? "url(#hach)" : s.fill}" stroke="${d.fora ? VERM : s.stroke}" stroke-width="1"${traco}/>`;
      if (d.tipo === "Porta") g += `<circle cx="${r1(x + w * 0.8)}" cy="${r1(y + h * 0.55)}" r="1.4" fill="${s.stroke}"/>`;
      if (d.tipo === "Janela") g += `<line x1="${r1(x + w / 2)}" y1="${r1(y)}" x2="${r1(x + w / 2)}" y2="${r1(y + h)}" stroke="${s.stroke}" stroke-width=".7"/><line x1="${r1(x)}" y1="${r1(y + h / 2)}" x2="${r1(x + w)}" y2="${r1(y + h / 2)}" stroke="${s.stroke}" stroke-width=".7"/>`;
      if (s.letra) g += `<text x="${r1(x + w / 2)}" y="${r1(y + h / 2 + (d.tipo === "Janela" ? -2 : 3))}" text-anchor="middle" font-size="${h > 14 ? 8 : 6}" font-family="Arial" font-weight="bold" fill="#3b3f44"${d.tipo === "Móvel" ? ' stroke="#fff" stroke-width="2" paint-order="stroke"' : ""}>${s.letra}</text>`;
      g += `<text x="${r1(x + w / 2)}" y="${r1(Math.max(y - 2, Y + 6))}" text-anchor="middle" font-size="5.5" font-family="Arial" fill="${VERM}" stroke="#fff" stroke-width="1.6" paint-order="stroke">${fmtM(d.w)} x ${fmtM(d.h)}</text>`;
    }
  // contorno (vermelho se algum desconto passa da parede)
  g += `<rect x="${r1(X)}" y="${r1(Y)}" width="${r1(W)}" height="${r1(H)}" fill="none" stroke="${c.fora ? VERM : "#5c6166"}" stroke-width="${c.fora ? 1.8 : 1.1}"/>`;
  if (c.L) g += cotaH(X, X + W, base + 9, fmtM(c.L), 8);
  if (c.H) g += cotaV(X + W + 9, Y, base, fmtM(c.H), 8);
  const ty = base + 30;
  if (c.L && c.H) g += `<text x="${r1(X + W / 2)}" y="${r1(ty)}" text-anchor="middle" font-size="9" font-family="Arial" font-weight="bold" fill="#1f2733">${fmtM(c.liquida)} m² líquidos</text>`;
  if (c.fora) g += `<text x="${r1(X + W / 2)}" y="${r1(ty + 10)}" text-anchor="middle" font-size="7" font-family="Arial" font-weight="bold" fill="${VERM}">algum desconto passa da parede</text>`;
  return svg(g, 240, 160);
}

/** desenho automático do item de uma lista de interiores (campos já gravados) */
export function desenhoInterior(grupo: GrupoInterior, campos: unknown): string {
  if (grupo === "cortinas") return desenhoCortina(limparCortina(campos));
  if (grupo === "revestimentos") return desenhoParede(limparParede(campos));
  return "";
}
