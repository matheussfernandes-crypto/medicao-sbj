// Gráfico de pizza em SVG puro (sem biblioteca, sem JS no cliente) — cada fatia
// recebe um <title>, que o navegador já exibe como tooltip nativo ao passar o
// mouse, com o valor e o percentual. Componente compartilhado entre os
// dashboards (financeiro e manutenções) — só muda o `formatValor`.

function polarToCartesian(cx: number, cy: number, r: number, angleGraus: number) {
  const rad = ((angleGraus - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function fatiaPizza(cx: number, cy: number, r: number, anguloInicial: number, anguloFinal: number) {
  const inicio = polarToCartesian(cx, cy, r, anguloInicial);
  const fim = polarToCartesian(cx, cy, r, anguloFinal);
  const largeArc = anguloFinal - anguloInicial <= 180 ? "0" : "1";
  return ["M", cx, cy, "L", inicio.x, inicio.y, "A", r, r, 0, largeArc, 1, fim.x, fim.y, "Z"].join(" ");
}

export type FatiaCategoria = { nome: string; valor: number; cor: string };

export default function GraficoPizza({
  categorias,
  total,
  formatValor = (v) => String(v),
}: {
  categorias: FatiaCategoria[];
  total: number;
  formatValor?: (v: number) => string;
}) {
  const cx = 100, cy = 100, r = 90;
  const comValor = categorias.filter((c) => c.valor > 0);

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 200 200" className="w-48 h-48 shrink-0">
        {total <= 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="#e5e7eb" />
        ) : comValor.length === 1 ? (
          <circle cx={cx} cy={cy} r={r} fill={comValor[0].cor}>
            <title>{`${comValor[0].nome}: ${formatValor(comValor[0].valor)} (100%)`}</title>
          </circle>
        ) : (
          (() => {
            let anguloAtual = 0;
            return comValor.map((c) => {
              const pct = c.valor / total;
              const anguloFinal = anguloAtual + pct * 360;
              const d = fatiaPizza(cx, cy, r, anguloAtual, anguloFinal);
              anguloAtual = anguloFinal;
              return (
                <path key={c.nome} d={d} fill={c.cor} stroke="#fff" strokeWidth={1}>
                  <title>{`${c.nome}: ${formatValor(c.valor)} (${Math.round(pct * 100)}%)`}</title>
                </path>
              );
            });
          })()
        )}
      </svg>
      <div className="space-y-1.5 text-sm">
        {categorias.map((c) => {
          const pct = total > 0 ? Math.round((c.valor / total) * 100) : 0;
          return (
            <div key={c.nome} className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: c.cor }} />
              <span className="w-24 text-gray-600">{c.nome}</span>
              <span className="font-semibold">{formatValor(c.valor)}</span>
              <span className="text-gray-400">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
