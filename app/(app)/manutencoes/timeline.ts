type LogRow = {
  acao: string;
  dados_anteriores: any;
  dados_novos: any;
  feito_por: string | null;
  feito_em: string;
};

export type EventoTimeline = { texto: string; quando: string; quem: string };

export function construirTimeline(logs: LogRow[], nomePorId: Record<string, string>): EventoTimeline[] {
  const eventos: EventoTimeline[] = [];

  for (const log of logs) {
    const quem = log.feito_por ? nomePorId[log.feito_por] ?? "—" : "Sistema";
    const quando = log.feito_em;

    if (log.acao === "INSERT") {
      eventos.push({ texto: "OS criada", quando, quem });
      continue;
    }
    if (log.acao === "DELETE") {
      eventos.push({ texto: "OS excluída", quando, quem });
      continue;
    }

    const antes = log.dados_anteriores ?? {};
    const depois = log.dados_novos ?? {};

    if (antes.status !== depois.status) {
      eventos.push({ texto: `Status alterado de "${antes.status}" para "${depois.status}"`, quando, quem });
    }
    if (!antes.responsavel_tipo && depois.responsavel_tipo) {
      eventos.push({ texto: `Responsável definido (${depois.responsavel_tipo === "EMPRESA" ? "empresa terceirizada" : "funcionário SBJ"})`, quando, quem });
    }
    if (!antes.agendado_para && depois.agendado_para) {
      eventos.push({ texto: "OS agendada", quando, quem });
    }
    if (!antes.iniciado_em && depois.iniciado_em) {
      eventos.push({ texto: "Serviço iniciado", quando, quem });
    }
    if (!antes.finalizado_em && depois.finalizado_em) {
      eventos.push({ texto: "Serviço finalizado", quando, quem });
    }
    if (!antes.aprovado_por && depois.aprovado_por) {
      eventos.push({ texto: "Aprovado pelo engenheiro", quando, quem });
    }
    if (!antes.motivo_reprovacao && depois.motivo_reprovacao) {
      eventos.push({ texto: `Reprovado: ${depois.motivo_reprovacao}`, quando, quem });
    }
  }

  return eventos;
}
