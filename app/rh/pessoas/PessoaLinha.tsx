"use client";

import { useState } from "react";
import ConfirmDeleteButton from "../../lancamentos/ConfirmDeleteButton";

type Obra = { id: string; nome: string };

type Pessoa = {
  id: string;
  nome: string;
  papel: string;
  obra_id: string;
  admissao: string;
  status: "ATIVO" | "INATIVO";
  saida: string | null;
};

const COLUNAS = 7;

function rotuloPapel(papel: string) {
  if (papel === "MESTRE") return "Mestre";
  if (papel === "MESTRE_GERAL") return "Mestre Geral";
  if (papel === "CONTRAMESTRE") return "Contramestre";
  return "Empreiteiro";
}

export default function PessoaLinha({
  p,
  obras,
  nomeObra,
  tempoTexto,
  souAdmin,
  transferirObra,
  darBaixa,
  reativarPessoa,
  excluirPessoa,
  editarPessoa,
  hoje,
}: {
  p: Pessoa;
  obras: Obra[];
  nomeObra: string;
  tempoTexto: string;
  souAdmin: boolean;
  transferirObra: (formData: FormData) => void;
  darBaixa: (formData: FormData) => void;
  reativarPessoa: (formData: FormData) => void;
  excluirPessoa: (formData: FormData) => void;
  editarPessoa: (formData: FormData) => void;
  hoje: string;
}) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <tr className="border-t">
        <td colSpan={COLUNAS} className="p-2">
          <form action={editarPessoa} className="space-y-2 bg-amber-50 border border-amber-200 rounded p-3">
            <input type="hidden" name="pessoaId" value={p.id} />
            <p className="text-xs text-amber-700 font-medium">Editando cadastro de {p.nome}</p>
            <div className="flex flex-wrap gap-2">
              <input name="nome" defaultValue={p.nome} placeholder="Nome da pessoa" className="border rounded px-2 py-1 flex-1 min-w-[160px]" required />
              <select name="papel" defaultValue={p.papel} className="border rounded px-2 py-1">
                <option value="EMPREITEIRO">Empreiteiro</option>
                <option value="MESTRE">Mestre</option>
                <option value="MESTRE_GERAL">Mestre Geral</option>
                <option value="CONTRAMESTRE">Contramestre</option>
              </select>
              <select name="obraId" defaultValue={p.obra_id} className="border rounded px-2 py-1">
                {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
              <input name="admissao" type="date" defaultValue={p.admissao} className="border rounded px-2 py-1" />
            </div>
            <div className="flex gap-2">
              <button className="bg-primary text-white rounded px-3 py-1 text-sm">Salvar</button>
              <button type="button" onClick={() => setEditando(false)} className="bg-gray-200 rounded px-3 py-1 text-sm">Cancelar</button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t">
      <td className="p-1">{p.nome}</td>
      <td className="p-1">{rotuloPapel(p.papel)}</td>
      <td className="p-1">{nomeObra}</td>
      <td className="p-1">{p.admissao}</td>
      <td className="p-1">{tempoTexto}</td>
      <td className="p-1">
        <span className={p.status === "ATIVO" ? "text-green-600" : "text-red-500"}>
          {p.status === "ATIVO" ? "Ativo" : "Inativo"}
        </span>
      </td>
      <td className="p-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {souAdmin && (
            <button onClick={() => setEditando(true)} className="bg-blue-100 text-blue-700 rounded px-2 py-0.5 text-xs">
              Editar
            </button>
          )}
        </div>
        {p.status === "ATIVO" ? (
          <>
            <form action={transferirObra} className="flex gap-1 mb-1">
              <input type="hidden" name="pessoaId" value={p.id} />
              <select name="obraId" defaultValue={p.obra_id} className="border rounded px-1 text-xs">
                {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
              <button className="bg-gray-200 rounded px-2 text-xs">Transferir</button>
            </form>
            <form action={darBaixa} className="flex gap-1">
              <input type="hidden" name="pessoaId" value={p.id} />
              <input type="date" name="saida" defaultValue={hoje} className="border rounded px-1 text-xs" />
              <button className="bg-red-100 text-red-700 rounded px-2 text-xs">Dar baixa</button>
            </form>
          </>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <form action={reativarPessoa}>
              <input type="hidden" name="pessoaId" value={p.id} />
              <span className="text-xs text-gray-400 mr-2">Saída em {p.saida || "—"}</span>
              <button className="bg-gray-200 rounded px-2 text-xs">Reativar</button>
            </form>
            {souAdmin && (
              <form action={excluirPessoa}>
                <input type="hidden" name="pessoaId" value={p.id} />
                <ConfirmDeleteButton
                  mensagemPersonalizada={`Excluir definitivamente o cadastro de "${p.nome}"? Essa ação não pode ser desfeita. Só funciona se essa pessoa não tiver lançamentos ou retiradas registrados.`}
                />
              </form>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
