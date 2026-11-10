"use client";

import { useState, useTransition } from "react";
import { LockKeyhole } from "lucide-react";
import { solicitarAcesso } from "@/app/(app)/acessos/actions";
import { rotuloModulo } from "@/lib/acessos/modulos";

// Tela mostrada quando a pessoa abre um módulo que ainda não foi liberado para ela.
export default function SemAcesso({ modulo }: { modulo: string }) {
  const [enviado, setEnviado] = useState<"novo" | "ja" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const pedir = () => {
    setErro(null);
    iniciar(async () => {
      try {
        const r = await solicitarAcesso(modulo);
        setEnviado(r.jaExistia ? "ja" : "novo");
      } catch (e: any) {
        setErro(e?.message ?? "Não foi possível enviar o pedido.");
      }
    });
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="card max-w-md w-full text-center space-y-4 p-8">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <LockKeyhole className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-semibold text-primaryDark">Você não tem acesso a {rotuloModulo(modulo)}</h1>
        <p className="text-sm text-ink-500">
          Este módulo ainda não foi liberado para o seu usuário. Peça acesso e o responsável vai analisar.
        </p>

        {enviado === "novo" && <p className="text-sm font-medium text-primary">Pedido enviado. Você será avisado quando for liberado.</p>}
        {enviado === "ja" && <p className="text-sm font-medium text-primary">Você já tem um pedido em análise para este módulo.</p>}
        {erro && <p className="text-sm text-danger">{erro}</p>}

        {!enviado && (
          <button
            type="button"
            onClick={pedir}
            disabled={pendente}
            className="inline-flex items-center justify-center bg-primary text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-primaryDark transition-colors duration-200 disabled:opacity-60"
          >
            {pendente ? "Enviando..." : "Solicitar acesso"}
          </button>
        )}
      </div>
    </div>
  );
}
