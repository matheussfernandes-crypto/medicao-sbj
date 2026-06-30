"use client";

import { useRef, useState, useTransition } from "react";
import { enviarNotificacaoAvulsa } from "./actions";

type Perfil = { id: string; nome_completo: string; setor: string };

const SETOR_LABEL: Record<string, string> = {
  ESTAGIARIO: "Estagiário",
  ADMIN: "Engenheiro / ADM",
  RH: "RH",
  FINANCEIRO: "Financeiro",
};

export default function NotificacaoAvulsaPanel({ usuarios }: { usuarios: Perfil[] }) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "ok" | "erro">("idle");
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    if (selecionados.size === usuarios.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(usuarios.map((u) => u.id)));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Adicionar destinatários manualmente (checkboxes)
    selecionados.forEach((id) => fd.append("destinatarios", id));

    startTransition(async () => {
      try {
        await enviarNotificacaoAvulsa(fd);
        setStatus("ok");
        setMsg("Notificação enviada!");
        formRef.current?.reset();
        setSelecionados(new Set());
      } catch (err: unknown) {
        setStatus("erro");
        setMsg(err instanceof Error ? err.message : "Erro ao enviar.");
      }
      setTimeout(() => setStatus("idle"), 4000);
    });
  }

  return (
    <div className="card space-y-4">
      <h2 className="text-lg font-semibold text-primaryDark">📣 Enviar notificação para usuários</h2>
      <p className="text-sm text-gray-500">
        Selecione os destinatários e escreva a mensagem. Eles recebem a notificação no celular (iOS / Android) se tiverem o app adicionado à tela inicial.
      </p>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Título</label>
          <input
            name="titulo"
            required
            maxLength={60}
            placeholder="Ex: Atenção"
            className="input w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Mensagem</label>
          <textarea
            name="mensagem"
            required
            maxLength={200}
            rows={3}
            placeholder="Ex: Haverá paralisação na obra X amanhã."
            className="input w-full resize-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Destinatários</label>
            <button type="button" onClick={toggleTodos} className="text-xs text-primary underline">
              {selecionados.size === usuarios.length ? "Desmarcar todos" : "Selecionar todos"}
            </button>
          </div>
          <div className="border rounded max-h-48 overflow-y-auto divide-y">
            {usuarios.map((u) => (
              <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selecionados.has(u.id)}
                  onChange={() => toggle(u.id)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm">
                  {u.nome_completo}{" "}
                  <span className="text-gray-400 text-xs">({SETOR_LABEL[u.setor] ?? u.setor})</span>
                </span>
              </label>
            ))}
            {usuarios.length === 0 && (
              <p className="p-3 text-sm text-gray-400">Nenhum usuário aprovado cadastrado.</p>
            )}
          </div>
          {selecionados.size > 0 && (
            <p className="text-xs text-gray-500 mt-1">{selecionados.size} selecionado(s)</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending || selecionados.size === 0}
            className="btn-primary px-5 disabled:opacity-50"
          >
            {isPending ? "Enviando…" : "Enviar notificação"}
          </button>
          {status !== "idle" && (
            <span className={status === "ok" ? "text-green-600 text-sm" : "text-red-600 text-sm"}>
              {msg}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
