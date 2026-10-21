import type { Indice } from "./calculo";
import type { NiveisFachada } from "./Predio3D";
import { DESCIDAS_PADRAO, type DescidasConfig, type Local, type Pavimento, type Sistema, type SistemaItem } from "./types";

// Embasamento: pavimentos abaixo do 1º com apartamento (o mais baixo); Torre: dele até a Cobertura; Reservatório: 1 nível.
// (mesma regra de an_sincronizar_fachada no banco)
export function calcularNiveis(pavs: Pavimento[], locaisPorPav: Map<string, Local[]>, idx: Indice): NiveisFachada {
  const ordenados = [...pavs].sort((a, b) => a.ordem - b.ordem); // de cima para baixo
  let base: number | null = null;
  ordenados.forEach((p) => {
    const temApto = (locaisPorPav.get(p.id) ?? []).some((l) => idx.catPorId.get(l.categoria_id)?.chave === "tipo");
    if (temApto) base = base == null ? p.ordem : Math.max(base, p.ordem);
  });
  const emb = ordenados.filter((p) => base != null && p.ordem > base).map((p) => ({ id: p.id, nome: p.nome }));
  const tor = ordenados.filter((p) => base == null || p.ordem <= base).map((p) => ({ id: p.id, nome: p.nome }));
  return { emb, tor, res: [{ id: "res", nome: "Reservatório" }] };
}

export function descidasDoSistema(s: Sistema): DescidasConfig {
  const d = s.config?.descidas;
  const base = JSON.parse(JSON.stringify(DESCIDAS_PADRAO)) as DescidasConfig;
  if (!d) return base;
  (["emb", "tor", "res"] as const).forEach((p) => (["N", "S", "L", "O"] as const).forEach((f) => (base[p][f] = Number(d[p]?.[f] ?? base[p][f]))));
  return base;
}

export const chaveItemFachada = (parte: string, face: string, descida: number, nivelId: string) => `${parte}|${face}|${descida}|${nivelId}`;

export function mapaItensFachada(itens: SistemaItem[]): Map<string, SistemaItem> {
  const m = new Map<string, SistemaItem>();
  itens.forEach((i) => {
    if (i.parte && i.face && i.descida) m.set(chaveItemFachada(i.parte, i.face, i.descida, i.pavimento_id ?? "res"), i);
  });
  return m;
}
