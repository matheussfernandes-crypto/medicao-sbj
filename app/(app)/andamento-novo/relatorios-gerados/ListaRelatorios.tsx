"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Mail } from "lucide-react";
import EnviarEmail from "../relatorio/EnviarEmail";
import type { CorpoEmail, LinhaLog, RespostaRelatorio } from "../relatorio/tiposApi";

const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const diaBR = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // aaaa-mm-dd no horário de Brasília

export default function ListaRelatorios({ linhas, obraId, obraNome, todas }: { linhas: (LinhaLog & { url?: string | null })[]; obraId: string; obraNome: string; todas: boolean }) {
  const router = useRouter();
  const [pessoa, setPessoa] = useState("");
  const [acao, setAcao] = useState<"" | "PDF" | "EMAIL">("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [reenviando, setReenviando] = useState<LinhaLog | null>(null);

  const pessoas = useMemo(() => Array.from(new Set(linhas.map((l) => l.usuario_nome || l.usuario_email || "").filter(Boolean))).sort(), [linhas]);
  const filtradas = useMemo(
    () =>
      linhas.filter((l) => {
        if (pessoa && (l.usuario_nome || l.usuario_email) !== pessoa) return false;
        if (acao && l.acao !== acao) return false;
        const d = diaBR(l.criado_em);
        if (de && d < de) return false;
        if (ate && d > ate) return false;
        return true;
      }),
    [linhas, pessoa, acao, de, ate]
  );

  function exportarCSV() {
    const cab = ["Data/hora", "Obra", "Quem gerou", "E-mail de quem gerou", "Ação", "Tipo", "Filtro/predefinição", "Folha", "Páginas", "% da obra", "Resumo na 1ª página", "Destinatários", "Situação", "Erro"];
    const rows = filtradas.map((l) => [
      fmtDataHora(l.criado_em),
      l.obra_nome,
      l.usuario_nome ?? "",
      l.usuario_email ?? "",
      l.acao === "PDF" ? "PDF gerado" : "Enviado por e-mail",
      l.tipo === "montagem" ? `Montagem${l.montagem_nome ? ": " + l.montagem_nome : ""}` : "Relatório simples",
      l.filtro_resumo ?? "",
      l.folha ?? "",
      l.paginas ?? "",
      l.pct_obra != null ? Math.round(Number(l.pct_obra)) + "%" : "",
      l.com_resumo ? "Sim" : "Não",
      (l.destinatarios ?? []).join(", "),
      l.situacao ?? "",
      l.erro ?? "",
    ]);
    const csv = [cab, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorios-gerados-andamento.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function reenviar(corpo: CorpoEmail): Promise<RespostaRelatorio> {
    const r = await fetch("/api/andamento-novo/relatorio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "reenviar", logId: reenviando!.id, email: corpo }) });
    const j = (await r.json()) as RespostaRelatorio;
    if (j.ok) router.refresh();
    return j;
  }

  const campo = "border border-border rounded-md px-2 py-1.5 text-sm bg-white";
  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <h2 className="font-semibold text-primaryDark mr-2">Relatórios gerados</h2>
        <Link href={`/andamento-novo/relatorios-gerados?obra=${obraId}${todas ? "" : "&todas=1"}`} className="text-xs underline text-primary">
          {todas ? `Só ${obraNome}` : "Todas as obras"}
        </Link>
        <label className="text-xs text-ink-500">
          Pessoa
          <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} className={`${campo} block`}>
            <option value="">Todas</option>
            {pessoas.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-500">
          Ação
          <select value={acao} onChange={(e) => setAcao(e.target.value as "" | "PDF" | "EMAIL")} className={`${campo} block`}>
            <option value="">PDF e e-mail</option>
            <option value="PDF">PDF gerado</option>
            <option value="EMAIL">Enviado por e-mail</option>
          </select>
        </label>
        <label className="text-xs text-ink-500">
          De
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={`${campo} block`} />
        </label>
        <label className="text-xs text-ink-500">
          Até
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={`${campo} block`} />
        </label>
        <button onClick={exportarCSV} className="ml-auto flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm bg-white">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase text-ink-400 border-b border-border">
              {["Data/hora", "Obra", "Quem gerou", "Ação", "Tipo", "Folha", "Páginas", "Destinatários", "Situação", "PDF"].map((h) => (
                <th key={h} className="py-1.5 pr-3 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={10} className="py-6 text-center text-ink-500">
                  Nenhum relatório registrado com estes filtros.
                </td>
              </tr>
            )}
            {filtradas.map((l) => (
              <tr key={l.id} className="border-b border-border/60 align-top">
                <td className="py-2 pr-3 whitespace-nowrap">{fmtDataHora(l.criado_em)}</td>
                <td className="py-2 pr-3">{l.obra_nome}</td>
                <td className="py-2 pr-3">
                  {l.usuario_nome ?? "—"}
                  {l.usuario_email && <div className="text-[11px] text-ink-500">{l.usuario_email}</div>}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">{l.acao === "PDF" ? "PDF gerado" : "Enviado por e-mail"}</td>
                <td className="py-2 pr-3">
                  {l.tipo === "montagem" ? `Montagem${l.montagem_nome ? ": " + l.montagem_nome : ""}` : "Relatório simples"}
                  <div className="text-[11px] text-ink-500">
                    {l.filtro_resumo}
                    {l.pct_obra != null ? ` · obra ${Math.round(Number(l.pct_obra))}%` : ""}
                    {l.com_resumo ? " · com resumo" : ""}
                  </div>
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">{l.folha ?? "—"}</td>
                <td className="py-2 pr-3 text-right">{l.paginas ?? "—"}</td>
                <td className="py-2 pr-3 text-xs">{(l.destinatarios ?? []).join(", ") || "—"}</td>
                <td className="py-2 pr-3">
                  {l.situacao ? (
                    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${l.situacao === "Enviado" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`} title={l.erro ?? ""}>
                      {l.situacao}
                    </span>
                  ) : (
                    "—"
                  )}
                  {l.erro && <div className="text-[11px] text-danger max-w-[220px]">{l.erro}</div>}
                </td>
                <td className="py-2 whitespace-nowrap">
                  <div className="flex gap-1.5">
                    {l.url && (
                      <a href={l.url} className="text-xs px-2 py-1 border border-border rounded-md bg-white" download>
                        Baixar PDF
                      </a>
                    )}
                    {l.acao === "EMAIL" && l.pdf_path && (
                      <button onClick={() => setReenviando(l)} className="text-xs px-2 py-1 border border-primary text-primaryDark rounded-md bg-white flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Reenviar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-ink-500">Só consulta: os registros não podem ser editados nem apagados por aqui.</p>

      {reenviando && (
        <EnviarEmail
          obraId={reenviando.obra_id}
          destinosFixos={reenviando.destinatarios ?? []}
          assuntoPadrao={reenviando.assunto ?? `Relatório de andamento – ${reenviando.obra_nome}`}
          mensagemPadrao={reenviando.mensagem ?? ""}
          anexo={{ tipo: reenviando.tipo === "montagem" ? `Montagem "${reenviando.montagem_nome ?? ""}"` : "Relatório simples", filtro: reenviando.filtro_resumo ?? "", folha: reenviando.folha ?? "", paginas: reenviando.paginas }}
          tituloBotao="Reenviar"
          onEnviar={reenviar}
          onFechar={() => setReenviando(null)}
        />
      )}
    </div>
  );
}
