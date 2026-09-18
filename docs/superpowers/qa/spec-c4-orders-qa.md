# Spec C4 — Orders — QA

## Execution identity

- Slice: C4 — Orders
- Branch: `feature/spec-c4-orders`
- Base SHA: `737beeac2150aabeb39024af823f2f60fee25108`
- Executable SHA: `e7f05b6d6d8364c0482a7fe03949c001816e8e85`
- Last code-changing SHA before Task 11 QA docs: `d42bb42ba97f772c5e1fcd01dd1b9480ab02d0f4`
- PR: #48 — draft, open, not merged
- Production deploy: **NO**
- Merge: **NO**
- Status: **AUTOMATED GATES GREEN — STAGING PENDING**

## Automated gates

This ChatGPT session does not have a checked-out Git worktree/runner for this repository, so the Task 11 local command list was **not independently rerun locally**. No local PASS is claimed.

Authoritative GitHub evidence on the exact pre-QA-docs HEAD:

- Validate application: **#1262**
- Run ID: `35297928408`
- Event: `pull_request`
- Head SHA: `e7f05b6d6d8364c0482a7fe03949c001816e8e85`
- Conclusion: **success**
- `npm test`: **1,687 tests / 1,686 pass / 0 fail / 1 skipped**
- `npm run test:architecture`: **PASS** — `Frontend architecture boundaries: OK`
- `npm run lint`: **PASS**
- `npm run build`: **PASS**
- production Worker dry-run: **PASS**
- staging Worker dry-run: **PASS**
- `npm run d1:migrate:local`: **PASS**
- Spec B D1 clean-install/upgrade gate: **PASS**

`git status --short` and `git diff --check` are local-worktree checks and were not available in this connector-only session. GitHub branch state and commit diffs were inspected directly instead.

## Scope audit

Compared `origin/master` / base SHA `737beeac2150aabeb39024af823f2f60fee25108` to executable SHA `e7f05b6d6d8364c0482a7fe03949c001816e8e85`:

- `master` still points to the approved C4 base SHA; no master drift is present.
- No files under `worker/` changed.
- No files under `migrations/` changed.
- `src/printing/` changes are test-only path updates:
  - `src/printing/finalizedOrderSecondCopyPrompt.test.js`
  - `src/printing/printingManagerRegression.test.js`
  - `src/printing/printingUi.test.js`
- No C9 printing runtime refactor is part of C4.
- The permanent architecture gate rejects non-Orders deep imports into `src/domains/orders/**`.
- C4 legacy Orders owner paths are physically absent and protected against reintroduction.
- Migrated lifecycle exports `getOrders`, `createOrder`, `updateOrderStatus`, and `cancelOrder` are protected against reintroduction in `src/api/client.js`.

## GitHub Validate

Pre-staging executable validation:

| Field | Value |
|---|---|
| Workflow | Validate application |
| Run number | #1262 |
| Run ID | `35297928408` |
| Event | `pull_request` |
| Head SHA | `e7f05b6d6d8364c0482a7fe03949c001816e8e85` |
| Conclusion | **success** |

Pre-staging QA documentation validation:

| Field | Value |
|---|---|
| Workflow | Validate application |
| Run number | #1263 |
| Run ID | `35298379927` |
| Event | `pull_request` |
| Head SHA | `d625776952d1b58e1c4222830499913e42563f12` |
| Conclusion | **success** |

Run #1263 also completed the full test, architecture, lint, build, Worker dry-run, local D1, and Spec B D1 gate set successfully.

## Staging deployment

- Status: **SUCCESS**
- Workflow: `Deploy staging`
- Run number: **#180**
- Run ID: `35298763053`
- Event: `workflow_dispatch`
- Deployed SHA: `badfbcb7b5793a5b444c34950883d1216c4c42bd`
- Branch: `feature/spec-c4-orders`
- URL: https://sistema-para-delivery-staging.vzaponi.workers.dev
- Workflow evidence: tests, architecture, lint, build, local D1, staging Worker dry-run, staging migrations, PIN configuration, deploy and staging-login smoke all passed.
- Production workflow: **NOT TRIGGERED**

## Manual staging homologation matrix

Manual PASS requires direct observation. Automated evidence does not upgrade any row.

| # | Scenario | Status | Evidence / notes |
|---:|---|---|---|
| 1 | Novo Pedido imediato — abrir, preencher, salvar, retornar | PASS | Observado manualmente em staging; fluxo concluído normalmente. |
| 2 | Novo Pedido agendado — horário e validação de mesmo dia | PASS | Observado manualmente em staging; agendamento e validação ocorreram normalmente. |
| 3 | Draft sujo — continuar editando / descartar | PASS | Observado manualmente em staging; continuar editando e descartar funcionaram corretamente. |
| 4 | Novo Pedido vindo de Comandas — contexto e retorno | PASS | Observado manualmente em staging; contexto, vínculo e retorno funcionaram corretamente. |
| 5 | POLICY_CHANGED — feedback/retry se reproduzível com segurança | PENDING | — |
| 6 | Cozinha — filas imediato/agendado e regra temporal | PENDING | — |
| 7 | Cozinha — busca cliente/pedido/produto/tipo | PENDING | — |
| 8 | Cozinha — chegada nova sem reload | PENDING | — |
| 9 | Cozinha — som/highlight uma vez e preferência local | PENDING | — |
| 10 | Cozinha — finalização e mensagem de sucesso | PENDING | — |
| 11 | Cozinha — cancelamento, motivo e permissão de estorno | PENDING | — |
| 12 | Histórico — filtros, detalhes e metadados de cancelamento | PENDING | — |
| 13 | Cozinha/Histórico — pagamento externo continua abrindo | PENDING | — |
| 14 | Detalhe — entrada de impressão permanece igual | PENDING | — |
| 15 | Settings Operação — carregar/editar/salvar/cancelar | PENDING | — |
| 16 | Settings Modalidades — mesmo draft de Operação, sem prompt interno | PENDING | — |
| 17 | Settings Cancelamentos — adicionar/editar/ordenar/salvar/cancelar/read-only | PENDING | — |
| 18 | Desktop claro/escuro — Cozinha/Novo Pedido/Histórico | PENDING | — |
| 19 | Mobile/narrow claro/escuro — Cozinha/Novo Pedido/Histórico | PENDING | — |
| 20 | Console — nenhum novo erro atribuível à C4 | PENDING | — |

Current manual result: **4 PASS / 0 FAIL / 16 PENDING**.

Task 11 must stop merge preparation on any manual FAIL. BLOCKED is allowed only with an explicit, honest reason.
