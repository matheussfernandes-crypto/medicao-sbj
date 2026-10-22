import { carregarAndamento } from "../dados";
import ObraSelect from "../ObraSelect";
import OtimizadoClient from "./OtimizadoClient";

export default async function RelatorioOtimizadoPage({ searchParams }: { searchParams: { obra?: string } }) {
  const dados = await carregarAndamento(searchParams.obra);
  if (!dados) return <div className="card text-sm text-ink-500">Nenhuma obra cadastrada.</div>;
  return (
    <div className="space-y-3">
      <div className="print:hidden">
        <ObraSelect obras={dados.obras.map((o) => ({ id: o.id, nome: o.nome }))} atual={dados.obra.id} />
      </div>
      <OtimizadoClient key={dados.obra.id} dados={dados} />
    </div>
  );
}
