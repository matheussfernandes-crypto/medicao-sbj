import { redirect } from "next/navigation";
import { getUsuarioAtual, perfilDaRequisicao } from "@/lib/auth/getCurrentUserProfile";
import { createClient } from "@/lib/supabase/server";
import CadastroObras, { type ObraCadastro } from "./CadastroObras";

// Cadastro único de obras. Etapa 2: tela de consulta e edição. Os módulos ainda não leem daqui.
export default async function CadastroObrasPage() {
  const user = await getUsuarioAtual();
  const { data: perfil } = await perfilDaRequisicao(user!.id);
  if (perfil?.setor !== "ADMIN") redirect("/dashboard");

  const supabase = createClient();
  const { data, error } = await supabase
    .from("cadastro_obras")
    .select(
      "id, nome, nome_completo, nomes_alternativos, fase, cnpj, cno, razao_social, endereco, bairro, cidade, uf, cep, data_inicio, data_entrega_prevista, data_entrega_real, torres, pavimentos, unidades, responsavel_tecnico, aparece_medicao, aparece_andamento, aparece_vistorias, aparece_posvenda, obra_id, andamento_obra_id, posobra_id, posvenda_emp_id, observacoes, atualizado_em"
    )
    .order("nome");

  return <CadastroObras obras={(data ?? []) as ObraCadastro[]} erro={error?.message ?? null} />;
}
