# Produção multiempresa — estado final e operação corrente

**Status:** corte concluído em 04/10/2026 (America/Sao_Paulo).

Este documento substitui o roteiro transitório usado para migrar a Amor & Sabor do PIN legado para contas Mesiva por e-mail e senha. Os workflows de uso único do corte foram aposentados após a homologação e não fazem mais parte da operação normal.

## 1. Estado definitivo de produção

A produção opera com:

- domínio oficial: `https://app.mesiva.com.br`;
- `workers_dev: false` em produção;
- autenticação `multi_company` habilitada;
- `business_auth_state = user_only` para a Amor & Sabor;
- PIN legado removido fisicamente de `auth_credentials`;
- sessões legadas revogadas;
- Administrador Mesiva global separado dos vínculos operacionais das empresas;
- primeiro Gerente da Amor & Sabor ativo por e-mail e senha;
- recuperação normal de senha por e-mail;
- Resend como transporte de e-mail de produção.

Staging continua isolado em `https://staging.mesiva.com.br` e mantém `workers_dev: true` apenas como rota auxiliar de diagnóstico.

## 2. Evidência do fechamento

O corte foi concluído com as seguintes verificações reais de produção:

- primeiro Administrador Mesiva preparado, ativado e autenticado;
- inventário legado revisado;
- primeiro Gerente da Amor & Sabor preparado, ativado e autenticado;
- `check_ready = true`;
- deploy `multi_company` concluído;
- painel `/mesiva/empresas` homologado pelo Administrador Mesiva;
- operação do Gerente homologada;
- impressão/QZ homologada no ambiente real;
- finalização remota concluída com `mode=user_only`, `legacyPinRemoved=true`, `finalized=true`;
- smoke pós-finalização confirmou PIN rejeitado;
- deploy final com `workers_dev: false` confirmou somente `app.mesiva.com.br` como endpoint público de produção.

Referências principais:

- Finalize production cutover #1 — run `37245342969` — SUCCESS;
- Deploy production #70 — run `37248169529` — SUCCESS;
- Worker final desse deploy: `b1ce9b16-e018-40a6-953e-85ad613b8a12`.

## 3. Workflows de corte aposentados

Os seguintes workflows eram deliberadamente temporários e foram removidos após o fechamento:

- `Prepare Mesiva administrator`;
- `Manage production cutover`;
- `Finalize production cutover`.

Também foram removidos os runners, testes e o adaptador D1 REST que existiam apenas para esses fluxos.

Não recriar esses workflows como atalho operacional. Novas funcionalidades administrativas devem entrar pelo painel Mesiva ou por um procedimento novo, explicitamente revisado.

## 4. Deploy normal de produção

O único caminho normal de publicação continua sendo **Deploy production**, manual e master-only.

O formulário de produção não oferece mais `legacy`, `prepare` ou `readiness_confirmed`. Produção é permanentemente multiempresa.

Antes de publicar:

1. confirmar Validate verde no SHA atual de `master`;
2. confirmar staging verde;
3. disparar **Deploy production** em `master`;
4. aguardar testes, migrations, deploy e smoke;
5. confirmar `app.mesiva.com.br` operacional.

O ponto de restauração é registrado automaticamente, sem checkbox de confirmação. Se o registro falhar ou retornar um bookmark inválido, o workflow interrompe a publicação antes das migrations remotas.

O workflow:

- exige uma execução aprovada de `Validate application` na `master` e de `Deploy staging`, ambas para o SHA exato da publicação;
- aproveita essa validação completa, sem repetir `npm test` no deploy; se o CI ou staging ainda estiverem rodando, aguarda até dez minutos no total, e bloqueia em falha, cancelamento ou ausência de evidência válida;
- registra um bookmark de Time Travel do D1 antes de mudanças remotas;
- valida que a configuração canônica continua multiempresa;
- aplica migrations pendentes;
- consulta o estado de autenticação;
- mantém o secret de e-mail;
- publica o Worker;
- executa smoke de autenticação no domínio oficial.

Não existe passo de criação ou restauração de PIN no deploy normal.

## 5. Configuração e secrets permanentes

Configuração canônica versionada em `wrangler.jsonc`:

- `AUTH_EMAIL_ENABLED=true`;
- `AUTH_MULTI_COMPANY_ENABLED=true`;
- `AUTH_MULTI_COMPANY_PREPARE_ENABLED=false`;
- `AUTH_PUBLIC_ORIGIN=https://app.mesiva.com.br`;
- `AUTH_EMAIL_FROM=Mesiva <acesso@mesiva.com.br>`;
- `AUTH_EMAIL_DAILY_LIMIT=80`;
- `workers_dev=false` em produção.

Secrets permanentes esperados:

- Repository secret `CLOUDFLARE_API_TOKEN`;
- Repository secret `CLOUDFLARE_ACCOUNT_ID`;
- Environment secret `production / RESEND_API_KEY`.

Os secrets/variables temporários do corte, inclusive `AMOR_PIN` e `CUTOVER_*`, não fazem mais parte da configuração corrente.

Nunca registrar valores de secrets em commit, documentação, log de evidência ou chat.

## 6. Administração de contas

### Administrador Mesiva

O Administrador Mesiva entra normalmente em `https://app.mesiva.com.br` com e-mail e senha e acessa o painel de plataforma.

Uma conta de plataforma não aparece automaticamente na equipe de uma empresa e não recebe acesso operacional implícito aos clientes.

### Empresas e equipes

Novas empresas são provisionadas pelo painel Mesiva. O primeiro Gerente recebe o vínculo empresarial e, depois, gerencia a própria equipe conforme suas capabilities.

Gerentes e Operadores são vínculos empresariais. Administrador Mesiva é uma concessão global de plataforma.

### Gestão de empresas

Este procedimento requer a migration `0041_platform_company_management.sql` e o bundle correspondente à gestão administrativa. Verifique a release efetivamente publicada antes de assumir disponibilidade em produção. O endereço oficial permanece `https://app.mesiva.com.br`; a separação em domínio administrativo tem entrega própria.

No painel **Administração Mesiva → Empresas**, use nome/e-mail e o filtro de situação, depois **Gerenciar**. Os detalhes possuem **Visão geral**, **Pessoas e convites** (mediante permissão) e **Histórico**. Datas do histórico seguem São Paulo. Permissões são grants persistidos: a atualização concede os novos grants apenas às contas identificadas em `platform_bootstraps`, preservando permissões delegadas anteriores.

- **Suspender acesso** bloqueia toda a empresa e revoga suas sessões operacionais, convites pendentes e pareamentos da TV. Contas globais, senhas, vínculos e dados permanecem; outras empresas continuam acessíveis.
- **Reativar acesso** exige uma pessoa elegível com `access.users.manage` em empresa já ativada. Se necessário, reative um vínculo na aba de pessoas antes de liberar a empresa. Para cadastro pendente, **Retomar ativação** mantém o primeiro acesso pendente e exige reenvio explícito de convite.
- **Revogar acesso** afeta somente a pessoa na empresa selecionada. Não é permitido remover a última pessoa administradora elegível de uma operação habilitada: prepare um substituto ou suspenda a empresa primeiro. **Reativar vínculo** conserva o perfil; **Permitir novo convite** não ativa quem nunca aceitou.
- **Cancelar convite** invalida o link sem apagar o vínculo. **Reenviar convite** cria outro link e invalida os anteriores, sujeito ao intervalo de 60 segundos e limite do ambiente. Envio aceito pelo serviço não confirma recebimento no e-mail.
- **Excluir empresa** exige motivo e nome atual digitado. Remove o cadastro da consulta padrão e bloqueia o acesso; pedidos, clientes, catálogo, financeiro, auditoria, impressões e R2 permanecem preservados. Não existe purga automática.
- Para recuperar, filtre **Excluídas**, abra a empresa e selecione **Restaurar empresa**. Ela volta **Suspensa**; depois, retome acesso/ativação explicitamente. Sessões, links e pareamentos anteriores não voltam a funcionar; a TV exige novo pareamento.

Confirmações usam a revisão atual do cadastro. Se aparecer conflito, revise os dados e confirme novamente. Em perda de resposta, use **Verificar resultado**: essa consulta não repete a ação. Se não houver confirmação, **Tentar a mesma operação** é uma decisão explícita que preserva a chave original; nunca reenviar automaticamente um convite ou criar outra tentativa para contornar a incerteza.

Suspensão/exclusão não cancela pedidos, pagamentos ou papel já encaminhado ao QZ/spooler e não recupera dados já recebidos por um dispositivo desconectado. Preserve decisões humanas e resultados físicos desconhecidos; não reenviar impressões automaticamente ao retomar acesso.

Rollback para um bundle anterior a este controle pode ignorar `lifecycle_status` ao permitir novos logins. Não usar esse bundle para reabrir operação de empresas suspensas/excluídas; revise compatibilidade de autenticação, schema e estado administrativo antes de rollback, pelo runbook de release.

## 7. Recuperação de acesso

A recuperação normal usa **Esqueci minha senha** e e-mail.

A recuperação excepcional continua disponível somente em procedimento privado, após prova externa de titularidade:

```powershell
node scripts/infra/multi-company-production-admin.mjs issue-account-recovery --env production --account-id "ACCOUNT_ID" --ownership-verified --show-link-once
```

O link é confidencial, expira e não deve ser capturado em evidência.

## 8. Rollback após o fechamento

Depois de `user_only`, trocar flags não é rollback.

Se um incidente realmente exigir retorno a um estado anterior ao corte:

1. interromper novas escritas;
2. identificar o bookmark D1 compatível;
3. avaliar dados criados depois do corte;
4. restaurar explicitamente o D1;
5. restaurar um bundle compatível;
6. validar integridade antes de reabrir tráfego.

**Nunca recriar o PIN manualmente como atalho.**

## 9. Histórico

Os detalhes de desenho, TDD, decisões e homologações do corte permanecem preservados nos documentos de specs, planos, QA e histórico do GitHub. Este arquivo representa apenas o **estado operacional corrente** depois do encerramento.
