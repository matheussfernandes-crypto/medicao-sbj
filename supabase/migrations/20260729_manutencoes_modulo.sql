-- Módulo Manutenções / Assistência Técnica
-- Aplicado direto no banco via Supabase MCP (apply_migration) em 2026-07-29.
-- Espelhado aqui porque supabase/schema.sql está desatualizado em relação ao
-- banco real (várias tabelas existentes, como empresas_terceirizadas, torres,
-- pavimentos, unidades, log_auditoria, nunca foram commitadas antes desta).

-- 1) Novos setores de login
alter table public.perfis drop constraint perfis_setor_check;
alter table public.perfis add constraint perfis_setor_check
  check (setor = any (array['ESTAGIARIO','ADMIN','RH','FINANCEIRO','ARQUITETO','ENGENHEIRO','MESTRE_GERAL']));

-- 2) Campos novos em empresas_terceirizadas
alter table public.empresas_terceirizadas
  add column if not exists especialidade text,
  add column if not exists whatsapp text;

-- 3) Tabela principal de Ordens de Serviço
create table public.manutencao_os (
  id uuid primary key default gen_random_uuid(),
  numero_os int generated always as identity,

  solicitante_nome text not null,
  solicitante_telefone text not null,
  solicitante_tipo text not null check (solicitante_tipo in ('MORADOR','SINDICO','ADMINISTRADORA','ZELADOR','OUTRO')),

  origem text not null check (origem in ('WHATSAPP','TELEFONE','EMAIL','VISTORIA','PREVENTIVA','OUTRO')),

  obra_id uuid not null references public.obras(id),
  torre_id uuid references public.torres(id),
  pavimento_id uuid references public.pavimentos(id),
  unidade_id uuid references public.unidades(id),
  area_comum_texto text,

  categoria text not null check (categoria in (
    'HIDRAULICA','IMPERMEABILIZACAO','GAS','ELETRICA','ESTRUTURAL','PREVENTIVO',
    'PINTURA_INTERNA','PINTURA_EXTERNA','REBOCO','REVESTIMENTOS','COBERTURA',
    'FACHADAS','ESQUADRIAS','ELEVADORES','PISCINA','PAISAGISMO','LIMPEZA','OUTROS'
  )),
  problema text not null check (problema in (
    'INFILTRACAO','VAZAMENTO','TRINCA','MANCHA','DESCASCAMENTO','PORTA','JANELA',
    'REGISTRO','RALO','PISO','AZULEJO','PINTURA','OUTRO'
  )),
  descricao text,
  prioridade text not null default 'MEDIA' check (prioridade in ('BAIXA','MEDIA','ALTA','EMERGENCIAL')),

  status text not null default 'ABERTA' check (status in (
    'ABERTA','AGENDADA','EM_ANDAMENTO','AGUARDANDO_MATERIAL','AGUARDANDO_EMPRESA',
    'AGUARDANDO_APROVACAO','CONCLUIDA','CANCELADA','GARANTIA_NEGADA'
  )),

  responsavel_tipo text check (responsavel_tipo in ('FUNCIONARIO','EMPRESA')),
  responsavel_perfil_id uuid references public.perfis(id),
  responsavel_empresa_id uuid references public.empresas_terceirizadas(id),

  agendado_para timestamptz,

  iniciado_em timestamptz,
  finalizado_em timestamptz,
  servico_executado text check (servico_executado in (
    'REPARO','TROCA','VEDACAO','PINTURA','REGULAGEM','LIMPEZA','TESTE','REVISAO',
    'INSPECAO','SUBSTITUICAO','OUTRO'
  )),
  materiais_utilizados text,
  observacao_tecnica text,

  garantia_classificacao text check (garantia_classificacao in (
    'GARANTIA_CONSTRUTORA','GARANTIA_FORNECEDOR','RESPONSABILIDADE_CONDOMINIO',
    'RESPONSABILIDADE_PROPRIETARIO','FORA_GARANTIA','EM_ANALISE'
  )),

  aprovado_por uuid references public.perfis(id),
  aprovado_em timestamptz,
  motivo_reprovacao text,

  criado_por uuid references public.perfis(id),
  criado_em timestamptz not null default now()
);

create index on public.manutencao_os (obra_id);
create index on public.manutencao_os (status);
create index on public.manutencao_os (criado_em);

alter table public.manutencao_os enable row level security;

create policy "usuarios aprovados leem manutencao_os"
  on public.manutencao_os for select
  to authenticated
  using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado'));

create policy "usuarios aprovados criam manutencao_os"
  on public.manutencao_os for insert
  to authenticated
  with check (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado'));

create policy "usuarios aprovados atualizam manutencao_os"
  on public.manutencao_os for update
  to authenticated
  using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado'));

-- Reaproveita o trigger de auditoria genérico já existente (fn_log_auditoria),
-- usado também em lancamentos/fechamentos/retencoes_pessoa/retiradas_retido.
create trigger trg_log_manutencao_os
  after insert or update or delete on public.manutencao_os
  for each row execute function public.fn_log_auditoria();

-- 4) Anexos (fotos/vídeos/PDFs) — metadados; arquivos ficam no bucket manutencao-anexos
create table public.manutencao_anexos (
  id uuid primary key default gen_random_uuid(),
  os_id uuid not null references public.manutencao_os(id) on delete cascade,
  tipo text not null check (tipo in ('FOTO_CLIENTE','FOTO_ANTES','FOTO_DURANTE','FOTO_DEPOIS','VIDEO','PDF','DOCUMENTO')),
  storage_path text not null,
  nome_arquivo text,
  enviado_por uuid references public.perfis(id),
  criado_em timestamptz not null default now()
);

create index on public.manutencao_anexos (os_id);

alter table public.manutencao_anexos enable row level security;

create policy "usuarios aprovados leem manutencao_anexos"
  on public.manutencao_anexos for select
  to authenticated
  using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado'));

create policy "usuarios aprovados criam manutencao_anexos"
  on public.manutencao_anexos for insert
  to authenticated
  with check (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado'));

create policy "usuarios aprovados excluem manutencao_anexos"
  on public.manutencao_anexos for delete
  to authenticated
  using (exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'aprovado'));

-- 5) Bucket de Storage para os anexos (privado — leitura só via createSignedUrl)
insert into storage.buckets (id, name, public)
values ('manutencao-anexos', 'manutencao-anexos', false)
on conflict (id) do nothing;

create policy "autenticados inserem anexos de manutencao"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'manutencao-anexos');

create policy "autenticados leem anexos de manutencao"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'manutencao-anexos');

create policy "autenticados removem anexos de manutencao"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'manutencao-anexos');
