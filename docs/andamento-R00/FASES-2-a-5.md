# Andamento de Obra — modelo novo (Fases 2 a 5)

Tudo em `/andamento-novo` (menu "Andamento (novo)", **só ADM** por enquanto). A tela atual `/andamento-obra` e o painel inicial continuam lendo o modelo antigo — nada foi trocado ainda.

## Abas
- **Andamento** — cartões (Visão geral, Pavimentos, Tipos de local, Sistemas), grade por categoria, "vale para o pavimento inteiro", selecionar várias (clique, arraste, coluna, linha), lista para celular, popup com observação. Sistemas: caixa d'água (Fibra | Concreto armado) e **Fachadas em 3D** (isométrica, painel lateral, descidas +/−, lista para celular).
- **Pavimentos e serviços** — dados da obra, matriz categorias × serviços (+ fases, modelo padrão), pesos com cadeado, pavimentos, sistemas, cadastro de obra nova com prévia.
- **Relatório** — filtros, predefinições, formatação, folhas A3 (1587×1123 px), página de resumo, fachada 3D grande, impressão (janela própria) e CSV.
- **Histórico** e **Fotos**.

## Banco (Supabase) — tabelas `an_*`
Ver `FASE-1-modelo-novo.md`. Funções principais: `an_apontar` (lote + histórico), `an_observacao`, `an_definir_peso`/`an_normalizar_pesos`, `an_duplicar_pavimento`, `an_nova_obra`, `an_sincronizar_fachada`, `an_definir_descidas`, `an_trocar_reservatorio`, `an_percentuais`.

## Cálculo
`% = (peso finalizado + 0,5 × peso em andamento) / soma dos pesos`; ausência sai da conta. Soma ponderada de todas as células do grupo (pavimento, categoria, sistema, obra, filtro).

## Pendente (decisões)
- **Peso da fachada no índice geral:** hoje cada item (descida × pavimento) é uma célula; a fachada da Capri tem 242 itens e puxa o índice da obra para baixo (Capri 16,1% só locais → 4,2% com fachada; Tenerife 60,7% → 16,3%). Opções: (A) manter; (B) cada sistema pesa como um pavimento; (C) peso % configurável por sistema.
- Troca da tela atual pela nova (e do painel inicial) depois da aprovação; re-sincronizar os apontamentos feitos na tela antiga até lá.
