"use client";

export default function ConfirmDeleteButton({ jaFechado = false }: { jaFechado?: boolean }) {
  const mensagem = jaFechado
    ? "Atenção: este lançamento já faz parte de um fechamento mensal cujo PDF já foi gerado e enviado por email. Excluir agora NÃO atualiza o PDF que já foi enviado — pode haver divergência entre o relatório enviado e o sistema. Deseja excluir mesmo assim?"
    : "Tem certeza que deseja excluir este lançamento? Essa ação não pode ser desfeita.";

  return (
    <button
      type="submit"
      className="bg-red-100 text-red-700 rounded px-2 py-0.5 text-xs"
      onClick={(e) => {
        if (!confirm(mensagem)) {
          e.preventDefault();
        }
      }}
    >
      Excluir
    </button>
  );
}
