import { redirect } from "next/navigation";

// A tela antiga do Andamento de Obra saiu (13/11/2026): tudo dela já estava no Andamento novo.
// Os dados antigos continuam guardados no banco (andamento_servicos/andamento_status/andamento_historico);
// para voltar com a tela, restaurar este arquivo pelo git (commit anterior).
export default function AndamentoObraPage() {
  redirect("/andamento-novo");
}
