import { getUsuarioAtual, perfilDaRequisicao } from "@/lib/auth/getCurrentUserProfile";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EmpresasView from "./EmpresasView";

export default async function EmpresasPage({ searchParams }: { searchParams: { editar?: string } }) {
  const supabase = createClient();
  const user = await getUsuarioAtual();
  const { data: perfil } = await perfilDaRequisicao(user!.id);
  if (perfil?.setor !== "ADMIN") redirect("/dashboard");

  const { data: empresas } = await supabase
    .from("empresas_terceirizadas")
    .select("id, nome, nome_empresarial, cnpj, inscricao_municipal, contato, email, telefone, whatsapp, especialidade, endereco, cep, bairro, municipio, uf, observacoes, ativo")
    .order("nome");

  const { data: contratosEmp } = await supabase.from("contratos").select("empresa_id, status");
  const qtdContratos: Record<string, { ativos: number; total: number }> = {};
  for (const c of contratosEmp ?? []) {
    const q = (qtdContratos[c.empresa_id] ??= { ativos: 0, total: 0 });
    q.total++;
    if (c.status === "ATIVO") q.ativos++;
  }

  return <EmpresasView empresas={empresas ?? []} qtdContratos={qtdContratos} editarInicial={searchParams.editar ?? null} />;
}
