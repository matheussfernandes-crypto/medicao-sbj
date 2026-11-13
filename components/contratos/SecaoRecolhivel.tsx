"use client";

import { useEffect, useState } from "react";
import { Recolher, Seta } from "@/components/ui/anima";

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
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={alternar} aria-expanded={!fechado} aria-label={fechado ? "Mostrar" : "Recolher"} title={fechado ? "Mostrar" : "Recolher"} className="sbj-seta-btn -ml-1.5">
          <Seta aberto={!fechado} />
        </button>
        <div className="min-w-0">
          <h2 className="font-semibold text-primaryDark">{titulo}</h2>
          {subtitulo && <p className="text-xs text-ink-500">{subtitulo}</p>}
        </div>
        {!fechado && acoes && <div className="flex flex-wrap items-center gap-3 ml-auto sbj-entra">{acoes}</div>}
      </div>
      <Recolher aberto={!fechado}>
        <div className="pt-3 space-y-3">{children}</div>
      </Recolher>
    </section>
  );
}
