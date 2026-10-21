"use client";

import type { Indice } from "./calculo";
import type { Apontamento, DadosAndamento, Local, Pavimento, Sistema, SistemaItem } from "./types";
import type { Soma } from "./calculo";

// Fase 4: prédio em 3D, painel lateral e descidas. (provisório)
export default function FachadaView(_props: {
  dados: DadosAndamento;
  idx: Indice;
  ap: Map<string, Apontamento>;
  sistema: Sistema;
  itens: SistemaItem[];
  pavs: Pavimento[];
  locaisPorPav: Map<string, Local[]>;
  soma: Soma;
  podeApontar: boolean;
  aplicar: (cels: { alvo: string; servico: string }[], status: 0 | 1 | 2 | 3) => void;
  modoSel: boolean;
  alternarModoSel: () => void;
  sel: Set<string>;
  setSel: (s: Set<string>) => void;
}) {
  return <div className="card text-sm text-ink-500">Fachada: em construção.</div>;
}
