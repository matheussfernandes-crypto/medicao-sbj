"use client";

import Selecao from "@/components/ui/Selecao";
import { usePathname, useRouter } from "next/navigation";

export default function ObraSelect({ obras, atual }: { obras: { id: string; nome: string }[]; atual: string }) {
  const router = useRouter();
  const path = usePathname();
  return (
    <div>
      <label className="block text-xs text-ink-500 mb-1">Obra</label>
      <Selecao className="border border-border rounded-lg px-3 py-2 text-sm min-w-[220px] bg-white" value={atual} onChange={(e) => router.push(`${path}?obra=${e.target.value}`)}>
        {obras.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </Selecao>
    </div>
  );
}
