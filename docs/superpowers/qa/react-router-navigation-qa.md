# React Router Navigation — Staging QA

Date: 2026-09-23  
PR: #63 — Feature: React Router navigation  
Branch: `feature/react-router-navigation`  
Implementation base: `master@12f32d05401c59d9a3360d050df596a7c0803909`  
Pre-staging candidate before this QA commit: `9c7a388f2d7d74b19b6eb1af1d3037f2df7e2095`  
Status: **AUTOMATED GATES GREEN THROUGH TASK 7 — STAGING / MANUAL QA PENDING**

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
| Exact candidate Validate | PENDING | pending this commit |
| Deploy staging | PENDING | pending this commit |
| Staging login smoke | PENDING | pending deploy |
| Direct deep-link smoke | PENDING | pending deploy |
| Kitchen TV direct route shell | PENDING | pending deploy |
| Review threads | PENDING | final closure |
| Mergeability | PENDING | final closure |

## 5. Desktop manual QA

| # | Scenario | Status |
| --- | --- | --- |
| D1 | Login from `/` resolves to normal home | PENDING |
| D2 | Pedidos → Histórico → Comandas → Financeiro → Clientes → Configurações changes URL correctly | PENDING |
| D3 | Browser Back across multiple destinations | PENDING |
| D4 | Browser Forward across multiple destinations | PENDING |
| D5 | F5 on Pedidos preserves Pedidos | PENDING |
| D6 | F5 on Financeiro / A Receber preserves A Receber | PENDING |
| D7 | F5 on Configurações / Impressão preserves Impressão | PENDING |
| D8 | F5 on Comandas preserves Comandas | PENDING |
| D9 | Dirty New Order + sidebar navigation → Cancel stays in order | PENDING |
| D10 | Dirty New Order + sidebar navigation → Discard leaves order | PENDING |
| D11 | Dirty New Order + browser Back → Cancel stays | PENDING |
| D12 | Dirty New Order + browser Back → Discard follows history | PENDING |
| D13 | Dirty New Order + F5 shows native unload warning | PENDING |
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
