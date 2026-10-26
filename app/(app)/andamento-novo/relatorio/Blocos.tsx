"use client";

import { useMemo } from "react";
import { COR_STATUS, acumular, pct, somaZero, type Soma } from "../calculo";
import { calcularNiveis, chaveItemFachada, descidasDoServico, itensDoServico, mapaItensFachada } from "../fachada";
import Predio3D, { NOME_FACE, NOME_PARTE, type Face, type Parte } from "../Predio3D";
import { Barra, fmtPct0 } from "../ui";
import { status, type Ctx } from "./modelo";
import type { Servico, Status } from "../types";

const CINZA = COR_STATUS[0];

// ===================== fachada em 3D grande (uma folha por serviço; a faixa da categoria vem de fora) =====================

export function BlocoFachada3D({ servico, ctx, largura, altura }: { servico: Servico; ctx: Ctx; largura: number; altura: number }) {
  const sis = ctx.dados.sistemas.find((s) => s.tipo === "fachada");
  const itens = sis ? itensDoServico(ctx.itensPorSis.get(sis.id) ?? [], servico.id) : [];
  const niveis = useMemo(() => calcularNiveis(ctx.pavs, ctx.locaisPorPav, ctx.idx), [ctx]);
  const descidas = useMemo(() => (sis ? descidasDoServico(sis, servico.id) : null), [sis, servico.id]);
  const porChave = useMemo(() => mapaItensFachada(itens), [itens]);
  if (!sis || !descidas) return null;
  const cor = (parte: Parte, face: Face, d: number, nivelId: string) => {
    const it = porChave.get(chaveItemFachada(parte, face, d, nivelId));
    return it ? COR_STATUS[status(ctx.ap, it.id, servico.id)] : CINZA;
  };
  const pf: Record<Face, Soma> = { N: somaZero(), S: somaZero(), L: somaZero(), O: somaZero() };
  const pp: Record<Parte, Soma> = { emb: somaZero(), tor: somaZero(), res: somaZero() };
  itens.forEach((i) => {
    if (!i.face || !i.parte) return;
    const st = status(ctx.ap, i.id, servico.id);
    acumular(pf[i.face], 1, st);
    acumular(pp[i.parte], 1, st);
  });
  const vertical = largura < altura;
  const alturaDesenho = vertical ? Math.max(400, altura - 300) : altura - 40;
  const alturaSvg = vertical ? Math.max(400, altura - 290) : altura - 30;
  return (
    <div style={{ height: altura, width: "100%" }}>
      <div className={vertical ? "" : "flex gap-4"} style={{ width: "100%", padding: "12px 16px" }}>
        <div className={vertical ? "grid grid-cols-2 gap-3" : "flex-1 grid grid-cols-2 gap-3"}>
          <div>
            <p className="text-center font-semibold text-[12px]" style={{ color: "#5f7076" }}>
              Vista Norte + Leste
            </p>
            <Predio3D vista="NE" descidas={descidas} niveis={niveis} cor={cor} alturaMax={alturaDesenho} alturaTotal={alturaSvg} fonte={12} />
          </div>
          <div>
            <p className="text-center font-semibold text-[12px]" style={{ color: "#5f7076" }}>
              Vista Sul + Oeste
            </p>
            <Predio3D vista="SW" descidas={descidas} niveis={niveis} cor={cor} alturaMax={alturaDesenho} alturaTotal={alturaSvg} fonte={12} />
          </div>
        </div>
        <div className={vertical ? "mt-3 grid grid-cols-2 gap-4" : ""} style={{ width: vertical ? "100%" : 250 }}>
          <div>
            <p className="font-semibold text-[13px] mb-2" style={{ color: "#1f4a52" }}>
              {servico.nome} por fachada
            </p>
            {(["N", "S", "L", "O"] as Face[]).map((f) => (
              <div key={f} className="flex items-center gap-2 text-[12px] mb-1.5">
                <span style={{ width: 48 }}>{NOME_FACE[f]}</span>
                <div className="flex-1">
                  <Barra s={pf[f]} h={10} />
                </div>
                <b style={{ width: 38, textAlign: "right" }}>{fmtPct0(pct(pf[f]))}%</b>
              </div>
            ))}
          </div>
          <div>
            <p className="font-semibold text-[13px] mb-2 mt-1" style={{ color: "#1f4a52" }}>
              Por parte
            </p>
            {(["emb", "tor", "res"] as Parte[]).map((p) => (
              <div key={p} className="flex items-center gap-2 text-[12px] mb-1.5">
                <span style={{ width: 82 }}>{NOME_PARTE[p]}</span>
                <div className="flex-1">
                  <Barra s={pp[p]} h={10} />
                </div>
                <b style={{ width: 38, textAlign: "right" }}>{fmtPct0(pct(pp[p]))}%</b>
              </div>
            ))}
            <div className="mt-4 text-[11px] text-ink-500 space-y-1">
              {([2, 1, 0] as Status[]).map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <i style={{ width: 12, height: 12, background: COR_STATUS[s], display: "inline-block", borderRadius: 2 }} />
                  {s === 2 ? "Finalizado" : s === 1 ? "Andamento" : "Não iniciado"}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
