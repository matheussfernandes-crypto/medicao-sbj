"use server";

// Histórico dos PDFs de especificação: grava quem gerou, quando e qual arquivo (tabela esp_pdfs).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RegistroPdf = { projeto_id?: string | null; obra_id?: string | null; grupo: string; arquivo: string; rev?: string | null; papel?: string | null };

export async function registrarPdf(r: RegistroPdf) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: perfil } = await supabase.from("perfis").select("nome_completo, email").eq("id", user.id).maybeSingle();
  await supabase.from("esp_pdfs").insert({
    projeto_id: r.projeto_id || null, obra_id: r.obra_id || null, grupo: r.grupo, arquivo: String(r.arquivo).slice(0, 300),
    rev: r.rev || null, papel: r.papel || null, gerado_por: user.id, gerado_por_nome: perfil?.nome_completo || perfil?.email || user.email || null,
  });
  if (r.projeto_id) revalidatePath(`/arquitetura/especificacoes/${r.projeto_id}`);
  if (r.obra_id) revalidatePath(`/arquitetura/especificacoes/predio/${r.obra_id}`);
}
