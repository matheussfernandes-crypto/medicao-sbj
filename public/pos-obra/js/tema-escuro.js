/* Modo escuro do módulo de vistorias: troca os fundos brancos por escuros enquanto o tema escuro estiver
   ligado no site (atributo data-tema em <html>, que a página do site define). Só muda a aparência. */
(function () {
  var raiz = document.documentElement;
  var marca = "data-tema-branco";
  var css =
    "";
  var st = document.createElement("style");
  st.textContent = css;
  (document.head || raiz).appendChild(st);

  var branco = /^rgba?\(\s*255\s*,\s*255\s*,\s*255/;

  function escurece(el) {
    if (el.hasAttribute(marca)) return;
    var cor = getComputedStyle(el).backgroundColor;
    if (branco.test(cor)) {
      el.setAttribute(marca, cor);
      el.style.setProperty("background-color", "#152023", "important");
    }
  }
  function reverte() {
    var marcados = document.querySelectorAll("[" + marca + "]");
    for (var i = 0; i < marcados.length; i++) {
      marcados[i].style.removeProperty("background-color");
      marcados[i].removeAttribute(marca);
    }
  }
  function aplica() {
    agendado = false;
    if (raiz.getAttribute("data-tema") === "dark") {
      var els = document.body ? document.body.querySelectorAll("*") : [];
      for (var i = 0; i < els.length; i++) escurece(els[i]);
    } else {
      reverte();
    }
  }
  var agendado = false;
  function agendar() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(aplica);
  }
  new MutationObserver(agendar).observe(raiz, { attributes: true, attributeFilter: ["data-tema"], childList: true, subtree: true });
  agendar();
})();
