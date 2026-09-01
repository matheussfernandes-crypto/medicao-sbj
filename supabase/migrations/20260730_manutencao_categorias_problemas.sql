-- Categorias e Problemas de Manutenção viram listas gerenciáveis pelo ADM
-- (antes eram fixas no código via CHECK constraint — precisava de deploy pra
-- adicionar um item novo, ex: "Deck"). Aplicado via Supabase MCP (apply_migration)
-- em 2026-07-30, espelhado aqui pelo mesmo motivo do arquivo anterior.

create table public.manutencao_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  criado_por uuid references public.perfis(id),
  criado_em timestamptz not null default now()
);

create table public.manutencao_problemas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  criado_por uuid references public.perfis(id),
  criado_em timestamptz not null default now()
);

-- Semente com os valores fixos que já existiam em constants.ts, pra não mudar
-- nada do que já está cadastrado nas OS existentes.
insert into public.manutencao_categorias (nome) values
  ('HIDRAULICA'),('IMPERMEABILIZACAO'),('GAS'),('ELETRICA'),('ESTRUTURAL'),('PREVENTIVO'),
  ('PINTURA_INTERNA'),('PINTURA_EXTERNA'),('REBOCO'),('REVESTIMENTOS'),('COBERTURA'),
  ('FACHADAS'),('ESQUADRIAS'),('ELEVADORES'),('PISCINA'),('PAISAGISMO'),('LIMPEZA'),('OUTROS');

insert into public.manutencao_problemas (nome) values
  ('INFILTRACAO'),('VAZAMENTO'),('TRINCA'),('MANCHA'),('DESCASCAMENTO'),('PORTA'),('JANELA'),
  ('REGISTRO'),('RALO'),('PISO'),('AZULEJO'),('PINTURA'),('OUTRO');

-- Troca o CHECK fixo em manutencao_os por uma referência real às novas tabelas
-- ("sempre linkado", pedido explícito do usuário) — assim um item novo cadastrado
-- pelo ADM já fica disponível pra uso imediatamente, sem precisar de deploy.
alter table public.manutencao_os drop constraint manutencao_os_categoria_check;
alter table public.manutencao_os drop constraint manutencao_os_problema_check;
alter table public.manutencao_os
  add constraint manutencao_os_categoria_fkey foreign key (categoria) references public.manutencao_categorias(nome);
alter table public.manutencao_os
  add constraint manutencao_os_problema_fkey foreign key (problema) references public.manutencao_problemas(nome);

alter table public.manutencao_categorias enable row level security;
alter table public.manutencao_problemas enable row level security;

create policy "usuarios aprovados leem manutencao_categorias"
  on public.manutencao_categorias for select
  to authenticated
  using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado'));

create policy "admin cria manutencao_categorias"
  on public.manutencao_categorias for insert
  to authenticated
  with check (exists (select 1 from public.perfis p where p.id = auth.uid() and p.setor = 'ADMIN' and p.status = 'aprovado'));

create policy "admin atualiza manutencao_categorias"
  on public.manutencao_categorias for update
  to authenticated
  using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.setor = 'ADMIN' and p.status = 'aprovado'));

create policy "usuarios aprovados leem manutencao_problemas"
  on public.manutencao_problemas for select
  to authenticated
  using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado'));

create policy "admin cria manutencao_problemas"
  on public.manutencao_problemas for insert
  to authenticated
  with check (exists (select 1 from public.perfis p where p.id = auth.uid() and p.setor = 'ADMIN' and p.status = 'aprovado'));

create policy "admin atualiza manutencao_problemas"
  on public.manutencao_problemas for update
  to authenticated
  using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.setor = 'ADMIN' and p.status = 'aprovado'));
