# Spec B — Configurações e políticas do negócio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar as políticas e os catálogos aprovados da Spec B com os layouts individuais de Configurações, identidade visual atual, responsividade e preservação dos fluxos operacionais.

**Architecture:** Monólito modular/serverless existente: schemas puros compartilhados, persistência e validação no Worker, recursos tipados por domínio no D1. Configuração efetiva operacional separada dos editores administrativos; revisão, transação e reconciliação por recurso. App.jsx recebe apenas integração localizada de sessão, navegação, configuração efetiva e feedback, sem iniciar a Spec C.

**Tech Stack:** React/Vite, JavaScript ESM, Worker, D1, node:test, node:sqlite e harness React existentes; QZ Tray para homologação física. Node 22 e Wrangler 4.128.0 conforme os gates da base; npm ci respeitando o lockfile, sem atualização de dependências.

**Spec:** `docs/superpowers/specs/2026-09-12-business-settings-policies-design.md`.

**Visual contract:** `docs/superpowers/specs/2026-09-12-business-settings-policies-visual-contract.md`.

**Base conferida:** `master` = `8d2f897154526037606e9fee60f4b9a606089e8a`.
**Documentos de entrada:** `be16867cbb3ac2e28112f8e7fa6a8cff11dd94dc`, branch `docs/spec-b-settings-policies`.
**Data / revisão:** 12/09/2026 / plano 1.
**Autorização registrada:** após confirmar que quer os modelos individuais com as cores existentes e adaptação mobile, o usuário autorizou criar este plano. Os estados de revisão nos documentos de entrada representam a etapa anterior. Este registro não altera seu escopo.
**Estado deste plano:** pronto para revisão do usuário; nenhuma tarefa de implementação executada. Aprovação para planejar não autoriza código, migration remota, merge ou produção.

## Global Constraints

- Uma Spec por vez. Não iniciar Spec C ou Spec D; não reestruturar globalmente App.jsx, produtos, pagamentos ou impressão.
- Implementar em branch própria e worktree isolada a partir da master atualizada, incorporando os documentos aprovados. Nunca desenvolver diretamente na master.
- Não usar reset, restore, clean ou stash para limpar trabalho local existente; não sobrescrever trabalho de outro agente.
- TDD: RED antes de cada alteração relevante; logs reais de RED e GREEN e commit por entrega testável. Código de exemplo neste plano é instrução futura, não evidência de execução.
- Capabilities de domínio, nunca nomes fixos de cargos; preservar autenticação/origem/business_id confiáveis do Worker. Não alegar que a B entrega perfis reais para todas as APIs.
- Vias: avulso preserva valor configurado existente, fallback 2; mesa/comanda começa em 1; opções 1 ou 2; quantidade congelada em cada novo job. Retry não é novo job.
- Tempos: defaults 50/15/30/40; antecipação 0–240, tolerância 0–120, atraso imediato 1–180, muito atraso maior que atraso e até 240; minutos inteiros.
- America/Sao_Paulo e BRL preservados. Saldo inicial continua em Financeiro. Tema/som continuam locais.
- Métodos/modalidades nativos não são criáveis ou renomeáveis; manter pelo menos um ativo e padrão ativo. Outro de cancelamento sempre ativo e exige nota.
- Nativos nunca excluídos; personalizados renomeáveis/excluíveis somente antes de primeiro uso; uso histórico e soft-deleted é permanente.
- Resultado desconhecido não é falha confirmada. Nenhum autosave remoto, fila administrativa offline ou reenvio invisível.
- Nenhum deploy de produção, merge ou migration de produção sem autorização explícita separada. Staging somente após o checkpoint de código e autorização de publicação.
- Homologação física/QZ não é substituída por mocks, screenshots ou sucesso do build.
- Imagens definem os modelos de cada tela, não apenas uma inspiração genérica. Reutilizar layouts individuais com a paleta real, corrigindo somente incompatibilidades funcionais registradas no contrato visual.

## 1. Referências visuais obrigatórias e rastreabilidade

Referência principal: `a_clean_modern_web_app_dashboard_ui_screen_in_the.png`; SHA-256 indicado no contrato visual: `aae2d5176fce3b891e38f92b11710d757df5603f3a33112d1fddd4913dad252f`. O usuário anexará as imagens ao Codex; elas não estão automaticamente dentro do repositório.

| Tela | Imagem individual de apoio | O que reproduzir / ajustar |
|---|---|---|
| Home | Último mockup vermelho, não a primeira colagem | Grade de sete cards, hierarquia, ícones em caixas suaves e lateral escura; preservar menu agrupado da A. |
| Operação | `painel_de_operação_do_delivery.png` | Card de tempos, campos em duas colunas no desktop, unidades e ajuda; uma coluna no celular. |
| Modalidades | `configurações_de_modalidades_de_pedido.png` | Linhas Entrega/Retirada/Local e padrão; sem ordenar, criar ou prometer cardápio público. Mesmo agregado/editor de Operação. |
| Pagamentos | `configurações_de_pagamento_do_delivery.png` | Lista compacta, Ativo/Inativo, Padrão e menu; remover Adicionar forma e descrições bancárias inventadas. |
| Cancelamentos | `painel_de_motivos_de_cancelamento.png` | Lista, botão Adicionar, identificação nativo/personalizado e Outro protegido; os cinco iniciais são nativos. |
| Categorias financeiras | `painel_de_categorias_financeiras_da_loja.png` | Dois grupos Entrada/Saída, lista e modal de criação; sem saldo inicial ou edição das automáticas. |
| Impressão | `configuração_de_impressão_de_pedidos.png` | Três blocos: negócio, estação, impressora/QZ; salvar cada recurso separadamente. |
| Dispositivo | `painel_de_preferências_do_delivery.png` | Cards de aparência e som; remover diagnósticos fictícios, versão de navegador, armazenamento e funções adicionais. |

Cores não são copiadas dos estudos azuis. Usar `var(--primary)`, `var(--bg)`, `var(--surface)`, `var(--text)`, `var(--muted)` e tokens existentes: claro #b7192b/#f6f3f1/#ffffff; escuro #e34b5d/#151211/#211d1b. Lateral #211b1a; fonte Inter/fallbacks já definidos. Nenhuma marca, usuário, seletor de loja, sino, Marketing ou Relatórios novo por inferência das imagens. Azul semântico informativo existente pode permanecer; não virar cor principal do produto.

Desktop e mobile são entregas da mesma tarefa de tela, não um redesenho opcional ao fim. Usar mobile Pedidos / Comandas / Financeiro / Mais e Configurações via Mais. Verificar 360, 390, 768, 1024 e 1440 px; incluir 320 px para overflow e zoom 200%. Capturas separadas por tela/estado/tema, nunca colagens como única evidência. Não existem mockups mobile/escuro finais homologados: a adaptação será verificada em staging.

## 2. Rodadas e dependências

| Rodada | Tarefas | Saída para revisão |
|---|---|---|
| R1 — Fundação | T01–T03 | Contratos, migrations iniciais, transação/recibo demonstrados sem telas novas. |
| R2 — Domínios e API | T04–T08 | Recursos completos, capabilities e projeção efetiva. |
| R3 — Integração operacional | T09–T12 | Políticas aplicadas no Worker, histórico protegido e impressão por contexto. |
| R4 — Estado do frontend | T13–T15 | Sincronização, gravação recuperável, rascunho e comparação de conflitos. |
| R5 — Telas | T16–T21 | Todas as categorias com o modelo aprovado, claro/escuro e mobile. |
| R6 — QA e release preparada | T22–T23 | Evidências, gates, staging homologado e entrega para autorização de merge. |

Executar sequencialmente. Paralelizar só tarefas com arquivos e migrations sem sobreposição, após estabilizar interfaces; este plano não exige paralelismo. Cada tarefa tem revisão funcional e de qualidade com prioridade em Critical/Important demonstráveis. Não executar todas as rodadas numa única solicitação ao Codex.

## 3. Mapa de arquivos e contratos entre tarefas

Novos caminhos são propostas de implementação, não arquivos já existentes. Manter os consumidores atuais; não criar um motor genérico de settings.

| Fronteira | Criar | Integrar pontualmente |
|---|---|---|
| Contratos puros | `shared/businessPolicies.js`, `shared/settingsCatalogs.js`, `shared/settingsAccess.js` | `shared/finance.js`, `shared/orderTiming.js`, `src/app/access.js` |
| Persistência | `worker/settingsTransactions.js`, `worker/operationSettingsRepository.js`, `worker/paymentSettingsRepository.js`, `worker/cancellationSettingsRepository.js`, `worker/financeCategoryRepository.js`, `worker/printSettingsRepository.js` | Repositórios operacionais e de impressão existentes |
| API/projeção | `worker/settingsAccess.js`, `worker/settingsApi.js`, `worker/effectiveBusinessConfig.js`, `worker/operationalPolicyGuards.js` | `worker/index.js`, `worker/orderPrintingApi.js`, `worker/repositories.js` |
| Frontend não visual | `src/api/settingsClient.js`, `src/app/useBusinessSettingsController.js`, `src/app/settingsState.js`, `src/app/settingsConflict.js`, `src/app/settingsPendingStorage.js`, `src/app/useEffectiveBusinessConfig.js` | `src/api/client.js`, `src/App.jsx`, `src/app/usePrintingSettingsController.js` |
| Telas e componentes | `src/pages/SettingsHome.jsx`, `src/pages/OperationSettings.jsx`, `src/pages/PaymentSettings.jsx`, `src/pages/CancellationSettings.jsx`, `src/pages/FinanceCategorySettings.jsx`, `src/components/SettingsEditorShell.jsx`, `src/components/SettingsItemList.jsx`, `src/components/SettingsItemDialog.jsx`, `src/components/SettingsConflictReview.jsx`, `src/settings.css` | `Settings.jsx`, `PrintingSettingsContent.jsx`, navegação, Button/SystemSelect/Modal existentes |
| Testes e evidências | Testes nomeados nas tarefas; `worker/test-support/settingsDb.js`, `src/test-support/settingsFixtures.js`, `scripts/infra/spec-b-d1-gate.mjs`, `worker/test-support/settingsProbeWorker.js`, `scripts/infra/spec-b-wrangler.jsonc` | Harness React e CI existentes; QA e runbook |

### 3.1 Shapes canônicos

```js
// Exemplos de data completo e editável; sem businessId, role, usedEver ou isSystem.
const operationsData = {
  timing: { scheduledPrepLeadMinutes: 50, scheduledLateGraceMinutes: 15,
    immediateLateAfterMinutes: 30, immediateVeryLateAfterMinutes: 40 },
  enabledModalities: ['Entrega', 'Retirada', 'Local'], defaultModality: 'Entrega',
}
const paymentMethodsData = {
  methods: ['pix', 'cash', 'debit_card', 'credit_card', 'transfer', 'other']
    .map((code, sortOrder) => ({ code, active: true, sortOrder })),
  defaultMethod: 'pix',
}
const cancellationData = { items: [
  { id: 'other', label: 'Outro', active: true, sortOrder: 0 },
] } // shape ilustrativo de um item; seed completo contém os cinco nativos.
const financeCategoriesData = { items: [
  { id: 'supplies', type: 'saida', label: 'Insumos', active: true, sortOrder: 0 },
] }
const printingPolicyData = { orderDefaultCopies: 2, tableTabDefaultCopies: 1 }
```

`AdminResource = { resource, scopeId?, revision, data, meta }`; `meta` inclui timestamps e restrições de itens por ID (`isSystem`, `usedEver`, `canRename`, `canDelete`), nunca campos editáveis do payload. `SaveInput = { expectedRevision, mutationId, data }`. `Saved = { resource: AdminResource, receipt: { mutationId, committedRevision, committedAt, replayed } }`.

Recursos: `operations`, `paymentMethods`, `cancellationReasons`, `financeCategories`, `printingPolicy`; estação: `stationConfiguration` com scopeId; eleição: `stationPrimary`. Cada recurso possui revisão própria; heartbeat não incrementa revisão administrativa. `EffectiveConfig = { version, revisions, operations?, paymentMethods?, cancellationReasons?, financeCategories?, printingPolicy? }`, com somente projeções operacionais autorizadas, sem metadados de administração. operations/printingPolicy reutilizam data tipado. paymentMethods = { methods: [{code,label,value}], defaultMethod }, com value em português e lista ativa ordenada; cancellationReasons = { items: [{id,label,requiresNote}] }; financeCategories = { items: [{id,type,label}] }, somente ativos. Estado do editor: status idle/loading/ready/saving/unconfirmed/conflict/error, confirmed/base/draft/submitted separados e dirty booleano.

Assinaturas de repositórios, todas assíncronas: `loadOperations(db,businessId)`, `saveOperations(db,businessId,input,now)`; `loadPaymentMethods/savePaymentMethods`; `loadCancellationReasons/saveCancellationReasons`; `loadFinanceCategories/saveFinanceCategories`; `loadPrintingPolicy/savePrintingPolicy`; `loadStationConfiguration/saveStationConfiguration(db,businessId,stationId,input,now)`; `loadStationPrimary/saveStationPrimary(db,businessId,input,now)`. Loads retornam AdminResource, saves retornam Saved. `now` é Date injetável, default new Date(). Os exemplos usam sempre estes nomes.

### 3.2 HTTP e erros

GET/PUT: `/api/settings/operations`, `/payment-methods`, `/cancellation-reasons`, `/finance-categories` sob `/api/settings`; impressão mantém `/api/printing/settings`. Estação mantém PUT `/api/printing/stations/:id`; eleição mantém POST `/api/printing/stations/:id/make-primary`, agora com revisão/recibo. GET `/api/settings/effective`. GET `/api/settings/receipts/:mutationId?resource=...&scopeId=...`, validando recurso e escopo, somente consulta sem efeitos.

401 expira sessão; 403 nega acesso; 400 campos/contrato inválidos; 404 referência fora do negócio; 409 `SETTINGS_REVISION_CONFLICT`, `SETTINGS_ITEM_USED`, `POLICY_CHANGED`, `SETTINGS_MUTATION_REUSED`; 503 `SETTINGS_UNAVAILABLE`. Recibo não encontrado é `status: 'unconfirmed'`, não prova de rollback. Serializar erros via http.js, sem SQL ou segredos. Corpo malformado ou schema ausente não recebe defaults permissivos.

### 3.3 Protocolo TDD e preparação de execução

A preparação abaixo pertence à T01, não é autorização para executá-la nesta rodada documental. Conferir instruções locais (AGENTS.md etc.) e a base remota antes de criar a worktree. Se master avançou, listar diferenças e reconciliar o plano; não resetar nada.

```bash
git status --short
git fetch origin
git rev-parse origin/master
git log --oneline origin/master..origin/docs/spec-b-settings-policies
# Criar worktree isolada pelo mecanismo nativo do Codex; fallback após confirmar localização:
git worktree add ../sistema-delivery-spec-b -b feature/spec-b-settings-policies origin/master
cd ../sistema-delivery-spec-b
# Incorporar somente a documentação aprovada, sem forçar histórico:
git merge --ff-only origin/docs/spec-b-settings-policies
npm ci
npm test
npm run lint
npm run build
```

Se a branch/documentação tiver commits não documentais ou não admitir fast-forward, parar a integração e explicar o diff; não usar merge forçado. Não há comando de deploy ou mudança em master nesse preparo.

Criar `docs/superpowers/qa/2026-09-12-spec-b-execution-ledger.md` na T01: base, tarefa, RED (comando/falha esperada/exit), GREEN, commit, revisão e próximo passo. Todos os checkboxes começam abertos. Para cada conjunto de exemplos adicionais indicado na tarefa, repetir RED → menor mudança → GREEN, não escrever todo o domínio antes dos testes.

---

## T01 — Contratos tipados, defaults e caracterização da base

**Arquivos:** criar `shared/businessPolicies.js`, `shared/businessPolicies.test.js`, `shared/settingsCatalogs.js`, `shared/settingsCatalogs.test.js`, `src/test-support/settingsFixtures.js`, ledger; ler `shared/finance.js`, `shared/orderTiming.js`, `src/utils/orderWorkflow.js`, `worker/validation.js`, `src/pages/NewOrder.jsx`.
**Consome:** decisões da spec e shapes 3.1.
**Produz:** `DEFAULT_OPERATIONS`, `DEFAULT_PAYMENT_METHODS`, `LEGACY_TIMING`, `parseOperations(data)`, `parsePaymentMethods(data)`, `parsePrintingPolicy(data)`, `paymentCode(value)`, `paymentLabel(code)`; `nativeCancellationReasons()`, `nativeFinanceCategories()`, `parseCatalog(data,{kind,existing})`; kind = cancellation ou finance. Criar também fixtures puras `adminFixture`, `draftFixture`, `settingsGrants` para os testes posteriores, sem depender de código de frontend futuro.

- [ ] Executar a preparação 3.3 e registrar baseline real. Caracterizar fronteiras 30/40 min, agendado exato/15 min, arredondamentos, Local por mesa e vias atuais antes de modificar consumidores.
- [ ] RED: criar testes com os seis métodos, catálogo completo, formas legadas, ativo/padrão e faixas; exemplo:
```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_OPERATIONS, parseOperations, paymentCode } from './businessPolicies.js'
test('política operacional conserva defaults e rejeita limite invertido', () => {
  assert.equal(parseOperations(structuredClone(DEFAULT_OPERATIONS)).timing.scheduledPrepLeadMinutes, 50)
  const invalid = structuredClone(DEFAULT_OPERATIONS)
  invalid.timing.immediateVeryLateAfterMinutes = 25
  assert.throws(() => parseOperations(invalid), { code: 'SETTINGS_INVALID' })
  assert.equal(paymentCode('Dinheiro'), 'cash')
})
```
- [ ] Rodar `node --test shared/businessPolicies.test.js shared/settingsCatalogs.test.js`; verificar a falha prevista, não ambiente quebrado.
- [ ] GREEN: implementar objetos imutáveis e parsers por domínio; rejeitar chaves desconhecidas, vazio, decimal, NaN, ids repetidos e padrão inativo. Nome 1–80 caracteres, normalização de espaços/acentos/caixa para colisões; financeiro compara dentro do tipo. Não alterar locale dos rótulos históricos.
```js
const t = data.timing
if (!Number.isInteger(t.immediateVeryLateAfterMinutes) ||
    t.immediateVeryLateAfterMinutes <= t.immediateLateAfterMinutes ||
    t.immediateVeryLateAfterMinutes > 240) {
  throw Object.assign(new Error('Muito atrasado deve ser maior que atrasado e até 240.'),
    { status: 400, code: 'SETTINGS_INVALID', field: 'timing.immediateVeryLateAfterMinutes' })
}
```
- [ ] Rodar os dois testes e a caracterização existente; commit `feat: define typed business policy contracts`. Revisar sem integrar novas regras ao atendimento ainda.

## T02 — Migrations dos recursos e seed compatível

**Arquivos:** criar `migrations/0024_business_settings_policies.sql`, `worker/settingsMigration.test.js`, `worker/test-support/settingsDb.js`; ler todas as migrations até 0023. Se 0024 já estiver ocupado na execução, escolher o próximo número e atualizar todos os caminhos do plano/ledger antes da tarefa.
**Consome:** contratos T01; schema real pré-B.
**Produz:** tabelas tipadas de 3.1 e `createSettingsDb({beforeSpecB}) -> {db,sqlite,close}` para testes, aplicando migrations reais; callback recebe sqlite entre legado e B.

- [ ] RED: testar banco vazio e upgrade com default_copies=1, pedidos cancelados, movimentos soft-deleted e jobs/tentativas. A tabela de impressão existente não é reconstruída nesta tarefa.
```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { createSettingsDb } from './test-support/settingsDb.js'
test('migration preserva override de vias avulsas', (t) => {
  const f = createSettingsDb({ beforeSpecB(sqlite) {
    sqlite.exec("UPDATE business_print_settings SET default_copies = 1 WHERE business_id = 'amor-e-sabor'")
  } })
  t.after(() => f.close())
  const row = f.sqlite.prepare('SELECT default_copies, table_tab_default_copies FROM business_print_settings').get()
  assert.deepEqual([row.default_copies, row.table_tab_default_copies], [1, 1])
})
```
- [ ] Rodar `node --test worker/settingsMigration.test.js` e documentar RED.
- [ ] GREEN: criar `business_operation_settings` (quatro limites/default_modality/revision/timestamps), `business_order_modalities` (business_id/code/active); `business_payment_settings` e `business_payment_methods`; `business_cancellation_settings` e `business_cancel_reasons`; `business_finance_category_settings` e `business_finance_categories`. Chaves compostas por business_id; FKs para negócios; limites e enums também em CHECK. Catálogos usam `first_used_at` permanente e `is_system`, posição, rótulo normalizado. Não usar DELETE+INSERT do catálogo inteiro.
```sql
ALTER TABLE business_print_settings ADD COLUMN table_tab_default_copies INTEGER NOT NULL DEFAULT 1 CHECK(table_tab_default_copies IN (1,2));
ALTER TABLE business_print_settings ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE print_stations ADD COLUMN config_revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE orders ADD COLUMN timing_policy_snapshot_json TEXT;
CREATE TABLE settings_mutation_receipts (
  business_id TEXT NOT NULL REFERENCES businesses(id), resource_key TEXT NOT NULL,
  mutation_id TEXT NOT NULL, payload_hash TEXT NOT NULL,
  committed_revision INTEGER NOT NULL, committed_at TEXT NOT NULL,
  PRIMARY KEY(business_id, resource_key, mutation_id)
);
CREATE TABLE settings_tx_assertions (
  tx_id TEXT NOT NULL, check_key TEXT NOT NULL, valid INTEGER NOT NULL CHECK(valid IN (0,1)),
  assertion_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))
);
```
- [ ] Criar também `business_print_topology_settings` com primary_station_id, revision e timestamps, inicializando da estação principal real; separar eleição de revisão da política de vias. Seed por negócio com revisão 1, todos os nativos atuais e métodos/modalidades ativos. Marcar primeiro uso a partir de referências existentes incluindo soft-deleted, sem mudar pedidos/movimentos. Não preencher snapshots de pedidos antigos.
- [ ] Testar rollback da migration, constraints, seed de múltiplos negócios, ausência de alteração de dados históricos e `PRAGMA foreign_key_check`; `npm run d1:migrate:local`. Commit `feat: persist typed business settings with compatible seeds`.

## T03 — Gravação atômica, revisão e recibo: primeiro recurso operacional

**Arquivos:** criar `worker/settingsTransactions.js`, `worker/settingsTransactions.test.js`, `worker/operationSettingsRepository.js`, `worker/operationSettingsRepository.test.js`, `scripts/infra/spec-b-d1-gate.mjs`, `worker/test-support/settingsProbeWorker.js`, `scripts/infra/spec-b-wrangler.jsonc`; complementar migration 0024 apenas enquanto inédita/não publicada nesta branch.
**Consome:** db.batch, T01/T02.
**Produz:** loadOperations/saveOperations; `readSettingsReceipt(db,businessId,resourceKey,mutationId)`; `hashSettingsPayload(input)`; `prepareSettingsAssertion(db,txId,checkKey,predicateSql,bindings)` e `clearSettingsAssertions(db,txId)` (SQL interno, nunca do cliente).

- [ ] RED: duas escritas expectedRevision igual: uma ganha, outra 409; filhos da perdedora não mudam; falha intermediária reverte pai/filhos/recibo. Mesmo mutationId/payload não avança revisão; payload diferente rejeita. No-op produz recibo sem avançar revisão.
```js
const base = await loadOperations(db, 'amor-e-sabor')
const a = structuredClone(base.data); a.defaultModality = 'Retirada'
const b = structuredClone(base.data); b.timing.immediateLateAfterMinutes = 20
const results = await Promise.allSettled([
  saveOperations(db, 'amor-e-sabor', { expectedRevision: base.revision, mutationId: 'race-a', data: a }),
  saveOperations(db, 'amor-e-sabor', { expectedRevision: base.revision, mutationId: 'race-b', data: b }),
])
assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
assert.equal(results.find(r => r.status === 'rejected').reason.code, 'SETTINGS_REVISION_CONFLICT')
```
- [ ] Rodar `node --test worker/settingsTransactions.test.js worker/operationSettingsRepository.test.js`.
- [ ] GREEN: usar batch único com assertion de revisão antes de qualquer mudança, diff tipado de filhos, update de cabeçalho, recibo, limpeza das assertions e SELECT final dentro do batch. Assertion inválida deve falhar SQL por trigger (zero linhas alteradas não basta). Implementar este guard na migration:
```sql
CREATE TRIGGER settings_assertion_guard BEFORE INSERT ON settings_tx_assertions
WHEN NEW.valid = 0 BEGIN
  SELECT CASE NEW.check_key
    WHEN 'revision' THEN RAISE(ABORT, 'SETTINGS_REVISION_CONFLICT')
    WHEN 'unused' THEN RAISE(ABORT, 'SETTINGS_ITEM_USED')
    WHEN 'policy' THEN RAISE(ABORT, 'POLICY_CHANGED')
    ELSE RAISE(ABORT, 'SETTINGS_INVALID') END;
END;
-- Inserção sempre ocorre, mesmo quando a condição é falsa; nesse caso aborta.
INSERT INTO settings_tx_assertions(tx_id,check_key,valid)
SELECT ?, 'revision', EXISTS(SELECT 1 FROM business_operation_settings WHERE business_id=? AND revision=?);
```
- [ ] Consulta de recibo ocorre após autenticação e antes de rejeitar a revisão antiga no replay. Colisão de PK de recibo em corrida: reconsultar hash e resultado, não reenviar mutations. Recibo confirma committedRevision; GET do recurso pode já estar em revisão posterior, que não deve ser apresentada como o resultado antigo. Hash canônico inclui recurso/escopo/expectedRevision/data; ignora apenas ordem de chaves, nunca ordem de listas.
- [ ] Ausência legítima de cabeçalho em schema válido lê defaults com revision 0; salvar inicializa o cabeçalho/filhos defaults no mesmo batch e disputa expectedRevision 0. Estado parcial/corrupto falha 503. Schema ausente nunca é ausência legítima. Recibos válidos por 24 h; expirado exige consulta/revisão, não retry invisível.
- [ ] Criar probe **somente local**: Worker de teste importa saveOperations, usa D1 local e executa corrida/rollback/replay; configuração própria sem credenciais/remoto. Script inicia Wrangler com `--local`, porta loopback e `--persist-to` temporário, aplica migrations e encerra processo em finally; modo stdout JSON. Não adicionar endpoints de teste ao Worker da aplicação. `node scripts/infra/spec-b-d1-gate.mjs` deve sair 0 ou falhar, nunca pular silenciosamente.
- [ ] Rodar unitários e gate D1 local; testes SQLite são evidência adicional, não substituto do runtime D1. Commit `feat: save operations atomically with revisions and receipts`. Checkpoint R1.

## T04 — Métodos de pagamento administráveis sem CRUD livre

**Arquivos:** criar `worker/paymentSettingsRepository.js`, `worker/paymentSettingsRepository.test.js`; modificar `shared/finance.js` apenas para reutilizar mapeamento canônico.
**Consome:** parsePaymentMethods, transação T03.
**Produz:** loadPaymentMethods/savePaymentMethods, com seis códigos nativos e rótulos legados preservados.

- [ ] RED: trocar padrão e desativar o anterior no mesmo save; impedir último ativo, código inventado, renomeação, ordem duplicada e omissão de nativo. Exemplo no teste:
```js
const before = await loadPaymentMethods(db, businessId)
const data = structuredClone(before.data)
data.defaultMethod = 'cash'; data.methods.find(x => x.code === 'pix').active = false
const saved = await savePaymentMethods(db, businessId, { expectedRevision: before.revision, mutationId: 'payments-1', data })
assert.equal(saved.resource.data.defaultMethod, 'cash')
assert.equal(saved.resource.data.methods.find(x => x.code === 'pix').active, false)
```
- [ ] Rodar `node --test worker/paymentSettingsRepository.test.js` e verificar RED.
- [ ] GREEN: implementar load tipado e batch validado pelo mesmo protocolo; somente ativo/ordem/padrão editáveis. Uma revisão em pagamentos não conflita com operations.
```js
const normalized = parsePaymentMethods(input.data)
const selected = normalized.methods.find(x => x.code === normalized.defaultMethod)
if (!selected?.active) throw Object.assign(new Error('Escolha um padrão ativo.'), { status: 400, code: 'SETTINGS_INVALID' })
```
- [ ] Verificar histórico Dinheiro/Pix/debito/credito/Transferência/Outro sem regravação; rodar teste e `node --test shared/finance.test.js`; commit `feat: manage native payment method policy`.

## T05 — Motivos e disputa de primeiro uso

**Arquivos:** criar `worker/cancellationSettingsRepository.js`, `worker/cancellationSettingsRepository.test.js`; modificar `worker/orderCancellation.js` e acrescentar `worker/cancellationPolicyUsage.test.js`.
**Consome:** parseCatalog, T03; códigos nativos existentes.
**Produz:** loadCancellationReasons/saveCancellationReasons; `prepareCancellationUse(db,businessId,reasonId,expectedRevision,txId,at)` retorna statements para o batch operacional, sem executar antecipadamente.

- [ ] RED: cinco nativos não excluíveis/renomeáveis; Outro não desativável; personalizado nunca usado pode mudar; usado não pode; nota obrigatória/240; motivo de outro negócio recusado. Corrida rename/delete versus primeiro cancelamento deve ter uma ordem válida, nunca referência perdida.
```js
const before = await loadCancellationReasons(db, businessId)
const data = structuredClone(before.data)
data.items = data.items.filter(x => x.id !== 'other')
await assert.rejects(saveCancellationReasons(db, businessId,
  { expectedRevision: before.revision, mutationId: 'remove-other', data }), { code: 'SETTINGS_INVALID' })
```
- [ ] Rodar `node --test worker/cancellationSettingsRepository.test.js worker/cancellationPolicyUsage.test.js`.
- [ ] GREEN: validar origem/uso do servidor; aplicar diff sem apagar nativos; guard `unused` no batch da renomeação/exclusão. Primeiro uso: guard de revisão/opção ativa + `UPDATE business_cancel_reasons SET first_used_at=COALESCE(first_used_at,?)` dentro do mesmo batch que cancela. Não aceitar usedEver/isSystem do browser. Nenhum audit log completo novo.
- [ ] Acrescentar casos reativar, nome normalizado repetido, conflito de ordem e uso já existente no backfill; rodar testes e `node --test worker/orderCancellation.test.js worker/orderCancellationHttp.test.js`; commit `feat: manage cancellation reasons preserving first use`.

## T06 — Categorias financeiras manuais e referências antigas

**Arquivos:** criar `worker/financeCategoryRepository.js`, `worker/financeCategoryRepository.test.js`, `worker/financeCategoryUsage.test.js`; modificar `worker/financeValidation.js`, `worker/financeRepository.js`, `shared/finance.js`.
**Consome:** parseCatalog, T03; separação de categorias automáticas/manuais.
**Produz:** loadFinanceCategories/saveFinanceCategories; `prepareFinanceCategoryUse(db,businessId,categoryId,expectedRevision,txId,at)`.

- [ ] RED: categorias automáticas não editáveis; type imutável; nativo não excluído; personalizado usado em movimento soft-deleted continua usado; lista sem ativos bloqueia novo movimento do tipo, não vendas/estornos. Manter referência inativa ao editar o mesmo registro é permitido; selecionar outra inativa não.
```js
const before = await loadFinanceCategories(db, businessId)
const data = structuredClone(before.data)
data.items.find(x => x.id === 'supplies').type = 'entrada'
await assert.rejects(saveFinanceCategories(db, businessId,
  { expectedRevision: before.revision, mutationId: 'change-type', data }), { code: 'SETTINGS_INVALID' })
```
- [ ] Rodar `node --test worker/financeCategoryRepository.test.js worker/financeCategoryUsage.test.js`.
- [ ] GREEN: seed de códigos legados sem reescrever movements.category; `getMovementCategoryLabel` aceita mapa histórico completo, jamais só ativos. Guard de primeiro uso + escrita do movimento na mesma transação. first_used_at nunca volta a null após soft-delete ou troca de categoria.
```js
const retainingExistingReference = existingMovement && nextCategoryId === normalizeMovementCategory(existingMovement)
// existingMovement foi lido pelo Worker dentro do negócio, não é um valor confiado ao payload.
if (!retainingExistingReference && !selectedCategory.active) {
  throw Object.assign(new Error('Escolha uma categoria ativa.'), { status: 409, code: 'POLICY_CHANGED' })
}
```
- [ ] Rodar testes do domínio e `node --test worker/financeRepositoryCrud.test.js worker/financeValidation.test.js shared/finance.test.js`; commit `feat: manage manual finance categories without rewriting history`.

## T07 — Política de vias e configuração administrativa da estação

**Arquivos:** criar `worker/printSettingsRepository.js`, `worker/printSettingsRepository.test.js`, `worker/stationSettingsRevision.test.js`; modificar `worker/orderPrintingRepository.js`, `worker/orderPrintingApi.js`.
**Consome:** parsePrintingPolicy, T02/T03.
**Produz:** loads/saves de printingPolicy, stationConfiguration e stationPrimary definidos em 3.1; business_print_settings permanece autoridade única de vias.

- [ ] RED: guardar 1/2 por contexto; override avulso preservado; heartbeat não invalida editor; duas eleições de principal disputam revisão de topologia; save de autoimpressão não altera vias. Exemplo:
```js
const before = await loadPrintingPolicy(db, businessId)
const result = await savePrintingPolicy(db, businessId,
  { expectedRevision: before.revision, mutationId: 'print-1', data: { orderDefaultCopies: 1, tableTabDefaultCopies: 2 } })
assert.deepEqual(result.resource.data, { orderDefaultCopies: 1, tableTabDefaultCopies: 2 })
```
- [ ] Rodar `node --test worker/printSettingsRepository.test.js worker/stationSettingsRevision.test.js`.
- [ ] GREEN: implementar transação/recibo por recurso; config_revision da estação só muda em nome/plataforma/automação. Principal usa business_print_topology_settings e atualiza flags de ambas as estações no mesmo batch. Não usar updated_at que heartbeat altera como versão administrativa. O campo default_copies da estação continua compatibilidade sem autoridade de negócio.
- [ ] GET legado de impressão pode retornar defaultCopies como alias; PUT sem expectedRevision/mutationId não pode ser bypass: 400 `SETTINGS_CLIENT_UPDATE_REQUIRED`. Atualizar clientes na T21; não publicar este estado intermediário. Repetição de registro da estação durante bootstrap não pode sobrescrever configurações com defaults do cliente: separar registro ausente de alteração administrativa.
- [ ] Rodar regressões de saúde/principal e testes novos; commit `feat: separate print policy station configuration and topology`.

## T08 — Capabilities no Worker, API administrativa e projeção efetiva

**Arquivos:** criar `shared/settingsAccess.js`, `worker/settingsAccess.js`, `worker/settingsApi.js`, `worker/effectiveBusinessConfig.js`, `worker/settingsApi.test.js`, `worker/effectiveBusinessConfig.test.js`; modificar `worker/index.js`, `src/app/access.js`, `worker/repositories.js`, `worker/orderPrintingApi.js`.
**Consome:** recursos T03–T07; getAuthenticatedSession retorna businessId/sessionId na base.
**Produz:** `resolveSettingsAccess(session, trustedGrants) -> context`; `handleSettingsApi(request,env,context,url)`; `loadEffectiveBusinessConfig(db,businessId,granted)` e `readEffectiveConfigVersion(db,businessId,granted)`; corpo da sessão com `settingsContextId` não autenticador (hash da sessionId) derivado da sessão e grants de settings resolvidos no servidor.

- [ ] RED: contextos manager/read-only/operacional/sem acesso, rota direta, capability desconhecida, businessId falsificado; validar projeção sem meta/inativos/recibos. Nenhuma simulação cria perfis reais de produção.
```js
const context = { businessId: 'amor-e-sabor', sessionId: 'test-session', granted: new Set(['operations.settings.view']) }
const request = new Request('https://app.test/api/settings/operations', {
  method: 'PUT', headers: { origin: 'https://app.test', 'content-type': 'application/json' },
  body: JSON.stringify({ expectedRevision: 1, mutationId: 'denied', data: DEFAULT_OPERATIONS }),
})
await assert.rejects(handleSettingsApi(request, { DB: db }, context, new URL(request.url)), { status: 403 })
```
- [ ] Rodar `node --test worker/settingsApi.test.js worker/effectiveBusinessConfig.test.js`.
- [ ] GREEN: mapear explicitamente rotas para repositórios e view/manage. Catálogo de capabilities: operations.settings.view/manage, payments.settings.view/manage, orders.settings.view/manage, finance.categories.view/manage, printing.settings.view + printing.settings existente, printing.station.view + printing.station.configure existente. Granted vem do contexto do servidor. Na fase legada, resolver explicitamente concessão ampla para sessão validada; contexto limitado não recebe esse fallback. Entrada/retorno HTTP não aceita role/granted para se autorizar.
```js
if (!context.granted.has('operations.settings.manage')) {
  throw Object.assign(new Error('Você não pode alterar estas configurações.'), { status: 403, code: 'FORBIDDEN' })
}
assertSameOriginMutation(request)
const saved = await saveOperations(env.DB, context.businessId, await readJson(request))
return json(saved)
```
- [ ] Projeção operacional respeita necessidades: orders.view/create/history/analysis obtêm tempos/modalidades necessários; payments.receive/refund e finance.movements.manage obtêm opções de pagamento; orders.cancel obtém motivos; finance.movements/manage recebe rótulos necessários; printing.execute/queue obtém vias necessárias. Consulta administrativa recebe dados completos por endpoint próprio. Não retirar datasets legados do bootstrap como refatoração de segurança global.
- [ ] Ler revisões e dados da projeção num batch de leitura consistente; versão determinística por vetor ordenado + identidade do conjunto de capabilities. Inicialização retorna effectiveBusinessConfig; sincronização com versão conhecida pode devolver só effectiveConfigVersion quando igual. GET dedicado retorna projeção atual. Se mudar durante leitura, não publicar revisão nova com dados velhos. Recibos consultáveis somente pelo recurso/negócio autorizado.
- [ ] Rodar testes mais `node --test worker/index.test.js worker/auth.test.js src/app/navigation.test.js`; commit `feat: expose scoped settings APIs and effective configuration`. Checkpoint R2.

## T09 — Aplicar políticas na escrita de pedidos, pagamentos e movimentos

**Arquivos:** criar `worker/operationalPolicyGuards.js`, `worker/operationalPolicyGuards.test.js`, `worker/businessPolicyIntegration.test.js`; modificar `worker/repositories.js`, `worker/orderCheckout.js`, `worker/orderCancellation.js`, `worker/financeValidation.js`, `worker/financeRepository.js`, `worker/index.js`.
**Consome:** recursos T03–T08, mapeamentos T01, prepareCancellationUse e prepareFinanceCategoryUse.
**Produz:** `preparePolicyGuards(db,businessId,expectations,txId)`; expectations contém revisões **lidas pelo servidor** dos domínios consumidos. Guard entra no mesmo batch da mutação operacional.

- [ ] RED: método desativado bloqueia novo recebimento avulso, comanda, checkout pago, estorno e movimento; modalidade inativa bloqueia criação, mas não finalização/pagamento/transferência existente. Formulário aberto não muda silenciosamente de método. Replay de pedido já aceito mantém idempotência mesmo após política mudar.
```js
const resource = await loadPaymentMethods(db, businessId)
const data = structuredClone(resource.data)
data.methods.find(x => x.code === 'cash').active = false
await savePaymentMethods(db, businessId, { expectedRevision: resource.revision, mutationId: 'disable-cash', data })
await assert.rejects(registerOrderPayment(db, businessId, unpaidOrderId, 'Dinheiro'), { code: 'POLICY_CHANGED' })
assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM payments WHERE order_id=?').get(unpaidOrderId).n, 0)
```
- [ ] Rodar `node --test worker/operationalPolicyGuards.test.js worker/businessPolicyIntegration.test.js`.
- [ ] GREEN: parsers de entrada continuam validando tipos; serviço lê política do negócio, valida escolha e põe assertion de revisão/atividade no compromisso da escrita. Mudança concorrente entre await de validação e escrita => 409 sem pagamento, movimento, cancelamento ou job parcial. Não confiar na projeção do cliente.
```js
const txId = crypto.randomUUID()
const guards = preparePolicyGuards(db, businessId, { paymentMethods: policy.revision }, txId)
await db.batch([...guards, paymentStatement, movementStatement, clearSettingsAssertions(db, txId)])
```
- [ ] Ao criar pedido, eliminar efeitos prematuros novos do caminho protegido: criação de comanda, pedido, itens, pagamento e job precisam estar no compromisso coerente. Sequências/identidade de mesa devem continuar com as garantias da A. Se for necessária extração, limitar a preparação das statements de createOrder em `worker/orderCreationStatements.js`; não reescrever todo repositories.js. Preservar a chave de idempotência e não concluir que um erro genérico permite reenviar pagamento.
- [ ] Para movimentos antigos, manter categoria/método inativos já gravados somente quando a referência não mudou e o registro pertence ao negócio; seleção nova exige ativo. Estorno de pagamento em método desativado exige escolha explícita de meio ativo efetivamente usado, nunca substituição automática. Nomes nativos portugueses continuam aceitos pelos endpoints operacionais.
- [ ] Testar corrida uso versus desativação e rename/delete com barreiras determinísticas e probe D1; rodar `node --test worker/orderRepositories.test.js worker/tableTabPayment.test.js worker/orderCancellation.test.js worker/financeRepositoryCrud.test.js`; commit `feat: enforce current business policies at operational commit`.

## T10 — Tempos ativos e snapshot no encerramento

**Arquivos:** modificar `shared/orderTiming.js`, `src/utils/orderWorkflow.js`, `src/utils/kitchenQueue.js`, `src/utils/kitchenTicket.js`, `src/utils/dashboardAnalytics.js`, `worker/repositories.js`, `worker/orderReadSql.js`, `worker/orderCancellation.js`; criar `shared/businessTiming.test.js`, `worker/orderTimingSnapshot.test.js`.
**Consome:** operations.timing e coluna timing_policy_snapshot_json de T02.
**Produz:** `selectOrderTimingPolicy(order,currentTiming)`; funções de orderTiming aceitam política opcional sem quebrar calls legados; mapeamento `timingPolicySnapshot` no pedido lido pelo backend.

- [ ] RED: pedido ativo muda de fila/urgência com política; encerrado não é recalculado; legado sem snapshot usa 50/15/30/40; retroativo usa referência legada. Exercitar fronteiras exatas e arredondamentos da caracterização T01.
```js
const active = { status: 'Em preparo', createdAt: '2026-09-12T12:00:00Z' }
const current = { ...LEGACY_TIMING, immediateLateAfterMinutes: 20 }
assert.equal(selectOrderTimingPolicy(active, current).immediateLateAfterMinutes, 20)
const historical = { ...active, status: 'Finalizado', finishedAt: '2026-09-12T12:35:00Z' }
assert.equal(selectOrderTimingPolicy(historical, current).immediateLateAfterMinutes, 30)
```
- [ ] Rodar `node --test shared/businessTiming.test.js worker/orderTimingSnapshot.test.js`.
- [ ] GREEN: centralizar seleção da política para que receber currentTiming não sobrescreva snapshot histórico. Gravar snapshot tipado dos quatro limites ao finalizar/cancelar, com guard de versão e transição, no mesmo batch; segunda finalização não regrava snapshot. Não mudar createdAt/scheduledFor/finishedAt, preços ou duração por outra definição de negócio.
```js
export function selectOrderTimingPolicy(order, currentTiming = LEGACY_TIMING) {
  const terminal = ['Finalizado', 'Cancelado'].includes(order?.status)
  return terminal ? (order.timingPolicySnapshot ?? LEGACY_TIMING) : currentTiming
}
```
- [ ] Serializar snapshot validado; JSON inválido não recebe silenciosamente a política atual. Preservar impressão automática disponível na criação (não voltar a agendar impressão pelo lead). Política não cria job nem repete som já emitido. Rodar testes de timing/kitchenQueue/kitchenTicket/dashboardAnalytics e clock; commit `feat: apply live timing policies without rewriting history`.

## T11 — Migration de impressão: comanda com duas vias sem perda de dados

**Arquivos:** criar `migrations/0025_print_context_copies.sql`, `worker/printContextMigration.test.js`; ler `migrations/0019_print_operational_confirmation.sql`, `0022_table_tab_print_jobs.sql`, `0023_print_recovery_job_affinity.sql`; integrar probe D1.
**Consome:** schema completo pós-T02 e default por contexto T07. Renumerar se houver colisão na base de execução, antes da aplicação.
**Produz:** schema permite table-tab manual com copies_requested IN(1,2), mantendo todas as demais invariantes e identidades.

- [ ] RED: aplicar schema legado e provar que resumo table-tab com duas vias é rejeitado. No upgrade, preservar jobs pending/processing/awaiting_confirmation/awaiting_second_copy/attention/printed/discarded, parent_job_id, todas as tentativas e recovery_job_id da estação.
```js
const countsBefore = snapshotPrintTables(f.sqlite)
applyPrintContextMigration(f.sqlite)
assert.deepEqual(snapshotPrintTables(f.sqlite), countsBefore)
assert.deepEqual(f.sqlite.prepare('PRAGMA foreign_key_check').all(), [])
assert.doesNotThrow(() => insertTwoCopyTableTabFixture(f.sqlite))
```
- [ ] Definir no próprio teste os helpers `snapshotPrintTables(sqlite)` (linhas completas ordenadas de print_jobs/print_job_attempts/print_stations), `applyPrintContextMigration(sqlite)` (arquivo novo real) e `insertTwoCopyTableTabFixture(sqlite)` (comanda/negócio reais da fixture). Rodar `node --test worker/printContextMigration.test.js`.
- [ ] GREEN: reconstruir tabelas afetadas a partir do schema **final** e colunas explícitas, não SELECT * ou versão 0022 desatualizada. Preservar documentos e nomes/IDs do spooler, second_copy_prompted/requested/skipped_at, ação/erro/atenção, available_at, cópias contadas e unicidades.
```sql
-- Apenas o ramo do CHECK de identidade que muda:
(type = 'table-tab' AND order_id IS NULL AND table_tab_id IS NOT NULL
 AND trigger = 'manual' AND copies_requested IN (1,2))
```
- [ ] Não usar PRAGMA foreign_keys=OFF como garantia no D1. Planejar cópias de segurança temporárias **sem FKs** das tabelas atingidas e restaurar todos os vínculos após rebuild; defer_foreign_keys não impede ações CASCADE/SET NULL. Capturar dependências com sqlite_schema/foreign_key_list, incluindo autorreferência parent_job_id e quaisquer referências de estação. Preservar índices da 0022 e extensões posteriores. Copiar/restaurar explicitamente qualquer dado impactado por cascade; remover temporários só após checks e igualdade de linhas. Seguir documentação D1 nas fontes.
- [ ] Rodar upgrade com dados via D1 local e repetir contagens, igualdade de snapshots e foreign_key_check. Gate bloqueante: nenhum job/tentativa/afinidade desaparece; banco continua aceitando apenas order vinculado a pedido, table-tab manual e teste conforme contratos. Commit `feat: allow two-copy table-tab jobs preserving print history`.

## T12 — Resolver vias por contexto e executar segunda via de comanda

**Arquivos:** criar `shared/printContextPolicy.js`, `shared/printContextPolicy.test.js`, `worker/printContextPolicy.test.js`, `src/printing/tableTabSecondCopy.test.js`; modificar `worker/repositories.js`, `worker/orderPrintingRepository.js`, `worker/orderPrintingApi.js`, `worker/index.js`, `src/printing/usePrintingManager.js`, `src/printing/secondCopyPromptFlow.js`, `src/printing/printJobRunner.js`, `src/printing/printRecoveryFlow.js`, `src/App.jsx`, `src/pages/PrintQueue.jsx`.
**Consome:** T07/T11; estruturas de job/tentativa existentes.
**Produz:** `resolvePrintCopies({jobType,customerIdentityType,tableTabId,explicitCopies,policy})`; fluxo de segunda via identifica job/comanda sem orderId fictício.

- [ ] RED: avulso 1/2; pedido de mesa 1/2; resumo 1/2; teste sempre 1; Local legado sem vínculo não vira comanda; escolha manual válida vence default; retry conserva job; mudar política não altera fila.
```js
assert.equal(resolvePrintCopies({ jobType: 'order', customerIdentityType: 'table',
  policy: { orderDefaultCopies: 2, tableTabDefaultCopies: 1 } }), 1)
assert.equal(resolvePrintCopies({ jobType: 'table-tab',
  policy: { orderDefaultCopies: 1, tableTabDefaultCopies: 2 } }), 2)
assert.equal(resolvePrintCopies({ jobType: 'test', explicitCopies: 2,
  policy: { orderDefaultCopies: 2, tableTabDefaultCopies: 2 } }), 1)
```
- [ ] Rodar `node --test shared/printContextPolicy.test.js worker/printContextPolicy.test.js src/printing/tableTabSecondCopy.test.js`.
- [ ] GREEN: resolver default no Worker para novo job e gravar copies_requested, guardando a revisão lida no compromisso de criação. POST sem escolha usa policy; escolha explícita válida não é substituída; reprint novo preserva parent e semântica existente. Retry/continuação não reconsulta defaults. createManualTableTabPrintJob não fixa literal 1.
```js
const copies = explicitCopies ?? (jobType === 'table-tab' || customerIdentityType === 'table' || tableTabId
  ? policy.tableTabDefaultCopies : policy.orderDefaultCopies)
```
- [ ] Ampliar executor/confirmador de segunda via para type table-tab: tentativa e confirmação por via, opção de dispensar quando cabível, texto com número real da comanda. Popup de origem de pedido não usa comanda como pedido inexistente. Na recuperação, concluir/dispensar a segunda via do job atual antes de passar ao seguinte; não reimprimir automaticamente resultado físico desconhecido. Preservar prioridades/afinidade e at-most-one claim existente.
- [ ] Testar fechamento/transferência de comanda com confirmação aberta; identidade do job/documento fica estável. Rodar suíte inteira de impressão e testes de Comandas; commit `feat: apply print copies by context including table-tab recovery`. Checkpoint R3; ainda sem deploy.

## T13 — Cliente de configurações e sincronização efetiva única

**Arquivos:** criar `src/api/settingsClient.js`, `src/api/settingsClient.test.js`, `src/app/useEffectiveBusinessConfig.js`, `src/app/effectiveBusinessConfig.test.js`; modificar `src/api/client.js`, `src/App.jsx`, `src/utils/dataSync.js` apenas se necessário.
**Consome:** T08, DATA_COLLECTIONS e intervalos globais existentes.
**Produz:** `getSettings(resource,scopeId?)`, `putSettings(resource,input,scopeId?)`, `getSettingsReceipt(resource,mutationId,scopeId?)`, `getEffectiveConfig()`; hook retorna `{ config, status, error, accept, refresh, reset }`.

- [ ] RED: bootstrap confirmado; versão muda; foco/online revalida; resposta antiga, logout ou capabilities diferentes descartam dados; sem timers por página; falha não inventa defaults confirmados.
```js
const newer = { generation: 2, requestId: 8, version: 'v8' }
const older = { generation: 2, requestId: 7, version: 'v7' }
assert.equal(shouldAcceptEffectiveReply(newer, older), false)
assert.equal(shouldAcceptEffectiveReply(newer, { ...older, generation: 1 }), false)
```
- [ ] Definir `shouldAcceptEffectiveReply(currentOwner,incomingOwner)` no módulo do hook (export puro) e testar vetor monotônico por domínio, não ordenar strings opacas v8/v7. Rodar `node --test src/api/settingsClient.test.js src/app/effectiveBusinessConfig.test.js`.
- [ ] GREEN: adicionar versão leve à resposta de sincronização existente; se igual, não fazer fetch extra. Na mudança, carregar projeção completa uma vez e validar generation/requestId/revisions. Primeira carga usa bootstrap, sem segundo estado oficial paralelo. Cache em memória por negócio/settingsContextId/grants; reset total em logout/expiração, sem reter token no storage. Uma resposta com revisão menor de domínio conhecido não substitui a atual.
```js
if (incomingContextId !== activeContextId || requestId < latestAppliedRequestId) return false
if (response.effectiveConfigVersion !== currentConfig.version) await refresh()
```
- [ ] Rodar regressões realtimeSync/financeRealtime/orderStateOwnership; commit `feat: synchronize effective business configuration centrally`.

## T14 — Controlador de edição e reconciliação após timeout/reload

**Arquivos:** criar `src/app/settingsState.js`, `src/app/settingsState.test.js`, `src/app/settingsPendingStorage.js`, `src/app/settingsPendingStorage.test.js`, `src/app/useBusinessSettingsController.js`, `src/app/useBusinessSettingsController.test.js`; modificar App.jsx para montá-lo no ciclo autenticado, não dentro de Settings.jsx; complementar `src/test-support/renderWorkspace.js` apenas com sessionStorage e removeItem no storage simulado, com limpeza entre testes.
**Consome:** T13 e protocolo de recibos.
**Produz:** `createSettingsState()`, `settingsReducer(state,event)`; controlador `{ resources, load, edit, save, discard, reconcile, reset }`; load/save/discard/reconcile recebem `(resource,scopeId?)`, edit recebe `(resource,data,scopeId?)`; `writePending/readPending/clearPending(storage,contextKey,resourceKey)`.

- [ ] RED: dirty é local, click não chama PUT; save confirmado atualiza oficial; timeout conserva envio; unmount/navegação não cancela compromisso; consulta sem recibo não diz rollback; reload recupera ponteiro da mesma sessão; expiração/logoff limpa e invalida resposta tardia.
```js
let state = createSettingsState()
state = settingsReducer(state, { type: 'loaded', value: adminFixture })
state = settingsReducer(state, { type: 'edited', data: draftFixture })
const before = state.confirmed
state = settingsReducer(state, { type: 'saveStarted', mutationId: 'save-1' })
state = settingsReducer(state, { type: 'saveUnconfirmed' })
assert.equal(state.status, 'unconfirmed')
assert.deepEqual(state.confirmed, before)
assert.deepEqual(state.submitted.data, draftFixture)
```
- [ ] Rodar `node --test src/app/settingsState.test.js src/app/settingsPendingStorage.test.js src/app/useBusinessSettingsController.test.js`.
- [ ] GREEN: separar confirmed/base/draft/submitted; um envio por resourceKey; mutationId estável na tentativa e novo ID só para nova decisão após reconciliação. Guardar ponteiro {resource,scopeId,mutationId,payloadHash,startedAt,contextId} no sessionStorage, sem token/segredo nem fila offline. Memória mantém o payload enquanto a sessão está aberta. Recibo confirma revisão histórica; buscar recurso atual sem regredir o cache se outra pessoa já salvou depois.
```js
case 'saveUnconfirmed':
  return { ...state, status: 'unconfirmed', error: 'Resultado da gravação não confirmado.' }
```
- [ ] GET sem recibo continua incerto. Reconsultar é leitura, não reenvio. Enquanto houver envio incerto, bloquear nova mutação diferente do mesmo recurso; após 24 h, exigir leitura/revisão explícita antes de nova intenção. Sem ponteiro persistível, informar limitação de recuperação após reload, mas manter controle em memória; nunca exibir sucesso local falso.
- [ ] Permitir navegação durante saving/unconfirmed; feedback fora da tela; alterações pós-envio não se misturam à payload submetida. Prefs locais fora desse controlador. Rodar regressões de usePrintingSettingsController e navegação; commit `feat: preserve settings drafts and reconcile uncertain saves`.

## T15 — Conflito em três estados e descarte de rascunhos

**Arquivos:** criar `src/app/settingsConflict.js`, `src/app/settingsConflict.test.js`, `src/components/SettingsConflictReview.jsx`, `src/components/SettingsConflictReview.test.js`, `src/settingsDraftNavigation.test.js`; modificar `src/app/useNavigationController.js`, `src/app/useBusinessSettingsController.js`, `src/App.jsx`.
**Consome:** base/draft/current e meta T14; navegação da A.
**Produz:** `buildSettingsConflict({base,draft,current}) -> { candidate, conflicts }`; revisão explícita chama edit e prepara novo save sem envio automático; navegação conhece domínio do rascunho e intenção única.

- [ ] RED: remoto apenas => preservar remoto; local apenas => propor local; ambos diferentes => exigir escolha; ordem é lista inteira; item removido/usado tem mensagem específica. Exemplo:
```js
const base = { late: 30, grace: 15 }
const review = buildSettingsConflict({ base, draft: { late: 25, grace: 15 }, current: { late: 30, grace: 10 } })
assert.deepEqual(review.candidate, { late: 25, grace: 10 })
assert.equal(review.conflicts.length, 0)
```
- [ ] Rodar `node --test src/app/settingsConflict.test.js src/components/SettingsConflictReview.test.js src/settingsDraftNavigation.test.js`.
- [ ] GREEN: comparar listas por ID, nunca índice; deletar versus alterar é conflito; nativo ou first use recém-confirmado remove ações ilegais. Exibir Atual no negócio / Seu ajuste / Escolha para salvar; dois lados diferentes não recebem resolução padrão destrutiva. Mesmo candidate sem colisões exige revisão e click novo; expectedRevision atualizado só após revisão aceita.
```js
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
if (same(draftValue, baseValue)) candidateValue = currentValue
else if (same(currentValue, baseValue) || same(draftValue, currentValue)) candidateValue = draftValue
else conflicts.push({ path, base: baseValue, current: currentValue, draft: draftValue })
```
- [ ] Sair de editor dirty abre Continuar editando / Descartar alterações; não salvar no modal; revalidar destino antes de descartar, uma intenção por vez. Mais fecha antes de confirmação; Escape/foco corretos. Trocar Tempos/Modalidades dentro do mesmo agregado preserva draft, sem modal. Rascunho de novo pedido preserva o fluxo anterior. beforeunload só enquanto há rascunho ou compromisso incerto pertinente, respeitando limites do navegador.
- [ ] Testar destino revogado durante modal, duplo clique, logout durante revisão e navegação durante envio; rodar navigationContinuity/navigationContext/confirmationFlowRegression; commit `feat: review settings conflicts and protect unsaved navigation`. Checkpoint R4.

## T16 — Home de Configurações e componentes visuais compartilhados

**Arquivos:** criar `src/pages/SettingsHome.jsx`, `src/pages/SettingsHome.test.js`, `src/components/SettingsEditorShell.jsx`, `src/components/SettingsItemList.jsx`, `src/components/SettingsItemDialog.jsx`, `src/components/SettingsPrimitives.test.js`, `src/settings.css`; ler `src/test-support/settingsFixtures.js` de T01; modificar `src/pages/Settings.jsx`, `src/app/navigation.js`, `src/components/Sidebar.jsx`, `src/App.jsx` somente na ligação de destinos.
**Consome:** tokens/componentes existentes, capabilities T08, controlador T14.
**Produz:** `SettingsHome({granted,implemented,onNavigate})`; `SettingsEditorShell({title,description,scope,effectiveNotice,state,readOnly,onSave,onDiscard,children})`; `SettingsItemList({items,getActions,onAction,label})`; `SettingsItemDialog({open,kind,initialValue,onAdd,onClose})`. `kind` é cancellation ou finance; getActions informa IDs/labels/disabledReason por item. Fixtures `adminFixture`, `draftFixture` e `settingsGrants` vêm de T01.

- [ ] RED: home com sete cards para concessão completa; só dispositivo para preferences.local; nenhum menu fictício. Modal cria rascunho, não salva; readonly não tem ações editáveis. Usar workspaceHarness real, não regex como única evidência.
```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { workspaceHarness, buttonNamed } from '../test-support/renderWorkspace.js'
test('home sem acesso administrativo oferece somente dispositivo', async (t) => {
  const h = await workspaceHarness(t)
  const { default: SettingsHome } = await h.load('/src/pages/SettingsHome.jsx')
  const screen = await h.render(SettingsHome, { granted: new Set(['preferences.local']),
    implemented: new Set(['settings-home','settings-device']), onNavigate() {} })
  assert.ok(buttonNamed(screen.root, 'Preferências deste dispositivo'))
  assert.equal(buttonNamed(screen.root, 'Formas de pagamento'), undefined)
})
```
- [ ] Rodar `node --test src/pages/SettingsHome.test.js src/components/SettingsPrimitives.test.js`.
- [ ] GREEN: grade responsiva com cards inteiros acionáveis e nome acessível pelo título; padrão de listas com linhas e menus, não tabela desktop reduzida no mobile. Reusar Modal/Button/SystemSelect/Icon; foco e Escape; estado read-only em texto, sem dezenas de inputs cinzentos.
```css
.settings-home-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr)); gap:16px; }
.settings-home-card { min-width:0; border:1px solid var(--border); border-radius:var(--radius-lg); background:var(--surface); color:var(--text); }
.settings-home-card-icon { background:var(--primary-soft); color:var(--primary); }
@media (max-width:640px) { .settings-home-grid { grid-template-columns:minmax(0,1fr); } }
```
- [ ] Adicionar settings-home e settings-operations/modalities/payments/cancellations/finance-categories ao registro, usando implementados apenas quando a respectiva tela estiver pronta. Home não mostra placeholders; screenshots finais só depois de todos os destinos funcionais. Sidebar ativa por área inclui novos destinos, sem segundo menu paralelo. IDs antigos settings-printing/device continuam válidos.
- [ ] Footer de save tem área reservada no fluxo; sticky somente sem sobrepor bottom nav/teclado; usar tokens reais de safe area. Erros com role alert, salvamento com aria-live e foco no primeiro campo inválido. Não adicionar busca de configuração sem funcionalidade aprovada.
- [ ] Testar claro/escuro, mobile e keyboard; comparar home com último mockup vermelho. Rodar navigationLayout/settingsNavigation; commit `feat: build responsive settings home and editor primitives`.

## T17 — Tela de Operação e acesso de Modalidades

**Arquivos:** criar `src/pages/OperationSettings.jsx`, `src/pages/OperationSettings.test.js`; integrar `Settings.jsx` e `src/settings.css`.
**Consome:** operationsData, controlador T14, shell/lista T16.
**Produz:** `OperationSettings({resourceState,readOnly,initialSection,onEdit,onSave,onDiscard})`; initialSection = timing ou modalities, mesmo rascunho/revisão/save.

- [ ] RED: dois acessos da home abrem o bloco correspondente, sem apagar alterações do outro; quatro campos com faixas; padrão ativo; labels e unidade; nada persiste no change. Exemplo:
```js
const draft = structuredClone(DEFAULT_OPERATIONS)
draft.timing.scheduledPrepLeadMinutes = 40
draft.defaultModality = 'Retirada'
assert.equal(parseOperations(draft).timing.scheduledPrepLeadMinutes, 40)
// No teste de interação, onEdit recebe o draft e o contador de onSave permanece 0 até click explícito.
```
- [ ] Rodar `node --test src/pages/OperationSettings.test.js`.
- [ ] GREEN: reproduzir painel de operação: header, aviso de impacto, card de tempos em duas colunas no desktop; modalidades em linhas com estado e padrão. No mobile, campos/linhas empilhados, inputMode numeric, sufixo min legível, ação de save acessível. Abrir Modalidades foca o bloco e usa o mesmo componente/controlador, não uma política duplicada.
```jsx
<SettingsEditorShell title="Operação" scope="Todo o negócio" effectiveNotice="Os tempos afetam pedidos ativos. Modalidades valem para novos pedidos."
  state={resourceState} readOnly={readOnly} onSave={onSave} onDiscard={onDiscard}>
  <section id="settings-timing" aria-labelledby="timing-title"><h2 id="timing-title">Tempos da cozinha</h2>{timingFields}</section>
  <section id="settings-modalities" aria-labelledby="modalities-title"><h2 id="modalities-title">Modalidades de pedido</h2>{modalityRows}</section>
</SettingsEditorShell>
```
- [ ] timingFields contém os quatro campos de T01; modalityRows contém apenas os três nativos em ordem fixa. Avisar que antecipação pode mover agendados entre espera/operação, sem mudar horário de impressão. Erro do outro bloco mantém contagem de pendências e atalho para ele. Proibição de desativar padrão permite troca válida no mesmo draft.
- [ ] Testar invalid/readonly/saving/conflict além do estado feliz, celular com teclado e texto longo. Commit `feat: implement operation and modality settings layouts`.

## T18 — Tela de Pagamentos e consumidores operacionais

**Arquivos:** criar `src/pages/PaymentSettings.jsx`, `src/pages/PaymentSettings.test.js`, `src/businessPaymentOptions.test.js`; modificar `src/utils/paymentMethodOptions.js`, `src/App.jsx`, `src/components/TableTabPaymentDialog.jsx`, `src/components/ReceivablesQuickPaymentDialog.jsx`, `src/components/RegisterRefundDialog.jsx`, `src/components/CancelOrderDialog.jsx`, `src/components/MovementDialog.jsx`, `src/components/OrderCheckoutSummary.jsx` onde houver consumo de método/default.
**Consome:** paymentMethodsData, EffectiveConfig e controlador; mapeamentos T01.
**Produz:** `PaymentSettings({resourceState,readOnly,onEdit,onSave,onDiscard})`; `paymentOptionsFromEffective(config) -> [{value,label,code}]`. value permanece valor português operacional; code é ID da política.

- [ ] RED: seis linhas nativas; não existe Adicionar forma/Renomear/Excluir; ordenar por menu e teclado; mudança de default não altera diálogo aberto. Desativação remota de seleção existente avisa sem trocar por Pix e preserva formulário.
```js
const options = paymentOptionsFromEffective({ paymentMethods: {
  methods: [{ code: 'pix', label: 'Pix', value: 'Pix' }, { code: 'cash', label: 'Dinheiro', value: 'Dinheiro' }], defaultMethod: 'pix',
} })
assert.deepEqual(options.map(x => x.value), ['Pix', 'Dinheiro'])
```
- [ ] Rodar `node --test src/pages/PaymentSettings.test.js src/businessPaymentOptions.test.js`.
- [ ] GREEN: implementar modelo do mockup de pagamento com badges/menu e footer, mas sem botão Adicionar. Desktop: linhas alinhadas de nome/status/padrão/ações; mobile: linha/cartão compacto com nome e badges empilhados, menu acessível. Lista é um único componente responsivo, sem estados de dados duplicados.
```js
const actions = [
  { id: item.active ? 'deactivate' : 'activate', label: item.active ? 'Desativar' : 'Ativar' },
  ...(item.active && item.code !== data.defaultMethod ? [{ id: 'default', label: 'Definir como padrão' }] : []),
  { id: 'up', label: 'Mover para cima' }, { id: 'down', label: 'Mover para baixo' },
]
```
- [ ] Remover fontes duplicadas de opções dos consumidores listados; `rg 'PAYMENT_METHOD_OPTIONS|PAYMENT_OPTIONS|useState\(.Pix.|setPaymentMethod\(.Pix.' src` auxilia auditoria, mas histórico mantém rótulos completos. Aplicar padrão somente na abertura de nova seleção. Caixa de movimento que inicia vazia continua exigindo escolha. Estorno mostra meio original sem forçar opção inativa.
- [ ] Testar pagamento de comanda sem duplicidade, alvo estável e reconciliação da A; executar operationalPayment/comandasAppWiring e testes dos diálogos alterados. Commit `feat: implement payment settings and use effective methods`.

## T19 — Tela de Motivos e seleção no cancelamento

**Arquivos:** criar `src/pages/CancellationSettings.jsx`, `src/pages/CancellationSettings.test.js`, `src/cancellationSettingsIntegration.test.js`; modificar `Settings.jsx`, `CancelOrderDialog.jsx`, `OrderDetail.jsx`, `OrderHistory.jsx` e leitura de rótulos de motivo se necessário.
**Consome:** catálogo administrativo/meta; motivos ativos da projeção; T05/T09.
**Produz:** `CancellationSettings({resourceState,readOnly,onEdit,onSave,onDiscard})`; cancelamento usa motivo do negócio sem afetar elegibilidade/estorno.

- [ ] RED: cinco nativos identificados corretamente; Outro protegido; Adicionar à lista só modifica draft; personalizado usado não tem rename/delete; a seleção de cancelamento recebe personalizados ativos e mantém nome histórico inativo.
```js
const other = resourceState.confirmed.data.items.find(x => x.id === 'other')
assert.ok(other.active)
assert.equal(resourceState.confirmed.meta.items.other.isSystem, true)
assert.equal(resourceState.confirmed.meta.items.other.canDelete, false)
```
- [ ] Rodar `node --test src/pages/CancellationSettings.test.js src/cancellationSettingsIntegration.test.js`.
- [ ] GREEN: reproduzir mockup de cancelamento com lista compacta, origem, estado, menu e modal. Modal nome/ativo inicial, Cancelar/Adicionar à lista; indicar Novo e Alteração pendente até save. Nota de Outro validada em 240 caracteres no cliente e Worker. IDs de novos itens são UUIDs estáveis no draft e no replay, sem colidir com nativos.
```js
onEdit({ items: [...data.items, { id: crypto.randomUUID(), label: name.trim(), active: true, sortOrder: data.items.length }] })
```
- [ ] Cancelamento carrega motivos ativos pela configuração, não constantes locais. Leitura histórica usa rótulo resolvido do Worker pelo ID persistido (inclui inativo); não expor o catálogo administrativo completo para rotular um pedido. Conflito por primeiro uso mostra erro localizado e preserva intenção.
- [ ] Testar desktop/mobile, modal/escape/readonly, estado incerto e revisão; commit `feat: implement cancellation settings and active reason selection`.

## T20 — Tela de Categorias financeiras e formulário de movimento

**Arquivos:** criar `src/pages/FinanceCategorySettings.jsx`, `src/pages/FinanceCategorySettings.test.js`, `src/financeCategorySettingsIntegration.test.js`; modificar `Settings.jsx`, `MovementDialog.jsx`, `src/utils/finance.js`, consumidores de categoria em Finance.jsx/Dashboard se necessário.
**Consome:** T06/T09; catálogo completo para administração e projeção ativa para novo movimento.
**Produz:** `FinanceCategorySettings({resourceState,readOnly,onEdit,onSave,onDiscard})`; dois grupos visuais com uma revisão/save.

- [ ] RED: grupos Entrada/Saída; Adicionar categoria solicita tipo; tipo existente não editável; automáticas não têm ações; nenhum saldo inicial; lista vazia bloqueia apenas criação do tipo, e edição antiga mantém referência original.
```js
const draft = structuredClone(resourceState.confirmed.data)
draft.items.push({ id: 'custom-marketing', type: 'saida', label: 'Marketing', active: true, sortOrder: 11 })
assert.equal(draft.items.filter(x => x.type === 'saida' && x.id === 'custom-marketing').length, 1)
// A interação Adicionar à lista não chama putSettings; só Salvar alterações persiste.
```
- [ ] Rodar `node --test src/pages/FinanceCategorySettings.test.js src/financeCategorySettingsIntegration.test.js`.
- [ ] GREEN: manter composição do mockup financeiro, duas superfícies com cabeçalhos e listas; cores semânticas de entrada/saída via tokens. Desktop compacto, mobile sem tabela horizontal. Save do conjunto mostra pendências em ambos os grupos; botões não ficam escondidos ao rolar Saídas.
```jsx
<section aria-labelledby="manual-in-title"><h2 id="manual-in-title">Entradas manuais</h2>{incomeList}</section>
<section aria-labelledby="manual-out-title"><h2 id="manual-out-title">Saídas manuais</h2>{expenseList}</section>
```
- [ ] Adaptar MovementDialog para opções ativas por tipo e leitura do valor histórico preservado. Rótulos de lançamentos antigos vêm do Worker/mapa histórico por referência, não filtro de ativos. Empty state com acesso à administração apenas quando permitido, sem criar categoria fallback. Editar/remover movimento não libera rename/delete de categoria usada.
- [ ] Rodar regressões financeiras, modal e estados por tema; commit `feat: implement finance category settings and consumers`.

## T21 — Tela de Impressão, dispositivo e integração final de opções

**Arquivos:** modificar `PrintingSettingsContent.jsx`, `src/app/usePrintingSettingsController.js`, `src/printing/usePrintingManager.js`, `src/pages/Settings.jsx`, `src/pages/NewOrder.jsx`, `src/components/NewOrderCustomerStep.jsx`, `src/pages/Orders.jsx`, `src/App.jsx`; criar `src/settingsPrintingPolicy.test.js`, `src/settingsDevicePersistence.test.js`, `src/businessOperationsUi.test.js`.
**Consome:** T07/T10/T12–T16 e componentes atuais de impressão/ThemeProvider.
**Produz:** três blocos de impressão com controladores por recurso; dispositivo com autosave real; modalidades/tempos efetivos usados em todos os consumidores.

- [ ] RED: salvar vias não chama selecionar impressora; trocar QZ não muda negócio; principal exige confirmação; nome real da estação; testes de falha localStorage. Modalidade padrão geral não prevalece sobre contexto de mesa; inativa preserva pedido existente e bloqueia só novas criações.
```js
const data = { orderDefaultCopies: 2, tableTabDefaultCopies: 1 }
await controller.edit('printingPolicy', data)
assert.equal(calls.putSettings.length, 0)
await controller.save('printingPolicy')
assert.equal(calls.selectPrinter.length, 0)
```
- [ ] No teste, controller é a instância real de T14 e calls é gravador das fronteiras API/QZ do harness, não controlador falso. Rodar `node --test src/settingsPrintingPolicy.test.js src/settingsDevicePersistence.test.js src/businessOperationsUi.test.js`.
- [ ] GREEN: reproduzir os três cards do mockup de impressão: **Política do negócio** (Pedidos avulsos/Mesas e comandas, 1/2, Salvar política); **Esta estação** (real, autoimpressão, Salvar estação e Tornar principal); **Impressora local/QZ** (seleção, Salvar impressora, Testar e estado físico). Aviso correto: novas solicitações de impressão, não só novos pedidos. Preservar recovery/atenção e seleção de fila existente; dispositivos não executores usam somente fila central.
```jsx
<p className="settings-effective-notice">Apenas novas solicitações de impressão. A fila existente mantém suas vias.</p>
```
- [ ] Adaptar APIs do printing manager para revisão/recibo, sem segundo dono para estado remoto: controlador da A delega política/estação ao novo controlador ou é adaptado com mesma fonte; estado local do transporte continua nele. Bootstrap registra estação ausente sem regravar name/autoPrint/defaults de estação já existente. Health, heartbeat e execuções não dependem da página Settings montada.
- [ ] Dispositivo reproduz somente aparência (Claro/Escuro/Automático) e som. Autosave local; erro de storage não mostra Salvo; nenhum diagnóstico inventado. Manter preferência compartilhada com Cozinha e tema da aplicação, sem ressincronizar entre máquinas.
- [ ] Ligar operations efetivo ao NewOrder, kitchen helpers, relatórios/clock; draft existente conserva carrinho/cliente/seleção válida. Rota por comanda usa Local apenas habilitado; modalidade desativada durante preenchimento pede revisão, sem conversão silenciosa. Erro POLICY_CHANGED refresca opções e conserva formulário. Usar função de política T10 para históricos.
- [ ] Rodar todas as regressões de printing, NewOrder, kitchen clock e order identity; commit `feat: implement scoped printing and local preference layouts`. Checkpoint R5.

## T22 — Revisão integrada de UX, responsividade e regressões

**Arquivos:** criar `src/specBSettingsIntegration.test.js`, `src/settingsResponsive.test.js`, `docs/superpowers/qa/2026-09-12-spec-b-acceptance.md`; modificar CSS e componentes de T16–T21 somente para defeitos observados.
**Consome:** todas as telas e fluxos; imagens individuais + contrato visual.
**Produz:** matriz QA por V01–V14 e cenário; estados ainda não executados marcados explicitamente, sem aprovação presumida.

- [ ] RED para cada regressão descoberta: teclado sobre botões, campos truncados, menu fora da tela, perda de foco, cache cruzado ou interação indevida em readonly. Teste de integração usa componentes reais; regex CSS é apenas complemento.
```js
const h = await workspaceHarness(t, { mobile: true })
const { default: SettingsHome } = await h.load('/src/pages/SettingsHome.jsx')
const before = h.activitySnapshot({ ignoreFocus: true })
const screen = await h.render(SettingsHome, { granted: new Set(['preferences.local']),
  implemented: new Set(['settings-home', 'settings-device']), onNavigate() {} })
await act(async () => screen.unmount())
assert.deepEqual(h.activitySnapshot({ ignoreFocus: true }), before)
```
- [ ] Importar act de react-test-renderer no teste de desmontagem acima. Acrescentar cenário integrado com App, APIs simuladas e navegação por todas as categorias: contar timers após bootstrap e após cada retorno; navegar não acrescenta timers ou listeners permanentes. Rodar `node --test src/specBSettingsIntegration.test.js src/settingsResponsive.test.js`.
- [ ] GREEN: corrigir apenas defeitos demonstrados e retestar; nunca trocar todo layout por preferência do implementador. Controle nativo/meta/ações continua igual em desktop e mobile. Cobrir formulário longo, nome de 80 caracteres, reordenação sem drag e erro em seção fora da viewport.
- [ ] Gerar capturas reais individuais com navegador disponível no ambiente de execução: `V01-home-desktop-light.png`, `V01-home-desktop-dark.png`, `V01-home-mobile-light.png`, repetindo para V02–V08. Em mobile testar claro **e** escuro; V09–V14 recebem capturas dos estados. Não usar imagens geradas como prova da implementação. Se não houver navegador, registrar pendência e fazer a homologação com o usuário, sem inventar sucesso.
- [ ] Aplicar a matriz seguinte a **cada** categoria; guardar arquivo/viewport/tema/SHA e resultado no QA. A aprovação anterior da direção visual não aprova automaticamente estas capturas.

| Cenário | Critério |
|---|---|
| 1440/1024 px, claro/escuro | Sidebar da A, tokens corretos, proporções/agrupamentos do mockup individual, nenhum azul primário novo. |
| 768/390/360/320 px | Sem overflow horizontal; grade/listas se adaptam; alvos de toque da aplicação; texto não cortado. |
| Teclado virtual / zoom 200% | Campo, erro, Save e Descartar acessíveis; footer não cobre bottom nav nem conteúdo. |
| Modal/menu/conflito | Foco inicial/retorno, Escape, um diálogo por vez, diferenças compreensíveis no celular. |
| Leitura/sem permissão | Dados em leitura sem ações, card omitido quando sem view, rota direta validada. |
| Load/erro/incerto/salvo | Não fingir defaults confirmados ou rollback, rascunho preservado, sucesso só confirmado. |
| Navegação | Tempos/Modalidades compartilham draft; troca de domínio pede descarte; saving não bloqueia sair. |

- [ ] Commit `test: cover Spec B settings UX and responsive acceptance`. Evidência QA deve distinguir pass automatizado, pass manual e não testado.

## T23 — Gates finais, staging e passagem para merge autorizado

**Arquivos:** atualizar QA/ledger e `docs/release-and-migration-runbook.md`; criar `docs/operations/spec-b-settings.md`; ajustar `.github/workflows/validate.yml` apenas para acrescentar gate D1 local aprovado, sem remover gates nem mudar triggers de deploy.
**Consome:** R1–R5 revisadas e T22.
**Produz:** revisão final, runbook de rollout/rollback, staging homologado e PR preparado **quando executado e aprovado**, não por existir este documento.

- [ ] Antes de publicar, rodar novamente no HEAD exato:
```bash
npm ci
npm test
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
npm run d1:migrate:local
node scripts/infra/spec-b-d1-gate.mjs
git diff --check
```
Esperado: exit 0 em todos, zero falhas relevantes; warnings conhecidos registrados sem mascarar erro. Evidência de node:sqlite não substitui gate D1. Nenhum comando acima publica produção.
- [ ] Revisar diffs por domínio e por tela; nenhum hardcode editável remanescente em consumidor esquecido. Conferir migrations novas numeradas, schema final/índices/FKs e compatibilidade com o rollout; preservar overrides 1 via já salvos. Não remover campos/rotas legados sem testar clientes antigos: PUT antigo solicita atualização, não bypass de versão.
- [ ] Runbook descreve pré-condição backup/evidência, ordem migrations → aplicação, refresh de clientes e validação. Rollback de código antigo após personalizações/table-tab 2 vias **não é presumido seguro**. Testar compatibilidade ou preferir correção adiante; nunca apagar dados para viabilizar downgrade.
- [ ] Pedir autorização de publicação de staging no checkpoint. Usar workflow/manual de staging do repo com o SHA da branch revisada; conferir banco e ambiente. Não rodar deploy:production nem migration remota sem env staging. Registrar SHA real publicado e migrations aplicadas, não apenas SHA local esperado.
- [ ] Homologar dois dispositivos: editar políticas, verificar propagação; manter carrinho aberto; conflito de mesma revisão; timeout/recibo/reload; roles simuladas somente para testes. Visuais completos T22 e fluxos críticos login, pedidos, Comandas/transferência, financeiro e preferências.
- [ ] Homologação física obrigatória: avulso 1 e 2 vias; pedido de mesa 1 e 2; resumo comanda 1 e 2; impressora offline/reconexão; resultado desconhecido exige decisão, sem repetição automática; job com primeira via concluída seguido de outro job mantém segunda via do mesmo antes de prosseguir; trocar política com jobs pendentes não altera suas cópias; teste sempre 1 via; fechamento/transferência não troca identidade.
- [ ] Qualquer defeito: teste RED específico quando automatizável, correção localizada, GREEN/gates, republicação staging e nova evidência no SHA corrigido. Não manter QA aprovado sobre SHA anterior de aplicação diferente.
- [ ] Preparar PR para master com spec/contrato/plano, resumo por domínio, migrations, matriz QA, gates e riscos/rollback. Deixar merge e produção pendentes de autorizações explícitas. Commit documental `docs: close Spec B QA after staging acceptance` apenas depois do aceite real.

---

## 4. Cobertura da spec e contrato visual

| Requisito | Tarefas |
|---|---|
| D01 pagamentos; D02 motivos; D05 categorias | T01, T04–T06, T09, T18–T20 |
| D03 tempos, D06 modalidades, D25 limites | T01–T03, T09–T10, T17, T21 |
| D04 impressão por contexto e safety física | T02, T07, T11–T12, T21, T23 |
| D07 catálogo produtos; D08 telefone; D14 técnico; D15 fuso | Constraints globais, caracterização T01, regressões T22–T23; sem novas telas/configurações |
| D09 tipagem; D10 revisão; D11 migração; D24 atomicidade | T01–T07, T09, T11 |
| DA capabilities e D22 view/manage | T08, T13, T16–T22 |
| D12 efetiva; D13 sync; D16 metadados | T02–T03, T08, T13–T14 |
| D17 defaults/ativos; D26 rename; D27 delete | T01, T04–T06, T09, T18–T20 |
| D18 home; D19 save; D20 listas | T14, T16–T21 |
| D21 descarte; D23 conflito; envio incerto | T03, T14–T15, T22 |
| V01 home; V02/V03 operação/modalidades | T16–T17, T22 |
| V04 pagamentos; V05 cancelamentos; V06 financeiro | T18–T20, T22 |
| V07 impressão; V08 dispositivo | T21–T23 |
| V09 modal; V10 descarte; V11 conflito | T15–T20, T22 |
| V12 incerto; V13 readonly; V14 loading/indisponível | T08, T13–T16, T22 |
| História/soft-delete/first use e races | T02, T05–T06, T09–T10 |
| A: serviço sobrevive unmount, identidades e navegação | T12–T15, T21–T23 |

## 5. Entrega por rodada ao usuário / Codex

Em cada parada, informar: branch, HEAD inicial/final, tarefa concluída, testes RED/GREEN e comandos, arquivos/commits, revisão, pendências reais e próxima tarefa. Publicar commits na branch de feature para revisão, sem merge em master. Atualizar ledger no mesmo conjunto de commits; não marcar próximo item como concluído.

Primeira execução recomendada após aprovação do plano: **somente R1 (T01–T03)**. Antes de código, o Codex deve ler os dois documentos, este plano, instruções do repositório e imagens anexadas. A execução de R1 não inclui staging ou produção. Depois da revisão, autorizar a próxima rodada.

Antes de qualquer commit de implementação: `git diff --check`, `git diff --stat`, revisão do patch e `git add --` somente caminhos explícitos da tarefa. Nunca incluir trabalho de outra branch ou dados reais/segredos. As mensagens de commit das tarefas são sugestões, não prova de execução.

## 6. Fontes e limitações verificadas para este plano

Inspeção de código por GitHub na base indicada: documentos funcionais/visuais; navigation.js/useNavigationController.js; renderWorkspace.js; auth.js; testes de repositório de impressão com node:sqlite; workflow validate.yml. A auditoria anterior da mesma base e as referências R1–R15 da spec completam os pontos de integração listados. Os caminhos novos de T01–T23 ainda serão criados.

Documentação primária consultada em 12/09/2026:
- Cloudflare D1 Database, batch: https://developers.cloudflare.com/d1/worker-api/d1-database/ — transação/rollback em falha de statement, não em UPDATE que afeta zero linhas.
- Cloudflare D1 foreign keys: https://developers.cloudflare.com/d1/sql-api/foreign-keys/ — foreign_keys é imposto; defer_foreign_keys não elimina ações de FK.

As garantias do protocolo de assertions/recibos deste plano são um desenho a demonstrar nos testes T03/T09/T11, não uma afirmação de que foi executado. Nenhum teste do aplicativo, migration, build, staging ou impressão física foi executado ao redigir este documento. O gate D1 e o teste físico são bloqueantes na execução, não dispensáveis por esta análise.

## 7. Autorrevisão documental e estado

Conferir antes de publicar o plano: D01–D27/DA/DV cobertos; V01–V14 mapeados; modelos individuais e paleta/mobile explícitos; schemas/nomes e dependências coerentes; migrations históricas imutáveis; zero deploy autorizado implicitamente; nenhum checkbox de execução marcado.

O plano está submetido à revisão do usuário. A próxima ação operacional é a aprovação do plano e a autorização explícita da primeira rodada ao Codex. Não iniciar automaticamente a implementação ao terminar de ler.
