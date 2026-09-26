# Centro de Relatórios — Execution Ledger

Issue: #34  
Branch: `feature/issue-34-reporting-center`  
PR: #72 (draft)  
Spec: `docs/superpowers/specs/2026-09-25-reporting-center-design.md`  
Plan: `docs/superpowers/plans/2026-09-25-reporting-center-plan.md`  
Production: NO DEPLOY

## Preparation

- Approved documentary HEAD: `737b9a5f288cad568a8994bb413db165120ee802`.
- Master baseline: `6445098aef8332890b854f6eb8524b5f9c053b8f`.
- Draft PR #72 created from the approved documentary branch.
- Baseline Validate #2056 / run `36147998594` failed in an unrelated date-sensitive fixture:
  `business profile receipt lookup requires manage while invalid receipt resources remain rejected`.
- Root cause: the fixture persisted a receipt at fixed `2026-09-24T03:50:00.000Z`; the production 24-hour receipt TTL correctly considered it expired when CI ran on 2026-09-25.
- Baseline-only correction: `1d77305e1e8d6f126129d1ad5515187c3a0ec0ea` — the test now creates that receipt at the current test execution time; production code is unchanged.
- Validate #2057 / run `36148492907`: SUCCESS on the corrected baseline.

## Task 1 — Reporting boundary, capabilities, navigation and URL state

Status: **COMPLETE / GREEN**

### RED

Commit: `6eee82bb2d79f574d17df0ae41bfa0352ddadef3`  
Message: `test: define reporting navigation boundary`

Validate #2058 / run `36149045311`: intended failure.

The RED proved the missing contracts:

- `reports.view` / `reports.export` absent;
- `reports` destination and `/relatorios` absent;
- Finance area/desktop navigation missing Reporting;
- Router resolved `/relatorios` as unknown;
- Reporting query module absent;
- Reporting URL hook absent;
- App did not compose Reporting.

No parser/harness failure was used as the TDD signal.

### GREEN

Primary implementation commit: `e9056a126796619f32e5097fe43945ec74ed401c`  
Message: `feat: add reporting navigation shell`

The first full run exposed one implementation import-path error only:
`../../../shared/finance.js` resolved to `src/shared` instead of repository-level `shared`.

Correction commit: `a0dd7347a17294889437a283171a16a5a9a2c2b0`  
Message: `fix: correct reporting shared finance import`

Validate #2060 / run `36149650569`: **SUCCESS**

Test totals:
- 2,364 tests
- 2,363 pass
- 0 fail
- 1 skipped

Required gates:
- frontend architecture: PASS
- lint: PASS
- build: PASS
- production Worker dry-run: PASS
- staging Worker dry-run: PASS
- local D1 migrations: PASS
- Spec B D1 clean-install/upgrade: PASS
- operation-profile D1 clean-install/upgrade: PASS

### Delivered contracts

- canonical capabilities `reports.view` and `reports.export`;
- destination `reports` at `/relatorios`;
- Finance order: Visão geral -> Relatórios -> A receber -> Movimentações;
- no new mobile bottom-nav destination;
- React Router direct route/F5 support through canonical registry;
- `src/domains/reporting` public boundary;
- Reporting URL query normalization/serialization;
- population-changing filters reset detail page to 1;
- App composes `ReportingWorkspace` without passing orders, movements, products or clients;
- shell contains AreaNavigation, PageHeader, internal report tabs and a non-metric placeholder;
- no Reporting backend/API yet;
- no D1/schema change;
- no staging deploy;
- no production action.

### Task 1 acceptance

- [x] `/relatorios` exists.
- [x] Financeiro shows Relatórios.
- [x] Mobile bottom bar is unchanged.
- [x] No business KPI is calculated yet.
- [x] App does not pass operational collections to Reporting.
- [x] Worker/D1 behavior unchanged.

## Baseline stabilization before Task 2

- RED: `operationProfileR2Regression.test.js` failed despite the required staging branch already existing in the YAML.
- Cause: parsing/assertion was sensitive to CRLF.
- Fix: test-only CRLF-to-LF normalization; no production code or staging workflow behavior changed.
- Commit: `c2d129dd` — `test: make staging workflow regression CRLF-safe`.
- Focused GREEN: operation-profile plus production-safety regression tests, 11/11.

## Task 2–12 local commits

- Task 2 `e7de3c51`; Task 3 `f247aeb0`; Task 4 `c8b0cde2`; Task 5 `83311f55`.
- Task 6 `147aea19`; Task 7 `1afc8674`; Task 8 `78f10287`; Task 9 `4579055a`.
- Task 10 `3ddf2024`; Task 11 `2867b37e`; Task 12 `3896c532`.

## Task 13 — Candidate verification

- First full-suite run: 2,386 pass / 1 fail (`systemSelectMigration`); root cause was a native select in ReportingFilters.
- Correction uses the existing `SystemSelect`; focused regression plus build: GREEN.
- Serial full-suite rerun: 2,387 tests, 2,386 pass, 0 fail, 1 skipped (the serial mode avoids the Vite harness port race).
- Frontend architecture, lint (pre-existing warnings only) and build: PASS.
- Production and staging Worker dry-runs: PASS; no deployment occurred.
- Local D1 migrations and Spec B D1 gate: PASS.
- First push occurred at `ebf3ab0d6fb6fa8af80a8b1e0059fc051e730c72`.
- Validate application #2062, run `36158814713`, completed **SUCCESS** on that exact HEAD: 2,387 tests (2,386 pass, 0 fail, 1 skipped), architecture/lint/build, both Worker dry-runs, local D1, Spec B gate and operation-profile gate all passed.
- Staging QA did **not** occur and remains **PENDING AUTHORIZATION**. No merge or production deployment occurred.

## Second corrective pass — post-CI functional review

The green first-pass CI established non-regression, not functional completeness. A post-CI review identified partial/stubbed work in Tasks 3–12. This second pass adds new commits on top of published `ebf3ab0d`, without rewriting published history.

- `e58b1c3d` — `feat: complete reporting analytics and export service`: São Paulo receipt-day boundaries, strict calendar dates, preset comparisons, filter applicability, operational coverage/distributions, sales/receivables, historical product analytics, combined detail filters/drawer data, canonical export model and explicit 10,000-row limit. Backend-focused tests: 25/25 at commit.
- `7f11ded6` — `feat: connect reporting views mobile and exports`: eight overview KPIs, operation/sales/products/detail UI, read-only drawer, CSV/XLSX/PDF export menu with `reports.export`, mobile summary, state matrix and Mesiva-token styling. Frontend-focused tests: 30/30 at commit; architecture, lint and build passed.
- `64a7578f` — `fix: close reporting drilldowns and export parity`: receivable/deadline/payment drill-downs, explicit product allocation quality, operational hour controls, localized XLSX summary labels and an executive PDF with view-specific KPIs/summaries rather than generic property dumps. Also makes the `0030` migration test and gate safe when later migrations exist.
- The first corrective full-suite run exposed one stale assertion: `businessProfileMigration.test.js` assumed `0030` was forever the final migration. The new `0031` index is valid; the test and `operation-profile-d1-gate.mjs` now target the `0029`→`0030` upgrade by name while clean-install checks still apply all migrations. Focused RED observed, then GREEN.

### Performance evidence

`worker/reporting/queryPlan.test.js` executes `EXPLAIN QUERY PLAN` on a clean migrated SQLite schema for overview sales, receipts, allocations, products, detail count and detail page. The first plan showed `USE TEMP B-TREE FOR LAST 2 TERMS OF ORDER BY` on the default detail page. This justified the minimal `0031_reporting_detail_order.sql` index `(business_id, order_date DESC, order_number DESC, id DESC)`.

After migration the plans show indexed business/date searches for orders and receipts, indexed receipt-to-allocation and order-to-item joins, a covering index for detail count/page, and no cross-business full scan or detail temp B-tree. This is an evidence-driven index migration, not a speculative materialized view.

### XLSX dependency and bundle

The pre-existing first-pass dependency is `exceljs@4.4.0`, MIT per its installed `package.json`. `npm ls exceljs --all --json` resolves one top-level `exceljs@4.4.0`; its declared direct dependencies are `archiver`, `dayjs`, `fast-csv`, `jszip`, `readable-stream`, `saxes`, `tmp`, `unzipper` and `uuid`. Serializers import it dynamically only after an XLSX export request. Before this pass, the user-reported AdminBootstrap chunk was approximately 1,179 kB minified. The current corrective build emits `AdminBootstrap` 1,207.33 kB and a separate `exceljs.min` 930.42 kB (256.67 kB gzip) chunk. XLSX remains outside initial boot; no general bundle refactor was undertaken.

### Candidate gates and staging boundary

Focused reporting and business-profile regression tests: **59/59 PASS**. Final serial full suite on the corrected code: **2,414 tests, 2,414 pass, 0 fail, 0 skipped**. Architecture, lint (exit 0 with existing warnings), build, local D1 migration through `0031`, Spec B D1 gate, operation-profile D1 gate, and production/staging Worker dry-runs: **PASS**. Both dry-runs exited without deployment. At the time of this earlier candidate pass, staging QA had not yet occurred. See the later section below for the exact HEAD and staging results.

## Homologação funcional de staging — 25/09/2026

O código homologado foi o HEAD remoto da branch e do PR #72 `7583882ecad5bfe7a0d9994045c32ca084dbaf8b`; não se usou `master` para desenvolvimento. A URL de staging veio de `.github/workflows/deploy-staging.yml`: `https://sistema-para-delivery-staging.vzaponi.workers.dev`.

- [Validate run 36210750261](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36210750261): SUCCESS no SHA exato.
- [Deploy staging run 36210748088](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36210748088): SUCCESS no SHA exato, inclusive smoke de login e deep link. Nenhum deploy de produção ocorreu nesta homologação.
- Checkout local da mesma branch/SHA; `npm ci` PASS. Reporting focado: **81/81 PASS**; `npm test`: **2.438/2.438 PASS, 0 fail, 0 skipped**; arquitetura PASS; lint exit 0 com **142 warnings**, incluindo `useReportingData.js` (react/set-state-in-effect), `DetailReport.jsx` (react/only-export-components) e `ProductsReport.jsx` (react/immutability); build PASS, com avisos de chunk `AdminBootstrap` 1.252,25 kB e `exceljs.min` 930,42 kB.
- `npm run d1:migrate:local`: PASS, 31 migrações incluindo `0031_reporting_detail_order.sql`. `node scripts/infra/operation-profile-d1-gate.mjs`: PASS (`cleanInstall`, `upgradeFrom0029`, backfill e foreign keys verdadeiros).
- Dry-runs locais Worker production/staging e Spec B D1 gate: **não puderam ser confirmados neste sandbox Windows**, por `Cannot read directory "../../../../../..": Access is denied.` no bundle do Wrangler, inclusive com TEMP/TMP/cache/log sob o workspace e tentativa de permissão de leitura. Os mesmos gates passaram no Validate CI desse SHA. A falha local de infraestrutura não foi interpretada como falha funcional da aplicação; não se classificou a revalidação local integral como verde.
- `git diff --check` inicialmente limpo; nenhuma modificação em código, Spec ou plano aprovado. A matriz de staging está em `reporting-center-qa.md`: **58 PASS, 8 FAIL, 7 BLOCKED**, com recortes, valores, reproduções e limites por linha.

Um pagamento controlado foi registrado no staging, em Financeiro → A receber, para o pedido #172/R$ 3,00, dividido em Pix R$ 1,00 e Dinheiro R$ 2,00. A lista caiu de 38/R$ 2.889,00 para 37/R$ 2.886,00; Vendas elevou recebido de R$ 7.431,36 para R$ 7.434,36 e o mix subiu exatamente R$ 1,00/R$ 2,00. O Detalhado exibiu #172 como Pago/Pix + Dinheiro. Essa mutação é apenas dado de teste no staging e não alterou código.

Os bugs funcionais observados são exportação CSV/XLSX/PDF (alerta `orderHourFrom inválido.`), atalho Mês anterior ausente, comparação sem base exibindo anterior zero, ordenação por Menor duração com pedidos sem duração primeiro e linha de pedido com número `null`. **A exportação é blocker para merge** e bloqueia a reconciliação por arquivos. Capabilities de usuários restritos, cenários históricos de rename/snapshot, estado legacy de timing e impressão física seguem BLOCKED por falta de conta/fixture ou estação online. Nenhum bug foi corrigido, e não houve merge, PR ready ou deploy de produção.

## Re-homologação funcional focada — 26/09/2026

- **SHA da aplicação no PR #72 e na branch antes desta rodada:** `b330fd66e43fd8f720363ed57da6933eac08d2df`. A rodada original, em `7583882ecad5bfe7a0d9994045c32ca084dbaf8b`, conserva sua matriz 1–73 e o resultado histórico **58 PASS / 8 FAIL / 7 BLOCKED** na seção anterior e em `reporting-center-qa.md`.
- [Validate application run 36214127508](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36214127508) e [Deploy staging run 36214125203](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36214125203): **SUCCESS** no SHA exato da aplicação. A URL de staging e a operação autenticada Amor & Sabor são as mesmas da rodada anterior.
- Nesta rodada focada, as linhas históricas **11, 26, 50 e 55 passaram** com observação integrada. O atalho Mês anterior selecionou agosto completo e resistiu a F5; comparação com base real manteve percentuais/direção e sem base não fabricou anterior zero; Menor duração começou com #159/0 min e só chegou a duração ausente na posição global 163; o UUID `f9a1cb3b-d4fb-405f-b3ad-ca7027fa92a3` recebeu identificação **Sem nº · f9a1cb3b** na lista, no móvel e no drawer. A evidência de cada linha está na nova seção da matriz QA.
- Smoke relacionado: Hoje, 7 dias, 30 dias e Mês atual mudaram o período e retornaram dados; paginação 10/25/50/100 e Mais recentes funcionaram nos 189 pedidos do Detalhado; pedido numerado #183 abriu no drawer; Gerenciar em A receber levou a `/financeiro/a-receber` com 37 pendências/R$ 2.886,00; Reporting não exibiu comando de pagamento. Os controles do navegador automatizado foram ativados por Enter/Espaço, pois os cliques de mouse do controlador não alteraram a página.
- Como o calendário já estava em 26/09, o recorte original de 01–25/09 foi repetido com `period=custom`, mantendo as mesmas datas e 189 pedidos detalhados; o preset `current-month` agora termina em 26/09. Isso evita confundir mudança natural de data com regressão.

### Arquivos de exportação observados no staging

Todos os seis arquivos abaixo foram gerados após o Deploy staging `36214125203` do SHA re-homologado. Os arquivos sem sufixo são do Detalhado 01–25/09 **sem filtros avançados** (189 pedidos); os de sufixo `(1)` são do mesmo período com **Recebível: A receber + Busca: Fernanda** (16 pedidos). SHA-256 identifica o conteúdo exato inspecionado; os arquivos são evidência local e não foram adicionados ao commit documental.

| Arquivo | Tamanho | SHA-256 |
|---|---:|---|
| `relatorio-detail-2026-09-01-2026-09-25.csv` | 19.288 bytes | `EEFCA0223FC9709E0DB09F4E7F2DD00FA8FC1DD2BA2956710E51067800DEA872` |
| `relatorio-detail-2026-09-01-2026-09-25.xlsx` | 16.364 bytes | `078A98771FB219ECBD7977C578521D0845EDCA703E4576C8C2512C3E557000C1` |
| `relatorio-detail-2026-09-01-2026-09-25.pdf` | 5.089 bytes | `3F578F0F467AE5D479A6781A9B37FF4C9D44979CA60AFB87CC7C4EDCFBBFDEA0` |
| `relatorio-detail-2026-09-01-2026-09-25 (1).csv` | 2.185 bytes | `1F87168BEC81253C41DDB80800A58A53FCE8F4A3DD006E8ECF2BD816DE00F1F0` |
| `relatorio-detail-2026-09-01-2026-09-25 (1).xlsx` | 8.454 bytes | `B2B828B47EBA0F0283F53CF76F41D0DBCB79B7046B90F25E25357CD94AD78810` |
| `relatorio-detail-2026-09-01-2026-09-25 (1).pdf` | 5.168 bytes | `CA10B4428DBE6FD6B63CCFB924E55DA6EA2052D1C07F647E93B0ADE0EB4BF15E` |

- CSV sem filtros: BOM UTF-8 `EF BB BF`, 11 cabeçalhos em português e 189 linhas; #183 = R$ 432,00. XLSX abriu com abas **Resumo** e **Dados** e 189 linhas em Dados, datas tipadas e moeda numérica. Comparação de todas as 189 linhas/11 colunas com o CSV, normalizando data/moeda: **zero células divergentes**. PDF abriu em uma página, mostrou 189, R$ 10.398,36, R$ 62,27, 11,64%, comparação `Sem base comparável` e não incluiu a tabela completa.
- Com filtros, CSV e XLSX têm **16 linhas idênticas**; todas contêm Fernanda e pendência positiva, Total/Pendente somam **R$ 1.132,00**, igual à tela. CSV contém `receivable=unpaid` + `search=Fernanda`; XLSX contém `A receber=unpaid` + `Busca=Fernanda`; PDF resume 16, R$ 1.132,00, R$ 70,75 e 0%. Os dois filtros chegaram ao backend e nenhum pedido extra apareceu. A comparação de 16 linhas/11 colunas também deu **zero células divergentes**.
- **FAIL 58:** o Resumo do XLSX do Detalhado, nos dois recortes, só contém `total`, `page`, `pageSize`, `totalPages`, sem os KPIs exibidos na tela e no PDF. **FAIL 59:** o PDF não identifica a operação Amor & Sabor, exigida pelo design §22.4. **FAIL 60:** apesar da seleção de pedidos correta, a paridade integral falha pelo resumo XLSX sem KPIs e pelo valor técnico `unpaid` nos resumos XLSX/PDF no lugar do rótulo de recebível da interface. Os dados CSV/XLSX dos três pedidos sem `order_number` aparecem como `Indisponível`, sem UUID curto para rastreá-los individualmente. Nenhum desses bugs foi corrigido nesta rodada.
- **PASS 57:** CSV UTF-8 íntegro nos dois recortes, com cabeçalhos, quantidade e valores de pedidos. O erro antigo `orderHourFrom inválido.` não apareceu em nenhuma das seis exportações. **BLOCKED 61:** staging continua sem >10.000 pedidos; a falha antiga da exportação já não impede testar recortes comuns, mas ainda falta dataset para confirmar o limite integrado. Os BLOCKED 5, 6, 35, 46, 47 e 73 mantêm as causas históricas.

**Resultado consolidado no novo SHA: 63 PASS / 3 FAIL / 7 BLOCKED.** A exportação segue **blocker para merge** até resolver e revalidar 58–60. A validação local dos dry-runs Worker e do gate Spec B D1 continuou com a restrição de Wrangler no sandbox Windows registrada na homologação anterior; não se rotulou essa execução local como verde nem se repetiram esses comandos nesta rodada. Validate e Deploy staging do SHA novo passaram em CI. Somente os dois documentos de QA foram editados; não houve correção de código, alteração de Spec/plano, merge, PR ready ou deploy de produção.

## Re-homologação final focada das exportações — 26/09/2026

- **SHA da aplicação homologada:** `a9d8c33937a11022f9e308a6b5bedf48cea66b64`, branch `feature/issue-34-reporting-center`, PR #72, staging autenticado da operação Amor & Sabor. [Validate application 36247093889](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36247093889) foi **SUCCESS** no SHA exato; [Deploy staging 36247090546](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36247090546), **attempt 2**, foi **SUCCESS** no mesmo SHA. A attempt 1 teve timeout no smoke de propagação do asset após deploy bem sucedido. As evidências de execução anteriores, inclusive o bloqueio local dos dry-runs Worker e do Spec B D1 gate pelo Wrangler no sandbox Windows, permanecem preservadas acima; esses comandos locais não foram repetidos nem classificados como PASS nesta rodada.
- Escopo: reteste integrado apenas de **58 (XLSX), 59 (PDF), 60 (paridade com filtros)**, regressão de pedidos sem número e smoke relacionado. A linha **61** foi reavaliada somente quanto à disponibilidade de dataset >10.000. Não foram reexecutados os outros 69 casos da matriz.

### Arquivos novos e reconciliação

No Detalhado `period=custom&from=2026-09-01&to=2026-09-25` sem filtros avançados, a tela mostrou **189 pedidos**, **R$ 10.398,36**, **R$ 62,27** e **11,64%**. Os arquivos `(2)` foram baixados às 11:13, horário de São Paulo. CSV com BOM UTF-8 tem 189 linhas e 11 colunas; o XLSX abre com **Resumo** e **Dados**, 189 linhas em Dados, datas tipadas e moeda numérica. Resumo contém operação e os quatro KPIs oficiais, sem `total/page/pageSize/totalPages` como KPIs. O PDF de uma página identifica **Amor & Sabor**, período, geração, fuso, quatro KPIs e comparação **Sem base comparável**, sem despejar as linhas. As 189 linhas CSV × XLSX não têm divergência semântica após normalizar data, moeda e duração zero. As linhas somam R$ 11.236,36 ao incluir 22 cancelados/R$ 838,00; os 167 pedidos comerciais somam o KPI R$ 10.398,36.

No Detalhado com `receivable=unpaid&search=Fernanda`, a URL completa foi `/relatorios?view=detail&period=custom&from=2026-09-01&to=2026-09-25&receivable=unpaid&search=Fernanda`; a tela mostrou chips **Recebível: A receber** e **Busca: Fernanda**, **11 pedidos**, **R$ 836,00**, **R$ 76,00** e **0%**. Os arquivos `(3)` foram baixados às 11:14. CSV, Resumo XLSX e PDF mostram a operação, o período e os dois filtros com rótulo humano **A receber**, sem expor `unpaid` como valor. CSV e Dados XLSX têm os mesmos 11 IDs, todos de Fernanda e com pendência positiva, sem divergência semântica nas 11 colunas; Total/Pendente somam R$ 836,00. Resumo XLSX e PDF reproduzem os quatro KPIs da tela. Os 16 pedidos/R$ 1.132,00 da rodada anterior são histórico e não foram assumidos para o estado atual do staging. Ambos os PDFs foram abertos, tiveram texto extraído e foram renderizados visualmente; comparação indisponível permaneceu sem anterior zero. Não havia observação de qualidade adicional aplicável aos recortes.

Os downloads Blob não ficaram disponíveis ao navegador automatizado. A pessoa usuária baixou manualmente os seis arquivos novos da sessão autenticada, e a inspeção local confirmou conteúdo, formatos e SHA-256. Eles não foram adicionados ao repositório.

| Arquivo verificado | Bytes | SHA-256 |
|---|---:|---|
| `relatorio-detail-2026-09-01-2026-09-25 (2).csv` | 19.251 | `37997fa10e546c717244c3a74479551fc5e13d3aa53bf6a819a2b849bc9a1a6e` |
| `relatorio-detail-2026-09-01-2026-09-25 (2).xlsx` | 16.468 | `c7c7abe566ccd38d534acebb829a5f6c79f4494ad7d44f43bc41100cb4873e02` |
| `relatorio-detail-2026-09-01-2026-09-25 (2).pdf` | 5.189 | `ab36e22b987cdf7d23bced2ab25955884d473530748f30a4e312f6ae08c12acd` |
| `relatorio-detail-2026-09-01-2026-09-25 (3).csv` | 1.623 | `9940d6c3dd8189491ab7a3bf30f77383905c2b107d6db2ea2404f56b2991067a` |
| `relatorio-detail-2026-09-01-2026-09-25 (3).xlsx` | 8.304 | `48869075574271d1e12439b2ce6565f4ff7791e029efaf68b552c8fee9c71202` |
| `relatorio-detail-2026-09-01-2026-09-25 (3).pdf` | 5.269 | `bb4b75f4364a5f1d65619bd4f60d1c7248d6f8bc7fcdbf51a6e8011246b6862c` |

### Estados e smoke

- **58 — PASS:** ambos os XLSX abriram; Resumo tem operação/filtros/KPIs oficiais e Dados tem 189/11 linhas com tipos corretos e paridade com CSV. O antigo Resumo de paginação técnica foi substituído no artefato observado.
- **59 — PASS:** ambos os PDFs identificam a operação, contexto, filtros e KPIs, com comparação honesta e resumo executivo de uma página.
- **60 — PASS:** interface, CSV, XLSX e PDF concordam no recorte atual de 11 pedidos, R$ 836,00, ticket R$ 76,00, cancelamento 0%, operação e filtros. A apresentação usa **Recebível: A receber** e **Busca: Fernanda** nos três formatos.
- **Pedidos sem número:** a UI com filtro Combo Família mostrou **Sem nº · f9a1cb3b** e o drawer abriu o UUID `f9a1cb3b-d4fb-405f-b3ad-ca7027fa92a3`, Mesa 1/R$ 193,00. A coluna Pedido em CSV e XLSX do recorte sem filtros usa a mesma referência; as outras duas referências curtas são `66902e3c` e `36433d67`. Não apareceu `#null`, `Indisponível` como identidade nem número inventado.
- **Smoke somente leitura:** o drawer #183 abriu com 21 itens, R$ 432,00 recebidos e Dinheiro + Cartão de débito; Reporting não exibiu ação de pagamento. Em Vendas, **Gerenciar em A receber** navegou para `/financeiro/a-receber`, então com 29 pendências/R$ 2.460,00. Os seis downloads funcionaram. Nenhum pedido/pagamento foi modificado.
- **61 — BLOCKED:** staging disponibiliza 189 pedidos no recorte de referência, sem dataset integrado acima de 10.000 para provar rejeição explícita sem truncamento. As exportações comuns estão funcionais; falta somente esse dataset para a linha 61. Não se criou massa de pedidos. Os BLOCKED **5, 6, 35, 46, 47 e 73** mantêm os motivos específicos das seções históricas.

**Resultado consolidado da matriz 1–73 neste SHA: 66 PASS / 0 FAIL / 7 BLOCKED.** Apenas 58–60 mudaram de FAIL para PASS nesta rodada, com prova nos arquivos e na interface. **Não resta blocker funcional de exportação para merge**; os sete BLOCKED são limites de cobertura ainda não resolvidos e não foram promovidos a PASS. Histórico anterior e bugs encontrados permanecem documentados, sem alteração de código, Spec ou plano. Não houve merge, PR ready nem produção.
