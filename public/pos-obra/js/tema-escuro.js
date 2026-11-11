/* Modo escuro do módulo de vistorias, no padrão do Pós-venda: fundos claros e neutros viram escuros,
   textos escuros viram claros. Cores fortes (teal, amarelo, vermelho, verde) não mudam. Enquanto o tema
   escuro estiver ligado no site (data-tema em <html>). Só muda a aparência; nenhum dado é alterado. */
(function () {
  var raiz = document.documentElement;
  var MARCA = "data-tema-escuro";
  var FUNDO = "#152023", FUNDO_SUAVE = "#1d2b2f", TEXTO = "#e4eef0", TEXTO_SUAVE = "#93a7ac";

  function rgb(cor) {
    var m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?/.exec(cor || "");
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }
  // neutro: pouca diferença entre canais (branco, cinza, preto); colorido: canais bem distantes
  function neutro(c) {
    return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 22;
  }
  function luz(c) {
    return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
  }
  function fundoEfetivo(el) {
    for (var e = el; e && e !== document.documentElement; e = e.parentElement) {
      var c = rgb(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0.5) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  function ajusta(el) {
    if (el.hasAttribute(MARCA)) return;
    var cs = getComputedStyle(el);
    var fundo = rgb(cs.backgroundColor);
    var mudou = false;
    if (fundo && fundo.a > 0.5 && neutro(fundo) && luz(fundo) > 0.82) {
      el.style.setProperty("background-color", luz(fundo) > 0.96 ? FUNDO : FUNDO_SUAVE, "important");
      mudou = true;
    }
    var texto = rgb(cs.color);
    if (texto && texto.a > 0.5 && luz(texto) < 0.55 && el.childNodes.length) {
      var base = fundoEfetivo(el);
      if (neutro(base) && luz(base) < 0.5) {
        el.style.setProperty("color", luz(texto) < 0.3 ? TEXTO : TEXTO_SUAVE, "important");
        mudou = true;
      }
    }
    if (mudou) el.setAttribute(MARCA, "1");
  }
  function reverte() {
    var marcados = document.querySelectorAll("[" + MARCA + "]");
    for (var i = 0; i < marcados.length; i++) {
      marcados[i].style.removeProperty("background-color");
      marcados[i].style.removeProperty("color");
      marcados[i].removeAttribute(MARCA);
    }
  }
  var agendado = false;
  function aplica() {
    agendado = false;
    if (raiz.getAttribute("data-tema") === "dark") {
      var els = document.body ? document.body.querySelectorAll("*") : [];
      for (var i = 0; i < els.length; i++) ajusta(els[i]);
    } else {
      reverte();
    }
  }
  function agendar() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(aplica);
  }
  new MutationObserver(agendar).observe(raiz, { attributes: true, attributeFilter: ["data-tema"], childList: true, subtree: true });
  agendar();
})();
