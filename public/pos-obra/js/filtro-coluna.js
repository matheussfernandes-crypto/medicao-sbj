/* Filtro e ordenação no título da coluna (mesmo padrão do Pós-venda).
   tfcBotao(chave, rótulo, nMarcados, ordem) devolve o botão do título;
   tfcAbrir(botão, cfg) abre o menu: ordenar + busca + caixinhas com a quantidade de cada valor + Limpar.
   cfg: { chave, ord: [[dir, rótulo]] | null, ordAtual, valores: [{ v, l, n }] | null, marcados: [], onOrdem(dir|null), onMarcar([...]) } */
(function () {
  const css = `
  .tf-h{display:inline-flex;align-items:center;gap:6px;margin:-5px -8px;padding:5px 8px;border:0;border-radius:8px;background:none;font:inherit;font-weight:700;color:var(--text,#14242a);text-transform:inherit;letter-spacing:inherit;cursor:pointer;white-space:nowrap;transition:background .15s,color .15s}
  .tf-h:hover{background:rgba(0,104,122,.1);color:var(--text,#14242a)}.tf-h .tf-i{display:inline-flex;opacity:.45;transition:opacity .15s}.tf-h:hover .tf-i{opacity:1}
  .tf-h.on{color:var(--primary,#00687a)}.tf-h.aberto{background:rgba(0,104,122,.12);color:var(--text,#14242a)}
  .tf-h .tf-c{background:var(--primary,#00687a);color:#fff;border-radius:999px;font-size:10.5px;padding:0 6px;letter-spacing:0;line-height:16px}
  .tf-h .tf-s{font-size:12px;letter-spacing:0}
  .tf-pop{position:absolute;z-index:9500;width:270px;background:var(--panel,#fff);border:1px solid var(--border,#e2e6ec);border-radius:14px;box-shadow:0 12px 32px rgba(11,70,82,.18);padding:6px;font-size:13px;text-transform:none;letter-spacing:0;font-weight:400;color:var(--text,#14242a);animation:tfc-in .16s ease}
  @keyframes tfc-in{from{opacity:0;transform:translateY(-4px)}}
  .tf-ord{display:flex;gap:6px;padding:4px 4px 8px}
  .tf-ord button{flex:1;border:1px solid var(--border,#e2e6ec);border-radius:8px;background:var(--panel,#fff);padding:6px 4px;font:inherit;font-size:12.5px;font-weight:600;color:var(--text,#14242a);cursor:pointer;white-space:nowrap}
  .tf-ord button:hover{border-color:var(--primary,#00687a)}.tf-ord button.on{background:rgba(0,104,122,.1);border-color:var(--primary,#00687a);color:var(--primary,#00687a)}
  .tf-linha{border-top:1px solid var(--border,#e2e6ec);margin:0 2px}
  .tf-busca{display:block;width:calc(100% - 16px);box-sizing:border-box;margin:8px 8px 6px;height:32px;border:1px solid var(--border,#e2e6ec);border-radius:9px;padding:0 10px;font:inherit;font-size:13px;background:var(--panel,#fff);color:var(--text,#14242a)}
  .tf-busca:focus{outline:none;border-color:var(--primary,#00687a);box-shadow:0 0 0 3px rgba(0,104,122,.15)}
  .tf-lista{max-height:260px;overflow:auto;padding-top:4px}
  .tf-op{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px;cursor:pointer}.tf-op:hover{background:rgba(0,104,122,.06)}
  .tf-op[hidden]{display:none}
  .tf-op input{width:16px;height:16px;accent-color:var(--primary,#00687a);margin:0;flex:none}.tf-op span:first-of-type{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tf-op .tf-n{margin-left:auto;color:var(--text-muted,#64748b);font-size:12px;font-variant-numeric:tabular-nums}
  .tf-ft{display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border,#e2e6ec);margin-top:4px;padding:8px 8px 4px;color:var(--text-muted,#64748b)}
  .tf-ft button{border:0;background:none;font:inherit;font-weight:600;color:var(--primary,#00687a);cursor:pointer;padding:0}
  @media print{.tf-h .tf-i,.tf-h .tf-c,.tf-h .tf-s{display:none!important}}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const ICO = '<span class="tf-i"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg></span>';

  window.tfcBotao = function (chave, rot, n, ord) {
    return `<button type="button" class="tf-h${n || ord ? " on" : ""}" data-tfc="${esc(chave)}" aria-haspopup="true">${esc(rot)}${n ? `<span class="tf-c">${n}</span>` : ""}${ord ? `<span class="tf-s">${ord === "asc" ? "↑" : "↓"}</span>` : ""}${!n && !ord ? ICO : ""}</button>`;
  };

  let TF = null;
  function fechar() {
    if (!TF) return;
    TF.el.remove(); if (TF.anc) TF.anc.classList.remove("aberto");
    document.removeEventListener("mousedown", TF.fora, true); document.removeEventListener("keydown", TF.tecla); window.removeEventListener("resize", fechar); window.removeEventListener("scroll", TF.rolou, true);
    TF = null;
  }
  window.tfcFechar = fechar;
  // depois de redesenhar a tabela, o menu continua preso ao novo botão do título
  window.tfcReancorar = function () { if (!TF) return; const n = document.querySelector(`[data-tfc="${CSS.escape(TF.chave)}"]`); if (n) { TF.anc = n; n.classList.add("aberto"); } };
  window.tfcAbrir = function (anc, cfg) {
    const mesma = TF && TF.chave === cfg.chave; fechar(); if (mesma) return;
    const el = document.createElement("div"); el.className = "tf-pop"; el.setAttribute("role", "dialog");
    const sel = new Set(cfg.marcados || []);
    const rodape = () => sel.size ? `${sel.size} ${sel.size === 1 ? "marcado" : "marcados"}` : "Mostrando todos";
    el.innerHTML = (cfg.ord ? `<div class="tf-ord">${cfg.ord.map(([d, l]) => `<button type="button" data-tfo="${d}" class="${cfg.ordAtual === d ? "on" : ""}">${esc(l)}</button>`).join("")}</div>` : "") +
      (cfg.valores ? (cfg.valores.length > 7 ? `${cfg.ord ? '<div class="tf-linha"></div>' : ""}<input class="tf-busca" type="search" placeholder="Buscar…" autocomplete="off">` : (cfg.ord ? '<div class="tf-linha"></div>' : "")) +
        `<div class="tf-lista">${cfg.valores.map(x => `<label class="tf-op" data-l="${esc(norm(x.l))}"><input type="checkbox" value="${esc(x.v)}" ${sel.has(x.v) ? "checked" : ""}><span>${esc(x.l)}</span><span class="tf-n">${x.n}</span></label>`).join("") || '<div style="padding:8px;color:var(--text-muted)">Nada para filtrar.</div>'}</div>
        <div class="tf-ft"><span class="tf-rod">${rodape()}</span><button type="button" data-tfl>Limpar</button></div>` : "");
    document.body.appendChild(el);
    const r = anc.getBoundingClientRect();
    el.style.top = (r.bottom + window.scrollY + 6) + "px";
    el.style.left = Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - el.offsetWidth - 8)) + "px";
    anc.classList.add("aberto");
    const marcar = () => { const rd = el.querySelector(".tf-rod"); if (rd) rd.textContent = rodape(); cfg.onMarcar && cfg.onMarcar([...sel]); };
    el.addEventListener("change", e => { const i = e.target; if (i.type !== "checkbox") return; i.checked ? sel.add(i.value) : sel.delete(i.value); marcar(); });
    el.addEventListener("input", e => { if (!e.target.classList.contains("tf-busca")) return; const q = norm(e.target.value); el.querySelectorAll(".tf-op").forEach(o => o.hidden = !!q && !o.dataset.l.includes(q)); });
    el.addEventListener("click", e => {
      const o = e.target.closest("[data-tfo]");
      if (o) { const d = o.classList.contains("on") ? null : o.dataset.tfo; el.querySelectorAll("[data-tfo]").forEach(b => b.classList.toggle("on", b.dataset.tfo === d)); cfg.onOrdem && cfg.onOrdem(d); return; }
      if (e.target.closest("[data-tfl]")) { sel.clear(); el.querySelectorAll(".tf-op input").forEach(i => i.checked = false); marcar(); }
    });
    TF = {
      el, anc, chave: cfg.chave,
      fora: e => { const h = e.target.closest && e.target.closest("[data-tfc]"); if (!el.contains(e.target) && !(h && h.dataset.tfc === TF.chave)) fechar(); },
      tecla: e => { if (e.key === "Escape") fechar(); },
      // rolar a tabela (ou a página) fecha o menu, para ele não ficar solto longe da coluna
      rolou: e => { if (!el.contains(e.target)) fechar(); }
    };
    document.addEventListener("mousedown", TF.fora, true); document.addEventListener("keydown", TF.tecla); window.addEventListener("resize", fechar);
    setTimeout(() => { if (TF && TF.el === el) window.addEventListener("scroll", TF.rolou, true); }, 0);
    const b = el.querySelector(".tf-busca"); if (b) b.focus();
  };
  // valores de uma coluna com a quantidade de cada um
  window.tfcContar = function (lista, val, rot, ordenar) {
    const cont = new Map();
    lista.forEach(x => { const v = val(x); cont.set(v, (cont.get(v) || 0) + 1); });
    const out = [...cont.entries()].map(([v, n]) => ({ v, l: rot ? rot(v) : (v || "—"), n }));
    return ordenar === false ? out : out.sort((a, b) => a.l.localeCompare(b.l, "pt-BR", { numeric: true }));
  };
})();
