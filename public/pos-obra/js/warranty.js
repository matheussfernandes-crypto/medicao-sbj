/* ---------- Matriz de garantia por empreendimento ---------- */
/* "Sistema" usa as mesmas CATEGORIES do chamado, para casar automaticamente.
   "Componente" é texto livre (ex: "Janela de alumínio"). */

function getWarrantyRows(buildingId) {
  return state.warrantyMatrix.filter(r => r.buildingId === buildingId);
}
function getWarrantyRow(id) { return state.warrantyMatrix.find(r => r.id === id); }
function nextWarrantyId() { return "g" + (state.warrantySeq++); }

/* Soma o prazo à data usando aritmética de calendário (anos/meses reais), não
   dias aproximados — "5 anos" a partir de 15/01/2024 tem que cair em 15/01/2029,
   não 2 dias antes por causa de anos bissextos. */
function addPrazoToDate(date, valor, unidade) {
  const d = new Date(date);
  const n = Number(valor) || 0;
  if (unidade === "anos") d.setFullYear(d.getFullYear() + n);
  else d.setMonth(d.getMonth() + n);
  return d;
}

function warrantyStartDate(row, building) {
  if (row.inicioContagemCriterio === "data_especifica" && row.inicioContagemData) return row.inicioContagemData;
  // "entrega_unidade" e "entrega_empreendimento" usam, por ora, a mesma data de entrega
  // cadastrada no empreendimento (não há data de entrega por unidade cadastrada).
  return building ? building.deliveryDate : "";
}

/* Agrupa as linhas de um sistema por componente (normalizado), ordenando cada grupo
   pela hierarquia de fontes (menor rank = mais autoritativo). */
function warrantyGroupsForSistema(buildingId, sistema) {
  const rows = getWarrantyRows(buildingId).filter(r => r.sistema === sistema);
  const groups = {};
  rows.forEach(r => {
    const key = (r.componente || "(sem componente definido)").trim().toLowerCase();
    if (!groups[key]) groups[key] = { componente: r.componente || "(sem componente definido)", rows: [] };
    groups[key].rows.push(r);
  });
  Object.values(groups).forEach(g => g.rows.sort((a, b) => FONTE_TIPO_MAP[a.fonteTipo].rank - FONTE_TIPO_MAP[b.fonteTipo].rank));
  return Object.values(groups);
}

/* Analisa um grupo (mesmo sistema+componente, possivelmente várias fontes) e devolve
   o painel de garantia. Nunca decide procedência — só organiza a informação. */
function analyzeWarrantyGroup(group, building) {
  const primary = group.rows[0];
  const distinctPrazos = new Set(group.rows.map(r => (r.prazoValor || "") + "|" + (r.prazoUnidade || "")));
  const divergence = group.rows.length > 1 && distinctPrazos.size > 1;

  const startDate = warrantyStartDate(primary, building);
  const hasPrazo = primary.prazoValor !== "" && primary.prazoValor !== undefined && primary.prazoValor !== null;

  let statusId;
  let dataLimite = "";
  if (divergence) {
    statusId = "divergencia";
  } else if (!hasPrazo) {
    statusId = "nao_identificado";
  } else if (!startDate) {
    statusId = "nao_identificado";
  } else {
    const start = toLocalDate(startDate);
    const limit = addPrazoToDate(start, primary.prazoValor, primary.prazoUnidade);
    dataLimite = toISODateString(limit);
    const today = new Date();
    const daysLeft = Math.round((limit - today) / 86400000);
    if (daysLeft < 0) statusId = "expirado";
    else if (daysLeft <= 90) statusId = "proximo";
    else statusId = "dentro";
  }

  return {
    group, primary, divergence, statusId,
    dataLimite, startDate, hasPrazo,
    hasCondicoes: !!(primary.condicoes && primary.condicoes.trim()),
  };
}

/* Sistemas que o manual costuma misturar: o chamado de "Louças e Metais" (vaso, torneira)
   cai nas regras de "Hidráulica" ("Instalações hidráulicas (louças, válvulas…)") e vice-versa. */
const GARANTIA_SISTEMAS_RELACIONADOS = {
  "Louças e Metais": ["Hidráulica"],
  "Hidráulica": ["Louças e Metais"],
  "Fechaduras": ["Portas"],
  "Portas": ["Fechaduras"],
};
const GARANTIA_PALAVRAS_FRACAS = new Set(["instalacao", "instalacoes", "material", "servico", "equipamento", "equipamentos", "funcionamento", "desempenho", "acabamento", "durabilidade", "integridade", "resistencia", "padroes", "projetados", "dentro", "sistema", "entre", "outros", "forma", "executado", "conforme"]);

/* Quantas palavras do componente da regra aparecem no texto do chamado (título, relato, material…).
   Só ordena: as regras mais ligadas ao que o cliente relatou vêm primeiro. */
function warrantyRelevancia(ticket, group) {
  const texto = qcNorm([ticket.title, ticket.descricaoSolicitacao, ticket.outrosDescricao, ticket.material, ticket.elemento,
    ticket.analiseTecnica && ticket.analiseTecnica.problemaRelatado, (ticket.ambientes || []).join(" ")].filter(Boolean).join(" "));
  const radicais = new Set((texto.match(/[a-z]{4,}/g) || []).map(w => w.slice(0, 5)));
  const toks = (qcNorm(group.componente).match(/[a-z]{4,}/g) || []).filter(w => !GARANTIA_PALAVRAS_FRACAS.has(w));
  return toks.filter(w => radicais.has(w.slice(0, 5))).length;
}

/* Ponto de entrada usado pela ficha do chamado: dado buildingId + category do chamado,
   devolve a lista de grupos (um por componente) já analisados — inclusive os dos sistemas
   relacionados, com as mais ligadas ao relato primeiro. */
function warrantyAnalysisForTicket(ticket) {
  const building = getBuilding(ticket.buildingId);
  const semDataEntrega = !(building && building.deliveryDate);
  const temRegrasNoPredio = getWarrantyRows(ticket.buildingId).length > 0;
  const sistemas = [ticketSistema(ticket), ...(GARANTIA_SISTEMAS_RELACIONADOS[ticketSistema(ticket)] || [])];
  const groups = sistemas.flatMap(s => warrantyGroupsForSistema(ticket.buildingId, s).map(g => ({ g, sistema: s })));
  if (!groups.length) return { hasMatrix: false, analyses: [], semDataEntrega, temRegrasNoPredio };
  const analyses = groups.map(({ g, sistema }) => ({
    ...analyzeWarrantyGroup(g, building), sistema, relacionado: sistema !== ticketSistema(ticket), relevancia: warrantyRelevancia(ticket, g),
  }));
  analyses.sort((a, b) => b.relevancia - a.relevancia || Number(a.relacionado) - Number(b.relacionado));
  return { hasMatrix: true, analyses, semDataEntrega, temRegrasNoPredio };
}

/* Resumo único que alimenta o selo do cabeçalho, o aviso no topo da ficha e a marca na lista
   de chamados — nunca decide procedência, só diz com clareza o que o sistema sabe (e por que não sabe). */
function garantiaAlertaDoChamado(ticket) {
  const a = warrantyAnalysisForTicket(ticket);
  const comp = (x) => {
    const p = x.group.componente.split(" — ").filter(Boolean);
    const corta = (s, n) => (s.length > n ? s.slice(0, n - 1).trim() + "…" : s);
    return p.length > 1 ? `${corta(p[p.length - 1], 60)} · ${corta(p[0], 38)}` : corta(p[0] || "", 70);
  };
  if (!a.hasMatrix) {
    return {
      nivel: "sem_regras", icone: "❓", titulo: "Sem regra de garantia cadastrada",
      detalhe: a.temRegrasNoPredio
        ? `Este empreendimento tem regras para outros sistemas, mas nenhuma para “${ticketSistema(ticket)}”.`
        : "Este empreendimento ainda não tem Matriz de Garantia. Importe do Manual do Proprietário (PDF) ou cadastre.",
      acao: a.temRegrasNoPredio ? "matriz" : "importar-manual", acaoLabel: a.temRegrasNoPredio ? "Abrir a Matriz de Garantia" : "Importar do manual (PDF)",
    };
  }
  if (a.semDataEntrega) {
    return {
      nivel: "sem_data", icone: "📅", titulo: "Falta a data de entrega do empreendimento",
      detalhe: "Sem essa data o sistema não consegue calcular quando a garantia termina — por isso não avisou se está vencida.",
      acao: "editar-predio", acaoLabel: "Cadastrar a data de entrega",
    };
  }
  const relevantes = a.analyses.filter(x => x.relevancia > 0);
  const base = relevantes.length ? relevantes : a.analyses;
  const medidas = base.filter(x => ["dentro", "proximo", "expirado"].includes(x.statusId));
  if (!medidas.length) {
    const div = base.some(x => x.statusId === "divergencia");
    return { nivel: div ? "divergencia" : "sem_prazo", icone: div ? "❗" : "❓", titulo: div ? "Divergência entre documentos" : "Prazo não identificado", detalhe: div ? "Fontes diferentes indicam prazos diferentes para o mesmo item. Veja o painel de garantia." : "As regras encontradas não trazem prazo (ex.: garantia do fabricante). Veja o painel de garantia.", acao: "", acaoLabel: "" };
  }
  const exp = medidas.filter(x => x.statusId === "expirado");
  const prox = medidas.filter(x => x.statusId === "proximo");
  const item = (x) => `${comp(x)} (${x.primary.prazoValor} ${x.primary.prazoUnidade === "anos" ? "ano(s)" : "mês(es)"}, venceu em ${fmtDate(x.dataLimite)})`;
  if (exp.length === medidas.length) {
    return { nivel: "fora", icone: "🔴", titulo: "Fora da garantia", detalhe: `${relevantes.length ? "Os itens ligados a este chamado" : `Todas as regras de “${ticketSistema(ticket)}” deste empreendimento`} já passaram do prazo: ${exp.slice(0, 2).map(item).join("; ")}${exp.length > 2 ? ` e mais ${exp.length - 2}` : ""}. Confira condições e exceções no painel de garantia antes de responder ao cliente.`, acao: "", acaoLabel: "" };
  }
  if (exp.length) {
    return { nivel: "parcial", icone: "🟠", titulo: "Parte das garantias deste sistema já venceu", detalhe: `${exp.length} de ${medidas.length} regra(s) já passaram do prazo (ex.: ${item(exp[0])}); as demais ainda valem. Confirme qual item é o do chamado.`, acao: "", acaoLabel: "" };
  }
  if (prox.length) {
    return { nivel: "proximo", icone: "🟡", titulo: "Garantia perto de acabar", detalhe: `${comp(prox[0])} vence em ${fmtDate(prox[0].dataLimite)}.`, acao: "", acaoLabel: "" };
  }
  return { nivel: "ok", icone: "🟢", titulo: "Dentro do prazo de garantia", detalhe: "", acao: "", acaoLabel: "" };
}

/* Faixa de aviso no topo da ficha do chamado (só aparece quando há algo a dizer). */
function renderGarantiaBanner(ticket) {
  const g = garantiaAlertaDoChamado(ticket);
  if (g.nivel === "ok") return "";
  return `<div class="ticket-section warn-banner garantia-banner nivel-${g.nivel}">
    <div class="garantia-banner-texto"><strong>${g.icone} ${escapeHtml(g.titulo.toUpperCase())}</strong><div>${escapeHtml(g.detalhe)}</div></div>
    ${g.acao ? `<button type="button" class="btn ghost small" data-garantia-acao="${g.acao}">${escapeHtml(g.acaoLabel)}</button>` : ""}
  </div>`;
}

function suggestSistemasForLocal(local) {
  if (!local) return [];
  const key = local.trim().toLowerCase();
  for (const k in LOCAL_SUGESTAO_MAP) {
    if (key.includes(k)) return LOCAL_SUGESTAO_MAP[k];
  }
  return [];
}

/* ---------- UI: Matriz de garantia (modal por empreendimento) ---------- */

function openWarrantyMatrixModal(buildingId) {
  const b = getBuilding(buildingId);
  if (!b) return;
  const rows = getWarrantyRows(buildingId).sort((a, c) => a.sistema.localeCompare(c.sistema, "pt-BR") || (a.componente || "").localeCompare(c.componente || "", "pt-BR"));

  openModal(`
    <div class="modal-header">
      <h2>Matriz de Garantia — ${escapeHtml(b.name)}</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <p class="hint" style="margin-bottom:14px;">Cadastre aqui as regras de garantia por sistema/componente, sempre citando a fonte exata (manual, termo, norma...). Quando houver mais de uma fonte para o mesmo sistema/componente com prazos diferentes, o sistema mostra a divergência em vez de escolher sozinho.</p>
      ${b.deliveryDate ? "" : `<div class="mp-alerta" style="margin-bottom:14px;">📅 Este empreendimento está <strong>sem data de entrega</strong>. Sem ela o sistema não calcula quando cada garantia termina e não avisa nos chamados quando ela venceu. Cadastre em <em>Editar empreendimento</em>.</div>`}
      <div class="table-wrap">
        <table class="mini-table">
          <thead><tr><th>Sistema</th><th>Componente</th><th>Prazo</th><th>Fonte</th><th>Início</th><th></th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(r => `
              <tr>
                <td>${escapeHtml(r.sistema)}</td>
                <td>${escapeHtml(r.componente || "—")}</td>
                <td>${r.prazoValor ? escapeHtml(r.prazoValor + " " + (r.prazoUnidade === "anos" ? "ano(s)" : "mês(es)")) : "—"}</td>
                <td>${escapeHtml(FONTE_TIPO_MAP[r.fonteTipo] ? FONTE_TIPO_MAP[r.fonteTipo].label : "—")}</td>
                <td>${escapeHtml((INICIO_CONTAGEM_OPTIONS.find(o => o.id === r.inicioContagemCriterio) || {}).label || "—")}</td>
                <td><button class="btn ghost small" data-edit-warranty="${r.id}">Editar</button></td>
              </tr>`).join("") : `<tr><td colspan="6" class="empty-hint">Nenhuma regra de garantia cadastrada para este empreendimento.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn ghost" id="btn-add-warranty" style="margin-right:auto;">+ Regra de garantia</button>
      <button class="btn primary" id="btn-import-manual-g">Importar do manual (PDF)</button>
      <button class="btn primary" data-close>Fechar</button>
    </div>
  `, true);
  wireModalClose();
  document.getElementById("btn-add-warranty").addEventListener("click", () => openWarrantyRowForm(buildingId, null));
  document.getElementById("btn-import-manual-g").addEventListener("click", () => openManualImport(buildingId));
  document.querySelectorAll("[data-edit-warranty]").forEach(el => el.addEventListener("click", () => openWarrantyRowForm(buildingId, el.dataset.editWarranty)));
}

function openWarrantyRowForm(buildingId, rowId) {
  const editing = rowId ? getWarrantyRow(rowId) : null;
  openModal(`
    <div class="modal-header">
      <h2>${editing ? "Editar regra de garantia" : "Nova regra de garantia"}</h2>
      <button class="modal-close" data-close>&times;</button>
    </div>
    <div class="modal-body">
      <form id="warranty-form">
        <div class="form-grid">
          <div class="field">
            <label>Sistema</label>
            <select name="sistema" required>${CATEGORIES.map(c => `<option value="${c}" ${editing?.sistema === c ? "selected" : ""}>${c}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label>Componente</label>
            <input type="text" name="componente" value="${editing ? escapeHtml(editing.componente || "") : ""}" placeholder="Ex: Janela de alumínio">
          </div>
          <div class="field">
            <label>Prazo</label>
            <input type="number" min="0" name="prazoValor" value="${editing ? editing.prazoValor ?? "" : ""}">
          </div>
          <div class="field">
            <label>Unidade</label>
            <select name="prazoUnidade">
              <option value="meses" ${editing?.prazoUnidade === "meses" ? "selected" : ""}>Meses</option>
              <option value="anos" ${!editing || editing?.prazoUnidade === "anos" ? "selected" : ""}>Anos</option>
            </select>
          </div>
          <div class="field full">
            <label>Fonte (tipo) — define a hierarquia quando houver divergência</label>
            <select name="fonteTipo">${FONTE_TIPO_HIERARQUIA.map(f => `<option value="${f.id}" ${editing?.fonteTipo === f.id ? "selected" : ""}>${f.label}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label>Documento (nome)</label>
            <input type="text" name="fonteDocumento" value="${editing ? escapeHtml(editing.fonteDocumento || "") : ""}" placeholder="Ex: Manual do Proprietário - Ilha do Arvoredo">
          </div>
          <div class="field">
            <label>Página / seção</label>
            <input type="text" name="fontePagina" value="${editing ? escapeHtml(editing.fontePagina || "") : ""}" placeholder="Ex: pág. 87">
          </div>
          <div class="field full">
            <label>Trecho / descrição da fonte</label>
            <input type="text" name="fonteTrecho" value="${editing ? escapeHtml(editing.fonteTrecho || "") : ""}">
          </div>
          <div class="field">
            <label>Início da contagem</label>
            <select name="inicioContagemCriterio">${INICIO_CONTAGEM_OPTIONS.map(o => `<option value="${o.id}" ${editing?.inicioContagemCriterio === o.id ? "selected" : ""}>${o.label}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label>Data específica (se aplicável)</label>
            <input type="date" name="inicioContagemData" value="${editing ? editing.inicioContagemData || "" : ""}">
          </div>
          <div class="field full">
            <label>Normas técnicas relacionadas</label>
            <div class="checkbox-group">
              ${NORMAS_TECNICAS.map(n => `<label class="checkbox-inline"><input type="checkbox" name="normas" value="${n}" ${editing?.normasRelacionadas?.includes(n) ? "checked" : ""}> ${n}</label>`).join("")}
            </div>
          </div>
          <div class="field full">
            <label>Condições da garantia (o que pode limitar/excluir)</label>
            <textarea name="condicoes" placeholder="Ex: depende de manutenção periódica comprovada">${editing ? escapeHtml(editing.condicoes || "") : ""}</textarea>
          </div>
          <div class="field full">
            <label>Observações</label>
            <textarea name="observacoes">${editing ? escapeHtml(editing.observacoes || "") : ""}</textarea>
          </div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      ${editing ? `<button class="btn danger" id="btn-delete-warranty" style="margin-right:auto;">Excluir</button>` : ""}
      <button class="btn ghost" id="btn-back-warranty">Voltar</button>
      <button class="btn primary" id="btn-save-warranty">Salvar</button>
    </div>
  `);
  wireModalClose();

  document.getElementById("btn-back-warranty").addEventListener("click", () => openWarrantyMatrixModal(buildingId));

  document.getElementById("btn-save-warranty").addEventListener("click", () => {
    const form = document.getElementById("warranty-form");
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const payload = {
      buildingId,
      sistema: fd.get("sistema"),
      componente: fd.get("componente").trim(),
      prazoValor: fd.get("prazoValor") ? Number(fd.get("prazoValor")) : "",
      prazoUnidade: fd.get("prazoUnidade"),
      fonteTipo: fd.get("fonteTipo"),
      fonteDocumento: fd.get("fonteDocumento").trim(),
      fontePagina: fd.get("fontePagina").trim(),
      fonteTrecho: fd.get("fonteTrecho").trim(),
      inicioContagemCriterio: fd.get("inicioContagemCriterio"),
      inicioContagemData: fd.get("inicioContagemData") || "",
      normasRelacionadas: fd.getAll("normas"),
      condicoes: fd.get("condicoes").trim(),
      observacoes: fd.get("observacoes").trim(),
    };
    if (editing) {
      Object.assign(editing, payload);
      toast("Regra de garantia atualizada.", "success");
    } else {
      state.warrantyMatrix.push({ id: nextWarrantyId(), ...payload });
      toast("Regra de garantia cadastrada.", "success");
    }
    persist();
    openWarrantyMatrixModal(buildingId);
  });

  const delBtn = document.getElementById("btn-delete-warranty");
  if (delBtn) {
    delBtn.addEventListener("click", () => {
      if (!confirm("Excluir esta regra de garantia?")) return;
      state.warrantyMatrix = state.warrantyMatrix.filter(r => r.id !== editing.id);
      persist();
      openWarrantyMatrixModal(buildingId);
      toast("Regra excluída.");
    });
  }
}

/* ---------- Painel de garantia dentro da ficha do chamado ---------- */

function renderGarantiaPanel(ticket) {
  const { hasMatrix, analyses } = warrantyAnalysisForTicket(ticket);
  if (!hasMatrix) {
    const g = garantiaAlertaDoChamado(ticket);
    return `<div class="warranty-panel empty">
      <span class="warranty-icon">${g.icone}</span>
      <div>
        <strong>${escapeHtml(g.titulo)}</strong>
        <p class="hint">${escapeHtml(g.detalhe)}</p>
      </div>
    </div>`;
  }
  const VISIVEIS = 4;
  const painel = (a) => {
    const st = GARANTIA_STATUS[a.statusId];
    const sourceRows = a.group.rows;
    return `
    <div class="warranty-panel status-${a.statusId}">
      <div class="warranty-head">
        <span class="warranty-icon">${st.icon}</span>
        <div>
          <strong>${st.label}</strong>
          <div class="hint">Sistema: ${escapeHtml(a.sistema)}${a.relacionado ? " (relacionado a “" + escapeHtml(ticketSistema(ticket)) + "”)" : ""} · Componente: ${escapeHtml(a.group.componente)}</div>
        </div>
      </div>
      <div class="detail-info-grid" style="margin-top:10px;">
        <div><div class="di-label">Prazo previsto</div>${a.hasPrazo ? escapeHtml(a.primary.prazoValor + " " + (a.primary.prazoUnidade === "anos" ? "ano(s)" : "mês(es)")) : "não informado"}</div>
        <div><div class="di-label">Data de entrega usada</div>${a.startDate ? fmtDate(a.startDate) : "não cadastrada"}</div>
        <div><div class="di-label">Data limite estimada</div>${a.dataLimite ? fmtDate(a.dataLimite) : "—"}</div>
        <div><div class="di-label">Fonte principal</div>${escapeHtml(FONTE_TIPO_MAP[a.primary.fonteTipo].label)}</div>
      </div>
      ${a.hasCondicoes ? `<div class="warranty-note">⚠️ CONDIÇÃO DE GARANTIA A VERIFICAR<br>${escapeHtml(a.primary.condicoes)}</div>` : ""}
      ${a.divergence ? `<div class="warranty-note divergence">
        ❗ DIVERGÊNCIA DE GARANTIA — fontes diferentes indicam prazos diferentes para o mesmo sistema/componente:
        <table class="mini-table" style="margin-top:8px;">
          <thead><tr><th>Fonte</th><th>Prazo</th><th>Documento</th></tr></thead>
          <tbody>${sourceRows.map(r => `<tr><td>${escapeHtml(FONTE_TIPO_MAP[r.fonteTipo].label)}</td><td>${r.prazoValor ? escapeHtml(r.prazoValor + " " + (r.prazoUnidade === "anos" ? "ano(s)" : "mês(es)")) : "—"}</td><td>${escapeHtml(r.fonteDocumento || "—")}</td></tr>`).join("")}</tbody>
        </table>
      </div>` : ""}
      ${a.primary.normasRelacionadas && a.primary.normasRelacionadas.length ? `<div class="hint" style="margin-top:8px;">Referência normativa relacionada: ${a.primary.normasRelacionadas.map(escapeHtml).join(", ")} (parâmetro técnico, não substitui a fonte acima)</div>` : ""}
      <details class="warranty-source">
        <summary>Ver fonte</summary>
        <div class="detail-info-grid" style="margin-top:8px;">
          <div><div class="di-label">Documento</div>${escapeHtml(a.primary.fonteDocumento || "—")}</div>
          <div><div class="di-label">Página / seção</div>${escapeHtml(a.primary.fontePagina || "—")}</div>
          <div class="full"><div class="di-label">Trecho</div>${escapeHtml(a.primary.fonteTrecho || "—")}</div>
        </div>
      </details>
    </div>`;
  };
  const visiveis = analyses.slice(0, VISIVEIS).map(painel).join("");
  const resto = analyses.slice(VISIVEIS);
  return visiveis + (resto.length ? `<details class="warranty-mais"><summary>Ver mais ${resto.length} regra(s) deste sistema</summary>${resto.map(painel).join("")}</details>` : "");
}

/* Marca discreta na lista de chamados: só aparece quando o sistema TEM certeza do que diz
   (fora da garantia, ou falta a data de entrega) — para não poluir a lista com "não sei". */
function garantiaMarcaNaLista(ticket) {
  if (CLOSED_STATUSES.includes(ticket.status)) return "";
  const g = garantiaAlertaDoChamado(ticket);
  if (g.nivel === "fora") return ` <span class="badge outline gar-marca gar-fora" title="${escapeHtml(g.detalhe)}">🔴 fora da garantia</span>`;
  if (g.nivel === "parcial") return ` <span class="badge outline gar-marca" title="${escapeHtml(g.detalhe)}">🟠 garantia parcial</span>`;
  return "";
}
