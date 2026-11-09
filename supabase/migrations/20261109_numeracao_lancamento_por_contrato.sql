-- Numeração dos lançamentos de contrato POR CONTRATO (antes era um contador único do site inteiro).
-- Medições (MEDICAO e VALE_MEDICAO) seguem uma sequência; vales (VALE) seguem outra, ambas por contrato.

alter table public.contrato_lancamentos alter column numero drop identity if exists;

-- Renumera o que já existe, na ordem em que foi feito (data do lançamento, depois data de criação).
with ordem as (
  select id,
         row_number() over (
           partition by contrato_id, (tipo = 'VALE')
           order by data, criado_em, id
         ) as n
  from public.contrato_lancamentos
)
update public.contrato_lancamentos l
   set numero = o.n
  from ordem o
 where o.id = l.id and l.numero is distinct from o.n;

create or replace function public.fn_numero_lancamento_contrato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- trava por contrato para dois lançamentos simultâneos não pegarem o mesmo número
  perform pg_advisory_xact_lock(hashtext('contrato_lanc_' || new.contrato_id::text));
  select coalesce(max(numero), 0) + 1
    into new.numero
    from public.contrato_lancamentos
   where contrato_id = new.contrato_id
     and (tipo = 'VALE') = (new.tipo = 'VALE');
  return new;
end;
$$;

drop trigger if exists trg_numero_lancamento_contrato on public.contrato_lancamentos;
create trigger trg_numero_lancamento_contrato
  before insert on public.contrato_lancamentos
  for each row execute function public.fn_numero_lancamento_contrato();

create unique index if not exists contrato_lancamentos_numero_por_contrato
  on public.contrato_lancamentos (contrato_id, (tipo = 'VALE'), numero);
