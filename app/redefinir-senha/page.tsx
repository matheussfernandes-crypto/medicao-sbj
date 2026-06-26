"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [pronto, setPronto] = useState(false);
  const [linkValido, setLinkValido] = useState<boolean | null>(null);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    // O link de recuperação do Supabase chega com o token na própria URL.
    // O cliente do navegador detecta esse token automaticamente e cria uma
    // sessão temporária só para permitir a troca de senha.
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setLinkValido(!!data.session);
      setPronto(true);
    });
  }, []);

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }

    setEnviando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    await supabase.auth.signOut();
    setSucesso(true);
    setTimeout(() => {
      router.push("/login?sucesso=" + encodeURIComponent("Senha alterada com sucesso. Entre com a nova senha."));
    }, 1500);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6">
        <h1 className="text-xl font-semibold text-primaryDark mb-1">Definir nova senha</h1>

        {!pronto && <p className="text-sm text-gray-500">Verificando o link...</p>}

        {pronto && !linkValido && (
          <>
            <p className="text-sm text-red-600 mb-4">
              Este link de recuperação é inválido ou já expirou. Solicite um novo.
            </p>
            <Link href="/esqueci-senha" className="text-sm text-primaryDark font-semibold">
              Solicitar novo link
            </Link>
          </>
        )}

        {pronto && linkValido && !sucesso && (
          <form onSubmit={trocarSenha} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Nova senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Confirmar nova senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                placeholder="••••••"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-primary text-white rounded py-2 text-sm font-medium hover:bg-primaryDark transition disabled:opacity-60"
            >
              {enviando ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}

        {sucesso && (
          <p className="text-sm text-green-700">Senha alterada! Levando você para o login...</p>
        )}
      </div>
    </main>
  );
}
