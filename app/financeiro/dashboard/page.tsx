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

function fmtReais(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Gráfico de pizza em SVG puro (sem biblioteca, sem JS no cliente) — cada fatia
// recebe um <title>, que o navegador já exibe como tooltip nativo ao passar o
// mouse, com o valor em R$ e o percentual.
function polarToCartesian(cx: number, cy: number, r: number, angleGraus: number) {
  const rad = ((angleGraus - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function fatiaPizza(cx: number, cy: number, r: number, anguloInicial: number, anguloFinal: number) {
  const inicio = polarToCartesian(cx, cy, r, anguloInicial);
  const fim = polarToCartesian(cx, cy, r, anguloFinal);
  const largeArc = anguloFinal - anguloInicial <= 180 ? "0" : "1";
  return ["M", cx, cy, "L", inicio.x, inicio.y, "A", r, r, 0, largeArc, 1, fim.x, fim.y, "Z"].join(" ");
}

type FatiaCategoria = { nome: string; valor: number; cor: string };

function GraficoPizza({ categorias, total }: { categorias: FatiaCategoria[]; total: number }) {
  const cx = 100, cy = 100, r = 90;
  const comValor = categorias.filter((c) => c.valor > 0);

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 200 200" className="w-48 h-48 shrink-0">
        {total <= 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="#e5e7eb" />
        ) : comValor.length === 1 ? (
          <circle cx={cx} cy={cy} r={r} fill={comValor[0].cor}>
            <title>{`${comValor[0].nome}: R$ ${fmtReais(comValor[0].valor)} (100%)`}</title>
          </circle>
        ) : (
          (() => {
            let anguloAtual = 0;
            return comValor.map((c) => {
              const pct = c.valor / total;
              const anguloFinal = anguloAtual + pct * 360;
              const d = fatiaPizza(cx, cy, r, anguloAtual, anguloFinal);
              anguloAtual = anguloFinal;
              return (
                <path key={c.nome} d={d} fill={c.cor} stroke="#fff" strokeWidth={1}>
                  <title>{`${c.nome}: R$ ${fmtReais(c.valor)} (${Math.round(pct * 100)}%)`}</title>
                </path>
              );
            });
          })()
        )}
      </svg>
      <div className="space-y-1.5 text-sm">
        {categorias.map((c) => {
          const pct = total > 0 ? Math.round((c.valor / total) * 100) : 0;
          return (
            <div key={c.nome} className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: c.cor }} />
              <span className="w-24 text-gray-600">{c.nome}</span>
              <span className="font-semibold">R$ {fmtReais(c.valor)}</span>
              <span className="text-gray-400">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
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

  // Saldo de retenção geral — mesma lógica e mesmas exclusões (Mestre e Mestre
  // Geral não entram no controle de retenção) usadas em financeiro/retiradas,
  // só que somando todas as pessoas para mostrar um número único aqui no topo.
  const { data: pessoasRetencao } = await supabase
    .from("pessoas")
    .select("id, saldo_inicial_retido")
    .not("papel", "in", "(MESTRE,MESTRE_GERAL)");
  const { data: medicoesParaRetencao } = await supabase
    .from("lancamentos")
    .select("pessoa_id, total_reais, retencao_pct_usado")
    .in("tipo", ["MEDICAO", "VALE_MEDICAO"])
    .eq("status", "APROVADO");
  const { data: retiradasTodas } = await supabase.from("retiradas_retido").select("pessoa_id, valor");

  const retidoCalculadoPessoa: Record<string, number> = {};
  for (const l of medicoesParaRetencao ?? []) {
    const pct = l.retencao_pct_usado != null ? Number(l.retencao_pct_usado) : 0;
    retidoCalculadoPessoa[l.pessoa_id] = (retidoCalculadoPessoa[l.pessoa_id] ?? 0) + Number(l.total_reais) * pct;
  }
  const retiradoPorPessoaGeral: Record<string, number> = {};
  for (const r of retiradasTodas ?? []) {
    retiradoPorPessoaGeral[r.pessoa_id] = (retiradoPorPessoaGeral[r.pessoa_id] ?? 0) + Number(r.valor);
  }
  const saldoRetidoGeral = (pessoasRetencao ?? []).reduce((soma, p) => {
    const totalRetido = Number(p.saldo_inicial_retido ?? 0) + (retidoCalculadoPessoa[p.id] ?? 0);
    const totalRetirado = retiradoPorPessoaGeral[p.id] ?? 0;
    return soma + (totalRetido - totalRetirado);
  }, 0);

  const { data: lancamentos } = await supabase
    .from("lancamentos")
    .select(
      "obra_id, pessoa_id, mes_referencia, tipo, total_reais, valor_vale_hibrido, valor_bruto, retencao_item, retencao_pct_usado, vale_real, status"
    )
    .eq("status", "APROVADO");

  const todos = lancamentos ?? [];
  const meses6 = ultimosMeses(6, mesSelecionado);

  // Totais por obra no mês selecionado
  // "valeReal" aqui é só o adiantamento puro (Vale Real), que NÃO entra no total
  // de gasto da obra — ele é descontado do que falta pagar no fechamento da
  // medição do mesmo mês (total a pagar = bruto − retido − vale real), então é
  // dinheiro que já está embutido na própria medição, não um gasto adicional.
  // "valeHibrido" é a parte de Vale + Medição complementar (pago junto com o
  // vale, não no fechamento de medição) — esse sim é gasto extra e entra no total.
  type Resumo = { medicao: number; valeReal: number; valeHibrido: number; valeCorrecao: number };
  const porObraMesAtual: Record<string, Resumo> = {};
  for (const obraId of Object.keys(nomeObra)) porObraMesAtual[obraId] = { medicao: 0, valeReal: 0, valeHibrido: 0, valeCorrecao: 0 };

  // Totais por mês (todas as obras somadas), últimos 6 meses até o mês selecionado
  const porMes: Record<string, number> = {};
  for (const m of meses6) porMes[m] = 0;

  // Composição do total aprovado do mês para o gráfico de pizza. Cada lançamento
  // contribui para "Medições" (líquido) + "Retidos" (a parte retida da mesma
  // medição), ou para "Vales" / "Correções" — de forma que a soma das 4 fatias
  // bata exatamente com o total bruto aprovado no mês (nenhum real fica de fora,
  // nenhum é contado duas vezes).
  let pizzaMedicoesLiquido = 0;
  let pizzaRetidos = 0;
  let pizzaVales = 0;
  let pizzaCorrecoes = 0;

  // Empreiteiros com alguma movimentação (medição, vale ou correção) no mês,
  // por obra e no total geral.
  const empreiteirosPorObra: Record<string, Set<string>> = {};
  const empreiteirosTotalMes = new Set<string>();

  for (const l of todos) {
    const valor = Number(l.total_reais ?? 0);
    // "Vale + Medição": a parte de medição (valor, = total_reais) entra no balde
    // "medicao"; a parte de vale (valorValeHibrido) entra no balde "valeReal" — os
    // dois contam normalmente no total do mês, como qualquer medição/vale aprovado.
    const valorValeHibrido = l.tipo === "VALE_MEDICAO" ? Number(l.valor_vale_hibrido ?? 0) : 0;
    if (l.mes_referencia === mesSelecionado) {
      if (!porObraMesAtual[l.obra_id]) porObraMesAtual[l.obra_id] = { medicao: 0, valeReal: 0, valeHibrido: 0, valeCorrecao: 0 };
      if (l.tipo === "MEDICAO") porObraMesAtual[l.obra_id].medicao += valor;
      else if (l.tipo === "VALE_MEDICAO") {
        porObraMesAtual[l.obra_id].medicao += valor;
        porObraMesAtual[l.obra_id].valeHibrido += valorValeHibrido;
      } else if (l.vale_real) porObraMesAtual[l.obra_id].valeReal += valor;
      else porObraMesAtual[l.obra_id].valeCorrecao += valor;

      if (!empreiteirosPorObra[l.obra_id]) empreiteirosPorObra[l.obra_id] = new Set();
      if (l.pessoa_id) {
        empreiteirosPorObra[l.obra_id].add(l.pessoa_id);
        empreiteirosTotalMes.add(l.pessoa_id);
      }

      const pct = Number(l.retencao_pct_usado ?? 0);
      if (l.tipo === "MEDICAO") {
        const retido = valor * pct;
        pizzaRetidos += retido;
        pizzaMedicoesLiquido += valor - retido;
      } else if (l.tipo === "VALE_MEDICAO") {
        // valor (total_reais) aqui é o bruto da Medição Complementar — paga,
        // líquida, junto com o vale no fechamento de Vale.
        const retido = valor * pct;
        pizzaRetidos += retido;
        pizzaCorrecoes += valor - retido;
        pizzaVales += valorValeHibrido;
      } else if (l.vale_real) {
        pizzaVales += valor;
      } else {
        // "Vale de correção de medição": total_reais já é líquido (a retenção do
        // próprio item foi calculada e descontada no momento do lançamento).
        pizzaRetidos += Number(l.retencao_item ?? 0);
        pizzaCorrecoes += valor;
      }
    }
    if (l.mes_referencia in porMes) {
      porMes[l.mes_referencia] += valor + valorValeHibrido;
    }
  }

  const totalAprovadoPizza = pizzaMedicoesLiquido + pizzaRetidos + pizzaVales + pizzaCorrecoes;
  const categoriasPizza: FatiaCategoria[] = [
    { nome: "Medições", valor: pizzaMedicoesLiquido, cor: "#2c6975" },
    { nome: "Vales", valor: pizzaVales, cor: "#f4dd3d" },
    { nome: "Correções", valor: pizzaCorrecoes, cor: "#c8763e" },
    { nome: "Retidos", valor: pizzaRetidos, cor: "#8a94a6" },
  ];

  const empreiteirosPorObraLista = Object.keys(nomeObra)
    .map((id) => ({ id, nome: nomeObra[id], qtd: empreiteirosPorObra[id]?.size ?? 0 }))
    .filter((o) => o.qtd > 0)
    .sort((a, b) => b.qtd - a.qtd);

  // O "gasto" da obra é Medição (já inclui a parte da Medição Complementar do
  // Vale híbrido) + Vale híbrido + Vale de correção. O Vale Real puro fica de
  // fora dessa soma de propósito: ele é um adiantamento que será descontado do
  // que falta pagar no fechamento da medição do mesmo mês, então já está
  // embutido no valor da própria medição — somá-lo de novo aqui inflaria o
  // gasto real da obra. Ele continua aparecendo no detalhamento, só não entra
  // no total.
  const gastoObra = (id: string) => {
    const r = porObraMesAtual[id];
    return r.medicao + r.valeHibrido + r.valeCorrecao;
  };
  const obraIds = Object.keys(nomeObra).filter((id) => {
    const r = porObraMesAtual[id];
    return r && (r.medicao + r.valeReal + r.valeHibrido + r.valeCorrecao) > 0;
  });
  const totalGeralMesAtual = obraIds.reduce((s, id) => s + gastoObra(id), 0);
  const maiorObra = Math.max(1, ...obraIds.map((id) => gastoObra(id)));
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

        <div className="flex flex-wrap gap-4">
          <div className="card flex-1 min-w-[240px]">
            <h2 className="font-semibold text-primaryDark mb-1">Total geral no mês — {mesLabel(mesSelecionado)}</h2>
            <p className="text-3xl font-bold text-primary">R$ {totalGeralMesAtual.toFixed(2)}</p>
          </div>
          <div className="card flex-1 min-w-[240px]">
            <h2 className="font-semibold text-primaryDark mb-1">Saldo retido com empreiteiros (geral)</h2>
            <p className="text-3xl font-bold text-primary">R$ {saldoRetidoGeral.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">
              Soma de tudo que está retido com os empreiteiros hoje (todas as obras, todos os meses), já descontado o que foi retirado.{" "}
              <a href="/financeiro/retiradas" className="underline">Ver detalhe por pessoa</a>
            </p>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-primaryDark mb-3">Gasto por obra no mês selecionado</h2>
          {obraIds.length > 0 ? (
            <div className="space-y-2">
              {obraIds
                .sort((a, b) => gastoObra(b) - gastoObra(a))
                .map((id) => {
                  const r = porObraMesAtual[id];
                  const total = gastoObra(id);
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
                        Medição: R$ {r.medicao.toFixed(2)} · Vale real do mês (adiantamento, já considerado na medição — não soma no total): R$ {r.valeReal.toFixed(2)} · Vale correção: R$ {(r.valeHibrido + r.valeCorrecao).toFixed(2)}
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

        <div className="card">
          <h2 className="font-semibold text-primaryDark mb-1">Distribuição dos gastos — {mesLabel(mesSelecionado)}</h2>
          <p className="text-xs text-gray-400 mb-3">Passe o mouse sobre uma fatia para ver o valor e o percentual.</p>
          {totalAprovadoPizza > 0 ? (
            <GraficoPizza categorias={categoriasPizza} total={totalAprovadoPizza} />
          ) : (
            <p className="text-sm text-gray-400">Nenhum valor aprovado neste mês ainda.</p>
          )}
        </div>

        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-primaryDark mb-1">Empreiteiros por obra — {mesLabel(mesSelecionado)}</h2>
          <p className="text-xs text-gray-400 mb-3">Empreiteiros com medição, vale ou correção aprovados no mês selecionado.</p>
          {empreiteirosPorObraLista.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="text-left text-gray-400">
                <tr>
                  <th className="p-1">Obra</th>
                  <th className="p-1 text-right">Empreiteiros</th>
                </tr>
              </thead>
              <tbody>
                {empreiteirosPorObraLista.map((o) => (
                  <tr key={o.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="p-1">{o.nome}</td>
                    <td className="p-1 text-right font-semibold">{o.qtd}</td>
                  </tr>
                ))}
                <tr className="border-t font-semibold" style={{ borderColor: "var(--border)" }}>
                  <td className="p-1">Total geral (sem repetir pessoa entre obras)</td>
                  <td className="p-1 text-right">{empreiteirosTotalMes.size}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400">Nenhum empreiteiro com movimentação neste mês ainda.</p>
          )}
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
