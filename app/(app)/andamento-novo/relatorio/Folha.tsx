"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { A3, MARGEM_FOLHA } from "./modelo";
import { fmtPct0 } from "../ui";

export const ALTURA_CABECALHO = 112;
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
      const h = el.offsetHeight * escala;
      const novo = h > altura ? (altura / h) * escala * 0.995 : escala;
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
            <div style={{ fontSize: 27, fontWeight: 800, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: larguraUtil - 330 }}>
              {primeiraSemResumo ? titulo : `${obraNome} — ${titulo}`}
            </div>
            <div style={{ fontSize: 11, color: "#d7e7e8" }}>
              Emitido em {emitidoEm} · por {usuario}
            </div>
            {filtros && <div style={{ fontSize: 11, color: "#f5c84c", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: larguraUtil - 330 }}>Filtros: {filtros}</div>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, color: "#f5c84c" }}>{fmtPct0(pct)}%</div>
          <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "#d7e7e8" }}>concluído</div>
        </div>
      </div>

      <div className="rel-conteudo" style={{ height: h - MARGEM_FOLHA * 2 - ALTURA_CABECALHO - 12 - ALTURA_RODAPE, marginTop: 12, overflow: "hidden" }}>
        <AutoEscala escala={escala} altura={h - MARGEM_FOLHA * 2 - ALTURA_CABECALHO - 12 - ALTURA_RODAPE} largura={larguraUtil}>
          {children}
        </AutoEscala>
      </div>

      <div style={{ position: "absolute", left: MARGEM_FOLHA, right: MARGEM_FOLHA, bottom: MARGEM_FOLHA - 6, height: ALTURA_RODAPE, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#65707d", borderTop: "1px solid #e1e6e9" }}>
        <span>Engenharia SBJ · {obraNome}</span>
        <span>
          Página {numero} de {total} · {titulo}
        </span>
      </div>
    </div>
  );
}
