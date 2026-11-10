// Permissões por subitem. Cada página do menu é um "item" com uma chave que fica guardada em perfis.acessos.
// Uma chave de módulo (ex.: "contratos") libera todos os subitens dele, e a chave antiga "medicoes" libera
// Contratos → Medições. Assim as permissões que já existiam continuam valendo.

export const MODULOS = [
  { key: "andamento_novo", label: "Andamento de Obra (novo)" },
  { key: "posobra", label: "Pós-obra" },
  { key: "contratos", label: "Contratos" },
  { key: "lancamentos", label: "Lançamentos" },
  { key: "financeiro", label: "Financeiro" },
] as const;

export type ItemDef = { key: string; modulo: string; label: string; prefixos: string[] };

export const ITENS: ItemDef[] = [
  { key: "andamento_novo", modulo: "andamento_novo", label: "Andamento (novo)", prefixos: ["/andamento-novo"] },
  { key: "posobra/vistorias", modulo: "posobra", label: "Vistorias", prefixos: ["/posobra/vistorias"] },
  { key: "posobra/empreendimentos", modulo: "posobra", label: "Empreendimentos", prefixos: ["/posobra/empreendimentos"] },
  { key: "posobra/clientes", modulo: "posobra", label: "Clientes", prefixos: ["/posobra/clientes"] },
  { key: "posobra/fornecedores", modulo: "posobra", label: "Fornecedores", prefixos: ["/posobra/fornecedores"] },
  { key: "contratos/lista", modulo: "contratos", label: "Contratos", prefixos: ["/contratos"] },
  { key: "contratos/medicoes", modulo: "contratos", label: "Medições", prefixos: ["/contratos/medicoes"] },
  { key: "contratos/autorizacao", modulo: "contratos", label: "Autorização", prefixos: ["/contratos/aprovacoes"] },
  { key: "contratos/fechamento", modulo: "contratos", label: "Fechamento", prefixos: ["/contratos/fechamento"] },
  { key: "contratos/historico", modulo: "contratos", label: "Histórico", prefixos: ["/contratos/historico"] },
  { key: "contratos/terceirizados", modulo: "contratos", label: "Cadastro de terceirizado", prefixos: ["/admin/empresas"] },
  { key: "lancamentos", modulo: "lancamentos", label: "Lançamentos", prefixos: ["/lancamentos"] },
  { key: "financeiro/dashboard", modulo: "financeiro", label: "Dashboard de gastos", prefixos: ["/financeiro/dashboard"] },
  { key: "financeiro/retiradas", modulo: "financeiro", label: "Retiradas de retido", prefixos: ["/financeiro/retiradas"] },
];

// Chaves antigas que continuam valendo
const ALIAS: Record<string, string[]> = { medicoes: ["contratos/medicoes"] };

// Único usuário que vê e altera as permissões de todos (os dois e-mails são da mesma pessoa).
export const GESTORES_ACESSOS_EMAILS = ["matheus.sfernandes@hotmail.com", "matheus@sbjconstrutora.com.br"];

export function ehGestorAcessos(email: string | null | undefined): boolean {
  return !!email && GESTORES_ACESSOS_EMAILS.includes(email.toLowerCase());
}

/** Conjunto de subitens liberados a partir do que está guardado para a pessoa. */
export function itensLiberados(chaves: string[] | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const k of chaves ?? []) {
    (ALIAS[k] ?? []).forEach((x) => out.add(x));
    if (ITENS.some((i) => i.key === k)) out.add(k);
    ITENS.filter((i) => i.modulo === k).forEach((i) => out.add(i.key));
  }
  return out;
}

/** Subitem a que um endereço pertence (o prefixo mais longo ganha), ou null se for página livre. */
export function itemDeCaminho(caminho: string): ItemDef | null {
  let achado: { item: ItemDef; tam: number } | null = null;
  for (const item of ITENS) {
    for (const p of item.prefixos) {
      if ((caminho === p || caminho.startsWith(p + "/")) && (!achado || p.length > achado.tam)) {
        achado = { item, tam: p.length };
      }
    }
  }
  return achado ? achado.item : null;
}

/** Pode abrir este endereço com as chaves dadas? */
export function permitido(chaves: string[] | null | undefined, caminho: string): boolean {
  const item = itemDeCaminho(caminho);
  return !item || itensLiberados(chaves).has(item.key);
}

/** Usado pelo menu: mostra o item se ele pertence a um módulo controlado. */
export function moduloDeCaminho(caminho: string): string | null {
  return itemDeCaminho(caminho)?.key ?? null;
}

export function rotuloItem(key: string): string {
  return ITENS.find((i) => i.key === key)?.label ?? key;
}

export const rotuloModulo = rotuloItem;
