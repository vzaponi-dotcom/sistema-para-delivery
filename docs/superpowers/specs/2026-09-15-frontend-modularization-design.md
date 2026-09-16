# Spec C — Modularização do frontend e separação de responsabilidades

**Projeto:** Gestão Delivery / Amor & Sabor  
**Repositório:** `vzaponi-dotcom/sistema-para-delivery`  
**Data:** 15/09/2026  
**Base inspecionada:** `master` em `af8266549603fc2d392880c812bc1c0d608a6dbc`  
**Branch documental:** `docs/spec-c-frontend-modularization`  
**Estado:** desenho arquitetural aprovado em conversa; documentação para revisão antes do plano de implementação.  
**Natureza desta entrega:** documentação. Não autoriza implementação, merge ou deploy.

---

## 1. Objetivo

A Spec C reorganiza o frontend do Gestão Delivery para reduzir acoplamento, distribuir responsabilidades por domínio e tornar mudanças futuras mais locais, testáveis e previsíveis.

O objetivo **não** é simplesmente dividir arquivos grandes ou aumentar a quantidade de pastas. O objetivo é chegar a um monólito serverless modular orientado ao domínio, pragmaticamente inspirado em DDD, no qual:

- `App.jsx` deixa de concentrar regras e operações de múltiplas áreas;
- regras puras ficam próximas do domínio que as possui;
- a UI deixa de conhecer detalhes de infraestrutura;
- operações que cruzam domínios ficam numa camada explícita de aplicação;
- o runtime central continua coordenando sessão, bootstrap e sincronização oficial;
- infraestrutura como HTTP, browser storage e QZ fica separada das regras operacionais;
- dependências arquiteturais passam a ser verificáveis por gates automáticos;
- cada fatia pode ser testada, homologada e integrada independentemente.

A redução de tamanho de `App.jsx` é uma consequência desejada, não a métrica primária de sucesso.

---

## 2. Escopo e invariantes

### 2.1 Escopo técnico

A Spec C atua sobre o **frontend e infraestrutura cliente**:

- `src/App.jsx` e composição de alto nível;
- `src/app`;
- `src/api`;
- `src/pages`;
- `src/components`;
- `src/printing`;
- hooks e utils relacionados;
- organização de testes do frontend;
- guards arquiteturais do frontend.

O `worker/` e o backend ficam fora da refatoração, exceto por ajuste mínimo estritamente necessário para preservar um contrato existente. A Spec C não é uma refatoração conjunta frontend + Worker.

### 2.2 Preservação estrita

Durante toda a Spec C:

- **não há redesign**;
- **não há nova UX intencional**;
- **não há feature nova**;
- **não há mudança de regra de negócio**;
- **não há mudança deliberada de fluxo**;
- **não há troca de tecnologia de estado global**;
- **não há migração para React Router**;
- light/dark, desktop/mobile e textos funcionais devem permanecer equivalentes;
- contratos de API, polling, storage keys, capabilities e sincronização devem ser preservados salvo necessidade técnica documentada.

Qualquer melhoria funcional ou visual descoberta durante C deve virar issue/spec separada.

### 2.3 Estado e bibliotecas

A Spec C não adiciona Redux, Zustand ou outra biblioteca de estado global. O frontend continua usando React, hooks/controllers e providers pequenos quando necessários.

### 2.4 Backend como autoridade

O backend continua sendo autoridade sobre o estado oficial. A reorganização do frontend não cria regras concorrentes nem cópias independentes de verdade por domínio.

---

## 3. Evidência da base atual

Na base inspecionada:

- `src/App.jsx` tem aproximadamente 89 KB e concentra autenticação, bootstrap, sincronização, coleções oficiais, capabilities, pagamentos, clientes, produtos, financeiro, comandas, settings, impressão, modais e renderização das principais superfícies;
- `src/app/` já contém seams úteis como navegação, settings state/conflict/pending recovery, controllers e effective config;
- `src/api/client.js` agrega endpoints de múltiplos domínios no mesmo arquivo;
- `src/printing/usePrintingManager.js` já concentra muita lógica operacional, mas também importa diretamente `qz-tray` e detalhes de browser/plataforma;
- `AppShell` já está separado e controla shell desktop/mobile;
- a Spec B deixou controllers e mecanismos de settings relativamente maduros;
- impressão possui uma arquitetura operacional relevante que deve ser preservada;
- a Spec A já definiu que C deve separar responsabilidades do `App.jsx` sem copiar a hierarquia visual do menu para a arquitetura de pastas.

A base atual portanto não exige reescrita; ela já possui módulos aproveitáveis que devem ser realocados e desacoplados incrementalmente.

---

## 4. Arquitetura-alvo

A direção arquitetural é:

```text
src/
  app/
    runtime/
    navigation/
    workflows/
    shell/
    surfaces/

  domains/
    orders/
    table-service/
    finance/
    customers/
    catalog/
    printing/

  infrastructure/
    api/
    auth/
    storage/
    qz/
    realtime/

  shared/
    ui/
    hooks/
    utils/
```

Essa árvore é um destino arquitetural, não uma obrigação de criar todas as pastas no primeiro PR.

A estrutura física deve refletir ownership e direção de dependência, não estética.

---

## 5. Fronteiras de domínio

### 5.1 `orders`

`orders` é um único domínio responsável pelo ciclo do pedido no frontend.

Inclui:

- Novo Pedido;
- Cozinha;
- Histórico;
- status/ciclo de vida;
- regras operacionais da fila;
- agendados/timing consumido pelo frontend;
- elegibilidade relacionada ao pedido;
- cancelamento como regra do ciclo do pedido;
- contratos públicos necessários a outras superfícies.

Não criar domínio separado `kitchen` apenas porque existe uma tela Cozinha.

A futura Kitchen TV será uma segunda superfície que consome regras públicas de `orders`, sem reutilizar a UI administrativa.

### 5.2 `table-service`

`table-service` reúne:

- Mesas;
- Comandas;
- `tableTabs`;
- identidade do atendimento em mesa;
- ocupação;
- transferência;
- fechamento/seleção operacional relacionados ao atendimento em mesa.

Mesas e Comandas permanecem telas distintas para o usuário, mas pertencem ao mesmo contexto operacional no código.

### 5.3 `finance`

`finance` reúne:

- Financeiro / Movimentações;
- A Receber;
- saldo e cálculos financeiros;
- entradas/saídas;
- projeções financeiras;
- regras financeiras de estorno/refund;
- categorias financeiras enquanto política pertencente ao domínio financeiro.

Pagamento **não** vira um domínio separado. Operações que atravessam `orders`, `finance` e `table-service` ficam em workflows de aplicação.

### 5.4 `customers`

`customers` é dono de:

- lista e busca de clientes;
- criação/edição/exclusão;
- identidade/duplicidade de cliente;
- contratos de API de clientes no frontend.

Não criar domínio genérico `cadastros`.

### 5.5 `catalog`

`catalog` é dono do catálogo/produtos atual e será a fronteira que receberá a futura Spec D.

Nesta spec C:

- não implementar variantes, option groups ou pricing extensível;
- não antecipar o modelo da Spec D;
- apenas criar uma fronteira clara para produtos/catálogo existentes.

### 5.6 `printing`

`printing` é um domínio operacional, não apenas infraestrutura.

É dono de regras e coordenação relacionadas a:

- print jobs;
- fila;
- 1/2 vias;
- segunda via;
- retry;
- reprint;
- recovery;
- resultado desconhecido;
- afinidade do job durante recuperação;
- estado operacional da estação enquanto conceito do sistema;
- regras de elegibilidade para operações de impressão.

QZ não pertence ao domínio: QZ é um adapter de infraestrutura.

---

## 6. O que não vira domínio

### 6.1 Configurações

Configurações é uma **superfície de composição**, não o dono de todas as políticas.

A UI continua única para o usuário, mas o ownership é distribuído:

- Operação/modalidades e cancelamentos → `orders` quando forem regras do ciclo operacional;
- categorias financeiras → `finance`;
- política de impressão → `printing`;
- preferências locais de dispositivo → app/infrastructure;
- mecanismos genéricos de edição versionada → camada compartilhada de aplicação.

A robustez da Spec B — draft, revision otimista, conflict, reconcile, pending recovery e save explícito — deve ser preservada.

### 6.2 Dashboard / Visão geral

Dashboard é uma **superfície de composição**. Ele consome contratos públicos de `orders`, `finance` e outros módulos necessários sem virar `domains/dashboard`.

### 6.3 Sessão/auth/capabilities

Sessão, login, logout, expiração e capabilities atuais ficam em `app/runtime` + infraestrutura de auth. Não criar `domains/users` ou `domains/access` nesta spec.

A futura modelagem de usuários/perfis está registrada na Issue #44.

---

## 7. Runtime central

O runtime central preserva a coordenação oficial do sistema sem virar um novo monólito.

Direção conceitual:

```text
AppRoot
  ├─ SessionProvider
  ├─ OperationalDataProvider
  ├─ NavigationProvider
  ├─ FeedbackProvider
  └─ AppShell / surfaces
```

Os nomes exatos podem mudar depois do dependency map. O importante é a responsabilidade.

### 7.1 Session runtime

Responsável por:

- sessão atual;
- login/logout;
- capabilities atuais;
- expiração;
- geração/contexto de sessão necessário aos consumidores.

Não conhece regras de pedido, financeiro ou impressão.

### 7.2 Operational data runtime

Responsável por:

- `/api/bootstrap` da aplicação administrativa;
- coleções oficiais;
- refresh/bootstrap silencioso;
- polling atual;
- sync guards;
- ownership/in-flight protection;
- aplicação coordenada de efeitos oficiais retornados pelo backend;
- revisões/receipts necessários à consistência transversal.

Ele não deve decidir regras de domínio. Exemplo: ele sabe que existe `orders[]`, mas não é dono de `isOrderActive`.

### 7.3 Navigation runtime

Mantém o mecanismo atual baseado em `activeTab`/`useNavigationController` durante C.

Deve isolar:

- registro de destinos;
- guards;
- navegação pendente;
- confirmação de descarte;
- vínculo com capabilities;
- contexto de origem/retorno quando já existente.

Os domínios não devem depender diretamente de `activeTab`, preparando a futura Issue #43.

### 7.4 Feedback runtime

Centraliza feedback global que realmente pertence à aplicação, como toast/sucesso/erros globais, sem absorver regras de negócio.

### 7.5 Regra contra mega context

É proibido substituir `App.jsx` por um `AppRuntimeContext` que exponha tudo:

```text
orders, clients, products, finance, printing, settings,
navigation, session, modals, pagamentos, ...
```

Consumers devem acessar contratos pequenos e específicos.

---

## 8. Fluxo de dados

Fluxo de leitura:

```text
Worker/API
  ↓
runtime sync
  ↓
estado oficial
  ↓
domínio/application
  ↓
UI
```

Fluxo de mutação:

```text
UI
  ↓
controller/workflow
  ↓
API específica do domínio
  ↓
resultado oficial
  ↓
runtime aplica efeitos oficiais
  ↓
consumidores observam novo estado
```

A Spec C não permite que cada domínio crie seu próprio `/api/bootstrap`, polling ou store oficial independente.

---

## 9. Workflows transversais

Operações que atravessam fronteiras ficam em `app/workflows`.

Exemplo principal: pagamentos.

### 9.1 Pagamento de pedido

Pode afetar:

- `orders`;
- `finance`.

### 9.2 Pagamento de comanda

Pode afetar:

- `orders`;
- `finance`;
- `table-service`.

### 9.3 Cancelamento + estorno

A regra de ciclo do pedido fica em `orders`; a consequência financeira fica em `finance`; a coordenação conjunta pode ficar em workflow.

### 9.4 Garantias existentes a preservar

Ao extrair workflows críticos, preservar:

- ownership da tentativa;
- prevenção de submissão concorrente indevida;
- resultado aceito não ser perdido por troca de UI;
- reconcile posterior;
- proteção contra resposta velha aplicada à nova seleção;
- tratamento de conflito/409;
- bloqueios de nova operação quando uma obrigação aceita ainda sincroniza;
- feedback e estado de request equivalentes ao comportamento atual.

A Spec C não simplifica esses fluxos durante a extração.

### 9.5 Regra contra God workflow

`app/workflows` não pode virar um `systemController.js` genérico. Cada workflow representa uma operação transversal clara.

---

## 10. Infrastructure e adapters

### 10.1 HTTP genérico

Criar uma camada genérica em direção a:

```text
src/infrastructure/api/httpClient.js
```

Ela conhece apenas:

- `fetch`;
- headers;
- JSON/text;
- credentials;
- normalização de erro HTTP.

### 10.2 APIs específicas por domínio

Endpoints específicos ficam próximos do domínio:

```text
domains/orders/infrastructure/ordersApi.js
domains/customers/infrastructure/customersApi.js
domains/finance/infrastructure/financeApi.js
domains/printing/infrastructure/printingApi.js
```

O `src/api/client.js` atual deve ser desmontado gradualmente, com fachadas temporárias quando necessário.

### 10.3 Storage

`localStorage` e `sessionStorage` devem ser isolados quando forem detalhe ambiental que dificulta teste ou acopla regra pura ao browser.

Não criar uma framework genérica de storage. Usar adapters pequenos e pragmáticos.

### 10.4 Realtime/polling

Não introduzir WebSocket/SSE na Spec C.

Preservar intervalos e semânticas atuais. Separar “quando sincronizar” de “qual é a regra do domínio”.

### 10.5 Browser APIs

Detalhes como `AudioContext`, `navigator.onLine`, `document.visibilityState`, `beforeunload` e outras APIs do browser devem ser isolados quando impedirem teste ou misturarem domínio puro com ambiente.

Não criar wrappers sem necessidade.

---

## 11. Printing x QZ

A separação deve permitir trocar o transporte físico no futuro sem reescrever o domínio de impressão.

Direção:

```text
domains/printing
      ↓
contrato de transporte
      ↓
infrastructure/qz
```

QZ conhece:

- `qz-tray`;
- conexão;
- certificados/assinatura;
- descoberta da impressora;
- envio físico de bytes;
- status físico suportado;
- detalhes Windows/QZ.

O domínio de impressão não deve importar `qz-tray` diretamente.

O contrato pode ser implementado por um objeto simples; não exigir classes ou abstrações formais desnecessárias.

Conceitualmente pode expor capacidades como:

```text
connect()
isReady()
listPrinters()
print(payload)
getPrinterStatus()
```

No futuro:

```text
printing
  ↓
PrintTransport
  ├─ QZTransport
  └─ ProfessionalPrinterTransport
```

Capacidades novas de uma impressora profissional — corte automático, telemetria melhor, conexão de rede — devem entrar como capacidades do adapter quando possível, e não como reconstrução da fila.

---

## 12. Engine compartilhada de edição de políticas

A Spec B criou um mecanismo robusto para settings tipadas. A Spec C deve separar o mecanismo genérico do ownership das políticas.

Uma camada compartilhada de aplicação pode cuidar de:

- load;
- draft;
- dirty;
- save;
- expected revision;
- conflict;
- conflict review;
- unknown result;
- pending recovery;
- reconcile;
- guards de abandono.

Cada domínio define seus dados, validações e ownership.

A superfície Configurações compõe os editores.

Não duplicar controllers completos por domínio apenas para evitar reuso; também não manter `settings` como domínio centralizador de regras que pertencem a outros domínios.

---

## 13. Estrutura interna dos domínios

Estrutura conceitual:

```text
domains/<domain>/
  domain/
  application/
  infrastructure/
  ui/
  index.js
```

Nem toda pasta precisa existir se o domínio não tiver conteúdo real para ela.

### 13.1 `domain/`

Contém regras puras.

Não importa:

- React;
- React DOM;
- UI;
- `fetch`;
- QZ;
- storage do browser;
- DOM/browser APIs.

### 13.2 `application/`

Coordena casos de uso internos do domínio e pode conter controllers/hooks. Pode conhecer React quando o módulo for explicitamente um hook, mas não contém markup.

### 13.3 `infrastructure/`

Contém adapters específicos do domínio, por exemplo APIs HTTP daquele domínio.

### 13.4 `ui/`

Contém páginas/componentes pertencentes ao domínio. Não chama D1, `fetch` cru ou QZ diretamente.

### 13.5 Contrato público

Cada domínio possui entry point público deliberado, por exemplo:

```text
domains/orders/index.js
```

Consumidores externos não importam internals do domínio.

Dentro do próprio domínio, imports relativos internos são permitidos e não precisam passar pelo `index.js`.

O `index.js` não deve reexportar tudo indiscriminadamente.

---

## 14. `shared/`

`shared/` recebe apenas código realmente genérico e sem dono de domínio.

Exemplos válidos:

- Button;
- Modal;
- SystemSelect;
- helpers genéricos de UI;
- formatação sem semântica de domínio;
- hooks genéricos de browser/UI.

Exemplos que não devem permanecer em `shared/` se houver owner claro:

- order lifecycle;
- table-tab payment;
- print recovery;
- finance balance;
- regras de catálogo.

`shared/` não importa `domains/`.

Módulos fora de `src` que são realmente compartilhados com o Worker podem permanecer onde estão nesta spec para evitar refatoração do backend.

---

## 15. Surfaces de aplicação

Superfícies que agregam múltiplos domínios podem ficar em direção a:

```text
app/surfaces/settings/
app/surfaces/dashboard/
```

Surface não é domínio.

Ela pode compor contratos públicos de múltiplos domínios, mas não deve virar dona das regras que agrega.

---

## 16. CSS e preservação visual

A Spec C não deve mover CSS agressivamente durante as primeiras fatias.

Motivo: ordem de import, especificidade e cascata podem mudar o visual mesmo quando o JSX aparenta estar equivalente.

Estratégia:

1. mover primeiro responsabilidades JS/JSX;
2. manter imports/cascata atuais sempre que possível;
3. deixar reorganização de CSS para uma etapa final específica;
4. exigir regressão visual proporcional antes de considerar a reorganização de estilos concluída.

Não há obrigação de tornar todo CSS co-localizado se isso aumentar risco sem benefício arquitetural real.

---

## 17. Estratégia de testes

### 17.1 Testes acompanham o domínio

Quando um módulo for migrado, seus testes específicos migram junto.

Testes de integração entre áreas permanecem em camada de app/integration apropriada.

### 17.2 Testes puros

Regras que não precisam de React, API ou browser devem preferencialmente ser testadas como funções puras.

### 17.3 Controllers/workflows

Garantias de orquestração devem ter testes de comportamento observável, especialmente:

- pagamentos;
- comanda;
- sync;
- sessão;
- printing;
- navegação com drafts.

### 17.4 Characterization tests

Antes de extrair fluxos muito acoplados do `App.jsx`, adicionar testes de caracterização quando a cobertura atual não provar suficientemente o comportamento homologado.

O teste registra o comportamento atual antes da movimentação.

### 17.5 Execução rápida por domínio

Cada domínio deve ser organizável de forma que seus testes possam ser executados isoladamente durante desenvolvimento.

Objetivo operacional:

```text
mudança em customers
  ↓
testes de customers
  ↓
feedback rápido
```

A suíte completa continua sendo gate de integração/release.

A Spec C deve incluir uma estratégia de execução que permita, quando viável, scripts/comandos focados por domínio sem enfraquecer `npm test` completo.

### 17.6 CI e crescimento da suíte

A suíte vai crescer conforme o produto cresce. A arquitetura deve permitir futura paralelização de jobs por domínio, caching e seleção de testes afetados, sem remover o gate completo antes de merge/release.

O plano pode propor otimizações leves de CI se forem consequência direta da modularização, mas não deve transformar C num projeto separado de CI.

---

## 18. Architectural gates

Adicionar checks automáticos permanentes para impedir regressão arquitetural.

Regras mínimas:

- `shared/` não importa `domains/`;
- `domains/*/domain/` não importa React;
- `domains/*/domain/` não importa UI;
- `domains/*/domain/` não importa `qz-tray`;
- `domains/*/domain/` não usa `fetch` diretamente;
- um domínio não importa internals de outro domínio;
- consumidores externos usam contratos públicos;
- detectar ciclos relevantes entre domínios/camadas;
- QZ fica restrito à infraestrutura aprovada.

Preferir um script Node simples ou ferramenta leve. Não adicionar dependência pesada sem benefício claro.

Conceitualmente o projeto deve ganhar um gate equivalente a:

```bash
npm run test:architecture
```

E o CI deve executá-lo junto aos gates existentes.

---

## 19. Migração incremental e fachadas de compatibilidade

A Spec C usa **strangler refactor**.

Ao mover um módulo, o caminho antigo pode permanecer temporariamente reexportando o novo módulo.

Exemplo conceitual:

```js
// caminho antigo temporário
export * from '../domains/...'
```

Cada facade temporária deve ter:

- motivo;
- consumidores ainda não migrados;
- fatia prevista para remoção.

Manter uma lista rastreável de facades temporárias durante C.

No fechamento de C10:

```text
facades temporárias = 0
```

salvo se alguma tiver sido explicitamente promovida a contrato permanente documentado.

---

## 20. Dependency map antes de C1

Antes do primeiro código da Spec C, produzir um dependency map da `master` corrente no momento de implementação.

O mapa deve identificar pelo menos:

- imports de `App.jsx`;
- consumidores de `src/app/*`;
- consumidores de `src/api/client.js`;
- dependências das principais páginas;
- dependências de `src/printing`;
- regras/utilities compartilhadas com ownership ambíguo;
- ciclos existentes;
- caminhos que exigem mover arquivos juntos;
- fachadas temporárias prováveis.

O dependency map deve ser evidência do plano, não um desenho genérico baseado apenas nesta spec.

---

## 21. Fatiamento aprovado

A Spec C é uma única arquitetura implementada em múltiplos PRs independentes.

Direção inicial:

### C1 — Runtime central

- sessão/auth atual;
- bootstrap;
- sincronização oficial;
- feedback global;
- extração de mechanisms de runtime do `App.jsx` sem mudar comportamento.

### C2 — Navegação e composição

- `AppRoot`/shell;
- isolamento do mecanismo atual de navegação;
- guards e registro de destinos;
- sem React Router.

### C3 — Configurações

- Configurações como surface;
- engine comum de políticas;
- ownership das políticas preparado para os domínios corretos;
- preservação integral das garantias da Spec B.

### C4 — Orders

- Novo Pedido;
- Cozinha;
- Histórico;
- regras operacionais;
- contratos públicos que também servirão à futura Kitchen TV.

### C5 — Table Service

- Mesas;
- Comandas;
- `tableTabs`;
- identidade/seleção/transferência.

### C6 — Finance + workflows

- Financeiro;
- A Receber;
- movimentações;
- workflows de pagamento e outras coordenações transversais necessárias.

### C7 — Customers

- Clientes;
- identidade/duplicidade;
- CRUD e API específica.

### C8 — Catalog

- produtos/catalog atual;
- fronteira preparada para a futura Spec D, sem implementar D.

### C9 — Printing

- domínio operacional de impressão;
- separação QZ/transport;
- preservação de fila, segunda via, recovery, retry/reprint e estação principal.

### C10 — Fechamento arquitetural

- infrastructure/shared cleanup;
- CSS quando seguro;
- remoção de facades;
- gates arquiteturais completos;
- auditoria final de dependências.

A ordem pode receber pequenos ajustes se o dependency map provar dependência real que torne outra sequência mais segura. Qualquer desvio deve ser explicado no plano.

---

## 22. Estratégia de branches e PRs

Cada fatia nasce da `master` que já contém a fatia anterior:

```text
master
  ↓
feature/spec-c1-...
  ↓
PR + staging + homologação
  ↓
merge
  ↓
master atualizada
  ↓
feature/spec-c2-...
```

Não manter uma branch longa acumulando C1–C10.

Cada PR deve ser independente da próxima fatia ainda não integrada.

Não trabalhar diretamente na `master` para implementação.

Produção continua dependendo de autorização explícita.

---

## 23. Critério para cada fatia

Uma fatia só é concluída quando:

- comportamento relevante está protegido por testes;
- testes proporcionais passam;
- suíte ampla necessária à superfície de risco passa;
- lint passa;
- build passa;
- D1/local e Worker gates normais continuam verdes quando executados pelo pipeline;
- architectural checks passam;
- diff foi revisado procurando alterações acidentais em strings, defaults, condições, tempos, endpoints, payloads, capabilities, polling, storage keys e CSS;
- staging foi publicado;
- homologação proporcional foi realizada;
- nenhuma mudança funcional/visual não autorizada foi introduzida.

Homologação proporcional não significa repetir todo o sistema em cada PR.

Exemplos:

- Customers → CRUD, duplicidade, desktop/mobile e navegação relacionada;
- Orders → Novo Pedido, Cozinha, Histórico, agendados, cancelamento e integrações relevantes;
- Printing → regressão operacional mais pesada e rodada física proporcional.

---

## 24. Definição de comportamento preservado

Para as mesmas entradas, sessão/capabilities e estado oficial, devem permanecer equivalentes:

- regras;
- resultados e efeitos observáveis;
- ações permitidas/bloqueadas;
- textos funcionais relevantes;
- navegação atual;
- drafts e confirmações;
- sincronização;
- política de impressão;
- layout/responsividade;
- light/dark;
- efeitos financeiros;
- reconciliação de resultados incertos já implementada.

DOM interno, nomes de arquivos e paths de imports podem mudar.

---

## 25. Decisões deliberadamente adiadas

### 25.1 React Router — Issue #43

A migração para React Router foi deliberadamente adiada.

Issue: **#43 — Modernizar navegação do frontend com React Router após a Spec C**.

Motivo:

- URLs reais, browser history, deep links e refresh por rota são mudanças funcionais de navegação;
- fazer isso junto da desmontagem de `App.jsx` aumentaria o risco;
- C deve isolar `app/navigation` para que a futura migração seja localizada.

### 25.2 Usuários/perfis — Issue #44

A frente de usuários, perfis e autorização granular foi deliberadamente adiada.

Issue: **#44 — Projetar usuários, perfis e autorização granular**.

C apenas prepara sessão/auth/capabilities para serem substituídos/estendidos futuramente.

### 25.3 Kitchen TV

Kitchen TV não é implementada por C.

A spec/plano existentes em `feature/kitchen-tv-display-design` definem uma TV read-only como segunda apresentação das mesmas regras da Cozinha.

Após C, o plano da TV deve ser reconciliado com:

- nova estrutura de `orders`;
- entry points resultantes;
- migrations atuais;
- base final do projeto.

A lógica operacional compartilhada que o plano antigo imaginava em `src/utils/kitchenOperationalQueue.js` deve preferencialmente nascer/terminar sob o ownership correto de `orders`, evitando movimentação dupla.

### 25.4 Spec D

A futura modelagem extensível de catálogo permanece fora de C.

C cria `domains/catalog`; D define entidades, histórico, pricing, UI e migração.

### 25.5 Impressora profissional

A troca de QZ/impressora atual fica fora de C.

C prepara a fronteira de transporte para reduzir o custo dessa evolução.

---

## 26. Riscos

### 26.1 Regressão silenciosa

Maior risco: uma movimentação estrutural alterar comportamento por ordem de efeitos, closure antiga, ownership assíncrono, mudança de import ou default.

Mitigação: characterization tests, TDD quando há mudança de fronteira comportamental, diff check e staging proporcional.

### 26.2 Mega Provider

Risco: mover tudo para um `AppRuntimeProvider` gigantesco.

Mitigação: providers pequenos por responsabilidade e contracts específicos.

### 26.3 Shared como nova gaveta global

Risco: mover regras para `shared/` apenas porque são usadas em mais de um lugar.

Mitigação: ownership explícito e gate `shared -> domains` proibido.

### 26.4 Overengineering

Risco: criar camadas/classes abstratas sem necessidade.

Mitigação: YAGNI; abstração só quando protege fronteira real, melhora teste ou substituibilidade.

### 26.5 Arquitetura apenas de pastas

Risco: arquivos mudarem de pasta, mas imports e responsabilidades continuarem misturados.

Mitigação: gates arquiteturais e aceite baseado em direção de dependência.

### 26.6 Facades permanentes por acidente

Risco: reexports temporários virarem dívida estrutural.

Mitigação: ledger/lista de facades e remoção obrigatória em C10.

### 26.7 CSS

Risco: mudança de ordem da cascata durante movimentos físicos.

Mitigação: CSS estável durante as primeiras fatias e reorganização apenas quando houver regressão visual dedicada.

---

## 27. Estratégia de execução dos testes e impacto no tempo de desenvolvimento

A modularização deve melhorar o tempo de feedback local sem reduzir a segurança final.

Modelo desejado:

### Durante TDD/desenvolvimento

Executar testes do domínio/fatia alterada sempre que possível.

### Antes de fechar tarefa/PR

Executar regressões próximas + lint + architectural gate + build.

### Antes de merge/release

Manter a suíte completa e os gates oficiais:

- `npm test`;
- `npm run lint`;
- `npm run test:architecture` ou equivalente;
- `npm run build`;
- `npm run d1:migrate:local`;
- dry-runs/gates dos workflows atuais;
- staging;
- smoke/homologação proporcional.

O crescimento futuro da suíte não deve ser resolvido removendo cobertura. A estrutura modular deve permitir, futuramente, paralelização de jobs e seleção de testes afetados como otimizações adicionais.

---

## 28. Critérios finais de sucesso

A Spec C só pode ser encerrada quando:

1. `App.jsx`/`AppRoot` estiver reduzido a composição e responsabilidades de alto nível;
2. CRUD e regras de domínios não estiverem mais no App global;
3. sessão, sync, navegação e feedback estiverem isolados por responsabilidade;
4. `orders`, `table-service`, `finance`, `customers`, `catalog` e `printing` estiverem estabelecidos;
5. Dashboard e Configurações forem surfaces, não domínios artificiais;
6. workflows transversais estiverem explicitamente fora dos domínios envolvidos;
7. `src/api/client.js` não continuar sendo o centro permanente de todas as APIs;
8. QZ estiver isolado do domínio de impressão;
9. `shared/` não contiver regras com owner claro;
10. contratos públicos dos domínios estiverem deliberadamente definidos;
11. architectural gates bloquearem imports proibidos e ciclos relevantes;
12. testes tiverem migrado para perto de seus owners quando apropriado;
13. facades temporárias tiverem sido removidas;
14. suíte completa, lint, build, D1/local e workflows oficiais estiverem verdes;
15. staging final estiver homologado;
16. nenhuma mudança funcional/visual não autorizada tiver sido incorporada;
17. decisões adiadas e issues relacionadas estiverem referenciadas;
18. o dependency map final refletir dependências substancialmente mais locais e previsíveis.

---

## 29. Resultado esperado para futuras features

Depois de C, a região natural de mudança deve ser previsível:

```text
nova feature de pedidos
  → domains/orders

nova regra financeira
  → domains/finance

nova impressora
  → novo adapter de infrastructure

Kitchen TV
  → nova surface consumindo orders

Spec D
  → evolução de catalog

React Router
  → app/navigation

usuários/perfis
  → evolução de session/auth sem desmontar App global
```

O ganho esperado é reduzir contexto necessário para desenvolver e revisar features, diminuir conflitos entre trabalhos paralelos, facilitar testes focados e tornar efeitos colaterais menos prováveis.

---

## 30. Não objetivos

A Spec C não entrega por si só:

- React Router;
- URLs/deep links novos;
- usuários/perfis;
- novo sistema de autorização;
- Kitchen TV;
- catálogo extensível da Spec D;
- nova impressora;
- WebSocket/SSE;
- microserviços;
- redesign;
- nova biblioteca de estado;
- refatoração ampla do Worker;
- alteração deliberada de regras de negócio.

---

## 31. Próximo passo após aprovação desta spec

Após revisão/aprovação deste documento:

1. usar a skill `writing-plans`;
2. inspecionar novamente a `master` corrente;
3. produzir dependency map real;
4. transformar C1–C10 em tarefas detalhadas com arquivos, testes RED/GREEN e checkpoints;
5. não iniciar implementação antes da aprovação do plano;
6. executar cada fatia em branch isolada criada da `master` já atualizada pela fatia anterior.
