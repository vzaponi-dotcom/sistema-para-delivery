# Gestão Delivery — Segurança operacional da impressão física e painel da fila (Issue #36)

Data: 2026-09-09
Status: design aprovado em conversa; consolidado e auto-revisado para revisão do usuário antes do plano de implementação
Branch: `feature/print-operational-safety-issue-36`
Issue incorporada: #36 — Transformar fila de impressão em painel operacional com paginação e ordenação

## 1. Contexto

A arquitetura oficial de impressão já é centralizada: qualquer dispositivo pode solicitar impressão, mas somente a estação Windows principal da cozinha executa fisicamente os jobs pelo QZ Tray.

Na homologação real da MPT-II foi identificado um problema importante: hoje a aplicação trata “QZ conectado + fila Windows encontrada” como suficiente para considerar a estação pronta, mas isso não garante que a impressora física esteja ligada. Além disso, o fluxo atual conclui a via quando `qz.print()` resolve, embora isso só prove que o envio foi aceito pelo QZ/Windows, não que o trabalho chegou a `COMPLETE` no spooler.

Os testes físicos realizados com a MPT-II confirmaram que o driver atual expõe eventos utilizáveis pelo QZ/Winspool:

- `PRINTER OK`, `Code: 0` quando a impressora está disponível;
- `PRINTER OFFLINE`, `Code: 67108864` quando está desligada/desconectada;
- impressão normal: `SPOOLING -> PRINTING -> RETAINED -> COMPLETE -> DELETING -> DELETED`;
- quando um job é enviado com a impressora offline, ele pode permanecer em `SPOOLING` e depois imprimir sozinho quando a MPT-II volta.

Esse último comportamento prova que um job já entregue ao spooler não pode ser reenviado automaticamente, pois isso pode gerar duplicidade.

Ao mesmo tempo, a Issue #36 define que a tela de Impressão deve virar um painel operacional curto e orientado à ação, deixando o Histórico responsável por pedidos antigos e reimpressões.

Esta spec consolida as duas frentes em uma única evolução do subsistema.

## 2. Relação com a spec anterior

Esta spec complementa e, quando houver conflito, substitui as regras correspondentes de `docs/superpowers/specs/2026-09-08-centralized-qz-print-queue-design.md`.

Continuam válidos:

- fila central de impressão;
- único executor físico: estação Windows principal;
- QZ Tray como transporte físico oficial;
- snapshot imutável por job;
- uma ou duas vias por job;
- segunda via controlada pelo operador;
- prioridade persistida no backend;
- reimpressão como novo job;
- celulares/tablets não executam fisicamente;
- staging antes de produção.

São substituídos por esta spec:

- sucesso físico baseado apenas no retorno de `qz.print()`;
- “fila QZ encontrada” como sinônimo de “impressora pronta”;
- retomada automática indiscriminada do backlog quando a impressora volta;
- retry automático de uma via cujo resultado ficou incerto;
- uso da tela Impressão como histórico navegável indefinidamente.

## 3. Objetivos

A entrega deve:

1. bloquear consumo quando a MPT-II estiver offline ou em estado físico não operacional;
2. distinguir QZ conectado, fila encontrada, impressora pronta e via concluída;
3. incrementar `copies_printed` somente após `JOB COMPLETE` correlacionado àquela tentativa, ou confirmação manual explícita em caso incerto;
4. impedir reenvio automático de tentativa já submetida ao spooler;
5. recuperar backlog uma via física por vez;
6. pausar novos jobs enquanto existir recuperação pendente/ativa/deferida;
7. melhorar mensagens de Configurações e Fila;
8. transformar a tela de Impressão no painel operacional da Issue #36;
9. mover paginação/ordenação para a fonte de dados/backend;
10. mostrar no máximo 10 concluídas recentes;
11. manter reimpressão histórica na tela Histórico;
12. aplicar retenção automática segura de 30 dias a estados terminais elegíveis;
13. preservar auditoria e diagnóstico;
14. seguir TDD e homologação física em staging.

## 4. Fora de escopo

Não fazem parte desta entrega:

- sensor mecânico independente para comprovar fisicamente o papel;
- nova impressora profissional;
- múltiplas impressoras/setores;
- segunda estação automática de failover;
- corte automático;
- impressão automática do backlog inteiro;
- histórico completo de jobs dentro da tela Impressão;
- RBAC/perfis;
- mudança do conteúdo/layout do ticket já homologado, salvo identificador técnico do job enviado ao spooler;
- deploy direto em produção.

## 5. Princípio central de segurança

A aplicação deve separar quatro conceitos:

1. **QZ conectado** — existe comunicação com o QZ Tray;
2. **fila Windows encontrada** — a fila configurada existe;
3. **impressora fisicamente pronta** — status `PRINTER` atual foi classificado como operacional;
4. **via concluída** — status `JOB COMPLETE` foi correlacionado à tentativa física correta.

Nenhum desses conceitos implica automaticamente o próximo.

Regra oficial:

> Só se inicia uma nova via quando a estação está operacionalmente pronta. Só se contabiliza a via quando existe confirmação conclusiva daquela tentativa.

## 6. Modelo único de saúde da impressora

Configurações e Fila devem consumir o mesmo estado derivado.

Estados amigáveis canônicos:

- `ready` -> **Pronta para imprimir**;
- `verifying` -> **Verificando impressora…**;
- `printer_offline` -> **Impressora desligada ou desconectada**;
- `printer_attention` -> **Atenção necessária na impressora**;
- `qz_unavailable` -> **QZ Tray indisponível**;
- `printer_not_found` -> **Impressora não encontrada**;
- `unconfigured` -> **Impressora não configurada**;
- `unsupported` -> plataforma sem execução física.

### 6.1 Regra fail-closed

Somente `ready` permite iniciar nova via.

`verifying`, estados desconhecidos e qualquer status físico ainda não confirmado bloqueiam o consumo.

Ao conectar/reconectar QZ ou trocar a fila:

- invalidar o status físico anterior;
- registrar listeners novamente;
- entrar em `verifying`;
- solicitar o status atual da impressora;
- liberar apenas depois de nova confirmação operacional.

Para a MPT-II atual, `OK` libera e `OFFLINE` bloqueia. Estados de papel, erro, pausa/intervenção e demais códigos bloqueantes conhecidos devem virar `printer_attention`. Estados desconhecidos permanecem não prontos até classificação segura.

## 7. Listener QZ

A estação Windows principal deve registrar listeners para a fila selecionada.

Há dois fluxos distintos:

- `PRINTER`: saúde física da impressora;
- `JOB`: ciclo de vida da tentativa física.

A implementação deve registrar o listener de `JOB` **antes de iniciar qualquer chamada de impressão**, porque eventos como `SPOOLING`, `PRINTING` e `COMPLETE` podem ocorrer muito rapidamente.

Ao perder o WebSocket QZ:

- novas vias são bloqueadas imediatamente;
- a estação deixa de ser `ready`;
- tentativas que possam já ter sido submetidas nunca são reenviadas automaticamente.

Ao reconectar:

- resolver novamente a fila;
- voltar a `verifying`;
- reativar listeners;
- obter status atual antes de permitir novo consumo.

## 8. Heartbeat da estação

O heartbeat deixa de refletir somente a existência da fila e passa a refletir a saúde física real conhecida localmente.

O backend deve persistir, no mínimo:

- `qz_ready`;
- `printer_ready`;
- estado/código físico normalizado;
- timestamp do último status físico válido;
- último instante em que a impressora ficou offline;
- estado do ciclo de recuperação.

O heartbeat serve para outras telas conhecerem o estado resumido da estação, mas a decisão imediata de imprimir continua dependendo do listener local ativo.

## 9. Estados persistidos de `print_jobs`

Estados canônicos após esta mudança:

- `pending` — ainda está somente no Gestão Delivery e é seguro não enviar/descartar;
- `processing` — claimado e preparando a tentativa, antes do ponto de risco de submissão;
- `awaiting_confirmation` — a tentativa entrou no ponto de risco de submissão ao QZ/spooler e não pode ser reenviada automaticamente;
- `awaiting_second_copy` — primeira de duas vias foi confirmada e aguarda decisão humana;
- `printed` — todas as vias solicitadas foram confirmadas;
- `failed` — falha conhecida em que é seguro afirmar que a tentativa não ficou pendurada no spooler;
- `requires_attention` — resultado incerto ou regra de segurança exige decisão humana;
- `discarded` — necessidade de impressão cancelada de forma segura.

`copies_printed` continua sendo o número de vias confirmadas, nunca o número de chamadas feitas ao QZ.

## 10. Tentativas físicas por via

Um mesmo job pode ter duas vias e uma via pode ganhar nova tentativa manual após resultado conhecido/incerto. Por isso, o vínculo físico com o spooler deve ser modelado em entidade própria, por exemplo `print_job_attempts`.

Cada tentativa deve guardar pelo menos:

- `id`;
- `business_id`;
- `job_id`;
- `copy_number`;
- `attempt_number`;
- `station_id`;
- `spool_job_name` único;
- `spool_job_id` quando informado pelo Winspool;
- estado técnico atual;
- `submission_started_at`;
- `submitted_at` quando houver evidência de aceitação;
- `last_event_at`;
- `completed_at`;
- resultado normalizado;
- erro/código quando houver.

Resultados equivalentes:

- `prepared`;
- `submitting`;
- `spooling`;
- `printing`;
- `complete`;
- `failed`;
- `unknown`.

A combinação `job_id + copy_number + attempt_number` deve ser única.

## 11. Correlação com o spooler

Cada tentativa usa nome de job único no QZ/Windows. O QZ suporta `jobName` na configuração de impressão; a implementação deve utilizá-lo.

Formato de referência:

`GESTAO-DELIVERY:<jobId>:COPY:<copyNumber>:ATTEMPT:<attemptNumber>`

Pode haver normalização de tamanho/caracteres, mas a unicidade por tentativa deve ser preservada.

Ao receber evento `JOB`:

- correlacionar pelo `jobName` exclusivo;
- persistir `JobId` do Windows quando disponível;
- atualizar apenas a tentativa correspondente;
- ignorar jobs de outros aplicativos/testes;
- nunca concluir um job por evento genérico da mesma impressora.

## 12. Janela crítica de submissão — regra anti-duplicidade

Existe uma corrida perigosa entre chamar `qz.print()` e receber o primeiro evento `SPOOLING`. Se o navegador fechar exatamente nesse intervalo, o spooler pode ter aceitado o job mesmo sem o frontend ter recebido o evento.

Para eliminar retry inseguro, o fluxo deve persistir o **início da submissão antes de chamar `qz.print()`**.

Sequência obrigatória:

1. validar estação, saúde e recuperação;
2. registrar listener `JOB` ativo;
3. criar a tentativa em `prepared`;
4. imediatamente antes de `qz.print()`, persistir `submission_started_at`, mover a tentativa para `submitting` e o job para `awaiting_confirmation` (ou estado equivalente que bloqueie retry automático);
5. chamar `qz.print()` com `jobName` único;
6. processar `SPOOLING`/`PRINTING`/`COMPLETE`;
7. só `COMPLETE` conclui a via.

Depois do passo 4, o sistema age conservadoramente: qualquer perda de processo/conexão pode representar uma tentativa aceita e, portanto, nunca gera reenvio automático.

Somente erros explicitamente classificados como **pré-submissão e comprovadamente não aceitos pelo QZ/spooler** podem retornar para `failed`/retry seguro. Erros durante ou depois de `submitting` que não provem ausência de aceitação viram resultado incerto.

## 13. Semântica de `qz.print()`

O retorno bem-sucedido de `qz.print()` não conclui a via.

Ele pode ser registrado como evidência adicional de envio, mas `copies_printed` permanece inalterado.

Eventos:

- `SPOOLING` -> tentativa registrada como aceita/aguardando;
- `PRINTING` -> tentativa em impressão;
- `RETAINED` -> pode ser registrado para diagnóstico;
- `COMPLETE` -> confirmação positiva;
- `DELETING`/`DELETED` -> pós-conclusão, úteis para diagnóstico, mas não necessários para contabilizar.

## 14. `JOB COMPLETE`

Somente `EventType: JOB` + `COMPLETE` correlacionado à tentativa permite:

- marcar a tentativa `complete`;
- incrementar `copies_printed` em exatamente 1;
- ir para `awaiting_second_copy` quando ainda faltar a segunda via;
- ir para `printed` quando todas as vias forem concluídas.

A operação deve ser idempotente. Receber `COMPLETE` duas vezes para a mesma tentativa não pode incrementar duas vezes.

`COMPLETE` é a confirmação operacional mais forte disponível no driver/Winspool atual e foi validado fisicamente com a MPT-II. Não é um sensor mecânico de papel, mas é a autoridade operacional desta arquitetura.

## 15. Impressora offline antes ou durante uma tentativa

### 15.1 Antes do ponto de submissão

Se a impressora ficar `OFFLINE` antes de `submission_started_at`:

- não chamar `qz.print()`;
- não incrementar cópia;
- manter o job recuperável sem risco de duplicidade.

### 15.2 Depois do ponto de submissão

Se a impressora ficar offline depois de `submission_started_at`:

- não reenviar;
- manter a via aguardando confirmação;
- deixar o spooler/Windows concluir quando possível;
- mostrar **Aguardando confirmação da impressora**.

O teste real confirmou que o Windows pode reter o job e imprimi-lo automaticamente quando a impressora volta.

## 16. Resultado não confirmado

Se a aplicação perder a capacidade de provar o resultado depois de `submission_started_at` — navegador fechado, QZ desconectado, PC reiniciado, lease abandonado ou processo perdido — nunca presumir falha.

A tentativa vai para `unknown` e o job para `requires_attention`, com razão:

`PRINT_OUTCOME_UNKNOWN`

Mensagem:

**Não foi possível confirmar esta impressão**  
Esta via pode ter sido impressa antes de a conexão ser interrompida.

Ações:

- **A via foi impressa** — confirmação manual explícita; contabiliza a via uma única vez;
- **Não foi impressa — reenviar** — exige confirmação adicional sobre risco de duplicidade e cria nova tentativa para a mesma via.

Não existe retry automático de `PRINT_OUTCOME_UNKNOWN`.

Se `COMPLETE` chegar depois e concorrer com uma confirmação manual, o backend deve garantir no máximo um incremento da via.

## 17. Lease e jobs abandonados

A proteção atual contra `processing` abandonado continua necessária, mas passa a respeitar o ponto de risco.

- `processing` sem `submission_started_at`: pode expirar para falha conhecida/retry controlado;
- tentativa com `submission_started_at`: nunca volta automaticamente a `pending`;
- tentativa submetida sem resultado conclusivo e sem executor confiável: vai para `requires_attention`.

Tempo excedido não é prova de que o papel não saiu.

## 18. Operação normal

Com a impressora `ready` e sem ciclo de recuperação:

- novos jobs continuam sendo consumidos automaticamente;
- uma tentativa física por vez;
- primeira via sai automaticamente;
- o sistema espera `JOB COMPLETE` antes de contabilizar;
- se houver segunda via, o job vai para `awaiting_second_copy`;
- a segunda via continua exigindo decisão humana.

A confirmação “Imprimir próxima” entre todos os jobs não é aplicada ao funcionamento normal.

Essa foi a opção aprovada porque preserva agilidade da operação diária.

## 19. Backlog e ciclo de recuperação

Backlog de recuperação é o conjunto de jobs ainda não submetidos fisicamente que se acumulou enquanto a impressora não estava pronta.

Quando ocorre uma transição real `não pronta -> ready` e existe backlog elegível:

- a estação entra em recuperação;
- o consumidor automático fica pausado;
- novos pedidos continuam criando jobs, mas também permanecem aguardando;
- nenhum job novo fura a recuperação.

O estado de recuperação deve ser persistido e sobreviver a reload.

Estados equivalentes:

- `none` — automático normal;
- `pending_decision` — impressora voltou e existe backlog aguardando decisão;
- `active` — recuperação via por via em andamento;
- `deferred` — operador escolheu adiar.

O backend deve detectar/persistir o ciclo com base na saúde anterior da estação e no backlog, não apenas em memória React.

## 20. Comportamento enquanto offline

Enquanto a impressora estiver offline:

- não mostrar modal de “imprimir agora”;
- não fazer claim automático;
- não chamar QZ;
- mostrar estado persistente e contagem, por exemplo:
  - **Impressora desligada ou desconectada**;
  - **4 trabalhos aguardando impressão**;
- oferecer **Ver fila**.

## 21. Prompt quando a impressora volta

Na transição `offline/non-ready -> ready`, existindo backlog, mostrar uma única vez por ciclo:

**Impressora disponível novamente**  
Há X trabalhos aguardando impressão.  
Como a impressora não possui corte automático, as vias serão impressas uma de cada vez.

Ações:

- **Imprimir agora**;
- **Agora não**;
- **Descartar todas**.

Reload, polling e foco de aba não reapresentam o mesmo prompt depois de uma decisão persistida.

Um novo ciclo físico futuro pode gerar novo prompt.

## 22. Recuperação via por via

Ao escolher **Imprimir agora**:

- recuperação vira `active`;
- pega o próximo job segundo a prioridade oficial do backend;
- imprime exatamente uma via;
- aguarda `JOB COMPLETE`;
- para antes da próxima saída física.

Após conclusão:

**Via impressa**  
Separe o papel antes de continuar.  
Restam X trabalhos/vias aguardando.

Ações:

- **Imprimir próxima**;
- **Parar por agora**.

Se o job atual possui duas vias, a segunda via também é uma saída física separada e exige nova confirmação. A UI deve informar quando a próxima ação é `2ª via do pedido #NNNN`.

Durante recuperação, novas solicitações entram na fila e não são impressas automaticamente.

## 23. `Agora não` e `Parar por agora`

Ambas adiam a recuperação sem descartar nada.

Comportamento:

- recuperação vira `deferred`;
- jobs permanecem no estado correto;
- automático continua pausado enquanto houver backlog do ciclo;
- aviso persistente continua visível;
- botão **Retomar impressões** inicia/reabre o modo via por via;
- modal não reaparece a cada refresh.

## 24. `Descartar todas` — escopo seguro

A ação em massa deve ser conservadora.

Ela pode descartar somente jobs que:

- estejam `pending`;
- tenham `copies_printed = 0`;
- não possuam tentativa com `submission_started_at`;
- portanto ainda estejam seguramente apenas no Gestão Delivery.

Ela **não** atinge:

- `processing` com ponto de submissão iniciado;
- `awaiting_confirmation`;
- `requires_attention` por resultado incerto;
- `awaiting_second_copy` de job que já teve a primeira via confirmada.

Para `awaiting_second_copy`, permanece a ação própria de pular/não imprimir a segunda via, sem fingir que o job inteiro foi descartado.

Confirmação exemplo:

**Descartar 5 trabalhos pendentes?**  
Eles ainda não foram enviados à impressora e não serão impressos.

Se existir algo fora do escopo seguro:

`5 trabalhos pendentes serão descartados. 1 via já foi enviada à impressora e continuará aguardando confirmação por segurança.`

A validação deve existir no backend.

## 25. Configurações — UX operacional

O bloco de impressão em Configurações deve mostrar:

- estado real da impressora;
- QZ conectado/desconectado;
- fila configurada;
- estação principal;
- trabalhos aguardando;
- vias aguardando confirmação;
- ação de verificar/atualizar;
- configurar/trocar fila;
- teste de impressão somente quando `ready`.

Mensagens de referência:

- **Pronta para imprimir**;
- **Verificando impressora…**;
- **Impressora desligada ou desconectada**;
- **Atenção necessária na impressora**;
- **QZ Tray indisponível**;
- **Impressora não encontrada**;
- **4 trabalhos aguardando impressão**;
- **1 via enviada à impressora aguardando confirmação**.

“Fila ativa” ou “QZ configurado” nunca deve ser exibido como sinônimo de prontidão física.

## 26. Issue #36 — responsabilidade da tela Impressão

A tela Impressão passa a ser oficialmente um **painel operacional da estação**, não um histórico completo.

Responsabilidades:

- **Cozinha** — pedidos ativos;
- **Impressão** — saúde da estação e jobs atuais;
- **Histórico** — pedidos antigos e reimpressões.

A tela Impressão deve responder rapidamente:

- a impressora está pronta?
- o que está aguardando?
- há algo preso no spooler?
- há resultado incerto?
- qual foi a última impressão concluída?

## 27. Estrutura da tela Impressão

### 27.1 Operação atual

Prioriza:

- `pending`;
- `processing`;
- `awaiting_confirmation`;
- `awaiting_second_copy`;
- `requires_attention`;
- `failed` quando ainda houver ação/diagnóstico.

Esses registros aparecem antes das concluídas.

Resumo/KPIs sugeridos:

- **Aguardando impressão**;
- **Aguardando confirmação**;
- **Requer atenção**;
- **Concluídas recentes**.

### 27.2 Impressões concluídas recentes

Mostrar no máximo as **10 `printed` mais recentes**.

Objetivo: responder “acabou de imprimir?” ou “qual foi a última impressão?”.

Não existe paginação histórica infinita desse bloco.

`discarded` e falhas terminais permanecem no banco durante a retenção, mas não competem visualmente com a operação principal.

## 28. Ordenação

A ordenação inicial da listagem operacional é `created_at DESC`: job mais recente primeiro, conforme Issue #36.

Isso é **ordenação visual**, não ordem física de execução. O claim continua respeitando prioridade persistida (`Imprimir agora`) e regras operacionais do backend.

Colunas ordenáveis no desktop, quando presentes:

- Pedido — numérica;
- Job — identificador/ordem apropriada;
- Status — textual;
- Destino/Impressora/Tipo — textual;
- Data/Hora — temporal real.

Regras:

- clique seleciona coluna;
- novo clique inverte `ASC/DESC`;
- coluna e direção ativas ficam visíveis;
- mudar sort volta para página 1;
- datas usam valor temporal canônico;
- números usam ordem numérica real.

No mobile, usar controle compacto equivalente, com a mesma fonte de verdade.

## 29. Paginação no backend

Paginação e ordenação devem ocorrer no backend. A UI não pode carregar uma página de 10 e ordenar apenas aqueles 10 localmente.

Contrato de listagem deve aceitar parâmetros equivalentes a:

- `scope=operational|recent`;
- `page`;
- `pageSize`;
- `sortBy`;
- `sortDirection`;
- filtros/busca já existentes.

Regras:

- máximo de 10 itens por página nas listas paginadas;
- paginação só aparece quando necessária;
- mudar filtro/sort volta à página 1;
- resposta inclui total suficiente para navegação;
- nenhuma duplicação/omissão entre páginas;
- `getPrintJobs({ limit: 100 })` + filtro local deixa de ser a fonte final da página operacional.

## 30. Reimpressão histórica

Reimpressão antiga permanece na tela Histórico.

Fluxo:

1. localizar pedido no Histórico;
2. solicitar reimpressão;
3. criar novo job manual;
4. novo job aparece no painel operacional;
5. execução segue as mesmas regras físicas e de confirmação.

Não é necessário manter o job original visível na tela Impressão para permitir reimpressão.

## 31. Retenção técnica de 30 dias

Política aprovada:

- reter jobs terminais elegíveis por pelo menos 30 dias;
- remover automaticamente somente estados seguros;
- nunca limpar estados ativos ou incertos por idade.

Elegíveis depois de 30 dias:

- `printed`;
- `discarded`;
- `failed` somente quando terminal e sem ação operacional pendente.

Nunca elegíveis automaticamente:

- `pending`;
- `processing`;
- `awaiting_confirmation`;
- `awaiting_second_copy`;
- `requires_attention`.

Tentativas/eventos associados podem ser removidos em cascata somente quando o job pai também for elegível.

### 31.1 Housekeeping sem cron novo

Para não adicionar infraestrutura de scheduler nesta entrega, a limpeza será oportunística e limitada por negócio:

- persistir `last_print_retention_cleanup_at` ou equivalente na configuração central de impressão;
- durante atividade normal do subsistema, se passaram pelo menos 24 horas desde a última limpeza daquele negócio, executar limpeza segura;
- atualizar o marcador;
- nunca apagar antes de 30 dias;
- se o negócio ficar sem atividade, os dados podem permanecer mais tempo até o próximo uso.

Isso preserva segurança e atende à retenção automática sem novo Cron Trigger.

## 32. Limpeza manual

Uma ação como **Limpar histórico concluído** não é requisito para a primeira implementação desta spec.

Se for adicionada futuramente ou durante a mesma entrega por baixo custo, deve:

- atingir apenas estados terminais seguros;
- nunca tocar ativos/incertos;
- exigir confirmação;
- informar quantidade;
- ser validada no backend.

## 33. API e concorrência

A API final deve suportar, reaproveitando endpoints quando fizer sentido:

- listar operação atual com paginação/ordenação;
- listar até 10 concluídas recentes;
- detalhes/timeline/tentativas;
- claim atômico;
- criar tentativa;
- marcar início de submissão antes de `qz.print()`;
- registrar eventos QZ/Winspool;
- concluir via de forma idempotente;
- marcar resultado incerto;
- confirmar manualmente resultado incerto;
- criar nova tentativa manual de reenvio;
- iniciar/deferir/retomar/finalizar recuperação;
- descartar backlog seguro em lote;
- heartbeat físico detalhado;
- housekeeping de retenção.

Regras de concorrência:

- uma tentativa física ativa por estação;
- `awaiting_confirmation` não pode ser claimado novamente;
- `submission_started_at` bloqueia retry automático;
- recuperação diferente de `none` bloqueia consumidor automático;
- `COMPLETE` repetido é idempotente;
- confirmação manual e `COMPLETE` concorrentes contabilizam no máximo uma vez;
- mutações validam `business_id`, estação principal e estado atual.

## 34. Timeline e auditoria

O detalhe do job deve permitir entender o que aconteceu sem expor toda telemetria na lista principal.

Eventos úteis:

- job criado/priorizado/claimado;
- bloqueio por saúde física;
- tentativa criada;
- submissão iniciada;
- `SPOOLING`;
- `PRINTING`;
- `RETAINED`;
- `COMPLETE`;
- resultado incerto;
- confirmação manual;
- reenvio manual autorizado;
- primeira/segunda via concluída;
- recuperação iniciada/deferida/retomada;
- descarte;
- job concluído.

## 35. Migração de dados

Usar nova migration, sem alterar migrations antigas já aplicadas.

Nome esperado:

`migrations/0019_print_physical_confirmation_and_operational_panel.sql`

Mudanças conceituais:

- adicionar `awaiting_confirmation` ao contrato de status;
- criar `print_job_attempts`;
- adicionar metadados de saúde/recuperação à estação ou estrutura equivalente;
- adicionar marcador de housekeeping à configuração de impressão;
- criar índices para operação, recentes, retenção e tentativas;
- preservar dados existentes.

Compatibilidade:

- jobs existentes continuam legíveis;
- `processing` existente na migration não é presumido como impresso;
- não criar tentativa fictícia retroativa sem evidência;
- migration não imprime, reenvia nem descarta nada.

## 36. Impacto esperado no código

Áreas principais:

Frontend/printing:

- `src/printing/qzTrayTransport.js`;
- `src/printing/usePrintingManager.js`;
- `src/printing/printJobRunner.js`;
- novos módulos focados para saúde/attempts/recovery, evitando crescer ainda mais `usePrintingManager.js`;
- testes desses módulos.

UI:

- `src/components/PrintingSettings.jsx`;
- `src/pages/PrintQueue.jsx`;
- `src/pages/printQueueSummary.js`;
- `src/pages/printQueueFilters.js`;
- `src/pages/printQueueDetails.js`;
- CSS e testes correspondentes.

API/Worker:

- `src/api/client.js`;
- `worker/orderPrintingApi.js`;
- `worker/orderPrintingRepository.js`;
- `worker/orderPrintingCentralClaim.js`;
- rotas/validações/testes relacionados;
- migration `0019`.

O plano de implementação deve confirmar a lista final antes da edição.

## 37. TDD obrigatório

A implementação deve começar cada mudança relevante com teste RED.

Cenários mínimos:

- fila encontrada + `PRINTER OFFLINE` -> não faz claim;
- status físico desconhecido -> não imprime;
- `PRINTER OK` -> fica elegível se demais condições passarem;
- listener `JOB` está ativo antes da impressão;
- `submission_started_at` é persistido antes de `qz.print()`;
- crash/perda exatamente após início da submissão -> nunca gera retry automático;
- `qz.print()` resolve sem `COMPLETE` -> não incrementa cópia;
- `SPOOLING` -> mantém aguardando confirmação;
- `COMPLETE` -> incrementa exatamente uma via;
- `COMPLETE` duplicado -> idempotente;
- offline após submissão -> não reenviar;
- reconexão + `COMPLETE` posterior -> conclui mesma tentativa;
- perda definitiva após submissão -> `PRINT_OUTCOME_UNKNOWN`;
- confirmação manual “foi impressa” -> conclui uma vez;
- reenvio consciente -> nova tentativa;
- `offline -> ready` + backlog -> pausa automático e cria ciclo persistido;
- `Agora não` -> sem impressão e sem popup repetido;
- `Descartar todas` -> só `pending` com zero cópias e nenhuma submissão;
- `awaiting_second_copy` fica fora do descarte em massa;
- recuperação imprime uma via por clique;
- novos jobs durante recuperação não furam a fila;
- fim do backlog restaura automático;
- operação normal continua automática;
- segunda via continua manual;
- sort padrão `created_at DESC`;
- paginação de até 10;
- mudança de sort volta à página 1;
- ordenação numérica/textual/temporal correta;
- backend ordena antes de paginar;
- recentes retornam no máximo 10 `printed`;
- reimpressão no Histórico cria novo job operacional;
- retenção remove apenas terminais >30 dias;
- retenção nunca apaga estados ativos/incertos;
- housekeeping no máximo uma vez por 24h por negócio;
- desktop e mobile continuam operáveis.

## 38. Homologação física em staging

Antes de produção, testar na MPT-II real:

1. impressora ligada -> pedido novo imprime e só conclui após `COMPLETE`;
2. impressora desligada -> novo pedido fica pendente e `copies_printed = 0`;
3. religar -> aparece recuperação sem disparar backlog;
4. `Agora não` -> nada imprime e aviso permanece sem spam;
5. `Retomar impressões` -> imprime uma única via;
6. `Imprimir próxima` -> somente a próxima saída física;
7. desligar após submissão -> não reenviar;
8. religar com listener ativo -> reconhecer `COMPLETE` do mesmo job;
9. simular perda do navegador/QZ depois de `submission_started_at` -> resultado incerto, sem retry automático;
10. validar as duas decisões manuais do resultado incerto;
11. validar tela com mais de 10 jobs, paginação e sort;
12. validar mobile;
13. validar reimpressão pelo Histórico;
14. validar que concluídas antigas não dominam o painel.

## 39. Critérios de aceite consolidados

A entrega está aceita quando:

- [ ] impressora offline bloqueia consumo;
- [ ] estado físico desconhecido falha fechado;
- [ ] `qz.print()` sozinho não conclui uma via;
- [ ] `copies_printed` avança apenas por `COMPLETE` ou confirmação manual explícita;
- [ ] o ponto de submissão é persistido antes da chamada ao QZ;
- [ ] uma tentativa potencialmente enviada nunca é reenviada automaticamente;
- [ ] resultado incerto exige ação humana;
- [ ] backlog não imprime em rajada na reconexão;
- [ ] recuperação é uma via física por vez;
- [ ] `Agora não` e `Descartar todas` são ações separadas;
- [ ] descarte em massa atinge somente jobs comprovadamente não submetidos;
- [ ] novos pedidos não furam recuperação;
- [ ] operação normal mantém primeira via automática;
- [ ] segunda via continua controlada;
- [ ] Configurações e Fila usam o mesmo modelo de saúde;
- [ ] tela Impressão é um painel operacional;
- [ ] jobs ativos/atenção têm prioridade visual;
- [ ] no máximo 10 concluídas recentes são mostradas;
- [ ] paginação usa até 10 itens por página;
- [ ] job mais recente aparece primeiro por padrão;
- [ ] ordenação é indicada e executada sobre a fonte completa no backend;
- [ ] Histórico continua sendo o lugar de reimpressão antiga;
- [ ] reimpressão cria novo job operacional;
- [ ] retenção de 30 dias remove apenas estados terminais seguros;
- [ ] estados ativos/incertos nunca são apagados por idade;
- [ ] testes automatizados cobrem os cenários críticos;
- [ ] staging é homologado fisicamente antes de produção.

## 40. Estratégia de implementação

O plano deve seguir esta ordem de dependência:

1. migration e modelo de tentativas/estados;
2. API de tentativa, confirmação, resultado incerto e recuperação;
3. listeners QZ `PRINTER` e `JOB`;
4. gating físico e persistência do ponto de submissão;
5. `JOB COMPLETE` como única confirmação automática;
6. recuperação manual de backlog;
7. UX de Configurações;
8. painel operacional/paginação/ordenação da Issue #36;
9. retenção;
10. regressões completas;
11. deploy em staging;
12. homologação física;
13. somente após aprovação explícita, merge/deploy de produção.

Nenhuma etapa pode relaxar a regra anti-duplicidade para acelerar a entrega.
