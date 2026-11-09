/* ---------- Cadastro mestre de Fornecedores ---------- */

function getSupplier(id) { return state.suppliers.find(s => s.id === id); }
function nextSupplierId() { return "sup" + (state.supplierSeq++); }
function nextContactId() { return "ct" + Date.now() + Math.random().toString(36).slice(2, 6); }

function supplierTickets(supplierId) {
  return state.tickets.filter(t => (t.fornecedores || []).some(f => f.supplierId === supplierId));
}

/* Indicadores calculados a partir dos chamados vinculados. Só devolve um número
   quando há dado real por trás — nunca inventa "0" com cara de métrica quando
   simplesmente não há chamados suficientes para aquele cálculo. */
function computeSupplierStats(supplierId) {
  const tickets = supplierTickets(supplierId);
  const total = tickets.length;
  if (!total) return { total: 0 };

  const abertos = tickets.filter(t => OPEN_STATUSES.includes(t.status)).length;
  const concluidos = tickets.filter(t => t.status === "concluido").length;
  const cancelados = tickets.filter(t => t.status === "cancelado").length;
  const improcedentes = tickets.filter(t => t.status === "improcedente").length;
  const reincidentes = tickets.filter(t => findSameUnitReincidence(t)).length;

  const closedWithTime = tickets.filter(t => CLOSED_STATUSES.includes(t.status) && ticketClosedAt(t));
  const tempoMedioResolucao = closedWithTime.length
    ? Math.round(closedWithTime.reduce((sum, t) => sum + Math.max(0, daysDiff(t.openedAt, ticketClosedAt(t))), 0) / closedWithTime.length)
    : null;

  const withAcionamento = tickets.filter(t => {
    const link = t.fornecedores.find(f => f.supplierId === supplierId);
    return link && link.dataAcionamento && link.dataExecutada;
  });
  const tempoMedioAtendimento = withAcionamento.length
    ? Math.round(withAcionamento.reduce((sum, t) => {
      const link = t.fornecedores.find(f => f.supplierId === supplierId);
      return sum + Math.max(0, daysDiff(link.dataAcionamento, link.dataExecutada));
    }, 0) / withAcionamento.length)
    : null;

  const porEmpreendimento = {};
  tickets.forEach(t => {
    const b = getBuilding(t.buildingId);
    const name = b ? b.name : "—";
    porEmpreendimento[name] = (porEmpreendimento[name] || 0) + 1;
  });

  return {
    total, abertos, concluidos, cancelados, improcedentes, reincidentes,
    tempoMedioResolucao, tempoMedioAtendimento,
    porEmpreendimento: Object.entries(porEmpreendimento).sort((a, b) => b[1] - a[1]),
  };
}

/* Chamados do fornecedor filtrados a um empreendimento específico — usado na
   relação fornecedor+empreendimento. */
function supplierBuildingTickets(supplierId, buildingId) {
  return supplierTickets(supplierId).filter(t => t.buildingId === buildingId);
}
function supplierBuildingStats(supplierId, buildingId) {
  const tickets = supplierBuildingTickets(supplierId, buildingId);
  return {
    total: tickets.length,
    abertos: tickets.filter(t => OPEN_STATUSES.includes(t.status)).length,
    concluidos: tickets.filter(t => t.status === "concluido").length,
  };
}

/* ---------- Lista de fornecedores ---------- */

function populateSupplierFilterSelects() {
  const sel = document.getElementById("filter-supplier-specialty");
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">Todas as especialidades</option>` + state.supplierSpecialties.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  sel.value = current;

  const buildingSel = document.getElementById("filter-supplier-building");
  const currentB = buildingSel.value;
  buildingSel.innerHTML = `<option value="">Todos os empreendimentos</option>` + state.buildings.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");
  buildingSel.value = currentB;
}

function renderSuppliers() {
  const search = (document.getElementById("global-search")?.value || "").trim().toLowerCase();
  const specialty = document.getElementById("filter-supplier-specialty")?.value || "";
  const statusFilter = document.getElementById("filter-supplier-status")?.value || "";
  const buildingFilterVal = document.getElementById("filter-supplier-building")?.value || "";

  let list = state.suppliers.slice();
  if (specialty) list = list.filter(s => s.specialties.includes(specialty));
  if (statusFilter) list = list.filter(s => s.status === statusFilter);
  if (buildingFilterVal) list = list.filter(s => s.buildings.some(b => b.buildingId === buildingFilterVal));
  if (search) {
    list = list.filter(s => supplierDisplayName(s).toLowerCase().includes(search) || (s.razaoSocial || "").toLowerCase().includes(search) || (s.cnpj || "").includes(search));
  }
  list.sort((a, b) => supplierDisplayName(a).localeCompare(supplierDisplayName(b), "pt-BR"));

  const tbody = document.querySelector("#suppliers-table tbody");
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="6" class="empty-hint">Nenhum fornecedor cadastrado.</td></tr>`; return; }
  tbody.innerHTML = list.map(s => {
    const stats = computeSupplierStats(s.id);
    const tags = s.buildings.map(b => getBuilding(b.buildingId)).filter(Boolean);
    return `<tr data-open-supplier="${s.id}">
      <td>${escapeHtml(supplierDisplayName(s))}</td>
      <td>${s.specialties.length ? escapeHtml(s.specialties.slice(0, 3).join(", ")) + (s.specialties.length > 3 ? "…" : "") : '<span class="empty-hint">—</span>'}</td>
      <td>${escapeHtml(s.telefone || s.whatsapp || "—")}</td>
      <td>${tags.length ? tags.map(b => `<span class="badge outline supplier-tag">${escapeHtml(b.name)}</span>`).join(" ") : '<span class="empty-hint">—</span>'}</td>
      <td>${stats.total}</td>
      <td><span class="badge ${s.status === "ativo" ? "status-concluido" : "status-cancelado"}">${s.status === "ativo" ? "Ativo" : "Inativo"}</span></td>
    </tr>`;
  }).join("");
  tbody.querySelectorAll("[data-open-supplier]").forEach(el => el.addEventListener("click", () => openSupplierDetail(el.dataset.openSupplier)));
}

/* ---------- Ficha do fornecedor ---------- */

function openSupplierDetail(id) {
  const s = getSupplier(id);
  if (!s) return;
  const stats = computeSupplierStats(id);
  const buildingLinks = s.buildings.map(link => ({ link, building: getBuilding(link.buildingId) })).filter(x => x.building);

  openModal(`
    <div class="modal-header">
      <h2>${escapeHtml(supplierDisplayName(s))}</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <div class="detail-info-grid">
        <div><div class="di-label">Razão social</div>${escapeHtml(s.razaoSocial || "—")}</div>
        <div><div class="di-label">CNPJ</div>${escapeHtml(s.cnpj || "—")}</div>
        <div><div class="di-label">Telefone</div>${escapeHtml(s.telefone || "—")}</div>
        <div><div class="di-label">WhatsApp</div>${escapeHtml(s.whatsapp || "—")}</div>
        <div><div class="di-label">E-mail</div>${escapeHtml(s.email || "—")}</div>
        <div><div class="di-label">Site</div>${escapeHtml(s.site || "—")}</div>
        <div class="full"><div class="di-label">Endereço</div>${escapeHtml(s.endereco || "—")}</div>
        <div><div class="di-label">Status</div>${s.status === "ativo" ? "Ativo" : "Inativo"}</div>
      </div>

      <h3 style="font-size:13.5px;margin:16px 0 10px;">Especialidades</h3>
      <div>${s.specialties.length ? s.specialties.map(sp => `<span class="badge outline" style="margin:0 6px 6px 0;">${escapeHtml(sp)}</span>`).join("") : '<span class="empty-hint">Nenhuma especialidade cadastrada.</span>'}</div>

      <h3 style="font-size:13.5px;margin:16px 0 10px;">Contatos</h3>
      <div class="table-wrap">
        <table class="mini-table">
          <thead><tr><th>Nome</th><th>Cargo</th><th>Telefone</th><th>WhatsApp</th><th>E-mail</th></tr></thead>
          <tbody>
            ${s.contacts.length ? s.contacts.map(c => `<tr><td>${escapeHtml(c.nome)}</td><td>${escapeHtml(c.cargo || "—")}</td><td>${escapeHtml(c.telefone || "—")}</td><td>${escapeHtml(c.whatsapp || "—")}</td><td>${escapeHtml(c.email || "—")}</td></tr>`).join("") : `<tr><td colspan="5" class="empty-hint">Nenhum contato cadastrado.</td></tr>`}
          </tbody>
        </table>
      </div>

      <h3 style="font-size:13.5px;margin:16px 0 10px;">Empreendimentos atendidos (${buildingLinks.length})</h3>
      <div class="table-wrap">
        <table class="mini-table">
          <thead><tr><th>Empreendimento</th><th>Categoria</th><th>Participação</th><th>Materiais/serviços</th><th>Chamados</th></tr></thead>
          <tbody>
            ${buildingLinks.length ? buildingLinks.map(({ link, building }) => {
    const bstats = supplierBuildingStats(s.id, building.id);
    const materiaisResumo = link.materiais.length ? link.materiais.slice(0, 2).join(", ") + (link.materiais.length > 2 ? "…" : "") : "—";
    return `<tr data-open-supplier-building="${building.id}" style="cursor:pointer;">
                <td>${escapeHtml(building.name)}</td>
                <td>${escapeHtml(link.categoria || "—")}</td>
                <td>${escapeHtml(link.participacao || "—")}</td>
                <td>${escapeHtml(materiaisResumo)}</td>
                <td>${bstats.total}</td>
              </tr>`;
  }).join("") : `<tr><td colspan="5" class="empty-hint">Nenhum empreendimento vinculado ainda. Use "Editar" para adicionar.</td></tr>`}
          </tbody>
        </table>
      </div>

      <h3 style="font-size:13.5px;margin:16px 0 10px;">Indicadores</h3>
      ${stats.total === 0 ? `<div class="empty-hint">Ainda não há chamados vinculados a este fornecedor para calcular indicadores.</div>` : `
      <div class="kpi-grid" style="margin-bottom:0;">
        <div class="kpi-card"><div class="kpi-label">Total de chamados</div><div class="kpi-value">${stats.total}</div></div>
        <div class="kpi-card"><div class="kpi-label">Em aberto</div><div class="kpi-value">${stats.abertos}</div></div>
        <div class="kpi-card good"><div class="kpi-label">Concluídos</div><div class="kpi-value">${stats.concluidos}</div></div>
        <div class="kpi-card"><div class="kpi-label">Cancelados / Improcedentes</div><div class="kpi-value">${stats.cancelados + stats.improcedentes}</div></div>
        ${stats.tempoMedioAtendimento !== null ? `<div class="kpi-card"><div class="kpi-label">Tempo médio de atendimento</div><div class="kpi-value">${stats.tempoMedioAtendimento}d</div></div>` : ""}
        ${stats.tempoMedioResolucao !== null ? `<div class="kpi-card"><div class="kpi-label">Tempo médio de resolução</div><div class="kpi-value">${stats.tempoMedioResolucao}d</div></div>` : ""}
        <div class="kpi-card ${stats.reincidentes ? "warn" : "good"}"><div class="kpi-label">Reincidentes</div><div class="kpi-value">${stats.reincidentes}</div></div>
      </div>
      ${stats.porEmpreendimento.length ? `
      <h4 class="form-section-title">Chamados por empreendimento</h4>
      <div class="barlist">${(() => {
      const max = Math.max(...stats.porEmpreendimento.map(e => e[1]));
      return stats.porEmpreendimento.map(([name, count]) => `
          <div class="bar-row"><span>${escapeHtml(name)}</span><div class="bar-track"><div class="bar-fill" style="width:${(count / max) * 100}%"></div></div><span class="bar-count">${count}</span></div>`).join("");
    })()}</div>` : ""}
      `}
    </div>
    <div class="modal-footer">
      <button class="btn danger" id="btn-delete-supplier" style="margin-right:auto;">Excluir</button>
      <button class="btn ghost" id="btn-supplier-tickets-btn">Ver todos os chamados deste fornecedor</button>
      <button class="btn ghost" data-edit-supplier="${s.id}">Editar</button>
      <button class="btn primary" data-close>Fechar</button>
    </div>
  `, true);
  wireModalClose();
  document.querySelector("[data-edit-supplier]").addEventListener("click", () => openSupplierForm(s.id));
  document.getElementById("btn-supplier-tickets-btn").addEventListener("click", () => openSupplierTicketsModal(s.id));
  document.querySelectorAll("[data-open-supplier-building]").forEach(el => {
    el.addEventListener("click", () => openSupplierBuildingModal(s.id, el.dataset.openSupplierBuilding));
  });
  document.getElementById("btn-delete-supplier").addEventListener("click", () => {
    if (stats.total > 0) { toast("Não é possível excluir: há chamados vinculados a este fornecedor.", "error"); return; }
    if (!confirm(`Excluir "${supplierDisplayName(s)}"?`)) return;
    state.suppliers = state.suppliers.filter(x => x.id !== s.id);
    persist();
    closeModal();
    renderAll();
    toast("Fornecedor excluído.");
  });
}

/* ---------- Atuação do fornecedor num empreendimento específico ---------- */

function openSupplierBuildingModal(supplierId, buildingId) {
  const s = getSupplier(supplierId);
  const b = getBuilding(buildingId);
  if (!s || !b) return;
  const link = s.buildings.find(x => x.buildingId === buildingId);
  if (!link) return;
  const tickets = supplierBuildingTickets(supplierId, buildingId).sort((a, c) => c.openedAt.localeCompare(a.openedAt));

  openModal(`
    <div class="modal-header">
      <h2>${escapeHtml(supplierDisplayName(s))} — ${escapeHtml(b.name)}</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <form id="supplier-building-form">
        <div class="form-grid">
          <div class="field"><label>Categoria</label><select name="categoria"><option value="">—</option>${CATEGORIES.map(c => `<option value="${c}" ${link.categoria === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
          <div class="field"><label>Participação</label><select name="participacao"><option value="">—</option>${PARTICIPACAO_OPTIONS.map(p => `<option value="${p}" ${link.participacao === p ? "selected" : ""}>${p}</option>`).join("")}</select></div>
          <div class="field"><label>Período/ano</label><input type="text" name="periodo" value="${escapeHtml(link.periodo || "")}" placeholder="Ex: 2023"></div>
          <div class="field"><label>Contato desta obra</label><input type="text" name="contatoNome" value="${escapeHtml(link.contatoNome || "")}"></div>
          <div class="field"><label>Telefone</label><input type="text" name="contatoTelefone" value="${escapeHtml(link.contatoTelefone || "")}"></div>
          <div class="field full"><label>E-mail do contato</label><input type="text" name="contatoEmail" value="${escapeHtml(link.contatoEmail || "")}"></div>
          <div class="field full"><label>Materiais / serviços fornecidos (um por linha)</label><textarea name="materiais" rows="5">${escapeHtml((link.materiais || []).join("\n"))}</textarea></div>
        </div>
        <div style="margin-top:12px;"><button type="button" class="btn primary" id="btn-save-supplier-building">Salvar</button></div>
      </form>

      <h3 style="font-size:13.5px;margin:18px 0 10px;">Chamados relacionados (${tickets.length})</h3>
      <div class="table-wrap">
        <table class="mini-table">
          <thead><tr><th>OS</th><th>Unidade</th><th>Serviço</th><th>Status</th></tr></thead>
          <tbody>
            ${tickets.length ? tickets.map(t => {
    const tlink = t.fornecedores.find(f => f.supplierId === supplierId);
    return `<tr data-open-ticket-inline="${t.id}" style="cursor:pointer;">
                <td>${t.id}</td><td>${escapeHtml(t.unit)}</td><td>${escapeHtml(tlink?.servico || "—")}</td>
                <td><span class="badge status-${t.status}">${TICKET_STATUS_MAP[t.status]}</span></td>
              </tr>`;
  }).join("") : `<tr><td colspan="4" class="empty-hint">Nenhum chamado deste fornecedor neste empreendimento ainda.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn danger" id="btn-remove-supplier-building" style="margin-right:auto;">Desvincular empreendimento</button>
      <button class="btn primary" data-close>Fechar</button>
    </div>
  `, true);
  wireModalClose();
  document.querySelectorAll("[data-open-ticket-inline]").forEach(el => {
    el.addEventListener("click", () => { closeModal(); goToTicketDetail(el.dataset.openTicketInline); });
  });
  document.getElementById("btn-save-supplier-building").addEventListener("click", () => {
    const fd = new FormData(document.getElementById("supplier-building-form"));
    link.categoria = fd.get("categoria");
    link.participacao = fd.get("participacao");
    link.periodo = fd.get("periodo").trim();
    link.contatoNome = fd.get("contatoNome").trim();
    link.contatoTelefone = fd.get("contatoTelefone").trim();
    link.contatoEmail = fd.get("contatoEmail").trim();
    link.materiais = fd.get("materiais").split("\n").map(m => m.trim()).filter(Boolean);
    persist();
    renderAll();
    toast("Atuação atualizada.", "success");
    openSupplierBuildingModal(supplierId, buildingId);
  });
  document.getElementById("btn-remove-supplier-building").addEventListener("click", () => {
    if (!confirm(`Desvincular ${supplierDisplayName(s)} de ${b.name}?`)) return;
    s.buildings = s.buildings.filter(x => x.buildingId !== buildingId);
    persist();
    closeModal();
    renderAll();
    toast("Empreendimento desvinculado.");
  });
}

function openSupplierTicketsModal(supplierId) {
  const supplier = getSupplier(supplierId);
  if (!supplier) return;
  const related = supplierTickets(supplierId).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  openModal(`
    <div class="modal-header">
      <h2>Chamados com ${escapeHtml(supplierDisplayName(supplier))}</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <div class="table-wrap">
        <table class="mini-table">
          <thead><tr><th>OS</th><th>Prédio / Unidade</th><th>Serviço</th><th>Status</th></tr></thead>
          <tbody>
            ${related.length ? related.map(t => {
    const b = getBuilding(t.buildingId);
    const link = t.fornecedores.find(f => f.supplierId === supplierId);
    return `<tr data-open-ticket-inline="${t.id}" style="cursor:pointer;">
                <td>${t.id}</td><td>${b ? escapeHtml(b.name) : "—"} / ${escapeHtml(t.unit)}</td>
                <td>${escapeHtml(link?.servico || "—")}</td>
                <td><span class="badge status-${t.status}">${TICKET_STATUS_MAP[t.status]}</span></td>
              </tr>`;
  }).join("") : `<tr><td colspan="4" class="empty-hint">Nenhum chamado vinculado ainda.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal-footer"><button class="btn primary" data-close>Fechar</button></div>
  `, true);
  wireModalClose();
  document.querySelectorAll("[data-open-ticket-inline]").forEach(el => {
    el.addEventListener("click", () => { closeModal(); goToTicketDetail(el.dataset.openTicketInline); });
  });
}

/* ---------- Cadastro / edição ---------- */

function specialtyCheckboxesHTML(selected) {
  return state.supplierSpecialties.map(sp => `
    <label class="checkbox-inline"><input type="checkbox" name="specialties" value="${escapeHtml(sp)}" ${selected.includes(sp) ? "checked" : ""}> ${escapeHtml(sp)}</label>
  `).join("");
}

function buildingLinkCardHTML(link) {
  const building = getBuilding(link.buildingId);
  return `
  <div class="supplier-building-card" data-building-id="${link.buildingId}">
    <div class="supplier-link-head">
      <strong>${escapeHtml(building ? building.name : "(empreendimento removido)")}</strong>
      <button type="button" class="btn ghost small remove-building-link-btn" style="margin-left:auto;">Remover</button>
    </div>
    <div class="form-grid">
      <div class="field"><label>Categoria</label><select class="bl-categoria"><option value="">—</option>${CATEGORIES.map(c => `<option value="${c}" ${link.categoria === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
      <div class="field"><label>Participação</label><select class="bl-participacao"><option value="">—</option>${PARTICIPACAO_OPTIONS.map(p => `<option value="${p}" ${link.participacao === p ? "selected" : ""}>${p}</option>`).join("")}</select></div>
      <div class="field"><label>Período/ano</label><input type="text" class="bl-periodo" value="${escapeHtml(link.periodo || "")}" placeholder="Ex: 2023"></div>
      <div class="field"><label>Contato desta obra</label><input type="text" class="bl-contatoNome" value="${escapeHtml(link.contatoNome || "")}"></div>
      <div class="field"><label>Telefone do contato</label><input type="text" class="bl-contatoTelefone" value="${escapeHtml(link.contatoTelefone || "")}"></div>
      <div class="field full"><label>E-mail do contato</label><input type="text" class="bl-contatoEmail" value="${escapeHtml(link.contatoEmail || "")}"></div>
      <div class="field full"><label>Materiais / serviços fornecidos (um por linha)</label><textarea class="bl-materiais" rows="3">${escapeHtml((link.materiais || []).join("\n"))}</textarea></div>
    </div>
  </div>`;
}
function buildingAddSelectHTML(alreadyLinkedIds) {
  const available = state.buildings.filter(b => !alreadyLinkedIds.includes(b.id));
  if (!available.length) return `<div class="hint">Todos os empreendimentos já estão vinculados.</div>`;
  return `
  <div class="add-person-row" style="display:flex;">
    <select id="new-building-link-select">${available.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("")}</select>
    <button type="button" class="btn ghost small" id="add-building-link-btn">+ Adicionar empreendimento</button>
  </div>`;
}

function contactRowHTML(contact) {
  const id = contact.id || nextContactId();
  return `
  <div class="supplier-contact-row" data-contact-id="${id}">
    <input type="hidden" class="ct-id" value="${id}">
    <div class="form-grid">
      <div class="field"><label>Nome</label><input type="text" class="ct-nome" value="${escapeHtml(contact.nome || "")}"></div>
      <div class="field"><label>Cargo/função</label><input type="text" class="ct-cargo" value="${escapeHtml(contact.cargo || "")}"></div>
      <div class="field"><label>Telefone</label><input type="text" class="ct-telefone" value="${escapeHtml(contact.telefone || "")}"></div>
      <div class="field"><label>WhatsApp</label><input type="text" class="ct-whatsapp" value="${escapeHtml(contact.whatsapp || "")}"></div>
      <div class="field"><label>E-mail</label><input type="text" class="ct-email" value="${escapeHtml(contact.email || "")}"></div>
    </div>
    <button type="button" class="btn ghost small remove-contact-btn">Remover contato</button>
  </div>`;
}

function openSupplierForm(id) {
  const editing = id ? getSupplier(id) : null;
  const s = editing || blankSupplier();
  openModal(`
    <div class="modal-header">
      <h2>${editing ? "Editar fornecedor" : "Novo fornecedor"}</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <form id="supplier-form">
        <h4 class="form-section-title">Dados da empresa</h4>
        <div class="form-grid">
          <div class="field"><label>Razão social</label><input type="text" name="razaoSocial" value="${escapeHtml(s.razaoSocial)}"></div>
          <div class="field"><label>Nome fantasia</label><input type="text" name="nomeFantasia" value="${escapeHtml(s.nomeFantasia)}"></div>
          <div class="field"><label>CNPJ</label><input type="text" name="cnpj" value="${escapeHtml(s.cnpj)}"></div>
          <div class="field"><label>Status</label><select name="status"><option value="ativo" ${s.status === "ativo" ? "selected" : ""}>Ativo</option><option value="inativo" ${s.status === "inativo" ? "selected" : ""}>Inativo</option></select></div>
          <div class="field"><label>Telefone</label><input type="text" name="telefone" value="${escapeHtml(s.telefone)}"></div>
          <div class="field"><label>WhatsApp</label><input type="text" name="whatsapp" value="${escapeHtml(s.whatsapp)}"></div>
          <div class="field"><label>E-mail</label><input type="text" name="email" value="${escapeHtml(s.email)}"></div>
          <div class="field"><label>Site</label><input type="text" name="site" value="${escapeHtml(s.site)}"></div>
          <div class="field full"><label>Endereço</label><input type="text" name="endereco" value="${escapeHtml(s.endereco)}"></div>
        </div>

        <h4 class="form-section-title">Especialidades</h4>
        <div class="checkbox-group" id="specialty-checkboxes">${specialtyCheckboxesHTML(s.specialties)}</div>
        <div class="add-person-row" id="add-specialty-row" style="display:flex; margin-top:8px;">
          <input type="text" class="add-person-input" id="new-specialty-input" placeholder="Nova especialidade">
          <button type="button" class="btn ghost small" id="add-specialty-btn">Adicionar</button>
        </div>

        <h4 class="form-section-title">Contatos</h4>
        <div id="contacts-list">${s.contacts.length ? s.contacts.map(contactRowHTML).join("") : ""}</div>
        <button type="button" class="btn ghost small" id="add-contact-btn">+ Adicionar contato</button>

        <h4 class="form-section-title">Empreendimentos atendidos</h4>
        <p class="hint" style="margin:0 0 10px;">Categoria, materiais e contato podem ser diferentes em cada obra.</p>
        <div id="building-links-list">${s.buildings.map(buildingLinkCardHTML).join("")}</div>
        <div id="add-building-link-row">${buildingAddSelectHTML(s.buildings.map(b => b.buildingId))}</div>

        <h4 class="form-section-title">Observações</h4>
        <div class="field full"><textarea name="notes">${escapeHtml(s.notes || "")}</textarea></div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn ghost" data-close>Cancelar</button>
      <button class="btn primary" id="btn-save-supplier">Salvar</button>
    </div>
  `, true);
  wireModalClose();

  document.getElementById("add-specialty-btn").addEventListener("click", () => {
    const input = document.getElementById("new-specialty-input");
    const name = input.value.trim();
    if (!name) return;
    if (!state.supplierSpecialties.includes(name)) { state.supplierSpecialties.push(name); persist(); }
    const box = document.getElementById("specialty-checkboxes");
    if (!box.querySelector(`input[value="${CSS.escape(name)}"]`)) {
      const label = document.createElement("label");
      label.className = "checkbox-inline";
      label.innerHTML = `<input type="checkbox" name="specialties" value="${escapeHtml(name)}" checked> ${escapeHtml(name)}`;
      box.appendChild(label);
    } else {
      box.querySelector(`input[value="${CSS.escape(name)}"]`).checked = true;
    }
    input.value = "";
  });

  document.getElementById("add-contact-btn").addEventListener("click", () => {
    document.getElementById("contacts-list").insertAdjacentHTML("beforeend", contactRowHTML(blankSupplierContact()));
    wireContactRemoveButtons();
  });
  wireContactRemoveButtons();
  function wireContactRemoveButtons() {
    document.querySelectorAll(".remove-contact-btn").forEach(btn => {
      btn.onclick = () => btn.closest(".supplier-contact-row").remove();
    });
  }

  function wireBuildingLinkRemoveButtons() {
    document.querySelectorAll(".remove-building-link-btn").forEach(btn => {
      btn.onclick = () => {
        btn.closest(".supplier-building-card").remove();
        refreshAddBuildingRow();
      };
    });
  }
  function currentlyLinkedIds() {
    return [...document.querySelectorAll(".supplier-building-card")].map(card => card.dataset.buildingId);
  }
  function refreshAddBuildingRow() {
    document.getElementById("add-building-link-row").innerHTML = buildingAddSelectHTML(currentlyLinkedIds());
    wireAddBuildingButton();
  }
  function wireAddBuildingButton() {
    const btn = document.getElementById("add-building-link-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const sel = document.getElementById("new-building-link-select");
      const buildingId = sel.value;
      document.getElementById("building-links-list").insertAdjacentHTML("beforeend", buildingLinkCardHTML({ ...blankSupplierBuildingLink(), buildingId }));
      wireBuildingLinkRemoveButtons();
      refreshAddBuildingRow();
    });
  }
  wireBuildingLinkRemoveButtons();
  wireAddBuildingButton();

  document.getElementById("btn-save-supplier").addEventListener("click", () => {
    const form = document.getElementById("supplier-form");
    const fd = new FormData(form);
    const contacts = [...document.querySelectorAll(".supplier-contact-row")].map(row => ({
      id: row.querySelector(".ct-id").value,
      nome: row.querySelector(".ct-nome").value.trim(),
      cargo: row.querySelector(".ct-cargo").value.trim(),
      telefone: row.querySelector(".ct-telefone").value.trim(),
      whatsapp: row.querySelector(".ct-whatsapp").value.trim(),
      email: row.querySelector(".ct-email").value.trim(),
    })).filter(c => c.nome);

    const buildings = [...document.querySelectorAll(".supplier-building-card")].map(card => {
      const existing = s.buildings.find(b => b.buildingId === card.dataset.buildingId);
      return {
        id: existing ? existing.id : "sb" + Date.now() + Math.random().toString(36).slice(2, 6),
        buildingId: card.dataset.buildingId,
        categoria: card.querySelector(".bl-categoria").value,
        participacao: card.querySelector(".bl-participacao").value,
        periodo: card.querySelector(".bl-periodo").value.trim(),
        contatoNome: card.querySelector(".bl-contatoNome").value.trim(),
        contatoTelefone: card.querySelector(".bl-contatoTelefone").value.trim(),
        contatoEmail: card.querySelector(".bl-contatoEmail").value.trim(),
        materiais: card.querySelector(".bl-materiais").value.split("\n").map(m => m.trim()).filter(Boolean),
      };
    });

    const payload = {
      razaoSocial: fd.get("razaoSocial").trim(),
      nomeFantasia: fd.get("nomeFantasia").trim(),
      cnpj: fd.get("cnpj").trim(),
      status: fd.get("status"),
      telefone: fd.get("telefone").trim(),
      whatsapp: fd.get("whatsapp").trim(),
      email: fd.get("email").trim(),
      site: fd.get("site").trim(),
      endereco: fd.get("endereco").trim(),
      specialties: fd.getAll("specialties"),
      buildings,
      contacts,
      notes: fd.get("notes").trim(),
    };
    if (!payload.razaoSocial && !payload.nomeFantasia) {
      toast("Informe ao menos a razão social ou o nome fantasia.", "error");
      return;
    }
    if (editing) {
      Object.assign(editing, payload);
      toast("Fornecedor atualizado.", "success");
      persist();
      closeModal();
      renderAll();
      openSupplierDetail(editing.id);
    } else {
      const similar = findSimilarSupplier(payload.nomeFantasia || payload.razaoSocial, payload.cnpj, [payload.telefone, payload.whatsapp]);
      if (similar) {
        openDuplicateSupplierWarning(similar, payload);
      } else {
        const supplier = { id: nextSupplierId(), ...payload };
        state.suppliers.push(supplier);
        toast("Fornecedor cadastrado.", "success");
        persist();
        closeModal();
        renderAll();
      }
    }
  });
}

/* ---------- Aviso de possível fornecedor duplicado ---------- */

function openDuplicateSupplierWarning(existing, payload) {
  const novoNome = payload.nomeFantasia || payload.razaoSocial;
  openModal(`
    <div class="modal-header">
      <h2>Possível fornecedor já cadastrado</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <p class="hint">O nome informado é parecido com um fornecedor que já existe. Isso evita cadastrar a mesma empresa duas vezes.</p>
      <div class="detail-info-grid" style="margin-top:12px;">
        <div><div class="di-label">Fornecedor existente</div>${escapeHtml(supplierDisplayName(existing))}${existing.cnpj ? " · CNPJ " + escapeHtml(existing.cnpj) : ""}${existing.telefone ? " · Tel. " + escapeHtml(existing.telefone) : ""}</div>
        <div><div class="di-label">Novo registro digitado</div>${escapeHtml(novoNome)}${payload.cnpj ? " · CNPJ " + escapeHtml(payload.cnpj) : ""}${payload.telefone ? " · Tel. " + escapeHtml(payload.telefone) : ""}</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn ghost" id="btn-dup-cancel">Cancelar</button>
      <button class="btn ghost" id="btn-dup-create">Criar novo mesmo assim</button>
      <button class="btn primary" id="btn-dup-link">Vincular ao fornecedor existente</button>
    </div>
  `, true);
  wireModalClose();
  document.getElementById("btn-dup-cancel").addEventListener("click", closeModal);
  document.getElementById("btn-dup-create").addEventListener("click", () => {
    const supplier = { id: nextSupplierId(), ...payload };
    state.suppliers.push(supplier);
    toast("Fornecedor cadastrado.", "success");
    persist();
    closeModal();
    renderAll();
  });
  document.getElementById("btn-dup-link").addEventListener("click", () => {
    closeModal();
    toast(`Abrindo "${supplierDisplayName(existing)}" — adicione a obra na seção "Empreendimentos atendidos".`, "");
    openSupplierForm(existing.id);
  });
}
