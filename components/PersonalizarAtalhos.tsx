"use client";

import { useState, useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";
import { salvarAtalhos } from "@/app/(app)/dashboard/actions";

// Escolha dos atalhos da página inicial: a pessoa marca as telas que quer ver ali (até 8).
export type OpcaoAtalho = { href: string; label: string };

export default function PersonalizarAtalhos({ opcoes, escolhidos }: { opcoes: OpcaoAtalho[]; escolhidos: string[] }) {
  const [aberto, setAberto] = useState(false);
  const [marcados, setMarcados] = useState<string[]>(escolhidos);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function alterna(href: string) {
    setMarcados((m) => (m.includes(href) ? m.filter((x) => x !== href) : m.length >= 8 ? m : [...m, href]));
  }

  function salva() {
    setErro(null);
    iniciar(async () => {
      try {
        await salvarAtalhos(marcados);
        setAberto(false);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não consegui salvar.");
      }
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setMarcados(escolhidos);
          setErro(null);
          setAberto((a) => !a);
        }}
        aria-expanded={aberto}
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
      >
        <SlidersHorizontal className="w-4 h-4" />
        Personalizar atalhos
      </button>

      <div
        className={
          "absolute right-0 top-full mt-2 z-40 w-[min(92vw,520px)] rounded-[14px] border border-border bg-white p-4 shadow-xl transition-all duration-200 ease-out origin-top-right " +
          (aberto ? "opacity-100 scale-100 translate-y-0" : "pointer-events-none opacity-0 scale-95 -translate-y-2")
        }
      >
        <p className="text-sm text-ink-500 mb-3">Escolha até 8 telas para aparecerem aqui. Só aparecem as que você tem acesso.</p>
        {opcoes.length === 0 ? (
          <p className="text-sm text-ink-500">Você ainda não tem telas liberadas.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {opcoes.map((o) => {
              const on = marcados.includes(o.href);
              return (
                <label
                  key={o.href}
                  className={
                    "flex items-center gap-3 rounded-[10px] border px-3 py-2.5 text-sm cursor-pointer transition-colors duration-200 " +
                    (on ? "border-primary bg-primary/5 text-ink-900" : "border-border text-ink-700 hover:bg-primary/5")
                  }
                >
                  <input type="checkbox" checked={on} onChange={() => alterna(o.href)} className="accent-[#00687A] w-4 h-4" />
                  {o.label}
                </label>
              );
            })}
          </div>
        )}
        {erro && <p className="text-sm text-danger mt-3">{erro}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setAberto(false)} className="btn ghost sm">
            Cancelar
          </button>
          <button type="button" onClick={salva} disabled={pendente} className="btn primary sm">
            {pendente ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
