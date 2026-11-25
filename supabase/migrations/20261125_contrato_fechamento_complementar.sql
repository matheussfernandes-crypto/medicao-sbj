-- Fechamento complementar: mais de um fechamento de medição no mesmo mês do contrato.
-- O 1º fechamento do mês é sequencia 1; uma medição lançada depois gera o 2º (complementar), e assim por diante.
alter table public.contrato_fechamentos add column if not exists sequencia int not null default 1;
alter table public.contrato_fechamentos drop constraint if exists contrato_fechamentos_contrato_id_mes_referencia_key;
alter table public.contrato_fechamentos
  add constraint contrato_fechamentos_contrato_mes_seq_key unique (contrato_id, mes_referencia, sequencia);
