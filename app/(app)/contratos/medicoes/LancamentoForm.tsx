"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, Camera } from "lucide-react";
import { salvarLancamento, solicitarAditivo } from "../actions";
import { enviarArquivos } from "@/components/contratos/UploadArquivo";
import { brl, num, pct, parseNum, mesAtual, hojeISO, mesLabel, EPS, UNIDADES } from "@/lib/contratos/util";

export type ItemMedivel = {
  id: string;
  codigo: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  saldo: number; // já inclui o que o lançamento em edição reservava
  ativo: boolean;
};

type Linha = { itemId: string; modo: "QTD" | "PCT"; valor: string };

export type Edicao = {
  id: string;
  tipo: "MEDICAO" | "VALE" | "VALE_MEDICAO";
  data: string;
  mes: string;
  observacao: string | null;
  valorVale: number;
  linhas: Linha[];
};

type Aba = "MEDICAO" | "VALE" | "VALE_MEDICAO" | "ADITIVO";

const ABAS: { id: Aba; label: string; desc: string }[] = [
  { id: "MEDICAO", label: "Nova medição", desc: "Serviço executado no período. Retenção aplicada na aprovação e vales descontados no fechamento do mês." },
  { id: "VALE", label: "Vale", desc: "Adiantamento em dinheiro, sem serviço medido. É descontado do líquido da próxima medição fechada." },
  { id: "VALE_MEDICAO", label: "Vale de medição", desc: "Antecipa o pagamento de um serviço já executado: abate o saldo do item, retenção calculada na hora e não é descontado de novo no fechamento." },
  { id: "ADITIVO", label: "Solicitar aditivo", desc: "Precisa medir além do contratado ou um serviço que não está no contrato? Peça ao ADM." },
];

export default function LancamentoForm({
  contrato,
  itens,
  retencaoPct,
  edicao,
}: {
  contrato: { id: string; numero: string; obra_nome: string; empresa_nome: string };
  itens: ItemMedivel[];
  retencaoPct: number;
  edicao?: Edicao | null;
}) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>(edicao?.tipo ?? "MEDICAO");
  const [linhas, setLinhas] = useState<Linha[]>(edicao?.linhas ?? []);
  const [data, setData] = useState(edicao?.data ?? hojeISO());
  const [mes, setMes] = useState(edicao?.mes ?? mesAtual());
  const [obs, setObs] = useState(edicao?.observacao ?? "");
  const [valorVale, setValorVale] = useState(edicao?.valorVale ? String(edicao.valorVale) : "");
  const [fotos, setFotos] = useState<File[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [msg, setMsg] = useState<{ erro?: string; ok?: string } | null>(null);
  const [pendente, start] = useTransition();

  // Solicitação de aditivo
  const [solTipo, setSolTipo] = useState<"AUMENTO" | "NOVO_SERVICO">("AUMENTO");
  const [solItem, setSolItem] = useState("");
  const [solQtd, setSolQtd] = useState("");

  const mapa = useMemo(() => Object.fromEntries(itens.map((i) => [i.id, i])), [itens]);

  const calc = linhas.map((l) => {
    const it = mapa[l.itemId];
    const v = parseNum(l.valor);
    const quantidade = l.modo === "PCT" ? (v / 100) * it.quantidade : v;
    return { ...l, it, quantidade, total: quantidade * it.valor_unitario, excede: quantidade > it.saldo + EPS };
  });
  const total = calc.reduce((s, c) => s + c.total, 0);
  const excedidos = calc.filter((c) => c.excede);
  const disponiveis = itens.filter((i) => i.ativo && !linhas.some((l) => l.itemId === i.id));

  const ehVale = aba === "VALE";
  const valorEnvio = ehVale ? parseNum(valorVale) : total;
  const podeEnviar = ehVale ? valorEnvio > 0 : calc.some((c) => c.quantidade > 0) && !excedidos.length;

  function setLinha(idx: number, patch: Partial<Linha>) {
    setLinhas((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function enviar() {
    setMsg(null);
    const fd = new FormData();
    fd.set("contratoId", contrato.id);
    if (edicao) fd.set("lancamentoId", edicao.id);
    fd.set("tipo", aba);
    fd.set("data", data);
    fd.set("mes", mes);
    fd.set("observacao", obs);
    if (ehVale) fd.set("valorVale", valorVale);
    else fd.set("itens", JSON.stringify(calc.map((c) => ({ itemId: c.itemId, modo: c.modo, valor: parseNum(c.valor) }))));
    start(async () => {
      const r = await salvarLancamento(fd);
      if (r.erro) { setMsg(r); setConfirmando(false); return; }
      if (fotos.length && r.id) {
        const e = await enviarArquivos(fotos, { contratoId: contrato.id, tipo: "FOTO", lancamentoId: r.id });
        if (e) { setMsg({ erro: `Lançamento salvo, mas as fotos falharam: ${e}` }); }
      }
      setConfirmando(false);
      setFotos([]);
      if (edicao) {
        router.push(`/contratos/medicoes?contrato=${contrato.id}`);
      } else {
        setLinhas([]); setObs(""); setValorVale("");
        setMsg({ ok: r.ok });
      }
      router.refresh();
    });
  }

  function enviarSolicitacao(form: HTMLFormElement) {
    setMsg(null);
    const fd = new FormData(form);
    fd.set("contratoId", contrato.id);
    start(async () => {
      const r = await solicitarAditivo(fd);
      setMsg(r);
      if (!r.erro) { form.reset(); setSolItem(""); setSolQtd(""); router.refresh(); }
    });
  }

  return (
    <div className="space-y-4">
      {/* Abas */}
      <div className="flex flex-wrap gap-2">
        {ABAS.filter((a) => !edicao || a.id === edicao.tipo).map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => { setAba(a.id); setMsg(null); setConfirmando(false); }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold border transition ${aba === a.id ? "bg-primary text-white border-primary" : "bg-white text-ink-700 hover:bg-surface-subtle"}`}
          >
            {edicao ? `Editando ${a.label.toLowerCase()}` : `+ ${a.label}`}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-500">{ABAS.find((a) => a.id === aba)?.desc}</p>

      {aba === "ADITIVO" ? (
        <form
          onSubmit={(e) => { e.preventDefault(); enviarSolicitacao(e.currentTarget); }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs"
        >
          <label className="sm:col-span-4 flex gap-4 text-sm">
            <span className="flex items-center gap-1"><input type="radio" name="tipo" value="AUMENTO" checked={solTipo === "AUMENTO"} onChange={() => setSolTipo("AUMENTO")} /> Aumentar quantidade de um item</span>
            <span className="flex items-center gap-1"><input type="radio" name="tipo" value="NOVO_SERVICO" checked={solTipo === "NOVO_SERVICO"} onChange={() => setSolTipo("NOVO_SERVICO")} /> Serviço novo</span>
          </label>
          {solTipo === "AUMENTO" ? (
            <label className="sm:col-span-3 flex flex-col gap-1">Item
              <select name="itemId" required value={solItem} onChange={(e) => setSolItem(e.target.value)} className="border rounded px-2 py-2 text-sm">
                <option value="">Selecione…</option>
                {itens.map((i) => <option key={i.id} value={i.id}>{i.codigo ?? ""} {i.descricao} — saldo {num(i.saldo)} {i.unidade}</option>)}
              </select>
            </label>
          ) : (
            <>
              <label className="sm:col-span-2 flex flex-col gap-1">Descrição do serviço<input name="descricao" required className="border rounded px-2 py-2 text-sm" /></label>
              <label className="flex flex-col gap-1">Unidade<input name="unidade" list="un-sol" defaultValue="m²" className="border rounded px-2 py-2 text-sm" />
                <datalist id="un-sol">{UNIDADES.map((u) => <option key={u} value={u} />)}</datalist>
              </label>
            </>
          )}
          <label className="flex flex-col gap-1">Quantidade a mais
            <input name="quantidade" inputMode="decimal" required value={solQtd} onChange={(e) => setSolQtd(e.target.value)} className="border rounded px-2 py-2 text-sm" />
          </label>
          <label className="sm:col-span-4 flex flex-col gap-1">Justificativa (o que aconteceu na obra)
            <textarea name="justificativa" required rows={2} className="border rounded px-2 py-2 text-sm" />
          </label>
          <p className="sm:col-span-4 text-ink-400">Você não informa valor: o ADM define o preço e a quantidade final ao aprovar.</p>
          <button disabled={pendente} className="sm:col-span-4 w-fit bg-primary text-white rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50">
            {pendente ? "Enviando…" : "Enviar solicitação ao ADM"}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex flex-col gap-1">Data<input type="date" value={data} onChange={(e) => setData(e.target.value)} className="border rounded px-2 py-2 text-sm" /></label>
            <label className="flex flex-col gap-1">Mês de referência<input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="border rounded px-2 py-2 text-sm" /></label>
            {ehVale && (
              <label className="flex flex-col gap-1">Valor do vale (R$)
                <input inputMode="decimal" value={valorVale} onChange={(e) => setValorVale(e.target.value)} className="border rounded px-2 py-2 text-sm w-40" />
              </label>
            )}
          </div>

          {!ehVale && (
            <>
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-2">Item</th>
                      <th className="py-2 pr-2">Un</th>
                      <th className="py-2 pr-2 text-right">Valor unit.</th>
                      <th className="py-2 pr-2 text-right">Saldo</th>
                      <th className="py-2 pr-2">Medir por</th>
                      <th className="py-2 pr-2">Este período</th>
                      <th className="py-2 pr-2 text-right">Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.map((c, idx) => (
                      <tr key={c.itemId} className={`border-b align-top ${c.excede ? "bg-red-50" : ""}`}>
                        <td className="py-2 pr-2"><b>{c.it.codigo}</b> {c.it.descricao}</td>
                        <td className="py-2 pr-2">{c.it.unidade}</td>
                        <td className="py-2 pr-2 text-right whitespace-nowrap">{brl(c.it.valor_unitario)}</td>
                        <td className="py-2 pr-2 text-right whitespace-nowrap">
                          {num(c.it.saldo)} {c.it.unidade}
                          <span className="block text-[10px] text-ink-400">{pct(c.it.quantidade > 0 ? (c.it.saldo / c.it.quantidade) * 100 : 0)}</span>
                        </td>
                        <td className="py-2 pr-2">
                          <select value={c.modo} onChange={(e) => setLinha(idx, { modo: e.target.value as "QTD" | "PCT", valor: "" })} className="border rounded px-1 py-1 text-xs">
                            <option value="QTD">Quantidade</option>
                            <option value="PCT">% do item</option>
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-1">
                            <input
                              inputMode="decimal"
                              value={c.valor}
                              onChange={(e) => setLinha(idx, { valor: e.target.value })}
                              className={`border rounded px-2 py-1 w-24 ${c.excede ? "border-danger" : ""}`}
                              placeholder="0"
                            />
                            <span className="text-xs text-ink-500">{c.modo === "PCT" ? "%" : c.it.unidade}</span>
                          </div>
                          {c.modo === "PCT" && c.quantidade > 0 && <span className="text-[10px] text-ink-400">= {num(c.quantidade, 4)} {c.it.unidade}</span>}
                        </td>
                        <td className="py-2 pr-2 text-right whitespace-nowrap font-semibold">{brl(c.total)}</td>
                        <td className="py-2">
                          <button type="button" onClick={() => setLinhas((ls) => ls.filter((_, i) => i !== idx))} className="text-ink-400 hover:text-danger p-1" aria-label="Remover item">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!calc.length && (
                      <tr><td colSpan={8} className="py-4 text-center text-ink-400 text-sm">Adicione os itens que foram executados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <select
                value=""
                onChange={(e) => { if (e.target.value) setLinhas((ls) => [...ls, { itemId: e.target.value, modo: "QTD", valor: "" }]); }}
                className="border-2 border-dashed border-primary/40 rounded-lg px-3 py-2 text-sm w-full sm:w-auto text-primary font-semibold"
              >
                <option value="">+ Adicionar item do contrato…</option>
                {disponiveis.map((i) => (
                  <option key={i.id} value={i.id} disabled={i.saldo <= EPS}>
                    {i.codigo ?? ""} {i.descricao} – {i.unidade} – {brl(i.valor_unitario)} {i.saldo <= EPS ? "(sem saldo)" : `(saldo ${num(i.saldo)})`}
                  </option>
                ))}
              </select>

              {excedidos.map((c) => (
                <div key={c.itemId} className="border border-amber-300 bg-amber-50 rounded-lg p-3 text-sm space-y-2">
                  <p className="flex items-center gap-2 font-semibold text-amber-800"><AlertTriangle className="w-4 h-4" /> Quantidade acima do saldo do item {c.it.codigo} {c.it.descricao}</p>
                  <p className="text-amber-800">Saldo disponível: {num(c.it.saldo)} {c.it.unidade} — informado: {num(c.quantidade)} {c.it.unidade}.</p>
                  <p className="text-amber-800">Para medir além do contratado, é necessário incluir o serviço ou aumentar a quantidade no contrato {contrato.numero}.</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const idx = linhas.findIndex((l) => l.itemId === c.itemId);
                        const v = c.modo === "PCT" ? (c.it.saldo / c.it.quantidade) * 100 : c.it.saldo;
                        setLinha(idx, { valor: String(Math.floor(v * 10000) / 10000).replace(".", ",") });
                      }}
                      className="bg-white border border-amber-400 rounded px-3 py-1 text-xs font-semibold"
                    >
                      Ajustar para o saldo ({num(c.it.saldo)})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSolTipo("AUMENTO");
                        setSolItem(c.itemId);
                        setSolQtd(String(Math.ceil((c.quantidade - c.it.saldo) * 100) / 100).replace(".", ","));
                        setAba("ADITIVO");
                      }}
                      className="bg-primary text-white rounded px-3 py-1 text-xs font-semibold"
                    >
                      Solicitar inclusão no contrato
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          <label className="flex flex-col gap-1 text-xs">Observação
            <input value={obs} onChange={(e) => setObs(e.target.value)} className="border rounded px-2 py-2 text-sm" placeholder={ehVale ? "Ex.: adiantamento solicitado pela empresa" : "Ex.: pavimentos 3 ao 5, torre A"} />
          </label>

          {!ehVale && (
            <label className="inline-flex items-center gap-2 text-xs text-primary font-semibold cursor-pointer w-fit">
              <Camera className="w-4 h-4" />
              {fotos.length ? `${fotos.length} foto(s) selecionada(s)` : "Anexar fotos do serviço (opcional)"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setFotos(Array.from(e.target.files ?? []))} />
            </label>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t pt-3">
            <div className="text-sm">
              <span className="text-ink-500">Total: </span><b className="text-lg text-primaryDark">{brl(valorEnvio)}</b>
              {aba === "VALE_MEDICAO" && valorEnvio > 0 && (
                <span className="block text-xs text-ink-500">Retenção prevista {pct(retencaoPct)}: {brl((valorEnvio * retencaoPct) / 100)} · líquido {brl(valorEnvio - (valorEnvio * retencaoPct) / 100)}</span>
              )}
              {aba === "MEDICAO" && valorEnvio > 0 && (
                <span className="block text-xs text-ink-500">Retenção prevista {pct(retencaoPct)} (aplicada na aprovação)</span>
              )}
            </div>
            {!confirmando ? (
              <button
                type="button"
                disabled={!podeEnviar || pendente}
                onClick={() => setConfirmando(true)}
                className="ml-auto bg-primary text-white rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-40"
              >
                {edicao ? "Salvar alterações" : "Enviar para aprovação"}
              </button>
            ) : (
              <div className="ml-auto flex flex-wrap items-center gap-2 bg-accent/30 border border-accent rounded-lg px-3 py-2 text-sm">
                <span>
                  {edicao ? "Salvar" : "Enviar"} {ABAS.find((a) => a.id === aba)?.label.replace("Nova ", "").toLowerCase()} de <b>{brl(valorEnvio)}</b> para o contrato <b>{contrato.numero}</b> – <b>{contrato.obra_nome}</b> ({mesLabel(mes)})?
                </span>
                <button type="button" disabled={pendente} onClick={enviar} className="bg-primary text-white rounded px-3 py-1 font-semibold disabled:opacity-50">
                  {pendente ? "Enviando…" : "Confirmar"}
                </button>
                <button type="button" onClick={() => setConfirmando(false)} className="text-xs underline">Voltar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {msg?.erro && <p className="text-sm text-danger bg-red-50 border border-red-200 rounded px-3 py-2">{msg.erro}</p>}
      {msg?.ok && <p className="text-sm text-success bg-green-50 border border-green-200 rounded px-3 py-2">{msg.ok}</p>}
    </div>
  );
}
