import { exigirArquiteturaPagina } from "../acesso";
import ListaProjetos, { type ProjetoResumo } from "./ListaProjetos";

export const dynamic = "force-dynamic";

// Obras › Arquitetura › Especificações: lista dos projetos (unidades dos clientes da arquitetura).
export default async function EspecificacoesPage() {
  const supabase = await exigirArquiteturaPagina();
  const [{ data: projetos }, { data: itens }] = await Promise.all([
    supabase.from("esp_projetos").select("id, codigo, titulo, cliente, atualizado_em").order("codigo", { ascending: false, nullsFirst: false }),
    supabase.from("esp_itens").select("projeto_id, grupo"),
  ]);
  const conta: Record<string, Record<string, number>> = {};
  for (const i of itens ?? []) {
    const c = (conta[i.projeto_id] ??= {});
    c[i.grupo] = (c[i.grupo] ?? 0) + 1;
  }
  const lista: ProjetoResumo[] = (projetos ?? []).map((p) => ({ ...p, qtd: conta[p.id] ?? {} }));
  return <ListaProjetos projetos={lista} />;
}
