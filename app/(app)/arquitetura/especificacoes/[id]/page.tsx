import { notFound } from "next/navigation";
import { assinarImagens } from "@/lib/especificacoes/imagem";
import { ehGrupo } from "@/lib/especificacoes/regras";
import { rotuloUnidadeSbj, unidadeSbj } from "@/lib/especificacoes/unidades";
import { exigirArquiteturaPagina } from "../../acesso";
import EditorProjeto, { type Item, type Nota } from "./EditorProjeto";
import type { Modelo } from "../../comum";

export const dynamic = "force-dynamic";

export default async function ProjetoPage({ params, searchParams }: { params: { id: string }; searchParams: { grupo?: string } }) {
  const supabase = await exigirArquiteturaPagina();
  const [{ data: projeto }, { data: itens }, { data: notas }, { data: modelos }] = await Promise.all([
    supabase.from("esp_projetos").select("id, codigo, titulo, cliente, unidade_id").eq("id", params.id).maybeSingle(),
    supabase.from("esp_itens").select("id, grupo, ambiente, material, referencia, medidas, qtd, img, ordem, vidro").eq("projeto_id", params.id).order("ordem"),
    supabase.from("esp_notas").select("grupo, obs, rev, papel").eq("projeto_id", params.id),
    supabase.from("esp_modelos").select("id, grupo, material, referencia, medidas, marca, linha, acab, codigo, faixa, uso, valor_ref, img, revisar, ordem").order("ordem"),
  ]);
  if (!projeto) notFound();
  const [assinadas, uni] = await Promise.all([
    assinarImagens(supabase, [...(itens ?? []), ...(modelos ?? [])].map((x) => x.img)),
    unidadeSbj(supabase, projeto.unidade_id),
  ]);
  return (
    <EditorProjeto
      projeto={{ id: projeto.id, codigo: projeto.codigo, titulo: projeto.titulo, cliente: projeto.cliente, unidade: uni ? rotuloUnidadeSbj(uni) : null }}
      itens={(itens ?? []).map((i) => ({ ...i, ordem: Number(i.ordem) })) as Item[]}
      notas={(notas ?? []) as Nota[]}
      modelos={(modelos ?? []) as Modelo[]}
      assinadas={assinadas}
      grupoInicial={ehGrupo(searchParams.grupo) ? searchParams.grupo : "metais"}
    />
  );
}
