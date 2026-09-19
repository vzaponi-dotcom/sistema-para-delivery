# C8 — Catalog staging QA

**Date:** 2026-09-19  
**Branch:** `feature/spec-c8-catalog`  
**PR:** #52 draft/open  
**Base:** `a7a8285ee125d90058c739f52daba6c170921adb`  
**Validated code candidate before documentation update:** `ae4d09d44b1012fadf6cabcbe6eb190ef9ef4bfb`  
**Validate:** #1460 / run `35469241957` — SUCCESS, 1,860 tests / 1,859 pass / 0 fail / 1 skipped  
**Staging status:** **DEPLOYED / HOMOLOGATED**  
**Deploy staging:** #186 / run `35469861985` — SUCCESS  
**Staged SHA:** `8a43d10e02821aca2a839394e3bd6d1daf15fdc8`  
**Worker version:** `28e2622f-c904-4959-8433-33c9691661f3`  
**Manual QA:** **34 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**  
**Production:** NOT DEPLOYED

## Staging deployment evidence

- Manual workflow dispatch completed successfully: Deploy staging #186 / run `35469861985`.
- Exact deployed SHA: `8a43d10e02821aca2a839394e3bd6d1daf15fdc8`.
- Pre-deploy Validate #1461 / run `35469623626`: SUCCESS.
- Workflow gates before deploy: tests/architecture/lint/build/local D1/staging dry-run all PASS.
- Remote staging migrations: no pending migrations.
- Cloudflare Worker version: `28e2622f-c904-4959-8433-33c9691661f3`.
- Readiness: attempt 1/6.
- Login smoke: HTTP 200.
- URL: `https://sistema-para-delivery-staging.vzaponi.workers.dev`.

## Manual QA matrix

| Nº | Caso | Resultado esperado | Estado |
|---:|---|---|---|
| 1 | Produtos desktop claro/escuro | Mesma hierarquia visual, textos e ações | PASS |
| 2 | Buscar nome | Trim/case atuais, sem mudança de acentos | PASS |
| 3 | Buscar categoria | Categoria visual, inclusive Outros | PASS |
| 4 | Buscar apresentação | P/Família/350 ml/localização atual | PASS |
| 5 | Buscar preço | Semântica `String(price)`, não busca BRL nova | PASS |
| 6 | Filtro Todos | Coleção completa visível | PASS |
| 7 | Filtro específico + busca | Interseção correta | PASS |
| 8 | Expandir/recolher | Accordion preservado; busca/filtro expande como antes | PASS |
| 9 | Criar Unidade | Nome, preço, retorno oficial, mensagem atual | PASS |
| 10 | Criar Tamanho P/M/G | Presets e preço preservados | PASS |
| 11 | Tamanho Outro | Texto customizado; até 24 caracteres | PASS |
| 12 | Volume com vírgula/ponto | ml/L; exibição localizada | PASS |
| 13 | Peso | g/kg; decimal positivo | PASS |
| 14 | Apresentação inválida | Submit bloqueado, mensagem atual | PASS |
| 15 | Editar estruturado | Mantém preço e apresentação; sucesso oficial | PASS |
| 16 | Legado | Size/categoria fallback; BLOCKED se não existir fixture adequada | PASS |
| 17 | Excluir/cancelar | Sem request ou efeito de remoção | PASS |
| 18 | Excluir/confirmar | Remove somente após sucesso; toast atual | PASS |
| 19 | Seleção desktop | Marcar/desmarcar/cancelar; contador correto | PASS |
| 20 | Bulk | Sequencial, sem perda indevida da seleção durante pending | PASS |
| 21 | Long press mobile | 550 ms, sem duplo toggle; scroll/cancel atuais | PASS |
| 22 | Toolbar mobile 320–640 px | Portal/fixed/sticky e safe area sem clipping | PASS |
| 23 | Formulário mobile | Decimal, digitação/foco contínuo e preview | PASS |
| 24 | Offline | Lista/busca/filtro funcionam; writes não são enviados | PASS |
| 25 | Novo Pedido: busca | Nome/categoria/apresentação sem preço adicionado à busca | PASS |
| 26 | Novo Pedido: categoria | Inicial vazio; categorias disponíveis; busca prevalece como antes | PASS |
| 27 | Carrinho | Adicionar, aumentar, diminuir; `Un`/apresentação preservados | PASS |
| 28 | Sync oficial | Create/update/delete continuam corretos após refresh | PASS |
| 29 | Logout/login | Editor e seleção não ressuscitam | PASS |
| 30 | Restricted/read-only | Sem ações de gestão; BLOCKED sem identidade adequada | BLOCKED |
| 31 | Preço inicial/foco | Novo zero uma vez; edição mantém valor; digitação não perde foco | PASS |
| 32 | Falha de exclusão controlada | Erro global; dialog/seleção encerram conforme baseline, sem falso sucesso | PASS |
| 33 | Request lento | Serialização global preservada; sem submissão duplicada pela UI | PASS |
| 34 | Retorno ao destino | Query preservada; lista reseta estado local conforme baseline | PASS |
| 35 | Smoke operacional | Criar pedido com produto disponível; demais áreas sem regressão evidente | PASS |

## Closure

Task 9 is **COMPLETE / STAGING HOMOLOGATED**. Final manual result: **34 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**. The single accepted BLOCKED is case 30 because there is no suitable restricted/read-only capability identity in staging; it is not counted as PASS. No corrective code changes were required. Hardware printing remains outside this proportional C8 matrix and was not inferred from print-queue visibility.

The staged/homologated executable is SHA `8a43d10e02821aca2a839394e3bd6d1daf15fdc8`. Documentation-only commits after this point must be recorded separately and validated on their own HEAD before merge.


## Task 10 handoff

- Manual QA is closed at **34 PASS / 0 FAIL / 1 BLOCKED / 0 PENDING**.
- Homologated executable remains `8a43d10e02821aca2a839394e3bd6d1daf15fdc8`; later commits are documentation-only and do not replace the staged SHA.
- Case 30 remains the single accepted BLOCKED due to missing restricted/read-only capability identity; no FAIL/PENDING remains.
- No code change was required after staging. Production was not deployed.
- Before merge, the final documentation-only branch HEAD must pass the full Validate workflow and merge requires a separate explicit user authorization.
