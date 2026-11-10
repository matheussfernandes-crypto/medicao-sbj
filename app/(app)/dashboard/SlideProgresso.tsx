import type { ProgressoObra } from "./painel-obras";

const FIN = "#0E6B73";
const AND = "#F5C518";

function Rosca({ p }: { p: ProgressoObra }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const fin = (p.pctFinalizado / 100) * c;
  const and = (p.pctAndamento / 100) * c;
  return (
    <svg viewBox="0 0 130 130" className="w-28 h-28 sm:w-36 sm:h-36 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="65" cy="65" r={r} fill="none" stroke="#EEF2F3" strokeWidth="13" />
      <circle cx="65" cy="65" r={r} fill="none" stroke={AND} strokeWidth="13" strokeLinecap="round" strokeDasharray={`${fin + and} ${c}`} />
      <circle cx="65" cy="65" r={r} fill="none" stroke={FIN} strokeWidth="13" strokeLinecap="round" strokeDasharray={`${fin} ${c}`} />
    </svg>
  );
}

const fmt = (v: number) => String(Math.round(v)).replace(".", ",");

export default function SlideProgresso({ p }: { p: ProgressoObra }) {
  return (
    <div className="h-full w-full bg-white p-4 sm:p-6 flex flex-col overflow-y-auto">
      <div className="pr-10">
        <h2 className="text-primaryDark font-semibold text-lg sm:text-xl leading-tight">{p.nome}</h2>
        <p className="text-xs text-ink-500 mt-0.5">Andamento físico · {p.unidades} locais</p>
      </div>

      {p.unidades === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-ink-500 text-center py-10">
          Ainda não há pavimentos e locais cadastrados no Andamento de Obra (novo).
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-center">
            <div className="relative mx-auto sm:mx-0">
              <Rosca p={p} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl sm:text-3xl font-semibold text-primaryDark leading-none tabular-nums">{fmt(p.pct)}%</span>
                <span className="text-[11px] text-ink-500 mt-1">concluído</span>
              </div>
            </div>

            <div className="space-y-2.5 min-w-0">
              <div className="rounded-xl bg-surface-subtle p-3">
                <p className="text-[11px] uppercase tracking-wider text-ink-500">Estágio atual</p>
                {p.estagio ? (
                  <>
                    <p className="font-semibold text-ink-900 mt-0.5 leading-snug">{p.estagio.nome}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-2 rounded-full bg-white overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, p.estagio.pct)}%`, background: FIN }} />
                      </div>
                      <b className="text-sm tabular-nums text-primaryDark">{fmt(p.estagio.pct)}%</b>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-ink-700 mt-0.5">Obra concluída</p>
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
                <span className="text-sm text-ink-700">Prazo para a entrega</span>
                {p.diasParaEntrega === null ? (
                  <span className="text-sm text-ink-500">sem prazo cadastrado</span>
                ) : p.diasParaEntrega >= 0 ? (
                  <b className="text-lg tabular-nums text-primaryDark">{p.diasParaEntrega} dias</b>
                ) : (
                  <b className="text-sm text-danger">vencido há {Math.abs(p.diasParaEntrega)} dias</b>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-700">
                <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: FIN }} />Finalizado {fmt(p.pctFinalizado)}%</span>
                <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: AND }} />Em andamento {fmt(p.pctAndamento)}%</span>
              </div>
            </div>
          </div>

          {p.grupos.length > 0 && (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {p.grupos.slice(0, 6).map((g) => (
                <div key={g.nome}>
                  <div className="flex justify-between gap-2 text-[12px] text-ink-700 leading-tight">
                    <span className="truncate">{g.nome}</span>
                    <b className="tabular-nums shrink-0">{fmt(g.pct)}%</b>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#EEF2F3] overflow-hidden mt-1">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, g.pct)}%`, background: FIN }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
