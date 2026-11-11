/* Deslize da seleção nos controles segmentados (abas em "pílula") e fade na troca de aba.
   Usado pelo Pós-venda (kit) e pelo módulo de vistorias. Só mexe em estilo: nenhum dado é alterado. */
(function () {
  var css =
    ".seg-deslize{position:relative!important}" +
    ".seg-deslize>.seg-marca{position:absolute;left:0;top:0;z-index:0;border-radius:inherit;background:var(--surface,#fff);box-shadow:0 1px 3px rgba(0,0,0,.14);pointer-events:none;opacity:0;transition:transform .34s cubic-bezier(.22,1,.36,1),width .34s cubic-bezier(.22,1,.36,1),height .34s cubic-bezier(.22,1,.36,1),opacity .2s ease}" +
    ".seg-deslize>:not(.seg-marca){position:relative;z-index:1}" +
    '.seg-deslize>[aria-pressed="true"],.seg-deslize>.ativo{background:transparent!important;box-shadow:none!important}' +
    "@keyframes segTroca{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
    "#view.troca,.view.troca{animation:segTroca .32s cubic-bezier(.22,1,.36,1) both}" +
    "@media (prefers-reduced-motion:reduce){.seg-deslize>.seg-marca,#view.troca,.view.troca{transition:none!important;animation:none!important}}";
  var st = document.createElement("style");
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  var ultimo = {};

  function alinha(g) {
    var chave = g.getAttribute("aria-label") || g.className || "seg";
    var ativo = g.querySelector('[aria-pressed="true"]') || g.querySelector(".ativo");
    var m = g.querySelector(":scope > .seg-marca");
    if (!ativo) {
      if (m) m.style.opacity = "0";
      return;
    }
    if (!m) {
      m = document.createElement("span");
      m.className = "seg-marca";
      g.insertBefore(m, g.firstChild);
      var p = ultimo[chave];
      if (p) {
        // redesenhado: começa de onde estava, para deslizar até a nova seleção
        m.style.transition = "none";
        m.style.width = p.w + "px";
        m.style.height = p.h + "px";
        m.style.transform = "translate(" + p.x + "px," + p.y + "px)";
        void m.offsetWidth;
        m.style.transition = "";
      }
    }
    var x = ativo.offsetLeft, y = ativo.offsetTop, w = ativo.offsetWidth, h = ativo.offsetHeight;
    if (!w) return;
    m.style.opacity = "1";
    m.style.width = w + "px";
    m.style.height = h + "px";
    m.style.transform = "translate(" + x + "px," + y + "px)";
    ultimo[chave] = { x: x, y: y, w: w, h: h };
  }

  var agendado = false;
  function todos() {
    agendado = false;
    var grupos = document.querySelectorAll(".seg, .vt-seg");
    for (var i = 0; i < grupos.length; i++) {
      grupos[i].classList.add("seg-deslize");
      alinha(grupos[i]);
    }
  }
  function agendar() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(todos);
  }

  // a tela é redesenhada a cada mudança; ao redesenhar, a seleção desliza da posição anterior
  new MutationObserver(agendar).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-pressed", "class"],
  });
  window.addEventListener("resize", agendar);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", agendar);
  else agendar();
})();
