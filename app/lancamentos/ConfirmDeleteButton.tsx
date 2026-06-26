"use client";

export default function ConfirmDeleteButton() {
  return (
    <button
      type="submit"
      className="bg-red-100 text-red-700 rounded px-2 py-0.5 text-xs"
      onClick={(e) => {
        if (!confirm("Tem certeza que deseja excluir este lançamento? Essa ação não pode ser desfeita.")) {
          e.preventDefault();
        }
      }}
    >
      Excluir
    </button>
  );
}
