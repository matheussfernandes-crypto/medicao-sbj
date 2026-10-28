import { chaveAp, type Indice } from "../calculo";
import { montarFatias, type Fatias } from "../fatias";
import type { Apontamento, Categoria, DadosAndamento, Fase, Local, Pavimento, Servico, Sistema, SistemaItem, Status } from "../types";

// ============================ opções do relatório ============================

// fases: nomes das fases (só usado nas seções do "Montar relatório")
export type Filtros = { pav: string[]; sis: string[]; cat: string[]; serv: string[]; fases?: string[] };
export type Papel = "A4" | "A3" | "A2" | "A1";
export type Formato = {
  papel: Papel; // tamanho da folha
  folha: "h" | "v"; // orientação: horizontal / vertical
  linhas: "serv" | "local"; // o que vai nas linhas da tabela: serviços | pavimentos e locais
  det: "ju" | "un"; // apartamentos e locais: juntos por pavimento | um por um
  fill: boolean; // tamanho: estender até ocupar a folha | manter tamanho normal
};
export type Montagem = { resumo: boolean; esconder: boolean };

export const FILTROS_VAZIOS: Filtros = { pav: [], sis: [], cat: [], serv: [] };
export const FORMATO_PADRAO: Formato = { papel: "A3", folha: "v", linhas: "local", det: "un", fill: true };
export const MONTAGEM_PADRAO: Montagem = { resumo: true, esconder: false };

// Tamanhos em px a 96 dpi (em pé). Cada folha fica 1-2 px menor que o papel: assim nunca passa da página impressa.
// A4 794×1123 · A3 1123×1587 · A2 1587×2245 · A1 2245×3179
export const PAPEIS: Record<Papel, { w: number; h: number; mm: [number, number]; nome: string }> = {
  A4: { w: 792, h: 1121, mm: [210, 297], nome: "A4" },
  A3: { w: 1121, h: 1585, mm: [297, 420], nome: "A3" },
  A2: { w: 1585, h: 2243, mm: [420, 594], nome: "A2" },
  A1: { w: 2243, h: 3177, mm: [594, 841], nome: "A1" },
};
export const PAPEL_LISTA: Papel[] = ["A4", "A3", "A2", "A1"];
export const dimFolha = (papel: Papel, folha: "h" | "v") => (folha === "v" ? { w: PAPEIS[papel].w, h: PAPEIS[papel].h } : { w: PAPEIS[papel].h, h: PAPEIS[papel].w });
// "A2 horizontal · 594 × 420 mm"
export const textoFolha = (papel: Papel, folha: "h" | "v") => {
  const [a, b] = PAPEIS[papel].mm;
  return `${papel} ${folha === "h" ? "horizontal" : "vertical"} · ${folha === "h" ? b : a} × ${folha === "h" ? a : b} mm`;
};
export const MARGEM_FOLHA = 34;

// ---- fotos do resumo (escolhidas na aba Fotos) ----
// onde as fotos aparecem: só no resumo, só no relatório final (Registro fotográfico) ou nos dois (padrão)
export type OndeFotos = "resumo" | "final" | "ambos";
export type FotosSel = { sel: string[]; leg: Record<string, string>; n: 4 | 6; onde?: OndeFotos; repetir?: boolean };
export const FOTOS_VAZIAS: FotosSel = { sel: [], leg: {}, n: 4, onde: "ambos", repetir: false };
export type FotoRel = { id: string; url: string; legenda: string; data: string }; // data já formatada (dd/mm/aaaa)

// distribui as fotos selecionadas (na ordem escolhida) entre o quadro do resumo e as páginas de Registro fotográfico
export function distribuirFotos(fs: FotosSel, todas: FotoRel[], resumoLigado: boolean): { resumo: FotoRel[]; final: FotoRel[]; fora: FotoRel[] } {
  const onde = fs.onde ?? "ambos";
  if (onde === "final") return { resumo: [], final: todas, fora: [] };
  const resumo = resumoLigado ? todas.slice(0, fs.n) : [];
  if (onde === "resumo") return { resumo, final: [], fora: resumoLigado ? todas.slice(fs.n) : todas };
  // resumo + relatório final: as que passam do limite vão para o registro; com "repetir", o registro mostra todas
  const final = !resumoLigado || fs.repetir ? todas : todas.slice(fs.n);
  return { resumo, final, fora: [] };
}

// ---- montagens: várias seções (filtro + formatação) num PDF só ----
// Seção de uma montagem. Campos opcionais: se faltarem, valem os da montagem. Seção feita de predefinição leva a formatação dela (pre).
export type Secao = {
  nome: string;
  filtro: Filtros;
  linhas: "serv" | "local";
  det: "ju" | "un";
  esconder?: boolean;
  fill?: boolean;
  papel?: Papel;
  folha?: "h" | "v";
  pre?: { id: string; nome: string; fmt: { linhas: "serv" | "local"; det: "ju" | "un"; esconder: boolean; fill: boolean; papel: Papel; folha: "h" | "v" } };
};
export type MontagemDados = {
  papel?: Papel;
  folha: "h" | "v";
  fill: boolean;
  resumo: boolean;
  sumario: boolean;
  fotos: FotosSel;
  secoes: Secao[];
};
export type MontagemSalva = { id: string; nome: string; dados: MontagemDados };

export const MONTAGEM_NOVA = (fotos: FotosSel): MontagemDados => ({ papel: "A3", folha: "v", fill: true, resumo: true, sumario: true, fotos: JSON.parse(JSON.stringify(fotos)), secoes: [] });

// ============================ contexto ============================

export type Ctx = {
  dados: DadosAndamento;
  idx: Indice;
  fat: Fatias; // fatias da obra (serviços dos locais e sistemas)
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
    fat: montarFatias(dados),
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

// ---- ordem dos serviços mexida na própria tela do relatório (vale na prévia na hora; só grava ao "Salvar ordem") ----
export type OrdemLocal = {
  serv: Record<string, { ordem: number; fase_id: string | null; grupo: string }>;
  fases: Record<string, number>;
};
export function aplicarOrdemLocal(dados: DadosAndamento, o: OrdemLocal | null): DadosAndamento {
  if (!o) return dados;
  return {
    ...dados,
    fases: dados.fases.map((f) => (o.fases[f.id] != null ? { ...f, ordem: o.fases[f.id] } : f)),
    servicos: dados.servicos.map((s) => (o.serv[s.id] ? { ...s, ...o.serv[s.id] } : s)),
  };
}
