"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function assertAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: perfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (perfil?.setor !== "ADMIN") throw new Error("Sem permissão");
  return { supabase, userId: user!.id };
}

function extrairCampos(fd: FormData) {
  return {
    nome: (fd.get("nome") as string).trim(),
    nome_empresarial: (fd.get("nome_empresarial") as string).trim() || null,
    cnpj: (fd.get("cnpj") as string).trim() || null,
    inscricao_municipal: (fd.get("inscricao_municipal") as string).trim() || null,
    contato: (fd.get("contato") as string).trim() || null,
    email: (fd.get("email") as string).trim() || null,
    telefone: (fd.get("telefone") as string).trim() || null,
    endereco: (fd.get("endereco") as string).trim() || null,
    cep: (fd.get("cep") as string).trim() || null,
    bairro: (fd.get("bairro") as string).trim() || null,
    municipio: (fd.get("municipio") as string).trim() || null,
    uf: (fd.get("uf") as string).trim().toUpperCase() || null,
    observacoes: (fd.get("observacoes") as string).trim() || null,
  };
}

export async function criarEmpresa(fd: FormData) {
  const { supabase } = await assertAdmin();
  const { error } = await supabase.from("empresas_terceirizadas").insert(extrairCampos(fd));
  if (error) throw new Error(error.message);
  revalidatePath("/admin/empresas");
}

export async function editarEmpresa(fd: FormData) {
  const { supabase } = await assertAdmin();
  const id = fd.get("id") as string;
  await supabase.from("empresas_terceirizadas").update(extrairCampos(fd)).eq("id", id);
  revalidatePath("/admin/empresas");
}

export async function toggleEmpresaAtivo(fd: FormData) {
  const { supabase } = await assertAdmin();
  const id = fd.get("id") as string;
  const ativo = fd.get("ativo") === "true";
  await supabase.from("empresas_terceirizadas").update({ ativo: !ativo }).eq("id", id);
  revalidatePath("/admin/empresas");
}
