-- Google Agenda: a pessoa escolhe uma agenda que já usa (em vez de o site criar uma nova).
-- conectado_em: só visitas marcadas/alteradas no site depois disso vão para o Google (as antigas já estão lá).
alter table public.google_agenda_conexoes add column if not exists calendario_nome text not null default '';
alter table public.google_agenda_conexoes add column if not exists conectado_em timestamptz not null default now();
alter table public.google_agenda_conexoes alter column calendario_id set default '';

drop function if exists public.google_agenda_conexoes_ativas();
create function public.google_agenda_conexoes_ativas()
returns table (usuario_id uuid, google_email text, token_cifrado text, calendario_id text, conectado_em timestamptz, ultimo_sync timestamptz)
language sql security definer set search_path = public stable as $$
  select c.usuario_id, c.google_email, c.token_cifrado, c.calendario_id, c.conectado_em, c.ultimo_sync
  from public.google_agenda_conexoes c
  where c.calendario_id <> '' and public.eh_usuario_aprovado(auth.uid());
$$;
revoke all on function public.google_agenda_conexoes_ativas() from public, anon;
grant execute on function public.google_agenda_conexoes_ativas() to authenticated;
