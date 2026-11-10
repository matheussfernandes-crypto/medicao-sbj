"use client";

// Botão que pede confirmação antes de executar uma ação do servidor.
export default function BotaoConfirmar({
  action,
  mensagem,
  rotulo,
}: {
  action: () => Promise<void>;
  mensagem: string;
  rotulo: string;
}) {
  return (
    <form
      action={action}
      className="inline"
      onSubmit={(e) => {
        if (!window.confirm(mensagem)) e.preventDefault();
      }}
    >
      <button className="bg-red-600 text-white rounded px-3 py-1 text-xs hover:bg-red-700 transition-colors duration-200">{rotulo}</button>
    </form>
  );
}
