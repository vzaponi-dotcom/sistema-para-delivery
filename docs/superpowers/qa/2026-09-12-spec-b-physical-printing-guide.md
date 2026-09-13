# Guia de homologação física — impressão por contexto da Spec B

Status: **PENDENTE / não executado**. Este guia prepara uma rodada posterior em staging; sua criação não autoriza deploy, migration remota ou impressão real.

## Pré-condições

- Usar staging no SHA exato aprovado e registrar SHA, ambiente, horário, operador, PC Windows principal, versão do QZ Tray, fila/driver e modelo da impressora.
- Confirmar backup e migrations de staging conforme o runbook antes de testar; não usar produção.
- Manter somente a estação Windows/QZ aprovada como principal e confirmar separadamente: QZ conectado, fila encontrada e estado físico pronto.
- Usar pedidos, mesas, comandas e clientes sintéticos identificáveis; anotar o ID de cada job e preservar os registros da fila/tentativas.
- Ter acesso à fila do Windows/QZ para correlacionar cada tentativa. Sucesso de `qz.print()` sozinho não conta como via concluída; a evidência operacional é o evento correlacionado `COMPLETE`.

## Matriz obrigatória

Para cada cenário, registrar política antes da criação, contexto real, `job.id`, `type`, `orderId`/`tableTabId`, `parentJobId`, `copies_requested`, tentativas por via, estado final, quantidade física e observações de legibilidade.

| Cenário | Procedimento | Resultado esperado |
|---|---|---|
| Pedido avulso, default 1 | Definir pedido=1 e criar Entrega/Retirada sem escolha explícita. | Um job comercial, uma tentativa confirmada e uma via física. |
| Pedido avulso, default 2 | Definir pedido=2 e criar Entrega/Retirada sem escolha explícita. | Mesmo job chega a 1/2, pede decisão e só imprime 2/2 após confirmação. |
| Local sem vínculo de mesa | Criar pedido de balcão com modalidade textual `Local`, sem identidade/link de mesa. | Usa default de pedido; não é classificado como comanda. |
| Pedido ligado à mesa, defaults 1 e 2 | Repetir com identidade/link real de mesa e `tableTabDefaultCopies` em 1 e 2. | `copies_requested` segue a política de comanda, independentemente do texto da modalidade. |
| Resumo de comanda, defaults 1 e 2 | Solicitar impressão consolidada da comanda sem escolha explícita. | Job `table-tab`, `orderId=null`, número real da comanda e 1 ou 2 vias conforme política. |
| Escolha explícita | Em pedidos e comandas, solicitar explicitamente 1 e 2. | A escolha válida vence o default; valor inválido é rejeitado e não cria job. |
| Impressão de teste | Com defaults comerciais em 2, disparar Testar impressão uma vez. | Job/teste e saída física continuam sempre com uma via. |
| Segunda via dispensada | Em job comercial 2 vias, concluir 1/2 e dispensar. | Mesmo job fica terminal; nenhuma segunda saída física e nenhuma duplicação. |
| Retry conhecido | Produzir falha conhecida antes da confirmação e solicitar retry. | Mesmo job, snapshot e total de vias; via já confirmada não é repetida. |
| Resultado desconhecido | Interromper após submissão sem `COMPLETE` correlacionado. | `requires_attention`; nenhuma repetição automática. Resolver somente por decisão explícita. |
| Reprint | Concluir job de pedido e solicitar reimpressão 1/2. | Novo job manual com `parentJobId` do original e snapshot oficial atual; histórico original intacto. |
| Política alterada com fila pendente | Criar jobs, alterar defaults e só então executá-los. | Cada job conserva `copies_requested`; somente novos jobs usam a nova política. |
| Fechamento/transferência | Após 1/2 de uma comanda, fechar ou transferir a comanda e decidir a segunda via. | Job mantém `tableTabId`, número e documento originais; não cria pedido fictício. |
| Recovery com dois jobs | Deixar uma comanda 2 vias em 1/2 e outro job pendente; reconectar impressora. | Afinidade permanece no primeiro job até concluir/dispensar 2/2; só depois o próximo é elegível. |
| Solicitação remota | Solicitar de celular/tablet e observar o PC principal. | Dispositivo remoto apenas enfileira; somente a estação Windows principal executa fisicamente. |

## Inspeção do papel e evidência

- Conferir número de pedido/comanda, mesa, cliente quando aplicável, itens, quantidades, observações, totais, acentos e ausência de `undefined`, UUID técnico ou identidade inventada.
- Conferir largura, margens, contraste, avanço, serrilha/corte manual e ordem física 1/2 → pausa → 2/2.
- Fotografar cada resultado sem dados reais e associar o arquivo ao SHA/job/cenário. Captura de tela da fila não substitui a saída física.
- Em divergência, parar o cenário, preservar job/tentativas/logs e abrir um RED automatizável antes da correção. Não aprovar outro SHA por herança.

## Critério de encerramento

A rodada física só pode ser marcada como aprovada quando todos os cenários aplicáveis tiverem evidência no mesmo SHA de staging, zero duplicação automática em resultado desconhecido e a quantidade física coincidir com as confirmações correlacionadas. `TEST-INFRA-01` continua sendo bloqueio independente para merge/release mesmo que esta matriz passe.
