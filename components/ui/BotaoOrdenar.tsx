"use client";

// Botão de ordenar (ícone), no lugar de um seletor grande. Abre um menu pequeno com as ordens possíveis.
// Feito para ser reaproveitado nas listas do site.

import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Check } from "lucide-react";

export type OpcaoOrdem<T extends string> = { valor: T; rotulo: string };

export default function BotaoOrdenar<T extends string>({
  valor,
  opcoes,
  onChange,
}: {
  valor: T;
  opcoes: OpcaoOrdem<T>[];
  onChange: (v: T) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const atual = opcoes.find((o) => o.valor === valor);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        title={"Ordenar: " + (atual?.rotulo ?? "")}
        aria-label={"Ordenar: " + (atual?.rotulo ?? "")}
        aria-expanded={aberto}
        className={`inline-flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border bg-white transition-colors ${
          aberto ? "border-primary text-primary ring-2 ring-primary/15" : "border-border text-ink-700 hover:border-primary hover:text-primary"
        }`}
      >
        <ArrowUpDown className="h-4 w-4" />
      </button>
      {aberto && (
        <div className="absolute right-0 z-30 mt-1.5 min-w-[200px] overflow-hidden rounded-[12px] border border-border bg-white py-1 shadow-[0_8px_24px_rgba(11,70,82,0.14)]">
          <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Ordenar por</div>
          {opcoes.map((o) => (
            <button
              key={o.valor}
              type="button"
              onClick={() => {
                onChange(o.valor);
                setAberto(false);
              }}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[#F4F8F9] ${
                o.valor === valor ? "font-semibold text-primary" : "text-ink-700"
              }`}
            >
              {o.rotulo}
              {o.valor === valor && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
