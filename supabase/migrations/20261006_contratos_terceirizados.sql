-- ============================================================================
-- Módulo CONTRATOS de empresas terceirizadas
-- Independente dos lançamentos de empreiteiros (tabela "lancamentos").
-- ============================================================================

-- ── Contrato ────────────────────────────────────────────────────────────────
create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  obra_id uuid not null references public.obras(id),
  empresa_id uuid not null references public.empresas_terceirizadas(id),
  objeto text not null,
  data_inicio date,
  data_termino date,
  status text not null default 'ATIVO' check (status in ('ATIVO','SUSPENSO','ENCERRADO')),
  observacoes text,
  empresa_obra_id uuid references public.empresa_obra(id),
  criado_por uuid references auth.users(id) default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists contratos_obra_idx on public.contratos(obra_id);
create index if not exists contratos_empresa_idx on public.contratos(empresa_id);

-- ── Itens (planilha de serviços do contrato) ───────────────────────────────
create table if not exists public.contrato_itens (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  codigo text,
  descricao text not null,
  unidade text not null default 'm²',
  quantidade_original numeric not null default 0,
  quantidade numeric not null default 0,          -- atual (original + aditivos)
  valor_unitario numeric not null default 0,
  ordem int not null default 0,
  ativo boolean not null default true,
  origem_aditivo boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists contrato_itens_contrato_idx on public.contrato_itens(contrato_id);

-- ── Histórico de retenção do contrato ──────────────────────────────────────
create table if not exists public.contrato_retencoes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  vigente_desde char(7) not null,                  -- YYYY-MM
  percent numeric not null default 0,              -- em % (ex.: 5 = 5%)
  motivo text,
  alterado_por uuid references auth.users(id) default auth.uid(),
  alterado_em timestamptz not null default now()
);
create index if not exists contrato_retencoes_contrato_idx on public.contrato_retencoes(contrato_id, vigente_desde);

-- ── Solicitações de aditivo (quem mede pede, ADM aprova/desaprova) ─────────
create table if not exists public.contrato_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  tipo text not null check (tipo in ('AUMENTO','NOVO_SERVICO')),
  item_id uuid references public.contrato_itens(id),
  descricao text,
  unidade text,
  quantidade numeric not null default 0,
  justificativa text not null,
  status text not null default 'AGUARDANDO' check (status in ('AGUARDANDO','APROVADA','DESAPROVADA')),
  motivo_resposta text,
  respondido_por uuid references auth.users(id),
  respondido_em timestamptz,
  criado_por uuid references auth.users(id) default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists contrato_solicitacoes_contrato_idx on public.contrato_solicitacoes(contrato_id);

-- ── Aditivos (cada alteração de quantidade/preço/item novo) ────────────────
create table if not exists public.contrato_aditivos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  tipo text not null check (tipo in ('ACRESCIMO','SUPRESSAO','ITEM_NOVO','PRECO')),
  item_id uuid references public.contrato_itens(id),
  quantidade_anterior numeric,
  quantidade_nova numeric,
  valor_unitario_anterior numeric,
  valor_unitario_novo numeric,
  justificativa text,
  solicitacao_id uuid references public.contrato_solicitacoes(id),
  criado_por uuid references auth.users(id) default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists contrato_aditivos_contrato_idx on public.contrato_aditivos(contrato_id);

-- ── Fechamento mensal do contrato (boletim) ────────────────────────────────
create table if not exists public.contrato_fechamentos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  mes_referencia char(7) not null,
  valor_bruto numeric not null default 0,
  retencao_valor numeric not null default 0,
  vales_descontados numeric not null default 0,
  valor_liquido numeric not null default 0,
  fechado_por uuid references auth.users(id) default auth.uid(),
  fechado_em timestamptz not null default now(),
  unique (contrato_id, mes_referencia)
);

-- ── Lançamentos (medição, vale, vale de medição) ───────────────────────────
create table if not exists public.contrato_lancamentos (
  id uuid primary key default gen_random_uuid(),
  numero int generated always as identity,
  contrato_id uuid not null references public.contratos(id),
  tipo text not null check (tipo in ('MEDICAO','VALE','VALE_MEDICAO')),
  data date not null default current_date,
  mes_referencia char(7) not null,
  status text not null default 'PENDENTE' check (status in ('PENDENTE','APROVADO','REJEITADO')),
  valor_medido numeric not null default 0,         -- como foi lançado
  valor_bruto numeric not null default 0,          -- aprovado (após glosa)
  retencao_aplicada boolean not null default true,
  retencao_pct numeric not null default 0,         -- em %
  retencao_valor numeric not null default 0,
  retencao_dispensa_motivo text,
  valor_vale numeric not null default 0,           -- só para VALE
  valor_liquido numeric not null default 0,
  teve_glosa boolean not null default false,
  observacao text,
  criado_por uuid references auth.users(id) default auth.uid(),
  criado_em timestamptz not null default now(),
  editado_por uuid references auth.users(id),
  editado_em timestamptz,
  aprovado_por uuid references auth.users(id),
  aprovado_em timestamptz,
  motivo_rejeicao text,
  fechamento_id uuid references public.contrato_fechamentos(id) on delete set null
);
create index if not exists contrato_lancamentos_contrato_idx on public.contrato_lancamentos(contrato_id, mes_referencia);
create index if not exists contrato_lancamentos_status_idx on public.contrato_lancamentos(status);

create table if not exists public.contrato_lancamento_itens (
  id uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references public.contrato_lancamentos(id) on delete cascade,
  item_id uuid not null references public.contrato_itens(id),
  modo text not null default 'QTD' check (modo in ('QTD','PCT')),
  percentual numeric,
  quantidade_medida numeric not null,
  quantidade_aprovada numeric,
  valor_unitario numeric not null,
  motivo_glosa text
);
create index if not exists contrato_lancamento_itens_lanc_idx on public.contrato_lancamento_itens(lancamento_id);
create index if not exists contrato_lancamento_itens_item_idx on public.contrato_lancamento_itens(item_id);

-- Quanto de cada vale já foi descontado em cada fechamento (vale maior que o
-- líquido do mês passa o restante para o mês seguinte).
create table if not exists public.contrato_vale_descontos (
  id uuid primary key default gen_random_uuid(),
  vale_id uuid not null references public.contrato_lancamentos(id) on delete cascade,
  fechamento_id uuid not null references public.contrato_fechamentos(id) on delete cascade,
  valor numeric not null
);

-- ── Liberação de retenção ───────────────────────────────────────────────────
create table if not exists public.contrato_retencao_liberacoes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  valor numeric not null,
  data date not null default current_date,
  observacao text,
  lancado_por uuid references auth.users(id) default auth.uid(),
  criado_em timestamptz not null default now()
);

-- ── Anexos (PDF do contrato, aditivos, fotos da medição) ───────────────────
create table if not exists public.contrato_anexos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  aditivo_id uuid references public.contrato_aditivos(id) on delete set null,
  lancamento_id uuid references public.contrato_lancamentos(id) on delete cascade,
  solicitacao_id uuid references public.contrato_solicitacoes(id) on delete cascade,
  tipo text not null default 'CONTRATO' check (tipo in ('CONTRATO','ADITIVO','FOTO','OUTRO')),
  nome_arquivo text,
  storage_path text not null,
  enviado_por uuid references auth.users(id) default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists contrato_anexos_contrato_idx on public.contrato_anexos(contrato_id);

-- ── Saldo por item (aprovado + pendente travam saldo) ──────────────────────
create or replace view public.contrato_itens_saldo
with (security_invoker = true) as
select
  i.*,
  coalesce(sum(case when l.status = 'APROVADO' then coalesce(li.quantidade_aprovada, li.quantidade_medida) end), 0) as qtd_aprovada,
  coalesce(sum(case when l.status = 'PENDENTE' then li.quantidade_medida end), 0) as qtd_pendente
from public.contrato_itens i
left join public.contrato_lancamento_itens li on li.item_id = i.id
left join public.contrato_lancamentos l on l.id = li.lancamento_id
group by i.id;

-- ============================================================================
-- RLS
-- ============================================================================
create or replace function public.eh_usuario_aprovado(uid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.perfis where id = uid and status = 'aprovado');
$$;

create or replace function public.pode_editar_contrato_lancamento(lid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.eh_admin_aprovado(auth.uid()) or exists (
    select 1 from public.contrato_lancamentos
    where id = lid and criado_por = auth.uid() and status = 'PENDENTE'
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'contratos','contrato_itens','contrato_retencoes','contrato_aditivos',
    'contrato_fechamentos','contrato_vale_descontos','contrato_retencao_liberacoes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_leitura" on public.%I', t, t);
    execute format('create policy "%s_leitura" on public.%I for select using (public.eh_usuario_aprovado(auth.uid()))', t, t);
    execute format('drop policy if exists "%s_adm" on public.%I', t, t);
    execute format('create policy "%s_adm" on public.%I for all using (public.eh_admin_aprovado(auth.uid())) with check (public.eh_admin_aprovado(auth.uid()))', t, t);
  end loop;
end $$;

-- Lançamentos
alter table public.contrato_lancamentos enable row level security;
drop policy if exists "contrato_lancamentos_leitura" on public.contrato_lancamentos;
create policy "contrato_lancamentos_leitura" on public.contrato_lancamentos
  for select using (public.eh_usuario_aprovado(auth.uid()));
drop policy if exists "contrato_lancamentos_insert" on public.contrato_lancamentos;
create policy "contrato_lancamentos_insert" on public.contrato_lancamentos
  for insert with check (public.eh_usuario_aprovado(auth.uid()) and criado_por = auth.uid() and status = 'PENDENTE');
drop policy if exists "contrato_lancamentos_update_proprio" on public.contrato_lancamentos;
create policy "contrato_lancamentos_update_proprio" on public.contrato_lancamentos
  for update using (criado_por = auth.uid() and status = 'PENDENTE')
  with check (criado_por = auth.uid() and status = 'PENDENTE');
drop policy if exists "contrato_lancamentos_delete_proprio" on public.contrato_lancamentos;
create policy "contrato_lancamentos_delete_proprio" on public.contrato_lancamentos
  for delete using (criado_por = auth.uid() and status = 'PENDENTE');
drop policy if exists "contrato_lancamentos_adm" on public.contrato_lancamentos;
create policy "contrato_lancamentos_adm" on public.contrato_lancamentos
  for all using (public.eh_admin_aprovado(auth.uid())) with check (public.eh_admin_aprovado(auth.uid()));

-- Itens do lançamento
alter table public.contrato_lancamento_itens enable row level security;
drop policy if exists "contrato_lancamento_itens_leitura" on public.contrato_lancamento_itens;
create policy "contrato_lancamento_itens_leitura" on public.contrato_lancamento_itens
  for select using (public.eh_usuario_aprovado(auth.uid()));
drop policy if exists "contrato_lancamento_itens_escrita" on public.contrato_lancamento_itens;
create policy "contrato_lancamento_itens_escrita" on public.contrato_lancamento_itens
  for all using (public.pode_editar_contrato_lancamento(lancamento_id))
  with check (public.pode_editar_contrato_lancamento(lancamento_id));

-- Solicitações de aditivo
alter table public.contrato_solicitacoes enable row level security;
drop policy if exists "contrato_solicitacoes_leitura" on public.contrato_solicitacoes;
create policy "contrato_solicitacoes_leitura" on public.contrato_solicitacoes
  for select using (public.eh_usuario_aprovado(auth.uid()));
drop policy if exists "contrato_solicitacoes_insert" on public.contrato_solicitacoes;
create policy "contrato_solicitacoes_insert" on public.contrato_solicitacoes
  for insert with check (public.eh_usuario_aprovado(auth.uid()) and criado_por = auth.uid() and status = 'AGUARDANDO');
drop policy if exists "contrato_solicitacoes_delete_proprio" on public.contrato_solicitacoes;
create policy "contrato_solicitacoes_delete_proprio" on public.contrato_solicitacoes
  for delete using (criado_por = auth.uid() and status = 'AGUARDANDO');
drop policy if exists "contrato_solicitacoes_adm" on public.contrato_solicitacoes;
create policy "contrato_solicitacoes_adm" on public.contrato_solicitacoes
  for all using (public.eh_admin_aprovado(auth.uid())) with check (public.eh_admin_aprovado(auth.uid()));

-- Anexos: qualquer aprovado envia (fotos da medição); só ADM ou quem enviou remove.
alter table public.contrato_anexos enable row level security;
drop policy if exists "contrato_anexos_leitura" on public.contrato_anexos;
create policy "contrato_anexos_leitura" on public.contrato_anexos
  for select using (public.eh_usuario_aprovado(auth.uid()));
drop policy if exists "contrato_anexos_insert" on public.contrato_anexos;
create policy "contrato_anexos_insert" on public.contrato_anexos
  for insert with check (public.eh_usuario_aprovado(auth.uid()) and enviado_por = auth.uid()
    and (tipo = 'FOTO' or public.eh_admin_aprovado(auth.uid())));
drop policy if exists "contrato_anexos_delete" on public.contrato_anexos;
create policy "contrato_anexos_delete" on public.contrato_anexos
  for delete using (public.eh_admin_aprovado(auth.uid()) or enviado_por = auth.uid());

-- ── Auditoria (reaproveita o log existente) ─────────────────────────────────
drop trigger if exists trg_auditoria_contratos on public.contratos;
create trigger trg_auditoria_contratos after insert or update or delete on public.contratos
  for each row execute function public.fn_log_auditoria();
drop trigger if exists trg_auditoria_contrato_itens on public.contrato_itens;
create trigger trg_auditoria_contrato_itens after insert or update or delete on public.contrato_itens
  for each row execute function public.fn_log_auditoria();
drop trigger if exists trg_auditoria_contrato_lancamentos on public.contrato_lancamentos;
create trigger trg_auditoria_contrato_lancamentos after insert or update or delete on public.contrato_lancamentos
  for each row execute function public.fn_log_auditoria();
drop trigger if exists trg_auditoria_contrato_retencoes on public.contrato_retencoes;
create trigger trg_auditoria_contrato_retencoes after insert or update or delete on public.contrato_retencoes
  for each row execute function public.fn_log_auditoria();

-- ── Storage: PDFs de contrato/aditivo e fotos de medição ───────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('contratos', 'contratos', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "aprovados leem arquivos de contratos" on storage.objects;
create policy "aprovados leem arquivos de contratos" on storage.objects
  for select using (bucket_id = 'contratos' and public.eh_usuario_aprovado(auth.uid()));
drop policy if exists "aprovados enviam arquivos de contratos" on storage.objects;
create policy "aprovados enviam arquivos de contratos" on storage.objects
  for insert with check (bucket_id = 'contratos' and public.eh_usuario_aprovado(auth.uid()));
drop policy if exists "aprovados removem arquivos de contratos" on storage.objects;
create policy "aprovados removem arquivos de contratos" on storage.objects
  for delete using (bucket_id = 'contratos' and public.eh_usuario_aprovado(auth.uid()));

-- ── Trazer os vínculos empresa × obra já cadastrados como contratos ────────
insert into public.contratos (numero, obra_id, empresa_id, objeto, data_inicio, data_termino, status, empresa_obra_id, criado_em)
select
  coalesce(nullif(trim(eo.observacoes), ''), 'EO-' || left(eo.id::text, 8)),
  eo.obra_id, eo.empresa_id, eo.tipo_servico, eo.data_inicio, eo.data_termino,
  case eo.status when 'ATIVO' then 'ATIVO' when 'INATIVO' then 'SUSPENSO' else 'ENCERRADO' end,
  eo.id, eo.criado_em
from public.empresa_obra eo
where not exists (select 1 from public.contratos c where c.empresa_obra_id = eo.id)
on conflict (numero) do nothing;

insert into public.contrato_retencoes (contrato_id, vigente_desde, percent, motivo, alterado_por)
select c.id,
  to_char(coalesce(eo.data_inicio, current_date), 'YYYY-MM'),
  case when eo.retencao_contratual then coalesce(eo.retencao_pct, 0) else 0 end,
  'Importado do vínculo empresa × obra', null
from public.contratos c
join public.empresa_obra eo on eo.id = c.empresa_obra_id
where not exists (select 1 from public.contrato_retencoes r where r.contrato_id = c.id);
