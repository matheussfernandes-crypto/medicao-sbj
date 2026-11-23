"use server";

// Ações do módulo Obras › Arquitetura › Especificações. Só ADMIN e ARQUITETO gravam (o banco confere de novo pela RLS).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ehGrupo, tituloAmbiente, CAMPOS_VIDRO, descVidro, medidasVidro, type Grupo, type Vidro } from "@/lib/especificacoes/regras";
import type { LinhaItem, LinhaModelo, LinhaNota, LinhaProjeto } from "@/lib/especificacoes/importar";

async function exigirArquitetura() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre de novo.");
  const { data: perfil } = await supabase.from("perfis").select("setor, status").eq("id", user.id).single();
  if (perfil?.status !== "aprovado" || !["ADMIN", "ARQUITETO"].includes(perfil?.setor ?? "")) throw new Error("Sem permissão.");
  return supabase;
}

const t = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const novoId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const agora = () => new Date().toISOString();
const imgValida = (v: unknown) => {
  const s = t(v);
  return s.startsWith("catalogo/") || s.startsWith("torre/") || s.startsWith("arq/") ? s : "";
};
function limparVidro(v: unknown): Vidro {
  const o: any = {};
  const src = (v && typeof v === "object" ? v : {}) as any;
  for (const c of CAMPOS_VIDRO) {
    const x = src[c];
    if (x === undefined || x === null || x === "") continue;
    if (c === "ateTeto") o[c] = !!x;
    else if (c === "folhas" || c === "correr") {
      const n = parseInt(String(x), 10);
      if (n > 0) o[c] = n;
    } else o[c] = String(x).trim();
  }
  return o;
}

// ---------- projetos ----------
export async function salvarProjeto(dados: { id?: string; codigo?: string; titulo: string; cliente?: string }) {
  const supabase = await exigirArquitetura();
  const titulo = t(dados.titulo);
  if (!titulo) throw new Error("Informe o nome do projeto (ex.: 701 Campeche).");
  const linha = { codigo: t(dados.codigo) || null, titulo, cliente: t(dados.cliente) || null, atualizado_em: agora() };
  if (dados.id) {
    const { error } = await supabase.from("esp_projetos").update(linha).eq("id", dados.id);
    if (error) throw new Error(error.message);
    revalidatePath("/arquitetura/especificacoes");
    return dados.id;
  }
  const id = novoId("proj");
  const { error } = await supabase.from("esp_projetos").insert({ id, ...linha });
  if (error) throw new Error(error.message);
  revalidatePath("/arquitetura/especificacoes");
  return id;
}

export async function excluirProjeto(id: string) {
  const supabase = await exigirArquitetura();
  const { error } = await supabase.from("esp_projetos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/arquitetura/especificacoes");
}

// ---------- itens ----------
export type DadosItem = {
  id?: string; projeto_id: string; grupo: Grupo; ambiente: string; material: string; referencia: string;
  medidas?: string; qtd?: number; img?: string; vidro?: Vidro | null; ordem?: number;
};

export async function salvarItem(d: DadosItem) {
  const supabase = await exigirArquitetura();
  if (!ehGrupo(d.grupo)) throw new Error("Grupo inválido.");
  const ambiente = tituloAmbiente(t(d.ambiente));
  if (!ambiente) throw new Error("Informe o ambiente.");
  const material = t(d.material).toUpperCase();
  if (!material) throw new Error("Informe o item (ex.: TORNEIRA).");
  let referencia = t(d.referencia);
  let medidas = t(d.medidas);
  let vidro: Vidro | null = null;
  if (d.grupo === "vidros") {
    vidro = limparVidro(d.vidro);
    referencia = descVidro(material, vidro);
    medidas = medidasVidro(vidro);
  }
  const linha = {
    projeto_id: d.projeto_id, grupo: d.grupo, ambiente, material, referencia, medidas,
    qtd: Math.max(1, Math.floor(Number(d.qtd) || 1)), img: imgValida(d.img), vidro, atualizado_em: agora(),
  };
  if (d.id) {
    const { error } = await supabase.from("esp_itens").update(linha).eq("id", d.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("esp_itens").insert({ id: novoId("id"), ordem: d.ordem ?? Date.now(), ...linha });
    if (error) throw new Error(error.message);
  }
  await supabase.from("esp_projetos").update({ atualizado_em: agora() }).eq("id", d.projeto_id);
  revalidatePath(`/arquitetura/especificacoes/${d.projeto_id}`);
}

export async function excluirItem(id: string, projetoId: string) {
  const supabase = await exigirArquitetura();
  const { error } = await supabase.from("esp_itens").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/arquitetura/especificacoes/${projetoId}`);
}

/** Troca o nome de um ambiente em todos os itens do grupo. */
export async function renomearAmbiente(projetoId: string, grupo: Grupo, de: string, para: string) {
  const supabase = await exigirArquitetura();
  const novo = tituloAmbiente(t(para));
  if (!novo) throw new Error("Informe o novo nome do ambiente.");
  const { error } = await supabase.from("esp_itens").update({ ambiente: novo, atualizado_em: agora() })
    .eq("projeto_id", projetoId).eq("grupo", grupo).eq("ambiente", de);
  if (error) throw new Error(error.message);
  revalidatePath(`/arquitetura/especificacoes/${projetoId}`);
}

/** Sobe ou desce um item dentro do ambiente (troca a ordem com o vizinho). */
export async function moverItem(projetoId: string, a: { id: string; ordem: number }, b: { id: string; ordem: number }) {
  const supabase = await exigirArquitetura();
  const r1 = await supabase.from("esp_itens").update({ ordem: b.ordem }).eq("id", a.id);
  const r2 = await supabase.from("esp_itens").update({ ordem: a.ordem }).eq("id", b.id);
  if (r1.error || r2.error) throw new Error((r1.error ?? r2.error)!.message);
  revalidatePath(`/arquitetura/especificacoes/${projetoId}`);
}

// ---------- observações e revisão da folha ----------
export async function salvarNota(projetoId: string, grupo: Grupo, dados: { obs: string; rev: string }) {
  const supabase = await exigirArquitetura();
  if (!ehGrupo(grupo)) throw new Error("Grupo inválido.");
  const rev = t(dados.rev).toUpperCase() || "R0";
  const { error } = await supabase.from("esp_notas").upsert({ projeto_id: projetoId, grupo, obs: t(dados.obs), rev }, { onConflict: "projeto_id,grupo" });
  if (error) throw new Error(error.message);
  revalidatePath(`/arquitetura/especificacoes/${projetoId}`);
}

// ---------- catálogo de modelos ----------
export type DadosModelo = {
  id?: string; grupo: Grupo; material: string; referencia: string; medidas?: string; marca?: string; linha?: string;
  acab?: string; codigo?: string; faixa?: number | null; uso?: string; valor_ref?: number | null; img?: string; revisar?: boolean;
};

export async function salvarModelo(d: DadosModelo) {
  const supabase = await exigirArquitetura();
  if (!ehGrupo(d.grupo)) throw new Error("Grupo inválido.");
  const material = t(d.material).toUpperCase();
  const referencia = t(d.referencia);
  if (!material || !referencia) throw new Error("Informe o item e a descrição do modelo.");
  const faixa = Number(d.faixa);
  const valor = Number(d.valor_ref);
  const linha = {
    grupo: d.grupo, material, referencia, medidas: t(d.medidas), marca: t(d.marca).toUpperCase(), linha: t(d.linha), acab: t(d.acab),
    codigo: t(d.codigo), faixa: faixa >= 1 && faixa <= 3 ? faixa : null, uso: ["b", "c", "s", "g"].includes(t(d.uso)) ? t(d.uso) : "g",
    valor_ref: valor > 0 ? valor : null, valor_data: valor > 0 ? agora().slice(0, 10) : null, img: imgValida(d.img), revisar: !!d.revisar,
    atualizado_em: agora(),
  };
  if (d.id) {
    const { error } = await supabase.from("esp_modelos").update(linha).eq("id", d.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("esp_modelos").insert({ id: novoId("mod"), ordem: Date.now(), ...linha });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/arquitetura/catalogo");
}

export async function excluirModelo(id: string) {
  const supabase = await exigirArquitetura();
  const { error } = await supabase.from("esp_modelos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/arquitetura/catalogo");
}

// ---------- importação do arquivo da Torre ----------
// O navegador lê o arquivo, envia as fotos embutidas para o bucket e manda só as linhas (já com "arq/...").
export async function importarLinhas(c: { projetos: LinhaProjeto[]; itens: LinhaItem[]; notas: LinhaNota[]; modelos: LinhaModelo[] }) {
  const supabase = await exigirArquitetura();
  const lote = async (tab: string, linhas: any[], conflito: string) => {
    for (let i = 0; i < linhas.length; i += 200) {
      const { error } = await supabase.from(tab).upsert(linhas.slice(i, i + 200), { onConflict: conflito });
      if (error) throw new Error(`${tab}: ${error.message}`);
    }
  };
  const fixImg = <T extends { img: string }>(x: T) => ({ ...x, img: imgValida(x.img) });
  await lote("esp_projetos", c.projetos.map((p) => ({ ...p, atualizado_em: agora() })), "id");
  await lote("esp_modelos", c.modelos.map(fixImg), "id");
  await lote("esp_itens", c.itens.map(fixImg), "id");
  await lote("esp_notas", c.notas, "projeto_id,grupo");
  revalidatePath("/arquitetura/especificacoes");
  revalidatePath("/arquitetura/catalogo");
  return { projetos: c.projetos.length, itens: c.itens.length, modelos: c.modelos.length };
}
