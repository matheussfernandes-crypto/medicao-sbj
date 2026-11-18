/* Preenchimento automático por CEP (ViaCEP) e CNPJ (BrasilAPI) nos formulários do Pós-obra.
   sbjAutoPreencher(form): ao sair do campo CNPJ ou CEP, preenche os campos VAZIOS do mesmo formulário.
   Só o número digitado é enviado. Se a consulta falhar, nada muda. */
(function () {
  const dig = s => String(s || "").replace(/\D/g, "");
  async function buscar(url) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    try { const r = await fetch(url, { signal: ctl.signal }); return r.ok ? await r.json() : null; } catch (e) { return null; } finally { clearTimeout(t); }
  }
  const vazio = (form, nome, v) => { const el = form.elements.namedItem(nome); if (el && v && !String(el.value || "").trim()) el.value = v; };
  window.sbjAutoPreencher = function (form) {
    if (!form || form.dataset.autoDocs) return; form.dataset.autoDocs = "1";
    const cnpj = form.elements.namedItem("cnpj"), cep = form.elements.namedItem("cep");
    if (cnpj) cnpj.addEventListener("blur", async () => {
      const n = dig(cnpj.value); if (n.length !== 14) return;
      const j = await buscar("https://brasilapi.com.br/api/cnpj/v1/" + n); if (!j || !j.razao_social) return;
      const tel = dig(j.ddd_telefone_1);
      vazio(form, "razaoSocial", j.razao_social); vazio(form, "nomeFantasia", j.nome_fantasia || j.razao_social);
      vazio(form, "telefone", tel.length >= 10 ? "(" + tel.slice(0, 2) + ") " + tel.slice(2, tel.length - 4) + "-" + tel.slice(-4) : "");
      vazio(form, "email", String(j.email || "").toLowerCase());
      const rua = [j.descricao_tipo_de_logradouro, j.logradouro].filter(Boolean).join(" ");
      vazio(form, "endereco", [rua, j.numero].filter(Boolean).join(", ") + (j.bairro ? " - " + j.bairro : "") + (j.municipio ? " - " + j.municipio + "/" + j.uf : ""));
    });
    if (cep) cep.addEventListener("blur", async () => {
      const n = dig(cep.value); if (n.length !== 8) return;
      const j = await buscar("https://viacep.com.br/ws/" + n + "/json/"); if (!j || j.erro) return;
      vazio(form, "endereco", [j.logradouro, j.bairro, j.localidade && j.uf ? j.localidade + "/" + j.uf : ""].filter(Boolean).join(" - "));
      vazio(form, "bairro", j.bairro); vazio(form, "cidade", j.localidade); vazio(form, "uf", j.uf);
    });
  };
})();
