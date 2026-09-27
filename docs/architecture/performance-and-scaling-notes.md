# Performance e escalabilidade — baseline e pontos para revisitar

**Data da análise:** 2026-09-27  
**Projeto:** Gestão Delivery  
**Baseline analisado:** `master` em `3c49d4da2790e59c2dd0ac7fc3d1c57dbf5df8ff`  
**Validate de referência:** #2287 — SUCCESS  
**Status:** nota arquitetural; nenhuma mudança de comportamento aprovada ou necessária agora.

## 1. Decisão atual

A experiência atual é considerada satisfatória. O tempo de abertura percebido relatado pelo proprietário do projeto é de aproximadamente **2 segundos**; esse valor é observação de uso, não benchmark controlado.

**Decisão desta revisão:** não executar agora uma refatoração ampla de lazy loading nem alterar o bootstrap somente por precaução.

Motivos:

- a navegação após a abertura é rápida e previsível;
- o ganho de um lazy loading agressivo pode ser pequeno no cenário atual;
- dividir todas as telas pode transferir custo para o primeiro acesso de cada área;
- o maior risco de escala identificado está no carregamento e na sincronização de **dados**, não no roteamento visual atual.

Esta nota deve ser usada como ponto de partida quando performance ou escala passarem a justificar uma iniciativa própria.

## 2. Carregamento de código atual

### 2.1 Entrada do produto

`src/main.jsx` já separa dois produtos por import dinâmico:

- `/cozinha-tv` -> `KitchenDisplayRoot.jsx`;
- restante do sistema -> `AdminBootstrap.jsx`.

Portanto, a TV da Cozinha não precisa carregar o bundle administrativo completo.

### 2.2 Gestor administrativo

O `AdminBootstrap.jsx` importa `App.jsx`, e `App.jsx` possui imports estáticos para as principais superfícies administrativas, incluindo:

- Pedidos / Histórico / Novo pedido;
- Comandas / Mesas;
- Financeiro / A Receber;
- Dashboard;
- Relatórios;
- Clientes;
- Produtos;
- Fila de impressão;
- Configurações;
- workflows de pagamento, refund e impressão.

As telas são condicionadas por `activeTab` na renderização, porém não existe hoje `React.lazy` ou lazy loading por rota para essas superfícies. Assim, a maior parte do código administrativo está disponível depois do carregamento inicial, o que favorece trocas de tela rápidas.

### 2.3 Baseline do build de produção

O build do Validate #2287 reportou:

| Asset | Minificado | Gzip |
| --- | ---: | ---: |
| `AdminBootstrap-*.js` | 1.304,58 kB | 379,92 kB |
| `AdminBootstrap-*.css` | 359,98 kB | 54,10 kB |
| `KitchenDisplayRoot-*.js` | 23,28 kB | 7,56 kB |
| `KitchenDisplayRoot-*.css` | 16,97 kB | 4,21 kB |

O Vite/Rolldown emite aviso de chunk acima de 500 kB para o bundle administrativo. Isso é um sinal para acompanhamento, não uma evidência de problema perceptível por si só.

### 2.4 Lazy loading já existente onde faz sentido

Partes pesadas de exportação de Relatórios já usam imports dinâmicos. Exemplos do build:

- `exceljs`: 930,42 kB minificado / 256,67 kB gzip;
- `pdfExport`: 167,59 kB / 116,91 kB gzip;
- `html2canvas`: 199,90 kB / 46,96 kB gzip.

Esses custos não precisam integrar o caminho normal de abertura do Gestor e só são relevantes quando o usuário executa as exportações correspondentes.

## 3. Sequência de abertura atual

No fluxo administrativo autenticado:

1. o navegador carrega o módulo administrativo;
2. a aplicação consulta `GET /api/auth/session`;
3. enquanto a sessão é verificada, a UI mostra **Carregando sistema**;
4. se autenticado, a aplicação executa `GET /api/bootstrap`;
5. enquanto o bootstrap está em andamento, a UI mostra **Carregando dados**;
6. somente quando `bootstrapState === 'ready'` o shell principal é liberado.

O login por PIN também confirma a sessão antes de executar o bootstrap operacional.

## 4. Bootstrap de dados atual

`GET /api/bootstrap` chama `loadEffectiveBusinessConfig` e depois `loadBootstrap`.

O `loadBootstrap` atual carrega, para o estabelecimento:

- identidade básica da empresa e estado do logo;
- todos os clientes;
- todos os produtos ativos;
- todos os pedidos;
- todos os itens de pedidos;
- todas as comandas (`table_tabs`);
- mesas;
- todas as movimentações financeiras não excluídas;
- configurações financeiras;
- configuração efetiva quando necessário.

### 4.1 Característica importante para escala

Pedidos e movimentações do bootstrap não usam paginação ou janela temporal. Portanto, o volume transferido tende a crescer junto com o histórico da operação.

Itens de pedidos também são carregados para o conjunto completo retornado pelo bootstrap.

### 4.2 Ordem de leitura

As principais leituras de `loadBootstrap` são executadas sequencialmente no repositório atual:

1. business;
2. clients;
3. products;
4. orders;
5. order_items;
6. table_tabs;
7. tables;
8. movements;
9. financeSettings.

Não há conclusão nesta nota de que a sequência seja hoje um gargalo; apenas registra-se a estrutura atual para uma futura investigação orientada por métricas.

## 5. Sincronização atual

Em `useOperationalDataRuntime`:

- `GLOBAL_SYNC_INTERVAL_MS = 5_000`;
- `ORDER_SYNC_INTERVAL_MS = 2_000`.

Quando o usuário está autenticado e o bootstrap já está pronto, a sincronização global chama novamente o bootstrap em background a cada **5 segundos**, além de refresh por foco/visibilidade.

Quando a aba ativa é **Pedidos**, existe também leitura específica de pedidos a cada **2 segundos**, também com refresh por foco/visibilidade.

Em uma sessão continuamente ativa, a frequência nominal do bootstrap global é de até:

- 12 execuções por minuto;
- 720 execuções por hora;

sem contar refreshes adicionais por foco/visibilidade.

Esses números descrevem o timer nominal do frontend, não consumo faturado nem custo real do D1.

## 6. Principal risco de escala identificado

O principal ponto para revisitar futuramente é a combinação:

> histórico crescente + bootstrap sem paginação + sincronização global frequente.

Conforme a operação acumular pedidos, itens, movimentações e clientes, o mesmo endpoint tende a:

- consultar mais linhas;
- serializar mais JSON;
- transferir mais dados;
- manter mais objetos em memória no navegador;
- repetir parte desse custo a cada sincronização global;
- aumentar o trabalho concorrente quando houver várias sessões/dispositivos ativos.

No estado atual, isso é **risco prospectivo**, não incidente de performance confirmado.

## 7. Por que não aplicar lazy loading amplo agora

Lazy loading por todas as telas poderia reduzir o bundle inicial, mas também introduzir custo no primeiro acesso a uma área.

A propriedade que deve ser preservada é:

> depois que o Gestor abre, a navegação entre áreas operacionais deve continuar perceptivelmente imediata.

Uma futura adoção de code splitting deve considerar:

- manter áreas operacionais principais já carregadas ou pré-carregadas;
- lazy load de áreas secundárias;
- preload em idle;
- preload por intenção de navegação, quando fizer sentido;
- fallback visual discreto;
- deep links funcionando diretamente;
- comportamento equivalente em desktop e mobile.

## 8. Ordem recomendada para uma iniciativa futura

Quando houver necessidade comprovada, seguir preferencialmente esta ordem.

### Fase A — medir antes de alterar

Instrumentar pelo menos:

- tempo de HTML até mount;
- tempo de verificação de sessão;
- duração do `/api/bootstrap`;
- tamanho da resposta do bootstrap;
- contagem de clientes, produtos, pedidos, itens e movimentos retornados;
- tempo de processamento/renderização no cliente;
- cold load e warm/cache load;
- dispositivos/redes representativos.

Sem telemetria ou benchmark reprodutível, não transformar a observação atual de ~2 s em SLA formal.

### Fase B — reduzir o caminho crítico de dados

Estudar um bootstrap mínimo contendo apenas dados realmente globais, por exemplo:

- sessão/contexto;
- empresa;
- capabilities/configuração efetiva;
- contadores ou resumos necessários para navegação;
- coleções estritamente necessárias à superfície inicial.

### Fase C — APIs e sincronização por domínio

Avaliar endpoints e refreshes próprios para:

- pedidos;
- clientes;
- produtos;
- mesas/comandas;
- movimentações;
- A Receber.

Evitar transformar uma coleção que mudou em motivo para recarregar coleções independentes.

### Fase D — paginação/janelas históricas

Priorizar dados históricos que crescem continuamente:

- Histórico de pedidos;
- Movimentações;
- outras projeções financeiras extensas.

A UI deve continuar permitindo consultar o histórico completo, mas isso não exige necessariamente mantê-lo inteiro no bootstrap global.

### Fase E — code splitting seletivo

Depois das fronteiras de dados e de ownership estarem estáveis, medir novamente o bundle e decidir onde lazy loading traz benefício real.

Candidatos naturais para avaliação futura:

- Relatórios;
- Configurações;
- Clientes;
- Produtos;
- superfícies administrativas menos frequentes.

Não assumir que Pedidos, Comandas ou A Receber devam ser lazy sem medir o efeito na operação.

## 9. Sinais para reabrir esta discussão

Revisitar a arquitetura quando um ou mais destes sinais aparecerem:

- aumento perceptível e recorrente do tempo de abertura comparado ao baseline atual;
- primeira carga lenta em aparelhos/redes reais usados pelos clientes;
- payload de bootstrap crescendo de forma relevante;
- consultas do bootstrap se tornando dominantes em tempo/custo;
- operações com histórico grande apresentando lentidão;
- várias sessões simultâneas tornando o polling global caro;
- uso de memória do navegador se tornando relevante;
- necessidade de suportar número muito maior de estabelecimentos ou volume de pedidos.

Os gatilhos quantitativos devem ser definidos quando houver medição real.

## 10. Invariantes para uma mudança futura

Uma Spec futura de performance/escala deve preservar:

- mesma semântica funcional;
- navegação rápida após a abertura;
- deep links e F5;
- autorização/capabilities;
- consistência de sessão;
- pagamentos e mutações sem estado financeiro otimista;
- sincronização sem sobrescrever efeitos oficiais mais novos;
- comandas;
- badges operacionais;
- impressão/QZ e recovery;
- TV da Cozinha;
- temas e responsividade;
- staging/homologação antes de produção.

## 11. Próximo passo

Não há implementação aprovada por esta nota.

Quando os sinais de escala justificarem o trabalho:

1. atualizar as medições;
2. revisar esta baseline contra a `master` vigente;
3. escrever uma Spec específica;
4. escrever plano TDD;
5. implementar incrementalmente;
6. comparar métricas antes/depois;
7. homologar a percepção de velocidade, não apenas números sintéticos.
