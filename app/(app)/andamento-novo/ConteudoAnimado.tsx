"use client";

import { usePathname } from "next/navigation";

// ao trocar de aba o conteúdo entra suave (padrão do pós-obra)
export default function ConteudoAnimado({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div key={path} className="sbj-conteudo">
      {children}
    </div>
  );
}
