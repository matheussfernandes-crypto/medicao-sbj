// Consulta pública de CEP (ViaCEP, com BrasilAPI de reserva) e de CNPJ (BrasilAPI, com CNPJ.ws de reserva)
// para preencher os outros campos do formulário. Só o número digitado (CEP ou CNPJ) é enviado.
// Se todas as consultas falharem, devolve null e o formulário continua como está.

export type EnderecoCep = { logradouro: string; bairro: string; cidade: string; uf: string };
export type DadosCnpj = {
  razaoSocial: string;
  nomeFantasia: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string; // só dígitos
  telefone: string;
  email: string;
};

export const digitos = (s: string) => (s || "").replace(/\D/g, "");
const t = (s: unknown) => String(s ?? "").trim();

async function buscar(url: string, ms = 9000): Promise<any | null> {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(tm);
  }
}

export async function consultarCep(valor: string): Promise<EnderecoCep | null> {
  const cep = digitos(valor);
  if (cep.length !== 8) return null;
  const j = await buscar(`https://viacep.com.br/ws/${cep}/json/`);
  if (j && !j.erro) return { logradouro: t(j.logradouro), bairro: t(j.bairro), cidade: t(j.localidade), uf: t(j.uf) };
  // reserva
  const b = await buscar(`https://brasilapi.com.br/api/cep/v1/${cep}`);
  if (b && (b.city || b.street)) return { logradouro: t(b.street), bairro: t(b.neighborhood), cidade: t(b.city), uf: t(b.state) };
  return null;
}

function telefoneBR(bruto: string) {
  const d = digitos(bruto);
  return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : "";
}

export async function consultarCnpj(valor: string): Promise<DadosCnpj | null> {
  const cnpj = digitos(valor);
  if (cnpj.length !== 14) return null;
  const j = await buscar(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (j && j.razao_social) {
    return {
      razaoSocial: t(j.razao_social),
      nomeFantasia: t(j.nome_fantasia),
      logradouro: [t(j.descricao_tipo_de_logradouro), t(j.logradouro)].filter(Boolean).join(" "),
      numero: t(j.numero),
      bairro: t(j.bairro),
      cidade: t(j.municipio),
      uf: t(j.uf),
      cep: digitos(t(j.cep)),
      telefone: telefoneBR(t(j.ddd_telefone_1)),
      email: t(j.email).toLowerCase(),
    };
  }
  // reserva (CNPJ.ws)
  const w = await buscar(`https://publica.cnpj.ws/cnpj/${cnpj}`);
  if (w && w.razao_social) {
    const e = w.estabelecimento || {};
    return {
      razaoSocial: t(w.razao_social),
      nomeFantasia: t(e.nome_fantasia),
      logradouro: [t(e.tipo_logradouro), t(e.logradouro)].filter(Boolean).join(" "),
      numero: t(e.numero),
      bairro: t(e.bairro),
      cidade: t(e.cidade?.nome),
      uf: t(e.estado?.sigla),
      cep: digitos(t(e.cep)),
      telefone: telefoneBR(`${t(e.ddd1)}${t(e.telefone1)}`),
      email: t(e.email).toLowerCase(),
    };
  }
  return null;
}

export const formatarCep = (d: string) => {
  const s = digitos(d);
  return s.length === 8 ? `${s.slice(0, 5)}-${s.slice(5)}` : d;
};

// "Rua X, 123"
export const enderecoComNumero = (d: DadosCnpj) => [d.logradouro, d.numero].filter(Boolean).join(", ");
