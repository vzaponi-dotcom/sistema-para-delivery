# Acesso individual: inscrição, corte e recuperação

Este roteiro implementa a issue #44. Todos os comandos remotos abaixo são instruções para a janela aprovada; a criação deste arquivo não executa nem autoriza migração, deploy, convite ou corte. Homologar em staging primeiro. Produção exige aprovação de release separada e evidências da Task 12.

## Autoridade e transporte

O CLI `scripts/infra/issue-44-access-admin.mjs` usa Wrangler **4.128.0**, `getPlatformProxy` e a binding D1 `DB`. `DB.batch` executa os guards e as mutações na mesma transação; erro desfaz o lote inteiro. Não existe endpoint HTTP de override nem senha administrativa do aplicativo. A autenticação remota usa `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` de administrador de infraestrutura, injetados por gerenciador de segredos na sessão do processo. O token precisa permitir as operações de remote bindings do Wrangler e acesso à D1 da conta; validar as permissões na homologação. Não fornecer o token como argumento, copiar para histórico ou usar PIN/cookie como credencial de infraestrutura.

`--env` é obrigatório. Staging usa o banco `amor-e-sabor-delivery-staging`; produção usa `amor-e-sabor-delivery`. O banco vem do `wrangler.jsonc`, e o negócio usa o mesmo `BUSINESS_ID` do Worker. Não há flags para trocar negócio, banco ou endpoint. O arquivo temporário contém apenas a binding e configuração não secreta; é removido após encerrar o proxy. Ambiente local usa `.wrangler/state/v3`, compatível com as migrations locais do Wrangler.

Referências oficiais: [API getPlatformProxy](https://developers.cloudflare.com/workers/wrangler/api/#getplatformproxy), [remote bindings](https://developers.cloudflare.com/workers/local-development/bindings-per-env/), [transação D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch), [comandos D1](https://developers.cloudflare.com/d1/wrangler-commands/). A aplicação continua usando bindings, e o CLI usa o proxy oficial fora do Worker. A validação local não comprova permissões nem conectividade remota.

## Preparação e evidências obrigatórias

1. Registrar responsável, ambiente, SHA aprovado, horário início/fim da janela e aprovação. Interromper outros ajustes administrativos durante o corte. Comunicar à equipe que todos os dispositivos e estações precisarão de login individual; contas compartilhadas antigas serão encerradas. Registrar quem dará suporte e quem tem autoridade de recuperação.
2. Guardar backup D1 e bookmark de Time Travel em armazenamento restrito fora do repositório. Validar a recuperação em banco isolado de staging. Dumps contêm dados pessoais, hashes e histórico: não anexar a tickets públicos. O restore completo de backup anterior ao corte também pode restaurar auth legado; qualquer recuperação desse tipo exige plano separado que preserve `user_only` antes de reabrir tráfego.
3. Aplicar migrations completas em ordem, incluindo `0035_users_profiles_access.sql` e `0036_audit_resource_attribution.sql`. Não editar dados antigos de pedidos/pagamentos/impressão para inventar autoria.
4. Conferir gates da Task 12: matriz de rotas e payloads diretos; projeções gerente/operador; build/lint/testes; convite/expiração/reuso; recuperação administrativa; TVs; impressão física; dispositivos compartilhados/pessoais; saída de sessão com operações pendentes. Preflight SQL não certifica esses gates.
5. Definir uma janela curta de enrollment. Durante ela, o PIN atende operações legadas; contas novas administram acessos. Ativar todas as contas que ficarão ativas antes do corte, ou desativar contas ainda pendentes. Preflight exige credencial válida para cada usuário ativo, gerente utilizável e grants V1 íntegros.

## Ensaio local

Executar da raiz do checkout, em terminal privado. Instalar/verificar o CLI fixado, aplicar migrations locais e rodar os testes. Nenhum comando desta seção usa banco remoto.

```powershell
npm exec --yes --package=wrangler@4.128.0 -- wrangler --version
npm run d1:migrate:local
node --test worker/access/cutover.test.js scripts/infra/issue-44-access-admin.test.js worker/access/sessions.test.js worker/access/roles.test.js worker/access/credentials.test.js
node scripts/infra/issue-44-access-admin.mjs issue-initial-manager --env local --identifier gerente --name "Gerente responsável" --show-invite-once
node scripts/infra/issue-44-access-admin.mjs preflight --env local
```

O primeiro preflight antes de aceitar o convite deve falhar. O destinatário abre o aplicativo local e cola o token no formulário de ativação; o token é enviado por POST, nunca em URL. Ele define a própria senha, com pelo menos 15 caracteres, e faz login em seguida: aceitar convite não abre sessão. Após preparar e ativar as contas, repetir o preflight e então:

```powershell
node scripts/infra/issue-44-access-admin.mjs cutover --env local
node scripts/infra/issue-44-access-admin.mjs preflight --env local
```

## Staging — apenas na janela aprovada

Injetar as duas variáveis Cloudflare de infraestrutura pelo gerenciador de segredos. Abrir terminal sem gravação/transcript. Criar a pasta protegida `C:/Backups/issue-44/staging` antes do export; usar um nome novo a cada janela. Os nomes abaixo exemplificam a primeira janela, e não devem sobrescrever backup existente.

```powershell
npm exec --yes --package=wrangler@4.128.0 -- wrangler d1 time-travel info amor-e-sabor-delivery-staging --env staging
npm exec --yes --package=wrangler@4.128.0 -- wrangler d1 export amor-e-sabor-delivery-staging --remote --env staging --output C:/Backups/issue-44/staging/before-access-001.sql
npm run d1:migrate:staging
npm run deploy:staging
node scripts/infra/issue-44-access-admin.mjs issue-initial-manager --env staging --identifier gerente --name "Gerente responsável" --show-invite-once
```

O último comando exibe deliberadamente o convite **uma vez**, após commit, somente em terminal interativo. O banco guarda apenas hash, validade de 24 horas e estado de uso. O operador verifica titularidade fora do aplicativo e entrega token por canal privado aprovado. Não usar `Tee-Object`, redirecionamento, gravação de terminal, captura de tela, logs de CI ou ticket. O CLI nunca pede nem imprime senha. Limpar o scrollback e encerrar a sessão após a entrega. Não automatizar reexecução se a resposta for incerta.

Se o convite inicial foi perdido/expirou antes da ativação, repetir o mesmo comando com o mesmo identificador: o convite anterior é revogado. Depois que o gerente ativou a senha, esse comando falha; recuperação usa o comando de emergência. O PIN não pode reivindicar a primeira conta.

Após ativação do gerente e preparação dos demais usuários, executar:

```powershell
node scripts/infra/issue-44-access-admin.mjs preflight --env staging
node scripts/infra/issue-44-access-admin.mjs cutover --env staging
node scripts/infra/issue-44-access-admin.mjs preflight --env staging
```

Preflight retorna `ready` e códigos de falha não secretos, com exit code 1 quando não está pronto. Corrigir a preparação sem editar credenciais diretamente. O corte revalida a situação no lote de gravação; mudança concorrente de senha/conta/grants pode recusar o corte mesmo após preflight verde. Repetir preflight após conciliar a mudança.

O corte muda `enrollment` para `user_only`, grava auditoria de sistema e revoga todas as sessões sem usuário na mesma transação. Repetir o comando após resposta incerta é idempotente e não duplica o evento de corte. Uma falha mantém estado/sessões como estavam. Não há comando para voltar a PIN.

### Publicações posteriores ao corte

Publicar apenas código que respeite `user_only`, incluindo ao configurar um domínio. Em 01/10/2026, uma branch de domínio baseada na master anterior à issue44 substituiu o Worker de staging e aceitou PIN, embora o banco mantivesse o corte. A concorrência do workflow serializa deploys, mas não impede uma branch antiga de substituir o código atual.

Enquanto a issue44 não estiver integrada à master, usar a branch que reúne perfis e domínio (`feature/issue-44-users-profiles-access`) no workflow oficial de staging. O endereço é https://staging.mesiva.com.br; o workers.dev continua disponível. A verificação mode-aware deve confirmar `user_only` e rejeição de PIN. Se uma versão antiga criar sessões legadas após o corte, restaurar primeiro o bundle compatível e executar o corte idempotente para revogá-las, preservando o timestamp/evento original e as contas. Uma mudança de hostname exige novo login porque o cookie é específico do host.

## Conferência após o corte

Todos os caixas, navegadores e estações entram novamente usando conta individual. Testar gerente e operador, modo compartilhado (12 horas) e pessoal (7 dias), expiração e troca de usuário. Confirmar recusa do PIN e das sessões legadas. A TV mantém autenticação própria; impressão automática exige sessão humana. Verificar impressão física e recuperação de resultado incerto sem replay automático de pedidos, recebimentos ou jobs. Registrar eventos de auditoria `access.auth.enrollment`, `access.invitation.initial`, `access.auth.cutover` e atribuições após corte sem guardar tokens.

## Produção — aprovação separada após staging

Revisar evidências acima, comunicar a equipe e definir a janela final. Provisionar pasta protegida `C:/Backups/issue-44/production` e credenciais de infraestrutura da conta correta. Executar somente após a aprovação de produção:

```powershell
npm exec --yes --package=wrangler@4.128.0 -- wrangler d1 time-travel info amor-e-sabor-delivery
npm exec --yes --package=wrangler@4.128.0 -- wrangler d1 export amor-e-sabor-delivery --remote --output C:/Backups/issue-44/production/before-access-001.sql
npm run d1:migrate:production
npm run deploy:production
node scripts/infra/issue-44-access-admin.mjs issue-initial-manager --env production --identifier gerente --name "Gerente responsável" --show-invite-once
```

Após entregar/aceitar convite, ativar usuários, validar acessos e confirmar a janela comunicada:

```powershell
node scripts/infra/issue-44-access-admin.mjs preflight --env production
node scripts/infra/issue-44-access-admin.mjs cutover --env production
node scripts/infra/issue-44-access-admin.mjs preflight --env production
```

## Recuperação administrativa

Verificar titularidade por canal externo; registrar responsável de infraestrutura, chamado, ambiente, usuário alvo e horário, sem segredos. A auditoria no banco identifica ator de sistema e alvo; a identidade humana do administrador deve constar no registro operacional e no controle de acesso da infraestrutura. A exceção é reservada ao gerente inacessível que já ativou credencial. Não ativa usuários desativados, não troca papel nem concede grants. Recuperação que exija reparar identidade/grants corrompidos requer investigação separada.

```powershell
node scripts/infra/issue-44-access-admin.mjs issue-emergency-invite --env staging --user-id amor-e-sabor:initial-manager --show-invite-once
```

Homologar esse fluxo em staging. Para o incidente aprovado em produção, usar exatamente o mesmo comando com `--env production` e o ID real do gerente confirmado. O lote revoga credencial/sessões e convites antigos e emite novo convite de 24 horas, com evento `access.invitation.emergency`. Pode recuperar o último gerente, incluindo reemissão se ele já estiver aguardando reset. A aceitação ocorre uma única vez e exige login posterior. A interface normal continua exigindo senha atual para redefinição própria.

Se entrega/resposta foi perdida, repetir conscientemente a emissão para esse gerente revoga o convite anterior; nunca repetir automaticamente. Após ativação, conferir login e auditoria. `user_only` permanece mesmo sem gerente temporariamente utilizável. Rollback de código deve continuar respeitando esse estado; **nunca restaurar PIN automaticamente**.

## Pendências antes de release

Task 11 entrega código e provas locais. Anexar à aprovação os resultados reais de staging, conectividade/permissões do token de infraestrutura, backup/restauração isolada, comunicação, QA de dispositivos/TV/impressão e os gates completos da Task 12. Nenhum desses resultados remotos foi produzido por este runbook.
