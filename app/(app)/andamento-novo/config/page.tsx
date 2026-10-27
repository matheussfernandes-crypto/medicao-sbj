import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConfigNovoClient from "../ConfigNovoClient";
import { carregarAndamento } from "../dados";
import { mapaApontamentos, montarIndice, pct } from "../calculo";
import { alvosDeItens, alvosDeLocais, montarFatias, somaRecorte } from "../fatias";
import { listarObrasAndamento, listarObrasExcluidas } from "../obrasAndamento";
import type { DadosConfig } from "../types";

export default async function AndamentoNovoPage({ searchParams }: { searchParams: { obra?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Configuração: ADM ou quem tem a permissão específica da tela nova (ex.: Cauê).
  const { data: pode } = await supabase.rpc("an_pode_configurar", { uid: user!.id });
  if (!pode) redirect("/andamento-novo");

  // quem passou de 30 dias na lista de excluídas é apagado de vez (só dados do módulo)
  await supabase.rpc("an_purgar_obras_excluidas");
  const obras = await listarObrasAndamento(supabase);
  const excluidas = await listarObrasExcluidas(supabase);
  // obras do cadastro geral que ainda não estão no Andamento novo (só leitura: serve para LIGAR, nunca para alterar)
  const { data: geraisRows } = await supabase.from("obras").select("id, nome").order("nome");
  const { data: ligadasRows } = await supabase.from("andamento_novo_obras").select("obra_id").not("obra_id", "is", null).is("excluida_em", null);
  const ligadas = new Set((ligadasRows ?? []).map((r: any) => r.obra_id));
  const obrasGerais = ((geraisRows ?? []) as { id: string; nome: string }[]).filter((o) => !ligadas.has(o.id));
  const obra = obras.find((o) => o.id === searchParams.obra) ?? obras[0];
  if (!obra) return <div className="card text-sm text-ink-500">Nenhuma obra cadastrada no Andamento de Obra (novo).</div>;

  // situação desta obra frente à versão atual do Modelo padrão (o modelo só chega nas obras quando alguém aplica)
  const { data: dif } = await supabase.rpc("an_modelo_diferencas", { p_obra: obra.id });
  const { data: versoesRows } = await supabase.from("an_modelo_versao").select("id, numero, criado_em, criado_por_nome, obra_origem_nome, resumo").order("numero", { ascending: false }).limit(30);
  const { data: aplicRows } = await supabase
    .from("an_aplicacao_log")
    .select("id, criado_em, por_nome, versao_numero, obra_id, obra_nome, resumo, opcoes, desfeita_em")
    .order("criado_em", { ascending: false })
    .limit(60);
  const { data: infoObras } = await supabase.rpc("an_info_obras_modelo");
  const [{ data: fases }, { data: categorias }, { data: servicos }, { data: pavimentos }, { data: sistemas }, { data: contagensRows }, andamento] =
    await Promise.all([
      supabase.from("an_fase").select("id, nome, ordem").eq("obra_id", obra.id).order("ordem"),
      supabase.from("an_categoria").select("id, chave, nome, cor, ordem").eq("obra_id", obra.id).order("ordem"),
      supabase
        .from("an_servico")
        .select("id, nome, grupo, fase_id, vale_pavimento_inteiro, ordem, fatia")
        .eq("obra_id", obra.id)
        .eq("arquivado", false)
        .order("ordem"),
      supabase.from("an_pavimento").select("id, nome, ordem").eq("obra_id", obra.id).order("ordem"),
      supabase.from("an_sistema").select("id, nome, tipo, ordem, fatia, config").eq("obra_id", obra.id).order("ordem"),
      supabase.rpc("an_contagens"),
      carregarAndamento(obra.id),
    ]);

  const catIds = (categorias ?? []).map((c) => c.id);
  const pavIds = (pavimentos ?? []).map((p) => p.id);
  const sisIds = (sistemas ?? []).map((s) => s.id);
  const [{ data: vinculos }, { data: locais }, { data: itens }] = await Promise.all([
    catIds.length
      ? supabase.from("an_categoria_servico").select("categoria_id, servico_id, peso, peso_fixo").in("categoria_id", catIds)
      : Promise.resolve({ data: [] as any[] }),
    pavIds.length
      ? supabase.from("an_local").select("id, pavimento_id, nome, categoria_id, ordem").in("pavimento_id", pavIds).order("ordem")
      : Promise.resolve({ data: [] as any[] }),
    sisIds.length
      ? supabase.from("an_sistema_item").select("id, sistema_id, nome, categoria_id, ordem, servico_id").in("sistema_id", sisIds).order("ordem")
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const contagens: Record<string, Record<string, number>> = {};
  for (const r of (contagensRows ?? []) as { obra_id: string | null; chave: string; n: number }[]) {
    const k = r.obra_id ?? "modelo";
    (contagens[k] ??= {})[r.chave] = r.n;
  }

  // % pelas fatias da obra (mesma conta das telas de andamento e do relatório)
  const percentuais: DadosConfig["percentuais"] = [];
  if (andamento) {
    const idx = montarIndice(andamento.categorias, andamento.servicos, andamento.vinculos);
    const fat = montarFatias(andamento);
    const ap = mapaApontamentos(andamento.apontamentos);
    const rec = (ls: typeof andamento.locais, is: typeof andamento.itens) => pct(somaRecorte(fat, idx, ap, [...alvosDeLocais(ls), ...alvosDeItens(is)]));
    percentuais.push({ nivel: "obra", ref_id: null, pct: rec(andamento.locais, andamento.itens) });
    andamento.pavimentos.forEach((p) => percentuais.push({ nivel: "pavimento", ref_id: p.id, pct: rec(andamento.locais.filter((l) => l.pavimento_id === p.id), []) }));
    andamento.sistemas.forEach((s) => percentuais.push({ nivel: "sistema", ref_id: s.id, pct: rec([], andamento.itens.filter((i) => i.sistema_id === s.id)) }));
  }

  const dados: DadosConfig = {
    obras,
    obra,
    fases: (fases ?? []) as any,
    categorias: (categorias ?? []) as any,
    servicos: ((servicos ?? []) as any[]).map((s) => ({ ...s, fatia: Number(s.fatia ?? 0) })),
    vinculos: ((vinculos ?? []) as any[]).map((v) => ({ ...v, peso: Number(v.peso) })),
    pavimentos: (pavimentos ?? []) as any,
    locais: (locais ?? []) as any,
    sistemas: ((sistemas ?? []) as any[]).map((s) => ({ ...s, fatia: Number(s.fatia ?? 0) })),
    itens: (itens ?? []) as any,
    percentuais,
    contagens,
    excluidas,
    obrasGerais,
    modelo: ((dif as any) ?? { tem_modelo: false }) as DadosConfig["modelo"],
    versoes: (versoesRows ?? []) as any,
    aplicacoes: (aplicRows ?? []) as any,
    infoObras: ((infoObras as any) ?? []) as DadosConfig["infoObras"],
  };

  return (
    <div className="space-y-4">
      <ConfigNovoClient key={obra.id} dados={dados} />
    </div>
  );
}
