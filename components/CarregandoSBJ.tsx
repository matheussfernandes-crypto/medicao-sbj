"use client";

import { useId } from "react";
import { CARREGAMENTO_SVG } from "@/lib/carregamento-svg";

// Cada desenho na tela precisa de ids próprios: com dois carregamentos ao mesmo tempo (página e módulo),
// os ids repetidos faziam a máscara apontar para o desenho escondido e a animação parecia parada.
function comIdsUnicos(svg: string, sufixo: string) {
  return svg.replace(/id="([^"]+)"/g, (_m, id) => `id="${id}-${sufixo}"`).replace(/url\(#([^)]+)\)/g, (_m, id) => `url(#${id}-${sufixo})`);
}

// Carregamento do site: o desenho da logo SBJ sendo traçado e preenchido, com "Carregando…".
// Usado em todas as telas que carregam (páginas do Next e coberturas dos módulos).
const CSS = ".cs-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;min-height:55vh;width:100%}.cs-logo svg{width:min(46vw,180px);height:auto;display:block}.cs-status{font:600 14px/1 system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;letter-spacing:.04em;color:#6b7f86}.cs-status span{display:inline-block;animation:cs-dot 1.2s infinite;opacity:.2}.cs-status span:nth-child(2){animation-delay:.2s}.cs-status span:nth-child(3){animation-delay:.4s}@keyframes cs-dot{0%,100%{opacity:.2}50%{opacity:1}}@media (prefers-reduced-motion:reduce){.cs-status span{animation:none;opacity:1}}" +
  // O traço amarelo da logo anima por CSS (antes era SMIL, que no Chrome só começa quando a página termina
  // de carregar: no F5, com o servidor ainda respondendo, a logo ficava parada no primeiro quadro).
  ".cs-logo .cs-tr,.cs-logo .cs-ap,.cs-logo [class^=cs-r]{animation-duration:4.5s;animation-iteration-count:infinite;animation-timing-function:linear}" +
  ".cs-logo [class^=cs-r]{transform-box:fill-box;transform-origin:0 0}.cs-logo .cs-r4{transform-origin:100% 0}" +
  ".cs-logo .cs-tr{stroke-dashoffset:1;animation-name:cs-tr}.cs-logo .cs-ap{stroke-dashoffset:1;animation-name:cs-ap}" +
  ".cs-logo .cs-r1{animation-name:cs-r1}.cs-logo .cs-r2{animation-name:cs-r2}.cs-logo .cs-r3{animation-name:cs-r3}.cs-logo .cs-r4{transform:scaleX(0);animation-name:cs-r4}" +
  "@keyframes cs-tr{0%{stroke-dashoffset:1}50%,100%{stroke-dashoffset:0}}@keyframes cs-ap{0%,50%{stroke-dashoffset:1}99%,100%{stroke-dashoffset:0}}" +
  "@keyframes cs-r1{0%{transform:scaleX(1)}50%,100%{transform:scaleX(0)}}@keyframes cs-r2{0%,45%{transform:scaleX(1)}50%,100%{transform:scaleX(0)}}" +
  "@keyframes cs-r3{0%,92.06%{transform:scaleX(1)}99%,100%{transform:scaleX(0)}}@keyframes cs-r4{0%,50%{transform:scaleX(0)}99%,100%{transform:scaleX(1)}}" +
  "@media (prefers-reduced-motion:reduce){.cs-logo .cs-tr,.cs-logo .cs-ap,.cs-logo [class^=cs-r]{animation:none}.cs-logo .cs-tr{stroke-dashoffset:0}.cs-logo .cs-r1,.cs-logo .cs-r2{transform:scaleX(0)}}";

export default function CarregandoSBJ({ className = "" }: { className?: string }) {
  const sufixo = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <div role="status" aria-live="polite" aria-label="Carregando" className={"cs-wrap " + className}>
      <style>{CSS}</style>
      <div className="cs-logo" dangerouslySetInnerHTML={{ __html: comIdsUnicos(CARREGAMENTO_SVG, sufixo) }} />
      <div className="cs-status">Carregando<span>.</span><span>.</span><span>.</span></div>
    </div>
  );
}
