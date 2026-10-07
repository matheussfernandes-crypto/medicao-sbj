import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual, getPerfilAtual } from "@/lib/auth/getCurrentUserProfile";
import { compararCodigo, retencaoVigente } from "./util";

export type Perfil = {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  setor: string;
  nome: string;
  ehAdmin: boolean;
};

/** Usuário logado + perfil aprovado (uma ida ao banco). Redireciona se não puder. */
export async function exigirPerfil(setoresPermitidos?: string[]): Promise<Perfil> {
  const supabase = createClient();
  const user = await getUsuarioAtual();
  if (!user) redirect("/login");
  const perfil = await getPerfilAtual(user.id);
  if (!perfil || perfil.status !== "aprovado") redirect("/aguardando-aprovacao");
  if (setoresPermitidos && !setoresPermitidos.includes(perfil.setor)) redirect("/dashboard");
  return {
    supabase,
    userId: user.id,
    setor: perfil.setor,
    nome: perfil.nome_completo ?? "",
    ehAdmin: perfil.setor === "ADMIN",
  };
}

export type ItemSaldo = {
  id: string;
  contrato_id: string;
  codigo: string | null;
  descricao: string;
  unidade: string;
  quantidade_original: number;
  quantidade: number;
  valor_unitario: number;
  ordem: number;
  ativo: boolean;
  origem_aditivo: boolean;
  qtd_aprovada: number;
  qtd_pendente: number;
  saldo: number;
};

export async function itensComSaldo(supabase: Perfil["supabase"], contratoId: string): Promise<ItemSaldo[]> {
  const { data } = await supabase
    .from("contrato_itens_saldo")
    .select("*")
    .eq("contrato_id", contratoId);
  return (data ?? [])
    .map((i: any) => {
      const quantidade = Number(i.quantidade);
      const qtd_aprovada = Number(i.qtd_aprovada);
      const qtd_pendente = Number(i.qtd_pendente);
      return {
        ...i,
        quantidade,
        quantidade_original: Number(i.quantidade_original),
        valor_unitario: Number(i.valor_unitario),
        qtd_aprovada,
        qtd_pendente,
        saldo: quantidade - qtd_aprovada - qtd_pendente,
      } as ItemSaldo;
    })
    .sort((a, b) => a.ordem - b.ordem || compararCodigo(a.codigo, b.codigo));
}

export type ContratoResumo = {
  id: string;
  numero: string;
  objeto: string;
  status: string;
  obra_id: string;
  obra_nome: string;
  empresa_id: string;
  empresa_nome: string;
  data_inicio: string | null;
  data_termino: string | null;
  valor_original: number;
  valor_atual: number;
  valor_medido: number; // aprovado (bruto)
  valor_pendente: number;
  saldo: number;
  perc_executado: number;
  retencao_vigente: number;
};

/** Lista contratos com totais financeiros calculados a partir dos itens. */
export async function listarContratos(
  supabase: Perfil["supabase"],
  filtro: { empresaId?: string; obraId?: string; status?: string; ids?: string[] } = {}
): Promise<ContratoResumo[]> {
  let q = supabase
    .from("contratos")
    .select("id, numero, objeto, status, obra_id, empresa_id, data_inicio, data_termino, obras(nome), empresas_terceirizadas(nome)")
    .order("numero");
  if (filtro.empresaId) q = q.eq("empresa_id", filtro.empresaId);
  if (filtro.obraId) q = q.eq("obra_id", filtro.obraId);
  if (filtro.status) q = q.eq("status", filtro.status);
  if (filtro.ids) q = q.in("id", filtro.ids.length ? filtro.ids : ["00000000-0000-0000-0000-000000000000"]);
  const { data: contratos } = await q;
  const ids = (contratos ?? []).map((c) => c.id);
  if (!ids.length) return [];

  const [{ data: itens }, { data: rets }] = await Promise.all([
    supabase
      .from("contrato_itens_saldo")
      .select("contrato_id, quantidade, quantidade_original, valor_unitario, qtd_aprovada, qtd_pendente")
      .in("contrato_id", ids),
    supabase.from("contrato_retencoes").select("contrato_id, vigente_desde, percent").in("contrato_id", ids),
  ]);

  const mes = new Date().toISOString().slice(0, 7);
  return (contratos ?? []).map((c: any) => {
    const its = (itens ?? []).filter((i: any) => i.contrato_id === c.id);
    let valor_original = 0, valor_atual = 0, valor_medido = 0, valor_pendente = 0;
    for (const i of its as any[]) {
      const vu = Number(i.valor_unitario);
      valor_original += Number(i.quantidade_original) * vu;
      valor_atual += Number(i.quantidade) * vu;
      valor_medido += Number(i.qtd_aprovada) * vu;
      valor_pendente += Number(i.qtd_pendente) * vu;
    }
    return {
      id: c.id,
      numero: c.numero,
      objeto: c.objeto,
      status: c.status,
      obra_id: c.obra_id,
      obra_nome: c.obras?.nome ?? "—",
      empresa_id: c.empresa_id,
      empresa_nome: c.empresas_terceirizadas?.nome ?? "—",
      data_inicio: c.data_inicio,
      data_termino: c.data_termino,
      valor_original,
      valor_atual,
      valor_medido,
      valor_pendente,
      saldo: valor_atual - valor_medido - valor_pendente,
      perc_executado: valor_atual > 0 ? (valor_medido / valor_atual) * 100 : 0,
      retencao_vigente: retencaoVigente(
        (rets ?? []).filter((r: any) => r.contrato_id === c.id) as any,
        mes
      ),
    };
  });
}

/** Nomes de usuários (perfis) — usa a função security definer existente. */
export async function nomesUsuarios(supabase: Perfil["supabase"], ids: (string | null | undefined)[]) {
  const unicos = Array.from(new Set(ids.filter(Boolean))) as string[];
  const mapa: Record<string, string> = {};
  if (!unicos.length) return mapa;
  const { data } = await supabase.rpc("nomes_perfis", { uids: unicos });
  for (const p of (data ?? []) as any[]) mapa[p.id] = p.nome_completo;
  return mapa;
}

export async function urlsAssinadas(supabase: Perfil["supabase"], paths: string[], segundos = 3600) {
  const mapa: Record<string, string> = {};
  if (!paths.length) return mapa;
  const { data } = await supabase.storage.from("contratos").createSignedUrls(paths, segundos);
  for (const d of data ?? []) if (d.path && d.signedUrl) mapa[d.path] = d.signedUrl;
  return mapa;
}
