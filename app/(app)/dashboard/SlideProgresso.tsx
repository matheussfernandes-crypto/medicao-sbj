import type { ProgressoObra } from "./painel-obras";

const COR = { fin: "#1f8a4c", and: "#f59e0b", nao: "#e5e7eb" };

function Rosca({ p }: { p: ProgressoObra }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const fin = (p.pct / 100) * c;
  const and = (p.pctAndamento / 100) * c;
  return (
    <svg viewBox="0 0 130 130" className="w-32 h-32 shrink-0 -rotate-90">
      <circle cx="65" cy="65" r={r} fill="none" stroke={COR.nao} strokeWidth="14" />
      <circle cx="65" cy="65" r={r} fill="none" stroke={COR.and} strokeWidth="14" strokeDasharray={`${fin + and} ${c}`} />
      <circle cx="65" cy="65" r={r} fill="none" stroke={COR.fin} strokeWidth="14" strokeDasharray={`${fin} ${c}`} />
    </svg>
  );
}

const fmt = (v: number) => String(v).replace(".", ",");

export default function SlideProgresso({ p }: { p: ProgressoObra }) {
  return (
    <div className="h-full w-full bg-white p-5 sm:p-6 flex flex-col">
      <div className="flex items-baseline gap-2 mb-2 pr-10">
        <h2 className="text-primaryDark font-semibold text-lg leading-tight">{p.nome}</h2>
        <span className="text-xs text-ink-500">Andamento físico</span>
      </div>

      {p.unidades === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-ink-500 text-center">
          Ainda não há pavimentos e unidades cadastrados no Andamento de Obra.
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Rosca p={p} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-primaryDark leading-none">{fmt(Math.round(p.pct))}%</span>
                <span className="text-[10px] text-ink-500 mt-0.5">concluído</span>
              </div>
            </div>
            <ul className="text-xs text-ink-700 space-y-1">
              <li className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: COR.fin }} />Finalizado {fmt(Math.round(p.pct))}%</li>
              <li className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: COR.and }} />Em andamento {fmt(Math.round(p.pctAndamento))}%</li>
              <li className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: COR.nao }} />Não iniciado {fmt(Math.round(p.pctNaoIniciado))}%</li>
              <li className="text-ink-500 pt-0.5">{p.unidades} unidades</li>
            </ul>
          </div>

          <div className="flex-1 min-w-[260px] grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 content-center">
            {p.servicos.map((s) => (
              <div key={s.nome}>
                <div className="flex justify-between text-[11px] text-ink-700 leading-tight">
                  <span className="truncate pr-2">{s.nome}</span>
                  <b className="tabular-nums">{fmt(Math.round(s.pct))}%</b>
                </div>
                <div className="h-1.5 rounded-full bg-[#e5e7eb] overflow-hidden mt-0.5">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, s.pct)}%`, background: COR.fin }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {p.torres.length > 1 && p.unidades > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {p.torres.map((t) => (
            <span key={t.nome} className="text-[11px] bg-primary/10 text-primaryDark rounded-full px-2.5 py-0.5">
              {t.nome}: <b>{fmt(Math.round(t.pct))}%</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
