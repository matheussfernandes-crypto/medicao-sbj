"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Plus, X } from "lucide-react";
import type { CorpoEmail, RespostaRelatorio } from "./tiposApi";

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const LIMITE_DESTINATARIOS = 10;

export type AnexoResumo = { obra?: string; tipo: string; filtro: string; folha: string; paginas: number | null };

// Janela "Gerar e enviar por e-mail": começa com 1 destinatário e cresce com o "+" (até 10), assunto e mensagem editáveis, resumo dos anexos.
// Com várias obras, os destinatários padrão das obras escolhidas são juntados (sem repetir endereço).
export default function EnviarEmail({
  obras,
  assuntoPadrao,
  mensagemPadrao,
  anexos,
  onEnviar,
  onFechar,
  tituloBotao = "Gerar e enviar",
  destinosFixos,
  progresso,
}: {
  obras: { id: string; nome: string }[]; // obras do envio (uma ou várias)
  assuntoPadrao: string;
  mensagemPadrao: string;
  anexos: AnexoResumo[];
  onEnviar: (e: CorpoEmail) => Promise<RespostaRelatorio>;
  onFechar: () => void;
  tituloBotao?: string;
  destinosFixos?: string[]; // reenvio: já vem com os mesmos destinatários
  progresso?: React.ReactNode; // andamento do lote, mostrado enquanto gera e envia
}) {
  const [dest, setDest] = useState<string[]>(destinosFixos && destinosFixos.length ? [...destinosFixos].slice(0, LIMITE_DESTINATARIOS) : [""]);
  const [vindosDe, setVindosDe] = useState<string[]>([]);
  const [assunto, setAssunto] = useState(assuntoPadrao);
  const [mensagem, setMensagem] = useState(mensagemPadrao);
  const [salvarPadrao, setSalvarPadrao] = useState(false);
  const [estado, setEstado] = useState<"edit" | "enviando" | "ok" | "erro">("edit");
  const [msg, setMsg] = useState<string | null>(null);
  const varias = obras.length > 1;
  const chaveObras = obras.map((o) => o.id).join(",");

  // vêm preenchidos com os destinatários padrão (ou os últimos usados) das obras escolhidas, sem repetir endereço
  useEffect(() => {
    if (destinosFixos) return;
    let vivo = true;
    Promise.all(
      obras.map((o) =>
        fetch(`/api/andamento-novo/relatorio?obra=${encodeURIComponent(o.id)}`)
          .then((r) => r.json())
          .then((d) => ({ nome: o.nome, lista: d?.ok ? (d.destinatarios as string[]) : [] }))
          .catch(() => ({ nome: o.nome, lista: [] as string[] }))
      )
    ).then((rs) => {
      if (!vivo) return;
      const vistos = new Set<string>();
      const uniao: string[] = [];
      const origens: string[] = [];
      rs.forEach((r) => {
        let trouxe = false;
        r.lista.forEach((e) => {
          const k = e.trim().toLowerCase();
          if (k && !vistos.has(k)) {
            vistos.add(k);
            uniao.push(e.trim());
            trouxe = true;
          }
        });
        if (trouxe) origens.push(r.nome);
      });
      setDest(uniao.length ? uniao.slice(0, LIMITE_DESTINATARIOS) : [""]);
      setVindosDe(origens);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveObras, destinosFixos]);

  const lista = dest.map((x) => x.trim()).filter(Boolean);
  const invalido = dest.map((x) => x.trim() !== "" && !EMAIL_OK.test(x.trim()));
  const repetido = new Set(lista.map((x) => x.toLowerCase())).size !== lista.length;
  const erroForm = !lista.length ? "Informe pelo menos 1 destinatário." : invalido.some(Boolean) ? "Há e-mail com formato inválido." : repetido ? "Há destinatários repetidos." : !assunto.trim() ? "Informe o assunto." : null;
  const noLimite = dest.length >= LIMITE_DESTINATARIOS;

  async function enviar() {
    if (erroForm) return;
    setEstado("enviando");
    setMsg(null);
    try {
      const r = await onEnviar({ destinatarios: lista, assunto, mensagem, salvarPadrao });
      if (r.ok) {
        setEstado("ok");
        setMsg(`${varias ? "Relatórios enviados" : "Relatório enviado"} para ${lista.length} destinatário${lista.length === 1 ? "" : "s"}.${r.porLink ? " Os PDFs eram grandes demais e foram enviados como link." : ""}`);
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
            <div className="text-[11px] uppercase text-ink-500 mb-1">Destinatários (até {LIMITE_DESTINATARIOS})</div>
            <div className="space-y-2">
              {dest.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="email"
                    value={v}
                    placeholder={i === 0 ? "E-mail (obrigatório)" : "E-mail"}
                    onChange={(e) => setDest((d) => d.map((x, k) => (k === i ? e.target.value : x)))}
                    className={`${campo} ${invalido[i] ? "border-danger" : ""}`}
                    aria-label={`Destinatário ${i + 1}`}
                  />
                  {i > 0 && (
                    <button type="button" onClick={() => setDest((d) => d.filter((_, k) => k !== i))} aria-label={`Tirar o destinatário ${i + 1}`} className="p-1.5 text-danger border border-border rounded-md bg-white">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <button type="button" disabled={noLimite} onClick={() => setDest((d) => [...d, ""])} className="text-sm px-3 py-1.5 border border-border rounded-md bg-white flex items-center gap-1.5 disabled:opacity-50">
                <Plus className="w-4 h-4" /> Adicionar destinatário
              </button>
              {noLimite && <span className="text-xs text-ink-500">Máximo de {LIMITE_DESTINATARIOS} destinatários</span>}
            </div>
            {varias && vindosDe.length > 0 && !destinosFixos && <p className="text-[11px] text-ink-500 mt-1.5">vindos de: {vindosDe.join(", ")}</p>}
            {!destinosFixos && (
              <label className="flex items-center gap-2 text-xs text-ink-700 mt-2">
                <input type="checkbox" checked={salvarPadrao} onChange={(e) => setSalvarPadrao(e.target.checked)} />
                {varias ? "Salvar como destinatários padrão destas obras" : "Salvar como destinatários padrão desta obra"}
              </label>
            )}
          </div>
          <label className="block text-xs text-ink-500">
            Assunto
            <input value={assunto} onChange={(e) => setAssunto(e.target.value)} className={campo} />
          </label>
          <label className="block text-xs text-ink-500">
            Mensagem
            <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={varias ? 6 : 4} className={campo} />
          </label>
        </fieldset>

        <div className="rounded-lg bg-surface-subtle border border-border px-3 py-2 text-xs text-ink-700 space-y-0.5">
          <b>No anexo (PDF):</b>
          {anexos.map((a, i) => (
            <div key={i}>
              {a.obra ? `${a.obra} · ` : ""}
              {a.tipo} · {a.filtro ? `${a.filtro} · ` : ""}
              {a.folha}
              {a.paginas ? ` · ${a.paginas} página${a.paginas === 1 ? "" : "s"}` : ""}
            </div>
          ))}
        </div>

        {estado === "enviando" && (progresso ?? (
          <p className="text-sm text-primaryDark flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Gerando e enviando…
          </p>
        ))}
        {estado !== "enviando" && estado !== "edit" && progresso}
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
