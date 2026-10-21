import type { Apontamento, Categoria, Local, Servico, SistemaItem, Status, Vinculo } from "./types";

// Cálculo ponderado (mesma regra de an_percentuais no banco):
//   % = (peso finalizado + p_andamento × peso em andamento) / soma dos pesos
//   Ausência sai da conta, com o peso dela. Sem pesos definidos, vale a contagem de etapas.
export const PESO_ANDAMENTO = 0.5;

export type Soma = { W: number; F: number; A: number; tot: number; fin: number; and: number; nao: number; aus: number };
export const somaZero = (): Soma => ({ W: 0, F: 0, A: 0, tot: 0, fin: 0, and: 0, nao: 0, aus: 0 });

export function juntar(a: Soma, b: Soma): Soma {
  return { W: a.W + b.W, F: a.F + b.F, A: a.A + b.A, tot: a.tot + b.tot, fin: a.fin + b.fin, and: a.and + b.and, nao: a.nao + b.nao, aus: a.aus + b.aus };
}

export function acumular(a: Soma, peso: number, st: Status) {
  if (st === 3) {
    a.aus++;
    return;
  }
  a.W += peso;
  a.tot++;
  if (st === 2) {
    a.F += peso;
    a.fin++;
  } else if (st === 1) {
    a.A += peso;
    a.and++;
  } else a.nao++;
}

export function pct(s: Soma, pAnd = PESO_ANDAMENTO): number {
  if (s.W > 0) return ((s.F + pAnd * s.A) / s.W) * 100;
  if (s.tot > 0) return ((s.fin + pAnd * s.and) / s.tot) * 100;
  return 0;
}
// parte "concluída" e "em andamento" para barras empilhadas (em % da soma)
export function partes(s: Soma, pAnd = PESO_ANDAMENTO) {
  const base = s.W > 0 ? s.W : s.tot;
  if (base <= 0) return { fin: 0, and: 0 };
  const f = s.W > 0 ? s.F : s.fin;
  const a = s.W > 0 ? s.A : s.and;
  return { fin: (f / base) * 100, and: ((a * pAnd) / base) * 100 };
}

export const chaveAp = (alvo: string, servico: string) => alvo + "|" + servico;

export type Indice = {
  servicosDaCat: Map<string, { servico: Servico; peso: number }[]>;
  servicoPorId: Map<string, Servico>;
  catPorId: Map<string, Categoria>;
};

export function montarIndice(categorias: Categoria[], servicos: Servico[], vinculos: Vinculo[]): Indice {
  const servicoPorId = new Map(servicos.map((s) => [s.id, s]));
  const servicosDaCat = new Map<string, { servico: Servico; peso: number }[]>();
  vinculos.forEach((v) => {
    const s = servicoPorId.get(v.servico_id);
    if (!s) return;
    if (!servicosDaCat.has(v.categoria_id)) servicosDaCat.set(v.categoria_id, []);
    servicosDaCat.get(v.categoria_id)!.push({ servico: s, peso: v.peso });
  });
  servicosDaCat.forEach((l) => l.sort((a, b) => a.servico.ordem - b.servico.ordem));
  return { servicosDaCat, servicoPorId, catPorId: new Map(categorias.map((c) => [c.id, c])) };
}

export function mapaApontamentos(lista: Apontamento[]): Map<string, Apontamento> {
  return new Map(lista.map((a) => [chaveAp(a.alvo, a.servico_id), a]));
}

// soma de um alvo (local ou item), opcionalmente só dos serviços aceitos pelo filtro
export function somarAlvo(
  alvoId: string,
  categoriaId: string,
  idx: Indice,
  ap: Map<string, Apontamento>,
  filtro?: (s: Servico) => boolean
): Soma {
  const s = somaZero();
  (idx.servicosDaCat.get(categoriaId) ?? []).forEach(({ servico, peso }) => {
    if (filtro && !filtro(servico)) return;
    acumular(s, peso, (ap.get(chaveAp(alvoId, servico.id))?.status ?? 0) as Status);
  });
  return s;
}

export type Alvo = Local | SistemaItem;

// células (local/item × serviço) que um apontamento atinge: serviço que "vale pro pavimento inteiro"
// vale para todos os locais do pavimento que têm o serviço.
export function celulasAfetadas(alvo: Local, servico: Servico, locaisDoPav: Local[], idx: Indice): { alvo: string; servico: string }[] {
  if (!servico.vale_pavimento_inteiro) return [{ alvo: alvo.id, servico: servico.id }];
  return locaisDoPav
    .filter((l) => (idx.servicosDaCat.get(l.categoria_id) ?? []).some((x) => x.servico.id === servico.id))
    .map((l) => ({ alvo: l.id, servico: servico.id }));
}

export const COR_STATUS: Record<Status, string> = { 0: "#e3e7e9", 1: "#f0a020", 2: "#24914f", 3: "#ffffff" };
export const TXT_STATUS: Record<Status, string> = { 0: "#4b5563", 1: "#3b2a00", 2: "#ffffff", 3: "#6b7280" };
export const ROTULO_STATUS: Record<Status, string> = { 0: "Não iniciado", 1: "Andamento", 2: "Finalizado", 3: "Ausência" };
