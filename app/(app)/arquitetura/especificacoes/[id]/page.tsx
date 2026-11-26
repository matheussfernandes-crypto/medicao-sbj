import { notFound } from "next/navigation";
import { assinarImagens } from "@/lib/especificacoes/imagem";
import { ehGrupoArq } from "@/lib/especificacoes/regras";
import { rotuloUnidadeSbj, unidadeSbj } from "@/lib/especificacoes/unidades";
import { exigirArquiteturaPagina } from "../../acesso";
import EditorProjeto, { type Item, type Nota } from "./EditorProjeto";
import type { Modelo } from "../../comum";
import HistoricoPdfs, { type PdfGerado } from "../HistoricoPdfs";

export const dynamic = "force-dynamic";

export default async function ProjetoPage({ params, searchParams }: { params: { id: string }; searchParams: { grupo?: string } }) {
  const supabase = await exigirArquiteturaPagina();
  const [{ data: projeto }, { data: itens }, { data: notas }, { data: modelos }] = await Promise.all([
    supabase.from("esp_projetos").select("id, codigo, titulo, cliente, unidade_id, obra_id, tipo, ambientes, obra:cadastro_obras(nome)").eq("id", params.id).maybeSingle(),
    supabase.from("esp_itens").select("id, grupo, ambiente, material, referencia, medidas, qtd, img, ordem, vidro, campos").eq("projeto_id", params.id).order("ordem"),
    supabase.from("esp_notas").select("grupo, obs, rev, papel").eq("projeto_id", params.id),
    supabase.from("esp_modelos").select("id, grupo, material, referencia, medidas, marca, linha, acab, codigo, faixa, uso, valor_ref, img, revisar, ordem").order("ordem"),
  ]);
  if (!projeto) notFound();
  const [assinadas, uni, { data: pdfs }] = await Promise.all([
    assinarImagens(supabase, [...(itens ?? []), ...(modelos ?? [])].map((x) => x.img)),
    unidadeSbj(supabase, projeto.unidade_id),
    supabase.from("esp_pdfs").select("id, arquivo, rev, papel, gerado_por_nome, gerado_em").eq("projeto_id", params.id).order("gerado_em", { ascending: false }).limit(200),
  ]);
  return (
    <div className="space-y-4">
    <EditorProjeto
      projeto={{
        id: projeto.id, codigo: projeto.codigo, titulo: projeto.titulo, cliente: projeto.cliente, unidade: uni ? rotuloUnidadeSbj(uni) : null,
        obraId: projeto.obra_id, predio: (projeto.obra as any)?.nome ?? null, lazer: projeto.tipo === "lazer", ambientesLazer: projeto.ambientes ?? [],
      }}
      itens={(itens ?? []).map((i) => ({ ...i, ordem: Number(i.ordem) })) as Item[]}
      notas={(notas ?? []) as Nota[]}
      modelos={(modelos ?? []) as Modelo[]}
      assinadas={assinadas}
      grupoInicial={ehGrupoArq(searchParams.grupo) ? searchParams.grupo : "metais"}
    />
    <HistoricoPdfs lista={(pdfs ?? []) as PdfGerado[]} />
    </div>
  );
}
