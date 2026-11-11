"use client";

// Carregamento entre páginas: só a logo SBJ com um anel amarelo girando em volta.
// (A animação completa da grua fica só na abertura do site, em public/intro-sbj.)
const CSS = `
.cs-wrap{display:flex;align-items:center;justify-content:center;min-height:55vh;animation:cs-in .2s ease-out .12s both}
@keyframes cs-in{from{opacity:0}to{opacity:1}}
.cs-box{position:relative;width:120px;height:120px;display:flex;align-items:center;justify-content:center}
.cs-ring{position:absolute;inset:0;border-radius:999px;border:3px solid rgba(12,107,118,.12);border-top-color:#F5E400;animation:cs-gira .9s linear infinite}
.cs-logo{width:64px;height:auto;animation:cs-pulsa 1.8s ease-in-out infinite}
@keyframes cs-gira{to{transform:rotate(360deg)}}
@keyframes cs-pulsa{0%,100%{opacity:.55;transform:scale(.96)}50%{opacity:1;transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.cs-ring,.cs-logo{animation:none}}
`;

export default function CarregandoSBJ() {
  return (
    <div className="cs-wrap" aria-busy="true" aria-label="Carregando" role="status">
      <style>{CSS}</style>
      <div className="cs-box">
        <span className="cs-ring" aria-hidden="true" />
        <img src="/logo-sbj.webp" alt="" className="cs-logo" />
      </div>
    </div>
  );
}
