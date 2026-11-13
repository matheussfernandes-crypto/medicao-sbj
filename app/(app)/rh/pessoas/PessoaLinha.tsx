"use client";

import { useState } from "react";
import ConfirmDeleteButton from "../../lancamentos/ConfirmDeleteButton";
import Selecao from "@/components/ui/Selecao";
import { BotaoAcoes, DataCampo } from "@/components/ui/anima";

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
  const [aberta, setAberta] = useState(false); // faixa de ações aberta

  if (editando) {
    return (
      <tr className="border-t">
        <td colSpan={COLUNAS} className="p-2">
          <form action={editarPessoa} className="space-y-2 bg-amber-50 border border-amber-200 rounded p-3">
            <input type="hidden" name="pessoaId" value={p.id} />
            <p className="text-xs text-amber-700 font-medium">Editando cadastro de {p.nome}</p>
            <div className="flex flex-wrap gap-2">
              <input name="nome" defaultValue={p.nome} placeholder="Nome da pessoa" className="border rounded px-2 py-1 flex-1 min-w-[160px]" required />
              <Selecao name="papel" defaultValue={p.papel} className="border rounded px-2 py-1">
                <option value="EMPREITEIRO">Empreiteiro</option>
                <option value="MESTRE">Mestre</option>
                <option value="MESTRE_GERAL">Mestre Geral</option>
                <option value="CONTRAMESTRE">Contramestre</option>
              </Selecao>
              <Selecao name="obraId" defaultValue={p.obra_id} className="border rounded px-2 py-1">
                {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </Selecao>
              <DataCampo name="admissao" defaultValue={p.admissao} />
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

  const grupo = "flex flex-wrap items-center gap-2";
  const rot = "text-xs font-semibold text-ink-500";
  return (
    <>
    <tr className={"border-t " + (aberta ? "bg-surface-subtle" : "")}>
      <td className="p-1">{p.nome}</td>
      <td className="p-1">{rotuloPapel(p.papel)}</td>
      <td className="p-1">{nomeObra}</td>
      <td className="p-1 whitespace-nowrap">{p.admissao}</td>
      <td className="p-1">{tempoTexto}</td>
      <td className="p-1">
        <span className={p.status === "ATIVO" ? "text-green-600" : "text-red-500"}>
          {p.status === "ATIVO" ? "Ativo" : "Inativo"}
        </span>
      </td>
      <td className="p-1 text-right whitespace-nowrap">
        <BotaoAcoes aberto={aberta} onClick={() => setAberta((v) => !v)} />
      </td>
    </tr>
    {aberta && (
      <tr className="bg-surface-subtle sbj-entra">
        <td colSpan={COLUNAS} className="px-3 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {souAdmin && (
              <button onClick={() => setEditando(true)} className="bg-blue-100 text-blue-700 rounded-lg px-3 py-1.5 text-xs font-semibold">
                Editar cadastro
              </button>
            )}
            {p.status === "ATIVO" ? (
              <>
                <form action={transferirObra} className={grupo}>
                  <input type="hidden" name="pessoaId" value={p.id} />
                  <span className={rot}>Transferir para</span>
                  <Selecao name="obraId" defaultValue={p.obra_id} className="border rounded px-2 py-1 text-xs">
                    {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </Selecao>
                  <button className="bg-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold">Transferir</button>
                </form>
                <form action={darBaixa} className={grupo}>
                  <input type="hidden" name="pessoaId" value={p.id} />
                  <span className={rot}>Dar baixa em</span>
                  <DataCampo name="saida" defaultValue={hoje} />
                  <button className="bg-red-100 text-red-700 rounded-lg px-3 py-1.5 text-xs font-semibold">Dar baixa</button>
                </form>
              </>
            ) : (
              <>
                <form action={reativarPessoa} className={grupo}>
                  <input type="hidden" name="pessoaId" value={p.id} />
                  <span className="text-xs text-gray-400">Saída em {p.saida || "—"}</span>
                  <button className="bg-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold">Reativar</button>
                </form>
                {souAdmin && (
                  <form action={excluirPessoa}>
                    <input type="hidden" name="pessoaId" value={p.id} />
                    <ConfirmDeleteButton
                      mensagemPersonalizada={`Excluir definitivamente o cadastro de "${p.nome}"? Essa ação não pode ser desfeita. Só funciona se essa pessoa não tiver lançamentos ou retiradas registrados.`}
                    />
                  </form>
                )}
              </>
            )}
          </div>
        </td>
      </tr>
    )}
    </>
  );
}
