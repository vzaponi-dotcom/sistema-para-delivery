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

## Fix round 1 — criação independente da estação

### Finding e causa raiz

O review identificou que `createOrder` ainda condicionava a criação do job a `loadPrimaryAutomaticPrintStation`. O finding foi confirmado contra a especificação central: todo pedido elegível deve gerar um job mesmo sem estação disponível. A causa raiz era o uso da prontidão/configuração do executor físico como gate de persistência da fila. O próprio `prepareAutomaticPrintJobStatement` já separava corretamente os conceitos ao persistir `station_id = NULL`; a estação deve ser exigida somente no claim.

### TDD — RED

O contrato antigo que esperava zero jobs foi substituído antes da mudança de produção. O novo teste exige exatamente um job não atribuído quando:

- a estação primária tem `auto_print_enabled = 0`;
- existe somente estação secundária;
- a estação primária está offline (`last_seen_at = NULL`);
- não existe nenhuma estação;
- o checkout é repetido com a mesma chave nos cenários desabilitado e sem estação.

Comando:

```text
node --test worker/orderAutomaticPrintJob.test.js
```

RED observado:

```text
tests 9
pass 8
fail 1
Expected values to be strictly equal: 0 !== 1
```

### GREEN

Foi removida somente a consulta/gate de `loadPrimaryAutomaticPrintStation` na criação. O bloco de criação do job agora usa `status === 'Em preparo'` como condição de elegibilidade. Não houve mudança em claim, estação QZ, estados de fila ou transporte.

Comando focado:

```text
node --test worker/orderAutomaticPrintJob.test.js
```

Resultado:

```text
tests 9
pass 9
fail 0
```

### Alinhamento mínimo de fixture

A primeira suíte completa revelou uma única expectativa antiga em `worker/orderRepositories.test.js`: o batch de um pedido elegível agora contém quatro statements (pedido, snapshot de contato, item e job), mas a fixture exigia três.

Primeira execução completa:

```text
npm.cmd test
tests 681
pass 680
fail 1
worker/orderRepositories.test.js: 4 !== 3
```

O alinhamento foi restrito a mudar a expectativa de tamanho do batch de 3 para 4. A verificação conjunta passou:

```text
node --test worker/orderRepositories.test.js worker/orderAutomaticPrintJob.test.js
tests 14
pass 14
fail 0
```

### Verificação final

```text
npm.cmd test
tests 681
pass 681
fail 0
duration_ms 3455.4127
```

`git diff --check` retornou exit code 0, com apenas avisos informativos de LF/CRLF no Windows.

### Arquivos desta rodada

- `worker/repositories.js` — remove o gate de estação na criação do job.
- `worker/orderAutomaticPrintJob.test.js` — cobre desabilitada, secundária, offline, ausente, `station_id = NULL` e retry idempotente.
- `worker/orderRepositories.test.js` — alinha de 3 para 4 o tamanho esperado do batch.
- `.superpowers/sdd/2026-09-08-centralized-qz-print-queue-plan/task-2-1-report.md` — registra esta rodada.

### Auto-revisão da rodada

- Todo pedido com `status === 'Em preparo'` agenda exatamente um job na mesma transação do pedido.
- Pedido histórico/finalizado continua sem job automático.
- O job permanece não atribuído até claim; nenhum executor é escolhido na criação.
- A chave idempotente do pedido e o índice único do job preservam exatamente um pedido e um job em retries.
- A leitura da configuração central de vias permanece no momento da criação, inclusive sem estação.
- Claim, QZ, RawBT, Web Serial e a Tarefa 2.2 não foram alterados.
- Não foram encontrados problemas adicionais de correção, regressão ou escopo.

### Desvios e preocupações da rodada

- O único desvio foi o alinhamento mínimo da fixture de batch descrito acima, exigido pela nova garantia de criação. Nenhuma preocupação residual nova foi identificada.
