// Modelo novo do Andamento de Obra: pavimento > local, sistema > item, categoria define serviços e pesos.

// obra_geral_id: ligação opcional (só leitura) com a obra do cadastro geral; as fotos usam essa ligação
export type ObraInfo = { id: string; nome: string; data_inicio: string | null; data_entrega_prevista: string | null; obra_geral_id?: string | null; segue_modelo?: boolean };
export type Fase = { id: string; nome: string; ordem: number };
export type Categoria = { id: string; chave: string; nome: string; cor: string; ordem: number };
export type Servico = {
  id: string;
  nome: string;
  grupo: string;
  fase_id: string | null;
  vale_pavimento_inteiro: boolean;
  ordem: number;
  fatia: number; // fatia da obra (só dos serviços dos locais; soma com as dos sistemas = 100%)
};
export type Vinculo = { categoria_id: string; servico_id: string; peso: number; peso_fixo: boolean };
export type Local = { id: string; pavimento_id: string; nome: string; categoria_id: string; ordem: number };
export type Pavimento = { id: string; nome: string; ordem: number };
export type SistemaItem = {
  id: string;
  sistema_id: string;
  nome: string;
  categoria_id: string;
  ordem: number;
  parte?: "emb" | "tor" | "res" | null;
  face?: "N" | "S" | "L" | "O" | null;
  descida?: number | null;
  pavimento_id?: string | null;
  servico_id?: string | null; // trechos da fachada são por serviço (cada serviço tem as suas descidas)
};
export type DescidasConfig = Record<"emb" | "tor" | "res", Record<"N" | "S" | "L" | "O", number>>;
export type Sistema = { id: string; nome: string; tipo: "comum" | "fachada"; ordem: number; fatia: number; config?: { descidas?: DescidasConfig; por_servico?: Record<string, DescidasConfig> } | null };

// Status de um apontamento: 0 = não iniciado, 1 = andamento, 2 = finalizado, 3 = ausência (fora da conta)
export type Status = 0 | 1 | 2 | 3;
export type Apontamento = {
  alvo: string; // id do local ou do item de sistema
  servico_id: string;
  status: Status;
  observacao: string | null;
  por: string | null;
  em: string | null;
};

export type DadosAndamento = {
  obras: ObraInfo[];
  obra: ObraInfo;
  fases: Fase[];
  categorias: Categoria[];
  servicos: Servico[];
  vinculos: Vinculo[];
  pavimentos: Pavimento[];
  locais: Local[];
  sistemas: Sistema[];
  itens: SistemaItem[];
  apontamentos: Apontamento[];
  usuario: { id: string; nome: string; setor: string };
};
export type Percentual = { nivel: string; ref_id: string | null; pct: number };

export type DadosConfig = {
  obras: ObraInfo[];
  obra: ObraInfo;
  fases: Fase[];
  categorias: Categoria[];
  servicos: Servico[];
  vinculos: Vinculo[];
  pavimentos: Pavimento[];
  locais: Local[];
  sistemas: Sistema[];
  itens: SistemaItem[];
  percentuais: Percentual[];
  // nº de serviços por categoria (chave) no Modelo padrão e em cada obra — usado na prévia da obra nova
  contagens: Record<string, Record<string, number>>;
  modelo: { segue: boolean; extras: { nome: string; status: number }[]; faltando: number }; // situação da obra frente ao Modelo padrão compartilhado
  excluidas: { id: string; nome: string; excluida_em: string }[]; // obras excluídas do Andamento novo há menos de 30 dias
  obrasGerais: { id: string; nome: string }[]; // obras do cadastro geral ainda não ligadas (só para ligar, sem alterar)
};

export const CORES_CATEGORIA = ["#2c6975", "#3d7d5a", "#a35d3d", "#56606b", "#c0782b", "#8a6d3b", "#4a6fa5", "#6b4f9e", "#b5651d", "#2f8a8a", "#7a6a5a", "#a3406b"];

// ---------- geração da estrutura de uma obra nova (mesma regra do protótipo) ----------

export type ParamsObraNova = {
  tipos: number; // pavimentos tipo
  aptos: number; // apartamentos por pavimento
  garagens: number;
  elev: number;
  lazerOnde: "proprio" | "cobertura" | "terreo" | "tipo" | "nao";
  cxSup: "cxf" | "cxc";
  cxInf: boolean;
};

export type EstruturaGerada = {
  pavs: { nome: string; locais: { nome: string; cat: string }[] }[];
  sis: { nome: string; tipo: "comum" | "fachada"; config?: unknown; itens: { nome: string; cat: string }[] }[];
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const L = (nome: string, cat: string) => ({ nome, cat });
const LAZER = () =>
  ["Salão de Festas", "Piscina", "Academia", "Brinquedoteca", "Salão de Jogos", "Quiosque 01", "Quiosque 02", "Área externa"].map((n) => L(n, "lazer"));

export const DESCIDAS_PADRAO = {
  emb: { N: 6, S: 6, L: 4, O: 4 },
  tor: { N: 5, S: 5, L: 3, O: 3 },
  res: { N: 2, S: 2, L: 1, O: 1 },
};

export function gerarEstrutura(o: ParamsObraNova): EstruturaGerada {
  const pavs: EstruturaGerada["pavs"] = [];
  const cob = { nome: "Cobertura", locais: [L("Casa de máquinas", "cob"), L("Laje técnica", "cob"), L("Escadaria", "esc")] };
  if (o.lazerOnde === "cobertura") cob.locais.splice(2, 0, ...LAZER());
  pavs.push(cob);
  for (let n = o.tipos; n >= 1; n--) {
    const locais = Array.from({ length: o.aptos }, (_, i) => L(`Apto ${n}${pad2(i + 1)}`, "tipo")).concat([L("Hall", "hall"), L("Escadaria", "esc")]);
    if (o.lazerOnde === "tipo" && n === o.tipos) locais.splice(locais.length - 2, 0, ...LAZER());
    pavs.push({ nome: `Pav ${pad2(n)}`, locais });
  }
  if (o.lazerOnde === "proprio") pavs.push({ nome: "Lazer", locais: [...LAZER(), L("Hall", "hall"), L("Escadaria", "esc")] });
  for (let g = o.garagens; g >= 1; g--) {
    const locais = [L("Garagem", "garagem"), L("Hall", "hall"), L("Escadaria", "esc")];
    if (g === 1) {
      locais.push(L("Hall de entrada", "comum"), L("Portaria", "comum"));
      if (o.lazerOnde === "terreo") locais.push(...LAZER());
    }
    pavs.push({ nome: g === 1 ? "G1 / Térreo" : `G${g}`, locais });
  }
  if (o.garagens === 0 && o.lazerOnde === "terreo") {
    pavs.push({ nome: "Térreo", locais: [L("Hall de entrada", "comum"), L("Portaria", "comum"), ...LAZER(), L("Escadaria", "esc")] });
  }
  const sis: EstruturaGerada["sis"] = [];
  if (o.elev > 0) {
    sis.push({
      nome: "Elevadores",
      tipo: "comum",
      itens: Array.from({ length: o.elev }, (_, i) => L(`Elevador ${i + 1}${i === 0 ? " – social" : i === 1 ? " – serviço" : ""}`, "elev")),
    });
  }
  sis.push({ nome: "Fachadas (reboco externo)", tipo: "fachada", config: { descidas: DESCIDAS_PADRAO }, itens: [] });
  sis.push({
    nome: "Caixa d'água",
    tipo: "comum",
    itens: [L("Reservatório superior", o.cxSup)].concat(o.cxInf ? [L("Reservatório inferior", "cxc")] : []),
  });
  return { pavs, sis };
}

export function previaEstrutura(est: EstruturaGerada, servicosPorCat: Record<string, number>) {
  const locais = est.pavs.reduce((a, p) => a + p.locais.length, 0);
  const itens = est.sis.reduce((a, s) => a + s.itens.length, 0);
  const etapas =
    est.pavs.reduce((a, p) => a + p.locais.reduce((b, l) => b + (servicosPorCat[l.cat] ?? 0), 0), 0) +
    est.sis.reduce((a, s) => a + s.itens.reduce((b, i) => b + (servicosPorCat[i.cat] ?? 0), 0), 0);
  return { pavimentos: est.pavs.length, locais, sistemas: est.sis.length, itens, etapas };
}
