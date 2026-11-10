import { createClient } from "@/lib/supabase/server";
import { listarObrasAndamento } from "../andamento-novo/obrasAndamento";
import { paginar } from "../andamento-novo/dados";
import { mapaApontamentos, montarIndice, pct } from "../andamento-novo/calculo";
import { alvosDeItens, alvosDeLocais, montarFatias, somaRecorte } from "../andamento-novo/fatias";
import type { Apontamento } from "../andamento-novo/types";

export type ObraPainel = { id: string; nome: string; exibir: boolean };

export type ProgressoObra = {
  obraId: string; // obra do Andamento (novo)
  obraGeralId: string | null; // ligação com o cadastro geral (fotos)
  nome: string;
  pct: number; // % da obra pelas fatias (finalizado + ½ andamento)
  pctFinalizado: number;
  pctAndamento: number;
  pctNaoIniciado: number;
  unidades: number; // locais cadastrados (apartamentos, áreas comuns…)
  grupos: { nome: string; pct: number }[]; // pavimentos e sistemas
  servicos: { nome: string; pct: number }[];
};

export type FotoPainel = { obraId: string; obraNome: string; url: string; dataFoto: string; legenda: string | null };

const pct1 = (v: number) => Math.round(v * 10) / 10;

// Progresso de uma obra do Andamento (novo): mesma conta das telas e do relatório (fatias).
async function progressoDaObra(supabase: ReturnType<typeof createClient>, obra: { id: string; nome: string; obra_geral_id?: string | null }): Promise<ProgressoObra> {
  const [{ data: categorias }, { data: servicos }, { data: pavimentos }, { data: sistemas }] = await Promise.all([
    supabase.from("an_categoria").select("id, chave, nome, cor, ordem").eq("obra_id", obra.id).order("ordem"),
    supabase.from("an_servico").select("id, nome, grupo, fase_id, vale_pavimento_inteiro, ordem, fatia").eq("obra_id", obra.id).eq("arquivado", false).order("ordem"),
    supabase.from("an_pavimento").select("id, nome, ordem").eq("obra_id", obra.id).order("ordem"),
    supabase.from("an_sistema").select("id, nome, tipo, ordem, fatia, config").eq("obra_id", obra.id).order("ordem"),
  ]);
  const catIds = (categorias ?? []).map((c) => c.id);
  const pavIds = (pavimentos ?? []).map((p) => p.id);
  const sisIds = (sistemas ?? []).map((s) => s.id);

  const [vinculos, locais, itens, apRows] = await Promise.all([
    catIds.length
      ? paginar<any>((de, ate) => supabase.from("an_categoria_servico").select("categoria_id, servico_id, peso, peso_fixo").in("categoria_id", catIds).order("categoria_id").order("servico_id").range(de, ate))
      : Promise.resolve([] as any[]),
    pavIds.length
      ? paginar<any>((de, ate) => supabase.from("an_local").select("id, pavimento_id, nome, categoria_id, ordem").in("pavimento_id", pavIds).order("id").range(de, ate))
      : Promise.resolve([] as any[]),
    sisIds.length
      ? paginar<any>((de, ate) => supabase.from("an_sistema_item").select("id, sistema_id, nome, categoria_id, ordem, servico_id").in("sistema_id", sisIds).order("id").range(de, ate))
      : Promise.resolve([] as any[]),
    paginar<any>((de, ate) => supabase.from("an_apontamento").select("local_id, sistema_item_id, servico_id, status").eq("obra_id", obra.id).order("id").range(de, ate)),
  ]);

  const servs = ((servicos ?? []) as any[]).map((s) => ({ ...s, fatia: Number(s.fatia ?? 0) }));
  const sists = ((sistemas ?? []) as any[]).map((s) => ({ ...s, fatia: Number(s.fatia ?? 0) }));
  const vincs = vinculos.map((v) => ({ ...v, peso: Number(v.peso) }));
  const cats = (categorias ?? []) as any[];

  const idx = montarIndice(cats, servs, vincs);
  const fat = montarFatias({ servicos: servs, sistemas: sists, itens, categorias: cats, vinculos: vincs });
  const ap = mapaApontamentos(
    apRows.map((r) => ({ alvo: (r.local_id ?? r.sistema_item_id) as string, servico_id: r.servico_id, status: r.status, observacao: null, por: null, em: null }) as Apontamento)
  );

  const rec = (ls: any[], is: any[], servOk?: (s: any) => boolean) => somaRecorte(fat, idx, ap, [...alvosDeLocais(ls), ...alvosDeItens(is)], servOk);
  const total = rec(locais, itens);
  const base = total.W > 0 ? total.W : total.tot;
  const f = total.W > 0 ? total.F : total.fin;
  const a = total.W > 0 ? total.A : total.and;
  const pctFin = base > 0 ? (f / base) * 100 : 0;
  const pctAnd = base > 0 ? (a / base) * 100 : 0;

  // serviços de maior fatia em destaque (empate: ordem cadastrada)
  const destaque = [...servs]
    .filter((s) => s.fatia > 0)
    .sort((x, y) => y.fatia - x.fatia || x.ordem - y.ordem)
    .slice(0, 8);
  const grupos = [
    ...(pavimentos ?? []).map((p) => ({ nome: p.nome, soma: rec(locais.filter((l) => l.pavimento_id === p.id), []) })),
    ...sists.map((s) => ({ nome: s.nome, soma: rec([], itens.filter((i) => i.sistema_id === s.id)) })),
  ].filter((g) => g.soma.tot > 0 || g.soma.aus > 0);

  return {
    obraId: obra.id,
    obraGeralId: obra.obra_geral_id ?? null,
    nome: obra.nome,
    pct: pct1(pct(total)),
    pctFinalizado: pct1(pctFin),
    pctAndamento: pct1(pctAnd),
    pctNaoIniciado: base > 0 ? pct1(Math.max(0, 100 - pctFin - pctAnd)) : 0,
    unidades: locais.length,
    grupos: grupos.map((g) => ({ nome: g.nome, pct: pct1(pct(g.soma)) })),
    servicos: destaque.map((s) => ({ nome: s.nome, pct: pct1(pct(rec(locais, itens, (sv) => sv.id === s.id))) })),
  };
}

export async function carregarPainelObras() {
  const supabase = createClient();

  // Seletor do ADM (obras do cadastro geral que giram no painel). Obra do Andamento (novo) sem ligação aparece sempre;
  // a que está ligada a uma obra do cadastro geral respeita a escolha feita aqui.
  const { data: obrasRows } = await supabase.from("obras").select("id, nome, exibir_no_painel").order("nome");
  const obras: ObraPainel[] = (obrasRows ?? []).map((o: any) => ({ id: o.id, nome: o.nome, exibir: o.exibir_no_painel !== false }));
  const exibirGeral = new Map(obras.map((o) => [o.id, o.exibir]));

  const obrasNovo = (await listarObrasAndamento(supabase)).filter((o) => !o.obra_geral_id || exibirGeral.get(o.obra_geral_id) !== false);
  if (!obrasNovo.length) return { obras, progresso: [] as ProgressoObra[], fotos: [] as FotoPainel[] };

  const progresso = await Promise.all(obrasNovo.map((o) => progressoDaObra(supabase, o)));

  // Fotos: só a rodada mais recente de cada obra ligada ao cadastro geral (até 4 fotos por obra).
  const idsGerais = obrasNovo.map((o) => o.obra_geral_id).filter(Boolean) as string[];
  const { data: fotosRows } = idsGerais.length
    ? await supabase
        .from("obra_fotos")
        .select("obra_id, data_foto, legenda, storage_path, criado_em")
        .in("obra_id", idsGerais)
        .order("data_foto", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(400)
    : { data: [] as any[] };
  const maisRecentes: any[] = [];
  for (const id of idsGerais) {
    const daObra = (fotosRows ?? []).filter((f: any) => f.obra_id === id);
    if (!daObra.length) continue;
    maisRecentes.push(...daObra.filter((f: any) => f.data_foto === daObra[0].data_foto).slice(0, 4));
  }
  const caminhos = maisRecentes.map((f) => f.storage_path);
  const { data: assinadas } = caminhos.length
    ? await supabase.storage.from("obra-fotos").createSignedUrls(caminhos, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlPorCaminho = new Map((assinadas ?? []).map((x) => [x.path, x.signedUrl]));
  const novoPorGeral = new Map(progresso.map((p) => [p.obraGeralId, p]));
  const fotos: FotoPainel[] = maisRecentes
    .filter((f) => urlPorCaminho.get(f.storage_path) && novoPorGeral.get(f.obra_id))
    .map((f) => ({
      obraId: novoPorGeral.get(f.obra_id)!.obraId,
      obraNome: novoPorGeral.get(f.obra_id)!.nome,
      url: urlPorCaminho.get(f.storage_path)!,
      dataFoto: f.data_foto,
      legenda: f.legenda,
    }));

  return { obras, progresso, fotos };
}
