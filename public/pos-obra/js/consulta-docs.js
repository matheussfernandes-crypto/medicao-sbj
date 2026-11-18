/* Preenchimento automático por CEP (ViaCEP) e CNPJ (BrasilAPI) nos formulários do Pós-obra.
   sbjAutoPreencher(form): ao sair do campo CNPJ ou CEP, preenche os campos VAZIOS do mesmo formulário.
   Só o número digitado é enviado. Se a consulta falhar, nada muda. */
(function () {
  const dig = s => String(s || "").replace(/\D/g, "");
  async function buscar(url) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    try { const r = await fetch(url, { signal: ctl.signal }); return r.ok ? await r.json() : null; } catch (e) { return null; } finally { clearTimeout(t); }
  }
  const troca = (form, nome, v) => { const el = form.elements.namedItem(nome); if (el && v) el.value = v; };
  const vazio = (form, nome, v) => { const el = form.elements.namedItem(nome); if (el && v && !String(el.value || "").trim()) el.value = v; };
  window.sbjAutoPreencher = function (form) {
    if (!form || form.dataset.autoDocs) return; form.dataset.autoDocs = "1";
    const cnpj = form.elements.namedItem("cnpj"), cep = form.elements.namedItem("cep");
    /* só consulta quando o número foi digitado ou alterado agora (abrir e sair do campo sem mudar não faz nada) */
    [cnpj, cep].forEach(el => { if (el) { el.dataset.orig = el.value; el.addEventListener("focus", () => { el.dataset.orig = el.value; }); } });
    if (cnpj) cnpj.addEventListener("blur", async () => {
      if (cnpj.value === (cnpj.dataset.orig || "")) return;
      const n = dig(cnpj.value); if (n.length !== 14) return;
      let j = await buscar("https://brasilapi.com.br/api/cnpj/v1/" + n);
      if (!j || !j.razao_social) { const w = await buscar("https://publica.cnpj.ws/cnpj/" + n); if (w && w.razao_social) { const e = w.estabelecimento || {}; j = { razao_social: w.razao_social, nome_fantasia: e.nome_fantasia, ddd_telefone_1: (e.ddd1 || "") + (e.telefone1 || ""), email: e.email, descricao_tipo_de_logradouro: e.tipo_logradouro, logradouro: e.logradouro, numero: e.numero, bairro: e.bairro, municipio: e.cidade && e.cidade.nome, uf: e.estado && e.estado.sigla }; } }
      if (!j || !j.razao_social) { if (typeof toast === "function") toast("Não consegui consultar este CNPJ agora. Preencha os dados manualmente.", "error"); return; }
      const tel = dig(j.ddd_telefone_1);
      /* CNPJ novo ou alterado: razão social e nome fantasia passam a ser os dele */
      troca(form, "razaoSocial", j.razao_social); troca(form, "nomeFantasia", j.nome_fantasia || j.razao_social);
      vazio(form, "telefone", tel.length >= 10 ? "(" + tel.slice(0, 2) + ") " + tel.slice(2, tel.length - 4) + "-" + tel.slice(-4) : "");
      vazio(form, "email", String(j.email || "").toLowerCase());
      const rua = [j.descricao_tipo_de_logradouro, j.logradouro].filter(Boolean).join(" ");
      vazio(form, "endereco", [rua, j.numero].filter(Boolean).join(", ") + (j.bairro ? " - " + j.bairro : "") + (j.municipio ? " - " + j.municipio + "/" + j.uf : ""));
    });
    if (cep) cep.addEventListener("blur", async () => {
      if (cep.value === (cep.dataset.orig || "")) return;
      const n = dig(cep.value); if (n.length !== 8) return;
      const j = await buscar("https://viacep.com.br/ws/" + n + "/json/"); if (!j || j.erro) { if (typeof toast === "function") toast("Não consegui consultar este CEP agora. Preencha o endereço manualmente.", "error"); return; }
      vazio(form, "endereco", [j.logradouro, j.bairro, j.localidade && j.uf ? j.localidade + "/" + j.uf : ""].filter(Boolean).join(" - "));
      vazio(form, "bairro", j.bairro); vazio(form, "cidade", j.localidade); vazio(form, "uf", j.uf);
    });
  };
})();
