"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Paginador, usePaginas } from "@/components/ui/anima";

export type LinhaHistorico = {
  id: string;
  quando: string;
  autor: string;
  onde: string;
  local: string;
  servico: string;
  tipo: string;
  de: string;
  para: string;
  observacao: string;
};

export default function HistoricoNovoClient({ obraNome, linhas }: { obraNome: string; linhas: LinhaHistorico[] }) {
  const [busca, setBusca] = useState("");
  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return linhas;
    return linhas.filter((l) => [l.autor, l.onde, l.local, l.servico, l.tipo, l.de, l.para, l.observacao].join(" ").toLowerCase().includes(t));
  }, [linhas, busca]);

  const pg = usePaginas(filtradas, 25);

  function exportar() {
    const cab = ["Data/hora", "Autor", "Pavimento/Sistema", "Local", "Serviço", "Tipo", "De", "Para", "Observação"];
    const csv = [cab, ...filtradas.map((l) => [new Date(l.quando).toLocaleString("pt-BR"), l.autor, l.onde, l.local, l.servico, l.tipo, l.de, l.para, l.observacao])]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-${obraNome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="relative">
          <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por pessoa, local, serviço…" className="border border-border rounded-[10px] pl-9 pr-3 py-2 text-sm w-72 max-w-full bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition" />
        </label>
        <span className="text-xs text-ink-500">{filtradas.length} registro(s) (os 1.500 mais recentes)</span>
        <button onClick={exportar} className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-[10px] text-sm font-medium hover:bg-primaryDark transition-colors">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>
      <div ref={pg.topo} className="overflow-auto border border-border rounded-xl">
        <table className="text-xs w-full">
          <thead className="sticky top-0 bg-surface-subtle">
            <tr className="text-left">
              {["Quando", "Quem", "Onde", "Local", "Serviço", "Mudança"].map((h) => (
                <th key={h} className="px-2 py-2 border-b border-border">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={pg.giro} className={pg.classe}>
            {pg.itens.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-8 text-center text-ink-500">
                  Nenhum registro {busca ? "com esta busca" : "ainda"}.
                </td>
              </tr>
            )}
            {pg.itens.map((l) => (
              <tr key={l.id} className="border-b border-border/60 align-top hover:bg-surface-subtle transition-colors">
                <td className="px-2 py-1.5 whitespace-nowrap">{new Date(l.quando).toLocaleString("pt-BR")}</td>
                <td className="px-2 py-1.5">{l.autor}</td>
                <td className="px-2 py-1.5">{l.onde}</td>
                <td className="px-2 py-1.5">{l.local}</td>
                <td className="px-2 py-1.5">{l.servico}</td>
                <td className="px-2 py-1.5">{l.tipo === "Status" ? `${l.de || "—"} → ${l.para}` : `Obs.: ${l.observacao}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Paginador {...pg} />
    </div>
  );
}
