"use server";

import { createClient } from "@/lib/supabase/server";
import { notificarUsuarios } from "@/lib/push/send";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SETORES_EXECUTORES, SETORES_APROVADORES, SETORES_MODULO } from "./constants";

async function exigirAcessoModulo() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase.from("perfis").select("setor, status, nome_completo").eq("id", user!.id).single();
  if (!perfil || perfil.status !== "aprovado" || !SETORES_MODULO.includes(perfil.setor)) {
    redirect("/dashboard");
  }
  return { supabase, user: user!, setor: perfil.setor as string, nome: perfil.nome_completo as string };
}

async function exigirExecutor() {
  const ctx = await exigirAcessoModulo();
  if (!SETORES_EXECUTORES.includes(ctx.setor)) throw new Error("Sem permissão para esta ação.");
  return ctx;
}

async function exigirAprovador() {
  const ctx = await exigirAcessoModulo();
  if (!SETORES_APROVADORES.includes(ctx.setor)) throw new Error("Sem permissão para aprovar/reprovar.");
  return ctx;
}

async function notificarResponsaveisModulo(payload: { title: string; body: string; url?: string }, supabase: ReturnType<typeof createClient>) {
  const { data: pessoas } = await supabase
    .from("perfis")
    .select("id")
    .in("setor", ["ADMIN", "ARQUITETO", "ENGENHEIRO"])
    .eq("status", "aprovado");
  if (pessoas?.length) {
    await notificarUsuarios(pessoas.map((p) => p.id), payload).catch(() => null);
  }
}

export async function criarOS(formData: FormData) {
  const { supabase, user } = await exigirExecutor();

  const obraId = String(formData.get("obraId") || "");
  if (!obraId) redirect(`/manutencoes/nova?erro=${encodeURIComponent("Selecione o empreendimento.")}`);

  const torreId = String(formData.get("torreId") || "") || null;
  const pavimentoId = String(formData.get("pavimentoId") || "") || null;
  const unidadeId = String(formData.get("unidadeId") || "") || null;
  const areaComumTexto = String(formData.get("areaComumTexto") || "").trim() || null;

  const { data: obra } = await supabase.from("obras").select("nome").eq("id", obraId).single();

  const { data: novaOS, error } = await supabase
    .from("manutencao_os")
    .insert({
      solicitante_nome: String(formData.get("solicitanteNome") || "").trim(),
      solicitante_telefone: String(formData.get("solicitanteTelefone") || "").trim(),
      solicitante_tipo: String(formData.get("solicitanteTipo") || "OUTRO"),
      origem: String(formData.get("origem") || "OUTRO"),
      obra_id: obraId,
      torre_id: torreId,
      pavimento_id: pavimentoId,
      unidade_id: unidadeId,
      area_comum_texto: areaComumTexto,
      categoria: String(formData.get("categoria") || "OUTROS"),
      problema: String(formData.get("problema") || "OUTRO"),
      descricao: String(formData.get("descricao") || "").trim() || null,
      prioridade: String(formData.get("prioridade") || "MEDIA"),
      criado_por: user.id,
    })
    .select("id, numero_os")
    .single();

  if (error || !novaOS) {
    redirect(`/manutencoes/nova?erro=${encodeURIComponent("Não foi possível salvar: " + (error?.message ?? "erro desconhecido"))}`);
  }

  await notificarResponsaveisModulo(
    {
      title: `Nova OS #${novaOS!.numero_os}`,
      body: `${obra?.nome ?? "Obra"} — ${String(formData.get("categoria") || "")}: ${String(formData.get("problema") || "")}`,
      url: `/manutencoes/os/${novaOS!.id}`,
    },
    supabase
  );

  revalidatePath("/manutencoes/os");
  redirect(`/manutencoes/os/${novaOS!.id}?sucesso=${encodeURIComponent(`OS #${novaOS!.numero_os} criada.`)}`);
}

export async function atribuirResponsavel(formData: FormData) {
  const { supabase } = await exigirExecutor();
  const id = String(formData.get("id"));
  const responsavelTipo = String(formData.get("responsavelTipo"));

  const update: Record<string, unknown> = { responsavel_tipo: responsavelTipo };
  if (responsavelTipo === "FUNCIONARIO") {
    update.responsavel_perfil_id = String(formData.get("responsavelPerfilId") || "") || null;
    update.responsavel_empresa_id = null;
  } else if (responsavelTipo === "EMPRESA") {
    update.responsavel_empresa_id = String(formData.get("responsavelEmpresaId") || "") || null;
    update.responsavel_perfil_id = null;
  }

  await supabase.from("manutencao_os").update(update).eq("id", id);
  revalidatePath(`/manutencoes/os/${id}`);
}

export async function agendarOS(formData: FormData) {
  const { supabase } = await exigirExecutor();
  const id = String(formData.get("id"));
  const agendadoPara = String(formData.get("agendadoPara") || "") || null;

  await supabase
    .from("manutencao_os")
    .update({ agendado_para: agendadoPara, status: agendadoPara ? "AGENDADA" : "ABERTA" })
    .eq("id", id);
  revalidatePath(`/manutencoes/os/${id}`);
  revalidatePath("/manutencoes/agenda");
}

export async function iniciarServico(formData: FormData) {
  const { supabase } = await exigirExecutor();
  const id = String(formData.get("id"));
  await supabase
    .from("manutencao_os")
    .update({ status: "EM_ANDAMENTO", iniciado_em: new Date().toISOString() })
    .eq("id", id);
  revalidatePath(`/manutencoes/os/${id}`);
}

export async function finalizarServico(formData: FormData) {
  const { supabase } = await exigirExecutor();
  const id = String(formData.get("id"));

  await supabase
    .from("manutencao_os")
    .update({
      status: "AGUARDANDO_APROVACAO",
      finalizado_em: new Date().toISOString(),
      servico_executado: String(formData.get("servicoExecutado") || "") || null,
      materiais_utilizados: String(formData.get("materiaisUtilizados") || "").trim() || null,
      observacao_tecnica: String(formData.get("observacaoTecnica") || "").trim() || null,
      garantia_classificacao: String(formData.get("garantiaClassificacao") || "") || null,
    })
    .eq("id", id);

  await notificarResponsaveisModulo(
    { title: "OS aguardando aprovação", body: `OS finalizada, aguardando revisão.`, url: `/manutencoes/os/${id}` },
    supabase
  );

  revalidatePath(`/manutencoes/os/${id}`);
}

export async function aprovarOS(formData: FormData) {
  const { supabase, user } = await exigirAprovador();
  const id = String(formData.get("id"));
  await supabase
    .from("manutencao_os")
    .update({ status: "CONCLUIDA", aprovado_por: user.id, aprovado_em: new Date().toISOString(), motivo_reprovacao: null })
    .eq("id", id);
  revalidatePath(`/manutencoes/os/${id}`);
  revalidatePath("/manutencoes/historico");
}

export async function reprovarOS(formData: FormData) {
  const { supabase } = await exigirAprovador();
  const id = String(formData.get("id"));
  const motivo = String(formData.get("motivo") || "").trim() || null;
  const negarGarantia = String(formData.get("negarGarantia")) === "1";
  await supabase
    .from("manutencao_os")
    .update({
      status: negarGarantia ? "GARANTIA_NEGADA" : "EM_ANDAMENTO",
      motivo_reprovacao: motivo,
      aprovado_por: null,
      aprovado_em: null,
    })
    .eq("id", id);
  revalidatePath(`/manutencoes/os/${id}`);
}

export async function cancelarOS(formData: FormData) {
  const { supabase } = await exigirExecutor();
  const id = String(formData.get("id"));
  await supabase.from("manutencao_os").update({ status: "CANCELADA" }).eq("id", id);
  revalidatePath(`/manutencoes/os/${id}`);
  revalidatePath("/manutencoes/os");
}

export async function enviarAnexo(formData: FormData) {
  const { supabase, user } = await exigirExecutor();
  const osId = String(formData.get("osId"));
  const tipo = String(formData.get("tipo") || "DOCUMENTO");
  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo || arquivo.size === 0) return;

  const nomeSanitizado = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${osId}/${tipo}/${Date.now()}-${nomeSanitizado}`;

  const { error } = await supabase.storage.from("manutencao-anexos").upload(path, arquivo, {
    contentType: arquivo.type || "application/octet-stream",
    upsert: false,
  });
  if (error) {
    redirect(`/manutencoes/os/${osId}?erro=${encodeURIComponent("Falha ao enviar anexo: " + error.message)}`);
  }

  await supabase.from("manutencao_anexos").insert({
    os_id: osId,
    tipo,
    storage_path: path,
    nome_arquivo: arquivo.name,
    enviado_por: user.id,
  });

  revalidatePath(`/manutencoes/os/${osId}`);
}

export async function excluirAnexo(formData: FormData) {
  const { supabase } = await exigirExecutor();
  const id = String(formData.get("id"));
  const osId = String(formData.get("osId"));

  const { data: anexo } = await supabase.from("manutencao_anexos").select("storage_path").eq("id", id).single();
  await supabase.from("manutencao_anexos").delete().eq("id", id);
  if (anexo?.storage_path) {
    await supabase.storage.from("manutencao-anexos").remove([anexo.storage_path]);
  }
  revalidatePath(`/manutencoes/os/${osId}`);
}
