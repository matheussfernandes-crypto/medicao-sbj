-- Módulo Pós-venda (public/posvenda). Uma tabela genérica: cada registro do kit é um documento em "dados".
-- Nada aqui toca as tabelas do Pós-obra. Acesso: usuário com perfil aprovado (o módulo é checado nas rotas).
create table if not exists public.posvenda_docs (
  colecao text not null,
  id text not null,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id),
  primary key (colecao, id)
);

alter table public.posvenda_docs enable row level security;

drop policy if exists "posvenda_docs_leitura" on public.posvenda_docs;
create policy "posvenda_docs_leitura" on public.posvenda_docs for select using (public.eh_usuario_aprovado(auth.uid()));
drop policy if exists "posvenda_docs_insert" on public.posvenda_docs;
create policy "posvenda_docs_insert" on public.posvenda_docs for insert with check (public.eh_usuario_aprovado(auth.uid()));
drop policy if exists "posvenda_docs_update" on public.posvenda_docs;
create policy "posvenda_docs_update" on public.posvenda_docs for update using (public.eh_usuario_aprovado(auth.uid())) with check (public.eh_usuario_aprovado(auth.uid()));
drop policy if exists "posvenda_docs_delete" on public.posvenda_docs;
create policy "posvenda_docs_delete" on public.posvenda_docs for delete using (public.eh_usuario_aprovado(auth.uid()));

-- grava um documento: modo "set" substitui tudo; modo "merge" acrescenta/altera só os campos enviados
create or replace function public.posvenda_gravar(p_colecao text, p_id text, p_dados jsonb, p_modo text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  insert into public.posvenda_docs (colecao, id, dados, atualizado_por)
  values (p_colecao, p_id, p_dados, auth.uid())
  on conflict (colecao, id) do update set
    dados = case when p_modo = $m$merge$m$ then public.posvenda_docs.dados || excluded.dados else excluded.dados end,
    atualizado_em = now(),
    atualizado_por = auth.uid();
end $$;
