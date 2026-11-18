"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pedirConfirmacao } from "@/components/ui/Confirmacao";

type Resultado = { erro?: string; ok?: string; id?: string };

/**
 * Formulário que chama uma Server Action que devolve { erro | ok }, mostra a
 * mensagem na própria tela (sem recarregar a página inteira) e atualiza os
 * dados com router.refresh().
 */
export default function FormAcao({
  action,
  children,
  className,
  reset = true,
  onSucesso,
  confirmar,
  mostrarOk = true,
}: {
  action: (fd: FormData) => Promise<Resultado>;
  children: React.ReactNode;
  className?: string;
  reset?: boolean;
  onSucesso?: (r: Resultado) => void | Promise<void>;
  confirmar?: string;
  mostrarOk?: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [pendente, start] = useTransition();
  const [msg, setMsg] = useState<Resultado | null>(null);

  function enviar(fd: FormData) {
    setMsg(null);
    start(async () => {
      const r = await action(fd);
      setMsg(r);
      if (!r.erro) {
        if (reset) ref.current?.reset();
        await onSucesso?.(r);
        router.refresh();
      }
    });
  }

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        if (confirmar) {
          const ok = await pedirConfirmacao({ texto: confirmar, botao: "Confirmar" });
          if (!ok) return;
        }
        enviar(fd);
      }}
    >
      <fieldset disabled={pendente} className="contents">
        {children}
      </fieldset>
      {pendente && <p className="basis-full w-full text-xs text-ink-500 mt-1">Salvando…</p>}
      {msg?.erro && (
        <p className="basis-full w-full mt-2 text-sm text-danger bg-red-50 border border-red-200 rounded px-3 py-2">{msg.erro}</p>
      )}
      {mostrarOk && msg?.ok && !pendente && (
        <p className="basis-full w-full mt-2 text-sm text-success bg-green-50 border border-green-200 rounded px-3 py-2">{msg.ok}</p>
      )}
    </form>
  );
}
