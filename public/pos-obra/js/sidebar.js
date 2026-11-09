/* Menu lateral.
   - Tela larga: menu fixo.
   - Tablet (até 900px): só ícones; abre ao passar o mouse / tocar / Tab e fecha sozinho.
   - Celular (até 720px): menu em gaveta (botão ☰ no topo) + barra de navegação embaixo. */
(function () {
  const sb = document.querySelector(".sidebar");
  if (!sb) return;
  const mq = window.matchMedia("(max-width: 720px)");
  let preso = false; // clicou num item: fica fechado até o mouse sair
  const abrir = () => { if (!preso) sb.classList.add("aberto"); };
  const fechar = () => { sb.classList.remove("aberto"); document.body.classList.remove("mn-aberto"); };

  /* ---------- tablet / desktop ---------- */
  sb.addEventListener("mouseenter", () => { if (!mq.matches) abrir(); });
  sb.addEventListener("mouseleave", () => { preso = false; if (!mq.matches) fechar(); });
  sb.addEventListener("click", (e) => {
    if (e.target.closest(".nav-btn")) { preso = true; fechar(); if (document.activeElement) document.activeElement.blur(); }
  });
  sb.addEventListener("touchstart", (e) => { if (!mq.matches && !sb.classList.contains("aberto") && !e.target.closest(".nav-btn")) abrir(); }, { passive: true });
  sb.addEventListener("focusin", (e) => { if (!mq.matches && e.target.matches(":focus-visible")) abrir(); });
  sb.addEventListener("focusout", (e) => { if (!mq.matches && !sb.contains(e.relatedTarget)) fechar(); });
  document.addEventListener("click", (e) => { if (!mq.matches && !sb.contains(e.target)) fechar(); });

  /* ---------- celular: gaveta + barra de baixo ---------- */
  const icone = (view) => { const b = sb.querySelector(`.nav-btn[data-view="${view}"] svg`); return b ? b.outerHTML : ""; };
  const backdrop = document.createElement("div"); backdrop.className = "mn-backdrop"; document.body.appendChild(backdrop);
  backdrop.addEventListener("click", fechar);

  const topbar = document.querySelector(".topbar");
  if (topbar) {
    const h = document.createElement("button");
    h.type = "button"; h.className = "mn-hamb"; h.setAttribute("aria-label", "Abrir o menu");
    h.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    h.addEventListener("click", () => { preso = false; sb.classList.add("aberto"); document.body.classList.add("mn-aberto"); });
    topbar.insertBefore(h, topbar.firstChild);
  }

  const itens = [["dashboard", "Painel"], ["tickets", "Pós-venda"], ["vistorias", "Vistorias"], ["agenda", "Agenda"]];
  const nav = document.createElement("nav"); nav.className = "mnav"; nav.setAttribute("aria-label", "Navegação principal");
  nav.innerHTML = itens.map(([v, r]) => `<button type="button" class="mnav-btn" data-mnav="${v}">${icone(v)}<span>${r}</span></button>`).join("")
    + `<button type="button" class="mnav-btn" data-mnav="__menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>Menu</span></button>`;
  document.body.appendChild(nav);
  nav.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mnav]"); if (!b) return;
    if (b.dataset.mnav === "__menu") { preso = false; sb.classList.add("aberto"); document.body.classList.add("mn-aberto"); return; }
    if (typeof showView === "function") showView(b.dataset.mnav);
    window.scrollTo({ top: 0 });
  });
  const marcar = () => {
    const ativo = sb.querySelector(".nav-btn.active"), v = ativo ? ativo.dataset.view : "";
    nav.querySelectorAll("[data-mnav]").forEach(b => b.classList.toggle("ativo", b.dataset.mnav === v));
    nav.querySelector('[data-mnav="__menu"]').classList.toggle("ativo", !!v && !itens.some(i => i[0] === v));
  };
  new MutationObserver(marcar).observe(sb, { attributes: true, subtree: true, attributeFilter: ["class"] });
  marcar();

  /* com o teclado aberto, a barra de baixo sai da frente */
  document.addEventListener("focusin", (e) => { if (e.target.matches("input:not([type=checkbox]):not([type=radio]), textarea")) document.body.classList.add("teclado"); });
  document.addEventListener("focusout", () => { setTimeout(() => { if (!document.activeElement || !document.activeElement.matches("input, textarea")) document.body.classList.remove("teclado"); }, 80); });
  mq.addEventListener("change", fechar);
})();
