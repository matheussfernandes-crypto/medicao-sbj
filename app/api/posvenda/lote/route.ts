import { NextRequest, NextResponse } from "next/server";
import { COLECOES, erro, exigirPosvenda } from "@/lib/posvenda/server";

// Pós-venda: restaura um backup (.json gerado pela própria tela). Registros com o mesmo id são substituídos.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const r = await exigirPosvenda();
  if ("erro" in r) return r.erro;
  const corpo = await req.json().catch(() => null);
  const colecoes = corpo?.colecoes;
  if (!colecoes || typeof colecoes !== "object") return erro("Arquivo inválido", 400);
  const agora = new Date().toISOString();
  let total = 0;
  for (const nome of Object.keys(colecoes)) {
    if (!(COLECOES as readonly string[]).includes(nome)) return erro("Coleção desconhecida: " + nome, 400);
    const valor = colecoes[nome];
    const itens: { id: string; dados: Record<string, unknown> }[] =
      nome === "config"
        ? [{ id: "geral", dados: valor && typeof valor === "object" ? valor : {} }]
        : ((Array.isArray(valor) ? valor : []) as any[])
            .filter((x) => x && typeof x.id === "string" && x.id)
            .map(({ id, ...dados }) => ({ id, dados }));
    for (let i = 0; i < itens.length; i += 200) {
      const lote = itens.slice(i, i + 200).map((x) => ({ colecao: nome, id: x.id, dados: x.dados, atualizado_em: agora, atualizado_por: r.user.id }));
      const { error } = await r.supabase.from("posvenda_docs").upsert(lote, { onConflict: "colecao,id" });
      if (error) return erro("Não foi possível restaurar tudo. Parte pode ter entrado.", 500);
      total += lote.length;
    }
  }
  return NextResponse.json({ ok: true, total });
}
