"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Status } from "./types";

// Apontar: estagiário e ADM (o banco também confere pelas políticas RLS).
async function apontador() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase.from("perfis").select("setor, status").eq("id", user!.id).single();
  if (!perfil || perfil.status !== "aprovado" || !["ESTAGIARIO", "ADMIN"].includes(perfil.setor)) throw new Error("Sem permissão para apontar.");
  return supabase;
}

export type CelulaApontamento = { l?: string; i?: string; s: string };

export async function apontarLote(obraId: string, celulas: CelulaApontamento[], status: Status) {
  const supabase = await apontador();
  const TAMANHO = 1500;
  let mudaram = 0;
  for (let i = 0; i < celulas.length; i += TAMANHO) {
    const { data, error } = await supabase.rpc("an_apontar", {
      p_obra: obraId,
      p_celulas: celulas.slice(i, i + TAMANHO).map((c) => ({ l: c.l ?? null, i: c.i ?? null, s: c.s })),
      p_status: status,
    });
    if (error) throw new Error(error.message);
    mudaram += Number(data ?? 0);
  }
  revalidatePath("/andamento-novo", "layout");
  return mudaram;
}

export async function salvarObservacao(obraId: string, alvo: { l?: string; i?: string }, servicoId: string, texto: string) {
  const supabase = await apontador();
  const { error } = await supabase.rpc("an_observacao", {
    p_obra: obraId,
    p_local: alvo.l ?? null,
    p_item: alvo.i ?? null,
    p_servico: servicoId,
    p_texto: texto,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/andamento-novo", "layout");
}

export async function trocarReservatorio(itemId: string, chave: "cxf" | "cxc") {
  const supabase = await apontador();
  const { error } = await supabase.rpc("an_trocar_reservatorio", { p_item: itemId, p_chave: chave });
  if (error) throw new Error(error.message);
  revalidatePath("/andamento-novo", "layout");
}

export async function definirDescidas(sistemaId: string, parte: "emb" | "tor" | "res", face: "N" | "S" | "L" | "O", n: number) {
  const supabase = await apontador();
  const { error } = await supabase.rpc("an_definir_descidas", { p_sistema: sistemaId, p_parte: parte, p_face: face, p_n: n });
  if (error) throw new Error(error.message);
  revalidatePath("/andamento-novo", "layout");
}
