"use client";

import { useState } from "react";
import { ChevronDown, History } from "lucide-react";

export type PdfGerado = { id: number; arquivo: string; rev: string | null; papel: string | null; gerado_por_nome: string | null; gerado_em: string };

const dataHora = (s: string) =>
  new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Histórico dos PDFs gerados (quem, quando, qual arquivo). Fica recolhido; abre ao clicar. */
export default function HistoricoPdfs({ lista }: { lista: PdfGerado[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="card">
      <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        <span className="flex items-center gap-2 font-semibold text-primaryDark">
          <History className="h-4 w-4 text-primary" /> Histórico de PDFs
          <span className="text-xs font-normal text-ink-400">{lista.length ? `${lista.length} gerado(s) · último em ${dataHora(lista[0].gerado_em)}` : "nenhum gerado ainda"}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-ink-400 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && (
        <div className="mt-3 overflow-x-auto">
          {!lista.length ? (
            <p className="text-sm text-ink-500">Quando alguém imprimir ou salvar o PDF, fica registrado aqui.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-ink-500">
                  <th className="py-1.5 pr-3 font-semibold">Data</th>
                  <th className="py-1.5 pr-3 font-semibold">Arquivo</th>
                  <th className="py-1.5 pr-3 font-semibold">Revisão</th>
                  <th className="py-1.5 pr-3 font-semibold">Papel</th>
                  <th className="py-1.5 font-semibold">Gerado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap py-1.5 pr-3 text-ink-700">{dataHora(p.gerado_em)}</td>
                    <td className="py-1.5 pr-3 text-ink-900">{p.arquivo}</td>
                    <td className="py-1.5 pr-3 text-ink-700">{p.rev ?? "—"}</td>
                    <td className="whitespace-nowrap py-1.5 pr-3 text-ink-700">{p.papel ?? "—"}</td>
                    <td className="py-1.5 text-ink-700">{p.gerado_por_nome ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
