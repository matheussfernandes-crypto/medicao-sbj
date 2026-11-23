"use client";

import { useEffect } from "react";

// Barra do topo da folha (some na impressão). Abre a janela de impressão sozinha quando as fontes carregam.
export default function BarraImprimir({ arquivo, papel }: { arquivo: string; papel: string }) {
  useEffect(() => {
    document.documentElement.classList.add("intro-done", "intro-livre");
    let ok = true;
    (document.fonts?.ready ?? Promise.resolve()).then(() =>
      setTimeout(() => {
        if (ok) window.print();
      }, 500)
    );
    return () => {
      ok = false;
    };
  }, []);
  return (
    <div className="barra">
      <button type="button" onClick={() => window.print()}>
        Imprimir / Salvar como PDF
      </button>
      <span>
        Na janela de impressão, escolha &quot;Salvar como PDF&quot; (o papel já vem como {papel}). O arquivo já vem com o nome <b>{arquivo}</b>.
      </span>
    </div>
  );
}
