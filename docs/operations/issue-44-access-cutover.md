# Acesso individual: corte e recuperação

## Roteiro vigente

A implementação de e-mail de 02/10/2026 substitui o procedimento inicial de identificador + token manual da issue #44. Para staging, seguir [Acesso por e-mail](email-access-staging.md), incluindo migração 0037, segredo Resend, novo gerente confirmado e finalização do inventário fictício. O antigo comando issue-initial-manager é bloqueado em staging; um convite manual histórico não confirma e-mail e não cria uma conta utilizável no fluxo atual.

Esta documentação não executa comandos. Produção requer plano de release e aprovação separada após evidências reais de staging. Não reutilizar comandos históricos de criação de gerente para o novo fluxo de e-mail.

## Autoridade e transporte

Os CLIs usam Wrangler 4.128.0, getPlatformProxy e a binding D1 DB definida em wrangler.jsonc. DB.batch aplica guards e mutações na mesma transação. O negócio vem do BUSINESS_ID do Worker; não há flag para escolher tenant/banco/endpoint. --env é obrigatório. Credenciais de infraestrutura CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID devem ser injetadas pelo gerenciador de segredos, sem argumentos, histórico ou logs. PIN e cookie não substituem acesso à infraestrutura.

O bootstrap novo aceita somente --env staging. Ambiente local dos utilitários históricos usa .wrangler/state/v3. A validação local não comprova conectividade/permissões remotas. Guardar backup e bookmark D1 em armazenamento restrito; restore anterior ao corte exige preservar user_only antes de reabrir tráfego.

## Preflight e corte

O preflight exige gerente utilizável, e-mail confirmado e credencial suportada para cada conta ativa, além de grants V1 íntegros. Não certifica por si só os testes de UI, permissões, TV ou impressão. Após confirmar os usuários preparados, executar na janela de staging autorizada:

```powershell
node scripts/infra/issue-44-access-admin.mjs preflight --env staging
node scripts/infra/issue-44-access-admin.mjs cutover --env staging
node scripts/infra/issue-44-access-admin.mjs preflight --env staging
```

O corte revalida a situação no lote; mudanças concorrentes podem recusá-lo após preflight verde. Ele muda enrollment para user_only, audita e revoga sessões legadas atomicamente. Repetir em user_only é idempotente e remove eventuais sessões legadas sem duplicar o corte. Não existe rollback automático para PIN. O bootstrap de e-mail pressupõe staging já em user_only e não altera esse modo.

## Publicações posteriores ao corte

Publicar código que respeite user_only, também ao configurar domínio. Em 01/10/2026 uma branch baseada na master anterior à issue44 substituiu o Worker e voltou a aceitar PIN embora o banco mantivesse o corte. Serializar workflows não impede publicação de código antigo.

Enquanto a issue44 não estiver integrada à master, usar feature/issue-44-users-profiles-access no workflow oficial de staging. O endereço é https://staging.mesiva.com.br. Conferir SHA publicado, rejeição de PIN e identificador, descoberta anônima e permissões. Mudança de hostname exige novo login porque o cookie é específico do host.

## Recuperação administrativa

Seguir a seção Recuperação sem acesso à caixa do [roteiro de e-mail](email-access-staging.md). A ferramenta exige --ownership-verified, terminal privado e --show-invite-once, após prova externa de titularidade. Somente gerente ativo/verificado pode receber o link privado de redefinição de 30 minutos. Emissão preserva credencial e sessões; conclusão substitui senha, incrementa revisão e revoga sessões/desafios. A interface não tem campo para colar token.

Contas desativadas, perfil sem gestão e identidade corrompida requerem investigação separada. Registrar o responsável de infraestrutura fora do banco; a auditoria do aplicativo identifica ator de sistema e alvo, sem segredos.

## Evidências para release

Guardar SHA/execução do workflow, configuração externa, resultado real de envio/ativação/recuperação, permissões gerente/operador, proteção do último gerente, modos de sessão compartilhada/pessoal, TV e limitações de impressão. Não inferir entrega de e-mail pela aceitação Resend ou deploy pela execução de build. Nenhuma evidência remota é produzida apenas por este documento.
