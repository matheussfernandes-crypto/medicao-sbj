import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Módulo Pós-obra (public/pos-obra): utilitários das rotas /api/pos-obra/*.
// Todas exigem login e perfil aprovado (mesma regra do resto do site).

export const BUCKET = "posobra";

export async function exigirUsuario() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) } as const;
  const { data: perfil } = await supabase.from("perfis").select("status").eq("id", user.id).single();
  if (perfil?.status !== "aprovado") return { erro: NextResponse.json({ error: "Usuário sem acesso" }, { status: 403 }) } as const;
  return { supabase, user } as const;
}

export function erro(msg: string, status = 500) {
  return NextResponse.json({ error: msg }, { status });
}

// marca de tempo para o próximo "desde": um pouco antes do início da consulta, para não perder
// nada gravado durante ela (repetir um registro é inofensivo: o módulo junta sem duplicar)
export function agoraComFolga() {
  return new Date(Date.now() - 5000).toISOString();
}

export function desdeValido(v: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// "data:image/png;base64,...." -> bytes
export function dataUrlParaBytes(url: string): { bytes: Buffer; tipo: string } | null {
  const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(url || "");
  if (!m) return null;
  const tipo = m[1] || "application/octet-stream";
  const bytes = m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]));
  return { bytes, tipo };
}
