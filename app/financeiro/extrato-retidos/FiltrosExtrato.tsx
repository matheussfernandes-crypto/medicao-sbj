"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";

type Props = {
  pessoas: { id: string; nome: string }[];
  obras: { id: string; nome: string }[];
};

export default function FiltrosExtrato({ pessoas, obras }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(formRef.current!);
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      if (v && String(v).trim()) params.set(k, String(v));
    }
    router.push(`/financeiro/extrato-retidos?${params.toString()}`);
  }

  const btn = "bg-primary text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-primaryDark transition";
  const inp = "border rounded px-2 py-1.5 text-sm";

  return (
    <form ref={formRef} onSubmit={submit} className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">Empreiteiro</label>
        <select name="pessoaId" defaultValue={sp.get("pessoaId") ?? ""} className={inp + " min-w-[200px]"}>
          <option value="">— Todos —</option>
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">Obra</label>
        <select name="obraId" defaultValue={sp.get("obraId") ?? ""} className={inp + " min-w-[160px]"}>
          <option value="">Todas as Obras</option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>{o.nome}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">Data inicial</label>
        <input type="date" name="dataInicio" defaultValue={sp.get("dataInicio") ?? ""} className={inp} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">Data final</label>
        <input type="date" name="dataFim" defaultValue={sp.get("dataFim") ?? ""} className={inp} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">Situação</label>
        <select name="situacao" defaultValue={sp.get("situacao") ?? ""} className={inp}>
          <option value="">Todos</option>
          <option value="com_saldo">Apenas com saldo</option>
          <option value="zerados">Apenas zerados/negativos</option>
        </select>
      </div>
      <button type="submit" className={btn}>Filtrar</button>
      <a href="/financeiro/extrato-retidos" className="text-xs text-gray-400 underline self-center">Limpar</a>
    </form>
  );
}
