import { createClient } from "@/lib/supabase/server";
import { carregarAndamento } from "../dados";
import ObraSelect from "../ObraSelect";
import RelatorioClient from "./RelatorioClient";
import type { Predefinicao } from "./predefinicoes";
import { FOTOS_VAZIAS, type Filtros, type Formato, type FotoRel, type FotosSel, type Montagem, type MontagemDados, type MontagemSalva } from "./modelo";

const fmtData = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

export default async function RelatorioNovoPage({ searchParams }: { searchParams: { obra?: string } }) {
  const dados = await carregarAndamento(searchParams.obra);
  if (!dados) return <div className="card text-sm text-ink-500">Nenhuma obra cadastrada.</div>;

  const supabase = createClient();
  const obraId = dados.obra.id;
  const [{ data: rows }, { data: mrows }, { data: cfg }, { data: frows }] = await Promise.all([
    supabase.from("an_predefinicao").select("id, nome, filtros, formatacao, montagem").eq("obra_id", obraId).order("criado_em"),
    supabase.from("an_montagem").select("id, nome, dados").eq("obra_id", obraId).order("criado_em"),
    supabase.from("an_relatorio_cfg").select("fotos").eq("obra_id", obraId).maybeSingle(),
    supabase.from("obra_fotos").select("id, data_foto, legenda, storage_path").eq("obra_id", obraId).order("data_foto", { ascending: false }).order("criado_em", { ascending: false }),
  ]);

  const salvas: Predefinicao[] = (rows ?? []).map((r: any) => ({
    id: r.id,
    nome: r.nome,
    filtros: r.filtros as Filtros,
    formato: r.formatacao as Partial<Formato>,
    montagem: r.montagem as Partial<Montagem>,
  }));
  const montagens: MontagemSalva[] = (mrows ?? []).map((m: any) => ({ id: m.id, nome: m.nome, dados: m.dados as MontagemDados }));
  const fotosCfg: FotosSel = { ...FOTOS_VAZIAS, ...((cfg?.fotos as Partial<FotosSel>) ?? {}) };

  // fotos da aba Fotos (mesma tabela obra_fotos), com endereço temporário para a tela e o PDF
  const caminhos = (frows ?? []).map((f) => f.storage_path);
  const { data: assinadas } = caminhos.length ? await supabase.storage.from("obra-fotos").createSignedUrls(caminhos, 3600) : { data: [] as { path: string | null; signedUrl: string }[] };
  const url = new Map((assinadas ?? []).map((a) => [a.path, a.signedUrl]));
  const fotos: FotoRel[] = (frows ?? [])
    .filter((f) => url.get(f.storage_path))
    .map((f) => ({ id: f.id, url: url.get(f.storage_path)!, legenda: f.legenda ?? "", data: fmtData(f.data_foto) }));

  return (
    <div className="space-y-3">
      <div className="print:hidden">
        <ObraSelect obras={dados.obras.map((o) => ({ id: o.id, nome: o.nome }))} atual={obraId} />
      </div>
      <RelatorioClient key={obraId} dados={dados} salvas={salvas} montagensIniciais={montagens} fotos={fotos} fotosIniciais={fotosCfg} />
    </div>
  );
}
