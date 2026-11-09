-- Módulo Pós-obra / Vistorias (public/pos-obra). Tabelas novas, todas com prefixo posobra_.
-- Nada aqui toca as tabelas que já existem. Acesso: qualquer usuário com perfil aprovado.

-- ---------- Cadastros (espelho de state.buildings / state.clients / state.suppliers do módulo) ----------
-- "id" é o mesmo id usado no módulo (b1, c12, sup3...). "dados" guarda o registro completo do módulo,
-- para nada se perder; as colunas soltas servem para consulta.
create table if not exists public.posobra_obras (
  id text primary key,
  nome text not null default '',
  endereco text,
  status text,
  unidades integer,
  data_entrega text,
  responsavel text,
  progresso numeric,
  possui_manual boolean,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id),
  excluido_em timestamptz
);

create table if not exists public.posobra_clientes (
  id text primary key,
  obra_id text,
  unidade text,
  vaga text,
  nome text,
  telefone text,
  email text,
  escritura text,
  observacoes text,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id),
  excluido_em timestamptz
);
create index if not exists posobra_clientes_obra_idx on public.posobra_clientes (obra_id);

create table if not exists public.posobra_fornecedores (
  id text primary key,
  razao_social text,
  nome_fantasia text,
  cnpj text,
  telefone text,
  email text,
  status text,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id),
  excluido_em timestamptz
);

create index if not exists posobra_obras_atual_idx on public.posobra_obras (atualizado_em);
create index if not exists posobra_clientes_atual_idx on public.posobra_clientes (atualizado_em);
create index if not exists posobra_fornecedores_atual_idx on public.posobra_fornecedores (atualizado_em);

-- ---------- Vistorias ----------
create table if not exists public.posobra_vistorias (
  id uuid primary key default gen_random_uuid(),
  id_local text,                       -- id gerado no aparelho (vt...)
  obra_id text not null,
  apartamento text not null,
  apartamento_chave text generated always as (lower(apartamento)) stored,
  data date not null,
  responsavel text,
  email text,
  nome_proprietario text,
  nome_tecnico text,
  folha jsonb,
  termo jsonb,
  assinatura_proprietario text,        -- caminho no Storage (bucket posobra)
  assinatura_tecnico text,
  assinatura_termo text,
  dados jsonb not null default '{}'::jsonb,   -- demais campos do objeto do módulo
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id),
  atualizado_por uuid references auth.users(id),
  constraint posobra_vistorias_chave unique (obra_id, apartamento_chave, data)
);
create index if not exists posobra_vistorias_atual_idx on public.posobra_vistorias (atualizado_em);

create table if not exists public.posobra_pendencias (
  id uuid primary key default gen_random_uuid(),
  vistoria_id uuid not null references public.posobra_vistorias(id) on delete cascade,
  id_local text,
  ambiente text not null default '',
  tipo text not null default '',
  descricao text not null default '',
  -- mesma regra do módulo (vtChaveItem): ambiente|tipo|descrição, minúsculo e sem espaços nas pontas
  chave text generated always as (lower(trim(ambiente)) || '|' || lower(trim(tipo)) || '|' || lower(trim(descricao))) stored,
  feito boolean not null default false,
  feito_em text,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint posobra_pendencias_chave unique (vistoria_id, chave)
);

create table if not exists public.posobra_fotos (
  id text primary key,                 -- código da foto no módulo (f...)
  pendencia_id uuid not null references public.posobra_pendencias(id) on delete cascade,
  caminho text,                        -- caminho no Storage; nulo enquanto o arquivo não subiu
  criado_em timestamptz not null default now()
);
create index if not exists posobra_fotos_pend_idx on public.posobra_fotos (pendencia_id);

-- ---------- Acesso (RLS): usuário aprovado lê e grava; ninguém apaga pela API ----------
do $$
declare t text;
begin
  foreach t in array array['posobra_obras','posobra_clientes','posobra_fornecedores','posobra_vistorias','posobra_pendencias','posobra_fotos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_leitura" on public.%I', t, t);
    execute format('create policy "%s_leitura" on public.%I for select using (public.eh_usuario_aprovado(auth.uid()))', t, t);
    execute format('drop policy if exists "%s_insert" on public.%I', t, t);
    execute format('create policy "%s_insert" on public.%I for insert with check (public.eh_usuario_aprovado(auth.uid()))', t, t);
    execute format('drop policy if exists "%s_update" on public.%I', t, t);
    execute format('create policy "%s_update" on public.%I for update using (public.eh_usuario_aprovado(auth.uid())) with check (public.eh_usuario_aprovado(auth.uid()))', t, t);
  end loop;
end $$;

-- ---------- Gravar uma vistoria completa (upsert pela chave natural obra + apartamento + data) ----------
-- Regras iguais às do módulo (vtMisturar): nunca apaga; pendência resolvida em qualquer lado fica resolvida;
-- campos de texto só são trocados quando vêm preenchidos.
create or replace function public.posobra_salvar_vistoria(v jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  vid uuid;
  it jsonb;
  pid uuid;
  n integer := 0;
  f text;
  faltando jsonb;
begin
  if not public.eh_usuario_aprovado(auth.uid()) then
    raise exception 'Usuário sem acesso';
  end if;
  if coalesce(v->>'buildingId', '') = '' or coalesce(v->>'unit', '') = '' or coalesce(v->>'date', '') = '' then
    raise exception 'Vistoria sem obra, apartamento ou data';
  end if;

  insert into public.posobra_vistorias as pv
    (id_local, obra_id, apartamento, data, responsavel, email, nome_proprietario, nome_tecnico, folha, termo, dados, criado_por, atualizado_por)
  values
    (v->>'id', v->>'buildingId', v->>'unit', (v->>'date')::date,
     nullif(v->>'responsavel', ''), nullif(v->>'email', ''), v->>'nomeProp', v->>'nomeTec',
     v->'folha', v->'termo', coalesce(v->'extra', '{}'::jsonb), auth.uid(), auth.uid())
  on conflict (obra_id, apartamento_chave, data) do update set
    responsavel       = coalesce(excluded.responsavel, pv.responsavel),
    email             = coalesce(excluded.email, pv.email),
    nome_proprietario = coalesce(excluded.nome_proprietario, pv.nome_proprietario),
    nome_tecnico      = coalesce(excluded.nome_tecnico, pv.nome_tecnico),
    folha             = coalesce(excluded.folha, pv.folha),
    termo             = coalesce(excluded.termo, pv.termo),
    dados             = pv.dados || excluded.dados,
    atualizado_em     = now(),
    atualizado_por    = auth.uid()
  returning pv.id into vid;

  for it in select value from jsonb_array_elements(coalesce(v->'items', '[]'::jsonb)) loop
    n := n + 1;
    insert into public.posobra_pendencias as pp (vistoria_id, id_local, ambiente, tipo, descricao, feito, feito_em, ordem)
    values (vid, it->>'id', coalesce(it->>'ambiente', ''), coalesce(it->>'tipo', ''), coalesce(it->>'descricao', ''),
            coalesce((it->>'feito')::boolean, false), nullif(it->>'feitoEm', ''), n)
    on conflict (vistoria_id, chave) do update set
      feito         = pp.feito or excluded.feito,
      feito_em      = coalesce(pp.feito_em, excluded.feito_em),
      atualizado_em = now()
    returning pp.id into pid;

    for f in select value from jsonb_array_elements_text(coalesce(it->'fotos', '[]'::jsonb)) loop
      insert into public.posobra_fotos (id, pendencia_id) values (f, pid) on conflict (id) do nothing;
    end loop;
  end loop;

  select coalesce(jsonb_agg(fo.id), '[]'::jsonb) into faltando
    from public.posobra_fotos fo join public.posobra_pendencias p on p.id = fo.pendencia_id
   where p.vistoria_id = vid and fo.caminho is null;

  return jsonb_build_object('id', vid, 'fotosFaltando', faltando);
end;
$$;

-- ---------- Arquivos: bucket privado "posobra" (fotos e assinaturas) ----------
insert into storage.buckets (id, name, public) values ('posobra', 'posobra', false) on conflict (id) do nothing;

drop policy if exists "posobra_arquivos_leitura" on storage.objects;
create policy "posobra_arquivos_leitura" on storage.objects for select
  using (bucket_id = 'posobra' and public.eh_usuario_aprovado(auth.uid()));
drop policy if exists "posobra_arquivos_insert" on storage.objects;
create policy "posobra_arquivos_insert" on storage.objects for insert
  with check (bucket_id = 'posobra' and public.eh_usuario_aprovado(auth.uid()));
drop policy if exists "posobra_arquivos_update" on storage.objects;
create policy "posobra_arquivos_update" on storage.objects for update
  using (bucket_id = 'posobra' and public.eh_usuario_aprovado(auth.uid()));
