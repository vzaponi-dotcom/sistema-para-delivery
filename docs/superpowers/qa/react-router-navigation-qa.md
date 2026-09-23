# React Router Navigation — Staging QA

Date: 2026-09-23  
PR: #63 — Feature: React Router navigation  
Branch: `feature/react-router-navigation`  
Implementation base: `master@12f32d05401c59d9a3360d050df596a7c0803909`  
Pre-staging candidate before this QA commit: `9c7a388f2d7d74b19b6eb1af1d3037f2df7e2095`  
Status: **TASK 8 MANUAL QA IN PROGRESS — finance nested-route reload defect FIXED / RE-TEST PASS**

## 1. Scope

This QA closes the migration from local `activeTab` navigation to URL-backed React Router navigation.

No production deployment is authorized by this document.

## 2. Completed automated evidence before staging

- Task 1: COMPLETE / GREEN
- Task 2: COMPLETE / GREEN
- Task 3: COMPLETE / GREEN
- Task 4: COMPLETE / GREEN
- Task 5: COMPLETE / GREEN
- Task 6: COMPLETE / GREEN
- Task 7: COMPLETE / GREEN
- Latest pre-staging Validate: **#1839 / run 35879885337 — SUCCESS**
- 8/8 test shards: PASS
- architecture: PASS
- lint: PASS
- build: PASS
- Worker production dry-run: PASS
- Worker staging dry-run: PASS
- D1 local: PASS
- Spec B D1: PASS
- Kitchen TV/admin build split: PASS

## 3. Staging automation for Task 8

The staging workflow is bound to `feature/react-router-navigation` for this feature and must:

1. run the full test suite;
2. run architecture/lint/build;
3. apply/verify staging migrations;
4. deploy staging;
5. verify staging auth/login readiness;
6. verify direct SPA loads for:
   - `/pedidos`
   - `/pedidos/historico`
   - `/comandas`
   - `/financeiro/a-receber`
   - `/configuracoes/impressao`
   - `/cozinha-tv`

Staging URL: `https://sistema-para-delivery-staging.vzaponi.workers.dev`

## 4. Automated Task 8 evidence

| Check | Status | Evidence |
| --- | --- | --- |
| Exact candidate Validate | PASS | #1846 / run 35890412473 on `886f1b7a2c174cf3b56c1db06c1f703fafe648d1` |
| Deploy staging | PASS | #231 / run 35890407152 |
| Staging login smoke | PASS | HTTP 200 |
| Direct deep-link smoke | PASS | SPA shell + JS/CSS assets |
| Kitchen TV direct route shell | PASS | `/cozinha-tv` shell + assets |
| Review threads | PENDING | final closure |
| Mergeability | PENDING | final closure |

## 5. Desktop manual QA

| # | Scenario | Status |
| --- | --- | --- |
| D1 | Login from `/` resolves to normal home | PASS |
| D2 | Pedidos → Histórico → Comandas → Financeiro → Clientes → Configurações changes URL correctly | PASS |
| D3 | Browser Back across multiple destinations | PASS |
| D4 | Browser Forward across multiple destinations | PASS |
| D5 | F5 on Pedidos preserves Pedidos | PASS |
| D6 | F5 on Financeiro / A Receber preserves A Receber | PASS |
| D7 | F5 on Configurações / Impressão preserves Impressão | PASS |
| D8 | F5 on Comandas preserves Comandas | PASS |
| D9 | Dirty New Order + sidebar navigation → Cancel stays in order | PASS |
| D10 | Dirty New Order + sidebar navigation → Discard leaves order | PASS |
| D11 | Dirty New Order + browser Back → Cancel stays | PASS |
| D12 | Dirty New Order + browser Back → Discard follows history | PASS |
| D13 | Dirty New Order + F5 shows native unload warning | PASS |
| D14 | Settings dirty + same-resource move does not prompt | PENDING |
| D15 | Settings dirty + leave resource prompts | PENDING |
| D16 | Print Queue → Printing Settings reaches `/configuracoes/impressao` | PENDING |
| D17 | Logout from non-home route resets next login to normal home | PENDING |
| D18 | No visual/layout regression in shell/content | PENDING |

## 6. Mobile manual QA

| # | Scenario | Status |
| --- | --- | --- |
| M1 | Bottom navigation changes real URLs | PENDING |
| M2 | Comandas navigation works | PENDING |
| M3 | Financeiro navigation works | PENDING |
| M4 | Mais → Clientes / Produtos / Configurações works | PENDING |
| M5 | Mais closes after route change | PENDING |
| M6 | Browser Back/Forward works | PENDING |
| M7 | Page opens at top after destination change | PENDING |
| M8 | Dirty New Order guard works | PENDING |
| M9 | Dirty Settings guard works | PENDING |
| M10 | No horizontal overflow/navigation visual regression | PENDING |

## 7. Permission / restricted-route QA

Automated unit/integration coverage is already GREEN for:

- allowed route;
- denied route;
- unknown route;
- area fallback;
- capability revoked while a confirmation is open.

Manual restricted-capability QA is only required if a safe staging fixture/session is available.

## 8. Kitchen TV regression

| Scenario | Status |
| --- | --- |
| `/cozinha-tv` direct load returns TV entry | PENDING |
| Existing pairing/runtime remains usable | PENDING |
| Admin Router UI does not appear in TV | PENDING |
| Admin session is not reused as TV session | PENDING |

Physical-TV re-homologation is not required unless browser/build evidence reveals a material Kitchen TV entry/runtime change.

## 9. Production

**NOT DEPLOYED / NOT AUTHORIZED**

## 10. Closure rule

Task 8 may be closed only after:

- exact candidate Validate is green;
- exact candidate is deployed to staging;
- automated deep-link/login smoke is green;
- required manual desktop/mobile QA is recorded;
- Kitchen TV regression is recorded;
- PR review threads/mergeability are checked;
- final documentation SHA is recorded.

Merge remains blocked until explicit user authorization.


## 11. Manual QA finding — nested Finance reload

During manual QA on 2026-09-23:

- D1–D3: PASS
- D4 partial:
  - Pedidos reload: PASS
  - Comandas reload: PASS
  - Configurações / Impressão reload: PASS in manual observation
  - A Receber reload: FAIL — blank page
  - Movimentações reload: FAIL — blank page
- D9–D13 (New Order guards): PASS in the tested scenarios.

Investigation evidence:

1. Direct authenticated App tests for `/financeiro/a-receber` and `/financeiro/movimentacoes` pass, proving the Finance surfaces and Router match correctly once JS is running.
2. Vite was configured with `base: './'`, which emits relative build asset references and is unsafe for nested SPA paths served from the domain root.
3. TDD RED SHA `14940a8d680a9e61f091b0cfda4bd823bf1f3302` / Validate #1842 proves the required absolute asset base was absent.
4. Correction changes Vite to `base: '/'`.
5. Staging deep-link smoke is strengthened to fetch every JS/CSS reference resolved from each nested page URL and assert a successful non-HTML asset MIME response.

D4/D6 nested Finance reload defect is CLOSED: A Receber and Movimentações were manually reloaded successfully after the corrected staging deploy.


### Staging asset propagation note

The first corrected staging deploy published Worker version `e39d4460-2e18-4693-89b9-364234497fd1` and passed login. The strengthened asset smoke then observed one newly uploaded JS asset temporarily resolve to the SPA HTML immediately after deployment.

Build/upload evidence proved the asset existed and was uploaded. The smoke is therefore bounded-retry hardened (same six-attempt policy used by staging readiness) so transient edge propagation does not create a false negative, while a persistent HTML/404 asset response still fails the deployment.


### Corrected staging candidate after D6 failure

- Final fix SHA: `0ce79d61b0243e0f7887b8226b715b22e72584f6`
- Validate **#1844** / run `35889522226` — **SUCCESS**
- Deploy staging **#229** / run `35889513881` — **SUCCESS**
- Worker version: `dac0148d-d09b-4f2a-8b9a-7c40fd9b1d5b`
- Vite base changed from `./` to `/` so nested SPA routes load root-absolute assets.
- Deep-link smoke now validates both SPA shell and referenced JS/CSS assets.
- Automated staging asset smoke PASS:
  - `/pedidos`
  - `/pedidos/historico`
  - `/comandas`
  - `/financeiro/a-receber`
  - `/configuracoes/impressao`
  - `/cozinha-tv`
- D6 manual status: **PASS**.
- Movimentações nested reload (`/financeiro/movimentacoes`): **PASS**.
- Final hardened smoke commit: `886f1b7a2c174cf3b56c1db06c1f703fafe648d1`.
- Validate **#1846** / run `35890412473` — **SUCCESS**.
- Deploy staging **#231** / run `35890407152` — **SUCCESS**.
- Worker version: `722464df-5996-4639-9d69-d04e033e6268`.
- Automated smoke PASS for both `/financeiro/a-receber` and `/financeiro/movimentacoes` with SPA shell + referenced JS/CSS assets.
