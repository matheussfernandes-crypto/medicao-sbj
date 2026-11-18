"use client";

import { Trash2 } from "lucide-react";
import { desfazivel, pedirConfirmacao } from "@/components/ui/Confirmacao";

// Excluir: pop-up de confirmação no rodapé; depois aparece "Desfazer" por alguns segundos e só então exclui.
export default function ConfirmDeleteButton({
  jaFechado = false,
  mensagemPersonalizada,
  rotulo,
}: {
  jaFechado?: boolean;
  mensagemPersonalizada?: string;
  rotulo?: string; // se informado, o símbolo vem com o texto ao lado
}) {
  const mensagem =
    mensagemPersonalizada ??
    (jaFechado
      ? "Atenção: este lançamento já faz parte de um fechamento mensal cujo PDF já foi gerado e enviado por email. Excluir agora NÃO atualiza o PDF que já foi enviado. Deseja excluir?"
      : "Tem certeza que deseja excluir este lançamento? Essa ação não pode ser desfeita.");

  return (
    <button
      type="button"
      className={rotulo ? "btn-acao-excluir-txt" : "btn-acao-excluir"}
      title={rotulo ?? "Excluir"}
      aria-label={rotulo ?? "Excluir"}
      onClick={async (e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        const ok = await pedirConfirmacao({ texto: mensagem, botao: "Excluir" });
        if (!ok) return;
        desfazivel("Exclusão confirmada.", () => form.requestSubmit());
      }}
    >
      <Trash2 className="w-4 h-4" aria-hidden />
      {rotulo}
    </button>
  );
}
