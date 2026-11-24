import { notFound } from "next/navigation";
import { assinarImagens } from "@/lib/especificacoes/imagem";
import { ehGrupo } from "@/lib/especificacoes/regras";
import { ordemProjeto } from "@/lib/especificacoes/predios";
import { exigirArquiteturaPagina } from "../../../acesso";
import VistaPredio, { type ItemPredio, type ProjetoPredio } from "./VistaPredio";

export const dynamic = "force-dynamic";

// Especificações de um prédio inteiro: todas as unidades e o lazer, por grupo (louças e metais, eletros, vidros).
export default async function PredioPage({ params, searchParams }: { params: { obraId: string }; searchParams: { grupo?: string; lazer?: string } }) {
  const supabase = await exigirArquiteturaPagina();
  const [{ data: obra }, { data: projetos }] = await Promise.all([
    supabase.from("cadastro_obras").select("id, nome, fase").eq("id", params.obraId).maybeSingle(),
    supabase.from("esp_projetos").select("id, codigo, titulo, cliente, tipo, ambientes").eq("obra_id", params.obraId),
  ]);
  if (!obra) notFound();
  const ids = (projetos ?? []).map((p) => p.id);
  const { data: itens } = ids.length
    ? await supabase.from("esp_itens").select("id, projeto_id, grupo, ambiente, material, referencia, medidas, qtd, img, ordem, vidro").in("projeto_id", ids).order("ordem")
    : { data: [] as ItemPredio[] };
  const assinadas = await assinarImagens(supabase, (itens ?? []).map((i) => i.img));
  return (
    <VistaPredio
      predio={obra}
      projetos={((projetos ?? []) as ProjetoPredio[]).sort(ordemProjeto)}
      itens={(itens ?? []) as ItemPredio[]}
      assinadas={assinadas}
      grupoInicial={ehGrupo(searchParams.grupo) ? searchParams.grupo : "metais"}
      abrirLazer={searchParams.lazer === "1"}
    />
  );
}
