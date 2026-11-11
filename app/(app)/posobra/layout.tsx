"use client";

import { useEffect, useRef, useState } from "react";
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

const ESTILO_TEMA_ESCURO = `
  html[data-tema="dark"] { --bg: #0e1517; --surface: #152023; --text: #e4eef0; --text-muted: #93a7ac; --border: #2a3a3f; color-scheme: dark; }
  html[data-tema="dark"] body { background: #0e1517; color: #e4eef0; }
  html[data-tema="dark"] .card, html[data-tema="dark"] .panel, html[data-tema="dark"] .modal, html[data-tema="dark"] .kpi-card, html[data-tema="dark"] .btn.ghost, html[data-tema="dark"] .topbar, html[data-tema="dark"] .sidebar, html[data-tema="dark"] .modal-header, html[data-tema="dark"] .modal-footer { background: #152023 !important; color: #e4eef0; }
  html[data-tema="dark"] input, html[data-tema="dark"] select, html[data-tema="dark"] textarea { background: #0e1517; color: #e4eef0; border-color: #2a3a3f; }
`;

type JanelaModulo = Window & { showView?: (v: string) => void };

export default function PosObraLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const quadro = useRef<HTMLIFrameElement>(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisivel(true), 4000);
    return () => clearTimeout(t);
  }, []);
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

  // modo claro/escuro: o módulo acompanha o tema do site
  const aplicaTema = (escuro: boolean) => {
    const doc = quadro.current?.contentDocument;
    if (!doc) return;
    if (!doc.getElementById("sbj-tema-escuro")) {
      const s = doc.createElement("style");
      s.id = "sbj-tema-escuro";
      s.textContent = ESTILO_TEMA_ESCURO;
      doc.head.appendChild(s);
    }
    doc.documentElement.setAttribute("data-tema", escuro ? "dark" : "light");
  };
  useEffect(() => {
    const aoMudar = (e: Event) => aplicaTema((e as CustomEvent).detail?.escuro === true);
    window.addEventListener("sbj-tema", aoMudar);
    return () => window.removeEventListener("sbj-tema", aoMudar);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const aoCarregar = () => {
    const doc = quadro.current?.contentDocument;
    if (!doc) return;
    if (!doc.getElementById("sbj-embutido")) {
      const s = doc.createElement("style");
      s.id = "sbj-embutido";
      s.textContent = ESTILO_EMBUTIDO;
      doc.head.appendChild(s);
    }
    aplicaTema(document.documentElement.classList.contains("dark"));
    // o módulo reabre a última tela usada logo após carregar; depois disso vale a tela do menu do site
    setTimeout(() => {
      pronto.current = true;
      setVisivel(true);
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
    <div className="relative -m-4 lg:-m-8 print:m-0">
      <div aria-hidden="true" className={"cobertura-modulo absolute inset-0 z-10 transition-opacity duration-300 " + (visivel ? "opacity-0 pointer-events-none" : "opacity-100")} />
      <iframe
        ref={quadro}
        src="/pos-obra/"
        title="Vistorias e entrega"
        onLoad={aoCarregar}
        className="block w-full border-0 bg-white"
        style={{ height: "calc(100dvh - 4rem)" }}
      />
      {children}
    </div>
  );
}
