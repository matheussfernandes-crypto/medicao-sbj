"use client";

import { useState } from "react";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import EditarLancamentoForm from "./EditarLancamentoForm";

type Pessoa = { id: string; nome: string };
type Servico = { id: string; nome: string; tipo: string; valor_unitario: number };

type Lancamento = {
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
};

const COLUNAS = 8;

function rotuloTipo(tipo: string) {
  if (tipo === "VALE") return "Vale";
  if (tipo === "VALE_MEDICAO") return "Vale + Medição";
  return "Medição";
}

export default function LinhaLancamento({
  l,
  obraId,
  nomePessoa,
  pessoas,
  servicos,
  ehAdmin,
  isOwner,
  jaFechado,
  aprovarLancamento,
  rejeitarLancamento,
  editarLancamento,
  excluirLancamento,
  excluirLancamentoProprio,
}: {
  l: Lancamento;
  obraId: string;
  nomePessoa: string;
  pessoas: Pessoa[];
  servicos: Servico[];
  ehAdmin: boolean;
  isOwner: boolean;
  jaFechado: boolean;
  aprovarLancamento: (formData: FormData) => void;
  rejeitarLancamento: (formData: FormData) => void;
  editarLancamento: (formData: FormData) => void;
  excluirLancamento: (formData: FormData) => void;
  excluirLancamentoProprio: (formData: FormData) => void;
}) {
  const [editando, setEditando] = useState(false);

  // Regra de negócio: só dá para editar ou excluir (pelo dono, o estagiário que
  // criou) enquanto o lançamento está PENDENTE. Depois que o ADM aprova, fica
  // travado para sempre — só o ADM mantém um botão de exclusão de emergência
  // (correção de erro/teste), já existente antes desta funcionalidade.
  const podeEditarOuExcluirProprio = l.status === "PENDENTE" && (isOwner || ehAdmin);

  if (editando) {
    return (
      <tr className="border-t">
        <td colSpan={COLUNAS} className="p-2">
          <EditarLancamentoForm
            obraId={obraId}
            lancamento={l}
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
      <td className="p-1">
        {l.tipo === "VALE_MEDICAO"
          ? `R$ ${(Number(l.valor_vale_hibrido ?? 0) + Number(l.total_reais)).toFixed(2)}`
          : `R$ ${Number(l.total_reais).toFixed(2)}`}
      </td>
      <td className="p-1">
        <span
          className={
            "badge " + (l.status === "APROVADO" ? "badge-aprovado" : l.status === "REJEITADO" ? "badge-rejeitado" : "badge-pendente")
          }
        >
          {l.status}
        </span>
      </td>
      <td className="p-1 space-x-1 whitespace-nowrap">
        {ehAdmin && l.status === "PENDENTE" && (
          <>
            <form action={aprovarLancamento} className="inline">
              <input type="hidden" name="id" value={l.id} />
              <button className="bg-primary text-white rounded px-2 py-0.5 text-xs">Aprovar</button>
            </form>
            <form action={rejeitarLancamento} className="inline">
              <input type="hidden" name="id" value={l.id} />
              <button className="bg-gray-200 rounded px-2 py-0.5 text-xs">Rejeitar</button>
            </form>
          </>
        )}

        {podeEditarOuExcluirProprio && (
          <>
            <button onClick={() => setEditando(true)} className="bg-blue-100 text-blue-700 rounded px-2 py-0.5 text-xs">
              Editar
            </button>
            <form action={isOwner && !ehAdmin ? excluirLancamentoProprio : excluirLancamento} className="inline">
              <input type="hidden" name="id" value={l.id} />
              <input type="hidden" name="obraId" value={obraId} />
              <ConfirmDeleteButton />
            </form>
          </>
        )}

        {!podeEditarOuExcluirProprio && l.status === "APROVADO" && !ehAdmin && (
          <span className="text-xs text-gray-400">
            Esta medição já foi aprovada pelo administrador e não pode mais ser alterada ou excluída.
          </span>
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
