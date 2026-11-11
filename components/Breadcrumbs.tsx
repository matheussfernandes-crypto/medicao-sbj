"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS, SECOES, itemDaRota } from "./nav-items";

export default function Breadcrumbs() {
  const pathname = usePathname();

  const atual = itemDaRota(NAV_ITEMS, pathname);
  // o setor acompanha a tela aberta: o setor do menu e, quando o grupo tem outro nome, o grupo (ex.: Pós-obra · Pós-venda)
  const secao = atual && atual.secao !== "inicio" ? SECOES.find((s) => s.id === atual.secao)?.label : null;
  const setor = secao ? (atual!.grupo && atual!.grupo !== secao ? `${secao} · ${atual!.grupo}` : secao) : "Engenharia SBJ";

  return (
    <div className="min-w-0">
      <p className="text-xs text-ink-400">{setor}</p>
      <h1 className="text-sm font-semibold text-ink-900 truncate">{atual?.label ?? "Painel"}</h1>
    </div>
  );
}
