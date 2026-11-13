"use client";

// Peças de interface no padrão do pós-obra (recolher com setinha, páginas que deslizam,
// campo de data com calendário). As animações ficam em app/anima.css.

import { Children, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Recolher: o conteúdo abre e fecha deslizando (altura animada)

export function Recolher({ aberto, children, className = "" }: { aberto: boolean; children: React.ReactNode; className?: string }) {
  // depois de aberto, o conteúdo deixa de ser cortado (calendários e menus podem sair para fora)
  const [solto, setSolto] = useState(aberto);
  useEffect(() => {
    if (!aberto) setSolto(false);
  }, [aberto]);
  return (
    <div
      className={`sbj-recolhe ${aberto ? "aberto" : ""} ${aberto && solto ? "solto" : ""} ${className}`}
      aria-hidden={!aberto}
      onTransitionEnd={(e) => e.target === e.currentTarget && e.propertyName === "grid-template-rows" && aberto && setSolto(true)}
    >
      <div className="sbj-recolhe-in">{children}</div>
    </div>
  );
}

// setinha que gira (aponta para baixo aberta, para a direita fechada)
export function Seta({ aberto, className = "" }: { aberto: boolean; className?: string }) {
  return <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-300 ${aberto ? "" : "-rotate-90"} ${className}`} />;
}

// botão redondo só com a setinha (ao lado do título)
export function BotaoSeta({ aberto, onClick, rotulo }: { aberto: boolean; onClick: () => void; rotulo?: string }) {
  const r = rotulo ?? (aberto ? "Recolher" : "Mostrar");
  return (
    <button type="button" onClick={onClick} aria-expanded={aberto} aria-label={r} title={r} className="sbj-seta-btn">
      <Seta aberto={aberto} />
    </button>
  );
}

// estado aberto/fechado lembrado neste navegador
export function useAberto(chave: string, inicial = true): [boolean, () => void, (v: boolean) => void] {
  const [aberto, setAberto] = useState(inicial);
  useEffect(() => {
    try {
      const v = localStorage.getItem(`sbj-rec-${chave}`);
      if (v !== null) setAberto(v === "1");
    } catch {}
  }, [chave]);
  const definir = (v: boolean) => {
    setAberto(v);
    try {
      localStorage.setItem(`sbj-rec-${chave}`, v ? "1" : "0");
    } catch {}
  };
  return [aberto, () => definir(!aberto), definir];
}

// ---------------------------------------------------------------------------
// Páginas: N por página, deslizando para o lado da troca e subindo a tela

export function usePaginas<T>(lista: T[], por = 20, chave?: string | number) {
  const [pag, setPag] = useState(0);
  const [dir, setDir] = useState(0);
  const [giro, setGiro] = useState(0); // muda a cada troca para reiniciar a animação
  const pags = Math.max(1, Math.ceil(lista.length / por));
  // volta para a página 1 quando a lista muda (por identidade, ou pela chave informada)
  const anterior = useRef<unknown>(chave ?? lista);
  useEffect(() => {
    const atual = chave ?? lista;
    if (anterior.current !== atual) {
      anterior.current = atual;
      setPag(0);
      setDir(0);
    }
  }, [lista, chave]);
  const atual = Math.min(pag, pags - 1);
  const itens = useMemo(() => lista.slice(atual * por, atual * por + por), [lista, atual, por]);
  const topo = useRef<HTMLDivElement>(null);
  function ir(n: number) {
    if (n < 0 || n >= pags || n === atual) return;
    setDir(n > atual ? 1 : -1);
    setGiro((g) => g + 1);
    setPag(n);
    const el = topo.current;
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 80;
      if (y < window.scrollY) window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }
  }
  const classe = dir === 1 ? "sbj-pg-dir" : dir === -1 ? "sbj-pg-esq" : "";
  return { itens, pag: atual, pags, total: lista.length, por, ir, classe, giro, topo };
}

export function Paginador({ pag, pags, total, por, ir }: { pag: number; pags: number; total: number; por: number; ir: (n: number) => void }) {
  if (pags < 2) return null;
  const nums: (number | "…")[] = [];
  for (let i = 0; i < pags; i++) {
    if (i === 0 || i === pags - 1 || Math.abs(i - pag) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return (
    <div className="sbj-pager">
      <span className="text-xs text-ink-500">
        {pag * por + 1}–{Math.min(total, pag * por + por)} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" className="sbj-pg-btn" disabled={pag === 0} onClick={() => ir(pag - 1)} aria-label="Página anterior">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {nums.map((n, k) =>
          n === "…" ? (
            <span key={"r" + k} className="text-xs text-ink-400 px-1">
              …
            </span>
          ) : (
            <button key={n} type="button" className={`sbj-pg-btn ${n === pag ? "atual" : ""}`} aria-current={n === pag ? "page" : undefined} onClick={() => ir(n)}>
              {n + 1}
            </button>
          )
        )}
        <button type="button" className="sbj-pg-btn" disabled={pag === pags - 1} onClick={() => ir(pag + 1)} aria-label="Próxima página">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campo de data com calendário (guarda "AAAA-MM-DD", como o campo nativo)

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const iso = (a: number, m: number, d: number) => `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const hojeIso = () => {
  const d = new Date();
  return iso(d.getFullYear(), d.getMonth(), d.getDate());
};

export function DataCampo({
  value: valorControlado,
  defaultValue,
  name,
  required,
  onChange,
  placeholder = "Escolher",
  className = "",
  btnClassName = "",
}: {
  value?: string;
  defaultValue?: string;
  name?: string;
  required?: boolean;
  onChange?: (v: string) => void;
  placeholder?: string;
  className?: string;
  btnClassName?: string; // largura/ajustes do botão
}) {
  const controlado = valorControlado !== undefined;
  const [interno, setInterno] = useState(defaultValue ?? "");
  const value = controlado ? valorControlado ?? "" : interno;
  const [aberto, setAberto] = useState(false);
  const base = value || hojeIso();
  const [ano, setAno] = useState(Number(base.slice(0, 4)));
  const [mes, setMes] = useState(Number(base.slice(5, 7)) - 1);
  const [dir, setDir] = useState(0);
  const [direita, setDireita] = useState(false); // abre alinhado à direita quando falta espaço
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => raiz.current && !raiz.current.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  function mudaMes(d: number) {
    setDir(d);
    const m = mes + d;
    setAno((a) => a + Math.floor(m / 12));
    setMes(((m % 12) + 12) % 12);
  }
  function escolhe(v: string) {
    if (!controlado) setInterno(v);
    onChange?.(v);
    setAberto(false);
  }

  const primeiro = new Date(ano, mes, 1).getDay();
  const dias = new Date(ano, mes + 1, 0).getDate();
  const cel: (number | null)[] = [...Array(primeiro).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  const hoje = hojeIso();
  const rotulo = value ? new Date(value + "T12:00:00").toLocaleDateString("pt-BR") : placeholder;

  return (
    <div ref={raiz} className={`relative inline-block ${className}`}>
      {name && <input name={name} value={value} required={required} tabIndex={-1} aria-hidden onChange={() => {}} onFocus={() => botao.current?.focus()} className="absolute inset-0 w-full h-full opacity-0 pointer-events-none" />}
      <button
        ref={botao}
        type="button"
        onClick={() => {
          const b = value || hoje;
          setAno(Number(b.slice(0, 4)));
          setMes(Number(b.slice(5, 7)) - 1);
          setDir(0);
          const r = raiz.current?.getBoundingClientRect();
          if (r) setDireita(r.left + 280 > window.innerWidth - 8 && r.right - 280 > 8);
          setAberto((a) => !a);
        }}
        aria-expanded={aberto}
        className={`flex items-center gap-2 min-h-[40px] rounded-[10px] border border-border bg-white px-3 py-1.5 text-sm hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${value ? "text-ink-900" : "text-ink-400"} ${btnClassName}`}
      >
        <span className="tabular-nums">{rotulo}</span>
        <CalendarDays className="w-4 h-4 text-ink-500" />
      </button>
      {aberto && (
        <div role="dialog" aria-label="Escolher a data" className={`sbj-pop absolute ${direita ? "right-0" : "left-0"} top-full mt-2 z-50 w-[272px] max-w-[calc(100vw-16px)] rounded-[14px] border border-border bg-white p-3 shadow-xl aberto`}>
        <div className="flex items-center justify-between mb-2">
          <button type="button" onClick={() => mudaMes(-1)} className="w-8 h-8 rounded-lg text-ink-700 hover:bg-primary/10 hover:text-primary transition-colors" aria-label="Mês anterior">
            ‹
          </button>
          <b className="font-semibold text-ink-900 text-sm">
            {MESES[mes]} {ano}
          </b>
          <button type="button" onClick={() => mudaMes(1)} className="w-8 h-8 rounded-lg text-ink-700 hover:bg-primary/10 hover:text-primary transition-colors" aria-label="Próximo mês">
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-ink-400 mb-1">
          {SEMANA.map((s, i) => (
            <span key={i}>{s}</span>
          ))}
        </div>
        <div key={`${ano}-${mes}`} className={`grid grid-cols-7 gap-0.5 ${dir === 1 ? "sbj-pg-dir" : dir === -1 ? "sbj-pg-esq" : ""}`}>
          {cel.map((d, i) => {
            if (d === null) return <span key={"v" + i} />;
            const v = iso(ano, mes, d);
            const sel = v === value;
            return (
              <button
                key={v}
                type="button"
                onClick={() => escolhe(v)}
                className={`h-8 rounded-lg text-sm tabular-nums transition-colors ${sel ? "bg-primary text-white font-semibold shadow-sm" : v === hoje ? "text-primary font-semibold ring-1 ring-primary/40 hover:bg-primary/10" : "text-ink-700 hover:bg-primary/10 hover:text-primary"}`}
              >
                {d}
              </button>
            );
          })}
        </div>
        <div className="mt-2 pt-2 border-t border-border flex justify-between text-sm">
          <button type="button" onClick={() => escolhe("")} className="text-ink-500 hover:text-danger transition-colors">
            Limpar
          </button>
          <button type="button" onClick={() => escolhe(hoje)} className="text-primary font-semibold hover:underline">
            Hoje
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

// tabela do servidor com páginas: recebe o <thead> e as linhas (<tr>) como filhos
export function TabelaPaginada({ cabecalho, children, por = 25, className = "w-full text-sm" }: { cabecalho: React.ReactNode; children: React.ReactNode; por?: number; className?: string }) {
  const linhas = useMemo(() => Children.toArray(children), [children]);
  const pg = usePaginas(linhas, por, linhas.length);
  return (
    <div ref={pg.topo}>
      <div className="overflow-x-auto">
        <table className={className}>
          {cabecalho}
          <tbody key={pg.giro} className={pg.classe}>
            {pg.itens}
          </tbody>
        </table>
      </div>
      <Paginador {...pg} />
    </div>
  );
}
