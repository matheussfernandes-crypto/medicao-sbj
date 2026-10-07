"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FormAcao from "@/components/contratos/FormAcao";
import { criarContrato } from "../actions";

type Empresa = { id: string; nome: string; especialidade: string | null };
type Obra = { id: string; nome: string };
type Contrato = { id: string; numero: string; objeto: string; status: string; empresa_id: string; obra_nome: string };

export default function NovoContratoForm({
  empresas,
  obras,
  contratos,
  sugestaoNumero,
}: {
  empresas: Empresa[];
  obras: Obra[];
  contratos: Contrato[];
  sugestaoNumero: string;
}) {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState("");
  const daEmpresa = contratos.filter((c) => c.empresa_id === empresaId);
  const empresa = empresas.find((e) => e.id === empresaId);

  return (
    <FormAcao
      action={criarContrato}
      reset={false}
      mostrarOk={false}
      onSucesso={(r) => { if (r.id) router.push(`/contratos/${r.id}`); }}
      className="card grid grid-cols-1 sm:grid-cols-2 gap-4"
    >
      <label className="sm:col-span-2 flex flex-col gap-1 text-xs text-ink-500">
        Empresa *
        <select name="empresaId" required value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className="border rounded px-3 py-2 text-sm text-ink-900">
          <option value="">Selecione a empresa…</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}{e.especialidade ? ` — ${e.especialidade}` : ""}</option>)}
        </select>
      </label>

      {empresaId && (
        <div className="sm:col-span-2 bg-surface-subtle border rounded-lg p-3">
          <p className="text-xs font-semibold text-ink-700 mb-2">Contratos já cadastrados de {empresa?.nome}</p>
          {daEmpresa.length ? (
            <ul className="space-y-1 text-sm">
              {daEmpresa.map((c) => (
                <li key={c.id} className="flex flex-wrap gap-2 items-center">
                  <Link href={`/contratos/${c.id}`} className="font-semibold text-primary hover:underline">Nº {c.numero}</Link>
                  <span className="font-semibold">🏗️ {c.obra_nome}</span>
                  <span className="text-ink-500">{c.objeto}</span>
                  <span className="text-[11px] text-ink-400">({c.status})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-400">Nenhum contrato ainda.</p>
          )}
        </div>
      )}

      <label className="flex flex-col gap-1 text-xs text-ink-500">
        Obra *
        <select name="obraId" required className="border rounded px-3 py-2 text-sm text-ink-900">
          <option value="">Selecione a obra…</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-500">
        Número do contrato *
        <input name="numero" required defaultValue={sugestaoNumero} className="border rounded px-3 py-2 text-sm text-ink-900" />
        <span className="text-[11px] text-ink-400">Sugerido automaticamente — pode trocar pelo número do contrato físico.</span>
      </label>
      <label className="sm:col-span-2 flex flex-col gap-1 text-xs text-ink-500">
        Objeto (serviço contratado) *
        <input name="objeto" required placeholder="Ex.: Mão de obra de revestimento cerâmico" className="border rounded px-3 py-2 text-sm text-ink-900" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-500">
        Início
        <input type="date" name="dataInicio" className="border rounded px-3 py-2 text-sm text-ink-900" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-500">
        Término previsto
        <input type="date" name="dataTermino" className="border rounded px-3 py-2 text-sm text-ink-900" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-500">
        Retenção por medição (%)
        <input name="retencaoPct" inputMode="decimal" defaultValue="5" className="border rounded px-3 py-2 text-sm text-ink-900" />
        <span className="text-[11px] text-ink-400">Aplicada por padrão em toda medição. Fica no histórico do contrato.</span>
      </label>
      <label className="sm:col-span-2 flex flex-col gap-1 text-xs text-ink-500">
        Observações
        <textarea name="observacoes" rows={2} className="border rounded px-3 py-2 text-sm text-ink-900" />
      </label>
      <div className="sm:col-span-2 flex gap-2">
        <button className="bg-primary text-white rounded-lg px-5 py-2 text-sm font-semibold hover:bg-primaryDark">Salvar e incluir itens →</button>
        <Link href="/contratos" className="px-4 py-2 text-sm text-ink-500">Cancelar</Link>
      </div>
    </FormAcao>
  );
}
