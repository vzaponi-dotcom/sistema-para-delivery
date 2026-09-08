# Relatório da Tarefa 2.1 — Pedido de mesa sempre cria 1 via automática

## Status

Implementação concluída no escopo definido pelo brief da Tarefa 2.1.

## Implementação

- `createOrder` continua usando a estação principal com impressão automática habilitada apenas como condição para criar o job.
- Quando o job automático será criado, o repositório lê `business_print_settings.default_copies` para o negócio.
- Pedidos identificados como mesa por `customerIdentity.type === 'table'` ou por `tableTabId` persistem `copies_requested = 1`.
- Entrega e retirada persistem o valor central vigente (1 ou 2) em `copies_requested`.
- Na ausência inesperada da linha central, o fallback permanece 2, coerente com o default do schema; a migration 0014 cria deterministicamente a linha para todos os negócios existentes.
- O valor é calculado apenas antes do `INSERT` do job e fica materializado nele. Alterações posteriores em `business_print_settings` não o recalculam.
- O retorno antecipado por `idempotency_key` e o índice único do job automático não foram alterados.

## TDD — RED

Primeiro foram adicionados testes comportamentais em `worker/orderAutomaticPrintJob.test.js`, junto do menor alinhamento da fixture local ao schema atual (`tables`, `table_tabs.table_id` e `business_print_settings`). A mudança de produção que esses testes deveriam detectar era a continuação do uso de `print_stations.default_copies` no lugar da configuração central e da regra de mesa.

Comando:

```text
node --test worker/orderAutomaticPrintJob.test.js
```

Resultado observado antes da implementação:

```text
tests 9
pass 5
fail 4
```

As quatro falhas foram as esperadas, todas com `actual: 2` e `expected: 1`:

- mesa com configuração central 2 deveria solicitar 1;
- entrega com configuração central 1 deveria solicitar 1;
- retirada com configuração central 1 deveria solicitar 1;
- snapshot criado com configuração 1 deveria continuar 1 após a configuração mudar para 2.

## TDD — GREEN e refactor

A implementação mínima adicionou a leitura da configuração central e calculou `automaticCopies` no bloco de criação do job, usando 1 para mesa e o default central para entrega/retirada.

Comando focado após a implementação:

```text
node --test worker/orderAutomaticPrintJob.test.js
```

Resultado:

```text
tests 9
pass 9
fail 0
```

Não houve refactor adicional: extrair uma nova abstração para uma única leitura e uma única decisão aumentaria o escopo sem melhorar o contrato.

## Verificação final

Tentativa inicial:

```text
npm test
```

O PowerShell bloqueou o wrapper `npm.ps1` por sua política local de execução; nenhum teste chegou a iniciar. O executável equivalente foi usado em seguida:

```text
npm.cmd test
```

Resultado da suíte completa:

```text
tests 681
pass 681
fail 0
duration_ms 3164.0649
```

Verificação de patch:

```text
git diff --check
```

Resultado: exit code 0; somente avisos informativos de conversão LF/CRLF do Git no Windows.

## Arquivos alterados

- `worker/repositories.js` — fonte central e regra de uma via para mesa na criação do job automático.
- `worker/orderAutomaticPrintJob.test.js` — contratos de mesa, entrega, retirada e snapshot imutável; fixture alinhada ao schema 0014/gestão de mesas.
- `.superpowers/sdd/2026-09-08-centralized-qz-print-queue-plan/task-2-1-report.md` — este relatório.

## Auto-revisão

- Requisitos do brief conferidos individualmente: mesa = 1 mesmo com central = 2; entrega e retirada cobrem 1 e 2; mudança posterior não altera o job; idempotência existente permanece coberta.
- A configuração central é consultada com `business_id`, mantendo isolamento entre negócios.
- A consulta ocorre somente para pedidos atuais que já satisfizeram a condição de estação automática; pedidos históricos e negócios sem estação automática mantêm o comportamento anterior.
- O snapshot usa literal independente nos testes e é verificado na linha realmente persistida, sem mock do repositório.
- Nenhuma rota, UI, QZ, RawBT, Web Serial, deploy ou comportamento da Tarefa 2.2 foi alterado.
- Não foram encontrados problemas de correção, regressão ou escopo no diff final.

## Desvios e preocupações

- Desvio operacional: foi necessário usar `npm.cmd test` porque a política de execução do PowerShell bloqueou `npm.ps1`; isso não altera o comando npm executado (`node --test`).
- A fixture do teste focado recebeu apenas as estruturas atuais necessárias para exercer a migration 0014 e o fluxo real de mesa. A suíte completa não exigiu outros alinhamentos.
- Preocupação residual baixa: o fallback 2 cobre uma linha central ausente, mas em produção a migration 0014 deve garantir essa linha; uma ausência indicaria inconsistência de dados a ser tratada em tarefa operacional separada.
