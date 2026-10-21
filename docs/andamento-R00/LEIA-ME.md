# ANDAMENTO R00 — ponto de restauração

Foto do Andamento de Obra **antes da reformulação** (modelo novo com pavimentos, locais, categorias e sistemas). Feita em 21/10/2026.

## O que foi guardado

| O quê | Onde |
|---|---|
| Código do site | etiqueta git `andamento-R00` (commit `02282a3`, branch `main`) |
| Dados do Andamento | schema `backup_andamento_r00` no Supabase (cópia das tabelas `obras`, `torres`, `pavimentos`, `unidades`, `andamento_servicos`, `andamento_status`, `andamento_historico`, `obra_fotos`) |
| Fotos (arquivos) | continuam no bucket `obra-fotos` (a reformulação não mexe nele) |

Contagens no momento do backup: 8 obras, 11 torres, 30 pavimentos, 135 unidades, 264 serviços, 1.753 apontamentos, 1.789 registros de histórico, 2 fotos.

## Por que dá pra voltar com segurança

- O modelo novo é construído em **tabelas novas** (`an_*`). As tabelas atuais do Andamento **não são alteradas** pela migração.
- `torres`, `pavimentos` e `unidades` também são usadas por **Manutenções**, por isso nunca são apagadas nem recriadas.

## Como voltar (se der problema)

1. **Código:** `git revert` dos commits da reformulação, ou publicar de novo o commit da etiqueta:
   `git checkout andamento-R00 -- .` e commit (ou pedir ao Claude: "volta o Andamento para o R00").
2. **Dados:** rodar `restaurar.sql` (nesta pasta) no SQL Editor do Supabase. Ele devolve `andamento_servicos`, `andamento_status`, `andamento_historico` e `obra_fotos` ao estado do backup e recria o que faltar em `torres`/`pavimentos`/`unidades`, sem apagar nada que esteja em uso por Manutenções.
3. As tabelas `an_*` podem ficar (não atrapalham) ou ser removidas depois.
