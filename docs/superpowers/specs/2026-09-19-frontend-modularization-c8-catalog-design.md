# Spec C8 — Catalog

**Data:** 2026-09-19  
**Status:** **AUTO-REVISADA** — design consolidado sobre a base pós-C7; aguardando aprovação explícita do usuário  
**Branch:** `feature/spec-c8-catalog`  
**Base:** `master` em `a7a8285ee125d90058c739f52daba6c170921adb`  
**Base validation:** Validate application #1429 / run `35459175985` — SUCCESS  
**Produção:** não tocar nesta slice sem autorização separada

## 1. Objetivo

A C8 estabelece `catalog` como domínio explícito do frontend para o **modelo de produtos já existente** e remove de `App.jsx` o ownership de CRUD, editor e regras de apresentação/listagem do catálogo.

A slice deve:

- criar um boundary público em `src/domains/catalog/`;
- tornar Catalog owner da tela de Produtos, formulário/editor, projeções de listagem, metadata frontend do catálogo e API de produtos;
- remover do `App.jsx` estados, helpers e handlers de CRUD/edição de produtos;
- retirar `createProduct`, `updateProduct` e `deleteProduct` do `src/api/client.js`;
- retirar o uso de `updateCollection('products', ...)` por meio de efeito oficial explícito de exclusão;
- encerrar o escape hatch `updateCollection` do operational runtime quando o último consumidor de produção for removido;
- preservar o uso do catálogo dentro de Novo Pedido sem transferir ownership do carrinho/fluxo de pedido para Catalog;
- preservar o contrato cross-runtime de `shared/productCatalog.js` realmente usado pelo Worker;
- reforçar architecture gates para impedir retorno dos owners legados;
- preservar integralmente comportamento, UX, visual, categorias, apresentações, BRL, capabilities, offline, bootstrap/sync e contratos do Worker.

A C8 é uma refatoração arquitetural. Ela **não** implementa o futuro modelo da Spec D.

## 2. Resultado esperado

Ao final da C8:

1. `src/domains/catalog` é o owner frontend de catálogo/produtos existentes;
2. `App.jsx` não contém draft, modal, CRUD nem payload builder de produto;
3. `src/pages/Products.jsx` e `src/components/ProductForm.jsx` deixam de ser owners de produção;
4. `src/api/client.js` não exporta APIs de produto;
5. create/update/delete passam por Catalog application + Catalog API;
6. exclusão aplica `deletedProductId` via `applyOfficialEffects`;
7. `updateCollection('products', ...)` desaparece e o escape hatch `updateCollection` deixa de fazer parte do runtime de produção;
8. Novo Pedido continua consumindo produtos oficiais e metadata/presentation do Catalog por contrato público;
9. Orders não importa internals nem infrastructure de Catalog;
10. Catalog não importa internals de Orders;
11. `shared/productCatalog.js` permanece somente como contrato cross-runtime necessário a frontend/Worker, sem continuar acumulando metadata exclusiva da UI;
12. todas as experiências atuais permanecem observacionalmente equivalentes.

## 3. Base técnica validada

A base da C8 é o merge da C7:

`a7a8285ee125d90058c739f52daba6c170921adb`

O merge foi produzido pelo PR #51.

Evidência validada em GitHub:

- PR #51 — merged/closed;
- merge/master SHA: `a7a8285ee125d90058c739f52daba6c170921adb`;
- post-merge Validate application #1429 / run `35459175985` — SUCCESS no SHA exato;
- produção não foi implantada pela C7.

A C8 parte exatamente dessa `master`.

### 3.1 Reconciliação documental obrigatória

A auditoria da base encontrou uma defasagem documental esperada do fechamento: os arquivos de rollout/execution ledger presentes no merge ainda descrevem C7 como homologada com merge pendente, embora o GitHub já prove que o PR #51 foi mergeado e que o Validate pós-merge passou no novo `master`.

Pela própria regra do execution ledger, quando ledger e GitHub divergem, o estado real do GitHub deve ser inspecionado e o ledger reconciliado antes da implementação.

Portanto, antes da Task 1 funcional da C8, a branch deve atualizar pelo menos:

- rollout da Spec C: C7 → **MERGED / COMPLETE** e C8 → slice ativa de design/plano;
- execution ledger: PR #51 merged, master `a7a8285ee125d90058c739f52daba6c170921adb`, Validate #1429 verde e C8 em planejamento;
- compatibility ledger somente no que for necessário para refletir o início da C8, sem marcar debts como removidos antes da implementação.

Essa reconciliação documental não muda a base técnica aprovada e não autoriza código funcional.

## 4. Restrições globais

A C8 deve preservar as regras da Spec C:

- não implementar diretamente em `master`;
- trabalhar em `feature/spec-c8-catalog`;
- TDD RED → GREEN para extrações e mudanças de ownership;
- backend/bootstrap continuam fonte de verdade;
- não criar store oficial independente para produtos;
- polling/sync global permanecem como estão;
- não introduzir Redux, Zustand, React Router, WebSocket/SSE ou microserviços;
- não redesenhar Produtos nem o seletor de produtos de Novo Pedido;
- não alterar regras de produto, categoria, apresentação, preço ou exclusão;
- não antecipar C9, C10 ou Spec D;
- produção somente mediante autorização explícita separada.

## 5. Ownership do domínio Catalog

Catalog é dono, no frontend, de:

- regras, projeções, UI e comandos que operam sobre o catálogo/produtos oficiais recebidos do runtime;
- tela administrativa Produtos;
- busca, filtro e agrupamento da tela Produtos;
- cadastro de produto;
- edição de produto;
- exclusão simples e coordenação das intenções de exclusão em massa existentes;
- draft/editor de produto;
- construção do payload frontend de produto;
- metadata frontend de categoria;
- fallback visual de categoria legada para `Outros`;
- sugestão frontend de apresentação por categoria;
- formatação/apresentação de catálogo exposta aos consumidores frontend através do public entry;
- API frontend de produtos;
- comandos de mutação de produtos.

O `products[]` oficial continua pertencendo ao operational runtime/bootstrap. Catalog não cria store oficial paralelo, não substitui os sync guards e não passa a ser fonte de verdade da coleção.

Catalog não é dono de:

- carrinho de Novo Pedido;
- quantidade adicionada ao carrinho;
- subtotal/total do pedido;
- checkout;
- lifecycle de Orders;
- snapshot persistido de item do pedido;
- pricing engine futuro;
- variantes/option groups;
- sessão/auth/capabilities;
- runtime/bootstrap global;
- navegação global;
- feedback global;
- impressão.

## 6. Estado atual na base C8

### 6.1 UI administrativa

Na base pós-C7:

- `src/pages/Products.jsx` possui:
  - busca;
  - filtro por categoria;
  - agrupamento em accordions;
  - expand/collapse por categoria;
  - overflow Editar/Excluir;
  - seleção múltipla;
  - long press mobile;
  - exclusão em massa sequencial;
  - confirmação simples e em massa;
  - estado local de pending/selection/action menu;
- `src/components/ProductForm.jsx` possui:
  - nome;
  - preço BRL;
  - categorias;
  - apresentação;
  - validação;
  - preview;
  - comportamento de preço inicial;
  - botões de cancelar/salvar.

### 6.2 App ownership

`App.jsx` ainda possui:

- `editingProductId`;
- `showProductForm`;
- `newProduct`;
- `emptyProduct`;
- `openNewProduct`;
- `handleEditProduct`;
- `productPayload`;
- `handleAddProduct`;
- `handleDeleteProduct`;
- `handleCancelProductEdit`;
- imports diretos das três APIs de produto;
- import direto de `ProductForm`;
- import direto de `Products`;
- modal do editor de produto;
- `updateCollection('products', ...)` na exclusão.

Esses são debts explícitos da C8.

### 6.3 API legado

`src/api/client.js` ainda exporta:

- `createProduct`;
- `updateProduct`;
- `deleteProduct`.

Esses exports devem desaparecer na C8.

### 6.4 Runtime

`useOperationalDataRuntime` já suporta:

- bootstrap oficial de `products[]`;
- `applyOfficialEffects({ product })` para upsert;
- sync guard para a coleção `products`.

Mas delete de produto ainda não possui efeito oficial explícito e depende do escape hatch:

`updateCollection('products', ...)`.

### 6.5 Consumidor Orders

`src/domains/orders/ui/components/OrderProductCatalog.jsx` pertence ao fluxo de criação de pedido e atualmente consome diretamente `shared/productCatalog.js` para:

- categorias;
- fallback de categoria;
- apresentação.

A UI de seleção permanece em Orders; apenas o contrato de catálogo consumido por ela deve passar pelo public entry de Catalog.

## 7. Contrato cross-runtime `shared/productCatalog.js`

Este arquivo é um caso real de compartilhamento frontend + Worker e **não pode ser movido integralmente** para `src/domains/catalog`.

Na base C8 auditada:

- `worker/validation.js` consome `PRODUCT_CATEGORIES` e `validateProductPresentation`;
- `worker/repositories.js` consome `formatProductPresentation`;
- o frontend consome também metadata que não é necessária ao Worker.

### 7.1 Contratos que permanecem cross-runtime

Podem permanecer em `shared/productCatalog.js`, desde que continuem puros e sem dependência de React/browser:

- `PRODUCT_CATEGORIES`;
- `deriveLegacySize`;
- `validateProductPresentation`;
- `formatProductPresentation`;
- helpers privados estritamente necessários a esses contratos.

Essa lista pode ser reduzida se a implementação provar que algum export deixou de ter consumidor, mas não pode ser ampliada por conveniência frontend.

### 7.2 Metadata frontend que passa a Catalog

Devem sair de `shared/productCatalog.js` e ter owner em Catalog, porque não possuem consumidor Worker real:

- `CATEGORY_ICON_NAMES`;
- `PRODUCT_CATEGORY_OPTIONS`;
- `categoryForUi`;
- `suggestPresentationType`.

A implementação pode escolher nomes/arquivos equivalentes, desde que o boundary fique explícito.

### 7.3 Public entry frontend

Consumidores frontend externos, especialmente Orders, não devem importar `shared/productCatalog.js` diretamente após C8.

Catalog pode reexportar pelo seu `index.js` somente os contratos realmente necessários externamente, por exemplo:

- `PRODUCT_CATEGORIES`;
- `categoryForUi`;
- `formatProductPresentation`.

O Worker continua consumindo o módulo cross-runtime diretamente.

Isso mantém uma única regra pura compartilhada com backend sem transformar `shared/` em um owner paralelo de UI do domínio.

## 8. Modelo atual de produto — invariantes

C8 não altera o modelo atual.

Campos observáveis relevantes:

- `id`;
- `category`;
- `name`;
- `price`;
- `presentationType`;
- `presentationValue`;
- `presentationUnit`;
- `size` como representação legada/compatível retornada pelo backend.

Cada variação continua sendo um registro independente.

Exemplos como Marmita P/M/G continuam sendo produtos separados com preços independentes.

Não criar entidade pai/filho de produto nesta slice.

## 9. Categorias

Preservar exatamente as categorias atuais:

- Refeições;
- Lanches;
- Combos;
- Porções;
- Bebidas;
- Sobremesas;
- Adicionais;
- Molhos;
- Outros.

As categorias continuam fixas pelo sistema.

C8 não adiciona CRUD/configuração de categorias.

### 9.1 Fallback legado

Categoria persistida fora do catálogo atual:

- continua aparecendo visualmente como `Outros`;
- continua pesquisável/visível;
- ao abrir para edição, o editor usa o fallback `Outros`;
- se for salva assim, passa a persistir `Outros`, preservando o comportamento já definido na rodada original do catálogo.

## 10. Apresentações

Preservar os quatro tipos:

- `unit` — Unidade;
- `size` — Tamanho;
- `volume` — Volume;
- `weight` — Peso.

### 10.1 Unidade

- sem valor complementar;
- representação compatível `Un`;
- exibição `Unidade`.

### 10.2 Tamanho

- presets `P`, `M`, `G`;
- `Outro` abre texto customizado;
- texto customizado com até 24 caracteres;
- vazio/inválido bloqueia submit.

### 10.3 Volume

- decimal positivo;
- aceita entrada com vírgula ou ponto;
- unidades `ml` ou `L`;
- zero/negativo/texto inválido bloqueiam submit.

### 10.4 Peso

- decimal positivo;
- aceita entrada com vírgula ou ponto;
- unidades `g` ou `kg`;
- zero/negativo/texto inválido bloqueiam submit.

### 10.5 Sugestão por categoria

Preservar:

| Categoria | Apresentação sugerida |
|---|---|
| Refeições | Tamanho |
| Lanches | Tamanho |
| Combos | Unidade |
| Porções | Tamanho |
| Bebidas | Volume |
| Sobremesas | Unidade |
| Adicionais | Unidade |
| Molhos | Unidade |
| Outros | Unidade |

Trocar categoria continua resetando a apresentação para a sugestão atual.

A sugestão é UX frontend, não regra persistida do Worker.

## 11. Estrutura alvo

Estrutura conceitual:

```text
src/
  domains/
    catalog/
      domain/
        catalogPresentation.js
        catalogList.js
      application/
        useCatalogCommands.js
        useProductEditor.js
      infrastructure/
        catalogApi.js
      ui/
        Products.jsx
        ProductForm.jsx
        CatalogWorkspace.jsx
        catalogSurfaces.js
      index.js
```

Arquivos de teste acompanham seus owners.

A estrutura exata pode ser simplificada no plano se o dependency graph provar que menos arquivos mantêm o mesmo boundary com maior clareza.

Não criar `app/surfaces/catalog` apenas por simetria. A administração de Produtos é single-domain e pode ser exposta por um `CatalogWorkspace`.

## 12. Public contract de Catalog

O `index.js` deve expor somente contratos usados externamente.

Candidatos reais:

- `CatalogWorkspace`;
- `PRODUCT_CATEGORIES` para o seletor de produtos de Orders;
- `categoryForUi`;
- `formatProductPresentation`.

Não reexportar:

- `catalogApi` se apenas a application layer usa;
- editor interno;
- commands internos sem consumidor externo;
- constantes puramente visuais sem consumidor;
- tudo indiscriminadamente.

Como testes Node carregam public entries, export público de UI deve usar o padrão Node-safe já adotado por outras slices se export direto de JSX quebrar o harness.

## 13. Catalog API adapter

Criar adapter em:

`src/domains/catalog/infrastructure/catalogApi.js`

Rotas existentes:

- `POST /api/products`;
- `PATCH /api/products/:id`;
- `DELETE /api/products/:id`.

### 13.1 Create

Request frontend atual:

```text
{
  category,
  presentationType,
  presentationValue,
  presentationUnit,
  name,
  price
}
```

Response:

```text
{ product }
```

Status atual de create: 201.

### 13.2 Update

Mesmo shape de payload.

Response:

```text
{ product }
```

### 13.3 Delete

Response atual:

```text
{ deleted: true }
```

Não alterar contratos, rotas, códigos de erro nem Worker na C8.

O adapter usa `src/infrastructure/api/httpClient.js` e não conhece React, UI ou operational runtime.

## 14. Product payload

A construção do payload deixa de pertencer ao App.

Preservar:

- `category` do draft;
- `presentationType`;
- `presentationValue`;
- `presentationUnit`;
- `name.trim()`;
- `price` convertido do input BRL para número pelo helper já existente.

O frontend não precisa enviar `size` nas gravações estruturadas atuais; o Worker continua derivando a representação compatível através da validação cross-runtime.

Não duplicar no Catalog uma segunda implementação divergente de `validateProductPresentation`.

## 15. Efeitos oficiais e exclusão de produto

Create/update já retornam produto oficial e continuam aplicando:

`applyOfficialEffects({ product })`.

Delete retorna apenas `{ deleted: true }`.

### 15.1 Decisão C8

Adicionar ao operational runtime o efeito oficial explícito:

`{ deletedProductId }`.

O comando de Catalog:

1. chama DELETE;
2. somente após resposta aceita aplica `applyOfficialEffects({ deletedProductId: id })`;
3. emite feedback de sucesso;
4. não remove localmente em caso de erro.

O runtime:

- marca `products` como coleção mutada;
- remove o produto por id;
- preserva sync guards;
- não aprende regra de negócio de Catalog.

### 15.2 Encerramento de `updateCollection`

Na base C8, o debt documentado restante de `updateCollection` é Catalog/products.

Após a migração:

- `App.jsx` não deve mais receber/desestruturar `updateCollection`;
- `useOperationalDataRuntime` não deve mais retornar o escape hatch;
- o callback genérico `updateCollection` deve ser removido do runtime de produção;
- testes legados que o tratem como contrato devem ser migrados para efeitos oficiais específicos.

Não criar callback bridge como `onProductDeleted`.

## 16. Catalog commands

CRUD deixa de ser coordenado em `App.jsx`.

A application layer deve possuir create/update/delete, recebendo por injeção:

- `applyOfficialEffects`;
- `writesBlocked`;
- `canManageProducts`;
- `setRequestKey`;
- feedback de sucesso;
- tratamento de erro.

Preservar request keys:

- create: `product:create`;
- update: `product:update:<id>`;
- delete: `product:delete:<id>`.

Preservar feedback:

- `Produto adicionado com sucesso`;
- `Produto atualizado com sucesso`;
- `Produto excluído com sucesso`.

Preservar:

- nenhuma escrita offline;
- nenhuma escrita sem `products.manage`;
- nenhuma mutação local antes de sucesso;
- erro retorna resultado falso/equivalente e usa o canal atual;
- nenhuma fila offline;
- nenhuma store paralela de produtos.

## 17. Product editor

O modal/editor deixa o App.

O editor de Catalog deve possuir:

- open/close;
- editing id;
- draft;
- inicialização de produto novo;
- hidratação de produto existente;
- construção de payload;
- submit create/update;
- cancel/reset.

### 17.1 Novo produto

Preservar experiência observável atual:

- título `Novo produto`;
- categoria inicial `Refeições`;
- apresentação inicial `Tamanho`;
- valor inicial `P`;
- preço exibido inicial `R$ 0,00`;
- nome vazio;
- submit bloqueado enquanto nome vazio ou apresentação inválida.

A implementação não precisa preservar um seed interno invisível anterior se os testes provarem equivalência observável; o contrato é o valor efetivamente apresentado ao usuário.

### 17.2 Edição

Preservar:

- título `Editar produto`;
- nome atual;
- preço formatado em BRL;
- campos estruturados quando disponíveis;
- fallback legado por `size` quando campos estruturados não existirem;
- `Un`/`Unidade` legado tratado como `unit`;
- outro `size` legado tratado como `size`;
- categoria legada desconhecida apresentada como `Outros`.

### 17.3 Exclusão do produto em edição

Se um produto atualmente aberto para edição for excluído com sucesso pela lista:

- fechar o editor;
- limpar editing id/draft;
- não deixar modal apontando para entidade removida.

## 18. ProductForm

O componente migra para `domains/catalog/ui`.

Preservar exatamente a experiência atual:

- label `Nome do produto`;
- placeholder `Ex: Marmita executiva`;
- `autoComplete="off"`;
- label `Preço`;
- `inputMode="decimal"`;
- placeholder `R$ 0,00`;
- grade de categorias com ícones;
- check visual de seleção;
- controle segmentado Unidade/Tamanho/Volume/Peso;
- helper `Escolha como este produto será apresentado no cardápio.`;
- tamanho P/M/G/Outro;
- campo `Nome do tamanho`;
- placeholder `Ex: Família`;
- volume/peso com teclado decimal;
- unidade segmentada;
- validação inline atual;
- preview de nome/categoria/apresentação/preço;
- `Cancelar`;
- `Salvar produto`;
- `Salvar alterações`;
- disabled atual.

Não redesenhar nem alterar CSS intencionalmente.

## 19. Tela Produtos

`src/pages/Products.jsx` migra para `domains/catalog/ui`.

Preservar:

- eyebrow `Cardápio`;
- título `Produtos e preços`;
- descrição atual;
- botão `Adicionar produto`;
- busca;
- filtro de categoria;
- contador;
- accordions por categoria;
- expand/collapse;
- rows compactas;
- apresentação;
- preço;
- overflow de ações;
- seleção explícita;
- long press em touch;
- seleção múltipla;
- toolbar desktop sticky;
- toolbar mobile via portal;
- confirmação simples;
- confirmação de exclusão em massa;
- estado vazio;
- `canManageProducts`;
- bloqueio offline atual;
- touch targets atuais;
- comportamento desktop/mobile.

### 19.1 Exclusão em massa

Não criar endpoint bulk na C8.

Preservar a estratégia atual:

- iterar ids selecionados;
- chamar delete individual sequencialmente;
- usar os mesmos efeitos oficiais e feedbacks de cada delete;
- cada comando de delete absorve o erro pelo canal global e resolve como falha controlada, de modo que a iteração atual segue para os próximos ids;
- ao terminar a iteração, a seleção é cancelada/limpa como hoje.

Melhorias de atomicidade, resumo agregado de erros ou API bulk são fora de escopo.

### 19.2 Fechamento das confirmações de exclusão

Preservar também a semântica observável atual dos dialogs:

- na exclusão simples, depois que `onDelete(productId)` resolve, o candidato de exclusão é limpo e o dialog fecha mesmo quando o callback retorna `false`; o erro já foi encaminhado pelo canal global;
- C8 não transforma retorno `false` em um dialog de retry persistente;
- exceções inesperadas continuam respeitando o `finally` de pending existente e não devem ser usadas para inventar uma UX nova.

Qualquer mudança nessa experiência deve ser uma melhoria funcional separada, não consequência da modularização.

## 20. Busca, filtro e agrupamento

A projeção de lista pode sair do JSX para helper puro de Catalog.

Preservar exatamente:

### Busca

- trim;
- lowercase localizado `pt-BR`;
- pesquisa combinada em:
  - nome;
  - categoria visual;
  - apresentação formatada;
  - `String(price)`.

### Filtro

- `Todos` mostra todas;
- demais opções seguem as categorias atuais;
- fallback legado entra em `Outros`.

### Agrupamento

- produtos visíveis agrupados por categoria visual;
- não introduzir sort novo;
- preservar ordem relativa observada da coleção oficial;
- busca ativa ou filtro específico mantém categorias relevantes expandidas como hoje.

O query state continua pertencendo à navegação/composição.

App pode manter:

- `query.products.search`;
- `query.products.categoryFilter`;
- callbacks `patchQuery`.

Catalog recebe esses valores/callbacks.

## 21. Orders × Catalog

A UI `OrderProductCatalog.jsx` permanece em Orders.

Ela é responsável por:

- busca dentro do step de Novo Pedido;
- escolha de categoria para adicionar itens;
- quantidade já presente no carrinho;
- adicionar/remover quantidade;
- vínculo com cart/checkout.

Catalog fornece apenas o contrato de produto necessário à apresentação.

### 21.1 Dependência permitida

Orders pode importar do public entry de Catalog:

- `PRODUCT_CATEGORIES`;
- `categoryForUi`;
- `formatProductPresentation`.

Orders não pode importar:

- `catalogApi.js`;
- commands de mutação;
- editor;
- internals de listagem;
- UI administrativa de Produtos.

Catalog não deve importar Orders **de nenhuma forma**, nem mesmo seu public entry: não existe dependência legítima de Catalog → Orders nesta slice. A dependência permitida é unidirecional: Orders → `domains/catalog/index.js`.

### 21.2 Semântica a preservar em Novo Pedido

Preservar:

- categorias mostradas apenas quando há produto correspondente;
- busca por nome/categoria/apresentação;
- nenhum resultado inicial enquanto não há busca/categoria;
- quantidade do carrinho;
- botão Adicionar;
- controle − / quantidade / +;
- preço com formatter injetado;
- produtos oficiais recebidos pelo fluxo de Orders;
- nenhuma alteração no checkout/persistência de order item;
- snapshots de nome/categoria/apresentação continuam responsabilidade do backend/Orders já existente.

## 22. BRL e preço

C8 não cria motor de preços.

Preservar:

- input de preço via `formatBRLCurrencyInput`;
- preço de edição via `formatBRLCurrencyValue`;
- conversão de payload via `parseBRLCurrencyInput`;
- preço exibido na lista pelo formatter `currency` já injetado;
- preço do Novo Pedido pelo formatter atual.

Helpers genéricos de BRL podem continuar em `src/utils/formFormatting.js`.

Não mover helper genérico para Catalog apenas por ele ser usado pelo formulário.

## 23. Capabilities

A capability existente:

`products.manage`

continua controlando mutações de produtos.

Preservar:

- sem capability, não mostrar/permitir ações de gestão;
- leitura/lista permanece conforme comportamento atual;
- nenhuma nova capability;
- Orders continua podendo consumir catálogo conforme suas próprias capabilities/fluxo de criação, sem depender de `products.manage` para simplesmente visualizar os produtos disponíveis.

Se staging não possuir identidade read-only apropriada, o item manual correspondente deve ser marcado BLOCKED, não PASS.

## 24. Offline e serialização de writes

Offline continua bloqueando writes.

Preservar:

- lista/busca/filtro com estado já carregado;
- adicionar bloqueado;
- editar bloqueado;
- excluir bloqueado;
- seleção pode existir localmente, mas não executar delete offline;
- nenhum POST/PATCH/DELETE offline.

Os commands continuam usando `writesBlocked` + `setRequestKey` para respeitar a serialização global de writes.

Não transformar pending local da tela em substituto do bloqueio global.

Também não ampliar visualmente o bloqueio para estados que hoje não o exibem sem necessidade comportamental comprovada.

## 25. Erros

Preservar o canal atual `showApiError`/feedback global.

### 25.1 404 update/delete

Se o Worker retornar `PRODUCT_NOT_FOUND`:

- não aplicar efeito oficial de sucesso;
- manter/fechar editor somente conforme o fluxo atual de erro, nunca como sucesso;
- exibir erro pelo canal normalizado;
- bootstrap subsequente permanece autoridade para corrigir estado stale.

### 25.2 Validação

Validação de apresentação continua antes do submit na UI e novamente no Worker.

C8 não remove a autoridade backend.

### 25.3 Resultado incerto

Não criar protocolo novo de unknown result para CRUD de produto.

## 26. App.jsx após C8

O App pode continuar responsável por:

- receber `products[]` do operational runtime;
- derivar `canManageProducts`;
- manter query state por destino;
- compor `CatalogWorkspace`;
- injetar `currency`, feedback e runtime adapters.

O App não deve continuar possuindo:

- `editingProductId`;
- `showProductForm`;
- `newProduct`;
- `emptyProduct`;
- editor/modal de produto;
- product payload builder;
- create/update/delete HTTP;
- success messages específicos dentro de handlers de produto;
- `updateCollection('products', ...)`;
- `removeById` para produto;
- import de `ProductForm`;
- import de `Products` pelo caminho legado.

## 27. Logout/reset

Hoje `clearBusinessData` fecha diretamente `showProductForm`.

Após C8, o estado transitório do editor deve desaparecer naturalmente quando o workspace/sessão desmontar.

Não criar bridge de reset App → Catalog se a desmontagem já preservar a semântica correta.

Testar explicitamente para evitar editor de produto sobrevivendo entre sessões.

## 28. CSS

C8 prioriza movimentação JS/JSX.

Podem permanecer em seus locais atuais:

- `src/product-form.css`;
- `src/product-selection.css`.

Preservar import order/cascade.

Não mover CSS apenas para “combinar” com a nova pasta.

Cleanup estrutural geral de CSS continua C10.

## 29. Worker, schema e migrations

C8 não exige mudança funcional em:

- `worker/index.js`;
- `worker/repositories.js`;
- `worker/validation.js`;
- migrations;
- schema D1.

O módulo `shared/productCatalog.js` pode ser **narrowed** para retirar metadata exclusiva do frontend, mas:

- exports usados pelo Worker continuam semanticamente idênticos;
- worker product tests devem permanecer verdes;
- nenhuma nova migration é aprovada.

## 30. Legacy API cleanup

Após migração dos consumidores, remover de `src/api/client.js`:

- `createProduct`;
- `updateProduct`;
- `deleteProduct`.

Não criar reexports de compatibilidade.

APIs de printing permanecem para C9.

Reexports generic/auth permanecem para C10.

## 31. Compatibility ledger

C8 deve fechar o debt:

`updateCollection runtime escape hatch → Catalog/products remain → C8`.

Após C8:

- customer usage continua removido;
- product usage está removido;
- runtime escape hatch está removido;
- o ledger marca `updateCollection` como **REMOVED IN C8 / architecture-enforced**.

`shared/productCatalog.js` não é facade temporária se permanecer com consumidores reais no Worker.

Deve ser documentado como contrato cross-runtime permitido, restrito aos exports realmente compartilhados.

## 32. Architecture gates

C8 deve adicionar checks permanentes.

No mínimo:

1. consumidores externos de Catalog não podem deep-importar internals;
2. Catalog não importa Orders de nenhuma forma;
3. Orders só cruza Catalog pelo public entry;
4. `src/pages/Products.jsx` não pode reaparecer como owner;
5. `src/components/ProductForm.jsx` não pode reaparecer como owner;
6. `src/api/client.js` não pode reexportar product CRUD;
7. `App.jsx` não pode recuperar state/handlers/editor de produto;
8. `updateCollection('products', ...)` não pode reaparecer;
9. o runtime não deve voltar a expor `updateCollection`;
10. frontend externo a Catalog não deve consumir diretamente `shared/productCatalog.js`;
11. `shared/productCatalog.js` não deve voltar a acumular metadata exclusivamente frontend como ícones/options/sugestão de UI;
12. Catalog domain layer não importa infrastructure, React ou browser APIs;
13. Catalog não importa printing/QZ/Finance/Table Service.

Evitar regex frágeis quando o checker estrutural puder expressar a regra.

## 33. Estratégia de testes

### 33.1 Cross-runtime

Testar:

- lista fixa de categorias;
- validação de unit/size/volume/weight;
- decimal com vírgula/ponto;
- zero/inválido;
- units válidas;
- derive legacy size;
- formatter de apresentação;
- Worker continua consumindo o contrato compartilhado.

### 33.2 Domain/frontend metadata

Testar:

- fallback `Outros`;
- sugestão por categoria;
- opções/ícones esperados;
- projeção de busca;
- filtro;
- agrupamento;
- categoria legada desconhecida.

### 33.3 API

Testar:

- rotas/métodos;
- encoding de id;
- payload create/update;
- delete;
- propagação de erro.

### 33.4 Commands

Testar:

- capability;
- offline/writesBlocked;
- request keys;
- create effect;
- update effect;
- `deletedProductId`;
- feedback;
- erro não produz efeito oficial.

### 33.5 Editor

Testar:

- abrir novo;
- preço visível inicial zero;
- abrir edição;
- structured presentation;
- legacy size fallback;
- legacy category fallback;
- cancel;
- payload;
- validação;
- produto em edição excluído.

### 33.6 Products UI

Testar:

- busca;
- filtro;
- accordion;
- overflow;
- delete cancel/confirm;
- explicit multi-select;
- long press;
- bulk delete sequencial;
- toolbar sticky/portal mobile;
- capability;
- offline;
- empty state.

### 33.7 Orders integration

Testar:

- Orders importa Catalog pelo public entry;
- busca por produto/categoria/apresentação;
- categorias disponíveis;
- add/decrease;
- cart quantity;
- nenhuma importação de Catalog infrastructure/internals;
- checkout/snapshot sem regressão.

### 33.8 Characterization tests existentes

Testes relevantes devem ser migrados/alinhados, não apagados para fazer a suíte passar:

- `shared/productCatalog.test.js`;
- `worker/productValidation.test.js`;
- `worker/productPresentationRepository.test.js`;
- `worker/productPresentationMigration.test.js`;
- `src/productCatalogUi.test.js`;
- `src/pages/ProductsUx.test.js`;
- `src/pages/ClientsProductsMobile.test.js`;
- `src/productFormFocusRegression.test.js`;
- `src/productSelectionFeedback.test.js`;
- `src/catalogLocalOrdersIntegration.test.js`;
- testes de navigation/query/capabilities que referenciem o path legado de Products/ProductForm.

## 34. TDD

Cada boundary relevante segue:

1. teste RED;
2. confirmar falha pelo motivo arquitetural/comportamental esperado;
3. commit/push do RED autoritativo;
4. implementação mínima;
5. focused GREEN;
6. commit GREEN;
7. exact-SHA Validate remoto;
8. registrar evidência no execution ledger.

Não aceitar RED causado por:

- JSX no runner Node sem suporte;
- parser;
- import path quebrado acidental;
- fixture inválida;
- assert obsoleto não relacionado ao objetivo.

Characterization path alignment deve ser rastreável e não mascarar regressão de produção.

## 35. Full gate

Antes de staging, exigir no exact candidate SHA:

```bash
npm test
npm run lint
npm run test:architecture
npm run build
npm run d1:migrate:local
```

E os dry-runs production/staging do workflow `Validate application`.

Auditar também:

- zero mudança funcional de Worker;
- zero migration nova;
- zero alteração de schema;
- zero antecipação de Spec D;
- zero ownership de printing/QZ;
- zero mudança financeira;
- zero mudança de lifecycle/checkout de Orders;
- zero redesign visual;
- zero facade temporária nova sem ledger.

## 36. Homologação staging

Após tasks funcionais/arquiteturais GREEN e full gate:

1. dispatch manual de `Deploy staging` na branch exata;
2. registrar run + exact SHA;
3. confirmar migrations remotas sem pendência inesperada;
4. confirmar real login smoke;
5. executar matriz manual.

### 36.1 Matriz mínima C8

1. abrir Produtos desktop;
2. buscar por nome;
3. buscar por categoria;
4. buscar por apresentação;
5. buscar por preço conforme semântica atual;
6. filtrar `Todos`;
7. filtrar uma categoria;
8. expandir/recolher accordion;
9. criar produto Unidade;
10. criar produto Tamanho P/M/G;
11. criar Tamanho Outro;
12. criar Volume com vírgula;
13. criar Peso;
14. validar bloqueio de apresentação inválida;
15. editar produto estruturado;
16. editar produto legado disponível, se existir fixture adequada;
17. abrir exclusão simples e cancelar;
18. excluir produto e confirmar;
19. seleção múltipla desktop;
20. exclusão em massa;
21. long press/seleção mobile;
22. toolbar mobile sem clipping em 320–640 px;
23. formulário mobile e teclado decimal;
24. offline: leitura/busca/filtro funciona e writes bloqueados;
25. Novo Pedido: busca produto;
26. Novo Pedido: filtro/categoria e apresentação corretos;
27. Novo Pedido: adicionar, aumentar e diminuir quantidade;
28. create/update/delete refletidos no estado oficial e após sync;
29. logout/login não preserva editor indevidamente;
30. capability/read-only, se houver identidade apropriada; caso contrário BLOCKED.

## 37. Não objetivos

C8 não inclui:

- produto pai com variantes;
- option groups;
- modifiers/complementos configuráveis;
- pricing engine;
- preço por ingrediente;
- regras de marmita compostas;
- categorias customizáveis;
- reorder de produtos/categorias;
- imagens de produto;
- disponibilidade/estoque;
- SKU/código de barras;
- descrição comercial nova;
- importação/exportação de catálogo;
- bulk API de delete;
- restore de produto excluído;
- hard delete;
- nova migration;
- mudança no checkout;
- redesign da tela Produtos;
- redesign do seletor de produtos em Novo Pedido;
- C9 Printing;
- C10 cleanup geral.

Esses temas exigem specs próprias ou a futura Spec D.

## 38. Critérios de aceite arquitetural

C8 só pode ser considerada pronta para homologação quando:

1. `domains/catalog/index.js` existe e é deliberado;
2. Catalog possui API própria;
3. Catalog possui UI administrativa própria;
4. Catalog possui editor/application próprios;
5. App não possui CRUD/editor/payload de produto;
6. product CRUD saiu de `src/api/client.js`;
7. `src/pages/Products.jsx` legado não é owner;
8. `src/components/ProductForm.jsx` legado não é owner;
9. Orders não importa Catalog internals/infrastructure;
10. Catalog não importa Orders de nenhuma forma;
11. Orders consome os helpers públicos de catálogo via `domains/catalog/index.js`;
12. `updateCollection('products', ...)` não existe;
13. runtime suporta `deletedProductId`;
14. runtime não expõe mais `updateCollection`;
15. `shared/productCatalog.js` fica restrito ao contrato cross-runtime real;
16. metadata exclusivamente frontend pertence a Catalog;
17. architecture gates bloqueiam reintrodução do debt C8;
18. full gates estão verdes.

## 39. Critérios de aceite comportamental

Além dos gates automáticos:

- create funciona;
- update funciona;
- delete funciona;
- busca funciona;
- filtro funciona;
- accordions funcionam;
- apresentação/validação funciona;
- BRL funciona;
- fallback legado funciona;
- seleção múltipla funciona;
- bulk delete funciona;
- mobile/desktop permanecem equivalentes;
- offline funciona;
- capability funciona ou é formalmente BLOCKED por falta de identidade;
- Novo Pedido continua localizando e adicionando produtos corretamente;
- nenhum FAIL manual fica aberto.

## 40. Fechamento da slice

Depois da homologação:

- criar `docs/superpowers/qa/spec-c8-catalog-qa.md`;
- atualizar execution ledger;
- atualizar compatibility ledger;
- atualizar rollout;
- executar status-only exact-head Validate;
- pedir autorização explícita de merge;
- mergear PR da C8;
- confirmar post-merge Validate de `master`;
- não fazer deploy de produção como parte normal da C8.

A C9 só parte da `master` mergeada/validada da C8.

## 41. Decisões normativas consolidadas

1. **Catalog é domínio; Produtos não é apenas uma page.**
2. **C8 trabalha somente sobre o modelo atual de produtos.**
3. **Spec D não será antecipada.**
4. **`shared/productCatalog.js` permanece como contrato cross-runtime porque o Worker o consome de verdade.**
5. **Metadata exclusiva de frontend sai de `shared/productCatalog.js` e passa a Catalog.**
6. **Frontend externo a Catalog consome o public entry; Worker continua consumindo shared diretamente.**
7. **OrderProductCatalog permanece em Orders**, pois coordena seleção/carrinho do pedido.
8. **Orders usa somente contratos públicos de Catalog.**
9. **Delete de produto ganha `deletedProductId` em official effects.**
10. **O escape hatch `updateCollection` termina em C8**, após o último debt documentado de products.
11. **Query state permanece em navegação/composição; busca/filtro/agrupamento pertencem a Catalog.**
12. **Helpers genéricos de moeda permanecem genéricos.**
13. **CSS não será reorganizado agressivamente.**
14. **Nenhuma mudança funcional de Worker/schema/migration é aprovada.**
15. **Nenhum código funcional começa antes da aprovação explícita desta spec e do plano C8.**

## 42. Próximo passo após aprovação

Após aprovação desta spec:

1. escrever o plano detalhado `docs/superpowers/plans/2026-09-19-frontend-modularization-c8-catalog-plan.md`;
2. decompor a migração em tasks TDD pequenas;
3. autorrevisar o plano contra esta spec, rollout, ledgers e GitHub;
4. pedir aprovação do plano;
5. somente então iniciar Task 1 RED.

Nenhuma task funcional da C8 começa durante a fase de design.

## 43. Autorrevisão formal — 2026-09-19

A spec foi revisada contra o estado real do repositório e os contratos existentes antes de ser apresentada para aprovação.

### 43.1 Fontes revisadas

- Spec C arquitetural;
- rollout C1–C10;
- execution ledger;
- compatibility facade ledger;
- PR #51 e merge pós-C7 no GitHub;
- Validate application #1429 / run `35459175985`;
- `src/App.jsx`;
- `src/pages/Products.jsx`;
- `src/components/ProductForm.jsx`;
- `src/app/runtime/data/useOperationalDataRuntime.js`;
- `src/api/client.js`;
- `shared/productCatalog.js`;
- `worker/index.js`;
- `worker/validation.js`;
- `worker/repositories.js`;
- testes de produto do Worker;
- `src/domains/orders/ui/components/OrderProductCatalog.jsx`;
- query state de navegação;
- architecture checker e seus testes;
- characterization/UI regressions atuais de Produtos.

### 43.2 Achados e resoluções

1. **Base confirmada.** PR #51 está mergeado/fechado e o novo master exato é `a7a8285ee125d90058c739f52daba6c170921adb`; Validate #1429 passou nesse SHA.
2. **Ledger pós-merge está defasado.** A spec tornou a reconciliação documental um pré-requisito explícito antes da Task 1 funcional.
3. **`shared/productCatalog.js` tem consumidores Worker reais.** Portanto ele não pode ser movido integralmente para Catalog.
4. **Há metadata apenas frontend dentro do shared.** Ícones, options, fallback visual e sugestão de apresentação devem receber owner em Catalog, mantendo shared restrito ao contrato cross-runtime.
5. **Delete é o último debt documentado de `updateCollection`.** A solução normativa é `deletedProductId` em official effects e remoção do escape hatch do runtime após migrar products.
6. **`OrderProductCatalog` deve continuar em Orders.** Ele coordena seleção e carrinho do pedido; apenas seus contratos de apresentação de produto passam a vir do public entry de Catalog.
7. **Não há dependência legítima Catalog → Orders.** A direção é unidirecional Orders → Catalog public entry.
8. **Query state de Produtos já pertence à navegação.** C8 não deve mover `search/categoryFilter` para uma store de domínio; Catalog recebe estado e callbacks e possui a projeção.
9. **Nenhuma mudança de Worker/schema/migration é necessária.** O contrato atual já cobre categorias/apresentações e soft delete.
10. **A Spec D permanece fora de escopo.** Variantes, grupos de opções e pricing extensível não são antecipados.
11. **O preço inicial tinha um detalhe interno enganoso.** App semeia um valor antigo, mas `ProductForm` normaliza o novo produto para `R$ 0,00`; a spec preserva o comportamento observável, não o seed invisível.
12. **Exclusão possui edge cases observáveis.** O dialog simples fecha após callback resolvido mesmo em falha controlada, e o bulk segue sequencialmente; ambos foram explicitados para a refatoração não alterar UX por acidente.
13. **Não foi encontrada contradição arquitetural pendente** após essas correções.

### 43.3 Conclusão da autorrevisão

Com os ajustes acima, esta spec está internamente consistente com a Spec C, com a base pós-C7 e com o código real auditado.

Ela está pronta para aprovação de design. O plano detalhado C8 só deve ser escrito após essa aprovação, e código funcional continua bloqueado até aprovação subsequente do plano.
