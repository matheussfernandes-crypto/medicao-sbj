"use client";

import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import FormAcao from "@/components/contratos/FormAcao";
import { editarItem, excluirItem } from "../actions";
import { brl, parseNum, UNIDADES } from "@/lib/contratos/util";

type Item = {
  id: string;
  codigo: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  ativo: boolean;
};

const br = (n: number) => String(n).replace(".", ",");

/** Botão "Editar" + janela por cima da página para alterar um item do contrato. */
export default function ItemEditor({ contratoId, item, temMedicao }: { contratoId: string; item: Item; temMedicao: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [qtd, setQtd] = useState(br(item.quantidade));
  const [valor, setValor] = useState(br(item.valor_unitario));

  useEffect(() => {
    if (!aberto) return;
    setQtd(br(item.quantidade));
    setValor(br(item.valor_unitario));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberto, item.quantidade, item.valor_unitario]);

  const total = parseNum(qtd) * parseNum(valor);
  const totalAtual = item.quantidade * item.valor_unitario;

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline">
        <Pencil className="w-3 h-3" /> Editar
      </button>
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAberto(false)}>
          <div className="w-full max-w-md bg-white rounded-xl shadow-panel p-5 text-left" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-primaryDark">Editar item</h3>
              <button type="button" onClick={() => setAberto(false)} className="text-ink-400 hover:text-ink-700" aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            <FormAcao action={editarItem} reset={false} onSucesso={() => setAberto(false)} className="grid grid-cols-2 gap-3 text-xs">
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="contratoId" value={contratoId} />
              <label className="flex flex-col gap-1">Código<input name="codigo" defaultValue={item.codigo ?? ""} className="border rounded px-2 py-1.5 text-sm" /></label>
              <label className="flex flex-col gap-1">Unidade
                <input name="unidade" list="unidades-edit" defaultValue={item.unidade} className="border rounded px-2 py-1.5 text-sm" />
              </label>
              <label className="col-span-2 flex flex-col gap-1">Descrição<input name="descricao" defaultValue={item.descricao} className="border rounded px-2 py-1.5 text-sm" /></label>
              <label className="flex flex-col gap-1">Quantidade (metragem)
                <input name="quantidade" inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} disabled={temMedicao} className="border rounded px-2 py-1.5 text-sm disabled:bg-gray-100" />
              </label>
              <label className="flex flex-col gap-1">Valor unit. (R$)
                <input name="valorUnitario" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} disabled={temMedicao} className="border rounded px-2 py-1.5 text-sm disabled:bg-gray-100" />
              </label>
              {temMedicao ? (
                <p className="col-span-2 text-[11px] text-ink-500 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  Este item já tem medição lançada: quantidade e valor só mudam por <b>aditivo</b> (seção Aditivos, mais abaixo), para manter o histórico.
                </p>
              ) : (
                <p className="col-span-2 text-sm">
                  Total do item: <b>{brl(total)}</b>
                  {Math.abs(total - totalAtual) > 0.004 && <span className="text-ink-400"> (antes {brl(totalAtual)})</span>}
                </p>
              )}
              <label className="col-span-2 flex items-center gap-2"><input type="checkbox" name="ativo" value="1" defaultChecked={item.ativo} /> Item ativo (aparece para medir)</label>
              <div className="col-span-2 flex gap-2">
                <button className="flex-1 bg-primary text-white rounded px-3 py-2 font-semibold">Salvar</button>
                <button type="button" onClick={() => setAberto(false)} className="border rounded px-3 py-2">Cancelar</button>
              </div>
              <datalist id="unidades-edit">{UNIDADES.map((u) => <option key={u} value={u} />)}</datalist>
            </FormAcao>
            {!temMedicao && (
              <FormAcao action={excluirItem} confirmar="Excluir este item do contrato?" onSucesso={() => setAberto(false)} className="mt-3 pt-3 border-t">
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="contratoId" value={contratoId} />
                <button className="text-xs text-danger">Excluir item</button>
              </FormAcao>
            )}
          </div>
        </div>
      )}
    </>
  );
}
