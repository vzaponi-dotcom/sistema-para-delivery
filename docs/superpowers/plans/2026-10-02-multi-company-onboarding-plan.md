# Mesiva Multiempresa e Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastrar empresas pelo painel Mesiva, convidar o primeiro gerente e operar várias empresas com conta global e isolamento verificável.

**Architecture:** Manter Worker, D1 e R2 compartilhados por ambiente, separando identidade global, vínculos empresariais e concessão administrativa. Sessões selecionam contexto empresarial ou administrativo, e cada API verifica o escopo e o marcador oficial. Provisionamento transacional e envio posterior preservam cadastro diante de falhas do provedor.

**Tech Stack:** JavaScript ESM, React 19, React Router 8, Cloudflare Workers/D1/R2, Resend HTTPS, Node `node:test` e `node:sqlite`; Wrangler fixado em `4.128.0`. Reutilizar bibliotecas e componentes existentes.

**Spec:** [2026-10-02-multi-company-onboarding-design.md](../specs/2026-10-02-multi-company-onboarding-design.md), aprovada em 2026-10-02.

**Issue:** [#87](https://github.com/vzaponi-dotcom/sistema-para-delivery/issues/87).
**Estado:** aprovado em 2026-10-02; execução nesta sessão, com revisão independente final, em andamento.
**Base documental:** `9fc69509`, derivada de `550a073f` da PR #85. Ao executar, conferir a base integrada atual e trazer a fundação de acesso/e-mail antes de iniciar. A validação real do e-mail em staging ainda está pendente; este plano não a certifica nem autoriza merge/produção.

## Global Constraints

- Todas as empresas usam o mesmo endereço do aplicativo. Não haverá subdomínio por cliente.
- E-mail normalizado único globalmente; uma senha por pessoa.
- Cada vínculo relaciona conta, empresa e perfil. Existe no máximo um vínculo da mesma conta com a mesma empresa.
- Gerente e operador continuam como perfis iniciais fixos, com capacidades explícitas.
- Administrador Mesiva não recebe acesso operacional implícito; gerente empresarial não recebe acesso à plataforma.
- Operação inicial: cadastros operacionais vazios e configurações padrão próprias.
- Duração absoluta: 12 horas em dispositivo compartilhado e sete dias em dispositivo pessoal. Seleção e troca não prolongam o vencimento.
- Convite: pelo menos 32 bytes aleatórios, hash, validade de 24 horas e uso único. Recuperação: 30 minutos.
- Reenvio: intervalo mínimo de 60 segundos, quota persistente e limite agregado do ambiente.
- Senha: mínimo de 15 caracteres, limite de 1.024 pontos de código e verificador versionado.
- Token de convite/desafio somente em memória e fragmento; nunca em query, storage, logs, recibos ou auditoria.
- Mudança de credencial global revoga sessões globais; gestão empresarial só altera vínculos da própria empresa.
- Empresa ativa não perde o último gerente capaz de administrar acesso, inclusive sob concorrência.
- Troca limpa dados anteriores e coordena as abas; requisição com contexto antigo não opera na empresa nova.
- TV mantém credencial empresarial própria. Impressão automática depende da sessão humana selecionada.
- Infraestrutura é configurada por ambiente. Primeiro administrador é preparado uma vez por ambiente, por procedimento privado auditado.
- Staging admite contas fictícias novas; IDs de atores e históricos são preservados. Nenhuma migração de contas reais ou publicação em produção está autorizada.
- Não adicionar cadastro público, cobrança, planos, domínio por cliente, editor de perfis, acesso de suporte ou suspensão comercial.

## Review Focus

1. Dois convites simultâneos para o mesmo e-mail: uma identidade e nenhuma sobrescrita de senha após a primeira ativação; fixar na Task 5.
2. Recurso estrangeiro com ID válido e referência nullable/snapshot: rejeitar referência entre empresas sem invalidar snapshots legítimos; fixar nas Tasks 8 e 9.
3. Resposta da criação perdida após commit, quota cheia e reenvio concorrente: reconciliar a empresa existente e nunca devolver token ou duplicar cadastro; fixar nas Tasks 6 e 7.
4. Aba antiga sem canal de comunicação, resposta atrasada e cookie já trocado: rejeitar contexto antigo e descartar efeitos/respostas; fixar nas Tasks 10 e 11.
5. Permissão removida, senha alterada ou sessão vencida durante troca/ação administrativa: repetir condições dentro da transação e negar a ação; fixar nas Tasks 3 e 7.

## Estrutura de arquivos e contratos comuns

- `worker/identity/`: contas, quotas, desafios globais, sessões e APIs de identidade. Não conhece regras de pedidos.
- `worker/tenancy/`: vínculos, convites, seleção/contexto, defaults e política de rotas. Recebe identidade autenticada.
- `worker/platform/`: concessões, auditoria administrativa, provisionamento e APIs de cadastro. Não consulta dados operacionais.
- `src/domains/companies/`: seleção de empresa e aceite de vínculo, pelo barrel `index.js`.
- `src/domains/platform/`: painel administrativo e seu cliente, pelo barrel `index.js`.
- `src/infrastructure/api/contextHttpClient.js`: transporte imutável associado ao contexto capturado; domínio não busca contexto mutável global para enviar payload antigo.
- `worker/test-support/tenancyDb.js`: fixture SQLite/D1 real para duas empresas e identidades/vínculos variados. Não substituir transações por mocks que sempre aprovam.
- Testes próximos dos módulos. Adicionar fronteiras dos novos domínios em `scripts/architecture/check-import-boundaries.mjs`.

Tipos lógicos compartilhados no plano:

- `Account`: `{ id, email, displayName, verifiedAt, active, credentialRevision }`; revisão nullable enquanto não houver credencial.
- `IdentityContext`: `{ accountId, identitySessionId, familyId, scope, contextId, expiresAt, deviceMode }`.
- `BusinessContext`: `IdentityContext` no escopo `business`, mais `{ businessId, userId, sessionId, displayName, granted }`. `userId` e `sessionId` continuam sendo IDs empresariais para auditoria existente.
- `PlatformContext`: `IdentityContext` no escopo `platform`, mais `platformGranted: Set<string>`; não inclui grants empresariais.
- `Prepared<T>`: `{ statements: D1PreparedStatement[], value: T }`, executado pelo serviço dono em um único `DB.batch`. Não aninhar batches para simular uma transação maior.
- `SessionView`: `{ authenticated, account, scope, contextId, expiresAt, capabilities, platformCapabilities }`; em `business`, acrescentar `businessId`, `settingsContextId` e `user` empresarial. Em `identity` ou `platform`, não inventar empresa/usuário empresarial.
- `DeliveryResult`: `{ status: 'accepted' | 'rejected' | 'uncertain', providerId?: string }`, sem payload bruto.

## Task 1: Esquema global aditivo e fixture empresarial

**Files:** Create `migrations/0038_global_identity_tenancy.sql`, `worker/identity/transactions.js`, `worker/identity/transactions.test.js`, `worker/identity/migration.test.js`, `worker/test-support/tenancyDb.js`, `shared/companyAccess.js`, `shared/companyAccess.test.js`. Modify `worker/test-support/settingsDb.js` somente se necessário para novas restrições aditivas.

**Interfaces:** `prepareIdentityAssertion(db, id, selectSql, values): D1PreparedStatement`; `commitIdentityStatements(db, statements): Promise<D1Result[]>`. `createTenancyFixture(t): Promise<{db, sqlite, now, accounts, businesses, members, contexts, close}>`: `businesses.A/B`; `accounts.alice/bob/carol/admin/pending`; `contexts.aliceA/aliceB/carolB/admin` com famílias diferentes, representando gerente A/operador B, gerente B e administrador sem vínculos. Bob é operador A; pending ainda não possui senha. Usar `hashHumanPassword` e SQL real, sem segredos reais; registrar cleanup em `t.after`. Estados e capacidades de plataforma são constantes de `shared/companyAccess.js`.

- [x] Escrever `0038 preserves existing actors and sessions` e `global identity and membership keys reject invalid shapes`: aplicar até 0037, inserir sessão/auditoria empresarial e aplicar 0038; comparar IDs/valores anteriores e `PRAGMA foreign_key_check`. Rejeitar e-mail duplicado, vínculo duplicado e conta/perfil/vínculo de empresas incompatíveis.
- [x] Executar `node --test worker/identity/migration.test.js worker/identity/transactions.test.js shared/companyAccess.test.js`; esperar falha por esquema/módulos ausentes.
- [x] Implementar esquema aditivo: `accounts` com `email_normalized` único, `account_credentials`, `identity_session_families`, `identity_sessions`, `identity_challenges`, `identity_login_attempts`, `identity_recovery_requests`, `identity_email_deliveries`, `identity_audit_events`, `company_invitations`, `platform_grants`, `platform_audit_events`, `platform_provisioning_receipts`, `platform_bootstraps`, `identity_tx_assertions`. Acrescentar `users.account_id` nullable e `users.membership_state` com default `historical`, preservando usuários anteriores; unique `(business_id,account_id)` e `(account_id,business_id,id)`. Acrescentar `businesses.access_status` com default `legacy`, estados `legacy/pending/active`. Migração não ativa, revoga ou funde contas antigas.
- [x] Implementar chaves/estados: credencial global com versão/revisão positiva; desafio global `activation/password_reset`; convite com destinatário, conta/vínculo/empresa, perfil e versão esperados, emissor e finalidade `first_manager/team`; hash único, prazo, consumo e revogação. Recibo com administrador, chave, hash do conteúdo e empresa. Concessões explícitas `platform.businesses.view/create` e `platform.invitations.resend`. Famílias mantêm conta, vencimento e sessão vigente. Sessões globais têm token hash, contexto único, escopo e FK composta à sessão/vínculo empresarial quando selecionadas; escopos `identity/platform` não carregam empresa. Guardas `CHECK(ok=1)` abortam o batch inteiro.
- [x] Executar os testes novamente; esperar PASS, rollback integral de batch inválido e nenhuma alteração de dados/credenciais anteriores. Commit: `feat(identity): add global account and tenancy schema`.

**Decisão de compatibilidade:** Não reconstruir `sessions` nem reatribuir empresa de registros existentes. `identity_sessions` guarda o token global e, em escopo empresarial, aponta para um registro da tabela `sessions`. O hash desse registro empresarial é interno, aleatório e nunca aceito como cookie global; seu ID continua servindo à auditoria. A troca cria novos registros e revoga os antigos.

## Task 2: Contas globais, verificação e limites persistentes

**Files:** Create `worker/identity/accounts.js`, `accounts.test.js`, `throttle.js`, `throttle.test.js`, `audit.js`, `audit.test.js`. Reuse `shared/accessEmail.js` e `worker/access/credentials.js`.

**Interfaces:** `findAccountByEmail(db,email): Promise<Account|null>`; `prepareAccountCreation(db,{id,email,displayName,now}): Prepared<{email}>` não muda conta existente; `verifyAccountLogin(db,{email,password}): Promise<Account|null>` executa verificação fictícia para conta ausente. `reserveIdentityLogin(db,{email,originKey,now})` retorna `{allowed,attemptId?,retryAfterSeconds}`; `completeIdentityLogin(db,attemptId,succeeded)`. `reserveIdentityRecovery(db,{email,originKey,now})` e `prepareIdentityDeliveryReservation(db,{accountId,subjectId,emitterId,now,dailyLimit,cooldownSeconds})`. `prepareIdentityAudit(db,event)` não persiste senha/token/IP bruto.

- [x] Escrever testes de aliases preservados, unicidade sob duas preparações concorrentes, conta existente intacta, conta não verificada/desativada rejeitada e verificação fictícia executada para inexistente. Quotas: login 5 falhas por conta e 30 por origem em 15 minutos, recuperações 3/e-mail em 30 minutos e 10/origem em 15 minutos, reenvio 60 segundos e limite diário global configurado.
- [x] Executar `node --test worker/identity/accounts.test.js worker/identity/throttle.test.js worker/identity/audit.test.js`; esperar FAIL por serviços ausentes.
- [x] Implementar assinaturas acima com normalização única, reservas em SQL atômico e digests globais separados por propósito. Manter default de 80 tentativas/dia UTC do envio em staging. Reserva cheia rejeita antes de iniciar nova emissão; sucesso de login libera apenas sua reserva, mantendo falhas anteriores. Limpeza limitada não remove reservas ainda dentro da janela.
- [x] Executar os testes; esperar PASS inclusive em chamadas concorrentes e limites exatos. Auditoria de identidade registra eventos globais sem tornar dados empresariais visíveis no painel.
- [x] Commit: `feat(identity): implement global account lookup and throttling`.

## Task 3: Sessões globais, famílias e contexto imutável

**Files:** Create `worker/identity/sessions.js`, `sessions.test.js`, `worker/tenancy/businessContext.js`, `businessContext.test.js`, `worker/tenancy/scopeSelection.js`, `scopeSelection.test.js`. Modify `worker/auth.js`, `worker/access/sessions.js` para adaptadores sem remover o caminho legado antes do corte.

**Interfaces:** `prepareAccountSession(db,{accountId,expectedCredentialRevision,scope,businessId?,familyId?,expiresAt?,deviceMode,now}): Promise<Prepared<{token,identitySessionId,contextId,expiresAt,scope,businessSessionId?}>>`; `authenticateAccountRequest(request,env,now): Promise<IdentityContext|BusinessContext|PlatformContext|null>`. `selectAccountScope(db,context,{scope,businessId?,contextId},now)` retorna nova sessão após um único batch. `requireBusinessContext(request,context): BusinessContext` e `requirePlatformContext(request,context,capability): PlatformContext`. `revokeBrowserFamily(db,context,now)` revoga somente a família daquele navegador.

- [x] Escrever testes de sessão global sem operação, empresarial com FK ao ator correto, plataforma sem grants empresariais, cookie `mesiva_session`, expiração em 12 horas/7 dias, histórico de auditoria intacto e troca A→B sem prolongar prazo.
- [x] Escrever teste de concorrência e Review Focus 5: duas trocas sobre a mesma sessão têm um vencedor; revogação de vínculo/concessão, revisão de senha ou vencimento antes do commit impede a troca. Conta com grant Mesiva não abre B sem vínculo. Marker ausente/divergente gera 409 `SESSION_CONTEXT_CHANGED` antes de consulta de domínio.

```js
test('uma sessão só permite uma troca concorrente', async t => {
  const f = await createTenancyFixture(t)
  const input = { scope: 'business', businessId: f.businesses.B.id, contextId: f.contexts.aliceA.contextId }
  const results = await Promise.allSettled([
    selectAccountScope(f.db, f.contexts.aliceA, input, f.now),
    selectAccountScope(f.db, f.contexts.aliceA, input, f.now),
  ])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.filter(r => r.status === 'rejected').length, 1)
})
```

- [x] Executar `node --test worker/identity/sessions.test.js worker/tenancy/businessContext.test.js worker/tenancy/scopeSelection.test.js`; esperar FAIL pelas novas interfaces ausentes.
- [x] Implementar criação/rotação transacional: guardas revalidam origem, identidade, revisão, família vigente e destino; criam sessão global e registro empresarial quando necessário; revogam os anteriores e atualizam a sessão vigente da família. Autenticação exige que a sessão seja a vigente da família, além de conta/vínculo/perfil/concessão ativos. Nunca mudar `business_id` de sessão histórica. Cookie seguro, host-only, HttpOnly, SameSite=Strict, Path=/ e Max-Age limitado ao prazo restante.
- [x] Executar os três arquivos; esperar PASS. Commit: `feat(auth): select trusted company or platform session scopes`.

## Task 4: Login global, ativação, recuperação e senha própria

**Files:** Create `worker/identity/challenges.js`, `challenges.test.js`, `authApi.js`, `authApi.test.js`, `emailMessages.js`, `emailMessages.test.js`. Modify `worker/access/emailDelivery.js` e `emailTemplates.js` para compartilhar transporte/template sem acoplar desafio global a empresa fixa.

**Interfaces:** `prepareIdentityChallenge(db,{accountId,purpose,expectedRevision?,now}): Promise<Prepared<{id,token,expiresAt}>>`; `inspectIdentityChallenge(db,{token,now})`; `completeIdentityChallenge(db,{token,password,now})`; `changeAccountPassword(db,context,{currentPassword,password},now)` retorna sucessora somente se contexto elegível. `deliverIdentityMessage(env,{subjectId,token,purpose,displayName,businessName?},options): Promise<DeliveryResult>`; finalidade de mensagem `activation/password_reset/company_invitation` resolve respectivamente `/ativar-conta`, `/redefinir-senha`, `/aceitar-convite`. `handleGlobalAuthApi(request,env,{waitUntil,now,fetchImpl})` cobre login/sessão/logout/recuperação/desafios/seleção e retorna `Response|null`.

- [x] Escrever testes: e-mail/senha sem empresa; uma empresa entra direto, várias geram escopo identity; plataforma via entrada `/mesiva`; credenciais inválidas não enumeram conta; ativação 24h e recuperação 30min; token reutilizado/vencido/revogado não altera credencial.
- [x] Fixar privacidade temporal com portas controladas: bloquear lookup e envio e verificar que recuperação retorna a mensagem genérica antes deles; `waitUntil` ausente falha uniformemente. Conclusão revoga sessões em A/B/plataforma; solicitar recuperação não revoga; senha própria exige senha atual, revoga sessões antigas e conserva prazo/contexto na sucessora. Mensagem não inclui token em logs nem rastreamento.
- [x] Executar `node --test worker/identity/challenges.test.js worker/identity/authApi.test.js worker/identity/emailMessages.test.js`; esperar FAIL.
- [x] Implementar desafios globais e endpoints da Spec 9.1. Quota pública antes da resposta; processamento privado em `waitUntil` ligado ao ExecutionContext real. Conclusão/credencial/revisão/revogações em um batch. Na senha própria, incluir sucessora da família atual somente após guardas de elegibilidade e revogar outras famílias; não estender vencimento. Preservar transporte Resend: duas tentativas de até 5 segundos, mesma mensagem/chave, resultados limitados; aceite pelo provedor não prova entrega na caixa de entrada.
- [x] Executar os arquivos e testes existentes de entrega/templates; esperar PASS. Commit: `feat(auth): add global email login and recovery`.

## Task 5: Convites empresariais e gestão de vínculos

**Files:** Create `worker/tenancy/memberships.js`, `memberships.test.js`, `companyInvitations.js`, `companyInvitations.test.js`, `invitationsApi.js`, `invitationsApi.test.js`. Modify `worker/access/users.js`, `api.js`, `users.test.js`, `emailAccessApi.test.js`.

**Interfaces:** `listEligibleBusinesses(db,accountId)` retorna `[{businessId,name,roleName}]`. `prepareMembershipInvitation(db,{businessId,accountEmail,displayName,roleId,issuer,purpose,userId?,now})` retorna `Prepared<{invitationId,token,expiresAt,userId}>`. `inspectCompanyInvitation(db,{token,now})` retorna empresa/perfil/estado de aceite sem outras participações da pessoa. `acceptCompanyInvitation(db,{token,password?,context?,now})` retorna `{accepted:true,businessId}`. `updateMembership(db,context,userId,{roleId?,active?},now)` e `resendCompanyInvitation(env,issuer,invitationId,options)`.

- [x] Escrever testes para conta nova, conta existente autenticada, sessão de outro e-mail negada, papel alterado/desativado, convite expirado/revogado e vínculo ativo sem opção de reenvio. Aceite ativa primeiro gerente e empresa no mesmo batch; segundo gerente não cria outra identidade.
- [x] Fixar Review Focus 1 com ativações concorrentes: convites A/B para um e-mail produzem uma conta; primeiro aceite define senha, segundo exige login e conserva verificador/revisão; outros convites pendentes continuam próprios. Desativar/mudar perfil em A não altera B ou sua credencial. Duas remoções concorrentes não eliminam todos os gerentes de empresa ativa.

```js
// Preparar/commitar dois convites team para accounts.pending, emitidos
// por contexts.aliceA e contexts.carolB, usando a interface desta tarefa.
const results = await Promise.allSettled([
  acceptCompanyInvitation(f.db, { token: inviteA.value.token, password: 'Senha ficticia A 2026', now: f.now }),
  acceptCompanyInvitation(f.db, { token: inviteB.value.token, password: 'Senha ficticia B 2026', now: f.now }),
])
assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
assert.equal(results.filter(r => r.status === 'rejected').length, 1)
assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM account_credentials WHERE account_id=?').get(f.accounts.pending.id).n, 1)
// Identificar a senha vencedora pelo resultado e comprovar que o verificador
// valida apenas essa senha; aceitar o segundo convite com login, sem alterá-lo.
```

- [x] Executar `node --test worker/tenancy/memberships.test.js worker/tenancy/companyInvitations.test.js worker/tenancy/invitationsApi.test.js`; esperar FAIL.
- [x] Implementar as interfaces, asserções e quotas em batches únicos. Gerente só emite/edita vínculo de seu negócio; convite first_manager aceita emissor plataforma, team exige capacidade empresarial. Reenvio revoga token anterior apenas do mesmo vínculo e guarda novo prazo. Após corte, `/api/access/users/:id/reset` não altera credencial global; retornar erro explícito e apontar recuperação pessoal. Manter sessão empresarial/ator histórico como vínculo.
- [x] Executar testes novos e `worker/access/users.test.js worker/access/emailAccessApi.test.js`; esperar PASS sem caminho alternativo de reset global por gerente. Commit: `feat(tenancy): invite accounts and manage company memberships`.

## Task 6: Padrões e provisionamento idempotente

**Files:** Create `worker/tenancy/businessDefaults.js`, `businessDefaults.test.js`, `worker/platform/businessProvisioning.js`, `businessProvisioning.test.js`. Modify `worker/printSettingsRepository.js` para exportar o default já existente se necessário, sem duplicá-lo.

**Interfaces:** `prepareBusinessDefaults(db,{businessId,name,now}): D1PreparedStatement[]`; `createBusiness(env,platformContext,{name,managerName,managerEmail},{idempotencyKey,now,waitUntil,deliver}): Promise<{businessId,firstManagerId,invitationId,created,deliveryStatus,expiresAt}>`. Retorno nunca contém token. Nome da empresa/gerente: trim, entre 1 e 200 pontos de código; e-mail via `normalizeAccessEmail`; chave de idempotência UUID. Nomes comerciais iguais são permitidos.

- [x] Escrever teste de defaults usando `DEFAULT_OPERATIONS`, `DEFAULT_PAYMENT_METHODS`, `nativeCancellationReasons`, `nativeFinanceCategories`, perfil vazio e política atual 2 cópias/pedido e 1/comanda. Nova empresa tem revisões coerentes, nenhum produto/cliente/pedido/mesa/job/TV/PIN e nenhum dado copiado da A.
- [x] Fixar Review Focus 3: mesma chave/conteúdo retorna mesma empresa, chave alterada/conteúdo igual cria nova tentativa intencional, mesma chave/conteúdo diferente retorna 409; perda de resposta após commit e replay com quota posteriormente cheia retorna recibo anterior sem nova reserva. Falha de guarda reverte todo o lote; falha do provedor preserva cadastro pendente. Dois cadastros com mesmo e-mail não duplicam identidade nem mudam credencial existente.
- [x] Executar `node --test worker/tenancy/businessDefaults.test.js worker/platform/businessProvisioning.test.js`; esperar FAIL.
- [x] Implementar defaults e criação em batch único com concessão administrativa revalidada, recibo, empresa pending, perfis, configurações, conta/vínculo, convite, reserva e auditoria. Consultar recibo correspondente antes de reservar nova quota; quota insuficiente em tentativa inédita rejeita sem cadastro parcial. Persistir somente hash do token e estado de envio, enviar após commit com token em memória. Se trabalho não completar, estado permanece pendente/não confirmado e reenvio emite novo token; não adicionar fila com token em claro.
- [x] Executar os dois arquivos; esperar PASS e integridade referencial. Commit: `feat(platform): provision companies and first manager invitations`.

## Task 7: Concessões e APIs do painel interno

**Files:** Create `worker/platform/access.js`, `access.test.js`, `audit.js`, `audit.test.js`, `businessesRepository.js`, `businessesRepository.test.js`, `businessesApi.js`, `businessesApi.test.js`.

**Interfaces:** `requirePlatformCapability(context,key)`; `preparePlatformAudit(db,context,event)`; `listPlatformBusinesses(db,{query,cursor,limit})` retorna `{items,nextCursor}` com default 20, máximo 50, busca de até 200 caracteres e cursor validado; `getPlatformBusiness(db,businessId)` projeta cadastro/primeiro gerente/convites; `handlePlatformBusinessesApi(request,env,context,{waitUntil,now})` atende as quatro rotas da Spec 9.1 e delega criação/reenvio às Tasks 5–6.

- [x] Escrever testes: gerente comum/identity scope/plataforma revogada recebem negação; concessão válida lista/cria/detalha/reenvia sem retornar pedidos, credenciais, outras empresas do gerente ou payload bruto do Resend. Origem externa é negada; paginação inválida não amplia consulta. Empresa ativada não permite reenviar convite inicial.
- [x] Fixar Review Focus 3/5: reenvios simultâneos produzem somente desafio vigente e cooldown; remoção de concessão durante leitura/commit impede criação/reenvio; marcador antigo impede alteração no escopo novo. Resultado accepted/uncertain/rejected e expirado/ativado são projetados separadamente.

```js
test('gerente empresarial não administra a plataforma', async t => {
  const f = await createTenancyFixture(t)
  assert.throws(() => requirePlatformCapability(f.contexts.aliceA, 'platform.businesses.create'),
    error => error.status === 403)
  assert.doesNotThrow(() => requirePlatformCapability(f.contexts.admin, 'platform.businesses.create'))
})
```

- [x] Executar `node --test worker/platform/access.test.js worker/platform/audit.test.js worker/platform/businessesRepository.test.js worker/platform/businessesApi.test.js`; esperar FAIL.
- [x] Implementar interfaces e respostas `no-store`, com validação de origem nas mutações e audit trail próprio. Query paginada lê apenas cadastro, primeiro vínculo e estado de convite. Reenvio verifica que é o primeiro vínculo ainda pendente; não autoriza administração de toda a equipe pelo painel.
- [x] Executar os quatro arquivos; esperar PASS. Commit: `feat(platform): expose authorized company onboarding APIs`.

## Task 8: Isolamento do banco, roteamento e domínios humanos

**Files:** Create `migrations/0039_tenant_reference_guards.sql`, `worker/tenancy/referenceGuards.test.js`, `routePolicy.js`, `routePolicy.test.js`, `worker/tenancy/isolationApi.test.js`. Modify `worker/index.js`, `worker/repositories.js`, `orderReadRepository.js`, `orderCheckout.js`, `paymentRepository.js`, `financeRepository.js`, `tableRepository.js`, `tableReservationRepository.js`, `tableTabDetailRepository.js`, `settingsApi.js`, `businessProfileApi.js`, `businessLogoStorage.js`, `worker/reporting/repository.js`, `worker/access/routeCoverage.test.js` e testes adjacentes onde a correção exigir.

**Interfaces:** `classifyApiRoute(method,path): 'public-identity'|'public-tv'|'platform'|'business'|'unknown'`; `resolveRequestContext(request,env,executionContext)` escolhe autenticação pelo flag de corte e retorna contexto confiável. APIs empresariais recebem `BusinessContext`; nenhuma usa empresa livre do body/header. Header do marcador: `X-Mesiva-Context`.

- [x] Escrever matriz de isolamento com A/B para cada rota de listagem, consulta por ID e mutação, incluindo bootstrap, efeitos de escrita, clientes/produtos, pagamentos/estornos, comandas/reservas, finanças/relatórios, configurações/recibos, equipe/auditoria e logos/R2. Nenhum domínio aceita escopo identity/platform ou marker divergente. IDs estrangeiros retornam negação/404 sem conteúdo do alvo.
- [x] Fixar Review Focus 2 com SQL real: rejeitar INSERT/UPDATE cruzados nas relações `orders.client_id/table_tab_id`, `order_items.order_id/product_id`, `payments.order_id`, `payment_receipts.table_tab_id`, `movements.order_id/payment_id`, `table_tabs.table_id`, `table_reservations.order_id/table_id/converted_table_tab_id`, `print_jobs.order_id/table_tab_id/parent_job_id/station_id`, `print_job_attempts.job_id/station_id` e `print_stations.recovery_job_id`. Preservar NULL permitido e snapshots válidos; impedir movimentação de `business_id` de entidade persistida.
- [x] Executar `node --test worker/tenancy/referenceGuards.test.js worker/tenancy/routePolicy.test.js worker/tenancy/isolationApi.test.js`; esperar FAIL nos caminhos ainda fixos ou nas referências sem guarda.
- [x] Implementar migração com guardas de banco em INSERT/UPDATE para as referências listadas e imutabilidade empresarial, usando triggers quando evitar reconstrução perigosa de tabelas referenciadas. Antes de instalar, asserção transacional rejeita dados cruzados preexistentes; não corrigir/excluir silenciosamente. Inspecionar relações sem FK ou tabelas filhas sem coluna empresarial e cobri-las pelo vínculo com o pai autorizado. Revalidar escopo/marcador antes do dispatch; corrigir queries/joins/vinculações que falharam na matriz. Não deixar fallback fixo após o corte.
- [x] Executar matriz, testes das APIs afetadas e `PRAGMA foreign_key_check`; esperar PASS. Commit: `fix(tenancy): enforce company boundaries across database and APIs`.

## Task 9: TV e impressão permanecem na empresa autorizada

**Files:** Create `worker/tenancy/deviceIsolation.test.js`. Modify `worker/kitchenTvApi.js`, `kitchenTvRepository.js`, `kitchenTvReadRepository.js`, `kitchenTvControlRepository.js`, `orderPrintingApi.js`, `orderPrintingRepository.js`, `orderPrintDocumentRepository.js`, `printAttemptRepository.js`, `printSettingsRepository.js`, `worker/access/printingAuthorization.js` e testes adjacentes.

**Interfaces:** TV pública deriva empresa do token próprio ou do pedido de pareamento autorizado, nunca de sessão humana global ou `BUSINESS_ID`. Aprovação/controle humanos recebem `BusinessContext`. Impressão recebe contexto e valida relação negócio–estação–job–tentativa para fila, documentos, execução, reimpressão, assinatura e recuperação.

- [x] Escrever testes A/B com TVs vinculadas separadamente, troca da sessão humana sem mudar destino da TV e código/pedido de pareamento de outra empresa negado. TV sem empresa resolvida não lista operações nem usa fallback. Token humano não concede TV e token TV não concede painel/equipe.
- [x] Fixar Review Focus 2 com job de B e estação/tentativa/documento de A: nenhuma leitura, claim, assinatura ou confirmação atravessa empresas; documentos de pedido/comanda estrangeiros negados. Fila e reimpressão continuam com capacidades por perfil.
- [x] Executar `node --test worker/tenancy/deviceIsolation.test.js worker/kitchenTvSecurityRegression.test.js worker/access/printingAuthorization.test.js`; esperar FAIL nos vínculos ainda não comprovados.
- [x] Implementar correções focadas nos handlers/repositórios afetados, usando guardas da Task 8 e credencial de TV existente. Preservar política de pareamento/revogação; não criar acesso autônomo de estação nem fazer um cliente Mesiva herdar credencial de TV de outro.
- [x] Executar os arquivos e testes de TV/impressão afetados; esperar PASS. Commit: `fix(tenancy): bind TV and printing to authorized companies`.

## Task 10: Transporte capturado, runtime e preferências empresariais

**Files:** Create `src/infrastructure/api/contextHttpClient.js`, `contextHttpClient.test.js`, `src/app/runtime/session/companyContext.test.js`. Modify `src/infrastructure/auth/sessionApi.js`, `src/app/runtime/session/useSessionRuntime.js`, `browserSessionCoordinator.js`, `sessionExitGuard.js`, `src/app/runtime/data/useOperationalDataRuntime.js`, `src/App.jsx`, `src/infrastructure/qz/qzLocalPreferences.js`, `qzTransport.js`, `src/domains/printing/infrastructure/printingLocalPreferences.js`, `printingApi.js`, `src/domains/printing/application/usePrintingManager.js`, `src/app/surfaces/settings/business-profile/businessProfilePolicy.js` e clientes de domínio listados abaixo.

**Interfaces:** `createContextHttpClient({context,fetchImpl}): {request,text,blob}` captura `context.contextId` imutável e adiciona `X-Mesiva-Context`, inclusive HTML e multipart. `createSessionApi` acrescenta `listBusinesses/selectBusiness/selectPlatform` e aceita SessionView nos três escopos. `useSessionRuntime` expõe `selectBusiness(businessId)`, `selectPlatform()`, `contextChangePending` e `refreshSession`; bootstrap só para business. Preferências: `getOrCreateLocalPrintStationId(storage,randomUUID,businessId)` e funções de origem por empresa; QZ usa `getQzPrinterName(storage,businessId,stationId)`, `saveQzPrinterName(storage,businessId,stationId,name)` e `clearQzPrinterName(storage,businessId,stationId)`. `createQzTransport` recebe `businessId` associado ao contexto capturado.

Clientes a modificar: `src/domains/orders/infrastructure/ordersApi.js`, `src/domains/customers/infrastructure/customersApi.js`, `src/domains/catalog/infrastructure/catalogApi.js`, `src/domains/finance/infrastructure/financeApi.js`, `src/domains/table-service/infrastructure/tableServiceApi.js`, `src/domains/table-service/infrastructure/tableReservationApi.js`, `src/domains/reporting/infrastructure/reportingApi.js`, `src/domains/access/infrastructure/accessApi.js`, `src/domains/printing/infrastructure/printingPolicy.js`, `src/infrastructure/api/bootstrapApi.js`, `effectiveConfigApi.js`, `policyHttp.js`, `src/app/workflows/payments/paymentApi.js`, `src/app/workflows/refunds/refundApi.js`, `src/app/surfaces/settings/kitchenTvSettingsApi.js` e `src/app/surfaces/kitchen-tv-control/kitchenTvControlApi.js`. Atualizar os barrels dos sete domínios e consumidores dessas factories; cada teste adjacente mantém a mesma injeção.

- [x] Escrever teste de cliente A retido após sessão B: envia marcador A e não busca contexto global atual; retorno 409 invalida runtime e não repete mutação. Cliente de perfil envia marker em multipart sem forçar Content-Type JSON. Prefs/IDs de estação/impressora não se repetem entre empresas; não importar automaticamente chaves legadas sem escopo.
- [x] Fixar Review Focus 4 com cookies já trocados, BroadcastChannel e storage indisponíveis, resposta de bootstrap atrasada e pagamento/impressão em voo: request antiga rejeitada, efeito antigo descartado e troca bloqueada até reconciliação na origem. Cookies recebidos após owner de tela expirar ainda exigem rediscovery oficial, como no runtime existente.

```js
test('cliente captura o contexto de origem', async () => {
  const context = { contextId: 'context-A' }
  let sent
  const client = createContextHttpClient({ context, fetchImpl: async (path, options) => {
    sent = new Headers(options.headers).get('X-Mesiva-Context')
    return Response.json({ orders: [] })
  } })
  context.contextId = 'context-B'
  await client.request('/api/orders')
  assert.equal(sent, 'context-A')
})
```

- [x] Executar `node --test src/infrastructure/api/contextHttpClient.test.js src/app/runtime/session/companyContext.test.js src/infrastructure/qz/qzLocalPreferences.test.js`; esperar FAIL.
- [x] Implementar transporte/coordenação e injetar cliente capturado nas factories de `orders`, `customers`, `catalog`, `finance`, `table-service`, `reporting`, `printing` e `access`; nos clientes `bootstrapApi`, `effectiveConfigApi`, `policyHttp`; nos workflows `paymentApi/refundApi`; nos clientes `kitchenTvSettingsApi/kitchenTvControlApi` e perfil de negócio. Adicionar factories onde houver apenas exports estáticos. Não manter export global sem escopo utilizável na estratégia multiempresa. Criar cliente por contexto no runtime e entregar ao domínio; limpar drafts, filtros, seleções, feedback e effective config na troca. Guardas existentes bloqueiam troca incerta; nenhuma retentativa muda tenant.
- [x] Executar os três arquivos, clientes/runtime afetados e `npm run test:architecture`; esperar PASS. Commit: `feat(runtime): capture company context and coordinate browser changes`.

## Task 11: Login, seleção e aceite de empresa

**Files:** Create `src/domains/companies/index.js`, `infrastructure/companiesApi.js`, `infrastructure/companiesApi.test.js`, `ui/CompanySelection.jsx`, `ui/CompanySelection.test.js`, `ui/CompanyInvitationAccept.jsx`, `ui/CompanyInvitationAccept.test.js`, `ui/companies.css`. Modify `src/app/shell/AppRoot.jsx`, `LoginScreen.jsx`, `OperationMenu.jsx`, `src/domains/access/ui/MyAccount.jsx`, `TeamAccess.jsx`, `useEmailChallenge.js`, `src/App.jsx`, `src/app/navigation/routes.js` e testes adjacentes.

**Interfaces:** `createCompaniesApi({request})` expõe listagem, inspect/accept de convite e seleção. `CompanySelection({account,items,currentBusinessId,onSelect,onLogout,pending,error})`; `CompanyInvitationAccept({api,session,onLogin,onAccepted})`. URL de convite `/aceitar-convite`, token capturado uma vez e removido do fragmento antes de inspeção; navegação pública não carrega runtime empresarial.

- [x] Escrever testes: login sem campo empresa, uma entrada direta, várias com nome/perfil, zero sem bootstrap e opção sair; menu trocar empresa; convite existente solicita autenticação da pessoa correta e confirmação explícita, novo solicita senha; vínculo aceito não seleciona automaticamente outra empresa se sessão já existir.
- [x] Fixar Review Focus 4 no nível da tela: troca e inspeção superadas por sessão nova não publicam dados antigos; empresa sem vínculo não aparece; Deep link empresarial sem seleção vai à seleção e só retorna a destino autorizado. `Minha conta` trata senha global; equipe deixa de oferecer reset administrativo de outra pessoa.
- [x] Executar `node --test src/domains/companies/ui/CompanySelection.test.js src/domains/companies/ui/CompanyInvitationAccept.test.js src/domains/companies/infrastructure/companiesApi.test.js`; esperar FAIL.
- [x] Implementar telas e rotas com componentes Mesiva existentes, mobile/desktop, estados de loading/erro/vazio, foco e labels. `AppRoot` renderiza seletor/plataforma sem exigir bootstrap empresarial; acesso operacional depende estritamente do escopo. Convite/recuperação não guardam tokens em query/storage. Adaptar entradas/retornos sem redirecionamento externo.
- [x] Executar testes novos e login/menu/equipe/conta/runtime afetados; esperar PASS. Commit: `feat(ui): add company selection and membership acceptance`.

## Task 12: Painel Mesiva responsivo

**Files:** Create `src/domains/platform/index.js`, `infrastructure/platformApi.js`, `infrastructure/platformApi.test.js`, `ui/PlatformShell.jsx`, `ui/CompanyList.jsx`, `ui/NewCompany.jsx`, `ui/CompanyDetail.jsx`, `ui/platform.css`, `ui/PlatformRoutes.test.js`, `ui/CompanyList.test.js`, `ui/NewCompany.test.js`, `ui/CompanyDetail.test.js`. Modify `src/App.jsx`, `src/app/navigation/routes.js`, `scripts/architecture/check-import-boundaries.mjs`.

**Interfaces:** `createPlatformApi({request})` expõe `listBusinesses(input)`, `getBusiness(id)`, `createBusiness(input,idempotencyKey)`, `resendFirstManagerInvitation(id)`. `PlatformShell({account,onLogout,onSelectBusiness,children})`; telas recebem api capturada/estado de sessão e não importam repositórios ou domínio operacional.

- [x] Escrever testes das rotas `/mesiva/empresas`, `/nova`, `/:id`: gerente é negado antes de fetch; campos e revisão do cadastro explícitos; uma UUID fica estável durante tentativa/resposta perdida; duplo clique não cria nova tentativa. Busca/paginação acessíveis e detalhe sem dados de operação.
- [x] Escrever testes de estados independentes de acesso/envio: pending, accepted, rejected, uncertain, expired, activated. Ativação prevalece e bloqueia reenvio; cooldown informa espera; 409/resultado incerto causa reconciliação, não criação silenciosa de outra empresa. Um menu aberto por vez, nomes longos no cabeçalho e ações curtas.
- [x] Executar `node --test src/domains/platform/infrastructure/platformApi.test.js src/domains/platform/ui/PlatformRoutes.test.js src/domains/platform/ui/CompanyList.test.js src/domains/platform/ui/NewCompany.test.js src/domains/platform/ui/CompanyDetail.test.js`; esperar FAIL.
- [x] Implementar interfaces, estrutura visual reutilizando logo/cores e componentes existentes; lista paginada, formulário com resumo e detalhes. Nenhum campo de API key ou link para entrar em operação alheia. Entry `/mesiva` seleciona escopo plataforma pelo runtime, condicionado à concessão oficial. Incluir os novos barrels nas regras de fronteira.
- [x] Executar os seis arquivos e `npm run test:architecture`; esperar PASS. Commit: `feat(ui): build Mesiva company onboarding panel`.

## Task 13: Bootstrap privado, flags e corte de staging

**Files:** Create `worker/platform/bootstrap.js`, `bootstrap.test.js`, `scripts/infra/multi-company-staging-admin.mjs`, `multi-company-staging-admin.test.js`, `docs/operations/multi-company-staging.md`. Modify `wrangler.jsonc`, `worker/index.js`, `scripts/infra/staging-auth-smoke.mjs`, `staging-auth-smoke.test.js`, `stagingDeepLinkRegression.test.js`, `.github/workflows/deploy-staging.yml`.

**Interfaces:** `preparePlatformAdministrator(db,{name,email,ownershipVerified,now})`; `prepareExistingBusinessManager(db,{businessId,name,email,now})` para a primeira operação já existente; `readMultiCompanyReadiness(db,{adminAccountId,businessId,managerAccountId})`; `finalizeMultiCompanyStaging(db,inventory,readiness)` revoga somente acessos fictícios inventariados. `issueVerifiedAccountRecovery(db,{accountId,ownershipVerified,now})` emite desafio global de 30 minutos sem alterar senha/sessões antes da conclusão. CLI restrita `--env staging`, comandos `prepare-admin`, `prepare-business-manager`, `check-ready`, `finalize-legacy`, `issue-account-recovery`; destinatários/IDs por argumentos administrativos, secrets somente no processo privado. Recuperação excepcional exige `--ownership-verified`, TTY e emissão única do link em terminal privado; sem endpoint público administrativo.

- [x] Escrever testes: titularidade não verificada rejeitada; repetição não duplica concessão e não sobrescreve senha ativa; readiness exige contas verificadas com credencial suportada e concessão/vínculo utilizáveis. Finalização preserva históricos e contas novas fora do inventário, é idempotente e revalida readiness no batch. CLI recusa produção, recuperação excepcional sem TTY/prova e segredo/erro bruto em logs; link bruto aparece apenas uma vez na emissão privada explicitamente solicitada.
- [x] Escrever testes dos flags: `AUTH_MULTI_COMPANY_ENABLED=false` mantém rota legado; `AUTH_MULTI_COMPANY_PREPARE_ENABLED=true` libera somente inspeção/conclusão de novos desafios/convites já emitidos por procedimento autorizado, sem abrir cadastro/painel/login multiempresa. Corte true passa a resolver identidade/contexto e rejeita cookies/endpoints legados; preparo não concede capabilities por si só.
- [x] Executar `node --test worker/platform/bootstrap.test.js scripts/infra/multi-company-staging-admin.test.js scripts/infra/staging-auth-smoke.test.js scripts/infra/stagingDeepLinkRegression.test.js`; esperar FAIL.
- [x] Implementar interfaces e flags com default false em produção e staging. Credenciais do procedimento inicial usam `connectInfrastructure` existente sem bypass de validação, exigindo configuração privada uma vez por ambiente. Inventário persistido, desafio por e-mail, guardas de bootstrap e finalização. Workflow de staging não aplica corte por push automático da nova branch; preparação, readiness e flag ativo são checkpoints explícitos. Smoke pós-corte recusa PIN/identificador, não faz envio de recuperação nem acessa empresa desconhecida. Deep links incluem `/aceitar-convite`, seleção e painel.
- [x] Escrever roteiro com backup/bookmark, aplicação aditiva, deploy de preparo, convite autorizado, ativação de administrador/gerente, readiness privado, validação local completa, corte controlado, login real e finalização de acessos inventariados. Readiness anterior ao corte confirma identidade/credencial/vínculo no banco; login real ocorre imediatamente após ativar o fluxo e falha impede finalizar. Retorno exige combinação explícita de bundle e snapshot compatível; não sugerir reativar PIN ou simplesmente trocar flag após finalização. Executar os quatro arquivos; esperar PASS. Commit: `feat(ops): bootstrap and cut over multitenant staging safely`.

## Task 14: Verificação integrada e entrega revisável

**Files:** Create `worker/tenancy/multiCompanyFlow.test.js`, `src/domains/companies/ui/MultiCompanyContinuity.test.js`, `docs/operations/2026-10-02-multi-company-staging-verification.md`. Modify testes/registros de operações afetados somente para contratos aprovados; não baixar gates para aceitar falhas.

**Interfaces:** Cenário integrado usa os serviços reais das Tasks 1–13 e duas empresas. Registra commit/bundle/ambiente e separa evidência local, remota, de e-mail e de interface. Nenhum segredo ou senha em artefatos.

- [x] Escrever fluxo de integração: administrador sem vínculo cria A/B, novo gerente ativa, conta existente aceita B sem trocar senha, seleciona A/B com perfis diferentes, gerente desativa vínculo A sem tocar B, recovery revoga ambas as sessões, usuário recupera e só recebe B, último gerente protegido e painel/TV/impressão isolados. Executar `node --test worker/tenancy/multiCompanyFlow.test.js src/domains/companies/ui/MultiCompanyContinuity.test.js`; confirmar a falha de qualquer contrato ainda ausente e corrigir somente o módulo dono.
- [x] Executar os dois arquivos; esperar PASS. Executar `npm test`, `npm run test:architecture`, `npm run lint`, `npm run build`, `npm run d1:migrate:local` e bundles `npx --yes wrangler@4.128.0 deploy --dry-run` / `--dry-run --env staging`; registrar resultados novos do commit final. Não reaproveitar o número de testes da PR #85 como prova desta frente.
- [x] Realizar uma revisão independente de toda a branch antes da liberação. Se execução Native, seguir `executing-plans` para um revisor final; se Subagent-driven, seguir gates por tarefa e revisão final. Corrigir achados materiais e repetir verificações relacionadas, mantendo a trilha de decisão. Não disparar agentes enquanto este plano ainda estiver em revisão.
- [ ] Com a execução/deploy de staging autorizados, seguir os checkpoints da Task 13; homologar e-mails somente para destinatários autorizados. Para convite de conta existente, usar conta/inbox de teste com consentimento; não criar endereços fictícios externos para enviar. Testar desktop/celular, duas abas com/sem canais, URL/API diretas, TVs vinculadas às duas empresas (podem ser testadas em sequência no mesmo equipamento) e filas de impressão, com data/commit. Não marcar envio ou teste físico como concluído sem evidência; impressão física permanece limite conhecido.
- [ ] Commit: `test(tenancy): verify company isolation and onboarding end to end`. Atualizar issue #87, criar PR revisável quando implementação terminar e anexá-la ao chat. Merge/produção continuam dependentes da etapa própria; este checkpoint entrega testes, evidências e PR.

## Cobertura da Spec e sequência de aprovação

| Seções da Spec | Tarefas donas |
|---|---|
| Resultado, alcance, base e arquitetura (1–4) | Todas; flags e dependência da base na Task 13 |
| Conta, vínculos e concessão (5) | 1–3, 5, 7 |
| Login, seleção, sessão e abas (6) | 3–4, 10–11 |
| Provisionamento e idempotência (7) | 6–7, 12 |
| Convites e recuperação (8) | 2, 4–5, 11 |
| Isolamento e contratos de API (9) | 3–9, 10 |
| Interface e estados (10) | 11–12 |
| Preparo e corte (11) | 13–14 |
| Critérios e evidências (12–13) | Testes por tarefa e 14 |

Auto-revisão realizada: cobertura da Spec mapeada acima; assinaturas e nomes compatíveis entre tarefas; cinco condições de Review Focus atribuídas a testes; sem decisões abertas ou placeholders; plano de tamanho próximo à Spec. Nenhum teste ou implementação descrito aqui já foi executado por ter sido escrito no plano.

Após revisão do documento, o usuário escolhe execução **Native** ou **Subagent-driven**. Recomenda-se Native nesta sessão: as 14 tarefas compartilham contratos de identidade/contexto e a continuidade ajuda a controlar a integração; haverá revisão independente final. Se o usuário preferir gates independentes por tarefa, usar Subagent-driven. Não iniciar produto ou migração antes desta aprovação.
