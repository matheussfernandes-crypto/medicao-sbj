"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight } from "lucide-react";

// Registro rápido da página inicial: a pessoa escreve o que precisa e o sistema leva para a tela certa,
// já com o texto preenchido. Regras simples (sem IA paga), uma por setor.
type Destino = { chave?: string; href: string; teste: RegExp; nome: string };

const DESTINOS: Destino[] = [
  // Pós-venda: chamado de manutenção (problema + unidade)
  {
    nome: "chamado do pós-venda",
    chave: "posvenda-texto",
    href: "/posvenda/inicio",
    teste: /(infiltra|vazament|goteira|trinca|fissura|rachadura|umidade|mofo|bolor|porta|janela|tomada|disjuntor|l[aâ]mpada|torneira|chuveiro|vaso|descarga|ralo|entupi|azulejo|cer[aâ]mica|rejunte|pintura|reboco|piso|esquadria|vidro|sacada|soleira|problema|conserto|reparo|chamado|garantia|manuten)/i,
  },
  // Pós-venda: vistoria de entrega
  { nome: "vistoria de entrega", href: "/posobra/vistorias", teste: /(vistoria|entrega de chave|entrega da unidade|termo de entrega)/i },
  // Medições
  { nome: "medição", chave: "registro-medicao", href: "/contratos/medicoes", teste: /(medi[cç][aã]o|medir|reten[cç][aã]o|empreiteir|empreitada|contrato)/i },
  // Vales e lançamentos
  { nome: "lançamento", href: "/lancamentos", teste: /(vale|lan[cç]amento|lan[cç]ar|adiantamento)/i },
  // Fechamento
  { nome: "fechamento", href: "/contratos/fechamento", teste: /(fechamento|fechar o m[eê]s)/i },
  // Andamento de obra
  { nome: "andamento da obra", href: "/andamento-obra", teste: /(andamento|cronograma|progresso|etapa|foto da obra)/i },
  // Fornecedores, clientes, empreendimentos
  { nome: "cadastros do pós-venda", href: "/posvenda/cadastros", teste: /(fornecedor|cadastr|cliente|propriet[aá]rio|empreendimento)/i },
];

export default function RegistroRapido() {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [dica, setDica] = useState<string | null>(null);

  function entender() {
    const t = texto.trim();
    if (!t) return;
    // número de unidade sozinho (ex.: "703 Campeche") também é chamado
    const destino = DESTINOS.find((d) => d.teste.test(t)) ?? (/\b\d{3,4}\b/.test(t) ? DESTINOS[0] : null);
    if (!destino) {
      setDica("Não entendi para onde levar. Tente com mais detalhes, por exemplo: “infiltração 703 Campeche” ou “medição do empreiteiro João”.");
      return;
    }
    if (destino.chave) {
      try {
        sessionStorage.setItem(destino.chave, t);
      } catch {}
    }
    setDica(`Abrindo ${destino.nome}…`);
    router.push(destino.href);
  }

  return (
    <div className="space-y-1.5">
    <form
      onSubmit={(e) => {
        e.preventDefault();
        entender();
      }}
      className="card !p-2 !pl-4 flex items-center gap-3 focus-within:ring-2 focus-within:ring-primary/20 transition-shadow"
    >
      <Sparkles className="w-5 h-5 text-primary shrink-0" aria-hidden />
      <input
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setDica(null);
        }}
        aria-label="Registro rápido"
        placeholder="O que você precisa? Ex.: infiltração 703 Campeche · medição do empreiteiro João"
        className="flex-1 min-w-0 bg-transparent py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
      />
      <button type="submit" disabled={!texto.trim()} className="btn primary sm shrink-0 inline-flex items-center gap-1">
        Ir <ArrowRight className="w-4 h-4" />
      </button>
    </form>
      {dica && <p role="status" className="text-sm text-ink-500 px-1">{dica}</p>}
    </div>
  );
}
