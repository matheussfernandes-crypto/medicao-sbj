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
  if (!perfil || !["ADMIN", "ENGENHEIRO", "ARQUITETO"].includes(perfil.setor) || perfil.status !== "aprovado")
    throw new Error("Apenas ADM, engenheiros e arquitetos podem alterar o cadastro de obras.");
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

// Obra nova: nasce no Cadastro e já fica disponível nas Vistorias e no Pós-venda (cria a obra correspondente no pós-obra).
// Medição, Fechamento, Contratos e Andamento não são tocados: a obra só aparece lá quando for ligada de propósito.
export async function criarObra(d: { nome: string; nome_completo: string | null; fase: "desenvolvimento" | "obra" | "entregue"; unidades: number | null; endereco: string | null; cidade: string | null; uf: string | null }): Promise<
  { ok: true; id: string } | { ok: false; erro: string }
> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const nome = txt(d.nome)?.toUpperCase();
    if (!nome) return { ok: false, erro: "Informe o nome da obra." };
    const { data: existentes } = await supabase.from("cadastro_obras").select("id, nome, nome_completo");
    const chave = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    if ((existentes ?? []).some((o: any) => chave(o.nome) === chave(nome) || (o.nome_completo && chave(o.nome_completo) === chave(nome))))
      return { ok: false, erro: "Já existe uma obra com esse nome no cadastro." };

    const agora = new Date().toISOString();
    const nomeCompleto = txt(d.nome_completo) ?? "Residencial " + nome.toLowerCase().replace(/(^|\s)(\S)/g, (_m, a, b, i) => (i > 0 && /^(de|da|do|dos|das)$/.test(nome.toLowerCase().slice(i + a.length).split(" ")[0]) ? a + b : a + b.toUpperCase()));
    if (!["desenvolvimento", "obra", "entregue"].includes(d.fase)) return { ok: false, erro: "Fase inválida." };
    const status = d.fase === "entregue" ? "concluido" : "andamento";
    const endereco = txt(d.endereco);
    const unidades = num(d.unidades);

    // obra correspondente no pós-obra (Vistorias e Pós-venda): próximo número livre, contando também as excluídas
    const { data: ids } = await supabase.from("posobra_obras").select("id");
    const n = Math.max(0, ...(ids ?? []).map((o: any) => Number(String(o.id).replace(/^\D+/, "")) || 0)) + 1;
    const posId = "b" + n;
    const { error: e1 } = await supabase.from("posobra_obras").insert({
      id: posId,
      nome: nomeCompleto,
      endereco,
      status,
      unidades,
      dados: { id: posId, name: nomeCompleto, address: endereco ?? "", status, deliveryDate: "", units: unidades ?? 0, responsible: "", progress: 0, possuiManual: false },
      criado_em: agora,
      atualizado_em: agora,
      atualizado_por: userId,
    });
    if (e1) return { ok: false, erro: "Não consegui criar a obra no pós-obra: " + e1.message };

    const { data: nova, error: e2 } = await supabase
      .from("cadastro_obras")
      .insert({
        nome,
        nome_completo: nomeCompleto,
        fase: d.fase,
        endereco,
        cidade: txt(d.cidade),
        uf: txt(d.uf)?.toUpperCase().slice(0, 2) ?? null,
        unidades,
        posobra_id: posId,
        aparece_vistorias: true,
        aparece_posvenda: true,
        criado_em: agora,
        atualizado_em: agora,
        atualizado_por: userId,
      })
      .select("id")
      .single();
    if (e2 || !nova) {
      // desfaz a obra do pós-obra para não ficar solta (marca como excluída; nada é apagado)
      await supabase.from("posobra_obras").update({ excluido_em: agora }).eq("id", posId);
      return { ok: false, erro: "Não consegui criar a obra: " + (e2?.message ?? "erro") };
    }
    // Em desenvolvimento ou execução: já nasce na Medição/Contratos (obra + serviços padrão), ligada ao Cadastro
    if (d.fase !== "entregue") {
      const { error: e3 } = await supabase.rpc("cadastro_criar_obra_medicao", { p_cadastro: nova.id });
      if (e3) {
        revalidatePath("/admin/cadastro-obras");
        return { ok: false, erro: "A obra foi criada no Cadastro, mas não consegui criá-la na Medição: " + e3.message };
      }
    }
    revalidatePath("/admin/cadastro-obras");
    return { ok: true, id: nova.id };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro ao criar." };
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

// Muda entre "em desenvolvimento" e "em execução" (e volta de "entregue" por engano). A data real NÃO é apagada (nada se perde);
// enquanto a fase não for "entregue", ela não vale para a garantia.
export async function mudarFase(id: string, fase: "desenvolvimento" | "obra"): Promise<Resultado> {
  if (fase !== "desenvolvimento" && fase !== "obra") return { ok: false, erro: "Fase inválida." };
  const r = await voltarParaObra(id, fase);
  if (!r.ok) return r;
  try {
    const { supabase } = await exigirAdmin();
    const { error } = await supabase.rpc("cadastro_criar_obra_medicao", { p_cadastro: id });
    if (error) return { ok: false, erro: "Fase alterada, mas não consegui ligar a obra à Medição: " + error.message };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro ao ligar à Medição." };
  }
  return r;
}
export async function voltarParaObra(id: string, fase: "desenvolvimento" | "obra" = "obra"): Promise<Resultado> {
  try {
    const { supabase, userId } = await exigirAdmin();
    const { error } = await supabase
      .from("cadastro_obras")
      .update({ fase, atualizado_em: new Date().toISOString(), atualizado_por: userId })
      .eq("id", id);
    if (error) return { ok: false, erro: "Não consegui salvar: " + error.message };
    revalidatePath("/admin/cadastro-obras");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

// Logo da obra: o arquivo vai para o espaço "obras-logos" (enviado pela tela); aqui só se guarda o endereço.
// Trocar ou tirar a logo não apaga o arquivo antigo (nada se perde).
export async function salvarLogo(id: string, url: string | null): Promise<Resultado> {
  try {
    const { supabase, userId } = await exigirAdmin();
    if (url && !/^https:\/\/[^\s]+\/storage\/v1\/object\/public\/obras-logos\//.test(url)) return { ok: false, erro: "Endereço da logo inválido." };
    const { error } = await supabase
      .from("cadastro_obras")
      .update({ logo_url: url, atualizado_em: new Date().toISOString(), atualizado_por: userId })
      .eq("id", id);
    if (error) return { ok: false, erro: "Não consegui salvar a logo: " + error.message };
    revalidatePath("/admin/cadastro-obras");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

// "Aparece em": por enquanto só fica guardado; cada módulo passa a respeitar quando for ligado ao cadastro.
const CAMPOS_APARECE = ["aparece_medicao", "aparece_andamento", "aparece_vistorias", "aparece_posvenda"] as const;
export type CampoAparece = (typeof CAMPOS_APARECE)[number];
export async function salvarAparece(id: string, campo: CampoAparece, valor: boolean): Promise<Resultado> {
  try {
    const { supabase, userId } = await exigirAdmin();
    if (!CAMPOS_APARECE.includes(campo)) return { ok: false, erro: "Campo inválido." };
    const { error } = await supabase
      .from("cadastro_obras")
      .update({ [campo]: !!valor, atualizado_em: new Date().toISOString(), atualizado_por: userId })
      .eq("id", id);
    if (error) return { ok: false, erro: "Não consegui salvar: " + error.message };
    revalidatePath("/admin/cadastro-obras");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}
