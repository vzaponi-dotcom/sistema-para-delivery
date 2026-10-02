# Acesso por e-mail em staging

Este roteiro acompanha a Spec e o plano de 02/10/2026. O ambiente contém somente contas fictícias. O novo bootstrap não migra identificadores antigos nem apaga usuários/histórico. Produção e merge dependem de aprovação separada.

## Configuração antes da publicação

1. Conferir no Resend o domínio mesiva.com.br verificado e os registros DKIM/SPF solicitados. Manter open tracking e click tracking desativados: o link de autenticação não deve passar por redirecionamento de rastreamento. Não copiar o valor DKIM truncado de uma captura.
2. Criar uma chave de envio restrita ao domínio. Instalar RESEND_API_KEY como segredo do Worker de staging pelo painel Cloudflare ou prompt interativo de Wrangler. Não enviar chave pelo chat nem usar argumentos, arquivo versionado, transcript ou logs de CI.
3. Conferir as variáveis revisadas em wrangler.jsonc: AUTH_EMAIL_ENABLED=true, AUTH_EMAIL_FROM="Mesiva <acesso@mesiva.com.br>", AUTH_PUBLIC_ORIGIN=https://staging.mesiva.com.br e AUTH_EMAIL_DAILY_LIMIT=80. O limite é global por dia UTC; reenvio administrativo exige 60 segundos. O orçamento conservador inclui tentativas rejeitadas/incertas.
4. Registrar SHA, responsável e janela. Preservar backup/bookmark D1 em armazenamento restrito. Aplicar migrations em ordem, incluindo 0037_email_access_recovery.sql, pelo workflow oficial de staging desta branch. Confirmar SHA e resultado do deploy; build local não é deploy.

Comando para instalar o segredo no prompt oculto, sem valor na linha de comando:

```powershell
npx --yes wrangler@4.128.0 secret put RESEND_API_KEY --env staging
npx --yes wrangler@4.128.0 secret list --env staging
```

O segundo comando lista somente nomes. A chave instalada no Worker não pode ser extraída para o CLI. O processo privado do CLI precisa receber sua própria RESEND_API_KEY e as credenciais CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID pelo gerenciador de segredos; não executar com captura de ambiente nem procurar valores em logs. A configuração não secreta vem de wrangler.jsonc; não sobrescrever origem/remetente na sessão de operação.

## Novo gerente e confirmação

Staging permanece em user_only. A publicação exige e-mail confirmado para sessões humanas; as contas antigas sem e-mail confirmado deixam de entrar. Planejar esta manutenção temporária e preparar Resend antes do deploy. TV mantém autenticação própria. Não restaurar PIN para contornar falhas.

Em sessão de infraestrutura autorizada, executar com o endereço autorizado pelo usuário:

```powershell
node scripts/infra/email-access-staging-admin.mjs prepare-manager --env staging --name "Gerente de staging" --email <email-autorizado>
```

O comando registra uma única conta e a lista dos IDs fictícios presentes naquele momento. Reserva o envio e emite desafio de ativação na mesma transação, depois chama Resend. A saída contém ID e resultado accepted/rejected/uncertain, sem link/token/e-mail. Accepted significa aceitação pelo provedor, não entrega na caixa. Se uncertain, conferir a caixa antes de reenviar. Em rejeição, corrigir a configuração e repetir conscientemente após o intervalo. Repetir com o mesmo endereço retoma a mesma conta pendente; a última emissão invalida a anterior. Conta já confirmada não recebe senha nova nem convite por esse comando.

O usuário abre o e-mail mais recente, define senha de pelo menos 15 caracteres na tela e entra com e-mail + senha. Ativação dura 24 horas e não abre sessão automaticamente. Não pedir a senha pelo chat. Ao recarregar a tela já sem fragmento, reabrir o link do e-mail. Confirmar login, menus e acesso a Equipe e acessos antes de finalizar.

## Finalizar as contas fictícias antigas

Usar o ID retornado pela preparação:

```powershell
node scripts/infra/email-access-staging-admin.mjs finalize-accounts --env staging --manager-id <id-do-novo-gerente>
```

O lote revalida gerente ativo, e-mail confirmado, credencial suportada e perfil com gestão. Só então desativa as contas do inventário inicial e revoga suas credenciais, sessões e convites/desafios. IDs e referências históricas permanecem. Contas criadas depois da preparação são preservadas. Repetir a finalização após resposta incerta é idempotente. Falha transacional mantém as contas anteriores; não editar hashes/grants diretamente.

Convidar o operador pela interface com outro endereço autorizado. Nome identifica a pessoa; e-mail é o login e permanece somente leitura. Reenviar convite quando pendente. Solicitar redefinição pelo gerente ou pela tela Esqueci minha senha quando confirmado/ativo. O pedido não encerra acesso: somente a conclusão troca a credencial e encerra todas as sessões desse usuário. O único gerente pode usar a recuperação pública normalmente.

## Recuperação sem acesso à caixa

A exceção exige administrador de infraestrutura, conta gerente ativa com e-mail já confirmado e prova de titularidade fora do aplicativo. Confirmar a identidade por canal independente conhecido e registrar chamado, evidência restrita, responsável, ambiente, ID e horário, sem segredos. Uma afirmação do solicitante ou o PIN não constitui prova. A flag abaixo atesta essa conferência; não substitui a prova operacional.

Executar em terminal privado interativo, sem transcript/redirecionamento:

```powershell
node scripts/infra/issue-44-access-admin.mjs issue-emergency-invite --env staging --user-id <id-confirmado> --ownership-verified --show-invite-once
```

O comando apresenta uma vez o link privado /redefinir-senha#token=..., com validade de 30 minutos. Entregar por canal privado já confirmado, encerrar terminal e limpar scrollback. O banco guarda somente hash. Não anexar link a ticket, screenshot, chat público ou CI. A emissão invalida desafios concorrentes, preservando senha e sessões atuais até a conclusão. Concluir pelo mesmo formulário público e fazer login depois; não existe endpoint público de override nem campo de token manual. Não ativa conta desativada ou corrige grants. Reemissão deve ser consciente, nunca automática.

## Homologação e evidências

Registrar resultados reais em 2026-10-02-email-access-staging-verification.md, sem endereços privados/senhas/tokens. Conferir gerente/operador, permissão por URL e API, último gerente, login novo/antigo, segundo navegador, uso único/expiração, limites e mensagens genéricas. Confirmar ausência de cookie na conclusão e de segredo em histórico/storage/logs. Validar desktop/celular e TV; registrar impressão física como não realizada quando indisponível. O smoke de deploy não envia e-mails reais.

Referências: [domínios Resend](https://resend.com/docs/dashboard/domains/introduction), [rastreamento por domínio](https://resend.com/changelog/update-click-open-tracking-via-api), [envio Resend](https://resend.com/docs/api-reference/emails/send-email), [segredos Cloudflare](https://developers.cloudflare.com/workers/configuration/secrets/).
