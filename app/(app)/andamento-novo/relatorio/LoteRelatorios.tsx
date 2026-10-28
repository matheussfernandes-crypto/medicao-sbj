"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Loader2 } from "lucide-react";
import type { MetaRelatorio, RespostaGerar } from "./tiposApi";

export type ObraLote = { id: string; nome: string };
export type EstadoObra = { obraId: string; nome: string; estado: "fila" | "gerando" | "ok" | "erro"; erro?: string; resp?: RespostaGerar; registrado?: boolean };

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const nomeArquivoPdf = (obra: string) => `Relatorio-Andamento_${semAcento(obra).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "")}_${new Date().toISOString().slice(0, 10)}.pdf`;
export const nomeLote = (n: number, ext: "pdf" | "zip") => `Relatorios-Andamento_${n}-obras_${new Date().toISOString().slice(0, 10)}.${ext}`;

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function baixarBytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("não foi possível baixar um dos PDFs");
  return new Uint8Array(await r.arrayBuffer());
}

// monta o arquivo final do lote no navegador (os PDFs já estão guardados; aqui só se juntam)
export async function montarArquivoLote(itens: { nome: string; url: string; meta: MetaRelatorio; paginas: number; pct: number }[], juntar: boolean): Promise<{ blob: Blob; nome: string }> {
  const pdfs = await Promise.all(itens.map((i) => baixarBytes(i.url)));
  if (juntar || itens.length === 1) {
    const { juntarComCapa } = await import("@/lib/pdf/juntar");
    const hoje = new Date().toLocaleDateString("pt-BR");
    const unido = await juntarComCapa(pdfs, {
      titulo: "Relatórios de andamento",
      subtitulo: `Emitido em ${hoje} · ${itens.length} ${itens.length === 1 ? "obra" : "obras"}`,
      itens: itens.map((i) => ({ obra: i.nome, detalhe: `${i.meta.tipo === "montagem" ? `Modelo "${i.meta.montagemNome}"` : "Relatório simples"} · ${i.meta.folha} · ${i.paginas} páginas · ${Math.round(i.pct)}% concluído` })),
    });
    return { blob: new Blob([unido as BlobPart], { type: "application/pdf" }), nome: nomeLote(itens.length, "pdf") };
  }
  const { zipSync } = await import("fflate");
  const arquivos: Record<string, Uint8Array> = {};
  itens.forEach((i, k) => {
    arquivos[nomeArquivoPdf(i.nome)] = pdfs[k];
  });
  const zip = zipSync(arquivos, { level: 0 }); // PDF já vem comprimido
  return { blob: new Blob([zip as BlobPart], { type: "application/zip" }), nome: nomeLote(itens.length, "zip") };
}

// ---------- escolha das obras (e como sai o resultado) ----------
export function SeletorObras({
  obras,
  sel,
  onSel,
  juntar,
  onJuntar,
  obraAtual,
}: {
  obras: ObraLote[];
  sel: string[];
  onSel: (ids: string[]) => void;
  juntar: boolean;
  onJuntar: (v: boolean) => void;
  obraAtual: string;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);
  const alternar = (id: string) => onSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const resumo = sel.length === 1 && sel[0] === obraAtual ? "só esta obra" : `${sel.length} ${sel.length === 1 ? "obra" : "obras"}`;
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className={`text-sm px-3 py-2 border rounded-lg flex items-center gap-1.5 ${sel.length > 1 || sel[0] !== obraAtual ? "border-primary bg-primary/10 text-primaryDark font-medium" : "border-border bg-white"}`}>
        Obras: {resumo} <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {aberto && (
        <div className="absolute right-0 z-30 mt-1 w-80 bg-white border border-border rounded-lg shadow-panel p-3 space-y-2">
          <p className="text-xs text-ink-500">Gerar, imprimir ou enviar com a configuração que está na tela (relatório escolhido, formatação, folha e resumo), uma vez para cada obra marcada.</p>
          <div className="flex gap-3">
            <button className="text-xs underline text-primary" onClick={() => onSel(obras.map((o) => o.id))}>
              Marcar todas
            </button>
            <button className="text-xs underline text-primary" onClick={() => onSel([])}>
              Desmarcar todas
            </button>
            <button className="text-xs underline text-primary ml-auto" onClick={() => onSel([obraAtual])}>
              Só esta
            </button>
          </div>
          <div className="max-h-56 overflow-auto space-y-1">
            {obras.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sel.includes(o.id)} onChange={() => alternar(o.id)} />
                {o.nome}
                {o.id === obraAtual && <span className="text-[11px] text-ink-500">(aberta)</span>}
              </label>
            ))}
          </div>
          {sel.length > 1 && (
            <div className="border-t border-border pt-2 space-y-1 text-sm">
              <div className="text-[11px] uppercase text-ink-500">Como sai o resultado</div>
              <label className="flex items-center gap-2">
                <input type="radio" name="juntar" checked={!juntar} onChange={() => onJuntar(false)} /> Um PDF por obra
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="juntar" checked={juntar} onChange={() => onJuntar(true)} /> Juntar num PDF só (com capa)
              </label>
              <p className="text-[11px] text-ink-500">Imprimir sempre sai num documento só. No PDF e no e-mail vale a escolha acima.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- andamento do lote ----------
export function ProgressoLote({ itens, fase, onTentarDeNovo, onFechar }: { itens: EstadoObra[]; fase: "gerando" | "enviando" | "pronto"; onTentarDeNovo?: () => void; onFechar?: () => void }) {
  const total = itens.length;
  const atual = itens.findIndex((i) => i.estado === "gerando");
  const falhas = itens.filter((i) => i.estado === "erro");
  return (
    <div className="space-y-1.5 text-sm">
      {fase === "gerando" && atual >= 0 && (
        <p className="flex items-center gap-2 text-primaryDark">
          <Loader2 className="w-4 h-4 animate-spin" /> Gerando {atual + 1} de {total}: {itens[atual].nome}…
        </p>
      )}
      {fase === "enviando" && (
        <p className="flex items-center gap-2 text-primaryDark">
          <Loader2 className="w-4 h-4 animate-spin" /> Registrando e enviando…
        </p>
      )}
      <ul className="space-y-0.5">
        {itens.map((i) => (
          <li key={i.obraId} className="flex flex-wrap items-center gap-2">
            {i.estado === "ok" ? <Check className="w-4 h-4 text-success" /> : i.estado === "erro" ? <AlertTriangle className="w-4 h-4 text-danger" /> : i.estado === "gerando" ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <span className="w-4 h-4 inline-block rounded-full border border-border" />}
            <span className={i.estado === "erro" ? "text-danger" : ""}>
              {i.nome}
              {i.estado === "ok" && i.resp?.paginas ? <span className="text-xs text-ink-500"> · {i.resp.paginas} páginas</span> : ""}
              {i.estado === "erro" && i.erro ? <span className="text-xs"> — {i.erro}</span> : ""}
            </span>
            {i.resp?.avisos?.map((a) => (
              <span key={a} className="basis-full pl-6 text-xs" style={{ color: "#7a5a00" }}>
                {a}
              </span>
            ))}
          </li>
        ))}
      </ul>
      {fase === "pronto" && (
        <div className="flex gap-2 pt-1">
          {falhas.length > 0 && onTentarDeNovo && (
            <button className="text-xs px-3 py-1.5 rounded-md bg-primary text-white font-medium" onClick={onTentarDeNovo}>
              Tentar de novo ({falhas.length})
            </button>
          )}
          {onFechar && (
            <button className="text-xs px-3 py-1.5 border border-border rounded-md bg-white" onClick={onFechar}>
              Fechar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
