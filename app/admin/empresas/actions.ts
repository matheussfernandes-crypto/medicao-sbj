"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function assertAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (perfil?.setor !== "ADMIN") throw new Error("Sem permissão");
  return { supabase, userId: user!.id };
}

export async function criarEmpresa(fd: FormData) {
  const { supabase } = await assertAdmin();
  const nome = (fd.get("nome") as string).trim();
  const cnpj = (fd.get("cnpj") as string).trim() || null;
  const contato = (fd.get("contato") as string).trim() || null;
  const email = (fd.get("email") as string).trim() || null;
  const telefone = (fd.get("telefone") as string).trim() || null;
  const observacoes = (fd.get("observacoes") as string).trim() || null;

  const { error } = await supabase.from("empresas_terceirizadas").insert({
    nome, cnpj, contato, email, telefone, observacoes,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/empresas");
}

export async function editarEmpresa(fd: FormData) {
  const { supabase } = await assertAdmin();
  const id = fd.get("id") as string;
  const nome = (fd.get("nome") as string).trim();
  const cnpj = (fd.get("cnpj") as string).trim() || null;
  const contato = (fd.get("contato") as string).trim() || null;
  const email = (fd.get("email") as string).trim() || null;
  const telefone = (fd.get("telefone") as string).trim() || null;
  const observacoes = (fd.get("observacoes") as string).trim() || null;

  await supabase.from("empresas_terceirizadas").update({
    nome, cnpj, contato, email, telefone, observacoes,
  }).eq("id", id);
  revalidatePath("/admin/empresas");
}

export async function toggleEmpresaAtivo(fd: FormData) {
  const { supabase } = await assertAdmin();
  const id = fd.get("id") as string;
  const ativo = fd.get("ativo") === "true";
  await supabase.from("empresas_terceirizadas").update({ ativo: !ativo }).eq("id", id);
  revalidatePath("/admin/empresas");
}
