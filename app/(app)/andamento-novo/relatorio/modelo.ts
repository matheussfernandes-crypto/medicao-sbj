import { chaveAp, type Indice } from "../calculo";
import type { Apontamento, Categoria, DadosAndamento, Fase, Local, Pavimento, Servico, Sistema, SistemaItem, Status } from "../types";

// ============================ opções do relatório ============================

export type Filtros = { pav: string[]; sis: string[]; cat: string[]; serv: string[] };
export type Formato = {
  folha: "h" | "v"; // A3 horizontal / vertical
  linhas: "serv" | "local"; // o que vai nas linhas da tabela
  texto: "h" | "v"; // texto do topo das colunas
  det: "ju" | "un"; // apartamentos e locais: juntos por pavimento | um por um
  fill: boolean; // ocupar a folha toda
  fachada: "3d" | "tab";
  fit: "cont" | "enc"; // bloco grande: continua na outra folha | encolhe pra caber
  letra: "n" | "c"; // normal | compacta
};
export type Montagem = { modo: "tipo" | "pav"; resumo: boolean; esconder: boolean };

export const FILTROS_VAZIOS: Filtros = { pav: [], sis: [], cat: [], serv: [] };
export const FORMATO_PADRAO: Formato = { folha: "h", linhas: "serv", texto: "v", det: "ju", fill: false, fachada: "3d", fit: "cont", letra: "n" };
export const MONTAGEM_PADRAO: Montagem = { modo: "tipo", resumo: true, esconder: false };

export const A3 = { h: { w: 1587, h: 1123 }, v: { w: 1123, h: 1587 } };
export const MARGEM_FOLHA = 34;

// ============================ contexto ============================

export type Ctx = {
  dados: DadosAndamento;
  idx: Indice;
  ap: Map<string, Apontamento>;
  pavs: Pavimento[]; // de cima para baixo
  locaisPorPav: Map<string, Local[]>;
  itensPorSis: Map<string, SistemaItem[]>;
  pavPorId: Map<string, Pavimento>;
  sisPorId: Map<string, Sistema>;
  faseOrdem: Map<string, Fase>;
};

export function montarCtx(dados: DadosAndamento, idx: Indice, ap: Map<string, Apontamento>): Ctx {
  const pavs = [...dados.pavimentos].sort((a, b) => a.ordem - b.ordem);
  const locaisPorPav = new Map<string, Local[]>();
  dados.locais.forEach((l) => locaisPorPav.set(l.pavimento_id, [...(locaisPorPav.get(l.pavimento_id) ?? []), l]));
  locaisPorPav.forEach((a) => a.sort((x, y) => x.ordem - y.ordem));
  const itensPorSis = new Map<string, SistemaItem[]>();
  dados.itens.forEach((i) => itensPorSis.set(i.sistema_id, [...(itensPorSis.get(i.sistema_id) ?? []), i]));
  itensPorSis.forEach((a) => a.sort((x, y) => x.ordem - y.ordem));
  return {
    dados,
    idx,
    ap,
    pavs,
    locaisPorPav,
    itensPorSis,
    pavPorId: new Map(pavs.map((p) => [p.id, p])),
    sisPorId: new Map(dados.sistemas.map((s) => [s.id, s])),
    faseOrdem: new Map(dados.fases.map((f) => [f.id, f])),
  };
}

// ============================ escopo (filtros) ============================

export type Escopo = { locais: Local[]; itens: SistemaItem[]; servOk: (s: Servico) => boolean; filtrado: boolean };

export function calcularEscopo(ctx: Ctx, f: Filtros): Escopo {
  const pav = new Set(f.pav),
    sis = new Set(f.sis),
    cat = new Set(f.cat),
    serv = new Set(f.serv);
  let locais = ctx.dados.locais;
  let itens = ctx.dados.itens;
  if (pav.size || sis.size) {
    locais = pav.size ? locais.filter((l) => pav.has(l.pavimento_id)) : [];
    itens = sis.size ? itens.filter((i) => sis.has(i.sistema_id)) : [];
  }
  if (cat.size) {
    locais = locais.filter((l) => cat.has(l.categoria_id));
    itens = itens.filter((i) => cat.has(i.categoria_id));
  }
  return { locais, itens, servOk: (s) => serv.size === 0 || serv.has(s.id), filtrado: pav.size + sis.size + cat.size + serv.size > 0 };
}

export const status = (ap: Map<string, Apontamento>, alvo: string, servico: string): Status => (ap.get(chaveAp(alvo, servico))?.status ?? 0) as Status;

// ============================ fases ============================

export type GrupoFase = { id: string; nome: string; servicos: Servico[] };

// serviços agrupados por fase (na ordem da obra); serviço sem fase aparece com o nome do grupo, depois das fases
export function agruparPorFase(servicos: Servico[], ctx: Ctx): GrupoFase[] {
  const fases = [...ctx.dados.fases].sort((a, b) => a.ordem - b.ordem);
  const m = new Map<string, GrupoFase>();
  fases.forEach((f) => m.set(f.id, { id: f.id, nome: f.nome, servicos: [] }));
  const ordenados = [...servicos].sort((a, b) => a.ordem - b.ordem);
  ordenados.forEach((s) => {
    const chave = s.fase_id && m.has(s.fase_id) ? s.fase_id : "g:" + s.grupo;
    if (!m.has(chave)) m.set(chave, { id: chave, nome: s.grupo, servicos: [] });
    m.get(chave)!.servicos.push(s);
  });
  return Array.from(m.values()).filter((g) => g.servicos.length);
}

// ============================ blocos ============================

export type Coluna = {
  id: string; // id do local, item ou pavimento (modo "juntos")
  rotulo: string;
  grupoId?: string; // pavimento, no modo "um por um"
  grupoRotulo?: string;
  alvos: string[]; // ids de locais/itens que a coluna reúne
  pavId?: string;
};

export type BlocoGrade = {
  id: string;
  tipo: "grade";
  cat: Categoria;
  titulo: string; // ex.: "Escadaria" ou "Pav 12 · Apartamentos"
  sub?: string;
  colunas: Coluna[]; // de cima para baixo (ordem natural do prédio)
  fases: GrupoFase[];
  agrupado: boolean; // colunas agrupadas por pavimento (um por um)
};
export type BlocoFachada = { id: string; tipo: "fachada"; servico: Servico; titulo: string };
export type BlocoFachadaTab = { id: string; tipo: "fachada-tab"; servico: Servico; titulo: string; sistemaId: string };
export type Bloco = BlocoGrade | BlocoFachada | BlocoFachadaTab;

// colunas de um conjunto de locais da mesma categoria
function colunasDeLocais(locais: Local[], ctx: Ctx, det: "ju" | "un"): Coluna[] {
  const porPav = new Map<string, Local[]>();
  locais.forEach((l) => porPav.set(l.pavimento_id, [...(porPav.get(l.pavimento_id) ?? []), l]));
  const pavsOrdenados = ctx.pavs.filter((p) => porPav.has(p.id));
  if (det === "ju") return pavsOrdenados.map((p) => ({ id: p.id, rotulo: p.nome, alvos: porPav.get(p.id)!.map((l) => l.id), pavId: p.id }));
  return pavsOrdenados.flatMap((p) =>
    porPav.get(p.id)!.map((l) => ({ id: l.id, rotulo: l.nome, grupoId: p.id, grupoRotulo: p.nome, alvos: [l.id], pavId: p.id }))
  );
}

const temApontamento = (ctx: Ctx, alvos: string[], s: Servico) => alvos.some((a) => status(ctx.ap, a, s.id) === 1 || status(ctx.ap, a, s.id) === 2);

export function montarBlocos(ctx: Ctx, esc: Escopo, fmt: Formato, mon: Montagem): Bloco[] {
  const blocos: Bloco[] = [];
  const { idx } = ctx;
  const cats = ctx.dados.categorias;

  const fasesDoBloco = (cat: Categoria, alvos: string[]) => {
    let servs = (idx.servicosDaCat.get(cat.id) ?? []).map((x) => x.servico).filter(esc.servOk);
    if (mon.esconder) servs = servs.filter((s) => temApontamento(ctx, alvos, s));
    return agruparPorFase(servs, ctx);
  };

  // ---- locais ----
  const locaisPorCat = (c: Categoria) => esc.locais.filter((l) => l.categoria_id === c.id);
  if (mon.modo === "tipo" || fmt.det === "un") {
    cats.forEach((cat) => {
      const ls = locaisPorCat(cat);
      if (!ls.length) return;
      const colunas = colunasDeLocais(ls, ctx, fmt.det);
      const alvos = ls.map((l) => l.id);
      const fases = fasesDoBloco(cat, alvos);
      if (!fases.length) return;
      blocos.push({ id: "cat:" + cat.id, tipo: "grade", cat, titulo: cat.nome, sub: `em ${new Set(ls.map((l) => l.pavimento_id)).size} pavimentos`, colunas, fases, agrupado: fmt.det === "un" });
    });
  } else {
    // folha por pavimento: um bloco por pavimento × categoria
    ctx.pavs.forEach((p) => {
      cats.forEach((cat) => {
        const ls = esc.locais.filter((l) => l.pavimento_id === p.id && l.categoria_id === cat.id);
        if (!ls.length) return;
        const fases = fasesDoBloco(cat, ls.map((l) => l.id));
        if (!fases.length) return;
        const colunas: Coluna[] = ls.map((l) => ({ id: l.id, rotulo: l.nome, alvos: [l.id], pavId: p.id }));
        blocos.push({ id: `pav:${p.id}:${cat.id}`, tipo: "grade", cat, titulo: `${p.nome} · ${cat.nome}`, colunas, fases, agrupado: false });
      });
    });
  }

  // ---- sistemas (blocos próprios) ----
  ctx.dados.sistemas.forEach((sis) => {
    const its = esc.itens.filter((i) => i.sistema_id === sis.id);
    if (!its.length) return;
    if (sis.tipo === "fachada") {
      const cat = cats.find((c) => c.chave === "fach");
      if (!cat) return;
      const servs = (idx.servicosDaCat.get(cat.id) ?? []).map((x) => x.servico).filter(esc.servOk);
      servs.forEach((s) => {
        if (mon.esconder && !temApontamento(ctx, its.map((i) => i.id), s)) return;
        blocos.push(
          fmt.fachada === "3d"
            ? { id: `fach3d:${s.id}`, tipo: "fachada", servico: s, titulo: `${sis.nome} · ${s.nome}` }
            : { id: `fachtab:${s.id}`, tipo: "fachada-tab", servico: s, titulo: `${sis.nome} · ${s.nome}`, sistemaId: sis.id }
        );
      });
      return;
    }
    cats.forEach((cat) => {
      const grupo = its.filter((i) => i.categoria_id === cat.id);
      if (!grupo.length) return;
      const fases = fasesDoBloco(cat, grupo.map((i) => i.id));
      if (!fases.length) return;
      const colunas: Coluna[] = grupo.map((i) => ({ id: i.id, rotulo: i.nome, alvos: [i.id] }));
      blocos.push({ id: `sis:${sis.id}:${cat.id}`, tipo: "grade", cat, titulo: `${sis.nome}`, sub: cat.nome, colunas, fases, agrupado: false });
    });
  });
  return blocos;
}

// ============================ números de uma célula ============================

export type Numeros = { n: number; f: number; a: number; aus: number };
export function numeros(ctx: Ctx, alvos: string[], s: Servico): Numeros {
  const r = { n: 0, f: 0, a: 0, aus: 0 };
  alvos.forEach((id) => {
    const st = status(ctx.ap, id, s.id);
    if (st === 3) r.aus++;
    else {
      r.n++;
      if (st === 2) r.f++;
      else if (st === 1) r.a++;
    }
  });
  return r;
}

// peso do serviço dentro da categoria (para % de fase)
export function pesoNaCategoria(ctx: Ctx, catId: string, servId: string) {
  return (ctx.idx.servicosDaCat.get(catId) ?? []).find((x) => x.servico.id === servId)?.peso ?? 0;
}

// título da folha: junta os grupos presentes ("HALL · ESCADARIA" ou "A · B e mais 2")
export function tituloDaFolha(nomes: string[]): string {
  const unicos = Array.from(new Set(nomes));
  if (unicos.length <= 2) return unicos.join(" · ").toUpperCase();
  return `${unicos.slice(0, 2).join(" · ")} e mais ${unicos.length - 2}`.toUpperCase();
}

// ============================ paginação ============================

export type Medida = { id: string; altura: number; cabecalho: number; fatias: number[] }; // alturas em px (escala 1)
export type ItemFolha = { blocoId: string; fatias: number[] | null; continuacao: boolean; escala: number };
export type Folha = { itens: ItemFolha[] };

// Encaixa os blocos, um embaixo do outro, em folhas de altura útil `capacidade`.
// - se o bloco não cabe no que sobra, vai inteiro pra próxima folha
// - se é maior que uma folha inteira: "encolhe" (fit = enc) ou continua na outra (corte sempre entre fatias/fases)
export function paginar(medidas: Medida[], capacidade: number, fit: "cont" | "enc", respiro = 14): Folha[] {
  const folhas: Folha[] = [{ itens: [] }];
  let usado = 0;
  const nova = () => {
    folhas.push({ itens: [] });
    usado = 0;
  };
  const atual = () => folhas[folhas.length - 1];

  medidas.forEach((m) => {
    const resto = capacidade - usado;
    if (m.altura <= resto) {
      atual().itens.push({ blocoId: m.id, fatias: null, continuacao: false, escala: 1 });
      usado += m.altura + respiro;
      return;
    }
    if (m.altura <= capacidade) {
      if (atual().itens.length) nova();
      atual().itens.push({ blocoId: m.id, fatias: null, continuacao: false, escala: 1 });
      usado = m.altura + respiro;
      return;
    }
    // maior que uma folha inteira
    if (atual().itens.length) nova();
    if (fit === "enc" || m.fatias.length <= 1) {
      atual().itens.push({ blocoId: m.id, fatias: null, continuacao: false, escala: capacidade / m.altura });
      usado = capacidade;
      return;
    }
    let fatia = 0;
    let primeira = true;
    while (fatia < m.fatias.length) {
      let h = m.cabecalho + (primeira ? 0 : 22);
      const grupo: number[] = [];
      while (fatia < m.fatias.length && (grupo.length === 0 || h + m.fatias[fatia] <= capacidade)) {
        h += m.fatias[fatia];
        grupo.push(fatia);
        fatia++;
      }
      atual().itens.push({ blocoId: m.id, fatias: grupo, continuacao: !primeira, escala: h > capacidade ? capacidade / h : 1 });
      usado = h + respiro;
      primeira = false;
      if (fatia < m.fatias.length) nova();
    }
  });
  return folhas.filter((f) => f.itens.length);
}
