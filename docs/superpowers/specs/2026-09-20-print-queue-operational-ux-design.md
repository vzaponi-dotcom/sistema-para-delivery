# Print Queue Operational UX — Design Spec

**Data:** 2026-09-20  
**Status:** **DRAFT** — direção funcional aprovada em conversa; documento aguardando revisão/aprovação explícita antes do plano de implementação  
**Branch:** `feature/print-queue-operational-ux`  
**Base:** `master` em `341881482389e872e6039b42395dbaee92fc81b2` — merge da Spec C10 / PR #54  
**Produção:** não tocar sem autorização separada  
**Gate físico existente:** C9 functional rows + matriz P1–P20 continuam `DEFERRED-PRODUCTION` e bloqueiam produção no release candidate final, não o desenvolvimento/merge desta melhoria.

## 1. Objetivo

Melhorar a experiência da **Fila de impressão**, principalmente no mobile, fazendo a tela comunicar o estado operacional real da impressão do negócio em vez de expor telemetria técnica da estação local que está visualizando a página.

A melhoria também refina o terceiro card de **Configurações → Impressão** para que ele represente corretamente o papel da estação atual:

- uma estação Windows principal pode executar impressão física via QZ;
- Android e demais estações `queue-only` acompanham a fila central, mas não executam QZ local;
- a indisponibilidade de uma estação secundária não deve fazer a operação inteira parecer indisponível;
- a tela operacional deve priorizar impacto sobre jobs, não detalhes técnicos de dispositivo.

A implementação deve preservar integralmente o pipeline físico existente.

## 2. Problema confirmado na base atual

A base pós-C10 já possui a separação arquitetural correta entre transporte físico e dispositivos `queue-only`, porém a UI da Fila de impressão ainda interpreta o estado errado.

Hoje `PrintQueue.jsx` usa:

- `printing.localStation` como estação exibida;
- `getPrintStationSummary(localStation)` para mostrar Online/Offline, QZ e fila;
- `printing.printerHealth` local para decidir se a impressora está indisponível;
- o texto literal `Cozinha PC` no card superior.

Esse desenho responde à pergunta:

> “Como está o dispositivo no qual estou vendo a tela?”

Mas a Fila de impressão precisa responder:

> “A impressão do negócio está operacional e os jobs conseguem ser processados?”

Em Android, `getPrintingTransportKind('android') === 'queue-only'`. Esse dispositivo não deve inicializar transporte físico QZ. Logo, usar sua saúde local para representar a impressão central pode gerar falso estado de indisponibilidade.

## 3. Arquitetura existente que deve ser preservada

A implementação atual já diferencia corretamente as responsabilidades:

### 3.1 Windows

`getPrintingTransportKind('windows') === 'qz'`.

Somente uma estação elegível Windows + principal pode:

- inicializar transporte físico em background;
- consumir automaticamente jobs;
- enviar heartbeat físico;
- executar QZ;
- observar a impressora;
- enviar bytes para a fila Windows;
- executar segunda via física.

### 3.2 Android e outras plataformas

Android e plataformas sem QZ são `queue-only`.

Elas podem:

- criar e acompanhar jobs;
- usar a Fila de impressão;
- executar ações remotas permitidas sobre jobs;
- consultar Configurações → Impressão;

mas não devem:

- executar QZ local;
- fazer a ausência de QZ local parecer falha do negócio;
- ser tratadas como executor físico apenas por estarem autenticadas.

### 3.3 Impressora configurada

O nome da fila QZ é uma preferência local da estação física, persistida por `stationId` em:

`delivery-qz-printer-name:<stationId>`

Esta spec **não** transforma o nome da impressora em configuração global e não cria uma nova fonte de verdade no backend.

### 3.4 Política de vias

A política atual permanece intocada:

- Pedidos: 1 ou 2 vias;
- Mesas / Comandas: 1 ou 2 vias;
- alterações afetam somente novos jobs;
- reprint/manual pode fornecer cópias explicitamente;
- teste físico usa 1 via.

## 4. Princípio de UX

A Fila de impressão passa a seguir a regra:

> **mostrar impacto operacional, não telemetria técnica da estação visualizadora.**

A primeira dobra deve responder rapidamente:

1. A impressão do negócio está disponível?
2. Existe algum impedimento real para processar jobs?
3. Quantos trabalhos estão aguardando?
4. Quantos exigem intervenção?
5. Onde estão os trabalhos para agir?

Informações como nome da estação local, plataforma, QZ local em Android e detalhes técnicos não devem competir com essas respostas.

## 5. Fonte do estado operacional

Deve existir uma projeção única e testável do estado operacional de Printing, sem React e sem acesso direto ao browser.

Direção de arquivo:

`src/domains/printing/domain/printOperationalStatus.js`

O nome final pode variar no plano, mas o ownership deve permanecer dentro do domínio `printing`.

### 5.1 Entradas

A projeção pode consumir dados já disponíveis no frontend, como:

- `stations`;
- `localStation`;
- `transportKind`;
- `qzConnected`;
- `configuredPrinterName`;
- `printerQueueFound`;
- `printerHealth`;
- contagem de jobs pendentes quando necessária para mensagem/tone.

Ela não deve chamar API, localStorage nem QZ diretamente.

### 5.2 Saída conceitual

O resolver deve produzir um view-model semântico, por exemplo:

- `code`;
- `tone`;
- `title`;
- `description`;
- `primaryStation`;
- `isLocalPrimary`;
- `pendingCount`;
- detalhes opcionais permitidos pela fonte disponível.

A UI não deve remontar a mesma árvore de decisão em vários componentes.

## 6. Resolução da estação principal

A Fila de impressão deve procurar a estação responsável pela operação, e não assumir que `localStation` é a responsável.

Ordem conceitual:

1. procurar em `printing.stations` uma estação marcada como `isPrimary`;
2. se a coleção ainda estiver incompleta e `localStation.isPrimary === true`, usar a estação local;
3. se não existir estação principal conhecida, retornar estado explícito de ausência de configuração;
4. nunca escolher uma estação secundária apenas porque ela é o dispositivo atual.

Uma estação secundária offline não muda o estado global de impressão.

## 7. Precedência de saúde

### 7.1 Quando o dispositivo atual é a estação física principal

Se a estação local é a mesma estação principal e o transporte é `qz`, a UI pode usar o estado local mais rico já disponível no manager:

- `qzConnected`;
- `configuredPrinterName`;
- `printerQueueFound`;
- `printerHealth`.

Isso preserva feedback rápido no próprio Windows e permite mensagens específicas como “impressora não configurada”.

### 7.2 Quando a fila é vista remotamente

Em Android, tablet ou estação secundária, a UI usa a saúde publicada da **estação principal**, por exemplo:

- `primaryStation.health.online`;
- `primaryStation.health.qzReady`;
- `primaryStation.health.printerReady`;
- `primaryStation.health.physicalState`, quando disponível.

A saúde local do dispositivo remoto não deve ser usada para declarar a impressora central indisponível.

### 7.3 Estado desconhecido

Ausência de heartbeat/health não pode ser interpretada automaticamente como offline.

Quando não houver evidência suficiente, usar um estado neutro como:

- **Verificando impressão**; ou
- **Status da impressão indisponível**.

Não mostrar alerta vermelho baseado em ausência de dados.

## 8. Estados operacionais

O resolver deve suportar pelo menos os seguintes estados.

### 8.1 Disponível

Condição: estação principal conhecida e caminho físico pronto segundo a melhor fonte disponível.

UI:

**Impressão disponível**

Descrição remota:

`Gerenciada pela estação <nome da estação principal>`

Descrição local opcional:

`<nome da impressora> · Impressora desta estação`

Tone: sucesso.

### 8.2 Sem estação principal

Condição: nenhuma estação principal conhecida.

UI:

**Estação de impressão não configurada**

Descrição:

`Defina uma estação Windows como responsável pela impressão automática.`

Tone: aviso.

A ação de configuração continua levando para a tela existente de Configurações → Impressão.

### 8.3 Estação principal offline

Condição: existe estação principal e o backend informa explicitamente `health.online === false`.

UI:

**Estação de impressão indisponível**

Descrição:

`A estação <nome> está offline.`

Se houver jobs pendentes, incluir a quantidade afetada.

Tone: aviso/erro operacional proporcional ao impacto.

### 8.4 QZ indisponível na principal

Condição: principal online, porém `qzReady === false`, ou estado local equivalente quando o viewer é a principal.

UI:

**QZ Tray desconectado na estação principal**

Descrição curta orientada à correção.

Nunca exibir essa mensagem porque o Android visualizador não possui QZ.

### 8.5 Impressora não configurada — somente quando conhecido

Quando a própria estação principal está sendo usada e `configuredPrinterName` está ausente:

**Impressora não configurada**

A UI pode indicar que é necessário selecionar a fila local.

Em visualização remota, se o heartbeat não permite distinguir “não configurada” de outras falhas, não inventar a causa. Usar mensagem genérica de caminho físico indisponível.

### 8.6 Impressora/fila indisponível

Quando a principal está online, QZ está pronto, mas a fila/impressora não está pronta:

**Impressora indisponível**

Quando `physicalState` permitir, a mensagem pode distinguir:

- impressora desligada/desconectada;
- atenção necessária;
- verificando.

Sem evidência suficiente, usar texto genérico.

### 8.7 Verificando

Estado transitório ou informação insuficiente.

UI:

**Verificando impressão**

Tone: neutro.

O estado não deve produzir banner crítico por si só.

## 9. Relação entre saúde e jobs pendentes

A existência de jobs pendentes não define, sozinha, se a impressão está saudável.

A UI combina:

- saúde operacional;
- quantidade de trabalhos;
- severidade do impacto.

Exemplos:

### Saudável + 3 pendentes

**Impressão disponível**  
`3 trabalhos aguardando impressão`

Não existe alerta de falha.

### Principal offline + 3 pendentes

**Estação de impressão indisponível**  
`3 trabalhos aguardando a estação voltar.`

O impedimento é operacional e merece destaque.

### Principal offline + 0 pendentes

Mostrar o estado de indisponibilidade, mas com menos urgência visual do que quando existe backlog afetado.

### Estação secundária offline

Não gerar banner de falha da impressão central.

## 10. Fila de impressão — novo cabeçalho

A tela continua usando o conceito visual do sistema, mas a ação de configurações precisa deixar de ocupar uma linha grande no mobile.

### Desktop

Manter:

- eyebrow `OPERAÇÃO`;
- título `Fila de impressão`;
- descrição;
- ação `Configurações > Impressão` ou equivalente compacta à direita.

### Mobile

Na mesma região visual do título:

`Fila de impressão                         [⚙]`

O botão:

- deve ter somente ícone visual;
- aproximadamente 36–40 px;
- manter `aria-label` descritivo;
- não ocupar 100% da largura;
- não aparecer como bloco solto entre título e status.

A implementação deve ser **escopada à Fila de impressão**. Não alterar o comportamento mobile global de `PageHeader` de forma que outras telas mudem inadvertidamente.

## 11. Card operacional superior

O card atual:

- `Cozinha PC`;
- nome da estação local;
- Online/Offline;
- QZ conectado/desconectado;
- fila encontrada/indisponível;

deixa de existir nesse formato.

Ele é substituído por um único card de **estado operacional da impressão**.

Conteúdo esperado:

- ícone/tone do estado;
- título semântico;
- descrição curta;
- nome da estação principal quando útil;
- quantidade de jobs afetados quando relevante.

O literal `Cozinha PC` deve ser removido.

A estação local Android não deve aparecer como protagonista da primeira dobra.

## 12. Resumo da fila

Os quatro conceitos atuais são preservados:

- Aguardando impressão;
- Aguardando confirmação;
- Aguardando 2ª via;
- Requer atenção.

Nenhuma regra de contagem muda.

### 12.1 Hierarquia visual

No mobile:

- número é o elemento principal;
- label é secundário;
- cards ficam em grade 2×2;
- `Requer atenção > 0` recebe maior ênfase;
- valores zero devem parecer neutros, sem competir visualmente com pendências reais.

Labels podem ser encurtados visualmente no mobile desde que a semântica/acessibilidade permaneça completa.

### 12.2 Não alterar semântica

`buildPrintQueueSummary` ou equivalente continua contando os mesmos estados canônicos.

Esta entrega não redefine status de jobs.

## 13. Trabalhos de impressão

A seção de trabalhos permanece responsável por:

- busca;
- filtros;
- paginação;
- cards mobile;
- tabela desktop;
- detalhes;
- ações;
- retry;
- force print;
- discard;
- segunda via;
- reprint;
- resolução de resultado desconhecido.

A melhoria visual pode reduzir espaço antes da lista, mas não altera a semântica dessas ações.

Filtros de histórico `Impresso` e `Descartado` permanecem disponíveis conforme o comportamento atual.

## 14. Configurações → Impressão

Não será criada uma segunda página de configuração.

A engrenagem da Fila continua navegando para o destino existente:

`settings-printing`

A tela atual permanece com os recursos independentes:

1. Política de impressão do negócio;
2. Estação;
3. impressão física/fila central contextual.

Não criar uma transação global entre esses recursos.

## 15. Card “Política de impressão do negócio”

Sem mudança funcional.

Preservar:

- Pedidos: 1 ou 2 vias;
- Mesas / Comandas: 1 ou 2 vias;
- save/cancel independente;
- aviso de que mudanças valem para novas solicitações.

Esta spec não altera a fonte de verdade da política.

## 16. Card “Estação”

Sem mudança funcional nas regras.

Preservar:

- Nome da estação;
- Plataforma;
- indicador Principal;
- ação confirmada para tornar principal;
- Impressão automática somente onde elegível;
- capabilities existentes;
- conflitos/unconfirmed/reconcile existentes.

Mudanças permitidas são apenas de texto/arranjo necessárias para coerência da nova UX.

## 17. Terceiro card de Configurações

O título e conteúdo tornam-se contextuais.

### 17.1 Na estação Windows/QZ

Título:

**Impressão nesta estação**

Conteúdo:

- status do QZ;
- impressora/fila local configurada;
- saúde física;
- impressão automática quando aplicável;
- jobs aguardando;
- `Testar impressão`;
- `Trocar impressora`.

Ações atuais continuam chamando exatamente os mesmos adapters/managers.

### 17.2 Em Android / queue-only

Título:

**Impressão do negócio**

Conteúdo:

- status operacional da estação principal;
- nome da estação responsável quando conhecido;
- resumo da fila;
- texto claro:

`Esta estação acompanha a fila central e não realiza impressão física.`

Não mostrar:

- seletor de impressora local;
- `Testar impressão`;
- estado fictício de QZ local;
- “Impressora configurada: Fila central”.

### 17.3 Sem principal configurada

O card orienta a definir uma estação principal utilizando o controle já existente no card Estação.

Não criar configuração paralela.

## 18. Nome da impressora em dispositivos remotos

O nome da impressora QZ permanece local à estação Windows.

Consequência deliberada:

- no próprio Windows, a UI pode mostrar o nome da impressora configurada;
- no Android, a UI mostra o nome da **estação responsável**, mas não precisa mostrar o nome físico da impressora;
- não adicionar campo ao heartbeat/backend apenas para permitir essa informação nesta melhoria.

Uma futura necessidade de inventário remoto de impressoras deve ser tratada em spec separada.

## 19. Estações secundárias

A saúde de uma estação secundária não participa do cálculo principal de disponibilidade.

Se:

- a estação principal está saudável;
- uma estação secundária está offline;

a Fila continua exibindo:

**Impressão disponível**

Esta spec não exige uma lista de estações secundárias na tela operacional.

## 20. Recovery

Os estados existentes de recovery `active` / `deferred` continuam independentes do card de saúde.

O banner de recovery atual permanece funcional.

A projeção operacional não deve:

- iniciar recovery;
- encerrar recovery;
- alterar affinity;
- alterar jobs;
- mascarar o banner existente.

É permitido reorganizar a posição visual para manter a primeira dobra clara, desde que os comandos e textos funcionais permaneçam acessíveis.

## 21. Capabilities

Preservar as capabilities existentes.

A melhoria não cria novas permissões.

Em particular:

- `printing.queue` continua controlando acesso à fila;
- `printing.settings.view` / `printing.settings` continuam controlando policy;
- `printing.station.view` / `printing.station.configure` continuam controlando estação;
- `printing.execute` e `printing.discard` continuam controlando ações operacionais.

A engrenagem não deve expor conteúdo que a navegação de settings bloquearia por capability.

## 22. Acessibilidade

Requisitos mínimos:

- status não pode depender apenas de cor;
- ícones decorativos devem ter tratamento apropriado;
- botão de engrenagem mobile deve manter nome acessível;
- números dos cards devem manter labels compreensíveis;
- mensagens dinâmicas críticas usam semântica compatível com o comportamento atual, sem excesso de anúncios;
- foco e teclado das ações atuais não podem regredir.

## 23. Tema claro/escuro

Usar exclusivamente tokens semânticos existentes ou tokens novos do design system, se indispensáveis.

Não introduzir cores hardcoded específicas do tema.

Os estados devem funcionar em ambos:

- sucesso;
- aviso;
- erro/atenção;
- neutro/verificando.

## 24. Responsividade

### Mobile

Prioridades:

1. título + engrenagem compacta;
2. status operacional;
3. resumo 2×2;
4. Trabalhos de impressão;
5. filtros;
6. cards dos jobs.

Não deve existir rolagem horizontal.

### Desktop

Aproveitar largura sem criar uma experiência diferente.

Direção:

- header com ação à direita;
- status operacional compacto;
- quatro indicadores em linha quando houver espaço;
- tabela existente abaixo.

## 25. Fronteira técnica

Mudanças esperadas permanecem concentradas em Printing.

Arquivos prováveis:

- `src/domains/printing/domain/printOperationalStatus.js` — novo resolver;
- `src/domains/printing/domain/printOperationalStatus.test.js`;
- `src/domains/printing/ui/PrintQueue.jsx`;
- `src/domains/printing/ui/PrintQueue.test.js`;
- `src/domains/printing/ui/printQueueSummary.js` apenas se necessário para remover responsabilidade de station summary;
- `src/domains/printing/ui/print-queue.css`;
- `src/domains/printing/ui/PrintingSettingsContent.jsx`;
- `src/domains/printing/ui/PrintingSettingsContent.test.js`;
- `src/domains/printing/ui/printing.css`;
- eventualmente testes de integração da surface de Settings.

O plano deve preferir criar helper semântico novo a ampliar lógica condicional diretamente em JSX.

## 26. O que não deve mudar

Esta melhoria não deve alterar:

- Worker/backend;
- D1/schema/migrations;
- endpoints;
- payloads;
- polling;
- heartbeat cadence;
- criação/claim/complete/fail de job;
- `runClaimedPrintJob`;
- exclusividade de operação física;
- QZ transport;
- QZ signing/security;
- spool observation;
- renderer ESC/POS;
- recovery state machine;
- second-copy state machine;
- storage key da impressora;
- station id local;
- política de vias;
- capabilities;
- navegação global;
- produção.

## 27. TDD obrigatório

A implementação deve seguir RED → GREEN por comportamento.

Testes mínimos devem provar:

1. Android/queue-only não usa sua saúde local para declarar a impressão central offline;
2. principal saudável produz estado `ready`;
3. principal explicitamente offline produz estado `primary_offline`;
4. QZ indisponível da principal produz estado correspondente;
5. ausência de health produz `unknown/verifying`, não falso offline;
6. ausência de principal produz `no_primary`;
7. estação secundária offline não degrada o estado global;
8. viewer local principal pode usar estado QZ mais rico;
9. o literal `Cozinha PC` sai da Fila;
10. o banner antigo baseado apenas em `printing.printerHealth` local deixa de existir;
11. card de Settings em queue-only não mostra controles físicos;
12. card de Settings em QZ mantém Testar/Trocar impressora;
13. política e estação continuam independentes;
14. layout mobile mantém quatro indicadores em 2×2;
15. engrenagem mobile não vira botão full-width;
16. filtros/actions/history existentes não regredem.

## 28. Homologação funcional desta melhoria

A homologação em staging deve cobrir pelo menos:

### Mobile Android / queue-only

- abrir Fila de impressão;
- confirmar ausência de falso `QZ desconectado` local;
- confirmar que o estado representa a estação principal;
- validar principal disponível;
- validar principal offline usando estado real/simulado de staging quando possível;
- validar backlog e cards;
- abrir Configurações pela engrenagem;
- confirmar card `Impressão do negócio`;
- confirmar ausência de Testar/Trocar impressora no Android.

### Windows principal

- abrir Fila;
- confirmar status local coerente;
- confirmar nome da impressora quando disponível;
- abrir Configurações;
- confirmar card `Impressão nesta estação`;
- confirmar que Testar impressão e Trocar impressora continuam presentes;
- não executar teste físico obrigatório se hardware não estiver disponível nessa rodada.

### Desktop/mobile visual

- dark/light;
- sem overflow horizontal;
- zero counts neutros;
- attention > 0 destacado;
- header compacto no mobile;
- lista/tabela e filtros preservados.

## 29. Relação com o gate físico C9

Esta melhoria não libera produção e não substitui a homologação física pendente da C9.

As linhas funcionais físicas já marcadas e a matriz **P1–P20** permanecem:

`DEFERRED-PRODUCTION`

até execução física real no **release candidate final**.

Como esta spec não altera o executor físico, QZ transport, renderer, spool, recovery ou state machine de segunda via, o gate físico não precisa ser executado antes de desenvolver ou mergear esta melhoria.

Porém, antes de produção:

1. formar o release candidate final;
2. congelar novas alterações;
3. executar C9 physical functional rows + P1–P20 no SHA exato;
4. corrigir qualquer falha;
5. repetir os testes afetados no novo RC;
6. somente então autorizar produção.

## 30. Critérios de aceitação

A spec estará funcionalmente concluída quando:

- a Fila mostrar o estado da **impressão do negócio**, não da estação visualizadora;
- Android sem QZ local puder mostrar `Impressão disponível` quando a principal Windows estiver pronta;
- uma estação secundária offline não gerar falso alerta operacional;
- a ausência de dados não seja tratada como offline;
- o card superior deixe de exibir `Cozinha PC` hardcoded;
- o botão de configurações seja compacto no mobile;
- os quatro indicadores mantenham semântica e ganhem hierarquia visual;
- Settings continue sendo uma única tela, sem duplicação;
- queue-only mostre `Impressão do negócio` em vez de uma “Impressora local (QZ Tray)” fictícia;
- Windows/QZ mantenha todos os controles físicos atuais;
- nenhuma regra de job, vias ou execução física mude;
- suíte, lint, build e architecture gates fiquem verdes;
- staging seja homologado;
- produção permaneça bloqueada pelo gate físico C9/P1–P20.

## 31. Fora de escopo

Explicitamente fora desta entrega:

- nova página de Configurações;
- nova rota de Diagnóstico;
- inventário remoto do nome da impressora;
- adicionar nome da impressora ao heartbeat;
- múltiplas impressoras por setor;
- failover entre estações;
- alterar qual estação é principal automaticamente;
- alterar tempos de heartbeat;
- push/WebSocket/SSE;
- novos estados persistidos de jobs;
- refatorar backend;
- mudar impressão física;
- executar produção.

## 32. Decisões consolidadas

1. **Fila de impressão é uma tela operacional.**
2. **Configurações → Impressão continua sendo a única tela de configuração.**
3. **Estado global deriva da estação principal.**
4. **Saúde da estação local só representa o negócio quando a estação local é a principal física.**
5. **Queue-only nunca é penalizado por não ter QZ local.**
6. **Estação secundária offline não equivale a impressão offline.**
7. **Nome da impressora continua local; sem backend novo.**
8. **O terceiro card de Settings é contextual ao papel da estação.**
9. **A melhoria é frontend/domain projection + UX, não alteração do pipeline físico.**
10. **C9/P1–P20 continuam como hard blocker de produção no release candidate final.**
