"use client";

import { CalendarDays, Pencil } from "lucide-react";
import { useState } from "react";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import EditarLancamentoForm from "./EditarLancamentoForm";
import { BotaoAcoes, DataCampo } from "@/components/ui/anima";

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
  comSelecao = ehAdmin,
  isOwner,
  jaFechado,
  selected,
  onSelect,
  aprovarLancamento,
  rejeitarLancamento,
  editarLancamento,
  excluirLancamento,
  excluirLancamentoProprio,
  editarDataLancamento,
}: {
  l: Lancamento;
  obraId: string;
  nomePessoa: string;
  nomeCriador: string;
  pessoas: Pessoa[];
  servicos: Servico[];
  ehAdmin: boolean;
  comSelecao?: boolean; // coluna de seleção (só quando há pendentes)
  isOwner: boolean;
  jaFechado: boolean;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  aprovarLancamento: (formData: FormData) => void;
  rejeitarLancamento: (formData: FormData) => void;
  editarLancamento: (formData: FormData) => void;
  excluirLancamento: (formData: FormData) => void;
  excluirLancamentoProprio: (formData: FormData) => void;
  editarDataLancamento: (formData: FormData) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [rejeitando, setRejeitando] = useState(false);
  const [motivoTexto, setMotivoTexto] = useState("");
  const [editandoData, setEditandoData] = useState(false);
  const [aberta, setAberta] = useState(false); // faixa de ações aberta

  // checkbox + 9 colunas existentes (quando admin); 9 sem checkbox (não-admin)
  const COLUNAS = comSelecao ? 10 : 9;

  const podeEditarOuExcluirProprio = l.status === "PENDENTE" && (isOwner || ehAdmin);
  const temAcoes = ehAdmin || podeEditarOuExcluirProprio;

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
    <>
    <tr className={"border-t " + (aberta ? "bg-surface-subtle" : "")}>
      {/* Checkbox de seleção — apenas para ADM em lançamentos PENDENTES */}
      {comSelecao && (
        <td data-col="sel" className="p-1 w-8 text-center">
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

      <td data-col="data" className="p-1 whitespace-nowrap">{new Date(l.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</td>
      <td data-col="tipo" className="p-1 whitespace-nowrap">{rotuloTipo(l.tipo)}</td>
      <td data-col="pessoa" className="p-1">{nomePessoa}</td>
      <td data-col="detalhe" className="p-1">
        {l.tipo === "VALE_MEDICAO" ? (
          <>
            {`Vale R$ ${Number(l.valor_vale_hibrido ?? 0).toFixed(2)} + Medição compl. R$ ${Number(l.total_reais).toFixed(2)} (bruto)`}
            {l.observacao_medicao && (
              <div className="text-xs text-ink-500 mt-0.5 whitespace-pre-wrap break-words">Obs.: {l.observacao_medicao}</div>
            )}
          </>
        ) : l.vale_real ? (
          "Vale real"
        ) : (
          `${l.servico ?? ""} ${l.detalhe_texto ?? ""}`
        )}
      </td>
      <td data-col="local" className="p-1 max-w-[140px] break-words">{l.local ?? "—"}</td>
      <td data-col="por" className="p-1 max-w-[130px]">{nomeCriador}</td>
      <td data-col="total" className="p-1 whitespace-nowrap tabular-nums font-medium">
        {l.tipo === "VALE_MEDICAO"
          ? `R$ ${(Number(l.valor_vale_hibrido ?? 0) + Number(l.total_reais)).toFixed(2)}`
          : `R$ ${Number(l.total_reais).toFixed(2)}`}
      </td>
      <td data-col="status" className="p-1">
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
      <td data-col="acoes" className="p-1 text-right whitespace-nowrap">
        {ehAdmin && l.status !== "PENDENTE" ? (
          <>
          <div className="hidden lg:block">
          {editandoData ? (
            <form action={editarDataLancamento} className="flex items-center justify-end gap-1" onSubmit={() => setEditandoData(false)}>
              <input type="hidden" name="id" value={l.id} />
              <DataCampo name="data" defaultValue={l.data} />
              <button type="submit" className="bg-primary text-white rounded px-2 py-0.5 text-xs">Salvar</button>
              <button type="button" onClick={() => setEditandoData(false)} className="bg-gray-200 rounded px-2 py-0.5 text-xs">✕</button>
            </form>
          ) : (
            <div className="flex items-center justify-end gap-1.5">
              <button type="button" onClick={() => setEditandoData(true)} className="btn-acao-editar" title="Alterar data" aria-label="Alterar data">
                <CalendarDays className="w-4 h-4" aria-hidden />
              </button>
              <form action={excluirLancamento} className="inline">
                <input type="hidden" name="id" value={l.id} />
                <input type="hidden" name="obraId" value={obraId} />
                <ConfirmDeleteButton jaFechado={jaFechado} />
              </form>
            </div>
          )}
          </div>
          <div className="lg:hidden">
            <BotaoAcoes aberto={aberta} onClick={() => setAberta((v) => !v)} />
          </div>
          </>
        ) : temAcoes ? (
          <BotaoAcoes aberto={aberta} onClick={() => setAberta((v) => !v)} />
        ) : (
          l.status === "APROVADO" && <span className="text-xs text-gray-400">Aprovado</span>
        )}
      </td>
    </tr>
    {aberta && temAcoes && (
      <tr className={"bg-surface-subtle sbj-entra " + (ehAdmin && l.status !== "PENDENTE" ? "lg:hidden" : "")}>
        <td colSpan={COLUNAS} className="px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
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
            <button onClick={() => setEditando(true)} className="btn-acao-alterar-txt" title="Editar" aria-label="Editar">
              <Pencil className="w-4 h-4" aria-hidden />
              Editar
            </button>
            <form action={isOwner && !ehAdmin ? excluirLancamentoProprio : excluirLancamento} className="inline">
              <input type="hidden" name="id" value={l.id} />
              <input type="hidden" name="obraId" value={obraId} />
              <ConfirmDeleteButton rotulo="Excluir lançamento" />
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
            <ConfirmDeleteButton jaFechado={jaFechado} rotulo="Excluir lançamento" />
          </form>
        )}

        {/* Editar data — ADM em qualquer status */}
        {ehAdmin && (
          editandoData ? (
            <form action={editarDataLancamento} className="flex items-center gap-1 mt-1 flex-wrap" onSubmit={() => setEditandoData(false)}>
              <input type="hidden" name="id" value={l.id} />
              <DataCampo name="data" defaultValue={l.data} />
              <button type="submit" className="bg-primary text-white rounded px-2 py-0.5 text-xs">Salvar</button>
              <button type="button" onClick={() => setEditandoData(false)} className="bg-gray-200 rounded px-2 py-0.5 text-xs">✕</button>
            </form>
          ) : (
            <button onClick={() => setEditandoData(true)} className="btn-acao-alterar-txt" title="Alterar data" aria-label="Alterar data">
              <CalendarDays className="w-4 h-4" aria-hidden />
              Alterar data
            </button>
          )
        )}
          </div>
        </td>
      </tr>
    )}
    </>
  );
}
