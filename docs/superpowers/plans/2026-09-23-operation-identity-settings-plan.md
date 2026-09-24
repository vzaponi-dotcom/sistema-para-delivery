# Mesiva — Identidade da operação — Implementation Plan

**Data:** 23/09/2026  
**Spec aprovada:** `docs/superpowers/specs/2026-09-23-operation-identity-settings-design.md`  
**Repositório:** `vzaponi-dotcom/sistema-para-delivery`  
**Base aprovada da spec:** `master@75966e5c585c85823e409d5bb7cbb75a557af2fa`  
**Branch documental atual:** `docs/operation-identity-settings`  
**Branch de implementação proposta:** `feature/operation-identity-settings`  
**Status:** **APROVADO pelo usuário em 23/09/2026**; implementação autorizada conforme gates deste plano.  
**Produção:** proibida neste plano até homologação de staging e autorização explícita posterior.

---

## 1. Objetivo de execução

Implementar a tela **Configurações → Identidade da operação** aprovada na spec, preservando a separação:

- **Mesiva** = produto;
- **operação** = estabelecimento;
- `businesses.name` continua sendo a única fonte oficial do nome;
- logo em R2 privado;
- metadados do perfil em D1;
- capabilities `business.profile.view/manage`;
- sem fila offline;
- sem logo em ticket/Kitchen TV nesta V1;
- sem alterar IDs, slugs, D1/Worker names ou histórico.

A execução é estritamente incremental e orientada por TDD.

---

## 2. Regras globais de execução

1. **Nunca trabalhar diretamente na master.**
2. Antes de qualquer implementação, conferir o HEAD remoto de `master` e da branch documental.
3. Se `master` tiver avançado desde `75966e5...`, comparar e reconciliar antes de alterar código.
4. Criar `feature/operation-identity-settings` a partir da documentação aprovada e garantir ancestry limpa da master corrente.
5. Abrir PR **DRAFT** contra `master` antes do primeiro GREEN relevante, para obter evidência remota de RED/GREEN.
6. Cada task comportamental deve ter:
   - RED real e específico;
   - commit RED;
   - Validate remoto mostrando a falha esperada quando a PR estiver aberta;
   - implementação mínima;
   - commit GREEN;
   - Validate remoto no SHA exato.
7. Não empilhar tasks sobre CI quebrado por causa desconhecida.
8. Falhas de harness/teste não contam como RED funcional.
9. Não fazer force-push/rewrite de histórico para “embelezar” TDD.
10. Staging só entra depois dos gates automatizados finais.
11. Produção nunca é executada durante este plano.
12. Merge somente após homologação manual e autorização explícita.
13. Alterações de infraestrutura R2 de **produção** não são executadas nesta implementação; o bucket de produção é pré-requisito posterior de release.

---

## 3. Preparação de execução

Antes da Task 1:

- confirmar:
  - `origin/master`;
  - HEAD de `docs/operation-identity-settings`;
  - spec aprovada;
  - este plano aprovado;
- criar `feature/operation-identity-settings`;
- confirmar que a branch contém somente master + documentação aprovada;
- abrir PR DRAFT;
- registrar no body:
  - base SHA;
  - spec;
  - plano;
  - regra “NO PRODUCTION”;
  - matriz TDD;
  - staging ainda não executado.

### Baseline obrigatório

Executar no SHA inicial da implementação:

```bash
npm test
npm run test:architecture
npm run lint
npm run build
npm run d1:migrate:local
node scripts/infra/spec-b-d1-gate.mjs
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

Se baseline estiver vermelho por regressão já existente, parar e separar o problema.

---

# Task 1 — Migration 0030 e gate D1 do perfil

## Objetivo

Criar `business_profiles` de forma aditiva, com backfill e validação de upgrade 0029 → 0030.

## Arquivos

**Criar**
- `migrations/0030_business_profiles.sql`
- `scripts/infra/operation-profile-d1-gate.mjs`
- testes focados de migration/gate conforme o harness atual

**Modificar**
- `.github/workflows/validate.yml` somente para executar o novo gate depois que ele estiver GREEN.

## RED

Escrever testes/gate exigindo:

- tabela `business_profiles`;
- PK/FK `business_id -> businesses(id)`;
- revision;
- contato/endereço;
- metadados de logo;
- backfill de todo business existente;
- `businesses.name` intocado;
- upgrade a partir de migrations até 0029;
- clean install;
- foreign keys válidas.

Rodar o foco antes de criar 0030 e comprovar falha por ausência da tabela/migration.

## GREEN

Criar 0030.

Contrato mínimo:

- `revision >= 1`;
- textos opcionais como `NOT NULL DEFAULT ''`;
- logo nullable;
- timestamps válidos;
- `INSERT ... SELECT` para todos os negócios existentes;
- nenhum UPDATE de `businesses.id/slug/name`.

O novo gate deve usar banco temporário isolado, como os gates de infraestrutura existentes, e não tocar D1 remoto.

## Gates

- foco migration;
- `npm run d1:migrate:local`;
- `node scripts/infra/operation-profile-d1-gate.mjs`;
- gate Spec B existente.

## Critério de conclusão

Clean + upgrade GREEN sem alteração de dados históricos.

---

# Task 2 — Validação pura e repository D1

## Objetivo

Criar o domínio do perfil sem R2/HTTP.

## Arquivos

**Criar**
- `shared/businessProfile.js`
- `shared/businessProfile.test.js`
- `worker/businessProfileRepository.js`
- `worker/businessProfileRepository.test.js`

**Modificar**
- test-support D1 somente se necessário, preservando owners existentes.

## RED

Cobrir:

### Parser
- nome obrigatório;
- trim;
- máximo 120;
- controle rejeitado;
- telefone até 32;
- limites de endereço;
- UF vazia ou 2 letras e uppercase;
- CEP vazio ou 8 dígitos;
- campos extras rejeitados.

### Read
- perfil backfilled;
- ausência legítima => revision 0 + defaults;
- inconsistência parcial => `BUSINESS_PROFILE_UNAVAILABLE`;
- resposta pública não vaza `logo_object_key`, hash ou metadata privada.

### Save D1
Criar uma função repository que recebe **metadados de logo já resolvidos pelo serviço**, sem falar com R2.

Cobrir:
- initialize revision 0;
- update revision;
- nome + perfil + receipt no mesmo batch;
- nome altera `businesses.name` mas não `slug`;
- no-op não incrementa revisão;
- conflito;
- replay do mesmo mutationId;
- mutationId com payload diferente;
- isolamento de businessId;
- failure/unconfirmed sem retry automático.

## GREEN

Implementar parsing e repository utilizando:

- `settings_mutation_receipts`;
- `settings_tx_assertions`;
- padrão de hash/revision das settings atuais;
- resource key `businessProfile`.

Não criar rota HTTP nesta task.

## Critério de conclusão

Repository puro GREEN e rastreável, sem R2.

---

# Task 3 — Capabilities e contrato administrativo de leitura

## Objetivo

Integrar o recurso ao modelo de acesso existente antes de habilitar mutação/upload.

## Arquivos

**Modificar**
- `shared/settingsAccess.js`
- `worker/settingsAccess.js` se necessário ao resolver concessão ampla
- `worker/settingsApi.js`
- testes de access/settings API

**Criar**
- `worker/businessProfileApi.js` ou owner equivalente específico
- testes focados HTTP

## RED

Exigir:

- `business.profile.view`;
- `business.profile.manage`;
- manage implica view;
- sessão ampla single-tenant recebe as novas capabilities;
- GET `/api/settings/business-profile`:
  - 200 com view;
  - 403 sem view;
  - businessId sempre da sessão;
  - não expõe chaves internas;
- receipt `businessProfile` exige manage;
- recurso inválido continua rejeitado.

## GREEN

Adicionar capabilities e GET administrativo.

Adicionar ao `receiptCapability`:

```text
businessProfile -> business.profile.manage
```

Ainda não implementar o PUT multipart nesta task.

## Critério de conclusão

Leitura e authorization GREEN sem qualquer upload.

---

# Task 4 — Storage R2 e validação binária de logo

## Objetivo

Implementar o componente de storage isolado, sem acoplar a UI.

## Arquivos

**Criar**
- `worker/businessLogoStorage.js`
- `worker/businessLogoStorage.test.js`

**Modificar**
- nenhuma rota pública ainda.

## RED

Fake R2 deve cobrir:

- máximo 1 MiB;
- WebP válido;
- PNG/JPEG válidos se o servidor receber formato aceito;
- assinatura incompatível com MIME rejeitada;
- SVG/GIF/arquivo arbitrário rejeitados;
- chave gerada pelo Worker;
- chave nunca recebida do cliente;
- `httpMetadata.contentType`;
- SHA-256;
- get por chave interna;
- delete best effort;
- bucket ausente => erro funcional;
- nenhuma operação de outro business por parâmetro público.

## GREEN

Criar uma API interna estreita:

```text
validateBusinessLogo(bytes, contentType)
storeBusinessLogo(bucket, businessId, logo)
readBusinessLogo(bucket, key)
deleteBusinessLogo(bucket, key)
```

A geração da chave deve usar UUID opaco.

## Critério de conclusão

Storage unitário GREEN, ainda sem alterar D1/routes.

---

# Task 5 — PUT multipart, compensação R2↔D1 e GET do logo

## Objetivo

Fechar o backend completo da feature.

## Arquivos

**Modificar**
- `worker/businessProfileApi.js`
- `worker/index.js`
- `worker/settingsApi.js` somente onde o roteamento/receipt exigir
- `worker/businessProfileRepository.js`

**Criar/expandir**
- `worker/businessProfileApi.test.js`
- `worker/businessLogoHttp.test.js`

## RED

### PUT
Exigir:

- `PUT /api/settings/business-profile`;
- `multipart/form-data`;
- parte `payload`;
- parte `logo` somente para replace;
- same-origin;
- manage;
- payload extra/businessId rejeitado como autoridade;
- `keep/replace/remove`;
- replace sem arquivo rejeita;
- keep com arquivo rejeita;
- remove com arquivo rejeita.

### Compensação
- upload R2 antes do commit D1;
- sucesso D1 => old object cleanup best effort;
- D1 failure => new object cleanup best effort;
- remove => commit D1 antes de cleanup antigo;
- cleanup antigo falhando não desfaz commit;
- no-op hash igual + dados iguais sem revisão extra;
- conflito não sobrescreve.

### Resultado incerto
- repository/HTTP não auto-reenvia;
- receipt confirma;
- reuse incompatível rejeita.

### GET logo
`GET /api/business/logo`:
- exige sessão;
- não exige capability administrativa;
- 404 sem logo;
- bytes corretos;
- content-type;
- ETag;
- cache private;
- sem businessId query authority.

## GREEN

Implementar o service orchestration.

Não transformar `settingsApi.js` em parser genérico multipart. O owner de Business Profile pode ser específico.

## Critério de conclusão

Backend completo GREEN com R2 fake, sem binding real ainda.

---

# Task 6 — Bootstrap seguro e invariantes de impressão

## Objetivo

Propagar somente nome + presença/versão de logo ao runtime global.

## Arquivos

**Modificar**
- `worker/repositories.js`
- testes de bootstrap
- testes de print document/reprint somente para caracterização da invariância.

## RED

Exigir bootstrap:

```json
business: {
  id,
  name,
  hasLogo,
  logoVersion
}
```

Sem telefone/endereço/chave/hash.

Cobrir:

- sem logo;
- com logo;
- nome atualizado;
- outro business isolado.

Caracterizar impressão:

- novo documento gerado após rename usa nome atual;
- snapshot de print job já criado permanece igual;
- logo não entra no ESC/POS/PDF;
- telefone/endereço não entram no ticket.

## GREEN

Expandir `loadBootstrap` com join/projeção mínima de `business_profiles`.

Não tocar layout de impressão.

## Critério de conclusão

Bootstrap seguro GREEN e impressão sem regressão.

---

# Task 7 — Infra frontend: adapter multipart, normalização e attachment transient

## Objetivo

Integrar Business Profile ao owner genérico de Policy Editing sem colocar Blob/base64 no draft persistido.

## Arquivos

**Criar**
- `src/app/surfaces/settings/business-profile/businessProfilePolicy.js`
- `src/app/surfaces/settings/business-profile/businessLogoImage.js`
- testes focados

**Modificar**
- `src/app/surfaces/settings/policies/registry.js`
- `src/app/surfaces/settings/SettingsPolicyBoundary.jsx`
- `src/app/policy-editing/policyEditingController.js`
- `src/app/policy-editing/PolicyEditingProvider.jsx`
- testes do controller/provider/registry

## Arquitetura obrigatória

Não guardar Blob/File dentro de:

- resource draft serializado;
- sessionStorage;
- pending pointer;
- conflict payload persistido.

Adicionar um seam mínimo e genérico para **transient save attachment**:

```text
save(resource, scopeId, transient)
  -> controller
  -> transport.save(resource, input, scopeId, transient)
  -> adapter específico
```

O controller:

- não clona o transient;
- não serializa;
- não inclui bytes em hash/storage;
- não guarda transient em resources;
- continua gravando pending pointer apenas com mutationId/hash/start/context;
- nunca reutiliza transient em auto retry porque auto retry não existe.

O estado plain-data do Business Profile deve carregar uma intenção serializável para o logo, normalizada pelo adapter, suficiente para dirty/conflict, mas nunca os bytes.

Sugestão do adapter:

- load/saved resource acrescenta localmente `logoAction: 'keep'`;
- selecionar novo logo altera draft para:
  - `logoAction: 'replace'`;
  - `logo.present = true`;
  - `logo.version = 'local:<sha256>'`;
- remover:
  - `logoAction = 'remove'`;
  - `logo.present = false`;
  - `logo.version = null`;
- adapter remove `logoAction`/token local do JSON enviado e monta o payload normativo;
- replace exige `transient.logoBlob` cujo SHA corresponde ao token.

Isso permite que o conflict engine atual detecte concorrência do logo sem serializar arquivo.

## RED — imagem

Cobrir normalização em browser:

- PNG/JPEG/WebP aceitos;
- formato inválido;
- decode failure;
- maior lado <= 1024;
- proporção preservada;
- saída WebP;
- <= 1 MiB;
- SHA-256;
- object URL revogado quando substituído/desmontado.

Evitar depender de canvas real no Node: isolar decoder/canvas/export por injeção para teste determinístico.

## RED — controller

Cobrir:

- transient chega somente ao adapter;
- não entra no pending storage;
- não entra em resources;
- unknown result não auto-reenvia transient;
- discard/reset não deixa efeito persistido;
- demais policies JSON continuam byte/behavior equivalent.

## GREEN

Implementar seam mínimo e adapter multipart.

## Critério de conclusão

Policy Editing continua único owner de save/conflict/reconcile; Blob permanece efêmero.

---

# Task 8 — Navegação, card e tela Identidade da operação

## Objetivo

Entregar a UI completa sem ainda alterar o shell global.

## Arquivos

**Modificar**
- `src/app/navigation/registry.js`
- `src/App.jsx` — `IMPLEMENTED_DESTINATIONS`
- `src/app/surfaces/settings/SettingsHome.jsx`
- `src/app/surfaces/settings/SettingsSurface.jsx`
- `src/app/surfaces/settings/policies/navigation.js` se necessário
- testes de navegação/settings

**Criar**
- `src/app/surfaces/settings/business-profile/BusinessProfileSettings.jsx`
- CSS específico no owner de settings
- testes renderizados

## RED — navegação

Exigir:

- destino `settings-business-profile`;
- path `/configuracoes/identidade`;
- settings-home inclui view capability;
- card primeiro;
- card omitido sem view;
- direct deep link autorizado;
- direct deep link negado;
- mobile Mais continua apontando para Configurações, sem item global novo.

## RED — tela

Cobrir:

- loading;
- error;
- ready;
- read-only;
- dirty;
- saving;
- unconfirmed;
- conflict;
- name validation;
- telefone;
- endereço;
- UF/CEP;
- prévia;
- selecionar logo;
- trocar logo;
- remover;
- cancelar restaura estado confirmado;
- nenhum upload no file-select;
- save passa blob transient;
- botão remover ausente em read-only;
- footer padrão;
- sem footer de versão.

## GREEN

Compor a tela usando `SettingsEditorShell`.

Layout:

- Identidade;
- Contato;
- Endereço;
- Prévia.

Desktop responsivo; mobile 1 coluna.

## Critério de conclusão

Tela funcional completa dentro de Configurações.

---

# Task 9 — Shell: logo desktop, menu mobile e atualização sem F5

## Objetivo

Aplicar a identidade confirmada ao shell sem trocar a marca Mesiva.

## Arquivos

**Modificar**
- `src/app/shell/AppShell.jsx`
- `src/app/shell/AppTopBar.jsx`
- `src/app/shell/OperationMenu.jsx`
- CSS da top bar/menu
- `src/App.jsx`
- `src/app/runtime/data/useOperationalDataRuntime.js` ou seam oficial equivalente
- testes shell/runtime

**Criar**
- pequeno componente de logo operacional se a composição justificar, sem biblioteca genérica de mídia.

## RED

Desktop:

- com logo => logo da operação;
- sem logo => ícone atual;
- nome do negócio continua texto principal.

Mobile:

- “Mesiva” continua título do produto;
- gatilho da operação mostra logo quando houver;
- sem logo => iniciais;
- heading do popover mantém nome da operação.

Pós-save:

- save confirmado atualiza `business.name/hasLogo/logoVersion` sem F5;
- não aplica draft antes da confirmação;
- conflito/erro não altera shell;
- logout/login não ressuscita draft/logo local.

## GREEN

Após `onPolicyCommitted` do `businessProfile`, atualizar o owner oficial via refresh bootstrap silencioso ou patch oficial equivalente.

Não criar store paralelo.

## Critério de conclusão

Nome/logo confirmados refletem no shell imediatamente, mantendo Mesiva no mobile/login.

---

# Task 10 — Conflito, offline, abandonment e lifecycle de preview

## Objetivo

Fechar os casos difíceis de estado.

## Arquivos

- testes cross-cutting de Settings/Policy Editing/Business Profile;
- ajustes mínimos nos owners existentes.

## RED

Cobrir:

### Conflito
- A/B revision;
- A salva;
- B conflito;
- draft B preservado;
- diferenças de nome/endereço;
- diferença de logo;
- resolver escolhendo current;
- resolver escolhendo draft;
- blob local só é reutilizado quando a escolha final ainda aponta para `local:<sha>`.

### Offline
- preview local funciona;
- save bloqueado pelo write guard;
- nenhuma fila local;
- nenhum sucesso falso.

### Abandono
- dirty profile participa do guard de navegação;
- logo selecionado torna a edição dirty pelo estado plain-data;
- discard revoga object URL e limpa transient;
- beforeunload continua padrão existente;
- unconfirmed impede discard conforme owner atual.

### Sessão/contexto
- troca de sessão limpa transient/preview;
- business A nunca usa Blob/intenção de business B.

## GREEN

Ajustes mínimos; não criar novo sistema de guarda.

## Critério de conclusão

Todos os estados de recuperação/conflito seguem o padrão existente.

---

# Task 11 — Wrangler R2, regressões de infraestrutura e gates finais

## Objetivo

Adicionar bindings declarativos e validar isolamento de ambientes sem tocar bucket remoto.

## Arquivos

**Modificar**
- `wrangler.jsonc`
- testes de production safety/infra
- `.github/workflows/validate.yml`
- `.github/workflows/deploy-staging.yml` apenas nos checks/deep links necessários

**Possível criar**
- teste/script de invariantes R2.

## RED

Exigir:

produção:
```text
binding = BUSINESS_ASSETS
bucket_name = mesiva-business-assets
```

staging:
```text
binding = BUSINESS_ASSETS
bucket_name = mesiva-business-assets-staging
```

E garantir:

- nomes diferentes;
- staging nunca referencia bucket prod;
- dry-run production;
- dry-run staging;
- deep link `/configuracoes/identidade` no smoke de staging;
- migration gate 0030 no Validate.

## GREEN

Adicionar `r2_buckets`.

Não executar `r2 bucket create` para produção.

### Gate automático final

```bash
npm test
npm run test:architecture
npm run lint
npm run build
npm run d1:migrate:local
node scripts/infra/spec-b-d1-gate.mjs
node scripts/infra/operation-profile-d1-gate.mjs
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

## Critério de conclusão

PR inteira GREEN no SHA executável final.

---

# Task 12 — Preparação e deploy de staging

## Pré-requisito humano/infra

Antes de deploy, deve existir **somente o bucket de staging**:

```text
mesiva-business-assets-staging
```

O bucket de produção não é necessário para homologar e não deve ser criado por conveniência.

Como não há automação de criação de bucket aprovada nesta spec, a criação do bucket de staging é um checkpoint explícito de infraestrutura.

## Antes do deploy

Confirmar:

- PR DRAFT;
- último Validate GREEN;
- zero migrations remotas de produção;
- bucket staging correto;
- binding staging correto;
- nenhuma credencial pública;
- staging D1 é `amor-e-sabor-delivery-staging`.

## Deploy

Usar o workflow oficial **Deploy staging**, por `workflow_dispatch` no branch exato ou por mecanismo aprovado do repositório.

Não reusar/retargetar silenciosamente produção.

Registrar:

- run ID;
- SHA;
- migration 0030 aplicada no staging;
- Worker version;
- login smoke;
- deep-link smoke;
- URL.

## Critério de conclusão

Staging disponível no SHA exato da implementação.

---

# Task 13 — Homologação manual

Executar a matriz da spec §24.

Registrar cada item como:

```text
PASS
FAIL
BLOCKED
```

Nunca converter impossibilidade de teste em PASS.

### Núcleo obrigatório

1. card/rota;
2. nome;
3. save sem F5;
4. cross-device refresh/focus;
5. PNG/JPG/WebP;
6. preview + Cancelar;
7. replace;
8. remove;
9. fallback;
10. telefone/endereço;
11. conflito;
12. offline;
13. desktop claro/escuro;
14. mobile claro/escuro;
15. Clássico/Mesiva;
16. login Mesiva;
17. Kitchen TV;
18. ticket novo usa novo nome;
19. snapshot anterior imutável;
20. logout/login;
21. capability restrita ou BLOCKED documentado.

Qualquer FAIL bloqueia fechamento.

---

# Task 14 — Fechamento documental e preparação de merge

## Objetivo

Fechar evidências sem mudar comportamento.

## Arquivos

**Criar**
- `docs/superpowers/qa/operation-identity-settings-qa.md`

**Atualizar se necessário**
- PR body;
- runbooks/ledger apenas quando houver referência normativa real.

## Conteúdo obrigatório

- base;
- commits RED/GREEN por task;
- Validate runs;
- staging run;
- migration;
- R2 staging;
- matriz manual;
- BLOCKEDs;
- ausência de produção.

### Gates após docs

Rodar Validate final no SHA documental.

Se docs forem único diff após SHA homologado, registrar separadamente:

- último SHA **executável** homologado;
- SHA **documental final** que o contém.

## Stop condition

Ao concluir:

- PR pode sair de DRAFT somente se tudo estiver GREEN;
- **não fazer merge automaticamente**;
- pedir autorização explícita.

---

## 4. Matriz resumida de tasks

| Task | Entrega | D1 | R2 | UI | Staging |
|---|---|---:|---:|---:|---:|
| 1 | migration/gate | ✅ | — | — | — |
| 2 | parser/repository | ✅ | — | — | — |
| 3 | capabilities/GET | ✅ | — | — | — |
| 4 | storage logo | — | fake | — | — |
| 5 | multipart/logo API | ✅ | fake | — | — |
| 6 | bootstrap/print invariants | ✅ | — | runtime | — |
| 7 | adapter/image/transient | — | — | infra | — |
| 8 | Settings UI | — | — | ✅ | — |
| 9 | shell/sync | — | leitura | ✅ | — |
| 10 | conflito/offline | — | — | ✅ | — |
| 11 | bindings/gates | local | config | — | — |
| 12 | deploy staging | staging | staging | — | ✅ |
| 13 | homologação | staging | staging | ✅ | ✅ |
| 14 | closure | — | — | docs | — |

---

## 5. Critérios de arquitetura

A implementação final deve satisfazer todos:

- nenhum base64 de logo em D1;
- nenhum bucket público;
- nenhum Blob no pending storage;
- nenhum store paralelo para business;
- nenhum segundo `display_name`;
- businessId não vem do cliente como autoridade;
- R2 key não sai na API;
- frontend não importa Worker internals;
- Worker não conhece componente React;
- Settings continua dono da edição administrativa;
- runtime continua dono do business oficial;
- shell consome somente projeção oficial;
- impressão mantém snapshots;
- Kitchen TV não ganha capability administrativa;
- tema continua local.

---

## 6. Auto-revisão do plano

### Escopo

- [x] cobre somente a spec aprovada;
- [x] CNPJ/fiscal/horários continuam fora;
- [x] logo de ticket/Kitchen TV continua fora;
- [x] não renomeia infra histórica.

### Persistência

- [x] migration aditiva;
- [x] backfill;
- [x] upgrade 0029→0030;
- [x] nome segue em `businesses`;
- [x] profile separado;
- [x] revision/receipt/conflito.

### R2

- [x] staging/prod isolados;
- [x] private;
- [x] key server-side;
- [x] compensação sem falsa atomicidade;
- [x] production bucket não é criado durante implementação.

### Frontend

- [x] preview antes de save;
- [x] bytes não entram em state/pending serializável;
- [x] seam transient explícito;
- [x] conflito de logo continua detectável via metadata plain-data;
- [x] mobile preserva Mesiva;
- [x] desktop ganha identidade operacional.

### TDD

- [x] cada task comportamental tem RED;
- [x] RED de harness não vale;
- [x] GREEN remoto por SHA;
- [x] gates completos;
- [x] staging posterior;
- [x] homologação posterior;
- [x] merge somente autorizado.

### Riscos explicitamente tratados

1. **R2 + D1 sem transação distribuída** → compensação.
2. **Blob não serializável no controller** → transient save seam.
3. **resultado incerto de multipart** → receipt, sem auto retry.
4. **rename afetar snapshots** → somente documentos novos usam nome novo.
5. **branding Mesiva vs operação** → mobile/login Mesiva; operação separada.
6. **ambiente** → bucket staging/prod distinto e checks.
7. **capability staging indisponível** → BLOCKED permitido, nunca PASS fictício.

Não foi identificado blocker arquitetural que exija alterar a spec antes de iniciar a execução.

---

## 7. Gate de aprovação

Este arquivo é **somente plano**.

Após este commit:

- não criar migration;
- não criar bucket;
- não criar branch de implementação;
- não abrir PR de implementação;
- não alterar código;
- não deployar staging;
- não deployar produção.

Aguardar aprovação explícita do usuário.

Após aprovação, executar **Preparação de execução + Task 1 somente** e parar para reportar a evidência antes de avançar, salvo autorização posterior para agrupar tasks.


---

## 8. Aprovação do plano

O plano foi aprovado explicitamente pelo responsável do produto em 23/09/2026.

A aprovação autoriza iniciar **Preparação de execução + Task 1 somente**, conforme o gate final deste documento. Não autoriza produção, merge ou avanço automático para Tasks 2+.
