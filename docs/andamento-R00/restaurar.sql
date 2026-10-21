-- ANDAMENTO R00 — restaura os dados do Andamento de Obra para o estado do backup (21/10/2026).
-- Rode no SQL Editor do Supabase. Tudo em uma transação: se algo falhar, nada muda.
-- NÃO mexe em torres/pavimentos/unidades que já existem (são usadas por Manutenções);
-- só recria linhas que tenham sumido.

begin;

-- 1) estrutura: devolve só o que faltar
insert into public.torres select * from backup_andamento_r00.torres b
  where not exists (select 1 from public.torres t where t.id = b.id);
insert into public.pavimentos select * from backup_andamento_r00.pavimentos b
  where not exists (select 1 from public.pavimentos p where p.id = b.id);
insert into public.unidades select * from backup_andamento_r00.unidades b
  where not exists (select 1 from public.unidades u where u.id = b.id);

-- 2) andamento: volta ao backup (apaga o que existe e copia de novo)
delete from public.andamento_historico;
delete from public.andamento_status;
delete from public.andamento_servicos;

insert into public.andamento_servicos select * from backup_andamento_r00.andamento_servicos;
insert into public.andamento_status    select * from backup_andamento_r00.andamento_status;
insert into public.andamento_historico select * from backup_andamento_r00.andamento_historico;

-- 3) fotos (registros; os arquivos continuam no bucket obra-fotos)
delete from public.obra_fotos;
insert into public.obra_fotos select * from backup_andamento_r00.obra_fotos;

-- 4) obras que aparecem no painel
update public.obras o set exibir_no_painel = b.exibir_no_painel
  from backup_andamento_r00.obras b where b.id = o.id;

-- conferência: tem que bater com o backup
select 'servicos' t, (select count(*) from public.andamento_servicos) agora, (select count(*) from backup_andamento_r00.andamento_servicos) backup
union all select 'status', (select count(*) from public.andamento_status), (select count(*) from backup_andamento_r00.andamento_status)
union all select 'historico', (select count(*) from public.andamento_historico), (select count(*) from backup_andamento_r00.andamento_historico)
union all select 'fotos', (select count(*) from public.obra_fotos), (select count(*) from backup_andamento_r00.obra_fotos);

commit;
