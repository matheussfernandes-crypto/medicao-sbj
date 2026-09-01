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
type EmpresaContrato = { id: string; empresa_nome: string; tipo_servico: string; retencao_pct: number; retencao_contratual: boolean };

export default function NovoLancamentoForm({
  obraId,
  pessoas,
  servicos,
  empresasContrato,
  criarLancamento,
}: {
  obraId: string;
  pessoas: Pessoa[];
  servicos: Servico[];
  empresasContrato: EmpresaContrato[];
  criarLancamento: (formData: FormData) => void;
}) {
  const [tipoContratado, setTipoContratado] = useState<"SBJ" | "TERCEIRIZADA">("SBJ");
  const [tipoLancamento, setTipoLancamento] = useState<"MEDICAO" | "VALE" | "VALE_MEDICAO">("MEDICAO");
  const [valeReal, setValeReal] = useState(false);

  const mostrarCamposServico = tipoLancamento === "MEDICAO" || (tipoLancamento === "VALE" && !valeReal);
  const mostrarValeReal = tipoLancamento === "VALE";
  const mostrarValeMedicao = tipoLancamento === "VALE_MEDICAO";

  const temEmpresasAtivas = empresasContrato.length > 0;

  return (
    <form action={criarLancamento} className="space-y-3">
      <input type="hidden" name="obraId" value={obraId} />
      <input type="hidden" name="tipoContratado" value={tipoContratado} />

      {/* ── PASSO 1: Tipo de contratado ── */}
      <div>
        <p className="text-xs text-gray-500 mb-1 font-medium">Tipo de contratado</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTipoContratado("SBJ")}
            className={`flex-1 border rounded px-3 py-2 text-sm font-medium transition ${
              tipoContratado === "SBJ"
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Empreiteiros SBJ
          </button>
          <button
            type="button"
            onClick={() => setTipoContratado("TERCEIRIZADA")}
            className={`flex-1 border rounded px-3 py-2 text-sm font-medium transition ${
              tipoContratado === "TERCEIRIZADA"
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Empresa Terceirizada
          </button>
        </div>
      </div>

      {/* ── PASSO 2: Quem vai medir ── */}
      <div className="flex flex-wrap gap-2">
        {tipoContratado === "SBJ" ? (
          <select name="pessoaId" className="border rounded px-2 py-1 flex-1 min-w-[150px]" required>
            <option value="">Selecionar empreiteiro…</option>
            {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        ) : (
          <>
            {temEmpresasAtivas ? (
              <select name="empresaObraId" className="border rounded px-2 py-1 flex-1 min-w-[200px]" required>
                <option value="">Selecionar empresa…</option>
                {empresasContrato.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.empresa_nome} — {e.tipo_servico}
                    {e.retencao_contratual ? ` (retenção ${Number(e.retencao_pct).toFixed(0)}%)` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex-1 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Nenhuma empresa com contrato ativo vinculada a esta obra.{" "}
                <a href="/admin/obras" className="underline font-medium">
                  Vincular empresa →
                </a>
              </div>
            )}
          </>
        )}

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
        <input type="date" name="data" defaultValue={new Date().toISOString().slice(0, 10)} className="border rounded px-2 py-1" />
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
            <input type="number" step="0.01" name="valorValeReal" placeholder="Valor do vale (R$)" className="border rounded px-2 py-1 w-40" />
          )}
        </div>
      )}

      {mostrarValeMedicao && (
        <div className="bg-primary/5 border border-primary/20 rounded p-2 space-y-2">
          <p className="text-xs text-gray-500">
            Use <b>Vale + Medição</b> quando o empreiteiro recebe um vale referente à próxima medição e, no mesmo
            lançamento, há uma medição complementar de um período anterior (correção de diferença, serviço que
            ficou de fora, ajuste posterior). Os dois valores ficam separados: o vale entra no fechamento de Vale
            do mês (junto com a medição complementar líquida); a medição complementar usa sua própria retenção.
          </p>
          <div className="flex flex-wrap gap-2">
            <input type="number" step="0.01" name="valorValeHibrido" placeholder="Valor do vale (R$)" className="border rounded px-2 py-1 w-44" />
            <input type="number" step="0.01" name="valorBrutoMedicaoComplementar" placeholder="Valor bruto da medição complementar (R$)" className="border rounded px-2 py-1 w-64" />
            <input name="observacaoMedicao" placeholder="Observação da correção (opcional)" className="border rounded px-2 py-1 flex-1 min-w-[200px]" />
          </div>
        </div>
      )}

      {mostrarCamposServico && (
        <>
          <div className="flex flex-wrap gap-2">
            <select name="servicoId" className="border rounded px-2 py-1 flex-1 min-w-[180px]">
              {servicos.map((s) => (
                <option key={s.id} value={s.id} data-tipo={s.tipo}>
                  {s.nome} — {TIPO_LABEL[s.tipo]} (R$ {Number(s.valor_unitario).toFixed(2)})
                </option>
              ))}
            </select>
            <input name="local" placeholder="Local (ex: bloco A, 3º pavimento)" className="border rounded px-2 py-1 flex-1 min-w-[150px]" />
          </div>

          <div className="flex flex-wrap gap-2">
            <input type="number" step="0.01" name="comprimento" placeholder="Comprimento (m)" className="border rounded px-2 py-1 w-36" />
            <input type="number" step="0.01" name="altura" placeholder="Altura (m) — só p/ m²" className="border rounded px-2 py-1 w-44" />
            <input type="number" step="0.01" name="qtd" placeholder="Quantidade — diária/unidade" className="border rounded px-2 py-1 w-52" />
            <input type="number" step="0.01" name="adicional" placeholder="Adicional R$" className="border rounded px-2 py-1 w-32" />
          </div>
        </>
      )}

      <button
        disabled={tipoContratado === "TERCEIRIZADA" && !temEmpresasAtivas}
        className="bg-primary text-white rounded px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Lançar
      </button>
      {mostrarCamposServico && (
        <p className="text-xs text-gray-400">
          Preencha comprimento/altura para serviços por m², só comprimento para metro linear, ou quantidade para diária/unidade.
          A % de retenção e o valor unitário usados ficam congelados neste lançamento — não mudam se a tabela de preços ou a retenção mudar depois.
        </p>
      )}
    </form>
  );
}
