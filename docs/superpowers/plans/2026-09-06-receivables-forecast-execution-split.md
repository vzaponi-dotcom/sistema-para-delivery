# Receivables Forecast Redesign — Execution Split

**Status:** aprovado para execução dividida  
**Branch única:** `feature/receivables-forecast-redesign`  
**Spec:** `docs/superpowers/specs/2026-09-06-receivables-forecast-redesign-design.md`  
**Plano-base:** `docs/superpowers/plans/2026-09-06-receivables-forecast-redesign-plan.md`

## Objetivo desta divisão

Separar a implementação por risco para permitir que o Codex execute o núcleo crítico com TDD e que a camada de UX seja concluída depois inline, sem duas frentes editando a mesma área ao mesmo tempo.

A ordem é obrigatória:

1. Codex executa somente Tasks 1–4 do plano-base.
2. Codex valida, commita e envia todo o trabalho para a branch remota.
3. Codex para e entrega o handoff.
4. O trabalho é revisado pelo GitHub.
5. Somente depois da revisão começam inline as Tasks 5–10.

## Responsabilidade do Codex — Tasks 1–4

O Codex é responsável pelo núcleo crítico da feature:

### Task 1 — Domínio temporal de recebíveis

Implementar e testar as funções puras em `src/utils/receivables.js`, incluindo:

- data esperada = `promisedPaymentDate ?? orderDate`;
- Hoje / Próximos / Em atraso;
- dias de atraso;
- exclusão de cancelados;
- separação de pagos;
- resumo financeiro de pendentes;
- forecast de 7 dias + `later`;
- agregação de comandas;
- ordenação por urgência.

Apesar de estar em `src/`, esta task pertence ao Codex porque contém regra de negócio financeira usada por toda a UX posterior.

### Task 2 — Persistência e mapper

Implementar e testar:

- `migrations/0012_receivables_payment_promise.sql`;
- `orders.promised_payment_date TEXT NULL`;
- índice por `business_id, promised_payment_date`;
- nenhuma alteração/backfill destrutivo;
- inclusão em todos os selects oficiais de pedido;
- `promisedPaymentDate` no mapper oficial.

### Task 3 — Mutação server-side da promessa

Implementar e testar:

- `worker/orderPaymentPromise.js`;
- validação de data ISO real;
- data prometida somente hoje ou futura no momento da gravação;
- remoção com `null`;
- isolamento por `business_id`;
- bloqueio de pedido pago e cancelado;
- alteração exclusiva de `promised_payment_date`;
- garantia de que a mutação não cria `payments`, `movements` ou receita.

### Task 4 — API e sincronização oficial no App

Implementar e testar:

- `PATCH /api/orders/:id/payment-promise`;
- wrapper em `src/api/client.js`;
- handler em `src/App.jsx`;
- reconciliação com `applyOfficialEffects({ order })`;
- sem update otimista;
- passagem de `disabled` e `onUpdatePaymentPromise` para `Receivables`.

O Codex pode fazer somente as alterações mínimas em `src/App.jsx` e nas props necessárias para concluir a Task 4. Não deve iniciar redesign de `Receivables.jsx`.

## Responsabilidade inline — Tasks 5–10

Após revisão e aceite do handoff do Codex, a execução inline será responsável por:

- Task 5 — ledger, resumos, Pendentes/Quitados, filtros, busca e ordenação;
- Task 6 — bottom sheet mobile, painel lateral desktop, detalhe e diálogo da data prometida;
- Task 7 — Previsão de recebimentos e ícone de gráfico;
- Task 8 — ação rápida Registrar recebimento reutilizando o fluxo de pagamento existente;
- Task 9 — responsividade, acessibilidade, offline e acabamento visual;
- Task 10 — regressões completas, lint/build, D1 local, dry-run, PR, staging e homologação.

## Limites obrigatórios para o Codex

Durante esta rodada, o Codex NÃO deve:

- executar Task 5 ou qualquer task posterior;
- redesenhar `src/pages/Receivables.jsx`;
- criar `ReceivableDetail`, `PaymentPromiseDialog`, forecast dialog ou quick-payment dialog;
- alterar a UX visual além do mínimo de contrato exigido pela Task 4;
- fazer deploy em staging;
- fazer deploy em produção;
- alterar `master`;
- fazer merge;
- criar ou alterar workflow de produção;
- adicionar pagamentos parciais;
- adicionar vencimento padrão;
- alterar a regra de `scheduledFor` para cobrança;
- criar uma nova tabela de contas a receber;
- duplicar o fluxo atual de pagamento.

## TDD e commits

O Codex deve seguir TDD estrito conforme o plano-base:

- teste RED antes da implementação relevante;
- observar o RED;
- implementação mínima GREEN;
- rodar testes de regressão próximos;
- um commit por task concluída.

Commits esperados conceitualmente:

1. `feat: add receivables timing domain`
2. `feat: persist payment promise date`
3. `feat: add payment promise mutation`
4. `feat: expose payment promise API`

Os hashes reais devem ser informados no handoff.

## Regras de Git/worktree

- trabalhar exclusivamente na branch `feature/receivables-forecast-redesign`;
- antes de editar, buscar o HEAD remoto atual da branch;
- usar worktree nova e isolada baseada no HEAD remoto atual;
- não trabalhar na `master`;
- não usar a worktree antiga/suja de outras rodadas;
- não usar `reset`, `restore`, `clean` ou `stash` em worktree compartilhada/original;
- ao terminar cada task, commitar na branch;
- ao final da Task 4, fazer push de todos os commits para `origin/feature/receivables-forecast-redesign`.

## Verificação mínima antes do handoff

Após concluir Task 4, executar no mínimo:

```bash
node --test src/utils/receivables.test.js
node --test worker/paymentPromiseMigration.test.js worker/orderIdentityRepositoryMapping.test.js
node --test worker/orderPaymentPromise.test.js worker/orderRepositories.test.js
node --test worker/index.test.js src/AppReceivablesPromise.test.js
npm run d1:migrate:local
npm test
npm run lint
npm run build
```

Se algum teste existente falhar por regressão causada pelas Tasks 1–4, corrigir antes do handoff. Não resolver problemas de UX das Tasks 5–9 antecipadamente.

## Condição de parada obrigatória

Depois de Tasks 1–4 concluídas, verificadas e publicadas no GitHub, PARAR.

Não iniciar Task 5.

O handoff deve informar:

- HEAD inicial usado;
- HEAD final remoto;
- commits de cada Task 1–4;
- arquivos criados/modificados;
- testes executados e resultados;
- resultado de `npm test`, `npm run lint`, `npm run build` e `npm run d1:migrate:local`;
- qualquer divergência necessária em relação ao plano;
- confirmação explícita de que Task 5 não foi iniciada;
- confirmação de que tudo está em `origin/feature/receivables-forecast-redesign` para revisão externa.

## Handoff para execução inline

A execução inline só deve começar após confirmar no GitHub que:

- os quatro commits estão no remoto;
- migration e mapper estão coerentes;
- o endpoint não produz efeitos financeiros;
- `App.jsx` aplica a resposta oficial sem estado otimista;
- testes críticos estão verdes;
- nenhuma alteração de UX da Task 5+ foi iniciada.

A partir desse ponto, as Tasks 5–10 seguem exatamente o plano-base.