"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, X } from "lucide-react";
import type { CorpoEmail, RespostaRelatorio } from "./tiposApi";

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Janela "Gerar e enviar por e-mail": 4 destinatários (como no fechamento mensal), assunto e mensagem editáveis, resumo do anexo.
export default function EnviarEmail({
  obraId,
  assuntoPadrao,
  mensagemPadrao,
  anexo,
  onEnviar,
  onFechar,
  tituloBotao = "Gerar e enviar",
  destinosFixos,
}: {
  obraId: string;
  assuntoPadrao: string;
  mensagemPadrao: string;
  anexo: { tipo: string; filtro: string; folha: string; paginas: number | null };
  onEnviar: (e: CorpoEmail) => Promise<RespostaRelatorio>;
  onFechar: () => void;
  tituloBotao?: string;
  destinosFixos?: string[]; // reenvio: já vem com os mesmos destinatários
}) {
  const [dest, setDest] = useState<string[]>(destinosFixos ? [...destinosFixos, "", "", "", ""].slice(0, 4) : ["", "", "", ""]);
  const [assunto, setAssunto] = useState(assuntoPadrao);
  const [mensagem, setMensagem] = useState(mensagemPadrao);
  const [salvarPadrao, setSalvarPadrao] = useState(false);
  const [estado, setEstado] = useState<"edit" | "enviando" | "ok" | "erro">("edit");
  const [msg, setMsg] = useState<string | null>(null);

  // vêm preenchidos com os destinatários padrão da obra ou, se não houver, os últimos usados nela
  useEffect(() => {
    if (destinosFixos) return;
    let vivo = true;
    fetch(`/api/andamento-novo/relatorio?obra=${encodeURIComponent(obraId)}`)
      .then((r) => r.json())
      .then((d) => vivo && d?.ok && setDest([...(d.destinatarios as string[]), "", "", "", ""].slice(0, 4)))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [obraId, destinosFixos]);

  const lista = dest.map((x) => x.trim()).filter(Boolean);
  const invalido = dest.map((x) => x.trim() !== "" && !EMAIL_OK.test(x.trim()));
  const repetido = new Set(lista.map((x) => x.toLowerCase())).size !== lista.length;
  const erroForm = !lista.length ? "Informe pelo menos 1 destinatário." : invalido.some(Boolean) ? "Há e-mail com formato inválido." : repetido ? "Há destinatários repetidos." : !assunto.trim() ? "Informe o assunto." : null;

  async function enviar() {
    if (erroForm) return;
    setEstado("enviando");
    setMsg(null);
    try {
      const r = await onEnviar({ destinatarios: lista, assunto, mensagem, salvarPadrao });
      if (r.ok) {
        setEstado("ok");
        setMsg(`Relatório enviado para ${lista.length} destinatário${lista.length === 1 ? "" : "s"}.${r.porLink ? " O PDF era grande demais e foi enviado como link." : ""}`);
      } else {
        setEstado("erro");
        setMsg(r.erro ?? "Não foi possível enviar.");
      }
    } catch (e: any) {
      setEstado("erro");
      setMsg(`Não foi possível enviar: ${e?.message ?? "erro de conexão"}`);
    }
  }

  const campo = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-white";
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-auto print:hidden" role="dialog" aria-modal="true" aria-label="Enviar relatório por e-mail">
      <div className="bg-white rounded-xl shadow-panel w-full max-w-xl mt-10 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-primaryDark flex-1">Enviar relatório por e-mail</h2>
          <button onClick={onFechar} aria-label="Fechar" className="p-1 text-ink-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <fieldset disabled={estado === "enviando"} className="space-y-3">
          <div>
            <div className="text-[11px] uppercase text-ink-500 mb-1">Destinatários (até 4)</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {dest.map((v, i) => (
                <input
                  key={i}
                  type="email"
                  value={v}
                  placeholder={`E-mail ${i + 1}${i === 0 ? " (obrigatório)" : ""}`}
                  onChange={(e) => setDest((d) => d.map((x, k) => (k === i ? e.target.value : x)))}
                  className={`${campo} ${invalido[i] ? "border-danger" : ""}`}
                  aria-label={`Destinatário ${i + 1}`}
                />
              ))}
            </div>
            {!destinosFixos && (
              <label className="flex items-center gap-2 text-xs text-ink-700 mt-2">
                <input type="checkbox" checked={salvarPadrao} onChange={(e) => setSalvarPadrao(e.target.checked)} />
                Salvar como destinatários padrão desta obra
              </label>
            )}
          </div>
          <label className="block text-xs text-ink-500">
            Assunto
            <input value={assunto} onChange={(e) => setAssunto(e.target.value)} className={campo} />
          </label>
          <label className="block text-xs text-ink-500">
            Mensagem
            <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={4} className={campo} />
          </label>
        </fieldset>

        <div className="rounded-lg bg-surface-subtle border border-border px-3 py-2 text-xs text-ink-700">
          <b>No anexo (PDF):</b> {anexo.tipo} · {anexo.filtro} · folha {anexo.folha}
          {anexo.paginas ? ` · ${anexo.paginas} página${anexo.paginas === 1 ? "" : "s"}` : ""}
        </div>

        {estado === "enviando" && (
          <p className="text-sm text-primaryDark flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Gerando e enviando…
          </p>
        )}
        {estado === "ok" && <p className="text-sm rounded-lg border px-3 py-2" style={{ background: "#e1f3e6", borderColor: "#b7dfc3", color: "#1c7440" }}>{msg}</p>}
        {estado === "erro" && <p className="text-sm text-danger rounded-lg border border-danger/40 bg-danger/5 px-3 py-2">{msg}</p>}
        {estado === "edit" && erroForm && lista.length + (assunto ? 1 : 0) > 0 && <p className="text-xs text-danger">{erroForm}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button className="text-sm px-3 py-1.5 border border-border rounded-md bg-white" onClick={onFechar} disabled={estado === "enviando"}>
            {estado === "ok" ? "Fechar" : "Cancelar"}
          </button>
          {estado !== "ok" && (
            <button className="text-sm px-4 py-1.5 rounded-md bg-primary text-white font-semibold disabled:opacity-50" disabled={estado === "enviando" || !!erroForm} onClick={enviar}>
              {estado === "erro" ? "Tentar de novo" : tituloBotao}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
