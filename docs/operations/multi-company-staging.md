# Preparação e corte multiempresa em staging

Este procedimento é administrativo e acontece uma vez por ambiente. O cadastro das próximas empresas é feito no painel Mesiva, com envio de convite pelo servidor. A primeira versão da CLI aceita somente `--env staging`; produção exige outro procedimento revisado.

## Checkpoints

1. Registrar o SHA do bundle atual e um backup SQL recente do D1 de staging, além do bookmark de Time Travel. Guardar os arquivos em local privado. Confirmar a restauração e a compatibilidade do bundle antes do corte.
2. Executar os testes completos, arquitetura, lint, build e deploy dry run; aplicar as migrações aditivas 0038 e 0039 ao D1 de staging. Não executar contra produção.
3. Implantar o bundle com `AUTH_MULTI_COMPANY_ENABLED=false` e `AUTH_MULTI_COMPANY_PREPARE_ENABLED=true`. O preparo abre somente inspeção e conclusão dos desafios globais e convites previamente emitidos. O login, o painel e as rotas operacionais multiempresa continuam fechados.
4. No processo administrativo privado, definir `RESEND_API_KEY`, `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`. O token e a conta Cloudflare devem corresponder ao binding revisado em `wrangler.jsonc`. Não colar valores no chat, nos argumentos, em logs ou em arquivos versionados. Não usar OAuth como alternativa.
5. Confirmar a titularidade do administrador e executar `prepare-admin`. O inventário dos usuários fictícios legados fica persistido; o link de ativação é enviado por e-mail. Nenhuma senha antiga é adotada.
6. A pessoa abre `/ativar-conta#token=...`, confirma o e-mail e define a senha. A aplicação remove o fragmento e não cria sessão durante a ativação.
7. Confirmar a titularidade do primeiro gerente e executar `prepare-business-manager`. Para uma identidade nova, o convite enviado é aceito em `/aceitar-convite`. Uma identidade global já verificada pode ser vinculada pelo procedimento privado somente após prova explícita de titularidade; sua senha permanece intacta. Este caso permite que o administrador também seja gerente da primeira empresa sem abrir login multiempresa durante o preparo.
8. Executar `check-ready` com os IDs retornados. `ready=true` exige credenciais globais suportadas, conta ativa e verificada, todas as concessões administrativas, empresa ativa e vínculo de gerente utilizável. O preparo não verifica o login em produção: a prova até aqui é de banco.
9. Após readiness, ativar explicitamente `AUTH_MULTI_COMPANY_ENABLED=true` e desativar o flag de preparo no deploy controlado. O primeiro corte exige a homologação abaixo antes de habilitar publicações automáticas. O corte de staging foi concluído e homologado em 2026-10-02; a configuração agora está versionada e os deploys seguintes usam GitHub Actions conforme o [roteiro de publicação](../release-and-migration-runbook.md).
10. Entrar realmente com e-mail e senha no mesmo domínio: conferir `/mesiva/empresas` como administrador e a primeira empresa como gerente. Verificar sessão/contexto oficial, seleção de empresa e bloqueio dos acessos antigos. Se o login falhar, interromper a finalização e investigar; não usar PIN como alternativa.
11. Somente após confirmar esses logins, executar `finalize-legacy --login-verified`. O batch revalida readiness, revoga os acessos fictícios inventariados e as sessões de PIN da primeira empresa, e remove a credencial de PIN. Preserva dados operacionais, nomes históricos e identidades globais fora do inventário.
12. Registrar a evidência do corte e dos testes por empresa, TV, troca de usuário/contexto, recuperação e convites. Impressão física permanece uma validação separada se não houver equipamento disponível.

## Comandos

Usar os valores reais somente no terminal administrativo privado. IDs abaixo são marcadores, não credenciais.

```powershell
node scripts/infra/multi-company-staging-admin.mjs prepare-admin --env staging --name "Administrador" --email "ADMIN_EMAIL" --ownership-verified
node scripts/infra/multi-company-staging-admin.mjs prepare-business-manager --env staging --business-id "BUSINESS_ID" --name "Gerente" --email "MANAGER_EMAIL" --ownership-verified
node scripts/infra/multi-company-staging-admin.mjs check-ready --env staging --admin-account-id "ADMIN_ID" --business-id "BUSINESS_ID" --manager-account-id "MANAGER_ID"
node scripts/infra/multi-company-staging-admin.mjs finalize-legacy --env staging --admin-account-id "ADMIN_ID" --business-id "BUSINESS_ID" --manager-account-id "MANAGER_ID" --login-verified
```

Uma repetição de preparo preserva credenciais ativas. O reenvio de link ainda obedece ao intervalo de 60 segundos e às quotas. `accepted` significa aceito pelo serviço de envio; `uncertain` pode ainda chegar. Não repetir automaticamente uma emissão incerta. Um login legado que conflite com o novo e-mail é retirado apenas se estiver no inventário fictício; seu nome e suas referências históricas são preservados.

## Recuperação excepcional

Preferir a recuperação pessoal por e-mail. Para perda de acesso excepcional, confirmar a titularidade fora do sistema e executar em terminal privado interativo:

```powershell
node scripts/infra/multi-company-staging-admin.mjs issue-account-recovery --env staging --account-id "ACCOUNT_ID" --ownership-verified --show-link-once
```

O link aparece uma vez nesse terminal, tem validade de 30 minutos e somente seu hash é persistido. A emissão não altera senha nem sessões; a conclusão altera a credencial e revoga as sessões globais. Não há endpoint público para conceder administração ou executar esse procedimento. Não capturar nem encaminhar o terminal contendo o link.

## Retorno

Depois da finalização, trocar um flag ou reativar PIN não constitui retorno válido. Planejar uma restauração explícita do snapshot/bookmark com seu bundle compatível, considerando os dados criados após o corte. Não apagar tabelas ou históricos para resolver login. Qualquer restauração de staging exige avaliação e autorização da alteração dos dados.

Os flags padrão em staging e produção permanecem `false`. A entrega do código e sua revisão não comprovam o corte remoto: registrar deploy, readiness, login e finalização como evidências separadas.
