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

export type ResumoModelo = {
  categorias: number;
  fases: number;
  servicos: number;
  fatia_servicos: number;
  fatia_sistemas: number;
  sistemas: { nome: string; tipo: string; fatia: number; itens: number; descidas: number }[];
  pavimentos: number;
  locais: number;
};
export type DifModelo = {
  tem_modelo: boolean;
  igual?: boolean;
  versao?: number;
  versao_em?: string;
  versao_por?: string | null;
  origem?: string | null;
  origem_id?: string | null;
  extras?: { id: string; nome: string; status: number }[];
  faltando?: string[];
  fatias_diferentes?: number;
  ordem_ou_nome_diferente?: number;
};
export type VersaoModelo = { id: string; numero: number; criado_em: string; criado_por_nome: string | null; obra_origem_nome: string | null; resumo: ResumoModelo };
export type ResumoAplicacao = {
  servicos_novos: number;
  servicos_restaurados: number;
  ordem_alterada: number;
  fatias_atualizadas: number;
  servicos_arquivados: number;
  fora_do_modelo: number;
  fora_lista: { nome: string; status: number }[];
  sistemas_criados: number;
  itens_criados: number;
  itens_removidos: number;
  itens_bloqueados: number;
  trechos_antes: number;
  trechos_depois: number;
  pavimentos_criados: number;
  locais_criados: number;
  locais_recategorizados: number;
  locais_pulados: number;
  substituicao: string | null;
  descidas_mantidas_por_status: number;
};
export type AplicacaoModelo = {
  id: string;
  criado_em: string;
  por_nome: string | null;
  versao_numero: number | null;
  obra_id: string;
  obra_nome: string | null;
  resumo: ResumoAplicacao;
  opcoes: OpcoesModelo;
  desfeita_em: string | null;
};
export type OpcoesModelo = { categorias: boolean; fatias: boolean; sist_servicos: boolean; sist_itens: boolean; pavimentos: boolean; substituir: boolean };
export type ResultadoAplicacao = { versao: number; obras: { obra_id: string; obra_nome: string; resumo?: ResumoAplicacao; erro?: string }[] };

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
  modelo: DifModelo; // situação da obra frente à versão atual do Modelo padrão
  versoes: VersaoModelo[]; // versões do modelo (a primeira é a atual)
  aplicacoes: AplicacaoModelo[]; // aplicações do modelo nas obras (para desfazer)
  infoObras: { obra_id: string; nome: string; status: number; pavimentos: number }[]; // por obra: status lançados e nº de pavimentos
  excluidas: { id: string; nome: string; excluida_em: string }[]; // obras excluídas do Andamento novo há menos de 30 dias
  obrasGerais: { id: string; nome: string }[]; // obras do cadastro geral ainda não ligadas (só para ligar, sem alterar)
};

export const CORES_CATEGORIA = ["#2c6975", "#3d7d5a", "#a35d3d", "#56606b", "#c0782b", "#8a6d3b", "#4a6fa5", "#6b4f9e", "#b5651d", "#2f8a8a", "#7a6a5a", "#a3406b"];

// ---------- geração da estrutura de uma obra nova (mesma regra do protótipo) ----------

export type GrupoTipo = { pavs: number; aptos: number }; // quantos pavimentos tipo e quantos apartamentos em cada um
export type ParamsObraNova = {
  total: number; // total de pavimentos do prédio (garagens, térreo, lazer e pavimentos tipo; a cobertura é à parte)
  grupos: GrupoTipo[]; // pavimentos tipo, de baixo para cima (ex.: 9 pavimentos com 5 aptos + 1 pavimento com 4 aptos)
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

// números dos pavimentos: o que não é tipo (garagens, térreo, lazer) vem antes; o 1º pavimento tipo é o seguinte (ex.: 3 abaixo → Pav 04, apartamentos 401, 402…)
export function contasPavimentos(o: ParamsObraNova) {
  const tipos = o.grupos.reduce((a, g) => a + Math.max(0, g.pavs), 0);
  const naoTipo = Math.max(0, o.total - tipos);
  const garagens = Math.max(0, naoTipo - (o.lazerOnde === "proprio" ? 1 : 0));
  return { tipos, naoTipo, garagens };
}

export function gerarEstrutura(o: ParamsObraNova): EstruturaGerada {
  const pavs: EstruturaGerada["pavs"] = [];
  const { tipos, naoTipo, garagens } = contasPavimentos(o);
  const cob = { nome: "Cobertura", locais: [L("Casa de máquinas", "cob"), L("Laje técnica", "cob"), L("Escadaria", "esc")] };
  if (o.lazerOnde === "cobertura") cob.locais.splice(2, 0, ...LAZER());
  pavs.push(cob);
  // apartamentos por pavimento tipo, do pavimento mais baixo ao mais alto
  const aptosPorTipo: number[] = [];
  o.grupos.forEach((g) => {
    for (let i = 0; i < Math.max(0, g.pavs); i++) aptosPorTipo.push(Math.max(0, g.aptos));
  });
  for (let k = tipos; k >= 1; k--) {
    const n = naoTipo + k; // número do pavimento
    const locais = Array.from({ length: aptosPorTipo[k - 1] }, (_, i) => L(`Apto ${n}${pad2(i + 1)}`, "tipo")).concat([L("Hall", "hall"), L("Escadaria", "esc")]);
    if (o.lazerOnde === "tipo" && k === tipos) locais.splice(locais.length - 2, 0, ...LAZER());
    pavs.push({ nome: `Pav ${pad2(n)}`, locais });
  }
  if (o.lazerOnde === "proprio") pavs.push({ nome: "Lazer", locais: [...LAZER(), L("Hall", "hall"), L("Escadaria", "esc")] });
  for (let g = garagens; g >= 1; g--) {
    const locais = [L("Garagem", "garagem"), L("Hall", "hall"), L("Escadaria", "esc")];
    if (g === 1) {
      locais.push(L("Hall de entrada", "comum"), L("Portaria", "comum"));
      if (o.lazerOnde === "terreo") locais.push(...LAZER());
    }
    pavs.push({ nome: g === 1 ? "G1 / Térreo" : `G${g}`, locais });
  }
  if (garagens === 0 && o.lazerOnde === "terreo") {
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
