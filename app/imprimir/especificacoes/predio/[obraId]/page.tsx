import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth/getCurrentUserProfile";
import { assinarImagens } from "@/lib/especificacoes/imagem";
import { GRUPOS, ehGrupo, type Grupo } from "@/lib/especificacoes/regras";
import { ordemProjeto } from "@/lib/especificacoes/predios";
import BarraImprimir from "../../[id]/BarraImprimir";
import { FolhaEspecificacao, cssFolha } from "../../folha";

export const dynamic = "force-dynamic";

type Props = { params: { obraId: string }; searchParams: { grupo?: string } };

async function carregar({ params, searchParams }: Props) {
  const user = await getUsuarioAtual();
  if (!user) redirect("/login");
  const supabase = createClient();
  const grupos: Grupo[] = ehGrupo(searchParams.grupo) ? [searchParams.grupo] : GRUPOS.map((g) => g.id);
  const [{ data: obra }, { data: projetos }] = await Promise.all([
    supabase.from("cadastro_obras").select("id, nome").eq("id", params.obraId).maybeSingle(),
    supabase.from("esp_projetos").select("id, codigo, titulo, cliente, tipo, ambientes").eq("obra_id", params.obraId),
  ]);
  if (!obra) return null;
  const ids = (projetos ?? []).map((p) => p.id);
  const [{ data: itens }, { data: notas }] = ids.length
    ? await Promise.all([
        supabase.from("esp_itens").select("id, projeto_id, grupo, ambiente, material, referencia, medidas, qtd, img, ordem, vidro").in("projeto_id", ids).in("grupo", grupos).order("ordem"),
        supabase.from("esp_notas").select("projeto_id, grupo, obs, rev").in("projeto_id", ids),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];
  const parte = grupos.length === 1 ? GRUPOS.find((g) => g.id === grupos[0])!.label : "COMPLETO";
  const arquivo = ["ESPECIFICAÇÃO", obra.nome, parte].join(" - ").toUpperCase().replace(/[\\/:*?"<>|]/g, "");
  return { supabase, obra, projetos: (projetos ?? []).sort(ordemProjeto), itens: itens ?? [], notas: notas ?? [], grupos, arquivo };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const d = await carregar(props);
  return { title: d ? d.arquivo : "Especificações" };
}

// PDF do prédio inteiro, sempre em A3 paisagem com a logo da SBJ: por grupo, uma folha para cada unidade e outra para o lazer.
export default async function ImprimirPredio(props: Props) {
  const d = await carregar(props);
  if (!d) notFound();
  const { obra, projetos, itens, notas, grupos, arquivo } = d;
  const assinadas = await assinarImagens(d.supabase, itens.map((i: any) => i.img));

  const folhas: { chave: string; grupo: Grupo; p: (typeof projetos)[number]; itens: any[] }[] = [];
  for (const g of grupos)
    for (const p of projetos) {
      const meus = itens.filter((i: any) => i.projeto_id === p.id && i.grupo === g);
      if (meus.length) folhas.push({ chave: `${g}-${p.id}`, grupo: g, p, itens: meus });
    }

  return (
    <div className="fg">
      <style>{cssFolha(true)}</style>
      <BarraImprimir arquivo={arquivo} papel="A3 paisagem" />
      {!folhas.length && (
        <div className="folha">
          <p className="sub">Nenhum item especificado neste prédio{grupos.length === 1 ? " neste grupo" : ""}.</p>
        </div>
      )}
      {folhas.map((f, k) => {
        const nota = notas.find((n: any) => n.projeto_id === f.p.id && n.grupo === f.grupo);
        const lazer = f.p.tipo === "lazer";
        const nome = (f.p.titulo || "").replace(/^\s*\d{4}-\d+\s*[—-]\s*/, "");
        const sub = lazer ? [obra.nome, "Lazer"].join(" · ") : [obra.nome, f.p.codigo, nome, f.p.cliente].filter(Boolean).join(" · ");
        return (
          <FolhaEspecificacao
            key={f.chave}
            quebra={k > 0}
            grupo={f.grupo}
            sub={sub}
            rev={(nota?.rev || "R0").toUpperCase()}
            obs={nota?.obs}
            itens={f.itens}
            assinadas={assinadas}
            ambientesVazios={lazer ? f.p.ambientes ?? [] : []}
            rodape={`${arquivo} · ${lazer ? "LAZER" : nome.toUpperCase()}`}
          />
        );
      })}
    </div>
  );
}
