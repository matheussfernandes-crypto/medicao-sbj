import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, ExternalLink } from "lucide-react";
import { exigirPerfil, itensComSaldo, nomesUsuarios, urlsAssinadas } from "@/lib/contratos/server";
import {
  SETORES_VEEM_CONTRATO, TIPO_ADITIVO_LABEL, TIPO_LANC_LABEL, STATUS_LANC_LABEL, UNIDADES,
  brl, num, pct, mesAtual, mesLabel, dataBR, dataHoraBR, retencaoVigente, hojeISO,
} from "@/lib/contratos/util";
import FormAcao from "@/components/contratos/FormAcao";
import UploadArquivo from "@/components/contratos/UploadArquivo";
import {
  editarContrato, adicionarItens, editarItem, excluirItem, novaRetencao, liberarRetencao, excluirAnexo,
} from "../actions";
import AditivoForm from "./AditivoForm";

const BADGE: Record<string, string> = {
  PENDENTE: "badge-pendente", APROVADO: "badge-aprovado", REJEITADO: "badge-rejeitado",
  AGUARDANDO: "badge-pendente", APROVADA: "badge-aprovado", DESAPROVADA: "badge-rejeitado",
  ATIVO: "badge-aprovado", SUSPENSO: "badge-pendente", ENCERRADO: "badge-desativado",
};

export default async function ContratoDetalhePage({ params }: { params: { id: string } }) {
  const { supabase, ehAdmin } = await exigirPerfil(SETORES_VEEM_CONTRATO);

  const { data: c } = await supabase
    .from("contratos")
    .select("*, obras(nome), empresas_terceirizadas(nome, nome_empresarial, cnpj, contato, telefone, whatsapp)")
    .eq("id", params.id)
    .maybeSingle();
  if (!c) notFound();

  const [itens, { data: aditivos }, { data: retencoes }, { data: liberacoes }, { data: anexos }, { data: lancs }, { data: solicitacoes }] =
    await Promise.all([
      itensComSaldo(supabase, c.id),
      supabase.from("contrato_aditivos").select("*").eq("contrato_id", c.id).order("criado_em", { ascending: false }),
      supabase.from("contrato_retencoes").select("*").eq("contrato_id", c.id).order("vigente_desde", { ascending: false }).order("alterado_em", { ascending: false }),
      supabase.from("contrato_retencao_liberacoes").select("*").eq("contrato_id", c.id).order("data", { ascending: false }),
      supabase.from("contrato_anexos").select("*").eq("contrato_id", c.id).neq("tipo", "FOTO").order("criado_em", { ascending: false }),
      supabase.from("contrato_lancamentos").select("id, numero, tipo, data, mes_referencia, status, valor_medido, valor_bruto, retencao_valor, valor_liquido, teve_glosa, criado_por").eq("contrato_id", c.id).order("criado_em", { ascending: false }),
      supabase.from("contrato_solicitacoes").select("*").eq("contrato_id", c.id).order("criado_em", { ascending: false }),
    ]);

  const nomes = await nomesUsuarios(supabase, [
    ...(aditivos ?? []).map((a) => a.criado_por),
    ...(retencoes ?? []).map((r) => r.alterado_por),
    ...(anexos ?? []).map((a) => a.enviado_por),
    ...(lancs ?? []).map((l) => l.criado_por),
    ...(solicitacoes ?? []).map((s) => s.criado_por),
  ]);
  const links = await urlsAssinadas(supabase, (anexos ?? []).map((a) => a.storage_path));

  const valorOriginal = itens.reduce((s, i) => s + i.quantidade_original * i.valor_unitario, 0);
  const valorAtual = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
  const medido = itens.reduce((s, i) => s + i.qtd_aprovada * i.valor_unitario, 0);
  const pendente = itens.reduce((s, i) => s + i.qtd_pendente * i.valor_unitario, 0);
  const saldo = valorAtual - medido - pendente;
  const retidoTotal = (lancs ?? []).filter((l) => l.status === "APROVADO").reduce((s, l) => s + Number(l.retencao_valor), 0);
  const liberado = (liberacoes ?? []).reduce((s, l) => s + Number(l.valor), 0);
  const retVigente = retencaoVigente((retencoes ?? []) as any, mesAtual());
  const itemNome: Record<string, string> = {};
  for (const i of itens) itemNome[i.id] = `${i.codigo ? i.codigo + " " : ""}${i.descricao}`;
  const anexosContrato = (anexos ?? []).filter((a) => !a.aditivo_id);

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div>
        <Link href="/contratos" className="text-xs text-primary hover:underline">← Contratos</Link>
        <div className="mt-1 rounded-xl bg-primaryDark text-white px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-white/60">Obra</p>
          <p className="text-lg font-bold">🏗️ {c.obras?.nome}</p>
          <p className="text-sm mt-1">
            Contrato <b>Nº {c.numero}</b> · {c.empresas_terceirizadas?.nome} · {c.objeto}{" "}
            <span className={`badge ${BADGE[c.status]} ml-1`}>{c.status}</span>
          </p>
          <p className="text-xs text-white/60 mt-1">
            Início {dataBR(c.data_inicio)} · Término {dataBR(c.data_termino)}
            {c.empresas_terceirizadas?.cnpj ? ` · CNPJ ${c.empresas_terceirizadas.cnpj}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Link href={`/contratos/medicoes?contrato=${c.id}`} className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-primaryDark">Medir este contrato</Link>
          {ehAdmin && <Link href={`/contratos/fechamento?contrato=${c.id}`} className="border border-primary text-primary rounded-lg px-4 py-2 text-sm font-semibold">Boletim / fechamento</Link>}
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-tile"><span className="stat-label">Valor original</span><span className="stat-value text-xl">{brl(valorOriginal)}</span><span className="stat-hint">Aditivos: {brl(valorAtual - valorOriginal)}</span></div>
        <div className="stat-tile"><span className="stat-label">Valor atualizado</span><span className="stat-value text-xl">{brl(valorAtual)}</span></div>
        <div className="stat-tile"><span className="stat-label">Medido aprovado</span><span className="stat-value text-xl">{brl(medido)}</span><span className="stat-hint">{valorAtual > 0 ? pct((medido / valorAtual) * 100) : "0%"} · pendente {brl(pendente)}</span></div>
        <div className="stat-tile"><span className="stat-label">Saldo a medir</span><span className="stat-value text-xl">{brl(saldo)}</span></div>
        <div className="stat-tile"><span className="stat-label">Retenção vigente</span><span className="stat-value text-xl">{pct(retVigente)}</span></div>
        <div className="stat-tile"><span className="stat-label">Retido acumulado</span><span className="stat-value text-xl">{brl(retidoTotal)}</span><span className="stat-hint">Liberado {brl(liberado)}</span></div>
        <div className="stat-tile"><span className="stat-label">Saldo de retenção</span><span className="stat-value text-xl">{brl(retidoTotal - liberado)}</span></div>
        <div className="stat-tile"><span className="stat-label">Lançamentos</span><span className="stat-value text-xl">{(lancs ?? []).length}</span><span className="stat-hint">{(lancs ?? []).filter((l) => l.status === "PENDENTE").length} pendente(s)</span></div>
      </div>

      {/* Documentos */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-primaryDark">Documentos do contrato</h2>
          {ehAdmin && <UploadArquivo meta={{ contratoId: c.id, tipo: "CONTRATO" }} label="Anexar PDF do contrato" accept="application/pdf,image/*" multiple />}
        </div>
        {anexosContrato.length ? (
          <ul className="divide-y text-sm">
            {anexosContrato.map((a) => (
              <li key={a.id} className="py-2 flex flex-wrap items-center gap-3">
                <FileText className="w-4 h-4 text-primary" />
                <a href={links[a.storage_path]} target="_blank" rel="noreferrer" className="text-primary hover:underline flex-1 min-w-0 truncate">{a.nome_arquivo ?? "arquivo"}</a>
                <span className="text-xs text-ink-400">{dataHoraBR(a.criado_em)} · {nomes[a.enviado_por] ?? "—"}</span>
                {ehAdmin && (
                  <FormAcao action={excluirAnexo} confirmar="Remover este arquivo?" mostrarOk={false}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="text-xs text-danger">Remover</button>
                  </FormAcao>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-400">Nenhum PDF anexado.</p>
        )}
      </section>

      {/* Itens */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-primaryDark">Itens de serviço ({itens.length})</h2>
          {!ehAdmin && <span className="text-xs text-ink-400">Somente o ADM altera quantidades e valores.</span>}
        </div>
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Item</th>
                <th className="py-2 pr-2">Serviço</th>
                <th className="py-2 pr-2">Un</th>
                <th className="py-2 pr-2 text-right">Contratado</th>
                <th className="py-2 pr-2 text-right">V. unit.</th>
                <th className="py-2 pr-2 text-right">Total</th>
                <th className="py-2 pr-2 text-right">Medido</th>
                <th className="py-2 pr-2 text-right">Pendente</th>
                <th className="py-2 pr-2 text-right">Saldo</th>
                <th className="py-2 pr-2">%</th>
                {ehAdmin && <th className="py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => {
                const perc = i.quantidade > 0 ? (i.qtd_aprovada / i.quantidade) * 100 : 0;
                const temMedicao = i.qtd_aprovada + i.qtd_pendente > 0;
                return (
                  <tr key={i.id} className={`border-b align-top ${!i.ativo ? "opacity-50" : ""}`}>
                    <td className="py-2 pr-2 whitespace-nowrap font-semibold">{i.codigo ?? "—"}</td>
                    <td className="py-2 pr-2">
                      {i.descricao}
                      {i.origem_aditivo && <span className="ml-1 text-[10px] bg-accent/40 rounded px-1">aditivo</span>}
                      {!i.ativo && <span className="ml-1 text-[10px] text-ink-500">(desativado)</span>}
                    </td>
                    <td className="py-2 pr-2">{i.unidade}</td>
                    <td className="py-2 pr-2 text-right whitespace-nowrap">
                      {num(i.quantidade)}
                      {Math.abs(i.quantidade - i.quantidade_original) > 1e-6 && (
                        <span className="block text-[10px] text-ink-400">orig. {num(i.quantidade_original)}</span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right whitespace-nowrap">{brl(i.valor_unitario)}</td>
                    <td className="py-2 pr-2 text-right whitespace-nowrap">{brl(i.quantidade * i.valor_unitario)}</td>
                    <td className="py-2 pr-2 text-right whitespace-nowrap">{num(i.qtd_aprovada)}</td>
                    <td className="py-2 pr-2 text-right whitespace-nowrap text-warning">{i.qtd_pendente ? num(i.qtd_pendente) : "—"}</td>
                    <td className={`py-2 pr-2 text-right whitespace-nowrap font-semibold ${i.saldo <= i.quantidade * 0.1 ? "text-danger" : ""}`}>{num(i.saldo)}</td>
                    <td className="py-2 pr-2 min-w-[70px]">
                      <div className="h-1.5 bg-gray-100 rounded overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, perc)}%` }} /></div>
                      <span className="text-[10px] text-ink-500">{pct(perc)}</span>
                    </td>
                    {ehAdmin && (
                      <td className="py-2">
                        <details className="relative">
                          <summary className="text-xs text-primary cursor-pointer select-none">Editar</summary>
                          <div className="mt-1 w-72 bg-white border rounded-lg shadow-panel p-3">
                            <FormAcao action={editarItem} reset={false} className="grid grid-cols-2 gap-2 text-xs">
                              <input type="hidden" name="id" value={i.id} />
                              <input type="hidden" name="contratoId" value={c.id} />
                              <label className="flex flex-col gap-1">Código<input name="codigo" defaultValue={i.codigo ?? ""} className="border rounded px-2 py-1" /></label>
                              <label className="flex flex-col gap-1">Unidade<input name="unidade" defaultValue={i.unidade} className="border rounded px-2 py-1" /></label>
                              <label className="col-span-2 flex flex-col gap-1">Descrição<input name="descricao" defaultValue={i.descricao} className="border rounded px-2 py-1" /></label>
                              <label className="flex flex-col gap-1">Quantidade<input name="quantidade" defaultValue={String(i.quantidade)} disabled={temMedicao} className="border rounded px-2 py-1 disabled:bg-gray-100" /></label>
                              <label className="flex flex-col gap-1">Valor unit.<input name="valorUnitario" defaultValue={String(i.valor_unitario)} disabled={temMedicao} className="border rounded px-2 py-1 disabled:bg-gray-100" /></label>
                              {temMedicao && <p className="col-span-2 text-[11px] text-ink-500">Item já medido: quantidade e valor só mudam por aditivo.</p>}
                              <label className="col-span-2 flex items-center gap-2"><input type="checkbox" name="ativo" value="1" defaultChecked={i.ativo} /> Item ativo (aparece para medir)</label>
                              <button className="col-span-2 bg-primary text-white rounded px-3 py-1.5 font-semibold">Salvar item</button>
                            </FormAcao>
                            {!temMedicao && (
                              <FormAcao action={excluirItem} confirmar="Excluir este item do contrato?" className="mt-2">
                                <input type="hidden" name="id" value={i.id} />
                                <input type="hidden" name="contratoId" value={c.id} />
                                <button className="text-xs text-danger">Excluir item</button>
                              </FormAcao>
                            )}
                          </div>
                        </details>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!itens.length && (
                <tr><td colSpan={11} className="py-6 text-center text-ink-400">Nenhum item cadastrado ainda.</td></tr>
              )}
            </tbody>
            {itens.length > 0 && (
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={5} className="py-2 pr-2 text-right">Totais</td>
                  <td className="py-2 pr-2 text-right whitespace-nowrap">{brl(valorAtual)}</td>
                  <td className="py-2 pr-2 text-right whitespace-nowrap">{brl(medido)}</td>
                  <td className="py-2 pr-2 text-right whitespace-nowrap">{brl(pendente)}</td>
                  <td className="py-2 pr-2 text-right whitespace-nowrap">{brl(saldo)}</td>
                  <td colSpan={ehAdmin ? 2 : 1}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {ehAdmin && (
          <div className="grid lg:grid-cols-2 gap-4 pt-2 border-t">
            <FormAcao action={adicionarItens} className="grid grid-cols-6 gap-2 text-xs items-end">
              <input type="hidden" name="contratoId" value={c.id} />
              <p className="col-span-6 font-semibold text-ink-700 text-sm">Adicionar item</p>
              <label className="col-span-1 flex flex-col gap-1">Código<input name="codigo" placeholder="1.1" className="border rounded px-2 py-1.5" /></label>
              <label className="col-span-5 flex flex-col gap-1">Descrição *<input name="descricao" required placeholder="Assentamento de porcelanato" className="border rounded px-2 py-1.5" /></label>
              <label className="col-span-2 flex flex-col gap-1">Unidade
                <input name="unidade" list="unidades" defaultValue="m²" className="border rounded px-2 py-1.5" />
              </label>
              <label className="col-span-2 flex flex-col gap-1">Quantidade<input name="quantidade" inputMode="decimal" required className="border rounded px-2 py-1.5" /></label>
              <label className="col-span-2 flex flex-col gap-1">Valor unit. (R$)<input name="valorUnitario" inputMode="decimal" required className="border rounded px-2 py-1.5" /></label>
              <button className="col-span-6 bg-primary text-white rounded px-3 py-2 font-semibold">Adicionar</button>
              <datalist id="unidades">{UNIDADES.map((u) => <option key={u} value={u} />)}</datalist>
            </FormAcao>
            <FormAcao action={adicionarItens} className="flex flex-col gap-2 text-xs">
              <input type="hidden" name="contratoId" value={c.id} />
              <p className="font-semibold text-ink-700 text-sm">Colar planilha do Excel</p>
              <p className="text-ink-500">Copie as colunas <b>Código · Descrição · Unidade · Quantidade · Valor unitário</b> (nessa ordem, sem cabeçalho) e cole aqui.</p>
              <textarea name="colado" rows={5} required placeholder={"1.1\tAssentamento de porcelanato\tm²\t1200\t45,00\n1.2\tRejunte\tm²\t1200\t8,50"} className="border rounded px-2 py-1.5 font-mono" />
              <button className="bg-primary text-white rounded px-3 py-2 font-semibold">Importar itens</button>
            </FormAcao>
          </div>
        )}
      </section>

      {/* Aditivos */}
      <section className="card space-y-3">
        <h2 className="font-semibold text-primaryDark">Aditivos</h2>
        {(aditivos ?? []).length ? (
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b"><th className="py-2 pr-2">Data</th><th className="py-2 pr-2">Tipo</th><th className="py-2 pr-2">Item</th><th className="py-2 pr-2">Alteração</th><th className="py-2 pr-2">Justificativa</th><th className="py-2 pr-2">PDF</th></tr></thead>
              <tbody>
                {(aditivos ?? []).map((a) => {
                  const pdfs = (anexos ?? []).filter((x) => x.aditivo_id === a.id);
                  return (
                    <tr key={a.id} className="border-b align-top">
                      <td className="py-2 pr-2 whitespace-nowrap">{dataBR(a.criado_em)}<span className="block text-[10px] text-ink-400">{nomes[a.criado_por] ?? ""}</span></td>
                      <td className="py-2 pr-2">{TIPO_ADITIVO_LABEL[a.tipo]}</td>
                      <td className="py-2 pr-2">{a.item_id ? itemNome[a.item_id] ?? "—" : "—"}</td>
                      <td className="py-2 pr-2 whitespace-nowrap">
                        {a.tipo === "PRECO"
                          ? `${brl(a.valor_unitario_anterior)} → ${brl(a.valor_unitario_novo)}`
                          : `${num(a.quantidade_anterior)} → ${num(a.quantidade_nova)}`}
                        {a.tipo !== "PRECO" && <span className="block text-[10px] text-ink-400">{brl((Number(a.quantidade_nova) - Number(a.quantidade_anterior)) * Number(a.valor_unitario_novo))}</span>}
                      </td>
                      <td className="py-2 pr-2 text-xs">{a.justificativa}</td>
                      <td className="py-2 pr-2">
                        {pdfs.map((x) => (
                          <a key={x.id} href={links[x.storage_path]} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="w-3 h-3" />{x.nome_arquivo}</a>
                        ))}
                        {ehAdmin && <UploadArquivo meta={{ contratoId: c.id, tipo: "ADITIVO", aditivoId: a.id }} label="PDF" accept="application/pdf,image/*" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-400">Nenhum aditivo.</p>
        )}
        {ehAdmin && itens.length > 0 && <AditivoForm contratoId={c.id} itens={itens.map((i) => ({ id: i.id, nome: itemNome[i.id], unidade: i.unidade, quantidade: i.quantidade, valor_unitario: i.valor_unitario }))} />}
      </section>

      {/* Retenção */}
      <section className="card grid lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h2 className="font-semibold text-primaryDark">Histórico de retenção</h2>
          <ul className="divide-y text-sm">
            {(retencoes ?? []).map((r) => (
              <li key={r.id} className="py-2">
                <b>{pct(r.percent)}</b> a partir de {mesLabel(r.vigente_desde)}
                <span className="block text-xs text-ink-500">{r.motivo ?? ""} · {dataHoraBR(r.alterado_em)}{r.alterado_por ? ` · ${nomes[r.alterado_por] ?? ""}` : ""}</span>
              </li>
            ))}
          </ul>
          {ehAdmin && (
            <FormAcao action={novaRetencao} className="flex flex-wrap gap-2 items-end text-xs border-t pt-3">
              <input type="hidden" name="contratoId" value={c.id} />
              <label className="flex flex-col gap-1">Novo %<input name="percent" inputMode="decimal" required className="border rounded px-2 py-1.5 w-20" /></label>
              <label className="flex flex-col gap-1">A partir de<input type="month" name="mes" required defaultValue={mesAtual()} className="border rounded px-2 py-1.5" /></label>
              <label className="flex flex-col gap-1 flex-1 min-w-[140px]">Motivo<input name="motivo" className="border rounded px-2 py-1.5" /></label>
              <button className="bg-primary text-white rounded px-3 py-2 font-semibold">Alterar retenção</button>
              <p className="basis-full text-ink-400">Medições já aprovadas mantêm o % com que foram aprovadas.</p>
            </FormAcao>
          )}
        </div>
        <div className="space-y-3">
          <h2 className="font-semibold text-primaryDark">Liberação de retenção</h2>
          <p className="text-sm">Retido {brl(retidoTotal)} · Liberado {brl(liberado)} · <b>Saldo {brl(retidoTotal - liberado)}</b></p>
          <ul className="divide-y text-sm">
            {(liberacoes ?? []).map((l) => (
              <li key={l.id} className="py-2">{dataBR(l.data)} · <b>{brl(l.valor)}</b> <span className="text-xs text-ink-500">{l.observacao}</span></li>
            ))}
          </ul>
          {ehAdmin && retidoTotal - liberado > 0.004 && (
            <FormAcao action={liberarRetencao} className="flex flex-wrap gap-2 items-end text-xs border-t pt-3" confirmar="Registrar liberação da retenção para a empresa?">
              <input type="hidden" name="contratoId" value={c.id} />
              <label className="flex flex-col gap-1">Valor (R$)<input name="valor" inputMode="decimal" required className="border rounded px-2 py-1.5 w-28" /></label>
              <label className="flex flex-col gap-1">Data<input type="date" name="data" defaultValue={hojeISO()} className="border rounded px-2 py-1.5" /></label>
              <label className="flex flex-col gap-1 flex-1 min-w-[140px]">Observação<input name="observacao" placeholder="Ex.: fim da obra / garantia" className="border rounded px-2 py-1.5" /></label>
              <button className="bg-primary text-white rounded px-3 py-2 font-semibold">Liberar</button>
            </FormAcao>
          )}
        </div>
      </section>

      {/* Solicitações */}
      {(solicitacoes ?? []).length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-semibold text-primaryDark">Solicitações de aditivo</h2>
          <ul className="divide-y text-sm">
            {(solicitacoes ?? []).map((s) => (
              <li key={s.id} className="py-2 flex flex-wrap gap-2 items-start">
                <span className={`badge ${BADGE[s.status]}`}>{s.status}</span>
                <span className="flex-1 min-w-[200px]">
                  {s.tipo === "AUMENTO" ? `+${num(s.quantidade)} em ${itemNome[s.item_id] ?? "item"}` : `Serviço novo: ${s.descricao} (${num(s.quantidade)} ${s.unidade ?? ""})`}
                  <span className="block text-xs text-ink-500">{s.justificativa} · {nomes[s.criado_por] ?? ""} · {dataHoraBR(s.criado_em)}</span>
                  {s.motivo_resposta && <span className="block text-xs">Resposta: {s.motivo_resposta}</span>}
                </span>
                {ehAdmin && s.status === "AGUARDANDO" && <Link href={`/contratos/aprovacoes#s-${s.id}`} className="text-xs text-primary underline">Responder</Link>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Lançamentos */}
      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-primaryDark">Lançamentos</h2>
          <Link href={`/contratos/medicoes?contrato=${c.id}`} className="text-xs text-primary underline">Ver na tela de medições</Link>
        </div>
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b"><th className="py-2 pr-2">Nº</th><th className="py-2 pr-2">Data</th><th className="py-2 pr-2">Tipo</th><th className="py-2 pr-2">Mês</th><th className="py-2 pr-2 text-right">Valor</th><th className="py-2 pr-2 text-right">Retenção</th><th className="py-2 pr-2">Por</th><th className="py-2 pr-2">Status</th></tr></thead>
            <tbody>
              {(lancs ?? []).slice(0, 30).map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="py-2 pr-2">{l.numero}</td>
                  <td className="py-2 pr-2 whitespace-nowrap">{dataBR(l.data)}</td>
                  <td className="py-2 pr-2">{TIPO_LANC_LABEL[l.tipo]}</td>
                  <td className="py-2 pr-2">{mesLabel(l.mes_referencia)}</td>
                  <td className="py-2 pr-2 text-right whitespace-nowrap">{brl(l.status === "APROVADO" ? l.valor_bruto : l.valor_medido)}</td>
                  <td className="py-2 pr-2 text-right whitespace-nowrap">{l.status === "APROVADO" ? brl(l.retencao_valor) : "—"}</td>
                  <td className="py-2 pr-2">{nomes[l.criado_por] ?? "—"}</td>
                  <td className="py-2 pr-2"><span className={`badge ${BADGE[l.status]}`}>{STATUS_LANC_LABEL[l.status]}{l.teve_glosa ? " c/ glosa" : ""}</span></td>
                </tr>
              ))}
              {!(lancs ?? []).length && <tr><td colSpan={8} className="py-4 text-center text-ink-400">Nenhum lançamento.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Editar dados (ADM) */}
      {ehAdmin && (
        <details className="card">
          <summary className="font-semibold text-primaryDark cursor-pointer">Editar dados do contrato</summary>
          <FormAcao action={editarContrato} reset={false} className="grid sm:grid-cols-2 gap-3 mt-4 text-xs">
            <input type="hidden" name="id" value={c.id} />
            <label className="flex flex-col gap-1">Número<input name="numero" defaultValue={c.numero} required className="border rounded px-3 py-2 text-sm" /></label>
            <label className="flex flex-col gap-1">Status
              <select name="status" defaultValue={c.status} className="border rounded px-3 py-2 text-sm">
                <option value="ATIVO">Ativo</option><option value="SUSPENSO">Suspenso</option><option value="ENCERRADO">Encerrado</option>
              </select>
            </label>
            <label className="sm:col-span-2 flex flex-col gap-1">Objeto<input name="objeto" defaultValue={c.objeto} required className="border rounded px-3 py-2 text-sm" /></label>
            <label className="flex flex-col gap-1">Início<input type="date" name="dataInicio" defaultValue={c.data_inicio ?? ""} className="border rounded px-3 py-2 text-sm" /></label>
            <label className="flex flex-col gap-1">Término<input type="date" name="dataTermino" defaultValue={c.data_termino ?? ""} className="border rounded px-3 py-2 text-sm" /></label>
            <label className="sm:col-span-2 flex flex-col gap-1">Observações<textarea name="observacoes" defaultValue={c.observacoes ?? ""} rows={2} className="border rounded px-3 py-2 text-sm" /></label>
            <p className="sm:col-span-2 text-ink-400">Obra e empresa não mudam depois de criado (para não perder o histórico).</p>
            <button className="sm:col-span-2 bg-primary text-white rounded px-4 py-2 font-semibold w-fit">Salvar</button>
          </FormAcao>
        </details>
      )}
    </div>
  );
}
