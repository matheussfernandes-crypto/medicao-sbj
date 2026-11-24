import { listarUnidadesSbj, rotuloUnidadeSbj } from "@/lib/especificacoes/unidades";
import { listarPredios } from "@/lib/especificacoes/predios";
import { exigirArquiteturaPagina } from "../acesso";
import ListaProjetos, { type ProjetoResumo } from "./ListaProjetos";

export const dynamic = "force-dynamic";

// Obras › Arquitetura › Especificações: projetos separados por prédio (cadastro de obras), cada prédio com seu lazer.
export default async function EspecificacoesPage() {
  const supabase = await exigirArquiteturaPagina();
  const [{ data: projetos }, { data: itens }, unidades, predios] = await Promise.all([
    supabase.from("esp_projetos").select("id, codigo, titulo, cliente, unidade_id, obra_id, tipo, ambientes, atualizado_em").order("codigo", { ascending: false, nullsFirst: false }),
    supabase.from("esp_itens").select("projeto_id, grupo"),
    listarUnidadesSbj(supabase),
    listarPredios(supabase),
  ]);
  const conta: Record<string, Record<string, number>> = {};
  for (const i of itens ?? []) {
    const c = (conta[i.projeto_id] ??= {});
    c[i.grupo] = (c[i.grupo] ?? 0) + 1;
  }
  const porId = new Map(unidades.map((u) => [u.id, u]));
  const lista: ProjetoResumo[] = (projetos ?? []).map((p) => {
    const u = p.unidade_id ? porId.get(p.unidade_id) : null;
    return { ...p, qtd: conta[p.id] ?? {}, unidade: u ? rotuloUnidadeSbj(u) : null };
  });
  return <ListaProjetos projetos={lista} unidades={unidades} predios={predios} />;
}
