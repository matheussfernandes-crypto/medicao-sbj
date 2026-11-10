"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// data no formato YYYY-MM-DD
export type EventoCalendario = { data: string; label: string; detalhe?: string };

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher)
function pascoa(ano: number) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

// Feriados nacionais do Brasil (fixos e móveis) do ano
export function feriadosDoAno(ano: number): Record<string, string> {
  const p = pascoa(ano);
  const movel = (dias: number, nome: string): [string, string] => {
    const d = new Date(p);
    d.setDate(d.getDate() + dias);
    return [iso(d), nome];
  };
  const pares: [string, string][] = [
    [`${ano}-01-01`, "Confraternização universal"],
    [`${ano}-04-21`, "Tiradentes"],
    [`${ano}-05-01`, "Dia do Trabalho"],
    [`${ano}-09-07`, "Independência do Brasil"],
    [`${ano}-10-12`, "Nossa Senhora Aparecida"],
    [`${ano}-11-02`, "Finados"],
    [`${ano}-11-15`, "Proclamação da República"],
    [`${ano}-11-20`, "Dia da Consciência Negra"],
    [`${ano}-12-25`, "Natal"],
    movel(-2, "Sexta-feira Santa"),
    movel(60, "Corpus Christi"),
  ];
  return Object.fromEntries(pares);
}

type Marca = { tipo: "feriado" | "evento"; label: string; detalhe?: string };

export default function CalendarioPainel({ eventos }: { eventos: EventoCalendario[] }) {
  const hoje = new Date();
  const hojeISO = iso(hoje);
  const [ref, setRef] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const ano = ref.getFullYear(), mes = ref.getMonth();

  // tudo que acontece num dia: feriados (do ano visível e do seguinte, para a lista de próximos) e eventos
  const marcas = useMemo(() => {
    const mapa = new Map<string, Marca[]>();
    const add = (k: string, m: Marca) => mapa.set(k, [...(mapa.get(k) ?? []), m]);
    for (const a of [ano, ano + 1]) {
      Object.entries(feriadosDoAno(a)).forEach(([k, nome]) => add(k, { tipo: "feriado", label: nome }));
    }
    eventos.forEach((e) => add(e.data, { tipo: "evento", label: e.label, detalhe: e.detalhe }));
    return mapa;
  }, [ano, eventos]);

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const celulas: (number | null)[] = [];
  for (let i = 0; i < primeiroDia; i++) celulas.push(null);
  for (let d = 1; d <= totalDias; d++) celulas.push(d);
  while (celulas.length % 7 !== 0) celulas.push(null);

  const chave = (dia: number) => `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const diaSel = selecionado ? marcas.get(selecionado) ?? [] : [];

  // próximos 60 dias com alguma marca, em ordem
  const proximos = useMemo(() => {
    const lista: { data: string; marca: Marca }[] = [];
    for (let n = 0; n <= 60; n++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + n);
      const k = iso(d);
      (marcas.get(k) ?? []).forEach((marca) => lista.push({ data: k, marca }));
    }
    return lista.slice(0, 6);
  }, [marcas]); // eslint-disable-line react-hooks/exhaustive-deps

  const mudarMes = (delta: number) => {
    setRef(new Date(ano, mes + delta, 1));
    setSelecionado(null);
  };

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-primaryDark">
            {MESES[mes]} de {ano}
          </h2>
          <p className="text-xs text-ink-500 mt-0.5">Feriados e marcações do mês</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => mudarMes(-1)}
            className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-ink-700 hover:bg-surface-subtle transition-colors duration-200"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setRef(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
              setSelecionado(hojeISO);
            }}
            className="px-3 h-9 rounded-full text-xs font-semibold text-primary hover:bg-primary/10 transition-colors duration-200"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => mudarMes(1)}
            className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-ink-700 hover:bg-surface-subtle transition-colors duration-200"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_260px] max-lg:grid-cols-1 gap-6">
        <div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-ink-500 mb-1">
            {DIAS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {celulas.map((dia, i) => {
              if (dia === null) return <span key={i} />;
              const k = chave(dia);
              const lista = marcas.get(k) ?? [];
              const temEvento = lista.some((m) => m.tipo === "evento");
              const temFeriado = lista.some((m) => m.tipo === "feriado");
              const eHoje = k === hojeISO;
              const ativo = selecionado === k;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelecionado(ativo ? null : k)}
                  aria-label={`${dia} de ${MESES[mes]}${lista.length ? ", com marcações" : ""}`}
                  aria-pressed={ativo}
                  className={
                    "relative h-11 sm:h-14 rounded-xl text-sm transition-all duration-200 " +
                    (ativo
                      ? "bg-primary text-white shadow-panel"
                      : eHoje
                        ? "bg-primary/10 text-primaryDark font-semibold"
                        : "text-ink-900 hover:bg-surface-subtle")
                  }
                >
                  <span className="tabular-nums">{dia}</span>
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                    {temFeriado && <i className={"w-1.5 h-1.5 rounded-full " + (ativo ? "bg-white" : "bg-primaryDark/60")} />}
                    {temEvento && <i className={"w-2 h-2 rounded-full " + (ativo ? "bg-white" : "bg-accent")} />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 min-h-[68px]">
            {selecionado && (
              <div className="rounded-xl bg-surface-subtle p-3 space-y-2 transition-all duration-200">
                <p className="text-xs font-semibold text-ink-500 uppercase">
                  {selecionado.split("-").reverse().join("/")}
                </p>
                {diaSel.length === 0 && <p className="text-sm text-ink-500">Nada marcado neste dia.</p>}
                {diaSel.map((m, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className={"mt-1.5 shrink-0 rounded-full " + (m.tipo === "evento" ? "w-2 h-2 bg-accent" : "w-1.5 h-1.5 bg-primaryDark/60")} />
                    <div>
                      <p className="text-sm text-ink-900">{m.label}</p>
                      <p className="text-xs text-ink-500">{m.tipo === "feriado" ? "Feriado nacional" : m.detalhe ?? "Marcação"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">Próximos</h3>
          <ul className="space-y-1">
            {proximos.map((p, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(p.data + "T00:00:00");
                    setRef(new Date(d.getFullYear(), d.getMonth(), 1));
                    setSelecionado(p.data);
                  }}
                  className="w-full flex gap-3 items-center rounded-lg px-2 py-2 text-left hover:bg-surface-subtle transition-colors duration-200"
                >
                  <span className="shrink-0 w-11 rounded-lg bg-primary/10 text-primaryDark text-center text-xs font-semibold py-1 tabular-nums">
                    {p.data.slice(8, 10)}/{p.data.slice(5, 7)}
                  </span>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={"shrink-0 rounded-full " + (p.marca.tipo === "evento" ? "w-2 h-2 bg-accent" : "w-1.5 h-1.5 bg-primaryDark/60")} />
                    <span className="text-sm text-ink-900 truncate">{p.marca.label}</span>
                  </span>
                </button>
              </li>
            ))}
            {proximos.length === 0 && <li className="text-sm text-ink-500 px-2">Nada nos próximos dias.</li>}
          </ul>
        </aside>
      </div>
    </section>
  );
}
