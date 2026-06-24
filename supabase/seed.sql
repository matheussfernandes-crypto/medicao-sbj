-- ============================================================================
-- Dados iniciais reais: obras e os 11 empreiteiros enviados pelo Matheus.
-- Rode DEPOIS de schema.sql, no SQL Editor do Supabase.
-- Todos com 20% de retenção a partir do mês de admissão e saldo retido
-- inicial = 0 (ajuste depois pelo painel Financeiro, quando essa tela existir
-- nesta versão — por ora, ajuste direto na tabela `pessoas` se precisar).
-- ============================================================================

insert into public.obras (id, nome) values
  (gen_random_uuid(), 'ILHA DE TENERIFE'),
  (gen_random_uuid(), 'ILHA DE SAN BLAS'),
  (gen_random_uuid(), 'ILHA DE CAPRI'),
  (gen_random_uuid(), 'ILHA DE COZUMEL'),
  (gen_random_uuid(), 'ILHA DE PAROS'),
  (gen_random_uuid(), 'INSS')
on conflict do nothing;

-- Os inserts abaixo usam subselects pelo nome da obra (mais simples do que fixar
-- UUIDs manualmente). Rode tudo de uma vez.
with o as (select id, nome from public.obras)
insert into public.pessoas (nome, papel, obra_id, admissao, status, saida, saldo_inicial_retido)
select v.nome, 'EMPREITEIRO', o.id, v.admissao::date, 'ATIVO', null, 0
from (values
  ('ADAILSON DO ESPIRITO SANTO ROCHA',          'ILHA DE SAN BLAS',  '2025-04-22'),
  ('ADEILSON APARECIDO RODRIGUES LESSA',         'ILHA DE SAN BLAS',  '2025-03-17'),
  ('CARLITO ADRIANO MOREIRA',                    'ILHA DE TENERIFE',  '2026-06-02'),
  ('EDIVALDO MACIEL DOS SANTOS',                 'ILHA DE SAN BLAS',  '2025-09-15'),
  ('FRANCISCO MARTINS FORMIGOSA',                'ILHA DE SAN BLAS',  '2024-09-10'),
  ('JEAN ELISE DERIVAL',                         'ILHA DE TENERIFE',  '2025-06-09'),
  ('JURANDI DO PRADO (INSS)',                    'INSS',              '2024-04-02'),
  ('KELWEN LOLRAN DOS SANTOS MOTA',              'ILHA DE SAN BLAS',  '2025-03-17'),
  ('LUIZ FELIPE LOPES ALBINO',                   'ILHA DE TENERIFE',  '2026-06-17'),
  ('MARCOS ANTONIO DIAZ LOPEZ',                  'ILHA DE CAPRI',     '2026-03-23'),
  ('RAIMUNDO NONATO FRANEL PEREIRA SILVA',        'ILHA DE TENERIFE',  '2026-02-19')
) as v(nome, obra_nome, admissao)
join o on o.nome = v.obra_nome;

-- Retenção inicial de 20% para todos, a partir do mês de admissão de cada um.
insert into public.retencoes_pessoa (pessoa_id, mes, percent)
select p.id, to_char(p.admissao, 'YYYY-MM'), 0.20
from public.pessoas p;
