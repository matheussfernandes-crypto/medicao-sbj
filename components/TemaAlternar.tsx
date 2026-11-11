"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { aplicarTema, temaEscuroAtivo } from "@/lib/tema";

// Botão do topo: alterna o modo claro e o escuro do site inteiro.
export default function TemaAlternar() {
  const [escuro, setEscuro] = useState(false);
  useEffect(() => {
    setEscuro(temaEscuroAtivo());
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        const novo = !temaEscuroAtivo();
        aplicarTema(novo);
        setEscuro(novo);
      }}
      className="text-ink-700 hover:text-primary transition-colors p-1"
      title={escuro ? "Mudar para o modo claro" : "Mudar para o modo escuro"}
      aria-label="Alternar modo claro e escuro"
    >
      {escuro ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
