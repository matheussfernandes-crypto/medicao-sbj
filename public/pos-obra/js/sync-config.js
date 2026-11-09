/* ---------- Ligação com o banco de dados ----------
   O site funciona 100% sem internet e guarda tudo no aparelho. O servidor (site Engenharia SBJ, rotas
   /api/pos-obra/...) é só a cópia compartilhada. A fila de envio (js/sync.js) usa estas funções:

   window.SBJ_ADAPTER = {
     // Envia UMA vistoria completa (apartamento, pendências, assinaturas, termo...). "Idempotente":
     // enviar de novo a mesma vistoria só atualiza, nunca duplica. A chave natural é obra + apartamento + data.
     // "buscarFoto(id)" devolve o arquivo (Blob) de uma foto, para enviar junto.
     async enviarVistoria(vistoria, buscarFoto) { ... },
     // Traz do servidor as vistorias novas ou alteradas por outras pessoas, no mesmo formato
     // (as fotos já ficam guardadas no aparelho).
     async receberVistorias(desdeISO) { return [ ... ]; },
     // Obras, clientes e fornecedores ("obras" | "clientes" | "fornecedores").
     async receberCadastro(tipo, desdeISO) { return { agora, registros, excluidos }; },
     async enviarCadastro(tipo, registros, excluidos) { ... },
   };

   Login: usa a sessão do site (cookie). Sem login a API responde 401 e a fila espera. */
(function () {
  const API = "/api/pos-obra";

  async function pedir(url, opcoes) {
    let r;
    try {
      r = await fetch(url, { credentials: "include", cache: "no-store", ...(opcoes || {}) });
    } catch (e) {
      throw new Error("Sem conexão com o servidor");
    }
    if (r.status === 401 || r.status === 403) { const e = new Error("Sessão expirada: entre no site de novo"); e.login = true; throw e; }
    let corpo = null;
    try { corpo = await r.json(); } catch (e) { /* resposta sem JSON */ }
    if (!r.ok || !corpo) throw new Error((corpo && corpo.error) || `Erro do servidor (${r.status})`);
    return corpo;
  }
  const json = (dados) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) });

  window.SBJ_ADAPTER = {
    ultimaAgora: null,   // hora do servidor da última recepção de vistorias (o sync.js usa como próximo "desde")

    async enviarVistoria(vistoria, buscarFoto) {
      delete vistoria.sync;
      const r = await pedir(`${API}/vistorias`, json(vistoria));
      for (const id of r.fotosFaltando || []) {
        const blob = await buscarFoto(id);
        if (!blob) continue;   // foto apagada neste aparelho: não há o que subir
        const fd = new FormData();
        fd.append("id", id);
        fd.append("arquivo", blob, id + ".jpg");
        await pedir(`${API}/fotos`, { method: "POST", body: fd });
      }
    },

    async receberVistorias(desdeISO) {
      const r = await pedir(`${API}/vistorias${desdeISO ? "?desde=" + encodeURIComponent(desdeISO) : ""}`);
      if (r.fotos && Object.keys(r.fotos).length && typeof vtfReceber === "function") await vtfReceber(r.fotos);
      this.ultimaAgora = r.agora || null;
      return r.vistorias || [];
    },

    async receberCadastro(tipo, desdeISO) {
      return pedir(`${API}/${tipo}${desdeISO ? "?desde=" + encodeURIComponent(desdeISO) : ""}`);
    },

    async enviarCadastro(tipo, registros, excluidos) {
      return pedir(`${API}/${tipo}`, json({ registros, excluidos }));
    },
  };
})();

window.SBJ_MODULOS_OCULTOS = ["dashboard", "tickets", "modifications", "agenda", "reports"];
