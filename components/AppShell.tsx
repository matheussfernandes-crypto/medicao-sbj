"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Bell } from "lucide-react";
import Sidebar from "./Sidebar";
import Breadcrumbs from "./Breadcrumbs";
import { sair } from "@/app/auth-actions";

export default function AppShell({
  setor,
  nome,
  naoLidas,
  children,
}: {
  setor: string | null;
  nome: string | null;
  naoLidas: number;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar setor={setor} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <header className="h-16 shrink-0 bg-white border-b border-border flex items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-ink-700 hover:text-primary p-2 -ml-2"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Breadcrumbs />
          </div>

          <div className="flex items-center gap-4 text-sm shrink-0">
            <Link
              href="/notificacoes"
              className="relative text-ink-700 hover:text-primary transition-colors p-1"
              title={naoLidas > 0 ? `${naoLidas} notificação${naoLidas > 1 ? "ões" : ""} não lida${naoLidas > 1 ? "s" : ""}` : "Notificações"}
            >
              <Bell className="w-5 h-5" />
              {naoLidas > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1 leading-none">
                  {naoLidas > 99 ? "99+" : naoLidas}
                </span>
              )}
            </Link>

            {nome && (
              <Link href="/perfil" className="hidden sm:inline text-ink-700 hover:text-primary" title="Editar meu cadastro">
                {nome}
              </Link>
            )}

            <form action={sair}>
              <button type="submit" className="text-ink-500 hover:text-danger">
                Sair
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 space-y-4">{children}</main>
      </div>
    </div>
  );
}
