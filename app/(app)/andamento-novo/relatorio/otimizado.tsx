"use client";

import { COR_STATUS, acumular, pct, somaZero, type Soma } from "../calculo";
import { Barra, fmtPct0 } from "../ui";
import { agruparPorFase, pesoNaCategoria, status, type BlocoFachada, type BlocoFachadaTab, type Ctx, type Escopo, type GrupoFase, type Montagem } from "./modelo";
import type { Categoria, Local, Servico, SistemaItem, Status } from "../types";

// ====================== MODELO OTIMIZADO ======================
// Escala única: toda folha usa a mesma letra e a mesma célula (quadrada, 5,5 mm ≈ 21 px). Nada encolhe nem estica
// por bloco; se não couber, quebra de página. As páginas são calculadas com medidas fixas (sem medir o DOM).

export const CEL = 21; // 5,5 mm a 96 dpi
export const FONTE = 12; // 9 pt
export const FONTE_PEQ = 11; // 8,3 pt (textos dentro da célula)
const ALT_BANNER = 40;
const ALT_BANNER_CONT = 26;
const BARRA_COL = 30; // coluna da mini barra à direita
const ESPACO_ANTES = 22;
const ESPACO_DEPOIS = 10;

export const ORDEM_AMBIENTES = ["tipo", "hall", "esc", "garagem", "lazer", "comum", "cob", "elev", "cxf", "cxc"];

export type GrupoLinhas = { id: string; rotulo: string; locais: { id: string; nome: string }[] };
export type Ambiente = {
  id: string;
  cat: Categoria;
  titulo: string;
  sub: string;
  grupos: GrupoLinhas[];
  fases: GrupoFase[];
  nLocais: number;
  nGrupos: number;
  soma: Soma;
};

export type ItemMatriz = { tipo: "matriz"; amb: Ambiente; fases: GrupoFase[]; grupos: GrupoLinhas[]; continuacao: boolean; topo: boolean };
export type ItemFachada = { tipo: "fachada"; bloco: BlocoFachada | BlocoFachadaTab };
export type ItemOtim = ItemMatriz | ItemFachada;
export type FolhaOtim = { itens: ItemOtim[]; titulo: string };

export type Geometria = { larguraUtil: number; alturaUtil: number; colPav: number; colLoc: number; colDir: number; altNomes: number; altFase: number; colunasMax: number };
// fase cuja palavra mais longa não cabe na largura das suas colunas: o texto da faixa vai na vertical
const faseEstreita = (f: GrupoFase) => Math.max(...f.nome.split(/\s+/).map((p) => p.length)) * FONTE * 0.62 + 6 > f.servicos.length * CEL;

const larguraTexto = (nomes: string[], min: number, max: number) => Math.max(min, Math.min(max, Math.ceil(Math.max(0, ...nomes.map((n) => n.length)) * FONTE * 0.58 + 16)));

export function geometria(larguraUtil: number, alturaUtil: number, ambientes: Ambiente[]): Geometria {
  const servicos = ambientes.flatMap((a) => a.fases.flatMap((f) => f.servicos.map((s) => s.nome)));
  const locais = ambientes.flatMap((a) => a.grupos.flatMap((g) => g.locais.map((l) => l.nome)));
  const pavs = ambientes.flatMap((a) => a.grupos.map((g) => g.rotulo));
  const colPav = larguraTexto(pavs, 60, 130);
  const colLoc = larguraTexto(locais, 60, 170);
  const colDir = colLoc + 38 + BARRA_COL;
  // faixa das fases: fase estreita (menos de NARROW colunas) leva o texto na vertical, então a faixa fica mais alta
  const nomesEstreitos = ambientes.flatMap((a) => a.fases.filter(faseEstreita).map((f) => f.nome + " 100%"));
  const altFase = nomesEstreitos.length ? Math.min(150, Math.ceil((larguraTexto(nomesEstreitos, 40, 400) + 4) / 10) * 10) : 56;
  // altura do cabeçalho: a mesma em todas as folhas, pelo maior nome do relatório inteiro
  const altNomes = Math.min(230, Math.ceil((larguraTexto(servicos, 40, 400) + 4) / 10) * 10);
  const colunasMax = Math.max(8, Math.floor((larguraUtil - colPav - colLoc - colDir - 8 * 2) / CEL));
  return { larguraUtil, alturaUtil, colPav, colLoc, colDir, altNomes, altFase, colunasMax };
}

const ordenarAmbientes = (cats: Categoria[]) =>
  [...cats].sort((a, b) => {
    const ia = ORDEM_AMBIENTES.indexOf(a.chave);
    const ib = ORDEM_AMBIENTES.indexOf(b.chave);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.ordem - b.ordem;
  });

const temApontamento = (ctx: Ctx, alvos: string[], s: Servico) => alvos.some((a) => [1, 2].includes(status(ctx.ap, a, s.id)));

function somaAmbiente(ctx: Ctx, cat: Categoria, alvos: string[], servs: Servico[]): Soma {
  const s = somaZero();
  alvos.forEach((a) => servs.forEach((sv) => acumular(s, pesoNaCategoria(ctx, cat.id, sv.id), status(ctx.ap, a, sv.id))));
  return s;
}

export function montarAmbientes(ctx: Ctx, esc: Escopo, mon: Montagem): Ambiente[] {
  const { idx } = ctx;
  const cats = ordenarAmbientes(ctx.dados.categorias);
  const resultado: Ambiente[] = [];

  const fasesDe = (cat: Categoria, alvos: string[]) => {
    let servs = (idx.servicosDaCat.get(cat.id) ?? []).map((x) => x.servico).filter(esc.servOk);
    if (mon.esconder) servs = servs.filter((s) => temApontamento(ctx, alvos, s));
    return agruparPorFase(servs, ctx);
  };

  // ---- locais (por ambiente) ----
  cats.forEach((cat) => {
    const ls = esc.locais.filter((l) => l.categoria_id === cat.id);
    if (!ls.length) return;
    const porPav = new Map<string, Local[]>();
    ls.forEach((l) => porPav.set(l.pavimento_id, [...(porPav.get(l.pavimento_id) ?? []), l]));
    const grupos: GrupoLinhas[] = ctx.pavs
      .filter((p) => porPav.has(p.id))
      .map((p) => {
        const lista = [...porPav.get(p.id)!].sort((a, b) => a.ordem - b.ordem);
        // apartamentos em ordem crescente de baixo para cima (101 embaixo); os demais, na ordem cadastrada
        const ord = cat.chave === "tipo" ? lista.reverse() : lista;
        return { id: p.id, rotulo: p.nome, locais: ord.map((l) => ({ id: l.id, nome: l.nome })) };
      });
    const alvos = ls.map((l) => l.id);
    const fases = fasesDe(cat, alvos);
    if (!fases.length) return;
    resultado.push({
      id: "amb:" + cat.id,
      cat,
      titulo: cat.nome,
      sub: `${ls.length} locais · ${grupos.length} pavimento${grupos.length === 1 ? "" : "s"}`,
      grupos,
      fases,
      nLocais: ls.length,
      nGrupos: grupos.length,
      soma: somaAmbiente(ctx, cat, alvos, fases.flatMap((f) => f.servicos)),
    });
  });

  // ---- sistemas (menos a fachada, que sai em 3D) ----
  ctx.dados.sistemas.forEach((sis) => {
    if (sis.tipo === "fachada") return;
    const its = esc.itens.filter((i) => i.sistema_id === sis.id);
    cats.forEach((cat) => {
      const grupo = its.filter((i: SistemaItem) => i.categoria_id === cat.id);
      if (!grupo.length) return;
      const alvos = grupo.map((i) => i.id);
      const fases = fasesDe(cat, alvos);
      if (!fases.length) return;
      resultado.push({
        id: `sis:${sis.id}:${cat.id}`,
        cat,
        titulo: sis.nome,
        sub: `${cat.nome} · ${grupo.length} ${grupo.length === 1 ? "item" : "itens"}`,
        grupos: [{ id: sis.id, rotulo: sis.nome, locais: grupo.map((i) => ({ id: i.id, nome: i.nome })) }],
        fases,
        nLocais: grupo.length,
        nGrupos: 1,
        soma: somaAmbiente(ctx, cat, alvos, fases.flatMap((f) => f.servicos)),
      });
    });
  });
  return resultado;
}

// divide as fases em "faixas de colunas" que cabem na largura da folha (sem encolher a célula)
function dividirColunas(fases: GrupoFase[], max: number): GrupoFase[][] {
  const paginas: GrupoFase[][] = [];
  let atual: GrupoFase[] = [];
  let n = 0;
  fases.forEach((f) => {
    if (atual.length && n + f.servicos.length > max) {
      paginas.push(atual);
      atual = [];
      n = 0;
    }
    if (f.servicos.length > max) {
      // fase maior que a folha: parte a fase
      for (let i = 0; i < f.servicos.length; i += max) {
        const pedaco = { ...f, id: f.id + ":" + i, servicos: f.servicos.slice(i, i + max) };
        if (atual.length) {
          paginas.push(atual);
          atual = [];
        }
        paginas.push([pedaco]);
      }
      n = 0;
      return;
    }
    atual.push(f);
    n += f.servicos.length;
  });
  if (atual.length) paginas.push(atual);
  return paginas;
}

export function montarFolhasOtimizadas(ambientes: Ambiente[], fachadas: (BlocoFachada | BlocoFachadaTab)[], g: Geometria): FolhaOtim[] {
  const folhas: FolhaOtim[] = [];
  let atual: ItemOtim[] = [];
  let usado = 0;
  const fechar = () => {
    if (atual.length) folhas.push({ itens: atual, titulo: "" });
    atual = [];
    usado = 0;
  };
  // altura do cabeçalho (faixa do ambiente + fases + nomes dos serviços) de um trecho
  const cabecalho = (continuacao: boolean, topo: boolean) => (topo ? 0 : ESPACO_ANTES) + (continuacao ? ALT_BANNER_CONT : ALT_BANNER) + g.altFase + g.altNomes + 2;

  ambientes.forEach((amb) => {
    const faixas = dividirColunas(amb.fases, g.colunasMax);
    const linhasTotal = amb.grupos.reduce((a, gr) => a + gr.locais.length, 0);
    faixas.forEach((fases, fi) => {
      // Apartamentos sempre em folha nova; faixas de colunas seguintes também
      if (amb.cat.chave === "tipo" || fi > 0) fechar();
      // o bloco inteiro cabe numa folha vazia mas não no que sobra: vai todo para a próxima (nunca cortado)
      const inteiro = cabecalho(false, true) + linhasTotal * CEL + ESPACO_DEPOIS;
      if (atual.length && inteiro <= g.alturaUtil && usado + cabecalho(false, false) + linhasTotal * CEL + ESPACO_DEPOIS > g.alturaUtil) fechar();
      let primeira = true;
      let fila = amb.grupos.map((gr) => ({ ...gr }));
      while (fila.length) {
        const topo = atual.length === 0;
        const cab = cabecalho(!primeira || fi > 0, topo);
        let livre = g.alturaUtil - usado - cab - ESPACO_DEPOIS;
        const escolhidos: GrupoLinhas[] = [];
        while (fila.length) {
          const gr = fila[0];
          const h = gr.locais.length * CEL;
          if (h <= livre) {
            escolhidos.push(gr);
            livre -= h;
            fila.shift();
          } else if (!escolhidos.length && topo && livre >= CEL) {
            // grupo maior que a folha inteira: parte por linhas (só se a folha está vazia)
            const cabem = Math.floor(livre / CEL);
            escolhidos.push({ ...gr, locais: gr.locais.slice(0, cabem) });
            fila[0] = { ...gr, locais: gr.locais.slice(cabem) };
            livre = 0;
            break;
          } else break;
        }
        if (!escolhidos.length) {
          fechar(); // não coube nem um grupo: folha nova
          continue;
        }
        const linhas = escolhidos.reduce((a, gr) => a + gr.locais.length, 0);
        atual.push({ tipo: "matriz", amb, fases, grupos: escolhidos, continuacao: !primeira || fi > 0, topo });
        usado += cab + linhas * CEL + ESPACO_DEPOIS;
        primeira = false;
        if (fila.length) fechar();
      }
    });
  });
  fechar();

  fachadas.forEach((b) => folhas.push({ itens: [{ tipo: "fachada", bloco: b }], titulo: "Fachada" }));
  return folhas;
}

export function tituloFolhaOtim(f: FolhaOtim): string {
  const nomes = Array.from(new Set(f.itens.map((i) => (i.tipo === "matriz" ? i.amb.titulo : "Fachada"))));
  if (nomes.length <= 2) return nomes.join(" · ").toUpperCase();
  return `${nomes.slice(0, 2).join(" · ")} e mais ${nomes.length - 2}`.toUpperCase();
}

// ====================== desenho ======================

function fundoParcial(f: number, a: number, n: number) {
  const pf = (f / n) * 100;
  const pa = (a / n) * 100;
  return `linear-gradient(to top, ${COR_STATUS[2]} 0%, ${COR_STATUS[2]} ${pf}%, ${COR_STATUS[1]} ${pf}%, ${COR_STATUS[1]} ${pf + pa}%, ${COR_STATUS[0]} ${pf + pa}%, ${COR_STATUS[0]} 100%)`;
}

function CelulaOtim({ ctx, alvos, s, rowSpan, zebra, guia, divFase }: { ctx: Ctx; alvos: string[]; s: Servico; rowSpan?: number; zebra: boolean; guia: boolean; divFase: boolean }) {
  let n = 0,
    f = 0,
    a = 0,
    aus = 0;
  alvos.forEach((id) => {
    const st = status(ctx.ap, id, s.id) as Status;
    if (st === 3) aus++;
    else {
      n++;
      if (st === 2) f++;
      else if (st === 1) a++;
    }
  });
  const parcial = n > 1 && f < n && (f > 0 || a > 0);
  const cinza = zebra ? "#e1e6e9" : "#e8ecee";
  let fundo = cinza;
  if (n === 0) fundo = "#ffffff";
  else if (f === n) fundo = COR_STATUS[2];
  else if (parcial) fundo = fundoParcial(f, a, n);
  else if (n === 1 && a === 1) fundo = COR_STATUS[1];
  else if (f === 0 && a > 0) fundo = COR_STATUS[1];
  return (
    <td
      rowSpan={rowSpan}
      title={n ? `${s.nome}: ${f}/${n} finalizados${a ? `, ${a} em andamento` : ""}` : `${s.nome}: ausência`}
      style={{
        width: CEL,
        minWidth: CEL,
        height: CEL * (rowSpan ?? 1),
        padding: 0,
        background: fundo,
        borderRight: "1px solid #fff",
        borderBottom: "1px solid #fff",
        borderLeft: divFase ? "2px solid #1f4a52" : guia ? "1px solid rgba(31,74,82,.45)" : undefined,
        textAlign: "center",
        fontSize: FONTE_PEQ - 1.5,
        lineHeight: 1,
        color: "#1f2937",
        fontWeight: 700,
        boxSizing: "border-box",
      }}
    >
      {n === 0 && <span style={{ color: "#b8c0c6", fontSize: 14, lineHeight: `${CEL}px` }}>×</span>}
      {parcial && <span style={{ background: "rgba(255,255,255,.9)", borderRadius: 3, padding: "1px 2px" }}>{f}/{n}</span>}
    </td>
  );
}

export function MatrizOtim({ item, ctx, g }: { item: ItemMatriz; ctx: Ctx; g: Geometria }) {
  const { amb, fases, grupos, continuacao } = item;
  const cat = amb.cat;
  const colunas: { s: Servico; faseIdx: number; primeiraDaFase: boolean }[] = fases.flatMap((f, fi) => f.servicos.map((s, si) => ({ s, faseIdx: fi, primeiraDaFase: si === 0 && fi > 0 })));
  const todasLocais = grupos.flatMap((gr) => gr.locais);
  const largura = g.colPav + g.colLoc + colunas.length * CEL + (fases.length - 1) * 2 + g.colDir;
  const somaFase = (f: GrupoFase) => somaAmbiente(ctx, cat, amb.grupos.flatMap((gr) => gr.locais.map((l) => l.id)), f.servicos);

  return (
    <div style={{ width: g.larguraUtil, marginTop: item.topo ? 0 : ESPACO_ANTES, marginBottom: ESPACO_DEPOIS, fontSize: FONTE, color: "#1f2937" }}>
      {/* faixa do ambiente */}
      <div
        style={{
          height: continuacao ? ALT_BANNER_CONT : ALT_BANNER,
          background: cat.cor,
          color: "#fff",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 14px",
          boxSizing: "border-box",
        }}
      >
        <b style={{ fontSize: continuacao ? 14 : 18, letterSpacing: ".02em" }}>{amb.titulo}</b>
        {continuacao ? <span style={{ fontSize: FONTE }}>(continuação)</span> : <span style={{ fontSize: FONTE, opacity: 0.92 }}>{amb.sub}</span>}
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 150 }}>
            <Barra s={amb.soma} h={9} cor="#f5c84c" />
          </span>
          <b style={{ fontSize: continuacao ? 14 : 20 }}>{fmtPct0(pct(amb.soma))}%</b>
        </span>
      </div>

      <table style={{ borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", width: largura }}>
        <colgroup>
          <col style={{ width: g.colPav }} />
          <col style={{ width: g.colLoc }} />
          {colunas.map((c, i) => (
            <col key={i} style={{ width: CEL + (c.primeiraDaFase ? 2 : 0) }} />
          ))}
          <col style={{ width: g.colLoc }} />
          <col style={{ width: 38 }} />
          <col style={{ width: BARRA_COL }} />
        </colgroup>
        <thead>
          <tr style={{ height: g.altFase }}>
            <th colSpan={2} />
            {fases.map((f, fi) => {
              const estreita = faseEstreita(f);
              const p = fmtPct0(pct(somaFase(f)));
              return (
                <th
                  key={f.id}
                  colSpan={f.servicos.length}
                  style={{ height: g.altFase, fontSize: FONTE, fontWeight: 800, color: cat.cor, borderBottom: `3px solid ${cat.cor}`, borderLeft: fi > 0 ? "2px solid #1f4a52" : undefined, textAlign: "center", verticalAlign: "bottom", overflow: "hidden", padding: "0 2px", boxSizing: "border-box" }}
                >
                  {estreita ? (
                    <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", margin: "0 auto", whiteSpace: "nowrap", paddingTop: 2 }}>
                      {f.nome} {p}%
                    </div>
                  ) : (
                    <div style={{ lineHeight: "16px", overflowWrap: "normal" }}>
                      {f.nome}
                      <br />
                      {p}%
                    </div>
                  )}
                </th>
              );
            })}
            <th colSpan={3} />
          </tr>
          <tr style={{ height: g.altNomes }}>
            <th style={{ textAlign: "left", verticalAlign: "bottom", fontSize: FONTE, color: "#65707d", fontWeight: 700 }}>Pavimento</th>
            <th style={{ textAlign: "left", verticalAlign: "bottom", fontSize: FONTE, color: "#65707d", fontWeight: 700 }}>{amb.id.startsWith("sis:") ? "Item" : "Local"}</th>
            {colunas.map((c, i) => (
              <th
                key={c.s.id}
                style={{
                  verticalAlign: "bottom",
                  padding: 0,
                  height: g.altNomes,
                  borderLeft: c.primeiraDaFase ? "2px solid #1f4a52" : i % 5 === 0 && i > 0 ? "1px solid rgba(31,74,82,.45)" : undefined,
                }}
              >
                <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", margin: "0 auto", whiteSpace: "nowrap", fontSize: FONTE, fontWeight: 600, color: "#1f4a52", paddingTop: 2 }}>{c.s.nome}</div>
              </th>
            ))}
            <th colSpan={3} style={{ textAlign: "left", verticalAlign: "bottom", fontSize: FONTE, color: "#65707d", fontWeight: 700, paddingLeft: 10 }}>
              Local · %
            </th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((gr, gi) => {
            const zebra = gi % 2 === 1;
            return gr.locais.map((l, li) => {
              const soma = somaAmbiente(ctx, cat, [l.id], amb.fases.flatMap((f) => f.servicos));
              return (
                <tr key={l.id} style={{ height: CEL }}>
                  {li === 0 && (
                    <td
                      rowSpan={gr.locais.length}
                      style={{
                        borderTop: "2px solid #1f4a52",
                        background: zebra ? "#eef3f4" : "#fff",
                        verticalAlign: "middle",
                        textAlign: "center",
                        fontWeight: 800,
                        fontSize: FONTE,
                        color: "#1f4a52",
                        overflow: "hidden",
                        padding: "0 3px",
                        boxSizing: "border-box",
                      }}
                    >
                      {gr.rotulo}
                    </td>
                  )}
                  <td style={{ borderTop: li === 0 ? "2px solid #1f4a52" : "1px solid #e1e6e9", background: zebra ? "#eef3f4" : "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "clip", fontSize: FONTE, padding: "0 6px", height: CEL, boxSizing: "border-box" }}>
                    {l.nome}
                  </td>
                  {colunas.map((c, ci) => {
                    const inteiro = c.s.vale_pavimento_inteiro && gr.locais.length > 1;
                    if (inteiro) {
                      if (li > 0) return null;
                      return <CelulaOtim key={c.s.id} ctx={ctx} alvos={gr.locais.map((x) => x.id)} s={c.s} rowSpan={gr.locais.length} zebra={zebra} guia={ci % 5 === 0 && ci > 0} divFase={c.primeiraDaFase} />;
                    }
                    return <CelulaOtim key={c.s.id} ctx={ctx} alvos={[l.id]} s={c.s} zebra={zebra} guia={ci % 5 === 0 && ci > 0} divFase={c.primeiraDaFase} />;
                  })}
                  {/* nome do local repetido à direita, com % e mini barra: ajuda a conferir as últimas colunas */}
                  <td style={{ paddingLeft: 10, whiteSpace: "nowrap", overflow: "hidden", fontSize: FONTE, borderTop: li === 0 ? "2px solid #1f4a52" : "1px solid #e1e6e9", background: zebra ? "#eef3f4" : "#fff", height: CEL, boxSizing: "border-box" }}>{l.nome}</td>
                  <td style={{ textAlign: "right", fontWeight: 800, fontSize: FONTE, color: cat.cor, borderTop: li === 0 ? "2px solid #1f4a52" : "1px solid #e1e6e9", background: zebra ? "#eef3f4" : "#fff", boxSizing: "border-box" }}>{fmtPct0(pct(soma))}%</td>
                  <td style={{ padding: "0 3px 0 4px", borderTop: li === 0 ? "2px solid #1f4a52" : "1px solid #e1e6e9", background: zebra ? "#eef3f4" : "#fff", boxSizing: "border-box" }}>
                    <div style={{ width: BARRA_COL - 8 }}>
                      <Barra s={soma} h={6} cor={cat.cor} />
                    </div>
                  </td>
                </tr>
              );
            });
          })}
          {/* fecha a tabela com uma linha fina */}
          <tr style={{ height: 1 }}>
            <td colSpan={colunas.length + 5} style={{ borderTop: "2px solid #1f4a52", padding: 0 }} />
          </tr>
        </tbody>
      </table>
      <span style={{ display: "none" }}>{todasLocais.length}</span>
    </div>
  );
}

export function LegendaRodape() {
  const item = (cor: string, nome: string, extra?: React.ReactNode) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 12 }}>
      <i style={{ width: 12, height: 12, borderRadius: 2, background: cor, display: "inline-block", border: cor === "#ffffff" ? "1px solid #c8d0d5" : undefined, textAlign: "center", lineHeight: "10px", fontSize: 10, color: "#9ca3af", fontStyle: "normal" }}>{extra}</i>
      {nome}
    </span>
  );
  return (
    <span style={{ fontSize: 10.5, color: "#4b5563" }}>
      {item(COR_STATUS[0], "Não iniciado")}
      {item(COR_STATUS[1], "Andamento")}
      {item(COR_STATUS[2], "Finalizado")}
      {item("#ffffff", "Ausência", "×")}
      {item(fundoParcial(1, 1, 3), "Parcial (f/n: finalizados / total)")}
    </span>
  );
}
