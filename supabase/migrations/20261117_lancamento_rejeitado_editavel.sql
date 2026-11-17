-- Quem lançou pode corrigir (volta para PENDENTE) ou excluir um lançamento REJEITADO, não só PENDENTE.
create or replace function public.pode_editar_contrato_lancamento(lid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.eh_admin_aprovado(auth.uid()) or exists (
    select 1 from public.contrato_lancamentos
    where id = lid and criado_por = auth.uid() and status in ('PENDENTE', 'REJEITADO')
  );
$$;

drop policy if exists "contrato_lancamentos_update_proprio" on public.contrato_lancamentos;
create policy "contrato_lancamentos_update_proprio" on public.contrato_lancamentos
  for update using (criado_por = auth.uid() and status in ('PENDENTE', 'REJEITADO'))
  with check (criado_por = auth.uid() and status = 'PENDENTE');

drop policy if exists "contrato_lancamentos_delete_proprio" on public.contrato_lancamentos;
create policy "contrato_lancamentos_delete_proprio" on public.contrato_lancamentos
  for delete using (criado_por = auth.uid() and status in ('PENDENTE', 'REJEITADO'));
