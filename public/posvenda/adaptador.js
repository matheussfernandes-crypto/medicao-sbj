/* Ponte entre o Pós-venda (HTML do kit) e o site da engenharia.
   O kit foi escrito para o ambiente do Claude (window.claude). Aqui o mesmo contrato é atendido
   pelas rotas /api/posvenda, com o login do site. As telas do kit não foram alteradas. */
(function () {
  const API = "/api/posvenda";
  const cache = {};      // coleção -> [{id, dados}]
  const texto = {};      // coleção -> JSON da última leitura (para só redesenhar quando mudar)
  const assinantes = {}; // coleção -> [{doc, ok, erro}]
  let usuario = null;
  let perfis = null;

  async function pedir(metodo, url, corpo) {
    const r = await fetch(url, {
      method: metodo,
      credentials: "same-origin",
      cache: "no-store",
      headers: corpo ? { "Content-Type": "application/json" } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (!r.ok) {
      const e = new Error("HTTP " + r.status);
      e.code = r.status === 401 || r.status === 403 ? "invalid_argument" : "unavailable";
      throw e;
    }
    return r.json();
  }

  /* ---------- banco: coleções e documentos no estilo do kit ---------- */
  function snapColecao(col) {
    const lista = cache[col] || [];
    return { docs: lista.map((i) => ({ id: i.id, data: () => i.dados })), metadata: { fromCache: false } };
  }
  function snapDoc(col, id) {
    const item = (cache[col] || []).find((i) => i.id === id);
    return { exists: !!item, data: () => (item ? item.dados : undefined), metadata: { fromCache: false } };
  }
  function avisar(col) {
    (assinantes[col] || []).forEach((a) => {
      try { a.ok(a.doc ? snapDoc(col, a.doc) : snapColecao(col)); } catch (e) { console.error(e); }
    });
  }
  async function atualizar(col, forcar) {
    const novo = await pedir("GET", API + "/" + col);
    const t = JSON.stringify(novo);
    if (!forcar && texto[col] === t) return;
    texto[col] = t;
    cache[col] = novo;
    avisar(col);
  }
  function assinar(col, doc, ok, erro) {
    const a = { doc: doc, ok: ok, erro: erro };
    (assinantes[col] = assinantes[col] || []).push(a);
    atualizar(col, true).catch((e) => { if (erro) erro(e); });
    return () => { assinantes[col] = (assinantes[col] || []).filter((x) => x !== a); };
  }
  // o que outra pessoa gravar aparece em até 10 s (só com a aba visível)
  setInterval(() => {
    if (document.hidden) return;
    Object.keys(assinantes).filter((c) => assinantes[c].length).forEach((c) => atualizar(c, false).catch(() => {}));
  }, 10000);

  function novoId() {
    const u = window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    return u.replace(/-/g, "");
  }
  function ref(col, id) {
    return {
      id: id,
      async set(dados) { await pedir("POST", API + "/" + col, { id: id, dados: dados, modo: "set" }); await atualizar(col, true); },
      async update(dados) { await pedir("POST", API + "/" + col, { id: id, dados: dados, modo: "merge" }); await atualizar(col, true); },
      async delete() { await pedir("DELETE", API + "/" + col + "?id=" + encodeURIComponent(id)); await atualizar(col, true); },
      onSnapshot(ok, erro) { return assinar(col, id, ok, erro); },
    };
  }
  const db = {
    collection: (nome) => ({
      doc: (id) => ref(nome, id || novoId()),
      onSnapshot: (ok, erro) => assinar(nome, null, ok, erro),
    }),
    doc: (caminho) => { const p = String(caminho).split("/"); return ref(p[0], p[1]); },
  };

  /* ---------- usuário logado no site ---------- */
  async function eu() { if (!usuario) usuario = await pedir("GET", API + "/eu"); return usuario; }
  const user = {
    id: async () => (await eu()).id,
    profiles: async (ids) => {
      if (!perfis) perfis = await pedir("GET", API + "/perfis");
      const out = {};
      (ids || []).forEach((i) => { const p = perfis.find((x) => x.id === i); if (p) out[i] = { name: p.nome }; });
      return out;
    },
  };

  /* ---------- fotos: reduzidas no aparelho antes de enviar ---------- */
  function reduzir(arquivo) {
    return new Promise((ok, falha) => {
      const img = new Image();
      const url = URL.createObjectURL(arquivo);
      img.onload = () => {
        const k = Math.min(1, 1400 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(url); falha(new Error("imagem")); };
      img.src = url;
    });
  }
  const assets = {
    upload: async (arquivo) => {
      const imagem = await reduzir(arquivo);
      const r = await pedir("POST", API + "/foto", { imagem: imagem });
      return { id: r.id };
    },
  };

  /* ---------- download comum do navegador ---------- */
  const downloads = {
    save: async ({ filename, data }) => {
      const tipo = /\.csv$/i.test(filename) ? "text/csv;charset=utf-8" : /\.json$/i.test(filename) ? "application/json;charset=utf-8" : "text/plain;charset=utf-8";
      const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: tipo }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    },
  };

  /* ---------- ditado por voz (Chrome e Android); sem suporte, o botão some ---------- */
  function ditado() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    let rec = null, ativo = false;
    const fins = [], parciais = [], estados = [];
    const estado = (s) => estados.forEach((f) => f({ state: s }));
    return {
      active: () => ativo,
      start: () => new Promise((ok, falha) => {
        if (ativo) return ok();
        rec = new SR();
        rec.lang = "pt-BR";
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (e) => {
          let parcial = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) fins.forEach((f) => f({ text: t.trim() }));
            else parcial += t;
          }
          parciais.forEach((f) => f({ text: parcial }));
        };
        rec.onerror = (ev) => {
          ativo = false;
          estado("idle");
          falha({ code: ev.error === "not-allowed" ? "not_granted" : ev.error === "no-speech" || ev.error === "aborted" ? "stopped" : "unavailable" });
        };
        rec.onend = () => { ativo = false; estado("idle"); };
        try { rec.start(); } catch (e) { return falha({ code: "unavailable" }); }
        ativo = true;
        estado("listening");
        ok();
      }),
      stop: () => { if (rec) rec.stop(); },
      onFinal: (f) => fins.push(f),
      onPartial: (f) => parciais.push(f),
      onState: (f) => estados.push(f),
    };
  }

  const servicos = { db: db, user: user, assets: assets, downloads: downloads, dictation: ditado() };
  window.claude = { use: async (nome) => servicos[nome] || null };

  /* ---------- restaurar um backup (.json) gerado pela tela de Cópia de segurança ---------- */
  window.posvendaRestaurar = async (input) => {
    const arq = input.files && input.files[0];
    input.value = "";
    if (!arq) return;
    const aviso = (m) => (typeof window.toast === "function" ? window.toast(m) : alert(m));
    let j;
    try { j = JSON.parse(await arq.text()); } catch (e) { return aviso("Esse arquivo não é um backup válido."); }
    if (!j || !String(j.sistema || "").startsWith("Central Pós-Venda")) return aviso("Esse arquivo não é um backup do Pós-venda.");
    const n = (j.unidades || []).length, c = (j.chamados || []).length, v = (j.agenda || []).length;
    if (!confirm("Restaurar " + arq.name + "?\n\n" + n + " unidades, " + c + " chamados e " + v + " visitas.\nRegistros com o mesmo id são substituídos; os que não estão no arquivo continuam como estão.")) return;
    const colecoes = {
      empreendimentos: j.empreendimentos || [],
      unidades: j.unidades || [],
      responsaveis: j.responsaveis || [],
      chamados: j.chamados || [],
      agenda: j.agenda || [],
      config: j.config || {},
    };
    try {
      aviso("Restaurando o backup…");
      await pedir("POST", API + "/lote", { colecoes: colecoes });
      for (const col of Object.keys(colecoes)) await atualizar(col, true);
      aviso("Backup restaurado.");
    } catch (e) {
      aviso("Não consegui restaurar o backup. Tente de novo.");
    }
  };
})();
