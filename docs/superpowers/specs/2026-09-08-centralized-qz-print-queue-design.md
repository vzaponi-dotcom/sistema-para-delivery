# Gestão Delivery — Fila Centralizada de Impressão com QZ Tray

Data: 2026-09-08
Status: design aprovado em conversa; aguardando revisão deste documento antes do plano de implementação

## 1. Contexto

O subsistema de impressão evoluiu de uma arquitetura multi-transporte para um cenário operacional em que o Windows da cozinha já consegue imprimir fisicamente pela fila local usando QZ Tray, enquanto Android depende de RawBT e outras plataformas mantêm fallback Web Serial.

Essa combinação introduziu complexidade desnecessária e uma ambiguidade importante: no Android, abrir o RawBT com um payload pode ser interpretado pelo Gestão Delivery como sucesso do transporte antes de existir confirmação de que o RawBT conseguiu se conectar à impressora e imprimir fisicamente. Como os jobs são compartilhados no backend, essa confirmação prematura também pode produzir estados e avisos incoerentes em outros dispositivos.

A nova decisão arquitetural separa definitivamente dois conceitos:

- **solicitar uma impressão**: qualquer dispositivo autenticado pode criar ou agir sobre um job central;
- **executar fisicamente uma impressão**: somente a estação Windows principal da cozinha, com QZ Tray e a impressora USB configurada, pode enviar bytes para a impressora.

O alvo deixa de ser uma aplicação em que cada dispositivo possui seu próprio transporte físico. O alvo passa a ser uma fila central com um único executor físico.

## 2. Objetivos

Esta mudança deve:

1. centralizar toda impressão física na estação Windows principal da cozinha;
2. usar QZ Tray como único transporte físico suportado no fluxo operacional final;
3. permitir que celular, tablet e outros computadores solicitem impressão sem instalar RawBT, parear Bluetooth ou acessar diretamente a impressora;
4. criar automaticamente um job para todo novo pedido elegível para cozinha;
5. oferecer uma tela visível de **Fila de impressão** para acompanhar e resolver jobs;
6. preservar histórico de descarte, falha e reimpressão;
7. manter o fluxo operacional de uma ou duas vias, incluindo a pausa física entre a primeira e a segunda via;
8. impedir pop-ups globais ou repetitivos em dispositivos que não executam a impressão;
9. manter jobs seguros quando a estação principal estiver desligada ou indisponível;
10. impedir retomada automática de jobs cujo pedido já foi finalizado ou cancelado;
11. mover a quantidade padrão de vias de uma preferência local da estação para uma configuração central do negócio, com regra operacional específica para pedidos de mesa/consumo local;
12. remover, depois da homologação do novo fluxo, os caminhos legados RawBT e Web Serial que deixarem de ter função;
13. reescrever a documentação operacional para refletir a arquitetura realmente suportada;
14. deixar a auditoria preparada para futura introdução de usuários, perfis e permissões sem implementar RBAC nesta entrega.

## 3. Fora de escopo

Não fazem parte desta entrega:

- QZ Tray instalado diretamente em Android ou iOS;
- navegador mobile conectando diretamente ao QZ Tray do Windows via LAN/QZ Print Server;
- impressão Bluetooth direta pelo celular;
- RawBT como fallback operacional;
- Web Serial como fallback operacional;
- segunda estação física de failover;
- múltiplas impressoras por praça/setor;
- roteamento de itens por impressora;
- confirmação física por sensor de papel, pois o hardware atual não fornece esse nível de telemetria;
- criação de usuários, perfis e permissões granulares;
- deploy de produção durante a fase de design/implementação/homologação em staging.

## 4. Arquitetura alvo

Fluxo oficial:

```text
Celular ───────┐
Tablet ────────┼──> Gestão Delivery / API ──> Fila central de impressão
Outro PC ──────┘                                  │
                                                   ▼
                                      Estação principal da cozinha
                                                   │
                                                QZ Tray
                                                   │
                                           fila de impressão Windows
                                                   │
                                                  USB
                                                   │
                                                   ▼
                                           Impressora térmica 58 mm
```

### 4.1 Regra de responsabilidade

Dispositivos que não são a estação física principal:

- podem criar pedidos;
- podem criar solicitações manuais de impressão;
- podem priorizar jobs com `Imprimir agora`;
- podem descartar jobs quando a ação for válida;
- podem solicitar reimpressão;
- podem ver ticket, histórico, status e timeline;
- **não** carregam transporte RawBT/Web Serial/QZ para execução física;
- **não** fazem claim de job para imprimir;
- **não** marcam job como impresso.

A estação Windows principal:

- registra heartbeat e prontidão;
- valida conexão QZ e fila Windows configurada;
- consome os jobs elegíveis;
- faz o claim atômico no backend antes de executar;
- renderiza o ticket e envia os bytes pelo QZ;
- registra sucesso, falha conhecida ou resultado incerto;
- é a única estação que pode receber o aviso operacional de segunda via.

### 4.2 Continuidade das camadas existentes

A separação já existente continua válida:

`Pedido -> OrderPrintDocument -> Renderer -> PrinterTransport`

Devem ser preservados:

- `OrderPrintDocument` canônico e snapshot imutável por job;
- renderer térmico 58 mm;
- compatibilidade `mpt2-bitmap` já homologada para a impressora atual;
- preview e PDF derivados do mesmo documento lógico;
- transporte QZ e assinatura segura pelo Worker.

O que muda é que `PrinterTransport` deixa de ser escolhido pela plataforma do navegador. No fluxo operacional final existe um único transporte físico: QZ na estação principal.

## 5. Estação principal e saúde operacional

### 5.1 O que é uma estação de impressão

No modelo alvo, `print_stations` representa executores físicos, não cada navegador autenticado. Celulares e tablets deixam de registrar estações apenas por abrirem o sistema.

Nesta entrega deve existir no máximo uma estação física principal por negócio.

A estação suportada é:

- plataforma Windows;
- QZ Tray;
- fila Windows escolhida explicitamente e persistida localmente na própria máquina;
- impressora térmica conectada por USB.

### 5.2 Heartbeat

Somente a estação física envia heartbeat de impressão.

O backend deve conseguir derivar pelo menos:

- estação online/offline pelo `last_seen_at`;
- estação pronta/não pronta para consumir jobs;
- último instante em que QZ + fila local foram considerados prontos.

A prontidão é best-effort. Ela não é uma garantia de papel físico, mas permite que a UI diferencie `Na fila` de `Aguardando estação`.

### 5.3 Configuração local da fila QZ

O nome da fila Windows continua local à estação. O servidor não deve escolher silenciosamente outra fila do Windows.

A tela de configuração da estação Windows deve manter:

- status do QZ;
- fila configurada;
- ação de configurar/trocar fila;
- teste de impressão;
- indicação de que esta é a estação principal.

O teste físico de QZ continua sendo uma ação local da estação principal. Celular e tablet não precisam oferecer `Testar impressão` para validar hardware.

## 6. Configuração central de impressão

A quantidade padrão de vias deixa de pertencer à estação e passa a pertencer ao negócio.

### 6.1 Quantidade padrão

A configuração central aceita somente:

- `1 via`; ou
- `2 vias`.

Essa configuração é a regra padrão para pedidos de **Entrega** e **Retirada**.

Pedidos de **mesa/consumo local** são uma exceção operacional deliberada: o job automático inicial deve sempre nascer com **1 via**, independentemente da configuração central. Para esta regra, considera-se pedido de mesa/consumo local aquele identificado pelo domínio atual como `Local` e/ou associado a mesa/comanda, conforme o modelo oficial do pedido. O objetivo é imprimir somente a via necessária para a cozinha, sem criar uma segunda via artificial que depois precisaria ser descartada.

A alteração da configuração central pode ser feita em qualquer dispositivo autenticado pelo modelo de autenticação atual.

Enquanto não existirem usuários/perfis, não haverá permissão granular específica. A estrutura deve, porém, permitir futura restrição sem redesenhar jobs ou histórico.

### 6.2 Imutabilidade por job

Ao criar um job automático inicial:

- pedido de mesa/consumo local recebe `copies_requested = 1`;
- pedido de Entrega/Retirada recebe o valor da configuração central vigente naquele instante.

Alterar a configuração depois:

- afeta somente novos jobs de Entrega/Retirada;
- nunca muda jobs já existentes;
- nunca acrescenta ou remove segunda via de job em andamento;
- não altera a regra fixa de 1 via para o job automático inicial de mesa/consumo local.

Uma **reimpressão manual** é uma ação deliberada e pode escolher 1 ou 2 vias mesmo quando o pedido original é de mesa/consumo local. Essa escolha pertence ao novo job de reimpressão e não altera a regra automática do tipo de atendimento.

### 6.3 Persistência

A implementação deve introduzir configuração central de impressão por `business_id`, em estrutura dedicada ou equivalente. A preferência `print_stations.default_copies` existente deve ser migrada/compatibilizada e depois descontinuada; não pode permanecer como fonte oficial concorrente.

A regra de 1 via para mesa/consumo local deve ser decidida no backend no momento de criação do job, usando o tipo oficial do pedido, e não por heurística visual do frontend.

## 7. Criação automática de jobs

Todo novo pedido elegível para cozinha cria automaticamente um job inicial, independentemente do dispositivo em que o pedido foi criado.

Regras:

- no máximo um job automático inicial por pedido;
- criação protegida por idempotência no backend;
- polling, reload, foco de aba e sincronização nunca criam job novo;
- a estação física estar offline não impede a criação do job;
- o job permanece na fila até poder ser processado ou até exigir intervenção;
- origem do pedido não altera a regra: sistema interno, cardápio digital futuro ou outra origem oficial usam o mesmo contrato;
- pedido de mesa/consumo local cria o job automático inicial com exatamente 1 via;
- pedido de Entrega/Retirada cria o job automático inicial com 1 ou 2 vias conforme a configuração central vigente;
- essa decisão de vias é persistida no próprio job e não é recalculada depois.

Esta decisão substitui o comportamento antigo que condicionava a existência do job automático à presença de uma estação principal com `auto_print_enabled` no momento da criação.

## 8. Modelo de estados

### 8.1 Estados persistidos recomendados

O job deve possuir estados canônicos suficientes para eliminar derivação ambígua:

- `queued`: aguardando execução física e seguro para claim;
- `processing`: claimado pela estação principal e em tentativa física;
- `awaiting_second_copy`: primeira de duas vias enviada com sucesso e aguardando decisão humana para a segunda;
- `printed`: todas as vias solicitadas foram enviadas com sucesso ao QZ/fila Windows;
- `failed`: falha conhecida em que o sistema sabe que a tentativa não foi aceita para impressão;
- `requires_attention`: resultado incerto ou regra de segurança exige decisão humana;
- `discarded`: cancelado pelo usuário, preservado no histórico.

A implementação pode fazer uma migração gradual dos estados atuais, mas o contrato funcional final deve ser explícito.

### 8.2 Estados amigáveis/derivados na UI

`queued` pode aparecer como:

- **Na fila** quando a estação principal está online e pronta;
- **Aguardando estação** quando a estação está offline/não pronta.

Outros rótulos:

- `processing` -> **Imprimindo**;
- `awaiting_second_copy` -> **Aguardando 2ª via**;
- `printed` -> **Impresso**;
- `failed` -> **Falhou**;
- `requires_attention` -> **Requer atenção**;
- `discarded` -> **Descartado**.

`Aguardando estação` não precisa ser persistido como um estado separado; derivá-lo da saúde da estação evita transições artificiais toda vez que um heartbeat muda.

## 9. Semântica de sucesso físico

O bug conceitual do fluxo RawBT não pode existir no novo desenho.

Um job só progride após a estação física executar o transporte QZ correspondente.

Para a infraestrutura atual, `printed` significa tecnicamente:

- o QZ aceitou a requisição e a operação de envio à fila Windows terminou sem erro reportado pelo QZ;
- todas as vias solicitadas foram processadas segundo o estado do job.

Isso **não** é confirmação por sensor de que o papel saiu fisicamente. A UI pode continuar usando o rótulo `Impresso`, mas logs, testes e documentação devem deixar essa limitação explícita.

Falhas devem ser classificadas em:

- **falha conhecida antes da aceitação**: `failed`, elegível a tentativa manual controlada no mesmo snapshot;
- **resultado incerto**: `requires_attention`, sem retry silencioso.

## 10. Fila de impressão — experiência visual

A nova página **Fila de impressão** é parte oficial desta entrega.

### 10.1 Desktop

A página deve possuir:

- título e explicação curta;
- KPIs: `Na fila`, `Imprimindo`, `Requer atenção`, `Concluídas hoje`;
- busca por pedido, cliente ou mesa;
- filtros por status, origem e estação quando aplicável;
- lista/tabela com Pedido, Cliente/Mesa, Origem, Estação responsável, Status, Horário e Ações;
- painel lateral de detalhes do job selecionado;
- timeline de eventos;
- visualização do ticket;
- responsividade compatível com o design system existente.

### 10.2 Mobile

No celular a mesma informação deve aparecer em cards compactos:

- resumo por status;
- pedido/cliente/mesa;
- status;
- horário;
- origem;
- estação;
- quantidade de vias;
- ações válidas para o estado.

Detalhes podem abrir em bottom sheet seguindo os padrões já usados pelo sistema.

### 10.3 Ações por estado

A UI pode oferecer, conforme o caso:

- `Imprimir agora`;
- `Imprimir 2ª via`;
- `Tentar novamente`;
- `Reimprimir`;
- `Descartar`;
- `Ver ticket`.

A aplicação deve calcular ações válidas a partir do contrato do job, e o backend deve repetir a validação. A UI nunca é a única barreira de integridade.

## 11. `Imprimir agora` e prioridade

`Imprimir agora` não significa imprimir pelo dispositivo que recebeu o clique.

A ação significa **priorizar o job para a estação principal**.

Comportamento:

- se a estação estiver pronta, o job torna-se o próximo elegível sem interromper um job já em processamento;
- se a estação estiver offline, o job permanece `queued` e aparece como `Aguardando estação`, porém com prioridade superior;
- prioridade deve ser persistida no backend, não somente reordenada visualmente no frontend;
- o claim deve ordenar primeiro por prioridade e depois pela ordem temporal para preservar previsibilidade.

## 12. Estação offline e retomada

Desligar o PC ou fechar/indisponibilizar o QZ não perde jobs.

### 12.1 Pedido ainda ativo

Quando a estação voltar, jobs `queued` cujo pedido continue operacionalmente ativo podem voltar a ser consumidos automaticamente na ordem/prioridade definida.

### 12.2 Pedido finalizado ou cancelado

Um job pendente cujo pedido esteja `Finalizado` ou `Cancelado` **não** deve ser impresso automaticamente quando a estação voltar.

Ele deve migrar para `requires_attention` com razão explícita, por exemplo:

- `ORDER_FINALIZED_BEFORE_PRINT`;
- `ORDER_CANCELLED_BEFORE_PRINT`.

O operador pode então decidir conscientemente entre imprimir mesmo assim ou descartar.

Esta regra substitui a idade cronológica como principal critério de segurança para jobs que aguardavam uma estação offline.

### 12.3 Jobs antigos por idade

Uma idade máxima ainda pode ser usada como proteção secundária para cenários ambíguos, mas não deve converter automaticamente um job de pedido ativo em erro apenas porque o PC ficou desligado por mais de 10 minutos.

O limiar antigo fixo de 10 minutos não é mais a regra central do fluxo.

## 13. Duas vias

O fluxo automático de duas vias aplica-se aos jobs cujo `copies_requested = 2`, normalmente pedidos de Entrega/Retirada quando a configuração central está em 2 vias. O job automático inicial de mesa/consumo local nasce com 1 via e, portanto, **não entra em `awaiting_second_copy` e não gera pop-up de segunda via**.

Quando `copies_requested = 2`:

1. a estação principal faz claim do job;
2. imprime apenas `CÓPIA 1/2`;
3. após sucesso QZ, registra `copies_printed = 1`;
4. job passa para `awaiting_second_copy`;
5. a estação principal apresenta um único aviso operacional para destacar o papel;
6. o operador escolhe `Imprimir 2ª via` ou `Depois`;
7. `Depois` fecha o aviso sem alterar a necessidade da segunda via;
8. a fila continua mostrando o job como `Aguardando 2ª via` com `1 de 2 vias`;
9. `Imprimir 2ª via` faz novo claim/continuação controlada do mesmo job e imprime somente `CÓPIA 2/2`;
10. após sucesso, `copies_printed = 2` e o job passa para `printed`.

A segunda via não cria um novo job. É continuação do mesmo trabalho original.

Uma reimpressão manual de um pedido local pode, por decisão explícita do operador, ser criada com 2 vias; nesse caso o novo job manual segue normalmente este fluxo de duas vias.

## 14. Regra dos pop-ups e notificações

Pop-up modal deve existir somente quando uma decisão física imediata é necessária na estação principal.

### 14.1 Permitido

Após a primeira de duas vias:

> Pedido #1234 — 1ª via impressa  
> Destaque o papel antes de continuar.  
> `[Depois] [Imprimir 2ª via]`

Esse modal:

- aparece somente na estação principal;
- aparece no máximo uma vez por transição para `awaiting_second_copy`;
- não aparece em celulares/tablets/outros PCs;
- não reaparece por reload, foco de aba ou sincronização;
- não precisa permanecer aberto para que a segunda via fique disponível;
- nunca aparece para o job automático inicial de mesa/consumo local, pois esse job possui apenas 1 via.

Para garantir isso, o backend deve possuir um mecanismo persistente de acknowledgment/evento, por exemplo `second_copy_prompted_at` ou evento equivalente. Uma lista local de IDs dispensados não pode ser a única proteção.

### 14.2 Não bloqueante

Demais eventos usam toast/banner discreto:

- solicitação criada no celular: `Pedido enviado para a fila da cozinha`;
- falha: `Falha ao imprimir pedido #1234 — verificar fila`;
- estação offline: estado visual `Aguardando estação`;
- sucesso normal: não exige modal.

Falhas antigas e jobs finalizados/cancelados nunca devem gerar uma sequência de pop-ups ao recarregar a aplicação.

## 15. Descartar

`Descartar` cancela a necessidade de execução, mas **nunca apaga o job**.

Regras:

- job passa para `discarded`;
- deixa a fila ativa;
- permanece no histórico;
- registra horário;
- registra origem da ação disponível no modelo atual (sessão/dispositivo/estação);
- futuramente poderá registrar `user_id` quando RBAC for introduzido;
- snapshot original permanece imutável.

O backend deve impedir descarte incoerente de job já totalmente processado, exceto se existir uma ação futura com semântica diferente.

## 16. Reimpressão

Reimpressão nunca reutiliza nem altera o job original.

Ao solicitar `Reimprimir`:

- cria-se um novo job manual;
- o novo job referencia o job de origem por `parent_job_id` ou equivalente;
- registra novo snapshot a partir do estado oficial atual do pedido;
- quantidade de vias pode ser escolhida em 1 ou 2 para aquela reimpressão, inclusive para pedido de mesa/consumo local;
- o job original permanece intocado;
- a timeline/histórico deve permitir navegar entre original e reimpressões.

Essa regra vale independentemente do dispositivo em que o usuário clicou em reimprimir. A execução física continua exclusiva da estação QZ.

## 17. Retry de falha versus reimpressão

As ações não são sinônimas:

- `Tentar novamente`: continua o mesmo job/snapshot quando a falha é conhecida e o backend sabe que a tentativa anterior não foi aceita para impressão;
- `Reimprimir`: cria um novo job e é usada quando já houve impressão concluída ou quando o resultado anterior é incerto e o operador deliberadamente decide gerar uma nova execução;
- `requires_attention` por resultado físico incerto nunca deve ser retomado silenciosamente.

A interface deve usar linguagem clara para evitar duplicidade acidental.

## 18. Timeline e auditoria

A tela de detalhe precisa de histórico operacional confiável. Recomenda-se uma entidade `print_job_events` ou mecanismo equivalente.

Eventos úteis:

- job criado;
- priorizado;
- claimado;
- primeira via enviada;
- aviso de segunda via apresentado;
- segunda via solicitada;
- concluído;
- falha conhecida;
- resultado incerto;
- movido para requer atenção por status do pedido;
- descartado;
- retry solicitado;
- reimpressão criada.

Cada evento pode guardar:

- `job_id`;
- `business_id`;
- tipo;
- timestamp de servidor;
- `station_id` quando aplicável;
- tipo/origem do ator disponível hoje;
- metadados não sensíveis.

Quando o sistema ganhar usuários, a modelagem poderá adicionar `actor_user_id` sem alterar a semântica dos jobs existentes.

## 19. Evolução de dados

A migration desta arquitetura deve ser aditiva e compatível com o estado existente. Não editar `0010_order_printing.sql`; criar nova migration numerada.

Elementos conceituais a considerar:

- configuração central por negócio com `default_copies`;
- `parent_job_id` para reimpressão;
- prioridade persistida (`priority`/`priority_requested_at` ou equivalente);
- estado `discarded` e horário de descarte;
- estado explícito `awaiting_second_copy`;
- acknowledgment persistente do aviso da segunda via;
- tabela/eventos de timeline;
- metadados de saúde/prontidão da estação;
- eventual marca de estações legadas/inativas durante a transição.

A regra de 1 via para mesa/consumo local não precisa necessariamente de coluna própria se puder ser derivada deterministicamente do tipo oficial do pedido no momento em que o job é criado. O valor final deve sempre ficar materializado em `copies_requested` no job.

### 19.1 Compatibilidade com dados existentes

Na migração:

- jobs históricos continuam legíveis;
- jobs `printed` com `copies_printed = 1` e `copies_requested = 2` podem ser mapeados funcionalmente para `awaiting_second_copy` quando ainda forem relevantes;
- estações Android/`other` existentes não devem ser apagadas destrutivamente; deixam de ser elegíveis a execução e podem ser marcadas como legadas/inativas;
- a configuração central inicial de vias deve ser definida de forma determinística a partir da configuração vigente da estação principal quando possível, com fallback seguro para 2 vias;
- nenhum job deve ser criado, reimpresso ou descartado apenas pela execução da migration.

## 20. API e concorrência

O backend permanece autoridade dos jobs.

Contratos necessários, podendo reutilizar endpoints atuais quando fizer sentido:

- listar jobs com filtros/paginação;
- obter detalhes/timeline;
- criar job manual/reimpressão;
- priorizar job;
- descartar job;
- reconhecer/liberar segunda via;
- retry controlado;
- listar/editar configuração central;
- heartbeat da estação principal;
- claim atômico do próximo job;
- completar/falhar tentativa.

### 20.1 Claim

Somente a estação principal QZ pode fazer claim para execução física.

O backend deve validar:

- `business_id` da sessão;
- station existente e principal;
- station elegível ao transporte QZ;
- job em estado compatível;
- pedido ainda elegível para claim automático;
- exclusão concorrente para impedir dois claims do mesmo job.

Um celular nunca deve conseguir transformar uma solicitação em `processing` por possuir um `station_id` local antigo.

## 21. Tela de configurações

A tela atual de impressão deve ser reorganizada em dois blocos conceituais.

### 21.1 Configuração do negócio — disponível em todos os dispositivos autenticados

- quantidade padrão: 1 ou 2 vias para Entrega/Retirada;
- explicação clara de que pedidos de mesa/consumo local usam sempre 1 via no job automático inicial;
- explicação de que a escolha vale para novos jobs de Entrega/Retirada;
- estado resumido da estação principal, somente leitura.

### 21.2 Configuração física — relevante somente no PC da cozinha

- nome da estação;
- QZ conectado/desconectado;
- fila Windows configurada;
- configurar/trocar impressora;
- teste físico;
- tornar/confirmar estação principal quando necessário.

Android não deve mostrar `Driver: RawBT`, `RawBT pronto`, botão de pareamento ou orientação Bluetooth no estado final.

## 22. Limpeza de código legado

A remoção do legado ocorre **depois** de o fluxo central QZ estar implementado e homologado fisicamente em staging.

### 22.1 Alvos conhecidos

Revisar e remover quando deixarem de ter consumidores:

- `src/printing/rawBtTransport.js`;
- `src/printing/rawBtTransport.test.js`;
- `src/printing/webSerialTransport.js`;
- `src/printing/webSerialTransport.test.js`;
- branches `rawbt` e `web-serial` de `src/printing/usePrintingManager.js`;
- detecção de transporte físico por plataforma;
- fingerprint/porta serial local que só exista para Web Serial;
- textos `RawBT pronto`, `Driver: RawBT`, `Driver: Web Serial` e instruções Bluetooth de `PrintingSettings`;
- testes/regressões que afirmem Android como executor físico;
- flags/configurações sem função após a migração.

### 22.2 Elementos a preservar

Não remover por associação indevida:

- `qzTrayTransport` e testes;
- endpoints e assinatura QZ no Worker;
- renderer ESC/POS/bitmap 58 mm;
- `OrderPrintDocument`;
- preview/PDF;
- identidade local da estação Windows, simplificada se necessário;
- runner/contrato de execução, refatorado para QZ-only;
- histórico e jobs persistidos.

### 22.3 Critério de limpeza

Ao final, buscas por `rawbt`, `RawBT`, `web-serial`, `Web Serial` e referências Bluetooth ligadas ao transporte de impressão não devem retornar código de produção ativo.

Referências históricas podem permanecer somente em documentos explicitamente marcados como **superseded/históricos**, sem serem apresentadas como instrução atual.

## 23. Reescrita da documentação

A documentação operacional precisa ficar coerente com a arquitetura final.

### 23.1 Documentos ativos a reescrever

`docs/order-printing-mtp5-acceptance.md`

- remover Windows/Web Serial;
- remover Android/RawBT;
- transformar o checklist em homologação da fila central QZ;
- incluir teste de solicitação pelo celular com impressão física no PC;
- incluir PC/QZ offline, retomada, 1/2 vias, regra de 1 via para mesa/consumo local, descarte, reimpressão e pop-up único.

`docs/operations/windows-qz-tray-printing.md`

- manter configuração QZ/Windows realmente homologada;
- remover smoke test Android/RawBT;
- explicar que todos os dispositivos apenas criam jobs centrais;
- documentar `Fila de impressão`, saúde da estação e recuperação offline;
- documentar a exceção automática de 1 via para mesa/consumo local;
- atualizar nomes de fila/driver somente a partir da estação física realmente homologada, sem hard-code inventado.

README e outros documentos ativos:

- revisar qualquer seção que descreva RawBT/Web Serial como arquitetura suportada atual.

### 23.2 Specs e planos históricos

Documentos antigos de design/implementação não devem ser silenciosamente apagados, pois registram decisões que de fato existiram. Eles devem receber um aviso claro no topo apontando para esta spec como substituta, por exemplo:

> **Superseded em 2026-09-08 por `2026-09-08-centralized-qz-print-queue-design.md`. Não usar este documento como runbook atual.**

Revisar pelo menos:

- `docs/superpowers/specs/2026-09-03-order-printing-escpos-design.md`;
- `docs/superpowers/plans/2026-09-03-order-printing-escpos-plan.md`;
- `docs/superpowers/plans/2026-09-07-qz-master-sync-plan.md`.

O plano QZ de 2026-09-07 também referencia uma spec `2026-09-06-windows-qz-silent-printing-design.md` ausente na `master`; o aviso de superseded deve impedir que esse link antigo seja tratado como fonte atual.

## 24. Estratégia de migração/cutover

A ordem é obrigatória para não retirar o caminho atual antes de provar o novo.

### Fase A — schema e contratos compatíveis

- migration aditiva;
- configuração central;
- regra automática de 1 via para mesa/consumo local;
- novos estados/eventos/parent link/prioridade;
- backend ainda compatível com frontend anterior durante a transição quando necessário.

### Fase B — fila visual e semântica de solicitação

- implementar página Fila de impressão;
- mobile/desktop criam e manipulam jobs centrais;
- `Imprimir agora` vira prioridade, não transporte local;
- reimpressão/descartar/timeline.

### Fase C — executor QZ exclusivo

- estação Windows principal torna-se único consumidor físico;
- claims de execução ficam restritos a ela;
- segunda via/pop-up ficam station-scoped e persistentes;
- celular/tablet deixam de fazer claim físico.

### Fase D — homologação física em staging

Antes de remover legado, validar com hardware real:

- pedido criado no PC -> impressão QZ;
- pedido criado no celular -> job central -> impressão QZ no PC;
- solicitação manual pelo celular -> impressão no PC;
- pedido de mesa/consumo local -> exatamente 1 via automática mesmo com padrão do negócio em 2 vias;
- pedido Entrega/Retirada -> respeita 1/2 vias da configuração central;
- reimpressão manual de pedido local -> permite escolha explícita de 1 ou 2 vias;
- 1 via;
- 2 vias com pausa e único aviso;
- `Depois` + retomada pela fila;
- QZ fechado;
- PC offline e retorno;
- pedido ativo pendente volta a imprimir;
- pedido finalizado/cancelado pendente vai para `Requer atenção`;
- priorização `Imprimir agora`;
- descarte preservado no histórico;
- reimpressão cria job vinculado;
- falha conhecida e resultado incerto;
- reload/foco não duplica impressão nem pop-up.

### Fase E — remoção do legado e documentação

Somente após Fase D aprovada:

- remover RawBT;
- remover Web Serial de impressão;
- remover UI/testes/configurações obsoletas;
- reescrever runbook/checklist ativos;
- marcar specs/planos antigos como superseded;
- executar busca final por referências legadas.

### Fase F — gate de release

- testes completos verdes;
- lint verde;
- build verde;
- validação Worker/migrations verde;
- staging no HEAD exato;
- nova homologação física rápida após a limpeza;
- aprovação explícita para merge/release;
- nenhuma ação desta spec autoriza deploy automático de produção.

## 25. Estratégia de testes

A implementação seguirá TDD estrito.

### 25.1 Backend/jobs

Testar:

- todo novo pedido elegível cria exatamente um job automático mesmo sem estação online;
- idempotência do job automático;
- pedido de mesa/consumo local cria job automático com exatamente 1 via, mesmo quando o padrão central é 2;
- pedido de Entrega/Retirada usa a quantidade central vigente no instante da criação;
- mudar a configuração central não altera `copies_requested` de jobs já criados;
- reimpressão manual de pedido local pode criar novo job com 1 ou 2 vias conforme escolha explícita;
- celular não pode claimar execução física;
- somente estação principal QZ pode claimar;
- prioridade altera a ordem sem interromper job em processamento;
- pedido finalizado/cancelado não é consumido automaticamente;
- job ativo pendente sobrevive a estação offline;
- discard preserva histórico;
- reimpressão cria novo job com `parent_job_id` e snapshot novo;
- retry conhecido reutiliza snapshot do mesmo job;
- resultado incerto vai para `requires_attention`;
- segunda via usa mesmo job;
- configurações centrais de vias não alteram jobs antigos;
- isolamento por `business_id`.

### 25.2 Estação/QZ

Testar:

- transport QZ é o único executor físico suportado;
- QZ não pronto impede claim local;
- fila não configurada impede prontidão;
- sucesso QZ progride cópia corretamente;
- falha QZ não marca job como impresso;
- heartbeat/prontidão alimentam estado da fila;
- nenhum caminho Android importa ou dispara transporte físico no estado final.

### 25.3 UI

Testar desktop e mobile:

- KPIs/filtros/busca;
- status derivados `Na fila`/`Aguardando estação`;
- ações permitidas por estado;
- `Imprimir agora` não chama transporte local;
- toast em dispositivo solicitante;
- discard/reprint/timeline;
- configuração central 1/2 vias com explicação da exceção para mesa/consumo local;
- ausência de UI RawBT/Web Serial.

### 25.4 Pop-up de segunda via

Testar:

- só estação principal exibe;
- celular/tablet nunca exibem;
- aparece uma vez ao entrar em `awaiting_second_copy`;
- job automático inicial de mesa/consumo local nunca entra em `awaiting_second_copy`;
- reload não reapresenta após acknowledgment;
- `Depois` preserva o job na fila;
- `Imprimir 2ª via` imprime somente cópia 2;
- concluir segunda via encerra o job.

### 25.5 Regressões

Manter verdes:

- criação de pedido;
- cozinha/realtime;
- pedidos agendados;
- cancelamento/finalização;
- mesas/comandas;
- financeiro;
- preview/PDF;
- autenticação;
- dark/light theme;
- mobile.

## 26. Critérios de aceite

A arquitetura estará pronta para promoção somente quando:

1. RawBT não fizer parte do fluxo operacional;
2. Web Serial não fizer parte do fluxo operacional;
3. apenas a estação Windows principal/QZ puder executar fisicamente jobs;
4. celular e tablet puderem solicitar impressão sem aplicativo/driver externo;
5. todo novo pedido elegível entrar automaticamente na fila;
6. pedido de mesa/consumo local criar exatamente 1 via no job automático inicial, independentemente do padrão central;
7. pedido de Entrega/Retirada respeitar a configuração central de 1/2 vias;
8. estação offline não perder jobs;
9. `Imprimir agora` priorizar sem tentar impressão local;
10. finalizados/cancelados pendentes não imprimirem silenciosamente no retorno da estação;
11. fila visual funcionar em desktop e mobile;
12. descarte preservar histórico;
13. reimpressão gerar job novo vinculado e permitir escolha explícita de vias;
14. duas vias funcionarem com pausa manual e um único pop-up na estação principal;
15. job automático local nunca gerar pop-up de segunda via;
16. nenhum pop-up de segunda via aparecer em dispositivos secundários;
17. reload/foco/sincronização não duplicarem job, cópia ou popup;
18. falha conhecida e resultado incerto tiverem semânticas diferentes;
19. documentação ativa refletir somente a arquitetura QZ central e a regra local de 1 via;
20. documentos históricos conflitantes estiverem claramente marcados como superseded;
21. código legado RawBT/Web Serial estiver removido após homologação;
22. testes, lint, build e validações de Worker/migrations estiverem verdes;
23. homologação física em staging estiver aprovada no HEAD exato;
24. produção permanecer intocada até autorização explícita posterior.

## 27. Evolução futura — usuários e permissões

A aplicação ainda não possui múltiplos usuários com permissões de gestão. Isso fica fora desta entrega.

A arquitetura deve, entretanto, evitar decisões que impeçam uma evolução futura para permissões como:

- visualizar fila;
- priorizar impressão;
- descartar job;
- reimprimir;
- alterar quantidade padrão de vias;
- configurar estação física.

Até essa evolução, valem as permissões gerais da autenticação atual. Eventos devem guardar o ator disponível hoje de forma não sensível e admitir `user_id` posteriormente.

## 28. Decisão final

O Gestão Delivery adota **fila central + uma única estação física Windows/QZ** como arquitetura oficial de impressão.

Celulares, tablets e computadores secundários deixam de ser impressoras/estações físicas e passam a ser clientes da fila. A simplificação operacional — uma impressora, um PC, um QZ Tray, uma fila central — tem prioridade sobre manter múltiplos transportes específicos por plataforma.

A quantidade padrão central de vias vale para Entrega/Retirada, enquanto o job automático inicial de mesa/consumo local usa sempre 1 via para atender apenas à necessidade da cozinha. Reimpressões continuam podendo escolher 1 ou 2 vias explicitamente.

RawBT e Web Serial serão removidos somente depois da nova arquitetura estar implementada e fisicamente homologada em staging, evitando uma janela em que o estabelecimento fique sem impressão funcional.