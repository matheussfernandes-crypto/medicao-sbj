"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { definirObraNoPainel } from "./actions";

type Obra = { id: string; nome: string; exibir: boolean };

export default function PainelObrasSeletor({ obras }: { obras: Obra[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<Record<string, boolean>>(() => Object.fromEntries(obras.map((o) => [o.id, o.exibir])));
  const [erro, setErro] = useState<string | null>(null);

  async function alternar(id: string) {
    const novo = !estado[id];
    setEstado((e) => ({ ...e, [id]: novo }));
    setErro(null);
    try {
      await definirObraNoPainel(id, novo);
      router.refresh();
    } catch (e: any) {
      setEstado((s) => ({ ...s, [id]: !novo }));
      setErro(e.message);
    }
  }

  return (
    <div className="absolute top-2 right-2 z-20">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        title="Escolher quais obras aparecem no painel"
        aria-label="Escolher quais obras aparecem no painel"
        className="bg-black/35 hover:bg-black/55 text-white rounded-full p-2 transition-colors"
      >
        <SlidersHorizontal className="w-4 h-4" />
      </button>
      {aberto && (
        <div className="absolute right-0 mt-2 w-64 bg-white text-ink-900 border border-border rounded-xl shadow-panel p-3">
          <p className="text-xs font-semibold text-primaryDark mb-0.5">Obras no painel</p>
          <p className="text-[11px] text-ink-500 mb-2">Marque as obras que devem girar aqui (fotos e gráficos de andamento).</p>
          <div className="max-h-56 overflow-auto space-y-1">
            {obras.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                <input type="checkbox" checked={!!estado[o.id]} onChange={() => alternar(o.id)} />
                <span className="truncate">{o.nome}</span>
              </label>
            ))}
          </div>
          {erro && <p className="text-xs text-danger mt-2">{erro}</p>}
        </div>
      )}
    </div>
  );
}
