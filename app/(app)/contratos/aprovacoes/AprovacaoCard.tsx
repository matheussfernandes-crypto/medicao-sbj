"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aprovarLancamentoContrato, rejeitarLancamentoContrato } from "../actions";
import { brl, num, pct, parseNum, EPS } from "@/lib/contratos/util";

export type LinhaAprov = {
  id: string;
  codigo: string | null;
  descricao: string;
  unidade: string;
  valor_unitario: number;
  quantidade_medida: number;
  modo: string;
  percentual: number | null;
  saldoLivre: number; // quanto ainda dá para aprovar acima do medido
};

export default function AprovacaoCard({
  id,
  tipo,
  valorVale,
  linhas,
  retencaoPct,
}: {
  id: string;
  tipo: string;
  valorVale: number;
  linhas: LinhaAprov[];
  retencaoPct: number;
}) {
  const router = useRouter();
  const [aprov, setAprov] = useState<Record<string, string>>(
    Object.fromEntries(linhas.map((l) => [l.id, String(l.quantidade_medida).replace(".", ",")]))
  );
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [aplicarRet, setAplicarRet] = useState(true);
  const [motivoDispensa, setMotivoDispensa] = useState("");
  const [rejeitando, setRejeitando] = useState(false);
  const [motivoRej, setMotivoRej] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, start] = useTransition();

  const calc = linhas.map((l) => {
    const q = parseNum(aprov[l.id]);
    const glosa = Math.abs(q - l.quantidade_medida) > EPS;
    const excede = q - l.quantidade_medida > l.saldoLivre + EPS;
    return { ...l, q, glosa, excede, total: q * l.valor_unitario, totalMedido: l.quantidade_medida * l.valor_unitario };
  });
  const bruto = tipo === "VALE" ? valorVale : calc.reduce((s, c) => s + c.total, 0);
  const medido = tipo === "VALE" ? valorVale : calc.reduce((s, c) => s + c.totalMedido, 0);
  const ret = tipo === "VALE" || !aplicarRet ? 0 : (bruto * retencaoPct) / 100;
  const faltaMotivo = calc.some((c) => c.glosa && !motivos[c.id]?.trim());
  const algumExcede = calc.some((c) => c.excede);

  function aprovar() {
    setMsg(null);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("glosas", JSON.stringify(calc.map((c) => ({ id: c.id, aprovada: c.q, motivo: motivos[c.id] ?? "" }))));
    fd.set("aplicarRetencao", aplicarRet ? "1" : "0");
    fd.set("motivoDispensa", motivoDispensa);
    start(async () => {
      const r = await aprovarLancamentoContrato(fd);
      if (r.erro) setMsg(r.erro);
      else router.refresh();
    });
  }

  function rejeitar() {
    setMsg(null);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("motivo", motivoRej);
    start(async () => {
      const r = await rejeitarLancamentoContrato(fd);
      if (r.erro) setMsg(r.erro);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {tipo !== "VALE" && (
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Item</th>
                <th className="py-2 pr-2">Un</th>
                <th className="py-2 pr-2 text-right">Medido</th>
                <th className="py-2 pr-2">Aprovado</th>
                <th className="py-2 pr-2 text-right">Valor unit.</th>
                <th className="py-2 pr-2 text-right">Total aprovado</th>
              </tr>
            </thead>
            <tbody>
              {calc.map((c) => (
                <tr key={c.id} className={`border-b align-top ${c.glosa ? "bg-amber-50" : ""}`}>
                  <td className="py-2 pr-2"><b>{c.codigo}</b> {c.descricao}</td>
                  <td className="py-2 pr-2">{c.unidade}</td>
                  <td className="py-2 pr-2 text-right whitespace-nowrap">
                    {num(c.quantidade_medida, 4)}
                    {c.modo === "PCT" && <span className="block text-[10px] text-ink-400">{num(c.percentual)}% do item</span>}
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      inputMode="decimal"
                      value={aprov[c.id]}
                      onChange={(e) => setAprov((a) => ({ ...a, [c.id]: e.target.value }))}
                      className={`border rounded px-2 py-1 w-24 ${c.excede ? "border-danger" : c.glosa ? "border-amber-500" : ""}`}
                    />
                    {c.excede && <span className="block text-[10px] text-danger">Acima do saldo (livre {num(c.saldoLivre)})</span>}
                    {c.glosa && (
                      <input
                        placeholder="Motivo da glosa *"
                        value={motivos[c.id] ?? ""}
                        onChange={(e) => setMotivos((m) => ({ ...m, [c.id]: e.target.value }))}
                        className="mt-1 block border border-amber-500 rounded px-2 py-1 text-xs w-56"
                      />
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right whitespace-nowrap">{brl(c.valor_unitario)}</td>
                  <td className="py-2 pr-2 text-right whitespace-nowrap font-semibold">
                    {brl(c.total)}
                    {c.glosa && <span className="block text-[10px] text-danger font-normal">glosa {brl(c.total - c.totalMedido)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4 text-sm">
        {tipo !== "VALE" && (
          <div className="space-y-1">
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={aplicarRet} onChange={(e) => setAplicarRet(e.target.checked)} />
              Aplicar retenção de {pct(retencaoPct)}
            </label>
            {!aplicarRet && (
              <input
                placeholder="Motivo para não reter * (ex.: última medição)"
                value={motivoDispensa}
                onChange={(e) => setMotivoDispensa(e.target.value)}
                className="border border-amber-500 rounded px-2 py-1 text-xs w-72"
              />
            )}
          </div>
        )}
        <div className="ml-auto text-right">
          {Math.abs(bruto - medido) > 0.004 && <p className="text-xs text-ink-500">Lançado {brl(medido)}</p>}
          <p>Bruto aprovado <b>{brl(bruto)}</b></p>
          {tipo !== "VALE" && <p className="text-xs">Retenção {brl(ret)} · Líquido <b>{brl(bruto - ret)}</b></p>}
          {tipo === "MEDICAO" && <p className="text-[11px] text-ink-400">Vales são descontados no fechamento do mês.</p>}
          {tipo === "VALE_MEDICAO" && <p className="text-[11px] text-ink-400">Pago na hora; não é descontado de novo no fechamento.</p>}
        </div>
      </div>

      {msg && <p className="text-sm text-danger bg-red-50 border border-red-200 rounded px-3 py-2">{msg}</p>}

      {!rejeitando ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pendente || faltaMotivo || algumExcede || (!aplicarRet && !motivoDispensa.trim())}
            onClick={aprovar}
            className="bg-success text-white rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-40"
          >
            {pendente ? "Salvando…" : calc.some((c) => c.glosa) ? "Aprovar com ajustes" : "Aprovar"}
          </button>
          <button type="button" onClick={() => setRejeitando(true)} className="border border-danger text-danger rounded-lg px-4 py-2 text-sm font-semibold">
            Rejeitar
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          <input autoFocus placeholder="Motivo da rejeição *" value={motivoRej} onChange={(e) => setMotivoRej(e.target.value)} className="border rounded px-3 py-2 text-sm flex-1 min-w-[220px]" />
          <button type="button" disabled={pendente || !motivoRej.trim()} onClick={rejeitar} className="bg-danger text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40">
            Confirmar rejeição
          </button>
          <button type="button" onClick={() => setRejeitando(false)} className="text-xs underline">Voltar</button>
        </div>
      )}
    </div>
  );
}
