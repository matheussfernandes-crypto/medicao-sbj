"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import FormAcao from "@/components/contratos/FormAcao";
import { editarPreco, excluirPreco } from "../actions";
import { brl, parseNum } from "@/lib/contratos/util";

type Preco = { id: string; servico: string; unidade: string; valor_unitario: number };
type Rascunho = { servico: string; unidade: string; valor: string };

const br = (n: number) => String(n).replace(".", ",");

/**
 * Preços unitários do contrato: aparecem só para leitura; o lápis abre a edição
 * de todos de uma vez, com um único "Salvar".
 */
export default function PrecosEditor({ contratoId, precos }: { contratoId: string; precos: Preco[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [rasc, setRasc] = useState<Record<string, Rascunho>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, start] = useTransition();

  function abrir() {
    setRasc(Object.fromEntries(precos.map((p) => [p.id, { servico: p.servico, unidade: p.unidade, valor: br(p.valor_unitario) }])));
    setErro(null);
    setEditando(true);
  }

  function mudar(id: string, patch: Partial<Rascunho>) {
    setRasc((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  }

  function salvar() {
    setErro(null);
    const alterados = precos.filter((p) => {
      const r = rasc[p.id];
      return r && (r.servico.trim() !== p.servico || r.unidade.trim() !== p.unidade || Math.abs(parseNum(r.valor) - p.valor_unitario) > 1e-9);
    });
    if (!alterados.length) { setEditando(false); return; }
    start(async () => {
      for (const p of alterados) {
        const r = rasc[p.id];
        const fd = new FormData();
        fd.set("id", p.id);
        fd.set("contratoId", contratoId);
        fd.set("servico", r.servico.trim());
        fd.set("unidade", r.unidade.trim());
        fd.set("valorUnitario", r.valor);
        const res = await editarPreco(fd);
        if (res.erro) { setErro(`${p.servico}: ${res.erro}`); router.refresh(); return; }
      }
      setEditando(false);
      router.refresh();
    });
  }

  if (!precos.length) return null;

  return (
    <div className="text-sm">
      <div className="hidden sm:grid grid-cols-12 gap-2 pb-1 text-xs font-semibold text-ink-500 border-b">
        <span className="col-span-6">Serviço</span><span className="col-span-2">Unidade</span><span className="col-span-3 text-right">Preço (R$)</span><span className="col-span-1"></span>
      </div>
      <div className="divide-y">
        {precos.map((pr) =>
          editando ? (
            <div key={pr.id} className="py-2 grid grid-cols-12 gap-2 items-center">
              <input value={rasc[pr.id]?.servico ?? ""} onChange={(e) => mudar(pr.id, { servico: e.target.value })} className="col-span-12 sm:col-span-6 border rounded px-2 py-1.5" aria-label="Serviço" />
              <input value={rasc[pr.id]?.unidade ?? ""} onChange={(e) => mudar(pr.id, { unidade: e.target.value })} list="unidades-preco" className="col-span-4 sm:col-span-2 border rounded px-2 py-1.5" aria-label="Unidade" />
              <input value={rasc[pr.id]?.valor ?? ""} onChange={(e) => mudar(pr.id, { valor: e.target.value })} inputMode="decimal" className="col-span-5 sm:col-span-3 border rounded px-2 py-1.5 text-right" aria-label="Preço" />
              <FormAcao action={excluirPreco} confirmar={`Remover "${pr.servico}" dos preços do contrato?`} mostrarOk={false} className="col-span-3 sm:col-span-1 text-right">
                <input type="hidden" name="id" value={pr.id} />
                <input type="hidden" name="contratoId" value={contratoId} />
                <button className="text-xs text-danger px-1">Remover</button>
              </FormAcao>
            </div>
          ) : (
            <div key={pr.id} className="py-2.5 grid grid-cols-12 gap-2 items-center">
              <span className="col-span-6">{pr.servico}</span>
              <span className="col-span-2 text-ink-500">{pr.unidade}</span>
              <span className="col-span-3 text-right font-semibold">{brl(pr.valor_unitario)}</span>
              <span className="col-span-1" />
            </div>
          )
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-3">
        {editando ? (
          <>
            <button type="button" onClick={salvar} disabled={pendente} className="bg-primary text-white rounded px-4 py-2 text-xs font-semibold disabled:opacity-50">
              {pendente ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={() => setEditando(false)} disabled={pendente} className="inline-flex items-center gap-1 border rounded px-3 py-2 text-xs">
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
          </>
        ) : (
          <button type="button" onClick={abrir} className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline">
            <Pencil className="w-3.5 h-3.5" /> Editar preços
          </button>
        )}
        {erro && <p className="basis-full text-sm text-danger bg-red-50 border border-red-200 rounded px-3 py-2">{erro}</p>}
      </div>
    </div>
  );
}
