"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

// Confirmação e "desfazer" em um pop-up no rodapé da tela (no lugar do aviso do navegador no topo).
// pedirConfirmacao(...) -> Promise<boolean>: mostra o pop-up e espera o clique.
// desfazivel(texto, executar): mostra "Desfazer" por alguns segundos; se ninguém desfizer, executa.

type DetConf = { texto: string; botao?: string; resolve: (ok: boolean) => void };
type DetDesf = { texto: string; ms?: number; executar: () => void };

export function pedirConfirmacao(opts: { texto: string; botao?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<DetConf>("sbj:confirmar", { detail: { ...opts, resolve } }));
  });
}

export function desfazivel(texto: string, executar: () => void, ms = 2500) {
  window.dispatchEvent(new CustomEvent<DetDesf>("sbj:desfazer", { detail: { texto, ms, executar } }));
}

export default function ConfirmacaoRoot() {
  const [conf, setConf] = useState<DetConf | null>(null);
  const [desf, setDesf] = useState<(DetDesf & { chave: number }) | null>(null);
  const [barra, setBarra] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const c = (e: Event) => setConf((e as CustomEvent<DetConf>).detail);
    const d = (e: Event) => {
      const det = (e as CustomEvent<DetDesf>).detail;
      setDesf({ ...det, chave: Date.now() });
    };
    window.addEventListener("sbj:confirmar", c);
    window.addEventListener("sbj:desfazer", d);
    return () => {
      window.removeEventListener("sbj:confirmar", c);
      window.removeEventListener("sbj:desfazer", d);
    };
  }, []);

  // contagem do "desfazer": a barra esvazia e, no fim, a ação acontece
  useEffect(() => {
    if (!desf) return;
    const ms = desf.ms ?? 2500;
    setBarra(0);
    const r = requestAnimationFrame(() => setBarra(100));
    timer.current = setTimeout(() => {
      const f = desf.executar;
      setDesf(null);
      f();
    }, ms);
    return () => {
      cancelAnimationFrame(r);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [desf]);

  function responder(ok: boolean) {
    conf?.resolve(ok);
    setConf(null);
  }

  return (
    <>
      {conf && (
        <div className="fixed inset-x-0 bottom-4 z-[300] flex justify-center px-4 pointer-events-none" role="dialog" aria-modal="true">
          <div className="sbj-entra pointer-events-auto w-full max-w-[420px] rounded-2xl border border-border bg-white p-4 shadow-[0_18px_40px_rgba(11,70,82,0.25)]">
            <p className="text-sm text-ink-900">{conf.texto}</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => responder(false)} className="rounded-[10px] border border-border bg-white px-4 py-2 text-sm font-semibold text-ink-700">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => responder(true)}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#d9413a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#bf332d]"
              >
                <Trash2 className="w-4 h-4" aria-hidden />
                {conf.botao ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {desf && (
        <div className="fixed inset-x-0 bottom-4 z-[300] flex justify-center px-4 pointer-events-none" role="status" aria-live="polite">
          <div className="sbj-entra pointer-events-auto relative w-full max-w-[420px] overflow-hidden rounded-2xl bg-[#1d2a30] px-4 py-3 text-white shadow-[0_18px_40px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">{desf.texto}</span>
              <button
                type="button"
                onClick={() => {
                  if (timer.current) clearTimeout(timer.current);
                  setDesf(null);
                }}
                className="rounded-[8px] px-3 py-1 text-sm font-semibold text-[#7fd0dc] hover:bg-white/10"
              >
                Desfazer
              </button>
            </div>
            <div className="absolute bottom-0 left-0 h-[3px] bg-[#7fd0dc] transition-[width] ease-linear" style={{ width: `${barra}%`, transitionDuration: `${desf.ms ?? 2500}ms` }} />
          </div>
        </div>
      )}
    </>
  );
}
