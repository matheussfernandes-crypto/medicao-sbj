"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// O Pós-venda (public/posvenda) abre aqui dentro, sem menu próprio: a troca de tela vem do menu
// do site (/posvenda/<tela>). O quadro fica aberto e só muda de tela, sem recarregar.
const TELAS = ["inicio", "chamados", "agenda", "painel", "relatorios", "cadastros"];
const telaDe = (caminho: string) => {
  const t = caminho.split("/")[2] ?? "";
  return TELAS.includes(t) ? t : "inicio";
};

type JanelaModulo = Window & { go?: (v: string) => void };

export default function PosVendaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const quadro = useRef<HTMLIFrameElement>(null);
  const inicial = useRef(telaDe(pathname));
  const tela = telaDe(pathname);

  // modo claro/escuro: o kit acompanha o tema do site
  useEffect(() => {
    const aplica = (escuro: boolean) => {
      try { quadro.current?.contentDocument?.documentElement.setAttribute("data-theme", escuro ? "dark" : "light"); } catch {}
    };
    const aoMudar = (e: Event) => aplica((e as CustomEvent).detail?.escuro === true);
    window.addEventListener("sbj-tema", aoMudar);
    return () => window.removeEventListener("sbj-tema", aoMudar);
  }, []);

  useEffect(() => {
    const w = quadro.current?.contentWindow as JanelaModulo | null | undefined;
    try {
      if (w && typeof w.go === "function" && w.location.hash !== "#" + tela) w.go(tela);
    } catch {}
  }, [tela]);

  return (
    <div className="-m-4 lg:-m-8 print:m-0">
      <iframe
        ref={quadro}
        src={"/posvenda/index.html#" + inicial.current}
        title="Pós-venda"
        className="block w-full border-0"
        style={{ height: "calc(100dvh - 4rem)" }}
        allow="microphone"
      />
      {children}
    </div>
  );
}
