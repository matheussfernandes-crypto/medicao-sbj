"use client";

// Menu de seleção no padrão do pós-obra (no lugar do <select> nativo, que fica com cara de Windows antigo).
// Uso igual ao <select>: <Selecao value onChange={(e) => …e.target.value}> com <option>/<optgroup> dentro.

import { Children, isValidElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type Opcao = { valor: string; texto: string; desab: boolean; grupo?: string };

function texto(n: React.ReactNode): string {
  if (n == null || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(texto).join("");
  if (isValidElement(n)) return texto((n.props as { children?: React.ReactNode }).children);
  return "";
}

function lerOpcoes(children: React.ReactNode, grupo?: string, saida: Opcao[] = []): Opcao[] {
  Children.forEach(children, (ch) => {
    if (!isValidElement(ch)) return;
    const p = ch.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean; label?: string };
    if (ch.type === "option") {
      const t = texto(p.children).trim();
      saida.push({ valor: p.value != null ? String(p.value) : t, texto: t, desab: !!p.disabled, grupo });
    } else if (ch.type === "optgroup") lerOpcoes(p.children, p.label, saida);
    else lerOpcoes(p.children, grupo, saida); // fragmentos
  });
  return saida;
}

const LAYOUT = /^(flex-1|w-full|w-\[|w-\d|block|min-w-|max-w-|ml-|mt-|mr-|mb-|shrink|grow)/;

export default function Selecao({
  value: valorControlado,
  defaultValue,
  name,
  required,
  onChange,
  children,
  className = "",
  disabled,
  title,
  ...resto
}: {
  value?: string | number;
  defaultValue?: string | number;
  name?: string; // dentro de <form>: o valor escolhido vai no envio, como no <select> nativo
  required?: boolean;
  onChange?: (e: { target: { value: string } }) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
}) {
  const opcoes = useMemo(() => lerOpcoes(children), [children]);
  const controlado = valorControlado !== undefined;
  const [interno, setInterno] = useState(() => (defaultValue !== undefined ? String(defaultValue) : ""));
  // sem valor inicial, o <select> nativo mostra a primeira opção
  const atual = controlado ? String(valorControlado ?? "") : defaultValue !== undefined || interno !== "" ? interno : opcoes[0]?.valor ?? "";
  const sel = opcoes.find((o) => o.valor === atual);
  const [aberto, setAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [busca, setBusca] = useState("");
  const [pos, setPos] = useState<{ left: number; top: number; minW: number; maxH: number; cima: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  const classes = className.split(/\s+/).filter(Boolean);
  const doWrap = classes.filter((c) => LAYOUT.test(c)).join(" ");
  const doBtn = classes.filter((c) => !/^(block|ml-|mt-|mr-|mb-)/.test(c)).join(" ");
  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? opcoes.filter((o) => o.texto.toLowerCase().includes(q)) : opcoes;
  }, [opcoes, busca]);

  function abrir() {
    if (disabled) return;
    setBusca("");
    setAtivo(Math.max(0, opcoes.findIndex((o) => o.valor === atual)));
    setSaindo(false);
    setAberto(true);
  }
  function fechar() {
    if (!aberto) return;
    setSaindo(true);
    setTimeout(() => {
      setAberto(false);
      setSaindo(false);
    }, 120);
  }
  function escolher(o?: Opcao) {
    if (!o || o.desab) return;
    if (!controlado) setInterno(o.valor);
    if (o.valor !== atual) {
      onChange?.({ target: { value: o.valor } });
      // dentro de um <FormFiltro>: avisa o formulário depois que o valor escondido foi atualizado
      const f = btn.current?.closest("form[data-filtro-auto]");
      if (f) setTimeout(() => f.dispatchEvent(new CustomEvent("filtro-mudou")), 30);
    }
    fechar();
    btn.current?.focus();
  }

  // posição do menu (abre para cima se não couber embaixo)
  useLayoutEffect(() => {
    if (!aberto || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const alt = Math.min(menu.current?.offsetHeight ?? 300, 340);
    const abaixo = window.innerHeight - r.bottom;
    const cima = abaixo < alt + 12 && r.top > abaixo;
    const minW = Math.max(r.width, 160);
    const largMenu = Math.max(minW, menu.current?.offsetWidth ?? minW);
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - largMenu - 8)),
      top: cima ? Math.max(8, r.top - alt - 6) : r.bottom + 6,
      minW,
      maxH: Math.max(160, Math.min(340, (cima ? r.top : abaixo) - 14)),
      cima,
    });
  }, [aberto, visiveis.length]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) fechar();
    };
    const rolar = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) fechar();
    };
    document.addEventListener("mousedown", fora, true);
    window.addEventListener("scroll", rolar, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("mousedown", fora, true);
      window.removeEventListener("scroll", rolar, true);
      window.removeEventListener("resize", fechar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    lista.current?.querySelector<HTMLElement>(`[data-i="${ativo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [ativo, aberto]);

  function tecla(e: React.KeyboardEvent) {
    if (!aberto) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        abrir();
      }
      return;
    }
    const v = visiveis.filter((o) => !o.desab);
    const k = v.indexOf(visiveis[ativo]);
    const vai = (o?: Opcao) => o && setAtivo(visiveis.indexOf(o));
    if (e.key === "ArrowDown") (e.preventDefault(), vai(v[Math.min(v.length - 1, k + 1)]));
    else if (e.key === "ArrowUp") (e.preventDefault(), vai(v[Math.max(0, k - 1)]));
    else if (e.key === "Enter") (e.preventDefault(), escolher(visiveis[ativo]));
    else if (e.key === "Escape") (e.preventDefault(), fechar());
    else if (e.key === "Tab") fechar();
  }

  const comBusca = opcoes.length > 10;
  let grupoAnterior: string | undefined;

  return (
    <span className={`relative inline-block align-middle max-w-full ${doWrap}`}>
      {name && (
        // campo de verdade para o envio do formulário; "required" faz o navegador avisar se estiver vazio
        <input name={name} value={atual} required={required} disabled={disabled} tabIndex={-1} aria-hidden onChange={() => {}} onFocus={() => btn.current?.focus()} className="absolute inset-0 w-full h-full opacity-0 pointer-events-none" />
      )}
      <button
        ref={btn}
        type="button"
        disabled={disabled}
        title={title}
        aria-label={resto["aria-label"]}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => (aberto ? fechar() : abrir())}
        onKeyDown={tecla}
        className={`sbj-sel ${aberto ? "aberto" : ""} ${doBtn} w-full`}
      >
        <span className={`truncate flex-1 min-w-0 text-left ${sel && sel.valor !== "" ? "" : "opacity-70"}`}>{sel?.texto || "Selecionar"}</span>
        <ChevronDown className="sbj-sel-seta w-3.5 h-3.5 shrink-0" />
      </button>
      {aberto &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menu}
            role="listbox"
            onKeyDown={tecla}
            onMouseDown={(e) => e.target !== menu.current?.querySelector("input") && e.preventDefault()}
            className={`sbj-sel-menu ${pos?.cima ? "cima" : ""} ${saindo ? "saindo" : ""}`}
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, minWidth: pos?.minW, maxHeight: pos?.maxH }}
          >
            {comBusca && (
              <input
                autoFocus
                type="search"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setAtivo(0);
                }}
                placeholder="Buscar…"
                className="sbj-sel-busca"
              />
            )}
            <div ref={lista} className="overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {visiveis.length === 0 && <div className="px-3 py-2 text-sm text-ink-500">Nada encontrado</div>}
              {visiveis.map((o, i) => {
                const cab = o.grupo && o.grupo !== grupoAnterior ? o.grupo : null;
                grupoAnterior = o.grupo;
                return (
                  <div key={o.valor + ":" + i}>
                    {cab && <div className="sbj-sel-grupo">{cab}</div>}
                    <div
                      data-i={i}
                      role="option"
                      aria-selected={o.valor === atual}
                      onMouseMove={() => i !== ativo && setAtivo(i)}
                      onClick={() => escolher(o)}
                      className={`sbj-sel-item ${i === ativo ? "ativo" : ""} ${o.valor === atual ? "sel" : ""} ${o.desab ? "off" : ""} ${o.grupo ? "pl-5" : ""}`}
                    >
                      <span className="truncate">{o.texto || "—"}</span>
                      <Check className="sbj-sel-check w-3.5 h-3.5 shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}
