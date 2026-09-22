# Gestão Delivery — Central de notificações, badges operacionais e top bar global

**Data:** 2026-09-21  
**Status:** SPEC APROVADA  
**Branch:** `feature/notifications-center-shell`

## 1. Objetivo

Criar uma camada global de utilidades do sistema que permaneça disponível em todas as telas internas autenticadas e entregue três capacidades independentes:

1. **badges operacionais na navegação**, inicialmente para Pedidos e Comandas;
2. uma **Central de notificações**, inicialmente alimentada somente por novidades do próprio Gestão Delivery;
3. um **menu da operação** na top bar, representado por `AS ▼` para Amor & Sabor, sem introduzir ainda o conceito de usuário individual.

A primeira versão deve ser simples para o usuário e pequena em infraestrutura, mas deve nascer com contratos que permitam adicionar no futuro notificações de outras fontes sem reescrever a UI.

## 2. Resultado esperado

Após autenticação e bootstrap:

- todas as telas internas usam uma top bar global compacta;
- no desktop, a top bar preserva a sidebar como navegação principal e concentra utilidades à direita;
- no mobile, a top bar apresenta identidade mínima do produto e os mesmos acessos globais;
- o item **Pedidos** da sidebar e da navegação mobile recebe um contador de pedidos operacionais atuais;
- o item **Comandas** recebe um contador de comandas efetivamente abertas;
- o sino mostra quantas notificações permanecem não lidas naquele dispositivo;
- uma nova novidade de versão aparece automaticamente uma única vez naquele dispositivo;
- fechar o aviso automático não o faz reaparecer sozinho, mas mantém a novidade não lida;
- a Central mantém histórico e carrega os itens progressivamente;
- o menu `AS ▼` oferece atalhos da operação sem fingir que existe um perfil de usuário.

## 3. Não objetivos desta versão

Esta entrega não deve:

- criar usuários, funcionários, perfis pessoais, avatares reais ou autenticação individual;
- atribuir ações a pessoas;
- introduzir senha/PIN por funcionário;
- criar RBAC novo ou duplicar regras de capability;
- criar endpoint, tabela D1, migration ou inbox no servidor para notificações;
- criar WebSocket, SSE, push notification ou service worker de notificações;
- transformar o badge de Pedidos em indicador de “não lido”;
- criar busca, filtros avançados ou paginação numerada na Central;
- criar uma página dedicada de Notificações;
- mover navegação existente para a top bar;
- substituir Sidebar ou MobileNavigation;
- usar `package.json.version` como versão comercial do produto enquanto ele permanecer em `0.0.0`.

## 4. Base arquitetural atual

A solução deve respeitar os limites já consolidados pela Spec C.

### 4.1 Shell

- `AppRoot` decide login, carregamento e estados de bootstrap.
- `AppShell` existe apenas na aplicação interna pronta.
- `Sidebar` é a navegação principal do desktop.
- `MobileNavigation` é a navegação inferior do mobile.
- Portanto, a nova top bar pertence a `src/app/shell/` e não deve existir na tela de login nem nos estados de carregamento/erro anteriores ao shell.

### 4.2 Orders

A coleção oficial `orders` já é mantida por `useOperationalDataRuntime`.

Sincronização existente:

- bootstrap/global sync autenticado: 5 s;
- sync de Orders quando Cozinha está ativa: 2 s;
- mutações aceitas localmente aplicam efeitos oficiais imediatamente.

A feature não deve criar um polling adicional apenas para o badge.

O domínio de Orders já possui:

- `isOrderActive()`;
- `isScheduledWaiting()`;
- `operationalOrderIdSet()`;
- `buildKitchenQueueModel()`.

A regra do badge deve reutilizar essas semânticas, não reconstruir listas de status em componentes de shell.

### 4.3 Table Service

O runtime operacional já mantém `tables[]` e `tableTabs[]` como coleções oficiais compartilhadas.

O domínio Table Service já define que:

- a identidade canônica de uma comanda aberta é `{ tableId, tableTabId }`;
- `tableTabId` é a identidade durável da comanda;
- `tableId` sozinho não é suficiente;
- transferir a mesma `tableTabId` entre mesas não cria uma nova comanda.

O badge de Comandas deve ser derivado no domínio Table Service e não contar apenas `occupancy === 'occupied'` no shell.

## 5. Top bar global

### 5.1 Localização

Criar um componente de shell, conceitualmente `AppTopBar`.

Composição alvo:

```text
AppRoot
└── AppShell
    ├── Sidebar
    ├── AppTopBar
    │   ├── NotificationBell
    │   └── OperationMenu
    ├── conteúdo da tela
    └── MobileNavigation
```

### 5.2 Desktop

A top bar deve:

- permanecer disponível em todas as telas internas, inclusive Novo Pedido e Configurações;
- ser baixa e visualmente discreta;
- não repetir o logo/nome do negócio que já existe na sidebar;
- manter as utilidades alinhadas à direita;
- não roubar área vertical significativa do conteúdo;
- respeitar tema claro e escuro.

Ordem inicial:

```text
[conteúdo livre/flexível]                [🔔] [AS ▼]
```

### 5.3 Mobile

No mobile:

- a top bar também é persistente;
- pode mostrar identidade mínima `Gestão Delivery` à esquerda;
- sino e `AS` ficam à direita;
- a bottom navigation continua sendo a navegação principal;
- a top bar não deve duplicar os destinos da bottom navigation.

### 5.4 Ausência da top bar

Não renderizar em:

- login;
- checagem de sessão;
- carregamento inicial de dados;
- erro de bootstrap antes da aplicação interna.

## 6. Menu da operação

### 6.1 Significado

`AS` significa **Amor & Sabor**, não iniciais de um usuário.

O componente não deve usar termos como “Meu perfil”, “Administrador” ou nome de pessoa nesta versão.

### 6.2 Conteúdo

O menu deve apresentar:

- cabeçalho `Amor & Sabor`;
- subtítulo `Operação atual`;
- `Configurações`, quando o destino for navegável pela sessão atual;
- `Preferências deste dispositivo`, quando `preferences.local` permitir esse destino;
- `Sobre o Gestão Delivery`;
- divisor;
- `Sair do sistema`.

### 6.3 Navegação e capabilities

Não codificar capabilities paralelas no menu.

Os atalhos devem reutilizar:

- registro de navegação;
- resolução de destinos;
- `requestNavigation`;
- conjunto `granted`;
- conjunto `implemented`.

Se um destino não seria oferecido pela navegação oficial, não deve aparecer no menu da operação.

### 6.4 Sobre o Gestão Delivery

O item `Sobre` deve abrir uma superfície pequena com informações do produto e da release atual.

A primeira versão não expõe `package.json.version` como versão de produto. O catálogo de releases usa IDs próprios e estáveis. Uma numeração comercial pode ser adicionada posteriormente sem mudar o modelo de notificações.

## 7. Badges operacionais da navegação

### 7.1 Semântica comum

Badges operacionais representam **trabalho/estado ativo agora**. Eles não representam conteúdo não lido.

Na V1 existem dois:

- **Pedidos** → pedidos que exigem acompanhamento operacional agora;
- **Comandas** → comandas efetivamente abertas agora.

Os badges são independentes da Central de notificações e do contador do sino.

### 7.2 Badge de Pedidos

O badge de Pedidos não representa:

- quantidade de pedidos não lidos;
- quantidade total do histórico;
- quantidade de pedidos agendados para o futuro que ainda não entraram na operação.

A regra deve reutilizar a mesma semântica já usada para chegadas operacionais em Orders:

- pedido com ID válido;
- não terminal/não encerrado pelas regras atuais de Orders;
- não classificado como `isScheduledWaiting(order, now, currentTiming)`.

A implementação não deve duplicar listas de status dentro de `Sidebar`, `MobileNavigation`, `AppShell` ou `AppTopBar`.

Se a regra de quando um agendado entra em operação mudar no domínio, o badge deve mudar junto.

### 7.3 Badge de Comandas

O badge de Comandas representa **quantas comandas abertas distintas existem no momento**.

A contagem deve pertencer ao domínio Table Service e usar a identidade canônica da comanda:

`{ tableId, tableTabId }`

com deduplicação por `tableTabId`.

Uma comanda conta quando a projeção oficial representa uma comanda realmente aberta, isto é:

- existe `tableTabId` válido;
- a mesa correspondente está ativa e ocupada com aquele `openTableTab.id`;
- quando a coleção `tableTabs` contém o mesmo ID, seu estado deve ser `open`.

A regra deve ser tolerante à janela curta de sincronização entre as coleções: inconsistência não pode produzir dupla contagem. O selector deve preferir identidade válida e deduplicada e voltar ao valor correto no próximo estado oficial.

Comportamentos obrigatórios:

- abrir uma nova comanda → incrementa;
- abrir outra comanda → incrementa novamente;
- transferir a mesma `tableTabId` para outra mesa → **não** incrementa;
- pagar/fechar a comanda → decrementa;
- mesa apenas marcada como ocupada, mas sem `openTableTab.id` válido → não conta;
- duas projeções acidentais para a mesma `tableTabId` → contam como uma só.

### 7.4 Renderização

Para ambos os badges:

- `0`: não exibir badge;
- `1..99`: exibir número;
- acima de `99`: exibir `99+`.

O valor completo continua disponível para acessibilidade.

### 7.5 Atualização

A feature deve aproveitar o estado oficial já existente.

Pedidos:

- mutações locais aceitas refletem imediatamente;
- alterações de outro dispositivo chegam pelo sync global existente, normalmente em até ~5 s;
- quando Cozinha está ativa, o sync de 2 s permanece;
- transições de agendados para a janela operacional usam os ciclos já existentes.

Comandas:

- abertura, transferência, pagamento e fechamento continuam usando os efeitos oficiais já existentes;
- alterações vindas de outro dispositivo chegam pelo sync global existente;
- não criar polling, store, bootstrap, WebSocket ou SSE específicos para os badges.

### 7.6 Superfícies

Exibir os valores em:

- Sidebar desktop:
  - `Pedidos [n]`;
  - `Comandas [n]`.
- MobileNavigation:
  - `Pedidos [n]`;
  - `Comandas [n]`.

Acessibilidade exemplos:

- `Pedidos, 3 pedidos em andamento`;
- `Comandas, 5 comandas abertas`.

## 8. Modelo de notificações

### 8.1 Arquitetura híbrida

A UI deve consumir notificações por um contrato genérico.

Na V1, existe uma única fonte:

`Novidades do sistema → Notification Center`.

No futuro, outras fontes poderão ser agregadas:

- avisos operacionais;
- falhas de impressão que exijam atenção;
- mensagens do servidor;
- alertas administrativos.

Essas futuras fontes não fazem parte desta implementação.

### 8.2 Estrutura de uma notificação

O contrato deve suportar pelo menos:

```js
{
  id: 'release-notification-center-2026-09',
  type: 'release',
  publishedAt: '2026-09-21T00:00:00-03:00',
  title: 'Novidades do Gestão Delivery',
  summary: 'Indicador de pedidos, central de notificações e nova barra superior.',
  sections: [
    {
      title: 'Pedidos em andamento',
      body: 'Agora o menu Pedidos mostra quantos pedidos precisam de acompanhamento naquele momento.'
    }
  ]
}
```

Campos de conteúdo devem ser dados estruturados, não HTML arbitrário.

O contrato pode reservar extensão futura para uma ação/destino, mas nenhuma ação operacional nova é necessária na V1.

### 8.3 Catálogo

Criar um catálogo versionado no frontend, dentro de `src/app/notifications/`.

A primeira notificação deve anunciar esta própria entrega:

- badges de Pedidos e Comandas;
- Central de notificações;
- nova top bar/menu da operação.

O catálogo é a fonte do histórico disponível nesta versão.

## 9. Persistência por dispositivo

### 9.1 Escopo

O estado de leitura é **por dispositivo**, conforme decisão de produto.

Uma pessoa abrir a novidade no desktop não deve fazê-la desaparecer como lida no celular.

### 9.2 Armazenamento

Usar `localStorage` com chave namespaced e versionada por negócio, derivada do `businessId` autenticado, conceitualmente:

```text
delivery-notifications:v1:<businessId>
```

Para Amor & Sabor, o valor atual resulta em `delivery-notifications:v1:amor-e-sabor`, mas a implementação não deve hardcodar esse identificador no módulo de notificações.

O formato deve distinguir no mínimo:

- IDs apresentados automaticamente;
- IDs lidos;
- IDs conhecidos pelo dispositivo, se necessários para inicialização segura.

O storage não deve ser apagado no logout.

### 9.3 Limpeza

Ao carregar o catálogo, remover do estado local referências a IDs que não existem mais no catálogo conhecido.

Isso impede crescimento indefinido de metadados órfãos.

### 9.4 Primeiro uso em um dispositivo com histórico existente

Um dispositivo que inicializa a feature pela primeira vez não deve receber uma sequência automática de releases antigas.

Regra:

- na primeira inicialização do storage naquele dispositivo, o release mais recente disponível é o único candidato ao aviso automático inicial;
- os releases mais antigos existentes naquele primeiro baseline são registrados como conhecidos, apresentados e lidos para não produzir uma falsa fila de pendências;
- esses releases antigos continuam acessíveis no histórico, com aparência de lidos;
- o release mais recente do baseline permanece não lido e não apresentado até seguir o fluxo normal do aviso;
- após o baseline, qualquer novo ID adicionado ao catálogo nasce como conhecido apenas após ser detectado e permanece não lido/não apresentado até interação;
- nunca abrir releases antigos em sequência apenas porque o dispositivo é novo.

## 10. Estados `presented` e `read`

Os estados têm significados diferentes.

### 10.1 `presented`

Indica que o sistema já mostrou automaticamente aquela novidade naquele dispositivo.

Ao fechar o aviso por:

- X;
- Escape;
- backdrop;

a notificação deve ser marcada como `presented`, mas não `read`.

Consequência: ela não abre automaticamente de novo, mas continua contando no sino.

### 10.2 `read`

Indica que a pessoa confirmou/leu a notificação.

Marcar como lida quando:

- clicar em `Entendi` no aviso automático;
- abrir explicitamente a notificação pela Central.

A leitura reduz o contador do sino.

## 11. Aviso automático de novidades

Após autenticação e bootstrap prontos:

1. localizar o release mais recente elegível e ainda não apresentado;
2. abrir seu aviso automaticamente;
3. nunca abrir uma pilha de releases antigos em sequência;
4. ao fechar sem `Entendi`, marcar apenas `presented`;
5. ao clicar `Entendi`, marcar `presented + read`.

O aviso deve reutilizar a infraestrutura acessível de diálogo já existente. Não criar uma nova implementação independente de foco/Escape/scroll lock.

## 12. Central de notificações

### 12.1 Sino

O sino fica na top bar.

- sem não lidas: ícone sem badge;
- 1..99: badge numérico;
- 100 ou mais: `99+`.

Acessibilidade exemplo:

`Notificações, 1 não lida`.

### 12.2 Desktop

Clicar no sino abre uma superfície lateral direita em formato drawer.

Preferência técnica: reutilizar o comportamento acessível de `Modal` e estilizar a superfície para drawer, em vez de implementar outro focus trap.

### 12.3 Mobile

Clicar no sino abre `BottomSheet`.

O conteúdo funcional deve ser o mesmo do desktop.

### 12.4 Lista

Ordenar por `publishedAt` decrescente, com desempate determinístico por ID.

Cada item mostra:

- ícone/tipo;
- título;
- data;
- resumo de 1–2 linhas;
- estado visual lido/não lido.

### 12.5 Limite e histórico

- lote inicial: 20 notificações;
- `Ver mais notificações`: adiciona mais 20;
- não remover acesso às notificações que ainda existem no catálogo;
- não renderizar 100 itens de uma vez apenas porque existem 100;
- não criar paginação numérica nesta versão.

Quando uma futura fonte server-side existir, a mesma interação poderá mapear para paginação real no backend.

## 13. Detalhe da notificação

### 13.1 Conteúdo

Ao abrir uma notificação com detalhes, mostrar:

- título;
- data;
- resumo/contexto;
- seções estruturadas;
- explicação curta de cada melhoria.

### 13.2 Desktop

A Central pode permanecer como drawer e o detalhe de release pode abrir em `Modal` acima dela. A infraestrutura atual já suporta noções de diálogo topmost.

### 13.3 Mobile

Não empilhar modal sobre BottomSheet para navegação comum da Central.

Ao selecionar uma notificação, o próprio BottomSheet muda de:

`lista → detalhe`

e oferece ação de voltar.

### 13.4 Notificações simples futuras

O contrato deve aceitar no futuro itens sem detalhe expandido. Isso não exige UI específica nesta V1 além de o renderer tolerar a ausência de `sections`.

## 14. Responsividade e tema

### Desktop

- sidebar permanece;
- top bar compacta;
- drawer lateral não deve empurrar/reformatar a página;
- conteúdo atrás pode receber backdrop conforme padrão de diálogo.

### Mobile

- top bar compacta;
- bottom navigation preservada;
- central em BottomSheet;
- labels e badges não podem causar overflow;
- respeitar safe areas existentes.

### Tema

Todas as novas superfícies devem usar tokens atuais do sistema e funcionar em claro/escuro.

Não introduzir uma paleta paralela somente para notificações.

## 15. Acessibilidade e interação

Todos os componentes devem:

- ter nomes acessíveis;
- suportar teclado;
- fechar por Escape quando apropriado;
- restaurar foco ao gatilho;
- usar foco inicial previsível;
- não criar focus trap concorrente;
- manter alvos de toque adequados no mobile;
- anunciar badges de forma textual, não apenas visual;
- não depender apenas de cor para distinguir lido/não lido.

Menu da operação deve:

- fechar após navegação;
- fechar por Escape;
- fechar ao clicar fora;
- restaurar foco ao chip `AS`.

## 16. Ownership e limites de dependência

### `src/app/shell/`

Responsável por:

- composição da top bar;
- posicionamento de sino;
- menu da operação;
- integração visual com Sidebar/MobileNavigation.

Não deve conhecer regras internas de status de Orders.

### `src/app/notifications/`

Responsável por:

- contrato de notificação;
- catálogo;
- persistência local;
- derivação de `unreadCount`;
- `presented/read`;
- paginação local;
- Notification Center;
- release detail;
- aviso automático.

Não deve importar infraestrutura interna de domínios de negócio.

### `src/domains/orders/`

Responsável por:

- selector de pedido operacional;
- contagem operacional;
- semântica de agendado aguardando.

### `src/domains/table-service/`

Responsável por:

- selector de comandas abertas;
- deduplicação por `tableTabId`;
- semântica de identidade/abertura da comanda.

O shell recebe somente valores calculados por contratos públicos dos domínios.

## 17. Fluxo de dados

### Badges operacionais

```text
useOperationalDataRuntime.orders
          ↓
Orders selector operacional
          ↓
activeOperationalOrderCount
          ┐
          │
useOperationalDataRuntime.tables + tableTabs
          ↓
Table Service selector
          ↓
openComandaCount
          ┘
          ↓
AppShell
     ├── Sidebar
     └── MobileNavigation
```

### Notificações

```text
notificationCatalog
        ↓
notification state/store ←→ localStorage por dispositivo
        ↓
  unreadCount / visibleItems / latestRelease
        ↓
AppTopBar ── NotificationCenter ── Release detail
        └── Automatic release notice
```

## 18. Falhas e degradação

Falha de `localStorage` não deve impedir o sistema de abrir.

Se leitura/escrita local falhar:

- a aplicação continua funcional;
- a Central ainda pode renderizar catálogo;
- o estado pode degradar para memória na sessão;
- não lançar erro global de bootstrap por causa da Central.

Uma notificação inválida isolada não deve derrubar o shell. O catálogo deve ser validado por testes e o renderer deve exigir IDs estáveis.

## 19. Testes obrigatórios

### Badges operacionais

1. pedido operacional entra no contador de Pedidos;
2. Finalizado/Cancelado e demais estados encerrados pelas regras existentes não entram;
3. agendado futuro em `isScheduledWaiting` não entra;
4. ao entrar na janela operacional, passa a contar;
5. comanda aberta válida entra no contador de Comandas;
6. comanda fechada/paga sai do contador;
7. transferência da mesma `tableTabId` não altera o total;
8. mesa ocupada sem `openTableTab.id` válido não conta;
9. `tableTabId` duplicado em projeções inconsistentes conta apenas uma vez;
10. zero não renderiza badge;
11. 1..99 mostra número;
12. acima de 99 mostra `99+`;
13. sidebar e mobile recebem os mesmos valores de domínio;
14. nenhuma regra de status/identidade é duplicada no shell.

### Store/notificações

15. catálogo ordena corretamente;
16. estado é namespaced pelo `businessId` autenticado e não hardcoda Amor & Sabor;
17. logout não apaga estado;
18. primeiro baseline marca releases antigos como conhecidos/apresentados/lidos e mantém somente o mais recente elegível para aviso;
19. fechar aviso automático marca `presented`, não `read`;
20. `Entendi` marca ambos;
21. abrir item pela Central marca `read`;
22. item apresentado e não lido não reabre automaticamente;
23. novo release posterior volta a abrir automaticamente;
24. baseline inicial não cria sequência de releases antigos nem contador artificialmente alto;
25. IDs órfãos são limpos;
26. falha de localStorage degrada sem quebrar a aplicação;
27. lote inicial é 20;
28. `Ver mais` adiciona 20;
29. badge do sino usa `99+`.

### Shell/UI

30. top bar existe em todas as telas internas;
31. top bar não existe em login/checking/bootstrap loading/error;
32. desktop mantém sidebar e top bar compacta;
33. mobile mantém bottom navigation e top bar;
34. menu AS não se apresenta como perfil pessoal;
35. Configurações/Preferências respeitam resolução/capabilities existentes;
36. clicar no atalho navega pelo controller oficial;
37. menu e diálogos respondem a Escape/foco/outside click;
38. Central desktop usa drawer;
39. Central mobile usa BottomSheet;
40. detalhe mobile troca lista/detalhe sem empilhar modal;
41. temas claro e escuro mantêm contraste;
42. badges possuem labels acessíveis.

### Regressão

43. fluxos de Pedidos/Cozinha continuam com refresh existente;
44. nenhuma chamada de rede nova é criada apenas pelo badge;
45. login/logout continuam funcionais;
46. navegação existente continua respeitando guards/capabilities;
47. build, lint, architecture e suíte completa permanecem verdes.

## 20. Homologação manual

Validar em staging:

### Desktop

- top bar em pelo menos Pedidos, Comandas, Financeiro, Clientes e Configurações;
- badge de Pedidos;
- badge de Comandas;
- abrir/transferir/fechar comanda e confirmar atualização do contador;
- sino sem/with unread;
- drawer;
- detalhe;
- menu AS;
- claro/escuro;
- largura aproximada de 1024, 1280 e 1440 px.

### Mobile

- top bar em largura ~320–390 px;
- badges de Pedidos e Comandas na bottom navigation;
- BottomSheet da Central;
- detalhe dentro do mesmo sheet;
- modal automático de release;
- menu da operação;
- safe area e teclado/foco.

### Estado local

- abrir release e marcar lido;
- recarregar;
- logout/login;
- confirmar persistência;
- simular nova release com fixture/teste de staging quando aplicável.

## 21. Deploy e rollout

A implementação deve seguir o fluxo normal do projeto:

1. branch de feature;
2. TDD RED → GREEN;
3. Validate;
4. deploy em staging;
5. homologação manual;
6. documentação/evidências;
7. merge somente com autorização explícita;
8. produção somente com autorização explícita.

Esta Spec não autoriza implementação, merge ou deploy.

## 22. Decisões fechadas

- top bar global: **sim**;
- top bar somente em aplicação interna autenticada: **sim**;
- desktop: barra discreta com utilidades à direita;
- mobile: identidade mínima + utilidades;
- perfis de usuário reais: **fora de escopo**;
- `AS` representa Amor & Sabor;
- badges de Pedidos e Comandas são operacionais, não “não lido”;
- badge Pedidos exclui agendados futuros fora da janela operacional;
- badge Comandas conta comandas abertas distintas por `tableTabId`, sem dupla contagem em transferência;
- Central V1 recebe somente novidades do sistema;
- arquitetura preparada para múltiplas fontes futuras;
- leitura por dispositivo;
- storage local não é apagado no logout;
- aviso automático aparece uma vez por release/dispositivo;
- fechar sem confirmar não marca como lido;
- abrir pela Central marca como lido;
- histórico em lotes de 20;
- badge visual máximo `99+`;
- lista mostra resumo curto;
- detalhe mostra conteúdo expandido;
- desktop usa drawer + modal de detalhe;
- mobile usa BottomSheet com lista/detalhe;
- sem endpoint/migration novos na V1;
- sem polling novo para os badges.
