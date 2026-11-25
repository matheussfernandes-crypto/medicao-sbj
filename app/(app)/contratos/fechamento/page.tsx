import MesCampo from "@/components/MesCampo";
import Link from "next/link";
import { FileDown } from "lucide-react";
import { exigirPerfil } from "@/lib/contratos/server";
import { calcularBoletim } from "@/lib/contratos/boletim";
import { brl, num, pct, mesAtual, mesLabel, dataBR, dataHoraBR } from "@/lib/contratos/util";
import FormAcao from "@/components/contratos/FormAcao";
import { fecharMesContrato, reabrirMesContrato, fecharValeMesContrato, reabrirValeMesContrato } from "../actions";
import { calcularFechamentoVale } from "@/lib/contratos/fechamentoVale";
import Selecao from "@/components/ui/Selecao";
import { TabelaPaginada } from "@/components/ui/anima";
import TabelaColunas from "@/components/ui/TabelaColunas";
import SecaoRecolhivel from "@/components/contratos/SecaoRecolhivel";

export default async function FechamentoContratosPage({
  searchParams,
}: {
  searchParams: { contrato?: string; mes?: string; seq?: string };
}) {
  const { supabase } = await exigirPerfil(["ADMIN"]);
  const { data: contratos } = await supabase
    .from("contratos")
    .select("id, numero, objeto, status, obras(nome), empresas_terceirizadas(nome)")
    .order("numero");
  const contratoId = searchParams.contrato || "";
  const mes = searchParams.mes || mesAtual();
  const seqPedida = Number(searchParams.seq) || undefined;

  const [b, { data: historico }, fv, { data: historicoVale }] = contratoId
    ? await Promise.all([
        calcularBoletim(supabase, contratoId, mes, { seq: seqPedida }),
        supabase.from("contrato_fechamentos").select("*").eq("contrato_id", contratoId).order("mes_referencia", { ascending: false }).order("sequencia", { ascending: false }),
        calcularFechamentoVale(supabase, contratoId, mes),
        supabase.from("contrato_fechamentos_vale").select("*").eq("contrato_id", contratoId).order("mes_referencia", { ascending: false }),
      ])
    : [null, { data: [] as any[] }, null, { data: [] as any[] }];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-primaryDark">Fechamento de Contratos</h1>

      <form method="get" className="card !p-4 flex flex-wrap gap-2 items-end">
        <label className="flex flex-col gap-1 text-xs text-ink-500 flex-1 min-w-[260px]">Contrato
          <Selecao name="contrato" defaultValue={contratoId} className="border rounded px-2 py-2 text-sm text-ink-900">
            <option value="">Selecione…</option>
            {(contratos ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>Nº {c.numero} — {c.obras?.nome} — {c.empresas_terceirizadas?.nome} ({c.objeto}){c.status !== "ATIVO" ? ` [${c.status}]` : ""}</option>
            ))}
          </Selecao>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-500">Mês de referência
          <MesCampo name="mes" defaultValue={mes} />
        </label>
        <button className="bg-primary text-white rounded px-4 py-2 text-sm font-semibold">Ver boletim</button>
      </form>

      {b && (
        <>
          <div className="rounded-xl bg-primaryDark text-white px-5 py-4 flex flex-wrap gap-x-6 gap-y-1 items-center">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-white/60">Obra</p>
              <p className="text-lg font-bold">{b.contrato.obras?.nome}</p>
            </div>
            <p className="text-sm">Contrato <b>Nº {b.contrato.numero}</b> · {b.contrato.empresas_terceirizadas?.nome} · {b.contrato.objeto}</p>
            <p className="ml-auto text-sm">Boletim {b.sequencia > 1 ? <>complementar <b>{b.sequencia}</b> </> : ""}de <b>{mesLabel(mes)}</b> {b.fechamento ? <span className="badge badge-aprovado ml-2">FECHADO</span> : <span className="badge badge-pendente ml-2">ABERTO</span>}</p>
          </div>

          {(b.fechamentosDoMes.length > 1 || (b.fechamentosDoMes.length > 0 && (b.lancamentosEmAberto > 0 || !b.fechamento))) && (
            <div className="card !p-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-500">Boletins de {mesLabel(mes)}:</span>
              {b.fechamentosDoMes.map((f: any) => {
                const s = Number(f.sequencia ?? 1);
                const ativo = b.fechamento?.id === f.id;
                return (
                  <Link key={f.id} href={`/contratos/fechamento?contrato=${contratoId}&mes=${mes}&seq=${s}`}
                    className={`rounded-lg border px-3 py-1 ${ativo ? "bg-primary text-white border-primary" : "hover:bg-surface-subtle"}`}>
                    {s === 1 ? "1º boletim" : `Complementar ${s}`} · fechado · {brl(f.valor_liquido)}
                  </Link>
                );
              })}
              {(b.lancamentosEmAberto > 0 || !b.fechamento) && (
                <Link href={`/contratos/fechamento?contrato=${contratoId}&mes=${mes}&seq=${b.fechamentosDoMes.length + 1}`}
                  className={`rounded-lg border px-3 py-1 ${!b.fechamento ? "bg-primary text-white border-primary" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                  Complementar {b.fechamentosDoMes.length + 1} · em aberto{b.lancamentosEmAberto ? ` (${b.lancamentosEmAberto} lançamento(s))` : ""}
                </Link>
              )}
            </div>
          )}

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

          <SecaoRecolhivel chave="ctr-boletim-planilha" titulo="Planilha de medição">
            <TabelaColunas
              por={15}
              className="w-full text-xs"
              colunas={[
                { chave: "item", rotulo: "Item", ordem: true },
                { chave: "servico", rotulo: "Serviço", ordem: true },
                { chave: "un", rotulo: "Un", filtro: true },
                { chave: "contratado", rotulo: "Contratado", direita: true },
                { chave: "vunit", rotulo: "V. unit.", direita: true },
                { chave: "anterior", rotulo: "Anterior", direita: true },
                { chave: "mes", rotulo: "Este mês", direita: true },
                { chave: "acumulado", rotulo: "Acumulado", direita: true },
                { chave: "saldo", rotulo: "Saldo", direita: true },
                { chave: "perc", rotulo: "% exec.", direita: true },
                { chave: "valor", rotulo: "Valor do mês", direita: true },
              ]}
              itens={b.linhas.map((l) => ({
                id: String(l.item_id),
                d: { item: String(l.codigo ?? ""), servico: String(l.descricao ?? ""), un: String(l.unidade ?? "") },
                linha: (
                  <tr className={`border-b ${l.qtd_atual > 0 ? "bg-primary/5" : ""}`}>
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
                ),
              }))}
            />
          </SecaoRecolhivel>

          <div className="grid lg:grid-cols-2 gap-4">
            <SecaoRecolhivel chave="ctr-boletim-vales" titulo="Vales (adiantamentos)">
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
            </SecaoRecolhivel>
            <SecaoRecolhivel chave="ctr-boletim-glosas" titulo="Glosas e retenção">
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
            </SecaoRecolhivel>
          </div>

          <div className="card flex flex-wrap items-center gap-3">
            <a href={`/contratos/fechamento/pdf?contrato=${contratoId}&mes=${mes}&seq=${b.sequencia}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-primary text-primary rounded-lg px-4 py-2 text-sm font-semibold">
              <FileDown className="w-4 h-4" /> {b.fechamento ? "Boletim em PDF" : "Ver PDF antes de fechar"}
            </a>
            {!b.fechamento ? (
              b.sequencia > 1 && !b.medicoes.length && !b.valesMedicao.length ? (
                <span className="text-sm text-ink-500">Nenhuma medição nova aprovada depois do fechamento de {mesLabel(mes)}.</span>
              ) : (
                <FormAcao action={fecharMesContrato} reset={false} confirmar={b.sequencia > 1
                  ? `Fechar o boletim complementar ${b.sequencia} de ${mesLabel(mes)}? Líquido a pagar ${brl(b.liquido)} (só o medido depois do fechamento anterior).`
                  : `Fechar ${mesLabel(mes)}? Líquido a pagar ${brl(b.liquido)}. Medições lançadas depois entram num boletim complementar.`} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="contratoId" value={contratoId} />
                  <input type="hidden" name="mes" value={mes} />
                  <button className="bg-primary text-white rounded-lg px-5 py-2 text-sm font-semibold">{b.sequencia > 1 ? "Fechar boletim complementar" : "Fechar mês"}</button>
                </FormAcao>
              )
            ) : (
              <>
                <span className="text-sm text-ink-500">Fechado em {dataHoraBR(b.fechamento.fechado_em)}</span>
                {b.sequencia === b.fechamentosDoMes.length && (
                  <FormAcao action={reabrirMesContrato} reset={false} confirmar={b.sequencia > 1 ? "Reabrir este boletim complementar? Os descontos de vale dele serão desfeitos." : "Reabrir este mês? Os descontos de vale deste fechamento serão desfeitos."} className="flex items-center">
                    <input type="hidden" name="contratoId" value={contratoId} />
                    <input type="hidden" name="mes" value={mes} />
                    <input type="hidden" name="seq" value={b.sequencia} />
                    <button className="text-sm text-danger underline">{b.sequencia > 1 ? "Reabrir complementar" : "Reabrir mês"}</button>
                  </FormAcao>
                )}
              </>
            )}
          </div>

          {fv && (
            <SecaoRecolhivel chave="ctr-fechamento-vales" titulo={`Fechamento de vales de ${mesLabel(mes)}`}>
              <div className="flex flex-wrap items-baseline gap-2">
                
                {fv.fechamento ? <span className="badge badge-aprovado">FECHADO</span> : <span className="badge badge-pendente">ABERTO</span>}
                <span className="text-sm text-ink-500 ml-auto">{fv.vales.length} vale(s) · total <b className="text-ink-900">{brl(fv.total)}</b></span>
              </div>
              {fv.vales.length ? (
                <ul className="text-sm divide-y">
                  {fv.vales.map((v) => (
                    <li key={v.id} className="py-1.5 flex gap-3">
                      <span>Vale nº {v.numero} · {dataBR(v.data)}{v.observacao ? <span className="text-ink-500"> · {v.observacao}</span> : null}</span>
                      <span className="ml-auto font-semibold whitespace-nowrap">{brl(v.valor)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-ink-400">Nenhum vale aprovado em {mesLabel(mes)}.</p>}
              {fv.pendentesNoMes > 0 && !fv.fechamento && (
                <p className="text-xs text-amber-800">Há {fv.pendentesNoMes} vale(s) pendente(s) neste mês. <Link href="/contratos/aprovacoes?tipo=VALE" className="underline font-semibold">Aprovar agora →</Link></p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <a href={`/contratos/fechamento/vale-pdf?contrato=${contratoId}&mes=${mes}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-primary text-primary rounded-lg px-4 py-2 text-sm font-semibold">
                  <FileDown className="w-4 h-4" /> {fv.fechamento ? "PDF dos vales" : "Ver PDF dos vales"}
                </a>
                {!fv.fechamento ? (
                  <FormAcao action={fecharValeMesContrato} reset={false} confirmar={`Fechar os vales de ${mesLabel(mes)}? Total ${brl(fv.total)}. Depois de fechado, não entram mais vales neste mês.`} className="flex items-center">
                    <input type="hidden" name="contratoId" value={contratoId} />
                    <input type="hidden" name="mes" value={mes} />
                    <button className="bg-primary text-white rounded-lg px-5 py-2 text-sm font-semibold">Fechar vale do mês</button>
                  </FormAcao>
                ) : (
                  <>
                    <span className="text-sm text-ink-500">Fechado em {dataHoraBR(fv.fechamento.fechado_em)}</span>
                    <FormAcao action={reabrirValeMesContrato} reset={false} confirmar="Reabrir o fechamento de vales deste mês?" className="flex items-center">
                      <input type="hidden" name="contratoId" value={contratoId} />
                      <input type="hidden" name="mes" value={mes} />
                      <button className="text-sm text-danger underline">Reabrir vales</button>
                    </FormAcao>
                  </>
                )}
              </div>
            </SecaoRecolhivel>
          )}

          {(historicoVale ?? []).length > 0 && (
            <SecaoRecolhivel chave="ctr-vales-fechados" titulo="Vales fechados deste contrato">
              <TabelaPaginada por={15} className="w-full text-sm" cabecalho={
<thead><tr className="text-left border-b"><th className="py-2">Mês</th><th className="py-2 text-right">Qtd. vales</th><th className="py-2 text-right">Total de vales</th><th className="py-2">Fechado em</th><th></th></tr></thead>
}>
                  {(historicoVale ?? []).map((f: any) => (
                    <tr key={f.id} className="border-b">
                      <td className="py-2"><Link href={`/contratos/fechamento?contrato=${contratoId}&mes=${f.mes_referencia}`} className="text-primary hover:underline">{mesLabel(f.mes_referencia)}</Link></td>
                      <td className="py-2 text-right">{f.qtd_vales}</td>
                      <td className="py-2 text-right font-semibold">{brl(f.valor_total)}</td>
                      <td className="py-2 text-xs text-ink-500">{dataHoraBR(f.fechado_em)}</td>
                      <td className="py-2 text-right"><a href={`/contratos/fechamento/vale-pdf?contrato=${contratoId}&mes=${f.mes_referencia}`} target="_blank" rel="noreferrer" className="text-xs text-primary underline">PDF</a></td>
                    </tr>
                  ))}
                </TabelaPaginada>
            </SecaoRecolhivel>
          )}

          {(historico ?? []).length > 0 && (
            <SecaoRecolhivel chave="ctr-medicoes-fechadas" titulo="Medições fechadas deste contrato">
              <TabelaPaginada por={15} className="w-full text-sm" cabecalho={
<thead><tr className="text-left border-b"><th className="py-2">Mês</th><th className="py-2 text-right">Bruto</th><th className="py-2 text-right">Retenção</th><th className="py-2 text-right">Vales</th><th className="py-2 text-right">Líquido</th><th></th></tr></thead>
}>
                  {(historico ?? []).map((f: any) => (
                    <tr key={f.id} className="border-b">
                      <td className="py-2"><Link href={`/contratos/fechamento?contrato=${contratoId}&mes=${f.mes_referencia}&seq=${f.sequencia ?? 1}`} className="text-primary hover:underline">{mesLabel(f.mes_referencia)}{Number(f.sequencia) > 1 ? ` · complementar ${f.sequencia}` : ""}</Link></td>
                      <td className="py-2 text-right">{brl(f.valor_bruto)}</td>
                      <td className="py-2 text-right">{brl(f.retencao_valor)}</td>
                      <td className="py-2 text-right">{brl(f.vales_descontados)}</td>
                      <td className="py-2 text-right font-semibold">{brl(f.valor_liquido)}</td>
                      <td className="py-2 text-right"><a href={`/contratos/fechamento/pdf?contrato=${contratoId}&mes=${f.mes_referencia}&seq=${f.sequencia ?? 1}`} target="_blank" rel="noreferrer" className="text-xs text-primary underline">PDF</a></td>
                    </tr>
                  ))}
                </TabelaPaginada>
            </SecaoRecolhivel>
          )}
        </>
      )}
    </div>
  );
}
