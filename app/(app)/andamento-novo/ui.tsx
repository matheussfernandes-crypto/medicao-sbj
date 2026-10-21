"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { COR_STATUS, ROTULO_STATUS, TXT_STATUS, partes, pct, type Soma } from "./calculo";
import type { Status } from "./types";

export const fmtPct = (v: number) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
export const fmtPct0 = (v: number) => String(Math.round(v));

export function Barra({ s, h = 8, cor = "#24914f" }: { s: Soma; h?: number; cor?: string }) {
  const p = partes(s);
  return (
    <div className="w-full overflow-hidden rounded-full flex" style={{ height: h, background: "#e3e7e9" }}>
      <div style={{ width: `${Math.min(100, p.fin)}%`, background: cor }} />
      <div style={{ width: `${Math.min(100 - Math.min(100, p.fin), p.and)}%`, background: "#f0a020" }} />
    </div>
  );
}

export function IconeX({ tam = 14 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Legenda() {
  return (
    <div className="flex items-center gap-3 text-xs text-ink-500 flex-wrap">
      {([0, 1, 2, 3] as Status[]).map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm" style={{ background: COR_STATUS[s], border: s === 3 ? "1px solid #d1d5db" : undefined }}>
            {s === 3 && <IconeX tam={10} />}
          </span>
          {ROTULO_STATUS[s]}
        </span>
      ))}
    </div>
  );
}

export function BotoesStatus({
  atual,
  onSet,
  grande = false,
  incluirAusencia = true,
}: {
  atual: Status | null;
  onSet: (s: Status) => void;
  grande?: boolean;
  incluirAusencia?: boolean;
}) {
  const lista: Status[] = incluirAusencia ? [0, 1, 2, 3] : [0, 1, 2];
  return (
    <div className={`grid gap-1.5 ${incluirAusencia ? "grid-cols-4" : "grid-cols-3"}`}>
      {lista.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSet(s)}
          className={`rounded-md font-semibold text-center ${grande ? "py-3 text-sm" : "py-1.5 text-[11px]"} ${atual === s ? "ring-2 ring-primaryDark" : ""}`}
          style={{ background: COR_STATUS[s], color: TXT_STATUS[s], border: s === 3 || s === 0 ? "1px solid #d5dadd" : undefined }}
        >
          {s === 0 ? "Não iniciado" : s === 3 ? "Ausência" : ROTULO_STATUS[s]}
        </button>
      ))}
    </div>
  );
}

export function PopupCelula({
  x,
  y,
  titulo,
  subtitulo,
  atual,
  observacao,
  autor,
  onStatus,
  onObs,
  onFechar,
}: {
  x: number;
  y: number;
  titulo: string;
  subtitulo: string;
  atual: Status;
  observacao: string;
  autor: string | null;
  onStatus: (s: Status) => void;
  onObs: (texto: string) => void;
  onFechar: () => void;
}) {
  const [obs, setObs] = useState(observacao);
  useEffect(() => setObs(observacao), [observacao]);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 10, top: 10 });
  useEffect(() => {
    const W = 290;
    const H = 270;
    const estreito = window.innerWidth < 640;
    setPos(
      estreito
        ? { left: Math.max(10, (window.innerWidth - W) / 2), top: Math.max(10, window.innerHeight / 2 - H / 2) }
        : { left: Math.max(10, Math.min(x + 14, window.innerWidth - W - 10)), top: Math.max(10, Math.min(y + 14, window.innerHeight - H - 10)) }
    );
  }, [x, y]);
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onFechar} />
      <div className="fixed z-50 bg-white border border-border rounded-xl shadow-panel p-3 w-[290px]" style={pos} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2 mb-2">
          <div className="text-xs text-ink-500 leading-snug flex-1">
            <b className="text-ink-900">{titulo}</b>
            <br />
            {subtitulo}
          </div>
          <button onClick={onFechar} aria-label="Fechar">
            <X className="w-4 h-4 text-ink-400" />
          </button>
        </div>
        <BotoesStatus atual={atual} onSet={onStatus} />
        <textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Observação (opcional)…"
          className="w-full text-xs border border-border rounded-md p-1.5 min-h-[56px] mt-2.5"
        />
        {autor && <div className="text-[10px] text-ink-400 mt-1">Última atualização: {autor}</div>}
        <div className="flex justify-between mt-2">
          <button className="text-xs px-2.5 py-1 border border-border rounded-md" onClick={onFechar}>
            Fechar
          </button>
          <button className="text-xs px-2.5 py-1 bg-primary text-white rounded-md" onClick={() => onObs(obs)}>
            Salvar observação
          </button>
        </div>
      </div>
    </>
  );
}

export function pctDe(s: Soma) {
  return pct(s);
}
