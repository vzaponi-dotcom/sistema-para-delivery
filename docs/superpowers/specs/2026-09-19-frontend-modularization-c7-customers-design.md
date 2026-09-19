# Spec C7 — Customers

**Data:** 2026-09-19  
**Status:** **APPROVED** — design consolidado, autorrevisado e aprovado explicitamente pelo usuário em 2026-09-19  
**Branch:** `feature/spec-c7-customers`  
**Base:** `master` em `5b101800fe29d02dd4543e184cca9e06d659a445`  
**Base validation:** Validate application #1392 / run `35448223721` — SUCCESS  
**Produção:** não tocar nesta slice sem autorização separada

## 1. Objetivo

A C7 estabelece `customers` como domínio explícito do frontend e remove de `App.jsx` o ownership de CRUD, edição e orquestração de duplicidade de clientes.

A slice deve:

- criar um boundary público em `src/domains/customers/`;
- tornar Customers owner da UI de Clientes, edição/cadastro, regras frontend de duplicidade e API de clientes;
- remover do `App.jsx` estados, refs e handlers de CRUD/edição/duplicidade de clientes;
- retirar `createClient`, `updateClient` e `deleteClient` do `src/api/client.js`;
- preservar o quick-create de cliente dentro de Novo Pedido sem transferir infraestrutura de Customers para Orders;
- preservar o contrato cross-runtime usado pelo Worker para normalização de telefone;
- eliminar o uso customer-specific de `updateCollection` por meio de efeito oficial explícito de exclusão;
- reforçar os architecture gates para impedir retorno dos owners legados;
- preservar integralmente comportamento, UX, visual, capabilities, offline e contratos do Worker.

A C7 é uma refatoração arquitetural. Ela não adiciona CRM, histórico de compras, endereço estruturado, tags, fidelidade, múltiplos telefones ou qualquer nova feature de relacionamento.

## 2. Resultado esperado

Ao final da C7:

1. `src/domains/customers` é o owner frontend de regras de duplicidade, comandos, API e UI de clientes;
2. `App.jsx` não contém formulário, modal, duplicate flow nem handlers CRUD de clientes;
3. `src/pages/Clients.jsx` e `src/components/ClientDuplicateModal.jsx` deixam de ser owners de produção;
4. `src/api/client.js` não exporta APIs de clientes;
5. o quick-create de Novo Pedido continua funcionando através de contrato público de Customers e composição por injeção;
6. Orders não importa infraestrutura nem internals de Customers;
7. Customers não importa internals de Orders;
8. exclusão de cliente usa efeito oficial explícito no runtime em vez de `updateCollection('clients', ...)`;
9. o contrato `shared/clientIdentity.js` necessário ao Worker permanece válido e documentado como compartilhamento cross-runtime, não como facade temporária;
10. todas as regras e experiências existentes permanecem observacionalmente equivalentes.

## 3. Base técnica validada

A base da C7 é o merge da C6:

`5b101800fe29d02dd4543e184cca9e06d659a445`

O merge foi produzido pelo PR #50.

Evidência:

- final exact-head C6 Validate: #1391 / run `35448041000` — SUCCESS em `d59fe0d804ec77de02fd0f34e1342e3189e35339`;
- merge PR #50: `5b101800fe29d02dd4543e184cca9e06d659a445`;
- post-merge Validate em `master`: #1392 / run `35448223721` — SUCCESS;
- produção não foi implantada pela C6.

A C7 deve partir exatamente dessa `master`, salvo reconciliação posterior explicitamente registrada.

## 4. Restrições globais

A C7 deve preservar as regras gerais da Spec C:

- não implementar diretamente em `master`;
- trabalhar em `feature/spec-c7-customers`;
- TDD RED → GREEN para extrações e mudanças de ownership;
- backend/bootstrap continuam fonte de verdade;
- não criar store oficial independente para clientes;
- polling/sync global permanecem como estão;
- não introduzir Redux, Zustand, React Router, WebSocket/SSE ou microserviços;
- não redesenhar Clientes nem Novo Pedido;
- não alterar regras de cadastro, edição, exclusão ou duplicidade;
- não antecipar C8, C9 ou C10;
- produção somente mediante autorização explícita separada.

## 5. Ownership do domínio Customers

Customers é dono, no frontend, de:

- lista e apresentação de clientes;
- busca e ordenação específicas da tela Clientes;
- cadastro de cliente;
- edição de cliente;
- exclusão de cliente;
- regras frontend de detecção de duplicidade por nome e telefone;
- fluxo "usar cliente existente";
- fluxo "cadastrar mesmo assim" para duplicidade apenas por nome;
- API frontend de clientes;
- comandos de mutação de clientes;
- editor/modal de cliente;
- duplicate modal;
- contratos públicos necessários a outras áreas, em especial Novo Pedido.

Customers não é dono de:

- lifecycle de pedidos;
- identidade de pedido `registered_client | guest_name | table`;
- regras de mesa/comanda;
- pagamentos;
- cadastro de produtos;
- sessão/auth/capabilities;
- runtime/bootstrap;
- navegação global;
- feedback global.

## 6. Estado atual na base C7

Na base validada:

### 6.1 UI

- `src/pages/Clients.jsx` possui lista, busca, ordenação, action sheet, edição/exclusão por intent e estados locais do action sheet;
- `src/components/ClientDuplicateModal.jsx` possui a apresentação do conflito por nome;
- formulário de criar/editar cliente ainda está inline em `App.jsx`.

### 6.2 App ownership

`App.jsx` ainda possui:

- `newClient`;
- `editingClientId`;
- `showClientForm`;
- `duplicateClientDialog`;
- `validateClientIdentity`;
- `handleQuickCreateClient`;
- `resetClientForm`;
- `openNewClient`;
- `handleEditClient`;
- `clientPayload`;
- `persistNewClient`;
- `persistClientUpdate`;
- `handleAddClient`;
- `handleSaveClient`;
- `handleUseExistingClient`;
- `handleConfirmDuplicateClient`;
- `handleDeleteClient`;
- `handleCancelClientEdit`.

Esses são debts explícitos da C7.

### 6.3 API legado

`src/api/client.js` ainda exporta:

- `createClient`;
- `updateClient`;
- `deleteClient`.

Esses exports devem desaparecer na C7.

### 6.4 Duplicate helper atual

`shared/clientIdentity.js` contém:

- `normalizeClientName`;
- `normalizeClientPhone`;
- `formatClientPhone`;
- `findClientDuplicates`.

Entretanto, esse arquivo também é importado pelo Worker para normalização/formatação de telefone e suporte à unicidade persistida.

Logo, ele não pode ser tratado como um simples owner frontend a mover integralmente.

## 7. Regra cross-runtime para identidade de cliente

A Spec C permite manter módulos fora de `src` quando eles são realmente compartilhados com o Worker.

C7 formaliza essa exceção.

### 7.1 Contrato que permanece compartilhado

`shared/clientIdentity.js` pode continuar contendo as primitivas puras necessárias a frontend e Worker, especialmente:

- `normalizeClientPhone`;
- `formatClientPhone`.

Na base C7 auditada, o Worker consome `shared/clientIdentity.js` somente para `normalizeClientPhone` e `formatClientPhone`. Portanto:

- `normalizeClientPhone` e `formatClientPhone` permanecem no módulo cross-runtime compartilhado;
- `normalizeClientName` passa a Customers, pois não há consumidor backend/Worker atual que justifique mantê-la em `shared`;
- qualquer desvio dessa decisão durante implementação exige prova de um consumidor cross-runtime real, não conveniência de import.

### 7.2 Regra que pertence a Customers

`findClientDuplicates` expressa uma decisão de UX/frontend sobre a coleção de clientes carregada e deve passar a ter owner em:

`src/domains/customers/domain/`

Ela deve usar `normalizeClientName` owned por Customers e pode consumir `normalizeClientPhone` do contrato cross-runtime compartilhado.

### 7.3 Worker

O Worker continua responsável por autoridade persistida de telefone único.

C7 não muda:

- `worker/repositories.js`;
- `worker/clientUniqueness.test.js`;
- migrations;
- schema;
- códigos de erro de backend.

A validação frontend melhora UX, mas não substitui a garantia backend.

## 8. Semântica de duplicidade

A C7 deve preservar exatamente a semântica atual.

### 8.1 Telefone duplicado

Quando o telefone normalizado já pertence a outro cliente:

- criação é bloqueada;
- edição para o telefone de outro cliente é bloqueada;
- editar mantendo o próprio telefone continua permitido;
- o usuário recebe feedback contendo o nome do cliente existente;
- não existe opção "cadastrar mesmo assim" para telefone duplicado.

O backend permanece autoridade e pode retornar `409 CLIENT_PHONE_EXISTS`.

### 8.2 Nome duplicado

Quando o nome normalizado coincide com outro cliente:

- abrir o modal in-app;
- mostrar o cliente encontrado;
- oferecer:
  - Cancelar;
  - Usar cliente existente;
  - Cadastrar mesmo assim.

Nome duplicado não é uma restrição persistida de unicidade.

### 8.3 Normalização

Preservar:

- trim;
- colapso de espaços;
- comparação case-insensitive;
- comparação de nome sem diacríticos;
- telefone somente por dígitos normalizados;
- remoção do prefixo Brasil `55` quando aplicável;
- limite atual de 11 dígitos;
- telefone vazio não conta como duplicidade.

### 8.4 Exclusão na edição

Ao editar um cliente, o próprio `id` deve ser excluído da busca por duplicidade.

## 9. Estrutura alvo

Estrutura conceitual:

```text
src/
  domains/
    customers/
      domain/
        clientDuplicates.js
      application/
        useCustomerCommands.js
        useCustomerEditor.js
      infrastructure/
        customersApi.js
      ui/
        Clients.jsx
        ClientDuplicateModal.jsx
        CustomerEditorDialog.jsx
        CustomersWorkspace.jsx
      index.js
```

Arquivos de teste acompanham seus owners.

A estrutura exata pode ser simplificada no plano se o import graph provar que menos arquivos mantêm o mesmo boundary com maior clareza.

Não criar uma `app/surfaces/customers` apenas por simetria. Clientes é uma superfície single-domain e pode ser exposta por um `CustomersWorkspace` público diretamente ao App.

## 10. Public contract de Customers

O `index.js` deve expor apenas contratos realmente consumidos externamente.

Candidatos:

- `CustomersWorkspace`;
- regra pública de detecção de duplicidade necessária por Novo Pedido;
- hook/comando público mínimo necessário para quick-create;
- `ClientDuplicateModal`, porque Novo Pedido é um consumidor externo real dessa UI customer-specific;
- eventualmente formatação/identity projection somente se existir consumidor real.

Como os testes Node carregam os public entries dos domínios, exports públicos de UI devem seguir o padrão Node-safe já estabelecido por Orders/Table Service/Finance (`*.js` surface wrapper com carregamento do JSX), se a exportação direta de `.jsx` quebrar o harness.

Não reexportar:

- API HTTP diretamente se apenas application layer usa;
- componentes internos do editor sem consumidor externo;
- helpers usados somente dentro do domínio;
- tudo indiscriminadamente.

## 11. Customers API adapter

Criar um adapter em:

`src/domains/customers/infrastructure/customersApi.js`

Rotas existentes:

- `POST /api/clients`;
- `PATCH /api/clients/:id`;
- `DELETE /api/clients/:id`.

Contratos permanecem:

### 11.1 Create

Request:

```text
{ name, phone, address }
```

Response:

```text
{ client }
```

### 11.2 Update

Request:

```text
{ name, phone, address }
```

Response:

```text
{ client }
```

### 11.3 Delete

Response atual:

```text
{ deleted: true }
```

Não alterar payloads nem respostas do Worker na C7.

O adapter usa `src/infrastructure/api/httpClient.js` e não conhece React, UI ou runtime.

## 12. Efeitos oficiais e exclusão de cliente

Create/update já retornam um cliente oficial e podem continuar aplicando:

```text
applyOfficialEffects({ client })
```

Delete não retorna a entidade removida.

Hoje o App chama diretamente:

```text
updateCollection('clients', ...)
```

Esse ownership deve sair do App.

### 12.1 Decisão C7

O operational runtime deve aceitar um efeito oficial explícito equivalente a:

```text
{ deletedClientId }
```

seguindo o padrão já existente de `deletedMovementId`.

O comando de Customers:

1. recebe sucesso `{ deleted: true }` da API;
2. conhece o `id` que acabou de ser aceito pelo backend;
3. aplica `applyOfficialEffects({ deletedClientId: id })`.

O runtime:

- marca `clients` como coleção mutada;
- remove o cliente por id;
- preserva sync guards;
- não aprende regra de negócio de Customers.

### 12.2 Escopo

Isso é uma extensão genérica do mecanismo de efeitos oficiais, não um bridge de callback Customers → runtime.

Não criar:

- `onClientDeleted`;
- `legacyCustomerBridge`;
- callback específico capturado pelo runtime.

Após C7, `updateCollection('clients', ...)` não deve mais ser necessário.

`updateCollection` pode permanecer para Catalog até C8 e para fechamento final C10.

## 13. Customer commands

CRUD deixa de ser coordenado em `App.jsx`.

Uma application layer de Customers deve possuir operações equivalentes a:

- create;
- quick create;
- update;
- delete.

Deve receber por injeção:

- `applyOfficialEffects`;
- estado `writesBlocked`;
- capability de gestão;
- `setRequestKey`, preservando a serialização global de writes já existente;
- feedback de sucesso;
- tratamento de erro.

### 13.1 Regras

Preservar:

- nenhuma escrita offline;
- nenhuma escrita sem `clients.manage`;
- os request keys atuais: `client:create`, `client:create:quick`, `client:update:<id>` e `client:delete:<id>`;
- enquanto qualquer um desses request keys estiver ativo, o `writesBlocked` global continua bloqueando outras escritas como hoje;
- não substituir essa semântica apenas por pending local do domínio;
- request/submitting state equivalente;
- create aplica cliente oficial;
- update aplica cliente oficial;
- delete remove apenas após resposta aceita;
- erro não fecha editor indevidamente;
- feedback de sucesso permanece:
  - `Cliente adicionado com sucesso`;
  - `Cliente atualizado com sucesso`;
  - `Cliente excluído com sucesso`.

Não criar store paralelo de clientes dentro do hook.

## 14. Customer editor

O formulário inline de `App.jsx` deve migrar para UI/application de Customers.

Preservar exatamente:

- título `Novo cliente`;
- título `Editar cliente`;
- label `Nome`;
- placeholder `Ex: Maria Silva`;
- `autoComplete="name"`;
- label `Telefone`;
- `type="tel"`;
- `inputMode="tel"`;
- `autoComplete="tel"`;
- placeholder atual;
- formatação de telefone enquanto digita;
- label `Endereço`;
- `autoComplete="street-address"`;
- placeholder `Bairro ou endereço`;
- ações Cancelar / Adicionar cliente / Salvar alterações;
- disable atual quando nome está vazio, offline ou submit está em andamento.

Semântica de payload também é parte do comportamento preservado:

- cadastro/edição normal envia `name.trim()`;
- mantém o telefone atual do draft ou `''`;
- endereço vazio no editor normal continua sendo enviado como a string `Sem endereço`, como ocorre hoje;
- o quick-create de Novo Pedido continua enviando `address: ''`, não `Sem endereço`;
- não normalizar essas duas rotas para o mesmo payload durante C7.

O editor deve limpar corretamente estado ao cancelar/fechar.

## 15. Duplicate modal

`ClientDuplicateModal` migra para Customers e passa a ser um contrato público deliberado porque também é usado pela UI de quick-create de Orders. Orders deve importá-lo somente pelo `domains/customers/index.js` (ou wrapper público equivalente), nunca pelo caminho interno do componente.

Preservar:

- título `Encontramos um cliente com este nome`;
- summary do cliente encontrado;
- telefone/endereço quando existentes;
- copy explicativa;
- botões e ordem funcional atual;
- disabled durante escrita;
- fechamento por Cancelar;
- sem `window.confirm`.

Não transformar em modal genérico.

## 16. Lista de Clientes

`src/pages/Clients.jsx` migra para `domains/customers/ui`.

Preservar:

- eyebrow `Relacionamento`;
- título `Clientes`;
- descrição atual;
- botão `Novo cliente`;
- busca por nome, telefone e endereço;
- sort:
  - Nome A–Z;
  - Nome Z–A;
- linhas compactas;
- telefone fallback;
- endereço fallback;
- action sheet;
- editar;
- confirmação de exclusão;
- após uma tentativa de exclusão disparada pelo action sheet, o action sheet continua fechando ao terminar o callback, inclusive quando o callback resolve `false`; C7 não deve alterar silenciosamente essa UX;
- estado vazio;
- touch targets atuais;
- comportamento mobile e desktop;
- `canManageClients`;
- bloqueio de ações offline.

A C7 não redesenha nem muda CSS visual.

## 17. CustomersWorkspace

A UI pública principal pode ser um `CustomersWorkspace` que compõe:

- lista;
- editor;
- duplicate modal;
- commands;
- query inputs;
- capabilities;
- feedback/adapters injetados.

O App pode renderizar diretamente esse workspace.

O workspace não deve:

- importar navigation runtime;
- importar session runtime;
- buscar bootstrap;
- manter cópia oficial de `clients[]`;
- chamar Worker fora de `customersApi`.

## 18. Busca e ordenação

Hoje `App.jsx` deriva `filteredClients`.

Essa projeção é específica da experiência de Clientes e deve sair do App.

Customers deve possuir uma projeção pura equivalente a:

```text
filterAndSortClients(clients, { search, sort })
```

ou implementação semanticamente equivalente.

Preservar:

- busca case-insensitive;
- combinação de nome + telefone + endereço;
- trim da busca;
- sort usando nome com a semântica atual de `localeCompare`;
- opções atuais de ordenação.

O query state global pode continuar no mecanismo de navegação/App, porque persistência de query por destino é responsabilidade de navegação/composição. Customers recebe `search`, `sort` e callbacks.

## 19. Quick-create no Novo Pedido

Novo Pedido pertence a Orders e já possui UI própria de quick-create.

C7 não move essa UI para Customers.

### 19.1 Ownership

Customers possui:

- detecção de duplicidade de clientes;
- comando/API de criação do cliente.

Orders possui:

- quando o quick-create aparece;
- estado visual do step do pedido;
- como o cliente criado/existente é selecionado no draft do pedido;
- ação Cancelar que limpa apenas quick-client state.

### 19.2 Composição

A preferência arquitetural é:

- Orders pode consumir a regra pura de duplicidade através do **public entry** de Customers;
- Orders também pode consumir `ClientDuplicateModal` através desse mesmo public entry, pois a UI é customer-specific e já é compartilhada entre os dois fluxos;
- a mutação quick-create é fornecida a Orders por callback/comando público injetado pela composição do App;
- Orders não importa `customersApi.js`;
- Orders não importa internals de Customers;
- Customers não importa Orders.

Isso preserva uma dependência controlada e evita API cross-domain dentro da UI Orders.

### 19.3 Garantias

Preservar:

- telefone duplicado no editor principal usa feedback global `Telefone já cadastrado para <nome>.`;
- telefone duplicado no quick-create usa o erro inline atual `Telefone já cadastrado para <nome>. Selecione esse cliente na busca acima.`;
- esses dois canais de feedback não devem ser unificados acidentalmente;
- nome duplicado abre modal;
- no quick-create, `Usar cliente existente` seleciona o cliente encontrado e fecha o quick-create;
- no editor da tela Clientes, `Usar cliente existente` fecha duplicate/editor e atualiza a busca da tela para o nome do cliente encontrado; não existe seleção de cliente nesse contexto;
- `Cadastrar mesmo assim` cria e seleciona o novo no quick-create, ou persiste create/update no editor principal conforme a ação original;
- Cancelar quick-create limpa somente:
  - open;
  - name;
  - phone;
  - erro;
  - duplicate modal;
- cancelar quick-create não altera itens, modalidade, data, taxa ou ajuste do pedido;
- capability e offline continuam respeitados.

## 20. Relação com identidade do pedido

`shared/orderCustomerIdentity.js` e as regras de Orders para:

- `registered_client`;
- `guest_name`;
- `table`;

não migram para Customers.

Essas regras dizem como **um pedido** é identificado, não como clientes são administrados.

C7 não altera:

- requisito de cliente cadastrado para entrega/retirada;
- mesa para consumo local;
- snapshots de identidade do pedido;
- Worker checkout.

## 21. Capabilities

A capability existente:

`clients.manage`

continua controlando mutações de clientes.

Preservar:

- sem capability, não mostrar/permitir ações de gestão;
- leitura/lista continua conforme comportamento atual;
- quick-create em Orders respeita a mesma capacidade;
- disabled visual permanece coerente;
- não criar novas capabilities na C7.

Se staging continuar sem identidade read-only apropriada, o item manual correspondente deve ser marcado BLOCKED, não PASS.

## 22. Offline

Offline continua bloqueando writes.

Preservar:

- busca/lista permanecem utilizáveis com estado já carregado;
- Novo cliente bloqueado;
- editar bloqueado;
- excluir bloqueado;
- quick-create bloqueado;
- nenhuma tentativa POST/PATCH/DELETE offline.

Não criar fila offline de clientes.

## 23. Erros e conflitos

Preservar o tratamento global atual.

### 23.1 Backend phone conflict

Se a validação frontend estiver stale e o Worker retornar `409 CLIENT_PHONE_EXISTS`:

- exibir o erro normalizado pelo canal atual (`showApiError`/feedback global para a falha de API);
- no quick-create, manter o formulário aberto e não selecionar cliente;
- no editor principal, manter o editor aberto;
- não aplicar cliente local;
- não fechar editor como sucesso.

### 23.2 404 update/delete

Preservar mensagem/fluxo do `showApiError`.

A C7 não adiciona retry automático de mutação.

### 23.3 Resultado incerto

C7 não inventa protocolo novo de unknown result para CRUD de cliente.

O comportamento deve permanecer igual ao atual: backend/bootstrap seguem autoridade e o sync subsequente corrige estado quando necessário.

## 24. App.jsx após C7

O App pode continuar responsável por:

- receber `clients[]` do operational runtime;
- derivar `canManageClients`;
- manter query state por destino;
- compor `CustomersWorkspace`;
- passar feedback/runtime adapters;
- passar um comando de quick-create para New Order;
- resetar superfícies no logout por seus contratos públicos.

O App não deve continuar possuindo:

- draft do formulário de cliente;
- editing id;
- open/close de editor;
- duplicate dialog state;
- duplicate validation;
- create/update/delete HTTP;
- persist helpers de cliente;
- customer success messages dentro de handlers App;
- `updateCollection('clients', ...)`;
- regra de filtro/sort de Clientes;
- modal markup de cadastro/edição;
- `ClientDuplicateModal` markup.

## 25. Logout/reset

Hoje logout limpa `showClientForm` e `duplicateClientDialog` diretamente no App.

Após C7, Customers deve limpar seu estado local naturalmente quando:

- workspace desmonta por sessão/destino; ou
- recebe uma chave/generation de sessão, somente se realmente necessário.

Não criar bridge de reset App → Customers se a desmontagem já fornece a semântica correta.

Testar explicitamente para evitar draft/modal sobrevivendo entre sessões.

## 26. CSS

A estratégia de CSS da Spec C continua válida.

C7 deve priorizar movimentação JS/JSX.

Arquivos como:

- `src/clients-phonebook.css`;
- `src/client-duplicate.css`;

podem permanecer em seus locais atuais para preservar cascade/especificidade.

Mover CSS apenas se:

- import order permanecer equivalente;
- testes/visual homologado não mudarem;
- não criar diff visual desnecessário.

Reorganização geral de CSS continua C10.

## 27. Legacy API cleanup

Após todos os consumidores migrarem, remover de `src/api/client.js`:

- `createClient`;
- `updateClient`;
- `deleteClient`.

Não criar reexports de compatibilidade.

O arquivo legado pode continuar contendo outras APIs pertencentes às slices futuras C8/C9/C10.

## 28. Compatibility ledger

C7 deve atualizar `docs/superpowers/qa/spec-c-compatibility-facades.md`.

### 28.1 `updateCollection`

O ledger atual registra:

`updateCollection runtime escape hatch → clients/products handlers not migrated yet → C8, final C10`.

Após C7:

- customer usage deve estar removido;
- product usage permanece para C8;
- a linha deve ser atualizada para refletir apenas o debt real de Catalog.

### 28.2 `shared/clientIdentity.js`

Não registrar como facade temporária se permanecer por uso real do Worker.

Documentar como contrato compartilhado cross-runtime permitido pela Spec C.

## 29. Architecture gates

C7 deve adicionar checks permanentes para impedir regressão.

No mínimo:

1. consumidores externos de Customers não podem deep-importar internals;
2. Customers não importa internals de Orders;
3. Orders não importa internals de Customers;
4. `src/pages/Clients.jsx` não pode reaparecer como owner;
5. `src/components/ClientDuplicateModal.jsx` não pode reaparecer como owner; Orders deve consumir o modal somente pelo public entry de Customers;
6. `src/api/client.js` não pode reexportar customer CRUD;
7. `App.jsx` não pode recuperar handlers/state de CRUD/editor/duplicidade;
8. `App.jsx` não pode voltar a chamar `updateCollection('clients', ...)`;
9. Orders não pode importar `customersApi.js` diretamente;
10. shared cross-runtime `clientIdentity.js` permanece uma exceção documentada, não uma permissão para novos helpers domain-specific irem para shared.

Evitar regras por regex excessivamente frágeis quando o checker já possui mecanismo estrutural melhor.

## 30. Estratégia de testes

### 30.1 Regras puras

Testar:

- duplicate name com case/acentos/espaços;
- duplicate phone com máscara e +55;
- telefone vazio;
- exclusão do próprio id na edição;
- filtro por nome;
- filtro por telefone;
- filtro por endereço;
- sort asc/desc.

### 30.2 API

Testar:

- rotas/métodos;
- encoding de id;
- payload create/update;
- delete;
- propagação de erro normalizado.

### 30.3 Commands

Testar:

- capability;
- offline;
- double-submit/estado busy quando aplicável;
- create effect;
- update effect;
- deletedClientId effect;
- feedback;
- erro não produz efeito oficial.

### 30.4 Editor/duplicate

Testar comportamento observável, não internals arbitrários:

- abrir novo;
- abrir edição;
- cancel;
- duplicate phone;
- duplicate name;
- use existing;
- confirm duplicate;
- labels/input hints;
- estado disabled.

### 30.5 Orders integration

Testar:

- quick create unique;
- duplicate phone;
- duplicate name/use existing;
- duplicate name/continue;
- cancel isolado;
- Orders usa public Customers contract;
- Orders não usa Customers infrastructure.

### 30.6 Characterization tests existentes

Testes atuais relevantes devem ser migrados/alinhados, não apagados para fazer a suíte passar:

- `src/clientsPhonebook.test.js`;
- `src/clientDuplicateUi.test.js`;
- `src/pages/ClientsProductsMobile.test.js`;
- `src/quickClientCancel.test.js`;
- `shared/clientIdentity.test.js`;
- Worker client uniqueness tests.

## 31. TDD

Cada boundary relevante deve seguir:

1. teste RED;
2. confirmar que falha pelo motivo arquitetural/comportamental esperado;
3. commit/push do RED autoritativo;
4. implementação mínima;
5. focused GREEN;
6. commit GREEN;
7. exact-SHA Validate remoto;
8. registrar evidência no execution ledger.

Não aceitar RED causado por:

- JSX em runner Node sem suporte;
- import path quebrado acidental;
- parser;
- fixture incorreta;
- assert obsoleto não relacionado ao objetivo do RED.

## 32. Full gate

Antes de staging, exigir no exact candidate SHA:

```bash
npm test
npm run lint
npm run test:architecture
npm run build
npm run d1:migrate:local
```

E os dry-runs production/staging já presentes no `Validate application`.

Também auditar:

- zero mudança funcional no Worker;
- zero migration nova;
- zero ownership de printing/QZ;
- zero mudança financeira;
- zero mudança de lifecycle de Orders;
- zero redesign visual.

## 33. Homologação staging

Depois dos tasks funcionais/arquiteturais GREEN e full gate:

1. dispatch manual de `Deploy staging` na branch exata;
2. registrar run + exact SHA;
3. confirmar migrations remotas sem pendência inesperada;
4. confirmar real login smoke;
5. executar matriz manual.

### 33.1 Matriz mínima C7

1. abrir Clientes desktop;
2. buscar por nome;
3. buscar por telefone;
4. buscar por endereço;
5. ordenar Nome A–Z;
6. ordenar Nome Z–A;
7. criar cliente único;
8. editar cliente;
9. abrir exclusão e cancelar;
10. excluir cliente e confirmar;
11. telefone duplicado bloqueado;
12. nome duplicado → Cancelar;
13. nome duplicado → Usar cliente existente;
14. nome duplicado → Cadastrar mesmo assim;
15. formulário mobile e teclado/autocomplete;
16. lista mobile 320–640 px sem clipping;
17. offline: leitura/busca funciona, writes bloqueados;
18. Novo Pedido: quick-create cliente único;
19. Novo Pedido: telefone duplicado;
20. Novo Pedido: nome duplicado → usar existente;
21. Novo Pedido: nome duplicado → continuar cadastro;
22. Novo Pedido: Cancelar quick-create não altera restante do draft;
23. create/update/delete aparecem corretamente no estado oficial após sync;
24. logout/login não preserva editor/duplicate modal indevidamente;
25. capability/read-only, se existir identidade apropriada; caso contrário BLOCKED.

## 34. Não objetivos

C7 não inclui:

- histórico de pedidos por cliente;
- CRM;
- tags/segmentação;
- fidelidade;
- múltiplos endereços;
- múltiplos telefones;
- email;
- CPF/CNPJ;
- importação/exportação;
- merge automático de clientes duplicados;
- deduplicação retroativa do banco;
- mudança de schema;
- mudança de regras de checkout;
- redesign da tela Clientes;
- React Router;
- mudança de polling;
- C8 Catalog;
- C9 Printing;
- cleanup geral de CSS/C10.

## 35. Critérios de aceite arquitetural

C7 só pode ser considerada pronta para homologação quando:

1. `domains/customers/index.js` existe e é deliberado;
2. Customers possui API própria;
3. Customers possui UI própria;
4. Customers possui regra frontend de duplicidade;
5. App não possui CRUD/editor/duplicate orchestration;
6. customer CRUD saiu de `src/api/client.js`;
7. `src/pages/Clients.jsx` legado não é owner;
8. `src/components/ClientDuplicateModal.jsx` legado não é owner;
9. Orders não importa Customers internals/infrastructure;
10. Customers não importa Orders internals;
11. quick-create continua via public contract/composição;
12. `updateCollection('clients', ...)` não existe em App/Customers;
13. runtime aceita exclusão oficial de cliente sem callback bridge;
14. `shared/clientIdentity.js` fica restrito às primitivas cross-runtime realmente usadas pelo Worker (`normalizeClientPhone` / `formatClientPhone`), enquanto normalização de nome e duplicate lookup pertencem a Customers;
15. architecture gates bloqueiam reintrodução do debt C7;
16. full gates estão verdes.

## 36. Critérios de aceite comportamental

Além dos gates automáticos:

- create funciona;
- update funciona;
- delete funciona;
- filtro funciona;
- sort funciona;
- duplicate phone funciona;
- duplicate name/cancel funciona;
- duplicate name/use existing funciona;
- duplicate name/continue funciona;
- quick-create funciona;
- offline funciona;
- capability funciona ou é formalmente BLOCKED por falta de identidade de staging;
- mobile/desktop permanecem visualmente equivalentes;
- nenhum FAIL manual fica aberto.

## 37. Fechamento da slice

Depois da homologação:

- criar `docs/superpowers/qa/spec-c7-customers-qa.md`;
- atualizar execution ledger;
- atualizar compatibility ledger;
- executar status-only exact-head Validate;
- pedir autorização explícita de merge;
- mergear PR da C7;
- confirmar post-merge Validate de `master`;
- não fazer deploy de produção como parte normal da C7.

A C8 só parte da `master` mergeada/validada da C7.

## 38. Decisões normativas consolidadas

Para evitar ambiguidades no plano:

1. **Customers é domínio; Clientes não é apenas uma page.**
2. **Não haverá `app/surfaces/customers` obrigatório.** Usar somente se aparecer necessidade real de composição cross-domain.
3. **`shared/clientIdentity.js` não será apagado indiscriminadamente**, pois possui consumidor Worker real.
4. **A regra frontend `findClientDuplicates` passa a Customers.**
5. **Worker continua autoridade de telefone único.**
6. **Orders pode consumir Customers somente pelo public entry para regra pura.**
7. **Quick-create mutation chega a Orders por injeção/composição; Orders não chama Customers API diretamente.**
8. **Delete de cliente ganha `deletedClientId` em `applyOfficialEffects`**, sem bridge específico.
9. **Query state permanece com navegação/composição; filtro/sort pertence a Customers.**
10. **CSS não será reorganizado agressivamente na C7.**
11. **Nenhuma mudança de Worker/schema é necessária ou aprovada.**
12. **Nenhum código funcional começa antes da aprovação explícita desta spec e da reconciliação do plano C7 com ela.**

## 39. Próximo passo após aprovação

O plano já criado em:

`docs/superpowers/plans/2026-09-19-frontend-modularization-c7-customers-plan.md`

foi rascunhado antes desta spec dedicada.

Após aprovação desta spec, ele deve ser revisado contra estas decisões, especialmente:

- preservar o contrato Worker de `shared/clientIdentity.js`;
- não criar `CustomersSurface` sem necessidade real;
- mover `findClientDuplicates`, não obrigatoriamente todas as primitivas compartilhadas;
- usar `deletedClientId` no official-effects runtime;
- manter quick-create API por injeção e regra pura via public entry.

Somente após essa reconciliação e aprovação do plano revisado deve começar Task 1 RED.

## 40. Autorrevisão formal — 2026-09-19

A spec foi revisada após a primeira gravação contra:

- Spec C arquitetural;
- rollout C1–C10;
- compatibility ledger;
- `App.jsx` real da base C7;
- `Clients.jsx`;
- `NewOrder.jsx`;
- `shared/clientIdentity.js` e seus testes;
- `worker/repositories.js` e unicidade de cliente;
- operational runtime `applyOfficialEffects` / `updateCollection`;
- patterns já consolidados em Orders, Table Service e Finance.

Correções incorporadas nesta autorrevisão:

1. restringir `shared/clientIdentity.js` às primitivas realmente cross-runtime e mover normalização de nome + duplicate lookup para Customers;
2. declarar `ClientDuplicateModal` como contrato público Customer consumido por Orders;
3. exigir wrapper de UI Node-safe se necessário, seguindo C4–C6;
4. preservar os request keys globais de clientes e, portanto, o bloqueio transversal de writes;
5. registrar a diferença atual de payload de endereço entre editor normal e quick-create;
6. distinguir os canais de feedback de telefone duplicado no editor principal e no quick-create;
7. registrar a semântica exata de “usar cliente existente” em cada contexto;
8. preservar a semântica atual de fechamento do action sheet após tentativa de delete;
9. explicitar o `localeCompare` atual na ordenação;
10. confirmar que `deletedClientId` é a extensão apropriada de official effects e não um novo runtime bridge.

Após essas correções, não ficou bloqueador arquitetural conhecido na spec. O usuário aprovou explicitamente esta versão em 2026-09-19. O plano pré-spec ainda precisa ser reconciliado com esta versão e aprovado separadamente antes de qualquer Task 1 RED.
