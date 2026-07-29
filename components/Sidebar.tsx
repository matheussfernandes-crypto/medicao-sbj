"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { navItemsForSetor } from "./nav-items";

const SETOR_LABEL: Record<string, string> = {
  ESTAGIARIO: "Estagiário",
  ADMIN: "Engenheiro / ADM",
  RH: "RH",
  FINANCEIRO: "Financeiro",
};

export default function Sidebar({
  setor,
  mobileOpen,
  onClose,
}: {
  setor: string | null;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const items = navItemsForSetor(setor);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={
          "fixed inset-y-0 left-0 z-40 w-sidebar bg-primaryDark flex flex-col transition-transform duration-200 ease-out " +
          "lg:static lg:translate-x-0 lg:shrink-0 " +
          (mobileOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="flex items-center justify-between gap-2 px-4 h-16 shrink-0 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <img src="/logo-topbar.png" alt="SBJ" className="h-8 w-auto shrink-0" />
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold leading-tight truncate">Medição SBJ</p>
              {setor && (
                <p className="text-white/50 text-[11px] leading-tight truncate">{SETOR_LABEL[setor] ?? setor}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden text-white/70 hover:text-white p-1"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <p className="nav-group-label">Navegação</p>
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={"nav-item" + (active ? " active" : "")}
                title={item.description}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
