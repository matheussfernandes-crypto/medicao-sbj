"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { BarChart3, Camera, FileText, History, LayoutGrid, Settings } from "lucide-react";

const ABAS = [
  { href: "/andamento-novo", label: "Andamento", icon: LayoutGrid },
  { href: "/andamento-novo/config", label: "Pavimentos e serviços", icon: Settings },
  { href: "/andamento-novo/relatorio", label: "Relatório", icon: BarChart3 },
  { href: "/andamento-novo/relatorios-gerados", label: "Relatórios gerados", icon: FileText },
  { href: "/andamento-novo/historico", label: "Histórico", icon: History },
  { href: "/andamento-novo/fotos", label: "Fotos", icon: Camera },
];

const ehAtiva = (href: string, path: string) => (href === "/andamento-novo" || href === "/andamento-novo/relatorio" ? path === href : path.startsWith(href));

// abas no padrão do pós-obra: um marcador desliza até a aba escolhida
export default function AbasNovo() {
  const path = usePathname();
  const obra = useSearchParams().get("obra");
  const q = obra ? `?obra=${obra}` : "";
  const [clicada, setClicada] = useState<string | null>(null); // marca na hora do clique, antes da página trocar
  const ativaHref = clicada ?? ABAS.find((a) => ehAtiva(a.href, path))?.href ?? null;
  const caixa = useRef<HTMLDivElement>(null);
  const [marca, setMarca] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [pronta, setPronta] = useState(false);

  useLayoutEffect(() => setClicada(null), [path]);

  useLayoutEffect(() => {
    const medir = () => {
      const el = caixa.current?.querySelector<HTMLElement>(`[data-href="${ativaHref}"]`);
      if (!el) return setMarca(null);
      setMarca({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
    };
    medir();
    const ro = new ResizeObserver(medir);
    if (caixa.current) ro.observe(caixa.current);
    return () => ro.disconnect();
  }, [ativaHref]);

  // a primeira posição aparece sem deslizar
  useLayoutEffect(() => {
    if (marca && !pronta) requestAnimationFrame(() => setPronta(true));
  }, [marca, pronta]);

  return (
    <div ref={caixa} className={`sbj-abas print:hidden ${marca ? "" : "sem-marca"}`}>
      {marca && <span aria-hidden className="sbj-abas-marca" style={{ ...marca, transition: pronta ? undefined : "none" }} />}
      {ABAS.map((a) => {
        const Icon = a.icon;
        const ativa = a.href === ativaHref;
        return (
          <Link key={a.href} data-href={a.href} href={a.href + q} onClick={() => setClicada(a.href)} aria-current={ativa ? "page" : undefined} className={`sbj-aba ${ativa ? "ativa" : ""}`}>
            <Icon className="w-4 h-4" />
            {a.label}
          </Link>
        );
      })}
    </div>
  );
}
