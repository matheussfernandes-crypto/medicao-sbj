import { createClient } from "@/lib/supabase/server";
import HistoricoNovoClient, { type LinhaHistorico } from "./HistoricoNovoClient";
import ObraSelect from "../ObraSelect";
import { listarObrasAndamento } from "../obrasAndamento";

const ST = ["Não iniciado", "Andamento", "Finalizado", "Ausência"];

export default async function HistoricoNovoPage({ searchParams }: { searchParams: { obra?: string } }) {
  const supabase = createClient();
  const obras = await listarObrasAndamento(supabase);
  const obra = (obras ?? []).find((o) => o.id === searchParams.obra) ?? (obras ?? [])[0];
  if (!obra) return <div className="card text-sm text-ink-500">Nenhuma obra cadastrada.</div>;

  const { data: h } = await supabase
    .from("an_historico")
    .select("id, local_id, sistema_item_id, servico_id, tipo, de, para, observacao, autor_id, criado_em")
    .eq("obra_id", obra.id)
    .order("criado_em", { ascending: false })
    .limit(1500);
  const rows = h ?? [];

  const localIds = Array.from(new Set(rows.map((r) => r.local_id).filter(Boolean))) as string[];
  const itemIds = Array.from(new Set(rows.map((r) => r.sistema_item_id).filter(Boolean))) as string[];
  const servIds = Array.from(new Set(rows.map((r) => r.servico_id).filter(Boolean))) as string[];
  const autorIds = Array.from(new Set(rows.map((r) => r.autor_id).filter(Boolean))) as string[];

  // consultas em lotes (a lista de ids vai na URL)
  async function emLotes<T>(ids: string[], buscar: (parte: string[]) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
    const r: T[] = [];
    for (let i = 0; i < ids.length; i += 100) r.push(...(((await buscar(ids.slice(i, i + 100))).data ?? []) as T[]));
    return r;
  }
  const [locais, itens, servs] = await Promise.all([
    emLotes<any>(localIds, (p) => supabase.from("an_local").select("id, nome, pavimento_id").in("id", p)),
    emLotes<any>(itemIds, (p) => supabase.from("an_sistema_item").select("id, nome, sistema_id").in("id", p)),
    emLotes<any>(servIds, (p) => supabase.from("an_servico").select("id, nome").in("id", p)),
  ]);
  const { data: nomes } = autorIds.length ? await supabase.rpc("nomes_perfis", { uids: autorIds }) : { data: [] as any[] };
  const pavIds = Array.from(new Set(locais.map((l: any) => l.pavimento_id)));
  const sisIds = Array.from(new Set(itens.map((i: any) => i.sistema_id)));
  const [pavs, sis] = await Promise.all([
    emLotes<any>(pavIds, (p) => supabase.from("an_pavimento").select("id, nome").in("id", p)),
    emLotes<any>(sisIds, (p) => supabase.from("an_sistema").select("id, nome").in("id", p)),
  ]);
  const pavNome = new Map(pavs.map((p: any) => [p.id, p.nome]));
  const sisNome = new Map(sis.map((p: any) => [p.id, p.nome]));
  const localPor = new Map(locais.map((l: any) => [l.id, l]));
  const itemPor = new Map(itens.map((i: any) => [i.id, i]));
  const servNome = new Map(servs.map((s: any) => [s.id, s.nome]));
  const autorNome = new Map(((nomes ?? []) as { id: string; nome_completo: string }[]).map((n) => [n.id, n.nome_completo]));

  const linhas: LinhaHistorico[] = rows.map((r) => {
    const l: any = r.local_id ? localPor.get(r.local_id) : null;
    const i: any = r.sistema_item_id ? itemPor.get(r.sistema_item_id) : null;
    return {
      id: r.id,
      quando: r.criado_em,
      autor: r.autor_id ? autorNome.get(r.autor_id) ?? "" : "",
      onde: l ? pavNome.get(l.pavimento_id) ?? "" : i ? sisNome.get(i.sistema_id) ?? "" : "",
      local: l?.nome ?? i?.nome ?? "(removido)",
      servico: r.servico_id ? servNome.get(r.servico_id) ?? "" : "",
      tipo: r.tipo === "STATUS" ? "Status" : "Observação",
      de: r.de == null ? "" : ST[r.de],
      para: r.para == null ? "" : ST[r.para],
      observacao: r.observacao ?? "",
    };
  });

  return (
    <div className="space-y-3">
      <ObraSelect obras={obras ?? []} atual={obra.id} />
      <HistoricoNovoClient obraNome={obra.nome} linhas={linhas} />
    </div>
  );
}
