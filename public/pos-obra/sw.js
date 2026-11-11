/* Service worker: deixa o site abrir e funcionar SEM INTERNET depois da primeira visita.
   (Arquivo gerado por gerar-sw.py a partir de sw.modelo.js. Só funciona em endereço seguro: https:// ou localhost.) */
const VERSAO = "a1b9ea39d8";
const CACHE = "posobra-" + VERSAO;
const CACHE_EXTRA = "posobra-extra"; // fontes e outros arquivos de fora
const ARQUIVOS = [
  "./",
  "assets/apple-touch-icon.png",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/logo-sbj-claro.png",
  "assets/logo-sbj-pdf.png",
  "assets/logo-sbj.png",
  "assets/logo-sbj.svg",
  "css/intro.css",
  "css/mobile.css",
  "css/redesign.css",
  "css/style.css",
  "data/vistorias-ilha-do-campeche.json",
  "index.html",
  "js/agenda.js",
  "js/app.js",
  "js/assinatura.js",
  "js/attachments.js",
  "js/building-detail.js",
  "js/clients-seed.js",
  "js/data.js",
  "js/dropdown.js",
  "js/import.js",
  "js/intro-data.js",
  "js/intro.js",
  "js/lib/jspdf.plugin.autotable.min.js",
  "js/lib/jspdf.umd.min.js",
  "js/lib/pdf.min.js",
  "js/lib/pdf.worker.min.js",
  "js/lib/xlsx.full.min.js",
  "js/maintenance.js",
  "js/manual-import.js",
  "js/modifications.js",
  "js/modulos.js",
  "js/navegacao.js",
  "js/quickcapture.js",
  "js/reports.js",
  "js/seg-deslize.js",
  "js/sidebar.js",
  "js/suppliers.js",
  "js/sync-config.js",
  "js/sync.js",
  "js/tema-escuro.js",
  "js/ticket-cockpit.js",
  "js/ticket-novo.js",
  "js/tickets.js",
  "js/vistoria-folha.js",
  "js/vistoria-fotos.js",
  "js/vistorias.js",
  "js/warranty.js",
  "manifest.webmanifest"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(chaves => Promise.all(chaves.filter(k => k.startsWith("posobra-") && k !== CACHE && k !== CACHE_EXTRA).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* arquivos do próprio site: tenta a internet (para pegar atualização); sem internet, usa o que está guardado */
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r && r.ok) { const c = await caches.open(CACHE); c.put(req, r.clone()); }
        return r;
      } catch (erro) {
        const guardado = await caches.match(req, { ignoreSearch: true });
        if (guardado) return guardado;
        if (req.mode === "navigate") { const home = await caches.match("./", { ignoreSearch: true }) || await caches.match("index.html", { ignoreSearch: true }); if (home) return home; }
        return new Response("Sem conexão e este arquivo ainda não foi guardado.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  /* fontes e bibliotecas de fora: usa o guardado e atualiza em segundo plano */
  e.respondWith((async () => {
    const c = await caches.open(CACHE_EXTRA);
    const guardado = await c.match(req);
    const rede = fetch(req).then(r => { if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; }).catch(() => null);
    return guardado || (await rede) || new Response("", { status: 504 });
  })());
});
