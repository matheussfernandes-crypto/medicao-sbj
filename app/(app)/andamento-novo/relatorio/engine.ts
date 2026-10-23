// Motor do relatório (rodada 3): monta as tabelas (células todas do mesmo tamanho), mede no navegador, calcula
// a escala única do relatório, estica na largura e distribui os blocos nas folhas. Porta do "modelo-relatorio.html".
// Gera HTML em texto para as tabelas (rápido de medir) e deixa para o React o resumo, as fotos e a fachada 3D.

import { pct, type Soma } from "../calculo";
import { alvosDeItens, alvosDeLocais, somaRecorte, type AlvoR } from "../fatias";
import { calcularNiveis } from "../fachada";
import type { Categoria, Servico } from "../types";
import { A3, MARGEM_FOLHA, agruparPorFase, calcularEscopo, faseDoServico, rotuloDoLocal, status, type Ctx, type Filtros, type FotoRel, type FotosSel, type Secao } from "./modelo";

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

// títulos das colunas e largura da célula de status em uso na hora de gerar cada tabela
let TIT: "h" | "v" = "h";
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

// ---------- modelo de dados do motor ----------
export type MServ = { id: string; nome: string; inteiro: boolean };
export type MFase = [string, MServ[]];
export type MItem = { id: string; pavId: string | null; pav: string | null; local: string; ordem: number };
export type MCat = { id: string; chave: string; nome: string; cor: string; sis: boolean; fachada: boolean };
type Linha = { label: string; items: MItem[]; agg?: boolean };
type Grupo = { pav: string | null; rows: Linha[] };

export type BlocoTab = { tipo: "tab"; c: MCat; its: MItem[]; servs: MServ[]; fases: MFase[]; sec: Secao; ncol: number; html: string; w: number; h: number; cw: number; cwb: number; tit: "h" | "v" };
export type BlocoFach = { tipo: "fach"; c: MCat; its: MItem[]; servs: [MServ]; servico: Servico };
export type BlocoE = BlocoTab | BlocoFach;

export type Plano = {
  titulo: string; // nome da montagem ("" no relatório simples)
  folha: "h" | "v";
  fill: boolean;
  titulos: "h" | "v";
  resumo: boolean;
  sumario: boolean;
  fotos: FotosSel;
  fotosLista: FotoRel[];
  secoes: Secao[];
  esconder: boolean;
};

export type Parte = { html: string } | { fach: BlocoFach };
export type Pag =
  | { tipo: "resumo"; n: number }
  | { tipo: "sumario"; n: number }
  | { tipo: "fotos"; n: number; fotos: FotoRel[] }
  | { tipo: "sec"; n: number; si: number; sec: Secao; partes: Parte[]; cats: string[]; blocos: BlocoE[]; titulo: string; pct: number };
export type SumLinha = { n: string | number; titulo: string; sub: string; pg: number | string };
export type Resultado = { seq: Pag[]; N: number; PW: number; PH: number; IN: number; LIVRE: number; k: number; cw: [number, number]; folha: "h" | "v"; sumario: SumLinha[]; extras: FotoRel[] };

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
        out.push({ tipo: "tab", c, its, servs, fases, sec, ncol: 0, html: "", w: 0, h: 0, cw: 20, cwb: 20, tit: "h" });
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
      out.push({ tipo: "tab", c, its, servs: fases.flatMap((x) => x[1]), fases, sec, ncol: 0, html: "", w: 0, h: 0, cw: 20, cwb: 20, tit: "h" });
    });
  });

  // ---- fachada: uma folha por serviço ----
  const fachCat = cats.find((c) => c.chave === "fach");
  const sisF = ctx.dados.sistemas.find((s) => s.tipo === "fachada");
  if (fachCat && sisF) {
    const its0 = escopo.itens.filter((i) => i.sistema_id === sisF.id);
    if (its0.length) {
      const its: MItem[] = its0.map((i) => ({ id: i.id, pavId: null, pav: null, local: i.nome, ordem: i.ordem }));
      let servs = (ctx.idx.servicosDaCat.get(fachCat.id) ?? []).map((x) => x.servico).filter(escopo.servOk);
      if (fasesF.size) servs = servs.filter((s) => fasesF.has(faseDoServico(s, ctx)));
      servs.forEach((s) => {
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
    sty = `background:linear-gradient(90deg,#24914f ${a}%,#f0a020 ${a}% ${b}%,#e3e7e9 ${b}%)`;
    t = `${f} de ${n} finalizados${w ? `, ${w} em andamento` : ""}`;
  }
  return `<td class="c ${k}" ${attr}${sty ? ` style="${sty}"` : ""} title="${esc(s.nome)}: ${t}"></td>`;
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
  const hh = Math.ceil(Math.max(...servs.map((s) => tw(s.nome, fSh))) + 12);
  const PH = fases.map(([n, l]) => {
    const pc = P(pct(somar(E, c, its, l))),
      up = n.toUpperCase(),
      wd = l.length * CW,
      ls = up.length * 0.36;
    const w1 = tw(up + " · " + pc, fPh) + ls + 10,
      w2 = tw(up, fPh) + ls + 8;
    const same = l.length === 1 && l[0].nome.toLowerCase() === n.toLowerCase();
    const mode = TIT === "h" ? (same ? "m" : wd >= w1 ? "h1" : "h2") : wd >= w1 ? "h1" : wd >= w2 ? "h2" : same ? "m" : "v";
    return { n, l, pc, up, mode, vlen: tw(up + " · " + pc, fPh) + ls + 14 };
  });
  const phH = Math.max(30, ...PH.filter((p) => p.mode === "v").map((p) => p.vlen));
  const mH = Math.max(0, ...PH.filter((p) => p.mode === "m").map((p) => p.vlen));
  const svH = Math.max(hh, mH - phH);
  const GP = 8,
    W = pavW + locW + servs.length * CW + (PH.length - 1) * GP,
    NC = (hasPav ? 2 : 1) + servs.length + PH.length - 1;
  const col = (hasPav ? `<col style="width:${pavW}px">` : "") + `<col style="width:${locW}px">` + PH.map((p, i) => (i > 0 ? `<col style="width:${GP}px">` : "") + p.l.map(() => `<col style="width:${CW}px">`).join("")).join("");
  let h1 = `<tr${TIT === "v" ? ` style="height:${phH}px"` : ""}><th class="lh" colspan="${hasPav ? 2 : 1}" rowspan="2">${hasPav ? "Pavimento · Local" : "Item"}</th>`;
  let h2 = `<tr${TIT === "v" ? ` style="height:${svH}px"` : ""}>`;
  PH.forEach((p, pi) => {
    if (pi > 0) h1 += `<th class="gp" rowspan="2"></th>`;
    if (p.mode === "m") {
      h1 += TIT === "h" ? `<th class="ph pm hz" rowspan="2"><b>${hy(p.n.toUpperCase(), "800 9px " + FF, CW - 5)}</b><br>${p.pc}</th>` : `<th class="ph pm" rowspan="2"><span class="vt"><b>${esc(p.up)}</b> · ${p.pc}</span></th>`;
      return;
    }
    if (p.mode === "v") h1 += `<th class="ph pv" colspan="${p.l.length}"><span class="vt">${esc(p.up)} · <b>${p.pc}</b></span></th>`;
    else if (p.mode === "h2") h1 += `<th class="ph hw" colspan="${p.l.length}">${hy(p.up, "800 9px " + FF, p.l.length * CW - 6)}<br><b>${p.pc}</b></th>`;
    else h1 += `<th class="ph" colspan="${p.l.length}">${esc(p.up)} · <b>${p.pc}</b></th>`;
    p.l.forEach((s) => (h2 += TIT === "h" ? `<th class="sh hz">${hy(s.nome)}</th>` : `<th class="sh"><span class="vt">${esc(s.nome)}</span></th>`));
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
  let h1 = `<tr style="height:${TIT === "v" ? r1 : 26}px"><th class="lh" rowspan="2">Serviço</th>`,
    h2 = `<tr${TIT === "v" ? ` style="height:${r2}px"` : ""}>`;
  gs.forEach((g, gi) => {
    const z = gi % 2 ? " z" : "";
    if (gi > 0 && GP) h1 += `<th class="gp" rowspan="2"></th>`;
    if (single(g)) h1 += TIT === "h" ? `<th class="gv hz${z}" rowspan="2">${hy(lab1(g), "700 9.5px " + FF)}</th>` : `<th class="gv${z}" rowspan="2"><span class="vt">${esc(lab1(g))}</span></th>`;
    else {
      h1 += `<th class="gh${z}" colspan="${g.rows.length}">${esc(g.pav)}</th>`;
      g.rows.forEach((r) => (h2 += TIT === "h" ? `<th class="lv hz${z}">${hy(r.label)}</th>` : `<th class="lv${z}"><span class="vt">${esc(r.label)}</span></th>`));
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

export function construir(ctx: Ctx, pl: Plano, MEAS: HTMLElement): Resultado {
  const E = ambiente(ctx);
  const PW = A3[pl.folha].w,
    PH = A3[pl.folha].h,
    IN = PW - 2 * MARGEM_FOLHA,
    LIVRE = PH - 2 * MARGEM_FOLHA - 124 - 12 - 34;

  const secs = pl.secoes.map((sec) => ({ sec, blocos: blocosDe(E, sec, pl.esconder) }));
  const tabs = secs.flatMap((S) => S.blocos.filter((b): b is BlocoTab => b.tipo === "tab"));
  tabs.forEach((b) => (b.ncol = b.sec.linhas === "serv" ? grupos(b.c, b.its, b.sec.det, E).reduce((a, g) => a + g.rows.length, 0) : b.servs.length));
  const html1 = (b: BlocoTab) => (b.sec.linhas === "serv" ? tabServ(E, b.c, b.its, b.fases, b.sec.det) : tabLocal(E, b.c, b.its, b.fases, b.sec.det));
  const medirHtml = (b: BlocoTab) => {
    MEAS.innerHTML = b.html;
    const t = MEAS.firstElementChild as HTMLElement;
    b.w = t.offsetWidth;
    b.h = t.offsetHeight;
  };
  // títulos horizontais ou verticais (vale para todas as tabelas); largura base da coluna: 38 px (horizontal) / 20 px (vertical)
  tabs.forEach((b) => {
    b.tit = pl.titulos;
    b.cwb = pl.titulos === "h" ? 38 : 20;
    TIT = b.tit;
    CW = b.cwb;
    b.cw = CW;
    b.html = html1(b);
    medirHtml(b);
  });
  // escala única: a menor que ainda deixa cada tabela inteira na folha (com "Estender", até 1,6)
  let k = tabs.length ? Math.min(...tabs.map((b) => Math.min(IN / b.w, (LIVRE - BAND) / b.h))) : 1;
  k = pl.fill ? Math.min(1.6, k) : Math.min(1, k);
  const cwMaxDe = (b: BlocoTab) => (b.tit === "h" ? 160 : 36);
  const regen = (b: BlocoTab, cw: number) => {
    TIT = b.tit;
    CW = cw;
    b.cw = cw;
    b.html = html1(b);
    medirHtml(b);
    CW = 20;
  };
  const wB = (b: BlocoTab) => b.w * k,
    hB = (b: BlocoTab) => BAND + b.h * k;

  type Linha2 = { bs: BlocoTab[]; w: number; h: number };
  type PagTmp = { tipo: "sec"; si: number; sec: Secao; rows: Linha2[]; cats: string[]; blocos: BlocoE[]; partes: Parte[]; cheia?: boolean };
  const pags: PagTmp[] = [];

  secs.forEach((S, si) => {
    const minhas: PagTmp[] = [];
    const nova = (): PagTmp => {
      const p: PagTmp = { tipo: "sec", si, sec: S.sec, rows: [], cats: [], blocos: [], partes: [] };
      pags.push(p);
      minhas.push(p);
      return p;
    };
    const altura = (p: { rows: Linha2[] }) => p.rows.reduce((a, r, i) => a + (i ? GAP : 0) + r.h, 0);
    // tenta pôr o bloco na folha, numa linha nova embaixo (nada lado a lado)
    const tenta = (p: { cheia?: boolean; rows: Linha2[] }, b: BlocoTab, real: boolean) => {
      if (p.cheia) return false;
      if (altura(p) + (p.rows.length ? GAP : 0) + hB(b) <= LIVRE) {
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

  // esticar: cada tabela alarga as células até ocupar a largura (máx. 160 px horizontal / 36 px vertical); a faixa ocupa sempre a largura toda
  const cws: number[] = [];
  pags.forEach((p) => {
    p.rows.forEach((r) => {
      if (pl.fill) {
        const sobra = IN - r.w,
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
          return `<div class="blk" style="width:${IN}px">${bandaCat(E, b)}<div class="tw" style="width:${wB(b)}px;height:${b.h * k}px"><div style="width:${b.w}px;transform:scale(${k});transform-origin:0 0">${b.html}</div></div></div>`;
        })
        .join("")}</div>`;
      p.partes.push({ html });
    });
  });
  CW = 20;

  // ---- sequência de folhas ----
  const seq: Pag[] = [];
  if (pl.resumo) seq.push({ tipo: "resumo", n: 0 });
  if (pl.sumario) seq.push({ tipo: "sumario", n: 0 });
  const secPags: Pag[] = pags.map((p) => {
    const nomes = p.cats;
    const titulo = (p.sec.nome ? p.sec.nome : nomes.length <= 3 ? nomes.join(" · ") : nomes.slice(0, 2).join(" · ") + " e mais " + (nomes.length - 2)).toUpperCase();
    return { tipo: "sec", n: 0, si: p.si, sec: p.sec, partes: p.partes, cats: p.cats, blocos: p.blocos, titulo, pct: pctBlocos(E, p.blocos) };
  });
  seq.push(...secPags);
  const todas = fotosDe(pl.fotos, pl.fotosLista);
  const extras = pl.resumo ? todas.slice(pl.fotos.n) : [];
  const porPg = pl.folha === "v" ? 12 : 8;
  for (let i = 0; i < extras.length; i += porPg) seq.push({ tipo: "fotos", n: 0, fotos: extras.slice(i, i + porPg) });
  seq.forEach((p, i) => (p.n = i + 1));

  // sumário
  const sumario: SumLinha[] = [];
  if (pl.sumario) {
    if (pl.resumo) sumario.push({ n: "R", titulo: "Resumo geral", sub: "Números, linha do tempo, quadros, 3D, fotos e frentes", pg: 1 });
    pl.secoes.forEach((s, i) => {
      const pg = seq.find((x) => x.tipo === "sec" && x.si === i);
      const cats = [...new Set(blocosDe(E, s, pl.esconder).map((b) => b.c.nome))];
      const resto = textoFiltro(E, s.filtro);
      sumario.push({ n: i + 1, titulo: s.nome || cats.join(", "), sub: cats.join(" · ") + (resto ? " · " + resto : ""), pg: pg ? pg.n : "—" });
    });
    const rf = seq.find((x) => x.tipo === "fotos");
    if (rf) sumario.push({ n: "F", titulo: "Registro fotográfico", sub: `${extras.length} fotos`, pg: rf.n });
  }

  const cwMin = cws.length ? Math.min(...cws) : 20,
    cwMax = cws.length ? Math.max(...cws) : 20;
  return { seq, N: seq.length, PW, PH, IN, LIVRE, k, cw: [cwMin, cwMax], folha: pl.folha, sumario, extras };
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
