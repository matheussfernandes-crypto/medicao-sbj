"use client";

// Peças usadas nas duas telas de Arquitetura: janela (modal), campo de foto e seletor de modelo do catálogo.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImageOff, ImagePlus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { enviarFoto, urlImg } from "@/lib/especificacoes/imagem";
import { FAIXAS, fold, type Grupo, type Vidro } from "@/lib/especificacoes/regras";
import { esquemaVidro } from "@/lib/especificacoes/desenho";
import { btnIcone, btnSec, campo } from "./ui";

export type Modelo = {
  id: string; grupo: Grupo; material: string; referencia: string; medidas: string; marca: string; linha: string; acab: string;
  codigo: string; faixa: number | null; uso: string; valor_ref: number | null; img: string; revisar: boolean; ordem: number;
};

export function Janela({ titulo, onFechar, children, largura = "max-w-2xl" }: { titulo: string; onFechar: () => void; children: React.ReactNode; largura?: string }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    setMontado(true);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);
  if (!montado) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className={`w-full ${largura} rounded-2xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold text-primaryDark">{titulo}</h2>
          <button type="button" className={btnIcone} onClick={onFechar} title="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function Miniatura({ img, assinadas, tam = "h-12 w-12" }: { img: string; assinadas: Record<string, string>; tam?: string }) {
  const src = urlImg(img, assinadas);
  return (
    <div className={`${tam} flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white`}>
      {src ? <img src={src} alt="" className="h-full w-full object-contain" loading="lazy" /> : <ImageOff className="h-4 w-4 text-ink-300" />}
    </div>
  );
}

/** Foto do item/modelo: mostra, troca (envia para o bucket) ou tira. */
export function FotoCampo({ valor, onChange, assinadas }: { valor: string; onChange: (img: string) => void; assinadas: Record<string, string> }) {
  const input = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function escolher(f: File) {
    setErro(null);
    setEnviando(true);
    try {
      const img = await enviarFoto(createClient(), f);
      setPrevia((p) => ({ ...p, [img]: URL.createObjectURL(f) }));
      onChange(img);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setEnviando(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="flex items-center gap-3">
      <Miniatura img={valor} assinadas={{ ...assinadas, ...previa }} tam="h-20 w-20" />
      <div className="space-y-1">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSec} disabled={enviando} onClick={() => input.current?.click()}>
            <ImagePlus className="h-4 w-4" /> {enviando ? "Enviando…" : valor ? "Trocar foto" : "Enviar foto"}
          </button>
          {valor && (
            <button type="button" className={btnSec} onClick={() => onChange("")}>
              Tirar foto
            </button>
          )}
        </div>
        {erro && <p className="text-xs text-danger">{erro}</p>}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && escolher(e.target.files[0])} />
    </div>
  );
}

export function Faixa({ f }: { f: number | null }) {
  if (!f || !FAIXAS[f]) return null;
  return (
    <span title={FAIXAS[f][1]} className="rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-primaryDark">
      {FAIXAS[f][0]}
    </span>
  );
}

/** Lista do catálogo para escolher um modelo (filtra pelo grupo e, se houver, pelo item digitado). */
export function SeletorModelo({
  modelos, grupo, material, assinadas, onEscolher,
}: { modelos: Modelo[]; grupo: Grupo; material: string; assinadas: Record<string, string>; onEscolher: (m: Modelo) => void }) {
  const [busca, setBusca] = useState("");
  const [soMaterial, setSoMaterial] = useState(true);
  const mat = fold(material).trim();
  const lista = useMemo(() => {
    const f = fold(busca);
    return modelos
      .filter((m) => m.grupo === grupo)
      .filter((m) => !(soMaterial && mat) || fold(m.material) === mat)
      .filter((m) => !f || fold(`${m.material} ${m.referencia} ${m.marca} ${m.linha} ${m.acab} ${m.codigo}`).includes(f))
      .sort((a, b) => a.material.localeCompare(b.material) || (a.faixa ?? 9) - (b.faixa ?? 9) || a.referencia.localeCompare(b.referencia));
  }, [modelos, grupo, mat, soMaterial, busca]);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
          <input autoFocus className={campo + " pl-9"} placeholder="Buscar no catálogo (marca, linha, código…)" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {mat && (
          <label className="flex items-center gap-1.5 text-xs text-ink-700">
            <input type="checkbox" checked={soMaterial} onChange={(e) => setSoMaterial(e.target.checked)} /> Só {material.toUpperCase()}
          </label>
        )}
      </div>
      <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-[10px] border border-border">
        {!lista.length && <li className="p-4 text-center text-sm text-ink-500">Nenhum modelo encontrado.</li>}
        {lista.map((m) => (
          <li key={m.id}>
            <button type="button" className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-subtle" onClick={() => onEscolher(m)}>
              <Miniatura img={m.img} assinadas={assinadas} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-ink-400">{m.material}</div>
                <div className="text-sm text-ink-900">{m.referencia}</div>
                <div className="text-xs text-ink-500">{[m.marca, m.linha, m.acab, m.codigo].filter(Boolean).join(" · ")}</div>
              </div>
              <Faixa f={m.faixa} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Desenho automático do vidro/box (quando o item não tem foto). */
export function DesenhoVidro({ material, vidro, tam = "h-16 w-24" }: { material: string; vidro: Vidro; tam?: string }) {
  const svg = useMemo(() => esquemaVidro(material, vidro), [material, vidro]);
  return <div className={`${tam} shrink-0 overflow-hidden rounded-lg border border-border bg-white`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
