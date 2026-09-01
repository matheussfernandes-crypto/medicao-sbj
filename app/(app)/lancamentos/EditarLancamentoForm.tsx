"use client";

import { useState } from "react";

const TIPO_LABEL: Record<string, string> = {
  area: "Por m² (comprimento × altura)",
  linear: "Por m",
  unidade: "Por unidade",
  diaria: "Por diária",
};

type Pessoa = { id: string; nome: string };
type Servico = { id: string; nome: string; tipo: string; valor_unitario: number };

type LancamentoEditavel = {
  id: string;
  tipo: "MEDICAO" | "VALE" | "VALE_MEDICAO";
  data: string;
  pessoa_id: string;
  local: string | null;
  vale_real: boolean;
  total_reais: number;
  valor_vale_hibrido: number | null;
  observacao_medicao: string | null;
  quantidade: number | null;
  servico: string | null;
};

export default function EditarLancamentoForm({
  obraId,
  lancamento,
  pessoas,
  servicos,
  editarLancamento,
  onCancelar,
}: {
  obraId: string;
  lancamento: LancamentoEditavel;
  pessoas: Pessoa[];
  servicos: Servico[];
  editarLancamento: (formData: FormData) => void;
  onCancelar: () => void;
}) {
  const [tipoLancamento, setTipoLancamento] = useState<"MEDICAO" | "VALE" | "VALE_MEDICAO">(lancamento.tipo);
  const [valeReal, setValeReal] = useState(lancamento.tipo === "VALE" && lancamento.vale_real);

  const mostrarCamposServico = tipoLancamento === "MEDICAO" || (tipoLancamento === "VALE" && !valeReal);
  const mostrarValeReal = tipoLancamento === "VALE";
  const mostrarValeMedicao = tipoLancamento === "VALE_MEDICAO";

  // Tenta pré-selecionar o serviço pelo nome gravado no lançamento (não existe FK
  // para o serviço, só o nome congelado no momento do lançamento original).
  const servicoAtual = servicos.find((s) => s.nome === lancamento.servico);

  return (
    <form action={editarLancamento} className="space-y-2 bg-amber-50 border border-amber-200 rounded p-3">
      <input type="hidden" name="id" value={lancamento.id} />
      <input type="hidden" name="obraId" value={obraId} />
      <p className="text-xs text-amber-700 font-medium">
        Editando lançamento pendente — valor atual: R$ {Number(lancamento.total_reais + (lancamento.valor_vale_hibrido ?? 0)).toFixed(2)}.
        Confira todos os campos antes de salvar.
      </p>

      <div className="flex flex-wrap gap-2">
        <select name="pessoaId" defaultValue={lancamento.pessoa_id} className="border rounded px-2 py-1 flex-1 min-w-[150px]" required>
          {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select
          name="tipoLancamento"
          className="border rounded px-2 py-1"
          value={tipoLancamento}
          onChange={(e) => setTipoLancamento(e.target.value as "MEDICAO" | "VALE" | "VALE_MEDICAO")}
        >
          <option value="MEDICAO">Medição</option>
          <option value="VALE">Vale</option>
          <option value="VALE_MEDICAO">Vale + Medição</option>
        </select>
        <input type="date" name="data" defaultValue={lancamento.data} className="border rounded px-2 py-1" />
      </div>

      {mostrarValeReal && (
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              name="valeReal"
              value="1"
              checked={valeReal}
              onChange={(e) => setValeReal(e.target.checked)}
            />{" "}
            Vale real (valor fixo, sem cálculo de serviço)
          </label>
          {valeReal && (
            <input
              type="number"
              step="0.01"
              name="valorValeReal"
              placeholder="Valor do vale (R$)"
              defaultValue={lancamento.tipo === "VALE" && lancamento.vale_real ? lancamento.total_reais : undefined}
              className="border rounded px-2 py-1 w-40"
            />
          )}
        </div>
      )}

      {mostrarValeMedicao && (
        <div className="bg-primary/5 border border-primary/20 rounded p-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              type="number"
              step="0.01"
              name="valorValeHibrido"
              placeholder="Valor do vale (R$)"
              defaultValue={lancamento.tipo === "VALE_MEDICAO" ? lancamento.valor_vale_hibrido ?? undefined : undefined}
              className="border rounded px-2 py-1 w-44"
            />
            <input
              type="number"
              step="0.01"
              name="valorBrutoMedicaoComplementar"
              placeholder="Valor bruto da medição complementar (R$)"
              defaultValue={lancamento.tipo === "VALE_MEDICAO" ? lancamento.total_reais : undefined}
              className="border rounded px-2 py-1 w-64"
            />
            <input
              name="observacaoMedicao"
              placeholder="Observação da correção (opcional)"
              defaultValue={lancamento.observacao_medicao ?? ""}
              className="border rounded px-2 py-1 flex-1 min-w-[200px]"
            />
          </div>
        </div>
      )}

      {mostrarCamposServico && (
        <>
          <div className="flex flex-wrap gap-2">
            <select name="servicoId" defaultValue={servicoAtual?.id ?? ""} className="border rounded px-2 py-1 flex-1 min-w-[180px]">
              <option value="" disabled>Selecione o serviço…</option>
              {servicos.map((s) => (
                <option key={s.id} value={s.id} data-tipo={s.tipo}>
                  {s.nome} — {TIPO_LABEL[s.tipo]} (R$ {Number(s.valor_unitario).toFixed(2)})
                </option>
              ))}
            </select>
            <input name="local" placeholder="Local" defaultValue={lancamento.local ?? ""} className="border rounded px-2 py-1 flex-1 min-w-[150px]" />
          </div>

          <div className="flex flex-wrap gap-2">
            <input type="number" step="0.01" name="comprimento" placeholder="Comprimento (m)" className="border rounded px-2 py-1 w-36" />
            <input type="number" step="0.01" name="altura" placeholder="Altura (m) — só p/ m²" className="border rounded px-2 py-1 w-44" />
            <input type="number" step="0.01" name="qtd" placeholder="Quantidade — diária/unidade" defaultValue={lancamento.quantidade ?? undefined} className="border rounded px-2 py-1 w-52" />
            <input type="number" step="0.01" name="adicional" placeholder="Adicional R$" className="border rounded px-2 py-1 w-32" />
          </div>
          <p className="text-xs text-gray-400">
            Por segurança, comprimento/altura/adicional não vêm pré-preenchidos (o sistema guarda só o resultado
            final, não os valores originais digitados) — informe de novo para recalcular. Quantidade (diária/unidade)
            e comprimento (metro linear) vêm com o valor atual.
          </p>
        </>
      )}

      <div className="flex gap-2">
        <button className="bg-primary text-white rounded px-4 py-2 text-sm">Salvar alterações</button>
        <button type="button" onClick={onCancelar} className="bg-gray-200 rounded px-4 py-2 text-sm">Cancelar</button>
      </div>
    </form>
  );
}
