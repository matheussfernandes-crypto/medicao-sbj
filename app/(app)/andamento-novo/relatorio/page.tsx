import ObraSelect from "../ObraSelect";
import RelatorioClient from "./RelatorioClient";
import { carregarRelatorio } from "./dadosRelatorio";

export default async function RelatorioNovoPage({ searchParams }: { searchParams: { obra?: string } }) {
  const r = await carregarRelatorio(searchParams.obra);
  if (!r) return <div className="card text-sm text-ink-500">Nenhuma obra cadastrada no Andamento de Obra (novo).</div>;
  const { dados, salvas, montagens, fotos, fotosCfg } = r;
  return (
    <div className="space-y-3">
      <div className="print:hidden">
        <ObraSelect obras={dados.obras.map((o) => ({ id: o.id, nome: o.nome }))} atual={dados.obra.id} />
      </div>
      <RelatorioClient key={dados.obra.id} dados={dados} salvas={salvas} montagensIniciais={montagens} fotos={fotos} fotosIniciais={fotosCfg} />
    </div>
  );
}
