import type { Filtros, Formato, FotosSel, Montagem, MontagemSalva } from "./modelo";

// Como o relatório está montado na tela: o servidor refaz exatamente o mesmo PDF a partir disto.
export type ConfigRelatorio = {
  filtros: Filtros;
  fmt: Formato;
  mon: Montagem;
  fotosSimples: FotosSel;
  montagem: MontagemSalva | null; // preenchida quando o relatório é uma montagem
};

// Textos que o registro mostra (o que não dá para tirar do PDF)
export type MetaRelatorio = {
  tipo: "simples" | "montagem";
  montagemNome: string | null;
  filtroResumo: string; // predefinição usada ou resumo do filtro
  folha: string; // "A3 horizontal"
  comResumo: boolean;
};

export type CorpoEmail = { destinatarios: string[]; assunto: string; mensagem: string; salvarPadrao: boolean };

export type PedidoRelatorio =
  | { acao: "pdf"; obraId: string; config: ConfigRelatorio; meta: MetaRelatorio }
  | { acao: "email"; obraId: string; config: ConfigRelatorio; meta: MetaRelatorio; email: CorpoEmail }
  | { acao: "reenviar"; logId: string; email: CorpoEmail };

export type RespostaRelatorio = { ok: boolean; erro?: string; logId?: string; url?: string; paginas?: number; pct?: number; enviadoPara?: string[]; porLink?: boolean };

export type LinhaLog = {
  id: string;
  criado_em: string;
  obra_id: string;
  obra_nome: string;
  usuario_nome: string | null;
  usuario_email: string | null;
  acao: "PDF" | "EMAIL";
  tipo: "simples" | "montagem";
  montagem_nome: string | null;
  filtro_resumo: string | null;
  folha: string | null;
  paginas: number | null;
  com_resumo: boolean | null;
  pct_obra: number | null;
  destinatarios: string[] | null;
  assunto: string | null;
  mensagem: string | null;
  situacao: "Enviado" | "Falhou" | null;
  erro: string | null;
  pdf_path: string | null;
  url?: string | null; // endereço temporário de download
};
