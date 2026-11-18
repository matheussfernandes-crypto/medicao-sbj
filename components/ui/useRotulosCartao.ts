"use client";

import { useEffect, type RefObject } from "react";

// No celular as tabelas viram cartões; cada célula mostra o nome da sua coluna (vem do título da tabela).
// Só coloca o atributo data-rot nas células; não altera nenhum dado.
export function useRotulosCartao(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const t = ref.current?.querySelector("table");
    if (!t) return;
    const aplicar = () => {
      const ths = Array.from(t.querySelectorAll("thead th")).map((th) => (th.textContent || "").replace(/\s+/g, " ").trim());
      t.querySelectorAll("tbody tr").forEach((tr) => {
        Array.from(tr.children).forEach((td, i) => {
          if (td.hasAttribute("colspan") || td.hasAttribute("data-rot") || td.hasAttribute("data-col")) return;
          if (ths[i]) td.setAttribute("data-rot", ths[i]);
        });
      });
    };
    aplicar();
    const mo = new MutationObserver(aplicar);
    mo.observe(t, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [ref]);
}
