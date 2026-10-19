export type StatusAndamento = "NAO_INICIADO" | "ANDAMENTO" | "FINALIZADO" | "AUSENTE";
export type CategoriaPavimento = "RESIDENCIAL" | "COMUM" | "LAZER" | "GARAGEM";

export const STATUS_LABEL: Record<StatusAndamento, string> = {
  NAO_INICIADO: "Não iniciado",
  ANDAMENTO: "Andamento",
  FINALIZADO: "Finalizado",
  AUSENTE: "Ausência",
};

// Status que entram na conta do andamento (usados nos relatórios).
export const STATUS_ORDER: StatusAndamento[] = ["NAO_INICIADO", "ANDAMENTO", "FINALIZADO"];
// Status que dá pra marcar na grade: inclui Ausência (o serviço não existe naquela
// unidade, então a célula fica fora da conta da porcentagem).
export const STATUS_ORDER_EDIT: StatusAndamento[] = ["NAO_INICIADO", "ANDAMENTO", "FINALIZADO", "AUSENTE"];

export const CATEGORIA_LABEL: Record<CategoriaPavimento, string> = {
  RESIDENCIAL: "Pavimento tipo",
  COMUM: "Área comum",
  LAZER: "Área de lazer",
  GARAGEM: "Garagem",
};

export const CATEGORIA_ORDER: CategoriaPavimento[] = ["RESIDENCIAL", "COMUM", "LAZER", "GARAGEM"];

export const CATEGORIA_COR: Record<CategoriaPavimento, string> = {
  RESIDENCIAL: "#2c6975",
  COMUM: "#8a6d3b",
  LAZER: "#c0781f",
  GARAGEM: "#5b6472",
};

export type Torre = { id: string; obra_id: string; nome: string; ordem: number };
export type Pavimento = { id: string; torre_id: string; nome: string; ordem: number; categoria: CategoriaPavimento };
export type Unidade = { id: string; pavimento_id: string; nome: string; ordem: number };
// Cada torre/seção tem a própria lista de serviços e os próprios pesos (soma 100).
export type ServicoAndamento = { id: string; obra_id: string; torre_id: string; nome: string; ordem: number; peso: number };

export type CelulaStatus = {
  unidade_id: string;
  servico_id: string;
  status: StatusAndamento;
  observacao: string | null;
  atualizado_por_nome: string | null;
  atualizado_em: string | null;
};

export type HistoricoItem = {
  id: string;
  unidade_id: string;
  servico_id: string;
  tipo: "STATUS" | "OBSERVACAO";
  de: string | null;
  para: string | null;
  observacao: string | null;
  autor_nome: string | null;
  criado_em: string;
};

export type FotoObra = {
  id: string;
  data_foto: string;
  legenda: string | null;
  storage_path: string;
  url: string;
  autor_nome: string | null;
};

export type ObraResumo = { id: string; nome: string };

export type DadosObra = {
  obraId: string;
  torres: Torre[];
  pavimentos: Pavimento[];
  unidades: Unidade[];
  servicos: ServicoAndamento[];
  celulas: CelulaStatus[];
  historico: HistoricoItem[];
  fotos: FotoObra[];
};

export function cellKey(unidadeId: string, servicoId: string) {
  return unidadeId + "__" + servicoId;
}

// Fluxograma padrão de serviços da SBJ (mesma ordem de execução usada nos
// fluxogramas verticais em papel). Usado pra pré-popular qualquer obra que
// ainda não tenha nenhum serviço de andamento cadastrado.
export const SERVICOS_PADRAO = [
  "Estrutura", "Alvenaria Perímetro", "Alvenaria", "Tubulação Elétrica Parede", "Tubulação Elétrica Teto",
  "Tubulação Hidráulica Parede", "Tubulação Hidráulica Teto", "Tubulação Gás", "Tubulação Split", "Churrasqueira",
  "Contramarco", "Chapisco Interno", "Reboco Interno", "Fiação Elétrica", "Contrapiso", "Manta Acústica",
  "Impermeabilização Esquadrias", "Impermeabilização Boxes", "Soleira Granito", "Forro de Gesso", "Azulejo",
  "Piso Cerâmico", "Autonivelante", "Acab. Churrasqueira", "Vinílico", "Esquadria de Alumínio", "Selador Acrílico",
  "Massa Corrida", "Pintura Interna", "Sanitários", "Portas e Rodapés", "Pintura Final", "Personalizado",
];

// Pesos padrão (% do total, soma 100) dos serviços de um prédio residencial.
// Serve de ponto de partida; cada torre pode ajustar os seus.
export const PESOS_PADRAO: Record<string, number> = {
  "Estrutura": 16, "Alvenaria Perímetro": 3, "Alvenaria": 6, "Tubulação Elétrica Parede": 2.5, "Tubulação Elétrica Teto": 1.5,
  "Tubulação Hidráulica Parede": 3, "Tubulação Hidráulica Teto": 2, "Tubulação Gás": 1, "Tubulação Split": 1, "Churrasqueira": 1.5,
  "Contramarco": 1, "Chapisco Interno": 1.5, "Reboco Interno": 7, "Fiação Elétrica": 3, "Contrapiso": 3, "Manta Acústica": 1.5,
  "Impermeabilização Esquadrias": 1, "Impermeabilização Boxes": 1.5, "Soleira Granito": 1, "Forro de Gesso": 3.5, "Azulejo": 5,
  "Piso Cerâmico": 5.5, "Autonivelante": 1.5, "Acab. Churrasqueira": 1, "Vinílico": 2, "Esquadria de Alumínio": 5,
  "Selador Acrílico": 1, "Massa Corrida": 3, "Pintura Interna": 4, "Sanitários": 4, "Portas e Rodapés": 3.5, "Pintura Final": 3,
  "Personalizado": 0,
};

// Modelo da torre "Cobertura" (telhado): serviços e pesos (soma 100) na ordem de execução.
export const SERVICOS_COBERTURA: [string, number][] = [
  ["Estrutura", 15], ["Alvenaria", 10], ["Chapisco", 3], ["Reboco", 8], ["Contrapiso", 5], ["Impermeabilização", 8],
  ["Execução de calhas", 4], ["Estrutura de madeira da cobertura", 14], ["Telhas", 12], ["Rufos de alumínio", 4],
  ["Calhas de alumínio", 4], ["Para-raios", 5], ["Ganchos de ancoragem", 3], ["Antena TV", 2],
  ["Saída de exaustão das churrasqueiras", 3],
];

export function ehCobertura(nomeTorre: string) {
  return /cobertura/i.test(nomeTorre);
}

// Serviços iniciais de uma torre nova: torre chamada "Cobertura" usa o modelo de
// telhado; as demais usam o fluxograma residencial padrão.
export function linhasServicosPadrao(obraId: string, torreId: string, nomeTorre = "") {
  if (ehCobertura(nomeTorre)) {
    return SERVICOS_COBERTURA.map(([nome, peso], ordem) => ({ obra_id: obraId, torre_id: torreId, nome, ordem, peso }));
  }
  return SERVICOS_PADRAO.map((nome, ordem) => ({ obra_id: obraId, torre_id: torreId, nome, ordem, peso: PESOS_PADRAO[nome] ?? 1 }));
}
