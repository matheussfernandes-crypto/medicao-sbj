import Link from "next/link";
import { solicitarCadastro } from "./actions";

export default function CadastroPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6">
        <h1 className="text-xl font-semibold text-primaryDark mb-1">Solicitar cadastro</h1>
        <p className="text-sm text-gray-500 mb-4">Seu acesso só é liberado depois que o ADM aprovar o cadastro.</p>

        <form action={solicitarCadastro} className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Nome completo</label>
            <input name="nomeCompleto" required className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input name="email" type="email" required className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm mb-1">Senha</label>
            <input name="senha" type="password" required minLength={6} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm mb-1">Qual setor você quer se cadastrar</label>
            <select name="setor" required className="w-full border rounded px-3 py-2 text-sm">
              <option value="ESTAGIARIO">Estagiário</option>
              <option value="ADMIN">Engenheiro / ADM</option>
              <option value="RH">RH</option>
              <option value="FINANCEIRO">Financeiro</option>
            </select>
          </div>

          {searchParams.erro && <p className="text-sm text-red-600">{searchParams.erro}</p>}

          <button
            type="submit"
            className="w-full bg-primary text-white rounded py-2 text-sm font-medium hover:bg-primaryDark transition"
          >
            Enviar solicitação de cadastro
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 mt-4">
          Já tem cadastro?{" "}
          <Link href="/login" className="text-primaryDark font-semibold">
            Voltar para Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
