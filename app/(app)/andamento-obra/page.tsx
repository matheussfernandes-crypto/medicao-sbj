import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarDadosObra } from "./data";
import AndamentoObraClient from "./AndamentoObraClient";

export default async function AndamentoObraPage({
  searchParams,
}: {
  searchParams: { obra?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("setor, nome_completo").eq("id", user!.id).single();
  if (perfil?.setor !== "ESTAGIARIO" && perfil?.setor !== "ADMIN") redirect("/dashboard");

  const { data: obras } = await supabase.from("obras").select("id, nome").order("nome");
  const obraSelecionada = searchParams.obra || obras?.[0]?.id || null;

  if (!obraSelecionada) {
    return (
      <div className="card text-center text-sm text-ink-500 py-16">
        Nenhuma obra cadastrada ainda. Cadastre uma obra em "Obras &amp; Pessoas" primeiro.
      </div>
    );
  }

  const dados = await buscarDadosObra(obraSelecionada);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-primaryDark">Andamento de Obra</h1>
        <p className="text-sm text-ink-500">Fluxograma vertical de serviços por pavimento e unidade.</p>
      </div>
      <AndamentoObraClient key={obraSelecionada} obras={obras ?? []} dados={dados} nomeUsuario={perfil?.nome_completo ?? "Você"} />
    </div>
  );
}
