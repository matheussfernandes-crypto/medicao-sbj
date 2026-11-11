-- Botão "Excluir" da Aprovação de logins.
-- 1) O status 'excluido' não estava na regra da tabela, então o update falhava em silêncio.
alter table public.perfis drop constraint if exists perfis_status_check;
alter table public.perfis add constraint perfis_status_check
  check (status = any (array['pendente','aprovado','rejeitado','desativado','excluido']));

-- 2) Excluir de verdade quando a pessoa não tem histórico: apaga o login (auth.users → perfis em cascata),
--    liberando o e-mail para um novo cadastro. Se houver histórico ligado ao login (medições, lançamentos,
--    vistorias...), a exclusão bate em chave estrangeira e o perfil só é marcado como 'excluido'.
--    Retorna 'apagado' ou 'arquivado'.
create or replace function public.excluir_login(p_perfil uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  if not exists (
    select 1 from public.perfis
    where id = auth.uid() and setor = 'ADMIN' and status = 'aprovado'
  ) then
    raise exception 'Apenas o ADM pode excluir acessos.';
  end if;
  if p_perfil = auth.uid() then
    raise exception 'Você não pode excluir o seu próprio acesso.';
  end if;
  select lower(email) into v_email from public.perfis where id = p_perfil;
  if v_email in ('matheus.sfernandes@hotmail.com', 'matheus@sbjconstrutora.com.br') then
    raise exception 'Esta conta é protegida e não pode ser alterada.';
  end if;

  begin
    delete from auth.users where id = p_perfil;
    if found then
      return 'apagado';
    end if;
  exception when foreign_key_violation then
    null; -- tem histórico: cai para o arquivamento abaixo
  end;

  update public.perfis
     set status = 'excluido', decidido_por = auth.uid(), decidido_em = now()
   where id = p_perfil;
  return 'arquivado';
end;
$$;

revoke all on function public.excluir_login(uuid) from public, anon;
grant execute on function public.excluir_login(uuid) to authenticated;
