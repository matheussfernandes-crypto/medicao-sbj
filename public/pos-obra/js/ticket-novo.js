/* ---------- Novo chamado — formulário rápido ---------- */
/* Uma tela só, sem rolagem longa: prédio, onde, sistema (obrigatório e sem
   chute), o que aconteceu, prioridade, quem pediu e — se já der — agendar a
   primeira ida. Material, elemento, ambientes detalhados etc. continuam na ficha
   do chamado ("Dados do chamado") e no formulário completo (link no rodapé). */

const NV_LOCAIS = [
  ["unidade_privativa", "Unidade"], ["area_comum", "Área comum"], ["area_lazer", "Lazer"],
  ["garagem", "Garagem"], ["fachada", "Fachada"], ["outro", "Outro"],
];
const NV_ORIGENS = ["Cliente", "Síndico", "Equipe interna", "Outro"];

function nvChips(grupo, itens, ativo) {
  return itens.map(([valor, rotulo]) =>
    `<button type="button" class="ck-chip ${valor === ativo ? "ativo" : ""}" data-nv-chip="${grupo}" data-valor="${escapeHtml(valor)}">${escapeHtml(rotulo)}</button>`).join("");
}

function openTicketFormRapido() {
  if (!state.buildings.length) { toast("Cadastre um empreendimento antes de abrir um chamado.", "error"); return; }
  let ultimo = "";
  try { ultimo = localStorage.getItem("posvenda_last_building") || ""; } catch (e) { /* sem storage */ }
  const predInicial = state.buildings.some(b => b.id === ultimo) ? ultimo : state.buildings[0].id;
  const nv = { local: "unidade_privativa", sistema: "", prioridade: "media", origem: "Cliente", agendar: "" };
  const hoje = todayISODate();

  openModal(`
    <div class="modal-header"><h2>Novo chamado</h2><button class="modal-close" data-close>&times;</button></div>
    <div class="modal-body">
      <div id="nv-form" class="nv">
        <div class="field">
          <label>Empreendimento</label>
          <select id="nv-pred">${state.buildings.map(b => `<option value="${b.id}" ${b.id === predInicial ? "selected" : ""}>${escapeHtml(b.name)}</option>`).join("")}</select>
        </div>

        <div class="ck-rotulo">Onde é o problema?</div>
        <div class="ck-chips" data-grupo="local">${nvChips("local", NV_LOCAIS, nv.local)}</div>
        <div class="field" id="nv-unidade-box" style="margin-top:10px;">
          <input type="text" id="nv-unidade" list="nv-unidades" placeholder="Número da unidade — ex: 302" autocomplete="off">
          <datalist id="nv-unidades"></datalist>
          <div class="nv-cliente" id="nv-cliente"></div>
        </div>
        <div class="field" id="nv-ambiente-box" style="margin-top:10px; display:none;">
          <input type="text" id="nv-ambiente" list="nv-ambientes" placeholder="Qual local? (opcional) — ex: Hall de entrada" autocomplete="off">
          <datalist id="nv-ambientes"></datalist>
        </div>

        <div class="ck-rotulo">Qual sistema? <span class="nv-obrig">obrigatório</span></div>
        <div class="ck-chips" data-grupo="sistema">${nvChips("sistema", QC_SISTEMAS_RAPIDOS.map(s => [s, s]), "")}</div>
        <select id="nv-sistema" class="ck-input"><option value="">Ou escolha na lista completa…</option>${CATEGORIES.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}</select>

        <div class="ck-rotulo">O que aconteceu?</div>
        <textarea id="nv-desc" class="ck-input" rows="3" placeholder="Descreva do seu jeito — ex: mancha de infiltração no teto do quarto"></textarea>

        <div class="nv-duas">
          <div>
            <div class="ck-rotulo">Prioridade</div>
            <div class="ck-chips" data-grupo="prioridade">${nvChips("prioridade", PRIORITIES.map(p => [p.id, p.label]), nv.prioridade)}</div>
          </div>
          <div>
            <div class="ck-rotulo">Quem pediu?</div>
            <div class="ck-chips" data-grupo="origem">${nvChips("origem", NV_ORIGENS.map(o => [o, o]), nv.origem)}</div>
          </div>
        </div>
        <div class="nv-duas" style="margin-top:8px;">
          <input type="text" id="nv-nome" class="ck-input" placeholder="Nome (opcional)" style="margin-top:0;">
          <input type="text" id="nv-contato" class="ck-input" placeholder="Telefone ou e-mail (opcional)" style="margin-top:0;">
        </div>

        <div class="ck-rotulo">Já agendar a primeira ida?</div>
        <div class="ck-chips" data-grupo="agendar">${nvChips("agendar", [["", "Agendar depois"], ["Realizar vistoria", "Vistoria"], ["Realizar reparo", "Reparo"]], "")}</div>
        <div class="ck-linha" id="nv-agenda-box" style="display:none;">
          <input type="date" id="nv-data" min="${hoje}" value="${qcAddDays(hoje, 1)}">
          <input type="time" id="nv-hora">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn ghost" data-close>Cancelar</button>
      <button class="btn primary" id="nv-salvar">Abrir chamado</button>
    </div>
  `);
  wireModalClose();

  const $ = (id) => document.getElementById(id);
  const form = $("nv-form");
  let nomeAuto = "", contatoAuto = "";

  function predio() { return getBuilding($("nv-pred").value); }
  function atualizarUnidades() {
    $("nv-unidades").innerHTML = state.clients.filter(c => c.buildingId === $("nv-pred").value).map(c => `<option value="${escapeHtml(c.unit)}">`).join("");
  }
  function atualizarAmbientes() {
    $("nv-ambientes").innerHTML = (nv.local === "unidade_privativa" ? [] : getAmbientesForLocal(predio(), nv.local)).map(a => `<option value="${escapeHtml(a)}">`).join("");
  }
  function clienteDaUnidade() {
    if (nv.local !== "unidade_privativa") return null;
    const u = $("nv-unidade").value.trim().toLowerCase();
    return u ? state.clients.find(c => c.buildingId === $("nv-pred").value && String(c.unit).toLowerCase() === u) || null : null;
  }
  /* Preenche nome/contato sozinho (cliente da unidade ou síndico), sem pisar no que a pessoa digitou. */
  function autopreencher() {
    let nome = "", contato = "";
    const cli = clienteDaUnidade();
    if (nv.origem === "Cliente" && cli) { nome = cli.name || ""; contato = cli.phone || cli.email || ""; }
    if (nv.origem === "Síndico") { const sd = (predio() || {}).sindico; if (sd && sd.nome) { nome = sd.nome; contato = sd.telefone || sd.email || ""; } }
    if (!$("nv-nome").value || $("nv-nome").value === nomeAuto) { $("nv-nome").value = nome; nomeAuto = nome; }
    if (!$("nv-contato").value || $("nv-contato").value === contatoAuto) { $("nv-contato").value = contato; contatoAuto = contato; }
    $("nv-cliente").innerHTML = cli && nv.local === "unidade_privativa" ? `✓ Cliente encontrado: <strong>${escapeHtml(cli.name || "sem nome")}</strong>` : "";
  }
  function marcar(grupo, valor) {
    form.querySelectorAll(`.ck-chips[data-grupo="${grupo}"] .ck-chip`).forEach(c => c.classList.toggle("ativo", c.dataset.valor === valor));
  }

  atualizarUnidades(); atualizarAmbientes();

  form.addEventListener("click", (e) => {
    const b = e.target.closest("[data-nv-chip]");
    if (!b) return;
    const g = b.dataset.nvChip, v = b.dataset.valor;
    if (g === "sistema" && nv.sistema === v) { nv.sistema = ""; $("nv-sistema").value = ""; marcar("sistema", ""); return; }
    nv[g] = v;
    marcar(g, v);
    if (g === "sistema") $("nv-sistema").value = v;
    if (g === "local") {
      const ehUnidade = v === "unidade_privativa";
      $("nv-unidade-box").style.display = ehUnidade ? "" : "none";
      $("nv-ambiente-box").style.display = ehUnidade ? "none" : "";
      atualizarAmbientes(); autopreencher();
    }
    if (g === "origem") autopreencher();
    if (g === "agendar") $("nv-agenda-box").style.display = v ? "" : "none";
  });
  $("nv-sistema").addEventListener("change", (e) => {
    nv.sistema = e.target.value;
    marcar("sistema", QC_SISTEMAS_RAPIDOS.includes(nv.sistema) ? nv.sistema : "");
  });
  $("nv-pred").addEventListener("change", () => { atualizarUnidades(); atualizarAmbientes(); autopreencher(); });
  $("nv-unidade").addEventListener("input", autopreencher);


  $("nv-salvar").addEventListener("click", () => {
    const buildingId = $("nv-pred").value;
    const ehUnidade = nv.local === "unidade_privativa";
    const unitDigitada = $("nv-unidade").value.trim();
    const ambiente = $("nv-ambiente").value.trim();
    const desc = $("nv-desc").value.trim();
    const falha = (msg, el) => { toast(msg, "error"); if (el) el.focus(); };

    if (ehUnidade && !unitDigitada) return falha("Digite o número da unidade.", $("nv-unidade"));
    if (!nv.sistema) return falha("Escolha o sistema do problema.", null);
    if (!desc) return falha("Descreva o que aconteceu.", $("nv-desc"));
    if (nv.agendar && !$("nv-data").value) return falha("Escolha a data da primeira ida.", $("nv-data"));

    const ambientes = !ehUnidade && ambiente ? [ambiente] : [];
    const unit = ehUnidade ? unitDigitada : (ambiente || LOCAL_TIPO_MAP[nv.local] || "—");
    const category = nv.sistema;
    const outrosDescricao = category === "Outros" ? desc.slice(0, 80) : "";
    const cli = ehUnidade ? clienteDaUnidade() : null;
    const b = getBuilding(buildingId);

    const t = {
      id: nextTicketCode(),
      openedAt: new Date().toISOString(),
      buildingId, unit,
      clientId: cli ? cli.id : "",
      origemSolicitacao: nv.origem,
      type: b && b.status === "andamento" ? "obra" : "posvenda",
      category, material: "", elemento: "", outrosDescricao,
      subcategory: "",
      localTipo: nv.local, ambientes,
      ambienteDetalhe: ambientes[0] || "",
      local: ambientes.join(", "), ambiente: ambientes.join(", "),
      priority: nv.prioridade,
      title: generateTicketTitle(category, "", ambientes, nv.local, outrosDescricao),
      status: "novo",
      responsavelInterno: "", responsavelProximaAcao: "", proximaAcao: "",
      dataLimiteProximaAcao: "", dataAcompanhamento: "",
      dataUltimaAcao: todayISODate(), dataUltimaCobranca: "", proximaCobranca: "",
      descricaoSolicitacao: desc,
      analiseTecnica: { ...blankAnaliseTecnica(), problemaRelatado: desc },
      fornecedor: blankFornecedor(), fornecedores: [],
      encerramento: blankEncerramento(),
      plano: [], anexos: [], relatorios: [],
      requesterName: $("nv-nome").value.trim(),
      requesterContact: $("nv-contato").value.trim(),
      history: [],
      _fornecedorMigrated: true,
    };
    addHistoryEntry(t, "Chamado aberto", `Origem: ${nv.origem}.`, "", "novo");

    if (nv.agendar) {
      const data = $("nv-data").value, hora = $("nv-hora").value;
      t.plano.push({
        ...blankAtividade(), id: ckId("et"), nome: nv.agendar, tipo: nv.agendar === "Realizar reparo" ? "execucao" : "acao",
        responsavel: ensureOperatorName(),
        execucoes: [{ ...blankExecucao(), id: ckId("exec"), data, horario: hora }],
      });
      t.status = statusCalculadoPeloPlano(t);
      addHistoryEntry(t, "Agendado: " + nv.agendar, `${fmtDate(data)}${hora ? " às " + hora : ""}`, "novo", t.status !== "novo" ? t.status : "");
    }

    state.tickets.push(t);
    try { localStorage.setItem("posvenda_last_building", buildingId); } catch (e) { /* sem storage */ }
    persist();
    closeModal();
    renderAll();
    toast(`Chamado ${t.id} aberto.`, "success");
    goToTicketDetail(t.id);
  });

  $("nv-unidade").focus();
}
