import { FILTROS_VAZIOS, type Ctx, type Filtros, type Formato, type Montagem } from "./modelo";

export type Predefinicao = {
  id: string;
  nome: string;
  filtros: Filtros;
  formato?: Partial<Formato>;
  montagem?: Partial<Montagem>;
  padrao?: boolean; // vem pronta com o sistema (não pode excluir)
};

const nomesInfra = ["Tubulação Elétrica Parede", "Tubulação Elétrica Teto", "Tubulação Hidráulica Parede", "Tubulação Hidráulica Teto", "Tubulação Gás", "Tubulação Split", "Fiação Elétrica"];
const nomesShaft = ["Shaft – água fria", "Shaft – gás primário", "Shaft – recalque", "Shaft – telecomunicações", "Shaft – elétrica (prumada)", "Shaft – esgoto e pluvial", "Shaft – incêndio (hidrante)"];

// Não há predefinições prontas: cada pessoa cria as suas com "+ Salvar filtro atual".
export function predefinicoesPadrao(_ctx: Ctx): Predefinicao[] {
  return [];
}