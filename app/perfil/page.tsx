import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Topbar from "../components/Topbar";
import PasswordField from "../components/PasswordField";
import { salvarPerfil } from "./actions";

const SETOR_LABEL: Record<string, string> = {
  ESTAGIARIO: "Estagiário",
  ADMIN: "Engenheiro / ADM",
  RH: "RH",
  FINANCEIRO: "Financeiro",
};

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: { erro?: string; sucesso?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome_completo, email, setor")
    .eq("id", user.id)
    .single();

  if (!perfil) redirect("/login");

  return (
    <main className="min-h-screen">
      <Topbar setor={perfil.setor} />
      <div className="max-w-md mx-auto p-6 space-y-4">
        <h1 className="text-xl font-semibold text-primaryDark">Meu cadastro</h1>

        {searchParams.erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">{searchParams.erro}</div>
        )}
        {searchParams.sucesso && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3">{searchParams.sucesso}</div>
        )}

        <form action={salvarPerfil} className="bg-white rounded-xl shadow p-4 space-y-4">
          <div>
            <label className="block text-sm mb-1">Nome</label>
            <input
              name="nome"
              defaultValue={perfil.nome_completo}
              required
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-500">Email</label>
            <input
              value={perfil.email}
              disabled
              className="w-full border rounded px-3 py-2 text-sm bg-gray-50 text-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1">O email de login não pode ser alterado aqui.</p>
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-500">Setor</label>
            <input
              value={SETOR_LABEL[perfil.setor] ?? perfil.setor}
              disabled
              className="w-full border rounded px-3 py-2 text-sm bg-gray-50 text-gray-400"
            />
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-primaryDark mb-2">Trocar senha (opcional)</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Nova senha</label>
                <PasswordField name="novaSenha" minLength={6} placeholder="Deixe em branco para não alterar" />
              </div>
              <div>
                <label className="block text-sm mb-1">Confirmar nova senha</label>
                <PasswordField name="confirmarSenha" minLength={6} placeholder="Repita a nova senha" />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-white rounded py-2 text-sm font-medium hover:bg-primaryDark transition"
          >
            Salvar alterações
          </button>
        </form>
      </div>
    </main>
  );
}
