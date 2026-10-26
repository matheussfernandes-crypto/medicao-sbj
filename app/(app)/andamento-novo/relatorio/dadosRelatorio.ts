import { createClient } from "@/lib/supabase/server";
import { carregarAndamento } from "../dados";
import type { Predefinicao } from "./predefinicoes";
import { FOTOS_VAZIAS, type Filtros, type Formato, type FotoRel, type FotosSel, type Montagem, type MontagemDados, type MontagemSalva } from "./modelo";

const fmtData = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

// Tudo que a tela do relatório (e a página de PDF) precisa de uma obra: dados do andamento, predefinições, montagens salvas e fotos.
export async function carregarRelatorio(obraPedida?: string) {
  const dados = await carregarAndamento(obraPedida);
  if (!dados) return null;

  const supabase = createClient();
  const obraId = dados.obra.id;
  const [{ data: rows }, { data: mrows }, { data: cfg }, { data: frows }] = await Promise.all([
    supabase.from("an_predefinicao").select("id, nome, filtros, formatacao, montagem").eq("obra_id", obraId).order("criado_em"),
    supabase.from("an_montagem").select("id, nome, dados").eq("obra_id", obraId).order("criado_em"),
    supabase.from("an_relatorio_cfg").select("fotos").eq("obra_id", obraId).maybeSingle(),
    dados.obra.obra_geral_id
      ? supabase.from("obra_fotos").select("id, data_foto, legenda, storage_path").eq("obra_id", dados.obra.obra_geral_id).order("data_foto", { ascending: false }).order("criado_em", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
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
  const caminhos = (frows ?? []).map((f: any) => f.storage_path);
  const { data: assinadas } = caminhos.length ? await supabase.storage.from("obra-fotos").createSignedUrls(caminhos, 3600) : { data: [] as { path: string | null; signedUrl: string }[] };
  const url = new Map((assinadas ?? []).map((a) => [a.path, a.signedUrl]));
  const fotos: FotoRel[] = (frows ?? [])
    .filter((f: any) => url.get(f.storage_path))
    .map((f: any) => ({ id: f.id, url: url.get(f.storage_path)!, legenda: f.legenda ?? "", data: fmtData(f.data_foto) }));

  return { dados, salvas, montagens, fotos, fotosCfg };
}
