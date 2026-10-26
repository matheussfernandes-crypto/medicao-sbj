"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BarChart3, Camera, FileText, History, LayoutGrid, Settings } from "lucide-react";

const ABAS = [
  { href: "/andamento-novo", label: "Andamento", icon: LayoutGrid },
  { href: "/andamento-novo/config", label: "Pavimentos e serviços", icon: Settings },
  { href: "/andamento-novo/relatorio", label: "Relatório", icon: BarChart3 },
  { href: "/andamento-novo/relatorios-gerados", label: "Relatórios gerados", icon: FileText },
  { href: "/andamento-novo/historico", label: "Histórico", icon: History },
  { href: "/andamento-novo/fotos", label: "Fotos", icon: Camera },
];

export default function AbasNovo() {
  const path = usePathname();
  const obra = useSearchParams().get("obra");
  const q = obra ? `?obra=${obra}` : "";
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {ABAS.map((a) => {
        const Icon = a.icon;
        const ativa = a.href === "/andamento-novo" ? path === a.href : a.href === "/andamento-novo/relatorio" ? path === a.href : path.startsWith(a.href);
        return (
          <Link
            key={a.href}
            href={a.href + q}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${
              ativa ? "bg-primaryDark text-white border-primaryDark" : "bg-white border-border text-ink-700 hover:bg-surface-subtle"
            }`}
          >
            <Icon className="w-4 h-4" />
            {a.label}
          </Link>
        );
      })}
    </div>
  );
}