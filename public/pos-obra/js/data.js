/* ---------- Constantes de domínio ---------- */

const STORAGE_KEY = "posvenda_construtora_v2";
const SCHEMA_VERSION = 10;

const BUILDING_STATUS = {
  concluido: "Concluído",
  andamento: "Em andamento",
};

const TICKET_STATUS = [
  { id: "novo", label: "Aberto" },
  { id: "aguardando_vistoria", label: "Aguardando Vistoria" },
  { id: "aguardando_orcamento", label: "Aguardando Orçamento" },
  { id: "aguardando_fornecedor", label: "Aguardando Fornecedor" },
  { id: "aguardando_reparo", label: "Aguardando Reparo" },
  { id: "aguardando_conferencia", label: "Aguardando Conferência" },
  { id: "concluido", label: "Concluído" },
  { id: "improcedente", label: "Improcedente" },
  /* Valores legados — não são mais atribuídos por nenhum fluxo novo, ficam só
     para chamados antigos continuarem exibindo o status/cor com que foram
     salvos (nunca migrados à força). */
  { id: "em_analise", label: "Em Análise" },
  { id: "aguardando_condominio", label: "Aguardando Condomínio" },
  { id: "aguardando_cliente", label: "Aguardando Cliente" },
  { id: "agendado", label: "Agendado" },
  { id: "em_execucao", label: "Em Execução" },
  { id: "executado", label: "Executado" },
  { id: "aguardando_validacao", label: "Aguardando Validação" },
  { id: "fora_garantia", label: "Fora da Garantia" },
  { id: "cancelado", label: "Cancelado" },
];
const TICKET_STATUS_MAP = Object.fromEntries(TICKET_STATUS.map(s => [s.id, s.label]));
const CLOSED_STATUSES = ["concluido", "improcedente", "fora_garantia", "cancelado"];
const OPEN_STATUSES = TICKET_STATUS.map(s => s.id).filter(id => !CLOSED_STATUSES.includes(id));

const STATUS_COLORS = {
  novo: "#64748b",
  aguardando_vistoria: "#c2410c",
  em_analise: "#e8862c",
  aguardando_orcamento: "#9b51e0",
  aguardando_fornecedor: "#8e44ad",
  aguardando_reparo: "#4338ca",
  aguardando_conferencia: "#0d9488",
  aguardando_condominio: "#0891b2",
  aguardando_cliente: "#6366f1",
  agendado: "#2f6fed",
  em_execucao: "#1d4fbd",
  executado: "#0f9b6c",
  aguardando_validacao: "#ca8a04",
  concluido: "#1fa971",
  improcedente: "#94a3b8",
  fora_garantia: "#78716c",
  cancelado: "#e2504a",
};
function statusColor(id) { return STATUS_COLORS[id] || "#94a3b8"; }

const CATEGORIES = [
  "Hidráulica", "Elétrica", "Esquadrias", "Portas", "Fechaduras", "Impermeabilização", "Pintura",
  "Revestimentos", "Pisos", "Rodapés", "Gesso", "Louças e Metais", "Vidros", "Fachada", "Cobertura",
  "Elevadores", "Portões", "Sistemas de Incêndio", "Marcenaria", "Gás", "Estrutural", "Climatização",
  "Equipamentos", "Outros",
];

/* Hierarquia Sistema -> Material/Tipo -> Elemento, só para os sistemas em que o
   material muda o fornecedor certo (ex.: esquadria de alumínio x madeira são
   fornecedores diferentes). Sistemas fora daqui não mostram esses campos extras
   no formulário — Sistema + Ambiente(s) já bastam. Cada nível permite "+
   Adicionar" no formulário, então esta lista é só um ponto de partida, não um
   limite fechado. */
const SISTEMA_ESTRUTURA = {
  "Esquadrias": {
    materiais: [
      { id: "aluminio", label: "Alumínio", elementos: ["Janela", "Porta", "Porta de sacada", "Fixo", "Maxim-ar", "Basculante", "Outro"] },
      { id: "madeira", label: "Madeira", elementos: ["Porta", "Janela", "Batente", "Folha", "Outro"] },
      { id: "pvc", label: "PVC", elementos: ["Janela", "Porta", "Outro"] },
      { id: "vidro", label: "Vidro", elementos: ["Porta", "Guarda-corpo", "Fixo", "Outro"] },
      { id: "outro", label: "Outro", elementos: ["Outro"] },
    ],
  },
  "Portas": {
    materiais: [
      { id: "madeira", label: "Madeira", elementos: ["Porta de entrada", "Porta interna", "Porta corta-fogo", "Batente", "Outro"] },
      { id: "aluminio", label: "Alumínio", elementos: ["Porta", "Porta de sacada", "Outro"] },
      { id: "ferro_metal", label: "Ferro/Metal", elementos: ["Porta corta-fogo", "Portão", "Grade", "Outro"] },
      { id: "outro", label: "Outro", elementos: ["Outro"] },
    ],
  },
  "Revestimentos": {
    materiais: [
      { id: "ceramica", label: "Cerâmica", elementos: [] },
      { id: "porcelanato", label: "Porcelanato", elementos: [] },
      { id: "granito", label: "Granito", elementos: [] },
      { id: "marmore", label: "Mármore", elementos: [] },
      { id: "laminado", label: "Laminado", elementos: [] },
      { id: "textura_pintura", label: "Textura/Pintura", elementos: [] },
      { id: "outro", label: "Outro", elementos: [] },
    ],
  },
  "Fachada": {
    elementos: ["Fachada frontal", "Fachada posterior", "Fachada lateral direita", "Fachada lateral esquerda", "Empena", "Sacada", "Elemento específico", "Outro"],
  },
};

const PRIORITIES = [
  { id: "baixa", label: "Baixa", slaDays: 30 },
  { id: "media", label: "Média", slaDays: 15 },
  { id: "alta", label: "Alta", slaDays: 5 },
  { id: "critica", label: "Crítica", slaDays: 2 },
];
const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map(p => [p.id, p]));

const ORIGENS_SOLICITACAO = ["Cliente", "Síndico", "Condomínio", "Zelador", "Equipe interna", "Vistoria", "Outro"];

/* ---------- Localização do chamado (Local -> Ambiente/elemento) ---------- */
/* "Local" é fixo. "Ambiente" tem uma lista padrão global por local, mas cada
   empreendimento pode ter a sua própria lista (ver getAmbientesForLocal). */

const LOCAL_TIPOS = [
  { id: "unidade_privativa", label: "Unidade privativa" },
  { id: "area_comum", label: "Área comum" },
  { id: "area_lazer", label: "Área de lazer" },
  { id: "fachada", label: "Fachada" },
  { id: "garagem", label: "Garagem" },
  { id: "area_tecnica", label: "Área técnica" },
  { id: "cobertura", label: "Cobertura" },
  { id: "area_externa", label: "Área externa" },
  { id: "outro", label: "Outro" },
];
const LOCAL_TIPO_MAP = Object.fromEntries(LOCAL_TIPOS.map(l => [l.id, l.label]));

const DEFAULT_AMBIENTES_POR_LOCAL = {
  unidade_privativa: ["Sala", "Cozinha", "Lavanderia", "Suíte", "Quarto", "Banheiro", "Sacada", "Área técnica", "Outro"],
  area_comum: ["Hall de entrada", "Hall dos apartamentos", "Hall dos elevadores", "Corredores", "Elevadores", "Escadaria", "Portaria", "Recepção", "Circulação", "Lixeira", "Central de gás", "Casa de bombas", "Banheiro área comum", "Lavabo", "Outro"],
  area_lazer: ["Piscina", "Deck", "Salão de festas", "Espaço gourmet", "Academia", "Brinquedoteca", "Playground", "Espaço pet", "Sauna", "Sala de jogos", "Quadra", "Churrasqueira", "Banheiros", "Outro"],
  fachada: ["Fachada frontal", "Fachada posterior", "Fachada lateral", "Sacadas", "Esquadrias", "Revestimentos", "Pintura", "Elementos de fachada", "Outro"],
  garagem: ["Vaga", "Circulação", "Portão", "Portaria", "Piso", "Parede", "Teto", "Iluminação", "Outro"],
  area_tecnica: ["Casa de máquinas", "Casa de bombas", "Barrilete", "Reservatórios", "Central de gás", "Área técnica da unidade", "Equipamentos", "Outro"],
  cobertura: ["Laje de cobertura", "Impermeabilização", "Casa de máquinas", "Reservatório superior", "Para-raios", "Guarda-corpo", "Acesso à cobertura", "Outro"],
  area_externa: ["Jardins", "Calçadas", "Muro/Cerca", "Estacionamento externo", "Área externa geral", "Outro"],
  outro: ["Outro"],
};

/* Lista efetiva de ambientes de um prédio para um local: usa a personalizada do
   prédio se existir, senão cai no padrão global (assim todo prédio já funciona
   sem precisar de configuração manual prévia). */
function getAmbientesForLocal(building, localTipoId) {
  if (building?.ambientesPorLocal?.[localTipoId]) return building.ambientesPorLocal[localTipoId];
  return DEFAULT_AMBIENTES_POR_LOCAL[localTipoId] || ["Outro"];
}
/* Adiciona um ambiente novo só para este prédio. Na primeira customização de um
   local, "bifurca" a partir do padrão global (cópia + novo item). */
function addAmbienteToBuilding(building, localTipoId, ambiente) {
  if (!building.ambientesPorLocal) building.ambientesPorLocal = {};
  if (!building.ambientesPorLocal[localTipoId]) {
    building.ambientesPorLocal[localTipoId] = [...(DEFAULT_AMBIENTES_POR_LOCAL[localTipoId] || ["Outro"])];
  }
  const list = building.ambientesPorLocal[localTipoId];
  const withoutOutro = list.filter(a => a.toLowerCase() !== "outro");
  if (!withoutOutro.some(a => a.toLowerCase() === ambiente.toLowerCase())) {
    withoutOutro.push(ambiente);
  }
  withoutOutro.push("Outro");
  building.ambientesPorLocal[localTipoId] = withoutOutro;
}

function blankSindico() {
  return { nome: "", telefone: "", email: "", dataInicio: "", observacoes: "" };
}
function blankAdministradora() {
  return { nomeEmpresa: "", responsavel: "", telefone: "", email: "" };
}

/* ---------- Fornecedores ---------- */

const DEFAULT_SUPPLIER_SPECIALTIES = [
  "Piscinas", "Esquadrias", "Impermeabilização", "Pintura", "Elétrica", "Hidráulica",
  "Elevadores", "Revestimentos", "Vidros", "Climatização", "Portões", "Bombas",
  "Equipamentos", "Fachada", "Outros",
];

function blankSupplier() {
  return {
    razaoSocial: "", nomeFantasia: "", cnpj: "", telefone: "", whatsapp: "", email: "",
    endereco: "", site: "", status: "ativo",
    contacts: [], specialties: [], buildings: [], notes: "",
  };
}
function blankSupplierContact() {
  return { id: "", nome: "", cargo: "", telefone: "", whatsapp: "", email: "" };
}
/* Relação fornecedor+empreendimento: categoria/materiais/contato podem variar
   de obra para obra, por isso não ficam no cadastro geral do fornecedor. */
function blankSupplierBuildingLink() {
  return { id: "", buildingId: "", categoria: "", materiais: [], contatoNome: "", contatoTelefone: "", contatoEmail: "", periodo: "", participacao: "" };
}
/* Tipo de participação do fornecedor naquele sistema/material específico —
   um fornecedor pode só fornecer o material em uma obra e fornecer+instalar
   em outra, por isso fica no vínculo, nunca no cadastro geral. */
const PARTICIPACAO_OPTIONS = ["Fornecimento", "Instalação", "Fornecimento + instalação", "Manutenção / assistência técnica"];
function supplierDisplayName(s) { return s.nomeFantasia || s.razaoSocial || "(fornecedor sem nome)"; }

/* Normaliza um nome de empresa para comparação (minúsculo, sem acento, sem
   sufixo societário) — usado só para SUGERIR possível duplicata, nunca decide
   sozinho. */
function normalizeSupplierName(name) {
  return (name || "")
    .toLowerCase()
    .normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/\b(s\/a|s\.a\.?|ltda\.?|me|eireli|epp)\b/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
/* Telefone é o identificador mais confiável pra dedup — nome sozinho engana
   ("Casa das Chaves" vs "Casa das Chaves Ltda." vs "Casa das Chaves - Alan"),
   mas o número não muda. Compara só dígitos, ignora formatação. */
function normalizePhone(phone) {
  return (phone || "").replace(/\D/g, "");
}
function supplierAllPhones(s) {
  const list = [s.telefone, s.whatsapp, ...(s.contacts || []).flatMap(c => [c.telefone, c.whatsapp])];
  return list.map(normalizePhone).filter(Boolean);
}
function findSimilarSupplierByPhone(phones) {
  const candidates = (Array.isArray(phones) ? phones : [phones]).map(normalizePhone).filter(Boolean);
  if (!candidates.length) return null;
  return state.suppliers.find(s => {
    const known = supplierAllPhones(s);
    return candidates.some(c => known.includes(c));
  }) || null;
}
/* Devolve o fornecedor existente mais parecido, ou null. Telefone igual =
   certeza (maior prioridade — nome varia, telefone não); CNPJ igual = certeza;
   nome normalizado igual/contido = possível duplicata. */
function findSimilarSupplier(nome, cnpj, phones) {
  const byPhone = findSimilarSupplierByPhone(phones);
  if (byPhone) return byPhone;
  const cnpjDigits = (cnpj || "").replace(/\D/g, "");
  if (cnpjDigits) {
    const byCnpj = state.suppliers.find(s => s.cnpj && s.cnpj.replace(/\D/g, "") === cnpjDigits);
    if (byCnpj) return byCnpj;
  }
  const norm = normalizeSupplierName(nome);
  if (!norm) return null;
  return state.suppliers.find(s => {
    const n = normalizeSupplierName(supplierDisplayName(s));
    return n && (n === norm || n.includes(norm) || norm.includes(n));
  }) || null;
}

/* ---------- Importação inicial de fornecedores (listas de manual do proprietário) ---------- */
/* Cada linha é um fornecedor+categoria+empreendimento tirado das listas reais de
   materiais/fornecedores dos manuais. Nunca roda "só uma vez" com flag — é
   idempotente por natureza: antes de adicionar, checa se aquele fornecedor já
   tem um vínculo pra aquele empreendimento+categoria e pula se já existir, então
   pode rodar em todo load sem nunca duplicar nem sobrescrever edição manual. */
const IMPORT_FORNECEDORES_OBRAS = [
  // ---- Residencial Ilha do Campeche (b21) ----
  { buildingId: "b21", categoria: "Revestimentos", nome: "Portobello S/A", contatoNome: "Marilene", contatoTelefone: "(47) 99176-4898",
    materiais: ["Revestimento de piso: Porcelanato Hit Off White (80x80) acabamento natural", "Porcelanato Hit Gris (80x80) acabamento natural", "Revestimento de parede da lavanderia e do banheiro: Cetim Bianco (30x60)"] },
  { buildingId: "b21", categoria: "Fechaduras", nome: "Pado", contatoTelefone: "(43) 3249-1100",
    materiais: ["Fechadura em aço inox internas e externas dos apartamentos, modelo Barra 55mm"] },
  { buildingId: "b21", categoria: "Fechaduras", nome: "Casa das Chaves", contatoNome: "Alan", contatoTelefone: "(47) 99151-0631", endereco: "Rua 904, Balneário Camboriú - SC",
    materiais: ["Fechadura Digital Kombat TTLock", "Instalação — central de atendimento (47) 99183-4630"] },
  { buildingId: "b21", categoria: "Impermeabilização", nome: "Denver S/A", contatoTelefone: "0800 770 1604 / (11) 4741-6000", endereco: "Av. Vereador João Batista Fitipaldi, 500, Vila Maluf, Suzano - SP",
    materiais: ["Argamassa polimérica Denvertec 100 e Denvertec 540", "Tela poliéster PVC impermeabilização"] },
  { buildingId: "b21", categoria: "Elevadores", nome: "Otis", contatoTelefone: "0800 704 8783", site: "https://www.otis.com/pt/br",
    materiais: ["Dois elevadores"] },
  { buildingId: "b21", categoria: "Sistemas de Incêndio", nome: "Manutenge", contatoTelefone: "(47) 3348-6092", endereco: "Itajaí - SC",
    materiais: ["Sistemas de iluminação de emergência e alarme de incêndio"] },
  { buildingId: "b21", categoria: "Climatização", nome: "Jaime Refrigeração e Climatização", contatoTelefone: "(47) 3342-2374",
    materiais: ["Tubulação e instalação de infraestrutura para ar-condicionado split"] },
  { buildingId: "b21", categoria: "Esquadrias", nome: "Alcomet Esquadrias", contatoTelefone: "(47) 3338-0089",
    materiais: ["Perfis de alumínio e acessórios, linha Suprema Mega"] },
  { buildingId: "b21", categoria: "Esquadrias", nome: "MS Esquadrias Ltda.", contatoTelefone: "(47) 3342-1749", contatoEmail: "marceloesq.@brturbo.com.br",
    materiais: ["Montagem e instalação das esquadrias metálicas — alumínio pintado cor preto, linha Suprema", "Janela suprema: vidro 4mm incolor superior, fixo inferior 4+4 laminado incolor", "Porta suprema: vidro tempero incolor 6mm", "Sacada lazer: vidro laminado incolor 4+4", "Portas pivotantes: vidro tempero incolor 10mm"] },
  { buildingId: "b21", categoria: "Portas", nome: "AGF Portas", contatoTelefone: "(47) 3375-0361",
    materiais: ["Portas linha ECO — entrada com preenchimento sólido em bondoor, demais semi-sólido em colméia, 35mm de espessura"] },
  { buildingId: "b21", categoria: "Revestimentos", nome: "Dimarmo", contatoTelefone: "(47) 3347-0447", contatoEmail: "contato@dimarmo.ind.br",
    materiais: ["Revestimentos em mármore, patamar e áreas comuns"] },
  { buildingId: "b21", categoria: "Revestimentos", nome: "Marmoraria KSP", contatoTelefone: "(47) 3365-4846 / (47) 99974-3792",
    materiais: ["Soleiras e peitoris das janelas"] },
  { buildingId: "b21", categoria: "Elétrica", nome: "Elétrica Zata Ltda", contatoTelefone: "(47) 9955-9471", endereco: "Rua Paris, 190, Itoupava Norte, Blumenau - SC",
    materiais: ["Disjuntores, caixas de passagem", "Módulo tomada/interruptor Legrand, cor branca"] },
  { buildingId: "b21", categoria: "Elétrica", nome: "Renatec Group", contatoTelefone: "(48) 99914-1700", endereco: "R. Jovito José Sodré, 319, Rio Caveiras, Biguaçu - SC",
    materiais: ["Quadros elétricos"] },
  { buildingId: "b21", categoria: "Louças e Metais", nome: "Roca", contatoNome: "Rafael", contatoTelefone: "(47) 99964-5579",
    materiais: ["Bacia sanitária modelo BC + caixa duplo acionamento Square BR — Roca C329770005, branco"] },
  { buildingId: "b21", categoria: "Hidráulica", nome: "Docol Metais Sanitários Ltda", contatoTelefone: "0800 474 333", site: "www.docol.com.br",
    materiais: ["Registro de pressão 3/4\"", "Registro de gaveta 3/4\" e 2\"", "Válvula de retenção vertical 2.1/2\"", "Válvula de esfera"] },
  { buildingId: "b21", categoria: "Pintura", nome: "Sanicolor", contatoTelefone: "(11) 98765-4321", site: "https://sanicolor.com.br/",
    materiais: ["Massa corrida"] },
  { buildingId: "b21", categoria: "Pintura", nome: "Decortec", contatoTelefone: "(47) 3268-7070",
    materiais: ["Massa PVA e acrílica, ambientes internos"] },
  { buildingId: "b21", categoria: "Hidráulica", nome: "LAO Indústrias", contatoTelefone: "(11) 3658-5200 / Fax (11) 3658-5219", notes: "Representante em SC: Marcelo Machado e Cia — (48) 3222-1889 (Luis Fernando)",
    materiais: ["Hidrômetros de 1\" e 3/4\", multijato, marca LAO"] },
  { buildingId: "b21", categoria: "Pintura", nome: "BASF SA", contatoNome: "Eduardo", contatoTelefone: "(48) 98414-5545", endereco: "Rua Cyro Correia Pereira, 2400, Curitiba - PR",
    materiais: ["Pintura externa (Suvinil): Inverno seco, Elefante, Cinza asfalto, Suco de uva, Roxo atemporal, Desfile de moda, Fim da estação, Dia de noiva, Capa de chuva", "Pintura interna apartamentos: Branco neve fosco (Suvinil)", "Áreas comuns: Fuligem (hall aptos), Branco gelo (salão de festas/hall entrada/lavabos), Cascalho (lavabo PCD), Cosmos (salão de jogos/academia), Suco de uva (piscina externa)"] },
  { buildingId: "b21", categoria: "Rodapés", nome: "Santa Luzia Soluções para Construção Civil", contatoNome: "Marinho", contatoTelefone: "(47) 99188-9988",
    materiais: ["Rodapé preto 15cm"] },
  { buildingId: "b21", categoria: "Rodapés", nome: "Biancogres", contatoNome: "Marinho", contatoTelefone: "(47) 99188-9988",
    materiais: ["Rodapé branco 10cm e 15cm"] },
  { buildingId: "b21", categoria: "Revestimentos", nome: "Ceramfix - Quartzolit", contatoTelefone: "(47) 2102-0511",
    materiais: ["Argamassas e rejuntes branco e cinza claro"] },
  { buildingId: "b21", categoria: "Gesso", nome: "Novagesso Ltda", contatoNome: "Jairo", contatoTelefone: "(47) 3319-5220 / 9912-2751",
    materiais: ["Fornecimento e execução de tetos e rebaixos, placas 60x60cm em gesso"] },
  { buildingId: "b21", categoria: "Portões", nome: "Patrimonial", contatoTelefone: "(47) 3348-4818", endereco: "Itajaí - SC",
    materiais: ["Portões eletrônicos"] },
  { buildingId: "b21", categoria: "Cobertura", nome: "Marcotelhas Industria Ltda", contatoTelefone: "(47) 3366-8532", endereco: "Rodovia BR 101, 8501, Galpão 10 e 11 Bloco A",
    materiais: ["Cobertura"] },
  { buildingId: "b21", categoria: "Cobertura", nome: "Rei das Calhas",
    materiais: ["Calhas e rufos em chapas de alumínio"] },
  { buildingId: "b21", categoria: "Sistemas de Incêndio", nome: "Multiseg", contatoTelefone: "(47) 3086-4218", endereco: "R. São Paulo, 3393, Itaum, Joinville - SC",
    materiais: ["Extintores 2A:10BC 4kg", "Extintores 2 PQS-4kg 10B:1C"] },
  { buildingId: "b21", categoria: "Pisos", nome: "Wnil Cerranas", contatoTelefone: "(47) 99754-8839", endereco: "Rua Modesto Tibolla, 156, Luiz Alves - SC",
    materiais: ["Instalação de piso laminado", "Piso Laminado EucaFloor Prime — cores Andorra New, Valência ou Lâmina Amêndoa"] },

  // ---- Residencial Ilha de Ibiza (b20) ----
  { buildingId: "b20", categoria: "Revestimentos", nome: "Portobello S/A", contatoNome: "Marilene", contatoTelefone: "(47) 99176-4898",
    materiais: ["Apartamentos — pisos: Porcelanato Via Durini Fog (90x90) natural, Via Durini Grey (90x90) natural, Via Durini Fog (90x90) EXT, Via Durini Grey (90x90) EXT", "Áreas comuns: Zesty Off White (1,20x1,20), Aeterna Bianco ST 120x120, Aeterna Bianco Cesellato MAT RET 45x120"] },
  { buildingId: "b20", categoria: "Fechaduras", nome: "Pado", contatoTelefone: "(43) 3249-1100",
    materiais: ["Fechadura em aço inox internas e externas dos apartamentos, modelo Barra 55mm", "Fechadura eletrônica FDE-250"] },
  { buildingId: "b20", categoria: "Fechaduras", nome: "Casa das Chaves", endereco: "Rua 904, Balneário Camboriú - SC",
    materiais: ["Instalação — central de atendimento (47) 99183-4630"] },
  { buildingId: "b20", categoria: "Impermeabilização", nome: "Denver S/A", contatoTelefone: "0800 770 1604 / (11) 4741-6000", endereco: "Av. Vereador João Batista Fitipaldi, 500, Vila Maluf, Suzano - SP",
    materiais: ["Argamassa polimérica Denvertec 100 e Denvertec 540", "Tela poliéster PVC impermeabilização"] },
  { buildingId: "b20", categoria: "Elevadores", nome: "Otis", contatoTelefone: "0800 704 8783", site: "https://www.otis.com/pt/br",
    materiais: ["Dois elevadores"] },
  { buildingId: "b20", categoria: "Sistemas de Incêndio", nome: "Manutenge", contatoTelefone: "(47) 3348-6092", endereco: "Itajaí - SC",
    materiais: ["Sistemas de iluminação de emergência e alarme de incêndio"] },
  { buildingId: "b20", categoria: "Climatização", nome: "Jaime Refrigeração e Climatização", contatoTelefone: "(47) 3342-2374",
    materiais: ["Tubulação e instalação de infraestrutura para ar-condicionado split"] },
  { buildingId: "b20", categoria: "Esquadrias", nome: "Alcomet Esquadrias", contatoTelefone: "(47) 3338-0089",
    materiais: ["Perfis de alumínio e acessórios, linha Suprema Mega", "Portões"] },
  { buildingId: "b20", categoria: "Esquadrias", nome: "MS Esquadrias Ltda.", contatoTelefone: "(47) 3342-1749", contatoEmail: "marceloesq.@brturbo.com.br",
    materiais: ["Montagem e instalação das esquadrias metálicas — alumínio pintado, linha Suprema", "Janela suprema: vidro 4mm incolor superior, fixo inferior 4+4 laminado incolor", "Porta suprema: vidro tempero incolor 6mm", "Sacada: vidro laminado incolor 4+4", "Portas pivotantes: vidro tempero incolor 10mm"] },
  { buildingId: "b20", categoria: "Portas", nome: "AGF Portas", contatoTelefone: "(47) 3375-0361",
    materiais: ["Esquadrias em MDF ultra e folha em madeira de alma cheia, revestimento em laca"] },
  { buildingId: "b20", categoria: "Revestimentos", nome: "Dimarmo", contatoTelefone: "(47) 3347-0447", contatoEmail: "contato@dimarmo.ind.br",
    materiais: ["Revestimentos em mármore, patamar e espelho das áreas comuns"] },
  { buildingId: "b20", categoria: "Revestimentos", nome: "Marmoraria KSP", contatoTelefone: "(47) 3365-4846 / (47) 99974-3792",
    materiais: ["Soleiras e peitoris das janelas"] },
  { buildingId: "b20", categoria: "Elétrica", nome: "Elétrica Zata Ltda", contatoTelefone: "(47) 9955-9471", endereco: "Rua Paris, 190, Itoupava Norte, Blumenau - SC",
    materiais: ["Disjuntores, caixas de passagem", "Módulo tomada/interruptor Legrand, cor branca"] },
  { buildingId: "b20", categoria: "Louças e Metais", nome: "Roca", contatoNome: "Rafael", contatoTelefone: "(47) 99964-5579",
    materiais: ["Bacia sanitária modelo BC + caixa duplo acionamento Square BR — Roca C329770005, branco"] },
  { buildingId: "b20", categoria: "Hidráulica", nome: "Docol Metais Sanitários Ltda", contatoTelefone: "0800 474 333", site: "www.docol.com.br",
    materiais: ["Registro de pressão 3/4\"", "Registro de gaveta 3/4\" e 2\"", "Válvula de retenção vertical 2.1/2\"", "Válvula de esfera"] },
  { buildingId: "b20", categoria: "Pintura", nome: "Decortec", contatoTelefone: "(47) 3360-7676", site: "https://www.decortec.ind.br/",
    materiais: ["Textura de churrasqueira", "Massa PVA e acrílica, ambientes internos"] },
  { buildingId: "b20", categoria: "Hidráulica", nome: "LAO Indústrias", contatoTelefone: "(11) 3658-5200 / Fax (11) 3658-5219", notes: "Representante em SC: Marcelo Machado e Cia — (48) 3222-1889 (Luis Fernando)",
    materiais: ["Hidrômetros de 1\" e 3/4\", multijato, marca LAO"] },
  { buildingId: "b20", categoria: "Pintura", nome: "BASF SA", contatoNome: "Eduardo", contatoTelefone: "(48) 98414-5545", endereco: "Rua Cyro Correia Pereira, 2400, Curitiba - PR",
    materiais: ["Pintura externa: Patativa, Barrica de carvalho, Concreto, Prata", "Pintura interna: Inverno gelado (hall aptos), Branco gelo (apartamentos), Anoitecer (sanca brinquedoteca), Estrada velha (teto salão de jogos), Fumaça de lareira (parede salão de jogos), Biscoito de chocolate (teto academia), Cobre arandela (academia)"] },
  { buildingId: "b20", categoria: "Rodapés", nome: "Santa Luzia Soluções para Construção Civil", contatoNome: "Marinho", contatoTelefone: "(47) 99188-9988",
    materiais: ["Rodapé 10cm e 15cm"] },
  { buildingId: "b20", categoria: "Revestimentos", nome: "Ceramfix - Quartzolit", contatoTelefone: "(47) 2102-0511",
    materiais: ["Argamassas e rejuntes branco"] },
  { buildingId: "b20", categoria: "Gesso", nome: "Novagesso Ltda", contatoTelefone: "(47) 3319-5220 / 9912-2751",
    materiais: ["Fornecimento e execução de tetos e rebaixos, placas 60x60cm em gesso"] },
  { buildingId: "b20", categoria: "Portões", nome: "Patrimonial", contatoTelefone: "(47) 3348-4818", endereco: "Itajaí - SC",
    materiais: ["Portões eletrônicos"] },
  { buildingId: "b20", categoria: "Cobertura", nome: "Marcotelhas Industria Ltda", contatoTelefone: "(47) 3366-8532", endereco: "Rodovia BR 101, 8501, Galpão 10 e 11 Bloco A",
    materiais: ["Cobertura"] },
  { buildingId: "b20", categoria: "Cobertura", nome: "Rei das Calhas",
    materiais: ["Calhas e rufos em chapas de alumínio"] },
  { buildingId: "b20", categoria: "Sistemas de Incêndio", nome: "Multiseg", contatoTelefone: "(47) 3086-4218", endereco: "R. São Paulo, 3393, Itaum, Joinville - SC",
    materiais: ["Extintores 2A:10BC 4kg", "Extintores 2 PQS-4kg 10B:1C"] },
  { buildingId: "b20", categoria: "Pisos", nome: "Wnil Cerranas", contatoTelefone: "(47) 99754-8839", endereco: "Luiz Alves - SC",
    materiais: ["Instalação de piso vinílico", "Piso Vinílico Tarkett 2mm (cor variada conforme escolha do cliente)"] },

  // ---- Residencial Ilha de Malta (b19) ----
  { buildingId: "b19", categoria: "Revestimentos", nome: "Portobello S/A", contatoNome: "Marilene", contatoTelefone: "(47) 99176-4898",
    materiais: ["Pisos: Porcelanato Hit Off White (80x80) natural, Hit Gris (80x80) natural", "Azulejos paredes cozinha/banheiros: Cetim Bianco (30x60)"] },
  { buildingId: "b19", categoria: "Fechaduras", nome: "Pado", contatoTelefone: "(43) 3249-1100",
    materiais: ["Fechadura em aço inox internas dos apartamentos, modelo Barra"] },
  { buildingId: "b19", categoria: "Impermeabilização", nome: "Imperclean", contatoTelefone: "(47) 3339-6033",
    materiais: ["Serviço de impermeabilização e cimento polimérico"] },
  { buildingId: "b19", categoria: "Impermeabilização", nome: "Denver S/A",
    materiais: ["Manta asfáltica tipo III e tipo III AR"] },
  { buildingId: "b19", categoria: "Elevadores", nome: "Atlas Schindler", contatoTelefone: "0800-055 1918", site: "http://www.schindler.com/br",
    materiais: ["Quatro elevadores para 05 passageiros"] },
  { buildingId: "b19", categoria: "Sistemas de Incêndio", nome: "Manutenge", contatoTelefone: "(47) 3348-6092", endereco: "Itajaí - SC",
    materiais: ["Sistemas de iluminação de emergência e alarme de incêndio"] },
  { buildingId: "b19", categoria: "Climatização", nome: "Jaime Refrigeração e Climatização", contatoTelefone: "(47) 3342-2374",
    materiais: ["Tubulação e instalação de infraestrutura para ar-condicionado split"] },
  { buildingId: "b19", categoria: "Esquadrias", nome: "Alcomet Esquadrias", contatoTelefone: "(47) 3338-0089",
    materiais: ["Perfis de alumínio e acessórios, linha Suprema Mega", "Portões"] },
  { buildingId: "b19", categoria: "Esquadrias", nome: "MS Esquadrias Ltda.", contatoTelefone: "(47) 3342-1749", contatoEmail: "marceloesq.@brturbo.com.br",
    materiais: ["Montagem e instalação das esquadrias metálicas — alumínio anodizado, modelo 1003, linha Suprema", "Vidros float incolor 4mm, temperados incolor 6mm, porta vidro temperado incolor 10mm"] },
  { buildingId: "b19", categoria: "Portas", nome: "AGF Portas", contatoTelefone: "(47) 3375-0361",
    materiais: ["Esquadrias em MDF ultra e folha em madeira de alma cheia, revestimento em laca"] },
  { buildingId: "b19", categoria: "Revestimentos", nome: "Dimarmo", contatoTelefone: "(47) 3347-0447", contatoEmail: "contato@dimarmo.ind.br",
    materiais: ["Revestimentos em mármore, patamar e espelho das áreas comuns"] },
  { buildingId: "b19", categoria: "Revestimentos", nome: "Marmoraria KSP", contatoTelefone: "(47) 3365-4846 / (47) 99974-3792",
    materiais: ["Soleiras e peitoris das janelas"] },
  { buildingId: "b19", categoria: "Elétrica", nome: "Steck Ind. Elétrica Ltda", contatoTelefone: "(11) 2206-7610", endereco: "Av. Mendes da Rocha, 1771, Jardim Brasil, São Paulo - SP",
    materiais: ["Disjuntores, caixas de passagem"] },
  { buildingId: "b19", categoria: "Elétrica", nome: "Rossi Materiais de Construção", contatoTelefone: "(47) 3367-2788", endereco: "Av. dos Estados, 3325, Centro, Balneário Camboriú - SC",
    materiais: ["Módulo tomada/interruptor Pial, linha Nereya, cor branca"] },
  { buildingId: "b19", categoria: "Louças e Metais", nome: "RJL Representação - Incepa", contatoTelefone: "(47) 9964-2579",
    materiais: ["Bacia sanitária modelo Thema, branco, com caixa acoplada"] },
  { buildingId: "b19", categoria: "Hidráulica", nome: "Docol Metais Sanitários Ltda", contatoTelefone: "0800 474 333", site: "www.docol.com.br",
    materiais: ["Registro de pressão 3/4\"", "Registro de gaveta 3/4\" e 2\"", "Válvula de retenção vertical 2.1/2\"", "Válvula de esfera"] },
  { buildingId: "b19", categoria: "Pintura", nome: "Decortec", contatoTelefone: "(47) 3360-7676", site: "https://www.decortec.ind.br/",
    materiais: ["Textura de churrasqueira", "Massa PVA e acrílica, ambientes internos"] },
  { buildingId: "b19", categoria: "Hidráulica", nome: "LAO Indústrias", contatoTelefone: "(11) 3658-5200 / Fax (11) 3658-5219", notes: "Representante em SC: Marcelo Machado e Cia — (48) 3222-1889 (Luis Fernando)",
    materiais: ["Hidrômetros de 1\" e 3/4\", multijato, marca LAO"] },
  { buildingId: "b19", categoria: "Pintura", nome: "BASF SA", contatoNome: "Eduardo", contatoTelefone: "(48) 98414-5545", endereco: "Rua Cyro Correia Pereira, 2400, Curitiba - PR",
    materiais: ["Pintura externa: Patativa, Cinza asfalto, Elefante, Melado, Branco gelo", "Pintura interna: Nanquim, Papel picado, Pimenta síria, Branco gelo"] },
  { buildingId: "b19", categoria: "Rodapés", nome: "Engevil Soluções para Construção Civil", contatoNome: "Stephanie", contatoTelefone: "(47) 99155-6661",
    materiais: ["Rodapé 10cm"] },
  { buildingId: "b19", categoria: "Revestimentos", nome: "Ceramfix", contatoTelefone: "(47) 2102-0511",
    materiais: ["Argamassas e rejuntes branco"] },
  { buildingId: "b19", categoria: "Gesso", nome: "Novagesso Ltda", contatoTelefone: "(47) 3319-5220 / 9912-2751",
    materiais: ["Fornecimento e execução de tetos e rebaixos, placas 60x60cm em gesso"] },
  { buildingId: "b19", categoria: "Portões", nome: "Patrimonial", contatoTelefone: "(47) 3348-4818", endereco: "Itajaí - SC",
    materiais: ["Portões eletrônicos"] },
  { buildingId: "b19", categoria: "Cobertura", nome: "Rei das Calhas", contatoTelefone: "(47) 3348-2050", endereco: "R. José Pereira Liberato, 1063, São João, Itajaí - SC",
    materiais: ["Calhas e rufos em chapas de alumínio"] },
  { buildingId: "b19", categoria: "Sistemas de Incêndio", nome: "Multiseg", contatoTelefone: "(47) 3086-4218", endereco: "R. São Paulo, 3393, Itaum, Joinville - SC",
    materiais: ["Extintores 2A:10BC 4kg", "Extintores 2 PQS-4kg 10B:1C"] },
  { buildingId: "b19", categoria: "Pisos", nome: "Wnil Cerranas", contatoTelefone: "(47) 99754-8839", endereco: "Luiz Alves - SC",
    materiais: ["Instalação de piso vinílico", "Piso Vinílico Hanley 2mm (cor variada conforme escolha do cliente)"] },

  // ---- Residencial Ilha de San Andrés (b18) ----
  { buildingId: "b18", categoria: "Revestimentos", nome: "Portobello S/A", contatoNome: "Marilene", contatoTelefone: "(47) 99176-4898",
    materiais: ["Apartamentos — azulejos área de serviço/banheiros: Cetim Bianco 30x60 RET; pisos: Hit Off White 80x80 RET / Hit Gris 80x80 RET", "Áreas comuns — Hall de entrada: Storm White 120x120 polido, Storm White Ply 60x120", "Hall dos apartamentos: Pietra Lombarda 90x90, Filo Gamma 60x120", "Piscina: Salt Lake 20x20, MoonLight 90x90 polido, Salt Winter 20x20, Ms Barcelona 90x90 EXT", "Banheiro salão de festas: Alpissimi 120x120 polido"] },
  { buildingId: "b18", categoria: "Fechaduras", nome: "Pado", contatoTelefone: "(48) 9911-3189",
    materiais: ["Fechadura em aço inox internas dos apartamentos"] },
  { buildingId: "b18", categoria: "Impermeabilização", nome: "Imperclean", contatoTelefone: "(47) 3339-6033",
    materiais: ["Serviço de impermeabilização e cimento polimérico"] },
  { buildingId: "b18", categoria: "Impermeabilização", nome: "Denver S/A",
    materiais: ["Manta asfáltica tipo III e tipo III AR"] },
  { buildingId: "b18", categoria: "Elevadores", nome: "Atlas Schindler", contatoTelefone: "0800-055 1918", site: "http://www.schindler.com/br",
    materiais: ["Quatro elevadores para 05 passageiros"] },
  { buildingId: "b18", categoria: "Sistemas de Incêndio", nome: "Manutenge", contatoTelefone: "(47) 3348-6092", endereco: "Itajaí - SC",
    materiais: ["Sistemas de iluminação de emergência e alarme de incêndio"] },
  { buildingId: "b18", categoria: "Climatização", nome: "Jaime Refrigeração e Climatização", contatoTelefone: "(47) 3342-2374",
    materiais: ["Tubulação e instalação de infraestrutura para ar-condicionado split"] },
  { buildingId: "b18", categoria: "Esquadrias", nome: "Alcomet Esquadrias", contatoTelefone: "(47) 3338-0089",
    materiais: ["Perfis de alumínio e acessórios, linha Suprema Mega", "Portões linha búzios, pintura eletrostática preto fosco"] },
  { buildingId: "b18", categoria: "Esquadrias", nome: "MS Esquadrias Ltda.", contatoTelefone: "(47) 3342-1749", contatoEmail: "marceloesq.@brturbo.com.br",
    materiais: ["Montagem e instalação das esquadrias metálicas — alumínio anodizado, modelo 1003, linha Suprema", "Vidros float incolor 4mm, temperados incolor 6mm, porta vidro temperado incolor 10mm"] },
  { buildingId: "b18", categoria: "Portas", nome: "AGF Portas", contatoTelefone: "(47) 3375-0361",
    materiais: ["Esquadrias em MDF ultra e folha em madeira de alma cheia, revestimento em laca"] },
  { buildingId: "b18", categoria: "Revestimentos", nome: "Gringo Mármores", contatoNome: "Rafael", contatoTelefone: "(47) 99158-1197",
    materiais: ["Bancadas, cubas e vistas do salão de festas e banheiros"] },
  { buildingId: "b18", categoria: "Revestimentos", nome: "Marmoraria Pirâmide", contatoNome: "Daniel", contatoTelefone: "(47) 99955-6055",
    materiais: ["Soleiras e peitoris das janelas"] },
  { buildingId: "b18", categoria: "Elétrica", nome: "Steck Ind. Elétrica Ltda", contatoTelefone: "(11) 2206-7610", endereco: "Av. Mendes da Rocha, 1771, Jardim Brasil, São Paulo - SP",
    materiais: ["Disjuntores, caixas de passagem"] },
  { buildingId: "b18", categoria: "Elétrica", nome: "Rossi Materiais de Construção", contatoTelefone: "(47) 3367-2788", endereco: "Av. dos Estados, 3325, Centro, Balneário Camboriú - SC",
    materiais: ["Módulo tomada/interruptor Pial, linha Nereya, cor branca"] },
  { buildingId: "b18", categoria: "Louças e Metais", nome: "Roca Sanitários Brasil", contatoNome: "Rafael", contatoTelefone: "(47) 9964-5579",
    materiais: ["Bacia sanitária modelo Debba Square com caixa acoplada"] },
  { buildingId: "b18", categoria: "Hidráulica", nome: "Docol Metais Sanitários Ltda", contatoTelefone: "0800 474 333", site: "www.docol.com.br",
    materiais: ["Registro de pressão 3/4\"", "Registro de gaveta 3/4\" e 2\"", "Válvula de retenção vertical 2.1/2\"", "Válvula de esfera"] },
  { buildingId: "b18", categoria: "Pintura", nome: "Protec Argamassas Especiais", contatoTelefone: "(47) 3308-9400", endereco: "Rua Else Mette, 199, Blumenau - SC",
    materiais: ["Textura projetada (churrasqueira e massa corrida)"] },
  { buildingId: "b18", categoria: "Hidráulica", nome: "LAO Indústrias", contatoTelefone: "(11) 3658-5200 / Fax (11) 3658-5219", notes: "Representante em SC: Marcelo Machado e Cia — (48) 3222-1889 (Luis Fernando)",
    materiais: ["Hidrômetros de 1\" e 3/4\", multijato, marca LAO"] },
  { buildingId: "b18", categoria: "Pintura", nome: "BASF SA", contatoNome: "Eduardo", contatoTelefone: "(48) 98414-5545", endereco: "Rua Cyro Correia Pereira, 2400, Curitiba - PR",
    materiais: ["Tinta interna Suvinil branca acrílico fosco premium", "Tinta fachada Suvinil emborrachada: Cinza asfalto, Elefante, Branco gelo", "Áreas comuns — térreo/hall aptos: Cascalho; Academia: Crômio, Cinza asfalto, Prata, Elefante; Salão de festa: Crômio, Cinza asfalto; Brinquedoteca: Veludo azul; Banheiro salão de festas: Pimenta síria; Banheiro academia: Veludo azul"] },
  { buildingId: "b18", categoria: "Rodapés", nome: "Engevil Soluções para Construção Civil", contatoNome: "Stephanie", contatoTelefone: "(47) 99155-6661",
    materiais: ["Rodapé 10cm"] },
  { buildingId: "b18", categoria: "Revestimentos", nome: "Ceramfix", contatoTelefone: "(47) 2102-0511",
    materiais: ["Argamassas e rejuntes branco"] },
  { buildingId: "b18", categoria: "Gesso", nome: "Novagesso Ltda", contatoTelefone: "(47) 3319-5220 / 9912-2751",
    materiais: ["Fornecimento e execução de tetos e rebaixos, placas 60x60cm em gesso"] },
  { buildingId: "b18", categoria: "Portões", nome: "MF Alarmes", contatoNome: "Miriam", contatoTelefone: "(47) 99985-0445",
    materiais: ["Instalação dos portões eletrônicos"] },
  { buildingId: "b18", categoria: "Cobertura", nome: "Rei das Calhas", contatoTelefone: "(47) 3348-2050", endereco: "R. José Pereira Liberato, 1063, São João, Itajaí - SC",
    materiais: ["Calhas e rufos em chapas de alumínio"] },
  { buildingId: "b18", categoria: "Sistemas de Incêndio", nome: "Sul Catarinense Representações", contatoTelefone: "(48) 8455-5158", endereco: "São José - SC",
    materiais: ["Extintor tipo PQSP 04kg", "Mangueiras de incêndio 1x20m e 2x15m"] },
  { buildingId: "b18", categoria: "Pisos", nome: "Wnil", contatoNome: "Wagner", contatoTelefone: "(47) 9754-8839", endereco: "Navegantes - SC",
    materiais: ["Instalação do piso vinílico"] },
  { buildingId: "b18", categoria: "Pisos", nome: "Hanley", contatoTelefone: "(51) 9173-1727",
    materiais: ["Piso vinílico 2mm, cor definida com o cliente"] },
  { buildingId: "b18", categoria: "Equipamentos", nome: "Malossinox", contatoNome: "Tita", contatoTelefone: "(47) 99231-7467",
    materiais: ["Louças do salão de festas: 30 pratos rasos, 30 pratos de sobremesa, 30 xícaras de chá, 30 facas de mesa, 30 garfos de mesa, 30 colheres de chá"] },
  { buildingId: "b18", categoria: "Vidros", nome: "Andriani Esquadrias de Alumínio", contatoNome: "Rai", contatoTelefone: "(47) 99206-2603",
    materiais: ["Pele de vidro da fachada frontal"] },
  { buildingId: "b18", categoria: "Equipamentos", nome: "Visual Piscinas", contatoNome: "William", contatoTelefone: "(47) 98498-0530",
    materiais: ["Infraestrutura para piscina aquecida"] },
  { buildingId: "b18", categoria: "Gás", nome: "Natural Gás", contatoNome: "Welington", contatoTelefone: "(47) 99696-0316",
    materiais: ["Infraestrutura de gás e medidores"] },
  { buildingId: "b18", categoria: "Marcenaria", nome: "Dell'a Rosa Marcenaria", contatoNome: "Andrey", contatoTelefone: "(47) 99712-5579",
    materiais: ["Marcenaria geral do empreendimento: salão de festas, brinquedoteca, academia, hall de entrada, hall de apartamentos"] },
];

/* Aplica IMPORT_FORNECEDORES_OBRAS em cima do state atual: nunca apaga/recria
   fornecedor existente, só cria o que falta e adiciona o vínculo de obra que
   ainda não existir — comparação de nome usa o mesmo critério de
   normalizeSupplierName (sem CNPJ nesta lista, então é só por nome). */
function importFornecedoresObras(state) {
  IMPORT_FORNECEDORES_OBRAS.forEach(row => {
    const rowPhone = normalizePhone(row.contatoTelefone);
    let supplier = rowPhone ? state.suppliers.find(s => supplierAllPhones(s).includes(rowPhone)) : null;
    if (!supplier) {
      const norm = normalizeSupplierName(row.nome);
      supplier = state.suppliers.find(s => normalizeSupplierName(supplierDisplayName(s)) === norm);
    }
    if (!supplier) {
      supplier = {
        id: "sup" + (state.supplierSeq++),
        ...blankSupplier(),
        nomeFantasia: row.nome,
        telefone: row.contatoTelefone || "",
        email: row.contatoEmail || "",
        endereco: row.endereco || "",
        site: row.site || "",
        notes: row.notes || "",
      };
      if (row.contatoNome) {
        supplier.contacts.push({ ...blankSupplierContact(), id: "sc" + Date.now() + Math.random().toString(36).slice(2, 6), nome: row.contatoNome, telefone: row.contatoTelefone || "" });
      }
      state.suppliers.push(supplier);
    }
    if (!supplier.specialties.includes(row.categoria)) supplier.specialties.push(row.categoria);
    if (!state.supplierSpecialties.includes(row.categoria)) state.supplierSpecialties.push(row.categoria);

    const alreadyLinked = supplier.buildings.some(b => b.buildingId === row.buildingId && b.categoria === row.categoria);
    if (!alreadyLinked) {
      supplier.buildings.push({
        ...blankSupplierBuildingLink(),
        id: "sb" + Date.now() + Math.random().toString(36).slice(2, 6),
        buildingId: row.buildingId,
        categoria: row.categoria,
        materiais: row.materiais || [],
        contatoNome: row.contatoNome || "",
        contatoTelefone: row.contatoTelefone || "",
        contatoEmail: row.contatoEmail || "",
      });
    }
  });
  return state;
}

/* ---------- Importação inicial de garantias e manutenção preventiva (manuais do proprietário) ---------- */
/* Mesmo princípio do IMPORT_FORNECEDORES_OBRAS acima: cada linha vem de um manual
   real, já revisada por humano antes de entrar aqui (nunca gerada/aprovada
   automaticamente pelo sistema). Roda de forma idempotente e aditiva — antes de
   adicionar, checa se aquele empreendimento+sistema+componente já tem uma linha
   com a mesma fonte e pula se já existir, então nunca duplica nem sobrescreve
   edição manual feita depois pela interface. */
const IMPORT_GARANTIAS_OBRAS = [];
const IMPORT_MANUTENCAO_OBRAS = [];

function importGarantiasObras(state) {
  IMPORT_GARANTIAS_OBRAS.forEach(row => {
    const exists = state.warrantyMatrix.some(r => r.buildingId === row.buildingId && r.sistema === row.sistema &&
      (r.componente || "") === (row.componente || "") && r.fonteTipo === row.fonteTipo && (r.fonteDocumento || "") === (row.fonteDocumento || ""));
    if (exists) return;
    state.warrantyMatrix.push({
      id: "g" + (state.warrantySeq++),
      buildingId: row.buildingId, sistema: row.sistema, componente: row.componente || "",
      prazoValor: row.prazoValor ?? "", prazoUnidade: row.prazoUnidade || "anos",
      fonteTipo: row.fonteTipo, fonteDocumento: row.fonteDocumento || "", fontePagina: row.fontePagina || "", fonteTrecho: row.fonteTrecho || "",
      inicioContagemCriterio: row.inicioContagemCriterio || "entrega_unidade", inicioContagemData: row.inicioContagemData || "",
      normasRelacionadas: row.normasRelacionadas || [], condicoes: row.condicoes || "", observacoes: row.observacoes || "",
    });
  });
  return state;
}

function importManutencaoObras(state) {
  IMPORT_MANUTENCAO_OBRAS.forEach(row => {
    const exists = state.maintenanceMatrix.some(r => r.buildingId === row.buildingId && r.sistema === row.sistema &&
      (r.componente || "") === (row.componente || "") && r.fonteTipo === row.fonteTipo && (r.fonteDocumento || "") === (row.fonteDocumento || ""));
    if (exists) return;
    state.maintenanceMatrix.push({
      id: "m" + (state.maintenanceSeq++),
      buildingId: row.buildingId, sistema: row.sistema, componente: row.componente || "",
      oQueVerificar: row.oQueVerificar || "", procedimento: row.procedimento || "", periodicidade: row.periodicidade || "",
      fonteTipo: row.fonteTipo, fonteDocumento: row.fonteDocumento || "", fontePagina: row.fontePagina || "", fonteTrecho: row.fonteTrecho || "",
      condicoes: row.condicoes || "", observacoes: row.observacoes || "",
    });
  });
  return state;
}

const RESPONSABILIDADE_OPTIONS = [
  "Em análise", "Construtora", "Condomínio", "Cliente", "Fornecedor", "Prestador",
  "Terceiro", "Improcedente", "Fora da garantia",
];

const ANEXO_ETAPAS = [
  { id: "solicitacao", label: "Solicitação" },
  { id: "vistoria", label: "Vistoria" },
  { id: "orcamento", label: "Orçamento" },
  { id: "execucao", label: "Execução" },
  { id: "resultado_final", label: "Resultado final" },
  { id: "outros", label: "Outros" },
];
/* Remapeamento das etapas antigas (8 valores) para as novas 6, usado na migração. */
const LEGACY_ANEXO_ETAPA_MAP = {
  problema: "solicitacao",
  vistoria: "vistoria",
  antes: "execucao",
  durante: "execucao",
  depois: "resultado_final",
  orcamento: "orcamento",
  laudo: "outros",
  documento: "outros",
};

const VALIDACAO_CLIENTE_OPTIONS = [
  { id: "", label: "—" },
  { id: "sim", label: "Cliente confirmou a solução" },
  { id: "nao", label: "Cliente não confirmou" },
  { id: "nao_respondeu", label: "Cliente não respondeu" },
];

/* ---------- Garantias ---------- */

const FONTE_TIPO_HIERARQUIA = [
  { id: "termo_especifico", label: "Termo de garantia específico do empreendimento", rank: 1 },
  { id: "manual", label: "Manual do Proprietário", rank: 2 },
  { id: "condicoes_construtora", label: "Condições gerais de garantia da construtora", rank: 3 },
  { id: "norma_tecnica", label: "Norma técnica (referência)", rank: 4 },
  { id: "fabricante", label: "Garantia do fabricante", rank: 5 },
  { id: "legislacao", label: "Legislação aplicável", rank: 6 },
];
const FONTE_TIPO_MAP = Object.fromEntries(FONTE_TIPO_HIERARQUIA.map(f => [f.id, f]));

const NORMAS_TECNICAS = ["ABNT NBR 15575", "ABNT NBR 17170", "ABNT NBR 14037", "ABNT NBR 5674"];

const INICIO_CONTAGEM_OPTIONS = [
  { id: "entrega_unidade", label: "Entrega da unidade" },
  { id: "entrega_empreendimento", label: "Entrega do empreendimento" },
  { id: "data_especifica", label: "Data específica" },
];

const GARANTIA_STATUS = {
  dentro: { icon: "🟢", label: "Dentro do prazo de garantia" },
  proximo: { icon: "🟡", label: "Próximo do término" },
  expirado: { icon: "🔴", label: "Prazo de garantia expirado" },
  depende_analise: { icon: "⚠️", label: "Garantia depende de análise técnica" },
  possivel_exclusao: { icon: "⚠️", label: "Possível exclusão de garantia" },
  nao_identificado: { icon: "❓", label: "Prazo não identificado" },
  divergencia: { icon: "❗", label: "Divergência entre documentos" },
};

/* Mapa simples de palavras-chave (local/ambiente) -> categorias possivelmente
   relacionadas, usado só como sugestão de preenchimento (item 6.9 do sistema de
   garantias). Não decide nada sozinho. */
const LOCAL_SUGESTAO_MAP = {
  "sacada": ["Impermeabilização", "Esquadrias", "Fachada", "Revestimentos"],
  "varanda": ["Impermeabilização", "Esquadrias", "Fachada", "Revestimentos"],
  "banheiro": ["Hidráulica", "Impermeabilização", "Louças e Metais", "Revestimentos"],
  "cozinha": ["Hidráulica", "Elétrica", "Revestimentos", "Louças e Metais"],
  "fachada": ["Fachada", "Impermeabilização", "Pintura"],
  "elevador": ["Elétrica", "Equipamentos"],
  "portão": ["Elétrica", "Equipamentos"],
  "portaria": ["Elétrica", "Equipamentos"],
  "casa de bombas": ["Hidráulica", "Elétrica", "Equipamentos"],
  "casa de máquinas": ["Elétrica", "Equipamentos", "Climatização"],
  "piscina": ["Hidráulica", "Impermeabilização", "Elétrica", "Equipamentos"],
  "academia": ["Elétrica", "Climatização", "Equipamentos"],
  "área comum": ["Elétrica", "Revestimentos", "Equipamentos"],
  "garagem": ["Estrutural", "Impermeabilização", "Elétrica"],
  "vaga": ["Estrutural", "Impermeabilização"],
};

/* ---------- Modificações de apartamento ---------- */

/* Lista editável (mesmo padrão de DEFAULT_SUPPLIER_SPECIALTIES) — não é um enum
   fechado, a tela permite adicionar categoria nova. */
const DEFAULT_MODIFICATION_CATEGORIES = ["Alvenaria", "Elétrica", "Hidráulica", "Contrapiso", "Luminotécnico", "Gesso", "Revestimentos", "Pintura"];

const MODIFICATION_STATUS = [
  { id: "solicitacao_recebida", label: "Solicitação recebida", icon: "🟡" },
  { id: "em_analise", label: "Em análise", icon: "🔵" },
  { id: "em_orcamento", label: "Em orçamento", icon: "🟣" },
  { id: "aguardando_aprovacao", label: "Aguardando aprovação", icon: "🟠" },
  { id: "aprovada", label: "Aprovada", icon: "🟢" },
  { id: "liberada_obra", label: "Liberada para obra", icon: "🟣" },
  { id: "recebida_obra", label: "Recebida pela obra", icon: "🟡" },
  { id: "em_execucao", label: "Em execução", icon: "🟠" },
  { id: "executada", label: "Executada", icon: "🟢" },
  { id: "aguardando_conferencia", label: "Aguardando conferência", icon: "🔵" },
  { id: "conferida", label: "Conferida", icon: "🟢" },
  { id: "nao_conforme", label: "Não conforme", icon: "⚠️" },
  { id: "finalizada", label: "Finalizada", icon: "✅" },
  { id: "nao_viavel", label: "Não viável", icon: "❌" },
  { id: "recusada_cliente", label: "Recusada pelo cliente", icon: "❌" },
  { id: "cancelada", label: "Cancelada", icon: "⚫" },
];
const MODIFICATION_STATUS_MAP = Object.fromEntries(MODIFICATION_STATUS.map(s => [s.id, s]));
const MODIFICATION_CLOSED_STATUSES = ["finalizada", "nao_viavel", "recusada_cliente", "cancelada"];
/* Diferente de MODIFICATION_CLOSED_STATUSES: usado só pelo Mapa de Modificações
   pra decidir se uma modificação "conta" como alteração real da unidade — uma
   modificação finalizada continua contando (a unidade foi de fato alterada),
   só as 3 abaixo representam "não aconteceu". */
const MODIFICATION_NEGATIVE_STATUSES = ["cancelada", "nao_viavel", "recusada_cliente"];

/* Itens específicos do Mapa de Modificações — diferente de MODIFICATION_CATEGORIES
   (que organiza o processo internamente). Uma modificação pode afetar vários
   itens do mapa mesmo tendo uma categoria só. Lista editável, mesmo padrão de
   DEFAULT_MODIFICATION_CATEGORIES. */
const DEFAULT_MAP_ITEMS = ["Alvenaria", "Contrapiso", "Elétrica", "Hidráulica", "Split", "Gás/Coifa", "Luminotécnico", "Porcelanato", "Vinílico", "Nicho", "Forro", "Tinta", "Portas", "Rodapé", "Fechadura", "Integração de Sacada"];

/* Tipos especiais de modificação — configuração central, não lógica espalhada
   pela interface. Cada tipo pode pré-preencher itens/abrangência na criação e
   exigir um documento específico antes de permitir finalizar. Novo tipo =
   nova entrada aqui, não uma nova tela. */
const MODIFICATION_TIPOS_ESPECIAIS = {
  integracao_sacada: {
    label: "Integração de Sacada",
    itensMapaPreSelecionados: ["Integração de Sacada"],
    abrangenciaPreSet: { tipo: "especifico", ambientes: ["Sacada"] },
    documentoObrigatorio: { tipo: "termo_integracao_sacada", label: "Termo de concordância de integração de sacada" },
  },
};

/* Categoria técnica interna, derivada automaticamente do(s) item(ns) do mapa
   marcados — nunca mais perguntada ao usuário (era redundante com "O que será
   modificado?"). Item sem mapeamento direto vira sua própria categoria, em vez
   de forçar um encaixe errado em uma das 8 categorias existentes. */
const MAP_ITEM_TO_CATEGORIA = {
  "Alvenaria": "Alvenaria", "Contrapiso": "Contrapiso", "Elétrica": "Elétrica", "Hidráulica": "Hidráulica",
  "Luminotécnico": "Luminotécnico", "Tinta": "Pintura",
  "Porcelanato": "Revestimentos", "Vinílico": "Revestimentos", "Nicho": "Revestimentos", "Rodapé": "Revestimentos",
  "Forro": "Gesso", "Split": "Elétrica", "Gás/Coifa": "Hidráulica",
};

/* Lista fixa de ambientes pra "Abrangência da modificação" — editável, mesmo
   padrão das outras listas de negócio deste módulo. */
const DEFAULT_MODIFICATION_AMBIENTES = ["Sala", "Cozinha", "Área de serviço", "Suíte", "Quarto 2", "Quarto 3", "Banheiro suíte", "Banheiro social", "Lavabo", "Sacada", "Outro"];

const MAPA_STATUS = {
  nao_vendido: { label: "NÃO VENDIDO" },
  modificado: { label: "MODIFICADO" },
  aguardar: { label: "AGUARDAR" },
  padrao: { label: "PADRÃO" },
};

const VIABILIDADE_OPTIONS = [
  { id: "viavel", label: "Viável" },
  { id: "viavel_ressalva", label: "Viável com ressalva" },
  { id: "nao_viavel", label: "Não viável" },
];

const DESTINO_CREDITO_OPTIONS = [
  { id: "usar_na_modificacao", label: "Usar na própria modificação" },
  { id: "abater_parcela", label: "Abater na parcela do apartamento" },
];

/* Status de cada VERSÃO de orçamento — a assinatura do termo é a aprovação,
   não existe uma ação manual separada de "marcar como aprovado". */
const ORCAMENTO_VERSAO_STATUS = {
  pronto_aprovacao: "Pronto para aprovação",
  aguardando_assinatura: "Aguardando assinatura",
  aprovado: "Aprovado",
  reprovado: "Reprovado/Cancelado",
};


function blankViabilidade() { return { status: "", observacao: "", analisadoPor: "", data: "" }; }
function blankAprovacaoCliente() { return { data: "", versaoAprovada: "", responsavel: "", observacao: "", evidenciaAttachmentId: "" }; }
function blankFinanceiroModificacao() { return { status: "", dataEnvio: "", enviadoPor: "", valorEnviado: null, condicaoPagamento: "", observacoes: "" }; }
function blankObraModificacao() {
  return {
    liberada: { data: "", usuario: "", versaoProjeto: "" },
    recebida: { data: "", responsavel: "" },
    execucao: { data: "" },
  };
}
function blankConferencia() { return { resultado: "", data: "", responsavel: "", observacao: "" }; }

function blankModification() {
  return {
    id: "", code: "",
    buildingId: "", unit: "", clientId: "",
    dataSolicitacao: "", recebidoPor: "",
    solicitacaoTexto: "", abrangencia: { tipo: "", ambientes: [] }, categorias: [],
    tipoEspecial: "",
    viabilidade: blankViabilidade(),
    projeto: { versoes: [], versaoAprovadaId: "" },
    orcamento: { versoes: [], versaoAprovadaId: "" },
    aprovacaoCliente: blankAprovacaoCliente(),
    destinoCredito: "",
    itensMapa: [],
    documentos: [],
    financeiro: blankFinanceiroModificacao(),
    obra: blankObraModificacao(),
    conferencia: blankConferencia(),
    naoConformidades: [],
    status: "solicitacao_recebida",
    history: [],
  };
}

/* Defensiva, mesmo estilo de migrateTicket — nunca apaga dado existente, só
   garante que blocos aninhados novos existam em registros salvos antes deles.
   m.retrabalho (removido do fluxo novo) é preservado em registros antigos que
   já o tinham, sem ser recriado nem lido por nada daqui em diante. */
function migrateModification(m) {
  if (!m.viabilidade) m.viabilidade = blankViabilidade();
  if (m.viabilidade.observacao === undefined) m.viabilidade.observacao = m.viabilidade.justificativa || "";
  if (m.viabilidade.status === "viavel_custo" || m.viabilidade.status === "viavel_retrabalho") m.viabilidade.status = "viavel_ressalva";
  if (!m.tipoEspecial) m.tipoEspecial = "";
  if (!m.documentos) m.documentos = [];
  if (!m.projeto) m.projeto = { versoes: [], versaoAprovadaId: "" };
  if (!m.orcamento) m.orcamento = { versoes: [], versaoAprovadaId: "" };
  m.orcamento.versoes.forEach(v => {
    if (!v.status) v.status = m.orcamento.versaoAprovadaId === v.id ? "aprovado" : "pronto_aprovacao";
  });
  if (!m.aprovacaoCliente) m.aprovacaoCliente = blankAprovacaoCliente();
  if (!m.financeiro) m.financeiro = blankFinanceiroModificacao();
  if (!m.obra) m.obra = blankObraModificacao();
  if (m.obra.execucao && m.obra.execucao.data === undefined) {
    m.obra.execucao.data = m.obra.execucao.dataFim || m.obra.execucao.dataInicio || "";
  }
  if (!m.conferencia) m.conferencia = blankConferencia();
  if (!m.naoConformidades) m.naoConformidades = [];
  if (!m.categorias) m.categorias = [];
  if (!m.itensMapa) m.itensMapa = [];
  /* Migração não destrutiva: "ambiente" (texto livre antigo) nunca é apagado,
     só deixa de ser usado — a partir daqui a informação estruturada é
     m.abrangencia. Registro antigo com texto vira "específico" com aquele
     texto como único ambiente, preservado como estava, mesmo que não bata
     com nenhuma opção da lista atual. */
  if (!m.abrangencia) {
    m.abrangencia = m.ambiente ? { tipo: "especifico", ambientes: [m.ambiente] } : { tipo: "", ambientes: [] };
  }
  if (!m.history) m.history = [];
  return m;
}

/* ---------- Empreendimentos reais da carteira SBJ ---------- */
/* Nomes extraídos dos arquivos em "Clientes SBJ"; 1-20 concluídos, 21-25 em andamento. */

const BUILDING_NAMES = [
  "Residencial Ilha do Arvoredo",
  "Residencial Ilha dos Açores",
  "Residencial Ilha Bela",
  "Residencial Ilha da Madeira",
  "Residencial Ilha de Bali",
  "Residencial Ilha de Paquetá",
  "Residencial Ilhas Gregas",
  "Residencial Ilha de Santorini",
  "Residencial Ilha de Itaparica",
  "Residencial Ilha dos Amores",
  "Residencial Ilha de Saint Martin",
  "Residencial Ilha de Patmos",
  "Residencial Ilha de Mykonos",
  "Residencial Ilha de Maiorca",
  "Residencial Ilha de Manhattan",
  "Residencial Ilha de Vancouver",
  "Residencial Ilha de Maui",
  "Residencial Ilha de San Andrés",
  "Residencial Ilha de Malta",
  "Residencial Ilha de Ibiza",
  "Residencial Ilha do Campeche",
  "Residencial Ilha de Tenerife",
  "Residencial Ilha de San Blas",
  "Residencial Ilha de Capri",
  "Residencial Ilha de Cozumel",
];

/* ---------- Seed inicial (editável pelo usuário) ---------- */

/* Empreendimentos cujo Manual do Proprietário foi lido e é utilizável como fonte
   de garantia (Round 4). Os demais — sem arquivo, ou com arquivo ilegível/incompleto
   (Maiorca escaneado sem OCR, Patmos só com 1 prancha hidráulica) — dependem da
   base normativa até um manual válido ser anexado. Isto é só metadado factual
   sobre qual arquivo existe, não uma classificação de qualidade construtiva. */
const BUILDINGS_COM_MANUAL_UTILIZAVEL = [5, 6, 7, 8, 9, 10, 11, 13, 15, 16, 17, 18, 19, 20, 21];

function buildSeedData() {
  const buildings = [];
  const clients = [];
  let clientSeq = 1;

  for (let i = 1; i <= 25; i++) {
    const buildingId = "b" + i;
    const roster = (typeof CLIENTS_BY_BUILDING !== "undefined" && CLIENTS_BY_BUILDING[i - 1]) || [];
    buildings.push({
      id: buildingId,
      name: BUILDING_NAMES[i - 1] || ("Residencial " + String(i).padStart(2, "0")),
      address: "",
      status: i <= 20 ? "concluido" : "andamento",
      units: roster.length,
      deliveryDate: "",
      responsible: "",
      progress: i <= 20 ? 100 : 0,
      ambientesPorLocal: {},
      sindico: null,
      sindicoHistorico: [],
      administradora: null,
      possuiManual: BUILDINGS_COM_MANUAL_UTILIZAVEL.includes(i),
    });
    roster.forEach(r => {
      clients.push({
        id: "c" + clientSeq++,
        buildingId,
        unit: r.unit || "",
        garage: r.garage || "",
        name: r.name || "",
        phone: r.phone || "",
        email: r.email || "",
        escritura: r.escritura || "",
        notes: "",
      });
    });
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    buildings, clients, clientSeq,
    tickets: [], ticketSeq: 1,
    warrantyMatrix: [], warrantySeq: 1,
    maintenanceMatrix: [], maintenanceSeq: 1,
    modifications: [], modificationSeq: 1,
    priceTable: [], priceTableSeq: 1,
    creditTable: [], creditTableSeq: 1,
    modificationCategories: [...DEFAULT_MODIFICATION_CATEGORIES],
    mapItems: [...DEFAULT_MAP_ITEMS],
    modificationAmbientes: [...DEFAULT_MODIFICATION_AMBIENTES],
    mapaPendencias: [], mapaPendenciaSeq: 1,
    teamInternal: ["Flávia", "Giovanna"],
    teamNextAction: ["Alexandre", "Matheus"],
    teamEtapas: ["Flávia", "Giovanna", "Alexandre", "Matheus"],
    suppliers: [], supplierSeq: 1,
    supplierSpecialties: [...DEFAULT_SUPPLIER_SPECIALTIES],
  };
}

/* ---------- Migração de schema ---------- */
/* Nunca apaga buildings/clients. Só adiciona campos novos com valores em branco
   e traduz o status antigo (6 valores) para o novo (14 valores). */

const LEGACY_STATUS_MAP = {
  aberto: "novo",
  em_analise: "em_analise",
  em_andamento: "em_execucao",
  aguardando: "aguardando_fornecedor",
  concluido: "concluido",
  cancelado: "cancelado",
};

function blankAnaliseTecnica() {
  return { problemaRelatado: "", constatacao: "", causaProvavel: "", causaConfirmada: "", responsabilidade: "", solucaoProposta: "", solucaoExecutada: "", observacoes: "" };
}
function blankFornecedor() {
  return { nome: "", contato: "", servico: "", dataAcionamento: "", prazoInformado: "", dataAgendada: "", dataExecutada: "" };
}
function blankEncerramento() {
  return {
    solucaoRegistrada: "", dataExecucao: "", responsavelExecucao: "", observacaoFinal: "", validacaoCliente: "",
    /* Campos da resolução em cards (item 22+). Chamados encerrados antes dessa
       mudança não têm resultadoTipo — a tela detecta isso e mostra o resumo
       antigo (solucaoRegistrada/dataExecucao/...) sem precisar migrar nada. */
    resultadoTipo: "", comoResolvido: "", comoResolvidoOutro: "",
    clienteConfirmou: "", clienteInformado: "",
    motivoParcial: "", motivoNaoSolucionado: "", motivoImprocedente: "", motivoSemNecessidade: "",
    /* Diagnóstico confirmado no encerramento ("reparo concluído"): o sistema
       informado na abertura (t.category) era mesmo o problema? sistemaConfirmado
       = "sim" | "nao". sistemaReal e causaReal alimentam o relatório de
       Engenharia. Chamados antigos não têm isso — ticketSistema() cai em t.category. */
    sistemaConfirmado: "", sistemaReal: "", causaReal: "",
  };
}

/* Sistema que vale para relatórios, reincidência e garantia: o real (confirmado
   ao encerrar) quando existe, senão o informado na abertura. */
function ticketSistema(t) {
  return (t && t.encerramento && t.encerramento.sistemaReal) || (t && t.category) || "Outros";
}
function ticketCausaReal(t) {
  return ((t && t.encerramento && t.encerramento.causaReal) || "").trim();
}
/* Chave p/ agrupar causas escritas de jeitos diferentes ("Falta de vedação" = "falta de vedacao "). */
function causaChave(texto) {
  return String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

const COMO_RESOLVIDO_OPTIONS = [
  { id: "ajuste", label: "Ajuste / regulagem" },
  { id: "reparo_executado", label: "Reparo executado" },
  { id: "substituicao", label: "Substituição" },
  { id: "limpeza", label: "Limpeza" },
  { id: "reexecucao", label: "Reexecução do serviço" },
  { id: "outro", label: "Outro" },
];
const MOTIVOS_NAO_SOLUCIONADO = [
  "Problema persiste", "Necessário novo reparo", "Necessário outro fornecedor",
  "Necessária nova vistoria", "Aguardando material", "Aguardando condomínio", "Outro",
];
const MOTIVOS_IMPROCEDENTE = [
  "Não identificado no local", "Uso / manutenção do usuário", "Característica do produto",
  "Sem evidência do problema", "Fora das condições de atendimento", "Outro",
];
const MOTIVOS_SEM_NECESSIDADE = [
  "Orientação ao cliente", "Ajuste não necessário", "Funcionamento normal", "Problema não reproduzido", "Outro",
];

/* ---------- Plano de Atendimento: Atividade -> Execuções ---------- */
/* Uma ATIVIDADE é o que precisa ser feito (ex.: "Realizar reparo"). Ela pode ter
   zero, uma ou várias EXECUÇÕES — cada tentativa/visita programada, com sua
   própria data/horário/resultado. Isso existe pra separar "a atividade ainda
   precisa acontecer" de "essa data específica não aconteceu, mas a atividade
   pode ter outra execução resolvendo ela depois" — ver atividadeStatus() em
   js/tickets.js, que é quem decide o que aparece na tela a partir disso.
   Não confundir com anexo.etapa/ANEXO_ETAPAS acima, que é só a categoria fixa
   de anexo (solicitação/vistoria/orçamento/...) — coisa totalmente diferente.
   Por isso o array continua em ticket.plano, não ticket.atividades. */
function blankExecucao() {
  return {
    id: "", data: "", horario: "",
    resultado: "pendente", // "pendente" | "realizada" | "nao_realizada"
    /* dataConclusao = quando o serviço REALMENTE aconteceu (só preenchida quando
       resultado !== "pendente", editável na hora de dar baixa). registradoEm =
       quando essa informação foi lançada no sistema (sempre automática, nunca
       editável) — nunca a mesma coisa quando o lançamento é retroativo. */
    dataConclusao: "", registradoEm: "",
    observacao: "", // nota dessa execução específica (motivo de não realizada, ou o que foi feito)
  };
}
function blankAtividade() {
  return {
    id: "", nome: "", tipo: "acao", // "acao" | "execucao"
    responsavel: "", supplierId: "",
    acessoUnidade: "nao", clientePresente: "nao", // "sim" | "nao"
    observacoes: "", // instrução geral da atividade — não muda de uma execução pra outra
    cancelada: false,
    execucoes: [], // blankExecucao()[]
  };
}
const ETAPA_STATUS = {
  a_agendar: { icon: "⚪", label: "A agendar" },
  agendada: { icon: "🔵", label: "Agendada" },
  concluida: { icon: "🟢", label: "Concluída" },
  nao_realizada: { icon: "🔴", label: "Não realizada" },
  cancelada: { icon: "⚫", label: "Cancelada" },
  /* Nunca gravado em atividade.status (não existe esse campo) — é a chave de
     exibição que atividadeStatus()/execucaoEffectiveStatus() devolvem quando a
     ÚLTIMA execução pendente (já considera reagendamento) venceu sem que
     exista outra execução futura resolvendo. Ver js/tickets.js. */
  atrasada: { icon: "🔴", label: "Atrasada" },
};
/* Sugestões prontas pro campo "Nome da etapa" (datalist) — não é uma lista fechada,
   o campo continua sendo texto livre. */
const ETAPA_NOME_SUGESTOES = [
  "Realizar vistoria", "Realizar reparo", "Solicitar orçamento", "Acionar fornecedor", "Aguardar fornecedor",
  "Retornar cliente", "Cobrar fornecedor", "Aguardar condomínio", "Identificação da origem", "Teste", "Acabamento",
  "Conferência", "Conferir reparo", "Finalização", "Finalizar atendimento",
];

function migrateTicket(t) {
  const knownStatusIds = TICKET_STATUS.map(s => s.id);
  if (!knownStatusIds.includes(t.status)) {
    t.status = LEGACY_STATUS_MAP[t.status] || "novo";
  }
  if (t.priority === "urgente") t.priority = "critica";

  if (t.type === undefined) t.type = "posvenda";
  if (t.clientId === undefined) t.clientId = "";
  if (t.origemSolicitacao === undefined) t.origemSolicitacao = "Cliente";
  if (t.subcategory === undefined) t.subcategory = "";
  if (t.local === undefined) t.local = "";
  if (t.ambiente === undefined) t.ambiente = "";
  if (t.title === undefined) t.title = t.title || "";

  if (t.responsavelInterno === undefined) t.responsavelInterno = "";
  if (t.clienteAguardando === undefined) t.clienteAguardando = null;
  if (t.outrosDescricao === undefined) t.outrosDescricao = "";
  if (t.responsavelProximaAcao === undefined) t.responsavelProximaAcao = "";
  if (t.proximaAcao === undefined) t.proximaAcao = "";
  if (t.dataLimiteProximaAcao === undefined) t.dataLimiteProximaAcao = t.dueDate ? t.dueDate : "";
  if (t.localTipo === undefined) t.localTipo = "";
  if (t.ambienteDetalhe === undefined) t.ambienteDetalhe = t.ambiente || t.local || "";
  if (!t.ambientes) t.ambientes = t.ambienteDetalhe ? [t.ambienteDetalhe] : [];
  if (t.material === undefined) t.material = "";
  if (t.elemento === undefined) t.elemento = "";
  if (t.dataAcompanhamento === undefined) t.dataAcompanhamento = t.dataLimiteProximaAcao || "";
  if (t.dataUltimaAcao === undefined) {
    t.dataUltimaAcao = (t.history && t.history.length) ? t.history[t.history.length - 1].date.slice(0, 10) : "";
  }
  if (t.dataUltimaCobranca === undefined) t.dataUltimaCobranca = "";
  if (t.proximaCobranca === undefined) t.proximaCobranca = "";

  if (!t.analiseTecnica) t.analiseTecnica = blankAnaliseTecnica();
  if (t.analiseTecnica.observacoes === undefined) t.analiseTecnica.observacoes = "";
  if (!t.fornecedor) t.fornecedor = blankFornecedor();
  if (!t.fornecedores) t.fornecedores = [];
  if (!t.encerramento) t.encerramento = blankEncerramento();
  if (!t.plano) t.plano = [];
  /* Etapa antiga (uma só data/status/resultado) -> atividade com 1 execução
     (ou zero, se nunca teve data nem foi resolvida — não inventa execução à
     toa). Idempotente: um item que já tem "execucoes" não é tocado de novo.
     Nada é apagado, cada campo antigo ganha um lugar novo:
       status "concluida"      -> execução resultado "realizada"
       status "nao_realizada"  -> execução resultado "nao_realizada"
       qualquer outro status   -> execução resultado "pendente"
       status "cancelada"      -> atividade.cancelada = true
       data/horario/dataConclusao/registradoEm -> viram campos da execução
       resultado (texto livre antigo)          -> vira execucao.observacao */
  t.plano = t.plano.map(item => {
    if (item.execucoes) return item;
    const resultado = item.status === "concluida" ? "realizada"
      : item.status === "nao_realizada" ? "nao_realizada"
      : "pendente";
    const temInformacaoReal = !!item.data || resultado !== "pendente";
    const execucoes = temInformacaoReal ? [{
      id: "exec" + (item.id || (Date.now() + Math.random().toString(36).slice(2, 6))),
      data: item.data || "", horario: item.horario || "",
      resultado,
      dataConclusao: item.dataConclusao || "", registradoEm: item.registradoEm || "",
      observacao: item.resultado || "",
    }] : [];
    return {
      id: item.id, nome: item.nome, tipo: item.tipo || "acao",
      responsavel: item.responsavel || "", supplierId: item.supplierId || "",
      acessoUnidade: item.acessoUnidade || "nao", clientePresente: item.clientePresente || "nao",
      observacoes: item.observacoes || "",
      cancelada: item.status === "cancelada",
      execucoes,
    };
  });
  if (!t.anexos) t.anexos = [];
  if (!t.relatorios) t.relatorios = [];
  t.anexos.forEach(a => { if (LEGACY_ANEXO_ETAPA_MAP[a.etapa]) a.etapa = LEGACY_ANEXO_ETAPA_MAP[a.etapa]; });
  /* Fotos passam a ser só "inicial"/"final", ligadas ao chamado (não à etapa).
     Nada é apagado — só calcula o momento a partir do que já existia, uma vez,
     pra alimentar a nova tela de Fotos sem perder nenhum anexo antigo. */
  t.anexos.forEach(a => {
    if (a.momento !== undefined) return;
    if (a.planoItemId) {
      const atividade = t.plano.find(e => e.id === a.planoItemId);
      const teveExecucaoRealizada = atividade && (atividade.execucoes || []).some(ex => ex.resultado === "realizada");
      a.momento = (atividade && atividade.tipo === "execucao" && teveExecucaoRealizada) ? "final" : "inicial";
    } else if (["execucao", "resultado_final"].includes(a.etapa)) {
      a.momento = "final";
    } else {
      a.momento = "inicial";
    }
  });
  if (t.descricaoSolicitacao === undefined) t.descricaoSolicitacao = t.analiseTecnica.problemaRelatado || t.description || "";

  if (!t.history) t.history = [];
  t.history = t.history.map(h => ({
    date: h.date,
    user: h.user || h.author || "Sistema",
    action: h.action || (h.status ? "Status alterado" : "Atualização"),
    note: h.note || "",
    statusFrom: h.statusFrom !== undefined ? h.statusFrom : "",
    statusTo: h.statusTo !== undefined ? h.statusTo : (h.status || ""),
  }));

  return t;
}

function blankSindicoHistEntry(sindico, dataFim) {
  return { ...sindico, dataFim };
}

function migrateBuilding(b) {
  if (!b.ambientesPorLocal) b.ambientesPorLocal = {};
  if (b.sindico === undefined) b.sindico = null;
  if (!b.sindicoHistorico) b.sindicoHistorico = [];
  if (b.administradora === undefined) b.administradora = null;
  if (b.possuiManual === undefined) b.possuiManual = null;
  if (!b.anotacoes) b.anotacoes = [];
  return b;
}

/* v7: buildingIds (lista solta de IDs) vira buildings[] (relação estruturada
   com categoria/materiais/contato por obra). Nenhum vínculo existente se perde,
   só passa a ter campos extras em branco até serem preenchidos. */
function migrateSupplier(s) {
  if (!s.buildings) s.buildings = [];
  if (s.buildingIds) {
    s.buildingIds.forEach(buildingId => {
      if (!s.buildings.some(b => b.buildingId === buildingId)) {
        s.buildings.push({ ...blankSupplierBuildingLink(), id: "sb" + Date.now() + Math.random().toString(36).slice(2, 6), buildingId });
      }
    });
    delete s.buildingIds;
  }
  s.buildings.forEach(b => { if (b.participacao === undefined) b.participacao = ""; });
  return s;
}

/* Todos os passos abaixo são idempotentes (só preenchem o que estiver faltando),
   então rodam sempre a cada load — não dependem de "só rodar uma vez na versão X" -
   isso evita o bug de campo novo não chegar em quem já estava numa versão intermediária. */
function migrateData(state) {
  state.tickets = (state.tickets || []).map(migrateTicket);
  state.ticketSeq = state.ticketSeq || (state.tickets.length + 1);
  if (!state.vistorias) state.vistorias = [];
  if (!state.warrantyMatrix) state.warrantyMatrix = [];
  if (!state.warrantySeq) state.warrantySeq = 1;
  if (!state.maintenanceMatrix) state.maintenanceMatrix = [];
  if (!state.maintenanceSeq) state.maintenanceSeq = 1;
  if (!state.modifications) state.modifications = [];
  if (!state.modificationSeq) state.modificationSeq = 1;
  if (!state.priceTable) state.priceTable = [];
  if (!state.priceTableSeq) state.priceTableSeq = 1;
  if (!state.creditTable) state.creditTable = [];
  if (!state.creditTableSeq) state.creditTableSeq = 1;
  if (!state.modificationCategories) state.modificationCategories = [...DEFAULT_MODIFICATION_CATEGORIES];
  if (!state.mapItems) state.mapItems = [...DEFAULT_MAP_ITEMS];
  if (!state.modificationAmbientes) state.modificationAmbientes = [...DEFAULT_MODIFICATION_AMBIENTES];
  if (!state.mapaPendencias) state.mapaPendencias = [];
  if (!state.mapaPendenciaSeq) state.mapaPendenciaSeq = 1;
  state.modifications.forEach(migrateModification);
  if (!state.clients) state.clients = [];
  if (!state.clientSeq) state.clientSeq = state.clients.length + 1;

  if (!state.teamInternal) state.teamInternal = ["Flávia", "Giovanna"];
  if (!state.teamNextAction) state.teamNextAction = ["Alexandre", "Matheus"];
  if (!state.teamEtapas) {
    state.teamEtapas = [...new Set([...state.teamInternal, ...state.teamNextAction])];
  }
  state.tickets.forEach(t => {
    if (t.responsavelInterno && !state.teamInternal.includes(t.responsavelInterno)) state.teamInternal.push(t.responsavelInterno);
    if (t.responsavelProximaAcao && !state.teamNextAction.includes(t.responsavelProximaAcao)) state.teamNextAction.push(t.responsavelProximaAcao);
    (t.plano || []).forEach(e => {
      if (e.responsavel && !state.teamEtapas.includes(e.responsavel)) state.teamEtapas.push(e.responsavel);
    });
  });

  state.buildings = (state.buildings || []).map(migrateBuilding);

  if (!state.suppliers) state.suppliers = [];
  if (!state.supplierSeq) state.supplierSeq = 1;
  if (!state.supplierSpecialties) state.supplierSpecialties = [...DEFAULT_SUPPLIER_SPECIALTIES];
  state.suppliers = state.suppliers.map(migrateSupplier);
  importFornecedoresObras(state);
  importGarantiasObras(state);
  importManutencaoObras(state);

  /* Consolida fornecedores digitados soltos em cada chamado (t.fornecedor.nome) num
     cadastro mestre único por nome, vinculando o chamado a ele. Roda uma vez por
     chamado (marcado com _fornecedorMigrated) para não duplicar se o vínculo novo
     for removido manualmente depois. */
  state.tickets.forEach(t => {
    if (t._fornecedorMigrated) return;
    const nome = (t.fornecedor && t.fornecedor.nome || "").trim();
    if (nome) {
      let supplier = state.suppliers.find(s => supplierDisplayName(s).toLowerCase() === nome.toLowerCase());
      if (!supplier) {
        supplier = { id: "sup" + (state.supplierSeq++), ...blankSupplier(), nomeFantasia: nome };
        state.suppliers.push(supplier);
      }
      t.fornecedores.push({
        id: "tf" + Date.now() + Math.random().toString(36).slice(2, 6),
        supplierId: supplier.id,
        servico: t.fornecedor.servico || "",
        dataAcionamento: t.fornecedor.dataAcionamento || "",
        prazoInformado: t.fornecedor.prazoInformado || "",
        dataAgendada: t.fornecedor.dataAgendada || "",
        dataExecutada: t.fornecedor.dataExecutada || "",
        principal: true,
      });
    }
    t._fornecedorMigrated = true;
  });

  state.schemaVersion = SCHEMA_VERSION;
  return state;
}

/* ---------- Persistência ---------- */

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = buildSeedData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw);
    const migrated = migrateData(parsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch (e) {
    const seeded = buildSeedData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
