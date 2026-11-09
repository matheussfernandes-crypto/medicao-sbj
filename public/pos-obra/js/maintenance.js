/* ---------- Matriz de manutenção preventiva por empreendimento ---------- */
/* Espelha js/warranty.js: mesma ideia de "Sistema" = CATEGORIES do chamado,
   mesma hierarquia de fonte (FONTE_TIPO_HIERARQUIA) — periodicidade pode vir
   do manual do proprietário ou, na ausência dele, da norma técnica, e nunca
   deve ser tratada como igual entre empreendimentos só porque hoje coincide. */

function getMaintenanceRows(buildingId) {
  return state.maintenanceMatrix.filter(r => r.buildingId === buildingId);
}
function getMaintenanceRow(id) { return state.maintenanceMatrix.find(r => r.id === id); }
function nextMaintenanceId() { return "m" + (state.maintenanceSeq++); }

const PERIODICIDADE_SUGESTOES = ["Mensal", "Trimestral", "Semestral", "Anual", "Bienal", "Trienal", "Quinquenal"];

/* ---------- UI: Matriz de manutenção preventiva (modal por empreendimento) ---------- */

function openMaintenanceMatrixModal(buildingId) {
  const b = getBuilding(buildingId);
  if (!b) return;
  const rows = getMaintenanceRows(buildingId).sort((a, c) => a.sistema.localeCompare(c.sistema, "pt-BR") || (a.componente || "").localeCompare(c.componente || "", "pt-BR"));

  openModal(`
    <div class="modal-header">
      <h2>Manutenção Preventiva — ${escapeHtml(b.name)}</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <p class="hint" style="margin-bottom:14px;">Cadastre aqui o que precisa ser verificado/mantido por sistema, sempre citando a fonte (manual, norma...). É referência de consulta — não gera lembrete nem tarefa automática nesta fase.</p>
      <div class="table-wrap">
        <table class="mini-table">
          <thead><tr><th>Sistema</th><th>Item</th><th>O que verificar</th><th>Periodicidade</th><th>Fonte</th><th></th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(r => `
              <tr>
                <td>${escapeHtml(r.sistema)}</td>
                <td>${escapeHtml(r.componente || "—")}</td>
                <td>${escapeHtml(r.oQueVerificar || "—")}</td>
                <td>${escapeHtml(r.periodicidade || "—")}</td>
                <td>${escapeHtml(FONTE_TIPO_MAP[r.fonteTipo] ? FONTE_TIPO_MAP[r.fonteTipo].label : "—")}</td>
                <td><button class="btn ghost small" data-edit-maintenance="${r.id}">Editar</button></td>
              </tr>`).join("") : `<tr><td colspan="6" class="empty-hint">Nenhum item de manutenção preventiva cadastrado para este empreendimento.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn ghost" id="btn-add-maintenance" style="margin-right:auto;">+ Item de manutenção</button>
      <button class="btn primary" id="btn-import-manual-m">Importar do manual (PDF)</button>
      <button class="btn primary" data-close>Fechar</button>
    </div>
  `, true);
  wireModalClose();
  document.getElementById("btn-add-maintenance").addEventListener("click", () => openMaintenanceRowForm(buildingId, null));
  document.getElementById("btn-import-manual-m").addEventListener("click", () => openManualImport(buildingId));
  document.querySelectorAll("[data-edit-maintenance]").forEach(el => el.addEventListener("click", () => openMaintenanceRowForm(buildingId, el.dataset.editMaintenance)));
}

function openMaintenanceRowForm(buildingId, rowId) {
  const editing = rowId ? getMaintenanceRow(rowId) : null;
  openModal(`
    <div class="modal-header">
      <h2>${editing ? "Editar item de manutenção" : "Novo item de manutenção"}</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <form id="maintenance-form">
        <div class="form-grid">
          <div class="field">
            <label>Sistema</label>
            <select name="sistema" required>${CATEGORIES.map(c => `<option value="${c}" ${editing?.sistema === c ? "selected" : ""}>${c}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label>Item/componente</label>
            <input type="text" name="componente" value="${editing ? escapeHtml(editing.componente || "") : ""}" placeholder="Ex: Fachada — pintura">
          </div>
          <div class="field full">
            <label>O que verificar</label>
            <input type="text" name="oQueVerificar" value="${editing ? escapeHtml(editing.oQueVerificar || "") : ""}" placeholder="Ex: Pontos de ferrugem, fissuras, descolamento">
          </div>
          <div class="field full">
            <label>Procedimento / orientação</label>
            <textarea name="procedimento">${editing ? escapeHtml(editing.procedimento || "") : ""}</textarea>
          </div>
          <div class="field">
            <label>Periodicidade</label>
            <input type="text" name="periodicidade" list="periodicidade-sugestoes" value="${editing ? escapeHtml(editing.periodicidade || "") : ""}" placeholder="Ex: Semestral">
            <datalist id="periodicidade-sugestoes">${PERIODICIDADE_SUGESTOES.map(p => `<option value="${p}">`).join("")}</datalist>
          </div>
          <div class="field full">
            <label>Fonte (tipo)</label>
            <select name="fonteTipo">${FONTE_TIPO_HIERARQUIA.map(f => `<option value="${f.id}" ${editing?.fonteTipo === f.id ? "selected" : ""}>${f.label}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label>Documento (nome)</label>
            <input type="text" name="fonteDocumento" value="${editing ? escapeHtml(editing.fonteDocumento || "") : ""}" placeholder="Ex: Manual do Proprietário - Ilha do Campeche">
          </div>
          <div class="field">
            <label>Página / seção</label>
            <input type="text" name="fontePagina" value="${editing ? escapeHtml(editing.fontePagina || "") : ""}" placeholder="Ex: pág. 42">
          </div>
          <div class="field full">
            <label>Trecho / descrição da fonte</label>
            <input type="text" name="fonteTrecho" value="${editing ? escapeHtml(editing.fonteTrecho || "") : ""}">
          </div>
          <div class="field full">
            <label>Condições (o que pode limitar/exigir)</label>
            <textarea name="condicoes" placeholder="Ex: depende de contratação de empresa especializada">${editing ? escapeHtml(editing.condicoes || "") : ""}</textarea>
          </div>
          <div class="field full">
            <label>Observações</label>
            <textarea name="observacoes">${editing ? escapeHtml(editing.observacoes || "") : ""}</textarea>
          </div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      ${editing ? `<button class="btn danger" id="btn-delete-maintenance" style="margin-right:auto;">Excluir</button>` : ""}
      <button class="btn ghost" id="btn-back-maintenance">Voltar</button>
      <button class="btn primary" id="btn-save-maintenance">Salvar</button>
    </div>
  `);
  wireModalClose();

  document.getElementById("btn-back-maintenance").addEventListener("click", () => openMaintenanceMatrixModal(buildingId));

  document.getElementById("btn-save-maintenance").addEventListener("click", () => {
    const form = document.getElementById("maintenance-form");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const payload = {
      buildingId,
      sistema: fd.get("sistema"),
      componente: fd.get("componente").trim(),
      oQueVerificar: fd.get("oQueVerificar").trim(),
      procedimento: fd.get("procedimento").trim(),
      periodicidade: fd.get("periodicidade").trim(),
      fonteTipo: fd.get("fonteTipo"),
      fonteDocumento: fd.get("fonteDocumento").trim(),
      fontePagina: fd.get("fontePagina").trim(),
      fonteTrecho: fd.get("fonteTrecho").trim(),
      condicoes: fd.get("condicoes").trim(),
      observacoes: fd.get("observacoes").trim(),
    };
    if (editing) {
      Object.assign(editing, payload);
      toast("Item de manutenção atualizado.", "success");
    } else {
      state.maintenanceMatrix.push({ id: nextMaintenanceId(), ...payload });
      toast("Item de manutenção cadastrado.", "success");
    }
    persist();
    openMaintenanceMatrixModal(buildingId);
  });

  const delBtn = document.getElementById("btn-delete-maintenance");
  if (delBtn) {
    delBtn.addEventListener("click", () => {
      if (!confirm("Excluir este item de manutenção?")) return;
      state.maintenanceMatrix = state.maintenanceMatrix.filter(r => r.id !== editing.id);
      persist();
      openMaintenanceMatrixModal(buildingId);
      toast("Item excluído.");
    });
  }
}
