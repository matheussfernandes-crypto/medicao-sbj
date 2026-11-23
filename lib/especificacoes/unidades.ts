// Unidades da SBJ (cadastro do Pós-venda, tabela posvenda_docs) para ligar a um projeto de especificação.
export type UnidadeSbj = { id: string; empId: string; empNome: string; numero: string; bloco: string; prop: string };

export async function listarUnidadesSbj(supabase: any): Promise<UnidadeSbj[]> {
  const { data: emps } = await supabase.from("posvenda_docs").select("id, nome:dados->>nome").eq("colecao", "empreendimentos");
  const nomes = new Map<string, string>((emps ?? []).map((e: any) => [e.id, e.nome ?? ""]));
  const out: UnidadeSbj[] = [];
  for (let de = 0; ; de += 1000) {
    const { data } = await supabase
      .from("posvenda_docs")
      .select("id, empId:dados->>empId, numero:dados->>numero, bloco:dados->>bloco, prop:dados->>prop")
      .eq("colecao", "unidades")
      .order("id")
      .range(de, de + 999);
    for (const u of data ?? [])
      out.push({ id: u.id, empId: u.empId ?? "", empNome: nomes.get(u.empId) ?? "", numero: u.numero ?? "", bloco: u.bloco ?? "", prop: u.prop ?? "" });
    if (!data || data.length < 1000) break;
  }
  return out.sort((a, b) => a.empNome.localeCompare(b.empNome) || a.numero.localeCompare(b.numero, "pt-BR", { numeric: true }));
}

export const rotuloUnidadeSbj = (u: Pick<UnidadeSbj, "empNome" | "numero" | "bloco">) =>
  `${u.empNome} · ${u.numero}${u.bloco ? ` bloco ${u.bloco}` : ""}`;

/** Uma unidade só (para mostrar o nome no projeto). */
export async function unidadeSbj(supabase: any, id: string | null | undefined): Promise<UnidadeSbj | null> {
  if (!id) return null;
  const { data: u } = await supabase
    .from("posvenda_docs")
    .select("id, empId:dados->>empId, numero:dados->>numero, bloco:dados->>bloco, prop:dados->>prop")
    .eq("colecao", "unidades")
    .eq("id", id)
    .maybeSingle();
  if (!u) return null;
  const { data: e } = await supabase.from("posvenda_docs").select("nome:dados->>nome").eq("colecao", "empreendimentos").eq("id", u.empId).maybeSingle();
  return { id: u.id, empId: u.empId ?? "", empNome: e?.nome ?? "", numero: u.numero ?? "", bloco: u.bloco ?? "", prop: u.prop ?? "" };
}
