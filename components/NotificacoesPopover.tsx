"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellOff } from "lucide-react";
import { marcarComoLida, marcarTodasComoLidas } from "@/app/(app)/notificacoes/actions";

type Item = { id: string; titulo: string; corpo: string | null; url: string | null; lida: boolean; criado_em: string };

const semEmoji = (s: string) => (s ?? "").replace(/\p{Extended_Pictographic}️?\s?/gu, "").trim();

function tempo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  const hrs = Math.floor(mins / 60);
  const dias = Math.floor(hrs / 24);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  if (hrs < 24) return `${hrs}h`;
  if (dias === 1) return "ontem";
  if (dias < 7) return `${dias} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Sininho do topo: abre um pop-up pequeno, animado a partir do sino, com as notificações.
export default function NotificacoesPopover({ naoLidas: inicial }: { naoLidas: number }) {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Item[] | null>(null);
  const [naoLidas, setNaoLidas] = useState(inicial);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => setNaoLidas(inicial), [inicial]);

  useEffect(() => {
    if (!aberto) return;
    setItens(null);
    fetch("/api/notificacoes", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setItens(j.itens ?? []);
        setNaoLidas(j.naoLidas ?? 0);
      })
      .catch(() => setItens([]));
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  async function lerUma(id: string) {
    const fd = new FormData();
    fd.append("id", id);
    await marcarComoLida(fd);
    setItens((l) => (l ? l.map((i) => (i.id === id ? { ...i, lida: true } : i)) : l));
    setNaoLidas((n) => Math.max(0, n - 1));
  }

  async function lerTodas() {
    await marcarTodasComoLidas(new FormData());
    setItens((l) => (l ? l.map((i) => ({ ...i, lida: true })) : l));
    setNaoLidas(0);
  }

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-label="Notificações"
        title="Notificações"
        className="relative text-ink-700 hover:text-primary transition-colors p-1"
      >
        <Bell className="w-5 h-5" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1 leading-none">
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        )}
      </button>

      <div
        role="dialog"
        aria-label="Notificações"
        className={
          "absolute right-0 top-full mt-2 w-[340px] max-w-[calc(100vw-24px)] origin-top-right z-50 rounded-xl border border-border bg-white shadow-xl overflow-hidden transition-all duration-200 ease-out " +
          (aberto ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none")
        }
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-semibold text-sm text-ink-900">
            Notificações
            {naoLidas > 0 && <span className="ml-2 text-xs text-danger font-bold">{naoLidas} nova{naoLidas > 1 ? "s" : ""}</span>}
          </span>
          {naoLidas > 0 && (
            <button type="button" onClick={lerTodas} className="text-xs text-primary underline">
              Marcar todas
            </button>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {itens === null && <p className="px-4 py-6 text-sm text-ink-500 text-center">Carregando…</p>}
          {itens && itens.length === 0 && (
            <div className="px-4 py-8 text-center text-ink-500">
              <BellOff className="w-7 h-7 mx-auto mb-2" />
              <p className="text-sm">Nenhuma notificação ainda.</p>
            </div>
          )}
          {itens?.map((n) => (
            <div
              key={n.id}
              className={"px-4 py-3 border-b border-border last:border-0 transition-colors duration-200 " + (n.lida ? "opacity-70" : "bg-primary/5 border-l-4 border-l-primary")}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={"text-sm font-medium " + (n.lida ? "text-ink-600" : "text-ink-900")}>{semEmoji(n.titulo)}</p>
                <span className="text-[11px] text-ink-400 whitespace-nowrap">{tempo(n.criado_em)}</span>
              </div>
              {n.corpo && <p className="text-xs text-ink-500 mt-0.5 break-words">{n.corpo}</p>}
              <div className="flex items-center gap-3 mt-1.5">
                {n.url && (
                  <Link href={n.url} onClick={() => setAberto(false)} className="text-xs text-primary font-medium underline">
                    Ver →
                  </Link>
                )}
                {!n.lida && (
                  <button type="button" onClick={() => lerUma(n.id)} className="text-xs text-ink-400 hover:text-ink-700 underline">
                    Marcar como lida
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/notificacoes"
          onClick={() => setAberto(false)}
          className="block text-center text-xs text-primary font-medium py-2.5 border-t border-border hover:bg-surface-subtle transition-colors"
        >
          Ver todas
        </Link>
      </div>
    </div>
  );
}
