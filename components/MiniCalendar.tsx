const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// data no formato YYYY-MM-DD — assim um evento de exemplo perto do fim do
// mês pode cair no mês seguinte sem quebrar a exibição.
export type EventoCalendario = { data: string; label: string };

export default function MiniCalendar({ eventos }: { eventos: EventoCalendario[] }) {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const hojeISO = hoje.toISOString().slice(0, 10);

  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  const eventosPorDia = new Map<number, EventoCalendario[]>();
  for (const ev of eventos) {
    const [evAno, evMes, evDia] = ev.data.split("-").map(Number);
    if (evAno === ano && evMes - 1 === mes) {
      const lista = eventosPorDia.get(evDia) ?? [];
      lista.push(ev);
      eventosPorDia.set(evDia, lista);
    }
  }

  const celulas: (number | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];

  const proximosEventos = [...eventos]
    .filter((e) => e.data >= hojeISO)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 4);

  function fmtData(iso: string) {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  }

  return (
    <div className="card h-full flex flex-col">
      <p className="text-sm font-semibold text-ink-900 mb-3">
        {MESES[mes]} de {ano}
      </p>

      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {DIAS_SEMANA.map((d, i) => (
          <span key={i} className="text-[10px] font-semibold text-ink-400">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 mb-4">
        {celulas.map((dia, i) => {
          if (dia === null) return <span key={i} />;
          const isHoje = dia === hoje.getDate();
          const temEvento = eventosPorDia.has(dia);
          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <span
                className={
                  "w-6 h-6 flex items-center justify-center rounded-full text-xs " +
                  (isHoje ? "bg-primary text-white font-semibold" : "text-ink-700")
                }
              >
                {dia}
              </span>
              {temEvento && <span className="w-1 h-1 rounded-full bg-accent" />}
            </div>
          );
        })}
      </div>

      <p className="nav-group-label !text-ink-400 !px-0 !pt-0">Próximos eventos</p>
      <div className="space-y-2 flex-1 overflow-y-auto">
        {proximosEventos.length > 0 ? (
          proximosEventos.map((ev, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="bg-primary/10 text-primaryDark font-semibold rounded px-1.5 py-0.5 text-xs shrink-0">
                {fmtData(ev.data)}
              </span>
              <span className="text-ink-700 leading-tight">{ev.label}</span>
            </div>
          ))
        ) : (
          <p className="text-xs text-ink-400">Nenhum evento próximo.</p>
        )}
      </div>
    </div>
  );
}
