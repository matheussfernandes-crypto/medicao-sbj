import { createClient } from "@/lib/supabase/server";
import {
  criarLancamento,
  aprovarLancamento,
  rejeitarLancamento,
  editarLancamento,
  excluirLancamento,
  excluirLancamentoProprio,
  aprovarEmLote,
  notificarEngenheiroConferir,
} from "./actions";
import Topbar from "../components/Topbar";
import NovoLancamentoForm from "./NovoLancamentoForm";
import LancamentosTable from "./LancamentosTable";

export default async function LancamentosPage({
  searchParams,
}: {
  searchParams: { obra?: string; erro?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: meuPerfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  const ehAdmin = meuPerfil?.setor === "ADMIN";

  const { data: obras } = await supabase.from("obras").select("id, nome").order("nome");
  const obraId = searchParams.obra || obras?.[0]?.id || null;
  const obraNome = obras?.find((o) => o.id === obraId)?.nome ?? "";

  const { data: pessoas } = obraId
    ? await supabase
        .from("pessoas")
        .select("id, nome")
        .eq("obra_id", obraId)
        .eq("status", "ATIVO")
        .eq("papel", "EMPREITEIRO")
        .order("nome")
    : { data: [] };

  const { data: todasPessoasObra } = obraId
    ? await supabase.from("pessoas").select("id, nome").eq("obra_id", obraId)
    : { data: [] };

  // Contratos de empresas terceirizadas com status ATIVO para esta obra
  const { data: contratosAtivos } = obraId
    ? await supabase
        .from("empresa_obra")
        .select("id, tipo_servico, retencao_pct, retencao_contratual, empresas_terceirizadas(nome)")
        .eq("obra_id", obraId)
        .eq("status", "ATIVO")
        .order("criado_em")
    : { data: [] };

  const empresasContrato = (contratosAtivos ?? []).map((c) => ({
    id: c.id,
    empresa_nome: (c.empresas_terceirizadas as any)?.nome ?? "—",
    tipo_servico: c.tipo_servico,
    retencao_pct: Number(c.retencao_pct),
    retencao_contratual: c.retencao_contratual,
  }));

  const { data: servicos } = obraId
    ? await supabase.from("servicos").select("id, nome, tipo, valor_unitario").eq("obra_id", obraId).order("criado_em")
    : { data: [] };

  const { data: lancamentos } = obraId
    ? await supabase
        .from("lancamentos")
        .select(
          "id, tipo, data, mes_referencia, pessoa_id, servico, local, detalhe_texto, total_reais, valor_vale_hibrido, retencao_pct_usado, status, vale_real, observacao_medicao, quantidade, criado_por, motivo_rejeicao"
        )
        .eq("obra_id", obraId)
        .order("criado_em", { ascending: false })
        .limit(50)
    : { data: [] };

  const nomesPessoas: Record<string, string> = {};
  for (const p of todasPessoasObra ?? []) nomesPessoas[p.id] = p.nome;

  const idsCriadores = Array.from(new Set((lancamentos ?? []).map((l) => l.criado_por).filter(Boolean)));
  const nomesCriadores: Record<string, string> = {};
  if (idsCriadores.length > 0) {
    const { data: perfisCriadores } = await supabase
      .from("perfis")
      .select("id, nome_completo")
      .in("id", idsCriadores as string[]);
    for (const p of perfisCriadores ?? []) nomesCriadores[p.id] = p.nome_completo;
  }

  const { data: fechamentosObra } = obraId
    ? await supabase.from("fechamentos").select("tipo, mes_referencia").eq("obra_id", obraId)
    : { data: [] };
  const mesesFechadosArr = (fechamentosObra ?? []).map((f) => `${f.tipo}-${f.mes_referencia}`);

  return (
    <main className="min-h-screen">
      <Topbar setor={meuPerfil?.setor} />
      <div className="p-8 space-y-4">
        <h1 className="text-xl font-semibold text-primaryDark">Lançamentos — Medição &amp; Vale</h1>

        <div className="card">
          <form method="get" className="flex gap-2">
            <select name="obra" defaultValue={obraId ?? ""} className="border rounded px-3 py-2 flex-1">
              {(obras ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
            <button className="bg-gray-200 rounded px-4 py-2">Ver obra</button>
          </form>
        </div>

        {obraId && (
          <div className="card">
            <h2 className="font-semibold text-primaryDark mb-2">Novo lançamento</h2>
            {pessoas && pessoas.length > 0 ? (
              <NovoLancamentoForm
                obraId={obraId}
                pessoas={pessoas}
                servicos={servicos ?? []}
                empresasContrato={empresasContrato}
                criarLancamento={criarLancamento}
              />
            ) : (
              <p className="text-sm text-gray-400">Nenhuma pessoa ativa nesta obra. Cadastre em RH &amp; Pessoas.</p>
            )}
          </div>
        )}

        {searchParams.erro && (
          <div className="card bg-red-50 border border-red-200 text-red-700 text-sm">
            {searchParams.erro}
          </div>
        )}

        {obraId && (
          <div className="card">
            <h2 className="font-semibold text-primaryDark mb-3">Histórico de lançamentos</h2>
            {lancamentos && lancamentos.length > 0 ? (
              <LancamentosTable
                lancamentos={lancamentos as any}
                obraId={obraId}
                obraNome={obraNome}
                nomesPessoas={nomesPessoas}
                nomesCriadores={nomesCriadores}
                pessoas={pessoas ?? []}
                servicos={servicos ?? []}
                ehAdmin={ehAdmin}
                meuUserId={user!.id}
                mesesFechados={new Set(mesesFechadosArr)}
                aprovarLancamento={aprovarLancamento}
                rejeitarLancamento={rejeitarLancamento}
                editarLancamento={editarLancamento}
                excluirLancamento={excluirLancamento}
                excluirLancamentoProprio={excluirLancamentoProprio}
              />
            ) : (
              <p className="text-sm text-gray-400">Nenhum lançamento encontrado para esta obra.</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
