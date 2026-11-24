-- Especificações por prédio: o projeto passa a ter o prédio (cadastro único de obras) e o tipo (unidade ou lazer).
-- Só acrescenta colunas; nada existente muda. Cada prédio tem no máximo um projeto de lazer, com a lista dos seus ambientes.
alter table public.esp_projetos add column if not exists obra_id uuid references public.cadastro_obras(id) on delete set null;
alter table public.esp_projetos add column if not exists tipo text not null default 'unidade';
alter table public.esp_projetos add column if not exists ambientes text[] not null default '{}';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'esp_projetos_tipo_check') then
    alter table public.esp_projetos add constraint esp_projetos_tipo_check check (tipo in ('unidade', 'lazer'));
  end if;
end $$;
create index if not exists esp_projetos_obra on public.esp_projetos (obra_id);
create unique index if not exists esp_projetos_lazer_unico on public.esp_projetos (obra_id) where tipo = 'lazer';
