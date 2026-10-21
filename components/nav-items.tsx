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
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  allowedSetores?: string[]; // undefined = todos os setores aprovados
  group?: string; // undefined = grupo padrão "Navegação"
  badgeKey?: "contratosPendentes"; // contador exibido ao lado do item
  extra?: string; // permissão específica que também libera o item (além dos setores)
};

// Fonte única da navegação — usada pela Sidebar e pelo Breadcrumbs, para não
// repetir a lógica de "quem pode ver o quê" espalhada pelas páginas.
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Painel",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Visão geral",
  },
  {
    label: "Aprovação de logins",
    href: "/admin/aprovacoes",
    icon: UserCheck,
    description: "Aprovar ou rejeitar cadastros pendentes.",
    allowedSetores: ["ADMIN"],
  },
  {
    label: "Obras & Pessoas",
    href: "/admin/obras",
    icon: Building2,
    description: "Cadastrar obras, serviços, retenção mensal e empresas contratadas.",
    allowedSetores: ["ADMIN"],
  },
  {
    label: "Empresas Terceirizadas",
    href: "/admin/empresas",
    icon: Briefcase,
    description: "Cadastrar e gerenciar empresas de serviços terceirizados.",
    allowedSetores: ["ADMIN"],
  },
  {
    label: "RH & Pessoas",
    href: "/rh/pessoas",
    icon: Users,
    description: "Cadastrar empreiteiros/mestres, transferir e dar baixa.",
    allowedSetores: ["ADMIN", "RH"],
  },
  {
    label: "Lançamentos",
    href: "/lancamentos",
    icon: ClipboardList,
    description: "Registrar medições e vales por pessoa/obra, com aprovação.",
  },
  {
    label: "Andamento de Obra",
    href: "/andamento-obra",
    icon: HardHat,
    description: "Fluxograma de andamento por pavimento e unidade, com relatório e histórico.",
    allowedSetores: ["ESTAGIARIO", "ADMIN"],
  },
  {
    label: "Andamento (novo)",
    href: "/andamento-novo",
    icon: Layers,
    description: "Reformulação do Andamento: pavimentos, locais, categorias, serviços e pesos (em construção).",
    allowedSetores: ["ADMIN"],
    extra: "andamento_novo",
  },
  {
    label: "Dashboard",
    href: "/manutencoes",
    icon: Wrench,
    description: "Indicadores de chamados de manutenção/assistência técnica.",
    allowedSetores: ["ADMIN", "ARQUITETO", "ENGENHEIRO", "MESTRE_GERAL", "ESTAGIARIO"],
    group: "Manutenções",
  },
  {
    label: "Nova Ordem de Serviço",
    href: "/manutencoes/nova",
    icon: FilePlus2,
    description: "Cadastrar um chamado em ~30 segundos.",
    allowedSetores: ["ADMIN", "ARQUITETO", "ENGENHEIRO", "ESTAGIARIO"],
    group: "Manutenções",
  },
  {
    label: "Ordens de Serviço",
    href: "/manutencoes/os",
    icon: ListChecks,
    description: "Acompanhar e executar chamados abertos.",
    allowedSetores: ["ADMIN", "ARQUITETO", "ENGENHEIRO", "MESTRE_GERAL", "ESTAGIARIO"],
    group: "Manutenções",
  },
  {
    label: "Agenda",
    href: "/manutencoes/agenda",
    icon: CalendarClock,
    description: "Chamados agendados por data, funcionário ou empresa.",
    allowedSetores: ["ADMIN", "ARQUITETO", "ENGENHEIRO", "MESTRE_GERAL", "ESTAGIARIO"],
    group: "Manutenções",
  },
  {
    label: "Histórico",
    href: "/manutencoes/historico",
    icon: Archive,
    description: "Histórico técnico permanente, com busca e filtros.",
    allowedSetores: ["ADMIN", "ARQUITETO", "ENGENHEIRO", "MESTRE_GERAL", "ESTAGIARIO"],
    group: "Manutenções",
  },
  {
    label: "Empresas Terceirizadas",
    href: "/admin/empresas",
    icon: Briefcase,
    description: "Cadastro de empresas (reaproveita o de Obras & Pessoas).",
    allowedSetores: ["ADMIN"],
    group: "Manutenções",
  },
  {
    label: "Relatórios",
    href: "/manutencoes/historico",
    icon: FileBarChart2,
    description: "Exportar PDF/Excel do histórico de manutenções.",
    allowedSetores: ["ADMIN", "ARQUITETO", "ENGENHEIRO", "MESTRE_GERAL", "ESTAGIARIO"],
    group: "Manutenções",
  },
  {
    label: "Categorias & Problemas",
    href: "/manutencoes/opcoes",
    icon: Tags,
    description: "Cadastrar novas categorias e problemas usados ao abrir uma OS.",
    allowedSetores: ["ADMIN"],
    group: "Manutenções",
  },
  {
    label: "Contratos",
    href: "/contratos",
    icon: Handshake,
    description: "Contratos de empresas terceirizadas: itens, aditivos, retenção e PDFs.",
    allowedSetores: ["ADMIN", "ENGENHEIRO", "ESTAGIARIO", "FINANCEIRO"],
    group: "Contratos",
  },
  {
    label: "Medições de Contratos",
    href: "/contratos/medicoes",
    icon: ClipboardPen,
    description: "Lançar medições, vales e vales de medição de empresas terceirizadas.",
    allowedSetores: ["ADMIN", "ENGENHEIRO", "ESTAGIARIO"],
    group: "Contratos",
  },
  {
    label: "Aprovações de Contratos",
    href: "/contratos/aprovacoes",
    icon: CheckCheck,
    description: "Aprovar medições/vales de contratos (com glosa) e solicitações de aditivo.",
    allowedSetores: ["ADMIN"],
    group: "Contratos",
    badgeKey: "contratosPendentes",
  },
  {
    label: "Fechamento de Contratos",
    href: "/contratos/fechamento",
    icon: FileSpreadsheet,
    description: "Boletim mensal por contrato, com PDF no padrão SBJ.",
    allowedSetores: ["ADMIN"],
    group: "Contratos",
  },
  {
    label: "Retiradas de retido",
    href: "/financeiro/retiradas",
    icon: Wallet,
    description: "Lançar retiradas, saldo inicial e saldo disponível por pessoa.",
    allowedSetores: ["ADMIN", "FINANCEIRO"],
  },
  {
    label: "Fechamento mensal",
    href: "/admin/fechamento",
    icon: FileCheck2,
    description: "Finalizar o mês: gera o PDF assinado e envia por email.",
    allowedSetores: ["ADMIN"],
  },
  {
    label: "Dashboard de gastos",
    href: "/financeiro/dashboard",
    icon: BarChart3,
    description: "Gasto por obra no mês atual e evolução dos últimos 6 meses.",
    allowedSetores: ["ADMIN", "FINANCEIRO"],
  },
  {
    label: "Log de auditoria",
    href: "/admin/auditoria",
    icon: History,
    description: "Histórico de quem criou, editou ou excluiu lançamentos.",
    allowedSetores: ["ADMIN"],
  },
];

export function navItemsForSetor(setor: string | null, extras: string[] = []): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.allowedSetores || (setor && item.allowedSetores.includes(setor)) || (item.extra && extras.includes(item.extra))
  );
}
