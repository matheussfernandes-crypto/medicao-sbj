import { createClient } from "@/lib/supabase/server";
import { sair } from "../auth-actions";

export default async function AguardandoAprovacaoPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let status: string | null = null;
  if (user) {
    const { data: perfil } = await supabase.from("perfis").select("status").eq("id", user.id).single();
    status = perfil?.status ?? null;
  }

  const rejeitado = status === "rejeitado";
  const desativado = status === "desativado";

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6 text-center">
        <h1 className="text-xl font-semibold text-primaryDark mb-2">
          {desativado ? "Acesso desativado" : rejeitado ? "Cadastro rejeitado" : "Cadastro pendente"}
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          {desativado
            ? "Seu acesso a este sistema foi desativado pelo ADM. Fale com o responsável se acredita que isso é um engano."
            : rejeitado
            ? "Seu cadastro foi rejeitado pelo ADM. Fale com o responsável se acredita que isso é um engano."
            : "Seu cadastro foi enviado e está aguardando aprovação do ADM. Você receberá acesso assim que for aprovado."}
        </p>
        <form action={sair}>
          <button type="submit" className="text-sm text-primaryDark font-semibold">
            Sair
          </button>
        </form>
      </div>
    </main>
  );
}
