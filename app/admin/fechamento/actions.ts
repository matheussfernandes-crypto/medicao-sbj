"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { FolhaMedicaoPdf, FolhaValePdf, type ItemMedicao, type ResumoMedicao, type ItemVale, type ResumoVale } from "@/lib/pdf/FolhaPdf";
import { getResend } from "@/lib/email/resend";

async function exigirAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase
    .from("perfis")
    .select("setor, status, nome_completo")
    .eq("id", user!.id)
    .single();
  if (!perfil || perfil.status !== "aprovado" || perfil.setor !== "ADMIN") redirect("/dashboard");
  return { supabase, userId: user!.id, engenheiroNome: perfil.nome_completo as string };
}

function hoje() {
  return new Date().toLocaleDateString("pt-BR");
}

export async function salvarConfigNotificacao(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const email1 = String(formData.get("email1") || "").trim() || null;
  const email2 = String(formData.get("email2") || "").trim() || null;
  const email3 = String(formData.get("email3") || "").trim() || null;
  const email4 = String(formData.get("email4") || "").trim() || null;
  await supabase
    .from("configuracoes_notificacao")
    .update({ email_1: email1, email_2: email2, email_3: email3, email_4: email4 })
    .eq("id", 1);
  revalidatePath("/admin/fechamento");
}

async function obterMestre(supabase: any, obraId: string) {
  const { data } = await supabase
    .from("pessoas")
    .select("nome")
    .eq("obra_id", obraId)
    .eq("papel", "MESTRE")
    .eq("status", "ATIVO")
    .limit(1)
    .maybeSingle();
  return data?.nome ?? null;
}

async function obterNomesLancadores(supabase: any, criadoPorIds: string[]): Promise<string[]> {
  if (!criadoPorIds.length) return [];
  const { data } = await supabase.from("perfis").select("id, nome_completo").in("id", criadoPorIds);
  const nomes: string[] = (data ?? []).map((c: any) => c.nome_completo).filter(Boolean);
  return Array.from(new Set(nomes));
}

// Salva o PDF já gerado no Storage para poder ser baixado depois pelo site,
// sem depender só do email enviado na hora do fechamento.
async function salvarPdfNoStorage(supabase: any, tipo: "medicao" | "vale", obraId: string, mes: string, buffer: Buffer) {
  const path = `${tipo}/${obraId}/${mes}-${Date.now()}.pdf`;
  const { error } = await supabase.storage.from("fechamentos-pdfs").upload(path, buffer, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) {
    console.error("Falha ao salvar PDF no storage:", error.message);
    return null;
  }
  return path;
}

export async function excluirFechamento(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(formData.get("id"));

  const { data: fechamento } = await supabase.from("fechamentos").select("pdf_path").eq("id", id).single();

  await supabase.from("fechamentos").delete().eq("id", id);

  if (fechamento?.pdf_path) {
    await supabase.storage.from("fechamentos-pdfs").remove([fechamento.pdf_path]);
  }

  // Excluir o registro do histórico libera aquele mês/obra/tipo para ser fechado de novo
  // (o fechamento original verifica se já existe um registro antes de gerar um novo PDF).
  revalidatePath("/admin/fechamento");
}

export async function finalizarFechamentoMedicao(formData: FormData) {
  const { supabase, userId, engenheiroNome } = await exigirAdmin();
  const obraId = String(formData.get("obraId"));
  const mes = String(formData.get("mes"));

  const { data: jaFechado } = await supabase
    .from("fechamentos")
    .select("id")
    .eq("obra_id", obraId).eq("tipo", "MEDICAO").eq("mes_referencia", mes)
    .maybeSingle();
  if (jaFechado) {
    redirect(`/admin/fechamento?obra=${obraId}&mes=${mes}&erro=${encodeURIComponent("Essa medição já foi fechada neste mês. Veja o histórico abaixo.")}`);
  }

  const { data: obra } = await supabase.from("obras").select("nome").eq("id", obraId).single();
  if (!obra) redirect(`/admin/fechamento?erro=${encodeURIComponent("Obra não encontrada.")}`);

  const { data: lista } = await supabase
    .from("lancamentos")
    .select("id, tipo, pessoa_id, servico, local, detalhe_texto, valor_unitario_usado, quantidade, total_reais, valor_vale_hibrido, retencao_pct_usado, vale_real, criado_por")
    .eq("obra_id", obraId).eq("mes_referencia", mes).eq("status", "APROVADO");

  const todos = lista ?? [];
  // A Medição Complementar de um lançamento "Vale + Medição" NÃO entra como item
  // aqui: ela já é paga (líquida) junto com o vale, no fechamento de Vale do mês.
  // Mas a parte do Vale desse mesmo lançamento (valor_vale_hibrido) funciona como
  // um Vale Real normal — é um adiantamento para a PRÓXIMA medição — e por isso
  // continua sendo descontada do total a pagar aqui, igual a qualquer Vale Real.
  const medicoes = todos.filter((l) => l.tipo === "MEDICAO");
  const valesReais = todos.filter((l) => (l.tipo === "VALE" && l.vale_real) || l.tipo === "VALE_MEDICAO");

  if (!medicoes.length) {
    redirect(`/admin/fechamento?obra=${obraId}&mes=${mes}&erro=${encodeURIComponent("Nenhuma medição aprovada nesse mês/obra para fechar.")}`);
  }

  const pessoaIds = Array.from(new Set(todos.map((l) => l.pessoa_id)));
  const { data: pessoas } = pessoaIds.length
    ? await supabase.from("pessoas").select("id, nome").in("id", pessoaIds)
    : { data: [] as any[] };
  const nomePessoa: Record<string, string> = {};
  for (const p of pessoas ?? []) nomePessoa[p.id] = p.nome;

  const lancadores = await obterNomesLancadores(
    supabase,
    Array.from(new Set(medicoes.map((l) => l.criado_por).filter(Boolean))) as string[]
  );
  const mestreNome = await obterMestre(supabase, obraId);

  const itens: ItemMedicao[] = medicoes.map((l) => ({
    empreiteiro: nomePessoa[l.pessoa_id] ?? "—",
    servico: l.servico ?? "—",
    local: l.local ?? "—",
    valorUnitario: Number(l.valor_unitario_usado ?? 0),
    quantidadeTexto: l.detalhe_texto ?? String(l.quantidade ?? ""),
    total: Number(l.total_reais),
  }));

  const porPessoa: Record<string, { nome: string; total: number; pct: number; vale: number }> = {};
  for (const l of medicoes) {
    const pid = l.pessoa_id;
    if (!porPessoa[pid]) porPessoa[pid] = { nome: nomePessoa[pid] ?? "—", total: 0, pct: Number(l.retencao_pct_usado ?? 0), vale: 0 };
    porPessoa[pid].total += Number(l.total_reais);
  }
  for (const l of valesReais) {
    const pid = l.pessoa_id;
    if (!porPessoa[pid]) porPessoa[pid] = { nome: nomePessoa[pid] ?? "—", total: 0, pct: 0, vale: 0 };
    // No lançamento híbrido, total_reais é a Medição Complementar (não entra aqui);
    // o valor do vale propriamente dito está em valor_vale_hibrido.
    porPessoa[pid].vale += l.tipo === "VALE_MEDICAO" ? Number(l.valor_vale_hibrido ?? 0) : Number(l.total_reais);
  }

  const resumo: ResumoMedicao[] = Object.values(porPessoa).map((p) => {
    const retido = p.total * p.pct;
    return { nome: p.nome, retido, pct: p.pct, total: p.total, vale: p.vale, totalPagar: p.total - retido - p.vale };
  });

  const somaTotal = resumo.reduce((s, r) => s + r.total, 0);
  const somaRetido = resumo.reduce((s, r) => s + r.retido, 0);
  const somaVale = resumo.reduce((s, r) => s + r.vale, 0);
  const somaPagar = resumo.reduce((s, r) => s + r.totalPagar, 0);

  const buffer = await renderToBuffer(
    FolhaMedicaoPdf({
      obraNome: obra!.nome,
      mes,
      itens,
      resumo,
      somaTotal,
      somaRetido,
      somaVale,
      somaPagar,
      mestreNome,
      lancadores,
      engenheiroNome,
      dataGeracao: hoje(),
    })
  );

  const { data: config } = await supabase.from("configuracoes_notificacao").select("email_1, email_2, email_3, email_4").eq("id", 1).single();
  const destinatarios = [config?.email_1, config?.email_2, config?.email_3, config?.email_4].filter(Boolean) as string[];

  // O retorno do Resend é { data, error } — ele NÃO lança exceção quando o envio
  // falha (domínio não verificado, destinatário inválido, limite da conta etc.).
  // Por isso é preciso checar "error" manualmente; sem isso o fechamento sempre
  // dizia "enviado por email" mesmo quando o email nunca saiu de fato.
  let emailErro: string | null = null;
  if (destinatarios.length) {
    const resend = getResend();
    if (resend) {
      const { error } = await resend.emails.send({
        from: "Medição SBJ <medicao@resend.dev>",
        to: destinatarios,
        subject: `Medição ${obra!.nome} — ${mes}`,
        html: `<p>Segue em anexo o relatório de medição da obra <b>${obra!.nome}</b>, referente a ${mes}, fechado por ${engenheiroNome}.</p>`,
        attachments: [{ filename: `medicao-${obra!.nome}-${mes}.pdf`, content: buffer.toString("base64") }],
      });
      if (error) {
        console.error("Falha ao enviar email de fechamento de medição:", error);
        emailErro = error.message || "Falha desconhecida no envio do email.";
      }
    } else {
      emailErro = "RESEND_API_KEY não configurada no servidor.";
    }
  }

  const pdfPath = await salvarPdfNoStorage(supabase, "medicao", obraId, mes, buffer);

  await supabase.from("fechamentos").insert({
    obra_id: obraId,
    tipo: "MEDICAO",
    mes_referencia: mes,
    fechado_por: userId,
    email_enviado_para: destinatarios.length && !emailErro ? destinatarios.join(", ") : null,
    pdf_path: pdfPath,
  });

  revalidatePath("/admin/fechamento");
  const mensagem = emailErro
    ? `Medição fechada, mas o email FALHOU: ${emailErro}. O PDF foi salvo e pode ser baixado no histórico abaixo.`
    : destinatarios.length
      ? "Medição fechada e PDF enviado por email."
      : "Medição fechada. Nenhum email configurado para envio.";
  const paramTipo = emailErro ? "erro" : "sucesso";
  redirect(`/admin/fechamento?obra=${obraId}&mes=${mes}&${paramTipo}=${encodeURIComponent(mensagem)}`);
}

export async function finalizarFechamentoVale(formData: FormData) {
  const { supabase, userId, engenheiroNome } = await exigirAdmin();
  const obraId = String(formData.get("obraId"));
  const mes = String(formData.get("mes"));

  const { data: jaFechado } = await supabase
    .from("fechamentos")
    .select("id")
    .eq("obra_id", obraId).eq("tipo", "VALE").eq("mes_referencia", mes)
    .maybeSingle();
  if (jaFechado) {
    redirect(`/admin/fechamento?obra=${obraId}&mes=${mes}&erro=${encodeURIComponent("Esse vale já foi fechado neste mês. Veja o histórico abaixo.")}`);
  }

  const { data: obra } = await supabase.from("obras").select("nome").eq("id", obraId).single();
  if (!obra) redirect(`/admin/fechamento?erro=${encodeURIComponent("Obra não encontrada.")}`);

  const { data: lista } = await supabase
    .from("lancamentos")
    .select("id, tipo, pessoa_id, servico, detalhe_texto, total_reais, valor_vale_hibrido, valor_bruto, retencao_item, retencao_pct_usado, vale_real, criado_por")
    .eq("obra_id", obraId).eq("mes_referencia", mes).in("tipo", ["VALE", "VALE_MEDICAO"]).eq("status", "APROVADO");

  // Lançamentos "Vale + Medição" entram aqui inteiros: o vale (valor_vale_hibrido, sem
  // retenção) e a Medição Complementar (total_reais bruto, com sua própria retenção)
  // são pagos juntos neste fechamento — é o serviço atrasado sendo regularizado no vale.
  const vales = lista ?? [];
  if (!vales.length) {
    redirect(`/admin/fechamento?obra=${obraId}&mes=${mes}&erro=${encodeURIComponent("Nenhum vale aprovado nesse mês/obra para fechar.")}`);
  }

  const pessoaIds = Array.from(new Set(vales.map((l) => l.pessoa_id)));
  const { data: pessoas } = pessoaIds.length
    ? await supabase.from("pessoas").select("id, nome").in("id", pessoaIds)
    : { data: [] as any[] };
  const nomePessoa: Record<string, string> = {};
  for (const p of pessoas ?? []) nomePessoa[p.id] = p.nome;

  const lancadores = await obterNomesLancadores(
    supabase,
    Array.from(new Set(vales.map((l) => l.criado_por).filter(Boolean))) as string[]
  );
  const mestreNome = await obterMestre(supabase, obraId);

  const itens: ItemVale[] = vales.map((l) => {
    if (l.tipo === "VALE_MEDICAO") {
      const bruto = Number(l.total_reais);
      const retido = bruto * Number(l.retencao_pct_usado ?? 0);
      const liquido = bruto - retido;
      const valorVale = Number(l.valor_vale_hibrido ?? 0);
      return {
        empreiteiro: nomePessoa[l.pessoa_id] ?? "—",
        descricao: l.detalhe_texto ?? "Vale + Medição",
        ehCorrecao: false,
        hibrido: true,
        valorValeHibrido: valorVale,
        medicaoComplementarBruto: bruto,
        medicaoComplementarRetido: retido,
        medicaoComplementarLiquido: liquido,
        total: valorVale + liquido,
      };
    }
    return {
      empreiteiro: nomePessoa[l.pessoa_id] ?? "—",
      descricao: l.detalhe_texto ?? l.servico ?? "Vale de correção",
      ehCorrecao: !l.vale_real,
      total: Number(l.total_reais),
    };
  });

  const porPessoa: Record<string, { nome: string; valeReal: number; correcaoBruto: number; correcaoRetido: number; correcaoLiquido: number }> = {};
  for (const l of vales) {
    const pid = l.pessoa_id;
    if (!porPessoa[pid]) porPessoa[pid] = { nome: nomePessoa[pid] ?? "—", valeReal: 0, correcaoBruto: 0, correcaoRetido: 0, correcaoLiquido: 0 };
    if (l.tipo === "VALE_MEDICAO") {
      // Vale (sem retenção) entra em valeReal. A Medição Complementar entra nas
      // colunas de Correção/Med. Compl. (bruto, retenção do item, líquido) — ela é
      // uma medição normal sendo paga aqui, junto com o vale, e não no fechamento
      // de medição do mês.
      const bruto = Number(l.total_reais);
      const retido = bruto * Number(l.retencao_pct_usado ?? 0);
      porPessoa[pid].valeReal += Number(l.valor_vale_hibrido ?? 0);
      porPessoa[pid].correcaoBruto += bruto;
      porPessoa[pid].correcaoRetido += retido;
      porPessoa[pid].correcaoLiquido += bruto - retido;
    } else if (l.vale_real) {
      porPessoa[pid].valeReal += Number(l.total_reais);
    } else {
      porPessoa[pid].correcaoBruto += Number(l.valor_bruto ?? l.total_reais);
      porPessoa[pid].correcaoRetido += Number(l.retencao_item ?? 0);
      porPessoa[pid].correcaoLiquido += Number(l.total_reais);
    }
  }

  const resumo: ResumoVale[] = Object.values(porPessoa).map((p) => ({
    ...p,
    totalGeral: p.valeReal + p.correcaoLiquido,
  }));

  const somaReal = resumo.reduce((s, r) => s + r.valeReal, 0);
  const somaCorrecaoBruto = resumo.reduce((s, r) => s + r.correcaoBruto, 0);
  const somaCorrecaoRetido = resumo.reduce((s, r) => s + r.correcaoRetido, 0);
  const somaCorrecaoLiquido = resumo.reduce((s, r) => s + r.correcaoLiquido, 0);
  const somaGeral = resumo.reduce((s, r) => s + r.totalGeral, 0);

  const buffer = await renderToBuffer(
    FolhaValePdf({
      obraNome: obra!.nome,
      mes,
      itens,
      resumo,
      somaReal,
      somaCorrecaoBruto,
      somaCorrecaoRetido,
      somaCorrecaoLiquido,
      somaGeral,
      mestreNome,
      lancadores,
      engenheiroNome,
      dataGeracao: hoje(),
    })
  );

  const { data: config } = await supabase.from("configuracoes_notificacao").select("email_1, email_2, email_3, email_4").eq("id", 1).single();
  const destinatarios = [config?.email_1, config?.email_2, config?.email_3, config?.email_4].filter(Boolean) as string[];

  let emailErro: string | null = null;
  if (destinatarios.length) {
    const resend = getResend();
    if (resend) {
      const { error } = await resend.emails.send({
        from: "Medição SBJ <medicao@resend.dev>",
        to: destinatarios,
        subject: `Vales ${obra!.nome} — ${mes}`,
        html: `<p>Segue em anexo o relatório de vales da obra <b>${obra!.nome}</b>, referente a ${mes}, fechado por ${engenheiroNome}.</p>`,
        attachments: [{ filename: `vales-${obra!.nome}-${mes}.pdf`, content: buffer.toString("base64") }],
      });
      if (error) {
        console.error("Falha ao enviar email de fechamento de vale:", error);
        emailErro = error.message || "Falha desconhecida no envio do email.";
      }
    } else {
      emailErro = "RESEND_API_KEY não configurada no servidor.";
    }
  }

  const pdfPath = await salvarPdfNoStorage(supabase, "vale", obraId, mes, buffer);

  await supabase.from("fechamentos").insert({
    obra_id: obraId,
    tipo: "VALE",
    mes_referencia: mes,
    fechado_por: userId,
    email_enviado_para: destinatarios.length && !emailErro ? destinatarios.join(", ") : null,
    pdf_path: pdfPath,
  });

  revalidatePath("/admin/fechamento");
  const mensagem = emailErro
    ? `Vales fechados, mas o email FALHOU: ${emailErro}. O PDF foi salvo e pode ser baixado no histórico abaixo.`
    : destinatarios.length
      ? "Vales fechados e PDF enviado por email."
      : "Vales fechados. Nenhum email configurado para envio.";
  const paramTipo = emailErro ? "erro" : "sucesso";
  redirect(`/admin/fechamento?obra=${obraId}&mes=${mes}&${paramTipo}=${encodeURIComponent(mensagem)}`);
}
