export type StatusAndamento = "NAO_INICIADO" | "ANDAMENTO" | "FINALIZADO";
export type CategoriaPavimento = "RESIDENCIAL" | "COMUM" | "LAZER" | "GARAGEM";

export const STATUS_LABEL: Record<StatusAndamento, string> = {
  NAO_INICIADO: "Não iniciado",
  ANDAMENTO: "Andamento",
  FINALIZADO: "Finalizado",
};

export const STATUS_ORDER: StatusAndamento[] = ["NAO_INICIADO", "ANDAMENTO", "FINALIZADO"];

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
export type ServicoAndamento = { id: string; obra_id: string; nome: string; ordem: number };

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

export type ObraResumo = { id: string; nome: string };

export type DadosObra = {
  obraId: string;
  torres: Torre[];
  pavimentos: Pavimento[];
  unidades: Unidade[];
  servicos: ServicoAndamento[];
  celulas: CelulaStatus[];
  historico: HistoricoItem[];
};

export function cellKey(unidadeId: string, servicoId: string) {
  return unidadeId + "__" + servicoId;
}
