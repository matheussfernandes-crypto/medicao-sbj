"use client";

import { useState } from "react";
import FormAcao from "@/components/contratos/FormAcao";
import { criarAditivo } from "../actions";
import { brl, num, parseNum, UNIDADES } from "@/lib/contratos/util";

type Item = { id: string; nome: string; unidade: string; quantidade: number; valor_unitario: number };

export default function AditivoForm({ contratoId, itens }: { contratoId: string; itens: Item[] }) {
  const [tipo, setTipo] = useState("ACRESCIMO");
  const [itemId, setItemId] = useState("");
  const [qtd, setQtd] = useState("");
  const [valor, setValor] = useState("");
  const item = itens.find((i) => i.id === itemId);

  let impacto = 0;
  if (tipo === "ACRESCIMO" && item) impacto = parseNum(qtd) * item.valor_unitario;
  if (tipo === "SUPRESSAO" && item) impacto = -parseNum(qtd) * item.valor_unitario;
  if (tipo === "ITEM_NOVO") impacto = parseNum(qtd) * parseNum(valor);
  if (tipo === "PRECO" && item) impacto = (parseNum(valor) - item.valor_unitario) * item.quantidade;

  return (
    <FormAcao
      action={criarAditivo}
      onSucesso={() => { setQtd(""); setValor(""); setItemId(""); }}
      className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs items-end border-t pt-3"
    >
      <input type="hidden" name="contratoId" value={contratoId} />
      <p className="col-span-2 sm:col-span-6 font-semibold text-ink-700 text-sm">Lançar aditivo</p>
      <label className="col-span-2 flex flex-col gap-1">Tipo
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="border rounded px-2 py-1.5">
          <option value="ACRESCIMO">Acréscimo de quantidade</option>
          <option value="SUPRESSAO">Supressão de quantidade</option>
          <option value="ITEM_NOVO">Serviço novo</option>
          <option value="PRECO">Alteração de preço</option>
        </select>
      </label>

      {tipo !== "ITEM_NOVO" ? (
        <label className="col-span-2 sm:col-span-4 flex flex-col gap-1">Item
          <select name="itemId" required value={itemId} onChange={(e) => setItemId(e.target.value)} className="border rounded px-2 py-1.5">
            <option value="">Selecione…</option>
            {itens.map((i) => <option key={i.id} value={i.id}>{i.nome} — {num(i.quantidade)} {i.unidade} × {brl(i.valor_unitario)}</option>)}
          </select>
        </label>
      ) : (
        <>
          <label className="col-span-1 flex flex-col gap-1">Código<input name="codigo" className="border rounded px-2 py-1.5" /></label>
          <label className="col-span-1 sm:col-span-2 flex flex-col gap-1">Descrição *<input name="descricao" required className="border rounded px-2 py-1.5" /></label>
          <label className="col-span-1 flex flex-col gap-1">Unidade<input name="unidade" list="unidades-ad" defaultValue="m²" className="border rounded px-2 py-1.5" />
            <datalist id="unidades-ad">{UNIDADES.map((u) => <option key={u} value={u} />)}</datalist>
          </label>
        </>
      )}

      {tipo !== "PRECO" && (
        <label className="col-span-1 flex flex-col gap-1">
          {tipo === "ITEM_NOVO" ? "Quantidade" : tipo === "ACRESCIMO" ? "Acrescentar" : "Reduzir"}
          <input name="quantidade" inputMode="decimal" required value={qtd} onChange={(e) => setQtd(e.target.value)} className="border rounded px-2 py-1.5" />
        </label>
      )}
      {(tipo === "PRECO" || tipo === "ITEM_NOVO") && (
        <label className="col-span-1 flex flex-col gap-1">{tipo === "PRECO" ? "Novo valor unit." : "Valor unit."}
          <input name="valorUnitario" inputMode="decimal" required value={valor} onChange={(e) => setValor(e.target.value)} className="border rounded px-2 py-1.5" />
        </label>
      )}
      <label className="col-span-2 sm:col-span-3 flex flex-col gap-1">Justificativa *<input name="justificativa" required className="border rounded px-2 py-1.5" /></label>
      <div className="col-span-2 sm:col-span-6 flex flex-wrap items-center gap-3">
        <button className="bg-primary text-white rounded px-4 py-2 font-semibold">Lançar aditivo</button>
        {impacto !== 0 && <span className={impacto > 0 ? "text-success" : "text-danger"}>Impacto no contrato: {brl(impacto)}</span>}
        <span className="text-ink-400">Depois de lançado, anexe o PDF assinado na linha do aditivo.</span>
      </div>
    </FormAcao>
  );
}
