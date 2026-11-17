"use server";

// Cadastro único de obras (tabela cadastro_obras). Só grava nesta tabela: nenhuma outra tabela
// (obras, contratos, lançamentos, fechamentos…) é alterada por estas ações.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function exigirAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre de novo.");
  const { data: perfil } = await supabase.from("perfis").select("setor,status").eq("id", user.id).single();
  if (!perfil || perfil.setor !== "ADMIN" || perfil.status !== "aprovado") throw new Error("Apenas o ADM pode alterar o cadastro de obras.");
  return { supabase, userId: user.id };
}

export type DadosObra = {
  nome: string;
  nome_completo: string | null;
  razao_social: string | null;
  cnpj: string | null;
  cno: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  data_inicio: string | null;
  data_entrega_prevista: string | null;
  torres: number | null;
  pavimentos: number | null;
  unidades: number | null;
  responsavel_tecnico: string | null;
  nomes_alternativos: string[];
  observacoes: string | null;
};

const txt = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};
const num = (v: unknown) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};
const data = (v: unknown) => {
  const s = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

type Resultado = { ok: true } | { ok: false; erro: string };

export async function salvarObra(id: string, d: DadosObra): Promise<Resultado> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const nome = txt(d.nome);
    if (!nome) return { ok: false, erro: "Informe o nome da obra." };
    const reg = {
      nome,
      nome_completo: txt(d.nome_completo),
      razao_social: txt(d.razao_social),
      cnpj: txt(d.cnpj),
      cno: txt(d.cno),
      endereco: txt(d.endereco),
      bairro: txt(d.bairro),
      cidade: txt(d.cidade),
      uf: txt(d.uf)?.toUpperCase().slice(0, 2) ?? null,
      cep: txt(d.cep),
      data_inicio: data(d.data_inicio),
      data_entrega_prevista: data(d.data_entrega_prevista),
      torres: num(d.torres),
      pavimentos: num(d.pavimentos),
      unidades: num(d.unidades),
      responsavel_tecnico: txt(d.responsavel_tecnico),
      nomes_alternativos: Array.from(new Set((d.nomes_alternativos ?? []).map((x) => String(x).trim()).filter(Boolean))),
      observacoes: txt(d.observacoes),
      atualizado_em: new Date().toISOString(),
      atualizado_por: userId,
    };
    const { error } = await supabase.from("cadastro_obras").update(reg).eq("id", id);
    if (error) return { ok: false, erro: "Não consegui salvar: " + error.message };
    revalidatePath("/admin/cadastro-obras");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

// Fase: só muda por aqui. Entregar pede a data real de entrega (base da garantia no pós-venda).
export async function marcarEntregue(id: string, dataReal: string): Promise<Resultado> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const dt = data(dataReal);
    if (!dt) return { ok: false, erro: "Informe a data de entrega real." };
    const { error } = await supabase
      .from("cadastro_obras")
      .update({ fase: "entregue", data_entrega_real: dt, atualizado_em: new Date().toISOString(), atualizado_por: userId })
      .eq("id", id);
    if (error) return { ok: false, erro: "Não consegui salvar: " + error.message };
    revalidatePath("/admin/cadastro-obras");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

// Volta para "em construção" (ex.: marcada como entregue por engano). A data real NÃO é apagada (nada se perde);
// enquanto a fase for "em construção", ela não vale para a garantia.
export async function voltarParaObra(id: string): Promise<Resultado> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const { error } = await supabase
      .from("cadastro_obras")
      .update({ fase: "obra", atualizado_em: new Date().toISOString(), atualizado_por: userId })
      .eq("id", id);
    if (error) return { ok: false, erro: "Não consegui salvar: " + error.message };
    revalidatePath("/admin/cadastro-obras");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}
