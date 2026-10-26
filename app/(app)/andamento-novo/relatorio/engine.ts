// Motor do relatório (rodada 3): monta as tabelas (células todas do mesmo tamanho), mede no navegador, calcula
// a escala única do relatório, estica na largura e distribui os blocos nas folhas. Porta do "modelo-relatorio.html".
// Gera HTML em texto para as tabelas (rápido de medir) e deixa para o React o resumo, as fotos e a fachada 3D.

import { pct, type Soma } from "../calculo";
import { alvosDeItens, alvosDeLocais, somaRecorte, type AlvoR } from "../fatias";
import { calcularNiveis } from "../fachada";
import type { Categoria, Servico } from "../types";
import { MARGEM_FOLHA, dimFolha, agruparPorFase, calcularEscopo, faseDoServico, rotuloDoLocal, status, type Ctx, type Filtros, type FotoRel, type FotosSel, type Papel, type Secao } from "./modelo";

export const FF = '"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif';
const P = (v: number) => Math.round(v) + "%";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// ---------- medida de texto (com o próprio navegador) ----------
const TWC = new Map<string, number>();
let TWS: HTMLSpanElement | null = null;
const tw = (t: string, font: string) => {
  const k = font + "|" + t;
  const c = TWC.get(k);
  if (c != null) return c;
  if (!TWS || !TWS.isConnected) {
    TWS = document.createElement("span");
    TWS.style.cssText = "position:absolute;left:-99999px;top:0;white-space:nowrap;visibility:hidden";
    document.body.appendChild(TWS);
  }
  TWS.style.font = font;
  TWS.textContent = String(t);
  const w = TWS.getBoundingClientRect().width;
  TWC.set(k, w);
  return w;
};
export const limparMedidas = () => TWC.clear();

// largura da célula de status em uso na hora de gerar cada tabela
let CW = 20;

// ---------- hifenização simples em português (hífen invisível U+00AD: só aparece se a linha quebrar ali) ----------
const VOG = "aeiouáéíóúâêôãõàü";
function hifen(w: string) {
  const low = w.toLowerCase();
  if (w.length < 6) return w;
  const isV = (c: string) => VOG.includes(c);
  const out: string[] = [];
  let last = 0;
  for (let i = 1; i < w.length - 1; i++) {
    const a = low[i - 1],
      b = low[i],
      c = low[i + 1];
    let br = false;
    if (isV(a) && !isV(b) && isV(c)) br = true;
    else if (!isV(a) && !isV(b) && isV(c) && i >= 2 && isV(low[i - 2])) {
      const pr = a + b;
      if (!["ch", "lh", "nh", "qu", "gu"].includes(pr) && !(/[bcdfgkptv]/.test(a) && /[lr]/.test(b))) br = true;
    }
    if (br && /[a-zà-ü]/i.test(a) && /[a-zà-ü]/i.test(b) && i - last >= 2 && w.length - i >= 2) {
      out.push(w.slice(last, i));
      last = i;
    }
  }
  out.push(w.slice(last));
  return out.join("­");
}
// só divide a palavra que não cabe na coluna, e no menor número de pedaços possível
const hy = (t: string, font = "600 8px " + FF, w = CW - 4) =>
  esc(t)
    .split(" ")
    .map((p) => {
      if (tw(p, font) <= w) return p;
      const sil = hifen(p).split("­");
      const out: string[] = [];
      let cur = "";
      sil.forEach((x) => {
        if (!cur || tw(cur + x + "-", font) <= w) cur += x;
        else {
          out.push(cur);
          cur = x;
        }
      });
      out.push(cur);
      return out.join("­");
    })
    .join(" ");

// ---------- títulos dos serviços: sempre na vertical, quebrando só entre palavras (nunca no meio da palavra, nunca com hífen) ----------
const ALT_TITULO = 130; // altura máxima do cabeçalho dos serviços
const LINHA_TITULO = 11; // largura de cada linha vertical
function quebraPalavras(nome: string, fonte: string, disp: number): string[] {
  const linhas: string[] = [];
  let cur = "";
  nome.split(/\s+/).forEach((w) => {
    const t = cur ? cur + " " + w : w;
    if (!cur || tw(t, fonte) <= disp) cur = t;
    else {
      linhas.push(cur);
      cur = w;
    }
  });
  if (cur) linhas.push(cur);
  return linhas;
}
type TitulosV = { fs: number; linhas: string[][]; alt: number; nl: number };
// maior fonte (9 → 8 px) em que toda palavra cabe na altura máxima; o título quebra em quantas linhas precisar
function titulosVerticais(nomes: string[]): TitulosV {
  const disp = ALT_TITULO - 8;
  let r: TitulosV | null = null;
  for (const fs of [9, 8.5, 8]) {
    const fonte = "600 " + fs + "px " + FF;
    const linhas = nomes.map((n) => quebraPalavras(n, fonte, disp));
    const maior = Math.max(0, ...linhas.flatMap((ls) => ls.map((l) => tw(l, fonte))));
    r = { fs, linhas, alt: Math.ceil(maior) + 8, nl: Math.max(1, ...linhas.map((l) => l.length)) };
    if (maior <= disp) break;
  }
  return r!;
}
// largura base da coluna de status: 20 px, mais 11 px por linha extra do maior título
export const larguraBase = (nomes: string[]) => 20 + LINHA_TITULO * (titulosVerticais(nomes).nl - 1);

// ---------- modelo de dados do motor ----------
export type MServ = { id: string; nome: string; inteiro: boolean };
export type MFase = [string, MServ[]];
export type MItem = { id: string; pavId: string | null; pav: string | null; local: string; ordem: number };
export type MCat = { id: string; chave: string; nome: string; cor: string; sis: boolean; fachada: boolean };
type Linha = { label: string; items: MItem[]; agg?: boolean };
type Grupo = { pav: string | null; rows: Linha[] };

export type BlocoTab = { tipo: "tab"; c: MCat; its: MItem[]; servs: MServ[]; fases: MFase[]; sec: Secao; ncol: number; html: string; w: number; h: number; cw: number; cwb: number; k: number };
export type BlocoFach = { tipo: "fach"; c: MCat; its: MItem[]; servs: [MServ]; servico: Servico };
export type BlocoE = BlocoTab | BlocoFach;

export type Plano = {
  titulo: string; // nome da montagem ("" no relatório simples)
  papel: Papel;
  folha: "h" | "v";
  fill: boolean;
  resumo: boolean;
  sumario: boolean;
  fotos: FotosSel;
  fotosLista: FotoRel[];
  secoes: Secao[];
  esconder: boolean;
};

export type Parte = { html: string } | { fach: BlocoFach };
// medidas de cada folha: cada seção de uma montagem pode ter o seu tamanho e orientação
export type DimPag = { papel: Papel; folha: "h" | "v"; PW: number; PH: number; IN: number; LIVRE: number };
export type Pag =
  | ({ tipo: "resumo"; n: number } & DimPag)
  | ({ tipo: "sumario"; n: number } & DimPag)
  | ({ tipo: "fotos"; n: number; fotos: FotoRel[] } & DimPag)
  | ({ tipo: "sec"; n: number; si: number; sec: Secao; partes: Parte[]; cats: string[]; blocos: BlocoE[]; titulo: string; pct: number } & DimPag);
export type SumLinha = { n: string | number; titulo: string; sub: string; pg: number | string };
export type Resultado = { seq: Pag[]; N: number; PW: number; PH: number; IN: number; LIVRE: number; k: number; cw: [number, number]; papel: Papel; folha: "h" | "v"; sumario: SumLinha[]; extras: FotoRel[]; avisos: string[] };

export function fotosDe(fs: FotosSel, lista: FotoRel[]): FotoRel[] {
  const m = new Map(lista.map((f) => [f.id, f]));
  return fs.sel.map((id) => m.get(id)).filter(Boolean).map((f) => ({ ...f!, legenda: fs.leg[f!.id] ?? f!.legenda }));
}

// ---------- ambiente (contexto + atalhos) ----------
export type Amb = { ctx: Ctx; alvo: Map<string, AlvoR>; st: (alvo: string, sv: string) => 0 | 1 | 2 | 3; pavIdx: Map<string, number>; chaveDesc: Map<string, string>; nNiveis: number };

function ambiente(ctx: Ctx): Amb {
  const niveis = calcularNiveis(ctx.pavs, ctx.locaisPorPav, ctx.idx);
  const chaveDesc = new Map<string, string>();
  ctx.dados.itens.forEach((i) => {
    if (i.parte && i.face && i.descida) chaveDesc.set(i.id, `${i.parte}${i.face}${i.descida}`);
  });
  const alvo = new Map<string, AlvoR>();
  alvosDeLocais(ctx.dados.locais).forEach((a) => alvo.set(a.id, a));
  alvosDeItens(ctx.dados.itens).forEach((a) => alvo.set(a.id, a));
  return {
    ctx,
    alvo,
    st: (a, s) => status(ctx.ap, a, s),
    pavIdx: new Map(ctx.pavs.map((p, i) => [p.id, i])),
    chaveDesc,
    nNiveis: niveis.emb.length + niveis.tor.length,
  };
}

// soma de um recorte (itens × serviços) pelas fatias da obra: serviços reescalados para somar 100% dentro do recorte
function somar(E: Amb, _c: MCat, its: MItem[], servs: MServ[]): Soma {
  const ids = new Set(servs.map((s) => s.id));
  const alvos = its.map((i) => E.alvo.get(i.id)).filter(Boolean) as AlvoR[];
  return somaRecorte(E.ctx.fat, E.ctx.idx, E.ctx.ap, alvos, (s) => ids.has(s.id));
}

// ---------- blocos de uma seção ----------
const TEC = new Set(["cob", "elev", "cxf", "cxc"]);
const mcat = (c: Categoria, sis: boolean, nome?: string): MCat => ({ id: c.id, chave: c.chave, nome: nome ?? c.nome, cor: c.cor, sis, fachada: c.chave === "fach" });
const mserv = (s: Servico): MServ => ({ id: s.id, nome: s.nome, inteiro: s.vale_pavimento_inteiro });

export function blocosDe(E: Amb, sec: Secao, esconder: boolean): BlocoE[] {
  const ctx = E.ctx;
  const f = sec.filtro;
  const escopo = calcularEscopo(ctx, f);
  const fasesF = new Set(f.fases ?? []);
  const cats = [...ctx.dados.categorias].sort((a, b) => a.ordem - b.ordem);
  const out: BlocoE[] = [];

  const fasesDe = (cat: Categoria, alvos: string[]): MFase[] => {
    let servs = (ctx.idx.servicosDaCat.get(cat.id) ?? []).map((x) => x.servico).filter(escopo.servOk);
    if (fasesF.size) servs = servs.filter((s) => fasesF.has(faseDoServico(s, ctx)));
    if (esconder) servs = servs.filter((s) => alvos.some((a) => [1, 2].includes(E.st(a, s.id))));
    return agruparPorFase(servs, ctx).map((g) => [g.nome, g.servicos.map(mserv)] as MFase);
  };

  cats.forEach((cat) => {
    if (cat.chave === "fach") return;
    // ---- locais ----
    const ls = escopo.locais.filter((l) => l.categoria_id === cat.id);
    if (ls.length) {
      const its: MItem[] = ls.map((l) => {
        const p = ctx.pavPorId.get(l.pavimento_id)!;
        return { id: l.id, pavId: l.pavimento_id, pav: p.nome, local: rotuloDoLocal(l, p.nome, cat), ordem: l.ordem };
      });
      const fases = fasesDe(cat, its.map((i) => i.id));
      if (fases.length) {
        const servs = fases.flatMap((x) => x[1]);
        const c = mcat(cat, false);
        out.push({ tipo: "tab", c, its, servs, fases, sec, ncol: 0, html: "", w: 0, h: 0, cw: 20, cwb: 20, k: 1 });
      }
    }
    // ---- sistemas (Elevadores, Caixa d'água…): sem pavimento ----
    ctx.dados.sistemas.forEach((sis) => {
      if (sis.tipo === "fachada") return;
      const grupo = escopo.itens.filter((i) => i.sistema_id === sis.id && i.categoria_id === cat.id);
      if (!grupo.length) return;
      const its: MItem[] = grupo.map((i) => ({ id: i.id, pavId: null, pav: null, local: i.nome, ordem: i.ordem }));
      const fases = fasesDe(cat, its.map((i) => i.id));
      if (!fases.length) return;
      const catsDoSis = new Set(ctx.dados.itens.filter((i) => i.sistema_id === sis.id).map((i) => i.categoria_id));
      const c = mcat(cat, true, catsDoSis.size > 1 ? cat.nome : sis.nome);
      out.push({ tipo: "tab", c, its, servs: fases.flatMap((x) => x[1]), fases, sec, ncol: 0, html: "", w: 0, h: 0, cw: 20, cwb: 20, k: 1 });
    });
  });

  // ---- fachada: uma folha por serviço ----
  const fachCat = cats.find((c) => c.chave === "fach");
  const sisF = ctx.dados.sistemas.find((s) => s.tipo === "fachada");
  if (fachCat && sisF) {
    const its0 = escopo.itens.filter((i) => i.sistema_id === sisF.id);
    if (its0.length) {
      let servs = (ctx.idx.servicosDaCat.get(fachCat.id) ?? []).map((x) => x.servico).filter(escopo.servOk);
      if (fasesF.size) servs = servs.filter((s) => fasesF.has(faseDoServico(s, ctx)));
      servs.forEach((s) => {
        // trechos (descida × pavimento) deste serviço: cada serviço tem as suas descidas
        const its: MItem[] = its0.filter((i) => i.servico_id === s.id).map((i) => ({ id: i.id, pavId: null, pav: null, local: i.nome, ordem: i.ordem }));
        if (!its.length) return;
        if (esconder && !its.some((i) => [1, 2].includes(E.st(i.id, s.id)))) return;
        out.push({ tipo: "fach", c: mcat(fachCat, true, "Fachada"), its, servs: [mserv(s)], servico: s });
      });
    }
  }
  return out;
}

// ---------- tabelas ----------
function grupos(c: MCat, its: MItem[], det: "ju" | "un", E: Amb): Grupo[] {
  if (c.sis) return [...its].sort((a, b) => a.ordem - b.ordem).map((i) => ({ pav: null, rows: [{ label: i.local, items: [i] }] }));
  const gs: Grupo[] = [];
  [...its]
    .sort((a, b) => b.ordem - a.ordem) // do maior para o menor (1205 … 1201); a tabela de serviços nas linhas inverte
    .forEach((i) => {
      let g = gs.find((x) => x.pav === i.pav);
      if (!g) {
        g = { pav: i.pav, rows: [] };
        gs.push(g);
      }
      g.rows.push({ label: i.local, items: [i] });
    });
  const pi = (g: Grupo) => E.pavIdx.get(its.find((i) => i.pav === g.pav)?.pavId ?? "") ?? 0;
  gs.sort((a, b) => pi(a) - pi(b));
  if (det === "ju")
    gs.forEach((g) => {
      if (g.rows.length > 1) g.rows = [{ label: g.rows.length + (c.chave === "tipo" ? " aptos" : " locais"), items: g.rows.flatMap((r) => r.items), agg: true }];
    });
  return gs;
}

function cel(E: Amb, items: MItem[], s: MServ, attr = "") {
  const vs = items.map((i) => E.st(i.id, s.id)).filter((v) => v !== 3);
  const n = vs.length,
    f = vs.filter((v) => v === 2).length,
    w = vs.filter((v) => v === 1).length;
  let k: string,
    sty = "",
    t: string;
  if (!n) {
    k = "s3";
    t = "não se aplica";
  } else if (f === n) {
    k = "s2";
    t = n > 1 ? `${n} de ${n} finalizados` : "finalizado";
  } else if (!f && !w) {
    k = "s0";
    t = "não iniciado";
  } else if (n === 1) {
    k = "s1";
    t = "em andamento";
  } else {
    k = "sp";
    const a = (f / n) * 100,
      b = ((f + w) / n) * 100;
    // duas barras cheias sobre o fundo cinza (sem degradê: cada degradê vira um objeto pesado no PDF e some em alguns leitores de celular)
    sty = `<i style="width:${a}%"></i><i class="w" style="left:${a}%;width:${b - a}%"></i>`;
    t = `${f} de ${n} finalizados${w ? `, ${w} em andamento` : ""}`;
  }
  return `<td class="c ${k}" ${attr} title="${esc(s.nome)}: ${t}">${sty}</td>`;
}

// MODO 1: pavimentos e locais nas linhas, serviços nas colunas
function tabLocal(E: Amb, c: MCat, its: MItem[], fases: MFase[], det: "ju" | "un") {
  const gs = grupos(c, its, det, E),
    servs = fases.flatMap((f) => f[1]),
    hasPav = !c.sis;
  const fPv = "700 10.5px " + FF,
    fLc = "400 10px " + FF,
    fSh = "600 9px " + FF,
    fPh = "800 9px " + FF;
  const merged = (g: Grupo) => hasPav && g.rows.length === 1 && g.rows[0].label === g.pav;
  const pavW = hasPav ? Math.ceil(Math.max(...gs.filter((g) => !merged(g)).map((g) => tw(g.pav!, fPv)), 30) + 14) : 0;
  let locW = Math.ceil(Math.max(44, ...gs.flatMap((g) => (merged(g) ? [] : g.rows.map((r) => tw(r.label, fLc))))) + 18);
  gs.filter(merged).forEach((g) => {
    const need = tw(g.pav!, fPv) + 18;
    if (pavW + locW < need) locW = Math.ceil(need - pavW);
  });
  const tv = titulosVerticais(servs.map((s) => s.nome));
  const hh = tv.alt;
  const idxServ = new Map(servs.map((s, i) => [s.id, i]));
  const PH = fases.map(([n, l]) => {
    const pc = P(pct(somar(E, c, its, l))),
      up = n.toUpperCase(),
      wd = l.length * CW,
      ls = up.length * 0.36;
    const w1 = tw(up + " · " + pc, fPh) + ls + 10,
      palavra = Math.max(...up.split(/\s+/).map((w) => tw(w, fPh))) + ls + 8,
      w2 = Math.max(palavra, tw(pc, fPh) + 8);
    const same = l.length === 1 && l[0].nome.toLowerCase() === n.toLowerCase();
    // 1 linha → 2 linhas (nome e %) → junto com o serviço (mesmo nome) → vertical
    const mode = wd >= w1 ? "h1" : wd >= w2 ? "h2" : same ? "m" : "v";
    return { n, l, pc, up, mode, vlen: tw(up + " · " + pc, fPh) + ls + 14 };
  });
  const phH = Math.max(30, ...PH.filter((p) => p.mode === "v").map((p) => p.vlen));
  const mH = Math.max(0, ...PH.filter((p) => p.mode === "m").map((p) => p.vlen));
  const svH = Math.max(hh, mH - phH);
  const GP = 8,
    W = pavW + locW + servs.length * CW + (PH.length - 1) * GP,
    NC = (hasPav ? 2 : 1) + servs.length + PH.length - 1;
  const col = (hasPav ? `<col style="width:${pavW}px">` : "") + `<col style="width:${locW}px">` + PH.map((p, i) => (i > 0 ? `<col style="width:${GP}px">` : "") + p.l.map(() => `<col style="width:${CW}px">`).join("")).join("");
  let h1 = `<tr style="height:${phH}px"><th class="lh" colspan="${hasPav ? 2 : 1}" rowspan="2">${hasPav ? "Pavimento · Local" : "Item"}</th>`;
  let h2 = `<tr style="height:${svH}px">`;
  PH.forEach((p, pi) => {
    if (pi > 0) h1 += `<th class="gp" rowspan="2"></th>`;
    if (p.mode === "m") {
      h1 += `<th class="ph pm" rowspan="2"><span class="vt">${esc(p.up)} · ${p.pc}</span></th>`;
      return;
    }
    if (p.mode === "v") h1 += `<th class="ph pv" colspan="${p.l.length}"><span class="vt">${esc(p.up)} · ${p.pc}</span></th>`;
    else if (p.mode === "h2") h1 += `<th class="ph hw" colspan="${p.l.length}">${esc(p.up)}<br>${p.pc}</th>`;
    else h1 += `<th class="ph" colspan="${p.l.length}">${esc(p.up)} · ${p.pc}</th>`;
    // título do serviço: vertical, uma linha vertical por trecho de palavras, sem hífen
    p.l.forEach((s) => {
      const ls = tv.linhas[idxServ.get(s.id)!];
      h2 += `<th class="sh"><span class="vt" style="font-size:${tv.fs}px;line-height:${LINHA_TITULO}px">${ls.map(esc).join("<br>")}</span></th>`;
    });
  });
  h1 += "</tr>";
  h2 += "</tr>";
  let body = "";
  gs.forEach((g, gi) =>
    g.rows.forEach((r, ri) => {
      const cls = gi % 2 && hasPav ? "z" : "";
      if (ri === 0 && gi > 0) body += `<tr class="gr${hasPav ? "" : " fino"}"><td colspan="${NC}"></td></tr>`;
      let tr = `<tr${cls ? ` class="${cls}"` : ""}>`;
      if (!hasPav) tr += `<th class="ll">${esc(r.label)}</th>`;
      else if (merged(g)) tr += `<th class="pv m" colspan="2">${esc(g.pav)}</th>`;
      else {
        if (ri === 0) tr += `<th class="pv" rowspan="${g.rows.length}">${esc(g.pav)}</th>`;
        tr += `<td class="lc${r.agg ? " ag" : ""}">${esc(r.label)}</td>`;
      }
      PH.forEach((p, pi) => {
        if (pi > 0) tr += `<td class="gp"></td>`;
        p.l.forEach((s) => {
          if (hasPav && s.inteiro && g.rows.length > 1) {
            if (ri === 0) tr += cel(E, g.rows.flatMap((x) => x.items), s, `rowspan="${g.rows.length}" `);
          } else tr += cel(E, r.items, s);
        });
      });
      body += tr + "</tr>";
    })
  );
  return `<table class="tb" style="--cc:${c.cor};width:${W}px"><colgroup>${col}</colgroup><thead>${h1}${h2}</thead><tbody>${body}</tbody></table>`;
}

// MODO 2: serviços nas linhas, pavimentos/locais nas colunas (do mais baixo à esquerda pro mais alto à direita)
function tabServ(E: Amb, c: MCat, its: MItem[], fases: MFase[], det: "ju" | "un") {
  const gs = c.sis ? grupos(c, its, det, E) : grupos(c, its, det, E).reverse();
  if (!c.sis) gs.forEach((g) => (g.rows = [...g.rows].reverse()));
  const servs = fases.flatMap((f) => f[1]),
    hasPav = !c.sis;
  const svW = Math.ceil(Math.max(80, ...servs.map((s) => tw(s.nome, "400 10px " + FF)), ...fases.map(([n]) => tw(n.toUpperCase() + " · 100%", "800 9.5px " + FF) + n.length * 0.5)) + 28);
  const single = (g: Grupo) => g.rows.length === 1;
  const lab1 = (g: Grupo) => {
    const r = g.rows[0];
    return g.pav == null ? r.label : r.label === g.pav || r.agg ? g.pav : g.pav + " · " + r.label;
  };
  const ghFits = (g: Grupo) => g.rows.length * CW >= Math.min(tw(g.pav!, "800 10px " + FF), Math.max(...g.pav!.split(/\s+/).map((w) => tw(w, "800 10px " + FF)))) + 4;
  const vl = gs.filter((g) => single(g) || !ghFits(g)).map((g) => tw(lab1(g), "700 9.5px " + FF) + 14);
  const vl2 = gs.filter((g) => !single(g)).flatMap((g) => g.rows.map((r) => tw(r.label, "600 9px " + FF) + 12));
  const r1 = 30,
    r2 = Math.ceil(Math.max(24, vl2.length ? Math.max(...vl2) : 0, (vl.length ? Math.max(...vl) : 0) - r1));
  const ncol = gs.reduce((a, g) => a + g.rows.length, 0),
    GP = hasPav ? (gs.every(single) ? 4 : 8) : 0,
    ngp = GP ? gs.length - 1 : 0,
    W = svW + ncol * CW + ngp * GP;
  const col = `<col style="width:${svW}px">` + gs.map((g, gi) => (gi > 0 && GP ? `<col style="width:${GP}px">` : "") + g.rows.map(() => `<col style="width:${CW}px">`).join("")).join("");
  let h1 = `<tr style="height:${r1}px"><th class="lh" rowspan="2">Serviço</th>`,
    h2 = `<tr style="height:${r2}px">`;
  gs.forEach((g, gi) => {
    const z = gi % 2 ? " z" : "";
    if (gi > 0 && GP) h1 += `<th class="gp" rowspan="2"></th>`;
    if (single(g)) h1 += `<th class="gv${z}" rowspan="2"><span class="vt">${esc(lab1(g))}</span></th>`;
    else {
      h1 += `<th class="gh${z}" colspan="${g.rows.length}">${esc(g.pav)}</th>`;
      g.rows.forEach((r) => (h2 += `<th class="lv${z}"><span class="vt">${esc(r.label)}</span></th>`));
    }
  });
  h1 += "</tr>";
  h2 += "</tr>";
  let body = "";
  fases.forEach(([n, l]) => {
    body += `<tr class="phr"><th colspan="${ncol + 1 + ngp}"><b>${esc(n)}</b> · ${P(pct(somar(E, c, its, l)))}</th></tr>`;
    l.forEach((s) => {
      body +=
        `<tr><th class="sl">${esc(s.nome)}</th>` +
        gs.map((g, gi) => (gi > 0 && GP ? `<td class="gp"></td>` : "") + (hasPav && s.inteiro && g.rows.length > 1 ? cel(E, g.rows.flatMap((r) => r.items), s, `colspan="${g.rows.length}" `) : g.rows.map((r) => cel(E, r.items, s)).join(""))).join("") +
        `</tr>`;
    });
  });
  return `<table class="tb ts" style="--cc:${c.cor};width:${W}px"><colgroup>${col}</colgroup><thead>${h1}${h2}</thead><tbody>${body}</tbody></table>`;
}

// faixa da categoria (nome, locais · pavimentos, barra amarela e %), na largura da área útil
export function bandaCat(E: Amb, b: { c: MCat; its: MItem[]; servs: MServ[] }, extra?: string) {
  const { c, its, servs } = b;
  const x = pct(somar(E, c, its, servs));
  const nl = its.length,
    np = new Set(its.map((i) => i.pavId).filter(Boolean)).size;
  const pl = (n: number) => (n === 1 ? "pavimento" : "pavimentos");
  const sub = c.fachada ? `${new Set(its.map((i) => E.chaveDesc.get(i.id)).filter(Boolean)).size} descidas · ${E.nNiveis} pavimentos` : c.sis ? `${nl} ${nl === 1 ? "item" : "itens"}` : nl === np ? `${np} ${pl(np)}` : `${nl} locais · ${np} ${pl(np)}`;
  return `<div class="cband" style="--cc:${c.cor}"><b>${esc(c.nome)}${extra ? ` · ${esc(extra)}` : ""}</b><span>${sub}</span><i class="cbar"><i style="width:${x}%"></i></i><b class="cpc">${P(x)}</b></div>`;
}

// ---------- texto dos filtros (sumário) ----------
function textoFiltro(E: Amb, f: Filtros): string {
  const p: string[] = [];
  if (f.pav.length) {
    const nomes = E.ctx.pavs.filter((x) => f.pav.includes(x.id)).map((x) => x.nome);
    p.push("Pavimentos: " + (nomes.length > 4 ? nomes.length + " pavimentos" : nomes.join(", ")));
  }
  if (f.fases?.length) p.push("Fases: " + f.fases.join(", "));
  return p.join(" · ");
}

// ---------- montagem das folhas ----------
const BAND = 40;
const GAP = 20;
const GX = 26;

// medidas úteis de uma folha (largura e altura livres para o conteúdo)
function dimDe(papel: Papel, folha: "h" | "v"): DimPag {
  const { w, h } = dimFolha(papel, folha);
  return { papel, folha, PW: w, PH: h, IN: w - 2 * MARGEM_FOLHA, LIVRE: h - 2 * MARGEM_FOLHA - 124 - 12 - 34 };
}

export function construir(ctx: Ctx, pl: Plano, MEAS: HTMLElement): Resultado {
  const E = ambiente(ctx);
  const dimPlano = dimDe(pl.papel, pl.folha);

  // cada seção pode ter o seu papel, orientação, "estender" e "esconder" (seção feita de predefinição); senão vale o da montagem
  const secs = pl.secoes.map((sec) => {
    const papel = sec.papel ?? pl.papel,
      folha = sec.folha ?? pl.folha,
      fill = sec.fill ?? pl.fill,
      esconder = sec.esconder ?? pl.esconder;
    return { sec, dim: dimDe(papel, folha), fill, esconder, grupo: `${papel}|${folha}|${fill ? 1 : 0}`, blocos: blocosDe(E, sec, esconder) };
  });
  const tabs = secs.flatMap((S) => S.blocos.filter((b): b is BlocoTab => b.tipo === "tab").map((b) => ({ b, S })));
  tabs.forEach(({ b }) => (b.ncol = b.sec.linhas === "serv" ? grupos(b.c, b.its, b.sec.det, E).reduce((a, g) => a + g.rows.length, 0) : b.servs.length));
  const html1 = (b: BlocoTab) => (b.sec.linhas === "serv" ? tabServ(E, b.c, b.its, b.fases, b.sec.det) : tabLocal(E, b.c, b.its, b.fases, b.sec.det));
  const medirHtml = (b: BlocoTab) => {
    MEAS.innerHTML = b.html;
    const t = MEAS.firstElementChild as HTMLElement;
    b.w = t.offsetWidth;
    b.h = t.offsetHeight;
  };
  // títulos sempre na vertical; largura base da coluna: 20 px (+11 px por linha extra do maior título)
  tabs.forEach(({ b }) => {
    b.cwb = b.sec.linhas === "local" ? larguraBase(b.servs.map((s) => s.nome)) : 20;
    CW = b.cwb;
    b.cw = CW;
    b.html = html1(b);
    medirHtml(b);
  });
  // escala única por tamanho de folha: a menor que ainda deixa cada tabela inteira na folha (com "Estender", até 1,6)
  const kPorGrupo = new Map<string, number>();
  tabs.forEach(({ b, S }) => {
    const kb = Math.min(S.dim.IN / b.w, (S.dim.LIVRE - BAND) / b.h);
    kPorGrupo.set(S.grupo, Math.min(kPorGrupo.get(S.grupo) ?? Infinity, kb));
  });
  kPorGrupo.forEach((v, g) => kPorGrupo.set(g, g.endsWith("|1") ? Math.min(1.6, v) : Math.min(1, v)));
  tabs.forEach(({ b, S }) => (b.k = kPorGrupo.get(S.grupo) ?? 1));
  const cwMaxDe = (b: BlocoTab) => Math.max(36, b.cwb);
  const regen = (b: BlocoTab, cw: number) => {
    CW = cw;
    b.cw = cw;
    b.html = html1(b);
    medirHtml(b);
    CW = 20;
  };
  const wB = (b: BlocoTab) => b.w * b.k,
    hB = (b: BlocoTab) => BAND + b.h * b.k;

  type Linha2 = { bs: BlocoTab[]; w: number; h: number };
  type PagTmp = { tipo: "sec"; si: number; sec: Secao; dim: DimPag; fill: boolean; rows: Linha2[]; cats: string[]; blocos: BlocoE[]; partes: Parte[]; cheia?: boolean };
  const pags: PagTmp[] = [];

  secs.forEach((S, si) => {
    const minhas: PagTmp[] = [];
    const nova = (): PagTmp => {
      const p: PagTmp = { tipo: "sec", si, sec: S.sec, dim: S.dim, fill: S.fill, rows: [], cats: [], blocos: [], partes: [] };
      pags.push(p);
      minhas.push(p);
      return p;
    };
    const altura = (p: { rows: Linha2[] }) => p.rows.reduce((a, r, i) => a + (i ? GAP : 0) + r.h, 0);
    // tenta pôr o bloco na folha, numa linha nova embaixo (nada lado a lado)
    const tenta = (p: { cheia?: boolean; rows: Linha2[] }, b: BlocoTab, real: boolean) => {
      if (p.cheia) return false;
      if (altura(p) + (p.rows.length ? GAP : 0) + hB(b) <= S.dim.LIVRE) {
        if (real) p.rows.push({ bs: [b], w: wB(b), h: hB(b) });
        return true;
      }
      return false;
    };
    let tecPg: PagTmp | null = null;
    S.blocos.forEach((b, bi) => {
      if (b.tipo === "fach") {
        const q = nova();
        q.partes.push({ fach: b });
        q.cats.push("Fachada");
        q.blocos.push(b);
        q.cheia = true;
        return;
      }
      const ehTec = TEC.has(b.c.chave);
      // Cobertura/técnica, Elevadores e Caixa d'água ficam na mesma folha quando cabem
      if (ehTec && tecPg && tenta(tecPg, b, true)) {
        tecPg.blocos.push(b);
        return;
      }
      let alvo: PagTmp | null = null;
      if (ehTec && !tecPg) {
        const grupo = S.blocos.slice(bi).filter((x): x is BlocoTab => x.tipo === "tab" && TEC.has(x.c.chave));
        const simula = (p: PagTmp) => {
          const c = { cheia: p.cheia, rows: p.rows.map((r) => ({ ...r, bs: [...r.bs] })) };
          return grupo.every((x) => tenta(c, x, true));
        };
        alvo = minhas.find(simula) ?? null;
        if (!alvo && grupo.length > 1) alvo = nova();
      }
      if (!alvo) alvo = minhas.find((p) => tenta(p, b, false)) ?? null;
      if (!alvo) alvo = nova();
      tenta(alvo, b, true);
      alvo.blocos.push(b);
      if (ehTec) tecPg = alvo;
    });
    if (!S.blocos.length) nova().partes.push({ html: `<div class="rel-vazio">Nada nesta seção com esses filtros.</div>` });
  });

  // esticar: cada tabela alarga as células até ocupar a largura; a faixa ocupa sempre a largura toda
  const cws: number[] = [];
  pags.forEach((p) => {
    p.rows.forEach((r) => {
      if (p.fill) {
        const k = r.bs[0].k;
        const sobra = p.dim.IN - r.w,
          nc = r.bs.reduce((a, b) => a + b.ncol, 0);
        if (sobra > 4) {
          const b0 = r.bs[0],
            cw = Math.min(cwMaxDe(b0), Math.floor((b0.cw + sobra / (k * nc)) * 10) / 10);
          if (cw > b0.cw + 0.5) {
            r.bs.forEach((b) => regen(b, cw));
            r.w = r.bs.reduce((a, b, i) => a + (i ? GX : 0) + wB(b), 0);
            r.h = Math.max(...r.bs.map(hB));
          }
        }
      }
      r.bs.forEach((b) => cws.push(b.cw || 20));
      const html = `<div class="brow">${r.bs
        .map((b) => {
          if (!p.cats.includes(b.c.nome)) p.cats.push(b.c.nome);
          return `<div class="blk" style="width:${p.dim.IN}px">${bandaCat(E, b)}<div class="tw" style="width:${wB(b)}px;height:${b.h * b.k}px"><div style="width:${b.w}px;transform:scale(${b.k});transform-origin:0 0">${b.html}</div></div></div>`;
        })
        .join("")}</div>`;
      p.partes.push({ html });
    });
  });
  CW = 20;

  // ---- sequência de folhas ----
  const seq: Pag[] = [];
  if (pl.resumo) seq.push({ tipo: "resumo", n: 0, ...dimPlano });
  if (pl.sumario) seq.push({ tipo: "sumario", n: 0, ...dimPlano });
  const secPags: Pag[] = pags.map((p) => {
    const nomes = p.cats;
    const titulo = (p.sec.nome ? p.sec.nome : nomes.length <= 3 ? nomes.join(" · ") : nomes.slice(0, 2).join(" · ") + " e mais " + (nomes.length - 2)).toUpperCase();
    return { tipo: "sec", n: 0, si: p.si, sec: p.sec, partes: p.partes, cats: p.cats, blocos: p.blocos, titulo, pct: pctBlocos(E, p.blocos), ...p.dim };
  });
  seq.push(...secPags);
  const todas = fotosDe(pl.fotos, pl.fotosLista);
  const extras = pl.resumo ? todas.slice(pl.fotos.n) : [];
  const porPg = pl.folha === "v" ? 12 : 8;
  for (let i = 0; i < extras.length; i += porPg) seq.push({ tipo: "fotos", n: 0, fotos: extras.slice(i, i + porPg), ...dimPlano });
  seq.forEach((p, i) => (p.n = i + 1));

  // sumário
  const sumario: SumLinha[] = [];
  if (pl.sumario) {
    if (pl.resumo) sumario.push({ n: "R", titulo: "Resumo geral", sub: "Números, linha do tempo, quadros, 3D, fotos e frentes", pg: 1 });
    pl.secoes.forEach((s, i) => {
      const pg = seq.find((x) => x.tipo === "sec" && x.si === i);
      const cats = [...new Set(secs[i].blocos.map((b) => b.c.nome))];
      const resto = textoFiltro(E, s.filtro);
      sumario.push({ n: i + 1, titulo: s.nome || cats.join(", "), sub: cats.join(" · ") + (resto ? " · " + resto : ""), pg: pg ? pg.n : "—" });
    });
    const rf = seq.find((x) => x.tipo === "fotos");
    if (rf) sumario.push({ n: "F", titulo: "Registro fotográfico", sub: `${extras.length} fotos`, pg: rf.n });
  }

  const k = kPorGrupo.size ? Math.min(...kPorGrupo.values()) : 1;
  const avisos: string[] = [];
  if (k < 0.55) avisos.push(`Neste tamanho de folha a tabela fica muito pequena (${Math.round(k * 100)}%): use um papel maior ou a folha na horizontal.`);
  const cwMin = cws.length ? Math.min(...cws) : 20,
    cwMax = cws.length ? Math.max(...cws) : 20;
  return { seq, N: seq.length, PW: dimPlano.PW, PH: dimPlano.PH, IN: dimPlano.IN, LIVRE: dimPlano.LIVRE, k, cw: [cwMin, cwMax], papel: pl.papel, folha: pl.folha, sumario, extras, avisos };
}

// faixa da categoria para a folha da fachada (React usa por dangerouslySetInnerHTML)
export function bandaFachada(ctx: Ctx, b: BlocoFach): string {
  return bandaCat(ambiente(ctx), b, b.servs[0].nome);
}

// % de um conjunto de blocos (cabeçalho da folha): um recorte só, com os serviços de cada categoria que aparecem nos blocos
function pctBlocos(E: Amb, blocos: BlocoE[]): number {
  const porCat = new Map<string, Set<string>>();
  const alvos: AlvoR[] = [];
  blocos.forEach((b) => {
    const set = porCat.get(b.c.id) ?? new Set<string>();
    b.servs.forEach((s) => set.add(s.id));
    porCat.set(b.c.id, set);
    b.its.forEach((i) => {
      const a = E.alvo.get(i.id);
      if (a && !alvos.includes(a)) alvos.push(a);
    });
  });
  return pct(somaRecorte(E.ctx.fat, E.ctx.idx, E.ctx.ap, alvos, (s, a) => porCat.get(a.categoria_id)?.has(s.id) ?? false));
}

export function pctDeBlocos(ctx: Ctx, blocos: BlocoE[]) {
  return pctBlocos(ambiente(ctx), blocos);
}
