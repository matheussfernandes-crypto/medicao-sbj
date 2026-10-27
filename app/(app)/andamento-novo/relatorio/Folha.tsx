"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { MARGEM_FOLHA, dimFolha, type Papel } from "./modelo";
import { fmtPct0 } from "../ui";
import { COR_STATUS } from "../calculo";

// legenda das cores das tabelas e das fachadas (rodapé das folhas de tabelas)
function LegendaStatus() {
  const quadro = (cor: string) => <i style={{ width: 12, height: 12, background: cor, borderRadius: 2, display: "inline-block", flex: "none" }} />;
  const item = (cor: string, nome: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      {quadro(cor)}
      {nome}
    </span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 16, fontSize: 11, color: "#4b5a60" }}>
      {item(COR_STATUS[2], "Finalizado")}
      {item(COR_STATUS[1], "Em andamento")}
      {item(COR_STATUS[0], "Não iniciado")}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ flex: "none" }}>
          <rect x="0.5" y="0.5" width="11" height="11" fill="#fff" stroke="#d3dadd" />
          <line x1="0.5" y1="11.5" x2="11.5" y2="0.5" stroke="#b4bec2" strokeWidth="1.2" />
        </svg>
        Ausência
      </span>
    </span>
  );
}

export const ALTURA_CABECALHO = 124;
export const ALTURA_RODAPE = 34;

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

export function dimensoes(folha: "h" | "v", papel: Papel = "A3") {
  const { w, h } = dimFolha(papel, folha);
  const larguraUtil = w - MARGEM_FOLHA * 2;
  const alturaUtil = h - MARGEM_FOLHA * 2 - ALTURA_CABECALHO - 12 - ALTURA_RODAPE;
  return { w, h, larguraUtil, alturaUtil };
}

// Uma folha de verdade (A4, A3, A2 ou A1; 96 dpi), com cabeçalho, conteúdo e rodapé. Margem, cabeçalho e rodapé têm o mesmo tamanho em todas.
export default function Folha({
  folha,
  papel = "A3",
  obraNome,
  titulo,
  sub = "Relatório de andamento de obra",
  pct,
  emitidoEm,
  usuario,
  numero,
  total,
  children,
  escala = 1,
  fixa = false,
  legenda = false,
}: {
  folha: "h" | "v";
  papel?: Papel;
  obraNome: string;
  titulo: string;
  sub?: string; // subtítulo da faixa (nome da montagem, por exemplo)
  pct: number | null;
  emitidoEm: string;
  usuario: string;
  numero: number;
  total: number;
  children: React.ReactNode;
  escala?: number;
  legenda?: boolean; // legenda das cores no rodapé (folhas de tabelas e de fachada)
  fixa?: boolean; // conteúdo já calculado para caber (escala única do relatório): não reduz nem amplia
}) {
  const { w, h, larguraUtil } = dimensoes(folha, papel);
  const estreita = w < 900; // A4 em pé: logo e % um pouco menores para o cabeçalho não apertar
  return (
    <div className="rel-folha" data-folha={numero} data-pagina={`${papel}-${folha}`} style={{ width: w, height: h, padding: MARGEM_FOLHA, background: "#fff", position: "relative", overflow: "hidden", boxSizing: "border-box", fontFamily: "inherit", color: "#1f2937" }}>
      <div
        className="rel-faixa"
        style={{
          height: ALTURA_CABECALHO,
          background: "#2a6270", // cor chapada: degradê grande pesa no PDF e some em alguns leitores de celular
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
          <img src="/logo-topbar.png" alt="SBJ" style={{ height: estreita ? 46 : 58, width: "auto" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#cfe3e5" }}>
              SBJ Construtora e Incorporadora · {sub}
            </div>
            <span style={{ display: "inline-block", background: "#f5c84c", color: "#1f4a52", fontWeight: 800, fontSize: 12, borderRadius: 5, padding: "1px 9px", marginTop: 3 }}>{obraNome}</span>
            {(() => {
              // o título nunca é cortado: quebra em até 2 linhas e a fonte diminui conforme o tamanho do texto
              const texto = titulo;
              const fs = (texto.length <= 34 ? 27 : texto.length <= 52 ? 23 : texto.length <= 80 ? 19 : 16) - (estreita ? 4 : 0);
              return (
                <div style={{ fontSize: fs, fontWeight: 800, lineHeight: 1.1, maxWidth: larguraUtil - (estreita ? 240 : 330), overflowWrap: "anywhere" }}>{texto}</div>
              );
            })()}
            <div style={{ fontSize: 11, color: "#d7e7e8" }}>
              Emitido em {emitidoEm} · por {usuario}
            </div>
          </div>
        </div>
        {pct != null && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: estreita ? 40 : 52, fontWeight: 800, lineHeight: 1, color: "#f5c84c" }}>{fmtPct0(pct)}%</div>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "#d7e7e8" }}>concluído</div>
          </div>
        )}
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
        <span>
          Engenharia SBJ · <b style={{ color: "#2c6975", fontWeight: 600 }}>{obraNome}</b>
        </span>
        {legenda && <LegendaStatus />}
        <span>
          Página {numero} de {total} · {titulo}
        </span>
      </div>
    </div>
  );
}
