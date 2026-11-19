/* ---------- Fotos das pendências ----------
   As fotos ficam no próprio aparelho (IndexedDB), reduzidas para um tamanho leve (até 1280px, JPEG).
   Cada pendência guarda só os códigos das fotos (item.fotos = ["f1abc", ...]). */

let vtfDbP = null;
function vtfAbrirDb() {
  if (vtfDbP) return vtfDbP;
  vtfDbP = new Promise((res, rej) => {
    const rq = indexedDB.open("posvenda_fotos", 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore("fotos");
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
  return vtfDbP;
}
async function vtfPut(id, blob) { const db = await vtfAbrirDb(); return new Promise((res, rej) => { const tx = db.transaction("fotos", "readwrite"); tx.objectStore("fotos").put(blob, id); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
async function vtfGet(id) { const db = await vtfAbrirDb(); return new Promise((res, rej) => { const rq = db.transaction("fotos").objectStore("fotos").get(id); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => rej(rq.error); }); }
async function vtfDel(id) { try { const db = await vtfAbrirDb(); await new Promise((res) => { const tx = db.transaction("fotos", "readwrite"); tx.objectStore("fotos").delete(id); tx.oncomplete = () => res(); tx.onerror = () => res(); }); } catch (e) { /* ignora */ } if (vtfUrls.has(id)) { URL.revokeObjectURL(vtfUrls.get(id)); vtfUrls.delete(id); } }

async function vtfComprimir(arquivo, max = 1280, qualidade = 0.72) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("imagem")); i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(b => res(b), "image/jpeg", qualidade));
  } finally { URL.revokeObjectURL(url); }
}

/* abre a câmera (no celular) ou o seletor de arquivos (no computador); devolve o código da foto ou null */
function vtfTirarFoto() {
  return new Promise(res => {
    const i = document.createElement("input");
    i.type = "file"; i.accept = "image/*"; i.setAttribute("capture", "environment"); i.style.display = "none";
    document.body.appendChild(i);
    i.addEventListener("change", async () => {
      const f = i.files[0]; i.remove();
      if (!f) { res(null); return; }
      try {
        const blob = await vtfComprimir(f);
        const id = "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        await vtfPut(id, blob);
        res(id);
      } catch (e) { toast("Não consegui usar essa foto.", "error"); res(null); }
    });
    i.addEventListener("cancel", () => { i.remove(); res(null); });
    i.click();
  });
}

const vtfUrls = new Map();
async function vtfUrl(id) {
  if (vtfUrls.has(id)) return vtfUrls.get(id);
  try { const b = await vtfGet(id); if (!b) return ""; const u = URL.createObjectURL(b); vtfUrls.set(id, u); return u; } catch (e) { return ""; }
}
function vtfHidratar(raiz) { (raiz || document).querySelectorAll("img[data-foto]").forEach(async img => { if (!img.src) img.src = await vtfUrl(img.dataset.foto); }); }

/* miniaturas clicáveis; "chave" diz de qual pendência são (o chamador usa para abrir a galeria) */
function vtfThumbs(ids, chave) {
  if (!ids || !ids.length) return "";
  return `<div class="vtf-thumbs">${ids.map(id => `<button type="button" class="vtf-th" data-vtf-abrir="${escapeHtml(chave)}" aria-label="Ver foto"><img data-foto="${id}" alt="Foto da pendência"></button>`).join("")}</div>`;
}

/* galeria de uma pendência: ver, tirar outra, remover. "ids" é a lista da própria pendência (é alterada aqui). */
function vtfGaleria({ titulo, ids, aoMudar }) {
  const desenhar = () => {
    openModal(`
      <div class="modal-header"><h3>${escapeHtml(titulo)}</h3><button class="modal-close" id="vtf-x" aria-label="Fechar">×</button></div>
      <div class="modal-body">
        ${ids.length ? `<div class="vtf-grade">${ids.map(id => `<figure><button type="button" class="vtf-foto-btn" data-vtf-ver="${id}" aria-label="Ver foto maior"><img data-foto="${id}" alt="Foto"></button><button type="button" class="btn ghost small" data-vtf-del="${id}">Remover</button></figure>`).join("")}</div>` : `<p class="hint">Nenhuma foto ainda.</p>`}
      </div>
      <div class="modal-footer"><button class="btn ghost" id="vtf-fechar">Fechar</button><button class="btn primary" id="vtf-add">${typeof ckIco === "function" ? ckIco("camera", 18) : ""} Tirar foto</button></div>`, true);
    const $ = id => document.getElementById(id);
    $("vtf-x").onclick = $("vtf-fechar").onclick = closeModal;
    $("vtf-add").onclick = async () => { const id = await vtfTirarFoto(); if (id) { ids.push(id); aoMudar(); desenhar(); } };
    document.querySelectorAll("[data-vtf-del]").forEach(b => b.onclick = async () => {
      if (!confirm("Remover esta foto?")) return;
      const k = ids.indexOf(b.dataset.vtfDel); if (k >= 0) ids.splice(k, 1);
      await vtfDel(b.dataset.vtfDel); aoMudar(); desenhar();
    });
    vtfHidratar(document.getElementById("modal-root"));
    document.querySelectorAll("[data-vtf-ver]").forEach(b => b.onclick = () => vtfAmpliar(b.dataset.vtfVer, ids));
  };
  desenhar();
}

/* Visualizador de fotos em tela cheia. Várias fotos: deslizar, setas, miniaturas embaixo e contador "2 / 4".
   Duplo toque aproxima (arraste para mover); de novo, volta. opc (opcional):
   { titulo, sub, feito: () => bool, aoResolver: () => bool (novo estado), aoRemover: async (id) => void }
   Com aoResolver, o botão de resolvida fica dentro do visualizador: dá para conferir a foto e marcar sem fechar. */
const VTFV_ICO = {
  ok: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  lixo: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>'
};
function vtfAmpliar(id, ids, opc) {
  opc = opc || {};
  let lista = ids && ids.length ? ids.slice() : [id];
  let i = Math.max(0, lista.indexOf(id)), z = 0;
  const antiga = document.getElementById("vtf-ampliada"); if (antiga) antiga.remove();
  const fundo = document.createElement("div");
  fundo.id = "vtf-ampliada"; fundo.className = "vtfv"; fundo.setAttribute("role", "dialog"); fundo.setAttribute("aria-modal", "true"); fundo.setAttribute("aria-label", "Fotos da pendência"); fundo.tabIndex = -1;
  document.body.appendChild(fundo);
  const fechar = () => { document.removeEventListener("keydown", tecla); fundo.classList.add("saindo"); setTimeout(() => fundo.remove(), 160); };
  const tecla = (e) => {
    if (e.key === "Escape") fechar();
    if (e.key === "ArrowLeft") ir(i - 1, true);
    if (e.key === "ArrowRight") ir(i + 1, true);
  };
  let car = null, minis = [], cont = null;
  const marca = () => {
    if (cont) cont.textContent = (i + 1) + " / " + lista.length;
    minis.forEach((m, k) => m.classList.toggle("on", k === i));
    if (minis[i] && minis[i].scrollIntoView) minis[i].scrollIntoView({ inline: "center", block: "nearest" });
    const p = fundo.querySelector(".vtfv-seta.e"), d = fundo.querySelector(".vtfv-seta.d");
    if (p) p.disabled = i === 0; if (d) d.disabled = i === lista.length - 1;
  };
  const resetZoom = () => { z = 0; if (car) { car.classList.remove("zoom"); car.querySelectorAll("img").forEach(m => { m.style.transform = ""; }); } };
  function ir(k, suave) {
    i = Math.max(0, Math.min(lista.length - 1, k)); resetZoom();
    if (car) car.scrollTo({ left: i * car.clientWidth, behavior: suave && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" });
    marca();
  }
  function montar() {
    const n = lista.length;
    fundo.innerHTML = `
      <div class="vtfv-top"><div class="vtfv-info"><b>${escapeHtml(opc.titulo || "Foto")}</b>${opc.sub ? `<span>${escapeHtml(opc.sub)}</span>` : ""}</div>
        ${opc.aoRemover ? `<button type="button" class="vtfv-ib" data-rem aria-label="Remover esta foto">${VTFV_ICO.lixo}</button>` : ""}
        <button type="button" class="vtfv-ib" data-x aria-label="Fechar">×</button></div>
      <div class="vtfv-pista"><div class="vtfv-car">${lista.map((u, k) => `<div class="vtfv-sl"><img data-foto="${u}" alt="Foto ${k + 1} de ${n}" draggable="false"></div>`).join("")}</div>
        ${n > 1 ? `<button type="button" class="vtfv-seta e" aria-label="Foto anterior">‹</button><button type="button" class="vtfv-seta d" aria-label="Próxima foto">›</button>` : ""}
        <div class="vtfv-dica">${n > 1 ? "Deslize para ver as outras · " : ""}toque duas vezes para aproximar</div></div>
      <div class="vtfv-base">
        ${n > 1 ? `<div class="vtfv-tira">${lista.map((u, k) => `<button type="button" class="vtfv-mini" aria-label="Ir para a foto ${k + 1}"><img data-foto="${u}" alt=""></button>`).join("")}</div>` : ""}
        <div class="vtfv-acao"><span class="vtfv-cont"></span>${opc.aoResolver ? `<button type="button" class="vtfv-res ${opc.feito && opc.feito() ? "on" : ""}" data-res aria-pressed="${!!(opc.feito && opc.feito())}">${VTFV_ICO.ok} <span>${opc.feito && opc.feito() ? "Resolvida (tocar para desfazer)" : "Marcar como resolvida"}</span></button>` : ""}</div>
      </div>`;
    vtfHidratar(fundo);
    car = fundo.querySelector(".vtfv-car"); cont = fundo.querySelector(".vtfv-cont"); minis = Array.from(fundo.querySelectorAll(".vtfv-mini"));
    fundo.querySelector("[data-x]").onclick = fechar;
    const p = fundo.querySelector(".vtfv-seta.e"), d = fundo.querySelector(".vtfv-seta.d");
    if (p) p.onclick = () => ir(i - 1, true); if (d) d.onclick = () => ir(i + 1, true);
    minis.forEach((m, k) => m.onclick = () => ir(k, true));
    car.addEventListener("scroll", () => { const k = Math.round(car.scrollLeft / car.clientWidth); if (k !== i && !z) { i = k; marca(); } }, { passive: true });
    const res = fundo.querySelector("[data-res]");
    if (res) res.onclick = () => {
      const novo = opc.aoResolver();
      res.classList.toggle("on", !!novo); res.setAttribute("aria-pressed", String(!!novo));
      res.querySelector("span").textContent = novo ? "Resolvida (tocar para desfazer)" : "Marcar como resolvida";
    };
    const rem = fundo.querySelector("[data-rem]");
    if (rem) rem.onclick = async () => {
      if (!confirm("Remover esta foto?")) return;
      const alvo = lista[i]; await opc.aoRemover(alvo);
      lista.splice(i, 1);
      if (!lista.length) { fechar(); return; }
      i = Math.min(i, lista.length - 1); montar();
    };
    /* aproximar: duplo toque (ou duplo clique) e arrastar */
    car.querySelectorAll(".vtfv-sl").forEach(sl => {
      const img = sl.querySelector("img"); let x = 0, y = 0, px = null, py = null;
      sl.addEventListener("dblclick", () => { if (z) { resetZoom(); return; } z = 2.4; car.classList.add("zoom"); x = y = 0; img.style.transform = `scale(${z})`; });
      sl.addEventListener("pointerdown", e => { if (!z) return; px = e.clientX; py = e.clientY; try { sl.setPointerCapture(e.pointerId); } catch (_) { /* segue */ } });
      sl.addEventListener("pointermove", e => { if (!z || px == null) return; x += (e.clientX - px) / z; y += (e.clientY - py) / z; px = e.clientX; py = e.clientY; img.style.transition = "none"; img.style.transform = `scale(${z}) translate(${x}px, ${y}px)`; });
      sl.addEventListener("pointerup", () => { px = null; img.style.transition = ""; });
    });
    let ult = 0;
    car.addEventListener("touchend", e => { const t = Date.now(); if (t - ult < 300) { const sl = e.target.closest(".vtfv-sl"); if (sl) sl.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); } ult = t; }, { passive: true });
    ir(i, false);
  }
  document.addEventListener("keydown", tecla);
  montar();
  fundo.focus({ preventScroll: true });
}

/* fotos de uma pendência dentro do card: uma foto grande, ou até três miniaturas + "Ver N fotos".
   "chave" identifica a pendência; o clique vem como data-vt-ver="chave:posição" e o chamador abre o visualizador. */
function vtfBloco(ids, chave) {
  const n = ids ? ids.length : 0; if (!n) return "";
  const k0 = escapeHtml(chave);
  const ft = (id, k, extra) => `<button type="button" class="vtfb-ft" data-vt-ver="${k0}:${k}" aria-label="Ampliar foto ${k + 1} de ${n}"><img data-foto="${id}" alt="Foto da pendência">${extra || ""}</button>`;
  if (n === 1) return `<div class="vtfb um">${ft(ids[0], 0, '<span class="vtfb-lupa">Ampliar</span>')}</div>`;
  return `<div class="vtfb">${ids.slice(0, 3).map((id, k) => ft(id, k, k === 2 && n > 3 ? `<span class="vtfb-mais">+${n - 3}</span>` : "")).join("")}</div>
    <button type="button" class="vtfb-ver" data-vt-ver="${k0}:0">${typeof ckIco === "function" ? ckIco("camera", 18) : ""} Ver ${n} fotos</button>`;
}

/* ---------- para o PDF ---------- */
async function vtfDataUrl(id) {
  const b = await vtfGet(id); if (!b) return "";
  return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
}
function vtfDim(url) { return new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth || 4, h: i.naturalHeight || 3 }); i.onerror = () => res({ w: 4, h: 3 }); i.src = url; }); }

/* seção "Fotos das pendências" no fim do PDF: duas por linha, com apto, ambiente, serviço e observação */
async function vtfPdfFotos(doc, cabecalho, grupos, { M, pw, ph, topo }) {
  const fotos = []; grupos.forEach(g => g.ids.forEach(id => fotos.push({ id, chave: g.chave, titulo: g.titulo, texto: g.texto })));
  const primeira = new Map();   // chave (apartamento) -> primeira página com foto dele
  if (!fotos.length) return primeira;
  const colW = (pw - 2 * M - 8) / 2, maxH = 80, capH = 17;
  doc.addPage(); cabecalho();
  let y = topo;
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(6, 27, 30); doc.text("Fotos das pendências", M, y + 4); y += 11;
  let col = 0;
  for (const f of fotos) {
    const url = await vtfDataUrl(f.id); if (!url) continue;
    const d = await vtfDim(url);
    let w = colW, h = w * d.h / d.w; if (h > maxH) { h = maxH; w = h * d.w / d.h; }
    if (col === 0 && y + maxH + capH > ph - 18) { doc.addPage(); cabecalho(); y = topo; }
    const x = M + col * (colW + 8);
    if (f.chave !== undefined && !primeira.has(f.chave)) primeira.set(f.chave, doc.internal.getCurrentPageInfo().pageNumber);
    doc.addImage(url, "JPEG", x, y, w, h);
    doc.setDrawColor(205, 212, 218); doc.setLineWidth(0.2); doc.rect(x, y, w, h);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.2); doc.setTextColor(6, 27, 30); doc.text(doc.splitTextToSize(f.titulo, colW)[0], x, y + h + 4.6);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.8); doc.setTextColor(70, 80, 88); doc.text(doc.splitTextToSize(f.texto || "", colW).slice(0, 3), x, y + h + 9);
    if (col === 1) { y += maxH + capH; col = 0; } else col = 1;
  }
  return primeira;
}

/* ---------- levar as fotos junto ao passar vistorias para outro aparelho ---------- */
async function vtfColetar(ids) {
  const out = {};
  for (const id of new Set(ids)) { const u = await vtfDataUrl(id); if (u) out[id] = u; }
  return out;
}
async function vtfReceber(mapa) {
  if (!mapa) return 0;
  let n = 0;
  for (const [id, url] of Object.entries(mapa)) {
    try { if (await vtfGet(id)) continue; const b = await (await fetch(url)).blob(); await vtfPut(id, b); n++; } catch (e) { /* segue */ }
  }
  return n;
}
