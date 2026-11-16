import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Cadastro único de unidades (proprietário, telefone, vaga, financiamento, situação).
// Usado pela tela Cadastros do pós-venda e pelo Controle de entregas. Só usuários aprovados.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function aprovado() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("perfis").select("status").eq("id", user.id).single();
  if (perfil?.status !== "aprovado") return null;
  return supabase;
}

const CAMPOS = ["id", "empreendimento_id", "obra_id", "numero", "bloco", "proprietario", "telefone", "contatos", "email", "vaga", "financiamento", "situacao_vistoria", "obs", "escritura", "criado_em"] as const;

// GET: todas as unidades (paginado de 1000 em 1000)
export async function GET() {
  const supabase = await aprovado();
  if (!supabase) return NextResponse.json({ ok: false, erro: "Sem acesso." }, { status: 401 });
  const itens: any[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from("cadastro_unidades").select(CAMPOS.join(", ")).order("obra_id").order("numero").range(de, de + 999);
    if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
    itens.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return NextResponse.json({ ok: true, unidades: itens });
}

// POST: grava um lote de unidades (upsert pelo id). Não apaga nada.
export async function POST(req: Request) {
  const supabase = await aprovado();
  if (!supabase) return NextResponse.json({ ok: false, erro: "Sem acesso." }, { status: 401 });
  const corpo = (await req.json().catch(() => null)) as { unidades?: any[] } | null;
  const lista = Array.isArray(corpo?.unidades) ? corpo!.unidades : [];
  if (!lista.length || lista.length > 500) return NextResponse.json({ ok: false, erro: "Lote inválido (1 a 500 unidades)." }, { status: 400 });
  const linhas = lista.map((u) => {
    const l: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
    CAMPOS.forEach((c) => {
      if (u[c] !== undefined) l[c] = u[c] == null ? "" : u[c];
    });
    return l;
  });
  const { error } = await supabase.from("cadastro_unidades").upsert(linhas, { onConflict: "id" });
  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, gravadas: linhas.length });
}
