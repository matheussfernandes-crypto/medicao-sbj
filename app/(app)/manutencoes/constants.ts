// Listas e rótulos compartilhados entre todas as telas do módulo de
// Manutenções / Assistência Técnica — mantidos em um só lugar pra bater
// exatamente com os `check` constraints da tabela `manutencao_os`.

export const SOLICITANTE_TIPO_LABEL: Record<string, string> = {
  MORADOR: "Morador",
  SINDICO: "Síndico",
  ADMINISTRADORA: "Administradora",
  ZELADOR: "Zelador",
  OUTRO: "Outro",
};

export const ORIGEM_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  TELEFONE: "Telefone",
  EMAIL: "E-mail",
  VISTORIA: "Vistoria",
  PREVENTIVA: "Preventiva",
  OUTRO: "Outro",
};

export const CATEGORIA_LABEL: Record<string, string> = {
  HIDRAULICA: "Hidráulica",
  IMPERMEABILIZACAO: "Impermeabilização",
  GAS: "Gás",
  ELETRICA: "Elétrica",
  ESTRUTURAL: "Estrutural",
  PREVENTIVO: "Preventivo",
  PINTURA_INTERNA: "Pintura Interna",
  PINTURA_EXTERNA: "Pintura Externa",
  REBOCO: "Reboco",
  REVESTIMENTOS: "Revestimentos",
  COBERTURA: "Cobertura",
  FACHADAS: "Fachadas",
  ESQUADRIAS: "Esquadrias",
  ELEVADORES: "Elevadores",
  PISCINA: "Piscina",
  PAISAGISMO: "Paisagismo",
  LIMPEZA: "Limpeza",
  OUTROS: "Outros",
};

export const PROBLEMA_LABEL: Record<string, string> = {
  INFILTRACAO: "Infiltração",
  VAZAMENTO: "Vazamento",
  TRINCA: "Trinca",
  MANCHA: "Mancha",
  DESCASCAMENTO: "Descascamento",
  PORTA: "Porta",
  JANELA: "Janela",
  REGISTRO: "Registro",
  RALO: "Ralo",
  PISO: "Piso",
  AZULEJO: "Azulejo",
  PINTURA: "Pintura",
  OUTRO: "Outro",
};

export const PRIORIDADE_LABEL: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  EMERGENCIAL: "Emergencial",
};

export const PRIORIDADE_COR: Record<string, string> = {
  BAIXA: "bg-gray-100 text-gray-600",
  MEDIA: "bg-blue-100 text-blue-700",
  ALTA: "bg-amber-100 text-amber-700",
  EMERGENCIAL: "bg-red-100 text-red-700",
};

export const STATUS_LABEL: Record<string, string> = {
  ABERTA: "Aberta",
  AGENDADA: "Agendada",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_MATERIAL: "Aguardando material",
  AGUARDANDO_EMPRESA: "Aguardando empresa",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
  GARANTIA_NEGADA: "Garantia negada",
};

export const STATUS_COR: Record<string, string> = {
  ABERTA: "badge-pendente",
  AGENDADA: "badge-pendente",
  EM_ANDAMENTO: "badge-pendente",
  AGUARDANDO_MATERIAL: "badge-pendente",
  AGUARDANDO_EMPRESA: "badge-pendente",
  AGUARDANDO_APROVACAO: "badge-pendente",
  CONCLUIDA: "badge-aprovado",
  CANCELADA: "badge-desativado",
  GARANTIA_NEGADA: "badge-rejeitado",
};

export const SERVICO_EXECUTADO_LABEL: Record<string, string> = {
  REPARO: "Reparo",
  TROCA: "Troca",
  VEDACAO: "Vedação",
  PINTURA: "Pintura",
  REGULAGEM: "Regulagem",
  LIMPEZA: "Limpeza",
  TESTE: "Teste",
  REVISAO: "Revisão",
  INSPECAO: "Inspeção",
  SUBSTITUICAO: "Substituição",
  OUTRO: "Outro",
};

export const GARANTIA_LABEL: Record<string, string> = {
  GARANTIA_CONSTRUTORA: "Garantia da construtora",
  GARANTIA_FORNECEDOR: "Garantia do fornecedor",
  RESPONSABILIDADE_CONDOMINIO: "Responsabilidade do condomínio",
  RESPONSABILIDADE_PROPRIETARIO: "Responsabilidade do proprietário",
  FORA_GARANTIA: "Fora da garantia",
  EM_ANALISE: "Em análise",
};

export const ANEXO_TIPO_LABEL: Record<string, string> = {
  FOTO_CLIENTE: "Foto do cliente",
  FOTO_ANTES: "Foto — antes",
  FOTO_DURANTE: "Foto — durante",
  FOTO_DEPOIS: "Foto — depois",
  VIDEO: "Vídeo",
  PDF: "PDF",
  DOCUMENTO: "Documento",
};

// Setores que podem criar/executar OS (tudo exceto Mestre Geral, RH e Financeiro)
export const SETORES_EXECUTORES = ["ESTAGIARIO", "ADMIN", "ARQUITETO", "ENGENHEIRO"];
// Setores que podem aprovar/reprovar
export const SETORES_APROVADORES = ["ADMIN", "ENGENHEIRO"];
// Setores com acesso ao módulo (view), incluindo o só-leitura
export const SETORES_MODULO = ["ADMIN", "ARQUITETO", "ENGENHEIRO", "MESTRE_GERAL", "ESTAGIARIO"];
