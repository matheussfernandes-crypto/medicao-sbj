import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  UserCheck,
  Building2,
  Briefcase,
  Users,
  ClipboardList,
  Wallet,
  FileCheck2,
  BarChart3,
  History,
  HardHat,
  Wrench,
  FilePlus2,
  ListChecks,
  CalendarClock,
  Archive,
  FileBarChart2,
  Tags,
  Handshake,
  ClipboardPen,
  CheckCheck,
  FileSpreadsheet,
  Layers,
  Home,
  Coins,
  Settings,
} from "lucide-react";

// Setores do menu (coluna de ícones, no estilo do Sienge). Cada item de navegação pertence a um setor e a um grupo dentro dele.
export type SecaoId = "inicio" | "obras" | "medicoes" | "contratos" | "manutencoes" | "financeiro" | "admin";

export type Secao = {
  id: SecaoId;
  label: string;
  icon: LucideIcon;
  href?: string; // setor sem painel: o ícone leva direto à página (ex.: Início)
};

export const SECOES: Secao[] = [
  { id: "inicio", label: "Início", icon: Home, href: "/dashboard" },
  { id: "obras", label: "Obras", icon: HardHat },
  { id: "medicoes", label: "Medições e Vales", icon: ClipboardList },
  { id: "contratos", label: "Contratos", icon: Handshake },
  { id: "manutencoes", label: "Manutenções", icon: Wrench },
  { id: "financeiro", label: "Financeiro", icon: Coins },
  { id: "admin", label: "Administração", icon: Settings },
];

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  secao: SecaoId; // setor do menu
  grupo: string; // grupo dentro do setor
  allowedSetores?: string[]; // undefined = todos os setores aprovados
  badgeKey?: "contratosPendentes"; // contador exibido ao lado do item
  extra?: string; // permissão específica que também libera o item (além dos setores)
};

// Fonte única da navegação — usada pela Sidebar, pelo Breadcrumbs e pelos atalhos do Painel, para não
// repetir a lógica de "quem pode ver o quê" espalhada pelas páginas.
export const NAV_ITEMS: NavItem[] = [
  { label: "Painel", href: "/dashboard", icon: LayoutDashboard, description: "Visão geral", secao: "inicio", grupo: "Início" },

  // ---- Obras ----
  {
    label: "Andamento de Obra",
    href: "/andamento-obra",
    icon: HardHat,
    description: "Fluxograma de andamento por pavimento e unidade, com relatório e histórico.",
    allowedSetores: ["ESTAGIARIO", "ADMIN"],
    secao: "obras",
    grupo: "Andamento de Obra",
  },
  {
    label: "Andamento (novo)",
    href: "/andamento-novo",
    icon: Layers,
    description: "Reformulação do Andamento: pavimentos, locais, categorias, serviços, pesos, relatórios e fachada.",
    allowedSetores: ["ADMIN"],
    extra: "andamento_novo",
    secao: "obras",
    grupo: "Andamento de Obra",
  },

  // ---- Medições e Vales (mão de obra própria) ----
  {
    label: "Lançamentos",
    href: "/lancamentos",
    icon: ClipboardList,
    description: "Registrar medições e vales por pessoa/obra, com aprovação.",
    secao: "medicoes",
    grupo: "Lançamentos",
  },
  {
    label: "Fechamento mensal",
    href: "/admin/fechamento",
    icon: FileCheck2,
    description: "Finalizar o mês: gera o PDF assinado e envia por email.",
    allowedSetores: ["ADMIN"],
    secao: "medicoes",
    grupo: "Fechamento",
  },

  // ---- Contratos (empresas terceirizadas) ----
  {
    label: "Contratos",
    href: "/contratos",
    icon: Handshake,
    description: "Contratos de empresas terceirizadas: itens, aditivos, retenção e PDFs.",
    allowedSetores: ["ADMIN", "ENGENHEIRO", "ESTAGIARIO", "FINANCEIRO"],
    secao: "contratos",
    grupo: "Contratos e Medições",
  },
  {
    label: "Medições de Contratos",
    href: "/contratos/medicoes",
    icon: ClipboardPen,
    description: "Lançar medições, vales e vales de medição de empresas terceirizadas.",
    allowedSetores: ["ADMIN", "ENGENHEIRO", "ESTAGIARIO"],
    secao: "contratos",
    grupo: "Contratos e Medições",
  },
  {
    label: "Aprovações de Contratos",
    href: "/contratos/aprovacoes",
    icon: CheckCheck,
    description: "Aprovar medições/vales de contratos (com glosa) e solicitações de aditivo.",
    allowedSetores: ["ADMIN"],
    badgeKey: "contratosPendentes",
    secao: "contratos",
    grupo: "Aprovação e fechamento",
  },
  {
    label: "Fechamento de Contratos",
    href: "/contratos/fechamento",
    icon: FileSpreadsheet,
    description: "Boletim mensal por contrato, com PDF no padrão SBJ.",
    allowedSetores: ["ADMIN"],
    secao: "contratos",
    grupo: "Aprovação e fechamento",
  },

  // ---- Manutenções ----
  {
    label: "Dashboard",
    href: "/manutencoes",
    icon: Wrench,
    description: "Indicadores de chamados de manutenção/assistência técnica.",
    allowedSetores: ["ADMIN", "ARQUITETO", "ENGENHEIRO", "MESTRE_GERAL", "ESTAGIARIO"],
    secao: "manutencoes",
    grupo: "Chamados",
  },
  {
    label: "Nova Ordem de Serviço",
    href: "/manutencoes/nova",
    icon: FilePlus2,
    description: "Cadastrar um chamado em ~30 segundos.",
    allowedSetores: ["ADMIN", "ARQUITETO", "ENGENHEIRO", "ESTAGIARIO"],
    secao: "manutencoes",
    grupo: "Chamados",
  },
  {
    label: "Ordens de Serviço",
    href: "/manutencoes/os",
    icon: ListChecks,
    description: "Acompanhar e executar chamados abertos.",
    allowedSetores: ["ADMIN", "ARQUITETO", "ENGENHEIRO", "MESTRE_GERAL", "ESTAGIARIO"],
    secao: "manutencoes",
    grupo: "Chamados",
  },
  {
    label: "Agenda",
    href: "/manutencoes/agenda",
    icon: CalendarClock,
    description: "Chamados agendados por data, funcionário ou empresa.",
    allowedSetores: ["ADMIN", "ARQUITETO", "ENGENHEIRO", "MESTRE_GERAL", "ESTAGIARIO"],
    secao: "manutencoes",
    grupo: "Chamados",
  },
  {
    label: "Histórico",
    href: "/manutencoes/historico",
    icon: Archive,
    description: "Histórico técnico permanente, com busca e filtros.",
    allowedSetores: ["ADMIN", "ARQUITETO", "ENGENHEIRO", "MESTRE_GERAL", "ESTAGIARIO"],
    secao: "manutencoes",
    grupo: "Consultas",
  },
  {
    label: "Relatórios",
    href: "/manutencoes/historico",
    icon: FileBarChart2,
    description: "Exportar PDF/Excel do histórico de manutenções.",
    allowedSetores: ["ADMIN", "ARQUITETO", "ENGENHEIRO", "MESTRE_GERAL", "ESTAGIARIO"],
    secao: "manutencoes",
    grupo: "Consultas",
  },
  {
    label: "Categorias & Problemas",
    href: "/manutencoes/opcoes",
    icon: Tags,
    description: "Cadastrar novas categorias e problemas usados ao abrir uma OS.",
    allowedSetores: ["ADMIN"],
    secao: "manutencoes",
    grupo: "Configuração",
  },

  // ---- Financeiro ----
  {
    label: "Dashboard de gastos",
    href: "/financeiro/dashboard",
    icon: BarChart3,
    description: "Gasto por obra, total a pagar por obra no fim do mês e evolução dos últimos 6 meses.",
    allowedSetores: ["ADMIN", "FINANCEIRO"],
    secao: "financeiro",
    grupo: "Painéis",
  },
  {
    label: "Retiradas de retido",
    href: "/financeiro/retiradas",
    icon: Wallet,
    description: "Lançar retiradas, saldo inicial e saldo disponível por pessoa.",
    allowedSetores: ["ADMIN", "FINANCEIRO"],
    secao: "financeiro",
    grupo: "Retidos",
  },

  // ---- Administração ----
  {
    label: "Obras & Pessoas",
    href: "/admin/obras",
    icon: Building2,
    description: "Cadastrar obras, serviços, retenção mensal e empresas contratadas.",
    allowedSetores: ["ADMIN"],
    secao: "admin",
    grupo: "Cadastros",
  },
  {
    label: "RH & Pessoas",
    href: "/rh/pessoas",
    icon: Users,
    description: "Cadastrar empreiteiros/mestres, transferir e dar baixa.",
    allowedSetores: ["ADMIN", "RH"],
    secao: "admin",
    grupo: "Cadastros",
  },
  {
    label: "Empresas Terceirizadas",
    href: "/admin/empresas",
    icon: Briefcase,
    description: "Cadastrar e gerenciar empresas de serviços terceirizados.",
    allowedSetores: ["ADMIN"],
    secao: "admin",
    grupo: "Cadastros",
  },
  {
    label: "Aprovação de logins",
    href: "/admin/aprovacoes",
    icon: UserCheck,
    description: "Aprovar ou rejeitar cadastros pendentes.",
    allowedSetores: ["ADMIN"],
    secao: "admin",
    grupo: "Acesso e auditoria",
  },
  {
    label: "Log de auditoria",
    href: "/admin/auditoria",
    icon: History,
    description: "Histórico de quem criou, editou ou excluiu lançamentos.",
    allowedSetores: ["ADMIN"],
    secao: "admin",
    grupo: "Acesso e auditoria",
  },
];

export function navItemsForSetor(setor: string | null, extras: string[] = []): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.allowedSetores || (setor && item.allowedSetores.includes(setor)) || (item.extra && extras.includes(item.extra))
  );
}

// item que corresponde à página aberta: o de href mais longo (ex.: /contratos/medicoes ganha de /contratos)
export function itemDaRota(items: NavItem[], pathname: string): NavItem | null {
  let melhor: NavItem | null = null;
  for (const it of items) {
    if (pathname === it.href || pathname.startsWith(it.href + "/")) if (!melhor || it.href.length > melhor.href.length) melhor = it;
  }
  return melhor;
}

// menu por setor: só entram os setores e grupos que têm pelo menos um item liberado para a pessoa
export type GrupoMenu = { nome: string; itens: NavItem[] };
export type SecaoMenu = Secao & { grupos: GrupoMenu[]; total: number };
export function menuPorSetor(setor: string | null, extras: string[] = []): SecaoMenu[] {
  const items = navItemsForSetor(setor, extras);
  return SECOES.map((s) => {
    const dela = items.filter((i) => i.secao === s.id);
    const grupos: GrupoMenu[] = [];
    dela.forEach((i) => {
      let g = grupos.find((x) => x.nome === i.grupo);
      if (!g) grupos.push((g = { nome: i.grupo, itens: [] }));
      g.itens.push(i);
    });
    return { ...s, grupos, total: dela.length };
  }).filter((s) => s.href || s.total > 0);
}
