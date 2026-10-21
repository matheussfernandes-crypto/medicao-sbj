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

// predefinições que vêm com o sistema; os ids são resolvidos pelos nomes da obra
export function predefinicoesPadrao(ctx: Ctx): Predefinicao[] {
  const cat = (chave: string) => ctx.dados.categorias.filter((c) => c.chave === chave).map((c) => c.id);
  const serv = (nomes: string[]) => ctx.dados.servicos.filter((s) => nomes.includes(s.nome)).map((s) => s.id);
  const garagens = ctx.pavs.filter((p) => /^G\d|garagem/i.test(p.nome)).map((p) => p.id);
  return [
    { id: "p:esc", nome: "Escadaria completa", padrao: true, filtros: { ...FILTROS_VAZIOS, cat: cat("esc") }, montagem: { modo: "tipo", resumo: false } },
    { id: "p:infra", nome: "Infra dos apartamentos", padrao: true, filtros: { ...FILTROS_VAZIOS, cat: cat("tipo"), serv: serv(nomesInfra) }, montagem: { modo: "tipo", resumo: false } },
    { id: "p:shafts", nome: "Shafts dos halls", padrao: true, filtros: { ...FILTROS_VAZIOS, cat: cat("hall"), serv: serv(nomesShaft) }, montagem: { modo: "tipo", resumo: false } },
    { id: "p:garagens", nome: "Garagens", padrao: true, filtros: { ...FILTROS_VAZIOS, pav: garagens }, montagem: { modo: "pav", resumo: true } },
    { id: "p:sistemas", nome: "Só sistemas", padrao: true, filtros: { ...FILTROS_VAZIOS, sis: ctx.dados.sistemas.map((s) => s.id) }, montagem: { modo: "tipo", resumo: false } },
    {
      id: "p:aptos",
      nome: "Apartamentos",
      padrao: true,
      filtros: { ...FILTROS_VAZIOS, cat: cat("tipo") },
      formato: { folha: "v", linhas: "local", texto: "v", letra: "n", det: "un", fit: "enc" },
      montagem: { modo: "tipo", resumo: false, esconder: false },
    },
  ];
}
