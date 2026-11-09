/* Esconde partes do site que ainda não entram em uso.
   Configure em js/sync-config.js:   window.SBJ_MODULOS_OCULTOS = ["dashboard", "tickets", "modifications", "agenda", "reports"];
   (nomes das telas: dashboard, tickets, modifications, agenda, reports, vistorias, buildings, clients, suppliers).
   Vazio = tudo aparece (é o padrão deste computador). Os dados dessas partes continuam existindo, só não aparecem. */
(function () {
  const ocultos = window.SBJ_MODULOS_OCULTOS || [];
  if (!ocultos.length) return;
  const inicial = ["vistorias", "buildings", "clients", "suppliers"].find(v => !ocultos.includes(v)) || "vistorias";

  function aplicar() {
    document.querySelectorAll(".nav-btn[data-view]").forEach(b => { if (ocultos.includes(b.dataset.view)) b.style.display = "none"; });
    document.querySelectorAll("[data-mnav]").forEach(b => { if (ocultos.includes(b.dataset.mnav)) b.style.display = "none"; });
    document.querySelectorAll(".nav-group-label").forEach(l => {
      let n = l.nextElementSibling, visivel = false;
      while (n && !n.classList.contains("nav-group-label") && !n.classList.contains("sidebar-footer")) { if (n.classList.contains("nav-btn") && n.style.display !== "none") visivel = true; n = n.nextElementSibling; }
      l.style.display = visivel ? "" : "none";
    });
    const nt = document.getElementById("btn-new-ticket"); if (nt && ocultos.includes("tickets")) nt.style.display = "none";
    const nm = document.getElementById("btn-new-modification"); if (nm && ocultos.includes("modifications")) nm.style.display = "none";
  }

  /* qualquer tentativa de abrir uma tela escondida cai na tela inicial permitida */
  const original = window.showView;
  if (typeof original === "function") {
    window.showView = function (nome) { return original.call(this, ocultos.includes(nome) ? inicial : nome); };
  }
  aplicar();
  const ativa = document.querySelector(".view.active");
  if (ativa && ocultos.includes(ativa.id.replace(/^view-/, ""))) window.showView(inicial);
})();
