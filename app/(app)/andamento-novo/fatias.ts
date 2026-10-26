// % da obra por FATIAS: cada serviço dos locais vale uma fatia da obra, e cada sistema (fachada, elevadores, caixa d'água…)
// vale outra. Dentro de um sistema, os serviços dividem a fatia do sistema (pesos internos somam 100% do sistema).
//
//   avanço do serviço = (finalizados + ½ em andamento) ÷ itens onde o serviço existe ("não se aplica" fica fora)
//   avanço do sistema = Σ (peso interno do serviço × avanço do serviço)
//   % do recorte      = Σ (fatia × avanço) ÷ Σ fatias dos serviços e sistemas que entram no recorte
//
// Para as telas continuarem somando em "Soma" (W, F, A), cada célula (item × serviço) entra com o peso
//   fatia do serviço ÷ nº de itens do recorte onde ele existe   (locais)
//   fatia do sistema × peso interno ÷ 100 ÷ nº de itens do sistema onde ele existe   (sistemas)
// e (F + ½A) ÷ W dá exatamente a fórmula acima, para qualquer recorte (obra, categoria, pavimento, filtro…).

import { acumular, chaveAp, somaZero, type Indice, type Soma } from "./calculo";
import type { Apontamento, Categoria, Local, Servico, Sistema, SistemaItem, Status, Vinculo } from "./types";

// categorias que pertencem a sistemas (as de locais não entram aqui)
export const CATEGORIAS_DE_SISTEMA = ["elev", "cxf", "cxc", "fach"];

export type Fatias = {
  servico: Map<string, number>; // fatia da obra de cada serviço dos locais
  sistema: Map<string, number>; // fatia da obra de cada sistema
  interno: Map<string, Map<string, number>>; // sistema → serviço → peso interno (soma 100% do sistema)
  catSistema: Set<string>; // ids das categorias de sistemas
};

type EntradaFatias = { servicos: Servico[]; sistemas: Sistema[]; itens: SistemaItem[]; categorias: Categoria[]; vinculos: Vinculo[] };

export function montarFatias(d: EntradaFatias): Fatias {
  const catSistema = new Set<string>();
  d.categorias.forEach((c) => CATEGORIAS_DE_SISTEMA.includes(c.chave) && catSistema.add(c.id));
  d.itens.forEach((i) => catSistema.add(i.categoria_id));

  const servico = new Map<string, number>();
  d.servicos.forEach((s) => servico.set(s.id, Number(s.fatia ?? 0)));
  const sistema = new Map<string, number>();
  d.sistemas.forEach((s) => sistema.set(s.id, Number(s.fatia ?? 0)));

  // peso interno: média dos pesos do serviço nas categorias do sistema, ponderada pelo nº de itens de cada categoria
  const interno = new Map<string, Map<string, number>>();
  d.sistemas.forEach((sis) => {
    const its = d.itens.filter((i) => i.sistema_id === sis.id);
    if (!its.length) return;
    const porCat = new Map<string, number>();
    its.forEach((i) => porCat.set(i.categoria_id, (porCat.get(i.categoria_id) ?? 0) + 1));
    const m = new Map<string, number>();
    d.vinculos.forEach((v) => {
      const n = porCat.get(v.categoria_id);
      if (!n) return;
      m.set(v.servico_id, (m.get(v.servico_id) ?? 0) + (Number(v.peso) * n) / its.length);
    });
    interno.set(sis.id, m);
  });
  return { servico, sistema, interno, catSistema };
}

export type AlvoR = { id: string; categoria_id: string; sistema_id?: string; servico_id?: string | null }; // servico_id: trecho de fachada, que só conta para o serviço dele
export const alvosDeLocais = (ls: Pick<Local, "id" | "categoria_id">[]): AlvoR[] => ls.map((l) => ({ id: l.id, categoria_id: l.categoria_id }));
export const alvosDeItens = (is: Pick<SistemaItem, "id" | "categoria_id" | "sistema_id" | "servico_id">[]): AlvoR[] => is.map((i) => ({ id: i.id, categoria_id: i.categoria_id, sistema_id: i.sistema_id, servico_id: i.servico_id }));

// soma de um recorte (qualquer conjunto de locais e itens de sistema), opcionalmente só de alguns serviços
export function somaRecorte(F: Fatias, idx: Indice, ap: Map<string, Apontamento>, alvos: AlvoR[], servOk?: (s: Servico, a: AlvoR) => boolean): Soma {
  const st = (a: AlvoR, s: Servico) => (ap.get(chaveAp(a.id, s.id))?.status ?? 0) as Status;
  const chave = (a: AlvoR, s: Servico) => (a.sistema_id ? a.sistema_id + "|" + s.id : s.id);
  const contagem = new Map<string, number>();
  alvos.forEach((a) =>
    (idx.servicosDaCat.get(a.categoria_id) ?? []).forEach(({ servico }) => {
      if (a.servico_id && a.servico_id !== servico.id) return;
      if (servOk && !servOk(servico, a)) return;
      if (st(a, servico) === 3) return;
      const k = chave(a, servico);
      contagem.set(k, (contagem.get(k) ?? 0) + 1);
    })
  );
  const soma = somaZero();
  alvos.forEach((a) =>
    (idx.servicosDaCat.get(a.categoria_id) ?? []).forEach(({ servico }) => {
      if (a.servico_id && a.servico_id !== servico.id) return;
      if (servOk && !servOk(servico, a)) return;
      const status = st(a, servico);
      if (status === 3) return acumular(soma, 0, 3);
      const n = contagem.get(chave(a, servico)) || 1;
      const peso = a.sistema_id ? ((F.sistema.get(a.sistema_id) ?? 0) * (F.interno.get(a.sistema_id)?.get(servico.id) ?? 0)) / 100 / n : (F.servico.get(servico.id) ?? 0) / n;
      acumular(soma, peso, status);
    })
  );
  return soma;
}

// total das fatias (serviços dos locais + sistemas) — deve dar 100
export function totalFatias(F: Fatias, servicosDeLocais: Servico[], sistemas: Sistema[]) {
  return servicosDeLocais.reduce((a, s) => a + (F.servico.get(s.id) ?? 0), 0) + sistemas.reduce((a, s) => a + (F.sistema.get(s.id) ?? 0), 0);
}

// serviços que contam como "dos locais": ligados a pelo menos uma categoria que não é de sistema
export function servicosDosLocais(F: Fatias, servicos: Servico[], idx: Indice, categorias: Categoria[]): Servico[] {
  const ids = new Set<string>();
  categorias.forEach((c) => {
    if (F.catSistema.has(c.id)) return;
    (idx.servicosDaCat.get(c.id) ?? []).forEach((x) => ids.add(x.servico.id));
  });
  return servicos.filter((s) => ids.has(s.id));
}
