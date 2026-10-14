import { createServiceClient } from "@/lib/supabase/service";

// Mesma fórmula da tela de Retiradas: saldo inicial + retenção das medições
// aprovadas (MEDICAO e VALE_MEDICAO) - retiradas já lançadas.
export async function saldoRetidoDisponivel(pessoaId: string): Promise<number> {
  const db = createServiceClient();

  const { data: pessoa } = await db.from("pessoas").select("saldo_inicial_retido").eq("id", pessoaId).single();
  const { data: medicoes } = await db
    .from("lancamentos")
    .select("total_reais, retencao_pct_usado")
    .eq("pessoa_id", pessoaId)
    .eq("status", "APROVADO")
    .in("tipo", ["MEDICAO", "VALE_MEDICAO"]);
  const { data: retiradas } = await db.from("retiradas_retido").select("valor").eq("pessoa_id", pessoaId);

  let total = Number(pessoa?.saldo_inicial_retido ?? 0);
  for (const l of medicoes ?? []) total += Number(l.total_reais) * Number(l.retencao_pct_usado ?? 0);
  for (const r of retiradas ?? []) total -= Number(r.valor);
  return Math.round(total * 100) / 100;
}

// Devolve (lança como retirada) todo o saldo retido de uma pessoa, deixando-o
// zerado. Mantém o histórico: aparece em Retiradas/Extrato como uma retirada
// automática de baixa. Não faz nada se o saldo já é zero.
export async function zerarRetidoDaPessoa(
  pessoaId: string,
  opts: { data: string; lancadoPor: string; observacao: string }
): Promise<{ valor: number; erro?: string }> {
  const saldo = await saldoRetidoDisponivel(pessoaId);
  if (saldo <= 0) return { valor: 0 };

  const db = createServiceClient();
  const { data: pessoa } = await db.from("pessoas").select("obra_id").eq("id", pessoaId).single();

  const { error } = await db.from("retiradas_retido").insert({
    pessoa_id: pessoaId,
    obra_id: pessoa?.obra_id ?? null,
    valor: saldo,
    data: opts.data,
    observacao: opts.observacao,
    lancado_por: opts.lancadoPor,
  });
  if (error) return { valor: 0, erro: error.message };
  return { valor: saldo };
}

// Para medições aprovadas depois da baixa: se a pessoa já está INATIVA, o
// retido novo também é devolvido na hora.
export async function zerarRetidoSeInativa(pessoaIds: string[], lancadoPor: string) {
  const ids = Array.from(new Set(pessoaIds.filter(Boolean)));
  if (!ids.length) return;
  const db = createServiceClient();
  const { data: inativas } = await db.from("pessoas").select("id").in("id", ids).eq("status", "INATIVO");
  const hoje = new Date().toISOString().slice(0, 10);
  for (const p of inativas ?? []) {
    await zerarRetidoDaPessoa(p.id, {
      data: hoje,
      lancadoPor,
      observacao: "Medição aprovada após a baixa — devolução automática do retido",
    });
  }
}
