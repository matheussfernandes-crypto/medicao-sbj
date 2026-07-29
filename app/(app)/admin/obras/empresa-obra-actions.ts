"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function assertAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (perfil?.setor !== "ADMIN") throw new Error("Sem permissão");
  return { supabase };
}

export async function vincularEmpresaObra(fd: FormData) {
  const { supabase } = await assertAdmin();
  const obraId = fd.get("obraId") as string;

  const retencaoContratual = fd.get("retencaoContratual") === "1";
  const retencaoPct = retencaoContratual ? Number(fd.get("retencaoPct") || "0") : 0;
  const dataTermino = (fd.get("dataTermino") as string) || null;

  const { error } = await supabase.from("empresa_obra").insert({
    obra_id: obraId,
    empresa_id: fd.get("empresaId") as string,
    tipo_servico: (fd.get("tipoServico") as string).trim(),
    data_inicio: fd.get("dataInicio") as string,
    data_termino: dataTermino,
    status: fd.get("status") as string,
    retencao_contratual: retencaoContratual,
    retencao_pct: retencaoPct,
    observacoes: ((fd.get("observacoes") as string) || "").trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/obras");
}

export async function editarVinculoEmpresaObra(fd: FormData) {
  const { supabase } = await assertAdmin();
  const id = fd.get("id") as string;
  const obraId = fd.get("obraId") as string;

  const retencaoContratual = fd.get("retencaoContratual") === "1";
  const retencaoPct = retencaoContratual ? Number(fd.get("retencaoPct") || "0") : 0;
  const dataTermino = (fd.get("dataTermino") as string) || null;

  await supabase.from("empresa_obra").update({
    empresa_id: fd.get("empresaId") as string,
    tipo_servico: (fd.get("tipoServico") as string).trim(),
    data_inicio: fd.get("dataInicio") as string,
    data_termino: dataTermino,
    status: fd.get("status") as string,
    retencao_contratual: retencaoContratual,
    retencao_pct: retencaoPct,
    observacoes: ((fd.get("observacoes") as string) || "").trim() || null,
  }).eq("id", id);

  revalidatePath("/admin/obras");
}

export async function removerVinculoEmpresaObra(fd: FormData) {
  const { supabase } = await assertAdmin();
  const id = fd.get("id") as string;
  // Só remove se não há lançamentos vinculados
  const { count } = await supabase
    .from("lancamentos")
    .select("id", { count: "exact", head: true })
    .eq("empresa_obra_id", id);
  if ((count ?? 0) > 0) throw new Error("Não é possível remover: há lançamentos vinculados a este contrato.");
  await supabase.from("empresa_obra").delete().eq("id", id);
  revalidatePath("/admin/obras");
}
