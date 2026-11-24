"use client";

import { useEffect } from "react";
import { registrarPdf, type RegistroPdf } from "../actions";

// Barra do topo da folha (some na impressão). Abre a janela de impressão sozinha quando as fontes carregam.
// Quando a janela de impressão fecha, grava no histórico quem gerou o PDF e quando
// (o navegador não conta se a pessoa salvou ou cancelou; conta como gerado sempre que a janela foi aberta).
export default function BarraImprimir({ arquivo, papel, registro }: { arquivo: string; papel: string; registro?: Omit<RegistroPdf, "arquivo" | "papel"> }) {
  useEffect(() => {
    document.documentElement.classList.add("intro-done", "intro-livre");
    let ok = true;
    let ultimo = 0;
    const depois = () => {
      if (!registro || Date.now() - ultimo < 3000) return;
      ultimo = Date.now();
      registrarPdf({ ...registro, arquivo, papel }).catch(() => {});
    };
    window.addEventListener("afterprint", depois);
    (document.fonts?.ready ?? Promise.resolve()).then(() =>
      setTimeout(() => {
        if (ok) window.print();
      }, 500)
    );
    return () => {
      ok = false;
      window.removeEventListener("afterprint", depois);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
