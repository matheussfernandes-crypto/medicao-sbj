import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/getCurrentUserProfile";
import { assinarImagens } from "@/lib/especificacoes/imagem";
import { GRUPOS, GRUPOS_ARQ, fold, type Grupo } from "@/lib/especificacoes/regras";
import BarraImprimir from "../BarraImprimir";
import { CapaIndice, FolhaEspecificacao, cssFolha } from "../../folha";

export const dynamic = "force-dynamic";

type Props = { params: { id: string }; searchParams: { grupos?: string } };

// PDF único com várias listas do mesmo projeto: capa com índice e cada lista começando numa página nova. Sempre A3 paisagem.
async function carregar({ params, searchParams }: Props) {
  const user = await getUsuarioAtual();
  if (!user) redirect("/login");
  const supabase = createClient();
  const pedidos = (searchParams.grupos || "").split(",").filter((g) => GRUPOS_ARQ.some((x) => x.id === g)) as Grupo[];
  const [{ data: projeto }, { data: itens }, { data: notas }] = await Promise.all([
    supabase.from("esp_projetos").select("id, codigo, titulo, cliente, tipo, ambientes, obra:cadastro_obras(nome)").eq("id", params.id).maybeSingle(),
    supabase.from("esp_itens").select("id, grupo, ambiente, material, referencia, medidas, qtd, img, ordem, vidro, campos").eq("projeto_id", params.id).order("ordem"),
    supabase.from("esp_notas").select("grupo, obs, rev").eq("projeto_id", params.id),
  ]);
  if (!projeto) return null;
  const todos = itens ?? [];
  // sem escolha: todas as listas que têm item, na ordem das abas
  const grupos = (pedidos.length ? GRUPOS_ARQ.filter((g) => pedidos.includes(g.id)) : GRUPOS_ARQ.filter((g) => todos.some((i) => i.grupo === g.id))).map((g) => g.id);
  const predio = (projeto.obra as any)?.nome as string | undefined;
  const lazer = projeto.tipo === "lazer";
  const nomeProj = lazer ? `LAZER ${predio ?? ""}`.trim() : projeto.titulo;
  const arquivo = ["ESPECIFICAÇÃO", "LISTAS", nomeProj].filter(Boolean).join(" - ").toUpperCase().replace(/[\\/:*?"<>|]/g, "");
  return { supabase, projeto, itens: todos, notas: notas ?? [], grupos, predio, lazer, arquivo };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const d = await carregar(props);
  return { title: d ? d.arquivo : "Especificações" };
}

export default async function ImprimirVariasListas(props: Props) {
  const d = await carregar(props);
  if (!d) notFound();
  const { projeto, itens, notas, grupos, predio, lazer, arquivo } = d;
  const usados = itens.filter((i) => grupos.includes(i.grupo as Grupo));
  const assinadas = await assinarImagens(d.supabase, usados.map((i) => i.img));
  const nomeProj = (projeto.titulo || "").replace(/^\s*\d{4}-\d+\s*[—-]\s*/, "");
  const sub = lazer ? ["Lazer", predio].filter(Boolean).join(" · ") : [projeto.codigo, predio, nomeProj, projeto.cliente].filter(Boolean).join(" · ");
  const linhas = grupos.map((g) => {
    const meus = usados.filter((i) => i.grupo === g);
    return {
      lista: GRUPOS.find((x) => x.id === g)!.label,
      ambientes: new Set(meus.map((i) => fold(i.ambiente).trim())).size,
      itens: meus.length,
      rev: (notas.find((n) => n.grupo === g)?.rev || "R0").toUpperCase(),
    };
  });

  return (
    <div className="fg">
      <style>{cssFolha(true)}</style>
      <BarraImprimir arquivo={arquivo} papel="A3 paisagem" registro={{ projeto_id: projeto.id, grupo: "varias" }} />
      <CapaIndice sub={sub} linhas={linhas} rodape={arquivo} />
      {grupos.map((g) => {
        const nota = notas.find((n) => n.grupo === g);
        return (
          <FolhaEspecificacao
            key={g}
            quebra
            grupo={g}
            sub={sub}
            rev={(nota?.rev || "R0").toUpperCase()}
            obs={nota?.obs}
            itens={usados.filter((i) => i.grupo === g)}
            assinadas={assinadas}
            ambientesVazios={lazer ? projeto.ambientes ?? [] : []}
            rodape={arquivo}
          />
        );
      })}
    </div>
  );
}
