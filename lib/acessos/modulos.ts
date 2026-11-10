// Módulos que podem ser liberados por pessoa. A chave é o que fica guardado em perfis.acessos.
// Os prefixos dizem quais endereços pertencem a cada módulo (o mais longo ganha).
export const MODULOS = [
  { key: "andamento_novo", label: "Andamento de Obra (novo)", prefixos: ["/andamento-novo"] },
  { key: "posobra", label: "Pós-obra", prefixos: ["/posobra"] },
  { key: "contratos", label: "Contratos", prefixos: ["/contratos"] },
  { key: "medicoes", label: "Medições e Vales", prefixos: ["/contratos/medicoes"] },
  { key: "lancamentos", label: "Lançamentos", prefixos: ["/lancamentos"] },
  { key: "financeiro", label: "Financeiro", prefixos: ["/financeiro"] },
] as const;

export type ModuloKey = (typeof MODULOS)[number]["key"];

// Único usuário que vê e altera as permissões de todos.
export const GESTOR_ACESSOS_EMAIL = "matheus.sfernandes@hotmail.com";

/** Módulo a que um endereço pertence, ou null se for uma página livre. */
export function moduloDeCaminho(caminho: string): ModuloKey | null {
  let achado: { key: ModuloKey; tam: number } | null = null;
  for (const m of MODULOS) {
    for (const p of m.prefixos) {
      if ((caminho === p || caminho.startsWith(p + "/")) && (!achado || p.length > achado.tam)) {
        achado = { key: m.key, tam: p.length };
      }
    }
  }
  return achado ? achado.key : null;
}

export function rotuloModulo(key: string): string {
  return MODULOS.find((m) => m.key === key)?.label ?? key;
}
