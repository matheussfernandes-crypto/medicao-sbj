import { chaveAp, type Indice } from "../calculo";
import type { Apontamento, Categoria, DadosAndamento, Fase, Local, Pavimento, Servico, Sistema, SistemaItem, Status } from "../types";

// ============================ opções do relatório ============================

// fases: nomes das fases (só usado nas seções do "Montar relatório")
export type Filtros = { pav: string[]; sis: string[]; cat: string[]; serv: string[]; fases?: string[] };
export type Formato = {
  folha: "h" | "v"; // A3 horizontal / vertical
  linhas: "serv" | "local"; // o que vai nas linhas da tabela: serviços | pavimentos e locais
  titulos: "h" | "v"; // títulos das colunas: horizontal (quebra linha) | vertical
  det: "ju" | "un"; // apartamentos e locais: juntos por pavimento | um por um
  fill: boolean; // tamanho: estender até ocupar a folha | manter tamanho normal
};
export type Montagem = { resumo: boolean; esconder: boolean };

export const FILTROS_VAZIOS: Filtros = { pav: [], sis: [], cat: [], serv: [] };
export const FORMATO_PADRAO: Formato = { folha: "v", linhas: "local", titulos: "h", det: "un", fill: true };
export const MONTAGEM_PADRAO: Montagem = { resumo: true, esconder: false };

// A3 = 420 x 297 mm = 1587,4 x 1122,5 px (96 dpi). A folha fica 1-2 px menor: assim nunca passa da página impressa.
export const A3 = { h: { w: 1585, h: 1120 }, v: { w: 1120, h: 1585 } };
export const MARGEM_FOLHA = 34;

// ---- fotos do resumo (escolhidas na aba Fotos) ----
export type FotosSel = { sel: string[]; leg: Record<string, string>; n: 4 | 6 };
export const FOTOS_VAZIAS: FotosSel = { sel: [], leg: {}, n: 4 };
export type FotoRel = { id: string; url: string; legenda: string; data: string }; // data já formatada (dd/mm/aaaa)

// ---- montagens: várias seções (filtro + formatação) num PDF só ----
export type Secao = { nome: string; filtro: Filtros; linhas: "serv" | "local"; det: "ju" | "un" };
export type MontagemDados = {
  folha: "h" | "v";
  fill: boolean;
  titulos: "h" | "v";
  resumo: boolean;
  sumario: boolean;
  fotos: FotosSel;
  secoes: Secao[];
};
export type MontagemSalva = { id: string; nome: string; dados: MontagemDados };

export const MONTAGEM_NOVA = (fotos: FotosSel): MontagemDados => ({ folha: "v", fill: true, titulos: "h", resumo: true, sumario: true, fotos: JSON.parse(JSON.stringify(fotos)), secoes: [] });

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

// nome da fase de um serviço (para filtrar por fase)
export const faseDoServico = (s: Servico, ctx: Ctx) => (s.fase_id && ctx.faseOrdem.get(s.fase_id)?.nome) || s.grupo;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// nome do local igual ao do ambiente (Hall, Escadaria, Garagem…) não diz de qual pavimento é: usa o nome do pavimento
export function rotuloDoLocal(l: Local, pavNome: string, cat: Categoria) {
  const n = norm(l.nome);
  return n === norm(cat.nome) || /^(hall|escadaria|garagem)$/.test(n) ? pavNome : l.nome;
}

// peso do serviço dentro da categoria (para % de fase)
export function pesoNaCategoria(ctx: Ctx, catId: string, servId: string) {
  return (ctx.idx.servicosDaCat.get(catId) ?? []).find((x) => x.servico.id === servId)?.peso ?? 0;
}
