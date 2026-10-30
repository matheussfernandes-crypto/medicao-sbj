"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS, itemDaRota } from "./nav-items";

export default function Breadcrumbs() {
  const pathname = usePathname();

  const atual = itemDaRota(NAV_ITEMS, pathname);

  return (
    <div className="min-w-0">
      <p className="text-xs text-ink-400">Engenharia SBJ</p>
      <h1 className="text-sm font-semibold text-ink-900 truncate">{atual?.label ?? "Painel"}</h1>
    </div>
  );
}
