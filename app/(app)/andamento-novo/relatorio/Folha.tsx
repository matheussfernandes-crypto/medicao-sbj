"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { A3, MARGEM_FOLHA } from "./modelo";
import { fmtPct0 } from "../ui";

export const ALTURA_CABECALHO = 124;
export const ALTURA_RODAPE = 26;

// Mede o conteúdo na largura real e reduz a escala só se ele passar da altura da folha (nada fica cortado).
function AutoEscala({ escala, altura, largura, children }: { escala: number; altura: number; largura: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [z, setZ] = useState(escala);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let travado = false;
    const ajustar = () => {
      if (travado) return;
      travado = true;
      el.style.transform = "none";
      el.style.width = `${largura / escala}px`;
      // 1) largura: tabela mais larga que a folha encolhe até caber
      el.dataset.hnat = String(Math.round(el.offsetHeight * escala)); // altura natural (para detectar bloco que não coube)
      const larguraLayout = largura / escala;
      const fw = el.scrollWidth > larguraLayout + 1 ? larguraLayout / el.scrollWidth : 1;
      let novo = escala * fw * 0.995;
      el.style.width = `${largura / novo}px`;
      // 2) altura: conteúdo mais alto que a folha encolhe até caber
      const h = el.offsetHeight * novo;
      if (h > altura) novo = novo * (altura / h) * 0.995;
      if (novo > escala) novo = escala;
      el.style.width = `${largura / novo}px`;
      el.style.transform = `scale(${novo})`;
      setZ((a) => (Math.abs(a - novo) > 0.001 ? novo : a));
      requestAnimationFrame(() => (travado = false));
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(el);
    const t = setTimeout(ajustar, 300);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [escala, altura, largura]);
  return (
    <div ref={ref} style={{ width: largura / z, transformOrigin: "top left", transform: `scale(${z})` }}>
      {children}
    </div>
  );
}

export function dimensoes(folha: "h" | "v") {
  const { w, h } = A3[folha];
  const larguraUtil = w - MARGEM_FOLHA * 2;
  const alturaUtil = h - MARGEM_FOLHA * 2 - ALTURA_CABECALHO - 12 - ALTURA_RODAPE;
  return { w, h, larguraUtil, alturaUtil };
}

// Uma folha A3 de verdade (1587×1123 px a 96 dpi, ou em pé), com cabeçalho, conteúdo e rodapé.
export default function Folha({
  folha,
  obraNome,
  titulo,
  filtros,
  pct,
  emitidoEm,
  usuario,
  numero,
  total,
  primeiraSemResumo,
  children,
  escala = 1,
  fixa = false,
  legenda,
}: {
  folha: "h" | "v";
  obraNome: string;
  titulo: string;
  filtros?: string;
  pct: number;
  emitidoEm: string;
  usuario: string;
  numero: number;
  total: number;
  primeiraSemResumo?: boolean;
  children: React.ReactNode;
  escala?: number;
  fixa?: boolean; // modelo otimizado: sem reduzir/ampliar o conteúdo (escala única em todo o relatório)
  legenda?: React.ReactNode; // rodapé: legenda de cores
}) {
  const { w, h, larguraUtil } = dimensoes(folha);
  return (
    <div className="rel-folha" data-folha={numero} style={{ width: w, height: h, padding: MARGEM_FOLHA, background: "#fff", position: "relative", overflow: "hidden", boxSizing: "border-box", fontFamily: "inherit", color: "#1f2937" }}>
      <div
        className="rel-faixa"
        style={{
          height: ALTURA_CABECALHO,
          background: "linear-gradient(120deg,#1f4a52,#2c6975 70%,#3a8794)",
          boxShadow: "inset 0 -6px 0 #f5c84c",
          borderRadius: 10,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 26px 6px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, minWidth: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-topbar.png" alt="SBJ" style={{ height: 58, width: "auto" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#cfe3e5" }}>
              SBJ Construtora e Incorporadora · {primeiraSemResumo ? "Relatório de andamento de obra" : "Andamento de obra"}
            </div>
            {primeiraSemResumo && (
              <span style={{ display: "inline-block", background: "#f5c84c", color: "#1f4a52", fontWeight: 800, fontSize: 12, borderRadius: 5, padding: "1px 9px", marginTop: 3 }}>{obraNome}</span>
            )}
            {(() => {
              // o título nunca é cortado: quebra em até 2 linhas e a fonte diminui conforme o tamanho do texto
              const texto = primeiraSemResumo ? titulo : `${obraNome} — ${titulo}`;
              const fs = texto.length <= 34 ? 27 : texto.length <= 52 ? 23 : texto.length <= 80 ? 19 : 16;
              return (
                <div style={{ fontSize: fs, fontWeight: 800, lineHeight: 1.1, maxWidth: larguraUtil - 330, overflowWrap: "anywhere" }}>{texto}</div>
              );
            })()}
            <div style={{ fontSize: 11, color: "#d7e7e8" }}>
              Emitido em {emitidoEm} · por {usuario}
            </div>
            {filtros && (
              <div style={{ fontSize: filtros.length < 130 ? 11 : filtros.length < 220 ? 9.5 : 8.5, color: "#f5c84c", marginTop: 1, lineHeight: 1.15, maxWidth: larguraUtil - 330 }}>Filtros: {filtros}</div>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, color: "#f5c84c" }}>{fmtPct0(pct)}%</div>
          <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "#d7e7e8" }}>concluído</div>
        </div>
      </div>

      <div className="rel-conteudo" style={{ height: h - MARGEM_FOLHA * 2 - ALTURA_CABECALHO - 12 - ALTURA_RODAPE, marginTop: 12, overflow: "hidden" }}>
        {fixa ? (
          <div data-hnat={0} style={{ width: larguraUtil }}>
            {children}
          </div>
        ) : (
          <AutoEscala escala={escala} altura={h - MARGEM_FOLHA * 2 - ALTURA_CABECALHO - 12 - ALTURA_RODAPE} largura={larguraUtil}>
            {children}
          </AutoEscala>
        )}
      </div>

      <div style={{ position: "absolute", left: MARGEM_FOLHA, right: MARGEM_FOLHA, bottom: MARGEM_FOLHA - 6, height: ALTURA_RODAPE, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#65707d", borderTop: "1px solid #e1e6e9" }}>
        {legenda ? <span>{legenda}</span> : <span>Engenharia SBJ · {obraNome}</span>}
        <span>
          {legenda ? `${obraNome} · ${emitidoEm} · ${usuario} · ` : ""}Página {numero} de {total}
          {legenda ? "" : ` · ${titulo}`}
        </span>
      </div>
    </div>
  );
}
