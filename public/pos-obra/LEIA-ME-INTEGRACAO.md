# Prompt para o engenheiro (colar no Claude Code do projeto do site que já está no ar)

> Antes: coloque a pasta `pos-obra/` (do zip `pos-obra-sbj.zip`) dentro do projeto, em `public/pos-obra/`. Depois, abra o Claude Code na raiz do projeto e cole tudo abaixo da linha.

---

Você vai integrar ao NOSSO site (este projeto, já em produção na Vercel) um módulo novo chamado **Pós-obra / Vistorias**. O módulo já está pronto e testado e está na pasta `public/pos-obra/` (site estático em JavaScript puro, sem etapa de build). **Ele deve ser mantido exatamente como está: mesmo layout, mesmas telas, mesmas funções.** Seu trabalho é só: servir o módulo, ligar o banco, proteger com o login que já existe e usar a animação de carregamento. Leia primeiro o projeto existente (stack, autenticação, banco, como as rotas de API são feitas) e siga os padrões dele.

## Regras que não podem ser quebradas
1. **Não altere nenhum dado, tabela, rota, página ou estilo que já exista no site.** O módulo novo é uma categoria separada. As únicas alterações em arquivos existentes são: o item de menu "Pós-obra" e a animação de carregamento (item 5).
2. **Não reescreva o módulo** (nada de converter para React/Next, nada de redesenhar, nada de renomear arquivos ou funções). Se achar que algo precisa mudar dentro de `public/pos-obra/`, só mexa em `js/sync-config.js` e `js/sync.js`, e me avise o motivo.
3. Tabelas novas com prefixo `posobra_`. Rotas novas em `/api/pos-obra/...`. Nada compartilhado com as tabelas atuais.
4. Antes de apagar, trocar ou migrar qualquer coisa, pergunte.

## O que fazer

### 1. Servir o módulo
- O módulo abre em `/pos-obra/` (arquivo `public/pos-obra/index.html`). Garanta que a Vercel o entregue sem reescrever os caminhos relativos (`css/`, `js/`, `assets/`, `data/`) e que a rota exija login (use o mesmo mecanismo de autenticação do site; se o login é por cookie/sessão, as chamadas do módulo à API devem enviar `credentials: "include"`).
- Adicione um item "Pós-obra" no menu do site atual apontando para `/pos-obra/`.
- Em HTTPS o módulo funciona **sem internet** (ele registra um service worker, `sw.js`). O escopo deve ser `/pos-obra/`. Não coloque cabeçalhos que impeçam isso. Se mudar qualquer arquivo do módulo, rode `python gerar-sw.py` dentro de `public/pos-obra/` para atualizar o `sw.js` (ou faça isso no build).

### 2. Telas que ficam visíveis por enquanto
- Só **Vistorias**, **Empreendimentos (obras)**, **Clientes** e **Fornecedores**. As telas Painel, Pós-venda (chamados), Modificações, Agenda e Relatórios ficam escondidas por enquanto (serão ativadas depois).
- Isso já está configurado em `js/sync-config.js` pela linha `window.SBJ_MODULOS_OCULTOS = [...]`. Não apague as telas; só deixe escondidas.

### 3. Banco de dados e API (a parte principal)
Use o banco que o site já usa. Crie tabelas novas (adapte aos tipos do banco):
- `posobra_obras` (empreendimentos), `posobra_clientes`, `posobra_fornecedores`: espelhe os campos dos registros de `state.buildings`, `state.clients`, `state.suppliers` (veja `js/data.js`, funções `buildSeedData` e `migrateData`).
- `posobra_vistorias`: id, obra_id, apartamento, data, responsavel, email, nome_proprietario, nome_tecnico, `folha` (JSON), `termo` (JSON), assinaturas (3 imagens PNG: proprietário, técnico, termo), criado_em, atualizado_em. **Chave natural única: obra + apartamento + data** (enviar de novo a mesma vistoria só atualiza, nunca duplica).
- `posobra_pendencias`: id, vistoria_id, ambiente, tipo (serviço), descricao, feito (bool), feito_em, ordem.
- `posobra_fotos`: id, pendencia_id, caminho. **As imagens vão para armazenamento de arquivos** (Vercel Blob, Supabase Storage ou o equivalente do projeto), não para a tabela. Cada foto já é um JPEG leve (até 1280 px).

Rotas (todas exigem login):
- `POST /api/pos-obra/vistorias`: recebe uma vistoria completa (mesmo formato do objeto em `state.vistorias`) e faz upsert pela chave natural, incluindo pendências, assinaturas e fotos.
- `GET /api/pos-obra/vistorias?desde=ISO`: devolve as vistorias criadas/alteradas depois da data (para outros aparelhos receberem).
- Rotas equivalentes para obras, clientes e fornecedores (listar e gravar).

### 4. Ligar o módulo ao banco (`js/sync-config.js`)
O módulo já tem uma **fila de envio** (`js/sync.js`): toda alteração marca a vistoria como "pendente"; quando há internet e `window.SBJ_ADAPTER` existe, ela envia uma por uma e marca como "enviada". Sem internet ela espera. Seu trabalho é só escrever o adaptador:
```js
window.SBJ_ADAPTER = {
  async enviarVistoria(vistoria, buscarFoto) { /* POST /api/pos-obra/vistorias; subir cada foto (await buscarFoto(id) devolve o Blob) */ },
  async receberVistorias(desdeISO) { /* GET /api/pos-obra/vistorias?desde=... */ },
};
```
- Fotos: o campo `item.fotos` de cada pendência guarda códigos; `buscarFoto(codigo)` devolve o arquivo. Suba os arquivos e salve o caminho. Ao receber, devolva as fotos de modo que o módulo consiga guardá-las (veja `vtfReceber` em `js/vistoria-fotos.js`).
- Para receber o que outras pessoas fizeram, use a função `vtMisturar(vistorias)` (em `js/vistorias.js`): ela junta sem apagar nem duplicar. Chame-a com o resultado de `receberVistorias`.
- **Obras, clientes e fornecedores:** hoje a fila cobre as vistorias. Estenda `js/sync.js` seguindo o mesmo modelo (marcar alterado, enviar, receber) para `state.buildings`, `state.clients` e `state.suppliers`, de forma que a primeira abertura traga os dados do banco e as alterações subam. Na carga inicial, importe do `js/data.js` (dados de partida) para as tabelas `posobra_*` **uma única vez** e depois tire os dados reais de clientes do `js/data.js` do módulo, deixando o banco como fonte.
- Mantenha o uso **offline primeiro**: o módulo sempre grava no aparelho primeiro; o servidor é só a cópia compartilhada.

### 5. Animação de carregamento (única mudança visual no site atual)
- Use a animação da logo SBJ (a que já existe neste projeto ou nesta pasta; o vetor da logo está em `public/pos-obra/assets/logo-sbj.svg`) como **tela de carregamento** na entrada do site e na troca de página. Se você não encontrar a animação pronta, pare e me pergunte onde ela está, em vez de inventar outra.
- Não mude mais nada do site atual.

## Como validar (me mostre o resultado de cada item)
1. `/pos-obra/` abre só logado e mostra apenas Vistorias, Empreendimentos, Clientes e Fornecedores.
2. Fazer uma vistoria de teste (Realizar vistoria): marcar itens como errado, linhas diferentes com fotos, assinar na tela e salvar. Ela aparece no banco, sem duplicar se for enviada duas vezes.
3. Pôr o celular em modo avião, abrir o módulo já instalado ("Adicionar à Tela de Início"), fazer outra vistoria; religar a internet: ela deve subir sozinha.
4. Abrir em outro aparelho: as vistorias e fotos aparecem (via `receberVistorias` + `vtMisturar`).
5. Nenhuma tabela, rota ou tela antiga do site foi alterada.
6. Os PDFs (relatório por serviço, vistoria assinada, termo de recebimento) são gerados no próprio aparelho: confirme que continuam saindo iguais.

Responda no fim com: lista de arquivos criados/alterados, tabelas criadas, o que ficou pendente e como testar em produção.
