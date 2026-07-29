import { createClient } from "@/lib/supabase/server";
import { lerFiltros, aplicarFiltros } from "./filtros";
import { CATEGORIA_LABEL, PROBLEMA_LABEL, STATUS_LABEL, GARANTIA_LABEL, SERVICO_EXECUTADO_LABEL } from "../constants";

export type LinhaRelatorio = {
  data: string;
  numeroOS: number;
  local: string;
  categoria: string;
  problema: string;
  servicoExecutado: string;
  responsavel: string;
  situacao: string;
  garantia: string;
};

export async function buscarDadosRelatorio(searchParams: URLSearchParams) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { autorizado: false as const };

  const { data: perfil } = await supabase.from("perfis").select("setor, status").eq("id", user.id).single();
  const setoresPermitidos = ["ADMIN", "ARQUITETO", "ENGENHEIRO", "MESTRE_GERAL", "ESTAGIARIO"];
  if (!perfil || perfil.status !== "aprovado" || !setoresPermitidos.includes(perfil.setor)) {
    return { autorizado: false as const };
  }

  const filtros = lerFiltros(searchParams);
  const { data: registros } = await aplicarFiltros(supabase, filtros);

  const idsObra = Array.from(new Set((registros ?? []).map((r) => r.obra_id)));
  const idsTorre = Array.from(new Set((registros ?? []).map((r) => r.torre_id).filter(Boolean))) as string[];
  const idsPavimento = Array.from(new Set((registros ?? []).map((r) => r.pavimento_id).filter(Boolean))) as string[];
  const idsUnidade = Array.from(new Set((registros ?? []).map((r) => r.unidade_id).filter(Boolean))) as string[];
  const idsPerfil = Array.from(new Set((registros ?? []).map((r) => r.responsavel_perfil_id).filter(Boolean))) as string[];
  const idsEmpresa = Array.from(new Set((registros ?? []).map((r) => r.responsavel_empresa_id).filter(Boolean))) as string[];

  const [obras, torres, pavimentos, unidades, perfis, empresas] = await Promise.all([
    idsObra.length ? supabase.from("obras").select("id, nome").in("id", idsObra) : Promise.resolve({ data: [] as any[] }),
    idsTorre.length ? supabase.from("torres").select("id, nome").in("id", idsTorre) : Promise.resolve({ data: [] as any[] }),
    idsPavimento.length ? supabase.from("pavimentos").select("id, nome").in("id", idsPavimento) : Promise.resolve({ data: [] as any[] }),
    idsUnidade.length ? supabase.from("unidades").select("id, nome").in("id", idsUnidade) : Promise.resolve({ data: [] as any[] }),
    idsPerfil.length ? supabase.from("perfis").select("id, nome_completo").in("id", idsPerfil) : Promise.resolve({ data: [] as any[] }),
    idsEmpresa.length ? supabase.from("empresas_terceirizadas").select("id, nome").in("id", idsEmpresa) : Promise.resolve({ data: [] as any[] }),
  ]);

  const mapa = <T extends { id: string }>(arr: T[] | null, campo: keyof T) => {
    const m: Record<string, string> = {};
    for (const item of arr ?? []) m[item.id] = String(item[campo]);
    return m;
  };
  const nomeObra = mapa(obras.data, "nome");
  const nomeTorre = mapa(torres.data, "nome");
  const nomePavimento = mapa(pavimentos.data, "nome");
  const nomeUnidade = mapa(unidades.data, "nome");
  const nomePerfil = mapa(perfis.data, "nome_completo");
  const nomeEmpresa = mapa(empresas.data, "nome");

  const linhas: LinhaRelatorio[] = (registros ?? []).map((r) => {
    const localPartes = [nomeTorre[r.torre_id ?? ""], nomePavimento[r.pavimento_id ?? ""], nomeUnidade[r.unidade_id ?? ""]].filter(Boolean);
    const local = [nomeObra[r.obra_id], localPartes.join(" — ") || r.area_comum_texto].filter(Boolean).join(" / ");

    const responsavel =
      r.responsavel_tipo === "FUNCIONARIO"
        ? nomePerfil[r.responsavel_perfil_id ?? ""] ?? "—"
        : r.responsavel_tipo === "EMPRESA"
        ? nomeEmpresa[r.responsavel_empresa_id ?? ""] ?? "—"
        : "—";

    return {
      data: new Date(r.criado_em).toLocaleDateString("pt-BR"),
      numeroOS: r.numero_os,
      local,
      categoria: CATEGORIA_LABEL[r.categoria] ?? r.categoria,
      problema: PROBLEMA_LABEL[r.problema] ?? r.problema,
      servicoExecutado: r.servico_executado ? SERVICO_EXECUTADO_LABEL[r.servico_executado] ?? r.servico_executado : "—",
      responsavel,
      situacao: STATUS_LABEL[r.status] ?? r.status,
      garantia: r.garantia_classificacao ? GARANTIA_LABEL[r.garantia_classificacao] ?? r.garantia_classificacao : "—",
    };
  });

  const resumo = {
    total: linhas.length,
    concluidos: (registros ?? []).filter((r) => r.status === "CONCLUIDA").length,
    emAndamento: (registros ?? []).filter((r) => r.status === "EM_ANDAMENTO").length,
    pendentes: (registros ?? []).filter((r) => !["CONCLUIDA", "CANCELADA", "GARANTIA_NEGADA"].includes(r.status)).length,
    garantia: (registros ?? []).filter((r) => r.garantia_classificacao && r.garantia_classificacao !== "FORA_GARANTIA").length,
    foraGarantia: (registros ?? []).filter((r) => r.garantia_classificacao === "FORA_GARANTIA").length,
  };

  return { autorizado: true as const, linhas, resumo, filtros };
}
