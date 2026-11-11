"use client";

import { CARREGAMENTO_SVG } from "@/lib/carregamento-svg";

// Carregamento do site: o desenho da logo SBJ sendo traçado e preenchido, com "Carregando…".
// Usado em todas as telas que carregam (páginas do Next e coberturas dos módulos).
const CSS = ".cs-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;min-height:55vh;width:100%}.cs-logo svg{width:min(70vw,300px);height:auto;display:block}.cs-status{font:600 14px/1 system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;letter-spacing:.04em;color:#6b7f86}.cs-status span{display:inline-block;animation:cs-dot 1.2s infinite;opacity:.2}.cs-status span:nth-child(2){animation-delay:.2s}.cs-status span:nth-child(3){animation-delay:.4s}@keyframes cs-dot{0%,100%{opacity:.2}50%{opacity:1}}@media (prefers-reduced-motion:reduce){.cs-status span{animation:none;opacity:1}}";

export default function CarregandoSBJ({ className = "" }: { className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label="Carregando" className={"cs-wrap " + className}>
      <style>{CSS}</style>
      <div className="cs-logo" dangerouslySetInnerHTML={{ __html: CARREGAMENTO_SVG }} />
      <div className="cs-status">Carregando<span>.</span><span>.</span><span>.</span></div>
    </div>
  );
}
