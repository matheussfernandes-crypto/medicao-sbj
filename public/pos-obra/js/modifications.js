/* ---------- Modificações de apartamento ---------- */
/* Mesma filosofia de tickets.js: um registro grande e coeso por modificação,
   histórico append-only, status sempre mudado explicitamente por uma ação
   (nunca inferido/automático) — "enviado pra obra" nunca vira "executado"
   sozinho, "conferido" nunca é pulado. */

function getModification(id) { return state.modifications.find(m => m.id === id); }
function modificationsForUnit(buildingId, unit, excludeId) {
  return state.modifications
    .filter(m => m.buildingId === buildingId && m.unit === unit && m.id !== excludeId)
    .sort((a, b) => b.dataSolicitacao.localeCompare(a.dataSolicitacao));
}
function nextModificationCode() {
  const code = "MOD-" + String(state.modificationSeq).padStart(4, "0");
  state.modificationSeq++;
  return code;
}
function versionLabel(n) { return "V" + String(n).padStart(2, "0"); }

/* Categoria não é mais perguntada ao usuário — sempre derivada do que foi
   marcado em "O que será modificado?" (MAP_ITEM_TO_CATEGORIA, data.js). */
function deriveCategoriasFromItens(itensMapa) {
  const set = new Set();
  (itensMapa || []).forEach(item => set.add(MAP_ITEM_TO_CATEGORIA[item] || item));
  return [...set];
}

function addModificationHistoryEntry(m, action, note, statusFrom, statusTo) {
  m.history.push({
    date: new Date().toISOString(),
    user: ensureOperatorName(),
    action, note: note || "",
    statusFrom: statusFrom || "", statusTo: statusTo || "",
  });
}
function setModificationStatus(m, newStatus, action, note) {
  const from = m.status;
  m.status = newStatus;
  addModificationHistoryEntry(m, action, note, from, newStatus);
}

/* Exclusão de verdade (some do sistema) só é permitida enquanto a modificação
   ainda não saiu do estágio inicial — sem nenhuma ação real registrada além da
   própria criação. A partir do primeiro passo real (viabilidade, orçamento,
   qualquer mudança de status), só "Cancelar" fica disponível, preservando o
   registro — princípio da Bíblia do Sistema (seção 29 / EXCEÇÃO 05 / CASO D):
   excluir não é a solução padrão pra encerrar uma modificação. */
function modificacaoPodeExcluir(m) {
  return m.status === "solicitacao_recebida" && (m.history || []).length <= 1;
}

/* ---------- Cálculo de orçamento (puro, não persiste nada) ---------- */

/* Sugestão automática pro orçamento: serviços da tabela de preços cuja
   categoria bate com o que já foi marcado em "O que será modificado?" —
   elimina a redigitação/reseleção manual que existia antes. */
function calcularOrcamentoSugerido(m) {
  return state.priceTable.filter(p => p.ativo && m.categorias.includes(p.categoria));
}

function calcularVersaoOrcamento(versao) {
  const totalParametrizados = (versao.itensParametrizados || []).reduce((s, i) => s + i.quantidade * i.valorUnit, 0);
  const totalPersonalizados = (versao.itensPersonalizados || []).reduce((s, i) => s + (i.quantidade || 1) * i.valor, 0);
  const totalAdicionais = totalParametrizados + totalPersonalizados;
  const totalCreditos = (versao.creditos || []).reduce((s, c) => s + c.valor, 0);
  return { totalAdicionais, totalCreditos, resultado: totalAdicionais - totalCreditos };
}

/* ---------- Nova modificação ---------- */

function openModificationForm() {
  if (!state.buildings.length) { toast("Cadastre um empreendimento antes de abrir uma modificação.", "error"); return; }
  openModal(`
    <div class="modal-header">
      <h2>Nova modificação</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <form id="modification-form">
        <div class="form-grid">
          <div class="field full">
            <label>Tipo de modificação</label>
            <select name="tipoEspecial" id="mod-form-tipo-especial">
              <option value="">Padrão</option>
              ${Object.entries(MODIFICATION_TIPOS_ESPECIAIS).map(([id, cfg]) => `<option value="${id}">${escapeHtml(cfg.label)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Empreendimento</label>
            <select name="buildingId" id="mod-form-building" required>
              <option value="">Selecione</option>
              ${state.buildings.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Unidade</label>
            <input type="text" name="unit" id="mod-form-unit" required placeholder="Ex: 804">
          </div>
          <div class="field full" id="mod-form-client-preview"></div>
          <div class="field">
            <label>Data da solicitação</label>
            <input type="date" name="dataSolicitacao" value="${todayISODate()}" required>
          </div>
          <div class="field">
            <label>Quem recebeu</label>
            <input type="text" name="recebidoPor" value="${escapeHtml(getOperatorName())}">
          </div>
          <div class="field full">
            <label>O que será modificado? <span class="hint">(pode marcar mais de um — se ainda não souber, deixe em branco e marque depois na ficha)</span></label>
            <div class="checkbox-group">${state.mapItems.map(i => `<label class="checkbox-inline"><input type="checkbox" name="itensMapa" value="${escapeHtml(i)}"> ${escapeHtml(i)}</label>`).join("")}</div>
          </div>
          <div class="field full">
            <label>Abrangência da modificação</label>
            <div class="checkbox-group">
              <label class="checkbox-inline"><input type="radio" name="abrangenciaTipo" value="especifico" id="mod-form-abrangencia-especifico" checked> Ambiente(s) específico(s)</label>
              <label class="checkbox-inline"><input type="radio" name="abrangenciaTipo" value="apartamento_inteiro" id="mod-form-abrangencia-inteiro"> Apartamento inteiro</label>
            </div>
          </div>
          <div class="field full" id="mod-form-ambientes-field">
            <label>Ambientes</label>
            <div class="checkbox-group">${state.modificationAmbientes.map(a => `<label class="checkbox-inline"><input type="checkbox" name="ambientes" value="${escapeHtml(a)}"> ${escapeHtml(a)}</label>`).join("")}</div>
          </div>
          <div class="field full">
            <label>Solicitação do cliente (texto original — não poderá ser editado depois de salvo)</label>
            <textarea name="solicitacaoTexto" required placeholder="Ex: Cliente solicita retirada da parede entre cozinha e sala e alteração dos pontos de iluminação."></textarea>
          </div>
        </div>
        <div id="mod-form-historico-unidade"></div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn ghost" data-close>Cancelar</button>
      <button class="btn primary" id="btn-save-modification">Criar modificação</button>
    </div>
  `, true);
  wireModalClose();

  const buildingSel = document.getElementById("mod-form-building");
  const unitInput = document.getElementById("mod-form-unit");
  function refreshUnitContext() {
    const buildingId = buildingSel.value;
    const unit = unitInput.value.trim();
    const previewBox = document.getElementById("mod-form-client-preview");
    const histBox = document.getElementById("mod-form-historico-unidade");
    if (!buildingId || !unit) { previewBox.innerHTML = ""; histBox.innerHTML = ""; return; }
    const client = state.clients.find(c => c.buildingId === buildingId && c.unit === unit);
    previewBox.innerHTML = client
      ? `<div class="hint">Cliente: <strong>${escapeHtml(client.name || "sem nome cadastrado")}</strong> · ${escapeHtml(client.phone || "sem telefone")}</div>`
      : `<div class="hint">Nenhum cliente cadastrado para esta unidade ainda.</div>`;
    const previous = modificationsForUnit(buildingId, unit);
    histBox.innerHTML = previous.length ? `
      <h4 class="form-section-title">Modificações anteriores desta unidade (${previous.length})</h4>
      <div class="table-wrap">
        <table class="mini-table">
          <thead><tr><th>Nº</th><th>Data</th><th>Solicitação</th><th>Status</th></tr></thead>
          <tbody>${previous.map(m => `<tr data-open-mod-inline="${m.id}" style="cursor:pointer;">
            <td>${m.code}</td><td>${fmtDate(m.dataSolicitacao)}</td>
            <td>${escapeHtml((m.solicitacaoTexto || "").slice(0, 50))}${(m.solicitacaoTexto || "").length > 50 ? "…" : ""}</td>
            <td><span class="badge mod-status-${m.status}">${MODIFICATION_STATUS_MAP[m.status].label}</span></td>
          </tr>`).join("")}</tbody>
        </table>
      </div>` : "";
    histBox.querySelectorAll("[data-open-mod-inline]").forEach(el => el.addEventListener("click", () => { closeModal(); goToModificationDetail(el.dataset.openModInline); }));
  }
  buildingSel.addEventListener("change", refreshUnitContext);
  unitInput.addEventListener("input", refreshUnitContext);

  const ambientesField = document.getElementById("mod-form-ambientes-field");
  function refreshAbrangenciaField() {
    const especifico = document.getElementById("mod-form-abrangencia-especifico").checked;
    ambientesField.style.display = especifico ? "" : "none";
    if (!especifico) ambientesField.querySelectorAll('input[name=ambientes]').forEach(el => { el.checked = false; });
  }
  document.querySelectorAll('input[name=abrangenciaTipo]').forEach(el => el.addEventListener("change", refreshAbrangenciaField));

  document.getElementById("mod-form-tipo-especial").addEventListener("change", (e) => {
    const cfg = MODIFICATION_TIPOS_ESPECIAIS[e.target.value];
    if (!cfg) return;
    document.querySelectorAll('#modification-form input[name=itensMapa]').forEach(el => { el.checked = cfg.itensMapaPreSelecionados.includes(el.value); });
    if (cfg.abrangenciaPreSet.tipo === "especifico") {
      document.getElementById("mod-form-abrangencia-especifico").checked = true;
      refreshAbrangenciaField();
      document.querySelectorAll('#modification-form input[name=ambientes]').forEach(el => { el.checked = cfg.abrangenciaPreSet.ambientes.includes(el.value); });
    } else {
      document.getElementById("mod-form-abrangencia-inteiro").checked = true;
      refreshAbrangenciaField();
    }
  });

  document.getElementById("btn-save-modification").addEventListener("click", () => {
    const form = document.getElementById("modification-form");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const buildingId = fd.get("buildingId");
    const unit = fd.get("unit").trim();
    const client = state.clients.find(c => c.buildingId === buildingId && c.unit === unit);
    const itensMapa = fd.getAll("itensMapa");
    const abrangenciaTipo = fd.get("abrangenciaTipo");
    const m = {
      ...blankModification(),
      id: "mod" + Date.now() + Math.random().toString(36).slice(2, 6),
      code: nextModificationCode(),
      buildingId, unit, clientId: client ? client.id : "",
      dataSolicitacao: fd.get("dataSolicitacao"),
      recebidoPor: fd.get("recebidoPor").trim(),
      abrangencia: { tipo: abrangenciaTipo, ambientes: abrangenciaTipo === "especifico" ? fd.getAll("ambientes") : [] },
      categorias: deriveCategoriasFromItens(itensMapa),
      itensMapa,
      tipoEspecial: fd.get("tipoEspecial") || "",
      solicitacaoTexto: fd.get("solicitacaoTexto").trim(),
    };
    addModificationHistoryEntry(m, "Solicitação criada", "", "", m.status);
    state.modifications.push(m);
    persist();
    closeModal();
    toast(`${m.code} criada.`, "success");
    goToModificationDetail(m.id);
  });
}

/* ---------- Navegação ---------- */

function goToModificationDetail(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-modification-detail").classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === "modifications"));
  document.getElementById("view-title").textContent = "Ficha da modificação";
  document.getElementById("view-subtitle").textContent = id ? getModification(id)?.code || "" : "";
  renderModificationDetailView(id);
}

/* ---------- Ficha da modificação ---------- */

function renderModificationDetailView(id) {
  const m = getModification(id);
  const root = document.getElementById("modification-detail-root");
  if (!m) { root.innerHTML = `<div class="empty-hint">Modificação não encontrada.</div>`; return; }
  const b = getBuilding(m.buildingId);
  const client = m.clientId ? getClient(m.clientId) : null;
  const isClosed = MODIFICATION_CLOSED_STATUSES.includes(m.status);
  const outras = modificationsForUnit(m.buildingId, m.unit, m.id);
  const st = MODIFICATION_STATUS_MAP[m.status];
  const secoesAbertas = seccoesAbertas(m);

  root.innerHTML = `
    <h2 class="ticket-page-title">${m.code} — ${escapeHtml(b ? b.name : "—")} · ${escapeHtml(m.unit)}</h2>
    <div class="ticket-toolbar">
      <button class="btn ghost" id="btn-back-modification">← Voltar</button>
      <div class="ticket-toolbar-badges">
        <span class="badge mod-status-${m.status}">${st.icon} ${st.label}</span>
      </div>
      <div style="margin-left:auto; display:flex; gap:8px;">
        ${!isClosed ? `
          <button class="btn ghost small" id="btn-mod-nao-viavel">Marcar não viável</button>
          <button class="btn ghost small" id="btn-mod-recusada">Recusada pelo cliente</button>
          <button class="btn ghost small" id="btn-mod-cancelar">Cancelar modificação</button>
        ` : ""}
        ${modificacaoPodeExcluir(m) ? `<button class="btn danger" id="btn-delete-modification">Excluir modificação</button>` : ""}
      </div>
    </div>

    <div class="ticket-header-strip detail-info-grid">
      <div><div class="di-label">Empreendimento</div>${escapeHtml(b ? b.name : "—")}</div>
      <div><div class="di-label">Unidade</div>${escapeHtml(m.unit)}</div>
      <div><div class="di-label">Cliente</div>${client ? escapeHtml(client.name || "—") : '<span class="empty-hint">não cadastrado</span>'}</div>
      <div><div class="di-label">Data da solicitação</div>${fmtDate(m.dataSolicitacao)}</div>
      <div><div class="di-label">Quem recebeu</div>${escapeHtml(m.recebidoPor || "—")}</div>
      <div><div class="di-label">Abrangência</div>${m.abrangencia.tipo === "apartamento_inteiro" ? "Apartamento inteiro" : m.abrangencia.tipo === "especifico" ? (m.abrangencia.ambientes.map(escapeHtml).join(", ") || "—") : '<span class="empty-hint">não informada</span>'}</div>
      <div class="full">
        <div class="di-label">O que foi modificado</div>
        ${m.itensMapa.length ? m.itensMapa.map(i => `<span class="badge outline" style="margin:0 4px 4px 0;">${escapeHtml(i)}</span>`).join("") : '<span class="empty-hint">nenhum item marcado ainda</span>'}
        ${!isClosed ? `<button class="btn ghost small" id="btn-edit-itens-mapa" style="margin-left:8px;">Editar</button>` : ""}
      </div>
    </div>

    <div class="ticket-grid">
      <div class="ticket-main">

        <div class="ticket-section">
          <h3>Solicitação do cliente</h3>
          <p style="white-space:pre-wrap;">${escapeHtml(m.solicitacaoTexto)}</p>
          <div class="hint">Registrado por ${escapeHtml(m.history[0]?.user || "—")} em ${fmtDate(m.dataSolicitacao)}. Texto original — não é editável.</div>
        </div>

        ${detailsSection("viabilidade", "Viabilidade", resumoViabilidade(m), secoesAbertas.has("viabilidade"), detalheViabilidade(m))}
        ${detailsSection("orcamento", "Orçamento e Aprovação", resumoOrcamento(m), secoesAbertas.has("orcamento"), detalheOrcamento(m))}
        ${detailsSection("financeiro", "💵 Financeiro", resumoFinanceiro(m), secoesAbertas.has("financeiro"), detalheFinanceiro(m))}
        ${detailsSection("execucao", "Execução na obra", resumoExecucao(m), secoesAbertas.has("execucao"), detalheExecucao(m))}

        <div class="ticket-section">
          <h3>📄 Documentos</h3>
          ${detalheDocumentos(m)}
        </div>

        <div class="ticket-section">
          <h3>📜 Histórico</h3>
          <div class="timeline">
            ${m.history.slice().reverse().map(h => `
              <div class="t-item" style="margin-bottom:10px;">
                <div class="t-action">${escapeHtml(h.action)}</div>
                <div class="hint">${fmtDate(h.date.slice(0, 10))} — ${escapeHtml(h.user)}${h.note ? " — " + escapeHtml(h.note) : ""}</div>
              </div>`).join("")}
          </div>
        </div>

      </div>

      <div class="ticket-side">
        <div class="ticket-section">
          <h3>Finalizar</h3>
          ${(() => {
      if (isClosed) return `<div class="empty-hint">Modificação encerrada.</div>`;
      const bloqueios = finalizarBloqueios(m);
      if (!bloqueios.length) return `<button class="btn primary" id="btn-mod-finalizar" style="width:100%;">Finalizar modificação</button>`;
      return `<div class="hint">Pendente antes de finalizar: ${bloqueios.map(escapeHtml).join(", ")}.</div>`;
    })()}
        </div>
        ${outras.length ? `
        <div class="ticket-section">
          <h3>Outras modificações desta unidade</h3>
          ${outras.map(o => `<div class="atencao-row" data-open-mod-side="${o.id}" style="cursor:pointer;">
            <div class="atencao-info"><strong>${o.code}</strong> — ${fmtDate(o.dataSolicitacao)}<br><span class="hint">${escapeHtml((o.solicitacaoTexto || "").slice(0, 40))}${(o.solicitacaoTexto || "").length > 40 ? "…" : ""}</span></div>
            <span class="badge mod-status-${o.status}">${MODIFICATION_STATUS_MAP[o.status].label}</span>
          </div>`).join("")}
        </div>` : ""}
      </div>
    </div>
  `;

  wireModificationDetail(m);
}

/* ---------- Seções retráteis: resumo (sempre visível) + detalhe (expande) ---------- */

function detailsSection(key, titulo, resumo, aberto, conteudoHtml) {
  return `<details class="mod-details" data-secao="${key}" ${aberto ? "open" : ""}>
    <summary class="mod-summary"><span class="mod-summary-title">${escapeHtml(titulo)}</span><span class="mod-summary-resumo">${resumo}</span></summary>
    <div class="mod-details-body">${conteudoHtml}</div>
  </details>`;
}

/* Decide quais seções já começam abertas — a etapa que corresponde ao status
   atual da modificação. O restante fica fechado, só com o resumo de uma linha. */
function seccoesAbertas(m) {
  const s = new Set();
  if (["solicitacao_recebida", "em_analise"].includes(m.status)) s.add("viabilidade");
  else if (m.status === "em_orcamento" || m.status === "aguardando_aprovacao") s.add("orcamento");
  else if (m.status === "aprovada") { s.add("financeiro"); s.add("execucao"); }
  else if (["liberada_obra", "recebida_obra", "em_execucao", "aguardando_conferencia", "nao_conforme", "conferida"].includes(m.status)) s.add("execucao");
  return s;
}

function resumoViabilidade(m) {
  const v = m.viabilidade;
  if (!v.status) return "— Ainda não analisada";
  const label = (VIABILIDADE_OPTIONS.find(o => o.id === v.status) || {}).label || v.status;
  const icon = v.status === "viavel" ? "✓" : v.status === "nao_viavel" ? "❌" : "⚠️";
  return `${icon} ${escapeHtml(label)} · ${escapeHtml(v.analisadoPor || "—")} · ${fmtDate(v.data)}`;
}
function detalheViabilidade(m) {
  const v = m.viabilidade;
  const podeRegistrar = !MODIFICATION_CLOSED_STATUSES.includes(m.status);
  return `
    ${v.status ? `
      <div class="detail-info-grid">
        <div><div class="di-label">Resultado</div>${escapeHtml((VIABILIDADE_OPTIONS.find(o => o.id === v.status) || {}).label || "—")}</div>
        <div><div class="di-label">Analisado por</div>${escapeHtml(v.analisadoPor || "—")}</div>
        <div><div class="di-label">Data</div>${fmtDate(v.data)}</div>
        <div class="full"><div class="di-label">Observação técnica</div>${escapeHtml(v.observacao || "—")}</div>
      </div>
    ` : `<div class="empty-hint">Viabilidade ainda não analisada.</div>`}
    ${podeRegistrar ? `<button class="btn ghost small" id="btn-registrar-viabilidade" style="margin-top:10px;">${v.status ? "Atualizar" : "Registrar"} viabilidade</button>` : ""}
  `;
}

/* Orçamento e Aprovação são o mesmo fluxo — a assinatura do termo É a
   aprovação, não uma etapa manual separada. Cada versão carrega seu próprio
   status (pronto_aprovacao → aguardando_assinatura → aprovado/reprovado). */
function resumoOrcamento(m) {
  const versoes = m.orcamento.versoes;
  if (!versoes.length) return "— Nenhuma versão criada ainda";
  const ac = m.aprovacaoCliente;
  if (ac.data) {
    const versao = m.orcamento.versoes.find(v => v.id === m.orcamento.versaoAprovadaId);
    const calc = versao ? calcularVersaoOrcamento(versao) : null;
    return `✓ Aprovado por ${escapeHtml(ac.responsavel || "—")} em ${fmtDate(ac.data)}${calc ? " · " + (calc.resultado > 0 ? "R$ " + calc.resultado.toFixed(2) : "Crédito R$ " + Math.abs(calc.resultado).toFixed(2)) : ""}`;
  }
  const ultima = versoes[versoes.length - 1];
  if (ultima.status === "aguardando_assinatura") return `⏳ ${versionLabel(ultima.numero)} aguardando assinatura do cliente`;
  const calc = calcularVersaoOrcamento(ultima);
  return `${versionLabel(ultima.numero)} · R$ ${calc.totalAdicionais.toFixed(2)} · Créditos R$ ${calc.totalCreditos.toFixed(2)} · Pronto para aprovação`;
}
function detalheOrcamento(m) {
  const versoes = m.orcamento.versoes;
  const isClosed = MODIFICATION_CLOSED_STATUSES.includes(m.status);
  const podeNovaVersao = !isClosed && m.status !== "solicitacao_recebida";
  const versaoAprovada = versoes.find(v => v.id === m.orcamento.versaoAprovadaId);
  const calcAprovada = versaoAprovada ? calcularVersaoOrcamento(versaoAprovada) : null;
  return `
    ${versoes.length ? `
    <div class="table-wrap">
      <table class="mini-table">
        <thead><tr><th>Versão</th><th>Data</th><th>Adicionais</th><th>Créditos</th><th>Resultado</th><th>Status</th><th></th></tr></thead>
        <tbody>${versoes.slice().reverse().map(v => {
    const calc = calcularVersaoOrcamento(v);
    const termo = m.documentos.find(d => d.tipo === "termo_aprovacao" && d.versaoRelacionada === v.id);
    const termoAssinado = m.documentos.find(d => d.tipo === "termo_aprovacao_assinado" && d.versaoRelacionada === v.id);
    let acoes = `<button class="btn ghost small" data-view-orcamento-versao="${v.id}">Ver orçamento</button>`;
    if (v.status === "pronto_aprovacao" && !isClosed) {
      acoes += ` <button class="btn ghost small" data-gerar-termo-versao="${v.id}">Gerar termo de aprovação</button>`;
    } else if (v.status === "aguardando_assinatura") {
      if (termo) acoes += ` <button class="btn ghost small" data-open-attachment="${termo.attachmentId}">Ver termo</button>`;
      if (!isClosed) acoes += ` <button class="btn ghost small" data-anexar-termo-versao="${v.id}">Anexar termo assinado</button>`;
    } else if (v.status === "aprovado" && termoAssinado) {
      acoes += ` <button class="btn ghost small" data-open-attachment="${termoAssinado.attachmentId}">Ver termo assinado</button>`;
    }
    return `<tr>
            <td>${versionLabel(v.numero)}</td>
            <td>${fmtDate(v.data)}</td>
            <td>R$ ${calc.totalAdicionais.toFixed(2)}</td>
            <td>R$ ${calc.totalCreditos.toFixed(2)}</td>
            <td style="color:${calc.resultado > 0 ? "var(--c-cancelado)" : "var(--c-concluido)"};">${calc.resultado > 0 ? "R$ " + calc.resultado.toFixed(2) : "Crédito R$ " + Math.abs(calc.resultado).toFixed(2)}</td>
            <td><span class="badge outline">${ORCAMENTO_VERSAO_STATUS[v.status] || v.status}</span></td>
            <td>${acoes}</td>
          </tr>`;
  }).join("")}</tbody>
      </table>
    </div>` : `<div class="empty-hint">Nenhuma versão de orçamento criada ainda.</div>`}
    ${m.aprovacaoCliente.data ? `
      <div class="detail-info-grid" style="margin-top:12px;">
        <div><div class="di-label">✓ Aprovado por</div>${escapeHtml(m.aprovacaoCliente.responsavel || "—")}</div>
        <div><div class="di-label">Data</div>${fmtDate(m.aprovacaoCliente.data)}</div>
        <div><div class="di-label">Versão aprovada</div>${escapeHtml(m.aprovacaoCliente.versaoAprovada || "—")}</div>
        ${calcAprovada && calcAprovada.resultado < 0 ? `
        <div class="full">
          <div class="di-label">Destino do crédito</div>
          <select id="sel-destino-credito">
            <option value="">Selecione</option>
            ${DESTINO_CREDITO_OPTIONS.map(o => `<option value="${o.id}" ${m.destinoCredito === o.id ? "selected" : ""}>${o.label}</option>`).join("")}
          </select>
        </div>` : ""}
      </div>
    ` : ""}
    ${podeNovaVersao ? `<button class="btn ghost small" id="btn-nova-versao-orcamento" style="margin-top:10px;">+ Nova versão de orçamento</button>` : ""}
  `;
}

function resumoFinanceiro(m) {
  const f = m.financeiro;
  if (f.status === "enviado" || f.status === "registrado") {
    const d = new Date(f.dataEnvio);
    const valida = !isNaN(d);
    const dataParte = valida ? d.toLocaleDateString("pt-BR") : fmtDate(f.dataEnvio);
    const horaParte = valida ? " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
    return `✓ Enviado ao financeiro em ${dataParte}${horaParte} por ${escapeHtml(f.enviadoPor || "—")}`;
  }
  return "— Aguardando aprovação";
}
function detalheFinanceiro(m) {
  const f = m.financeiro;
  const versao = m.orcamento.versoes.find(v => v.id === m.orcamento.versaoAprovadaId);
  const calc = versao ? calcularVersaoOrcamento(versao) : null;
  const podeEnviar = !!m.aprovacaoCliente.data && f.status !== "enviado" && f.status !== "registrado";
  return `
    ${calc ? `<div class="detail-info-grid"><div><div class="di-label">Valor a cobrar</div><strong>R$ ${calc.resultado.toFixed(2)}</strong></div></div>` : `<div class="empty-hint">Aguardando aprovação do cliente.</div>`}
    ${f.status === "enviado" || f.status === "registrado" ? `<div class="hint" style="margin-top:8px;">${resumoFinanceiro(m)}</div>` : ""}
    <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
      ${podeEnviar ? `<button class="btn primary small" id="btn-enviar-financeiro">Enviar ao financeiro</button>` : ""}
      ${f.status === "enviado" ? `<button class="btn ghost small" id="btn-registrado-financeiro">Marcar registrado pelo financeiro</button>` : ""}
      ${calc ? `<button class="btn ghost small" id="btn-exportar-financeiro">Exportar CSV</button>` : ""}
    </div>
  `;
}

/* Obra + Conferência fundidas — é um processo só, não duas etapas. */
const EXECUCAO_ESTAGIOS = ["Aguardando envio", "Enviada", "Recebida", "Executada", "Conferida"];
function estagioExecucaoAtual(m) {
  if (m.status === "aprovada") return 0;
  if (m.status === "liberada_obra") return 1;
  if (m.status === "recebida_obra" || m.status === "em_execucao") return 2;
  if (m.status === "aguardando_conferencia" || m.status === "nao_conforme") return 3;
  if (m.status === "conferida" || m.status === "finalizada") return 4;
  return -1;
}
function resumoExecucao(m) {
  const idx = estagioExecucaoAtual(m);
  if (idx < 0) return "— Aguardando aprovação do orçamento";
  if (m.status === "nao_conforme") return "⚠️ Não conforme — aguardando correção";
  return (idx === 4 ? "✓ " : "— ") + EXECUCAO_ESTAGIOS[idx];
}
function detalheExecucao(m) {
  const o = m.obra, c = m.conferencia;
  const idx = estagioExecucaoAtual(m);
  const linhas = [
    { label: "Enviada", data: o.liberada.data, extra: o.liberada.usuario ? "por " + o.liberada.usuario : "" },
    { label: "Recebida", data: o.recebida.data, extra: o.recebida.responsavel ? "por " + o.recebida.responsavel : "" },
    { label: "Executada", data: o.execucao.data, extra: "" },
    { label: "Conferida", data: c.data, extra: c.responsavel ? "por " + c.responsavel + (c.resultado ? " — " + (c.resultado === "conforme" ? "Conforme" : "Não conforme") : "") : "" },
  ];
  let actionBtn = "";
  if (m.status === "aprovada") actionBtn = `<button class="btn ghost small" id="btn-enviar-obra">Enviar para obra</button>`;
  else if (m.status === "liberada_obra") actionBtn = `<button class="btn ghost small" id="btn-receber-obra">Registrar recebimento</button>`;
  else if (m.status === "recebida_obra" || m.status === "em_execucao") actionBtn = `<button class="btn ghost small" id="btn-registrar-executada">Registrar executada</button>`;
  else if (m.status === "aguardando_conferencia") actionBtn = `<button class="btn ghost small" id="btn-registrar-conferencia">Registrar conferência</button>`;
  else if (m.status === "nao_conforme") actionBtn = `<button class="btn ghost small" id="btn-reenviar-conferencia">Correção feita — reenviar para conferência</button>`;

  return `
    <div class="mod-estagios">
      ${EXECUCAO_ESTAGIOS.map((label, i) => `<span class="mod-estagio ${i < idx ? "done" : i === idx ? "current" : ""}">${escapeHtml(label)}</span>`).join(`<span class="mod-estagio-sep">→</span>`)}
    </div>
    <div class="detail-info-grid" style="margin-top:12px;">
      ${linhas.map(r => `<div><div class="di-label">${r.label}</div>${r.data ? fmtDate(r.data) + (r.extra ? " — " + escapeHtml(r.extra) : "") : "—"}</div>`).join("")}
    </div>
    ${m.naoConformidades.length ? `
      <h4 class="form-section-title">Não conformidades registradas</h4>
      <div class="table-wrap">
        <table class="mini-table">
          <thead><tr><th>Data</th><th>Descrição</th><th>Responsável</th></tr></thead>
          <tbody>${m.naoConformidades.slice().reverse().map(nc => `<tr><td>${fmtDate(nc.data)}</td><td>${escapeHtml(nc.descricao)}</td><td>${escapeHtml(nc.responsavel || "—")}</td></tr>`).join("")}</tbody>
        </table>
      </div>` : ""}
    ${actionBtn ? `<div style="margin-top:10px;">${actionBtn}</div>` : ""}
    ${idx < 0 ? `<div class="hint" style="margin-top:8px;">Disponível depois que o cliente aprovar o orçamento.</div>` : ""}
  `;
}

/* Documentos — projeto + termos gerados/anexados, num lugar só. */
function detalheDocumentos(m) {
  const isClosed = MODIFICATION_CLOSED_STATUSES.includes(m.status);
  const cfg = MODIFICATION_TIPOS_ESPECIAIS[m.tipoEspecial];
  const docObrigatorio = cfg ? cfg.documentoObrigatorio : null;
  const temDocObrigatorio = docObrigatorio && m.documentos.some(d => d.tipo === docObrigatorio.tipo);
  const versoesProjeto = m.projeto.versoes;

  return `
    ${docObrigatorio && !temDocObrigatorio ? `<div class="warranty-note divergence" style="margin-bottom:10px;">⚠️ Pendência: ${escapeHtml(docObrigatorio.label)} ainda não anexado — obrigatório pra finalizar esta modificação.</div>` : ""}

    <h4 class="form-section-title">Projeto</h4>
    ${versoesProjeto.length ? `
    <div class="table-wrap">
      <table class="mini-table">
        <thead><tr><th>Versão</th><th>Data</th><th>Arquivos</th><th>Enviado por</th><th></th></tr></thead>
        <tbody>${versoesProjeto.slice().reverse().map(v => `<tr>
            <td>${versionLabel(v.numero)}${m.projeto.versaoAprovadaId === v.id ? ' <span class="badge outline">versão atual</span>' : ""}</td>
            <td>${fmtDate(v.data)}</td>
            <td>${v.arquivos.map(a => `<a href="#" data-open-attachment="${a.attachmentId}">${escapeHtml(a.fileName)}</a>`).join(", ") || "—"}</td>
            <td>${escapeHtml(v.enviadoPor || "—")}</td>
            <td>${m.projeto.versaoAprovadaId !== v.id && !isClosed ? `<button class="btn ghost small" data-set-projeto-versao="${v.id}">Definir como atual</button>` : ""}</td>
          </tr>`).join("")}</tbody>
      </table>
    </div>` : `<div class="empty-hint">Nenhuma versão de projeto anexada ainda.</div>`}
    ${!isClosed ? `<button class="btn ghost small" id="btn-nova-versao-projeto" style="margin-top:8px;">+ Nova versão de projeto</button>` : ""}

    <h4 class="form-section-title" style="margin-top:18px;">Outros documentos</h4>
    ${m.documentos.length ? `
    <div class="table-wrap">
      <table class="mini-table">
        <thead><tr><th>Documento</th><th>Arquivo</th><th>Data</th></tr></thead>
        <tbody>${m.documentos.map(d => `<tr>
          <td>${escapeHtml(d.label)}</td>
          <td><a href="#" data-open-attachment="${d.attachmentId}">${escapeHtml(d.fileName)}</a></td>
          <td>${fmtDate(d.data)}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>` : `<div class="empty-hint">Nenhum documento gerado/anexado ainda.</div>`}
    ${cfg && docObrigatorio && !isClosed ? `
      <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn ghost small" id="btn-gerar-termo-especial">Gerar ${escapeHtml(docObrigatorio.label.toLowerCase())}</button>
        <button class="btn ghost small" id="btn-anexar-termo-especial">Anexar termo assinado</button>
      </div>
    ` : ""}
  `;
}

/* O que falta antes de poder finalizar — conferência conforme sempre, mais
   qualquer documento obrigatório do tipo especial da modificação. */
function finalizarBloqueios(m) {
  const bloqueios = [];
  if (m.conferencia.resultado !== "conforme") bloqueios.push('conferência com resultado "Conforme"');
  const cfg = MODIFICATION_TIPOS_ESPECIAIS[m.tipoEspecial];
  if (cfg && cfg.documentoObrigatorio && !m.documentos.some(d => d.tipo === cfg.documentoObrigatorio.tipo)) {
    bloqueios.push(cfg.documentoObrigatorio.label + " anexado");
  }
  return bloqueios;
}

/* ---------- Wiring da ficha ---------- */

function wireModificationDetail(m) {
  document.getElementById("btn-back-modification").addEventListener("click", () => showView("modifications"));
  document.querySelectorAll("[data-open-mod-side]").forEach(el => el.addEventListener("click", () => goToModificationDetail(el.dataset.openModSide)));
  document.querySelectorAll("[data-open-attachment]").forEach(el => el.addEventListener("click", async (e) => {
    e.preventDefault();
    const url = await getAttachmentUrl(el.dataset.openAttachment);
    if (url) window.open(url, "_blank");
  }));

  const nv = document.getElementById("btn-mod-nao-viavel");
  if (nv) nv.addEventListener("click", () => promptObservacaoEAcao(m, "Marcar como não viável?", (obs) => {
    setModificationStatus(m, "nao_viavel", "Marcada como não viável", obs);
    persist(); toast("Modificação marcada como não viável.", ""); goToModificationDetail(m.id);
  }));
  const rec = document.getElementById("btn-mod-recusada");
  if (rec) rec.addEventListener("click", () => promptObservacaoEAcao(m, "Registrar recusa do cliente?", (obs) => {
    setModificationStatus(m, "recusada_cliente", "Recusada pelo cliente", obs);
    persist(); toast("Modificação marcada como recusada.", ""); goToModificationDetail(m.id);
  }));
  const canc = document.getElementById("btn-mod-cancelar");
  if (canc) canc.addEventListener("click", () => {
    if (!confirm("Cancelar esta modificação? O histórico é preservado.")) return;
    promptObservacaoEAcao(m, "Motivo do cancelamento (opcional)", (obs) => {
      setModificationStatus(m, "cancelada", "Modificação cancelada", obs);
      persist(); toast("Modificação cancelada.", ""); goToModificationDetail(m.id);
    });
  });

  document.getElementById("btn-delete-modification")?.addEventListener("click", () => {
    if (!confirm(`Excluir ${m.code}? Esta ação não pode ser desfeita.`)) return;
    state.modifications = state.modifications.filter(x => x.id !== m.id);
    persist();
    showView("modifications");
    toast("Modificação excluída.");
  });

  const finalizar = document.getElementById("btn-mod-finalizar");
  if (finalizar) finalizar.addEventListener("click", () => {
    if (!confirm(`Finalizar ${m.code}?`)) return;
    setModificationStatus(m, "finalizada", "Modificação finalizada");
    persist(); toast("Modificação finalizada.", "success"); goToModificationDetail(m.id);
  });

  const itensMapaBtn = document.getElementById("btn-edit-itens-mapa");
  if (itensMapaBtn) itensMapaBtn.addEventListener("click", () => openItensMapaForm(m));

  const vBtn = document.getElementById("btn-registrar-viabilidade");
  if (vBtn) vBtn.addEventListener("click", () => openViabilidadeForm(m));

  const orcBtn = document.getElementById("btn-nova-versao-orcamento");
  if (orcBtn) orcBtn.addEventListener("click", () => openOrcamentoVersaoForm(m));
  document.querySelectorAll("[data-view-orcamento-versao]").forEach(el => el.addEventListener("click", () => openOrcamentoVersaoViewer(m, el.dataset.viewOrcamentoVersao)));
  document.querySelectorAll("[data-gerar-termo-versao]").forEach(el => el.addEventListener("click", () => gerarTermoAprovacaoPDF(m, el.dataset.gerarTermoVersao)));
  document.querySelectorAll("[data-anexar-termo-versao]").forEach(el => el.addEventListener("click", () => anexarTermoAprovacaoAssinado(m, el.dataset.anexarTermoVersao)));
  const destinoCreditoSel = document.getElementById("sel-destino-credito");
  if (destinoCreditoSel) destinoCreditoSel.addEventListener("change", (e) => {
    m.destinoCredito = e.target.value;
    persist();
    toast("Destino do crédito salvo.", "success");
  });

  const projBtn = document.getElementById("btn-nova-versao-projeto");
  if (projBtn) projBtn.addEventListener("click", () => openProjetoVersaoForm(m));
  document.querySelectorAll("[data-set-projeto-versao]").forEach(el => el.addEventListener("click", () => {
    m.projeto.versaoAprovadaId = el.dataset.setProjetoVersao;
    persist(); toast("Versão de projeto definida como atual.", "success"); goToModificationDetail(m.id);
  }));

  const finBtn = document.getElementById("btn-enviar-financeiro");
  if (finBtn) finBtn.addEventListener("click", () => enviarAoFinanceiro(m));
  const finReg = document.getElementById("btn-registrado-financeiro");
  if (finReg) finReg.addEventListener("click", () => {
    m.financeiro.status = "registrado";
    addModificationHistoryEntry(m, "Registrado pelo financeiro");
    persist(); toast("Financeiro atualizado.", "success"); goToModificationDetail(m.id);
  });
  const finExp = document.getElementById("btn-exportar-financeiro");
  if (finExp) finExp.addEventListener("click", () => exportarInformacoesFinanceiro(m));

  const envObra = document.getElementById("btn-enviar-obra");
  if (envObra) envObra.addEventListener("click", () => {
    if (!m.projeto.versaoAprovadaId) { toast("Defina qual versão de projeto será enviada antes.", "error"); return; }
    m.obra.liberada = { data: todayISODate(), usuario: ensureOperatorName(), versaoProjeto: versionLabel(m.projeto.versoes.find(v => v.id === m.projeto.versaoAprovadaId).numero) };
    setModificationStatus(m, "liberada_obra", "Enviado para obra", m.obra.liberada.versaoProjeto);
    persist(); toast("Modificação enviada para a obra.", "success"); goToModificationDetail(m.id);
  });
  const recObra = document.getElementById("btn-receber-obra");
  if (recObra) recObra.addEventListener("click", () => promptResponsavelEAcao(m, "Quem recebeu na obra?", (resp) => {
    m.obra.recebida = { data: todayISODate(), responsavel: resp };
    setModificationStatus(m, "recebida_obra", "Recebimento confirmado pela obra", resp);
    persist(); toast("Recebimento registrado.", "success"); goToModificationDetail(m.id);
  }));
  const regExec = document.getElementById("btn-registrar-executada");
  if (regExec) regExec.addEventListener("click", () => {
    m.obra.execucao.data = todayISODate();
    setModificationStatus(m, "aguardando_conferencia", "Execução concluída pela obra");
    persist(); toast("Execução registrada — aguardando conferência.", "success"); goToModificationDetail(m.id);
  });

  const confBtn = document.getElementById("btn-registrar-conferencia");
  if (confBtn) confBtn.addEventListener("click", () => openConferenciaForm(m));
  const reenvBtn = document.getElementById("btn-reenviar-conferencia");
  if (reenvBtn) reenvBtn.addEventListener("click", () => {
    setModificationStatus(m, "aguardando_conferencia", "Correção registrada, aguardando nova conferência");
    persist(); toast("Reenviado para conferência.", "success"); goToModificationDetail(m.id);
  });


  const gerarTermoEspecial = document.getElementById("btn-gerar-termo-especial");
  if (gerarTermoEspecial) gerarTermoEspecial.addEventListener("click", () => {
    const cfg = MODIFICATION_TIPOS_ESPECIAIS[m.tipoEspecial];
    if (cfg?.documentoObrigatorio?.tipo === "termo_integracao_sacada") gerarTermoIntegracaoSacadaPDF(m);
  });
  const anexarTermoEspecial = document.getElementById("btn-anexar-termo-especial");
  if (anexarTermoEspecial) anexarTermoEspecial.addEventListener("click", () => {
    const cfg = MODIFICATION_TIPOS_ESPECIAIS[m.tipoEspecial];
    if (cfg?.documentoObrigatorio) anexarTermoAssinado(m, cfg.documentoObrigatorio.tipo, cfg.documentoObrigatorio.label + " (assinado)");
  });
}

/* ---------- Sub-formulários (modais) ---------- */

function promptObservacaoEAcao(m, title, onConfirm) {
  openModal(`
    <div class="modal-header"><h2>${escapeHtml(title)}</h2><button class="modal-close" data-close>&times;</button></div>
    <div class="modal-body"><div class="field full"><label>Observação</label><textarea id="prompt-obs"></textarea></div></div>
    <div class="modal-footer"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="btn-prompt-confirm">Confirmar</button></div>
  `, true);
  wireModalClose();
  document.getElementById("btn-prompt-confirm").addEventListener("click", () => {
    const obs = document.getElementById("prompt-obs").value.trim();
    closeModal();
    onConfirm(obs);
  });
}
function promptResponsavelEAcao(m, title, onConfirm) {
  openModal(`
    <div class="modal-header"><h2>${escapeHtml(title)}</h2><button class="modal-close" data-close>&times;</button></div>
    <div class="modal-body"><div class="field full"><label>Responsável</label><input type="text" id="prompt-resp" value="${escapeHtml(getOperatorName())}"></div></div>
    <div class="modal-footer"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="btn-prompt-confirm">Confirmar</button></div>
  `, true);
  wireModalClose();
  document.getElementById("btn-prompt-confirm").addEventListener("click", () => {
    const resp = document.getElementById("prompt-resp").value.trim();
    closeModal();
    onConfirm(resp);
  });
}

function openItensMapaForm(m) {
  openModal(`
    <div class="modal-header"><h2>O que foi modificado — ${m.code}</h2><button class="modal-close" data-close>&times;</button></div>
    <div class="modal-body">
      <p class="hint">Alimenta as colunas do Mapa de Modificações nesta unidade. A categoria técnica interna é recalculada automaticamente a partir do que for marcado aqui.</p>
      <div class="checkbox-group">${state.mapItems.map(i => `<label class="checkbox-inline"><input type="checkbox" name="itensMapa" value="${escapeHtml(i)}" ${m.itensMapa.includes(i) ? "checked" : ""}> ${escapeHtml(i)}</label>`).join("")}</div>
    </div>
    <div class="modal-footer"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="btn-save-itens-mapa">Salvar</button></div>
  `, true);
  wireModalClose();
  document.getElementById("btn-save-itens-mapa").addEventListener("click", () => {
    m.itensMapa = [...document.querySelectorAll('#modal-root input[name=itensMapa]:checked')].map(el => el.value);
    m.categorias = deriveCategoriasFromItens(m.itensMapa);
    addModificationHistoryEntry(m, "O que foi modificado — atualizado", m.itensMapa.join(", "));
    persist();
    closeModal();
    toast("Atualizado.", "success");
    goToModificationDetail(m.id);
  });
}

function openViabilidadeForm(m) {
  const v = m.viabilidade;
  openModal(`
    <div class="modal-header"><h2>Viabilidade — ${m.code}</h2><button class="modal-close" data-close>&times;</button></div>
    <div class="modal-body">
      <form id="viabilidade-form">
        <div class="form-grid">
          <div class="field full">
            <label>Resultado</label>
            <select name="status" required>
              <option value="">Selecione</option>
              ${VIABILIDADE_OPTIONS.map(o => `<option value="${o.id}" ${v.status === o.id ? "selected" : ""}>${o.label}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Analisado por</label><input type="text" name="analisadoPor" value="${escapeHtml(v.analisadoPor || getOperatorName())}"></div>
          <div class="field"><label>Data da análise</label><input type="date" name="data" value="${v.data || todayISODate()}"></div>
          <div class="field full"><label>Observação técnica</label><textarea name="observacao" placeholder="Ex: viável, mas exige retrabalho na tubulação já executada — custo entra no orçamento.">${escapeHtml(v.observacao || "")}</textarea></div>
        </div>
      </form>
    </div>
    <div class="modal-footer"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="btn-save-viabilidade">Salvar</button></div>
  `, true);
  wireModalClose();
  document.getElementById("btn-save-viabilidade").addEventListener("click", () => {
    const form = document.getElementById("viabilidade-form");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    m.viabilidade = { status: fd.get("status"), observacao: fd.get("observacao").trim(), analisadoPor: fd.get("analisadoPor").trim(), data: fd.get("data") };
    const label = (VIABILIDADE_OPTIONS.find(o => o.id === m.viabilidade.status) || {}).label;
    if (m.viabilidade.status === "nao_viavel") {
      setModificationStatus(m, "nao_viavel", "Viabilidade registrada: " + label, m.viabilidade.observacao);
    } else if (m.status === "solicitacao_recebida" || m.status === "em_analise") {
      setModificationStatus(m, "em_orcamento", "Viabilidade registrada: " + label, m.viabilidade.observacao);
    } else {
      addModificationHistoryEntry(m, "Viabilidade atualizada: " + label, m.viabilidade.observacao);
    }
    persist();
    closeModal();
    toast("Viabilidade registrada.", "success");
    goToModificationDetail(m.id);
  });
}

function orcamentoItemParamRowHTML(item) {
  return `<div class="supplier-contact-row orc-param-row">
    <div class="form-grid">
      <div class="field full"><label>Serviço</label><select class="op-item">${state.priceTable.filter(p => p.ativo).map(p => `<option value="${p.id}" ${item?.priceTableId === p.id ? "selected" : ""}>${escapeHtml(p.descricao)} — R$ ${p.valor.toFixed(2)}/${escapeHtml(p.unidade)}</option>`).join("") || `<option value="">Nenhum serviço cadastrado</option>`}</select></div>
      <div class="field"><label>Quantidade</label><input type="number" min="1" class="op-qtd" value="${item?.quantidade || 1}"></div>
    </div>
    <button type="button" class="btn ghost small remove-contact-btn">Remover</button>
  </div>`;
}
function orcamentoItemCustomRowHTML(item) {
  return `<div class="supplier-contact-row orc-custom-row">
    <div class="form-grid">
      <div class="field"><label>Descrição</label><input type="text" class="oc-desc" value="${escapeHtml(item?.descricao || "")}"></div>
      <div class="field"><label>Categoria</label><select class="oc-cat"><option value="">—</option>${state.modificationCategories.map(c => `<option value="${c}" ${item?.categoria === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
      <div class="field"><label>Quantidade</label><input type="number" min="1" class="oc-qtd" value="${item?.quantidade || 1}"></div>
      <div class="field"><label>Valor (R$)</label><input type="number" min="0" step="0.01" class="oc-valor" value="${item?.valor || ""}"></div>
      <div class="field full"><label>Observação</label><input type="text" class="oc-obs" value="${escapeHtml(item?.observacao || "")}"></div>
    </div>
    <button type="button" class="btn ghost small remove-contact-btn">Remover</button>
  </div>`;
}
function orcamentoCreditoRowHTML(item, buildingId) {
  const opts = state.creditTable.filter(c => c.buildingId === buildingId && c.ativo);
  return `<div class="supplier-contact-row orc-credito-row">
    <div class="form-grid">
      <div class="field full"><label>Item</label><select class="ocr-item">${opts.map(c => `<option value="${c.id}" ${item?.creditTableId === c.id ? "selected" : ""}>${escapeHtml(c.item)} — crédito R$ ${c.creditoCliente.toFixed(2)}</option>`).join("") || `<option value="">Nenhum item de crédito cadastrado para este empreendimento</option>`}</select></div>
    </div>
    <button type="button" class="btn ghost small remove-contact-btn">Remover</button>
  </div>`;
}

function openOrcamentoVersaoForm(m) {
  const numero = (m.orcamento.versoes[m.orcamento.versoes.length - 1]?.numero || 0) + 1;
  openModal(`
    <div class="modal-header"><h2>Nova versão de orçamento — ${versionLabel(numero)}</h2><button class="modal-close" data-close>&times;</button></div>
    <div class="modal-body">
      <form id="orcamento-form">
        <h4 class="form-section-title">Itens com preço parametrizado</h4>
        <div id="orc-param-list"></div>
        <button type="button" class="btn ghost small" id="btn-add-param">+ Adicionar item da tabela</button>

        <h4 class="form-section-title">Itens personalizados</h4>
        <div id="orc-custom-list"></div>
        <button type="button" class="btn ghost small" id="btn-add-custom">+ Adicionar item personalizado</button>

        <h4 class="form-section-title">Créditos</h4>
        <div id="orc-credito-list"></div>
        <button type="button" class="btn ghost small" id="btn-add-credito">+ Adicionar crédito</button>
        ${!state.creditTable.some(c => c.buildingId === m.buildingId && c.ativo) ? `<div class="hint" style="margin-top:6px;">Nenhum crédito configurado para este empreendimento ainda — cadastre na Tabela de Créditos, na ficha do empreendimento.</div>` : ""}

        <h4 class="form-section-title">Observações</h4>
        <div class="field full"><textarea name="observacoes"></textarea></div>

        <div class="detail-info-grid" id="orc-totais" style="margin-top:16px;"></div>
      </form>
    </div>
    <div class="modal-footer"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="btn-save-orcamento">Salvar versão</button></div>
  `, true);
  wireModalClose();

  function wireRemoveButtons() {
    document.querySelectorAll("#orcamento-form .remove-contact-btn").forEach(btn => { btn.onclick = () => { btn.closest(".supplier-contact-row").remove(); updateTotais(); }; });
  }
  function updateTotais() {
    const totalAdicionais =
      [...document.querySelectorAll(".orc-param-row")].reduce((s, row) => {
        const opt = row.querySelector(".op-item").selectedOptions[0];
        const p = state.priceTable.find(x => x.id === opt?.value);
        return s + (p ? p.valor * Number(row.querySelector(".op-qtd").value || 0) : 0);
      }, 0) +
      [...document.querySelectorAll(".orc-custom-row")].reduce((s, row) => s + Number(row.querySelector(".oc-qtd").value || 1) * Number(row.querySelector(".oc-valor").value || 0), 0);
    const totalCreditos = [...document.querySelectorAll(".orc-credito-row")].reduce((s, row) => {
      const opt = row.querySelector(".ocr-item").selectedOptions[0];
      const c = state.creditTable.find(x => x.id === opt?.value);
      return s + (c ? c.creditoCliente : 0);
    }, 0);
    const resultado = totalAdicionais - totalCreditos;
    document.getElementById("orc-totais").innerHTML = `
      <div><div class="di-label">Subtotal das modificações</div>R$ ${totalAdicionais.toFixed(2)}</div>
      <div><div class="di-label">Créditos</div>${totalCreditos > 0 ? "- R$ " + totalCreditos.toFixed(2) : "R$ 0,00"}</div>
      <div><div class="di-label">Total a cobrar</div><strong>${resultado > 0 ? "R$ " + resultado.toFixed(2) : "Crédito de R$ " + Math.abs(resultado).toFixed(2)}</strong></div>
    `;
  }
  document.getElementById("btn-add-param").addEventListener("click", () => {
    document.getElementById("orc-param-list").insertAdjacentHTML("beforeend", orcamentoItemParamRowHTML());
    wireRemoveButtons();
    document.querySelectorAll(".orc-param-row .op-item, .orc-param-row .op-qtd").forEach(el => el.addEventListener("input", updateTotais));
    updateTotais();
  });
  document.getElementById("btn-add-custom").addEventListener("click", () => {
    document.getElementById("orc-custom-list").insertAdjacentHTML("beforeend", orcamentoItemCustomRowHTML());
    wireRemoveButtons();
    document.querySelectorAll(".orc-custom-row .oc-qtd, .orc-custom-row .oc-valor").forEach(el => el.addEventListener("input", updateTotais));
    updateTotais();
  });
  document.getElementById("btn-add-credito").addEventListener("click", () => {
    document.getElementById("orc-credito-list").insertAdjacentHTML("beforeend", orcamentoCreditoRowHTML(null, m.buildingId));
    wireRemoveButtons();
    document.querySelectorAll(".orc-credito-row .ocr-item").forEach(el => el.addEventListener("change", updateTotais));
    updateTotais();
  });

  /* Pré-preenche com os itens da tabela de preços cuja categoria bate com o
     que já foi marcado em "O que será modificado?" — o usuário só ajusta
     quantidade ou remove o que não se aplica, não escolhe do zero de novo. */
  calcularOrcamentoSugerido(m).forEach(p => {
    document.getElementById("orc-param-list").insertAdjacentHTML("beforeend", orcamentoItemParamRowHTML());
    const row = document.querySelector("#orc-param-list .orc-param-row:last-child");
    row.querySelector(".op-item").value = p.id;
    row.querySelector(".op-item").addEventListener("input", updateTotais);
    row.querySelector(".op-qtd").addEventListener("input", updateTotais);
  });
  wireRemoveButtons();
  updateTotais();

  document.getElementById("btn-save-orcamento").addEventListener("click", () => {
    const itensParametrizados = [...document.querySelectorAll(".orc-param-row")].map(row => {
      const p = state.priceTable.find(x => x.id === row.querySelector(".op-item").value);
      if (!p) return null;
      return { priceTableId: p.id, descricao: p.descricao, categoria: p.categoria, quantidade: Number(row.querySelector(".op-qtd").value || 1), valorUnit: p.valor };
    }).filter(Boolean);
    const itensPersonalizados = [...document.querySelectorAll(".orc-custom-row")].map(row => ({
      descricao: row.querySelector(".oc-desc").value.trim(), categoria: row.querySelector(".oc-cat").value,
      quantidade: Number(row.querySelector(".oc-qtd").value || 1), valor: Number(row.querySelector(".oc-valor").value || 0),
      observacao: row.querySelector(".oc-obs").value.trim(),
    })).filter(i => i.descricao);
    const creditos = [...document.querySelectorAll(".orc-credito-row")].map(row => {
      const c = state.creditTable.find(x => x.id === row.querySelector(".ocr-item").value);
      if (!c) return null;
      return { creditTableId: c.id, item: c.item, valor: c.creditoCliente };
    }).filter(Boolean);
    const versao = {
      id: "ov" + Date.now() + Math.random().toString(36).slice(2, 6), numero, status: "pronto_aprovacao",
      itensParametrizados, itensPersonalizados, creditos,
      data: todayISODate(), responsavel: ensureOperatorName(),
      observacoes: document.querySelector('#orcamento-form textarea[name=observacoes]').value.trim(),
    };
    /* Uma versão nova substitui a anterior que ainda estava aguardando
       assinatura — o cliente pediu alteração, o termo antigo não vale mais. */
    const anterior = m.orcamento.versoes[m.orcamento.versoes.length - 1];
    if (anterior && anterior.status === "aguardando_assinatura") anterior.status = "reprovado";
    m.orcamento.versoes.push(versao);
    if (m.status === "em_analise" || m.status === "solicitacao_recebida") m.status = "em_orcamento";
    addModificationHistoryEntry(m, "Orçamento " + versionLabel(numero) + " criado");
    persist();
    closeModal();
    toast("Versão de orçamento salva.", "success");
    goToModificationDetail(m.id);
  });
}

function openOrcamentoVersaoViewer(m, versaoId) {
  const v = m.orcamento.versoes.find(x => x.id === versaoId);
  if (!v) return;
  const calc = calcularVersaoOrcamento(v);
  openModal(`
    <div class="modal-header"><h2>Orçamento ${versionLabel(v.numero)} — ${m.code}</h2><button class="modal-close" data-close>&times;</button></div>
    <div class="modal-body">
      <h4 class="form-section-title">Adicionais</h4>
      <div class="table-wrap"><table class="mini-table"><thead><tr><th>Descrição</th><th>Categoria</th><th>Qtd</th><th>Valor</th></tr></thead><tbody>
        ${[...v.itensParametrizados.map(i => ({ ...i, tipo: "tabela" })), ...v.itensPersonalizados.map(i => ({ ...i, valorUnit: i.valor, tipo: "personalizado" }))].map(i => `<tr><td>${escapeHtml(i.descricao)}</td><td>${escapeHtml(i.categoria || "—")}</td><td>${i.quantidade}</td><td>R$ ${(i.valorUnit * i.quantidade).toFixed(2)}</td></tr>`).join("") || `<tr><td colspan="4" class="empty-hint">Nenhum item.</td></tr>`}
      </tbody></table></div>
      <h4 class="form-section-title">Créditos</h4>
      <div class="table-wrap"><table class="mini-table"><thead><tr><th>Item</th><th>Valor</th></tr></thead><tbody>
        ${v.creditos.map(c => `<tr><td>${escapeHtml(c.item)}</td><td>R$ ${c.valor.toFixed(2)}</td></tr>`).join("") || `<tr><td colspan="2" class="empty-hint">Nenhum.</td></tr>`}
      </tbody></table></div>
      <div class="detail-info-grid" style="margin-top:14px;">
        <div><div class="di-label">Subtotal das modificações</div>R$ ${calc.totalAdicionais.toFixed(2)}</div>
        <div><div class="di-label">Créditos</div>${calc.totalCreditos > 0 ? "- R$ " + calc.totalCreditos.toFixed(2) : "R$ 0,00"}</div>
        <div><div class="di-label">Total a cobrar</div><strong>${calc.resultado > 0 ? "R$ " + calc.resultado.toFixed(2) : "Crédito de R$ " + Math.abs(calc.resultado).toFixed(2)}</strong></div>
        <div class="full"><div class="di-label">Observações</div>${escapeHtml(v.observacoes || "—")}</div>
      </div>
    </div>
    <div class="modal-footer"><button class="btn primary" data-close>Fechar</button></div>
  `, true);
  wireModalClose();
}

function openProjetoVersaoForm(m) {
  const numero = (m.projeto.versoes[m.projeto.versoes.length - 1]?.numero || 0) + 1;
  openModal(`
    <div class="modal-header"><h2>Nova versão de projeto — ${versionLabel(numero)}</h2><button class="modal-close" data-close>&times;</button></div>
    <div class="modal-body">
      <div class="field full"><label>Arquivos (planta, PDF, imagens)</label><input type="file" id="projeto-files" multiple></div>
    </div>
    <div class="modal-footer"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="btn-save-projeto">Salvar versão</button></div>
  `, true);
  wireModalClose();
  document.getElementById("btn-save-projeto").addEventListener("click", async () => {
    const files = [...document.getElementById("projeto-files").files];
    if (!files.length) { toast("Selecione ao menos um arquivo.", "error"); return; }
    const arquivos = [];
    for (const file of files) {
      const attachmentId = await saveAttachment(file);
      arquivos.push({ attachmentId, fileName: file.name });
    }
    const novaVersao = { id: "pv" + Date.now() + Math.random().toString(36).slice(2, 6), numero, arquivos, data: todayISODate(), enviadoPor: ensureOperatorName() };
    m.projeto.versoes.push(novaVersao);
    /* Primeira versão de projeto não tem ambiguidade nenhuma — já define
       como a atual sozinha, sem exigir um clique extra em "Definir como
       atual". A partir da segunda versão, a escolha passa a ser manual. */
    if (m.projeto.versoes.length === 1) m.projeto.versaoAprovadaId = novaVersao.id;
    addModificationHistoryEntry(m, "Projeto " + versionLabel(numero) + " anexado");
    persist();
    closeModal();
    toast("Versão de projeto salva.", "success");
    goToModificationDetail(m.id);
  });
}

/* Sem formulário — a equipe de Arquitetura não redigita nada que a
   modificação já tem. Um clique registra tudo automaticamente. */
function enviarAoFinanceiro(m) {
  const versao = m.orcamento.versoes.find(v => v.id === m.orcamento.versaoAprovadaId);
  const calc = versao ? calcularVersaoOrcamento(versao) : { resultado: 0 };
  m.financeiro.status = "enviado";
  m.financeiro.dataEnvio = new Date().toISOString();
  m.financeiro.enviadoPor = ensureOperatorName();
  m.financeiro.valorEnviado = calc.resultado;
  addModificationHistoryEntry(m, "Enviado ao financeiro", `R$ ${calc.resultado.toFixed(2)}`);
  persist();
  toast("Enviado ao financeiro.", "success");
  goToModificationDetail(m.id);
}

function openConferenciaForm(m) {
  openModal(`
    <div class="modal-header"><h2>Registrar conferência — ${m.code}</h2><button class="modal-close" data-close>&times;</button></div>
    <div class="modal-body">
      <form id="conferencia-form">
        <div class="form-grid">
          <div class="field full">
            <label>Resultado</label>
            <select name="resultado" required>
              <option value="">Selecione</option>
              <option value="conforme">✅ Conforme</option>
              <option value="nao_conforme">❌ Não conforme</option>
            </select>
          </div>
          <div class="field"><label>Data</label><input type="date" name="data" value="${todayISODate()}"></div>
          <div class="field"><label>Responsável</label><input type="text" name="responsavel" value="${escapeHtml(getOperatorName())}"></div>
          <div class="field full"><label>Observação</label><textarea name="observacao" placeholder="Ex: ponto executado em posição diferente da planta"></textarea></div>
        </div>
      </form>
    </div>
    <div class="modal-footer"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="btn-save-conferencia">Salvar</button></div>
  `, true);
  wireModalClose();
  document.getElementById("btn-save-conferencia").addEventListener("click", () => {
    const form = document.getElementById("conferencia-form");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const resultado = fd.get("resultado");
    m.conferencia = { resultado, data: fd.get("data"), responsavel: fd.get("responsavel").trim(), observacao: fd.get("observacao").trim() };
    if (resultado === "conforme") {
      setModificationStatus(m, "conferida", "Conferência realizada: conforme");
    } else {
      m.naoConformidades.push({ data: fd.get("data"), descricao: fd.get("observacao").trim() || "Não conforme com a planta", responsavel: fd.get("responsavel").trim(), resolvidaEm: "" });
      setModificationStatus(m, "nao_conforme", "Conferência realizada: não conforme", fd.get("observacao").trim());
    }
    persist();
    closeModal();
    toast("Conferência registrada.", resultado === "conforme" ? "success" : "");
    goToModificationDetail(m.id);
  });
}

/* ---------- Tabela de preços (global) e tabela de créditos (por empreendimento) ---------- */

/* ---------- Documentos gerados (PDF) e anexados ---------- */

function anexarTermoAssinado(m, tipo, label) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/pdf,image/*";
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    const attachmentId = await saveAttachment(file);
    m.documentos.push({ id: "doc" + Date.now() + Math.random().toString(36).slice(2, 6), tipo, label, attachmentId, fileName: file.name, origem: "anexado", data: todayISODate() });
    addModificationHistoryEntry(m, label + " anexado");
    persist();
    toast("Documento anexado.", "success");
    goToModificationDetail(m.id);
  });
  input.click();
}

function gerarTermoAprovacaoPDF(m, versaoId) {
  if (!window.jspdf) { toast("Biblioteca de PDF não carregada.", "error"); return; }
  const versao = m.orcamento.versoes.find(v => v.id === versaoId);
  if (!versao) { toast("Versão de orçamento não encontrada.", "error"); return; }
  const b = getBuilding(m.buildingId);
  const client = m.clientId ? getClient(m.clientId) : null;
  const calc = calcularVersaoOrcamento(versao);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFont(undefined, "bold"); doc.setFontSize(14); doc.setTextColor(16, 32, 61);
  doc.text("GESTÃO DE ARQUITETURA", pageWidth / 2, y, { align: "center" }); y += 7;
  doc.setFontSize(12);
  doc.text("TERMO DE APROVAÇÃO DE MODIFICAÇÃO", pageWidth / 2, y, { align: "center" }); y += 14;

  doc.setFont(undefined, "normal"); doc.setFontSize(10.5); doc.setTextColor(40, 40, 40);
  const campos = [
    ["Empreendimento", b ? b.name : "—"],
    ["Apartamento", m.unit],
    ["Cliente", client ? client.name : "—"],
    ["Modificação", m.code],
    ["Itens afetados", m.itensMapa.join(", ") || "—"],
    ["Descrição", m.solicitacaoTexto],
  ];
  campos.forEach(([label, valor]) => {
    doc.setFont(undefined, "bold"); doc.text(label + ":", 15, y);
    doc.setFont(undefined, "normal");
    const linhas = doc.splitTextToSize(String(valor || "—"), pageWidth - 65);
    doc.text(linhas, 60, y);
    y += Math.max(6, linhas.length * 5);
  });

  y += 4;
  doc.setDrawColor(210); doc.line(15, y, pageWidth - 15, y); y += 9;

  doc.setFont(undefined, "bold"); doc.text("Valor da modificação:", 15, y);
  doc.setFont(undefined, "normal"); doc.text(`R$ ${calc.totalAdicionais.toFixed(2)}`, 90, y); y += 7;
  doc.setFont(undefined, "bold"); doc.text("Créditos:", 15, y);
  doc.setFont(undefined, "normal"); doc.text(`R$ ${calc.totalCreditos.toFixed(2)}`, 90, y); y += 7;
  doc.setFont(undefined, "bold"); doc.text("Valor final:", 15, y);
  doc.setFont(undefined, "normal");
  doc.text(calc.resultado > 0 ? `R$ ${calc.resultado.toFixed(2)} a cobrar` : `Crédito de R$ ${Math.abs(calc.resultado).toFixed(2)}`, 90, y);
  y += 18;

  doc.setFontSize(9.5); doc.setTextColor(110, 110, 110);
  doc.text(`Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`, 15, y);
  y += 22;

  doc.setTextColor(40, 40, 40); doc.setFontSize(10.5);
  doc.text("_______________________________________________", 15, y); y += 6;
  doc.text("Assinatura do(a) cliente", 15, y);

  const fileName = `Termo-Aprovacao-${m.code}.pdf`;
  (async () => {
    const blob = doc.output("blob");
    const file = new File([blob], fileName, { type: "application/pdf" });
    const attachmentId = await saveAttachment(file);
    m.documentos.push({
      id: "doc" + Date.now() + Math.random().toString(36).slice(2, 6), tipo: "termo_aprovacao", label: "Termo de aprovação",
      attachmentId, fileName, origem: "gerado", data: todayISODate(), versaoRelacionada: versaoId,
    });
    versao.status = "aguardando_assinatura";
    if (m.status === "em_orcamento") setModificationStatus(m, "aguardando_aprovacao", "Termo de aprovação gerado — " + versionLabel(versao.numero));
    else addModificationHistoryEntry(m, "Termo de aprovação gerado — " + versionLabel(versao.numero));
    persist();
    doc.save(fileName);
    toast("Termo de aprovação gerado.", "success");
    goToModificationDetail(m.id);
  })();
}

/* A assinatura do termo É a aprovação — uma ação só faz tudo: anexa o
   arquivo, marca a versão como aprovada, e libera Financeiro/Obra. Não existe
   um "marcar como aprovado" separado. */
function anexarTermoAprovacaoAssinado(m, versaoId) {
  const versao = m.orcamento.versoes.find(v => v.id === versaoId);
  if (!versao) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/pdf,image/*";
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    const attachmentId = await saveAttachment(file);
    m.documentos.push({
      id: "doc" + Date.now() + Math.random().toString(36).slice(2, 6), tipo: "termo_aprovacao_assinado", label: "Termo de aprovação (assinado)",
      attachmentId, fileName: file.name, origem: "anexado", data: todayISODate(), versaoRelacionada: versaoId,
    });
    versao.status = "aprovado";
    m.orcamento.versaoAprovadaId = versaoId;
    m.aprovacaoCliente = { data: todayISODate(), versaoAprovada: versionLabel(versao.numero), responsavel: ensureOperatorName(), observacao: "", evidenciaAttachmentId: attachmentId };
    setModificationStatus(m, "aprovada", "Termo assinado anexado — orçamento aprovado", versionLabel(versao.numero));
    persist();
    toast("Orçamento aprovado.", "success");
    goToModificationDetail(m.id);
  });
  input.click();
}

/* Texto legal exatamente como fornecido pela construtora (Termo de
   Conhecimento dos Riscos e Concordância — integração de sacada), só
   parametrizado. Nunca parafrasear uma declaração legal. */
function textoTermoIntegracaoSacada(d) {
  return [
    `Eu, ${d.nome}, nacionalidade: ${d.nacionalidade}, estado civil: ${d.estadoCivil}, profissão: ${d.profissao}, inscrito(a) no CPF sob o n.º ${d.cpf}, residente e domiciliado(a) na ${d.endereco}, na qualidade de detentor dos direitos aquisitivos do imóvel representado pelo Apartamento, n.º ${d.unidade}, do Empreendimento ${d.empreendimento}, conforme compromisso de compra e venda datado de ${d.dataCompromisso}, firmado junto a SBJ Construtora e Incorporadora.`,
    `O apartamento foi projetado para constar sacada aberta com área molhada contendo desnível entre a sacada e o pavimento interno de apartamento com ralo na sacada.`,
    `No entanto, venho por meio desta, solicitar que a Construtora remova o desnível de piso entre a área molhada e o pavimento interno do apartamento, assim como efetue a remoção do ralo de escoamento da água, ou seja, que seja efetuado o nivelamento do piso, para possibilitar que no futuro possa ser integrado os ambientes e colocado envidraçamento na sacada via Reiki ou outro similar.`,
    `Para tanto, declaro que fui informado de que como o projeto do empreendimento foi idealizado com sacada aberta contendo área molhada, a Construtora, não se responsabilizará, pelos riscos de eventuais infiltrações ou vazamento de água da chuva que porventura possa ocorrer na área da sacada, mesmo após o fechamento por meio de envidraçamento, tendo em vista, que o sistema de envidraçamento não garante a total vedação.`,
    `Para tanto, estou ciente das consequências e, portanto, isento a Construtora de quaisquer problemas futuros que possam ocorrer em relação a alteração solicitada.`,
    `Nada mais a declarar, e ciente dos riscos que envolvem as alterações solicitadas.`,
  ];
}

function gerarTermoIntegracaoSacadaPDF(m) {
  if (!window.jspdf) { toast("Biblioteca de PDF não carregada.", "error"); return; }
  const client = m.clientId ? getClient(m.clientId) : null;
  if (!client) { toast("Esta unidade não tem cliente cadastrado — cadastre o cliente antes de gerar o termo.", "error"); return; }
  const faltando = ["cpf", "nacionalidade", "estadoCivil", "profissao", "enderecoCompleto", "dataCompromisso"].filter(f => !client[f]);
  if (faltando.length) {
    toast("Faltam dados legais do cliente pra gerar o termo — complete e tente de novo.", "");
    openCompletarDadosLegaisForm(client, () => gerarTermoIntegracaoSacadaPDF(m));
    return;
  }
  const b = getBuilding(m.buildingId);
  const dados = {
    nome: client.name, nacionalidade: client.nacionalidade, estadoCivil: client.estadoCivil, profissao: client.profissao,
    cpf: client.cpf, endereco: client.enderecoCompleto, unidade: m.unit, empreendimento: b ? b.name : "—",
    dataCompromisso: fmtDate(client.dataCompromisso),
  };
  const paragrafos = textoTermoIntegracaoSacada(dados);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 20;
  const maxWidth = pageWidth - marginX * 2;
  let y = 22;

  doc.setFont(undefined, "bold"); doc.setFontSize(12); doc.setTextColor(20, 20, 20);
  doc.text("TERMO DE CONHECIMENTO DOS RISCOS E CONCORDÂNCIA", pageWidth / 2, y, { align: "center" });
  y += 12;

  doc.setFont(undefined, "normal"); doc.setFontSize(10.5); doc.setTextColor(30, 30, 30);
  paragrafos.forEach(p => {
    const linhas = doc.splitTextToSize(p, maxWidth);
    if (y + linhas.length * 5.2 > 270) { doc.addPage(); y = 22; }
    doc.text(linhas, marginX, y);
    y += linhas.length * 5.2 + 5;
  });

  y += 10;
  if (y > 255) { doc.addPage(); y = 22; }
  doc.text(`${escapeHtml(b?.address || "").trim() ? b.address + ", " : ""}${new Date().toLocaleDateString("pt-BR")}`, marginX, y);
  y += 20;
  doc.text("___________________________________________________", marginX, y); y += 6;
  doc.text("Assinatura do(a) declarante", marginX, y);

  const fileName = `Termo-Integracao-Sacada-${m.code}.pdf`;
  (async () => {
    const blob = doc.output("blob");
    const file = new File([blob], fileName, { type: "application/pdf" });
    const attachmentId = await saveAttachment(file);
    m.documentos.push({
      id: "doc" + Date.now() + Math.random().toString(36).slice(2, 6), tipo: "termo_integracao_sacada",
      label: "Termo de concordância de integração de sacada", attachmentId, fileName, origem: "gerado", data: todayISODate(),
    });
    addModificationHistoryEntry(m, "Termo de integração de sacada gerado");
    persist();
    doc.save(fileName);
    toast("Termo gerado.", "success");
    goToModificationDetail(m.id);
  })();
}

/* Dados legais do cliente, usados só na geração de termos formais — não
   aparecem no cadastro geral porque a maioria dos casos não precisa deles.
   Preenchidos uma vez, ficam salvos no cliente e nunca mais são pedidos. */
function openCompletarDadosLegaisForm(client, onComplete) {
  openModal(`
    <div class="modal-header"><h2>Completar dados do cliente</h2><button class="modal-close" data-close>&times;</button></div>
    <div class="modal-body">
      <p class="hint">Necessários pra gerar o termo. Preenchidos uma vez só — ficam salvos no cadastro deste cliente.</p>
      <form id="dados-legais-form">
        <div class="form-grid">
          <div class="field full"><label>Nome completo</label><input type="text" name="name" value="${escapeHtml(client.name || "")}" required></div>
          <div class="field"><label>Nacionalidade</label><input type="text" name="nacionalidade" value="${escapeHtml(client.nacionalidade || "Brasileiro(a)")}" required></div>
          <div class="field"><label>Estado civil</label><input type="text" name="estadoCivil" value="${escapeHtml(client.estadoCivil || "")}" required></div>
          <div class="field"><label>Profissão</label><input type="text" name="profissao" value="${escapeHtml(client.profissao || "")}" required></div>
          <div class="field"><label>CPF</label><input type="text" name="cpf" value="${escapeHtml(client.cpf || "")}" required></div>
          <div class="field"><label>Data do compromisso de compra e venda</label><input type="date" name="dataCompromisso" value="${client.dataCompromisso || ""}" required></div>
          <div class="field full"><label>Endereço completo (rua, número, cidade, estado, país, CEP)</label><textarea name="enderecoCompleto" required>${escapeHtml(client.enderecoCompleto || "")}</textarea></div>
        </div>
      </form>
    </div>
    <div class="modal-footer"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="btn-save-dados-legais">Salvar e continuar</button></div>
  `, true);
  wireModalClose();
  document.getElementById("btn-save-dados-legais").addEventListener("click", () => {
    const form = document.getElementById("dados-legais-form");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    client.name = fd.get("name").trim();
    client.nacionalidade = fd.get("nacionalidade").trim();
    client.estadoCivil = fd.get("estadoCivil").trim();
    client.profissao = fd.get("profissao").trim();
    client.cpf = fd.get("cpf").trim();
    client.dataCompromisso = fd.get("dataCompromisso");
    client.enderecoCompleto = fd.get("enderecoCompleto").trim();
    persist();
    closeModal();
    toast("Dados do cliente atualizados.", "success");
    onComplete();
  });
}

function openPriceTableModal() {
  const rows = state.priceTable.slice().sort((a, b) => a.categoria.localeCompare(b.categoria, "pt-BR"));
  openModal(`
    <div class="modal-header"><h2>Tabela de Preços — Modificações</h2><button class="modal-close" data-close>&times;</button></div>
    <div class="modal-body">
      <p class="hint">Reajustar aqui não altera orçamentos já criados — cada orçamento guarda o valor praticado no momento em que foi feito.</p>
      <div class="table-wrap">
        <table class="mini-table">
          <thead><tr><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Unidade</th><th>Vigente desde</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows.length ? rows.map(p => `<tr>
            <td>${escapeHtml(p.descricao)}</td><td>${escapeHtml(p.categoria)}</td><td>R$ ${p.valor.toFixed(2)}</td><td>${escapeHtml(p.unidade)}</td><td>${fmtDate(p.vigenteDesde)}</td>
            <td>${p.ativo ? "Ativo" : "Inativo"}</td>
            <td><button class="btn ghost small" data-edit-price="${p.id}">Editar</button></td>
          </tr>`).join("") : `<tr><td colspan="7" class="empty-hint">Nenhum serviço cadastrado.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
    <div class="modal-footer"><button class="btn ghost" id="btn-add-price" style="margin-right:auto;">+ Serviço</button><button class="btn primary" data-close>Fechar</button></div>
  `, true);
  wireModalClose();
  document.getElementById("btn-add-price").addEventListener("click", () => openPriceRowForm(null));
  document.querySelectorAll("[data-edit-price]").forEach(el => el.addEventListener("click", () => openPriceRowForm(el.dataset.editPrice)));
}
function openPriceRowForm(id) {
  const editing = id ? state.priceTable.find(p => p.id === id) : null;
  openModal(`
    <div class="modal-header"><h2>${editing ? "Editar" : "Novo"} serviço</h2><button class="modal-close" data-close>&times;</button></div>
    <div class="modal-body">
      <form id="price-form">
        <div class="form-grid">
          <div class="field full"><label>Descrição</label><input type="text" name="descricao" required value="${editing ? escapeHtml(editing.descricao) : ""}" placeholder="Ex: Ponto elétrico"></div>
          <div class="field"><label>Categoria</label><select name="categoria">${state.modificationCategories.map(c => `<option value="${c}" ${editing?.categoria === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
          <div class="field"><label>Valor (R$)</label><input type="number" min="0" step="0.01" name="valor" required value="${editing ? editing.valor : ""}"></div>
          <div class="field"><label>Unidade de cobrança</label><input type="text" name="unidade" value="${editing ? escapeHtml(editing.unidade) : "ponto"}" placeholder="Ex: ponto, circuito, nicho"></div>
          <div class="field"><label>Vigente desde</label><input type="date" name="vigenteDesde" value="${editing ? editing.vigenteDesde : todayISODate()}"></div>
          <div class="field full"><label class="checkbox-inline"><input type="checkbox" name="ativo" ${!editing || editing.ativo ? "checked" : ""}> Ativo</label></div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      ${editing ? `<button class="btn danger" id="btn-delete-price" style="margin-right:auto;">Excluir</button>` : ""}
      <button class="btn ghost" id="btn-back-price">Voltar</button>
      <button class="btn primary" id="btn-save-price">Salvar</button>
    </div>
  `);
  wireModalClose();
  document.getElementById("btn-back-price").addEventListener("click", openPriceTableModal);
  document.getElementById("btn-save-price").addEventListener("click", () => {
    const form = document.getElementById("price-form");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const payload = { descricao: fd.get("descricao").trim(), categoria: fd.get("categoria"), valor: Number(fd.get("valor")), unidade: fd.get("unidade").trim(), vigenteDesde: fd.get("vigenteDesde"), ativo: fd.get("ativo") === "on" };
    if (editing) Object.assign(editing, payload);
    else state.priceTable.push({ id: "pt" + (state.priceTableSeq++), ...payload });
    persist();
    toast("Tabela de preços atualizada.", "success");
    openPriceTableModal();
  });
  const delBtn = document.getElementById("btn-delete-price");
  if (delBtn) delBtn.addEventListener("click", () => {
    if (!confirm("Excluir este serviço da tabela?")) return;
    state.priceTable = state.priceTable.filter(p => p.id !== editing.id);
    persist();
    openPriceTableModal();
  });
}

function openCreditTableModal(buildingId) {
  const b = getBuilding(buildingId);
  const rows = state.creditTable.filter(c => c.buildingId === buildingId);
  openModal(`
    <div class="modal-header"><h2>Tabela de Créditos — ${escapeHtml(b.name)}</h2><button class="modal-close" data-close>&times;</button></div>
    <div class="modal-body">
      <p class="hint">Cadastrada por empreendimento — o mesmo item pode ter custos diferentes em obras diferentes. Nem todo item retirado precisa gerar crédito.</p>
      <div class="table-wrap">
        <table class="mini-table">
          <thead><tr><th>Item</th><th>Custo da construtora</th><th>Crédito ao cliente</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows.length ? rows.map(c => `<tr>
            <td>${escapeHtml(c.item)}</td><td>R$ ${c.custoConstrutora.toFixed(2)}</td><td>R$ ${c.creditoCliente.toFixed(2)}</td>
            <td>${c.ativo ? "Ativo" : "Inativo"}</td>
            <td><button class="btn ghost small" data-edit-credit="${c.id}">Editar</button></td>
          </tr>`).join("") : `<tr><td colspan="5" class="empty-hint">Nenhum item de crédito cadastrado.</td></tr>`}</tbody>
        </table>
      </div>
    </div>
    <div class="modal-footer"><button class="btn ghost" id="btn-add-credit" style="margin-right:auto;">+ Item de crédito</button><button class="btn primary" data-close>Fechar</button></div>
  `, true);
  wireModalClose();
  document.getElementById("btn-add-credit").addEventListener("click", () => openCreditRowForm(buildingId, null));
  document.querySelectorAll("[data-edit-credit]").forEach(el => el.addEventListener("click", () => openCreditRowForm(buildingId, el.dataset.editCredit)));
}
function openCreditRowForm(buildingId, id) {
  const editing = id ? state.creditTable.find(c => c.id === id) : null;
  openModal(`
    <div class="modal-header"><h2>${editing ? "Editar" : "Novo"} item de crédito</h2><button class="modal-close" data-close>&times;</button></div>
    <div class="modal-body">
      <form id="credit-form">
        <div class="form-grid">
          <div class="field full"><label>Item</label><input type="text" name="item" required value="${editing ? escapeHtml(editing.item) : ""}" placeholder="Ex: Porta de entrada"></div>
          <div class="field"><label>Custo da construtora (R$)</label><input type="number" min="0" step="0.01" name="custoConstrutora" required value="${editing ? editing.custoConstrutora : ""}"></div>
          <div class="field"><label>Crédito ao cliente (R$)</label><input type="number" min="0" step="0.01" name="creditoCliente" required value="${editing ? editing.creditoCliente : ""}"></div>
          <div class="field full"><label class="checkbox-inline"><input type="checkbox" name="ativo" ${!editing || editing.ativo ? "checked" : ""}> Ativo</label></div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      ${editing ? `<button class="btn danger" id="btn-delete-credit" style="margin-right:auto;">Excluir</button>` : ""}
      <button class="btn ghost" id="btn-back-credit">Voltar</button>
      <button class="btn primary" id="btn-save-credit">Salvar</button>
    </div>
  `);
  wireModalClose();
  document.getElementById("btn-back-credit").addEventListener("click", () => openCreditTableModal(buildingId));
  document.getElementById("btn-save-credit").addEventListener("click", () => {
    const form = document.getElementById("credit-form");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const payload = { buildingId, item: fd.get("item").trim(), custoConstrutora: Number(fd.get("custoConstrutora")), creditoCliente: Number(fd.get("creditoCliente")), ativo: fd.get("ativo") === "on" };
    if (editing) Object.assign(editing, payload);
    else state.creditTable.push({ id: "ct" + (state.creditTableSeq++), ...payload });
    persist();
    toast("Tabela de créditos atualizada.", "success");
    openCreditTableModal(buildingId);
  });
  const delBtn = document.getElementById("btn-delete-credit");
  if (delBtn) delBtn.addEventListener("click", () => {
    if (!confirm("Excluir este item da tabela de créditos?")) return;
    state.creditTable = state.creditTable.filter(c => c.id !== editing.id);
    persist();
    openCreditTableModal(buildingId);
  });
}

/* ---------- Exportação pro financeiro ---------- */

function exportarInformacoesFinanceiro(m) {
  const b = getBuilding(m.buildingId);
  const client = m.clientId ? getClient(m.clientId) : null;
  const versao = m.orcamento.versoes.find(v => v.id === m.orcamento.versaoAprovadaId);
  const calc = versao ? calcularVersaoOrcamento(versao) : { totalAdicionais: 0, totalCreditos: 0, resultado: 0 };
  const rows = [
    ["Empreendimento", "Apartamento", "Cliente", "Modificação", "Adicionais", "Créditos", "Valor final", "Condição de pagamento", "Observações"],
    [b ? b.name : "", m.unit, client ? client.name : "", m.code, calc.totalAdicionais.toFixed(2), calc.totalCreditos.toFixed(2), calc.resultado.toFixed(2), m.financeiro.condicaoPagamento, m.financeiro.observacoes],
  ];
  const csv = rows.map(r => r.map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${m.code}-financeiro.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast("CSV exportado.", "success");
}

/* ---------- Painel Geral — bloco de KPIs e "Precisa da minha atenção" ---------- */

/* Sem nenhum campo de prazo/SLA cadastrado ainda por modificação — "atrasada"
   é definida como "parada", não como prazo estourado: mais de 5 dias desde o
   último evento do histórico, em qualquer status aberto. */
function isModificacaoAtrasada(m) {
  if (MODIFICATION_CLOSED_STATUSES.includes(m.status)) return false;
  const last = m.history[m.history.length - 1];
  if (!last) return false;
  return daysDiff(last.date.slice(0, 10), todayISODate()) > 5;
}

function renderModificationsHomeKpis() {
  const root = document.getElementById("modifications-home-kpi-grid");
  if (!root) return;
  const mods = state.modifications;
  const kpis = [
    { label: "Em análise", value: mods.filter(m => m.status === "solicitacao_recebida" || m.status === "em_analise").length },
    { label: "Aguardando aprovação", value: mods.filter(m => m.status === "aguardando_aprovacao").length },
    { label: "Aprovadas", value: mods.filter(m => m.status === "aprovada").length },
    { label: "Em execução", value: mods.filter(m => m.status === "em_execucao").length },
    { label: "Aguardando conferência", value: mods.filter(m => m.status === "aguardando_conferencia" || m.status === "nao_conforme").length },
    { label: "Atrasadas", value: mods.filter(isModificacaoAtrasada).length, cls: mods.some(isModificacaoAtrasada) ? "warn" : "good" },
    { label: "Finalizadas", value: mods.filter(m => m.status === "finalizada").length },
  ];
  root.innerHTML = kpis.map(k => `<div class="kpi-card ${k.cls || ""}"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div></div>`).join("");
}

/* Mesmo formato de retorno de motivoAtencaoDoChamado (tickets.js/app.js), pra
   as duas listas se mesclarem sem tratamento especial em montarListaAtencao. */
function motivoAtencaoDaModificacao(m, hoje) {
  const b = getBuilding(m.buildingId);
  const local = `${b ? b.name : "—"}${m.unit ? " / " + m.unit : ""}`;

  if (m.status === "aguardando_conferencia") {
    return { m, local, motivo: "Execução concluída — aguardando conferência", dias: 0, acaoLabel: "VER MODIFICAÇÃO" };
  }
  if (m.status === "nao_conforme") {
    return { m, local, motivo: "Não conforme — aguardando correção da obra", dias: 0, acaoLabel: "VER MODIFICAÇÃO" };
  }
  if (m.status === "aguardando_aprovacao") {
    const last = m.history.slice().reverse().find(h => h.statusTo === "aguardando_aprovacao");
    const dias = last ? daysDiff(last.date.slice(0, 10), hoje) : 0;
    if (dias >= 3) return { m, local, motivo: `Orçamento aguardando aprovação há ${dias} dia${dias === 1 ? "" : "s"}`, dias, acaoLabel: "VER MODIFICAÇÃO" };
  }
  if (isModificacaoAtrasada(m)) {
    const dias = daysDiff(m.history[m.history.length - 1].date.slice(0, 10), hoje);
    return { m, local, motivo: `Sem movimentação há ${dias} dias`, dias, acaoLabel: "VER MODIFICAÇÃO" };
  }
  return null;
}

/* ---------- Lista / dashboard de Modificações ---------- */

function renderModificationsList() {
  const kpis = [
    { label: "Total", value: state.modifications.length },
    { label: "Em análise", value: state.modifications.filter(m => m.status === "em_analise" || m.status === "solicitacao_recebida").length },
    { label: "Aguardando aprovação", value: state.modifications.filter(m => m.status === "aguardando_aprovacao").length },
    { label: "Aprovadas", value: state.modifications.filter(m => m.status === "aprovada").length },
    { label: "Em execução", value: state.modifications.filter(m => m.status === "em_execucao").length },
    { label: "Aguardando conferência", value: state.modifications.filter(m => m.status === "aguardando_conferencia" || m.status === "nao_conforme").length },
    { label: "Finalizadas", value: state.modifications.filter(m => m.status === "finalizada").length },
    { label: "Não conformes", value: state.modifications.filter(m => m.status === "nao_conforme").length, cls: state.modifications.some(m => m.status === "nao_conforme") ? "warn" : "good" },
  ];
  const kpiRoot = document.getElementById("modifications-kpi-grid");
  if (kpiRoot) kpiRoot.innerHTML = kpis.map(k => `<div class="kpi-card ${k.cls || ""}"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div></div>`).join("");

  const buildingSel = document.getElementById("filter-mod-building");
  if (buildingSel && !buildingSel.dataset.wired) {
    buildingSel.innerHTML = `<option value="">Todos os empreendimentos</option>` + state.buildings.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");
    buildingSel.dataset.wired = "1";
  }
  const statusSel = document.getElementById("filter-mod-status");
  if (statusSel && !statusSel.dataset.wired) {
    statusSel.innerHTML = `<option value="">Todos os status</option>` + MODIFICATION_STATUS.map(s => `<option value="${s.id}">${s.label}</option>`).join("");
    statusSel.dataset.wired = "1";
  }
  const itemSel = document.getElementById("filter-mod-item");
  if (itemSel && !itemSel.dataset.wired) {
    itemSel.innerHTML = `<option value="">Todos os itens</option>` + state.mapItems.map(i => `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`).join("");
    itemSel.dataset.wired = "1";
  }

  const buildingVal = buildingSel?.value || "";
  const statusVal = statusSel?.value || "";
  const itemVal = itemSel?.value || "";
  const searchVal = (document.getElementById("filter-mod-search")?.value || "").trim().toLowerCase();

  let list = state.modifications.slice();
  if (buildingVal) list = list.filter(m => m.buildingId === buildingVal);
  if (statusVal) list = list.filter(m => m.status === statusVal);
  if (itemVal) list = list.filter(m => m.itensMapa.includes(itemVal));
  if (searchVal) {
    list = list.filter(m => m.code.toLowerCase().includes(searchVal) || m.unit.toLowerCase().includes(searchVal) || (m.solicitacaoTexto || "").toLowerCase().includes(searchVal));
  }
  list.sort((a, b) => b.dataSolicitacao.localeCompare(a.dataSolicitacao));

  const tbody = document.querySelector("#modifications-table tbody");
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="6" class="empty-hint">Nenhuma modificação encontrada.</td></tr>`; return; }
  tbody.innerHTML = list.map(m => {
    const b = getBuilding(m.buildingId);
    const client = m.clientId ? getClient(m.clientId) : null;
    return `<tr data-open-mod="${m.id}" style="cursor:pointer;">
      <td>${m.code}</td>
      <td>${escapeHtml(b ? b.name : "—")} / ${escapeHtml(m.unit)}</td>
      <td>${client ? escapeHtml(client.name) : "—"}</td>
      <td>${m.itensMapa.map(escapeHtml).join(", ") || "—"}</td>
      <td>${fmtDate(m.dataSolicitacao)}</td>
      <td><span class="badge mod-status-${m.status}">${MODIFICATION_STATUS_MAP[m.status].label}</span></td>
    </tr>`;
  }).join("");
  tbody.querySelectorAll("[data-open-mod]").forEach(el => el.addEventListener("click", () => goToModificationDetail(el.dataset.openMod)));
}

/* ---------- Mapa de Modificações ---------- */
/* Visão apto × item, sempre calculada — nunca uma segunda base de dados.
   Hierarquia: Não vendido > Modificado > Aguardar > Padrão. Só "Aguardar" é
   gravado (state.mapaPendencias); os outros três nunca viram registro. */

/* Hoje "vendida" é inferido pela existência de um cliente com nome na unidade.
   Quando existir um campo explícito de status comercial da unidade
   (Disponível/Reservada/Vendida), trocar esta checagem por ele, sem mexer no
   resto da lógica do mapa. */
function unitIsVendida(buildingId, unit) {
  const client = state.clients.find(c => c.buildingId === buildingId && c.unit === unit);
  return !!(client && client.name && client.name.trim());
}

function modificacoesAtivasParaUnidade(buildingId, unit) {
  return state.modifications
    .filter(m => m.buildingId === buildingId && m.unit === unit && !MODIFICATION_NEGATIVE_STATUSES.includes(m.status))
    .sort((a, b) => b.dataSolicitacao.localeCompare(a.dataSolicitacao));
}
function modificacaoAtivaParaItem(buildingId, unit, item) {
  return modificacoesAtivasParaUnidade(buildingId, unit).find(m => (m.itensMapa || []).includes(item)) || null;
}

function mapCellStatus(buildingId, unit, item, vendida) {
  if (!vendida) return { status: "nao_vendido" };
  const mod = modificacaoAtivaParaItem(buildingId, unit, item);
  if (mod) return { status: "modificado", modificacaoId: mod.id };
  const pendente = state.mapaPendencias.some(p => p.buildingId === buildingId && p.unit === unit && p.item === item);
  if (pendente) return { status: "aguardar" };
  return { status: "padrao" };
}

/* Único write manual do mapa — liga/desliga "Aguardar". Nunca aceita
   "modificado": isso só existe como consequência de uma modificação cadastrada. */
function setMapaPendencia(buildingId, unit, item, pendente) {
  const idx = state.mapaPendencias.findIndex(p => p.buildingId === buildingId && p.unit === unit && p.item === item);
  if (pendente && idx === -1) state.mapaPendencias.push({ id: "mp" + (state.mapaPendenciaSeq++), buildingId, unit, item });
  if (!pendente && idx !== -1) state.mapaPendencias.splice(idx, 1);
  persist();
}

function buildingMapSummary(buildingId) {
  const units = state.clients.filter(c => c.buildingId === buildingId);
  let vendidas = 0, comModificacao = 0, comPendencia = 0;
  units.forEach(c => {
    const vendida = unitIsVendida(buildingId, c.unit);
    if (vendida) vendidas++;
    let hasMod = false, hasPend = false;
    state.mapItems.forEach(item => {
      const st = mapCellStatus(buildingId, c.unit, item, vendida).status;
      if (st === "modificado") hasMod = true;
      if (st === "aguardar") hasPend = true;
    });
    if (hasMod) comModificacao++;
    if (hasPend) comPendencia++;
  });
  return { total: units.length, vendidas, naoVendidas: units.length - vendidas, comModificacao, comPendencia };
}

function itemModificadoCounts(buildingId) {
  const units = state.clients.filter(c => c.buildingId === buildingId);
  return state.mapItems.map(item => ({
    item,
    count: units.filter(c => mapCellStatus(buildingId, c.unit, item, unitIsVendida(buildingId, c.unit)).status === "modificado").length,
  })).filter(x => x.count > 0);
}

/* ---------- Tela do mapa ---------- */

function goToModificationsMap() {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-modifications-map").classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === "modifications"));
  document.getElementById("view-title").textContent = "Mapa de Modificações";
  document.getElementById("view-subtitle").textContent = "Visão rápida por apartamento — onde existe alteração em relação ao padrão da construtora";
  renderModificationsMap();
}

function renderModificationsMap() {
  const buildingSel = document.getElementById("mapa-building");
  if (!buildingSel.dataset.wired) {
    buildingSel.innerHTML = `<option value="">Selecione o empreendimento</option>` + state.buildings.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");
    buildingSel.dataset.wired = "1";
    buildingSel.addEventListener("change", renderModificationsMapTable);
  }
  const statusSel = document.getElementById("mapa-status-filter");
  if (!statusSel.dataset.wired) {
    statusSel.innerHTML = `<option value="">Todos os status</option>` + Object.entries(MAPA_STATUS).map(([id, s]) => `<option value="${id}">${s.label}</option>`).join("");
    statusSel.dataset.wired = "1";
    statusSel.addEventListener("change", renderModificationsMapTable);
  }
  const itemSel = document.getElementById("mapa-item-filter");
  if (!itemSel.dataset.wired) {
    itemSel.innerHTML = `<option value="">Todos os itens</option>` + state.mapItems.map(i => `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`).join("");
    itemSel.dataset.wired = "1";
    itemSel.addEventListener("change", renderModificationsMapTable);
  }
  const searchInput = document.getElementById("mapa-search");
  if (!searchInput.dataset.wired) {
    searchInput.dataset.wired = "1";
    searchInput.addEventListener("input", renderModificationsMapTable);
  }
  const exportBtn = document.getElementById("btn-export-mapa");
  if (!exportBtn.dataset.wired) {
    exportBtn.dataset.wired = "1";
    exportBtn.addEventListener("click", () => {
      const buildingId = document.getElementById("mapa-building").value;
      if (!buildingId) { toast("Selecione um empreendimento antes de exportar.", "error"); return; }
      exportarMapaModificacoes(buildingId);
    });
  }
  const exportPdfBtn = document.getElementById("btn-export-mapa-pdf");
  if (!exportPdfBtn.dataset.wired) {
    exportPdfBtn.dataset.wired = "1";
    exportPdfBtn.addEventListener("click", () => {
      const buildingId = document.getElementById("mapa-building").value;
      if (!buildingId) { toast("Selecione um empreendimento antes de exportar.", "error"); return; }
      exportarMapaModificacoesPDF(buildingId);
    });
  }
  const backBtn = document.getElementById("btn-back-modifications-map");
  if (!backBtn.dataset.wired) {
    backBtn.dataset.wired = "1";
    backBtn.addEventListener("click", () => showView("modifications"));
  }
  renderModificationsMapTable();
}

/* Única fonte de verdade das linhas filtradas do mapa — tela, CSV e PDF usam
   exatamente esta função, nunca uma lógica de filtro separada por exportação. */
function getMapaRows(buildingId, statusFiltro, itemFiltro, search) {
  let units = state.clients.filter(c => c.buildingId === buildingId).sort((a, c2) => a.unit.localeCompare(c2.unit, "pt-BR", { numeric: true }));
  if (search) units = units.filter(c => c.unit.toLowerCase().includes(search) || (c.name || "").toLowerCase().includes(search));
  return units.map(c => {
    const vendida = unitIsVendida(buildingId, c.unit);
    const cells = state.mapItems.map(item => ({ item, ...mapCellStatus(buildingId, c.unit, item, vendida) }));
    return { c, vendida, cells };
  }).filter(r => {
    if (!statusFiltro) return true;
    if (itemFiltro) {
      const cell = r.cells.find(x => x.item === itemFiltro);
      return cell && cell.status === statusFiltro;
    }
    return r.cells.some(x => x.status === statusFiltro);
  });
}
function currentMapaFiltros() {
  return {
    buildingId: document.getElementById("mapa-building").value,
    statusFiltro: document.getElementById("mapa-status-filter").value,
    itemFiltro: document.getElementById("mapa-item-filter").value,
    search: (document.getElementById("mapa-search").value || "").trim().toLowerCase(),
  };
}

function renderModificationsMapTable() {
  const { buildingId, statusFiltro, itemFiltro, search } = currentMapaFiltros();
  const summaryRoot = document.getElementById("modifications-map-summary");
  const tableRoot = document.getElementById("modifications-map-table");
  if (!buildingId) {
    summaryRoot.innerHTML = "";
    tableRoot.innerHTML = `<div class="empty-hint">Selecione um empreendimento pra ver o mapa.</div>`;
    return;
  }
  const b = getBuilding(buildingId);

  const summary = buildingMapSummary(buildingId);
  const porItem = itemModificadoCounts(buildingId);
  summaryRoot.innerHTML = `
    <div class="panel" style="margin-bottom:14px;">
      <h3>${escapeHtml(b.name)}</h3>
      <div class="detail-info-grid">
        <div><div class="di-label">Total de unidades</div>${summary.total}</div>
        <div><div class="di-label">Vendidas</div>${summary.vendidas}</div>
        <div><div class="di-label">Não vendidas</div>${summary.naoVendidas}</div>
        <div><div class="di-label">Com modificação</div>${summary.comModificacao}</div>
        <div><div class="di-label">Com pendência</div>${summary.comPendencia}</div>
      </div>
      ${porItem.length ? `<div style="margin-top:10px;">${porItem.map(x => `<span class="badge outline" style="margin:0 6px 6px 0;">${escapeHtml(x.item)} — ${x.count} apto${x.count === 1 ? "" : "s"}</span>`).join("")}</div>` : ""}
      <div class="hint" style="margin-top:8px;">Última atualização: ${new Date().toLocaleString("pt-BR")}</div>
    </div>
  `;

  const rows = getMapaRows(buildingId, statusFiltro, itemFiltro, search);

  if (!rows.length) { tableRoot.innerHTML = `<div class="empty-hint">Nenhuma unidade encontrada com os filtros atuais.</div>`; return; }

  tableRoot.innerHTML = `
    <div class="table-wrap">
      <table class="mini-table mapa-table">
        <thead><tr><th>Apto</th><th>Cliente</th>${state.mapItems.map(i => `<th>${escapeHtml(i)}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td>${escapeHtml(r.c.unit)}</td>
            <td>${r.c.name ? escapeHtml(r.c.name) : '<span class="empty-hint">—</span>'}</td>
            ${r.cells.map(cell => `<td><span class="mapa-cell mapa-${cell.status}" data-mapa-cell data-building="${buildingId}" data-unit="${escapeHtml(r.c.unit)}" data-item="${escapeHtml(cell.item)}" data-status="${cell.status}" data-mod-id="${cell.modificacaoId || ""}">${MAPA_STATUS[cell.status].label}</span></td>`).join("")}
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
  wireMapaCellClicks();
}

function wireMapaCellClicks() {
  document.querySelectorAll("[data-mapa-cell]").forEach(el => {
    el.addEventListener("click", () => {
      const { building, unit, item, status, modId } = el.dataset;
      if (status === "modificado") { openMapaCelulaModificadoModal(modId); return; }
      if (status === "nao_vendido") { toast("Esta unidade está marcada como não vendida no cadastro comercial. Pra alterar, edite o cliente da unidade.", ""); return; }
      openMapaStatusManualModal(building, unit, item);
    });
  });
}

function openMapaStatusManualModal(buildingId, unit, item) {
  openModal(`
    <div class="modal-header"><h2>Status manual — Apto ${escapeHtml(unit)} · ${escapeHtml(item)}</h2><button class="modal-close" data-close>&times;</button></div>
    <div class="modal-body"><p class="hint">MODIFICADO nunca é escolhido manualmente — vem sempre de uma modificação cadastrada com esse item marcado.</p></div>
    <div class="modal-footer">
      <button class="btn ghost" data-close>Cancelar</button>
      <button class="btn ghost" id="btn-mapa-padrao">Padrão</button>
      <button class="btn primary" id="btn-mapa-aguardar">Aguardar</button>
    </div>
  `, true);
  wireModalClose();
  document.getElementById("btn-mapa-padrao").addEventListener("click", () => {
    setMapaPendencia(buildingId, unit, item, false);
    closeModal();
    renderModificationsMapTable();
  });
  document.getElementById("btn-mapa-aguardar").addEventListener("click", () => {
    setMapaPendencia(buildingId, unit, item, true);
    closeModal();
    renderModificationsMapTable();
  });
}

function openMapaCelulaModificadoModal(modificacaoId) {
  const m = getModification(modificacaoId);
  if (!m) return;
  const client = m.clientId ? getClient(m.clientId) : null;
  const arquivos = [];
  m.projeto.versoes.forEach(v => v.arquivos.forEach(a => arquivos.push(`Projeto ${versionLabel(v.numero)} — ${a.fileName}`)));
  if (m.orcamento.versaoAprovadaId) {
    const v = m.orcamento.versoes.find(x => x.id === m.orcamento.versaoAprovadaId);
    if (v) arquivos.push(`Orçamento aprovado (${versionLabel(v.numero)})`);
  }
  arquivos.push(`Solicitação do cliente (registrada em ${fmtDate(m.dataSolicitacao)})`);
  openModal(`
    <div class="modal-header"><h2>${m.code}</h2><button class="modal-close" data-close>&times;</button></div>
    <div class="modal-body">
      <div class="detail-info-grid">
        <div><div class="di-label">Apartamento</div>${escapeHtml(m.unit)}</div>
        <div><div class="di-label">Cliente</div>${client ? escapeHtml(client.name) : "—"}</div>
        <div><div class="di-label">Itens afetados</div>${m.itensMapa.map(escapeHtml).join(", ") || "—"}</div>
        <div><div class="di-label">Status</div><span class="badge mod-status-${m.status}">${MODIFICATION_STATUS_MAP[m.status].label}</span></div>
        <div class="full"><div class="di-label">Descrição</div>${escapeHtml(m.solicitacaoTexto)}</div>
      </div>
      <h4 class="form-section-title">Arquivos disponíveis</h4>
      <ul>${arquivos.map(a => `<li>${escapeHtml(a)}</li>`).join("")}</ul>
    </div>
    <div class="modal-footer"><button class="btn ghost" data-close>Fechar</button><button class="btn primary" id="btn-abrir-modificacao">Abrir modificação</button></div>
  `, true);
  wireModalClose();
  document.getElementById("btn-abrir-modificacao").addEventListener("click", () => { closeModal(); goToModificationDetail(m.id); });
}

function exportarMapaModificacoes(buildingId) {
  const b = getBuilding(buildingId);
  const { statusFiltro, itemFiltro, search } = currentMapaFiltros();
  const linhas = getMapaRows(buildingId, statusFiltro, itemFiltro, search);
  const atualizacao = new Date().toLocaleString("pt-BR");
  const header = ["Empreendimento", "Data de atualização", "Apto", "Cliente", ...state.mapItems];
  const rows = [header];
  linhas.forEach(r => {
    rows.push([b.name, atualizacao, r.c.unit, r.c.name || "", ...r.cells.map(cell => MAPA_STATUS[cell.status].label)]);
  });
  const csv = rows.map(r => r.map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mapa-modificacoes-${(b.name || "empreendimento").replace(/\s+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Mapa exportado.", "success");
}

/* Nome de arquivo seguro — remove acentos e qualquer caractere que não seja
   letra/número/hífen/underscore, pra nunca gerar um nome de arquivo problemático. */
function nomeArquivoSeguro(nome) {
  return (nome || "empreendimento")
    .normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/* Cores institucionais — mesmos valores hex das variáveis --mapa-* do CSS,
   só que em RGB (jsPDF não lê variáveis CSS). Qualquer mudança de paleta no
   mapa da tela deve ser replicada aqui também. */
const MAPA_PDF_COLORS = {
  padrao: { fill: [238, 240, 242], text: [107, 114, 128] },
  nao_vendido: { fill: [226, 232, 240], text: [71, 85, 105] },
  aguardar: { fill: [253, 236, 200], text: [146, 97, 10] },
  modificado: { fill: [226, 80, 74], text: [255, 255, 255] },
};
const MAPA_PDF_LEGENDA = [
  ["padrao", "Padrão"], ["nao_vendido", "Não vendido"], ["aguardar", "Aguardar"], ["modificado", "Modificado"],
];

/* Reaproveita exatamente os mesmos dados/lógica da tela (getMapaRows) — o PDF
   é só uma representação impressa do que já está calculado, nunca uma segunda
   lógica de mapa. */
function exportarMapaModificacoesPDF(buildingId) {
  if (!window.jspdf) { toast("Biblioteca de PDF não carregada.", "error"); return; }
  const b = getBuilding(buildingId);
  const { statusFiltro, itemFiltro, search } = currentMapaFiltros();
  const rows = getMapaRows(buildingId, statusFiltro, itemFiltro, search);

  const now = new Date();
  const dataHora = now.toLocaleDateString("pt-BR") + " às " + now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const filtrosPartes = [];
  if (statusFiltro) filtrosPartes.push("Status: " + MAPA_STATUS[statusFiltro].label);
  if (itemFiltro) filtrosPartes.push("Item: " + itemFiltro);
  if (search) filtrosPartes.push(`Busca: "${search}"`);
  const filtrosLabel = filtrosPartes.length ? filtrosPartes.join(" · ") : "Todos";

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.autoTable({
    head: [["Apto", "Cliente", ...state.mapItems]],
    body: rows.map(r => [r.c.unit, r.c.name || "—", ...r.cells.map(c => MAPA_STATUS[c.status].label)]),
    startY: 28,
    margin: { top: 28, left: 6, right: 6, bottom: 14 },
    styles: { fontSize: 6.3, cellPadding: 1, halign: "center", valign: "middle", lineColor: [222, 222, 222], lineWidth: 0.1, textColor: [40, 40, 40], overflow: "linebreak" },
    headStyles: { fillColor: [16, 32, 61], textColor: 255, fontStyle: "bold", fontSize: 6.3 },
    columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 11 }, 1: { halign: "left", cellWidth: 24 } },
    didParseCell(data) {
      if (data.section !== "body" || data.column.index < 2) return;
      const entry = Object.entries(MAPA_STATUS).find(([, s]) => s.label === data.cell.raw);
      if (!entry) return;
      const colors = MAPA_PDF_COLORS[entry[0]];
      data.cell.styles.fillColor = colors.fill;
      data.cell.styles.textColor = colors.text;
      if (entry[0] === "modificado") data.cell.styles.fontStyle = "bold";
    },
    didDrawPage() {
      doc.setFont(undefined, "bold"); doc.setFontSize(13); doc.setTextColor(16, 32, 61);
      doc.text("GESTÃO DE ARQUITETURA", 8, 11);
      doc.setFont(undefined, "normal"); doc.setFontSize(10); doc.setTextColor(70, 70, 70);
      doc.text(`Mapa de Modificações — ${b.name}`, 8, 16.5);
      doc.setFontSize(8);
      doc.text(`Unidades: ${rows.length}   ·   Filtros: ${filtrosLabel}`, 8, 21);
      doc.setFontSize(8);
      doc.text("Exportado em: " + dataHora, pageWidth - 8, 11, { align: "right" });

      let cursor = pageWidth - 8;
      doc.setFontSize(7.5);
      [...MAPA_PDF_LEGENDA].reverse().forEach(([id, label]) => {
        const w = doc.getTextWidth(label) + 6;
        cursor -= w;
        doc.setFillColor(...MAPA_PDF_COLORS[id].fill);
        doc.rect(cursor, 13.5, 4, 3, "F");
        doc.setTextColor(80, 80, 80);
        doc.text(label, cursor + 5.5, 16);
        cursor -= 4;
      });

      doc.setFontSize(7.5); doc.setTextColor(130, 130, 130);
      doc.text("Gestão de Arquitetura — Mapa de Modificações", 8, pageHeight - 7);
    },
  });

  /* "Página X de Y" só pode ser escrito com certeza depois que todas as
     páginas existirem — didDrawPage não sabe o total enquanto ainda está
     desenhando páginas anteriores. */
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5); doc.setTextColor(130, 130, 130);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 8, pageHeight - 7, { align: "right" });
  }

  const filename = `Mapa_Modificacoes_${nomeArquivoSeguro(b.name)}_${now.toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`;
  doc.save(filename);
  toast("PDF exportado.", "success");
}
