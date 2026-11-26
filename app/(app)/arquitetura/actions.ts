"use server";

// Ações do módulo Obras › Arquitetura › Especificações. Só ADMIN e ARQUITETO gravam (o banco confere de novo pela RLS).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ehGrupo, ehInterior, temQtd, tituloAmbiente, CAMPOS_VIDRO, descVidro, medidasVidro, type Grupo, type Vidro } from "@/lib/especificacoes/regras";
import { gerarInterior } from "@/lib/especificacoes/interiores";
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
export async function salvarProjeto(dados: { id?: string; codigo?: string; titulo: string; cliente?: string; unidade_id?: string | null; obra_id?: string | null }) {
  const supabase = await exigirArquitetura();
  const titulo = t(dados.titulo);
  if (!titulo) throw new Error("Informe o nome do projeto (ex.: 701 Campeche).");
  // "fora" = projeto que não é de prédio da SBJ (ex.: cliente particular da arquitetura)
  const obra = t(dados.obra_id);
  if (!obra) throw new Error('Escolha o prédio (ou "Fora da SBJ").');
  const linha = {
    codigo: t(dados.codigo) || null, titulo, cliente: t(dados.cliente) || null, unidade_id: t(dados.unidade_id) || null,
    obra_id: obra === "fora" ? null : obra, atualizado_em: agora(),
  };
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

// ---------- lazer do prédio ----------
/** Cria (ou atualiza) o projeto de lazer do prédio com a lista de ambientes escolhida. Devolve o id. */
export async function salvarLazer(obraId: string, ambientes: string[]) {
  const supabase = await exigirArquitetura();
  if (!t(obraId)) throw new Error("Prédio inválido.");
  const lista = Array.from(new Set(ambientes.map((a) => tituloAmbiente(t(a))).filter(Boolean)));
  const { data: ja } = await supabase.from("esp_projetos").select("id").eq("obra_id", obraId).eq("tipo", "lazer").maybeSingle();
  if (ja) {
    const { error } = await supabase.from("esp_projetos").update({ ambientes: lista, atualizado_em: agora() }).eq("id", ja.id);
    if (error) throw new Error(error.message);
    revalidatePath("/arquitetura/especificacoes");
    return ja.id as string;
  }
  const id = novoId("proj");
  const { error } = await supabase.from("esp_projetos").insert({ id, titulo: "Lazer", tipo: "lazer", obra_id: obraId, ambientes: lista, atualizado_em: agora() });
  if (error) throw new Error(error.message);
  revalidatePath("/arquitetura/especificacoes");
  return id;
}

/** Mantém a lista de ambientes do lazer igual ao que a pessoa fez na tela (só mexe se o projeto for de lazer). */
async function ajustarAmbientesLazer(supabase: any, projetoId: string, f: (l: string[]) => string[]) {
  const { data: p } = await supabase.from("esp_projetos").select("tipo, ambientes").eq("id", projetoId).maybeSingle();
  if (p?.tipo !== "lazer") return;
  const nova = Array.from(new Set(f(p.ambientes ?? []).filter(Boolean)));
  await supabase.from("esp_projetos").update({ ambientes: nova }).eq("id", projetoId);
}

export async function adicionarAmbienteLazer(projetoId: string, ambiente: string) {
  const supabase = await exigirArquitetura();
  const nome = tituloAmbiente(t(ambiente));
  if (!nome) throw new Error("Informe o ambiente.");
  await ajustarAmbientesLazer(supabase, projetoId, (l) => (l.some((a) => a.toLowerCase() === nome.toLowerCase()) ? l : [...l, nome]));
  revalidatePath(`/arquitetura/especificacoes/${projetoId}`);
}

/** Tira um ambiente sem itens da lista do lazer. */
export async function removerAmbienteLazer(projetoId: string, ambiente: string) {
  const supabase = await exigirArquitetura();
  await ajustarAmbientesLazer(supabase, projetoId, (l) => l.filter((a) => a !== ambiente));
  revalidatePath(`/arquitetura/especificacoes/${projetoId}`);
}

// ---------- itens ----------
export type DadosItem = {
  id?: string; projeto_id: string; grupo: Grupo; ambiente: string; material: string; referencia: string;
  medidas?: string; qtd?: number; img?: string; vidro?: Vidro | null; campos?: Record<string, unknown> | null; ordem?: number;
};

export async function salvarItem(d: DadosItem) {
  const supabase = await exigirArquitetura();
  if (!ehGrupo(d.grupo)) throw new Error("Grupo inválido.");
  const ambiente = tituloAmbiente(t(d.ambiente));
  if (!ambiente) throw new Error("Informe o ambiente.");
  let material = t(d.material).toUpperCase();
  let referencia = t(d.referencia);
  let medidas = t(d.medidas);
  let vidro: Vidro | null = null;
  let campos: Record<string, unknown> | null = null;
  if (ehInterior(d.grupo)) {
    // listas de interiores: tipo, texto e medidas saem sempre dos campos (nada digitado à mão vai para a folha)
    const g = gerarInterior(d.grupo, d.campos);
    ({ campos, material, referencia, medidas } = g);
  }
  if (!material) throw new Error("Informe o item (ex.: TORNEIRA).");
  if (d.grupo === "vidros") {
    vidro = limparVidro(d.vidro);
    referencia = descVidro(material, vidro);
    medidas = medidasVidro(vidro);
  }
  const linha = {
    projeto_id: d.projeto_id, grupo: d.grupo, ambiente, material, referencia, medidas,
    qtd: temQtd(d.grupo) ? Math.max(1, Math.floor(Number(d.qtd) || 1)) : 1, img: imgValida(d.img), vidro, campos, atualizado_em: agora(),
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

/** Vários itens de uma vez (sugestões do ambiente ou texto livre). */
export async function criarItens(projetoId: string, grupo: Grupo, lista: { ambiente: string; material: string; referencia?: string; medidas?: string; qtd?: number }[]) {
  const supabase = await exigirArquitetura();
  if (!ehGrupo(grupo)) throw new Error("Grupo inválido.");
  const base = Date.now();
  const linhas = lista
    .map((it, k) => ({
      id: novoId("id"), projeto_id: projetoId, grupo, ambiente: tituloAmbiente(t(it.ambiente)), material: t(it.material).toUpperCase(),
      referencia: t(it.referencia), medidas: t(it.medidas), qtd: Math.max(1, Math.floor(Number(it.qtd) || 1)), img: "", ordem: base + k,
      vidro: grupo === "vidros" ? {} : null,
      campos: ehInterior(grupo) ? {} : null,
    }))
    .filter((l) => l.ambiente);
  if (!linhas.length) throw new Error("Nenhum item para gravar (falta o ambiente?).");
  const { error } = await supabase.from("esp_itens").insert(linhas);
  if (error) throw new Error(error.message);
  await supabase.from("esp_projetos").update({ atualizado_em: agora() }).eq("id", projetoId);
  revalidatePath(`/arquitetura/especificacoes/${projetoId}`);
  return linhas.length;
}

export async function excluirItem(id: string, projetoId: string) {
  const supabase = await exigirArquitetura();
  const { error } = await supabase.from("esp_itens").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/arquitetura/especificacoes/${projetoId}`);
}

/** Troca o nome de um ambiente em todos os itens do grupo (no lazer, em todos os grupos, porque a lista é do prédio). */
export async function renomearAmbiente(projetoId: string, grupo: Grupo, de: string, para: string) {
  const supabase = await exigirArquitetura();
  const novo = tituloAmbiente(t(para));
  if (!novo) throw new Error("Informe o novo nome do ambiente.");
  const { data: p } = await supabase.from("esp_projetos").select("tipo").eq("id", projetoId).maybeSingle();
  let q = supabase.from("esp_itens").update({ ambiente: novo, atualizado_em: agora() }).eq("projeto_id", projetoId).eq("ambiente", de);
  if (p?.tipo !== "lazer") q = q.eq("grupo", grupo);
  const { error } = await q;
  if (error) throw new Error(error.message);
  await ajustarAmbientesLazer(supabase, projetoId, (l) => l.map((a) => (a === de ? novo : a)));
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
export async function salvarNota(projetoId: string, grupo: Grupo, dados: { obs: string; rev: string; papel?: string }) {
  const supabase = await exigirArquitetura();
  if (!ehGrupo(grupo)) throw new Error("Grupo inválido.");
  const rev = t(dados.rev).toUpperCase() || "R0";
  const { error } = await supabase.from("esp_notas").upsert({ projeto_id: projetoId, grupo, obs: t(dados.obs), rev, papel: dados.papel === "a4p" ? "a4p" : "a3p" }, { onConflict: "projeto_id,grupo" });
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

/** Remove um ambiente inteiro (todos os itens dele no grupo). */
export async function excluirAmbiente(projetoId: string, grupo: Grupo, ambiente: string) {
  const supabase = await exigirArquitetura();
  const { error } = await supabase.from("esp_itens").delete().eq("projeto_id", projetoId).eq("grupo", grupo).eq("ambiente", ambiente);
  if (error) throw new Error(error.message);
  // no lazer o ambiente sai da lista só quando não sobra item dele em nenhum grupo
  const { count } = await supabase.from("esp_itens").select("id", { count: "exact", head: true }).eq("projeto_id", projetoId).eq("ambiente", ambiente);
  if (!count) await ajustarAmbientesLazer(supabase, projetoId, (l) => l.filter((a) => a !== ambiente));
  revalidatePath(`/arquitetura/especificacoes/${projetoId}`);
}
