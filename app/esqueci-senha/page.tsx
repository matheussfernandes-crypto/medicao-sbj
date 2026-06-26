import Link from "next/link";
import { solicitarRecuperacaoSenha } from "./actions";

export default function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: { erro?: string; sucesso?: string };
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6">
        <h1 className="text-xl font-semibold text-primaryDark mb-1">Esqueceu sua senha?</h1>
        <p className="text-sm text-gray-500 mb-4">
          Informe o email do seu cadastro. Vamos enviar um link para você definir uma nova senha.
        </p>

        {searchParams.sucesso ? (
          <p className="text-sm text-green-700">{searchParams.sucesso}</p>
        ) : (
          <form action={solicitarRecuperacaoSenha} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                name="email"
                type="email"
                required
                placeholder="seuemail@empresa.com.br"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            {searchParams.erro && (
              <p className="text-sm text-red-600">{searchParams.erro}</p>
            )}

            <button
              type="submit"
              className="w-full bg-primary text-white rounded py-2 text-sm font-medium hover:bg-primaryDark transition"
            >
              Enviar link de recuperação
            </button>
          </form>
        )}

        <p className="text-sm text-center text-gray-500 mt-4">
          <Link href="/login" className="text-primaryDark font-semibold">
            Voltar para o login
          </Link>
        </p>
      </div>
    </main>
  );
}
