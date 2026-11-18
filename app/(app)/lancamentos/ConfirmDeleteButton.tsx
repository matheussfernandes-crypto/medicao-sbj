"use client";

import { Trash2 } from "lucide-react";

export default function ConfirmDeleteButton({
  jaFechado = false,
  mensagemPersonalizada,
}: {
  jaFechado?: boolean;
  mensagemPersonalizada?: string;
}) {
  const mensagem =
    mensagemPersonalizada ??
    (jaFechado
      ? "Atenção: este lançamento já faz parte de um fechamento mensal cujo PDF já foi gerado e enviado por email. Excluir agora NÃO atualiza o PDF que já foi enviado — pode haver divergência entre o relatório enviado e o sistema. Deseja excluir mesmo assim?"
      : "Tem certeza que deseja excluir este lançamento? Essa ação não pode ser desfeita.");

  return (
    <button
      type="submit"
      className="btn-acao-excluir"
      title="Excluir"
      aria-label="Excluir"
      onClick={(e) => {
        if (!confirm(mensagem)) {
          e.preventDefault();
        }
      }}
    >
      <Trash2 className="w-4 h-4" aria-hidden />
    </button>
  );
}
