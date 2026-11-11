-- Preços unitários combinados com o fornecedor em cada contrato ("contrato tipo").
-- Ex.: Forro de gesso R$ 55,00/m² · Negativo R$ 25,00/m · Cortineiro R$ 85,00/m.
create table if not exists public.contrato_precos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  servico text not null,
  unidade text not null,
  valor_unitario numeric(14,2) not null check (valor_unitario >= 0),
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists contrato_precos_contrato_idx on public.contrato_precos(contrato_id, ordem);

alter table public.contrato_precos enable row level security;
drop policy if exists "contrato_precos_leitura" on public.contrato_precos;
create policy "contrato_precos_leitura" on public.contrato_precos
  for select using (public.eh_usuario_aprovado(auth.uid()));
drop policy if exists "contrato_precos_adm" on public.contrato_precos;
create policy "contrato_precos_adm" on public.contrato_precos
  for all using (public.eh_admin_aprovado(auth.uid())) with check (public.eh_admin_aprovado(auth.uid()));
