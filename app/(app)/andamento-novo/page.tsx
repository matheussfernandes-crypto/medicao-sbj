import { carregarAndamento } from "./dados";
import AndamentoClient from "./AndamentoClient";

export default async function AndamentoNovoPage({ searchParams }: { searchParams: { obra?: string } }) {
  const dados = await carregarAndamento(searchParams.obra);
  if (!dados) return <div className="card text-sm text-ink-500">Nenhuma obra cadastrada.</div>;
  return <AndamentoClient key={dados.obra.id} dados={dados} />;
}