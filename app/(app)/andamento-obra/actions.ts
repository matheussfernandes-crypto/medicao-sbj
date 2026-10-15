"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { StatusAndamento, CategoriaPavimento } from "./types";

async function exigirAcesso() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase
    .from("perfis")
    .select("setor, status, nome_completo")
    .eq("id", user!.id)
    .single();
  if (!perfil || perfil.status !== "aprovado" || !["ESTAGIARIO", "ADMIN"].includes(perfil.setor)) {
    throw new Error("Sem permissão para esta ação.");
  }
  return { supabase, userId: user!.id, nome: perfil.nome_completo as string };
}

// ---------- status da célula (unidade x serviço) ----------

export async function definirStatus(unidadeId: string, servicoId: string, novoStatus: StatusAndamento) {
  const { supabase, userId } = await exigirAcesso();

  const { data: atual } = await supabase
    .from("andamento_status")
    .select("status")
    .eq("unidade_id", unidadeId)
    .eq("servico_id", servicoId)
    .maybeSingle();

  const statusAnterior = atual?.status ?? null;

  await supabase
    .from("andamento_status")
    .upsert(
      { unidade_id: unidadeId, servico_id: servicoId, status: novoStatus, atualizado_por: userId, atualizado_em: new Date().toISOString() },
      { onConflict: "unidade_id,servico_id" }
    );

  if (statusAnterior !== novoStatus) {
    await supabase.from("andamento_historico").insert({
      unidade_id: unidadeId,
      servico_id: servicoId,
      tipo: "STATUS",
      de: statusAnterior,
      para: novoStatus,
      autor_id: userId,
    });
  }

  revalidatePath("/andamento-obra");
}

export async function salvarObservacao(unidadeId: string, servicoId: string, observacao: string) {
  const { supabase, userId } = await exigirAcesso();

  const { data: atual } = await supabase
    .from("andamento_status")
    .select("observacao, status")
    .eq("unidade_id", unidadeId)
    .eq("servico_id", servicoId)
    .maybeSingle();

  await supabase
    .from("andamento_status")
    .upsert(
      {
        unidade_id: unidadeId,
        servico_id: servicoId,
        status: atual?.status ?? "NAO_INICIADO",
        observacao,
        atualizado_por: userId,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "unidade_id,servico_id" }
    );

  if ((atual?.observacao ?? "") !== observacao && observacao) {
    await supabase.from("andamento_historico").insert({
      unidade_id: unidadeId,
      servico_id: servicoId,
      tipo: "OBSERVACAO",
      observacao,
      autor_id: userId,
    });
  }

  revalidatePath("/andamento-obra");
}

// ---------- torres ----------

export async function salvarTorre(input: { id?: string; obraId: string; nome: string; ordem: number }) {
  const { supabase } = await exigirAcesso();
  const { data, error } = await supabase
    .from("torres")
    .upsert({ id: input.id, obra_id: input.obraId, nome: input.nome, ordem: input.ordem })
    .select("id, obra_id, nome, ordem")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/andamento-obra");
  return data;
}

export async function excluirTorre(id: string) {
  const { supabase } = await exigirAcesso();
  const { error } = await supabase.from("torres").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/andamento-obra");
}

// ---------- pavimentos ----------

export async function salvarPavimento(input: {
  id?: string;
  torreId: string;
  nome: string;
  ordem: number;
  categoria: CategoriaPavimento;
}) {
  const { supabase } = await exigirAcesso();
  const { data, error } = await supabase
    .from("pavimentos")
    .upsert({ id: input.id, torre_id: input.torreId, nome: input.nome, ordem: input.ordem, categoria: input.categoria })
    .select("id, torre_id, nome, ordem, categoria")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/andamento-obra");
  return data;
}

export async function excluirPavimento(id: string) {
  const { supabase } = await exigirAcesso();
  const { error } = await supabase.from("pavimentos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/andamento-obra");
}

// Duplica um pavimento com as unidades. O nome ganha o próximo número livre
// (Tipo 06 -> Tipo 07) e, quando o nome da unidade começa pelo número do andar
// (Apartamento 601 em "Tipo 06"), ele acompanha (Apartamento 701).
function ultimoNumero(texto: string) {
  const m = /(\d+)(?!.*\d)/.exec(texto);
  return m ? { digitos: m[1], inicio: m.index, fim: m.index + m[1].length } : null;
}

export async function duplicarPavimento(pavimentoId: string) {
  const { supabase } = await exigirAcesso();

  const { data: src } = await supabase
    .from("pavimentos")
    .select("id, torre_id, nome, ordem, categoria")
    .eq("id", pavimentoId)
    .single();
  if (!src) throw new Error("Pavimento não encontrado.");

  const { data: irmaos } = await supabase
    .from("pavimentos")
    .select("id, nome, ordem")
    .eq("torre_id", src.torre_id)
    .order("ordem");
  const { data: unidadesOrigem } = await supabase
    .from("unidades")
    .select("nome, ordem")
    .eq("pavimento_id", src.id)
    .order("ordem");

  const usados = new Set((irmaos ?? []).map((p) => p.nome.trim().toLowerCase()));
  let novoNome = "";
  let numAntigo: number | null = null;
  let numNovo: number | null = null;
  const num = ultimoNumero(src.nome);
  if (num) {
    numAntigo = parseInt(num.digitos, 10);
    let n = numAntigo;
    do {
      n += 1;
      novoNome = src.nome.slice(0, num.inicio) + String(n).padStart(num.digitos.length, "0") + src.nome.slice(num.fim);
    } while (usados.has(novoNome.trim().toLowerCase()));
    numNovo = n;
  } else {
    let k = 1;
    do {
      novoNome = `${src.nome} (cópia${k > 1 ? " " + k : ""})`;
      k += 1;
    } while (usados.has(novoNome.trim().toLowerCase()));
  }

  // abre espaço logo abaixo do original
  for (const irmao of (irmaos ?? []).filter((p) => p.ordem > src.ordem)) {
    await supabase.from("pavimentos").update({ ordem: irmao.ordem + 1 }).eq("id", irmao.id);
  }

  const { data: novo, error } = await supabase
    .from("pavimentos")
    .insert({ torre_id: src.torre_id, nome: novoNome, ordem: src.ordem + 1, categoria: src.categoria })
    .select("id")
    .single();
  if (error || !novo) throw new Error(error?.message ?? "Não foi possível duplicar o pavimento.");

  const nomeUnidade = (nome: string) => {
    if (numAntigo == null || numNovo == null) return nome;
    const u = ultimoNumero(nome);
    const prefixo = String(numAntigo);
    const d = u ? String(parseInt(u.digitos, 10)) : "";
    if (u && d.length >= prefixo.length + 2 && d.startsWith(prefixo)) {
      const trocado = String(numNovo) + d.slice(prefixo.length);
      return nome.slice(0, u.inicio) + trocado.padStart(u.digitos.length, "0") + nome.slice(u.fim);
    }
    return nome;
  };

  let novasUnidades: { id: string; pavimento_id: string; nome: string; ordem: number }[] = [];
  if ((unidadesOrigem ?? []).length) {
    const { data: criadas, error: e2 } = await supabase
      .from("unidades")
      .insert((unidadesOrigem ?? []).map((u) => ({ pavimento_id: novo.id, nome: nomeUnidade(u.nome), ordem: u.ordem })))
      .select("id, pavimento_id, nome, ordem");
    if (e2) throw new Error(e2.message);
    novasUnidades = criadas ?? [];
  }

  const { data: pavimentosDaTorre } = await supabase
    .from("pavimentos")
    .select("id, torre_id, nome, ordem, categoria")
    .eq("torre_id", src.torre_id)
    .order("ordem");

  revalidatePath("/andamento-obra");
  return { novoId: novo.id as string, pavimentos: pavimentosDaTorre ?? [], unidades: novasUnidades };
}
// ---------- unidades ----------

export async function salvarUnidade(input: { id?: string; pavimentoId: string; nome: string; ordem: number }) {
  const { supabase } = await exigirAcesso();
  const { data, error } = await supabase
    .from("unidades")
    .upsert({ id: input.id, pavimento_id: input.pavimentoId, nome: input.nome, ordem: input.ordem })
    .select("id, pavimento_id, nome, ordem")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/andamento-obra");
  return data;
}

export async function excluirUnidade(id: string) {
  const { supabase } = await exigirAcesso();
  const { error } = await supabase.from("unidades").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/andamento-obra");
}

// ---------- serviços (fases do fluxograma) ----------

export async function salvarServico(input: { id?: string; obraId: string; nome: string; ordem: number }) {
  const { supabase } = await exigirAcesso();
  const { data, error } = await supabase
    .from("andamento_servicos")
    .upsert({ id: input.id, obra_id: input.obraId, nome: input.nome, ordem: input.ordem })
    .select("id, obra_id, nome, ordem")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/andamento-obra");
  return data;
}

export async function excluirServico(id: string) {
  const { supabase } = await exigirAcesso();
  const { error } = await supabase.from("andamento_servicos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/andamento-obra");
}
