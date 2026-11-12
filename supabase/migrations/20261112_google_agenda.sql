-- Ligação da Agenda do Pós-venda com o Google Agenda (uma linha por pessoa que conectou).
-- O site só mexe numa agenda que ele mesmo cria no Google ("SBJ · Pós-venda"); a autorização fica cifrada
-- (a chave existe só no servidor). Tabela nova: nada do que já existe é alterado.
create table if not exists public.google_agenda_conexoes (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  google_email text not null default '',
  token_cifrado text not null,
  calendario_id text not null,
  criado_em timestamptz not null default now(),
  ultimo_sync timestamptz,
  ultimo_erro text
);

alter table public.google_agenda_conexoes enable row level security;

drop policy if exists "google_agenda_proprio_select" on public.google_agenda_conexoes;
create policy "google_agenda_proprio_select" on public.google_agenda_conexoes for select using (usuario_id = auth.uid());
drop policy if exists "google_agenda_proprio_insert" on public.google_agenda_conexoes;
create policy "google_agenda_proprio_insert" on public.google_agenda_conexoes for insert with check (usuario_id = auth.uid());
drop policy if exists "google_agenda_proprio_update" on public.google_agenda_conexoes;
create policy "google_agenda_proprio_update" on public.google_agenda_conexoes for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
drop policy if exists "google_agenda_proprio_delete" on public.google_agenda_conexoes;
create policy "google_agenda_proprio_delete" on public.google_agenda_conexoes for delete using (usuario_id = auth.uid());

-- Quando alguém grava uma visita, o servidor atualiza a agenda Google de todas as pessoas conectadas.
-- Só usuários aprovados chamam; o token sai cifrado e só o servidor consegue abrir.
create or replace function public.google_agenda_conexoes_ativas()
returns table (usuario_id uuid, google_email text, token_cifrado text, calendario_id text, ultimo_sync timestamptz)
language sql security definer set search_path = public stable as $$
  select c.usuario_id, c.google_email, c.token_cifrado, c.calendario_id, c.ultimo_sync
  from public.google_agenda_conexoes c
  where public.eh_usuario_aprovado(auth.uid());
$$;

create or replace function public.google_agenda_registrar(p_usuario uuid, p_erro text)
returns void language sql security definer set search_path = public as $$
  update public.google_agenda_conexoes
     set ultimo_sync = case when p_erro is null then now() else ultimo_sync end,
         ultimo_erro = p_erro
   where usuario_id = p_usuario and public.eh_usuario_aprovado(auth.uid());
$$;

revoke all on function public.google_agenda_conexoes_ativas() from public, anon;
revoke all on function public.google_agenda_registrar(uuid, text) from public, anon;
grant execute on function public.google_agenda_conexoes_ativas() to authenticated;
grant execute on function public.google_agenda_registrar(uuid, text) to authenticated;
