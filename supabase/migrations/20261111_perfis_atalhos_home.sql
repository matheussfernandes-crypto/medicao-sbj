-- Atalhos escolhidos por cada pessoa na página inicial (lista de endereços do menu). Nulo = atalhos padrão.
alter table public.perfis add column if not exists atalhos_home text[] default null;
