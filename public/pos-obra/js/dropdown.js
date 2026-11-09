/* Menus de seleção do site (substitui o menu nativo do navegador, que fica com cara de Windows antigo).
   Cada <select> continua existindo (escondido) e recebe value/change normalmente: o resto do código
   não precisa saber. Funciona também para selects criados depois (modais, telas redesenhadas). */
(function () {
  const protoValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  const protoIndex = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex");
  let aberto = null; // { dd, menu, fechar }

  function textoSelecionado(sel) {
    const o = sel.options[sel.selectedIndex];
    return o ? o.textContent.trim() : "";
  }

  function atualizar(sel) {
    const dd = sel._dd; if (!dd) return;
    const t = textoSelecionado(sel);
    const placeholder = !sel.value;
    dd.btn.querySelector(".dd-txt").textContent = t || "Selecionar";
    dd.btn.classList.toggle("dd-vazio", placeholder);
    dd.btn.disabled = sel.disabled;
  }

  function fecharMenu() { if (aberto) { aberto.fechar(); aberto = null; } }

  function abrirMenu(sel) {
    fecharMenu();
    const dd = sel._dd, btn = dd.btn;
    const menu = document.createElement("div");
    menu.className = "dd-menu"; menu.setAttribute("role", "listbox");
    const opcoes = [];
    const monta = (o, grupo) => {
      const it = document.createElement("div");
      it.className = "dd-item" + (o.selected ? " sel" : "") + (o.disabled ? " off" : "") + (grupo ? " em-grupo" : "");
      it.setAttribute("role", "option"); it.dataset.i = String(o.index);
      it.innerHTML = `<span class="dd-item-txt"></span><svg class="dd-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>`;
      it.querySelector(".dd-item-txt").textContent = o.textContent.trim() || "—";
      opcoes.push(it); return it;
    };
    const lista = document.createElement("div"); lista.className = "dd-lista";
    Array.from(sel.children).forEach(ch => {
      if (ch.tagName === "OPTGROUP") {
        const g = document.createElement("div"); g.className = "dd-grupo"; g.textContent = ch.label; lista.appendChild(g);
        Array.from(ch.children).forEach(o => lista.appendChild(monta(o, true)));
      } else lista.appendChild(monta(ch, false));
    });
    let busca = null;
    if (opcoes.length > 10) {
      busca = document.createElement("input"); busca.type = "search"; busca.className = "dd-busca"; busca.placeholder = "Buscar…"; busca.autocomplete = "off";
      menu.appendChild(busca);
    }
    menu.appendChild(lista);
    document.body.appendChild(menu);

    const r = btn.getBoundingClientRect();
    menu.style.minWidth = Math.max(r.width, 160) + "px";
    const altMenu = Math.min(menu.offsetHeight, 340);
    const abaixo = window.innerHeight - r.bottom, acima = r.top;
    const emCima = abaixo < altMenu + 12 && acima > abaixo;
    menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8)) + "px";
    menu.style.maxHeight = Math.max(160, Math.min(340, (emCima ? acima : abaixo) - 14)) + "px";
    menu.style.top = emCima ? Math.max(8, r.top - menu.offsetHeight - 6) + "px" : (r.bottom + 6) + "px";
    menu.classList.toggle("dd-cima", emCima);
    btn.setAttribute("aria-expanded", "true"); dd.wrap.classList.add("dd-aberto");

    let ativo = Math.max(0, opcoes.findIndex(o => o.classList.contains("sel")));
    const visiveis = () => opcoes.filter(o => !o.hidden && !o.classList.contains("off"));
    const marca = (el, rolar) => { opcoes.forEach(o => o.classList.remove("ativo")); if (el) { el.classList.add("ativo"); if (rolar) el.scrollIntoView({ block: "nearest" }); } };
    marca(opcoes[ativo], true);

    const escolher = (el) => {
      if (!el || el.classList.contains("off")) return;
      const i = Number(el.dataset.i);
      if (sel.selectedIndex !== i) { protoIndex.set.call(sel, i); atualizar(sel); sel.dispatchEvent(new Event("input", { bubbles: true })); sel.dispatchEvent(new Event("change", { bubbles: true })); }
      fecharMenu(); btn.focus();
    };
    menu.addEventListener("mousemove", e => { const it = e.target.closest(".dd-item"); if (it && !it.classList.contains("ativo")) marca(it, false); });
    menu.addEventListener("mousedown", e => e.preventDefault());
    menu.addEventListener("click", e => escolher(e.target.closest(".dd-item")));
    if (busca) {
      busca.addEventListener("input", () => {
        const q = busca.value.trim().toLowerCase();
        opcoes.forEach(o => { o.hidden = q && !o.textContent.toLowerCase().includes(q); });
        marca(visiveis()[0] || null, true);
      });
      setTimeout(() => busca.focus(), 0);
    }
    const tecla = (e) => {
      const v = visiveis(); const pos = v.findIndex(o => o.classList.contains("ativo"));
      if (e.key === "ArrowDown") { e.preventDefault(); marca(v[Math.min(v.length - 1, pos + 1)], true); }
      else if (e.key === "ArrowUp") { e.preventDefault(); marca(v[Math.max(0, pos - 1)], true); }
      else if (e.key === "Home") { e.preventDefault(); marca(v[0], true); }
      else if (e.key === "End") { e.preventDefault(); marca(v[v.length - 1], true); }
      else if (e.key === "Enter") { e.preventDefault(); escolher(v[pos]); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fecharMenu(); btn.focus(); }
      else if (e.key === "Tab") fecharMenu();
      else if (!busca && e.key.length === 1) { const q = e.key.toLowerCase(); const ach = v.find(o => o.textContent.trim().toLowerCase().startsWith(q)); if (ach) marca(ach, true); }
    };
    document.addEventListener("keydown", tecla, true);
    const fora = (e) => { if (!menu.contains(e.target) && !dd.wrap.contains(e.target)) fecharMenu(); };
    const rolagem = (e) => { if (!menu.contains(e.target)) fecharMenu(); };
    document.addEventListener("mousedown", fora, true);
    window.addEventListener("scroll", rolagem, true);
    window.addEventListener("resize", fecharMenu);
    aberto = {
      fechar() {
        document.removeEventListener("keydown", tecla, true); document.removeEventListener("mousedown", fora, true);
        window.removeEventListener("scroll", rolagem, true); window.removeEventListener("resize", fecharMenu);
        menu.classList.add("dd-saindo"); setTimeout(() => menu.remove(), 120);
        btn.setAttribute("aria-expanded", "false"); dd.wrap.classList.remove("dd-aberto");
      },
    };
  }

  function melhorar(sel) {
    if (sel._dd || sel.multiple || sel.size > 1 || sel.hasAttribute("data-nativo")) return;
    const wrap = document.createElement("span"); wrap.className = "dd";
    const pai = sel.parentElement; const larg = sel.offsetWidth, largPai = pai ? pai.clientWidth : 0;
    const cheio = (sel.style.width === "100%") || (largPai && larg >= largPai * 0.92) || getComputedStyle(sel).display === "block";
    if (cheio) wrap.classList.add("dd-cheio");
    if (sel.style.minWidth) wrap.style.minWidth = sel.style.minWidth;
    if (sel.style.maxWidth) wrap.style.maxWidth = sel.style.maxWidth;
    if (sel.style.marginLeft) wrap.style.marginLeft = sel.style.marginLeft;
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "dd-btn " + (sel.className || "");
    btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
    if (sel.title) btn.title = sel.title;
    btn.innerHTML = `<span class="dd-txt"></span><svg class="dd-seta" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l7 7 7-7"/></svg>`;
    wrap.appendChild(btn); sel.parentNode.insertBefore(wrap, sel); sel.classList.add("dd-oculto");
    sel._dd = { wrap, btn };
    btn.addEventListener("click", () => { aberto && aberto.fechar && wrap.classList.contains("dd-aberto") ? fecharMenu() : abrirMenu(sel); });
    btn.addEventListener("keydown", e => { if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); abrirMenu(sel); } });
    // mudanças feitas pelo código (value = ..., selectedIndex = ...) atualizam o texto do botão
    Object.defineProperty(sel, "value", { configurable: true, get() { return protoValue.get.call(this); }, set(v) { protoValue.set.call(this, v); atualizar(this); } });
    Object.defineProperty(sel, "selectedIndex", { configurable: true, get() { return protoIndex.get.call(this); }, set(v) { protoIndex.set.call(this, v); atualizar(this); } });
    new MutationObserver(() => atualizar(sel)).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "selected"] });
    sel.addEventListener("change", () => atualizar(sel));
    atualizar(sel);
  }

  function varrer(raiz) { (raiz || document).querySelectorAll("select").forEach(melhorar); }
  let pendente = false;
  new MutationObserver(() => { if (pendente) return; pendente = true; setTimeout(() => { pendente = false; varrer(); }, 0); })
    .observe(document.documentElement, { childList: true, subtree: true });
  varrer();
})();
