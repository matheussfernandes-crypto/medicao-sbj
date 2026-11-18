// Consulta pública de CEP (ViaCEP) e de CNPJ (BrasilAPI) para preencher os outros campos do formulário.
// Só o número digitado (CEP ou CNPJ) é enviado. Se a consulta falhar, o formulário continua como está.

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

const digitos = (s: string) => (s || "").replace(/\D/g, "");

async function buscar(url: string, ms = 8000): Promise<any | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function consultarCep(valor: string): Promise<EnderecoCep | null> {
  const cep = digitos(valor);
  if (cep.length !== 8) return null;
  const j = await buscar(`https://viacep.com.br/ws/${cep}/json/`);
  if (!j || j.erro) return null;
  return { logradouro: j.logradouro || "", bairro: j.bairro || "", cidade: j.localidade || "", uf: j.uf || "" };
}

export async function consultarCnpj(valor: string): Promise<DadosCnpj | null> {
  const cnpj = digitos(valor);
  if (cnpj.length !== 14) return null;
  const j = await buscar(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (!j || !j.razao_social) return null;
  const tel = digitos(String(j.ddd_telefone_1 || ""));
  const titulo = (s: string) => String(s || "").trim();
  return {
    razaoSocial: titulo(j.razao_social),
    nomeFantasia: titulo(j.nome_fantasia),
    logradouro: [titulo(j.descricao_tipo_de_logradouro), titulo(j.logradouro)].filter(Boolean).join(" "),
    numero: titulo(j.numero),
    bairro: titulo(j.bairro),
    cidade: titulo(j.municipio),
    uf: titulo(j.uf),
    cep: digitos(String(j.cep || "")),
    telefone: tel.length >= 10 ? `(${tel.slice(0, 2)}) ${tel.slice(2, tel.length - 4)}-${tel.slice(-4)}` : "",
    email: titulo(j.email).toLowerCase(),
  };
}

export const formatarCep = (d: string) => {
  const s = digitos(d);
  return s.length === 8 ? `${s.slice(0, 5)}-${s.slice(5)}` : d;
};

// "Rua X, 123"
export const enderecoComNumero = (d: DadosCnpj) => [d.logradouro, d.numero].filter(Boolean).join(", ");
