"use client";

import { useState } from "react";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import EditarLancamentoForm from "./EditarLancamentoForm";

type Pessoa = { id: string; nome: string };
type Servico = { id: string; nome: string; tipo: string; valor_unitario: number };

export type Lancamento = {
  id: string;
  tipo: "MEDICAO" | "VALE" | "VALE_MEDICAO";
  data: string;
  mes_referencia: string;
  pessoa_id: string;
  servico: string | null;
  local: string | null;
  detalhe_texto: string | null;
  total_reais: number;
  valor_vale_hibrido: number | null;
  retencao_pct_usado: number | null;
  status: "PENDENTE" | "APROVADO" | "REJEITADO";
  vale_real: boolean;
  observacao_medicao: string | null;
  quantidade: number | null;
  criado_por: string | null;
  motivo_rejeicao: string | null;
};

function rotuloTipo(tipo: string) {
  if (tipo === "VALE") return "Vale";
  if (tipo === "VALE_MEDICAO") return "Vale + Medição";
  return "Medição";
}

export default function LinhaLancamento({
  l,
  obraId,
  nomePessoa,
  nomeCriador,
  pessoas,
  servicos,
  ehAdmin,
  isOwner,
  jaFechado,
  selected,
  onSelect,
  aprovarLancamento,
  rejeitarLancamento,
  editarLancamento,
  excluirLancamento,
  excluirLancamentoProprio,
}: {
  l: Lancamento;
  obraId: string;
  nomePessoa: string;
  nomeCriador: string;
  pessoas: Pessoa[];
  servicos: Servico[];
  ehAdmin: boolean;
  isOwner: boolean;
  jaFechado: boolean;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  aprovarLancamento: (formData: FormData) => void;
  rejeitarLancamento: (formData: FormData) => void;
  editarLancamento: (formData: FormData) => void;
  excluirLancamento: (formData: FormData) => void;
  excluirLancamentoProprio: (formData: FormData) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [rejeitando, setRejeitando] = useState(false);
  const [motivoTexto, setMotivoTexto] = useState("");

  // checkbox + 9 colunas existentes (quando admin); 9 sem checkbox (não-admin)
  const COLUNAS = ehAdmin ? 10 : 9;

  const podeEditarOuExcluirProprio = l.status === "PENDENTE" && (isOwner || ehAdmin);

  if (editando) {
    return (
      <tr className="border-t">
        <td colSpan={COLUNAS} className="p-2">
          <EditarLancamentoForm
            obraId={obraId}
            lancamento={l as any}
            pessoas={pessoas}
            servicos={servicos}
            editarLancamento={editarLancamento}
            onCancelar={() => setEditando(false)}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t">
      {/* Checkbox de seleção — apenas para ADM em lançamentos PENDENTES */}
      {ehAdmin && (
        <td className="p-1 w-8 text-center">
          {l.status === "PENDENTE" && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={(e) => onSelect?.(l.id, e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
          )}
        </td>
      )}

      <td className="p-1">{new Date(l.data).toLocaleDateString("pt-BR")}</td>
      <td className="p-1">{rotuloTipo(l.tipo)}</td>
      <td className="p-1">{nomePessoa}</td>
      <td className="p-1">
        {l.tipo === "VALE_MEDICAO"
          ? `Vale R$ ${Number(l.valor_vale_hibrido ?? 0).toFixed(2)} + Medição compl. R$ ${Number(l.total_reais).toFixed(2)} (bruto)`
          : l.vale_real
          ? "Vale real"
          : `${l.servico ?? ""} ${l.detalhe_texto ?? ""}`}
      </td>
      <td className="p-1">{l.local ?? "—"}</td>
      <td className="p-1">{nomeCriador}</td>
      <td className="p-1">
        {l.tipo === "VALE_MEDICAO"
          ? `R$ ${(Number(l.valor_vale_hibrido ?? 0) + Number(l.total_reais)).toFixed(2)}`
          : `R$ ${Number(l.total_reais).toFixed(2)}`}
      </td>
      <td className="p-1">
        <span
          className={
            "badge " +
            (l.status === "APROVADO"
              ? "badge-aprovado"
              : l.status === "REJEITADO"
              ? "badge-rejeitado"
              : "badge-pendente")
          }
        >
          {l.status}
        </span>
        {/* Motivo de rejeição visível inline */}
        {l.status === "REJEITADO" && l.motivo_rejeicao && (
          <p className="text-xs text-red-600 mt-0.5 max-w-[180px] break-words">{l.motivo_rejeicao}</p>
        )}
      </td>
      <td className="p-1 space-y-1">
        {ehAdmin && l.status === "PENDENTE" && (
          <div className="flex flex-wrap gap-1">
            {/* Aprovar individual (o lote está no toolbar acima da tabela) */}
            <form action={aprovarLancamento} className="inline">
              <input type="hidden" name="id" value={l.id} />
              <button className="bg-primary text-white rounded px-2 py-0.5 text-xs">Aprovar</button>
            </form>

            {/* Rejeitar com motivo: expande inline antes de confirmar */}
            {rejeitando ? (
              <form action={rejeitarLancamento} className="flex items-center gap-1 flex-wrap">
                <input type="hidden" name="id" value={l.id} />
                <input
                  type="text"
                  name="motivo"
                  placeholder="Motivo (opcional)"
                  value={motivoTexto}
                  onChange={(e) => setMotivoTexto(e.target.value)}
                  className="border rounded px-2 py-0.5 text-xs w-36 focus:outline-none focus:ring-1 focus:ring-red-300"
                  autoFocus
                />
                <button type="submit" className="bg-red-500 text-white rounded px-2 py-0.5 text-xs">
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => { setRejeitando(false); setMotivoTexto(""); }}
                  className="bg-gray-200 rounded px-2 py-0.5 text-xs"
                >
                  ✕
                </button>
              </form>
            ) : (
              <button
                onClick={() => setRejeitando(true)}
                className="bg-gray-200 rounded px-2 py-0.5 text-xs"
              >
                Rejeitar
              </button>
            )}
          </div>
        )}

        {podeEditarOuExcluirProprio && (
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setEditando(true)} className="bg-blue-100 text-blue-700 rounded px-2 py-0.5 text-xs">
              Editar
            </button>
            <form action={isOwner && !ehAdmin ? excluirLancamentoProprio : excluirLancamento} className="inline">
              <input type="hidden" name="id" value={l.id} />
              <input type="hidden" name="obraId" value={obraId} />
              <ConfirmDeleteButton />
            </form>
          </div>
        )}

        {!podeEditarOuExcluirProprio && l.status === "APROVADO" && !ehAdmin && (
          <span className="text-xs text-gray-400">Aprovado.</span>
        )}

        {ehAdmin && l.status !== "PENDENTE" && (
          <form action={excluirLancamento} className="inline">
            <input type="hidden" name="id" value={l.id} />
            <input type="hidden" name="obraId" value={obraId} />
            <ConfirmDeleteButton jaFechado={jaFechado} />
          </form>
        )}
      </td>
    </tr>
  );
}
