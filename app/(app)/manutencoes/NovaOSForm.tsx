"use client";

import { useMemo, useState } from "react";
import {
  SOLICITANTE_TIPO_LABEL,
  ORIGEM_LABEL,
  PRIORIDADE_LABEL,
} from "./constants";
import type { Opcao } from "./opcoes-listas";

type Obra = { id: string; nome: string };
type Torre = { id: string; obra_id: string; nome: string };
type Pavimento = { id: string; torre_id: string; nome: string };
type Unidade = { id: string; pavimento_id: string; nome: string };

export default function NovaOSForm({
  obras,
  torres,
  pavimentos,
  unidades,
  categorias,
  problemas,
  criarOS,
}: {
  obras: Obra[];
  torres: Torre[];
  pavimentos: Pavimento[];
  unidades: Unidade[];
  categorias: Opcao[];
  problemas: Opcao[];
  criarOS: (formData: FormData) => void;
}) {
  const [obraId, setObraId] = useState(obras[0]?.id ?? "");
  const [torreId, setTorreId] = useState("");
  const [pavimentoId, setPavimentoId] = useState("");
  const [areaComum, setAreaComum] = useState(false);

  const torresDaObra = useMemo(() => torres.filter((t) => t.obra_id === obraId), [torres, obraId]);
  const pavimentosDaTorre = useMemo(() => pavimentos.filter((p) => p.torre_id === torreId), [pavimentos, torreId]);
  const unidadesDoPavimento = useMemo(() => unidades.filter((u) => u.pavimento_id === pavimentoId), [unidades, pavimentoId]);

  return (
    <form action={criarOS} className="space-y-5">
      <input type="hidden" name="obraId" value={obraId} />

      <div className="card space-y-3">
        <h2 className="font-semibold text-primaryDark">Solicitante</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-ink-500 block mb-1">Nome *</label>
            <input name="solicitanteNome" required className="border rounded px-3 py-2 w-full" placeholder="Nome do solicitante" />
          </div>
          <div>
            <label className="text-xs text-ink-500 block mb-1">Telefone *</label>
            <input name="solicitanteTelefone" required className="border rounded px-3 py-2 w-full" placeholder="(47) 99999-9999" />
          </div>
          <div>
            <label className="text-xs text-ink-500 block mb-1">Tipo *</label>
            <select name="solicitanteTipo" required className="border rounded px-3 py-2 w-full" defaultValue="MORADOR">
              {Object.entries(SOLICITANTE_TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-ink-500 block mb-1">Origem *</label>
            <select name="origem" required className="border rounded px-3 py-2 w-full" defaultValue="WHATSAPP">
              {Object.entries(ORIGEM_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-primaryDark">Local</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-ink-500 block mb-1">Empreendimento *</label>
            <select
              value={obraId}
              onChange={(e) => { setObraId(e.target.value); setTorreId(""); setPavimentoId(""); }}
              className="border rounded px-3 py-2 w-full"
              required
            >
              {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>

          {torresDaObra.length > 0 && (
            <div>
              <label className="text-xs text-ink-500 block mb-1">Torre</label>
              <select
                name="torreId"
                value={torreId}
                onChange={(e) => { setTorreId(e.target.value); setPavimentoId(""); }}
                className="border rounded px-3 py-2 w-full"
              >
                <option value="">—</option>
                {torresDaObra.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
          )}

          {pavimentosDaTorre.length > 0 && (
            <div>
              <label className="text-xs text-ink-500 block mb-1">Pavimento</label>
              <select
                name="pavimentoId"
                value={pavimentoId}
                onChange={(e) => setPavimentoId(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              >
                <option value="">—</option>
                {pavimentosDaTorre.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          )}

          {unidadesDoPavimento.length > 0 && !areaComum && (
            <div>
              <label className="text-xs text-ink-500 block mb-1">Apartamento / Unidade</label>
              <select name="unidadeId" className="border rounded px-3 py-2 w-full">
                <option value="">—</option>
                {unidadesDoPavimento.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={areaComum} onChange={(e) => setAreaComum(e.target.checked)} />
          É área comum (não é uma unidade específica)
        </label>
        {areaComum && (
          <input name="areaComumTexto" className="border rounded px-3 py-2 w-full" placeholder="Ex: Salão de festas, Garagem, Hall de entrada…" />
        )}
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-primaryDark">Chamado</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-ink-500 block mb-1">Categoria *</label>
            <select name="categoria" required className="border rounded px-3 py-2 w-full" defaultValue="">
              <option value="" disabled>Selecione…</option>
              {categorias.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-ink-500 block mb-1">Problema *</label>
            <select name="problema" required className="border rounded px-3 py-2 w-full" defaultValue="">
              <option value="" disabled>Selecione…</option>
              {problemas.map((p) => <option key={p.valor} value={p.valor}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-ink-500 block mb-1">Prioridade *</label>
            <select name="prioridade" required className="border rounded px-3 py-2 w-full" defaultValue="MEDIA">
              {Object.entries(PRIORIDADE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-ink-500 block mb-1">Descrição</label>
          <textarea name="descricao" className="border rounded px-3 py-2 w-full h-20 resize-none" placeholder="Detalhe o que foi relatado…" />
        </div>
      </div>

      <button type="submit" className="bg-primary text-white rounded px-6 py-2.5 font-semibold hover:bg-primaryDark transition">
        Abrir Ordem de Serviço
      </button>
    </form>
  );
}
