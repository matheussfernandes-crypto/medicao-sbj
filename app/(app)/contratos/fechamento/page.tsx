import Link from "next/link";
import { FileDown } from "lucide-react";
import { exigirPerfil } from "@/lib/contratos/server";
import { calcularBoletim } from "@/lib/contratos/boletim";
import { brl, num, pct, mesAtual, mesLabel, dataBR, dataHoraBR } from "@/lib/contratos/util";
import FormAcao from "@/components/contratos/FormAcao";
import { fecharMesContrato, reabrirMesContrato } from "../actions";

export default async function FechamentoContratosPage({
  searchParams,
}: {
  searchParams: { contrato?: string; mes?: string };
}) {
  const { supabase } = await exigirPerfil(["ADMIN"]);
  const { data: contratos } = await supabase
    .from("contratos")
    .select("id, numero, objeto, status, obras(nome), empresas_terceirizadas(nome)")
    .order("numero");
  const contratoId = searchParams.contrato || "";
  const mes = searchParams.mes || mesAtual();

  const [b, { data: historico }] = contratoId
    ? await Promise.all([
        calcularBoletim(supabase, contratoId, mes),
        supabase.from("contrato_fechamentos").select("*").eq("contrato_id", contratoId).order("mes_referencia", { ascending: false }),
      ])
    : [null, { data: [] as any[] }];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-primaryDark">Fechamento de Contratos</h1>

      <form method="get" className="card !p-4 flex flex-wrap gap-2 items-end">
        <label className="flex flex-col gap-1 text-xs text-ink-500 flex-1 min-w-[260px]">Contrato
          <select name="contrato" defaultValue={contratoId} className="border rounded px-2 py-2 text-sm text-ink-900">
            <option value="">Selecione…</option>
            {(contratos ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>Nº {c.numero} — {c.obras?.nome} — {c.empresas_terceirizadas?.nome} ({c.objeto}){c.status !== "ATIVO" ? ` [${c.status}]` : ""}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-500">Mês de referência
          <input type="month" name="mes" defaultValue={mes} className="border rounded px-2 py-2 text-sm text-ink-900" />
        </label>
        <button className="bg-primary text-white rounded px-4 py-2 text-sm font-semibold">Ver boletim</button>
      </form>

      {b && (
        <>
          <div className="rounded-xl bg-primaryDark text-white px-5 py-4 flex flex-wrap gap-x-6 gap-y-1 items-center">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-white/60">Obra</p>
              <p className="text-lg font-bold">🏗️ {b.contrato.obras?.nome}</p>
            </div>
            <p className="text-sm">Contrato <b>Nº {b.contrato.numero}</b> · {b.contrato.empresas_terceirizadas?.nome} · {b.contrato.objeto}</p>
            <p className="ml-auto text-sm">Boletim de <b>{mesLabel(mes)}</b> {b.fechamento ? <span className="badge badge-aprovado ml-2">FECHADO</span> : <span className="badge badge-pendente ml-2">ABERTO</span>}</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="stat-tile"><span className="stat-label">Bruto medido no mês</span><span className="stat-value text-xl">{brl(b.bruto)}</span></div>
            <div className="stat-tile"><span className="stat-label">(−) Retenção</span><span className="stat-value text-xl">{brl(b.retido)}</span></div>
            <div className="stat-tile"><span className="stat-label">(−) Vales descontados</span><span className="stat-value text-xl">{brl(b.valesDescontados)}</span></div>
            <div className="stat-tile !bg-primary/5"><span className="stat-label">Líquido a pagar</span><span className="stat-value text-xl">{brl(b.liquido)}</span></div>
            <div className="stat-tile"><span className="stat-label">Acumulado do contrato</span><span className="stat-value text-xl">{pct(b.valorContrato > 0 ? (b.valorAcumuladoTotal / b.valorContrato) * 100 : 0)}</span><span className="stat-hint">{brl(b.valorAcumuladoTotal)} de {brl(b.valorContrato)}</span></div>
          </div>

          {b.pendentesNoMes > 0 && (
            <div className="card !p-3 bg-amber-50 border-amber-200 text-sm text-amber-800">
              Há {b.pendentesNoMes} lançamento(s) pendente(s) neste mês. <Link href="/contratos/aprovacoes" className="underline font-semibold">Aprovar agora →</Link>
            </div>
          )}

          <section className="card space-y-3">
            <h2 className="font-semibold text-primaryDark">Planilha de medição</h2>
            <div className="table-scroll">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-2">Item</th><th className="py-2 pr-2">Serviço</th><th className="py-2 pr-2">Un</th>
                    <th className="py-2 pr-2 text-right">Contratado</th><th className="py-2 pr-2 text-right">V. unit.</th>
                    <th className="py-2 pr-2 text-right">Anterior</th><th className="py-2 pr-2 text-right">Este mês</th>
                    <th className="py-2 pr-2 text-right">Acumulado</th><th className="py-2 pr-2 text-right">Saldo</th>
                    <th className="py-2 pr-2 text-right">% exec.</th><th className="py-2 pr-2 text-right">Valor do mês</th>
                  </tr>
                </thead>
                <tbody>
                  {b.linhas.map((l) => (
                    <tr key={l.item_id} className={`border-b ${l.qtd_atual > 0 ? "bg-primary/5" : ""}`}>
                      <td className="py-1.5 pr-2 font-semibold">{l.codigo}</td>
                      <td className="py-1.5 pr-2">{l.descricao}{l.antecipado && <span className="ml-1 text-[10px] bg-amber-100 rounded px-1">antecipado</span>}</td>
                      <td className="py-1.5 pr-2">{l.unidade}</td>
                      <td className="py-1.5 pr-2 text-right">{num(l.qtd_contratada)}</td>
                      <td className="py-1.5 pr-2 text-right whitespace-nowrap">{brl(l.valor_unitario)}</td>
                      <td className="py-1.5 pr-2 text-right">{num(l.qtd_anterior)}</td>
                      <td className="py-1.5 pr-2 text-right font-semibold">{num(l.qtd_atual)}</td>
                      <td className="py-1.5 pr-2 text-right">{num(l.qtd_acumulada)}</td>
                      <td className="py-1.5 pr-2 text-right">{num(l.qtd_saldo)}</td>
                      <td className="py-1.5 pr-2 text-right">{pct(l.perc_executado)}</td>
                      <td className="py-1.5 pr-2 text-right whitespace-nowrap font-semibold">{brl(l.valor_atual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid lg:grid-cols-2 gap-4">
            <section className="card space-y-2 text-sm">
              <h2 className="font-semibold text-primaryDark">Vales (adiantamentos)</h2>
              {b.vales.length ? (
                <ul className="divide-y">
                  {b.vales.map((v) => (
                    <li key={v.vale_id} className="py-2">
                      Vale nº {v.numero} · {dataBR(v.data)} · {brl(v.valor_vale)}
                      <span className="block text-xs text-ink-500">
                        Desconta agora <b>{brl(v.descontar_agora)}</b>
                        {v.ja_descontado > 0 ? ` · já descontado ${brl(v.ja_descontado)}` : ""}
                        {v.restante_depois > 0 ? ` · passa para o próximo mês ${brl(v.restante_depois)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-ink-400">Nenhum vale a descontar.</p>}
              {b.valesMedicao.length > 0 && (
                <p className="text-xs text-ink-500 border-t pt-2">
                  Vales de medição no mês (já pagos, não descontam de novo): bruto {brl(b.valeMedicaoBruto)} · retenção {brl(b.valeMedicaoRetido)} · líquido pago {brl(b.valeMedicaoLiquido)}
                </p>
              )}
            </section>
            <section className="card space-y-2 text-sm">
              <h2 className="font-semibold text-primaryDark">Glosas e retenção</h2>
              {b.glosas.length ? (
                <ul className="text-xs space-y-1">
                  {b.glosas.map((g, i) => <li key={i}>Med. nº {g.numero} · {g.codigo} {g.descricao}: {num(g.medido)} → {num(g.aprovado)} {g.unidade} — {g.motivo}</li>)}
                </ul>
              ) : <p className="text-ink-400 text-xs">Sem glosas no mês.</p>}
              {b.retencoesDispensadas.length > 0 && (
                <ul className="text-xs space-y-1 border-t pt-2">
                  {b.retencoesDispensadas.map((r, i) => <li key={i}>Retenção dispensada no lançamento nº {r.numero}: {r.motivo}</li>)}
                </ul>
              )}
            </section>
          </div>

          <div className="card flex flex-wrap items-center gap-3">
            <a href={`/contratos/fechamento/pdf?contrato=${contratoId}&mes=${mes}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-primary text-primary rounded-lg px-4 py-2 text-sm font-semibold">
              <FileDown className="w-4 h-4" /> {b.fechamento ? "Boletim em PDF" : "Prévia do boletim (PDF)"}
            </a>
            {!b.fechamento ? (
              <FormAcao action={fecharMesContrato} reset={false} confirmar={`Fechar ${mesLabel(mes)}? Líquido a pagar ${brl(b.liquido)}. Depois de fechado, o mês fica travado para novos lançamentos.`} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="contratoId" value={contratoId} />
                <input type="hidden" name="mes" value={mes} />
                <button className="bg-primary text-white rounded-lg px-5 py-2 text-sm font-semibold">Fechar mês</button>
              </FormAcao>
            ) : (
              <>
                <span className="text-sm text-ink-500">Fechado em {dataHoraBR(b.fechamento.fechado_em)}</span>
                <FormAcao action={reabrirMesContrato} reset={false} confirmar="Reabrir este mês? Os descontos de vale deste fechamento serão desfeitos." className="flex items-center">
                  <input type="hidden" name="contratoId" value={contratoId} />
                  <input type="hidden" name="mes" value={mes} />
                  <button className="text-sm text-danger underline">Reabrir mês</button>
                </FormAcao>
              </>
            )}
          </div>

          {(historico ?? []).length > 0 && (
            <section className="card space-y-2">
              <h2 className="font-semibold text-primaryDark">Meses fechados deste contrato</h2>
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b"><th className="py-2">Mês</th><th className="py-2 text-right">Bruto</th><th className="py-2 text-right">Retenção</th><th className="py-2 text-right">Vales</th><th className="py-2 text-right">Líquido</th><th></th></tr></thead>
                <tbody>
                  {(historico ?? []).map((f: any) => (
                    <tr key={f.id} className="border-b">
                      <td className="py-2"><Link href={`/contratos/fechamento?contrato=${contratoId}&mes=${f.mes_referencia}`} className="text-primary hover:underline">{mesLabel(f.mes_referencia)}</Link></td>
                      <td className="py-2 text-right">{brl(f.valor_bruto)}</td>
                      <td className="py-2 text-right">{brl(f.retencao_valor)}</td>
                      <td className="py-2 text-right">{brl(f.vales_descontados)}</td>
                      <td className="py-2 text-right font-semibold">{brl(f.valor_liquido)}</td>
                      <td className="py-2 text-right"><a href={`/contratos/fechamento/pdf?contrato=${contratoId}&mes=${f.mes_referencia}`} target="_blank" rel="noreferrer" className="text-xs text-primary underline">PDF</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
