# Medição de Empreiteiros — versão com backend (Next.js + Supabase)

Esta é a versão real do sistema (protótipo HTML em `demo-medicao.html`), começando pela parte mais
crítica: **login com email/senha e aprovação de cadastro pelo ADM**. As telas de obras, pessoas,
lançamentos de medição/vale e retenção (que já existem no protótipo) entram na próxima fase — o
banco de dados (`supabase/schema.sql`) já foi desenhado para receber tudo isso sem precisar redesenhar
mais tarde.

## O que já funciona nesta versão

- Cadastro (nome completo, email, senha, setor: Estagiário / Engenheiro-ADM / RH / Financeiro).
- Todo cadastro novo fica "pendente" até o ADM aprovar.
- Painel `/admin/aprovacoes`: lista pendentes, aprova/rejeita, mantém histórico de decisões.
- Login com email/senha real (via Supabase Auth) — só entra quem está aprovado.
- Troca de senha — usar a tela "Esqueci minha senha" do Supabase Auth (ainda não tem botão na UI
  desta versão; no protótipo HTML já existe — porto na próxima leva).

## 1. Criar o projeto Supabase (gratuito)

1. Crie uma conta em https://supabase.com e clique em "New project".
2. Escolha uma senha de banco de dados (guarde-a) e a região mais próxima (ex: South America).
3. O plano gratuito ("Free") já é suficiente para testar por um tempo — sem cartão de crédito.
4. Depois do projeto criado, vá em **Project Settings → API** e copie:
   - `Project URL` → cole em `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → cole em `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Rodar o schema do banco

1. No painel do Supabase, abra **SQL Editor**.
2. Cole todo o conteúdo de `supabase/schema.sql` e clique em "Run".
3. Depois, cole todo o conteúdo de `supabase/seed.sql` e clique em "Run" — isso cria as obras e os
   11 empreiteiros reais (todos com 20% de retenção a partir da admissão).

## 3. Rodar localmente

```bash
cp .env.example .env.local
# edite .env.local com a URL e a anon key do seu projeto Supabase
npm install
npm run dev
```

Acesse http://localhost:3000 → você cai em `/login`.

## 4. Criar e aprovar a SUA conta como ADM (bootstrap)

Como ainda não existe nenhum ADM aprovado para aprovar o primeiro, faça assim:

1. Acesse `/cadastro`, preencha com **matheus@sbjconstrutora.com.br**, escolha uma senha sua, e
   selecione o setor "Engenheiro / ADM".
2. No Supabase, vá em **Table Editor → perfis**, encontre a linha com esse email, e mude a coluna
   `status` de `pendente` para `aprovado` manualmente (só precisa fazer isso uma vez, para o primeiro ADM).
3. A partir daí, você consegue entrar normalmente e aprovar todos os próximos cadastros (estagiários,
   RH, financeiro, outros engenheiros) direto pela tela `/admin/aprovacoes`, sem precisar tocar no banco.

## 5. Colocar no ar de graça (Vercel) — para testar por 1 mês

1. Crie um repositório no GitHub e suba esta pasta:
   ```bash
   git init && git add . && git commit -m "init" && git push
   ```
2. Em https://vercel.com, clique em "New Project" e importe o repositório.
3. Em "Environment Variables", adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (os mesmos valores do `.env.local`).
4. Clique em "Deploy". A Vercel gera um link gratuito tipo `medicao-app.vercel.app` — esse é o link
   que você e a equipe vão usar para testar.

Tanto a Vercel quanto o Supabase têm planos gratuitos sem necessidade de cartão, suficientes para o
período de teste de 1 mês.

## 6. Se der certo: domínio próprio e planos pagos

- **Domínio**: compre em qualquer registrador (Registro.br, GoDaddy, Namecheap) e aponte para a Vercel
  em "Project Settings → Domains" — é só adicionar o domínio e seguir as instruções de DNS.
- **Supabase pago**: necessário só quando o uso crescer (mais armazenamento, mais usuários simultâneos,
  backups diários). O plano "Pro" custa a partir de US$ 25/mês.
- **Vercel pago**: o plano gratuito ("Hobby") já aguenta uso interno de uma empresa pequena/média; o
  plano "Pro" (US$ 20/mês) só costuma ser necessário se o tráfego for alto ou for uso comercial sério.

## Estrutura do projeto

```
supabase/schema.sql            tabelas, gatilhos e políticas de segurança (RLS)
supabase/seed.sql              obras + 11 empreiteiros reais + retenção inicial 20%
lib/supabase/client.ts         cliente Supabase para componentes do navegador
lib/supabase/server.ts         cliente Supabase para Server Components/Actions
middleware.ts                  protege rotas (sem login -> /login; pendente -> /aguardando-aprovacao)
app/login                      tela de entrar (email/senha)
app/cadastro                   tela de solicitar cadastro
app/aguardando-aprovacao       tela exibida enquanto o cadastro está pendente/rejeitado
app/dashboard                  painel inicial após login (por setor)
app/admin/aprovacoes           fila de aprovação de cadastros (só ADM)
```

## Próximos passos (não incluídos nesta leva)

- Portar para esta versão: obras & pessoas, lançamento de medição/vale pelo estagiário, retenção por
  pessoa com % congelada e log de alteração, saldo retido inicial, retiradas pelo Financeiro, e os
  relatórios em PDF/Excel — tudo já existe no protótipo `demo-medicao.html` e o banco já está
  preparado (`supabase/schema.sql`) para receber essas telas sem precisar mudar a estrutura.
- Botão de "trocar senha" e "esqueci minha senha" na interface (hoje dá para fazer pelo painel do
  Supabase Auth, mas ainda não tem tela própria nesta versão).

## Sobre o projeto antigo (Prisma + Neon)

Havia uma tentativa anterior deste backend usando Prisma + Neon, com um modelo de dados mais simples
(sem obras reais, sem retenção por pessoa, sem RH/Financeiro, sem aprovação de login). Ela foi
renomeada para `medicao-app-OLD-prisma-neon` e não é mais usada — esta pasta (`medicao-app`) é a
versão atual.
