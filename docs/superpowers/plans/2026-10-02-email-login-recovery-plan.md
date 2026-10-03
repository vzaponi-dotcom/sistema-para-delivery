# Login por e-mail e recuperação de senha — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerentes e operadores entram com e-mail e senha, ativam a conta por convite enviado por e-mail e recuperam a própria senha por link.

**Architecture:** Preservar autorização e sessões do Worker e acrescentar desafios de e-mail persistidos em D1, um adaptador HTTP do Resend e telas públicas no layout Mesiva. Verificação e consumo são transacionais; envio externo não faz parte da transação D1. Preparar contas novas somente em staging por ferramenta administrativa controlada.

**Tech Stack:** JavaScript ESM, React 19, React Router, Cloudflare Workers/D1, Web Crypto, Node test runner com SQLite e harness React existentes; Resend via HTTPS, sem SDK novo.

**Spec:** `docs/superpowers/specs/2026-10-02-email-login-recovery-design.md`, aprovada pelo usuário após o commit `3ebfd74c`.

**Execução proposta:** nativa nesta sessão, tarefa por tarefa, com revisão independente da alteração completa antes do corte de staging. A revisão deste plano e a escolha do método precedem qualquer implementação.

## Global Constraints

- Login com e-mail + senha; sem login por link, login social ou cadastro público.
- Convite válido por **24 horas**, de uso único; recuperação válida por **30 minutos**, de uso único.
- Mínimo de 15 caracteres e máximo de 1.024 para a senha; manter o verificador versionado atual.
- Token aleatório de 32 bytes; persistir somente seu hash SHA-256. Token no fragmento da URL, enviado ao servidor no corpo do POST.
- Sessões em dispositivo compartilhado: 12 horas; pessoal: sete dias. Sem login automático depois da conclusão do desafio.
- Negócio derivado do contexto confiável do Worker; usuário não seleciona negócio em chamada pública.
- Solicitar recuperação não revoga credenciais ou sessões. Concluir recuperação troca a senha e revoga todas as sessões de forma atômica.
- 3 solicitações por e-mail/30 minutos; 10 por origem/15 minutos; reenvio autenticado com intervalo mínimo de 60 segundos por conta.
- Orçamento global inicial de **80 tentativas de envio por dia UTC** por ambiente, configurável, reservado atomicamente antes do envio.
- Configuração: `RESEND_API_KEY` como segredo; `AUTH_EMAIL_FROM`, `AUTH_PUBLIC_ORIGIN`, `AUTH_EMAIL_ENABLED` por ambiente. Configuração ausente causa erro controlado; login ativado funciona sem Resend.
- Recomeçar somente as contas fictícias de staging; manter referências históricas, pedidos, catálogos e perfis. Não executar corte em produção nem merge nesta implementação.
- Usar o worktree existente `.worktrees/issue-44-users-profiles-access` e a PR #85; não criar outro checkout nem apagar temporários de planos anteriores.

## Review Focus

- Um link atrasado chega depois de reenvio ou troca de senha: rejeitar o link antigo sem alterar credencial ou sessão; teste na tarefa 2.
- Conta desativada ou perfil revogado entre abertura e confirmação: conclusão deve falhar sem habilitar acesso; teste nas tarefas 2 e 4.
- Scanner abre o e-mail e recarregar limpa o token da memória: GET não consome, falta de token orienta reabrir o e-mail; teste na tarefa 5.
- Timeout ocorre depois de o provedor aceitar envio: manter o desafio utilizável e informar resultado incerto somente a quem gerencia contas; teste nas tarefas 3 e 4.
- Bootstrap é repetido após interrupção ou executado contra produção: retomar a mesma conta em staging e rejeitar produção antes de conectar/mutar; teste na tarefa 6.

## Arquivos e limites de responsabilidade

- `shared/accessEmail.js`: canonização e validação compartilhadas, sem dependência de UI ou Worker.
- `migrations/0037_email_access_recovery.sql`: verificação do e-mail, revisão da credencial, desafios, reservas de quota e afirmações transacionais.
- `worker/access/emailChallenges.js`: emissão, inspeção, consumo e revogação; não envia e-mail.
- `worker/access/emailThrottle.js`: reservas persistentes de solicitação, cooldown e orçamento diário.
- `worker/access/emailDelivery.js`: adaptador HTTP Resend e configuração de origem/remetente.
- `worker/access/emailTemplates.js`: HTML e texto dos e-mails de acesso, com escaping de conteúdo e identificação de staging.
- `worker/access/emailAuthApi.js`: login por e-mail e rotas públicas de recuperação/inspeção/conclusão.
- `worker/access/users.js`, `api.js`, `sessions.js`: gestão autenticada, projeções e condições de acesso verificadas.
- `src/domains/access/infrastructure/accessApi.js`, `src/infrastructure/auth/sessionApi.js`: contratos cliente, nunca segredos de envio.
- `src/domains/access/ui/{PasswordRecovery,InvitationAccept,TeamAccess,MyAccount}.jsx`: recuperação, conclusão por link e gestão de contas.
- `src/domains/access/ui/useEmailChallenge.js`: captura única do fragmento, limpeza de histórico e inspeção com proteção contra respostas obsoletas.
- `src/App.jsx`, `src/app/shell/LoginScreen.jsx`, `src/domains/access/index.js`: composição de rotas públicas e entrada por e-mail.
- `worker/access/emailStagingBootstrap.js`, `scripts/infra/email-access-staging-admin.mjs`: criação e finalização retomáveis das novas contas fictícias.
- Testes próximos dos módulos, conforme o padrão existente. Não criar diretório genérico `tests/`.

## Task 1: Contrato de e-mail e esquema aditivo

**Files:** Create `shared/accessEmail.js`, `shared/accessEmail.test.js`, `migrations/0037_email_access_recovery.sql`, `worker/access/emailMigration.test.js`.

**Interfaces:** `normalizeAccessEmail(input: unknown): string` lança erro de validação para entrada fora do formato; novas contas guardam o resultado em `users.login_normalized`. `users.email_verified_at` é nullable. `user_credentials.revision` é inteiro positivo, default 1, separado de `version` que já identifica o contrato do verificador.

- [ ] Escrever testes de `normalizeAccessEmail`: `"  Pessoa+Equipe@MESIVA.COM.BR "` resulta em `"pessoa+equipe@mesiva.com.br"`; preservar pontos e `+`; rejeitar múltiplos destinatários, controles, espaços internos, caracteres não ASCII, local vazio e comprimento maior que 254. Fixar suporte ao formato ASCII convencional sem nomes de exibição/partes entre aspas, compartilhado com o servidor.

```js
test('normaliza e-mail sem remover aliases', () => {
  assert.equal(normalizeAccessEmail('  Pessoa+Equipe@MESIVA.COM.BR '), 'pessoa+equipe@mesiva.com.br')
  assert.equal(normalizeAccessEmail('pessoa.equipe@mesiva.com.br'), 'pessoa.equipe@mesiva.com.br')
  assert.throws(() => normalizeAccessEmail('a@mesiva.com.br,b@mesiva.com.br'))
})
```

- [ ] Escrever teste SQLite: aplicar a migração não desativa contas nem altera pedidos/auditoria; FKs dos desafios permanecem compostas por negócio/usuário; rejeitar finalidade inválida, revisão não positiva e hash duplicado; `PRAGMA foreign_key_check` vazio.
- [ ] Executar `node --test shared/accessEmail.test.js worker/access/emailMigration.test.js`; confirmar falha por módulos/esquema novos ausentes.
- [ ] Implementar a normalização e o esquema. `auth_email_challenges`: IDs, negócio/usuário, finalidade, destinatário, hash único, revisão esperada nullable para ativação, emissor, emissão/validade/consumo/revogação. `auth_email_requests` e `auth_email_deliveries`: reservas com timestamps, hashes e índices de janelas. `auth_email_tx_assertions`: `id` e `ok INTEGER NOT NULL CHECK(ok=1)` para abortar lotes inteiros quando precondições falham; remover a afirmação ao terminar cada lote. `auth_email_staging_bootstraps`: negócio como chave, gerente com FK composta, IDs anteriores em JSON, data de preparação/finalização; não inserir nenhum bootstrap pela migração.
- [ ] Executar novamente os dois arquivos; esperar PASS e migração não destrutiva.
- [ ] Commit: `feat(auth): add email identity and challenge schema` com somente os arquivos desta tarefa.

## Task 2: Desafios e limites transacionais

**Files:** Create `worker/access/emailChallenges.js`, `emailChallenges.test.js`, `emailThrottle.js`, `emailThrottle.test.js`. Modify `worker/access/users.js` para incrementar `revision` e revogar desafios ao trocar senha/desativar. Adaptar fixtures existentes de credenciais apenas onde o novo contrato exigir.

**Interfaces:**
- `issueEmailChallenge(db, {businessId,userId,purpose,issuedBy=null,challengeId=crypto.randomUUID(),now}): Promise<{challengeId,token,email,expiresAt}>` — token retornado somente a chamadores internos. O chamador pode gerar o ID para reservar orçamento antes da emissão; o ID reservado e o persistido devem ser iguais.
- `inspectEmailChallenge(db, {businessId,token,now}): Promise<{purpose,expiresAt}>` — sem identidade/endereço na resposta pública.
- `completeEmailChallenge(db, {businessId,token,password,now}): Promise<{completed:true,purpose}>`.
- `revokeEmailChallenges(db, {businessId,userId,now}): Promise<void>`; nas mutações maiores, compor as mesmas instruções de revogação no lote da mutação, não chamar depois dela.
- `reserveRecoveryRequest(db, {businessId,email,originKey,now}): Promise<{allowed,retryAfterSeconds}>`; `reserveEmailDelivery(db, {businessId,userId,challengeId,now,dailyLimit=80,cooldownSeconds=60}): Promise<{allowed,reason}>`.

- [ ] Escrever testes reais SQLite: ativação marca e-mail e cria credencial no mesmo lote; recuperação preserva tudo na emissão e troca senha/revoga sessões na conclusão; link anterior falha depois de reenvio/troca de senha; mesmo token tem exatamente uma conclusão bem-sucedida; rollback integral em falha de afirmação/auditoria; desativação ou mudança de perfil para inativo antes de concluir impede consumo; outro negócio nunca acessa o desafio.

Assertions do teste `recuperação não revoga na emissão e consome somente uma vez`, com snapshot da credencial/sessões antes de emitir:

```js
assert.deepEqual(afterIssueCredential, beforeCredential)
assert.deepEqual(afterIssueSessions, beforeSessions)
assert.deepEqual(await completeEmailChallenge(db, input), { completed: true, purpose: 'password_reset' })
await assert.rejects(completeEmailChallenge(db, input), { code: 'INVALID_EMAIL_CHALLENGE' })
assert.equal(activeSessionsAfterComplete, 0)
```

- [ ] Escrever testes de limite: quarta solicitação do mesmo e-mail em 30 minutos e décima primeira da mesma origem em 15 minutos são bloqueadas antes de consultar conta; endereços ausentes também reservam; segunda entrega autenticada em menos de 60 segundos é bloqueada; reserva 81 do dia UTC falha; virar meia-noite reinicia o orçamento; instâncias independentes usando o mesmo banco compartilham limite.
- [ ] Executar `node --test worker/access/emailChallenges.test.js worker/access/emailThrottle.test.js`; confirmar RED por ausência do comportamento.
- [ ] Implementar geração Web Crypto, hash, revogação e afirmações de elegibilidade dentro de `db.batch`. Em recuperação, comparar `revision` capturada com a atual, incrementar ao trocar senha, manter `version` atual do verificador. Em ativação, exigir usuário/perfil ativos e ausência de credencial ativa. Consumir, mudar credencial, confirmar e-mail, revogar sessões/desafios e auditar no mesmo lote. Não fazer sequência de updates condicionais que possa continuar após zero linhas afetadas.
- [ ] Implementar reservas por escrita SQL condicional e hashes com negócio/domínio de finalidade; aplicar orçamento e cooldown antes de criar/inutilizar links. Limpeza limitada por índices, sem depender da memória do Worker. No teste de concorrência, usar clientes/conexões sobre o mesmo SQLite e não apenas uma sequência no mesmo adapter.
- [ ] Incrementar revisão/revogar desafios na troca autenticada de senha e na desativação, preservando a rotação de sessão atual dessa troca.
- [ ] Executar novamente testes novos e `node --test worker/access/users.test.js worker/access/credentials.test.js`; esperar PASS. Commit: `feat(auth): implement atomic email challenges and quotas`.

## Task 3: Entrega Resend e modelos de e-mail

**Files:** Create `worker/access/emailDelivery.js`, `emailDelivery.test.js`, `emailTemplates.js`, `emailTemplates.test.js`. Modify `wrangler.jsonc` para valores de staging sem incluir segredo e para envio desabilitado por padrão fora de staging.

**Interfaces:** `readEmailConfig(env): {enabled,from,publicOrigin,apiKey,dailyLimit}`; `buildChallengeEmail({purpose,displayName,businessName,expiresAt,link,isStaging}): {subject,html,text}`; `deliverEmailChallenge(env, challenge, {fetchImpl=fetch,now}={}): Promise<{status:'accepted'|'rejected'|'uncertain',providerId?:string}>`.

- [ ] Escrever testes HTTP: POST somente para `https://api.resend.com/emails`, Bearer no header, destinatário único, `Idempotency-Key` estável em retry; limite de duas tentativas, cada uma com timeout de cinco segundos. Rejeição definitiva retorna `rejected`; timeout/erro de rede ao fim retorna `uncertain`; erros sanitizados não incluem chave/token/corpo do e-mail. Tracking é configuração do domínio Resend, verificada na tarefa 7; não inventar parâmetros de tracking no POST de envio.

Assertions do teste `retry transitório preserva chave e payload` sobre o fetch injetado:

```js
assert.equal(calls.length, 2)
assert.equal(calls[0].url, 'https://api.resend.com/emails')
assert.equal(calls[0].options.headers['Idempotency-Key'], calls[1].options.headers['Idempotency-Key'])
assert.equal(calls[0].options.body, calls[1].options.body)
assert.equal(result.status, 'accepted')
```

- [ ] Escrever testes de template/configuração: escaping de nome/operação, HTML e texto, assunto com Ambiente de testes em staging, link `https://staging.mesiva.com.br/ativar-conta#token=...` ou `/redefinir-senha#token=...`; não usar Host enviado pelo cliente. Rejeitar origem não HTTPS ou com caminho/query/fragmento, configuração ausente/desabilitada e remetente inválido.
- [ ] Executar `node --test worker/access/emailDelivery.test.js worker/access/emailTemplates.test.js`; confirmar RED.
- [ ] Implementar modelos, configuração e adaptador HTTP sem SDK. Repetir payload/chave somente em falhas transitórias dentro da mesma execução; não repetir rejeição definitiva. Manter token exclusivamente em memória e mensagem enviada ao provedor.
- [ ] Executar os testes; esperar PASS. Commit: `feat(auth): deliver access emails through Resend`.

## Task 4: APIs de autenticação e gestão por e-mail

**Files:** Create `worker/access/emailAuthApi.js`, `emailAuthApi.test.js`. Modify `worker/index.js`, `worker/index.test.js`, `worker/access/{api,users,sessions}.js` e respectivos testes; adaptar `worker/access/cutover.js`/testes e `invitations.js`/testes somente para condições de gerente confirmado e revogação/revisão de credencial. Add `worker/access/emailAccessApi.test.js`.

**Interfaces:** `handleEmailAuthApi(request,env,{businessId}): Promise<Response|null>` dispatcha as quatro rotas da Spec. `createUser` recebe `{displayName,email,roleId}`. APIs autenticadas devolvem `{user,delivery:{status,expiresAt}}`, nunca token. Adicionar `POST /api/access/users/:id/resend-invite` e preservar `/reset` com a nova semântica. Projeções passam a `email` e `emailVerified`, retirando `identifier` da UI/API nova. Recuperação pendente não transforma `credentialState: 'active'` em credencial inativa: expor `passwordRecoveryPending` separadamente. Convite de ativação continua usando `credentialState: 'invited'`.

- [ ] Escrever testes de login: e-mail canônico/confirmado com senha correta cria sessão; não confirmado, desativado, perfil inativo e senha errada recebem `E-mail ou senha inválidos.`; payload com somente `identifier` não entra no fluxo `user_only`. Login funciona sem configuração Resend; throttle de login existente permanece ativo.
- [ ] Escrever testes de recuperação pública: mesma resposta genérica para conta ausente/pendente/desativada/elegível e rejeição específica de envio; 429 uniforme por limite; configuração global inválida retorna 503 uniforme; inspeção não consome nem revela conta; conclusão não emite cookie. Todos os responses de autenticação são `no-store` e POST exige origem válida.

Assertions do teste `conclusão pública não inicia sessão` e do teste `recuperação não revela existência`:

```js
assert.equal(completeResponse.headers.get('set-cookie'), null)
assert.match(completeResponse.headers.get('cache-control'), /no-store/)
assert.deepEqual(await existingResponse.json(), await missingResponse.json())
assert.equal(existingResponse.status, missingResponse.status)
```

- [ ] Escrever testes autenticados: operador não cria/reenvia/reset; gerente cria e reenvia convite; duplicata canônica retorna erro de cadastro; e-mail não pode ser alterado por PATCH; reset próprio orienta recuperação/troca autenticada; reset de outro gerente não revoga acesso na emissão; resultado incerto de envio mantém desafio; rejeição definitiva revoga apenas o desafio. Usuário/perfil/emissor mudados durante a mutação invalidam precondições de gravação.
- [ ] Executar `node --test worker/access/emailAuthApi.test.js worker/access/emailAccessApi.test.js`; confirmar RED.
- [ ] Implementar dispatch público antes do requisito de sessão, integração de reservas/desafios/entrega e auditoria. Na recuperação pública, usar `cooldownSeconds: 0` na reserva de entrega e aplicar as duas janelas públicas; em reenvio autenticado usar 60 segundos. Extrair o login por e-mail para o módulo novo, mantendo a integração de rediscovery/validação de resposta do Worker. O modo humano `user_only` exige e-mail confirmado; não criar aliases para contas fictícias. PIN legado não volta a funcionar em staging; rotas de infraestrutura legadas que ainda existam não devem contornar verificação do e-mail no login/criação/validação de sessão.
- [ ] Atualizar todas as condições de gerente utilizável, sessão e preflight para `email_verified_at IS NOT NULL`; impedir contar conta pendente como proteção do último gerente. Atualizar fixtures específicas para representar gerentes verificados onde o teste requer acesso; não enfraquecer assertions para acomodar falhas.
- [ ] Executar `node --test worker/index.test.js worker/access/emailAuthApi.test.js worker/access/emailAccessApi.test.js worker/access/api.test.js worker/access/users.test.js worker/access/sessions.test.js worker/access/cutover.test.js`; esperar PASS. Commit: `feat(auth): expose email login invitation and recovery APIs`.

## Task 5: Telas públicas e equipe sem tokens manuais

**Files:** Create `src/domains/access/ui/PasswordRecovery.jsx`, `PasswordRecovery.test.js`, `useEmailChallenge.js`, `useEmailChallenge.test.js`. Modify `src/domains/access/ui/InvitationAccept.jsx`/testes, `TeamAccess.jsx`/testes, `MyAccount.jsx`/testes, `src/domains/access/infrastructure/accessApi.js`, `src/domains/access/index.js`, `src/infrastructure/auth/sessionApi.js`/testes, `src/app/shell/LoginScreen.jsx`/testes, `src/App.jsx`, `src/domains/access/ui/AccessRoutes.test.js`, `src/shared/ui/access-auth.css` se necessário.

**Interfaces:** Session API envia `{email,password,deviceMode}`. Access API acrescenta `recoverPassword({email})`, `inspectChallenge({token})`, `completeChallenge({token,password})`, `resendInvitation(id)`. `PasswordRecovery({api,onLogin})`; `InvitationAccept({api,onLogin,expectedPurpose})` serve ativação e redefinição; `useEmailChallenge({expectedPurpose,api,location,history})` captura/limpa token e protege dono da resposta.

- [ ] Escrever testes: LoginScreen rotula E-mail e envia o contrato novo; link Esqueci minha senha leva a `/recuperar-senha`; recuperação usa texto genérico exato da Spec; confirmação divergir impede submit; completar mostra sucesso correto sem autenticar automaticamente.
- [ ] Escrever testes de link: fragmento retirado por `replaceState` antes da inspeção, sem `localStorage`/`sessionStorage`; GET/abertura não chama complete; recarregar sem token pede reabrir e-mail; finalidade errada é rejeitada; resposta obsoleta após navegação não altera tela nem recupera token; inicialização repetida/StrictMode não perde token na mesma montagem lógica.

Assertions do teste `abrir link inspeciona sem consumir e limpa histórico`, usando token sintético:

```js
assert.equal(inspections.length, 1)
assert.equal(completions.length, 0)
assert.equal(historyCalls[0].url.includes('#'), false)
assert.equal(persistentStorageWrites.length, 0)
```

- [ ] Escrever testes de equipe: Nome/E-mail/Perfil com operador inicial; sem token/copiar código; status de envio aceito/rejeitado/incerto honesto; Reenviar convite disponível para pendente; textos de reset dizem que sessões terminam somente após conclusão; e-mail somente leitura; filtro por nome/e-mail e apenas um menu aberto continuam funcionando.
- [ ] Executar `node --test src/app/shell/LoginScreen.test.js src/infrastructure/auth/sessionApi.test.js src/domains/access/ui/PasswordRecovery.test.js src/domains/access/ui/useEmailChallenge.test.js src/domains/access/ui/InvitationAccept.test.js src/domains/access/ui/TeamAccess.test.js`; confirmar falhas de comportamento esperado.
- [ ] Implementar as telas usando `AccessAuthLayout`, `PasswordField`, `Button`, Modal e guards de ownership existentes. Rotas públicas `/recuperar-senha`, `/ativar-conta`, `/redefinir-senha` são reconhecidas antes do shell autenticado e das guards de destino, inclusive quando outro usuário já tem sessão. Não limpar cookie de outro usuário ao concluir desafio; sua validade será rechecada pelo runtime normal.
- [ ] Ajustar o antigo link Tenho um convite para orientar abrir o e-mail; URL sem token não exibe campo para colar código. Concluir conta nunca oferece entrar com token. Atualizar Minha conta e rótulos de sessão para e-mail, mantendo bloqueio de troca de senha e rediscovery existentes. O cálculo de gerente utilizável na equipe exige `emailVerified` e credencial ativa; recuperação pendente não exclui esse gerente do cálculo.
- [ ] Executar testes citados e `node --test src/domains/access/ui/*.test.js src/app/runtime/session/useSessionRuntime.test.js`; esperar PASS. Commit: `feat(ui): add Mesiva email activation and password recovery screens`.

## Task 6: Bootstrap retomável e recuperação administrativa

**Files:** Create `worker/access/emailStagingBootstrap.js`, `emailStagingBootstrap.test.js`, `scripts/infra/email-access-staging-admin.mjs`, `email-access-staging-admin.test.js`. Modify `scripts/infra/issue-44-access-admin.mjs`/testes e `docs/operations/issue-44-access-cutover.md`; create `docs/operations/email-access-staging.md`.

**Interfaces:** CLI novo tem `prepare-manager --env staging --name <nome> --email <email>` e `finalize-accounts --env staging --manager-id <id>`; sem senha/token em argumentos. `prepareStagingEmailManager(db,{businessId,name,email,now})` retorna conta/challenge para entrega controlada; `finalizeStagingEmailAccounts(db,{businessId,managerId,now})` protege o gerente confirmado e desativa as demais contas antigas. Repetir prepare retoma a mesma conta pendente; conta confirmada não tem credencial substituída.

- [ ] Escrever testes: rejeitar ausência de `--env staging` ou tentativa de produção antes de conectar; repetir prepare não duplica usuário; finalizar com gerente pendente/inativo/perfil sem gestão falha sem mutações; concluir desativa/revoga contas antigas no mesmo lote, preserva novo gerente e referências; repetir finalize é idempotente e não desativa novas contas criadas depois da preparação. Persistir no bootstrap o conjunto dos IDs fictícios capturado na primeira preparação, em vez de selecionar indiscriminadamente todas as outras contas na finalização.

Assertions do teste `bootstrap repetido não apaga contas criadas depois` e do teste `produção é recusada antes de conectar`:

```js
assert.equal(firstPreparation.userId, secondPreparation.userId)
assert.equal(newOperatorAfterFinalize.active, true)
assert.deepEqual(foreignKeyErrors, [])
assert.equal(productionConnectionCalls, 0)
```

- [ ] Escrever testes de recuperação administrativa: somente ferramenta de infraestrutura, validação de titularidade descrita no runbook, link privado com token apresentado uma vez e nunca logado; challenge restrito a conta com e-mail já confirmado; não depender de acesso à caixa perdida nem habilitar endpoint público de administração. Invalidar desafios concorrentes/revisionar qualquer credencial alterada pelo procedimento. O frontend conclui o desafio pelo mesmo formulário sem campo de token manual.
- [ ] Executar `node --test worker/access/emailStagingBootstrap.test.js scripts/infra/email-access-staging-admin.test.js scripts/infra/issue-44-access-admin.test.js`; confirmar RED.
- [ ] Implementar bootstrap com conexões/controlos da CLI existente, validações de ambiente e afirmações transacionais, inventário persistente de contas anteriores e auditoria sanitizada. Preservar `user_only`; não apagar banco nem contas com referências históricas. Para emergência, adaptar emissão à nova família de desafios e entrega privada depois de prova de titularidade; a solicitação pública nunca tem acesso a esse modo de entrega.
- [ ] Documentar preparação, instalação de segredo fora do chat, verificação DNS, manutenção temporária de staging, ativação pelo usuário, finalização, reenvio e retomada após falha. Não usar rollback para PIN como recuperação de falhas.
- [ ] Executar testes citados; esperar PASS. Commit: `feat(ops): bootstrap fresh staging email accounts safely`.

## Task 7: Revisão, configuração e ensaio em staging

**Files:** Modify `.github/workflows/deploy-staging.yml` para verificar também os deep links `/recuperar-senha` e `/redefinir-senha`; manter deploy de produção intacto. Modify `scripts/infra/staging-auth-smoke.mjs`/testes e create `docs/operations/2026-10-02-email-access-staging-verification.md` para resultados reais, sem tokens ou senhas.

**Interfaces:** Resend com domínio verificado e chave instalada como segredo do Worker staging; `AUTH_EMAIL_FROM=Mesiva <acesso@mesiva.com.br>`, `AUTH_PUBLIC_ORIGIN=https://staging.mesiva.com.br`. Caixas de gerente/operador e autorização de envio devem vir do usuário. Sem contratar plano pago.

- [ ] Adaptar smoke para e-mail e verificar rotas públicas/identidade/capabilities; escrever assertions contra PIN/identifier aceito em `user_only`, token nos logs e cookie emitido pela conclusão. Executar `node --test scripts/infra/staging-auth-smoke.test.js`; esperar RED antes da mudança e PASS depois.

Assertions do teste `smoke user_only rejeita PIN e identificador sem criar sessão`, sobre respostas simuladas; nenhum ensaio de envio real é executado pelo smoke de deploy:

```js
assert.equal(pinResponse.headers.get('set-cookie'), null)
assert.equal(identifierResponse.headers.get('set-cookie'), null)
assert.equal(afterProbes.authenticated, false)
assert.equal(recoveryEmailsSentBySmoke, 0)
```

- [ ] Rodar `npm run test:architecture`, `npm run lint`, `npm test`, `npm run build` no worktree e registrar códigos de saída/contagens. Corrigir regressões concretas; não repetir suíte por rotina depois de resultados suficientes.
- [ ] Fazer revisão independente da alteração completa, focando transações, revogação, isolamento, antiabuso, bootstrap e ownership de UI. Corrigir achados relevantes e verificar os testes específicos antes de preparar corte remoto.
- [ ] Usar a conta Resend que o usuário confirmou ter criado e verificar o domínio com registros DNS fornecidos pelo serviço. Confirmar `open_tracking=false` e `click_tracking=false` no domínio, conforme a [configuração oficial do Resend](https://resend.com/changelog/update-click-open-tracking-via-api). Instalar `RESEND_API_KEY` pelo canal seguro de segredo do Worker staging; não fornecer valor em argumentos, Git, logs ou chat. Confirmar endereços de teste autorizados antes de envio real; interromper apenas essa etapa se configuração externa estiver faltando.
- [ ] Commitar e publicar somente a branch da PR #85. Conferir CI e workflow de deploy de staging existente; aplicar migração `0037` no D1 de staging e confirmar deploy do SHA revisto, sem executar workflow de produção. Não inferir deploy pela execução local de build.
- [ ] Fazer envio ao endereço autorizado e executar prepare-manager. Ativar o gerente pelo e-mail, verificar login/permissões, executar finalize-accounts e convidar novo operador. A definição de novas senhas é feita pelo usuário em tela; não pedir senha pelo chat.
- [ ] Ensaiar recuperação do operador e do único gerente, login com senha nova/antiga, sessão em segundo navegador, link reutilizado/expirado e acesso proibido do operador. Verificar desktop/celular, TV e ausência de mudanças na impressão; não exigir ensaio físico de impressão que o usuário informou ser indisponível.
- [ ] Registrar resultados reais, SHA/IDs de execução, evidências sem segredos, falhas ainda abertas e limitação de impressão física; commit de documentação. Apresentar resultado e próximo passo ao usuário, sem merge ou produção.

## Handoff e dependências externas

Plano preparado para revisão. O método recomendado é **execução nativa nesta sessão**, pois os módulos compartilham contratos de desafio, quota e sessão e a implementação deve manter essas mudanças coerentes. Fazer revisão independente ao terminar.

Revisão do plano não exige configurar Resend antecipadamente. Código e testes locais podem avançar depois de aprovar o plano/método; envio real, DNS e corte de staging dependem da conta, do acesso de configuração e dos endereços autorizados. Não afirmar que houve entrega/deploy enquanto essas etapas não forem verificadas.
