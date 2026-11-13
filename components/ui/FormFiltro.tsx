"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

// Formulário de filtros que aplica sozinho ao escolher uma opção (sem botão "Filtrar").
// Só troca os parâmetros do endereço; nada é gravado.
export default function FormFiltro({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const f = ref.current;
    if (!f) return;
    const aplicar = () => {
      const dados = new FormData(f);
      const q = new URLSearchParams();
      dados.forEach((v, k) => {
        if (typeof v === "string") q.set(k, v);
      });
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    };
    f.addEventListener("filtro-mudou", aplicar);
    return () => f.removeEventListener("filtro-mudou", aplicar);
  }, [router, pathname]);

  return (
    <form ref={ref} method="get" data-filtro-auto className={className}>
      {children}
    </form>
  );
}
