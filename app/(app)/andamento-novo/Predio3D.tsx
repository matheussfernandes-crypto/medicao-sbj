"use client";

import type { DescidasConfig } from "./types";

export type Parte = "emb" | "tor" | "res";
export type Face = "N" | "S" | "L" | "O";
export type Nivel = { id: string; nome: string };
export type NiveisFachada = { emb: Nivel[]; tor: Nivel[]; res: Nivel[] };
export type Destaque = "foco" | "sel" | null;

export const NOME_PARTE: Record<Parte, string> = { emb: "Embasamento", tor: "Torre", res: "Reservatório" };
export const NOME_FACE: Record<Face, string> = { N: "Norte", S: "Sul", L: "Leste", O: "Oeste" };

type Props = {
  vista: "NE" | "SW";
  descidas: DescidasConfig;
  niveis: NiveisFachada;
  cor: (parte: Parte, face: Face, descida: number, nivelId: string) => string;
  destaque?: (parte: Parte, face: Face, descida: number, nivelId: string) => Destaque;
  onCelula?: (parte: Parte, face: Face, descida: number, nivelId: string, e: React.MouseEvent) => void;
  onNivel?: (nivelId: string) => void;
  rotulos?: boolean; // nomes dos pavimentos, cotas e nomes das fachadas
  alturaMax?: number; // altura desejada do prédio, em px (sem margens)
  alturaTotal?: number; // altura máxima do SVG inteiro (o desenho encolhe para caber)
  fonte?: number;
};

const ORDEM: Parte[] = ["emb", "tor", "res"];
const ALTURA_PAV = 1.25; // altura de cada pavimento, em unidades (1 unidade = largura de 1 descida)
const ALTURA_RES = 2;
const C30 = 0.866;

// Prédio em isométrica. s = +1 (vista Norte + Leste) ou -1 (vista Sul + Oeste):
//   x_tela = (s·x − s·y)·0,866 ; y_tela = (s·x + s·y)·0,5 − z
export default function Predio3D({ vista, descidas, niveis, cor, destaque, onCelula, onNivel, rotulos = true, alturaMax = 560, alturaTotal, fonte = 11 }: Props) {
  const s = vista === "NE" ? 1 : -1;

  type Caixa = { parte: Parte; X: number; Y: number; H: number; z0: number; linhas: Nivel[]; rowH: number };

  // Tamanho das caixas: o embasamento é a base; a torre fica contida e recuada dentro dele (80% de largura e
  // profundidade) e o reservatório tem no máximo 50% da torre. O nº de descidas só divide cada face em colunas.
  const contagem = (parte: Parte) => ({ X: Math.max(descidas[parte].N, descidas[parte].S, 0), Y: Math.max(descidas[parte].L, descidas[parte].O, 0) });
  const ativa = (parte: Parte) => niveis[parte].length > 0 && (contagem(parte).X > 0 || contagem(parte).Y > 0);
  const equilibrar = (X: number, Y: number) => {
    // proporção agradável mesmo com contagens de descidas muito diferentes entre as fachadas
    X = Math.max(X, 1);
    Y = Math.max(Y, 1);
    const limite = 1.8;
    if (X / Y > limite) Y = X / limite;
    else if (Y / X > limite) X = Y / limite;
    return { X, Y };
  };
  const base = ativa("emb") ? equilibrar(contagem("emb").X, contagem("emb").Y) : ativa("tor") ? equilibrar(contagem("tor").X, contagem("tor").Y) : equilibrar(contagem("res").X, contagem("res").Y);
  const torre = ativa("emb") ? { X: base.X * 0.8, Y: base.Y * 0.8 } : base;
  const dims: Record<Parte, { X: number; Y: number }> = {
    emb: base,
    tor: torre,
    res: ativa("tor") || ativa("emb") ? { X: torre.X * 0.5, Y: torre.Y * 0.5 } : base,
  };

  const caixas: Caixa[] = [];
  let z = 0;
  ORDEM.forEach((parte) => {
    const linhas = niveis[parte];
    if (!ativa(parte)) return;
    const H = parte === "res" ? ALTURA_RES : linhas.length * ALTURA_PAV;
    caixas.push({ parte, X: dims[parte].X, Y: dims[parte].Y, H, z0: z, linhas, rowH: H / linhas.length });
    z += H;
  });  if (!caixas.length) return <div className="text-xs text-ink-500 p-4">Sem descidas definidas.</div>;

  const Htot = z;
  const maxX = Math.max(...caixas.map((c) => c.X));
  const maxY = Math.max(...caixas.map((c) => c.Y));
  const U = Math.max(8, Math.min(34, alturaMax / (Htot + (maxX + maxY) * 0.5)));

  const P = (x: number, y: number, zz: number): [number, number] => [(s * x - s * y) * C30 * U, (s * x + s * y) * 0.5 * U - zz * U];

  // limites do desenho
  let minX = Infinity,
    maxPx = -Infinity,
    minY = Infinity,
    maxPy = -Infinity;
  caixas.forEach((c) => {
    [-c.X / 2, c.X / 2].forEach((x) =>
      [-c.Y / 2, c.Y / 2].forEach((y) =>
        [c.z0, c.z0 + c.H].forEach((zz) => {
          const [px, py] = P(x, y, zz);
          minX = Math.min(minX, px);
          maxPx = Math.max(maxPx, px);
          minY = Math.min(minY, py);
          maxPy = Math.max(maxPy, py);
        })
      )
    );
  });

  const margemLado = rotulos ? 178 : 8; // simétrica: o prédio fica centralizado no quadro
  const margemTopo = 10;
  const margemBase = rotulos ? 92 : 8;
  const cx = (minX + maxPx) / 2;
  const largura = (maxPx - minX) + margemLado * 2;
  const altura = maxPy - minY + margemTopo + margemBase;
  const vbX = cx - largura / 2;
  const vbY = minY - margemTopo;

  const faces: Face[] = vista === "NE" ? ["N", "L"] : ["S", "O"];
  const mundo = (c: Caixa, face: Face, t: number): [number, number] => {
    if (face === "N") return [-c.X / 2 + t * c.X, c.Y / 2];
    if (face === "L") return [c.X / 2, c.Y / 2 - t * c.Y];
    if (face === "S") return [c.X / 2 - t * c.X, -c.Y / 2];
    return [-c.X / 2, -c.Y / 2 + t * c.Y]; // O
  };
  const pt = (c: Caixa, face: Face, t: number, zz: number) => {
    const [x, y] = mundo(c, face, t);
    return P(x, y, zz);
  };
  const poly = (pts: [number, number][]) => pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ");

  const elementos: React.ReactNode[] = [];

  caixas.forEach((c) => {
    // topo da caixa (cinza claro)
    const topo = [P(-c.X / 2, -c.Y / 2, c.z0 + c.H), P(c.X / 2, -c.Y / 2, c.z0 + c.H), P(c.X / 2, c.Y / 2, c.z0 + c.H), P(-c.X / 2, c.Y / 2, c.z0 + c.H)];
    elementos.push(<polygon key={`t-${c.parte}`} points={poly(topo)} fill="#e6eaed" stroke="#9aa5ad" strokeWidth={0.8} />);

    faces.forEach((face) => {
      const n = descidas[c.parte][face];
      if (n <= 0) return;
      c.linhas.forEach((lv, r) => {
        const zTop = c.z0 + c.H - r * c.rowH;
        const zBot = zTop - c.rowH;
        for (let i = 1; i <= n; i++) {
          const t0 = (i - 1) / n;
          const t1 = i / n;
          const pts = [pt(c, face, t0, zTop), pt(c, face, t1, zTop), pt(c, face, t1, zBot), pt(c, face, t0, zBot)];
          const d = destaque?.(c.parte, face, i, lv.id) ?? null;
          elementos.push(
            <polygon
              key={`${c.parte}-${face}-${i}-${lv.id}`}
              points={poly(pts)}
              fill={d ? "#a9dcf7" : cor(c.parte, face, i, lv.id)}
              stroke={d ? "#2b86c2" : "#ffffff"}
              strokeWidth={d ? 1.6 : 0.7}
              style={{ cursor: onCelula ? "pointer" : "default", outline: "none" }}
              onClick={onCelula ? (e) => onCelula(c.parte, face, i, lv.id, e) : undefined}
            >
              <title>{`${NOME_PARTE[c.parte]} · ${NOME_FACE[face]} · D${i}${c.parte !== "res" ? " · " + lv.nome : ""}`}</title>
            </polygon>
          );
        }
      });
      // linhas dos pavimentos (tracejadas) e limite entre as partes (mais forte)
      for (let r = 0; r <= c.linhas.length; r++) {
        const zz = c.z0 + c.H - r * c.rowH;
        const [x1, y1] = pt(c, face, 0, zz);
        const [x2, y2] = pt(c, face, 1, zz);
        const limite = r === 0 || r === c.linhas.length;
        elementos.push(
          <line key={`l-${c.parte}-${face}-${r}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={limite ? "#1f2937" : "#374151"} strokeWidth={limite ? 1.7 : 0.9} strokeDasharray={limite ? undefined : "4 3"} pointerEvents="none" />
        );
      }
    });
  });

  // ----- rótulos: pavimentos à esquerda, cotas à direita, nomes das fachadas embaixo -----
  const rotulosEl: React.ReactNode[] = [];
  if (rotulos) {
    const esquerda = vbX + 6;
    caixas.forEach((c) => {
      // canto mais à esquerda desta caixa
      const cantos: [number, number][] = [[-c.X / 2, -c.Y / 2], [c.X / 2, -c.Y / 2], [c.X / 2, c.Y / 2], [-c.X / 2, c.Y / 2]];
      const esq = cantos.reduce((a, b) => (P(b[0], b[1], 0)[0] < P(a[0], a[1], 0)[0] ? b : a));
      c.linhas.forEach((lv, r) => {
        if (c.parte === "res") return;
        const zc = c.z0 + c.H - (r + 0.5) * c.rowH;
        const [px, py] = P(esq[0], esq[1], zc);
        rotulosEl.push(
          <g key={`nv-${c.parte}-${lv.id}`} style={{ cursor: onNivel ? "pointer" : "default" }} onClick={onNivel ? () => onNivel(lv.id) : undefined}>
            <line x1={esquerda + 62} y1={py} x2={px - 2} y2={py} stroke="#9aa5ad" strokeWidth={0.7} strokeDasharray="2 3" />
            <text x={esquerda} y={py + fonte / 3} fontSize={fonte} fill="#1f2937" textAnchor="start">
              {lv.nome.length > 11 ? lv.nome.slice(0, 10) + "…" : lv.nome}
            </text>
          </g>
        );
      });
    });

    // cotas (direita): linha vertical com traços inclinados nas pontas, chamadas tracejadas e texto horizontal em negrito
    const xDim = vbX + largura - 118;
    caixas.forEach((c) => {
      const cantos: [number, number][] = [[-c.X / 2, -c.Y / 2], [c.X / 2, -c.Y / 2], [c.X / 2, c.Y / 2], [-c.X / 2, c.Y / 2]];
      const dir = cantos.reduce((a, b) => (P(b[0], b[1], 0)[0] > P(a[0], a[1], 0)[0] ? b : a));
      const [pxB, pyB] = P(dir[0], dir[1], c.z0);
      const [pxT, pyT] = P(dir[0], dir[1], c.z0 + c.H);
      const meio = (pyB + pyT) / 2;
      const tick = (y: number) => <line x1={xDim - 5} y1={y + 5} x2={xDim + 5} y2={y - 5} stroke="#111827" strokeWidth={1.4} />;
      rotulosEl.push(
        <g key={`cota-${c.parte}`}>
          <line x1={pxB + 4} y1={pyB} x2={xDim + 6} y2={pyB} stroke="#6b7280" strokeWidth={0.7} strokeDasharray="3 3" />
          <line x1={pxT + 4} y1={pyT} x2={xDim + 6} y2={pyT} stroke="#6b7280" strokeWidth={0.7} strokeDasharray="3 3" />
          <line x1={xDim} y1={pyB} x2={xDim} y2={pyT} stroke="#111827" strokeWidth={1.2} />
          {tick(pyB)}
          {tick(pyT)}
          <text x={xDim + 10} y={meio + fonte / 3} fontSize={fonte - 0.5} fontWeight={700} fill="#111827">
            {NOME_PARTE[c.parte].toUpperCase()}
          </text>
        </g>
      );
    });

    // nomes das fachadas, inclinados junto com a base, com uma cota paralela
    const base = caixas[0];
    faces.forEach((face) => {
      const [x1, y1] = pt(base, face, 0, 0);
      const [x2, y2] = pt(base, face, 1, 0);
      const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const off = 26; // nome da fachada mais afastado do prédio
      // o nome fica no meio da cota, a uma distância fixa dela (medida na perpendicular, não na vertical)
      const rad = (ang * Math.PI) / 180;
      const tx = mx - Math.sin(rad) * 15;
      const ty = my + off + Math.cos(rad) * 15;
      const o1: [number, number] = [x1, y1 + off];
      const o2: [number, number] = [x2, y2 + off];
      rotulosEl.push(
        <g key={`fn-${face}`}>
          <line x1={x1} y1={y1 + 3} x2={o1[0]} y2={o1[1] + 3} stroke="#6b7280" strokeWidth={0.7} strokeDasharray="3 3" />
          <line x1={x2} y1={y2 + 3} x2={o2[0]} y2={o2[1] + 3} stroke="#6b7280" strokeWidth={0.7} strokeDasharray="3 3" />
          <line x1={o1[0]} y1={o1[1]} x2={o2[0]} y2={o2[1]} stroke="#111827" strokeWidth={1.1} />
          <text x={tx} y={ty} fontSize={fonte + 1} fontWeight={700} fill="#111827" textAnchor="middle" dominantBaseline="central" transform={`rotate(${ang.toFixed(1)} ${tx} ${ty})`}>
            {NOME_FACE[face].toUpperCase()}
          </text>
        </g>
      );
    });
  }

  return (
    <svg viewBox={`${vbX.toFixed(1)} ${vbY.toFixed(1)} ${largura.toFixed(1)} ${altura.toFixed(1)}`} preserveAspectRatio={alturaTotal ? "xMidYMin meet" : undefined} className={alturaTotal ? "w-full" : "w-full h-auto"} style={{ maxWidth: alturaTotal ? undefined : largura * 1.25, height: alturaTotal, outline: "none", display: "block", margin: "0 auto" }} role="img" aria-label={vista === "NE" ? "Vista Norte e Leste" : "Vista Sul e Oeste"}>
      {elementos}
      {rotulosEl}
    </svg>
  );
}
