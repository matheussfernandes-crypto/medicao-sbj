import Link from "next/link";
import { Mail } from "lucide-react";
import { login } from "./actions";
import PasswordField from "../components/PasswordField";
import PwaInstallGuide from "../components/PwaInstallGuide";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { erro?: string; sucesso?: string };
}) {
  return (
    <main className="min-h-screen lg:flex">
      {/* Painel de marca — some no mobile, ocupa metade da tela no desktop */}
      <div className="hidden lg:flex lg:w-1/2 bg-primaryDark relative overflow-hidden flex-col justify-between p-12">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px), radial-gradient(circle at 60% 70%, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <img src="/logo-topbar.png" alt="SBJ" className="h-12 w-auto relative" />
        <div className="relative">
          <h1 className="text-3xl font-semibold text-white leading-tight max-w-md">
            Sistema de Medição de Empreiteiros
          </h1>
          <p className="text-white/60 mt-3 max-w-sm">
            Medição, retenção e fechamento de obra em um só lugar — SBJ Construtora e Incorporadora.
          </p>
        </div>
        <p className="text-white/30 text-xs relative">© {new Date().getFullYear()} SBJ Construtora e Incorporadora</p>
      </div>

      {/* Painel de login */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-12 bg-surface-subtle">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <img src="/logo-topbar.png" alt="SBJ" className="h-9 w-auto bg-primaryDark rounded p-1" />
            <span className="font-semibold text-primaryDark">Medição SBJ</span>
          </div>

          <h1 className="text-xl font-semibold text-ink-900 mb-1">Entrar</h1>
          <p className="text-sm text-ink-500 mb-6">Acesse com o email e a senha do seu cadastro.</p>

          <form action={login} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="seuemail@empresa.com.br"
                  className="w-full border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-ink-700">Senha</label>
                <Link href="/esqueci-senha" className="text-xs text-primary font-semibold hover:underline">
                  Esqueceu sua senha?
                </Link>
              </div>
              <PasswordField name="senha" required placeholder="••••••" />
            </div>

            {searchParams.erro && (
              <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">{searchParams.erro}</p>
            )}
            {searchParams.sucesso && (
              <p className="text-sm text-success bg-success/5 border border-success/20 rounded-lg px-3 py-2">{searchParams.sucesso}</p>
            )}

            <button
              type="submit"
              className="w-full bg-primary text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-primaryDark transition shadow-panel"
            >
              Entrar
            </button>
          </form>

          <p className="text-sm text-center text-ink-500 mt-6">
            Ainda não tem cadastro?{" "}
            <Link href="/cadastro" className="text-primary font-semibold hover:underline">
              Solicitar cadastro
            </Link>
          </p>
          <p className="text-xs text-ink-400 mt-3 text-center">
            Todo cadastro novo precisa ser aprovado pelo ADM antes do primeiro acesso.
          </p>

          {/* Guia de instalação PWA */}
          <PwaInstallGuide />
        </div>
      </div>
    </main>
  );
}
