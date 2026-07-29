import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarOS } from "../actions";
import NovaOSForm from "../NovaOSForm";
import { SETORES_EXECUTORES } from "../constants";

export default async function NovaOSPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (!perfil || !SETORES_EXECUTORES.includes(perfil.setor)) redirect("/manutencoes");

  const [{ data: obras }, { data: torres }, { data: pavimentos }, { data: unidades }] = await Promise.all([
    supabase.from("obras").select("id, nome").order("nome"),
    supabase.from("torres").select("id, obra_id, nome").order("ordem"),
    supabase.from("pavimentos").select("id, torre_id, nome").order("ordem"),
    supabase.from("unidades").select("id, pavimento_id, nome").order("ordem"),
  ]);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-primaryDark">Nova Ordem de Serviço</h1>
        <p className="text-sm text-ink-500">Cadastro rápido — o responsável pela execução pode ser atribuído depois.</p>
      </div>

      {searchParams.erro && (
        <div className="card bg-red-50 border border-red-200 text-red-700 text-sm">{searchParams.erro}</div>
      )}

      <NovaOSForm
        obras={obras ?? []}
        torres={torres ?? []}
        pavimentos={pavimentos ?? []}
        unidades={unidades ?? []}
        criarOS={criarOS}
      />
    </div>
  );
}
