"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// O módulo Pós-obra (public/pos-obra) abre aqui dentro, no espaço de conteúdo do site:
// o menu e o topo continuam os do site. O menu próprio do módulo fica escondido e a troca
// de tela vem do menu do site (/posobra/<tela>). O módulo não é alterado: só recebe um estilo extra.
const TELAS: Record<string, string> = {
  vistorias: "vistorias",
  empreendimentos: "buildings",
  clientes: "clients",
  fornecedores: "suppliers",
};

const ESTILO_EMBUTIDO = `
  .sidebar, .mn-hamb, .mnav, .mn-backdrop { display: none !important; }
  .app { display: block !important; }
  .main { margin-left: 0 !important; padding-bottom: 0 !important; min-height: 100vh; }
`;

type JanelaModulo = Window & { showView?: (v: string) => void };

export default function PosObraLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const quadro = useRef<HTMLIFrameElement>(null);
  const pronto = useRef(false);
  const tela = TELAS[pathname.split("/")[2] ?? ""] ?? "vistorias";

  const irPara = (view: string) => {
    const w = quadro.current?.contentWindow as JanelaModulo | null | undefined;
    if (!w || typeof w.showView !== "function") return;
    const ativa = w.document.querySelector(".view.active");
    if (ativa && ativa.id === `view-${view}`) return;
    w.showView(view);
    w.scrollTo({ top: 0 });
  };

  const aoCarregar = () => {
    const doc = quadro.current?.contentDocument;
    if (!doc) return;
    if (!doc.getElementById("sbj-embutido")) {
      const s = doc.createElement("style");
      s.id = "sbj-embutido";
      s.textContent = ESTILO_EMBUTIDO;
      doc.head.appendChild(s);
    }
    // o módulo reabre a última tela usada logo após carregar; depois disso vale a tela do menu do site
    setTimeout(() => {
      pronto.current = true;
      irPara(TELAS[window.location.pathname.split("/")[2] ?? ""] ?? "vistorias");
    }, 700);
  };

  // se o quadro terminou de carregar antes do React ligar o onLoad
  useEffect(() => {
    const doc = quadro.current?.contentDocument;
    if (doc && doc.readyState === "complete" && doc.querySelector(".sidebar")) aoCarregar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pronto.current) irPara(tela);
  }, [tela]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="-m-4 lg:-m-8 print:m-0">
      <iframe
        ref={quadro}
        src="/pos-obra/"
        title="Pós-obra"
        onLoad={aoCarregar}
        className="block w-full border-0 bg-white"
        style={{ height: "calc(100dvh - 4rem)" }}
      />
      {children}
    </div>
  );
}
