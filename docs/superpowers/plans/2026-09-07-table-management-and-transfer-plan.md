# Gestão de Mesas e Transferência de Comandas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar mesas persistentes com ID estável, seleção obrigatória para consumo no local, cliente opcional, gestão em `Mais → Mesas`, estado Livre/Ocupada derivado de comandas e transferência atômica de comanda para mesa livre.

**Architecture:** Criar a entidade `tables` como fonte de identidade operacional, manter `table_tabs.table_identifier` apenas como snapshot histórico e migrar `table_tabs` para `table_id`. O Worker continua sendo a autoridade de regras de negócio. A UI consome `tables` pelo bootstrap e envia `tableId`, nunca texto digitado. CRUD/configuração e transferência ficam em um módulo de domínio focado, sem ampliar o já grande `worker/repositories.js` além da integração necessária com pedidos.

**Tech Stack:** React 19, Vite, Node test runner (`node --test`), Cloudflare Worker, Cloudflare D1/SQLite, Wrangler 4.128.0.

**Spec:** `docs/superpowers/specs/2026-09-07-table-management-design.md`

## Global Constraints

- Trabalhar somente em `feature/table-management-and-transfer-v2`.
- A branch deve partir de `master` @ `2114b9539786fb0528d3ea51adb8e687b5dd3944` ou de um descendente fast-forward dessa master antes do primeiro código.
- Não trabalhar na branch antiga `feature/table-management-and-transfer`; ela ficou divergente após o merge do PR #12.
- Não fazer commit direto em `master`.
- Não executar migration remota de staging/produção durante implementação.
- Não executar deploy de produção.
- TDD estrito: para cada regra relevante, escrever/alterar teste, executar e observar RED pelo motivo esperado; só então alterar código de produção; executar novamente até GREEN.
- Não apagar compatibilidade histórica de `guest_name`; apenas impedir novas vendas locais nesse formato.
- Não introduzir hard delete de mesas, merge de comandas, reservas, mapa de salão, capacidade de mesa ou auditoria completa de transferências.
- Não alterar transporte de impressão, RawBT, Web Serial, Windows/QZ ou fila de impressão. Alterações em ticket/documento só podem ser as mínimas necessárias para exibir mesa + cliente opcional corretamente.
- Não usar `git reset`, `git restore`, `git clean` ou `git stash` para resolver estado local. Se houver alterações inesperadas, parar e inspecionar antes de continuar.
- Commits pequenos e coerentes. Cada commit de implementação deve ter os testes relevantes verdes antes de seguir para a próxima tarefa.

---

## Task 0: Preparar a branch local e registrar baseline

**Files:** leitura apenas nesta tarefa.

- [ ] Confirmar branch e working tree:

```bash
git status
git branch --show-current
git log -1 --oneline
```

Esperado: branch `feature/table-management-and-transfer-v2`, working tree limpo e ancestral contendo `2114b95`.

- [ ] Se a branch ainda não existir localmente, buscar sem reescrever histórico:

```bash
git fetch origin
git switch --track origin/feature/table-management-and-transfer-v2
```

Se já existir:

```bash
git switch feature/table-management-and-transfer-v2
git pull --ff-only origin feature/table-management-and-transfer-v2
```

- [ ] Instalar exatamente o lockfile oficial:

```bash
npm ci
```

- [ ] Rodar baseline completo antes de editar:

```bash
npm test
npm run lint
npm run build
npm run d1:migrate:local
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

- [ ] Se qualquer comando falhar antes das mudanças, registrar a falha e não atribuí-la à feature.

Nenhum commit é necessário nesta tarefa.

---

## Task 1: Criar a migration de mesas e proteger o contrato de dados

**Files:**
- Create: `migrations/0013_table_management.sql`
- Create: `worker/tableManagementMigration.test.js`
- Read/possibly extend: `worker/tableTabsMigration.test.js`
- Read: `migrations/0007_table_tabs.sql`

### 1.1 RED — contrato da migration

- [ ] Criar `worker/tableManagementMigration.test.js` lendo `migrations/0013_table_management.sql` e exigindo, no mínimo:
  - `CREATE TABLE tables` com `id`, `business_id`, `name`, `name_key`, `sort_order`, `is_active`, `created_at`, `updated_at`;
  - FK para `businesses`;
  - índice único de `(business_id, name_key)`;
  - seed de Mesa 1 a Mesa 7 para cada negócio existente;
  - `ALTER TABLE table_tabs ADD COLUMN table_id ...`;
  - backfill de `table_id` sem apagar `table_identifier`;
  - `DROP INDEX IF EXISTS idx_table_tabs_one_open_per_table`;
  - novo índice único parcial por `(business_id, table_id)` com `WHERE status = 'open'`;
  - preservação de identificadores legados através de criação/mapeamento de mesas, nunca `DELETE` de comandas.

- [ ] Adicionar teste que recuse padrões destrutivos nesta migration, por exemplo `DROP TABLE table_tabs` ou `DELETE FROM table_tabs`.

- [ ] Executar:

```bash
node --test worker/tableManagementMigration.test.js
```

Esperado: RED porque `0013_table_management.sql` ainda não existe/está incompleta.

### 1.2 GREEN — migration conservadora

- [ ] Criar `migrations/0013_table_management.sql`.

Modelo esperado para `tables`:

```sql
CREATE TABLE tables (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_tables_business_name_key
ON tables (business_id, name_key);

CREATE INDEX idx_tables_business_sort
ON tables (business_id, sort_order, name);
```

- [ ] Seed Mesa 1..7 de forma idempotente por estabelecimento. Como migration SQL não possui `crypto.randomUUID()`, usar IDs SQLite estáveis/aleatórios gerados no SQL (por exemplo `lower(hex(randomblob(16)))`) e `INSERT ... SELECT` somente quando o `name_key` ainda não existir.

- [ ] Normalização usada na migration deve ser compatível com o domínio: trim, espaços internos colapsados quando possível e chave sem diferença de caixa. Não depender de `COLLATE NOCASE` como única identidade se o runtime também grava `name_key` explicitamente.

- [ ] Adicionar `table_id` nullable a `table_tabs`. Backfill deve:
  1. mapear nomes equivalentes às mesas seed quando inequívocos;
  2. criar uma `tables` correspondente para identificadores legados restantes;
  3. preencher `table_tabs.table_id`;
  4. preservar `table_tabs.table_identifier` intacto como snapshot.

- [ ] Para legados numéricos simples `1`/`01`..`7`/`07`, mapear para Mesa 1..7 somente se a equivalência for inequívoca. Para qualquer formato ambíguo, criar mesa correspondente em vez de adivinhar.

- [ ] Substituir a unicidade antiga por texto pela unicidade de comanda aberta por `table_id`.

- [ ] Não tornar `table_id NOT NULL` via reconstrução destrutiva nesta versão. O runtime deve exigir `table_id` para novas operações, enquanto linhas históricas ficam protegidas pela migration/backfill.

- [ ] Executar:

```bash
node --test worker/tableManagementMigration.test.js worker/tableTabsMigration.test.js
npm run d1:migrate:local
```

Esperado: GREEN e D1 local aplicando todas as migrations.

- [ ] Commit:

```bash
git add migrations/0013_table_management.sql worker/tableManagementMigration.test.js worker/tableTabsMigration.test.js
git commit -m "feat: add persistent tables migration"
```

---

## Task 2: Implementar domínio/repositório de mesas

**Files:**
- Create: `worker/tableRepository.js`
- Create: `worker/tableRepository.test.js`
- Possibly modify: `worker/orderWriteEffects.js`
- Possibly modify: `worker/orderWriteEffects.test.js`

### 2.1 RED — normalização, leitura e CRUD sem delete

- [ ] Criar testes para `normalizeTableName(value)`:
  - `'  Mesa   8  '` → `{ name: 'Mesa 8', nameKey: 'MESA 8' }`;
  - nome vazio é inválido;
  - impor limite de tamanho razoável e explícito (recomendação: 60 caracteres no nome normalizado).

- [ ] Criar testes de `listTables(db, businessId)` para retorno ordenado por `sort_order`, contendo estado derivado:

```js
{
  id,
  name,
  sortOrder,
  isActive,
  occupancy: 'free' | 'occupied',
  openTableTabId: null | string,
}
```

O estado deve vir de `LEFT JOIN` com `table_tabs status='open'`, não de coluna persistida em `tables`.

- [ ] Criar testes RED de:
  - `createTable`;
  - renomear mesa livre;
  - conflito de `name_key` normalizado retorna 409 com código estável como `TABLE_NAME_EXISTS`;
  - desativar mesa livre;
  - reativar mesa inativa;
  - bloquear renomeação de mesa ocupada (`TABLE_OCCUPIED`);
  - bloquear desativação de mesa ocupada (`TABLE_OCCUPIED`);
  - nenhuma função de hard delete.

- [ ] Executar:

```bash
node --test worker/tableRepository.test.js
```

Esperado: RED por módulo/funções ausentes.

### 2.2 GREEN — `worker/tableRepository.js`

- [ ] Implementar funções focadas:

```js
normalizeTableName(value)
mapTableRow(row)
listTables(db, businessId)
loadTableById(db, businessId, tableId)
createTable(db, businessId, input, now)
renameTable(db, businessId, tableId, name, now)
setTableActive(db, businessId, tableId, isActive, now)
reorderTables(db, businessId, orderedIds, now)
```

- [ ] `createTable` deve escolher `sort_order` após o maior valor atual do estabelecimento.

- [ ] `renameTable` e `setTableActive(false)` devem consultar comanda aberta no backend antes de escrever.

- [ ] Mapear colisão do índice de `name_key` para erro de domínio 409, não deixar mensagem SQL vazar à UI.

- [ ] `reorderTables` deve validar que todos os IDs pertencem ao mesmo negócio e que não há duplicatas. A operação pode atualizar os `sort_order` usando `db.batch()` se o padrão do projeto suportar, mas não pode afetar mesas de outro negócio.

- [ ] Executar:

```bash
node --test worker/tableRepository.test.js
npm test
```

- [ ] Commit:

```bash
git add worker/tableRepository.js worker/tableRepository.test.js worker/orderWriteEffects.js worker/orderWriteEffects.test.js
git commit -m "feat: add table management domain"
```

Adicionar ao commit apenas arquivos realmente modificados.

---

## Task 3: Migrar a identidade de pedido local para `tableId` + cliente opcional

**Files:**
- Modify: `shared/orderCustomerIdentity.js`
- Modify: `shared/orderCustomerIdentity.test.js`
- Modify: `worker/orderCheckout.js`
- Modify: `worker/orderCheckout.test.js`
- Modify: `worker/orderCustomerIdentityCheckout.test.js`

### 3.1 RED — novo contrato de checkout

- [ ] Atualizar testes compartilhados para o formato novo:

```js
{ type: 'table', tableId: 'table-123' }
{ type: 'table', tableId: 'table-123', clientId: 'client-456' }
```

- [ ] Cobrir explicitamente:
  - `Local` sem `tableId` → inválido;
  - `Local` com `guest_name` → inválido para nova venda;
  - `Local` com `registered_client` sem mesa → inválido;
  - `Local` com mesa e sem cliente → válido;
  - `Local` com mesa e `clientId` opcional → válido;
  - `Entrega`/`Retirada` continuam aceitando somente `registered_client` com `clientId`.

- [ ] Manter `guest_name` reconhecível para compatibilidade histórica de leitura; não remover a constante/mapper de forma que dados antigos deixem de ser exibidos.

- [ ] Executar:

```bash
node --test shared/orderCustomerIdentity.test.js worker/orderCheckout.test.js worker/orderCustomerIdentityCheckout.test.js
```

Esperado: RED nos novos casos.

### 3.2 GREEN — validação

- [ ] Alterar `validateCustomerIdentity` para validar checkout conforme contrato acima.

- [ ] Remover dependência de `TABLE_ID_PATTERN` para novas mesas, pois a referência operacional passa a ser ID interno, não nome digitado.

- [ ] `validateCheckoutInput` continua sendo a fronteira que converte body em input confiável; deve devolver `customerIdentity` já normalizado.

- [ ] Executar os testes focados e a suíte completa.

- [ ] Commit:

```bash
git add shared/orderCustomerIdentity.js shared/orderCustomerIdentity.test.js worker/orderCheckout.js worker/orderCheckout.test.js worker/orderCustomerIdentityCheckout.test.js
git commit -m "feat: require table id for local checkout"
```

---

## Task 4: Criar/reutilizar comanda por `table_id` e persistir cliente opcional

**Files:**
- Modify: `worker/tableRepository.js`
- Modify: `worker/tableRepository.test.js`
- Modify: `worker/repositories.js`
- Modify: `worker/orderIdentityRepositoryMapping.test.js`
- Modify: `worker/orderRepositories.test.js`
- Modify: `worker/multiItemCheckoutRepository.test.js`
- Modify if needed: `worker/orderWriteEffects.js`

### 4.1 RED — autoridade do banco

- [ ] Escrever testes para `getOrCreateOpenTableTabByTableId(db, businessId, tableId, now)`:
  - mesa ativa existente abre comanda;
  - snapshot `table_identifier` recebe exatamente `table.name` (não prefixar `Mesa ` novamente);
  - segunda chamada reutiliza a mesma comanda;
  - mesa inexistente → 404/400 de domínio;
  - mesa de outro negócio → não encontrada;
  - mesa inativa → 409/400 `TABLE_INACTIVE`;
  - unicidade por `table_id` impede duas comandas abertas em disputa.

- [ ] Escrever testes no fluxo `createOrder`:
  - pedido Local sem cliente persiste `client_id = NULL`, `customer_identity_type='table'`, `table_tab_id` preenchido;
  - cliente opcional do mesmo negócio persiste `client_id` e `client_name_snapshot`;
  - cliente opcional de outro negócio é recusado;
  - segundo pedido na mesma mesa usa o mesmo `table_tab_id`;
  - entrega/retirada continuam inalteradas.

- [ ] Rodar RED:

```bash
node --test worker/tableRepository.test.js worker/orderIdentityRepositoryMapping.test.js worker/orderRepositories.test.js worker/multiItemCheckoutRepository.test.js
```

### 4.2 GREEN — integração do repositório

- [ ] Em `worker/tableRepository.js`, implementar `getOrCreateOpenTableTabByTableId` selecionando a mesa por `id + business_id + is_active=1`.

- [ ] Substituir em `worker/repositories.js` o fluxo antigo de `normalizeTableIdentifier(rawIdentifier)` / `getOrCreateOpenTableTab(...texto...)` por busca usando `customerIdentity.tableId`.

- [ ] O `clientSnapshot` de pedido local deve obedecer:
  - com cliente opcional: snapshot do cliente;
  - sem cliente: texto compatível para o schema atual, preferencialmente o nome snapshot da mesa;
  - a identidade primária para telas/tickets não deve depender desse `clientSnapshot`; o `tableTab`/`tableIdentifier` será usado para isso.

- [ ] `mapTableTabRow` deve passar a devolver também `tableId`.

- [ ] Não remover suporte de leitura para linhas históricas cujo `customer_identity_type='guest_name'`.

- [ ] Rodar testes focados + `npm test`.

- [ ] Commit:

```bash
git add worker/tableRepository.js worker/tableRepository.test.js worker/repositories.js worker/orderIdentityRepositoryMapping.test.js worker/orderRepositories.test.js worker/multiItemCheckoutRepository.test.js worker/orderWriteEffects.js
git commit -m "feat: link local orders to persistent tables"
```

---

## Task 5: Implementar transferência atômica de comanda

**Files:**
- Modify: `worker/tableRepository.js`
- Modify: `worker/tableRepository.test.js`
- Create if useful: `worker/tableTransfer.test.js`

### 5.1 RED — regras de transferência

- [ ] Cobrir:
  - origem com comanda aberta + destino ativo/livre → sucesso;
  - a mesma `table_tab.id` permanece;
  - `table_id` vira o destino;
  - `table_identifier` vira o nome atual do destino;
  - pedidos continuam ligados à mesma `table_tab_id`;
  - origem fica livre e destino ocupado;
  - origem sem comanda → conflito/not found;
  - destino inexistente ou de outro negócio → recusado;
  - destino inativo → recusado;
  - destino ocupado → recusado;
  - origem == destino → recusado;
  - duas transferências simultâneas para o mesmo destino não podem produzir duas comandas abertas.

- [ ] Rodar RED:

```bash
node --test worker/tableRepository.test.js worker/tableTransfer.test.js
```

### 5.2 GREEN — uma escrita guardada + constraint como última defesa

- [ ] Implementar `transferOpenTableTab(db, businessId, sourceTableId, destinationTableId, now)`.

- [ ] Validar origem e destino antes da escrita para retornar mensagens de domínio claras.

- [ ] Fazer a mudança da comanda com **uma única instrução SQL `UPDATE` guardada**, em vez de depender de `BEGIN/COMMIT` manual no D1. Forma recomendada:

```sql
UPDATE table_tabs
SET table_id = ?, table_identifier = ?, updated_at = ?
WHERE business_id = ?
  AND table_id = ?
  AND status = 'open'
  AND NOT EXISTS (
    SELECT 1 FROM table_tabs
    WHERE business_id = ? AND table_id = ? AND status = 'open'
  );
```

- [ ] Confirmar `meta.changes === 1`. Se 0, reler estado e retornar conflito adequado.

- [ ] O índice único parcial `(business_id, table_id) WHERE status='open'` é a última defesa contra corrida. Mapear colisão para `TABLE_DESTINATION_OCCUPIED` 409.

- [ ] Não atualizar `orders.table_tab_id`; manter a mesma comanda é a própria garantia de que todos os pedidos foram transferidos juntos.

- [ ] Rodar testes focados + suíte.

- [ ] Commit:

```bash
git add worker/tableRepository.js worker/tableRepository.test.js worker/tableTransfer.test.js
git commit -m "feat: transfer open table tabs atomically"
```

---

## Task 6: Expor mesas no bootstrap e criar API autenticada

**Files:**
- Modify: `worker/repositories.js`
- Modify: `worker/index.js`
- Modify: `worker/index.test.js`
- Create: `worker/tableRoutes.test.js`
- Modify: `src/api/client.js`
- Modify: `src/api/client.test.js`

### 6.1 RED — contratos HTTP e client

- [ ] Criar testes para bootstrap contendo `tables` ordenadas e com `occupancy/openTableTabId` derivados.

- [ ] Criar testes HTTP autenticados para:
  - `POST /api/tables` body `{ name }`;
  - `PATCH /api/tables/:id` body `{ name }` ou `{ isActive }` — rejeitar payloads ambíguos/inesperados;
  - `PUT /api/tables/order` body `{ tableIds: [...] }`;
  - `POST /api/tables/:id/transfer` body `{ destinationTableId }`.

- [ ] Todos os mutations devem exigir sessão e `assertSameOriginMutation`.

- [ ] Respostas de mutation devem fornecer dados oficiais suficientes para a UI atualizar sem inventar estado. Recomendação:
  - create/rename/active/reorder → `{ tables: await listTables(...) }`;
  - transfer → `{ tables: await listTables(...), tableTab }`.

- [ ] Em `src/api/client.test.js`, exigir wrappers:

```js
createTable({ name })
updateTable(id, patch)
reorderTables(tableIds)
transferTableTab(sourceTableId, destinationTableId)
```

- [ ] Rodar RED:

```bash
node --test worker/tableRoutes.test.js worker/index.test.js src/api/client.test.js
```

### 6.2 GREEN — rotas

- [ ] Importar as funções de `tableRepository.js` em `worker/index.js` e manter parsing/erros simples e explícitos.

- [ ] Adicionar `tables` em `loadBootstrap` sem remover `tableTabs`.

- [ ] Atualizar `loadTableTabById`/queries relacionadas para carregar `table_id` quando aplicável.

- [ ] Adicionar os wrappers no client React.

- [ ] Rodar testes focados + suíte.

- [ ] Commit:

```bash
git add worker/repositories.js worker/index.js worker/index.test.js worker/tableRoutes.test.js src/api/client.js src/api/client.test.js
git commit -m "feat: expose table management api"
```

---

## Task 7: Integrar `tables` ao estado oficial do App

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/tableTabsAppWiring.test.js`
- Create: `src/tablesAppWiring.test.js`
- Modify if needed: `src/utils/dataSync.test.js`

### 7.1 RED — coleção oficial

- [ ] Criar teste exigindo:
  - `tables` em `DATA_COLLECTIONS`;
  - estado `tables`;
  - reset em logout/clear;
  - bootstrap aplica `data.tables`;
  - efeitos oficiais aceitam lista atualizada de `tables` e `tableTab`;
  - `NewOrder` recebe `tables`;
  - futura página `Tables` recebe callbacks de mutation.

- [ ] Rodar:

```bash
node --test src/tablesAppWiring.test.js src/tableTabsAppWiring.test.js src/utils/dataSync.test.js
```

Esperado: RED.

### 7.2 GREEN — wiring

- [ ] Em `App.jsx`:
  - `const [tables, setTables] = useState([])`;
  - adicionar `tables` a `DATA_COLLECTIONS`;
  - limpar/aplicar no bootstrap;
  - ampliar `applyOfficialEffects` para `table`/`tables` sem quebrar `tableTabs`;
  - importar wrappers API;
  - criar handlers de create/update/reorder/transfer com o padrão de `requestKey`, `showApiError` e dados oficiais já usados no App.

- [ ] Depois de transferência, aplicar simultaneamente `tables` e `tableTab` retornados pelo Worker; não inferir ocupação no frontend.

- [ ] Rodar testes focados + suíte.

- [ ] Commit:

```bash
git add src/App.jsx src/tablesAppWiring.test.js src/tableTabsAppWiring.test.js src/utils/dataSync.test.js
git commit -m "feat: sync persistent tables in app state"
```

---

## Task 8: Redesenhar Consumo no local para seleção de mesa + cliente opcional

**Files:**
- Create: `src/components/LocalTableSelector.jsx`
- Modify: `src/components/NewOrderCustomerStep.jsx`
- Modify: `src/pages/NewOrder.jsx`
- Modify: `src/localOrderIdentityUi.test.js`
- Modify: `src/tableTabNewOrderUi.test.js`
- Modify: `src/orderIdentityPayload.test.js`
- Modify: `src/pages/NewOrder.test.js`
- Modify: `src/pages/NewOrderMobile.test.js`
- Modify: `src/pages/NewOrderWizard.test.js`
- Modify: `src/local-order-identity.css`
- Modify if needed: `src/new-order.css`
- Modify if needed: `src/mobile-compact-controls.css`

### 8.1 RED — UX aprovada

- [ ] Atualizar testes para exigir que, em `Local`:
  - não exista opção `Nome`;
  - não exista input textual de mesa;
  - somente `tables.filter(isActive)` seja exibida;
  - cada mesa use botão com nome e selo textual `Livre`/`Ocupada`;
  - ocupada permaneça habilitada;
  - seleção tenha `aria-pressed`/estado visual;
  - ocupada selecionada mostre `Comanda aberta — este pedido será adicionado à <nome>`;
  - cliente cadastrado apareça abaixo como opcional;
  - sem mesa o passo cliente não pode avançar;
  - cliente opcional vazio não bloqueia avanço;
  - payload Local seja `{ customerIdentity: { type:'table', tableId, ...(clientId ? {clientId}: {}) } }`;
  - resumo seja `<Mesa>` ou `<Mesa> · <Cliente>` e nunca substitua mesa pelo cliente.

- [ ] Rodar RED focado:

```bash
node --test src/localOrderIdentityUi.test.js src/tableTabNewOrderUi.test.js src/orderIdentityPayload.test.js src/pages/NewOrder.test.js src/pages/NewOrderMobile.test.js src/pages/NewOrderWizard.test.js
```

### 8.2 GREEN — componente e fluxo

- [ ] `LocalTableSelector.jsx` deve receber dados, não buscá-los sozinho:

```jsx
<LocalTableSelector
  tables={tables}
  selectedTableId={selectedTableId}
  onSelect={setSelectedTableId}
  disabled={disabled}
/>
```

- [ ] Em `NewOrder.jsx`, substituir `localIdentityType/localIdentityValue` por `selectedTableId` para a nova operação.

- [ ] Não deixar o cliente padrão da entrega tornar-se cliente local sem intenção. Criar estado opcional explícito para cliente local (`localClientId`/busca correspondente) ou resetar de forma testada ao entrar em Local. Preferência: estado opcional separado para evitar perder a seleção de entrega ao alternar tipos.

- [ ] Atualizar dirty snapshot/step flow com `selectedTableId` e cliente local opcional.

- [ ] Ao voltar para Entrega/Retirada, preservar o fluxo obrigatório de cliente existente.

- [ ] CSS mobile: grade responsiva, touch target >= 44px, sem overflow, badges textuais e contraste nos temas claro/escuro.

- [ ] Rodar testes focados, `npm test`, `npm run lint`, `npm run build`.

- [ ] Commit:

```bash
git add src/components/LocalTableSelector.jsx src/components/NewOrderCustomerStep.jsx src/pages/NewOrder.jsx src/localOrderIdentityUi.test.js src/tableTabNewOrderUi.test.js src/orderIdentityPayload.test.js src/pages/NewOrder.test.js src/pages/NewOrderMobile.test.js src/pages/NewOrderWizard.test.js src/local-order-identity.css src/new-order.css src/mobile-compact-controls.css
git commit -m "feat: select registered table for local orders"
```

Adicionar apenas arquivos realmente alterados.

---

## Task 9: Criar `Mais → Mesas` e gestão operacional

**Files:**
- Create: `src/pages/Tables.jsx`
- Create: `src/pages/Tables.test.js`
- Create: `src/table-management.css`
- Create if useful: `src/components/TableTransferDialog.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/MobileNavigation.jsx`
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/main.jsx` if stylesheet imported there; otherwise import from App
- Modify: `src/FinanceMoreMobile.test.js` or create `src/tablesNavigation.test.js`

### 9.1 RED — página e navegação

- [ ] Testar navegação mobile:
  - `Mesas` aparece dentro do BottomSheet `Mais`;
  - `moreActive` considera `activeTab === 'tables'`;
  - tocar em Mesas chama `onNavigate('tables')` e fecha o sheet.

- [ ] No desktop, incluir `Mesas` na navegação de forma coerente com o app. Embora o conceito de produto seja `Mais → Mesas`, o desktop não possui submenu `Mais`; pode existir item `Mesas` na Sidebar, enquanto no mobile ele fica em `Mais`.

- [ ] Testar página:
  - lista ordenada;
  - distingue `Ativa/Inativa` de `Livre/Ocupada`;
  - criar mesa;
  - renomear livre;
  - mover para cima/baixo (reordenação acessível; não implementar drag-and-drop como requisito);
  - confirmar desativação;
  - mesa ocupada não oferece renomear/desativar como ações válidas e mostra explicação;
  - mesa ocupada oferece `Transferir comanda`;
  - seletor de destino mostra apenas mesas ativas e livres, exclui origem;
  - confirmação única `Transferir X → Y?`;
  - não há botão excluir.

- [ ] Rodar RED:

```bash
node --test src/pages/Tables.test.js src/tablesNavigation.test.js
```

### 9.2 GREEN — UI de gestão

- [ ] Implementar `Tables.jsx` como componente controlado por props/callbacks do App, sem acesso direto a fetch.

Interface sugerida:

```jsx
<Tables
  tables={tables}
  disabled={writesBlocked}
  onCreate={handleCreateTable}
  onRename={handleRenameTable}
  onSetActive={handleSetTableActive}
  onReorder={handleReorderTables}
  onTransfer={handleTransferTableTab}
/>
```

- [ ] Usar `ConfirmationDialog` existente para desativação e confirmação de transferência quando possível.

- [ ] Para mesa ocupada, mostrar texto claro: `Feche ou transfira a comanda antes de renomear/desativar.`

- [ ] Separar/identificar mesas inativas visualmente, sem escondê-las da tela de gestão.

- [ ] Após mutation, UI deve ser atualizada pelos dados oficiais retornados pelo Worker.

- [ ] Rodar testes focados + suíte + build/lint.

- [ ] Commit:

```bash
git add src/pages/Tables.jsx src/pages/Tables.test.js src/table-management.css src/components/TableTransferDialog.jsx src/App.jsx src/components/MobileNavigation.jsx src/components/Sidebar.jsx src/main.jsx src/tablesNavigation.test.js src/FinanceMoreMobile.test.js
git commit -m "feat: add table management workspace"
```

Adicionar somente os arquivos presentes/modificados.

---

## Task 10: Garantir exibição histórica e identidade mesa-primeiro em telas/ticket

**Files:**
- Modify: `worker/orderReadSql.js`
- Modify: `worker/orderReadRepository.js`
- Modify: `worker/orderReadRepository.test.js`
- Modify: `worker/repositories.js`
- Modify: `worker/orderPrintDocumentRepository.js`
- Modify: `worker/orderPrintDocumentRepository.test.js`
- Modify if needed: `shared/orderPrintDocument.js`
- Modify if needed: `shared/orderPrintDocument.test.js`
- Modify only if required by current renderers: `src/components/OrderDetail.jsx`, `src/components/KitchenTicket.jsx`, related tests

### 10.1 RED — apresentação sem reescrever histórico

- [ ] Adicionar `tableIdentifier` ao DTO de pedido lendo `table_tabs.table_identifier` por `table_tab_id`.

- [ ] Testar rótulo para:
  - Local sem cliente → `Mesa 4` (ou nome customizado da mesa, exatamente como snapshot);
  - Local com cliente opcional → `Mesa 4 · Hugo`;
  - pedido histórico `guest_name` → continua mostrando nome legado;
  - Entrega/Retirada → comportamento atual preservado.

- [ ] Testar que renomear `tables.name` após comanda fechada não altera `table_tabs.table_identifier` e portanto não altera o histórico.

- [ ] Testar documento de impressão usando o snapshot da comanda como identidade primária para Local, acrescentando cliente opcional sem mudar ESC/POS/transporte/fila.

- [ ] Rodar RED focado:

```bash
node --test worker/orderReadRepository.test.js worker/orderPrintDocumentRepository.test.js shared/orderPrintDocument.test.js
```

### 10.2 GREEN — join/snapshot de leitura

- [ ] Atualizar SELECTs de pedidos para `LEFT JOIN table_tabs tt ON tt.id = o.table_tab_id AND tt.business_id = o.business_id` e mapear `tt.table_identifier AS table_identifier`.

- [ ] `mapOrderRow` deve retornar `tableIdentifier`.

- [ ] Criar um helper de apresentação somente se evitar duplicação real; não criar abstração desnecessária. A regra é:
  - se `customerIdentityType === 'table'` e houver `tableIdentifier`, mostrar esse snapshot primeiro;
  - se houver cliente opcional real, acrescentar ` · cliente`;
  - guest legado usa snapshot de cliente antigo.

- [ ] Atualizar o documento de impressão na camada de dados/documento, sem tocar em RawBT/Web Serial.

- [ ] Rodar testes focados + impressão existente para evitar regressão:

```bash
node --test worker/orderReadRepository.test.js worker/orderPrintDocumentRepository.test.js shared/orderPrintDocument.test.js src/printing/escpos58mm.test.js src/printing/pdfOrderRenderer.test.js
```

- [ ] Commit:

```bash
git add worker/orderReadSql.js worker/orderReadRepository.js worker/orderReadRepository.test.js worker/repositories.js worker/orderPrintDocumentRepository.js worker/orderPrintDocumentRepository.test.js shared/orderPrintDocument.js shared/orderPrintDocument.test.js src/components/OrderDetail.jsx src/components/KitchenTicket.jsx
git commit -m "fix: prioritize table identity in local order display"
```

Adicionar somente arquivos realmente alterados.

---

## Task 11: Verificar fechamento/pagamento da comanda e atualização de ocupação

**Files:**
- Modify as needed: `worker/tableTabPayment.test.js`
- Modify as needed: `worker/repositories.js`
- Modify as needed: `worker/orderWriteEffects.js`
- Modify as needed: `src/tableTabReceivablesUi.test.js`
- Modify as needed: `src/pages/Receivables.jsx`

### 11.1 RED — mesa volta a ficar livre

- [ ] Estender os testes existentes de pagamento de comanda para garantir que, quando a comanda fecha, `listTables` passa a retornar a mesa como `free`.

- [ ] Confirmar que pagamento/fechamento continua baseado na mesma `table_tab.id` após uma transferência.

- [ ] Não mover a ação de transferir para A Receber; Receivables continua apenas com pagamento/fechamento.

- [ ] Rodar RED se algum contrato ainda não estiver coberto:

```bash
node --test worker/tableTabPayment.test.js src/tableTabReceivablesUi.test.js worker/tableRepository.test.js
```

### 11.2 GREEN — somente se necessário

- [ ] Ajustar queries que ainda dependam apenas de `table_identifier` para carregarem `table_id`, sem mudar regras financeiras.

- [ ] Depois do pagamento, endpoint já pode retornar `tableTab` fechado; a próxima lista oficial de `tables` deve derivar `free` automaticamente. Não gravar `occupancy` em `tables`.

- [ ] Commit somente se houve código:

```bash
git add worker/tableTabPayment.test.js worker/repositories.js worker/orderWriteEffects.js src/tableTabReceivablesUi.test.js src/pages/Receivables.jsx
git commit -m "test: verify table release after tab payment"
```

---

## Task 12: Integração, regressão, migration real local e revisão final

**Files:** todos os arquivos alterados no branch.

- [ ] Rodar suíte completa:

```bash
npm test
```

- [ ] Rodar lint:

```bash
npm run lint
```

- [ ] Rodar build:

```bash
npm run build
```

- [ ] Validar migrations num D1 local. Se o diretório `.wrangler/state` local já contiver uma base de desenvolvimento importante, não apagá-la. Use a base existente ou um ambiente isolado seguro.

```bash
npm run d1:migrate:local
```

- [ ] Inspecionar estrutura/resultados localmente:

```bash
npx --yes wrangler@4.128.0 d1 execute amor-e-sabor-delivery --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('tables','table_tabs') ORDER BY name;"
npx --yes wrangler@4.128.0 d1 execute amor-e-sabor-delivery --local --command "SELECT name, name_key, sort_order, is_active FROM tables WHERE business_id='amor-e-sabor' ORDER BY sort_order;"
```

Esperado em instalação sem customização: Mesa 1..Mesa 7 ativas, em ordem.

- [ ] Validar Worker sem publicar:

```bash
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

- [ ] Revisar diff completo contra master:

```bash
git status
git diff --check
git diff --stat master...HEAD
git log --oneline master..HEAD
```

- [ ] Revisar manualmente que o diff não contém:
  - alterações de produção/segredos/PIN;
  - hard delete de mesa;
  - merge de comandas;
  - alterações de RawBT/Web Serial/QZ;
  - deploy/migration remota executada por código de feature;
  - remoção de compatibilidade de histórico `guest_name`.

- [ ] Rodar busca de placeholders/acidentes:

```bash
git grep -n -E "TODO|FIXME|PLACEHOLDER" -- ':!docs/superpowers/plans/*'
```

Investigar resultados novos; não apagar TODO histórico sem relação.

- [ ] Se o último commit não tiver CI automático por ainda não existir PR, fazer push da branch e abrir PR **draft** para `master`:

```bash
git push -u origin feature/table-management-and-transfer-v2
```

- [ ] No PR, exigir `Validate application` verde no HEAD final.

- [ ] Não fazer deploy staging até o gate ficar verde.

---

## Task 13: Staging e homologação física

Esta tarefa só começa depois do PR draft estar com CI verde.

- [ ] Executar manualmente **Deploy staging** selecionando `feature/table-management-and-transfer-v2`.

- [ ] Confirmar sucesso de migrations staging, deploy e smoke test.

- [ ] Homologar fisicamente:
  1. Mesa 1..7 existem;
  2. Nova venda Local exige mesa;
  3. não existe campo Nome/mesa digitada;
  4. Mesa 1 livre aceita pedido sem cliente;
  5. Mesa 1 vira Ocupada;
  6. segundo pedido na Mesa 1 entra na mesma comanda;
  7. cliente opcional pode ser vinculado e mesa continua identidade principal;
  8. renomear/desativar mesa ocupada é bloqueado com explicação;
  9. transferência Mesa 1 → Mesa 5 lista somente destinos ativos/livres;
  10. transferência exige uma confirmação e mantém a mesma comanda/pedidos;
  11. Mesa 1 fica livre e Mesa 5 ocupada;
  12. pagamento/fechamento deixa Mesa 5 livre;
  13. mesa livre pode ser renomeada e reordenada;
  14. mesa livre pode ser desativada/reativada;
  15. mesa inativa desaparece de Nova venda, mas continua na gestão;
  16. histórico fechado mantém snapshot antigo após renomeação futura;
  17. ticket/preview/PDF mostram mesa corretamente e impressão continua sem alteração de transporte;
  18. tema claro/escuro e mobile não têm overflow.

- [ ] Se houver falha de homologação, criar teste RED reproduzindo-a antes da correção e repetir gate completo.

- [ ] Somente depois de aprovação explícita do usuário: tirar PR de draft, revisar HEAD/CI novamente e então mergear em `master`.

- [ ] Produção permanece fora desta execução até autorização explícita posterior.

---

## Implementation Notes for Codex

- `worker/repositories.js` já concentra muitos domínios. Prefira colocar CRUD/status/transferência de mesas em `worker/tableRepository.js` e importar apenas as funções necessárias.
- O status `Livre/Ocupada` é sempre derivado; nunca adicione coluna `occupied`/`status` em `tables`.
- `table_tabs.table_identifier` continua existindo como snapshot. Não renomeie nem reescreva snapshots de comandas fechadas.
- Ao transferir, alterar somente a comanda aberta: `table_id`, `table_identifier`, `updated_at`. Os pedidos continuam com o mesmo `table_tab_id`.
- O formato de checkout Local deve ser estável: `{ type:'table', tableId, clientId? }`.
- Não reutilize `registered_client` como identidade primária de pedido Local. Cliente é secundário.
- Para erro de concorrência, a constraint do banco é autoridade final; o frontend nunca deve decidir sozinho que uma mesa está livre.
- Depois de qualquer mutation, usar objetos/listas oficiais retornados pela API. Não alternar ocupação otimisticamente sem resposta do backend.
- Preserve idempotência de criação de pedido e comportamento atual de `idempotency-key`.
- Preserve compatibilidade dos pedidos antigos com `guest_name` em histórico/leitura.
- Preserve todo o fluxo financeiro e de impressão; somente a string de apresentação da identidade local pode mudar conforme a spec.
