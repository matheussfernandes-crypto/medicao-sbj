-- Fechamento de VALE do mês (relatório de adiantamentos pagos, separado do boletim de medição).
create table if not exists public.contrato_fechamentos_vale (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  mes_referencia char(7) not null,
  qtd_vales int not null default 0,
  valor_total numeric not null default 0,
  fechado_por uuid references auth.users(id) default auth.uid(),
  fechado_em timestamptz not null default now(),
  unique (contrato_id, mes_referencia)
);

alter table public.contrato_lancamentos
  add column if not exists fechamento_vale_id uuid references public.contrato_fechamentos_vale(id) on delete set null;

alter table public.contrato_fechamentos_vale enable row level security;
drop policy if exists "contrato_fechamentos_vale_leitura" on public.contrato_fechamentos_vale;
create policy "contrato_fechamentos_vale_leitura" on public.contrato_fechamentos_vale
  for select using (public.eh_usuario_aprovado(auth.uid()));
drop policy if exists "contrato_fechamentos_vale_adm" on public.contrato_fechamentos_vale;
create policy "contrato_fechamentos_vale_adm" on public.contrato_fechamentos_vale
  for all using (public.eh_admin_aprovado(auth.uid())) with check (public.eh_admin_aprovado(auth.uid()));
