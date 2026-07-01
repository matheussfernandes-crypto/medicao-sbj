"use client";

import { useState, useTransition } from "react";
import LinhaLancamento, { type Lancamento } from "./LinhaLancamento";
import { aprovarEmLote, notificarEngenheiroConferir } from "./actions";

type Pessoa = { id: string; nome: string };
type Servico = { id: string; nome: string; tipo: string; valor_unitario: number };

export default function LancamentosTable({
  lancamentos,
  obraId,
  obraNome,
  nomesPessoas,
  nomesCriadores,
  pessoas,
  servicos,
  ehAdmin,
  meuUserId,
  mesesFechados,
  aprovarLancamento,
  rejeitarLancamento,
  editarLancamento,
  excluirLancamento,
  excluirLancamentoProprio,
}: {
  lancamentos: Lancamento[];
  obraId: string;
  obraNome: string;
  nomesPessoas: Record<string, string>;
  nomesCriadores: Record<string, string>;
  pessoas: Pessoa[];
  servicos: Servico[];
  ehAdmin: boolean;
  meuUserId: string;
  mesesFechados: Set<string>;
  aprovarLancamento: (formData: FormData) => void;
  rejeitarLancamento: (formData: FormData) => void;
  editarLancamento: (formData: FormData) => void;
  excluirLancamento: (formData: FormData) => void;
  excluirLancamentoProprio: (formData: FormData) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notificando, setNotificando] = useState(false);
  const [notificado, setNotificado] = useState(false);
  const [_, startTransition] = useTransition();

  const pendentes = lancamentos.filter((l) => l.status === "PENDENTE");
  const todosSelecionados = pendentes.length > 0 && pendentes.every((l) => selectedIds.has(l.id));

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(pendentes.map((l) => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleNotificar() {
    setNotificando(true);
    const fd = new FormData();
    fd.set("obraNome", obraNome);
    await notificarEngenheiroConferir(fd);
    setNotificando(false);
    setNotificado(true);
    setTimeout(() => setNotificado(false), 4000);
  }

  return (
    <div>
      {/* Toolbar de aprovação em lote (ADM, quando há seleção) */}
      {ehAdmin && selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-lg px-4 py-2">
          <span className="text-sm text-primaryDark font-medium">
            {selectedIds.size} lançamento{selectedIds.size > 1 ? "s" : ""} selecionado{selectedIds.size > 1 ? "s" : ""}
          </span>
          <form
            action={async (fd) => {
              fd.set("ids", Array.from(selectedIds).join(","));
              startTransition(() => aprovarEmLote(fd));
              setSelectedIds(new Set());
            }}
          >
            <button
              type="submit"
              className="bg-primary text-white rounded px-3 py-1 text-sm font-medium hover:bg-primaryDark transition-colors"
            >
              ✅ Aprovar selecionados
            </button>
          </form>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Limpar seleção
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-400">
            <tr>
              {/* Select-all para ADM */}
              {ehAdmin && (
                <th className="p-1 w-8">
                  {pendentes.length > 0 && (
                    <input
                      type="checkbox"
                      checked={todosSelecionados}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="w-4 h-4 cursor-pointer"
                      title="Selecionar todos os pendentes"
                    />
                  )}
                </th>
              )}
              <th className="p-1">Data</th>
              <th className="p-1">Tipo</th>
              <th className="p-1">Pessoa</th>
              <th className="p-1">Detalhe</th>
              <th className="p-1">Local</th>
              <th className="p-1">Lançado por</th>
              <th className="p-1">Total</th>
              <th className="p-1">Status</th>
              <th className="p-1">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lancamentos.map((l) => {
              const isOwner = l.criado_por === meuUserId;
              const jaFechado =
                l.tipo === "VALE_MEDICAO"
                  ? mesesFechados.has(`MEDICAO-${l.mes_referencia}`) || mesesFechados.has(`VALE-${l.mes_referencia}`)
                  : mesesFechados.has(`${l.tipo}-${l.mes_referencia}`);
              return (
                <LinhaLancamento
                  key={l.id}
                  l={l}
                  obraId={obraId}
                  nomePessoa={nomesPessoas[l.pessoa_id] ?? "—"}
                  nomeCriador={(l.criado_por && nomesCriadores[l.criado_por]) || "—"}
                  pessoas={pessoas}
                  servicos={servicos}
                  ehAdmin={ehAdmin}
                  isOwner={isOwner}
                  jaFechado={jaFechado}
                  selected={selectedIds.has(l.id)}
                  onSelect={toggleSelect}
                  aprovarLancamento={aprovarLancamento}
                  rejeitarLancamento={rejeitarLancamento}
                  editarLancamento={editarLancamento}
                  excluirLancamento={excluirLancamento}
                  excluirLancamentoProprio={excluirLancamentoProprio}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Botão "Notificar engenheiro" — apenas estagiários (não-ADM) */}
      {!ehAdmin && (
        <div className="mt-4 pt-4 border-t">
          {notificado ? (
            <p className="text-sm text-green-600 font-medium">
              ✅ Engenheiro notificado! Aguarde a revisão dos lançamentos.
            </p>
          ) : (
            <button
              onClick={handleNotificar}
              disabled={notificando}
              className="bg-accent text-primaryDark font-semibold rounded px-4 py-2 text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {notificando ? "Enviando…" : `📢 Notificar engenheiro — lançamentos de "${obraNome}" prontos para revisão`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
