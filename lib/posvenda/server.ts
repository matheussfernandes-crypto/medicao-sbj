import { NextResponse } from "next/server";
import { erro, exigirUsuario } from "@/lib/pos-obra/server";
import { ehGestorAcessos, permitido } from "@/lib/acessos/modulos";

// Coleções do kit Pós-venda (os mesmos nomes que o HTML usa). Qualquer outra é recusada.
export const COLECOES = ["empreendimentos", "unidades", "responsaveis", "chamados", "agenda", "config"] as const;

// Pós-venda: login aprovado e acesso ao módulo (o gestor sempre tem).
export async function exigirPosvenda() {
  const r = await exigirUsuario();
  if (r.erro) return { erro: r.erro } as const;
  const { supabase, user } = r;
  const { data: perfil } = await supabase.from("perfis").select("acessos, nome_completo").eq("id", user.id).single();
  const liberado = ehGestorAcessos(user.email) || permitido((perfil?.acessos as string[] | null) ?? [], "/posvenda");
  if (!liberado) return { erro: NextResponse.json({ error: "Sem acesso ao Pós-venda" }, { status: 403 }) } as const;
  return { supabase, user, nome: (perfil?.nome_completo as string | null) ?? user.email ?? "" } as const;
}

export { erro };
