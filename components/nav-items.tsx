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
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  allowedSetores?: string[]; // undefined = todos os setores aprovados
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
    label: "EM PRODUÇÃO",
    href: "/andamento-obra",
    icon: HardHat,
    description: "Andamento de obra — módulo em construção.",
    allowedSetores: ["ESTAGIARIO", "ADMIN"],
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

export function navItemsForSetor(setor: string | null): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.allowedSetores || (setor && item.allowedSetores.includes(setor)));
}
