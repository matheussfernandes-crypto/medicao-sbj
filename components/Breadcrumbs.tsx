"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";

export default function Breadcrumbs() {
  const pathname = usePathname();

  const atual =
    NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(item.href + "/")) ?? null;

  return (
    <div className="min-w-0">
      <p className="text-xs text-ink-400">Medição SBJ</p>
      <h1 className="text-sm font-semibold text-ink-900 truncate">{atual?.label ?? "Painel"}</h1>
    </div>
  );
}
