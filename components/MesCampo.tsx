"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

// Campo de mês do site (no lugar do campo nativo do navegador). Guarda o valor em "AAAA-MM",
// como o campo nativo, e mantém o nome para formulários que enviam por GET.
type Props = {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  required?: boolean;
  className?: string;
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const hojeMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function MesCampo({ name, defaultValue, value, onChange, required, className = "" }: Props) {
  const controlado = value !== undefined;
  const [interno, setInterno] = useState(defaultValue ?? "");
  const atual = controlado ? (value ?? "") : interno;
  const [aberto, setAberto] = useState(false);
  const [ano, setAno] = useState(() => Number((atual || hojeMes()).slice(0, 4)));
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  function escolhe(v: string) {
    if (!controlado) setInterno(v);
    onChange?.(v);
    setAberto(false);
  }

  const [anoSel, mesSel] = atual ? atual.split("-").map(Number) : [null, null];
  const rotulo = atual
    ? new Date(anoSel as number, (mesSel as number) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : "Escolher o mês";
  const hoje = hojeMes();

  return (
    <div ref={raiz} className={"relative inline-block " + className}>
      <input type="hidden" name={name} value={atual} required={required} />
      <button
        type="button"
        onClick={() => {
          setAno(Number((atual || hoje).slice(0, 4)));
          setAberto((a) => !a);
        }}
        aria-expanded={aberto}
        className="flex items-center gap-2 min-h-[40px] rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-ink-900 hover:border-primary transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <span className="capitalize">{rotulo}</span>
        <CalendarDays className="w-4 h-4 text-ink-500" />
      </button>

      <div
        role="dialog"
        aria-label="Escolher o mês"
        className={
          "absolute left-0 top-full mt-2 z-50 w-[260px] origin-top-left rounded-[14px] border border-border bg-white p-3 shadow-xl transition-all duration-200 ease-out " +
          (aberto ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none")
        }
      >
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => setAno((a) => a - 1)} className="w-8 h-8 rounded-lg text-ink-700 hover:bg-primary/10 hover:text-primary transition-colors" aria-label="Ano anterior">
            ‹
          </button>
          <b className="font-semibold text-ink-900">{ano}</b>
          <button type="button" onClick={() => setAno((a) => a + 1)} className="w-8 h-8 rounded-lg text-ink-700 hover:bg-primary/10 hover:text-primary transition-colors" aria-label="Próximo ano">
            ›
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MESES.map((m, i) => {
            const v = `${ano}-${String(i + 1).padStart(2, "0")}`;
            const sel = atual === v;
            const esteMes = hoje === v;
            return (
              <button
                key={m}
                type="button"
                onClick={() => escolhe(v)}
                className={
                  "rounded-[10px] py-2 text-sm font-semibold capitalize transition-colors duration-200 " +
                  (sel
                    ? "bg-primary text-white shadow-sm"
                    : esteMes
                      ? "text-primary ring-1 ring-primary/40 hover:bg-primary/10"
                      : "text-ink-700 hover:bg-primary/10 hover:text-primary")
                }
              >
                {m}
              </button>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm">
          <button type="button" onClick={() => escolhe("")} className="text-ink-500 hover:text-danger transition-colors">
            Limpar
          </button>
          <button type="button" onClick={() => { setAno(Number(hoje.slice(0, 4))); escolhe(hoje); }} className="text-primary font-semibold hover:underline">
            Este mês
          </button>
        </div>
      </div>
    </div>
  );
}
