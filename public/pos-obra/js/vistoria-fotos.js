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

/* foto em tela cheia. Com mais de uma foto: setas, deslizar com o dedo e setas do teclado. */
function vtfAmpliar(id, ids) {
  const lista = ids && ids.length ? ids.slice() : [id];
  let i = Math.max(0, lista.indexOf(id));
  const antiga = document.getElementById("vtf-ampliada"); if (antiga) antiga.remove();
  const fundo = document.createElement("div");
  fundo.id = "vtf-ampliada"; fundo.className = "vtf-amp";
  const varias = lista.length > 1;
  fundo.innerHTML = `<button type="button" class="vtf-amp-x" aria-label="Fechar foto">×</button>${varias ? `<button type="button" class="vtf-amp-seta esq" aria-label="Foto anterior">‹</button><button type="button" class="vtf-amp-seta dir" aria-label="Próxima foto">›</button><span class="vtf-amp-cont"></span>` : ""}<img alt="Foto ampliada">`;
  document.body.appendChild(fundo);
  const img = fundo.querySelector("img"), cont = fundo.querySelector(".vtf-amp-cont");
  const mostrar = (k) => {
    i = (k + lista.length) % lista.length;
    img.classList.add("trocando");
    vtfUrl(lista[i]).then(u => { if (u) img.src = u; img.classList.remove("trocando"); });
    if (cont) cont.textContent = (i + 1) + " / " + lista.length;
  };
  const fechar = () => { document.removeEventListener("keydown", tecla); fundo.remove(); };
  const tecla = (e) => {
    if (e.key === "Escape") fechar();
    if (varias && e.key === "ArrowLeft") mostrar(i - 1);
    if (varias && e.key === "ArrowRight") mostrar(i + 1);
  };
  document.addEventListener("keydown", tecla);
  fundo.addEventListener("click", e => { if (e.target === fundo) fechar(); });
  fundo.querySelector(".vtf-amp-x").onclick = fechar;
  if (varias) {
    fundo.querySelector(".esq").onclick = e => { e.stopPropagation(); mostrar(i - 1); };
    fundo.querySelector(".dir").onclick = e => { e.stopPropagation(); mostrar(i + 1); };
    let x0 = null;
    fundo.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
    fundo.addEventListener("touchend", e => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) mostrar(dx < 0 ? i + 1 : i - 1);
    }, { passive: true });
  }
  mostrar(i);
}

/* ---------- para o PDF ---------- */
async function vtfDataUrl(id) {
  const b = await vtfGet(id); if (!b) return "";
  return new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
}
function vtfDim(url) { return new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth || 4, h: i.naturalHeight || 3 }); i.onerror = () => res({ w: 4, h: 3 }); i.src = url; }); }

/* seção "Fotos das pendências" no fim do PDF: duas por linha, com apto, ambiente, serviço e observação */
async function vtfPdfFotos(doc, cabecalho, grupos, { M, pw, ph, topo }) {
  const fotos = []; grupos.forEach(g => g.ids.forEach(id => fotos.push({ id, titulo: g.titulo, texto: g.texto })));
  if (!fotos.length) return;
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
    doc.addImage(url, "JPEG", x, y, w, h);
    doc.setDrawColor(205, 212, 218); doc.setLineWidth(0.2); doc.rect(x, y, w, h);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.2); doc.setTextColor(6, 27, 30); doc.text(doc.splitTextToSize(f.titulo, colW)[0], x, y + h + 4.6);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.8); doc.setTextColor(70, 80, 88); doc.text(doc.splitTextToSize(f.texto || "", colW).slice(0, 3), x, y + h + 9);
    if (col === 1) { y += maxH + capH; col = 0; } else col = 1;
  }
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
