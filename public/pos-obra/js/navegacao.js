/* Navegação do celular: botão Voltar do aparelho/navegador, botão ← no topo e "lembrar onde eu estava".
   Cada tela (e cada vistoria aberta) vira uma entrada do histórico; ao voltar, o site mostra a tela anterior
   em vez de sair. Se a página recarregar (ex.: voltou de um PDF), o site reabre na mesma tela. */
(function () {
  const CHAVE = "posvenda_ui", LIMITE_MS = 6 * 3600 * 1000;
  const PAI = { "ticket-detail": "tickets", "building-detail": "buildings", "modification-detail": "modifications", "modifications-map": "modifications" };
  const TELAS = ["dashboard", "buildings", "clients", "suppliers", "tickets", "agenda", "vistorias", "modifications", "reports"];
  let ultimo = "", restaurando = false, profundidade = 0, pronto = false;
  let salvoInicial = null;
  try { salvoInicial = JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (e) { /* ignora */ }

  const viewAtiva = () => { const v = document.querySelector(".view.active"); return v ? v.id.replace(/^view-/, "") : "dashboard"; };
  const foto = () => {
    const v = viewAtiva();
    return {
      v,
      sub: v === "ticket-detail" ? (document.getElementById("view-subtitle").textContent || "") : "",
      vt: v === "vistorias" && typeof vtAbertaId !== "undefined" ? vtAbertaId : null,
      vf: v === "vistorias" && typeof vf !== "undefined" && vf ? { e: vf.etapa, id: vf.vid || null } : null,
    };
  };
  const fundo = (s) => !!(PAI[s.v] || s.vt || s.vf);

  function registrar() {
    if (restaurando || !pronto) return;
    const s = foto(), j = JSON.stringify(s);
    document.body.classList.toggle("mn-fundo", fundo(s));
    if (j === ultimo) return;
    const primeiro = ultimo === ""; ultimo = j;
    try { localStorage.setItem(CHAVE, JSON.stringify({ ...s, t: Date.now() })); } catch (e) { /* sem armazenamento */ }
    if (primeiro) history.replaceState(s, ""); else { history.pushState(s, ""); profundidade++; }
  }

  function aplicar(s) {
    restaurando = true;
    try {
      const v = TELAS.includes(s.v) ? s.v : (PAI[s.v] || "dashboard");
      if (s.v === "ticket-detail" && s.sub && typeof goToTicketDetail === "function" && typeof getTicket === "function" && getTicket(s.sub)) { goToTicketDetail(s.sub); }
      else {
        if (v === "vistorias") {
          if (typeof vf !== "undefined") {
            if (s.vf && s.vf.e === "final" && s.vf.id) vf = { etapa: "final", vid: s.vf.id, novos: null };
            else if (s.vf && typeof vfRascunhoLer === "function") { vf = vfRascunhoLer(); if (vf && (s.vf.e === "inicio" || s.vf.e === "folha")) vf.etapa = s.vf.e; }
            else vf = null;
          }
          if (typeof vtAbertaId !== "undefined") vtAbertaId = s.vf ? null : (s.vt || null);
        } else {
          if (typeof vf !== "undefined") vf = null;
          if (typeof vtAbertaId !== "undefined") vtAbertaId = null;
        }
        showView(v);
      }
    } finally {
      setTimeout(() => { restaurando = false; ultimo = JSON.stringify(foto()); document.body.classList.toggle("mn-fundo", fundo(foto())); }, 80);
    }
  }

  /* envolve as funções que trocam de tela, sem mexer nelas */
  ["showView", "goToTicketDetail", "goToModificationDetail", "openBuildingDetail", "renderVistorias"].forEach(nome => {
    const orig = window[nome]; if (typeof orig !== "function") return;
    window[nome] = function () { const r = orig.apply(this, arguments); setTimeout(registrar, 0); return r; };
  });

  window.addEventListener("popstate", (e) => { if (e.state) { profundidade = Math.max(0, profundidade - 1); aplicar(e.state); } });

  /* botão ← no topo (celular): volta uma tela; se não houver histórico, vai para a tela "mãe" */
  const topbar = document.querySelector(".topbar");
  if (topbar) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "mn-voltar"; b.setAttribute("aria-label", "Voltar");
    b.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
    b.addEventListener("click", () => {
      if (profundidade > 0) { history.back(); return; }
      const s = foto();
      if (s.vf && s.vf.e === "final") aplicar({ v: "vistorias", vt: null, vf: null });
      else if (s.vf || s.vt) aplicar({ v: "vistorias", vt: null, vf: null });
      else aplicar({ v: PAI[s.v] || "dashboard", vt: null, vf: null });
    });
    topbar.insertBefore(b, topbar.firstChild);
  }

  /* reabre onde estava (reload, voltou de um PDF, o celular descarregou a página) */
  window.addEventListener("load", () => {
    setTimeout(() => {
      const salvo = salvoInicial;
      if (salvo && Date.now() - (salvo.t || 0) < LIMITE_MS && (salvo.v !== "dashboard" || salvo.vf || salvo.vt)) aplicar(salvo);
      setTimeout(() => { pronto = true; registrar(); }, 200);
    }, 300);
  });

  /* caixas de texto crescem em vez de rolar por dentro (rolar a página não pode "agarrar" na caixa) */
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t && t.matches && t.matches(".qc-input, #vt-texto, #vf-decl")) { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }
  });
})();
