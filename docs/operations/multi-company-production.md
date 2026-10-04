# Corte multiempresa e primeiro acesso — produção

Este roteiro prepara o primeiro Administrador Mesiva e o primeiro gerente da empresa já existente sem desligar o acesso legado antes da confirmação real. Ele é executado somente em uma janela de produção explicitamente autorizada.

A implementação desta frente **não executa produção por si só**. O workflow `Deploy production` continua manual e master-only.

## 1. Pré-requisitos obrigatórios

Antes de qualquer fase diferente de `legacy`:

- registrar o SHA exato de `master` e confirmar o Validate correspondente;
- confirmar staging verde no mesmo código;
- confirmar que o D1 de produção oferece Time Travel; o próprio workflow registra o bookmark atual antes de qualquer migration/deploy de `prepare` ou `multi_company`;
- confirmar o endereço oficial de produção `https://app.mesiva.com.br`, usado pela aplicação e pelos links de ativação;
- configurar no Environment `production` do GitHub:
  - secret `CLOUDFLARE_API_TOKEN`;
  - secret `CLOUDFLARE_ACCOUNT_ID`;
  - secret `RESEND_API_KEY`;
  - secret `AMOR_PIN` enquanto o modo legado ainda existir;
  - variable `PRODUCTION_URL=https://app.mesiva.com.br` (opcional; este já é o fallback canônico do workflow);
  - variable `AUTH_PUBLIC_ORIGIN=https://app.mesiva.com.br` para gerar links de ativação, convite e recuperação;
  - variable `AUTH_EMAIL_FROM=Mesiva <acesso@mesiva.com.br>` ou outro remetente Mesiva já autorizado no Resend;
  - variable `AUTH_EMAIL_DAILY_LIMIT=80`, opcional porque 80 já é o default.
- no terminal administrativo privado que executará a CLI, disponibilizar por injeção segura:
  - `CLOUDFLARE_API_TOKEN`;
  - `CLOUDFLARE_ACCOUNT_ID`;
  - `RESEND_API_KEY`;
  - `AUTH_PUBLIC_ORIGIN`;
  - `AUTH_EMAIL_FROM`;
  - `AUTH_EMAIL_DAILY_LIMIT` se diferente de 80.

Nenhum segredo, senha, cookie ou link com token deve ser enviado ao chat, salvo em argumento de comando, commit, artefato de CI ou log de evidência.

O domínio de produção é versionado em `wrangler.jsonc` como Custom Domain `app.mesiva.com.br`. O endpoint `workers.dev` permanece habilitado apenas como contingência técnica; o endereço canônico para usuários, e-mails e smoke de produção é `https://app.mesiva.com.br`.

## 2. Fase A — PREPARE, sem retirar o PIN

Disparar manualmente **Deploy production** no SHA atual de `master` com:

- `auth_phase = prepare`;
- `backup_confirmed = true`;
- `readiness_confirmed = false`.

O workflow:

1. roda testes, arquitetura, lint, build e Worker dry-run;
2. confirma que o SHA ainda é o último `master`;
3. consulta o Time Travel do D1 e registra no resumo do run o bookmark atual de restauração;
4. valida os checkpoints humanos informados no disparo;
5. aplica as migrations de produção, garantindo que `business_auth_state` exista antes da leitura;
6. lê o estado atual de `business_auth_state`;
7. bloqueia qualquer tentativa de voltar a `legacy/prepare` se produção já estiver `user_only`;
8. instala/atualiza o secret de e-mail;
9. publica somente o modo de preparação;
10. aguarda uma janela limitada de propagação do domínio `app.mesiva.com.br` e comprova que o PIN legado continua entrando e que os endpoints estreitos de ativação/convite estão disponíveis.

Neste estágio:

- `AUTH_MULTI_COMPANY_ENABLED=false`;
- `AUTH_MULTI_COMPANY_PREPARE_ENABLED=true`;
- o painel Mesiva e o login multiempresa ainda não estão liberados;
- o PIN continua sendo o acesso operacional de contingência.

Se a captura do bookmark falhar, o workflow para antes das migrations. Se o smoke de domínio/PIN falhar após a janela limitada de propagação, **parar** e não preparar contas.

## 3. Preparar o primeiro Administrador Mesiva

Após prova externa de titularidade, no terminal privado:

```powershell
node scripts/infra/multi-company-production-admin.mjs prepare-admin --env production --name "NOME_ADMIN" --email "EMAIL_ADMIN" --ownership-verified
```

O comando usa exclusivamente o binding de produção revisado no `wrangler.jsonc`, não aceita banco/endpoint arbitrário e não define senha.

O destinatário abre o link de ativação recebido em `AUTH_PUBLIC_ORIGIN`, confirma o e-mail e define a própria senha. A ativação não cria sessão automaticamente.

Repetir `prepare-admin` para a mesma identidade não pode sobrescrever uma credencial ativa.

## 4. Inspecionar o inventário legado de produção

Antes de criar o vínculo do primeiro gerente, revisar o inventário capturado pelo bootstrap:

```powershell
node scripts/infra/multi-company-production-admin.mjs inspect-inventory --env production --admin-account-id "ADMIN_ACCOUNT_ID"
```

A saída traz somente metadados operacionais necessários à revisão (IDs, nome de exibição, papel/estado), sem senha/token.

**Regra de produção:** o preparo do gerente não renomeia silenciosamente um login legado conflitante. Se existir colisão com o e-mail escolhido, o batch falha e nenhum novo acesso é persistido. Nesse caso, interromper e decidir a migração daquela identidade antes de continuar.

## 5. Preparar o gerente da empresa existente

Depois da revisão:

```powershell
node scripts/infra/multi-company-production-admin.mjs prepare-business-manager --env production --business-id "amor-e-sabor" --name "NOME_GERENTE" --email "EMAIL_GERENTE" --ownership-verified
```

É permitido usar a mesma conta do Administrador Mesiva. Nesse caso, a senha global já criada é preservada e apenas o vínculo empresarial é acrescentado.

Se for uma conta nova, o gerente recebe convite e define sua senha pelo fluxo oficial.

## 6. Readiness antes do corte

Com os IDs retornados:

```powershell
node scripts/infra/multi-company-production-admin.mjs check-ready --env production --admin-account-id "ADMIN_ACCOUNT_ID" --business-id "amor-e-sabor" --manager-account-id "MANAGER_ACCOUNT_ID"
```

Só continuar com `ready=true`.

O readiness exige, entre outros pontos:

- administrador ativo, verificado e com credencial suportada;
- grants explícitos da plataforma;
- empresa ativa;
- gerente ativo/verificado;
- perfil com `access.users.manage`.

`ready=true` ainda **não** substitui um login real no site.

## 7. Fase B — habilitar multiempresa, sem finalizar legado

Disparar novamente **Deploy production** em `master` com:

- `auth_phase = multi_company`;
- `backup_confirmed = true`;
- `readiness_confirmed = true`.

O workflow deve confirmar:

- sessão anônima informa `authMode=multi_company`;
- tentativa de login por PIN é rejeitada;
- nenhum passo recria o PIN.

A credencial PIN ainda pode existir fisicamente no D1 nessa fase, mas o Worker multiempresa não a aceita. Ela só será removida na finalização.

## 8. Homologação humana obrigatória antes da finalização

Com o novo código ativo, realizar login real no endereço oficial de produção.

### Administrador Mesiva

Confirmar:

- login por e-mail e senha;
- acesso a `/mesiva/empresas`;
- capacidade de listar/cadastrar empresas conforme grants;
- ausência de acesso operacional implícito a empresas sem vínculo.

### Gerente da Amor & Sabor

Confirmar:

- login por e-mail e senha;
- abertura da Amor & Sabor;
- Pedidos;
- Comandas;
- A receber;
- Movimentações;
- Configurações;
- fila/impressão conforme ambiente disponível;
- TV/controle;
- Minha conta;
- troca de empresa, se aplicável.

Se qualquer login ou contexto falhar, **não executar `finalize-legacy`**. Enquanto a finalização não ocorreu, o banco ainda conserva a credencial PIN para um retorno controlado de código à fase anterior, se realmente necessário.

## 9. Finalização irreversível do caminho normal

Somente depois de:

- inventário explicitamente revisado;
- `ready=true`;
- login real do administrador confirmado;
- login real do gerente confirmado;

executar:

```powershell
node scripts/infra/multi-company-production-admin.mjs finalize-legacy --env production --admin-account-id "ADMIN_ACCOUNT_ID" --business-id "amor-e-sabor" --manager-account-id "MANAGER_ACCOUNT_ID" --login-verified --inventory-reviewed
```

A finalização revalida tudo dentro do batch e:

- desativa acessos legados inventariados;
- revoga sessões humanas legadas;
- muda `business_auth_state` para `user_only`;
- remove `auth_credentials` do PIN da Amor & Sabor;
- marca o bootstrap de **production** como finalizado;
- preserva pedidos, clientes, pagamentos, movimentos, histórico e atores antigos;
- não atribui ações históricas às novas contas.

O flag `--inventory-reviewed` é obrigatório em produção. A função não aceita finalização de produção sem ele.

## 10. Depois da finalização

Após `user_only`:

- deploys de produção devem usar `auth_phase = multi_company`;
- o workflow consulta o estado remoto e bloqueia `legacy` ou `prepare`, impedindo recriação acidental do PIN;
- recuperação normal usa o e-mail global;
- recuperação excepcional usa `issue-account-recovery` apenas após prova externa de titularidade e em terminal privado interativo.

Exemplo excepcional:

```powershell
node scripts/infra/multi-company-production-admin.mjs issue-account-recovery --env production --account-id "ACCOUNT_ID" --ownership-verified --show-link-once
```

O link é exibido apenas no canal privado, expira e não deve ser capturado em evidência.

## 11. Retorno

### Antes de `finalize-legacy`

Se o deploy `multi_company` apresentar problema antes da finalização, avaliar retorno ao bundle/fase anterior usando o mesmo snapshot de dados. Não criar outra identidade nem repetir convite incerto sem reconciliação.

### Depois de `finalize-legacy`

Trocar flags não é rollback válido. O workflow bloqueia `legacy/prepare` quando o banco já está `user_only`.

Um retorno pós-finalização exige:

1. interromper novas escritas;
2. avaliar dados criados após o corte;
3. restaurar explicitamente o bookmark/backup compatível do D1 e o bundle correspondente;
4. validar integridade antes de reabrir tráfego.

Nunca recriar PIN manualmente como atalho.

## 12. Evidência de fechamento

Registrar sem segredos:

- SHA de `master`;
- Validate do SHA;
- execução production/prepare;
- resultado de ativação do admin;
- resultado de inspeção de inventário;
- resultado de ativação do gerente;
- `check-ready = true`;
- execução production/multi_company;
- login real admin PASS;
- login real gerente PASS;
- finalização PASS;
- estado `user_only`;
- PIN rejeitado;
- limitações físicas ainda não homologadas, se houver.

