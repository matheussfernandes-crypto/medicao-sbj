import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Topbar from "../../components/Topbar";

function mesAtualISO() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function mesLabel(mes: string) {
  const [ano, m] = mes.split("-");
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${nomes[Number(m) - 1] ?? m}/${ano}`;
}

function ultimosMeses(qtd: number, mesFinalISO: string): string[] {
  const meses: string[] = [];
  const [anoStr, mesStr] = mesFinalISO.split("-");
  const d = new Date(Number(anoStr), Number(mesStr) - 1, 1);
  for (let i = 0; i < qtd; i++) {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    meses.unshift(`${ano}-${mes}`);
    d.setMonth(d.getMonth() - 1);
  }
  return meses;
}

export default async function DashboardGastosPage({
  searchParams,
}: {
  searchParams: { mes?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: meuPerfil } = await supabase.from("perfis").select("setor").eq("id", user!.id).single();
  if (meuPerfil?.setor !== "FINANCEIRO" && meuPerfil?.setor !== "ADMIN") redirect("/dashboard");

  const mesSelecionado = searchParams.mes && /^\d{4}-\d{2}$/.test(searchParams.mes) ? searchParams.mes : mesAtualISO();

  const { data: obras } = await supabase.from("obras").select("id, nome");
  const nomeObra: Record<string, string> = {};
  for (const o of obras ?? []) nomeObra[o.id] = o.nome;

  const { data: lancamentos } = await supabase
    .from("lancamentos")
    .select("obra_id, mes_referencia, tipo, total_reais, vale_real, status")
    .eq("status", "APROVADO");

  const todos = lancamentos ?? [];
  const meses6 = ultimosMeses(6, mesSelecionado);

  // Totais por obra no mês selecionado
  type Resumo = { medicao: number; valeReal: number; valeCorrecao: number };
  const porObraMesAtual: Record<string, Resumo> = {};
  for (const obraId of Object.keys(nomeObra)) porObraMesAtual[obraId] = { medicao: 0, valeReal: 0, valeCorrecao: 0 };

  // Totais por mês (todas as obras somadas), últimos 6 meses até o mês selecionado
  const porMes: Record<string, number> = {};
  for (const m of meses6) porMes[m] = 0;

  for (const l of todos) {
    const valor = Number(l.total_reais ?? 0);
    if (l.mes_referencia === mesSelecionado) {
      if (!porObraMesAtual[l.obra_id]) porObraMesAtual[l.obra_id] = { medicao: 0, valeReal: 0, valeCorrecao: 0 };
      if (l.tipo === "MEDICAO") porObraMesAtual[l.obra_id].medicao += valor;
      else if (l.vale_real) porObraMesAtual[l.obra_id].valeReal += valor;
      else porObraMesAtual[l.obra_id].valeCorrecao += valor;
    }
    if (l.mes_referencia in porMes) {
      porMes[l.mes_referencia] += valor;
    }
  }

  const obraIds = Object.keys(nomeObra).filter((id) => {
    const r = porObraMesAtual[id];
    return r && (r.medicao + r.valeReal + r.valeCorrecao) > 0;
  });
  const totalGeralMesAtual = obraIds.reduce(
    (s, id) => s + porObraMesAtual[id].medicao + porObraMesAtual[id].valeReal + porObraMesAtual[id].valeCorrecao,
    0
  );
  const maiorObra = Math.max(1, ...obraIds.map((id) => porObraMesAtual[id].medicao + porObraMesAtual[id].valeReal + porObraMesAtual[id].valeCorrecao));
  const maiorMes = Math.max(1, ...Object.values(porMes));

  return (
    <main className="min-h-screen">
      <Topbar setor="FINANCEIRO" />
      <div className="p-8 space-y-4">
        <h1 className="text-xl font-semibold text-primaryDark">Dashboard de gastos</h1>
        <p className="text-sm text-gray-500">
          Visão geral dos valores aprovados (medições e vales). Mês de referência: {mesLabel(mesSelecionado)}.
        </p>

        <form method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Selecionar mês</label>
            <input type="month" name="mes" defaultValue={mesSelecionado} className="border rounded px-2 py-1" />
          </div>
          <button className="bg-primary text-white rounded px-3 py-1">Ver mês</button>
        </form>

        <div className="card">
          <h2 className="font-semibold text-primaryDark mb-1">Total geral no mês — {mesLabel(mesSelecionado)}</h2>
          <p className="text-3xl font-bold text-primary">R$ {totalGeralMesAtual.toFixed(2)}</p>
        </div>

        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-primaryDark mb-3">Gasto por obra no mês selecionado</h2>
          {obraIds.length > 0 ? (
            <div className="space-y-2">
              {obraIds
                .sort((a, b) => {
                  const ta = porObraMesAtual[a].medicao + porObraMesAtual[a].valeReal + porObraMesAtual[a].valeCorrecao;
                  const tb = porObraMesAtual[b].medicao + porObraMesAtual[b].valeReal + porObraMesAtual[b].valeCorrecao;
                  return tb - ta;
                })
                .map((id) => {
                  const r = porObraMesAtual[id];
                  const total = r.medicao + r.valeReal + r.valeCorrecao;
                  const pct = Math.round((total / maiorObra) * 100);
                  return (
                    <div key={id}>
                      <div className="flex justify-between text-sm mb-0.5">
                        <span>{nomeObra[id]}</span>
                        <span className="font-semibold">R$ {total.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded h-3">
                        <div className="bg-primary rounded h-3" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Medição: R$ {r.medicao.toFixed(2)} · Vale real: R$ {r.valeReal.toFixed(2)} · Vale correção: R$ {r.valeCorrecao.toFixed(2)}
                      </p>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nenhuma medição ou vale aprovado neste mês ainda.</p>
          )}
        </div>

        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-primaryDark mb-3">Evolução — últimos 6 meses (todas as obras)</h2>
          <div className="space-y-2">
            {meses6.map((m) => {
              const total = porMes[m];
              const pct = Math.round((total / maiorMes) * 100);
              return (
                <div key={m}>
                  <div className="flex justify-between text-sm mb-0.5">
                    <span>{mesLabel(m)}</span>
                    <span className="font-semibold">R$ {total.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded h-3">
                    <div className="bg-accent rounded h-3" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-semibold text-primaryDark mb-1">Relatório para a diretoria</h2>
            <p className="text-xs text-gray-400">PDF formatado com o resumo do mês selecionado, pronto para apresentação.</p>
          </div>
          <a
            href={`/financeiro/dashboard/pdf?mes=${mesSelecionado}`}
            className="bg-primaryDark text-white rounded px-4 py-2 text-sm font-semibold"
          >
            Baixar relatório em PDF
          </a>
        </div>
      </div>
    </main>
  );
}
