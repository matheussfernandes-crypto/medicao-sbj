-- Obras › Arquitetura › Especificações (módulo vindo da Torre de Controle FG).
-- Só cria tabelas novas (esp_*) e o bucket "especificacoes"; nenhuma tabela existente é alterada.
-- Leitura: qualquer usuário aprovado (o pós-venda vai consultar). Gravação: ADMIN e ARQUITETO.

create or replace function public.eh_arquitetura_aprovado(uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.perfis where id = uid and status = 'aprovado' and setor in ('ADMIN', 'ARQUITETO'));
$$;

-- projeto = unidade de um cliente da arquitetura (ex.: "701 Campeche"); pode ligar a uma unidade da SBJ depois
create table if not exists public.esp_projetos (
  id text primary key,
  codigo text,
  titulo text not null,
  cliente text,
  unidade_id text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.esp_itens (
  id text primary key,
  projeto_id text not null references public.esp_projetos(id) on delete cascade,
  grupo text not null check (grupo in ('metais', 'eletros', 'vidros')),
  ambiente text not null default '',
  material text not null default '',
  referencia text not null default '',
  medidas text not null default '',
  qtd int not null default 1 check (qtd >= 1),
  img text not null default '',          -- "catalogo/<arquivo>" (foto do catálogo) ou "arq/<caminho>" (bucket especificacoes)
  ordem numeric not null default 0,
  vidro jsonb,                            -- só em vidros: altura, largura, ateTeto, perfil, vidro, folhas, correr, puxador, sistema, obs
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists esp_itens_projeto on public.esp_itens (projeto_id, grupo);

create table if not exists public.esp_notas (
  projeto_id text not null references public.esp_projetos(id) on delete cascade,
  grupo text not null check (grupo in ('metais', 'eletros', 'vidros')),
  obs text not null default '',
  rev text not null default 'R0',
  papel text not null default 'a3p',
  faixa int,
  marca text,
  acab text,
  primary key (projeto_id, grupo)
);

create table if not exists public.esp_modelos (
  id text primary key,
  grupo text not null check (grupo in ('metais', 'eletros', 'vidros')),
  material text not null default '',
  referencia text not null default '',
  medidas text not null default '',
  marca text not null default '',
  linha text not null default '',
  acab text not null default '',
  codigo text not null default '',
  faixa int check (faixa between 1 and 3),
  uso text not null default 'g' check (uso in ('b', 'c', 's', 'g')),
  valor_ref numeric,
  valor_data date,
  img text not null default '',
  revisar boolean not null default false,
  ordem numeric not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['esp_projetos', 'esp_itens', 'esp_notas', 'esp_modelos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
    execute format('create policy %I on public.%I for select using (public.eh_usuario_aprovado(auth.uid()))', t || '_leitura', t);
    execute format('drop policy if exists %I on public.%I', t || '_arquitetura', t);
    execute format('create policy %I on public.%I for all using (public.eh_arquitetura_aprovado(auth.uid())) with check (public.eh_arquitetura_aprovado(auth.uid()))', t || '_arquitetura', t);
  end loop;
end $$;

-- fotos dos itens e modelos enviadas pelo site (as do catálogo inicial ficam em /public/especificacoes/catalogo)
insert into storage.buckets (id, name, public) values ('especificacoes', 'especificacoes', false) on conflict (id) do nothing;
drop policy if exists "especificacoes: ler" on storage.objects;
create policy "especificacoes: ler" on storage.objects for select using (bucket_id = 'especificacoes' and public.eh_usuario_aprovado(auth.uid()));
drop policy if exists "especificacoes: enviar" on storage.objects;
create policy "especificacoes: enviar" on storage.objects for insert with check (bucket_id = 'especificacoes' and public.eh_arquitetura_aprovado(auth.uid()));
drop policy if exists "especificacoes: trocar" on storage.objects;
create policy "especificacoes: trocar" on storage.objects for update using (bucket_id = 'especificacoes' and public.eh_arquitetura_aprovado(auth.uid()));
drop policy if exists "especificacoes: apagar" on storage.objects;
create policy "especificacoes: apagar" on storage.objects for delete using (bucket_id = 'especificacoes' and public.eh_arquitetura_aprovado(auth.uid()));
