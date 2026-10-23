"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CORES_CATEGORIA, gerarEstrutura, type ParamsObraNova } from "./types";

// Configuração: ADM ou quem tem a permissão específica (an_pode_configurar). As políticas do banco (RLS) conferem de novo.
async function admin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: pode } = await supabase.rpc("an_pode_configurar", { uid: user!.id });
  if (!pode) throw new Error("Sem permissão para configurar o Andamento.");
  return supabase;
}

function ok(error: { message: string } | null) {
  if (error) throw new Error(error.message);
  revalidatePath("/andamento-novo", "layout");
}

type S = Awaited<ReturnType<typeof admin>>;
async function rpc(supabase: S, fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args);
  ok(error);
  return data;
}

// ---------- obra ----------
export async function salvarDatasObra(obraId: string, inicio: string | null, entrega: string | null) {
  const s = await admin();
  await rpc(s, "an_definir_datas_obra", { p_obra: obraId, p_inicio: inicio || null, p_entrega: entrega || null });
}

export async function prepararObra(obraId: string) {
  const s = await admin();
  await rpc(s, "an_copiar_config", { p_origem: null, p_destino: obraId });
}

export async function criarObraNova(input: {
  nome: string;
  base: string | null; // null = Modelo padrão SBJ; senão id da obra de onde copiar
  inicio: string | null;
  entrega: string | null;
  params: ParamsObraNova;
}) {
  const s = await admin();
  const estrutura = gerarEstrutura(input.params);
  const id = await rpc(s, "an_nova_obra", {
    p_nome: input.nome,
    p_base: input.base,
    p_estrutura: estrutura,
    p_inicio: input.inicio || null,
    p_entrega: input.entrega || null,
  });
  return id as string;
}

// ---------- fases ----------
export async function criarFase(obraId: string, nome: string) {
  const s = await admin();
  const { data } = await s.from("an_fase").select("ordem").eq("obra_id", obraId).order("ordem", { ascending: false }).limit(1);
  ok((await s.from("an_fase").insert({ obra_id: obraId, nome: nome.trim(), ordem: (data?.[0]?.ordem ?? -1) + 1 })).error);
}
export async function renomearFase(id: string, nome: string) {
  const s = await admin();
  ok((await s.from("an_fase").update({ nome: nome.trim() }).eq("id", id)).error);
}
export async function excluirFase(id: string) {
  const s = await admin();
  ok((await s.from("an_fase").delete().eq("id", id)).error); // serviços da fase ficam sem fase (aparecem pelo grupo)
}
export async function moverFase(id: string, dir: -1 | 1) {
  const s = await admin();
  const { data: f } = await s.from("an_fase").select("id, obra_id, ordem").eq("id", id).single();
  if (!f) return;
  const { data: lista } = await s.from("an_fase").select("id, ordem").eq("obra_id", f.obra_id).order("ordem");
  const arr = lista ?? [];
  const i = arr.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  for (let k = 0; k < arr.length; k++) {
    const { error } = await s.from("an_fase").update({ ordem: k }).eq("id", arr[k].id);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/andamento-novo", "layout");
}

// ---------- categorias ----------
export async function criarCategoria(obraId: string, nome: string) {
  const s = await admin();
  const { data } = await s.from("an_categoria").select("ordem").eq("obra_id", obraId).order("ordem", { ascending: false }).limit(1);
  const ordem = (data?.[0]?.ordem ?? -1) + 1;
  const chave = nome.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 20) + "-" + Math.random().toString(36).slice(2, 6);
  ok((await s.from("an_categoria").insert({ obra_id: obraId, chave, nome: nome.trim(), cor: CORES_CATEGORIA[ordem % CORES_CATEGORIA.length], ordem })).error);
}
export async function renomearCategoria(id: string, nome: string) {
  const s = await admin();
  ok((await s.from("an_categoria").update({ nome: nome.trim() }).eq("id", id)).error);
}
export async function excluirCategoria(id: string, destino: string | null) {
  const s = await admin();
  await rpc(s, "an_excluir_categoria", { p_cat: id, p_destino: destino });
}

// ---------- serviços ----------
export async function criarServico(obraId: string, grupo: string, nome: string) {
  const s = await admin();
  const { data } = await s.from("an_servico").select("ordem").eq("obra_id", obraId).order("ordem", { ascending: false }).limit(1);
  ok((await s.from("an_servico").insert({ obra_id: obraId, grupo, nome: nome.trim(), ordem: (data?.[0]?.ordem ?? -1) + 1 })).error);
}
export async function renomearServico(id: string, nome: string) {
  const s = await admin();
  ok((await s.from("an_servico").update({ nome: nome.trim() }).eq("id", id)).error);
}
export async function definirFaseServico(id: string, faseId: string | null) {
  const s = await admin();
  ok((await s.from("an_servico").update({ fase_id: faseId }).eq("id", id)).error);
}
// Ordem de execução: move o serviço (dentro do grupo ou para outro grupo). Não altera apontamentos nem pesos.
export async function moverServico(id: string, grupo: string, antesDe: string | null) {
  const s = await admin();
  await rpc(s, "an_mover_servico", { p_serv: id, p_grupo: grupo, p_antes: antesDe });
}
export async function excluirServico(id: string) {
  const s = await admin();
  await rpc(s, "an_excluir_servico", { p_serv: id });
}
export async function definirPavInteiro(id: string, valor: boolean) {
  const s = await admin();
  ok((await s.from("an_servico").update({ vale_pavimento_inteiro: valor }).eq("id", id)).error);
}
export async function servicoNaCategoria(cat: string, serv: string, ligado: boolean) {
  const s = await admin();
  await rpc(s, "an_servico_na_categoria", { p_cat: cat, p_serv: serv, p_on: ligado });
}

// ---------- pesos ----------
export async function definirPeso(cat: string, serv: string, valor: number) {
  const s = await admin();
  await rpc(s, "an_definir_peso", { p_cat: cat, p_serv: serv, p_valor: valor });
}
export async function alternarFixo(cat: string, serv: string, fixo: boolean) {
  const s = await admin();
  await rpc(s, "an_alternar_fixo", { p_cat: cat, p_serv: serv, p_fixo: fixo });
}
export async function igualarPesos(cat: string) {
  const s = await admin();
  await rpc(s, "an_igualar_pesos", { p_cat: cat });
}
export async function pesosPadrao(cat: string) {
  const s = await admin();
  await rpc(s, "an_pesos_padrao", { p_cat: cat });
}
// ---------- fatias da obra ----------
// t: "s" = serviço dos locais, "y" = sistema; v = % da obra
export async function definirFatias(itens: { t: "s" | "y"; id: string; v: number }[]) {
  const s = await admin();
  await rpc(s, "an_definir_fatias", { p: itens });
}
// pesos internos de um sistema (% do sistema): categoria × serviço
export async function definirPesosInternos(itens: { c: string; s: string; v: number }[]) {
  const s = await admin();
  await rpc(s, "an_definir_pesos_internos", { p: itens });
}
export async function salvarComoModelo(obraId: string) {
  const s = await admin();
  await rpc(s, "an_salvar_como_modelo", { p_obra: obraId });
}

// ---------- pavimentos e locais ----------
export async function criarPavimento(obraId: string, posicao: "topo" | "fim", nome: string) {
  const s = await admin();
  const { data } = await s.from("an_pavimento").select("ordem").eq("obra_id", obraId).order("ordem", { ascending: posicao === "fim" }).limit(1);
  const base = data?.[0]?.ordem ?? 0;
  ok((await s.from("an_pavimento").insert({ obra_id: obraId, nome: nome.trim() || "Novo pavimento", ordem: posicao === "fim" ? base + 1 : base - 1 })).error);
  await rpc(s, "an_renumerar_pavimentos", { p_obra: obraId });
}
export async function renomearPavimento(id: string, nome: string) {
  const s = await admin();
  ok((await s.from("an_pavimento").update({ nome: nome.trim() }).eq("id", id)).error);
}
export async function moverPavimento(id: string, dir: -1 | 1) {
  const s = await admin();
  await rpc(s, "an_mover_pavimento", { p_pav: id, p_dir: dir });
}
export async function duplicarPavimento(id: string) {
  const s = await admin();
  await rpc(s, "an_duplicar_pavimento", { p_pav: id });
}
export async function excluirPavimento(id: string) {
  const s = await admin();
  ok((await s.from("an_pavimento").delete().eq("id", id)).error);
}
export async function criarLocal(pavimentoId: string, categoriaId: string, nome: string) {
  const s = await admin();
  const { data } = await s.from("an_local").select("ordem").eq("pavimento_id", pavimentoId).order("ordem", { ascending: false }).limit(1);
  ok((await s.from("an_local").insert({ pavimento_id: pavimentoId, categoria_id: categoriaId, nome: nome.trim() || "Novo local", ordem: (data?.[0]?.ordem ?? -1) + 1 })).error);
}
export async function renomearLocal(id: string, nome: string) {
  const s = await admin();
  ok((await s.from("an_local").update({ nome: nome.trim() }).eq("id", id)).error);
}
export async function trocarCategoriaLocal(id: string, categoriaId: string) {
  const s = await admin();
  ok((await s.from("an_local").update({ categoria_id: categoriaId }).eq("id", id)).error); // apontamentos continuam guardados
}
export async function excluirLocal(id: string) {
  const s = await admin();
  ok((await s.from("an_local").delete().eq("id", id)).error);
}

// ---------- sistemas e itens ----------
export async function criarSistema(obraId: string, nome: string) {
  const s = await admin();
  const { data } = await s.from("an_sistema").select("ordem").eq("obra_id", obraId).order("ordem", { ascending: false }).limit(1);
  ok((await s.from("an_sistema").insert({ obra_id: obraId, nome: nome.trim() || "Novo sistema", tipo: "comum", ordem: (data?.[0]?.ordem ?? -1) + 1 })).error);
}
export async function renomearSistema(id: string, nome: string) {
  const s = await admin();
  ok((await s.from("an_sistema").update({ nome: nome.trim() }).eq("id", id)).error);
}
export async function excluirSistema(id: string) {
  const s = await admin();
  ok((await s.from("an_sistema").delete().eq("id", id)).error);
}
export async function criarItem(sistemaId: string, categoriaId: string, nome: string) {
  const s = await admin();
  const { data } = await s.from("an_sistema_item").select("ordem").eq("sistema_id", sistemaId).order("ordem", { ascending: false }).limit(1);
  ok((await s.from("an_sistema_item").insert({ sistema_id: sistemaId, categoria_id: categoriaId, nome: nome.trim() || "Novo item", ordem: (data?.[0]?.ordem ?? -1) + 1 })).error);
}
export async function renomearItem(id: string, nome: string) {
  const s = await admin();
  ok((await s.from("an_sistema_item").update({ nome: nome.trim() }).eq("id", id)).error);
}
export async function trocarCategoriaItem(id: string, categoriaId: string) {
  const s = await admin();
  ok((await s.from("an_sistema_item").update({ categoria_id: categoriaId }).eq("id", id)).error);
}
export async function excluirItem(id: string) {
  const s = await admin();
  ok((await s.from("an_sistema_item").delete().eq("id", id)).error);
}
