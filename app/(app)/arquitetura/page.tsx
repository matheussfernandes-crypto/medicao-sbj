import { redirect } from "next/navigation";

// Obras › Arquitetura: a entrada leva direto para Especificações.
export default function ArquiteturaPage() {
  redirect("/arquitetura/especificacoes");
}
