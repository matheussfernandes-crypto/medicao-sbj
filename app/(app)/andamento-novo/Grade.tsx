"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { COR_STATUS, chaveAp, pct, type Soma } from "./calculo";
import { IconeX, fmtPct0 } from "./ui";
import type { Apontamento, Servico, Status } from "./types";

export type LinhaGrade = {
  alvoId: string;
  rotulo: string;
  grupoId?: string; // linhas seguidas com o mesmo grupo viram uma célula com rowspan (ex.: pavimento)
  grupoRotulo?: string;
  grupoSub?: string;
};

type Props = {
  linhas: LinhaGrade[];
  colunas: Servico[];
  ap: Map<string, Apontamento>;
  somaPorAlvo: Map<string, Soma>;
  modoSel: boolean;
  sel: Set<string>;
  setSel: (s: Set<string>) => void;
  onCelula: (e: React.MouseEvent, alvoId: string, servicoId: string) => void;
  tituloGrupo?: string;
  tituloLinha?: string;
  tam?: number;
  corDestaque?: string;
};

// Grade local × serviço. No modo "Selecionar várias": clique, arraste (retângulo), clique no nome do serviço (coluna)
// ou no nome do local (linha).
export default function Grade({ linhas, colunas, ap, somaPorAlvo, modoSel, sel, setSel, onCelula, tituloGrupo, tituloLinha = "Local", tam = 26, corDestaque = "#2c6975" }: Props) {
  const arraste = useRef<{ l: number; c: number; modo: "add" | "rem"; base: Set<string> } | null>(null);

  useEffect(() => {
    const soltar = () => {
      arraste.current = null;
    };
    window.addEventListener("mouseup", soltar);
    return () => window.removeEventListener("mouseup", soltar);
  }, []);

  const chave = (l: number, c: number) => chaveAp(linhas[l].alvoId, colunas[c].id);

  function aplicar(l: number, c: number) {
    const a = arraste.current;
    if (!a) return;
    const prox = new Set(a.base);
    for (let i = Math.min(a.l, l); i <= Math.max(a.l, l); i++)
      for (let j = Math.min(a.c, c); j <= Math.max(a.c, c); j++) {
        const k = chave(i, j);
        if (a.modo === "add") prox.add(k);
        else prox.delete(k);
      }
    setSel(prox);
  }

  function iniciar(e: React.MouseEvent, l: number, c: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    arraste.current = { l, c, modo: sel.has(chave(l, c)) ? "rem" : "add", base: new Set(sel) };
    aplicar(l, c);
  }

  function alternarGrupo(chaves: string[]) {
    const todas = chaves.length > 0 && chaves.every((k) => sel.has(k));
    const prox = new Set(sel);
    chaves.forEach((k) => (todas ? prox.delete(k) : prox.add(k)));
    setSel(prox);
  }

  function autoRolar(e: React.MouseEvent<HTMLDivElement>) {
    if (!arraste.current) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    if (e.clientY > r.bottom - 40) el.scrollTop += 20;
    else if (e.clientY < r.top + 150) el.scrollTop -= 20;
    if (e.clientX > r.right - 40) el.scrollLeft += 20;
    else if (e.clientX < r.left + 200) el.scrollLeft -= 20;
  }

  // rowspan por grupo
  const spans: number[] = linhas.map(() => 0);
  for (let i = 0; i < linhas.length; ) {
    let j = i + 1;
    while (j < linhas.length && linhas[i].grupoId && linhas[j].grupoId === linhas[i].grupoId) j++;
    spans[i] = j - i;
    i = j;
  }
  const temGrupo = linhas.some((l) => l.grupoId);
  const larguraGrupo = 120;

  return (
    <div className="overflow-auto border border-border rounded-lg bg-white" style={{ maxHeight: "72vh", userSelect: modoSel ? "none" : undefined }} onMouseMove={modoSel ? autoRolar : undefined}>
      <table className="border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            {temGrupo && (
              <th className="sticky top-0 left-0 z-30 bg-surface-subtle px-2 py-2 text-left border-b border-r border-border" style={{ minWidth: larguraGrupo }}>
                {tituloGrupo ?? "Pavimento"}
              </th>
            )}
            <th
              className="sticky top-0 z-30 bg-surface-subtle px-2 py-2 text-left border-b border-r border-border"
              style={{ left: temGrupo ? larguraGrupo : 0, minWidth: 110 }}
            >
              {tituloLinha}
            </th>
            {colunas.map((s, c) => (
              <th
                key={s.id}
                title={modoSel ? `Selecionar a coluna: ${s.nome}` : s.nome}
                onClick={modoSel ? () => alternarGrupo(linhas.map((_, l) => chave(l, c))) : undefined}
                className={`sticky top-0 z-20 bg-surface-subtle border-b border-r border-border font-semibold text-primaryDark ${modoSel ? "cursor-pointer hover:bg-accent/40" : ""}`}
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 132, padding: "6px 2px", minWidth: tam }}
              >
                {s.nome}
              </th>
            ))}
            <th className="sticky top-0 z-20 bg-surface-subtle px-2 py-2 border-b border-border text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((ln, l) => {
            const soma = somaPorAlvo.get(ln.alvoId);
            return (
              <tr key={ln.alvoId}>
                {temGrupo && spans[l] > 0 && (
                  <td
                    rowSpan={spans[l]}
                    onClick={modoSel ? () => alternarGrupo(linhas.slice(l, l + spans[l]).flatMap((x) => colunas.map((s) => chaveAp(x.alvoId, s.id)))) : undefined}
                    className={`sticky left-0 z-10 bg-white px-2 py-1 border-b border-r border-border font-semibold align-top whitespace-nowrap ${modoSel ? "cursor-pointer hover:bg-accent/30" : ""}`}
                    style={{ minWidth: larguraGrupo }}
                  >
                    {ln.grupoRotulo}
                    {ln.grupoSub && <div className="font-normal text-[10px] text-ink-400">{ln.grupoSub}</div>}
                  </td>
                )}
                <td
                  onClick={modoSel ? () => alternarGrupo(colunas.map((s) => chaveAp(ln.alvoId, s.id))) : undefined}
                  className={`sticky z-10 bg-white px-2 py-1 border-b border-r border-border whitespace-nowrap text-ink-700 ${modoSel ? "cursor-pointer hover:bg-accent/30" : ""}`}
                  style={{ left: temGrupo ? larguraGrupo : 0 }}
                >
                  {ln.rotulo}
                </td>
                {colunas.map((s, c) => {
                  const a = ap.get(chaveAp(ln.alvoId, s.id));
                  const st = (a?.status ?? 0) as Status;
                  const marcada = sel.has(chaveAp(ln.alvoId, s.id));
                  return (
                    <td
                      key={s.id}
                      title={`${ln.grupoRotulo ? ln.grupoRotulo + " · " : ""}${ln.rotulo} · ${s.nome}`}
                      onClick={modoSel ? undefined : (e) => onCelula(e, ln.alvoId, s.id)}
                      onMouseDown={modoSel ? (e) => iniciar(e, l, c) : undefined}
                      onMouseEnter={modoSel ? () => aplicar(l, c) : undefined}
                      className="border-b border-r border-border cursor-pointer relative hover:brightness-95"
                      style={{ background: COR_STATUS[st], width: tam, minWidth: tam, height: tam, boxShadow: marcada ? `inset 0 0 0 2px ${corDestaque}` : undefined }}
                    >
                      {st === 3 && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <IconeX />
                        </span>
                      )}
                      {marcada && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                          <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                        </span>
                      )}
                      {!marcada && a?.observacao && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-black" />}
                    </td>
                  );
                })}
                <td className="px-2 py-1 border-b border-border text-right font-semibold tabular-nums" style={{ color: corDestaque }}>
                  {soma ? fmtPct0(pct(soma)) : "0"}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
