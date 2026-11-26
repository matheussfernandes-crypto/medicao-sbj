-- Especificações › listas de interiores: cortinas e persianas, revestimentos de parede, tapetes.
-- Só acrescenta: libera os três grupos novos nas restrições de grupo e cria a coluna "campos"
-- (os campos de cada lista; a referência e as medidas continuam gravadas como texto pronto).
-- Nenhum dado existente é alterado.

do $$
declare r record;
begin
  -- tira as restrições antigas de grupo (metais/eletros/vidros) das três tabelas
  for r in
    select c.conrelid::regclass as tabela, c.conname
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in ('public.esp_itens'::regclass, 'public.esp_notas'::regclass, 'public.esp_modelos'::regclass)
      and pg_get_constraintdef(c.oid) ilike '%grupo%'
  loop
    execute format('alter table %s drop constraint %I', r.tabela, r.conname);
  end loop;
end $$;

alter table public.esp_itens add constraint esp_itens_grupo_check
  check (grupo in ('metais', 'eletros', 'vidros', 'cortinas', 'revestimentos', 'tapetes'));
alter table public.esp_notas add constraint esp_notas_grupo_check
  check (grupo in ('metais', 'eletros', 'vidros', 'cortinas', 'revestimentos', 'tapetes'));
alter table public.esp_modelos add constraint esp_modelos_grupo_check
  check (grupo in ('metais', 'eletros', 'vidros', 'cortinas', 'revestimentos', 'tapetes'));

alter table public.esp_itens add column if not exists campos jsonb;
