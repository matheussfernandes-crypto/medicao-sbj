# Andamento de Obra — modelo novo (Fase 1)

Feito em 21/10/2026, **depois** do backup ANDAMENTO R00. Nada do modelo antigo foi alterado: a tela atual continua usando `torres`, `pavimentos`, `unidades` e `andamento_*`.

## Tabelas novas (prefixo `an_`)

`an_fase`, `an_categoria`, `an_servico`, `an_categoria_servico` (peso, peso_fixo), `an_pavimento`, `an_local`, `an_sistema`, `an_sistema_item`, `an_apontamento`, `an_historico`, `an_predefinicao`. Também `obras.data_inicio` e `obras.data_entrega_prevista`.

- `obra_id` nulo nas tabelas de configuração = **Modelo padrão SBJ** (carregado de `lib/andamento/modelo-padrao-sbj.json`).
- O status fica ligado ao **id** do local/item (nunca à posição). 0 = não iniciado, 1 = andamento, 2 = finalizado, 3 = ausência. Só o que foi apontado é gravado.
- `legacy_unidade_id` / `legacy_torre_id` guardam de onde cada linha veio, para conferência e para voltar.
- Permissões (RLS): todos os aprovados leem; configuração só ADM; apontar = estagiário e ADM.

## Funções

- `an_carregar_modelo(jsonb)` — carrega o Modelo padrão (pesos normalizados para 100% por categoria).
- `an_copiar_config(origem, destino)` — copia categorias, serviços, fases e pesos (origem nula = Modelo padrão).
- `an_migrar_legado(obra)` — converte uma obra do modelo antigo para o novo (estrutura, apontamentos e histórico).
- `an_resumo_alvos(obra)` e `an_percentuais(obra, andamento = 0.5)` — cálculo ponderado no servidor: `(peso finalizado + andamento × peso em andamento) / soma dos pesos`, ausência fora da conta.

## Como ficou a Capri e a Tenerife

Capri: 14 pavimentos (Cobertura, Lazer, Pav 12…04, G3, G2, G1 / Térreo), 86 locais, 138 apontamentos, 162 registros de histórico.
Tenerife: 12 pavimentos (Pav 12…04, G3 / Lazer, G2, G1 / Térreo), 78 locais, 1.614 apontamentos, 1.627 registros de histórico.
Conferido: marcados, finalizados, em andamento, observações e histórico **idênticos** ao modelo antigo.

Apontamentos guardados fora da conta (o serviço não existe na categoria do local): Capri 1 (Estrutura na Caixa d'água fibra) e Tenerife 117 (serviços de apartamento marcados no Hall).

## Voltar atrás

Ver `LEIA-ME.md` e `restaurar.sql`. As tabelas `an_*` podem ser ignoradas ou removidas sem afetar o modelo antigo.
