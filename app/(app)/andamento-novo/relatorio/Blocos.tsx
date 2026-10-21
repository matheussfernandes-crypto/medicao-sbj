"use client";

import { useMemo } from "react";
import { COR_STATUS, acumular, pct, somaZero, type Soma } from "../calculo";
import { calcularNiveis, chaveItemFachada, descidasDoSistema, mapaItensFachada } from "../fachada";
import Predio3D, { NOME_FACE, NOME_PARTE, type Face, type Parte } from "../Predio3D";
import { Barra, fmtPct, fmtPct0 } from "../ui";
import { numeros, pesoNaCategoria, status, type BlocoFachada, type BlocoFachadaTab, type BlocoGrade, type Coluna, type Ctx, type Formato, type GrupoFase } from "./modelo";
import type { Servico, Status } from "../types";

const VERDE = COR_STATUS[2];
const LARANJA = COR_STATUS[1];
const CINZA = COR_STATUS[0];

function fundo(f: number, a: number, n: number) {
  if (n === 0) return "#ffffff";
  const pf = (f / n) * 100;
  const pa = (a / n) * 100;
  if (pf >= 99.9) return VERDE;
  if (pf + pa <= 0.1) return CINZA;
  return `linear-gradient(to top, ${VERDE} 0%, ${VERDE} ${pf}%, ${LARANJA} ${pf}%, ${LARANJA} ${pf + pa}%, ${CINZA} ${pf + pa}%, ${CINZA} 100%)`;
}

function Celula({ ctx, alvos, s, alt, colSpan, rowSpan, fonte }: { ctx: Ctx; alvos: string[]; s: Servico; alt: number; colSpan?: number; rowSpan?: number; fonte: number }) {
  const nm = numeros(ctx, alvos, s);
  const parcial = nm.n > 1 && nm.f < nm.n && (nm.f > 0 || nm.a > 0);
  return (
    <td
      colSpan={colSpan}
      rowSpan={rowSpan}
      title={nm.n ? `${s.nome}: ${nm.f}/${nm.n} finalizados${nm.a ? `, ${nm.a} em andamento` : ""}` : `${s.nome}: não se aplica`}
      style={{ background: fundo(nm.f, nm.a, nm.n), height: alt, border: "1px solid #fff", textAlign: "center", fontSize: fonte - 2, padding: 0, color: "#1f2937" }}
    >
      {nm.n === 0 && <span style={{ color: "#b8c0c6" }}>–</span>}
      {parcial && (
        <span style={{ background: "rgba(255,255,255,.88)", borderRadius: 3, padding: "0 3px", fontWeight: 700 }}>
          {nm.f}/{nm.n}
          {nm.a > 0 ? ` +${nm.a}` : ""}
        </span>
      )}
    </td>
  );
}

// soma ponderada de um conjunto de serviços sobre um conjunto de colunas
export function somaDe(ctx: Ctx, catId: string, colunas: Coluna[], servs: Servico[]): Soma {
  const s = somaZero();
  colunas.forEach((c) => c.alvos.forEach((a) => servs.forEach((sv) => acumular(s, pesoNaCategoria(ctx, catId, sv.id), status(ctx.ap, a, sv.id)))));
  return s;
}
export function somaBloco(ctx: Ctx, b: BlocoGrade): Soma {
  return somaDe(ctx, b.cat.id, b.colunas, b.fases.flatMap((f) => f.servicos));
}

type PropsGrade = {
  bloco: BlocoGrade;
  ctx: Ctx;
  fmt: Formato;
  largura: number;
  fatias?: number[] | null; // quais fatias (fases/pavimentos) desenhar; null = todas
  continuacao?: boolean;
};

const cabecalhoBloco = (bloco: BlocoGrade, soma: Soma, continuacao?: boolean) => (
  <div data-cab="1" className="flex items-center gap-3 mb-1.5">
    <span className="inline-block text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full" style={{ background: bloco.cat.cor }}>
      {bloco.titulo}
    </span>
    {bloco.sub && <span className="text-[11px] text-ink-500">{bloco.sub}</span>}
    {continuacao && <span className="text-[11px] italic text-ink-500">(continuação)</span>}
    <div className="w-40">
      <Barra s={soma} h={7} cor={bloco.cat.cor} />
    </div>
    <b className="text-sm" style={{ color: bloco.cat.cor }}>
      {fmtPct0(pct(soma))}%
    </b>
  </div>
);

// quebra o rótulo vertical quando a palavra não cabe na coluna
function usarVertical(fmt: Formato, rotulos: string[], larguraColuna: number, fonte: number) {
  if (fmt.texto === "v") return true;
  const maior = Math.max(...rotulos.map((r) => r.length), 1);
  return maior * fonte * 0.56 > larguraColuna - 6;
}

export function BlocoGradeView({ bloco, ctx, fmt, largura, fatias, continuacao }: PropsGrade) {
  const fonte = fmt.letra === "c" ? 10.5 : 12;
  const alt = fmt.letra === "c" ? 17 : 22;
  const soma = useMemo(() => somaBloco(ctx, bloco), [ctx, bloco]);
  const todasServ = bloco.fases.flatMap((f) => f.servicos);
  const inteiro = (s: Servico) => s.vale_pavimento_inteiro;

  if (fmt.linhas === "serv") {
    // colunas: do pavimento/local mais baixo (esquerda) para o mais alto (direita)
    const colunas: Coluna[] = bloco.agrupado
      ? (() => {
          const grupos: Coluna[][] = [];
          bloco.colunas.forEach((c) => {
            const ult = grupos[grupos.length - 1];
            if (ult && ult[0].grupoId === c.grupoId) ult.push(c);
            else grupos.push([c]);
          });
          return grupos.reverse().flatMap((g) => g);
        })()
      : [...bloco.colunas].reverse();
    const colW = (largura - 230) / Math.max(1, colunas.length);
    const vert = usarVertical(fmt, colunas.map((c) => c.rotulo), colW, fonte);
    const grupos: { id: string; rotulo: string; cols: Coluna[] }[] = [];
    if (bloco.agrupado) colunas.forEach((c) => {
      const u = grupos[grupos.length - 1];
      if (u && u.id === c.grupoId) u.cols.push(c);
      else grupos.push({ id: c.grupoId!, rotulo: c.grupoRotulo!, cols: [c] });
    });
    const alturaCab = vert ? Math.min(120, 14 + Math.max(...colunas.map((c) => c.rotulo.length)) * fonte * 0.55) : alt;
    return (
      <div data-bloco={bloco.id} className="rel-bloco" style={{ borderLeft: `5px solid ${bloco.cat.cor}`, paddingLeft: 8, fontSize: fonte }}>
        {cabecalhoBloco(bloco, soma, continuacao)}
        <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "separate", borderSpacing: 0 }}>
          <colgroup>
            <col style={{ width: 230 }} />
            {colunas.map((c) => (
              <col key={c.id} />
            ))}
          </colgroup>
          <thead data-cab="1">
            {bloco.agrupado && (
              <tr>
                <th />
                {grupos.map((g) => (
                  <th key={g.id} colSpan={g.cols.length} style={{ fontSize: fonte - 1, fontWeight: 700, color: "#1f4a52", borderBottom: "2px solid #cfd8dc", textAlign: "center", padding: "1px 0" }}>
                    {g.rotulo}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              <th style={{ textAlign: "left", fontSize: fonte - 1, color: "#65707d" }}>Serviço</th>
              {colunas.map((c) => (
                <th key={c.id} style={{ fontSize: fonte - 1, fontWeight: 600, color: "#1f4a52", height: alturaCab, verticalAlign: "bottom", padding: "0 1px", textAlign: "center" }}>
                  {vert ? (
                    <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", margin: "0 auto", whiteSpace: "nowrap" }}>{c.rotulo}</div>
                  ) : (
                    c.rotulo
                  )}
                </th>
              ))}
            </tr>
          </thead>
          {bloco.fases.map((g, gi) => {
            if (fatias && !fatias.includes(gi)) return null;
            const somaFase = somaDe(ctx, bloco.cat.id, bloco.colunas, g.servicos);
            return (
              <tbody key={g.id} data-fatia={gi}>
                <tr>
                  <td colSpan={colunas.length + 1} style={{ fontSize: fonte - 1, fontWeight: 700, color: bloco.cat.cor, borderBottom: `2px solid ${bloco.cat.cor}`, padding: "3px 0 1px" }}>
                    {g.nome} <span style={{ color: "#65707d", fontWeight: 600 }}>· {fmtPct0(pct(somaFase))}%</span>
                  </td>
                </tr>
                {g.servicos.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontSize: fonte, whiteSpace: "nowrap", overflow: "hidden", paddingRight: 6, height: alt }}>{s.nome}</td>
                    {bloco.agrupado && inteiro(s)
                      ? grupos.map((g2) => <Celula key={g2.id} ctx={ctx} alvos={g2.cols.flatMap((c) => c.alvos)} s={s} alt={alt} colSpan={g2.cols.length} fonte={fonte} />)
                      : colunas.map((c) => <Celula key={c.id} ctx={ctx} alvos={c.alvos} s={s} alt={alt} fonte={fonte} />)}
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
    );
  }

  // linhas = pavimentos / locais; colunas = serviços agrupados por fase
  const linhas: Coluna[] = bloco.agrupado
    ? (() => {
        // de cima para baixo; dentro do pavimento, o apto mais alto em cima (101 embaixo … 1205 em cima)
        const grupos: Coluna[][] = [];
        bloco.colunas.forEach((c) => {
          const u = grupos[grupos.length - 1];
          if (u && u[0].grupoId === c.grupoId) u.push(c);
          else grupos.push([c]);
        });
        return grupos.flatMap((g) => [...g].reverse());
      })()
    : bloco.colunas;
  const vert = fmt.texto === "v" || todasServ.length > 22;
  const maiorNome = Math.max(...todasServ.map((s) => s.nome.length), 1);
  const alturaCab = vert ? Math.min(150, 12 + maiorNome * fonte * 0.55) : alt * 1.6;
  const porPav = new Map<string, Coluna[]>();
  linhas.forEach((l) => porPav.set(l.grupoId ?? l.id, [...(porPav.get(l.grupoId ?? l.id) ?? []), l]));
  const gruposLinhas = Array.from(porPav.entries());
  // fatias: um grupo por pavimento (um por um) ou blocos de 8 linhas
  const fatiasLinhas: { id: string; linhas: Coluna[] }[] = bloco.agrupado
    ? gruposLinhas.map(([id, l]) => ({ id, linhas: l }))
    : Array.from({ length: Math.ceil(linhas.length / 8) }, (_, i) => ({ id: "f" + i, linhas: linhas.slice(i * 8, i * 8 + 8) }));

  return (
    <div data-bloco={bloco.id} className="rel-bloco" style={{ borderLeft: `5px solid ${bloco.cat.cor}`, paddingLeft: 8, fontSize: fonte }}>
      {cabecalhoBloco(bloco, soma, continuacao)}
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
        <thead data-cab="1">
          <tr>
            {bloco.agrupado && <th rowSpan={2} />}
            <th rowSpan={2} style={{ textAlign: "left", fontSize: fonte - 1, color: "#65707d", verticalAlign: "bottom" }}>
              {bloco.agrupado ? "Local" : "Pavimento / local"}
            </th>
            {bloco.fases.map((g) => (
              <th key={g.id} colSpan={g.servicos.length} style={{ fontSize: fonte - 1, fontWeight: 700, color: bloco.cat.cor, borderBottom: `2px solid ${bloco.cat.cor}`, textAlign: "center" }}>
                {g.nome} · {fmtPct0(pct(somaDe(ctx, bloco.cat.id, bloco.colunas, g.servicos)))}%
              </th>
            ))}
            <th rowSpan={2} style={{ fontSize: fonte - 1, color: "#65707d", verticalAlign: "bottom", paddingLeft: 6 }}>
              %
            </th>
          </tr>
          <tr>
            {bloco.fases.flatMap((g) =>
              g.servicos.map((s) => (
                <th key={s.id} style={{ fontSize: fonte - 2, fontWeight: 600, color: "#1f4a52", height: alturaCab, verticalAlign: "bottom", padding: "0 1px", minWidth: 16 }}>
                  {vert ? <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", margin: "0 auto", whiteSpace: "nowrap" }}>{s.nome}</div> : s.nome}
                </th>
              ))
            )}
          </tr>
        </thead>
        {fatiasLinhas.map((fl, fi) => {
          if (fatias && !fatias.includes(fi)) return null;
          return (
            <tbody key={fl.id} data-fatia={fi}>
              {fl.linhas.map((l, li) => {
                const somaLinha = somaDe(ctx, bloco.cat.id, [l], todasServ);
                return (
                  <tr key={l.id}>
                    {bloco.agrupado && li === 0 && (
                      <td rowSpan={fl.linhas.length} style={{ fontWeight: 700, color: "#1f4a52", fontSize: fonte, paddingRight: 8, verticalAlign: "top", whiteSpace: "nowrap", borderTop: "1px solid #e5e9ec" }}>
                        {l.grupoRotulo}
                      </td>
                    )}
                    <td style={{ whiteSpace: "nowrap", paddingRight: 8, fontSize: fonte, height: alt }}>{l.rotulo}</td>
                    {bloco.fases.flatMap((g) =>
                      g.servicos.map((s) =>
                        bloco.agrupado && inteiro(s) ? (
                          li === 0 ? (
                            <Celula key={s.id} ctx={ctx} alvos={fl.linhas.flatMap((x) => x.alvos)} s={s} alt={alt} rowSpan={fl.linhas.length} fonte={fonte} />
                          ) : null
                        ) : (
                          <Celula key={s.id} ctx={ctx} alvos={l.alvos} s={s} alt={alt} fonte={fonte} />
                        )
                      )
                    )}
                    <td style={{ fontWeight: 700, fontSize: fonte, paddingLeft: 6, textAlign: "right", color: bloco.cat.cor }}>{fmtPct0(pct(somaLinha))}%</td>
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

export function medidaFatias(bloco: BlocoGrade, fmt: Formato): number {
  if (fmt.linhas === "serv") return bloco.fases.length;
  if (bloco.agrupado) return new Set(bloco.colunas.map((c) => c.grupoId)).size;
  return Math.ceil(bloco.colunas.length / 8);
}

// ===================== fachada em 3D grande (uma folha por serviço) =====================

export function BlocoFachada3D({ bloco, ctx, largura, altura }: { bloco: BlocoFachada; ctx: Ctx; largura: number; altura: number }) {
  const sis = ctx.dados.sistemas.find((s) => s.tipo === "fachada");
  const itens = sis ? ctx.itensPorSis.get(sis.id) ?? [] : [];
  const niveis = useMemo(() => calcularNiveis(ctx.pavs, ctx.locaisPorPav, ctx.idx), [ctx]);
  const descidas = useMemo(() => (sis ? descidasDoSistema(sis) : null), [sis]);
  const porChave = useMemo(() => mapaItensFachada(itens), [itens]);
  if (!sis || !descidas) return null;
  const cor = (parte: Parte, face: Face, d: number, nivelId: string) => {
    const it = porChave.get(chaveItemFachada(parte, face, d, nivelId));
    return it ? COR_STATUS[status(ctx.ap, it.id, bloco.servico.id)] : CINZA;
  };
  const pf: Record<Face, Soma> = { N: somaZero(), S: somaZero(), L: somaZero(), O: somaZero() };
  const pp: Record<Parte, Soma> = { emb: somaZero(), tor: somaZero(), res: somaZero() };
  let total = somaZero();
  itens.forEach((i) => {
    if (!i.face || !i.parte) return;
    const st = status(ctx.ap, i.id, bloco.servico.id);
    acumular(pf[i.face], 1, st);
    acumular(pp[i.parte], 1, st);
    acumular(total, 1, st);
  });
  const vertical = largura < altura;
  const alturaDesenho = vertical ? Math.min(560, altura / 2 - 80) : altura - 70;
  return (
    <div data-bloco={bloco.id} className="rel-bloco">
      <div className="flex items-center gap-3 mb-2" data-cab="1">
        <span className="inline-block text-[12px] font-bold text-white px-3 py-1 rounded-full" style={{ background: "#b5651d" }}>
          {bloco.titulo}
        </span>
        <b style={{ color: "#b5651d" }}>{fmtPct(pct(total))}%</b>
      </div>
      <div className={vertical ? "" : "flex gap-4"} style={{ width: "100%" }}>
        <div className={vertical ? "flex flex-col gap-2" : "flex-1 grid grid-cols-2 gap-3"}>
          <div>
            <p className="text-center font-semibold text-[12px]" style={{ color: "#1f4a52" }}>Vista Norte + Leste</p>
            <Predio3D vista="NE" descidas={descidas} niveis={niveis} cor={cor} alturaMax={alturaDesenho} fonte={12} />
          </div>
          <div>
            <p className="text-center font-semibold text-[12px]" style={{ color: "#1f4a52" }}>Vista Sul + Oeste</p>
            <Predio3D vista="SW" descidas={descidas} niveis={niveis} cor={cor} alturaMax={alturaDesenho} fonte={12} />
          </div>
        </div>
        <div className={vertical ? "mt-3 grid grid-cols-2 gap-4" : ""} style={{ width: vertical ? "100%" : 250 }}>
          <div>
            <p className="font-semibold text-[13px] mb-2" style={{ color: "#1f4a52" }}>
              {bloco.servico.nome} por fachada
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

// ===================== fachada em tabela =====================

export function BlocoFachadaTabela({ bloco, ctx, fmt }: { bloco: BlocoFachadaTab; ctx: Ctx; fmt: Formato }) {
  const sis = ctx.dados.sistemas.find((s) => s.id === bloco.sistemaId);
  const itens = sis ? ctx.itensPorSis.get(sis.id) ?? [] : [];
  const niveis = useMemo(() => calcularNiveis(ctx.pavs, ctx.locaisPorPav, ctx.idx), [ctx]);
  const porChave = useMemo(() => mapaItensFachada(itens), [itens]);
  const fonte = fmt.letra === "c" ? 10 : 11;
  // colunas: pavimentos do mais baixo ao mais alto (embasamento, torre) + reservatório
  const colunasNiv = [...niveis.emb].reverse().map((n) => ({ ...n, parte: "emb" as Parte })).concat([...niveis.tor].reverse().map((n) => ({ ...n, parte: "tor" as Parte })), [{ id: "res", nome: "Reserv.", parte: "res" as Parte }]);
  const linhas: { parte: Parte; face: Face; d: number }[] = [];
  (["emb", "tor", "res"] as Parte[]).forEach((p) =>
    (["N", "S", "L", "O"] as Face[]).forEach((f) => {
      const max = Math.max(0, ...itens.filter((i) => i.parte === p && i.face === f).map((i) => i.descida ?? 0));
      for (let d = 1; d <= max; d++) linhas.push({ parte: p, face: f, d });
    })
  );
  return (
    <div data-bloco={bloco.id} className="rel-bloco" style={{ fontSize: fonte }}>
      <div data-cab="1" className="flex items-center gap-3 mb-1.5">
        <span className="inline-block text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full" style={{ background: "#b5651d" }}>
          {bloco.titulo}
        </span>
      </div>
      <table style={{ borderCollapse: "separate", borderSpacing: 0 }}>
        <thead data-cab="1">
          <tr>
            <th style={{ textAlign: "left", paddingRight: 10 }}>Descida</th>
            {colunasNiv.map((c) => (
              <th key={c.parte + c.id} style={{ fontWeight: 600, color: "#1f4a52", height: 70, verticalAlign: "bottom", padding: "0 1px" }}>
                <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", margin: "0 auto", whiteSpace: "nowrap" }}>{c.nome}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody data-fatia={0}>
          {linhas.map((l) => (
            <tr key={`${l.parte}${l.face}${l.d}`}>
              <td style={{ whiteSpace: "nowrap", paddingRight: 10 }}>{`${NOME_PARTE[l.parte]} · ${NOME_FACE[l.face]} · D${l.d}`}</td>
              {colunasNiv.map((c) => {
                if (c.parte !== l.parte) return <td key={c.parte + c.id} style={{ width: 22, height: 18 }} />;
                const it = porChave.get(chaveItemFachada(l.parte, l.face, l.d, c.id));
                const st = it ? status(ctx.ap, it.id, bloco.servico.id) : 0;
                return <td key={c.parte + c.id} style={{ width: 22, height: 18, background: it ? COR_STATUS[st] : "transparent", border: "1px solid #fff" }} />;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type { GrupoFase };
