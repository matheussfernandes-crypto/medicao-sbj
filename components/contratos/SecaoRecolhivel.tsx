"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

/**
 * Card com botão "Recolher / Mostrar" (mesmo estilo dos relatórios do pós-venda).
 * O estado fica lembrado neste navegador pela `chave`.
 */
export default function SecaoRecolhivel({
  chave,
  titulo,
  subtitulo,
  acoes,
  children,
  inicialFechado = false,
}: {
  chave: string;
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  acoes?: React.ReactNode;
  children: React.ReactNode;
  inicialFechado?: boolean;
}) {
  const [fechado, setFechado] = useState(inicialFechado);

  useEffect(() => {
    try {
      const v = localStorage.getItem(`sbj-secao-${chave}`);
      if (v !== null) setFechado(v === "1");
    } catch {}
  }, [chave]);

  function alternar() {
    setFechado((f) => {
      try { localStorage.setItem(`sbj-secao-${chave}`, f ? "0" : "1"); } catch {}
      return !f;
    });
  }

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold text-primaryDark">{titulo}</h2>
          {subtitulo && <p className="text-xs text-ink-500">{subtitulo}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 ml-auto">
          {!fechado && acoes}
          <button
            type="button"
            onClick={alternar}
            aria-expanded={!fechado}
            className="inline-flex items-center gap-1.5 h-[34px] px-3 rounded-[10px] border border-border bg-white text-primary text-[13px] font-semibold hover:border-primary hover:bg-primary/5 transition-colors"
          >
            {fechado ? "Mostrar" : "Recolher"}
            <ChevronUp className={`w-3.5 h-3.5 transition-transform duration-300 ${fechado ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
        style={{ gridTemplateRows: fechado ? "0fr" : "1fr", opacity: fechado ? 0 : 1 }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-3 space-y-3">{children}</div>
        </div>
      </div>
    </section>
  );
}
