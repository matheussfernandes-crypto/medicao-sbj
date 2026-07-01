import Link from "next/link";
import { login } from "./actions";
import PasswordField from "../components/PasswordField";
import PwaInstallGuide from "../components/PwaInstallGuide";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { erro?: string; sucesso?: string };
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6">
        <h1 className="text-xl font-semibold text-primaryDark mb-1">Entrar</h1>
        <p className="text-sm text-gray-500 mb-4">Acesse com o email e a senha do seu cadastro.</p>

        <form action={login} className="space-y-3">
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
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm">Senha</label>
              <Link href="/esqueci-senha" className="text-xs text-primaryDark font-semibold">
                Esqueceu sua senha?
              </Link>
            </div>
            <PasswordField name="senha" required placeholder="••••••" />
          </div>

          {searchParams.erro && (
            <p className="text-sm text-red-600">{searchParams.erro}</p>
          )}
          {searchParams.sucesso && (
            <p className="text-sm text-green-700">{searchParams.sucesso}</p>
          )}

          <button
            type="submit"
            className="w-full bg-primary text-white rounded py-2 text-sm font-medium hover:bg-primaryDark transition"
          >
            Entrar
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 mt-4">
          Ainda não tem cadastro?{" "}
          <Link href="/cadastro" className="text-primaryDark font-semibold">
            Solicitar cadastro
          </Link>
        </p>
        <p className="text-xs text-gray-400 mt-3 text-center">
          Todo cadastro novo precisa ser aprovado pelo ADM antes do primeiro acesso.
        </p>

        {/* Guia de instalação PWA */}
        <PwaInstallGuide />
      </div>
    </main>
  );
}
