"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Recolher } from "./anima";

// Cartão de cadastro que fica fechado: mostra só o botão; ao clicar, o formulário abre deslizando.
// `abertoInicial` serve para quando a pessoa chegou para editar um registro.
export default function PainelCadastro({
  titulo,
  rotuloBotao,
  abertoInicial = false,
  children,
}: {
  titulo: string;
  rotuloBotao: string;
  abertoInicial?: boolean;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(abertoInicial);
  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-primaryDark">{titulo}</h2>
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          className={`inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-semibold transition-colors ${
            aberto ? "border border-border bg-white text-ink-700 hover:border-primary hover:text-primary" : "bg-primary text-white hover:bg-primaryDark"
          }`}
        >
          {aberto ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {aberto ? "Fechar" : rotuloBotao}
        </button>
      </div>
      <Recolher aberto={aberto}>
        <div className="pt-4">{children}</div>
      </Recolher>
    </div>
  );
}
