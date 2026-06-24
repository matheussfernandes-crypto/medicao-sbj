"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const SERVICOS_PADRAO: Array<{ nome: string; tipo: string; valor_unitario: number }> = [
  { nome: "DIÁRIA DE PEDREIRO", tipo: "diaria", valor_unitario: 200 },
  { nome: "ALVENARIA", tipo: "area", valor_unitario: 14 },
  { nome: "REBOCO INTERNO", tipo: "area", valor_unitario: 16 },
  { nome: "REBOCO EXTERNO", tipo: "area", valor_unitario: 20 },
  { nome: "TELA", tipo: "linear", valor_unitario: 10 },
  { nome: "EMPREITA", tipo: "unidade", valor_unitario: 1 },
  { nome: "ESTUQUE", tipo: "area", valor_unitario: 8 },
  { nome: "REVESTIMENTO", tipo: "area", valor_unitario: 35 },
  { nome: "CONTRAPISO", tipo: "area", valor_unitario: 14 },
  { nome: "CHANFRO", tipo: "area", valor_unitario: 8 },
  { nome: "PASTILHA", tipo: "area", valor_unitario: 30.5 },
  { nome: "FRISOS", tipo: "linear", valor_unitario: 15.25 },
  { nome: "PEDRA", tipo: "linear", valor_unitario: 25 },
  { nome: "REFRATARIO", tipo: "area", valor_unitario: 150 },
];

async function exigirAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase.from("perfis").select("setor,status").eq("id", user.id).single();
  if (!perfil || perfil.setor !== "ADMIN" || perfil.status !== "aprovado") {
    throw new Error("Apenas o ADM pode gerenciar obras.");
  }
  return { supabase, user };
}

export async function criarObra(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const nome = String(formData.get("nome") || "").trim();
  if (!nome) return;

  const { data: obra, error } = await supabase.from("obras").insert({ nome }).select("id").single();
  if (error || !obra) return;

  await supabase.from("servicos").insert(
    SERVICOS_PADRAO.map((s) => ({ ...s, obra_id: obra.id }))
  );

  revalidatePath("/admin/obras");
}

export async function criarServico(obraId: string, formData: FormData) {
  const { supabase } = await exigirAdmin();
  const nome = String(formData.get("nome") || "").trim();
  const tipo = String(formData.get("tipo") || "area");
  const valor = parseFloat(String(formData.get("valor") || "0")) || 0;
  if (!nome) return;

  await supabase.from("servicos").insert({ obra_id: obraId, nome, tipo, valor_unitario: valor });
  revalidatePath("/admin/obras");
}

export async function editarValorServico(formData: FormData) {
  const { supabase } = await exigirAdmin();
  const servicoId = String(formData.get("servicoId"));
  const valor = parseFloat(String(formData.get("valor") || "0")) || 0;
  await supabase.from("servicos").update({ valor_unitario: valor }).eq("id", servicoId);
  revalidatePath("/admin/obras");
}

export async function salvarRetencao(formData: FormData) {
  const { supabase, user } = await exigirAdmin();
  const pessoaId = String(formData.get("pessoaId"));
  const obraId = String(formData.get("obraId"));
  const mes = String(formData.get("mes"));
  const pctNovo = parseFloat(String(formData.get("percent") || "0")) || 0;

  const { data: vigentes } = await supabase
    .from("retencoes_pessoa")
    .select("mes, percent")
    .eq("pessoa_id", pessoaId)
    .lte("mes", mes)
    .order("mes", { ascending: false })
    .limit(1);

  const pctAnterior = vigentes && vigentes[0] ? Number(vigentes[0].percent) : 0;

  await supabase.from("retencoes_pessoa").delete().eq("pessoa_id", pessoaId).eq("mes", mes);
  await supabase.from("retencoes_pessoa").insert({ pessoa_id: pessoaId, mes, percent: pctNovo / 100 });

  if (Math.round(pctAnterior * 100) !== pctNovo) {
    await supabase.from("log_alteracoes_retencao").insert({
      pessoa_id: pessoaId,
      obra_id: obraId,
      mes_aplicacao: mes,
      percent_anterior: pctAnterior,
      percent_novo: pctNovo / 100,
      alterado_por: user.id,
    });
  }

  revalidatePath("/admin/obras");
}
