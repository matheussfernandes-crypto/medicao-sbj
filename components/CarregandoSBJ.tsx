"use client";

import { useEffect, useState } from "react";

// Tela de carregamento na troca de página: a parte final da animação de entrada da logo SBJ
// (arco se desenha, prédios aparecem, SBJ sobe), em laço enquanto a página carrega.
// Usa o mesmo vetor da animação de entrada (public/intro-sbj/intro-data.js, carregado no layout raiz).

type IntroData = { yellow: string; teal: string; paths: Record<"arc" | "bld" | "s" | "b" | "j" | "tag", string> };

const CSS = `
.cs-wrap{display:flex;align-items:center;justify-content:center;min-height:55vh;animation:cs-in .2s ease-out .12s both}
@keyframes cs-in{from{opacity:0}to{opacity:1}}
.cs-logo{width:min(150px,40vw);height:auto;overflow:visible}
.cs-arc{stroke-dasharray:75 100;stroke-dashoffset:75;animation:cs-desenha 1.8s cubic-bezier(.45,0,.2,1) infinite}
@keyframes cs-desenha{0%{stroke-dashoffset:75}35%,85%{stroke-dashoffset:0}100%{stroke-dashoffset:-25}}
.cs-bld{animation:cs-bld 1.8s ease-in-out infinite}
@keyframes cs-bld{0%,10%{opacity:0}30%,85%{opacity:1}100%{opacity:0}}
.cs-rise{transform:translateY(190px);animation:cs-sobe 1.8s cubic-bezier(.16,1,.3,1) infinite}
.cs-rise.b{animation-delay:.07s}.cs-rise.j{animation-delay:.14s}
@keyframes cs-sobe{0%,15%{transform:translateY(190px)}40%,85%{transform:none}100%{transform:translateY(-190px)}}
.cs-tag{animation:cs-bld 1.8s ease-in-out .2s infinite}
@media (prefers-reduced-motion:reduce){.cs-arc,.cs-bld,.cs-rise,.cs-tag{animation:none;stroke-dashoffset:0;transform:none;opacity:1}}
`;

export default function CarregandoSBJ() {
  const [d, setD] = useState<IntroData | null>(null);
  useEffect(() => {
    const dados = (window as any).SBJ_INTRO as IntroData | undefined;
    if (dados?.paths) setD(dados);
  }, []);

  return (
    <div className="cs-wrap" aria-busy="true" aria-label="Carregando" role="status">
      <style>{CSS}</style>
      {d ? (
        <svg className="cs-logo" viewBox="0 0 510 444" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <mask id="cs-m-arc" maskUnits="userSpaceOnUse" x="0" y="0" width="510" height="444">
              <circle className="cs-arc" cx="255.5" cy="250" r="244" fill="none" stroke="#fff" strokeWidth="44" pathLength={100} transform="rotate(140 255.5 250)" />
            </mask>
            {(["s", "b", "j"] as const).map((k) => (
              <mask key={k} id={"cs-m-" + k} maskUnits="userSpaceOnUse" x="0" y="0" width="510" height="444">
                <rect className={"cs-rise " + k} x="0" y="90" width="510" height="190" fill="#fff" />
              </mask>
            ))}
          </defs>
          <path className="cs-bld" fill={d.yellow} fillRule="evenodd" d={d.paths.bld} />
          <g mask="url(#cs-m-arc)">
            <path fill={d.yellow} fillRule="evenodd" d={d.paths.arc} />
          </g>
          <g fill={d.teal} fillRule="evenodd">
            <g mask="url(#cs-m-s)"><path d={d.paths.s} /></g>
            <g mask="url(#cs-m-b)"><path d={d.paths.b} /></g>
            <g mask="url(#cs-m-j)"><path d={d.paths.j} /></g>
            <path className="cs-tag" d={d.paths.tag} />
          </g>
        </svg>
      ) : (
        <img src="/logo-topbar.png" alt="" className="h-10 w-auto animate-pulse" />
      )}
    </div>
  );
}
