"use client";

// Filtro e ordenação no título da coluna (mesmo padrão do Pós-venda e do pós-obra).
// Clicar no título abre um menu: ordenar + busca + caixinhas com a quantidade de cada valor + Limpar.
// Clicar de novo no título fecha o menu.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type Direcao = "asc" | "desc";
export type ValorFiltro = { v: string; l: string; n: number };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export default function FiltroColuna({
  rotulo,
  ordens,
  ordem,
  onOrdem,
  valores,
  marcados = [],
  onMarcar,
  alinharDireita = false,
}: {
  rotulo: string;
  ordens?: [Direcao, string][]; // ex.: [["asc","A → Z"],["desc","Z → A"]]
  ordem?: Direcao | null;
  onOrdem?: (d: Direcao | null) => void;
  valores?: ValorFiltro[];
  marcados?: string[];
  onMarcar?: (v: string[]) => void;
  alinharDireita?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const n = marcados.length;

  function abrir() {
    const r = botao.current?.getBoundingClientRect();
    if (!r) return;
    const largura = 270;
    setPos({ top: r.bottom + window.scrollY + 6, left: Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - largura - 8)) });
    setBusca("");
    setAberto(true);
  }

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menu.current?.contains(t) || botao.current?.contains(t)) return;
      setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    const rolou = (e: Event) => {
      if (menu.current && e.target instanceof Node && menu.current.contains(e.target)) return;
      setAberto(false);
    };
    document.addEventListener("mousedown", fora, true);
    document.addEventListener("keydown", tecla);
    window.addEventListener("resize", rolou);
    const t = setTimeout(() => window.addEventListener("scroll", rolou, true), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", fora, true);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("resize", rolou);
      window.removeEventListener("scroll", rolou, true);
    };
  }, [aberto]);

  const visiveis = useMemo(() => {
    const q = norm(busca);
    return (valores ?? []).filter((x) => !q || norm(x.l).includes(q));
  }, [valores, busca]);

  function marcar(v: string, sim: boolean) {
    const s = new Set(marcados);
    if (sim) s.add(v);
    else s.delete(v);
    onMarcar?.(Array.from(s));
  }

  return (
    <>
      <button
        ref={botao}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        className={`group -mx-2 -my-1 inline-flex items-center gap-1.5 whitespace-nowrap font-bold rounded-[8px] px-2 py-1 uppercase tracking-wide transition-colors ${
          alinharDireita ? "flex-row-reverse" : ""
        } ${aberto ? "bg-[#E3EEF1] text-ink-900" : n || ordem ? "text-primary hover:bg-[#E3EEF1]" : "text-ink-900 hover:bg-[#E3EEF1]"}`}
      >
        {rotulo}
        {n > 0 && <span className="rounded-full bg-primary px-1.5 text-[10.5px] leading-4 tracking-normal text-white">{n}</span>}
        {ordem && <span className="text-xs tracking-normal">{ordem === "asc" ? "↑" : "↓"}</span>}
        {!n && !ordem && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="opacity-45 transition-opacity group-hover:opacity-100" aria-hidden>
            <path d="M3 5h18l-7 8v6l-4-2v-4z" />
          </svg>
        )}
      </button>
      {aberto &&
        pos &&
        createPortal(
          <div
            ref={menu}
            role="dialog"
            style={{ top: pos.top, left: pos.left }}
            className="sbj-entra absolute z-[80] w-[270px] rounded-[14px] border border-border bg-white p-1.5 text-[13px] normal-case tracking-normal text-ink-900 shadow-[0_12px_32px_rgba(11,70,82,0.18)]"
          >
            {ordens && (
              <div className="flex gap-1.5 p-1 pb-2">
                {ordens.map(([d, l]) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onOrdem?.(ordem === d ? null : d)}
                    className={`flex-1 whitespace-nowrap rounded-[8px] border px-1 py-1.5 text-[12.5px] font-semibold ${
                      ordem === d ? "border-primary bg-[#E3EEF1] text-primary" : "border-border bg-white hover:border-primary"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
            {valores && (
              <>
                {ordens && <div className="mx-0.5 border-t border-border" />}
                {valores.length > 7 && (
                  <input
                    autoFocus
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar…"
                    className="mx-0.5 mb-1.5 mt-2 block h-8 w-[calc(100%-4px)] rounded-[9px] border border-border px-2.5 text-[13px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  />
                )}
                <div className="max-h-[260px] overflow-auto pt-1">
                  {visiveis.map((x) => (
                    <label key={x.v} className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2 py-[7px] hover:bg-[#F4F8F9]">
                      <input type="checkbox" checked={marcados.includes(x.v)} onChange={(e) => marcar(x.v, e.target.checked)} className="h-4 w-4 shrink-0 accent-[#00687A]" />
                      <span className="min-w-0 truncate">{x.l}</span>
                      <span className="ml-auto text-xs tabular-nums text-ink-500">{x.n}</span>
                    </label>
                  ))}
                  {!visiveis.length && <div className="px-2 py-2 text-ink-500">Nada para filtrar.</div>}
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-border px-2 pb-1 pt-2 text-ink-500">
                  <span>{n ? `${n} ${n === 1 ? "marcado" : "marcados"}` : "Mostrando todos"}</span>
                  <button type="button" onClick={() => onMarcar?.([])} className="font-semibold text-primary">
                    Limpar
                  </button>
                </div>
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

// valores de uma coluna com a quantidade de cada um
export function contarValores<T>(lista: T[], val: (x: T) => string, rot?: (v: string) => string): ValorFiltro[] {
  const m = new Map<string, number>();
  lista.forEach((x) => {
    const v = val(x);
    m.set(v, (m.get(v) ?? 0) + 1);
  });
  return Array.from(m.entries()).map(([v, n]) => ({ v, l: rot ? rot(v) : v || "—", n }));
}
