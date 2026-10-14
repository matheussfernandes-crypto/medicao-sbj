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
