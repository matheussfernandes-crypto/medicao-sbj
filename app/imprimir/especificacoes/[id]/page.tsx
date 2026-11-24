import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/getCurrentUserProfile";
import { assinarImagens } from "@/lib/especificacoes/imagem";
import { GRUPOS, ehGrupo, type Grupo } from "@/lib/especificacoes/regras";
import BarraImprimir from "./BarraImprimir";
import { FolhaEspecificacao, cssFolha } from "../folha";

export const dynamic = "force-dynamic";

type Props = { params: { id: string }; searchParams: { grupo?: string } };

async function carregar({ params, searchParams }: Props) {
  const user = await getUsuarioAtual();
  if (!user) redirect("/login");
  const supabase = createClient();
  const grupo: Grupo = ehGrupo(searchParams.grupo) ? searchParams.grupo : "metais";
  const [{ data: projeto }, { data: itens }, { data: nota }] = await Promise.all([
    supabase.from("esp_projetos").select("id, codigo, titulo, cliente, tipo, ambientes, obra:cadastro_obras(nome)").eq("id", params.id).maybeSingle(),
    supabase.from("esp_itens").select("id, ambiente, material, referencia, medidas, qtd, img, ordem, vidro").eq("projeto_id", params.id).eq("grupo", grupo).order("ordem"),
    supabase.from("esp_notas").select("obs, rev, papel").eq("projeto_id", params.id).eq("grupo", grupo).maybeSingle(),
  ]);
  if (!projeto) return null;
  const g = GRUPOS.find((x) => x.id === grupo)!;
  const rev = (nota?.rev || "R0").toUpperCase();
  const predio = (projeto.obra as any)?.nome as string | undefined;
  const lazer = projeto.tipo === "lazer";
  const nomeProj = lazer ? `LAZER ${predio ?? ""}`.trim() : projeto.titulo;
  // nome do arquivo no padrão SBJ: ESPECIFICAÇÃO - LOUÇAS E METAIS - 701 CAMPECHE - R0
  const arquivo = ["ESPECIFICAÇÃO", g.label, nomeProj, rev].filter(Boolean).join(" - ").toUpperCase().replace(/[\\/:*?"<>|]/g, "");
  return { supabase, projeto, itens: itens ?? [], nota, grupo, rev, arquivo, predio, lazer };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const d = await carregar(props);
  return { title: d ? d.arquivo : "Especificações" };
}

// Folha de especificação no padrão dos PDFs da SBJ: abre e chama a impressão; "Salvar como PDF" gera o arquivo.
export default async function ImprimirEspecificacao(props: Props) {
  const d = await carregar(props);
  if (!d) notFound();
  const { projeto, itens, nota, grupo, rev, arquivo, predio, lazer } = d;
  const assinadas = await assinarImagens(d.supabase, itens.map((i) => i.img));
  const a3 = (nota?.papel ?? "a3p") !== "a4p";
  const nomeProj = (projeto.titulo || "").replace(/^\s*\d{4}-\d+\s*[—-]\s*/, "");
  const sub = lazer
    ? ["Lazer", predio].filter(Boolean).join(" · ")
    : [projeto.codigo, predio, nomeProj, projeto.cliente].filter(Boolean).join(" · ");

  return (
    <div className="fg">
      <style>{cssFolha(a3)}</style>
      <BarraImprimir arquivo={arquivo} papel={a3 ? "A3 paisagem" : "A4 paisagem"} registro={{ projeto_id: projeto.id, grupo, rev }} />
      <FolhaEspecificacao
        grupo={grupo}
        sub={sub}
        rev={rev}
        obs={nota?.obs}
        itens={itens}
        assinadas={assinadas}
        ambientesVazios={lazer ? projeto.ambientes ?? [] : []}
        rodape={arquivo}
      />
    </div>
  );
}
