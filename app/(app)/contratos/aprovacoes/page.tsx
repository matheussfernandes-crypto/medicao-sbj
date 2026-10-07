import Link from "next/link";
import { Camera } from "lucide-react";
import { exigirPerfil, nomesUsuarios, urlsAssinadas } from "@/lib/contratos/server";
import { TIPO_LANC_LABEL, STATUS_LANC_LABEL, brl, num, mesLabel, dataBR, dataHoraBR, retencaoVigente } from "@/lib/contratos/util";
import FormAcao from "@/components/contratos/FormAcao";
import { reabrirLancamentoContrato } from "../actions";
import AprovacaoCard from "./AprovacaoCard";
import SolicitacaoCard from "./SolicitacaoCard";

const TIPO_COR: Record<string, string> = {
  MEDICAO: "bg-primary/10 text-primaryDark",
  VALE: "bg-accent/40 text-ink-900",
  VALE_MEDICAO: "bg-amber-100 text-amber-900",
};

export default async function AprovacoesContratosPage({
  searchParams,
}: {
  searchParams: { obra?: string; empresa?: string; tipo?: string };
}) {
  const { supabase } = await exigirPerfil(["ADMIN"]);

  const [{ data: pendentes }, { data: sols }, { data: recentes }, { data: obras }, { data: empresas }] = await Promise.all([
    supabase
      .from("contrato_lancamentos")
      .select("id, numero, tipo, data, mes_referencia, valor_medido, valor_vale, observacao, criado_por, criado_em, editado_em, contrato_id, contratos!inner(numero, objeto, obra_id, empresa_id, obras(nome), empresas_terceirizadas(nome)), contrato_lancamento_itens(id, item_id, modo, percentual, quantidade_medida, valor_unitario)")
      .eq("status", "PENDENTE")
      .order("criado_em"),
    supabase
      .from("contrato_solicitacoes")
      .select("*, contratos!inner(numero, objeto, obra_id, empresa_id, obras(nome), empresas_terceirizadas(nome))")
      .eq("status", "AGUARDANDO")
      .order("criado_em"),
    supabase
      .from("contrato_lancamentos")
      .select("id, numero, tipo, mes_referencia, status, valor_bruto, valor_medido, teve_glosa, aprovado_em, fechamento_id, motivo_rejeicao, contratos(numero, obras(nome), empresas_terceirizadas(nome))")
      .neq("status", "PENDENTE")
      .order("aprovado_em", { ascending: false })
      .limit(15),
    supabase.from("obras").select("id, nome").order("nome"),
    supabase.from("empresas_terceirizadas").select("id, nome").order("nome"),
  ]);

  const filtra = (c: any) =>
    (!searchParams.obra || c.obra_id === searchParams.obra) && (!searchParams.empresa || c.empresa_id === searchParams.empresa);
  const lista = (pendentes ?? []).filter((l: any) => filtra(l.contratos) && (!searchParams.tipo || l.tipo === searchParams.tipo));
  const solicitacoes = (sols ?? []).filter((s: any) => filtra(s.contratos));

  const contratoIds = Array.from(new Set([...lista.map((l: any) => l.contrato_id), ...solicitacoes.map((s: any) => s.contrato_id)]));
  const [{ data: saldos }, { data: rets }, { data: fotos }] = await Promise.all([
    contratoIds.length
      ? supabase.from("contrato_itens_saldo").select("id, codigo, descricao, unidade, quantidade, valor_unitario, qtd_aprovada, qtd_pendente").in("contrato_id", contratoIds)
      : Promise.resolve({ data: [] as any[] }),
    contratoIds.length
      ? supabase.from("contrato_retencoes").select("contrato_id, vigente_desde, percent").in("contrato_id", contratoIds)
      : Promise.resolve({ data: [] as any[] }),
    lista.length
      ? supabase.from("contrato_anexos").select("lancamento_id, storage_path").eq("tipo", "FOTO").in("lancamento_id", lista.map((l: any) => l.id))
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const itemMap: Record<string, any> = Object.fromEntries((saldos ?? []).map((s: any) => [s.id, s]));
  const nomes = await nomesUsuarios(supabase, [...lista.map((l: any) => l.criado_por), ...solicitacoes.map((s: any) => s.criado_por)]);
  const links = await urlsAssinadas(supabase, (fotos ?? []).map((f: any) => f.storage_path));

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-primaryDark">Aprovações de Contratos</h1>

      <form method="get" className="card !p-4 flex flex-wrap gap-2 items-end">
        <label className="flex flex-col gap-1 text-xs text-ink-500 flex-1 min-w-[150px]">Obra
          <select name="obra" defaultValue={searchParams.obra ?? ""} className="border rounded px-2 py-2 text-sm text-ink-900">
            <option value="">Todas</option>{(obras ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-500 flex-1 min-w-[150px]">Empresa
          <select name="empresa" defaultValue={searchParams.empresa ?? ""} className="border rounded px-2 py-2 text-sm text-ink-900">
            <option value="">Todas</option>{(empresas ?? []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-500">Tipo
          <select name="tipo" defaultValue={searchParams.tipo ?? ""} className="border rounded px-2 py-2 text-sm text-ink-900">
            <option value="">Todos</option><option value="MEDICAO">Medição</option><option value="VALE">Vale</option><option value="VALE_MEDICAO">Vale de medição</option>
          </select>
        </label>
        <button className="bg-gray-100 border rounded px-4 py-2 text-sm">Filtrar</button>
      </form>

      {/* Solicitações de aditivo */}
      <section className="space-y-3">
        <h2 className="font-semibold text-primaryDark">Solicitações de aditivo ({solicitacoes.length})</h2>
        {solicitacoes.map((s: any) => {
          const it = s.item_id ? itemMap[s.item_id] : null;
          return (
            <div key={s.id} id={`s-${s.id}`} className="card space-y-3 scroll-mt-20 border-l-4 !border-l-accent">
              <div className="flex flex-wrap gap-x-4 gap-y-1 items-baseline">
                <span className="font-bold">🏗️ {s.contratos.obras?.nome}</span>
                <span className="text-sm">Contrato <b>Nº {s.contratos.numero}</b> · {s.contratos.empresas_terceirizadas?.nome}</span>
                <span className="text-xs text-ink-400 ml-auto">{nomes[s.criado_por] ?? "—"} · {dataHoraBR(s.criado_em)}</span>
              </div>
              <p className="text-sm">
                {s.tipo === "AUMENTO"
                  ? <>Aumentar <b>{num(s.quantidade)} {it?.unidade}</b> no item <b>{it?.codigo} {it?.descricao}</b> <span className="text-ink-500">(contratado {num(it?.quantidade)}, saldo {num(Number(it?.quantidade) - Number(it?.qtd_aprovada) - Number(it?.qtd_pendente))})</span></>
                  : <>Serviço novo: <b>{s.descricao}</b> — {num(s.quantidade)} {s.unidade}</>}
              </p>
              <p className="text-sm text-ink-700 bg-surface-subtle rounded px-3 py-2">“{s.justificativa}”</p>
              <SolicitacaoCard
                id={s.id}
                tipo={s.tipo}
                quantidade={Number(s.quantidade)}
                descricao={s.descricao}
                unidade={s.unidade}
                valorUnitarioItem={it ? Number(it.valor_unitario) : null}
              />
            </div>
          );
        })}
        {!solicitacoes.length && <p className="text-sm text-ink-400">Nenhuma solicitação aguardando.</p>}
      </section>

      {/* Lançamentos pendentes */}
      <section className="space-y-3">
        <h2 className="font-semibold text-primaryDark">Medições e vales pendentes ({lista.length})</h2>
        {lista.map((l: any) => {
          const pctRet = retencaoVigente((rets ?? []).filter((r: any) => r.contrato_id === l.contrato_id) as any, l.mes_referencia);
          const fotosL = (fotos ?? []).filter((f: any) => f.lancamento_id === l.id);
          return (
            <div key={l.id} id={`l-${l.id}`} className="card space-y-3 scroll-mt-20">
              <div className="flex flex-wrap gap-x-4 gap-y-1 items-baseline">
                <span className={`text-xs font-bold rounded px-2 py-0.5 ${TIPO_COR[l.tipo]}`}>{TIPO_LANC_LABEL[l.tipo]} nº {l.numero}</span>
                <span className="font-bold">🏗️ {l.contratos.obras?.nome}</span>
                <span className="text-sm">
                  <Link href={`/contratos/${l.contrato_id}`} className="hover:underline">Contrato <b>Nº {l.contratos.numero}</b></Link> · {l.contratos.empresas_terceirizadas?.nome} · {l.contratos.objeto}
                </span>
                <span className="text-xs text-ink-500 ml-auto">
                  {dataBR(l.data)} · ref. {mesLabel(l.mes_referencia)} · {nomes[l.criado_por] ?? "—"}{l.editado_em ? " · editado" : ""}
                </span>
              </div>
              {l.observacao && <p className="text-sm text-ink-700">Obs.: {l.observacao}</p>}
              {fotosL.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {fotosL.map((f: any) => (
                    <a key={f.storage_path} href={links[f.storage_path]} target="_blank" rel="noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={links[f.storage_path]} alt="foto do serviço" className="h-20 w-20 object-cover rounded border" />
                    </a>
                  ))}
                </div>
              )}
              <AprovacaoCard
                id={l.id}
                tipo={l.tipo}
                valorVale={Number(l.valor_vale)}
                retencaoPct={pctRet}
                linhas={(l.contrato_lancamento_itens ?? []).map((li: any) => {
                  const it = itemMap[li.item_id] ?? {};
                  return {
                    id: li.id,
                    codigo: it.codigo ?? null,
                    descricao: it.descricao ?? "—",
                    unidade: it.unidade ?? "",
                    valor_unitario: Number(li.valor_unitario),
                    quantidade_medida: Number(li.quantidade_medida),
                    modo: li.modo,
                    percentual: li.percentual !== null ? Number(li.percentual) : null,
                    saldoLivre: Number(it.quantidade) - Number(it.qtd_aprovada) - Number(it.qtd_pendente),
                  };
                })}
              />
            </div>
          );
        })}
        {!lista.length && <div className="card text-sm text-ink-400">Nada pendente. 👍</div>}
      </section>

      {/* Decididos recentemente */}
      <section className="card space-y-2">
        <h2 className="font-semibold text-primaryDark">Decididos recentemente</h2>
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b"><th className="py-2 pr-2">Quando</th><th className="py-2 pr-2">Obra / contrato</th><th className="py-2 pr-2">Tipo</th><th className="py-2 pr-2 text-right">Valor</th><th className="py-2 pr-2">Status</th><th></th></tr></thead>
            <tbody>
              {(recentes ?? []).map((l: any) => (
                <tr key={l.id} className="border-b">
                  <td className="py-2 pr-2 whitespace-nowrap">{dataHoraBR(l.aprovado_em)}</td>
                  <td className="py-2 pr-2"><b>{l.contratos?.obras?.nome}</b> · Nº {l.contratos?.numero} · {l.contratos?.empresas_terceirizadas?.nome}</td>
                  <td className="py-2 pr-2">{TIPO_LANC_LABEL[l.tipo]} nº {l.numero} · {mesLabel(l.mes_referencia)}</td>
                  <td className="py-2 pr-2 text-right whitespace-nowrap">{brl(l.status === "APROVADO" ? l.valor_bruto : l.valor_medido)}</td>
                  <td className="py-2 pr-2">
                    <span className={`badge ${l.status === "APROVADO" ? "badge-aprovado" : "badge-rejeitado"}`}>{STATUS_LANC_LABEL[l.status]}{l.teve_glosa ? " c/ glosa" : ""}</span>
                    {l.motivo_rejeicao && <span className="block text-xs text-ink-500">{l.motivo_rejeicao}</span>}
                  </td>
                  <td className="py-2">
                    {!l.fechamento_id && (
                      <FormAcao action={reabrirLancamentoContrato} confirmar="Voltar este lançamento para pendente?" mostrarOk={false}>
                        <input type="hidden" name="id" value={l.id} />
                        <button className="text-xs text-primary underline">Desfazer</button>
                      </FormAcao>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
