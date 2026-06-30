"use server";

import { createClient } from "@/lib/supabase/server";
import { notificarAdmins } from "@/lib/push/send";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function exigirAprovado() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase.from("perfis").select("status,nome_completo").eq("id", user.id).single();
  if (!perfil || perfil.status !== "aprovado") throw new Error("Cadastro não aprovado.");
  return { supabase, user, nome: perfil.nome_completo as string };
}

async function exigirAdmin() {
  const { supabase, user } = await exigirAprovado();
  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user.id).single();
  if (!perfil || perfil.setor !== "ADMIN") throw new Error("Apenas o ADM pode realizar esta ação.");
  return { supabase, user };
}

function calcular(tipo: string, comprimento: number, altura: number, qtd: number, adicional: number, valorUnitario: number) {
  if (tipo === "diaria" || tipo === "unidade") {
    return { quantidade: qtd, bruto: qtd * valorUnitario, detalhe: `${qtd} ${tipo === "diaria" ? "diária(s)" : "unidade(s)"}` };
  }
  if (tipo === "linear") {
    const bruto = comprimento * valorUnitario + adicional;
    return { quantidade: comprimento, bruto, detalhe: `${comprimento} m (linear)${adicional ? ` + R$ ${adicional} adicional` : ""}` };
  }
  const area = comprimento * altura;
  const bruto = area * valorUnitario + adicional;
  return { quantidade: area, bruto, detalhe: `${area.toFixed(2)} m²${adicional ? ` + R$ ${adicional} adicional` : ""}` };
}

export async function criarLancamento(formData: FormData) {
  const { supabase, user, nome } = await exigirAprovado();

  const obraId = String(formData.get("obraId"));
  const pessoaId = String(formData.get("pessoaId"));
  const tipoLancamento = String(formData.get("tipoLancamento")); // MEDICAO | VALE | VALE_MEDICAO
  const data = String(formData.get("data") || new Date().toISOString().slice(0, 10));
  const mesReferencia = data.slice(0, 7);
  const local = String(formData.get("local") || "(sem local)");

  const { data: pessoa } = await supabase.from("pessoas").select("nome").eq("id", pessoaId).single();
  const empreiteiroNome = pessoa?.nome ?? "?";

  const { data: vigente } = await supabase
    .from("retencoes_pessoa")
    .select("percent")
    .eq("pessoa_id", pessoaId)
    .lte("mes", mesReferencia)
    .order("mes", { ascending: false })
    .limit(1);
  const pct = vigente && vigente[0] ? Number(vigente[0].percent) : 0;

  // Vale + Medição: lançamento híbrido — um Vale (adiantamento da próxima medição,
  // sem retenção) e uma Medição Complementar (regularização de um período anterior)
  // registrados juntos. A Medição Complementar é gravada nos MESMOS campos que uma
  // medição normal (total_reais = bruto, retencao_pct_usado = % vigente), para que
  // ela siga exatamente o mesmo tratamento financeiro de qualquer outra medição
  // (retenção calculada no fechamento, saldo retido, relatórios). O valor do Vale
  // fica isolado em valor_vale_hibrido, para entrar só no Vale do Mês da Obra.
  if (tipoLancamento === "VALE_MEDICAO") {
    const valorVale = parseFloat(String(formData.get("valorValeHibrido") || "0")) || 0;
    const valorBrutoMedicao = parseFloat(String(formData.get("valorBrutoMedicaoComplementar") || "0")) || 0;
    const observacaoMedicao = String(formData.get("observacaoMedicao") || "").trim() || null;

    await supabase.from("lancamentos").insert({
      obra_id: obraId, pessoa_id: pessoaId, tipo: "VALE_MEDICAO", data, mes_referencia: mesReferencia,
      servico: "Medição complementar", local, detalhe_texto: observacaoMedicao ?? "Medição complementar (regularização de período anterior)",
      retencao_pct_usado: pct, total_reais: valorBrutoMedicao, valor_vale_hibrido: valorVale,
      observacao_medicao: observacaoMedicao, status: "PENDENTE", criado_por: user.id, vale_real: false,
    });
    revalidatePath("/lancamentos");
    notificarAdmins({ title: "Novo lançamento pendente", body: `${nome} lançou Vale+Medição para ${empreiteiroNome}`, url: "/admin/aprovacoes" }).catch(() => null);
    return;
  }

  if (tipoLancamento === "VALE" && String(formData.get("valeReal")) === "1") {
    const valor = parseFloat(String(formData.get("valorValeReal") || "0")) || 0;
    await supabase.from("lancamentos").insert({
      obra_id: obraId, pessoa_id: pessoaId, tipo: "VALE", data, mes_referencia: mesReferencia,
      total_reais: valor, status: "PENDENTE", criado_por: user.id, vale_real: true,
      detalhe_texto: `Vale real (${empreiteiroNome})`,
    });
    revalidatePath("/lancamentos");
    notificarAdmins({ title: "Novo vale pendente", body: `${nome} lançou vale para ${empreiteiroNome}`, url: "/admin/aprovacoes" }).catch(() => null);
    return;
  }

  const servicoId = String(formData.get("servicoId"));
  const { data: servico } = await supabase.from("servicos").select("nome, tipo, valor_unitario").eq("id", servicoId).single();
  if (!servico) return;

  const comprimento = parseFloat(String(formData.get("comprimento") || "0")) || 0;
  const altura = parseFloat(String(formData.get("altura") || "0")) || 0;
  const qtd = parseFloat(String(formData.get("qtd") || "0")) || 0;
  const adicional = parseFloat(String(formData.get("adicional") || "0")) || 0;

  const { quantidade, bruto, detalhe } = calcular(servico.tipo, comprimento, altura, qtd, adicional, Number(servico.valor_unitario));

  if (tipoLancamento === "VALE") {
    const retido = bruto * pct;
    const liquido = bruto - retido;
    await supabase.from("lancamentos").insert({
      obra_id: obraId, pessoa_id: pessoaId, tipo: "VALE", data, mes_referencia: mesReferencia,
      servico: servico.nome, local, quantidade, detalhe_texto: detalhe,
      valor_unitario_usado: servico.valor_unitario, valor_bruto: bruto, retencao_item: retido,
      retencao_pct_usado: pct, total_reais: liquido, status: "PENDENTE", criado_por: user.id, vale_real: false,
    });
  } else {
    await supabase.from("lancamentos").insert({
      obra_id: obraId, pessoa_id: pessoaId, tipo: "MEDICAO", data, mes_referencia: mesReferencia,
      servico: servico.nome, local, quantidade, detalhe_texto: detalhe,
      valor_unitario_usado: servico.valor_unitario, retencao_pct_usado: pct,
      total_reais: bruto, status: "PENDENTE", criado_por: user.id,
    });
  }

  revalidatePath("/lancamentos");
  notificarAdmins({ title: "Novo lançamento pendente", body: `${nome} lançou medição para ${empreiteiroNome}`, url: "/admin/aprovacoes" }).catch(() => null);
}

export async function aprovarLancamento(formData: FormData) {
  const { supabase, user } = await exigirAdmin();
  const id = String(formData.get("id"));
  // A aprovação é definitiva: a partir daqui o lançamento fica travado para
  // edição/exclusão pelo estagiário (ver editarLancamento/excluirLancamento).
  await supabase
    .from("lancamentos")
    .update({ status: "APROVADO", aprovado_em: new Date().toISOString(), aprovado_por: user.id })
    .eq("id", id);
  revalidatePath("/lancamentos");
}

export async function rejeitarLancamento(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(formData.get("id"));
  await supabase.from("lancamentos").update({ status: "REJEITADO" }).eq("id", id);
  revalidatePath("/lancamentos");
}

// Edição: só o estagiário que criou o lançamento (ou o ADM) pode editar, e só
// enquanto o status for PENDENTE — depois de aprovado, o lançamento fica
// congelado para preservar a integridade do histórico financeiro. Reaproveita
// o mesmo cálculo de bruto/retenção usado na criação, para que o valor editado
// siga exatamente a mesma regra de negócio de um lançamento novo.
export async function editarLancamento(formData: FormData) {
  const { supabase, user } = await exigirAprovado();
  const id = String(formData.get("id"));
  const obraId = String(formData.get("obraId"));

  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user.id).single();
  const ehAdmin = perfil?.setor === "ADMIN";

  const { data: atual } = await supabase
    .from("lancamentos")
    .select("status, criado_por")
    .eq("id", id)
    .single();

  if (!atual) {
    redirect(`/lancamentos?obra=${obraId}&erro=${encodeURIComponent("Lançamento não encontrado.")}`);
  }
  if (atual!.status !== "PENDENTE") {
    redirect(
      `/lancamentos?obra=${obraId}&erro=${encodeURIComponent(
        "Esta medição já foi aprovada pelo administrador e não pode mais ser alterada ou excluída."
      )}`
    );
  }
  if (!ehAdmin && atual!.criado_por !== user.id) {
    redirect(`/lancamentos?obra=${obraId}&erro=${encodeURIComponent("Você só pode editar lançamentos criados por você.")}`);
  }

  const pessoaId = String(formData.get("pessoaId"));
  const tipoLancamento = String(formData.get("tipoLancamento"));
  const data = String(formData.get("data") || new Date().toISOString().slice(0, 10));
  const mesReferencia = data.slice(0, 7);
  const local = String(formData.get("local") || "(sem local)");

  const { data: pessoa } = await supabase.from("pessoas").select("nome").eq("id", pessoaId).single();
  const empreiteiroNome = pessoa?.nome ?? "?";

  const { data: vigente } = await supabase
    .from("retencoes_pessoa")
    .select("percent")
    .eq("pessoa_id", pessoaId)
    .lte("mes", mesReferencia)
    .order("mes", { ascending: false })
    .limit(1);
  const pct = vigente && vigente[0] ? Number(vigente[0].percent) : 0;

  const editAudit = { editado_em: new Date().toISOString(), editado_por: user.id };

  if (tipoLancamento === "VALE_MEDICAO") {
    const valorVale = parseFloat(String(formData.get("valorValeHibrido") || "0")) || 0;
    const valorBrutoMedicao = parseFloat(String(formData.get("valorBrutoMedicaoComplementar") || "0")) || 0;
    const observacaoMedicao = String(formData.get("observacaoMedicao") || "").trim() || null;

    await supabase.from("lancamentos").update({
      pessoa_id: pessoaId, tipo: "VALE_MEDICAO", data, mes_referencia: mesReferencia,
      servico: "Medição complementar", local, detalhe_texto: observacaoMedicao ?? "Medição complementar (regularização de período anterior)",
      retencao_pct_usado: pct, total_reais: valorBrutoMedicao, valor_vale_hibrido: valorVale,
      observacao_medicao: observacaoMedicao, vale_real: false,
      quantidade: null, valor_unitario_usado: null, valor_bruto: null, retencao_item: null,
      ...editAudit,
    }).eq("id", id);
    revalidatePath("/lancamentos");
    redirect(`/lancamentos?obra=${obraId}`);
  }

  if (tipoLancamento === "VALE" && String(formData.get("valeReal")) === "1") {
    const valor = parseFloat(String(formData.get("valorValeReal") || "0")) || 0;
    await supabase.from("lancamentos").update({
      pessoa_id: pessoaId, tipo: "VALE", data, mes_referencia: mesReferencia,
      total_reais: valor, vale_real: true, detalhe_texto: `Vale real (${empreiteiroNome})`,
      servico: null, local: null, quantidade: null, valor_unitario_usado: null, valor_bruto: null,
      retencao_item: null, valor_vale_hibrido: null, observacao_medicao: null,
      ...editAudit,
    }).eq("id", id);
    revalidatePath("/lancamentos");
    redirect(`/lancamentos?obra=${obraId}`);
  }

  const servicoId = String(formData.get("servicoId"));
  const { data: servico } = await supabase.from("servicos").select("nome, tipo, valor_unitario").eq("id", servicoId).single();
  if (!servico) {
    redirect(`/lancamentos?obra=${obraId}&erro=${encodeURIComponent("Selecione um serviço válido.")}`);
  }

  const comprimento = parseFloat(String(formData.get("comprimento") || "0")) || 0;
  const altura = parseFloat(String(formData.get("altura") || "0")) || 0;
  const qtd = parseFloat(String(formData.get("qtd") || "0")) || 0;
  const adicional = parseFloat(String(formData.get("adicional") || "0")) || 0;

  const { quantidade, bruto, detalhe } = calcular(servico!.tipo, comprimento, altura, qtd, adicional, Number(servico!.valor_unitario));

  if (tipoLancamento === "VALE") {
    const retido = bruto * pct;
    const liquido = bruto - retido;
    await supabase.from("lancamentos").update({
      pessoa_id: pessoaId, tipo: "VALE", data, mes_referencia: mesReferencia,
      servico: servico!.nome, local, quantidade, detalhe_texto: detalhe,
      valor_unitario_usado: servico!.valor_unitario, valor_bruto: bruto, retencao_item: retido,
      retencao_pct_usado: pct, total_reais: liquido, vale_real: false,
      valor_vale_hibrido: null, observacao_medicao: null,
      ...editAudit,
    }).eq("id", id);
  } else {
    await supabase.from("lancamentos").update({
      pessoa_id: pessoaId, tipo: "MEDICAO", data, mes_referencia: mesReferencia,
      servico: servico!.nome, local, quantidade, detalhe_texto: detalhe,
      valor_unitario_usado: servico!.valor_unitario, retencao_pct_usado: pct,
      total_reais: bruto, vale_real: false,
      valor_bruto: null, retencao_item: null, valor_vale_hibrido: null, observacao_medicao: null,
      ...editAudit,
    }).eq("id", id);
  }

  revalidatePath("/lancamentos");
  redirect(`/lancamentos?obra=${obraId}`);
}

export async function excluirLancamento(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(formData.get("id"));

  // O ADM pode excluir qualquer lançamento, em qualquer status (PENDENTE, APROVADO
  // ou REJEITADO), inclusive um que já tenha entrado num fechamento mensal já
  // enviado por PDF/email — por exemplo, para corrigir um clique errado ou um
  // lançamento de teste. A confirmação na tela (ConfirmDeleteButton) já avisa
  // o ADM quando o lançamento em questão faz parte de um mês já fechado, para
  // que ele saiba que o PDF já enviado não será atualizado automaticamente.
  await supabase.from("lancamentos").delete().eq("id", id);
  revalidatePath("/lancamentos");
}

export async function excluirLancamentoProprio(formData: FormData) {
  const { supabase, user } = await exigirAprovado();
  const id = String(formData.get("id"));
  const obraId = String(formData.get("obraId"));

  const { data: atual } = await supabase
    .from("lancamentos")
    .select("status, criado_por")
    .eq("id", id)
    .single();

  if (!atual || atual.criado_por !== user.id) {
    redirect(`/lancamentos?obra=${obraId}&erro=${encodeURIComponent("Você só pode excluir lançamentos criados por você.")}`);
  }
  if (atual!.status !== "PENDENTE") {
    redirect(
      `/lancamentos?obra=${obraId}&erro=${encodeURIComponent(
        "Esta medição já foi aprovada pelo administrador e não pode mais ser alterada ou excluída."
      )}`
    );
  }

  await supabase.from("lancamentos").delete().eq("id", id);
  revalidatePath("/lancamentos");
}
