"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notificarAdmins, notificarUsuarios } from "@/lib/push/send";
import {
  SETORES_LANCAM_CONTRATO,
  TIPO_LANC_LABEL,
  parseNum,
  retencaoVigente,
  arred,
  brl,
  num,
  mesLabel,
  EPS,
} from "@/lib/contratos/util";
import { calcularBoletim } from "@/lib/contratos/boletim";

export type Resultado = { erro?: string; ok?: string; id?: string };

// ─── Helpers ────────────────────────────────────────────────────────────────

async function perfilAtual() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase
    .from("perfis")
    .select("setor, status, nome_completo")
    .eq("id", user.id)
    .single();
  if (!perfil || perfil.status !== "aprovado") return null;
  return { supabase, userId: user.id, setor: perfil.setor as string, nome: (perfil.nome_completo ?? "") as string, ehAdmin: perfil.setor === "ADMIN" };
}

function revalidarTudo(contratoId?: string) {
  revalidatePath("/contratos");
  revalidatePath("/contratos/medicoes");
  revalidatePath("/contratos/aprovacoes");
  revalidatePath("/contratos/fechamento");
  if (contratoId) revalidatePath(`/contratos/${contratoId}`);
}

function txt(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}

async function contratoInfo(supabase: any, contratoId: string) {
  const { data } = await supabase
    .from("contratos")
    .select("id, numero, objeto, status, obras(nome), empresas_terceirizadas(nome)")
    .eq("id", contratoId)
    .single();
  if (!data) return null;
  return {
    ...data,
    obra_nome: data.obras?.nome ?? "—",
    empresa_nome: data.empresas_terceirizadas?.nome ?? "—",
  };
}

async function mesFechado(supabase: any, contratoId: string, mes: string) {
  const { data } = await supabase
    .from("contrato_fechamentos")
    .select("id")
    .eq("contrato_id", contratoId)
    .eq("mes_referencia", mes)
    .maybeSingle();
  return !!data;
}

// ─── Contrato (ADM) ─────────────────────────────────────────────────────────

export async function criarContrato(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p?.ehAdmin) return { erro: "Apenas o ADM pode cadastrar contratos." };
  const numero = txt(fd, "numero");
  const obraId = txt(fd, "obraId");
  const empresaId = txt(fd, "empresaId");
  const objeto = txt(fd, "objeto");
  if (!numero || !obraId || !empresaId || !objeto) return { erro: "Preencha número, empresa, obra e objeto." };

  const { data: existe } = await p.supabase.from("contratos").select("id").eq("numero", numero).maybeSingle();
  if (existe) return { erro: `Já existe um contrato com o número ${numero}.` };

  const { data, error } = await p.supabase
    .from("contratos")
    .insert({
      numero,
      obra_id: obraId,
      empresa_id: empresaId,
      objeto,
      data_inicio: txt(fd, "dataInicio") || null,
      data_termino: txt(fd, "dataTermino") || null,
      observacoes: txt(fd, "observacoes") || null,
      criado_por: p.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { erro: "Não foi possível salvar: " + (error?.message ?? "erro desconhecido") };

  const retPct = parseNum(fd.get("retencaoPct"));
  const inicio = txt(fd, "dataInicio");
  await p.supabase.from("contrato_retencoes").insert({
    contrato_id: data.id,
    vigente_desde: (inicio || new Date().toISOString()).slice(0, 7),
    percent: retPct,
    motivo: "Retenção inicial do contrato",
    alterado_por: p.userId,
  });

  revalidarTudo(data.id);
  return { ok: "Contrato cadastrado.", id: data.id };
}

export async function editarContrato(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p?.ehAdmin) return { erro: "Apenas o ADM pode editar contratos." };
  const id = txt(fd, "id");
  const numero = txt(fd, "numero");
  if (!numero) return { erro: "Informe o número do contrato." };
  const { data: existe } = await p.supabase.from("contratos").select("id").eq("numero", numero).neq("id", id).maybeSingle();
  if (existe) return { erro: `Já existe outro contrato com o número ${numero}.` };

  const { error } = await p.supabase
    .from("contratos")
    .update({
      numero,
      objeto: txt(fd, "objeto"),
      data_inicio: txt(fd, "dataInicio") || null,
      data_termino: txt(fd, "dataTermino") || null,
      status: txt(fd, "status") || "ATIVO",
      observacoes: txt(fd, "observacoes") || null,
    })
    .eq("id", id);
  if (error) return { erro: error.message };
  revalidarTudo(id);
  return { ok: "Contrato atualizado." };
}

// ─── Itens (ADM) ────────────────────────────────────────────────────────────

/** Adiciona um item ou vários colados do Excel (código ⇥ descrição ⇥ unidade ⇥ quantidade ⇥ valor unitário). */
export async function adicionarItens(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p?.ehAdmin) return { erro: "Apenas o ADM pode alterar itens do contrato." };
  const contratoId = txt(fd, "contratoId");
  const colado = txt(fd, "colado");

  const { data: ult } = await p.supabase
    .from("contrato_itens")
    .select("ordem")
    .eq("contrato_id", contratoId)
    .order("ordem", { ascending: false })
    .limit(1);
  let ordem = (ult?.[0]?.ordem ?? 0) + 1;

  const novos: any[] = [];
  if (colado) {
    const linhas = colado.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const [idx, linha] of linhas.entries()) {
      const c = linha.split(/\t|;/).map((x) => x.trim());
      if (c.length < 5) return { erro: `Linha ${idx + 1}: são esperadas 5 colunas (código, descrição, unidade, quantidade, valor unitário).` };
      const [codigo, descricao, unidade, qtd, vu] = c;
      const quantidade = parseNum(qtd);
      const valor = parseNum(vu.replace(/R\$\s?/, ""));
      if (!descricao) return { erro: `Linha ${idx + 1}: descrição vazia.` };
      novos.push({ contrato_id: contratoId, codigo: codigo || null, descricao, unidade: unidade || "un", quantidade_original: quantidade, quantidade, valor_unitario: valor, ordem: ordem++ });
    }
  } else {
    const descricao = txt(fd, "descricao");
    if (!descricao) return { erro: "Informe a descrição do serviço." };
    const quantidade = parseNum(fd.get("quantidade"));
    novos.push({
      contrato_id: contratoId,
      codigo: txt(fd, "codigo") || null,
      descricao,
      unidade: txt(fd, "unidade") || "un",
      quantidade_original: quantidade,
      quantidade,
      valor_unitario: parseNum(fd.get("valorUnitario")),
      ordem,
    });
  }
  if (!novos.length) return { erro: "Nenhum item para adicionar." };
  const { error } = await p.supabase.from("contrato_itens").insert(novos);
  if (error) return { erro: error.message };
  revalidarTudo(contratoId);
  return { ok: `${novos.length} item(ns) adicionado(s).` };
}

export async function editarItem(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p?.ehAdmin) return { erro: "Apenas o ADM pode alterar itens do contrato." };
  const id = txt(fd, "id");
  const contratoId = txt(fd, "contratoId");
  const { data: item } = await p.supabase.from("contrato_itens").select("*").eq("id", id).single();
  if (!item) return { erro: "Item não encontrado." };
  const { count } = await p.supabase
    .from("contrato_lancamento_itens")
    .select("id", { count: "exact", head: true })
    .eq("item_id", id);

  const quantidade = fd.has("quantidade") ? parseNum(fd.get("quantidade")) : Number(item.quantidade);
  const valor = fd.has("valorUnitario") ? parseNum(fd.get("valorUnitario")) : Number(item.valor_unitario);
  const mudouValores = Math.abs(quantidade - Number(item.quantidade)) > EPS || Math.abs(valor - Number(item.valor_unitario)) > EPS;
  if ((count ?? 0) > 0 && mudouValores) {
    return { erro: "Este item já tem medições. Para mudar quantidade ou valor, lance um aditivo." };
  }
  const update: any = {
    codigo: txt(fd, "codigo") || null,
    descricao: txt(fd, "descricao") || item.descricao,
    unidade: txt(fd, "unidade") || item.unidade,
    ativo: fd.get("ativo") === "1",
  };
  if (!(count ?? 0)) {
    update.quantidade = quantidade;
    update.quantidade_original = quantidade;
    update.valor_unitario = valor;
  }
  const { error } = await p.supabase.from("contrato_itens").update(update).eq("id", id);
  if (error) return { erro: error.message };
  revalidarTudo(contratoId);
  return { ok: "Item atualizado." };
}

export async function excluirItem(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p?.ehAdmin) return { erro: "Apenas o ADM pode excluir itens." };
  const id = txt(fd, "id");
  const contratoId = txt(fd, "contratoId");
  const { count } = await p.supabase
    .from("contrato_lancamento_itens")
    .select("id", { count: "exact", head: true })
    .eq("item_id", id);
  if ((count ?? 0) > 0) return { erro: "Item com medições não pode ser excluído. Desative-o." };
  const { count: ads } = await p.supabase.from("contrato_aditivos").select("id", { count: "exact", head: true }).eq("item_id", id);
  if ((ads ?? 0) > 0) return { erro: "Item com aditivos não pode ser excluído. Desative-o." };
  const { error } = await p.supabase.from("contrato_itens").delete().eq("id", id);
  if (error) return { erro: error.message };
  revalidarTudo(contratoId);
  return { ok: "Item excluído." };
}

// ─── Aditivos (ADM) ─────────────────────────────────────────────────────────

async function aplicarAditivo(
  supabase: any,
  userId: string,
  a: {
    contratoId: string;
    tipo: string;
    itemId?: string;
    quantidade?: number; // ACRESCIMO/SUPRESSAO: quantidade a somar/subtrair; ITEM_NOVO: quantidade
    valorUnitario?: number;
    codigo?: string;
    descricao?: string;
    unidade?: string;
    justificativa: string;
    solicitacaoId?: string;
  }
): Promise<Resultado> {
  if (a.tipo === "ITEM_NOVO") {
    if (!a.descricao) return { erro: "Informe a descrição do serviço novo." };
    const { data: ult } = await supabase
      .from("contrato_itens").select("ordem").eq("contrato_id", a.contratoId)
      .order("ordem", { ascending: false }).limit(1);
    const { data: item, error } = await supabase
      .from("contrato_itens")
      .insert({
        contrato_id: a.contratoId,
        codigo: a.codigo || null,
        descricao: a.descricao,
        unidade: a.unidade || "un",
        quantidade_original: 0,
        quantidade: a.quantidade ?? 0,
        valor_unitario: a.valorUnitario ?? 0,
        ordem: (ult?.[0]?.ordem ?? 0) + 1,
        origem_aditivo: true,
      })
      .select("id")
      .single();
    if (error || !item) return { erro: error?.message ?? "Falha ao criar item." };
    const { data: ad, error: e2 } = await supabase
      .from("contrato_aditivos")
      .insert({
        contrato_id: a.contratoId, tipo: "ITEM_NOVO", item_id: item.id,
        quantidade_anterior: 0, quantidade_nova: a.quantidade ?? 0,
        valor_unitario_anterior: null, valor_unitario_novo: a.valorUnitario ?? 0,
        justificativa: a.justificativa, solicitacao_id: a.solicitacaoId ?? null, criado_por: userId,
      })
      .select("id").single();
    if (e2) return { erro: e2.message };
    return { ok: "Aditivo lançado.", id: ad?.id };
  }

  const { data: item } = await supabase
    .from("contrato_itens_saldo").select("*").eq("id", a.itemId ?? "").single();
  if (!item) return { erro: "Selecione o item do contrato." };
  const qAtual = Number(item.quantidade);
  const vAtual = Number(item.valor_unitario);

  if (a.tipo === "PRECO") {
    const novo = a.valorUnitario ?? 0;
    if (novo <= 0) return { erro: "Informe o novo valor unitário." };
    await supabase.from("contrato_itens").update({ valor_unitario: novo }).eq("id", item.id);
    const { data: ad } = await supabase.from("contrato_aditivos").insert({
      contrato_id: a.contratoId, tipo: "PRECO", item_id: item.id,
      quantidade_anterior: qAtual, quantidade_nova: qAtual,
      valor_unitario_anterior: vAtual, valor_unitario_novo: novo,
      justificativa: a.justificativa, solicitacao_id: a.solicitacaoId ?? null, criado_por: userId,
    }).select("id").single();
    return { ok: "Aditivo lançado. O novo preço vale para as próximas medições.", id: ad?.id };
  }

  const delta = Math.abs(a.quantidade ?? 0);
  if (delta <= 0) return { erro: "Informe a quantidade do aditivo." };
  const nova = a.tipo === "SUPRESSAO" ? qAtual - delta : qAtual + delta;
  const comprometido = Number(item.qtd_aprovada) + Number(item.qtd_pendente);
  if (nova < comprometido - EPS) {
    return { erro: `Não dá para reduzir abaixo do já medido (${num(comprometido)} ${item.unidade}).` };
  }
  await supabase.from("contrato_itens").update({ quantidade: nova }).eq("id", item.id);
  const { data: ad } = await supabase.from("contrato_aditivos").insert({
    contrato_id: a.contratoId, tipo: a.tipo, item_id: item.id,
    quantidade_anterior: qAtual, quantidade_nova: nova,
    valor_unitario_anterior: vAtual, valor_unitario_novo: vAtual,
    justificativa: a.justificativa, solicitacao_id: a.solicitacaoId ?? null, criado_por: userId,
  }).select("id").single();
  return { ok: "Aditivo lançado.", id: ad?.id };
}

export async function criarAditivo(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p?.ehAdmin) return { erro: "Apenas o ADM pode lançar aditivos." };
  const contratoId = txt(fd, "contratoId");
  const justificativa = txt(fd, "justificativa");
  if (!justificativa) return { erro: "Informe a justificativa do aditivo." };
  const r = await aplicarAditivo(p.supabase, p.userId, {
    contratoId,
    tipo: txt(fd, "tipo"),
    itemId: txt(fd, "itemId"),
    quantidade: parseNum(fd.get("quantidade")),
    valorUnitario: parseNum(fd.get("valorUnitario")),
    codigo: txt(fd, "codigo"),
    descricao: txt(fd, "descricao"),
    unidade: txt(fd, "unidade"),
    justificativa,
  });
  revalidarTudo(contratoId);
  return r;
}

// ─── Retenção (ADM) ─────────────────────────────────────────────────────────

export async function novaRetencao(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p?.ehAdmin) return { erro: "Apenas o ADM pode alterar a retenção." };
  const contratoId = txt(fd, "contratoId");
  const mes = txt(fd, "mes");
  if (!/^\d{4}-\d{2}$/.test(mes)) return { erro: "Informe o mês de início da vigência." };
  const percent = parseNum(fd.get("percent"));
  if (percent < 0 || percent > 100) return { erro: "Percentual inválido." };
  const { error } = await p.supabase.from("contrato_retencoes").insert({
    contrato_id: contratoId, vigente_desde: mes, percent,
    motivo: txt(fd, "motivo") || null, alterado_por: p.userId,
  });
  if (error) return { erro: error.message };
  revalidarTudo(contratoId);
  return { ok: `Retenção de ${percent}% vigente a partir de ${mesLabel(mes)}.` };
}

export async function liberarRetencao(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p?.ehAdmin) return { erro: "Apenas o ADM pode liberar retenção." };
  const contratoId = txt(fd, "contratoId");
  const valor = parseNum(fd.get("valor"));
  if (valor <= 0) return { erro: "Informe o valor liberado." };

  const [{ data: lancs }, { data: libs }] = await Promise.all([
    p.supabase.from("contrato_lancamentos").select("retencao_valor").eq("contrato_id", contratoId).eq("status", "APROVADO"),
    p.supabase.from("contrato_retencao_liberacoes").select("valor").eq("contrato_id", contratoId),
  ]);
  const saldo =
    (lancs ?? []).reduce((s, l: any) => s + Number(l.retencao_valor), 0) -
    (libs ?? []).reduce((s, l: any) => s + Number(l.valor), 0);
  if (valor > saldo + 0.01) return { erro: `O valor é maior que o saldo retido (${brl(saldo)}).` };

  const { error } = await p.supabase.from("contrato_retencao_liberacoes").insert({
    contrato_id: contratoId, valor, data: txt(fd, "data") || undefined,
    observacao: txt(fd, "observacao") || null, lancado_por: p.userId,
  });
  if (error) return { erro: error.message };
  revalidarTudo(contratoId);
  return { ok: "Liberação de retenção registrada." };
}

// ─── Anexos ─────────────────────────────────────────────────────────────────

export async function registrarAnexo(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p) return { erro: "Sessão expirada." };
  const tipo = txt(fd, "tipo") || "CONTRATO";
  if (tipo !== "FOTO" && !p.ehAdmin) return { erro: "Apenas o ADM pode anexar documentos ao contrato." };
  const contratoId = txt(fd, "contratoId");
  const { error } = await p.supabase.from("contrato_anexos").insert({
    contrato_id: contratoId,
    aditivo_id: txt(fd, "aditivoId") || null,
    lancamento_id: txt(fd, "lancamentoId") || null,
    solicitacao_id: txt(fd, "solicitacaoId") || null,
    tipo,
    nome_arquivo: txt(fd, "nome") || null,
    storage_path: txt(fd, "path"),
    enviado_por: p.userId,
  });
  if (error) return { erro: error.message };
  revalidarTudo(contratoId);
  return { ok: "Arquivo anexado." };
}

export async function excluirAnexo(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p) return { erro: "Sessão expirada." };
  const id = txt(fd, "id");
  const { data: anexo } = await p.supabase.from("contrato_anexos").select("storage_path, contrato_id, enviado_por").eq("id", id).single();
  if (!anexo) return { erro: "Arquivo não encontrado." };
  if (!p.ehAdmin && anexo.enviado_por !== p.userId) return { erro: "Você só pode remover arquivos enviados por você." };
  await p.supabase.from("contrato_anexos").delete().eq("id", id);
  await p.supabase.storage.from("contratos").remove([anexo.storage_path]);
  revalidarTudo(anexo.contrato_id);
  return { ok: "Arquivo removido." };
}

// ─── Lançamentos (medição / vale / vale de medição) ─────────────────────────

type ItemLancado = { itemId: string; modo: "QTD" | "PCT"; valor: number };

export async function salvarLancamento(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p) return { erro: "Sessão expirada. Entre novamente." };
  if (!SETORES_LANCAM_CONTRATO.includes(p.setor)) return { erro: "Seu perfil não pode lançar medições de contrato." };

  const contratoId = txt(fd, "contratoId");
  const lancamentoId = txt(fd, "lancamentoId"); // edição
  const tipo = txt(fd, "tipo");
  const data = txt(fd, "data") || new Date().toISOString().slice(0, 10);
  const mes = txt(fd, "mes") || data.slice(0, 7);
  const observacao = txt(fd, "observacao") || null;
  if (!["MEDICAO", "VALE", "VALE_MEDICAO"].includes(tipo)) return { erro: "Tipo de lançamento inválido." };

  const contrato = await contratoInfo(p.supabase, contratoId);
  if (!contrato) return { erro: "Contrato não encontrado." };
  if (contrato.status !== "ATIVO") return { erro: "Este contrato não está ativo." };
  if (await mesFechado(p.supabase, contratoId, mes)) {
    return { erro: `O mês ${mesLabel(mes)} já foi fechado neste contrato. Use outro mês de referência.` };
  }

  let anterior: any = null;
  if (lancamentoId) {
    const { data } = await p.supabase.from("contrato_lancamentos").select("*").eq("id", lancamentoId).single();
    if (!data) return { erro: "Lançamento não encontrado." };
    if (data.status !== "PENDENTE") return { erro: "Este lançamento já foi aprovado/rejeitado e não pode mais ser alterado." };
    if (!p.ehAdmin && data.criado_por !== p.userId) return { erro: "Você só pode editar lançamentos feitos por você." };
    anterior = data;
  }

  let valorMedido = 0;
  let valorVale = 0;
  const linhas: any[] = [];

  if (tipo === "VALE") {
    valorVale = parseNum(fd.get("valorVale"));
    if (valorVale <= 0) return { erro: "Informe o valor do vale." };
  } else {
    let itens: ItemLancado[] = [];
    try { itens = JSON.parse(txt(fd, "itens") || "[]"); } catch { return { erro: "Itens inválidos." }; }
    itens = itens.filter((i) => Number(i.valor) > 0);
    if (!itens.length) return { erro: "Adicione pelo menos um item com quantidade." };
    if (new Set(itens.map((i) => i.itemId)).size !== itens.length) return { erro: "O mesmo item foi adicionado duas vezes." };

    const { data: saldos } = await p.supabase
      .from("contrato_itens_saldo").select("*").eq("contrato_id", contratoId);
    // Na edição, o que este lançamento já reservava volta para o saldo.
    const { data: proprios } = lancamentoId
      ? await p.supabase.from("contrato_lancamento_itens").select("item_id, quantidade_medida").eq("lancamento_id", lancamentoId)
      : { data: [] as any[] };

    for (const it of itens) {
      const s: any = (saldos ?? []).find((x: any) => x.id === it.itemId);
      if (!s) return { erro: "Item não pertence a este contrato." };
      if (!s.ativo) return { erro: `O item ${s.codigo ?? ""} ${s.descricao} está desativado.` };
      const quantidade = it.modo === "PCT" ? (Number(it.valor) / 100) * Number(s.quantidade) : Number(it.valor);
      const reservaPropria = (proprios ?? []).filter((x: any) => x.item_id === it.itemId).reduce((t: number, x: any) => t + Number(x.quantidade_medida), 0);
      const saldo = Number(s.quantidade) - Number(s.qtd_aprovada) - Number(s.qtd_pendente) + reservaPropria;
      if (quantidade > saldo + EPS) {
        return {
          erro: `Quantidade acima do saldo no item ${s.codigo ?? ""} ${s.descricao}: saldo ${num(saldo)} ${s.unidade}, informado ${num(quantidade)} ${s.unidade}. Para medir além do contratado, solicite um aditivo.`,
        };
      }
      const q = arred(quantidade, 4);
      valorMedido += q * Number(s.valor_unitario);
      linhas.push({
        item_id: it.itemId,
        modo: it.modo,
        percentual: it.modo === "PCT" ? Number(it.valor) : null,
        quantidade_medida: q,
        valor_unitario: Number(s.valor_unitario),
      });
    }
    valorMedido = arred(valorMedido);
  }

  const campos = {
    tipo, data, mes_referencia: mes, observacao,
    valor_medido: tipo === "VALE" ? valorVale : valorMedido,
    valor_vale: valorVale,
  };

  let id = lancamentoId;
  if (anterior) {
    const { error } = await p.supabase
      .from("contrato_lancamentos")
      .update({ ...campos, editado_por: p.userId, editado_em: new Date().toISOString() })
      .eq("id", lancamentoId);
    if (error) return { erro: error.message };
    await p.supabase.from("contrato_lancamento_itens").delete().eq("lancamento_id", lancamentoId);
  } else {
    const { data: novo, error } = await p.supabase
      .from("contrato_lancamentos")
      .insert({ ...campos, contrato_id: contratoId, criado_por: p.userId, status: "PENDENTE" })
      .select("id, numero")
      .single();
    if (error || !novo) return { erro: "Não foi possível salvar: " + (error?.message ?? "") };
    id = novo.id;
  }
  if (linhas.length) {
    const { error } = await p.supabase
      .from("contrato_lancamento_itens")
      .insert(linhas.map((l) => ({ ...l, lancamento_id: id })));
    if (error) {
      if (!anterior) await p.supabase.from("contrato_lancamentos").delete().eq("id", id);
      return { erro: "Não foi possível salvar os itens: " + error.message };
    }
  }

  const valor = tipo === "VALE" ? valorVale : valorMedido;
  if (!p.ehAdmin || anterior) {
    notificarAdmins({
      title: anterior ? `✏️ ${TIPO_LANC_LABEL[tipo]} editado(a)` : `📝 Novo(a) ${TIPO_LANC_LABEL[tipo].toLowerCase()} de contrato`,
      body: `Contrato ${contrato.numero} · ${contrato.obra_nome} · ${contrato.empresa_nome} · ${brl(valor)} · por ${p.nome}`,
      url: `/contratos/aprovacoes#l-${id}`,
    }).catch(() => null);
  }

  revalidarTudo(contratoId);
  return { ok: anterior ? "Lançamento atualizado." : "Lançamento enviado para aprovação.", id };
}

export async function excluirLancamentoContrato(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p) return { erro: "Sessão expirada." };
  const id = txt(fd, "id");
  const { data: l } = await p.supabase
    .from("contrato_lancamentos").select("status, criado_por, contrato_id, tipo, valor_medido").eq("id", id).single();
  if (!l) return { erro: "Lançamento não encontrado." };
  if (l.status !== "PENDENTE") return { erro: "Só é possível excluir lançamentos pendentes." };
  if (!p.ehAdmin && l.criado_por !== p.userId) return { erro: "Você só pode excluir lançamentos feitos por você." };

  const { data: fotos } = await p.supabase.from("contrato_anexos").select("storage_path").eq("lancamento_id", id);
  const { error } = await p.supabase.from("contrato_lancamentos").delete().eq("id", id);
  if (error) return { erro: error.message };
  if (fotos?.length) await p.supabase.storage.from("contratos").remove(fotos.map((f: any) => f.storage_path));

  if (!p.ehAdmin) {
    const c = await contratoInfo(p.supabase, l.contrato_id);
    notificarAdmins({
      title: `🗑️ ${TIPO_LANC_LABEL[l.tipo]} excluído(a)`,
      body: `Contrato ${c?.numero} · ${c?.obra_nome} · ${brl(l.valor_medido)} · por ${p.nome}`,
      url: `/contratos/medicoes?contrato=${l.contrato_id}`,
    }).catch(() => null);
  }
  revalidarTudo(l.contrato_id);
  return { ok: "Lançamento excluído." };
}

// ─── Solicitação de aditivo ─────────────────────────────────────────────────

export async function solicitarAditivo(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p) return { erro: "Sessão expirada." };
  if (!SETORES_LANCAM_CONTRATO.includes(p.setor)) return { erro: "Seu perfil não pode solicitar aditivos." };
  const contratoId = txt(fd, "contratoId");
  const tipo = txt(fd, "tipo");
  const justificativa = txt(fd, "justificativa");
  const quantidade = parseNum(fd.get("quantidade"));
  if (!justificativa) return { erro: "Explique o motivo da solicitação." };
  if (quantidade <= 0) return { erro: "Informe a quantidade." };
  const itemId = tipo === "AUMENTO" ? txt(fd, "itemId") : "";
  if (tipo === "AUMENTO" && !itemId) return { erro: "Selecione o item." };
  if (tipo === "NOVO_SERVICO" && !txt(fd, "descricao")) return { erro: "Descreva o serviço novo." };

  const { data, error } = await p.supabase.from("contrato_solicitacoes").insert({
    contrato_id: contratoId,
    tipo,
    item_id: itemId || null,
    descricao: txt(fd, "descricao") || null,
    unidade: txt(fd, "unidade") || null,
    quantidade,
    justificativa,
    criado_por: p.userId,
  }).select("id").single();
  if (error || !data) return { erro: error?.message ?? "Falha ao salvar." };

  const c = await contratoInfo(p.supabase, contratoId);
  let oque = txt(fd, "descricao");
  if (tipo === "AUMENTO") {
    const { data: it } = await p.supabase.from("contrato_itens").select("codigo, descricao, unidade").eq("id", itemId).single();
    oque = `+${num(quantidade)} ${it?.unidade ?? ""} em ${it?.codigo ?? ""} ${it?.descricao ?? ""}`;
  }
  notificarAdmins({
    title: "📄 Solicitação de aditivo",
    body: `Contrato ${c?.numero} · ${c?.obra_nome} · ${oque} · por ${p.nome}`,
    url: `/contratos/aprovacoes#s-${data.id}`,
  }).catch(() => null);

  revalidarTudo(contratoId);
  return { ok: "Solicitação enviada ao ADM.", id: data.id };
}

export async function cancelarSolicitacao(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p) return { erro: "Sessão expirada." };
  const id = txt(fd, "id");
  const { data: s } = await p.supabase.from("contrato_solicitacoes").select("criado_por, status, contrato_id").eq("id", id).single();
  if (!s) return { erro: "Solicitação não encontrada." };
  if (s.status !== "AGUARDANDO") return { erro: "Esta solicitação já foi respondida." };
  if (!p.ehAdmin && s.criado_por !== p.userId) return { erro: "Você só pode cancelar suas solicitações." };
  await p.supabase.from("contrato_solicitacoes").delete().eq("id", id);
  revalidarTudo(s.contrato_id);
  return { ok: "Solicitação cancelada." };
}

export async function responderSolicitacao(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p?.ehAdmin) return { erro: "Apenas o ADM pode responder solicitações." };
  const id = txt(fd, "id");
  const decisao = txt(fd, "decisao");
  const { data: s } = await p.supabase.from("contrato_solicitacoes").select("*").eq("id", id).single();
  if (!s) return { erro: "Solicitação não encontrada." };
  if (s.status !== "AGUARDANDO") return { erro: "Esta solicitação já foi respondida." };
  const c = await contratoInfo(p.supabase, s.contrato_id);

  if (decisao === "DESAPROVAR") {
    const motivo = txt(fd, "motivo");
    if (!motivo) return { erro: "Informe o motivo da desaprovação." };
    await p.supabase.from("contrato_solicitacoes").update({
      status: "DESAPROVADA", motivo_resposta: motivo, respondido_por: p.userId, respondido_em: new Date().toISOString(),
    }).eq("id", id);
    if (s.criado_por) {
      notificarUsuarios([s.criado_por], {
        title: "🔴 Solicitação de aditivo desaprovada",
        body: `Contrato ${c?.numero} · ${c?.obra_nome}: ${motivo}`,
        url: `/contratos/medicoes?contrato=${s.contrato_id}`,
      }).catch(() => null);
    }
    revalidarTudo(s.contrato_id);
    return { ok: "Solicitação desaprovada." };
  }

  const quantidade = parseNum(fd.get("quantidade"));
  if (quantidade <= 0) return { erro: "Informe a quantidade aprovada." };
  const r = await aplicarAditivo(p.supabase, p.userId, {
    contratoId: s.contrato_id,
    tipo: s.tipo === "AUMENTO" ? "ACRESCIMO" : "ITEM_NOVO",
    itemId: s.item_id ?? undefined,
    quantidade,
    valorUnitario: parseNum(fd.get("valorUnitario")),
    codigo: txt(fd, "codigo"),
    descricao: txt(fd, "descricao") || s.descricao,
    unidade: txt(fd, "unidade") || s.unidade,
    justificativa: `Solicitação: ${s.justificativa}${txt(fd, "motivo") ? ` · ADM: ${txt(fd, "motivo")}` : ""}`,
    solicitacaoId: id,
  });
  if (r.erro) return r;
  await p.supabase.from("contrato_solicitacoes").update({
    status: "APROVADA", motivo_resposta: txt(fd, "motivo") || null,
    respondido_por: p.userId, respondido_em: new Date().toISOString(),
  }).eq("id", id);
  if (s.criado_por) {
    notificarUsuarios([s.criado_por], {
      title: "🟢 Aditivo aprovado",
      body: `Contrato ${c?.numero} · ${c?.obra_nome}: saldo liberado (${num(quantidade)}). Já pode medir.`,
      url: `/contratos/medicoes?contrato=${s.contrato_id}`,
    }).catch(() => null);
  }
  revalidarTudo(s.contrato_id);
  return { ok: "Aditivo aprovado e lançado no contrato.", id: r.id };
}

// ─── Aprovação (ADM) ────────────────────────────────────────────────────────

type Glosa = { id: string; aprovada: number; motivo: string };

export async function aprovarLancamentoContrato(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p?.ehAdmin) return { erro: "Apenas o ADM pode aprovar." };
  const id = txt(fd, "id");
  const { data: l } = await p.supabase
    .from("contrato_lancamentos")
    .select("*, contrato_lancamento_itens(*)")
    .eq("id", id)
    .single();
  if (!l) return { erro: "Lançamento não encontrado." };
  if (l.status !== "PENDENTE") return { erro: "Este lançamento já foi decidido." };
  if (await mesFechado(p.supabase, l.contrato_id, l.mes_referencia)) {
    return { erro: `O mês ${mesLabel(l.mes_referencia)} já foi fechado. Reabra o fechamento para aprovar.` };
  }
  const c = await contratoInfo(p.supabase, l.contrato_id);

  let bruto = 0;
  let teveGlosa = false;
  const glosasResumo: string[] = [];

  if (l.tipo === "VALE") {
    bruto = Number(l.valor_vale);
  } else {
    let glosas: Glosa[] = [];
    try { glosas = JSON.parse(txt(fd, "glosas") || "[]"); } catch { return { erro: "Dados de glosa inválidos." }; }
    const { data: saldos } = await p.supabase.from("contrato_itens_saldo").select("*").eq("contrato_id", l.contrato_id);

    for (const li of l.contrato_lancamento_itens as any[]) {
      const g = glosas.find((x) => x.id === li.id);
      const medida = Number(li.quantidade_medida);
      const aprovada = g ? Math.max(0, Number(g.aprovada)) : medida;
      const s: any = (saldos ?? []).find((x: any) => x.id === li.item_id);
      if (Math.abs(aprovada - medida) > EPS) {
        if (!g?.motivo?.trim()) return { erro: `Informe o motivo da glosa no item ${s?.codigo ?? ""} ${s?.descricao ?? ""}.` };
        if (aprovada > medida) {
          // aumentar só até o saldo livre do item (excluindo o que este lançamento já reserva)
          const livre = Number(s.quantidade) - Number(s.qtd_aprovada) - Number(s.qtd_pendente);
          if (aprovada - medida > livre + EPS) {
            return { erro: `Item ${s?.codigo ?? ""} ${s?.descricao}: aprovado acima do saldo (livre ${num(livre)} ${s?.unidade}).` };
          }
        }
        teveGlosa = true;
        glosasResumo.push(`${s?.codigo ?? ""} ${s?.descricao}: ${num(medida)} → ${num(aprovada)} ${s?.unidade} (${g!.motivo.trim()})`);
      }
      await p.supabase
        .from("contrato_lancamento_itens")
        .update({ quantidade_aprovada: arred(aprovada, 4), motivo_glosa: Math.abs(aprovada - medida) > EPS ? g!.motivo.trim() : null })
        .eq("id", li.id);
      bruto += aprovada * Number(li.valor_unitario);
    }
    bruto = arred(bruto);
  }

  // Retenção: padrão ligada; ADM pode desligar com motivo obrigatório.
  let retPct = 0;
  let retValor = 0;
  let aplicada = true;
  let motivoDispensa: string | null = null;
  if (l.tipo !== "VALE") {
    const { data: hist } = await p.supabase.from("contrato_retencoes").select("vigente_desde, percent").eq("contrato_id", l.contrato_id);
    retPct = retencaoVigente((hist ?? []) as any, l.mes_referencia);
    aplicada = fd.get("aplicarRetencao") !== "0";
    if (!aplicada) {
      motivoDispensa = txt(fd, "motivoDispensa");
      if (!motivoDispensa) return { erro: "Informe o motivo para não aplicar a retenção nesta medição." };
    }
    retValor = aplicada ? arred((bruto * retPct) / 100) : 0;
  }

  const { error } = await p.supabase
    .from("contrato_lancamentos")
    .update({
      status: "APROVADO",
      valor_bruto: bruto,
      retencao_aplicada: aplicada,
      retencao_pct: aplicada ? retPct : 0,
      retencao_valor: retValor,
      retencao_dispensa_motivo: motivoDispensa,
      valor_liquido: arred(bruto - retValor),
      teve_glosa: teveGlosa,
      aprovado_por: p.userId,
      aprovado_em: new Date().toISOString(),
      motivo_rejeicao: null,
    })
    .eq("id", id);
  if (error) return { erro: error.message };

  if (l.criado_por && l.criado_por !== p.userId) {
    notificarUsuarios([l.criado_por], {
      title: teveGlosa ? `🟡 ${TIPO_LANC_LABEL[l.tipo]} aprovado(a) com glosa` : `🟢 ${TIPO_LANC_LABEL[l.tipo]} aprovado(a)`,
      body: `Contrato ${c?.numero} · ${c?.obra_nome} · ${brl(bruto)}${teveGlosa ? ` · ${glosasResumo.join("; ")}` : ""}`,
      url: `/contratos/medicoes?contrato=${l.contrato_id}`,
    }).catch(() => null);
  }
  revalidarTudo(l.contrato_id);
  return { ok: teveGlosa ? "Aprovado com glosa." : "Aprovado." };
}

export async function rejeitarLancamentoContrato(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p?.ehAdmin) return { erro: "Apenas o ADM pode rejeitar." };
  const id = txt(fd, "id");
  const motivo = txt(fd, "motivo");
  if (!motivo) return { erro: "Informe o motivo da rejeição." };
  const { data: l } = await p.supabase.from("contrato_lancamentos").select("status, criado_por, contrato_id, tipo, valor_medido").eq("id", id).single();
  if (!l) return { erro: "Lançamento não encontrado." };
  if (l.status !== "PENDENTE") return { erro: "Este lançamento já foi decidido." };
  await p.supabase.from("contrato_lancamentos").update({ status: "REJEITADO", motivo_rejeicao: motivo, aprovado_por: p.userId, aprovado_em: new Date().toISOString() }).eq("id", id);
  const c = await contratoInfo(p.supabase, l.contrato_id);
  if (l.criado_por && l.criado_por !== p.userId) {
    notificarUsuarios([l.criado_por], {
      title: `🔴 ${TIPO_LANC_LABEL[l.tipo]} rejeitado(a)`,
      body: `Contrato ${c?.numero} · ${c?.obra_nome} · ${brl(l.valor_medido)}: ${motivo}`,
      url: `/contratos/medicoes?contrato=${l.contrato_id}`,
    }).catch(() => null);
  }
  revalidarTudo(l.contrato_id);
  return { ok: "Lançamento rejeitado." };
}

/** ADM volta um lançamento aprovado/rejeitado para pendente (corrigir erro), se o mês não estiver fechado. */
export async function reabrirLancamentoContrato(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p?.ehAdmin) return { erro: "Apenas o ADM pode reabrir." };
  const id = txt(fd, "id");
  const { data: l } = await p.supabase.from("contrato_lancamentos").select("contrato_id, mes_referencia, fechamento_id").eq("id", id).single();
  if (!l) return { erro: "Lançamento não encontrado." };
  if (l.fechamento_id || (await mesFechado(p.supabase, l.contrato_id, l.mes_referencia))) {
    return { erro: "O mês deste lançamento já foi fechado. Reabra o fechamento primeiro." };
  }
  const { count } = await p.supabase.from("contrato_vale_descontos").select("id", { count: "exact", head: true }).eq("vale_id", id);
  if ((count ?? 0) > 0) return { erro: "Este vale já foi descontado em um fechamento." };
  await p.supabase.from("contrato_lancamento_itens").update({ quantidade_aprovada: null, motivo_glosa: null }).eq("lancamento_id", id);
  await p.supabase.from("contrato_lancamentos").update({
    status: "PENDENTE", valor_bruto: 0, retencao_valor: 0, retencao_pct: 0, retencao_aplicada: true,
    retencao_dispensa_motivo: null, valor_liquido: 0, teve_glosa: false, aprovado_por: null, aprovado_em: null, motivo_rejeicao: null,
  }).eq("id", id);
  revalidarTudo(l.contrato_id);
  return { ok: "Lançamento voltou para pendente." };
}

// ─── Fechamento mensal (ADM) ────────────────────────────────────────────────

export async function fecharMesContrato(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p?.ehAdmin) return { erro: "Apenas o ADM pode fechar o mês." };
  const contratoId = txt(fd, "contratoId");
  const mes = txt(fd, "mes");
  const b = await calcularBoletim(p.supabase, contratoId, mes);
  if (!b) return { erro: "Contrato não encontrado." };
  if (b.fechamento) return { erro: "Este mês já está fechado." };
  if (b.pendentesNoMes > 0) return { erro: `Há ${b.pendentesNoMes} lançamento(s) pendente(s) neste mês. Aprove ou rejeite antes de fechar.` };
  if (!b.medicoes.length && !b.valesMedicao.length) return { erro: "Não há medições aprovadas neste mês." };

  const { data: f, error } = await p.supabase.from("contrato_fechamentos").insert({
    contrato_id: contratoId, mes_referencia: mes,
    valor_bruto: b.bruto, retencao_valor: b.retido, vales_descontados: b.valesDescontados, valor_liquido: b.liquido,
    fechado_por: p.userId,
  }).select("id").single();
  if (error || !f) return { erro: error?.message ?? "Falha ao fechar." };

  const descontos = b.vales.filter((v) => v.descontar_agora > 0).map((v) => ({ vale_id: v.vale_id, fechamento_id: f.id, valor: v.descontar_agora }));
  if (descontos.length) await p.supabase.from("contrato_vale_descontos").insert(descontos);
  const ids = [...b.medicoes, ...b.valesMedicao].map((l: any) => l.id);
  if (ids.length) await p.supabase.from("contrato_lancamentos").update({ fechamento_id: f.id }).in("id", ids);

  revalidarTudo(contratoId);
  return { ok: `Mês ${mesLabel(mes)} fechado. Líquido a pagar: ${brl(b.liquido)}.` };
}

export async function reabrirMesContrato(fd: FormData): Promise<Resultado> {
  const p = await perfilAtual();
  if (!p?.ehAdmin) return { erro: "Apenas o ADM pode reabrir o mês." };
  const contratoId = txt(fd, "contratoId");
  const mes = txt(fd, "mes");
  const { data: f } = await p.supabase.from("contrato_fechamentos").select("id").eq("contrato_id", contratoId).eq("mes_referencia", mes).maybeSingle();
  if (!f) return { erro: "Este mês não está fechado." };
  const { data: posterior } = await p.supabase.from("contrato_fechamentos").select("mes_referencia").eq("contrato_id", contratoId).gt("mes_referencia", mes).limit(1);
  if (posterior?.length) return { erro: `Existe fechamento posterior (${mesLabel(posterior[0].mes_referencia)}). Reabra os meses mais recentes primeiro.` };
  await p.supabase.from("contrato_lancamentos").update({ fechamento_id: null }).eq("fechamento_id", f.id);
  await p.supabase.from("contrato_fechamentos").delete().eq("id", f.id);
  revalidarTudo(contratoId);
  return { ok: `Mês ${mesLabel(mes)} reaberto.` };
}
