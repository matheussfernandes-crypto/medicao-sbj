import { createClient } from "@/lib/supabase/server";
import { carregarAndamento } from "../dados";
import ObraSelect from "../ObraSelect";
import RelatorioClient from "./RelatorioClient";
import type { Predefinicao } from "./predefinicoes";
import type { Filtros, Formato, Montagem } from "./modelo";

export default async function RelatorioNovoPage({ searchParams }: { searchParams: { obra?: string } }) {
  const dados = await carregarAndamento(searchParams.obra);
  if (!dados) return <div className="card text-sm text-ink-500">Nenhuma obra cadastrada.</div>;

  const supabase = createClient();
  const { data: rows } = await supabase.from("an_predefinicao").select("id, nome, filtros, formatacao, montagem").eq("obra_id", dados.obra.id).order("criado_em");
  const salvas: Predefinicao[] = (rows ?? []).map((r: any) => ({
    id: r.id,
    nome: r.nome,
    filtros: r.filtros as Filtros,
    formato: r.formatacao as Partial<Formato>,
    montagem: r.montagem as Partial<Montagem>,
  }));

  return (
    <div className="space-y-3">
      <div className="print:hidden">
        <ObraSelect obras={dados.obras.map((o) => ({ id: o.id, nome: o.nome }))} atual={dados.obra.id} />
      </div>
      <RelatorioClient key={dados.obra.id} dados={dados} salvas={salvas} />
    </div>
  );
}
