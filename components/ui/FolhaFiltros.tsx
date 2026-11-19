"use client";

// Filtros no celular: um botão "Filtros" (com a quantidade ativa), os filtros ativos como chips removíveis
// e uma folha que sobe de baixo com as opções, o botão "Limpar tudo" e o botão "Aplicar".
// No tablet/computador as tabelas continuam com os filtros de sempre. Só muda a apresentação.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Filter, X } from "lucide-react";

// true em telas de celular (mesmo ponto de corte dos cartões: até 767px)
export function useCelular() {
  const [cel, setCel] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 767px)");
    const f = () => setCel(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return cel;
}

export type ChipFiltro = { k: string; rotulo: string; remover: () => void };

// faixa do topo: botão Filtros + resumo + chips dos filtros ativos
export function BarraFiltros({
  n,
  chips,
  onAbrir,
  resumo,
  onLimpar,
}: {
  n: number;
  chips: ChipFiltro[];
  onAbrir: () => void;
  resumo: string;
  onLimpar?: () => void;
}) {
  return (
    <div className="space-y-2 md:hidden">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onAbrir}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-[10px] border border-border bg-white px-3.5 text-sm font-semibold text-ink-900"
        >
          <Filter className="h-4 w-4" aria-hidden />
          Filtros
          {n > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] leading-[18px] text-white">{n}</span>}
        </button>
        <span className="text-xs text-ink-500">{resumo}</span>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c.k} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#E3EEF1] py-1 pl-3 pr-1.5 text-xs text-primaryDark">
              <span className="truncate">{c.rotulo}</span>
              <button type="button" onClick={c.remover} aria-label={`Remover filtro ${c.rotulo}`} className="grid h-5 w-5 shrink-0 place-items-center rounded-full hover:bg-primary/15">
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
          {onLimpar && chips.length > 1 && (
            <button type="button" onClick={onLimpar} className="px-1 text-xs font-semibold text-primary">
              Limpar tudo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// a folha em si (portal no body, sobe de baixo)
export function FolhaFiltros({
  aberto,
  onFechar,
  onAplicar,
  onLimpar,
  children,
}: {
  aberto: boolean;
  onFechar: () => void;
  onAplicar: () => void;
  onLimpar: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!aberto) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", tecla);
    return () => {
      document.body.style.overflow = antes;
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto, onFechar]);

  if (!aberto || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end bg-black/45" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div role="dialog" aria-modal="true" aria-label="Filtros" className="sbj-entra flex max-h-[90dvh] w-full flex-col rounded-t-[22px] border border-border bg-white text-ink-900 shadow-2xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h3 className="inline-flex items-center gap-2 text-base font-bold">
            <Filter className="h-[18px] w-[18px]" aria-hidden /> Filtros
          </h3>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full hover:bg-black/5">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">{children}</div>
        <div className="grid grid-cols-2 gap-3 border-t border-border px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onLimpar} className="min-h-[44px] rounded-[10px] border border-primary text-sm font-semibold text-primary">
            Limpar tudo
          </button>
          <button type="button" onClick={onAplicar} className="min-h-[44px] rounded-[10px] bg-primary text-sm font-semibold text-white">
            Aplicar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// bloco que abre/fecha dentro da folha (um por coluna ou filtro)
export function SecaoFiltro({ rotulo, n = 0, aberta = false, children }: { rotulo: string; n?: number; aberta?: boolean; children: React.ReactNode }) {
  return (
    <details open={aberta} className="group rounded-[12px] border border-border">
      <summary className="sbj-sum flex min-h-[48px] w-full items-center justify-between px-3.5 text-sm font-semibold">
        <span className="inline-flex items-center gap-2">
          {rotulo}
          {n > 0 && <span className="rounded-md bg-[#E3EEF1] px-1.5 py-0.5 text-xs text-primaryDark">{n}</span>}
        </span>
      </summary>
      <div className="max-h-[260px] overflow-y-auto border-t border-border">{children}</div>
    </details>
  );
}

// opção com caixinha (alvo de toque de 44px)
export function OpcaoFiltro({ rotulo, n, marcado, onChange }: { rotulo: string; n?: number; marcado: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 border-b border-border px-3.5 text-sm last:border-b-0">
      <input type="checkbox" checked={marcado} onChange={(e) => onChange(e.target.checked)} className="h-[18px] w-[18px] shrink-0 accent-[#00687A]" />
      <span className="min-w-0 flex-1 truncate">{rotulo}</span>
      {n !== undefined && <span className="text-xs tabular-nums text-ink-500">{n}</span>}
    </label>
  );
}
