// Prédios para as especificações: vêm do cadastro único de obras (tabela cadastro_obras).
export type Predio = { id: string; nome: string; fase: string | null; empId: string | null };

export async function listarPredios(supabase: any): Promise<Predio[]> {
  const { data } = await supabase.from("cadastro_obras").select("id, nome, fase, posvenda_emp_id").not("fase", "is", null).order("nome");
  return (data ?? []).map((o: any) => ({ id: o.id, nome: o.nome, fase: o.fase, empId: o.posvenda_emp_id }));
}

export const FASE_PREDIO: Record<string, string> = { desenvolvimento: "Em desenvolvimento", obra: "Em obra", entregue: "Entregue" };

/** Ordena unidades pelo número ("201", "1102 B") e deixa o lazer por último. */
export const ordemProjeto = (a: { tipo?: string; titulo: string }, b: { tipo?: string; titulo: string }) =>
  (a.tipo === "lazer" ? 1 : 0) - (b.tipo === "lazer" ? 1 : 0) || a.titulo.localeCompare(b.titulo, "pt-BR", { numeric: true });
