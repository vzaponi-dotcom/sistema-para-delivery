# Guia de homologação física — impressão por contexto da Spec B

Status: **APROVADO PARA RELEASE DE PRODUÇÃO**.

A matriz física da política de impressão por contexto da Spec B foi executada manualmente em staging e aprovada pelo usuário responsável pela homologação em **15/09/2026**, sobre o SHA funcional **`9381311a76d3ced64bd3dcb5074d7b7363b59554`**.

A aprovação cobre os cenários obrigatórios deste guia. A evidência registrada no repositório é a declaração explícita de homologação do operador; fotos, IDs individuais de jobs e capturas da fila não foram anexados ao repositório e não devem ser inventados retroativamente.

## Pré-condições usadas como referência

- staging no SHA funcional homologado;
- estação Windows/QZ principal como executora física;
- QZ conectado, fila localizada e impressora fisicamente pronta;
- pedidos/comandas de teste sem uso de dados reais;
- validação da quantidade física de vias e do comportamento de fila/recovery.

## Matriz homologada

| Cenário | Resultado esperado | Resultado final |
|---|---|---|
| Pedido avulso, default 1 | Um job comercial e uma via física. | **PASS** |
| Pedido avulso, default 2 | Mesmo job em 1/2, decisão e 2/2 somente após confirmação. | **PASS** |
| Local sem vínculo de mesa | Usa default de pedido; não é classificado como comanda. | **PASS** |
| Pedido ligado à mesa, defaults 1 e 2 | `copies_requested` segue política de comanda. | **PASS** |
| Resumo de comanda, defaults 1 e 2 | Job `table-tab` e 1/2 vias conforme política. | **PASS** |
| Escolha explícita | 1/2 explícito vence default; inválido não cria job. | **PASS** |
| Impressão de teste | Sempre uma via. | **PASS** |
| Segunda via dispensada | Job terminal sem segunda saída nem duplicação. | **PASS** |
| Retry conhecido | Mesmo job; via confirmada não é repetida. | **PASS** |
| Resultado desconhecido | `requires_attention`, sem repetição automática. | **PASS** |
| Reprint | Novo job manual com vínculo ao original. | **PASS** |
| Política alterada com fila pendente | Jobs existentes preservam `copies_requested`. | **PASS** |
| Fechamento/transferência | Identidade/documento original da comanda preservados. | **PASS** |
| Recovery com dois jobs | Afinidade no primeiro job até concluir/dispensar 2/2. | **PASS** |
| Solicitação remota | Dispositivo remoto enfileira; PC principal executa fisicamente. | **PASS** |

## Inspeção física homologada

A homologação confirmou funcionamento correto da impressão física, quantidade de vias, ordem de execução, segunda via, fila/recovery e execução pela estação principal. Não foi reportada duplicação indevida nem divergência funcional nos cenários testados.

## Critério de encerramento

A pendência física da Spec B está **encerrada**. Para fins de release, a declaração explícita do usuário responsável pela homologação em 15/09/2026 é aceita como evidência manual equivalente da matriz completa executada no SHA funcional `9381311...`.

Um commit posterior exclusivamente documental não altera o código executável homologado; a release deve continuar verificando por comparação que nenhuma alteração de aplicação foi introduzida depois desse SHA sem nova validação.
