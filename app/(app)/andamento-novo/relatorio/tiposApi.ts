import type { Filtros, Formato, FotosSel, Montagem, MontagemSalva, OrdemLocal } from "./modelo";

// Como o relatório está montado na tela: o servidor refaz exatamente o mesmo PDF a partir disto.
export type ConfigRelatorio = {
  filtros: Filtros;
  fmt: Formato;
  mon: Montagem;
  fotosSimples: FotosSel;
  montagem: MontagemSalva | null; // preenchida quando o relatório é uma montagem
  ordem?: OrdemLocal | null; // ordem dos serviços ainda não salva (o PDF sai como a prévia)
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

// uma obra do lote (várias obras de uma vez): o PDF dela já está guardado
export type ItemLote = { obraId: string; obraNome: string; path: string; bytes: number; paginas: number; pct: number; meta: MetaRelatorio };

export type PedidoRelatorio =
  | { acao: "gerar"; origemId: string; obraId: string; config: ConfigRelatorio; meta: MetaRelatorio } // gera e guarda o PDF de UMA obra do lote (sem registrar)
  | { acao: "registrar"; lote: string; modo: "PDF" | "EMAIL"; juntar: boolean; itens: ItemLote[]; email?: CorpoEmail } // registra o lote (uma linha por obra) e, se for e-mail, envia
  | { acao: "pdf"; obraId: string; config: ConfigRelatorio; meta: MetaRelatorio }
  | { acao: "email"; obraId: string; config: ConfigRelatorio; meta: MetaRelatorio; email: CorpoEmail }
  | { acao: "reenviar"; logId: string; email: CorpoEmail };

export type RespostaGerar = { ok: boolean; erro?: string; obraId: string; obraNome: string; path?: string; bytes?: number; paginas?: number; pct?: number; url?: string; avisos: string[] };
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
  lote_id?: string | null; // várias obras geradas/enviadas juntas
  junto_com?: string[]; // nomes das outras obras do mesmo lote
  url?: string | null; // endereço temporário de download
};
