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

O caminho normal de produção é o workflow manual **Prepare Mesiva administrator** no GitHub Actions. Ele existe somente para o bootstrap do primeiro administrador da plataforma e não cria perfil Gerente/Operador nem vínculo com empresa.

Disparar em `master` preenchendo:

- `admin_name`: nome de exibição do Administrador Mesiva;
- `admin_email`: e-mail controlado pelo Administrador Mesiva;
- `ownership_confirmed = true`: confirmação explícita de titularidade e autorização da conta de plataforma.

Antes de gravar a conta, o workflow:

1. confirma que o SHA disparado ainda é o último `master`;
2. valida os secrets/variables do Environment `production`;
3. registra um bookmark atual do D1 Time Travel;
4. executa novamente o smoke de `prepare`, incluindo continuidade do PIN legado e disponibilidade dos endpoints de ativação;
5. acessa o D1 de produção pela API REST oficial da Cloudflare com timeout e configuração derivada do `wrangler.jsonc`, sem `getPlatformProxy`;
6. executa o mesmo `preparePlatformAdministrator` usado pelo procedimento administrativo oficial;
7. exige que a entrega pelo Resend seja aceita, salvo quando a conta já estiver ativada.

O destinatário abre o link de ativação recebido em `AUTH_PUBLIC_ORIGIN`, confirma o e-mail e define a própria senha. A ativação não cria sessão automaticamente.

A conta criada tem somente concessões explícitas de plataforma Mesiva. Ela não recebe acesso operacional implícito à Amor & Sabor ou a qualquer outra empresa.

Repetir a preparação para a mesma identidade não pode sobrescrever uma credencial ativa. Um e-mail diferente não substitui silenciosamente o administrador já registrado para o bootstrap de produção.

### Fallback administrativo

A CLI privada abaixo permanece apenas como contingência operacional quando o workflow não puder ser usado. Ela exige injeção segura das mesmas credenciais no terminal:

```powershell
node scripts/infra/multi-company-production-admin.mjs prepare-admin --env production --name "NOME_ADMIN" --email "EMAIL_ADMIN" --ownership-verified
```

Não copiar secrets do GitHub para o chat nem persistir credenciais em arquivo local.

## 4. Inspecionar o inventário legado de produção

O caminho normal é o workflow manual **Manage production cutover** no GitHub Actions, em `master`, com:

- `cutover_action = inspect_inventory`;
- `ownership_confirmed = false`.

O workflow resolve internamente o Administrador Mesiva registrado no bootstrap e publica apenas agregados não sensíveis no resumo do run: quantidade de registros inventariados, quantidade ativa e se todos pertencem à Amor & Sabor. Nome, e-mail, ID humano e segredo não são publicados no CI.

Se o inventário apontar outra empresa, o procedimento falha fechado e o corte deve ser interrompido.

A CLI privada `inspect-inventory` permanece somente como fallback quando uma revisão nominal for indispensável em terminal privado.

**Regra de produção:** o preparo do gerente não renomeia silenciosamente um login legado conflitante. Se existir colisão com o e-mail escolhido, o batch falha e nenhum novo acesso é persistido. Nesse caso, interromper e decidir a migração daquela identidade antes de continuar.

## 5. Preparar o gerente da empresa existente

Antes de executar o workflow, configurar temporariamente no Environment `production` dois secrets:

- `CUTOVER_MANAGER_NAME`: nome do primeiro gerente da Amor & Sabor;
- `CUTOVER_MANAGER_EMAIL`: e-mail controlado por essa pessoa.

Não usar inputs públicos do workflow para esses dados.

Depois disparar **Manage production cutover** com:

- `cutover_action = prepare_business_manager`;
- `ownership_confirmed = true`.

O workflow registra um bookmark atual do D1, reconfirma que produção continua em `prepare`, revalida o inventário e executa o mesmo `prepareExistingBusinessManager` oficial. Se o gerente ainda não tiver conta global ativa, o Resend deve aceitar o convite. Nenhum acesso legado é finalizado nessa etapa.

É permitido usar a mesma conta do Administrador Mesiva, mas para produção normal a recomendação é manter a conta de plataforma separada da conta operacional do cliente.

Depois que o gerente ativar o convite e definir sua senha, manter os dois secrets até concluir o readiness; em seguida eles podem ser removidos do Environment `production`.

## 6. Readiness antes do corte

Disparar **Manage production cutover** com:

- `cutover_action = check_ready`;
- `ownership_confirmed = false`.

O workflow resolve internamente o administrador do bootstrap e a conta do gerente pelo e-mail armazenado no secret, sem publicar seus identificadores. Só continuar quando o resumo informar `Ready: true`.

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

