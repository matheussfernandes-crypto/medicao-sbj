"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

// Registro rápido da página inicial: a pessoa escreve o que precisa e o sistema leva para a tela certa.
// Regras simples, sem IA paga: chamados do pós-venda (infiltração, vazamento, unidade...) e medições.
const PALAVRAS_CHAMADO = /(infiltra|vazament|trinca|fissura|umidade|mofo|porta|janela|tomada|lâmpada|lampada|torneira|vaso|ralo|azulejo|pintura|reboco|piso|esquadria|vidro|sacada|soleira|problema|conserto|reparo|chamado)/i;
const PALAVRAS_MEDICAO = /(medi[cç][aã]o|vale|retenção|retencao|fechamento|lançamento|lancamento|empreiteiro)/i;

export default function RegistroRapido() {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [dica, setDica] = useState<string | null>(null);

  function entender() {
    const t = texto.trim();
    if (!t) return;
    if (PALAVRAS_MEDICAO.test(t) && !PALAVRAS_CHAMADO.test(t)) {
      try {
        sessionStorage.setItem("registro-medicao", t);
      } catch {}
      router.push("/contratos/medicoes");
      return;
    }
    if (PALAVRAS_CHAMADO.test(t) || /\b\d{3,4}\b/.test(t)) {
      try {
        sessionStorage.setItem("posvenda-texto", t);
      } catch {}
      router.push("/posvenda/inicio");
      return;
    }
    setDica("Não entendi se é um chamado do pós-venda ou uma medição. Escreva com mais detalhes, por exemplo: “infiltração 703 Campeche”.");
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2 text-primaryDark font-semibold">
        <Sparkles className="w-4 h-4" />
        Registro rápido
      </div>
      <textarea
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setDica(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) entender();
        }}
        rows={2}
        placeholder="Ex.: infiltração 703 Campeche, ou iniciar medição do empreiteiro João"
        className="w-full rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink-500">Escreva o que precisa e leve para a tela certa.</span>
        <button type="button" onClick={entender} disabled={!texto.trim()} className="btn primary sm">
          Entender
        </button>
      </div>
      {dica && <p className="text-sm text-warning">{dica}</p>}
    </div>
  );
}
