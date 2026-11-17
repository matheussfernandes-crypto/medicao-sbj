// A fase da obra no Cadastro único decide onde ela aparece nas listas de ESCOLHA de obra:
//   Em desenvolvimento -> Medição e Contratos
//   Em execução        -> Medição, Contratos e Andamento
//   Concluída          -> sai de Medição, Contratos e Andamento (nada é apagado; o histórico continua acessível)
// Obra sem ligação com o Cadastro ou sem fase (ex.: INSS) continua aparecendo em tudo.
// Só filtra listas; não mexe em cálculos, lançamentos, fechamentos nem PDFs.

export type Fase = "desenvolvimento" | "obra" | "entregue" | null;
type Mapa = { porObraGeral: Map<string, Fase>; porAndamento: Map<string, Fase> };

export async function fasesDasObras(supabase: any): Promise<Mapa> {
  const porObraGeral = new Map<string, Fase>();
  const porAndamento = new Map<string, Fase>();
  const { data, error } = await supabase.from("cadastro_obras").select("fase, obra_id, andamento_obra_id");
  // se o Cadastro não puder ser lido, nada é escondido
  if (error) return { porObraGeral, porAndamento };
  (data ?? []).forEach((c: any) => {
    if (c.obra_id) porObraGeral.set(c.obra_id, c.fase ?? null);
    if (c.andamento_obra_id) porAndamento.set(c.andamento_obra_id, c.fase ?? null);
  });
  return { porObraGeral, porAndamento };
}

// Medição e Contratos: some só a obra concluída. "manter" = obra pedida/selecionada, que continua na lista.
export function paraMedicao<T extends { id: string }>(obras: T[], m: Mapa, manter?: string | null): T[] {
  return obras.filter((o) => o.id === manter || m.porObraGeral.get(o.id) !== "entregue");
}

// Andamento: só obra em execução (sem fase ou sem ligação continua visível).
export function paraAndamento<T extends { id: string }>(obras: T[], m: Mapa, manter?: string | null): T[] {
  return obras.filter((o) => {
    if (o.id === manter) return true;
    const f = m.porAndamento.get(o.id);
    return f === undefined || f === null || f === "obra";
  });
}
