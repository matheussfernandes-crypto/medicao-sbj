-- Histórico dos PDFs de especificação: cada vez que a folha é impressa / salva em PDF, grava quem, quando e qual arquivo.
-- Tabela nova; nada existente muda. Leitura para aprovados; cada um só grava em seu próprio nome; ninguém altera ou apaga.
create table if not exists public.esp_pdfs (
  id bigint generated always as identity primary key,
  projeto_id text references public.esp_projetos(id) on delete cascade,  -- PDF de um projeto (unidade ou lazer)
  obra_id uuid references public.cadastro_obras(id) on delete cascade,    -- PDF do prédio inteiro
  grupo text not null,                                                    -- metais | eletros | vidros | todos
  arquivo text not null,
  rev text,
  papel text,
  gerado_por uuid not null default auth.uid(),
  gerado_por_nome text,
  gerado_em timestamptz not null default now()
);
create index if not exists esp_pdfs_projeto on public.esp_pdfs (projeto_id, gerado_em desc);
create index if not exists esp_pdfs_obra on public.esp_pdfs (obra_id, gerado_em desc);
alter table public.esp_pdfs enable row level security;
drop policy if exists esp_pdfs_leitura on public.esp_pdfs;
create policy esp_pdfs_leitura on public.esp_pdfs for select using (public.eh_usuario_aprovado(auth.uid()));
drop policy if exists esp_pdfs_registrar on public.esp_pdfs;
create policy esp_pdfs_registrar on public.esp_pdfs for insert with check (public.eh_usuario_aprovado(auth.uid()) and gerado_por = auth.uid());
