/* Service worker: deixa o site abrir e funcionar SEM INTERNET depois da primeira visita.
   (Arquivo gerado por gerar-sw.py a partir de sw.modelo.js. Só funciona em endereço seguro: https:// ou localhost.) */
const VERSAO = "__VERSAO__";
const CACHE = "posobra-" + VERSAO;
const CACHE_EXTRA = "posobra-extra"; // fontes e outros arquivos de fora
const ARQUIVOS = __ARQUIVOS__;

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
