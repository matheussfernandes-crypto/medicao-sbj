-- ============================================================================
-- Sistema de Medição de Empreiteiros — SBJ Construtora e Incorporadora
-- Schema Supabase (Postgres). Rode este arquivo inteiro no SQL Editor do
-- seu projeto Supabase (https://app.supabase.com -> seu projeto -> SQL Editor).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) PERFIS — extensão de auth.users com setor e status de aprovação do ADM.
-- ---------------------------------------------------------------------------
create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome_completo text not null,
  email text not null,
  setor text not null check (setor in ('ESTAGIARIO', 'ADMIN', 'RH', 'FINANCEIRO')),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado')),
  criado_em timestamptz not null default now(),
  decidido_por uuid references auth.users(id),
  decidido_em timestamptz
);

-- Gatilho: toda vez que alguém se cadastra via supabase.auth.signUp(),
-- cria automaticamente a linha em perfis com status 'pendente'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfis (id, nome_completo, email, setor, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome_completo', new.email),
    new.email,
    coalesce(new.raw_user_meta_data->>'setor', 'ESTAGIARIO'),
    'pendente'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Função auxiliar (security definer) para checar se o usuário logado é ADM aprovado,
-- sem cair em recursão de RLS nas políticas abaixo.
create or replace function public.eh_admin_aprovado(uid uuid)
returns boolean
language sql
security definer set search_path = public
as $$
  select exists (
    select 1 from public.perfis
    where id = uid and setor = 'ADMIN' and status = 'aprovado'
  );
$$;

alter table public.perfis enable row level security;

create policy "usuário vê o próprio perfil"
  on public.perfis for select
  using (auth.uid() = id);

create policy "ADM vê todos os perfis"
  on public.perfis for select
  using (public.eh_admin_aprovado(auth.uid()));

create policy "ADM aprova ou rejeita perfis"
  on public.perfis for update
  using (public.eh_admin_aprovado(auth.uid()));

-- ---------------------------------------------------------------------------
-- 2) OBRAS, PESSOAS (empreiteiros), SERVIÇOS — base para as próximas fases.
--    (Ainda não usadas pelas telas desta primeira versão; deixadas aqui para
--    a migração das funcionalidades do protótipo HTML não precisar redesenhar
--    o banco depois.)
-- ---------------------------------------------------------------------------
create table if not exists public.obras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  logo_url text
);

create table if not exists public.pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  papel text not null default 'EMPREITEIRO' check (papel in ('EMPREITEIRO', 'MESTRE')),
  obra_id uuid references public.obras(id),
  admissao date not null,
  status text not null default 'ATIVO' check (status in ('ATIVO', 'INATIVO')),
  saida date,
  saldo_inicial_retido numeric(12, 2) not null default 0
);

create table if not exists public.retencoes_pessoa (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  mes char(7) not null, -- formato 'YYYY-MM'
  percent numeric(5, 4) not null,
  alterado_em timestamptz not null default now()
);

create table if not exists public.log_alteracoes_retencao (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  obra_id uuid references public.obras(id),
  mes_aplicacao char(7) not null,
  percent_anterior numeric(5, 4) not null,
  percent_novo numeric(5, 4) not null,
  alterado_por uuid references auth.users(id),
  alterado_em timestamptz not null default now()
);

create table if not exists public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoas(id),
  obra_id uuid not null references public.obras(id),
  tipo text not null check (tipo in ('MEDICAO', 'VALE')),
  mes_referencia char(7) not null,
  total_reais numeric(12, 2) not null,
  retencao_pct_usado numeric(5, 4),
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'APROVADO', 'REJEITADO')),
  criado_por uuid references auth.users(id),
  criado_em timestamptz not null default now()
);

create table if not exists public.retiradas_retido (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoas(id),
  obra_id uuid references public.obras(id),
  valor numeric(12, 2) not null,
  data date not null default current_date,
  observacao text,
  lancado_por uuid references auth.users(id)
);

-- RLS básico: por enquanto, qualquer usuário aprovado pode ler; só ADM/RH/Financeiro
-- (conforme a tela) poderão escrever — políticas de escrita detalhadas entram na
-- próxima fase, quando as telas de obras/pessoas/lançamentos forem construídas.
alter table public.obras enable row level security;
alter table public.pessoas enable row level security;
alter table public.retencoes_pessoa enable row level security;
alter table public.log_alteracoes_retencao enable row level security;
alter table public.lancamentos enable row level security;
alter table public.retiradas_retido enable row level security;

create policy "usuários aprovados leem obras" on public.obras for select
  using (exists (select 1 from public.perfis where id = auth.uid() and status = 'aprovado'));
create policy "usuários aprovados leem pessoas" on public.pessoas for select
  using (exists (select 1 from public.perfis where id = auth.uid() and status = 'aprovado'));
create policy "usuários aprovados leem retencoes" on public.retencoes_pessoa for select
  using (exists (select 1 from public.perfis where id = auth.uid() and status = 'aprovado'));
create policy "usuários aprovados leem log" on public.log_alteracoes_retencao for select
  using (exists (select 1 from public.perfis where id = auth.uid() and status = 'aprovado'));
create policy "usuários aprovados leem lancamentos" on public.lancamentos for select
  using (exists (select 1 from public.perfis where id = auth.uid() and status = 'aprovado'));
create policy "usuários aprovados leem retiradas" on public.retiradas_retido for select
  using (exists (select 1 from public.perfis where id = auth.uid() and status = 'aprovado'));

-- ============================================================================
-- FIM DO SCHEMA. Próximo passo: rode supabase/seed.sql para criar as obras e
-- os 11 empreiteiros reais. Depois siga o README.md para criar e aprovar a sua
-- própria conta (matheus@sbjconstrutora.com.br) como ADM.
-- ============================================================================
