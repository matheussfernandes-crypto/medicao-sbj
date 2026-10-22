"use client";

export function Seg<T extends string>({ valor, opcoes, onChange }: { valor: T; opcoes: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap border border-border rounded-md overflow-hidden">
      {opcoes.map(([v, nome]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={`px-2.5 py-1.5 text-xs ${valor === v ? "bg-primaryDark text-white" : "bg-white hover:bg-surface-subtle"}`}>
          {nome}
        </button>
      ))}
    </div>
  );
}

export function Chave({ ligada, onChange, texto }: { ligada: boolean; onChange: (v: boolean) => void; texto: string }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <span className={`relative w-9 h-5 rounded-full transition ${ligada ? "bg-primary" : "bg-gray-300"}`} onClick={() => onChange(!ligada)}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${ligada ? "left-[18px]" : "left-0.5"}`} />
      </span>
      {texto}
    </label>
  );
}

export function Linha({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 items-center md:grid-cols-[200px_1fr]">
      <span className="text-[13px] font-semibold">{titulo}</span>
      <div>{children}</div>
    </div>
  );
}

export function Chip({ ligado, onClick, cor, tracejado, children }: { ligado: boolean; onClick: () => void; cor?: string; tracejado?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] ${ligado ? "bg-primaryDark text-white border-primaryDark" : "bg-white border-border hover:bg-surface-subtle"} ${tracejado ? "border-dashed" : ""}`}
    >
      {cor && <i className="inline-block w-2 h-2 rounded-full" style={{ background: cor }} />}
      {children}
    </button>
  );
}

export const BotaoIcone = ({ onClick, disabled, vermelho, titulo, children }: { onClick: () => void; disabled?: boolean; vermelho?: boolean; titulo: string; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={titulo}
    title={titulo}
    className={`w-7 h-7 grid place-items-center rounded-md border text-[13px] disabled:opacity-35 ${vermelho ? "border-red-200 bg-red-50 text-red-600" : "border-border bg-white text-ink-500 hover:bg-surface-subtle"}`}
  >
    {children}
  </button>
);
