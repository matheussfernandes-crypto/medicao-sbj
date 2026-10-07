"use client";

import { useState } from "react";
import FormAcao from "@/components/contratos/FormAcao";
import { responderSolicitacao } from "../actions";
import { brl, parseNum } from "@/lib/contratos/util";

export default function SolicitacaoCard({
  id,
  tipo,
  quantidade,
  descricao,
  unidade,
  valorUnitarioItem,
}: {
  id: string;
  tipo: "AUMENTO" | "NOVO_SERVICO";
  quantidade: number;
  descricao: string | null;
  unidade: string | null;
  valorUnitarioItem: number | null;
}) {
  const [decisao, setDecisao] = useState<"APROVAR" | "DESAPROVAR">("APROVAR");
  const [qtd, setQtd] = useState(String(quantidade).replace(".", ","));
  const [vu, setVu] = useState("");
  const impacto = parseNum(qtd) * (tipo === "AUMENTO" ? valorUnitarioItem ?? 0 : parseNum(vu));

  return (
    <FormAcao action={responderSolicitacao} reset={false} className="flex flex-wrap gap-2 items-end text-xs">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decisao" value={decisao} />
      <div className="basis-full flex gap-2">
        <button type="button" onClick={() => setDecisao("APROVAR")} className={`rounded px-3 py-1.5 font-semibold border ${decisao === "APROVAR" ? "bg-success text-white border-success" : "bg-white"}`}>Aprovar</button>
        <button type="button" onClick={() => setDecisao("DESAPROVAR")} className={`rounded px-3 py-1.5 font-semibold border ${decisao === "DESAPROVAR" ? "bg-danger text-white border-danger" : "bg-white"}`}>Desaprovar</button>
      </div>
      {decisao === "APROVAR" && (
        <>
          {tipo === "NOVO_SERVICO" && (
            <>
              <label className="flex flex-col gap-1">Código<input name="codigo" className="border rounded px-2 py-1.5 w-20" /></label>
              <label className="flex flex-col gap-1 flex-1 min-w-[180px]">Descrição<input name="descricao" defaultValue={descricao ?? ""} required className="border rounded px-2 py-1.5" /></label>
              <label className="flex flex-col gap-1">Unidade<input name="unidade" defaultValue={unidade ?? ""} className="border rounded px-2 py-1.5 w-16" /></label>
              <label className="flex flex-col gap-1">Valor unit. (R$) *<input name="valorUnitario" required inputMode="decimal" value={vu} onChange={(e) => setVu(e.target.value)} className="border rounded px-2 py-1.5 w-28" /></label>
            </>
          )}
          <label className="flex flex-col gap-1">Quantidade aprovada<input name="quantidade" inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} className="border rounded px-2 py-1.5 w-28" /></label>
          <label className="flex flex-col gap-1 flex-1 min-w-[160px]">Observação (opcional)<input name="motivo" className="border rounded px-2 py-1.5" /></label>
          <button className="bg-success text-white rounded px-4 py-2 font-semibold">Aprovar e lançar aditivo</button>
          {impacto > 0 && <span className="basis-full text-ink-500">Impacto no contrato: {brl(impacto)}</span>}
        </>
      )}
      {decisao === "DESAPROVAR" && (
        <>
          <label className="flex flex-col gap-1 flex-1 min-w-[220px]">Motivo *<input name="motivo" required className="border rounded px-2 py-1.5" /></label>
          <button className="bg-danger text-white rounded px-4 py-2 font-semibold">Desaprovar</button>
        </>
      )}
    </FormAcao>
  );
}
