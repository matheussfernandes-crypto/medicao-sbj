import Link from "next/link";
import { Camera } from "lucide-react";
import { exigirPerfil, itensComSaldo, listarContratos, nomesUsuarios, urlsAssinadas } from "@/lib/contratos/server";
import {
  SETORES_LANCAM_CONTRATO, TIPO_LANC_LABEL, STATUS_LANC_LABEL,
  brl, num, mesAtual, mesLabel, dataBR, dataHoraBR, retencaoVigente,
} from "@/lib/contratos/util";
import FormAcao from "@/components/contratos/FormAcao";
import { excluirLancamentoContrato, cancelarSolicitacao } from "../actions";
import LancamentoForm, { type Edicao } from "./LancamentoForm";

const BADGE: Record<string, string> = {
  PENDENTE: "badge-pendente", APROVADO: "badge-aprovado", REJEITADO: "badge-rejeitado",
  AGUARDANDO: "badge-pendente", APROVADA: "badge-aprovado", DESAPROVADA: "badge-rejeitado",
};

export default async function MedicoesContratosPage({
  searchParams,
}: {
  searchParams: { empresa?: string; contrato?: string; editar?: string };
}) {
  const { supabase, userId, ehAdmin } = await exigirPerfil(SETORES_LANCAM_CONTRATO);

  const ativos = await listarContratos(supabase, { status: "ATIVO" });
  const contratoSel = searchParams.contrato ? ativos.find((c) => c.id === searchParams.contrato) ?? null : null;
  const empresaId = contratoSel?.empresa_id ?? searchParams.empresa ?? "";

  const empresas = Array.from(new Map(ativos.map((c) => [c.empresa_id, c.empresa_nome])).entries())
    .sort((a, b) => a[1].localeCompare(b[1]));
  const daEmpresa = ativos.filter((c) => c.empresa_id === empresaId);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-primaryDark">Medições de Contratos</h1>

      {/* 1. Empresa */}
      <form method="get" className="card !p-4 flex flex-wrap gap-2 items-end">
        <label className="flex flex-col gap-1 text-xs text-ink-500 flex-1 min-w-[220px]">
          Empresa
          <select name="empresa" defaultValue={empresaId} className="border rounded px-3 py-2 text-sm text-ink-900">
            <option value="">Selecione a empresa…</option>
            {empresas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        </label>
        <button className="bg-primary text-white rounded px-4 py-2 text-sm font-semibold">Ver contratos</button>
      </form>

      {/* 2. Contratos da empresa */}
      {empresaId && !contratoSel && (
        <div className="card space-y-2">
          <p className="text-sm font-semibold text-ink-700">Contratos ativos de {daEmpresa[0]?.empresa_nome ?? "—"}</p>
          {daEmpresa.length ? (
            <ul className="divide-y">
              {daEmpresa.map((c) => (
                <li key={c.id}>
                  <Link href={`/contratos/medicoes?contrato=${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 px-2 rounded hover:bg-surface-subtle">
                    <span className="w-4 h-4 rounded-full border-2 border-primary shrink-0" />
                    <span className="font-semibold text-primaryDark">Nº {c.numero}</span>
                    <span className="font-bold">🏗️ {c.obra_nome}</span>
                    <span className="text-sm text-ink-500 flex-1">{c.objeto}</span>
                    <span className="text-sm">Saldo <b>{brl(c.saldo)}</b></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-400">Nenhum contrato ativo.</p>
          )}
        </div>
      )}

      {!empresaId && !ativos.length && (
        <div className="card text-sm text-ink-500">Nenhum contrato ativo cadastrado ainda.{ehAdmin && <> <Link href="/contratos/novo" className="text-primary underline">Cadastrar contrato →</Link></>}</div>
      )}

      {/* 3. Contrato selecionado */}
      {contratoSel && <ContratoSelecionado contratoId={contratoSel.id} resumo={contratoSel} userId={userId} ehAdmin={ehAdmin} editarId={searchParams.editar} supabase={supabase} />}
    </div>
  );
}

async function ContratoSelecionado({
  contratoId, resumo, userId, ehAdmin, editarId, supabase,
}: {
  contratoId: string;
  resumo: Awaited<ReturnType<typeof listarContratos>>[number];
  userId: string;
  ehAdmin: boolean;
  editarId?: string;
  supabase: any;
}) {
  const [itens, { data: rets }, { data: lancs }, { data: sols }, { data: fotos }] = await Promise.all([
    itensComSaldo(supabase, contratoId),
    supabase.from("contrato_retencoes").select("vigente_desde, percent").eq("contrato_id", contratoId),
    supabase
      .from("contrato_lancamentos")
      .select("id, numero, tipo, data, mes_referencia, status, valor_medido, valor_bruto, retencao_aplicada, retencao_valor, retencao_dispensa_motivo, valor_liquido, valor_vale, teve_glosa, observacao, criado_por, criado_em, editado_em, motivo_rejeicao, contrato_lancamento_itens(id, item_id, modo, percentual, quantidade_medida, quantidade_aprovada, motivo_glosa)")
      .eq("contrato_id", contratoId)
      .order("criado_em", { ascending: false })
      .limit(60),
    supabase.from("contrato_solicitacoes").select("*").eq("contrato_id", contratoId).order("criado_em", { ascending: false }).limit(20),
    supabase.from("contrato_anexos").select("lancamento_id, storage_path, nome_arquivo").eq("contrato_id", contratoId).eq("tipo", "FOTO"),
  ]);

  const nomes = await nomesUsuarios(supabase, [...(lancs ?? []).map((l: any) => l.criado_por), ...(sols ?? []).map((s: any) => s.criado_por)]);
  const links = await urlsAssinadas(supabase, (fotos ?? []).map((f: any) => f.storage_path));
  const itemMap: Record<string, any> = Object.fromEntries(itens.map((i) => [i.id, i]));
  const retPct = retencaoVigente((rets ?? []) as any, mesAtual());

  // Edição de um lançamento pendente próprio (ou ADM)
  const editando = editarId ? (lancs ?? []).find((l: any) => l.id === editarId && l.status === "PENDENTE" && (ehAdmin || l.criado_por === userId)) : null;
  const reserva: Record<string, number> = {};
  if (editando) for (const li of editando.contrato_lancamento_itens ?? []) reserva[li.item_id] = (reserva[li.item_id] ?? 0) + Number(li.quantidade_medida);

  const edicao: Edicao | null = editando
    ? {
        id: editando.id,
        tipo: editando.tipo,
        data: editando.data,
        mes: editando.mes_referencia,
        observacao: editando.observacao,
        valorVale: Number(editando.valor_vale),
        linhas: (editando.contrato_lancamento_itens ?? []).map((li: any) => ({
          itemId: li.item_id,
          modo: li.modo,
          valor: String(li.modo === "PCT" ? li.percentual : li.quantidade_medida).replace(".", ","),
        })),
      }
    : null;

  return (
    <>
      <div className="sticky top-0 z-20 -mx-1 px-1">
        <div className="rounded-xl bg-primaryDark text-white px-5 py-3 shadow-panel flex flex-wrap items-center gap-x-6 gap-y-1">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/60">Obra</p>
            <p className="text-lg font-bold leading-tight">🏗️ {resumo.obra_nome}</p>
          </div>
          <div className="text-sm">
            Contrato <b>Nº {resumo.numero}</b> · {resumo.empresa_nome} · {resumo.objeto}
          </div>
          <div className="ml-auto flex flex-wrap gap-4 text-xs text-white/80">
            <span>Valor <b className="text-white">{brl(resumo.valor_atual)}</b></span>
            <span>Medido <b className="text-white">{brl(resumo.valor_medido)}</b> ({num(resumo.perc_executado, 1)}%)</span>
            <span>Saldo <b className="text-accent">{brl(resumo.saldo)}</b></span>
            <span>Retenção <b className="text-white">{num(retPct)}%</b></span>
            <Link href={`/contratos/${contratoId}`} className="underline">📄 Ver contrato</Link>
            <Link href={`/contratos/medicoes?empresa=${resumo.empresa_id}`} className="underline">Trocar</Link>
          </div>
        </div>
      </div>

      <div className="card">
        {itens.length === 0 ? (
          <p className="text-sm text-ink-500">Este contrato ainda não tem itens cadastrados. O ADM precisa incluir os serviços e valores.</p>
        ) : (
          <LancamentoForm
            key={edicao?.id ?? "novo"}
            contrato={{ id: contratoId, numero: resumo.numero, obra_nome: resumo.obra_nome, empresa_nome: resumo.empresa_nome }}
            itens={itens.map((i) => ({
              id: i.id, codigo: i.codigo, descricao: i.descricao, unidade: i.unidade, quantidade: i.quantidade,
              valor_unitario: i.valor_unitario, saldo: i.saldo + (reserva[i.id] ?? 0), ativo: i.ativo,
            }))}
            retencaoPct={retPct}
            edicao={edicao}
          />
        )}
        {edicao && <Link href={`/contratos/medicoes?contrato=${contratoId}`} className="text-xs text-ink-500 underline mt-3 inline-block">Cancelar edição</Link>}
      </div>

      {/* Histórico de lançamentos */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-primaryDark">Lançamentos deste contrato</h2>
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Nº</th>
                <th className="py-2 pr-2">Data</th>
                <th className="py-2 pr-2">Tipo</th>
                <th className="py-2 pr-2">Mês ref.</th>
                <th className="py-2 pr-2">Itens</th>
                <th className="py-2 pr-2 text-right">Valor</th>
                <th className="py-2 pr-2">Lançado por</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(lancs ?? []).map((l: any) => {
                const minhaPendente = l.status === "PENDENTE" && (ehAdmin || l.criado_por === userId);
                const fotosL = (fotos ?? []).filter((f: any) => f.lancamento_id === l.id);
                return (
                  <tr key={l.id} className="border-b align-top">
                    <td className="py-2 pr-2">{l.numero}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{dataBR(l.data)}</td>
                    <td className="py-2 pr-2">{TIPO_LANC_LABEL[l.tipo]}</td>
                    <td className="py-2 pr-2">{mesLabel(l.mes_referencia)}</td>
                    <td className="py-2 pr-2 text-xs">
                      {(l.contrato_lancamento_itens ?? []).map((li: any) => {
                        const it = itemMap[li.item_id];
                        const glosa = li.quantidade_aprovada !== null && Number(li.quantidade_aprovada) !== Number(li.quantidade_medida);
                        return (
                          <span key={li.id} className="block">
                            {it?.codigo} {it?.descricao}: {num(li.quantidade_medida)} {it?.unidade}
                            {li.modo === "PCT" ? ` (${num(li.percentual)}%)` : ""}
                            {glosa && <span className="text-danger"> → aprovado {num(li.quantidade_aprovada)} ({li.motivo_glosa})</span>}
                          </span>
                        );
                      })}
                      {l.observacao && <span className="block text-ink-500">{l.observacao}</span>}
                      {fotosL.length > 0 && (
                        <span className="flex flex-wrap gap-2 mt-1">
                          {fotosL.map((f: any) => (
                            <a key={f.storage_path} href={links[f.storage_path]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><Camera className="w-3 h-3" />foto</a>
                          ))}
                        </span>
                      )}
                      {l.status === "REJEITADO" && l.motivo_rejeicao && <span className="block text-danger">Rejeitado: {l.motivo_rejeicao}</span>}
                      {l.status === "APROVADO" && !l.retencao_aplicada && l.tipo !== "VALE" && <span className="block text-ink-500">Retenção dispensada: {l.retencao_dispensa_motivo}</span>}
                    </td>
                    <td className="py-2 pr-2 text-right whitespace-nowrap">
                      {brl(l.status === "APROVADO" ? l.valor_bruto : l.valor_medido)}
                      {l.status === "APROVADO" && l.tipo !== "VALE" && <span className="block text-[10px] text-ink-400">ret. {brl(l.retencao_valor)} · líq. {brl(l.valor_liquido)}</span>}
                    </td>
                    <td className="py-2 pr-2 text-xs">
                      {nomes[l.criado_por] ?? "—"}
                      <span className="block text-ink-400">{dataHoraBR(l.criado_em)}</span>
                      {l.editado_em && <span className="block text-ink-400">editado {dataHoraBR(l.editado_em)}</span>}
                    </td>
                    <td className="py-2 pr-2"><span className={`badge ${BADGE[l.status]}`}>{STATUS_LANC_LABEL[l.status]}{l.teve_glosa ? " c/ glosa" : ""}</span></td>
                    <td className="py-2 whitespace-nowrap">
                      {minhaPendente && (
                        <div className="flex flex-col gap-1 items-start">
                          <Link href={`/contratos/medicoes?contrato=${contratoId}&editar=${l.id}`} className="text-xs text-primary underline">Editar</Link>
                          <FormAcao action={excluirLancamentoContrato} confirmar="Excluir este lançamento?" mostrarOk={false}>
                            <input type="hidden" name="id" value={l.id} />
                            <button className="text-xs text-danger underline">Excluir</button>
                          </FormAcao>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!(lancs ?? []).length && <tr><td colSpan={9} className="py-4 text-center text-ink-400">Nenhum lançamento ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {(sols ?? []).length > 0 && (
        <div className="card space-y-2">
          <h2 className="font-semibold text-primaryDark">Solicitações de aditivo</h2>
          <ul className="divide-y text-sm">
            {(sols ?? []).map((s: any) => (
              <li key={s.id} className="py-2 flex flex-wrap gap-2 items-start">
                <span className={`badge ${BADGE[s.status]}`}>{s.status === "AGUARDANDO" ? "🟡 Aguardando" : s.status === "APROVADA" ? "🟢 Aprovada" : "🔴 Desaprovada"}</span>
                <span className="flex-1 min-w-[200px]">
                  {s.tipo === "AUMENTO"
                    ? `+${num(s.quantidade)} ${itemMap[s.item_id]?.unidade ?? ""} em ${itemMap[s.item_id]?.codigo ?? ""} ${itemMap[s.item_id]?.descricao ?? ""}`
                    : `Serviço novo: ${s.descricao} (${num(s.quantidade)} ${s.unidade ?? ""})`}
                  <span className="block text-xs text-ink-500">{s.justificativa} · {nomes[s.criado_por] ?? ""} · {dataHoraBR(s.criado_em)}</span>
                  {s.motivo_resposta && <span className="block text-xs">Resposta do ADM: {s.motivo_resposta}</span>}
                </span>
                {s.status === "AGUARDANDO" && (ehAdmin || s.criado_por === userId) && (
                  <FormAcao action={cancelarSolicitacao} confirmar="Cancelar esta solicitação?" mostrarOk={false}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="text-xs text-danger underline">Cancelar</button>
                  </FormAcao>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
