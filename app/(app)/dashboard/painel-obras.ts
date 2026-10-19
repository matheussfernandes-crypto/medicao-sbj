import { createClient } from "@/lib/supabase/server";
import { buscarStatusDasUnidades } from "../andamento-obra/status-query";

export type ObraPainel = { id: string; nome: string; exibir: boolean };

export type ProgressoObra = {
  obraId: string;
  nome: string;
  pct: number; // finalizado, ponderado pelo peso dos serviços
  pctAndamento: number;
  pctNaoIniciado: number;
  unidades: number;
  torres: { nome: string; pct: number }[];
  servicos: { nome: string; pct: number }[];
};

export type FotoPainel = { obraId: string; obraNome: string; url: string; dataFoto: string; legenda: string | null };

const pct1 = (v: number) => Math.round(v * 10) / 10;

export async function carregarPainelObras() {
  const supabase = createClient();

  const { data: obrasRows } = await supabase.from("obras").select("id, nome, exibir_no_painel").order("nome");
  const obras: ObraPainel[] = (obrasRows ?? []).map((o: any) => ({ id: o.id, nome: o.nome, exibir: o.exibir_no_painel !== false }));
  const selecionadas = obras.filter((o) => o.exibir);
  const ids = selecionadas.map((o) => o.id);
  if (!ids.length) return { obras, progresso: [] as ProgressoObra[], fotos: [] as FotoPainel[] };

  const [{ data: torres }, { data: servicos }, { data: fotosRows }] = await Promise.all([
    supabase.from("torres").select("id, obra_id, nome, ordem").in("obra_id", ids).order("ordem"),
    supabase.from("andamento_servicos").select("id, obra_id, torre_id, nome, ordem, peso").in("obra_id", ids).order("ordem"),
    supabase
      .from("obra_fotos")
      .select("obra_id, data_foto, legenda, storage_path, criado_em")
      .in("obra_id", ids)
      .order("data_foto", { ascending: false })
      .order("criado_em", { ascending: false })
      .limit(400),
  ]);

  const torreIds = (torres ?? []).map((t) => t.id);
  const { data: pavimentos } = torreIds.length
    ? await supabase.from("pavimentos").select("id, torre_id").in("torre_id", torreIds)
    : { data: [] as { id: string; torre_id: string }[] };
  const pavIds = (pavimentos ?? []).map((p) => p.id);
  const { data: unidades } = pavIds.length
    ? await supabase.from("unidades").select("id, pavimento_id").in("pavimento_id", pavIds).limit(5000)
    : { data: [] as { id: string; pavimento_id: string }[] };
  const status = await buscarStatusDasUnidades<{ unidade_id: string; servico_id: string; status: string }>(
    supabase,
    (unidades ?? []).map((u) => u.id),
    "unidade_id, servico_id, status"
  );

  const torrePorPav = new Map((pavimentos ?? []).map((p) => [p.id, p.torre_id]));
  const torreDaUnidade = new Map((unidades ?? []).map((u) => [u.id, torrePorPav.get(u.pavimento_id)!]));
  const statusPorChave = new Map(status.map((s) => [s.unidade_id + "__" + s.servico_id, s.status]));

  const progresso: ProgressoObra[] = selecionadas.map((obra) => {
    const torresObra = (torres ?? []).filter((t) => t.obra_id === obra.id);
    const servObra = (servicos ?? []).filter((s) => s.obra_id === obra.id);
    const servPorTorre = new Map<string, typeof servObra>();
    servObra.forEach((s) => servPorTorre.set(s.torre_id, [...(servPorTorre.get(s.torre_id) ?? []), s]));
    const unidadesObra = (unidades ?? []).filter((u) => torresObra.some((t) => t.id === torreDaUnidade.get(u.id)));

    let fin = 0;
    let and = 0;
    let total = 0;
    const porTorre = new Map<string, { fin: number; total: number }>();
    // cada torre tem os seus serviços; no gráfico, agrupa pelo nome do serviço
    const porServico = new Map<string, { fin: number; total: number; peso: number; ordem: number }>();
    unidadesObra.forEach((u) => {
      const tid = torreDaUnidade.get(u.id)!;
      (servPorTorre.get(tid) ?? []).forEach((s) => {
        const w = Number(s.peso ?? 1);
        const st = statusPorChave.get(u.id + "__" + s.id) ?? "NAO_INICIADO";
        if (st === "AUSENTE") return; // serviço inexistente nesta unidade: fora da conta
        total += w;
        if (st === "FINALIZADO") fin += w;
        else if (st === "ANDAMENTO") and += w;
        const t = porTorre.get(tid) ?? { fin: 0, total: 0 };
        t.total += w;
        if (st === "FINALIZADO") t.fin += w;
        porTorre.set(tid, t);
        const sv = porServico.get(s.nome) ?? { fin: 0, total: 0, peso: 0, ordem: s.ordem };
        sv.total += 1;
        sv.peso = Math.max(sv.peso, w);
        if (st === "FINALIZADO") sv.fin += 1;
        porServico.set(s.nome, sv);
      });
    });

    const pctOf = (a: number, b: number) => (b > 0 ? pct1((a / b) * 100) : 0);
    // os serviços de maior peso vão em destaque (empate: ordem do fluxograma)
    const destaque = Array.from(porServico.entries())
      .sort((a, b) => b[1].peso - a[1].peso || a[1].ordem - b[1].ordem)
      .slice(0, 8);
    return {
      obraId: obra.id,
      nome: obra.nome,
      pct: pctOf(fin, total),
      pctAndamento: pctOf(and, total),
      pctNaoIniciado: total > 0 ? pct1(100 - pctOf(fin, total) - pctOf(and, total)) : 0,
      unidades: unidadesObra.length,
      torres: torresObra.map((t) => ({ nome: t.nome, pct: pctOf(porTorre.get(t.id)?.fin ?? 0, porTorre.get(t.id)?.total ?? 0) })),
      servicos: destaque.map(([nome, v]) => ({ nome, pct: pctOf(v.fin, v.total) })),
    };
  });

  // Fotos: só a rodada mais recente de cada obra (até 4 fotos por obra).
  const maisRecentes: typeof fotosRows = [];
  for (const o of selecionadas) {
    const daObra = (fotosRows ?? []).filter((f) => f.obra_id === o.id);
    if (!daObra.length) continue;
    maisRecentes!.push(...daObra.filter((f) => f.data_foto === daObra[0].data_foto).slice(0, 4));
  }
  const caminhos = (maisRecentes ?? []).map((f) => f.storage_path);
  const { data: assinadas } = caminhos.length
    ? await supabase.storage.from("obra-fotos").createSignedUrls(caminhos, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlPorCaminho = new Map((assinadas ?? []).map((a) => [a.path, a.signedUrl]));
  const nomePorObra = new Map(obras.map((o) => [o.id, o.nome]));
  const fotos: FotoPainel[] = (maisRecentes ?? [])
    .filter((f) => urlPorCaminho.get(f.storage_path))
    .map((f) => ({
      obraId: f.obra_id,
      obraNome: nomePorObra.get(f.obra_id) ?? "",
      url: urlPorCaminho.get(f.storage_path)!,
      dataFoto: f.data_foto,
      legenda: f.legenda,
    }));

  return { obras, progresso, fotos };
}
