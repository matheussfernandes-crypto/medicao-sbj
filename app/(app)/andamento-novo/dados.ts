import { createClient } from "@/lib/supabase/server";
import type { Apontamento, DadosAndamento, ObraInfo } from "./types";

// Busca em páginas: o PostgREST devolve no máximo 1000 linhas por consulta.
async function paginar<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const PAGINA = 1000;
  const todas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    const linhas = data ?? [];
    todas.push(...linhas);
    if (linhas.length < PAGINA) break;
  }
  return todas;
}

export async function carregarAndamento(obraIdPedida?: string): Promise<DadosAndamento | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("nome_completo, setor").eq("id", user!.id).single();

  const { data: obrasRows } = await supabase.from("obras").select("id, nome, data_inicio, data_entrega_prevista").order("nome");
  const obras = (obrasRows ?? []) as ObraInfo[];
  const obra = obras.find((o) => o.id === obraIdPedida) ?? obras[0];
  if (!obra) return null;

  // mantém os itens da fachada (descida x pavimento) em dia com os pavimentos atuais
  await supabase.rpc("an_sincronizar_fachada", { p_obra: obra.id });

  const [{ data: fases }, { data: categorias }, { data: servicos }, { data: pavimentos }, { data: sistemas }] = await Promise.all([
    supabase.from("an_fase").select("id, nome, ordem").eq("obra_id", obra.id).order("ordem"),
    supabase.from("an_categoria").select("id, chave, nome, cor, ordem").eq("obra_id", obra.id).order("ordem"),
    supabase.from("an_servico").select("id, nome, grupo, fase_id, vale_pavimento_inteiro, ordem").eq("obra_id", obra.id).eq("arquivado", false).order("ordem"),
    supabase.from("an_pavimento").select("id, nome, ordem").eq("obra_id", obra.id).order("ordem"),
    supabase.from("an_sistema").select("id, nome, tipo, ordem, config").eq("obra_id", obra.id).order("ordem"),
  ]);

  const catIds = (categorias ?? []).map((c) => c.id);
  const pavIds = (pavimentos ?? []).map((p) => p.id);
  const sisIds = (sistemas ?? []).map((s) => s.id);

  const [vinculos, locais, itens, apRows] = await Promise.all([
    catIds.length
      ? paginar<any>((de, ate) => supabase.from("an_categoria_servico").select("categoria_id, servico_id, peso, peso_fixo").in("categoria_id", catIds).order("categoria_id").order("servico_id").range(de, ate))
      : Promise.resolve([] as any[]),
    pavIds.length
      ? paginar<any>((de, ate) => supabase.from("an_local").select("id, pavimento_id, nome, categoria_id, ordem").in("pavimento_id", pavIds).order("id").range(de, ate))
      : Promise.resolve([] as any[]),
    sisIds.length
      ? paginar<any>((de, ate) =>
          supabase.from("an_sistema_item").select("id, sistema_id, nome, categoria_id, ordem, parte, face, descida, pavimento_id").in("sistema_id", sisIds).order("id").range(de, ate)
        )
      : Promise.resolve([] as any[]),
    paginar<any>((de, ate) =>
      supabase
        .from("an_apontamento")
        .select("local_id, sistema_item_id, servico_id, status, observacao, atualizado_por, atualizado_em")
        .eq("obra_id", obra.id)
        .order("id")
        .range(de, ate)
    ),
  ]);

  const ids = Array.from(new Set(apRows.map((r) => r.atualizado_por).filter(Boolean))) as string[];
  const { data: nomes } = ids.length ? await supabase.rpc("nomes_perfis", { uids: ids }) : { data: [] as { id: string; nome_completo: string }[] };
  const nomePorId = new Map(((nomes ?? []) as { id: string; nome_completo: string }[]).map((n) => [n.id, n.nome_completo]));

  const apontamentos: Apontamento[] = apRows.map((r) => ({
    alvo: (r.local_id ?? r.sistema_item_id) as string,
    servico_id: r.servico_id,
    status: r.status,
    observacao: r.observacao,
    por: r.atualizado_por ? nomePorId.get(r.atualizado_por) ?? null : null,
    em: r.atualizado_em,
  }));

  return {
    obras,
    obra,
    fases: (fases ?? []) as any,
    categorias: (categorias ?? []) as any,
    servicos: (servicos ?? []) as any,
    vinculos: vinculos.map((v) => ({ ...v, peso: Number(v.peso) })),
    pavimentos: (pavimentos ?? []) as any,
    locais: locais as any,
    sistemas: (sistemas ?? []) as any,
    itens: itens as any,
    apontamentos,
    usuario: { id: user!.id, nome: perfil?.nome_completo ?? "Você", setor: perfil?.setor ?? "" },
  };
}
