import { NextRequest, NextResponse } from "next/server";
import { agoraComFolga, desdeValido, erro, exigirUsuario } from "./server";

// Obras, clientes e fornecedores do módulo Pós-obra. O registro inteiro do módulo vai em "dados";
// as colunas soltas são só para consulta. "id" é o mesmo id do módulo (b1, c12, sup3...).

type Registro = Record<string, any>;
type Tipo = {
  tabela: "posobra_obras" | "posobra_clientes" | "posobra_fornecedores";
  colunas: (r: Registro) => Record<string, unknown>;
};

const txt = (v: unknown) => (v === undefined || v === null ? null : String(v));
const num = (v: unknown) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? null : Number(v));

export const TIPOS: Record<"obras" | "clientes" | "fornecedores", Tipo> = {
  obras: {
    tabela: "posobra_obras",
    colunas: (r) => ({
      nome: txt(r.name) ?? "",
      endereco: txt(r.address),
      status: txt(r.status),
      unidades: num(r.units),
      data_entrega: txt(r.deliveryDate),
      responsavel: txt(r.responsible),
      progresso: num(r.progress),
      possui_manual: typeof r.possuiManual === "boolean" ? r.possuiManual : null,
    }),
  },
  clientes: {
    tabela: "posobra_clientes",
    colunas: (r) => ({
      obra_id: txt(r.buildingId),
      unidade: txt(r.unit),
      vaga: txt(r.garage),
      nome: txt(r.name),
      telefone: txt(r.phone),
      email: txt(r.email),
      escritura: txt(r.escritura),
      observacoes: txt(r.notes),
    }),
  },
  fornecedores: {
    tabela: "posobra_fornecedores",
    colunas: (r) => ({
      razao_social: txt(r.razaoSocial),
      nome_fantasia: txt(r.nomeFantasia),
      cnpj: txt(r.cnpj),
      telefone: txt(r.telefone),
      email: txt(r.email),
      status: txt(r.status),
    }),
  },
};

// GET ?desde=ISO -> { agora, registros: [...], excluidos: [ids] }
export function rotaListar(tipo: Tipo) {
  return async function GET(req: NextRequest) {
    const u = await exigirUsuario();
    if ("erro" in u) return u.erro;
    const desde = desdeValido(req.nextUrl.searchParams.get("desde"));
    const agora = agoraComFolga();

    const registros: Registro[] = [];
    const excluidos: string[] = [];
    // PostgREST devolve no máximo 1000 linhas por vez: busca em páginas
    for (let de = 0; ; de += 1000) {
      let q = u.supabase.from(tipo.tabela).select("id, dados, excluido_em").order("id").range(de, de + 999);
      if (desde) q = q.gt("atualizado_em", desde);
      else q = q.is("excluido_em", null);
      const { data, error } = await q;
      if (error) return erro(error.message);
      (data ?? []).forEach((l: any) => {
        if (l.excluido_em) excluidos.push(l.id);
        else registros.push({ ...(l.dados || {}), id: l.id });
      });
      if (!data || data.length < 1000) break;
    }
    return NextResponse.json({ agora, registros, excluidos });
  };
}

// POST { registros: [...], excluidos: [ids] } -> grava (upsert por id); excluir = marcar excluido_em (nada é apagado)
export function rotaGravar(tipo: Tipo) {
  return async function POST(req: NextRequest) {
    const u = await exigirUsuario();
    if ("erro" in u) return u.erro;
    let corpo: any;
    try {
      corpo = await req.json();
    } catch {
      return erro("Corpo inválido", 400);
    }
    const registros: Registro[] = Array.isArray(corpo?.registros) ? corpo.registros.filter((r: any) => r && r.id) : [];
    const excluidos: string[] = Array.isArray(corpo?.excluidos) ? corpo.excluidos.filter((x: any) => typeof x === "string" && x) : [];
    const agora = new Date().toISOString();

    for (let i = 0; i < registros.length; i += 500) {
      const linhas = registros.slice(i, i + 500).map((r) => {
        const { sync, ...dados } = r;
        return { id: String(r.id), ...tipo.colunas(dados), dados, atualizado_em: agora, atualizado_por: u.user.id, excluido_em: null };
      });
      const { error } = await u.supabase.from(tipo.tabela).upsert(linhas, { onConflict: "id" });
      if (error) return erro(error.message);
    }
    if (excluidos.length) {
      const { error } = await u.supabase
        .from(tipo.tabela)
        .update({ excluido_em: agora, atualizado_em: agora, atualizado_por: u.user.id })
        .in("id", excluidos);
      if (error) return erro(error.message);
    }
    return NextResponse.json({ ok: true, gravados: registros.length, excluidos: excluidos.length });
  };
}
