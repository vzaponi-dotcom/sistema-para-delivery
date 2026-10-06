# Gestão administrativa de empresas — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Entregar a lista e a página de gestão aprovadas, com suspensão, vínculos, convites, exclusão recuperável, restauração e histórico.

**Architecture:** O domínio `platform` coordena a interface e as mutations administrativas; `worker/platform` aplica capabilities atuais e transações D1. O ciclo administrativo permanece independente da ativação inicial, e helpers de tenancy mantêm os bloqueios de sessão, vínculo, convite e TV. Domínios têm entrega própria. Após o aceite local e autorização de homologação em 06/10/2026, apenas esta branch foi admitida para staging manual, preservando os gates de publicação.

**Tech Stack:** React/React Router/Vite existentes, Worker/D1/R2, Node.js 22, `node:test`, harness React e adaptador SQLite já presentes; sem dependências novas.

**Spec:** [Especificação aprovada](../specs/2026-10-05-platform-company-management-design.md).

Estado: plano aprovado e concluído, com execução inline e revisão independente, conforme escolha do usuário em 05/10/2026. Tarefas 1–8 e a rodada de correções da revisão concluídas; versão combinada com a master: 3622/3622 testes. Branch: `codex/administracao-empresas`. Aceite manual local e autorização de push/PR/CI/staging recebidos em 06/10/2026; merge na master e produção permanecem etapas próprias. Evidências e limitações no [QA](../qa/2026-10-05-platform-company-management.md).

## Global Constraints

- “A primeira entrega reúne a interface e as regras de gestão, mantendo o painel nas rotas atuais `/mesiva/empresas`.”
- “Não alterar DNS, origens de autenticação, cookies ou workflows de deploy nesta entrega.”
- “O painel administrativo opera no contexto `platform`.”
- “Preservar `access_status` e acrescentar `lifecycle_status`, com valores `enabled`, `suspended` e `deleted`, default `enabled`.”
- “Acrescentar `management_revision`, inteiro não negativo com default zero.”
- “Todas as novas mutations de gestão exigem motivo de 3 a 500 caracteres Unicode, após trim, e `expectedRevision`.”
- “Restaurar sempre resulta em suspensão.”
- “Não inferir grants pelo nome ‘Administrador Mesiva’.”
- “Não enviar e-mail ao suspender, excluir, restaurar ou revogar vínculo.”
- “Não executar `DELETE` de empresa, conta, pedidos, financeiro, auditoria, impressões ou objetos R2; não impor prazo de purga.”
- “Não ressuscitar sessões, links ou pareamentos anteriores.”
- “A suspensão não promete recolher dados já recebidos por um dispositivo desconectado, desfazer efeitos externos concluídos nem parar papel já entregue ao QZ/spooler.”
- Node.js 22, versões de Wrangler fixadas nos scripts, instalação por `npm ci` quando necessária. Não depender de instalação global.
- Preservar mudanças externas, bancos/servidores existentes e todos os gates. Só encerrar processos criados para esta tarefa. Documentação e produto em português.

## Review Focus

1. Resposta perdida depois do commit: consultar a receipt, manter a chave original e nunca repetir e-mail automaticamente — tarefas 3, 5 e 7.
2. Reenvio administrativo de convite de equipe: o emissor `platform` não é um gerente operacional e a aceitação precisa reconhecer esse emissor autorizado — tarefa 5.
3. Empresa pendente suspensa/excluída: restaurar/retomar não ativa empresa nem vínculo nunca aceito — tarefas 4, 5 e 7.
4. Dois gestores/abas agindo ao mesmo tempo: revisão e regra da última pessoa administradora precisam sobreviver ao commit concorrente — tarefas 2, 4 e 5.
5. Audit, cursor e estado visual históricos: valores nulos, timestamps SQLite antigos, filtros diferentes e convite aceito não podem ocultar bloqueios ou vazar dados — tarefas 1, 6 e 7.

## Contratos entre tarefas

Tipos descritos aqui são contratos JavaScript, sem introduzir TypeScript:

- `ManagementInput = { reason: string, expectedRevision: number, confirmationName?: string }`.
- `ManagementTarget = { businessId: string, operation: 'suspend' | 'resume' | 'delete' | 'restore' | 'membership.revoke' | 'membership.reactivate' | 'invitation.cancel' | 'invitation.resend', userId?: string, invitationId?: string }`.
- `ManagementResult = { businessId: string, operation: string, resourceId: string, managementRevision: number, invitationId?: string, userId?: string, expiresAt?: string, delivery?: { status: string } }`.
- `PreparedManagement = { statements: D1PreparedStatement[], result: ManagementResult, deliveryMessage?: object }`; token bruto existe somente em `deliveryMessage` transitório, nunca em receipt, response ou audit.
- `ManagementAttemptView = { status: 'confirmed', result: ManagementResult }`. Receipt inexistente retorna 404; isso não prova que uma chamada ainda em andamento falhou.
- Listagem: `{ items: Company[], nextCursor: string | null }`; `Company` preserva os campos atuais e acrescenta `lifecycleStatus` e `managementRevision`.
- Pessoas: `{ users: Member[], managementRevision: number }`; manter projeção sanitizada de `Member` e incluir `canRevoke`, `canReactivate`, `canCancelInvitation`, `canResendInvitation`, sem capabilities operacionais completas. Esses flags expressam elegibilidade do alvo; UI combina-os com grants do emissor e Worker autoriza cada ação independentemente.
- Histórico: `{ items: { id, action, result, occurredAt, actorName, reason, resourceType, resourceId }[], nextCursor }`, com campos novos nulos nos eventos anteriores quando não houver informação.

## Mapa de responsabilidades

Schema e grants: migration nova `0041_platform_company_management.sql`, `shared/companyAccess.js` e `worker/platform/bootstrap.js`. Se surgir migration externa durante execução, reservar o próximo número livre e ajustar somente este plano.

Transações: `worker/platform/managementTransactions.js` cuida de validação/replay; `businessManagement.js`, `membershipManagement.js` e `invitationManagement.js` preparam ações; `managementCommands.js` coordena commit e entrega de convite.

Consultas/rotas: repositório atual de empresas, novo `managementRepository.js`, API administrativa atual e política de rotas. Bloqueios comuns: identity, tenancy e TV, com um facade de banco restrito à sessão operacional.

UI: `CompanyList` e `CompanyDetail` permanecem owners das páginas; componentes de pessoas/histórico/confirmação e hook de gestão ficam dentro do domínio. `src/App.jsx` compõe o owner de tentativas, exportado pelo `index.js` de `platform`.

## Task 1: Schema, grants e compatibilidade de upgrade

**Files:** criar `migrations/0041_platform_company_management.sql`, `worker/platform/managementMigration.test.js`, `scripts/infra/company-management-d1-gate.mjs`, `worker/test-support/companyManagementDb.js`; modificar `shared/companyAccess.js`, `shared/companyAccess.test.js`, `worker/platform/bootstrap.js`, `worker/platform/bootstrap.test.js`, `worker/platform/audit.js`, `worker/platform/audit.test.js`.

**Interfaces:** produzir `BUSINESS_LIFECYCLE_STATES` e `COMPANY_STATUS_FILTERS = ['visible','active','pending','suspended','deleted','all']`; ampliar `PLATFORM_CAPABILITIES` com as cinco permissões da spec. Acrescentar `reason`, `resource_type`, `resource_id`, `metadata_json` à auditoria e tabela `platform_management_receipts` com conta, empresa, operação, chave, hash, resultado JSON e UTC; `UNIQUE(account_id,idempotency_key)`. Helper de teste `createManagementFixture(t)` reutiliza `createTenancyFixture(t)` e acrescenta grants administrativos explicitamente, sem ampliar o fixture original nem alterar seus testes de permissões limitadas.

- [x] **1. Escrever testes de instalação/upgrade:** assertar `lifecycle_status === 'enabled'`, `management_revision === 0` em empresas antigas; comparar linhas de pedidos/financeiro/grants/auditoria antes/depois; `PRAGMA foreign_key_check` vazio. Assertar que somente contas identificadas em `platform_bootstraps` recebem novos grants e que uma conta delegada com os três grants antigos continua com três.
- [x] **2. Confirmar falha:** `node --test worker/platform/managementMigration.test.js shared/companyAccess.test.js`; falha por schema/constantes ausentes, não por dependência indisponível.
- [x] **3. Implementar migration e contratos:** acrescentar colunas em `businesses`; ampliar o CHECK de `platform_grants` por reconstrução controlada dessa tabela, preservando linhas/FKs/PK. Acrescentar auditoria/receipt sem recriar tabelas de negócio. Ajustar bootstrap para lista canônica e assertion baseada em todas as capabilities necessárias. Ampliar `preparePlatformAudit(db, context, { action, businessId, result, reason = null, resourceType = null, resourceId = null, metadata = {}, now })` preservando os callers antigos.
- [x] **4. Verificar:** `node --test worker/platform/managementMigration.test.js shared/companyAccess.test.js worker/platform/bootstrap.test.js worker/platform/audit.test.js scripts/infra/multi-company-production-admin.test.js scripts/infra/multi-company-staging-admin.test.js`; `node scripts/infra/company-management-d1-gate.mjs`. Gate verifica clean install e upgrade real de `0040`, incluindo timestamps/grants/audits históricos e receipts sem tokens. Esperado: zero falhas.
- [x] **5. Commit:** `feat: adicionar ciclo administrativo e permissões de empresas`.

## Task 2: Elegibilidade e guard transacional operacional

**Files:** criar `worker/tenancy/guardedBusinessDb.js`, `worker/tenancy/guardedBusinessDb.test.js`; modificar `worker/identity/sessions.js`, `worker/tenancy/eligibleBusinesses.js`, `worker/tenancy/companyInvitations.js`, `worker/kitchenTvRepository.js`, `worker/kitchenTvApi.js`, `worker/index.js`; testes existentes de identity, tenancy/isolation e TV.

**Interfaces:** produzir `withBusinessSessionGuard(db, context, { now = new Date(), monotonicNow = () => performance.now() } = {}) -> D1Facade`. Facade preserva `prepare/bind/first(column)/all/run/batch`, resultados e ordem das statements; execuções usam banco original para as assertions, evitando recursão. Produzir `prepareKitchenTvAccessRevocation(db, businessId, now) -> D1PreparedStatement[]`, sem audit operacional, para composição administrativa; o owner operacional mantém sua auditoria existente.

- [x] **1. Escrever testes:** com empresas `suspended` e `deleted`, assertar rejeição de nova sessão, contexto, logo, convite e TV. Injetar mudança de ciclo/revogação no banco original imediatamente antes de `batch` e assertar que `.run()` e DML com `.all()/RETURNING` não alteram dados nem audit. Confirmar que `first(column)`, `meta.changes`, batches com `changes()` e sessions da empresa B continuam corretos.
- [x] **2. Confirmar falha:** `node --test worker/tenancy/guardedBusinessDb.test.js worker/identity/sessions.test.js worker/tenancy/companyInvitations.test.js worker/kitchenTvRepository.test.js`.
- [x] **3. Implementar bloqueios:** exigir ciclo habilitado nas queries e assertions de sessão, seleção/privacidade e convites. Facade envolve execução de statements em batch com assertion de sessão/contexto/grants/lifecycle antes e cleanup depois, sem inserir guards entre statements originais que dependem de `changes()`. Conferir o snapshot autenticado, não aceitar grants novos lidos silenciosamente depois da autenticação. Instalar facade somente em dispatch operacional multiempresa antes de `withAuditContext`; preservar banco bruto para autenticação, platform, legacy e registro de rejeições. Aprovação/consumo do pareamento TV verificam ciclo dentro de sua transação.
- [x] **4. Verificar:** rodar os testes acima e `node --test worker/tenancy/isolationApi.test.js worker/tenancy/memberships.test.js worker/kitchenTvApi.test.js worker/kitchenTvSecurityRegression.test.js worker/identity/authApi.test.js`; zero falhas. Manter teste de corrida autenticada via `handleRequest`, além do teste do facade; preservação de pedidos/financeiro/impressão após tentativa rejeitada é obrigatória.
- [x] **5. Commit:** `fix: bloquear operações de empresas suspensas no commit`.

## Task 3: Receipt, revisão e execução administrativa

**Files:** criar `worker/platform/managementTransactions.js`, `worker/platform/managementTransactions.test.js`; modificar `worker/platform/access.js` somente se necessário para compor o snapshot já existente.

**Interfaces:** `validateManagementInput(target, input, idempotencyKey) -> ManagementInput`; `prepareManagementTransaction(db, context, target, input, { idempotencyKey, now, monotonicNow }) -> { replay: ManagementResult | null, company, snapshot, statements }`; `prepareManagementCompletion(db, prepared, result, audit, now) -> D1PreparedStatement[]`. Essa tarefa entrega helpers testáveis sem importar os preparadores ainda inexistentes das tarefas 4/5; sem rota HTTP exposta até tarefa 6.

- [x] **1. Escrever testes:** rejeitar motivo Unicode fora de 3–500 após trim, revisão negativa/fracionária, campos extras, UUID inválido e alvo malformado com 400. Assertar replay sem novo evento/revisão; chave com outro payload/alvo => 409; perda de grant/contexto antes de commit => rollback de state/receipt/audit; replay continua exigindo grant atual.
- [x] **2. Confirmar falha:** `node --test worker/platform/managementTransactions.test.js`.
- [x] **3. Implementar núcleo:** mapa explícito operação→capability; exigir também view. Capturar company/revisão com alvo sanitizado; validar sessão atual e operação por assertions. Reservar receipt e atualizar revisão uma vez no mesmo batch; hash de payload inclui alvo/ação e input normalizado. Retornar `BUSINESS_MANAGEMENT_CHANGED` em conflito; manter o erro de contexto existente e não expor erros SQL. Replay devolve resultado sanitizado e não executa preparador/entrega novamente.
- [x] **4. Verificar:** mesmos testes, mais `worker/platform/access.test.js` e `worker/identity/transactions.test.js`; zero falhas. Teste determinístico com hook no `db.batch` cobre perda de grant/expiração entre preparação e commit.
- [x] **5. Commit:** `feat: proteger mutations administrativas com revisão e receipt`.

## Task 4: Suspender, retomar, excluir e restaurar

**Files:** criar `worker/platform/businessManagement.js`, `worker/platform/businessManagement.test.js`, `worker/platform/managementCommands.js`, `worker/platform/managementCommands.test.js`, `worker/tenancy/membershipEligibility.js`, `worker/tenancy/membershipEligibility.test.js`; modificar `worker/tenancy/memberships.js` para compartilhar somente a regra de última pessoa elegível.

**Interfaces:** `prepareBusinessLifecycleChange(db, prepared, target, input, now) -> PreparedManagement`; `prepareEligibleManagerAssertion(db, businessId, { excludingUserId = null, now } = {}) -> Promise<D1PreparedStatement>`; `performBusinessManagement(env, context, target, input, { idempotencyKey, now, monotonicNow, deliver }) -> ManagementResult`, coordenando inicialmente lifecycle e ampliado na tarefa 5. A consulta de elegibilidade usa account, credencial válida, vínculo, role e grant `access.users.manage`; sem role code/nome para autorização.

- [x] **1. Escrever testes:** excluir A preserva todas as linhas de negócio/credenciais/R2 referências e bloqueia apenas A; restaurar resulta em `suspended`; retomar mantém accessStatus pending/legacy. Em empresa ativa, resume sem administrador elegível => 409; role custom com grant real conta como administrador. Nome incorreto => 400; nome com composição Unicode equivalente e espaços externos é aceito; case diferente é rejeitado.
- [x] **2. Confirmar falha:** `node --test worker/platform/businessManagement.test.js worker/tenancy/membershipEligibility.test.js`.
- [x] **3. Implementar ações:** mapa de transições explícito. Suspender/excluir compõem revogações de sessões A, convites não consumidos e TV, sem famílias globais. Não atualizar grants/vínculos nem chamar provedor/R2/QZ. Inserir audit com motivo e antes/depois mínimo na mesma completion; transição incompatível => 409 sem partial writes.
- [x] **4. Verificar:** testes acima, `worker/tenancy/memberships.test.js`, `worker/platform/managementCommands.test.js` e gate D1 novo; zero falhas. Testar two calls com mesma revisão: uma efetivada, outra 409, um incremento e um audit.
- [x] **5. Commit:** `feat: gerir suspensão e exclusão recuperável de empresas`.

## Task 5: Vínculos e convites administrativos

**Files:** criar `worker/platform/membershipManagement.js`, `worker/platform/membershipManagement.test.js`, `worker/platform/invitationManagement.js`, `worker/platform/invitationManagement.test.js`; modificar `worker/tenancy/memberships.js`, `worker/tenancy/companyInvitations.js` e `worker/platform/managementCommands.js`.

**Interfaces:** `preparePlatformMembershipChange(db, prepared, target, input, now) -> PreparedManagement`; `preparePlatformInvitationChange(env, prepared, target, input, options) -> PreparedManagement`. O preparador de convite existente recebe autorização explícita do emissor/owner para contexto platform com grant de reenvio e opção `auditOwner: 'issuer' | 'management'`, default `issuer`; nunca converter a sessão em business fictício.

- [x] **1. Escrever testes:** revogar aliceA preserva aliceB e sua senha; dois gestores concorrentes deixam um elegível; último gestor pode ser revogado depois de suspender. Reactivate de `inactive` mantém role e não recupera sessão; de `invited` desativado só habilita novo convite. Empresa excluída nega mudanças. Convite consumido/revogado ou ID de B sob A => conflito/404 sem eventos; expirado não consumido pode ser cancelado.
- [x] **2. Escrever testes de reenvio:** plataforma sem vínculo operacional reenvia convite `team` com grant correto e destinatário aceita; persistir `issuer_scope = platform`, verificar view/resend atuais desse emissor na aceitação. Contexto business continua com suas regras atuais. Rollback por suspensão/grant revogado não cria token novo; replay de entrega incerta chama o provedor uma única vez e preserva o status oficial.
- [x] **3. Confirmar falha:** `node --test worker/platform/membershipManagement.test.js worker/platform/invitationManagement.test.js`.
- [x] **4. Implementar preparadores:** compor assertions, alterações e revogações somente no alvo. Separar preparo do reenvio existente de commit/entrega; coordenador acrescenta receipt/revisão e audit único antes do commit. Delivery message transitório é entregue somente pelo vencedor; replay consulta status persistido por invitationId. Audits de resultado do provedor permanecem eventos de entrega, distintos do audit único da mutation.
- [x] **5. Verificar:** testes acima, `worker/tenancy/companyInvitations.test.js`, `worker/tenancy/memberships.test.js`, `worker/tenancy/multiCompanyFlow.test.js` e `worker/platform/businessProvisioning.test.js`; zero falhas. Manter cooldown/limite de e-mail, primeiro acesso e proteção de grant revogado na aceitação.
- [x] **6. Commit:** `feat: administrar vínculos e convites por empresa`.

## Task 6: Consultas, API e reconciliação somente por leitura

**Files:** criar `worker/platform/managementRepository.js`, `worker/platform/managementRepository.test.js`; modificar `worker/platform/businessesRepository.js`, `worker/platform/businessesRepository.test.js`, `worker/platform/businessesApi.js`, `worker/platform/businessesApi.test.js`, `worker/tenancy/routePolicy.js`, `worker/tenancy/routePolicy.test.js`, `src/domains/platform/infrastructure/platformApi.js` e seu teste.

**Interfaces:** `listPlatformMemberships(db, businessId, now) -> { users, managementRevision }`; `listPlatformHistory(db, businessId, { cursor, limit = 20 }) -> { items, nextCursor }`; `getPlatformManagementAttempt(db, accountId, businessId, key) -> ManagementAttemptView`. `listPlatformBusinesses` acrescenta status default `visible`, limit 20, query até 200 chars. Histórico aceita limit 1–50.

Adaptador produz `manageBusiness(target, input, idempotencyKey)`, `getManagementAttempt(businessId, key, options)`, `listMemberships(businessId, options)` e `listHistory(businessId, input, options)`, preservando seus métodos existentes. `manageBusiness` mapeia operação somente para os endpoints explícitos da spec, com encode de cada ID e header de chave.

- [x] **1. Escrever testes de consultas:** filtro padrão exclui deleted; query por e-mail via EXISTS não duplica empresa; cursor prende query/status e rejeita mudança, JSON/UTF-8 malformado e timestamps inválidos. Paginação antiga sem status permanece compatível com filtro default. Histórico preserva nulos/UTC e não expõe token_hash, verifier, provider payload ou grants operacionais.
- [x] **2. Escrever testes de API:** todos os novos caminhos são platform e exigem método/capability/origem/contexto corretos. Após consulta, grant revogado impede resposta de dados. Receipt de outra conta/empresa => 404. Reenvio inicial antigo sem body continua funcionando e respeita ciclo.
- [x] **3. Confirmar falha:** `node --test worker/platform/managementRepository.test.js worker/platform/businessesRepository.test.js worker/platform/businessesApi.test.js worker/tenancy/routePolicy.test.js src/domains/platform/infrastructure/platformApi.test.js`.
- [x] **4. Implementar rotas/consultas:** todos os endpoints da spec e `GET /management-attempts/:key` sob a empresa para resolver resposta perdida sem repetir POST. Esse GET exige a capability correspondente à receipt e view, retorna somente resultado autorizado do emissor e `no-store`. Resultado committed pode ter delivery pending/uncertain e não provoca envio. Nova rota de leitura detalha o requisito de reconciliação já aprovado; registrar essa precisão no contrato da spec.
- [x] **5. Verificar:** testes acima mais `worker/tenancy/isolationApi.test.js`; zero falhas. Testar `handleRequest` completo para platform scope e IDs codificados, não apenas handler isolado.
- [x] **6. Commit:** `feat: expor gestão e consultas administrativas autorizadas`.

## Task 7: Interface aprovada e owner das tentativas

**Files:** modificar `src/domains/platform/ui/CompanyList.jsx`, `CompanyDetail.jsx`, `PlatformRoutes.jsx`, `companyStatus.js`, `platform.css` e respectivos testes; criar `src/domains/platform/ui/components/CompanyMembersPanel.jsx`, `CompanyHistoryPanel.jsx`, `CompanyManagementDialog.jsx`, `src/domains/platform/application/managementAttempts.js`, `managementAttempts.test.js`, `useCompanyManagement.js` e `src/domains/platform/ui/CompanyManagement.test.js`; modificar `src/domains/platform/index.js`, `src/App.jsx` somente na composição platform e testes pertinentes de contexto/saída.

**Interfaces:** `createManagementAttempts()` fornece `subscribe`, `getSnapshot(accountId)`, `isBlocking(accountId)`, `hasUnresolved()`, `execute({ accountId, contextId, target, input, api })`, `reconcile({ accountId, api })`, `retryConfirmedAttempt({ accountId, api })`, `acknowledge(accountId, key)`. Estado immutable contém author, target, key/input e status pending/uncertain/confirmed/rejected. Owner vive acima das páginas, não em storage compartilhado. `useCompanyManagement({ accountId, contextId, businessId, api, attempts, onPendingChange })` expõe tentativa, pending, execute/reconcile e resultado para recarga oficial.

- [x] **1. Escrever testes do owner:** resposta perdida mantém key/payload; reconcile chama somente GET; ausência de receipt não libera tentativa automaticamente; retry só por ação explícita mantém key; outra conta não lê/reexecuta tentativa; respostas tardias de contextId antigo não atualizam UI. Replays não enviam e-mail novo.
- [x] **2. Escrever testes de UI:** filtros/busca ressetam cursor somente no submit; deleted/suspended prevalecem sobre convite aceito. As três abas e actions respeitam grants/eligibilidade; exclusão exige motivo e nome NFC correto; pending bloqueia modal/contexto e uma segunda chamada. 409 recarrega dados e exige confirmação nova; uncertain mantém bloqueio até consultar receipt. Restore mostra suspended; pending resumed continua aguardando. Erro/loading/empty, actor null e cooldown recebem textos claros.
- [x] **3. Confirmar falha:** `node --test src/domains/platform/application/managementAttempts.test.js src/domains/platform/ui/CompanyManagement.test.js src/domains/platform/ui/CompanyList.test.js src/domains/platform/ui/CompanyDetail.test.js`.
- [x] **4. Implementar páginas e componentes:** lista compacta com Nova empresa junto ao título, filtro SystemSelect e Gerenciar; detalhes com tabs e panels, audit paginado e modal de domínio reutilizando `Modal`/`Button`, sem restilizar shared UI global. Passar grants reais, account/context e attempts pelo owner atual. Bloqueio de sessão/troca/saída considera tentativa pendente/incerta; reautenticação do autor permite somente reconciliação explícita. UTC é apresentado com `Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ... })`, com fuso visível.
- [x] **5. Verificar:** testes acima, `src/domains/platform/ui/PlatformRoutes.test.js`, `NewCompany.test.js`, `src/app/runtime/session/companyContext.test.js`, `sessionExitGuard.test.js`, `useSessionRuntime.test.js` e `npm run test:architecture`; zero falhas. Verificar em navegador 360px/desktop, light/dark, Tab/Shift+Tab/Escape, foco/scroll e sessão invalidada limpando dados operacionais; registrar evidências reais.
- [x] **6. Commit:** `feat: renovar a interface de gestão de empresas`.

## Task 8: Integração, documentação e gates da entrega

**Files:** criar `worker/platform/companyManagementFlow.test.js`, `docs/superpowers/qa/2026-10-05-platform-company-management.md`; modificar `docs/operations/multi-company-production.md`, `README.md` somente na descrição das novas funções e `.github/workflows/validate.yml` para executar o novo gate D1, sem retirar gates/shards existentes ou modificar deploy.

- [x] **1. Escrever teste integrado:** empresa A active → suspend → revogar último gestor → delete → restore suspended → reativar vínculo → resume active; assertar mesma identidade/dados de negócio, credenciais antigas inválidas, seleção B funcionando e contagens de audit/receipt. Segundo caminho pending → suspend → restore se excluída → resume pending → reenvio explícito → aceitação active. Corrida entre suspend e escrita/pareamento/convite não reabre acesso.
- [x] **2. Confirmar falha/regressão detectável:** `node --test worker/platform/companyManagementFlow.test.js`; testes precisam detectar regressão real de isolamento/transição antes de seu ajuste final. Não enfraquecer assertions para produzir verde.
- [x] **3. Atualizar docs e gate:** documentar alcance, último administrador, recuperação de convites/empresa e limitação física do spooler. QA distingue verificado, não verificado e publicação pendente. Nova etapa CI executa `node scripts/infra/company-management-d1-gate.mjs`; manter versões atuais de Wrangler e autenticação.
- [x] **4. Rodar verificação final:** `npm run test:architecture`, `npm run lint`, `npm run build`, `npm test`; `npx --yes wrangler@4.128.0 deploy --dry-run`; mesmo dry-run com `--env staging`; gates `node scripts/infra/spec-b-d1-gate.mjs`, `node scripts/infra/operation-profile-d1-gate.mjs`, `node scripts/infra/company-management-d1-gate.mjs`; `git diff --check`. Zero falhas. Migrations Wrangler locais usam persistência exclusiva da tarefa, nunca o banco de teste existente; gate SQLite valida install/upgrade em memória.
- [x] **5. Registrar/revisar:** manter evidência dos comandos e limitações em QA; conferir diff final e consumidores. Uma revisão independente ao fim segue o método de execução escolhido. Commit: `test: validar gestão administrativa e documentar recuperação`.

## Handoff e publicação

Recomendação: execução por este agente, em sequência, porque migrations, grants, facade, receipts e UI compartilham contratos; evitar edições paralelas no mesmo checkout. Ao fim, revisão independente da branch conforme o método escolhido. A alternativa com subagentes tem implementação/revisão por tarefa e mais consumo de contexto.

Este plano termina em código validado localmente e evidência de QA, pronto para PR/homologação. Se ainda não houver autorização para push/PR/staging, preparar os resultados e informar o próximo passo sem executar operações remotas adicionais. CI, staging, merge e produção seguem o [runbook](../../release-and-migration-runbook.md); produção continua exigindo autorização explícita para o SHA validado. O domínio administrativo terá outra entrega.
