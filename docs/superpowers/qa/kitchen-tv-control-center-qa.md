# Kitchen TV Control Center — QA Closure

Date: 2026-09-28 / 2026-09-29  
PR: #81  
Branch: `feature/kitchen-tv-control-center`

## 1. Scope and immutable references

- Base commit: `18f37ff68bcad478f9d34800c4378044424cb769`
- Approved spec: `docs/superpowers/specs/2026-09-28-kitchen-tv-control-center-design.md`
  - Git blob SHA: `c7b6294402b3a1f83513096326ce8c2adf13face`
- Approved plan: `docs/superpowers/plans/2026-09-28-kitchen-tv-control-center-plan.md`
  - Git blob SHA: `2b4b81db50698f7ba75665f362f6c5551108cb63`
- Migration: `migrations/0032_kitchen_tv_control.sql`
  - Git blob SHA: `68b4e65da5c03dbd9d27f15e651d2fcbc9fa05bb`
- Exact product candidate: `c426a1d765559ef1d9508d2df4df7482e1d29b1d`

The exact product candidate above is the homologated application state. This document is a documentation-only successor and does not replace candidate evidence.

## 2. Automated gates

Exact product candidate `c426a1d765559ef1d9508d2df4df7482e1d29b1d`:

- Validate application: **#2504 / run 36509035540 — SUCCESS**
- All 8 test shards: PASS
- Frontend architecture: PASS
- Lint: PASS
- Build: PASS
- Production Worker dry-run: PASS
- Staging Worker dry-run: PASS
- Local D1 migrations: PASS
- Spec B D1 clean install/upgrade gate: PASS
- Operation-profile D1 clean install/upgrade gate: PASS

Staging:

- Deploy staging: **#561 / run 36509032327 — SUCCESS**
- Test aggregate: **2,647 total / 2,646 pass / 0 fail / 1 skipped**
- Remote migrations: **No migrations to apply**
- Staging login: **HTTP 200**
- Direct deep link `/pedidos/controle-da-tv`: **HTTP 200 / SPA shell + assets OK**
- Staging Worker Version ID: `76333391-a276-4e7d-b2b5-82e75d4911b1`
- Staging URL: `https://sistema-para-delivery-staging.vzaponi.workers.dev`

Migration 0032 was previously applied successfully in staging and subsequent exact-candidate staging runs reported no pending migrations.

## 3. TDD evidence

The implementation followed RED → GREEN checkpoints throughout the plan. Key final-round evidence includes:

- Task 8 compact control surface:
  - RED: `af0e2b7edff7576a5513a9a1380ce150587eeb23`, `b84b15db8a9914c1a7881a018007a76afbb6f671`
  - GREEN checkpoint: `5c295f447b62bcec96b5dff7792a571da579d98d`
- Task 9 actions/navigation:
  - RED: `e8be6a3f050515edf7ef998a71d9ab4ca1a8ae8e`, `44c990460c2fc587402fb7b1703ddf8a2fffcb73`, `d67438c97bb8e9a6a1c4e3db4492ea8d05361a43`
  - GREEN checkpoint: `3e399fe9821b15d9d178bc0fb4611f0113c6dd85`
- Task 10 hardening:
  - RED: `d2bba4ecd7e2c62166c84fcdc87b37eca834dd96`, `adc11af2f93641350522696a45bd7b6a65d97491`, `679349210b38bdc5fbe497ea2bc650b32cad9973`
  - GREEN/security checkpoints: `ab14dfcb1f71125829e4e7bc551606d97d37011e`, `10244144673f2c996eb2640d9bb39e259d1f5a72`, `818a2c88b31f7df16881fb401168b0f053840dc8`
- Real-device heartbeat fix:
  - RED: `fa2bd1bc7db1d02870c1953a602838fd01b7c958`
  - GREEN: `3a33f0fc941fea5ca2dfdc8715dd446e7b799bac`
- Current-page mirroring:
  - RED: `0abf3518592b97181f8edb74e3c563bcc1669fae`
  - GREEN: `91dd4414977d781a4b4a9051f89a817136e9c689`
  - Test-alignment successor: `8e88cda079c9d3692514f1ebec2bf67b4d69214c`
- Approved mobile proportion polish:
  - RED: `3e994262004e603cefc0f93b3d39d7bd7fedd062`
  - GREEN: `1344eed93e8ed0d04223a1e71e4a29d3a8e6eee4`
- Remove-action interaction polish:
  - RED: `daf6468dedf8a172f8222cf6dbbdd94fbce41207`
  - GREEN: `ab3ad4b0bcee69c5217d375d5de1422928c602dd`
- Immersive mobile + item snapshot:
  - RED: `c7913a32a55381762eb7feed17969f8f30c0eaf8`
  - first GREEN: `e1cfe1f35c5491daa9822f94705fc74b281ed0f8`
  - final boundary/alignment fix: `c426a1d765559ef1d9508d2df4df7482e1d29b1d`

## 4. Mobile QA — PASS

Real-device mobile QA was executed against staging and reported **PASS** for:

1. Direct route `/pedidos/controle-da-tv`.
2. Approved compact/immersive header and navigation hierarchy.
3. Larger approved mobile card proportions with scrolling.
4. Current TV page mirrored exactly in the controller.
5. Anterior / Início / Próxima page navigation.
6. New arrival while on page 2 resets TV/controller to page 1.
7. Old page-2 command does not replay after arrival reset.
8. Hide removes the order from TV/controller but leaves it active in Pedidos → Cozinha.
9. Restore through **Retirados N**.
10. Canonical print snapshot shows item quantity/name/presentation/note.
11. Operational snapshot does not render phone, address, payment or financial values.
12. Scheduled-order presentation and control restrictions.
13. Immersive mobile surface and vertical scrolling.
14. Light theme.
15. Dark theme.
16. F5/direct deep-link recovery.

Approved deviations from the original early checklist:

- Inline **Undo** was intentionally removed; restoration is through **Retirados N**.
- **Ver na Cozinha** was intentionally removed; the action sheet now exposes the item snapshot instead.
- The fixed “10 cards simultaneously visible” target was superseded by the approved larger-card mobile layout with normal vertical scrolling.

## 5. Real TV + phone paired QA — PASS

Real TV and real phone were used together. Reported **PASS** for:

1. Single-page button bounds.
2. 2+ page indicator parity.
3. Próxima remote paging.
4. Anterior remote paging.
5. Início remote paging.
6. TV/controller current-page and visible-order parity.
7. New arrival from page 2 returns to page 1 and alerts once.
8. Old page command does not replay.
9. Hide visible order removes it only from the TV/controller projection.
10. Hidden order remains officially active in Pedidos → Cozinha.
11. Restore returns the order according to the TV solver.
12. Page-count shrink and current-page clamp.
13. Official finalize clears hidden state.
14. Official cancel clears hidden state.
15. Scheduled-order presentation/priority.
16. Fullscreen enter/exit state stability.
17. TV offline → stale transition.
18. TV reconnect → automatic recovery.
19. One-minute idle heartbeat stability with no recurring “TV sem sinal” flash.

## 6. Concurrency QA — PASS

Two administrative sessions were used against the same paired TV. Reported **PASS** for:

- alternating page commands;
- rapid Próxima / Início / Próxima commands across sessions;
- last-write-wins convergence;
- hide of the same order from both sessions;
- restore of the same order from both sessions;
- no duplicated hidden state;
- no corrupted page state;
- both controllers converging on authoritative TV telemetry.

## 7. Privacy/security smoke — PASS

Manual smoke was reported **PASS** for:

- controller grid continues to use the existing admin Orders runtime;
- `/api/kitchen-tv/control` does not expose phone, address, payment, totals, PIN or administrative capability/session data;
- TV state remains minimal;
- TV session cannot execute administrative control mutations;
- the item snapshot uses the existing canonical print-document route, while this operational UI renders only item quantity/name/presentation/note;
- `orders.kitchen.control` remains separated from official order finalization;
- Settings-management permissions remain separate from kitchen-control permissions.

Automated security regressions also cover revocation, capability separation, terminal cleanup, stale/offline fail-closed behavior and architecture boundaries.

## 8. Known limitations / approved product decisions

- Mobile “fullscreen” is an immersive in-app surface, not the browser/OS Fullscreen API. This avoids browser permission differences while hiding the global top and bottom navigation on the control screen.
- The control grid mirrors the TV's reported current page. Hidden orders are intentionally managed in the separate **Retirados N** panel.
- **Fora da tela** is intentionally retained as the complementary count of active eligible orders on other TV pages.
- The item snapshot is an operational subset of the canonical print document; the UI intentionally omits contact and financial data.
- One automated suite remains skipped in the repository-wide total; no new failure or blocking finding is associated with this feature.

No blocking, high or medium finding remains open for this scope.

## 9. PR closure state

- Tasks 1–11: **COMPLETE / GREEN**
- Exact product candidate: `c426a1d765559ef1d9508d2df4df7482e1d29b1d`
- Exact candidate Validate: **#2504 / run 36509035540 — SUCCESS**
- Exact candidate staging deploy: **#561 / run 36509032327 — SUCCESS**
- Mobile QA: **PASS**
- Real TV + phone QA: **PASS**
- Concurrency QA: **PASS**
- Privacy/security smoke: **PASS**
- Unresolved review threads before QA-document commit: **0**
- Merge: **NOT EXECUTED**
- Production: **NO DEPLOY**

## 10. Release gate

The Kitchen TV Control Center implementation is homologated in staging and ready for explicit merge authorization.

Production remains a separate authorization step and has not been deployed by this work.
