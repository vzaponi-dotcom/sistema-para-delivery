# Gestão Delivery — Segurança operacional da impressão física e painel da fila (Issue #36)

Data: 2026-09-09
Status: design aprovado em conversa; documento consolidado para revisão final antes do plano de implementação
Branch de design: `feature/print-operational-safety-issue-36`
Issue incorporada: #36 — Transformar fila de impressão em painel operacional com paginação e ordenação

## 1. Contexto

A fila centralizada de impressão com QZ Tray já está implementada como arquitetura oficial: qualquer dispositivo pode solicitar impressão, mas somente a estação Windows principal da cozinha executa a impressão física.

Durante a homologação física da MPT-II foi identificado um problema de semântica importante: a aplicação considera a fila pronta quando o QZ está conectado e a fila Windows existe, mas isso não garante que a impressora física esteja ligada ou disponível. Além disso, o fluxo atual conclui uma via depois que `qz.print()` resolve, o que prova apenas que o QZ/Windows aceitou o envio, não que o trabalho chegou a `COMPLETE` no spooler.

Os testes reais feitos com a MPT-II mostraram que o driver atual expõe eventos de status confiáveis pelo QZ/Winspool:

- impressora disponível: `EventType: PRINTER`, `OK`, `Code: 0`;
- impressora desligada/desconectada: `EventType: PRINTER`, `OFFLINE`, `Code: 67108864`;
- impressão normal: `JOB SPOOLING -> PRINTING -> RETAINED -> COMPLETE -> DELETING -> DELETED`;
- impressão enviada com a impressora offline: o job fica em `SPOOLING`, permanece retido no Windows e imprime sozinho quando a MPT-II volta, concluindo depois com `JOB COMPLETE`.

Esse último comportamento é crítico: um trabalho já entregue ao spooler não pode ser reenviado automaticamente apenas porque a impressora ficou offline, pois isso pode gerar impressão duplicada.

Ao mesmo tempo, a Issue #36 define que a tela de Impressão deve deixar de atuar como histórico infinito e passar a ser um painel operacional curto, paginado, ordenável e focado no estado atual da estação e dos jobs que exigem ação.

Esta spec consolida as duas necessidades em uma única evolução do subsistema.

## 2. Relação com a spec anterior

Esta spec complementa e, quando houver conflito, substitui as regras correspondentes de `docs/superpowers/specs/2026-09-08-centralized-qz-print-queue-design.md`.

Permanecem válidas da arquitetura anterior:

- fila central de impressão;
- único executor físico na estação Windows principal;
- QZ Tray como transporte físico oficial;
- snapshot imutável de `OrderPrintDocument` por job;
- uma ou duas vias por job;
- segunda via controlada pelo operador;
- reimpressão como novo job;
- prioridade persistida pelo backend;
- nenhuma impressão física em celular/tablet;
- homologação em staging antes de produção.

São explicitamente substituídas nesta spec:

- a definição de sucesso físico baseada apenas em retorno de `qz.print()`;
- a noção de que “fila QZ encontrada” equivale a “impressora pronta”;
- a retomada automática indiscriminada de backlog após a estação voltar;
- qualquer retry automático de uma via cujo resultado físico ficou incerto;
- a ideia de manter a tela de Impressão como histórico navegável indefinidamente.

## 3. Objetivos

A entrega deve:

1. impedir consumo automático quando a MPT-II estiver desligada, desconectada ou em estado físico bloqueante;
2. distinguir claramente QZ conectado, fila Windows encontrada e impressora fisicamente pronta;
3. considerar uma via concluída somente após confirmação `EventType: JOB` + `COMPLETE` correspondente àquela tentativa;
4. impedir reenvio automático de tentativa já entregue ao spooler;
5. tratar perda de confirmação como estado incerto e exigir decisão humana;
6. recuperar backlog acumulado de forma controlada, uma via física por vez;
7. impedir novos pedidos de furarem a recuperação enquanto existir backlog aguardando decisão/execução manual;
8. melhorar mensagens de Configurações e Fila para mostrar o estado operacional real;
9. transformar a tela de Impressão no painel operacional definido pela Issue #36;
10. limitar concluídas recentes, paginar e ordenar no backend;
11. manter reimpressão histórica centralizada na tela Histórico;
12. aplicar retenção automática segura de 30 dias somente a jobs terminais elegíveis;
13. preservar auditoria suficiente para diagnóstico e decisões manuais;
14. manter TDD, staging e segurança de produção como requisitos da implementação.

## 4. Fora de escopo

Não fazem parte desta entrega:

- sensor físico independente para comprovar mecanicamente que o papel saiu;
- troca da MPT-II por impressora profissional;
- múltiplas impressoras ou roteamento por setor;
- segunda estação automática de failover;
- corte automático de papel;
- impressão automática de backlog inteiro após reconexão;
- busca histórica completa de jobs na tela de Impressão;
- RBAC/usuários/permissões granulares;
- alteração do layout do ticket já homologado, salvo textos estritamente necessários ao diagnóstico;
- deploy direto em produção sem homologação em staging.

## 5. Princípio central de segurança

A aplicação deve separar quatro conceitos que hoje estão parcialmente misturados:

1. **QZ conectado** — existe comunicação WebSocket com o QZ Tray;
2. **fila Windows encontrada** — a impressora configurada existe na lista do Windows/QZ;
3. **impressora fisicamente pronta** — o listener de `PRINTER` confirmou estado não bloqueante, atualmente `OK` para a MPT-II;
4. **via concluída** — o listener de `JOB` confirmou `COMPLETE` para a tentativa correspondente.

Nenhum conceito implica automaticamente o próximo.

Regra oficial:

> Uma estação só pode iniciar uma nova via quando QZ está conectado, a fila configurada foi encontrada e o último estado físico válido da impressora é operacional. Uma via só incrementa `copies_printed` depois de `JOB COMPLETE` correlacionado àquela tentativa.

## 6. Modelo de saúde da impressora

### 6.1 Estados amigáveis canônicos

A UI deve trabalhar com um modelo único de saúde operacional, compartilhado por Configurações e Fila:

- `ready` -> **Pronta para imprimir**;
- `verifying` -> **Verificando impressora…**;
- `printer_offline` -> **Impressora desligada ou desconectada**;
- `printer_attention` -> **Atenção necessária na impressora**;
- `qz_unavailable` -> **QZ Tray indisponível**;
- `printer_not_found` -> **Impressora não encontrada**;
- `unconfigured` -> **Impressora não configurada**;
- `unsupported` -> plataforma sem execução física.

### 6.2 Regra fail-closed

Somente `ready` permite iniciar uma nova via automática ou manual.

`verifying` também bloqueia consumo. Ao conectar/reconectar o QZ ou trocar a fila configurada, o sistema deve invalidar qualquer status físico anterior e permanecer em `verifying` até receber/obter um estado físico válido da impressora selecionada.

Não existe fallback silencioso de “estado desconhecido = pronta”.

### 6.3 Eventos físicos bloqueantes

Para a MPT-II atual:

- `OK` libera a estação;
- `OFFLINE` bloqueia imediatamente.

A implementação deve classificar outros estados Winspool/QZ conhecidos como papel ausente, erro ou intervenção do usuário como `printer_attention` e bloquear consumo.

Estados desconhecidos devem ser tratados conservadoramente como não prontos até classificação segura.

### 6.4 Heartbeat

O heartbeat da estação deve deixar de enviar apenas um booleano derivado da existência da fila. Ele deve refletir o estado físico real conhecido pela estação.

O backend deve persistir, no mínimo:

- `qz_ready`;
- `printer_ready`;
- código/estado físico normalizado;
- timestamp do último evento físico válido;
- último momento em que a impressora ficou offline;
- estado do ciclo de recuperação de backlog.

O heartbeat continua servindo para outras telas conhecerem o estado resumido da estação, mas não substitui o listener local de QZ para decisão imediata de impressão.

## 7. Listener QZ

A estação Windows principal deve registrar listeners de status QZ para a fila configurada.

São necessários dois fluxos independentes:

- listener de `PRINTER`, responsável por disponibilidade física;
- listener de `JOB`, responsável por ciclo de vida de cada tentativa enviada ao spooler.

Ao perder a conexão WebSocket do QZ:

- `qz_ready = false`;
- estado local deixa de ser `ready` imediatamente;
- novas vias são bloqueadas;
- tentativas já entregues ao spooler não são reenviadas.

Ao reconectar:

- a fila configurada é resolvida novamente;
- o estado físico volta para `verifying`;
- o consumo só é liberado depois de nova confirmação operacional.

## 8. Estados persistidos do job

Os estados canônicos de `print_jobs` passam a ser:

- `pending` — ainda está apenas na fila do Gestão Delivery e pode ser descartado com segurança;
- `processing` — claimado pela estação, mas ainda não existe confirmação persistida de que foi aceito pelo spooler;
- `awaiting_confirmation` — uma via foi entregue ao spooler e aguarda resultado conclusivo; não pode ser reenviada automaticamente;
- `awaiting_second_copy` — primeira de duas vias foi confirmada e aguarda decisão humana para a segunda;
- `printed` — todas as vias solicitadas foram confirmadas;
- `failed` — falha conhecida em ponto no qual o sistema sabe que a tentativa não ficou pendurada no spooler;
- `requires_attention` — resultado incerto ou condição que exige decisão humana;
- `discarded` — necessidade de impressão cancelada conscientemente antes de execução insegura.

`copies_printed` continua representando apenas vias efetivamente confirmadas pelo fluxo oficial.

## 9. Tentativas físicas por via

Como um mesmo job pode possuir duas vias e pode sofrer retry controlado, o vínculo com o spooler não deve ficar espremido em um único conjunto de colunas no próprio `print_jobs`.

A implementação deve introduzir uma entidade equivalente a `print_job_attempts`, com uma linha por tentativa física de uma via.

Cada tentativa deve guardar pelo menos:

- `id`;
- `business_id`;
- `job_id`;
- `copy_number`;
- `attempt_number`;
- `station_id`;
- `spool_job_name` único;
- `spool_job_id` quando informado pelo QZ/Winspool;
- último estado QZ/Winspool conhecido;
- `submitted_at`;
- `last_event_at`;
- `completed_at` quando houver `COMPLETE`;
- resultado normalizado (`pending`, `spooling`, `printing`, `complete`, `failed`, `unknown` ou equivalente);
- código/mensagem de erro quando houver.

Esse histórico permite responder sem ambiguidade se uma via nunca foi enviada, se está no spooler, se concluiu ou se ficou com resultado incerto.

## 10. Correlação com o spooler

Cada tentativa deve usar nome de trabalho único e determinístico o bastante para ser reconhecido nos eventos de `JOB`.

Formato de referência:

`GESTAO-DELIVERY:<jobId>:COPY:<copyNumber>:ATTEMPT:<attemptNumber>`

O valor exato pode ser normalizado para limites do QZ/Windows, mas deve permanecer único por tentativa.

Ao receber evento `JOB`:

- correlacionar primeiro pelo nome exclusivo;
- persistir `JobId` do Windows quando disponível;
- atualizar a tentativa correspondente;
- ignorar eventos que não pertencem aos nomes gerados pelo Gestão Delivery;
- nunca completar um job por evento genérico de outra impressão da mesma fila.

## 11. Semântica de envio e conclusão

### 11.1 Antes do envio

Antes de fazer claim automático e imediatamente antes de enviar os bytes:

- estação precisa ser principal;
- QZ precisa estar ativo;
- fila configurada precisa existir;
- estado físico precisa ser `ready`;
- não pode existir outra tentativa física em execução pela estação;
- não pode haver ciclo de recuperação bloqueando o consumo automático.

### 11.2 `qz.print()` resolve

O retorno bem-sucedido de `qz.print()` não conclui a via.

Depois que existe evidência de aceitação pelo spooler, por exemplo `SPOOLING` ou outro primeiro evento correlacionado, o job entra em `awaiting_confirmation` e a tentativa passa a registrar esse estado.

Se `qz.print()` resolver antes de o primeiro evento de `JOB` chegar, a estação aguarda a confirmação do listener dentro do fluxo daquela tentativa. Não incrementa cópias nesse intervalo.

### 11.3 `JOB COMPLETE`

Somente `EventType: JOB` com estado `COMPLETE` correlacionado à tentativa permite:

- marcar a tentativa como concluída;
- incrementar `copies_printed` em exatamente 1;
- passar para `awaiting_second_copy` se `copies_requested = 2` e `copies_printed = 1`;
- passar para `printed` se todas as vias foram concluídas.

Eventos posteriores `DELETING`/`DELETED` não são necessários para contabilizar a via, mas podem ser registrados para diagnóstico.

### 11.4 O que `COMPLETE` significa

`COMPLETE` é a confirmação mais forte disponível no driver/Winspool atual e foi comprovado empiricamente com a MPT-II.

Ainda não é um sensor mecânico de papel. A spec considera `JOB COMPLETE` a autoridade operacional disponível para o sistema atual.

## 12. Impressora fica offline durante uma tentativa

Se o estado físico mudar para `OFFLINE` antes de qualquer envio ao spooler:

- abortar a tentativa antes do envio;
- manter o job sem incremento de cópias;
- não criar duplicidade.

Se a tentativa já chegou ao spooler:

- não reenviar;
- manter `awaiting_confirmation`;
- mostrar que a via está **Aguardando confirmação da impressora**;
- permitir que o Windows conclua o trabalho quando a impressora voltar.

O teste real mostrou que esse cenário ocorre: o job pode ficar em `SPOOLING` e imprimir sozinho posteriormente.

## 13. Resultado não confirmado

Se a aplicação perder a capacidade de acompanhar uma tentativa depois que ela foi entregue ao spooler — por exemplo, navegador fechado, QZ desconectado, PC reiniciado ou lease antigo retomado sem prova conclusiva — o sistema nunca deve presumir que a via falhou.

A tentativa passa a `unknown` e o job a `requires_attention` com razão explícita, por exemplo:

`PRINT_OUTCOME_UNKNOWN`

A UI mostra:

**Não foi possível confirmar esta impressão**  
Esta via pode ter sido impressa antes de a conexão ser interrompida.

Ações disponíveis:

- **A via foi impressa** — confirmação manual consciente; contabiliza a via e segue o fluxo normal;
- **Não foi impressa — reenviar** — exige confirmação adicional sobre risco de duplicidade e cria uma nova tentativa controlada da mesma via.

Não existe retry automático para `PRINT_OUTCOME_UNKNOWN`.

## 14. Lease/timeout de `processing`

A proteção atual contra jobs abandonados continua necessária, mas deve distinguir dois casos:

1. `processing` sem qualquer evidência de submissão ao spooler: pode expirar para falha conhecida/retry controlado conforme regra definida no backend;
2. tentativa com evidência de submissão (`spool_job_name`, evento `SPOOLING`/equivalente ou estado persistido de aceitação): nunca volta automaticamente para `pending` e nunca é reenviada pelo timeout.

Se a estação deixar de acompanhar uma tentativa submetida, a recuperação leva o job a `requires_attention`, não a retry automático.

## 15. Operação normal

No funcionamento normal, com a impressora sempre `ready`:

- novos jobs elegíveis continuam sendo consumidos automaticamente;
- somente uma tentativa física é executada por vez;
- a primeira via sai automaticamente;
- o sistema aguarda `JOB COMPLETE` antes de contabilizar essa via;
- jobs de duas vias continuam indo para `awaiting_second_copy` após a primeira confirmação;
- a segunda via mantém decisão humana antes da execução, como já ocorre no modelo atual.

A confirmação “Imprimir próxima” entre todos os trabalhos não é aplicada ao fluxo normal.

Essa decisão preserva agilidade operacional e evita transformar cada novo pedido em intervenção manual.

## 16. Detecção de backlog e ciclo de recuperação

Backlog de recuperação é o conjunto de jobs ainda não enviados fisicamente que se acumulou enquanto a impressora não estava pronta.

Quando ocorre uma transição física real `não pronta -> ready` e existem jobs `pending` elegíveis:

- a estação entra em ciclo de recuperação;
- o consumo automático fica pausado;
- novos jobs continuam sendo criados normalmente no backend, mas também permanecem pendentes;
- nenhum novo pedido fura a recuperação.

A recuperação é persistida por estação/ciclo para sobreviver a reload sem reapresentar modal repetidamente.

Estados de recuperação equivalentes:

- `none` — operação automática normal;
- `pending_decision` — impressora voltou e existe backlog aguardando decisão;
- `active` — operador iniciou recuperação via por via;
- `deferred` — operador escolheu “Agora não”.

O estado exato pode ser implementado por enum/colunas equivalentes, mas deve ser persistente e não apenas memória React.

## 17. Prompt ao voltar a impressora

Durante `OFFLINE`:

- não existe modal pedindo impressão imediata;
- Configurações e Fila mostram a indisponibilidade e a quantidade pendente;
- há acesso para **Ver fila**.

Ao voltar para `ready` com backlog, mostrar uma única vez por ciclo:

**Impressora disponível novamente**  
Há X trabalhos aguardando impressão.  
Como a impressora não possui corte automático, as vias serão impressas uma de cada vez.

Ações:

- **Imprimir agora**;
- **Agora não**;
- **Descartar todas**.

Reload, polling, foco de aba ou sincronização não reapresentam o mesmo prompt depois de uma decisão já persistida.

Um novo ciclo físico futuro `offline -> ready` pode gerar novo prompt se houver novo backlog.

## 18. Recuperação via por via

Ao escolher **Imprimir agora**:

- estado de recuperação passa para `active`;
- seleciona o próximo job elegível respeitando a prioridade oficial de execução do backend;
- imprime exatamente uma via física;
- aguarda `JOB COMPLETE`;
- para antes de iniciar qualquer outra via.

Depois de `COMPLETE`:

**Via impressa**  
Separe o papel antes de continuar.  
Restam X trabalhos/vias aguardando.

Ações:

- **Imprimir próxima**;
- **Parar por agora**.

Se o job atual possuir duas vias, a próxima via física desse mesmo job continua sujeita ao controle humano. A interface pode indicar claramente `2ª via do pedido #NNNN` antes de seguir para o próximo job.

Durante recuperação, uma via por vez significa uma única saída física por confirmação, independentemente de pertencer ao mesmo job ou ao job seguinte.

## 19. `Agora não`

Ao escolher **Agora não** ou **Parar por agora**:

- estado de recuperação passa para `deferred`;
- nenhum job é descartado;
- nenhum `copies_printed` muda;
- consumo automático continua pausado enquanto houver backlog do ciclo;
- a UI mostra banner persistente com quantidade pendente;
- ação **Retomar impressões** reabre/inicia o modo via por via.

Não deve existir spam de modal em refresh.

## 20. `Descartar todas`

`Descartar todas` atinge apenas jobs/vias que ainda estão seguramente no Gestão Delivery e não foram enviados ao spooler.

A confirmação destrutiva deve informar a quantidade exata, por exemplo:

**Descartar 5 trabalhos pendentes?**  
Eles ainda não foram enviados à impressora e não serão impressos.

Se existir qualquer tentativa já submetida ao spooler:

- ela fica fora do descarte em massa;
- a UI informa isso explicitamente;
- não é marcada como descartada só porque o usuário descartou o backlog seguro.

Exemplo:

`5 trabalhos pendentes serão descartados. 1 via já foi enviada à impressora e continuará aguardando confirmação por segurança.`

A operação deve ser validada no backend; a UI não é a única barreira.

## 21. Configurações — nova UX operacional

A área de Impressão nas Configurações deve mostrar o estado real da estação principal.

Informações principais:

- estado amigável da impressora;
- nome da fila configurada;
- QZ Tray conectado/desconectado;
- indicação de estação principal;
- quantidade de trabalhos pendentes;
- quantidade de vias aguardando confirmação, quando houver;
- ação de atualizar/verificar;
- configurar/trocar impressora;
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

“Fila ativa”, “QZ configurado” ou equivalentes nunca devem ser usados como sinônimo de prontidão física.

## 22. Issue #36 — responsabilidade da tela de Impressão

A tela de Impressão passa a ter responsabilidade oficial de **painel operacional da estação**, não de histórico completo.

Separação funcional:

- **Cozinha** — operar pedidos ativos;
- **Impressão** — acompanhar saúde da estação e jobs atuais;
- **Histórico** — localizar pedidos antigos e solicitar reimpressão.

A tela de Impressão deve responder rapidamente:

- há algo parado?
- a impressora está pronta?
- qual job está aguardando ação?
- a última impressão concluiu?
- existe alguma tentativa com resultado incerto?

Ela não precisa servir para encontrar uma impressão de semanas atrás.

## 23. Estrutura visual do painel operacional

A página deve ser dividida em duas áreas principais.

### 23.1 Operação atual

Prioriza jobs que ainda exigem execução, acompanhamento ou decisão:

- `pending`;
- `processing`;
- `awaiting_confirmation`;
- `awaiting_second_copy`;
- `requires_attention`;
- `failed` quando ainda houver ação de retry/diagnóstico.

Esses jobs aparecem antes de qualquer bloco de concluídas recentes.

KPIs/resumo devem ser coerentes com o novo modelo, por exemplo:

- **Aguardando impressão**;
- **Aguardando confirmação**;
- **Requer atenção**;
- **Concluídas recentes**.

### 23.2 Impressões concluídas recentes

Mostrar no máximo as **10 impressões `printed` mais recentes**.

Esse bloco é apenas para conferência rápida. Não existe paginação histórica infinita a partir dele.

Jobs `discarded` e falhas terminais permanecem no banco durante a retenção, mas não competem com a operação principal. Quando necessário, continuam acessíveis por diagnóstico/ações contextualizadas, sem transformar a tela em arquivo histórico.

## 24. Ordenação

A ordenação inicial da listagem operacional deve ser por `created_at DESC`: job mais recente primeiro, conforme Issue #36.

A ordenação visual não altera a ordem física de claim. A execução continua respeitando as regras do backend, incluindo prioridade persistida de `Imprimir agora`.

Colunas ordenáveis no desktop, quando presentes:

- Pedido — numérico;
- Job — identificador/ordem apropriada;
- Status — textual;
- Destino/Impressora/Tipo — textual quando aplicável;
- Data/Hora — temporal real.

Regras:

- primeiro clique seleciona a coluna;
- novo clique na mesma coluna inverte `ASC/DESC`;
- coluna ativa e direção ficam visíveis;
- ao mudar ordenação, volta para página 1;
- data é ordenada pelo valor temporal canônico, nunca pela string formatada;
- pedido/identificadores numéricos devem usar ordem numérica quando houver representação numérica oficial.

No mobile, a ordenação pode usar um controle compacto equivalente em vez de cabeçalho clicável, mantendo a mesma fonte de verdade.

## 25. Paginação e fonte de verdade

A paginação e ordenação devem acontecer no backend para evitar o erro de carregar 10 itens e ordenar somente aquela página localmente.

Contrato de listagem deve aceitar parâmetros equivalentes a:

- `scope=operational|recent`;
- `page`;
- `pageSize`, limitado a 10 para a tela;
- `sortBy`;
- `sortDirection`;
- filtros/busca operacional já suportados pela interface.

A resposta deve fornecer quantidade total necessária para controles de página.

Regras:

- no máximo 10 itens por página nas listas paginadas;
- controles só aparecem quando há mais de uma página;
- mudar filtro/ordenação volta à primeira página;
- não duplicar nem omitir registros entre páginas;
- a lista operacional e a lista de concluídas recentes não podem depender de `getPrintJobs({ limit: 100 })` seguido de filtragem local como fonte final.

## 26. Reimpressão histórica

A reimpressão de pedido antigo permanece centralizada na tela Histórico.

Fluxo oficial:

1. operador abre Histórico;
2. localiza o pedido;
3. solicita reimpressão;
4. backend cria um novo job manual com novo snapshot;
5. o novo job aparece como trabalho atual na tela de Impressão;
6. a execução física segue todas as novas regras de prontidão e confirmação.

A existência do job original antigo na UI de Impressão não é requisito para reimprimir.

## 27. Retenção técnica de 30 dias

Política aprovada:

- reter jobs terminais elegíveis por pelo menos 30 dias para auditoria/diagnóstico;
- remover automaticamente depois de 30 dias apenas estados seguros;
- nunca remover automaticamente jobs que ainda fazem parte da operação ou exigem atenção.

### 27.1 Elegíveis à limpeza automática

Podem ser removidos depois de 30 dias:

- `printed`;
- `discarded`;
- `failed` somente quando for terminal e não houver ação operacional pendente.

Tentativas físicas e eventos associados podem ser removidos em cascata junto do job elegível.

### 27.2 Nunca elegíveis por idade

Não remover automaticamente:

- `pending`;
- `processing`;
- `awaiting_confirmation`;
- `awaiting_second_copy`;
- `requires_attention`.

A idade nunca resolve sozinha um estado incerto.

### 27.3 Mecanismo de housekeeping

Para evitar introduzir infraestrutura de cron apenas para esta entrega, a limpeza será **oportunística e limitada por negócio**:

- o backend mantém `last_print_retention_cleanup_at` ou marcador equivalente na configuração de impressão;
- durante atividade normal do subsistema de impressão, se passaram pelo menos 24 horas desde a última limpeza daquele negócio, executa um `DELETE` limitado às condições seguras acima;
- atualiza o marcador de limpeza;
- se o negócio ficar sem uso, registros podem permanecer além de 30 dias até a próxima atividade; nunca são apagados antes de 30 dias.

Assim a retenção é automática sem adicionar uma nova dependência operacional de scheduler nesta entrega.

## 28. Limpeza manual

Se a UI expuser **Limpar histórico concluído**, ela é opcional nesta entrega. Caso seja implementada, deve:

- atingir somente estados terminais seguros;
- nunca tocar jobs ativos/incertos;
- exigir confirmação explícita;
- informar quantidade afetada;
- ser validada no backend.

A funcionalidade principal da Issue #36 não depende dessa ação manual.

## 29. API necessária

A implementação pode reaproveitar endpoints atuais, mas o contrato final deve cobrir:

- listar jobs operacionais paginados/ordenados;
- listar até 10 impressões concluídas recentes;
- obter detalhes/timeline/tentativas;
- claim atômico de job;
- registrar submissão/tentativa ao spooler;
- registrar eventos de tentativa;
- completar uma via somente por confirmação válida ou confirmação manual explícita;
- marcar resultado incerto;
- confirmar manualmente “a via foi impressa”;
- reenviar conscientemente uma via incerta com nova tentativa;
- iniciar/deferir/retomar/finalizar ciclo de recuperação;
- descartar backlog seguro em lote;
- heartbeat de saúde física detalhada;
- housekeeping de retenção.

As mutações devem validar `business_id`, estação principal e estado atual para impedir transições concorrentes inválidas.

## 30. Concorrência

A estação principal continua sendo o único executor físico.

Regras adicionais:

- apenas uma tentativa física ativa por estação;
- um job `awaiting_confirmation` não pode ser claimado novamente;
- uma via com tentativa submetida não pode ganhar segunda tentativa automática;
- recuperação `pending_decision`, `active` ou `deferred` bloqueia o consumidor automático;
- ações manuais devem usar transições atômicas no backend;
- `COMPLETE` repetido/idempotente para a mesma tentativa não incrementa `copies_printed` duas vezes;
- confirmação manual e evento `COMPLETE` concorrentes devem resultar em no máximo um incremento daquela via.

## 31. Timeline e auditoria

O detalhe do job deve permitir explicar o que aconteceu.

Eventos relevantes:

- job criado;
- priorizado;
- claimado;
- estado físico bloqueou execução;
- tentativa criada;
- `SPOOLING`;
- `PRINTING`;
- `COMPLETE`;
- tentativa ficou incerta;
- resultado confirmado manualmente;
- reenvio manual autorizado;
- primeira via concluída;
- segunda via solicitada/concluída;
- recuperação iniciada/deferida/retomada;
- job descartado;
- job concluído.

Não é necessário expor todos os eventos técnicos na lista principal; eles pertencem ao detalhe/diagnóstico.

## 32. Migração de dados

A evolução deve ser aditiva e usar nova migration, sem editar migrations antigas já aplicadas.

Nome esperado:

`migrations/0019_print_physical_confirmation_and_operational_panel.sql`

Mudanças conceituais:

- adicionar `awaiting_confirmation` ao CHECK de status de `print_jobs`;
- criar `print_job_attempts`;
- adicionar metadados detalhados de saúde/recuperação à `print_stations` ou estrutura equivalente;
- adicionar marcador de housekeeping à configuração central de impressão;
- criar índices para listagem operacional, recentes, retenção e tentativas;
- preservar todos os jobs existentes.

Compatibilidade:

- jobs atuais `pending`, `awaiting_second_copy`, `printed`, `failed`, `requires_attention`, `discarded` permanecem legíveis;
- jobs `processing` existentes no momento da migration não devem ser presumidos como impressos;
- não criar tentativas fictícias retroativas para jobs históricos sem evidência;
- migration não imprime, descarta nem reenvia nada.

## 33. Impacto nos componentes atuais

Áreas esperadas de mudança:

Frontend/printing:

- `src/printing/qzTrayTransport.js` — listeners PRINTER/JOB, job name, confirmação;
- `src/printing/usePrintingManager.js` — modelo de saúde, gating, recuperação e consumo;
- `src/printing/printJobRunner.js` — separar submissão de conclusão;
- novos módulos pequenos para saúde/attempt tracking/recovery, evitando concentrar tudo em `usePrintingManager.js`;
- testes atuais de QZ/runner/manager.

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
- nova migration `0019`.

O plano de implementação deve confirmar a lista final de arquivos antes de editar.

## 34. Testes obrigatórios — unidade e contrato

A implementação deve seguir TDD estrito.

Cenários mínimos:

- fila QZ existe, mas `PRINTER OFFLINE` -> não faz claim automático;
- estado físico desconhecido -> não imprime;
- `PRINTER OK` -> elegível quando demais pré-condições passam;
- `qz.print()` resolve sem `JOB COMPLETE` -> `copies_printed` não muda;
- `SPOOLING` -> job passa a aguardar confirmação;
- `COMPLETE` -> incrementa exatamente uma via;
- `COMPLETE` duplicado -> idempotente;
- offline depois de `SPOOLING` -> não cria retry automático;
- reconexão + `COMPLETE` posterior -> conclui a mesma tentativa;
- perda do executor após submissão -> `PRINT_OUTCOME_UNKNOWN`, sem retry automático;
- confirmação manual “foi impressa” -> conclui uma vez;
- “não foi impressa — reenviar” -> nova tentativa com confirmação destrutiva/risco;
- backlog + `offline -> ready` -> pausa automático e abre ciclo persistido;
- `Agora não` -> mantém jobs e não reapresenta modal em refresh;
- `Descartar todas` -> só descarta `pending` seguro;
- tentativa no spooler fica fora do descarte em massa;
- recuperação imprime uma via por clique;
- novos jobs durante recuperação não furam a fila;
- término do backlog restaura operação automática;
- segunda via normal continua controlada;
- listagem padrão `created_at DESC`;
- paginação 10 por página;
- mudança de sort volta para página 1;
- ordenação numérica/textual/temporal correta;
- backend não ordena apenas página já recortada;
- recentes retornam no máximo 10 `printed`;
- reimpressão pelo Histórico cria novo job operacional;
- retenção remove apenas terminais >30 dias;
- retenção nunca apaga `requires_attention` ou estados ativos;
- housekeeping não executa mais de uma vez por 24h por negócio;
- mobile e desktop mantêm ações acessíveis.

## 35. Homologação física em staging

Antes de produção, validar com a MPT-II real no Windows da cozinha.

Roteiro mínimo:

1. staging com QZ e MPT-II ligada -> novo pedido imprime primeira via e só conclui após `COMPLETE`;
2. desligar MPT-II -> novo pedido permanece `pending`, `copies_printed = 0`;
3. religar -> aparece recuperação, não dispara backlog automaticamente;
4. escolher `Agora não` -> nada imprime e aviso persiste sem spam;
5. retomar -> imprime uma única via;
6. clicar `Imprimir próxima` -> sai apenas a próxima via;
7. durante tentativa submetida, desligar impressora -> job fica aguardando confirmação e não é reenviado;
8. religar -> Windows conclui o mesmo job e sistema reconhece `COMPLETE` quando listener permanece ativo;
9. simular perda do navegador/QZ após submissão -> resultado vai para atenção, não retry automático;
10. validar decisão manual de resultado incerto;
11. validar painel com >10 jobs e ordenação/paginação;
12. validar layout mobile;
13. validar reimpressão pelo Histórico;
14. validar que concluídas antigas não dominam a tela.

## 36. Critérios de aceite consolidados

A entrega está aceita quando:

- [ ] impressora fisicamente offline bloqueia consumo;
- [ ] QZ conectado/fila encontrada não são mais sinônimo de pronta;
- [ ] `copies_printed` só avança por `JOB COMPLETE` ou confirmação manual explícita de resultado incerto;
- [ ] tentativa já submetida nunca é reenviada automaticamente;
- [ ] resultado não confirmado exige ação humana;
- [ ] backlog não imprime em rajada ao reconectar;
- [ ] recuperação é uma via por vez;
- [ ] `Agora não` e `Descartar todas` são ações distintas;
- [ ] descarte em massa não toca tentativa já no spooler;
- [ ] novos pedidos não furam recuperação ativa/deferida;
- [ ] operação normal permanece automática para primeira via;
- [ ] segunda via continua controlada pelo operador;
- [ ] Configurações mostra estado físico real e contagens relevantes;
- [ ] tela de Impressão funciona como painel operacional;
- [ ] jobs ativos/atenção aparecem antes de concluídos;
- [ ] no máximo 10 concluídas recentes são mostradas;
- [ ] listagens paginadas usam no máximo 10 itens por página;
- [ ] job mais recente aparece primeiro por padrão;
- [ ] ordenação clicável/compacta altera backend e indica direção;
- [ ] paginação e ordenação usam a mesma fonte de verdade;
- [ ] Histórico continua sendo o lugar de reimpressão antiga;
- [ ] reimpressão cria novo job atual;
- [ ] retenção técnica de 30 dias está implementada com limpeza segura;
- [ ] nenhum estado ativo/incerto é limpo por idade;
- [ ] testes automatizados cobrem regressões críticas;
- [ ] staging é homologado fisicamente antes de qualquer deploy de produção.

## 37. Estratégia de entrega

Para reduzir risco e ainda permitir conclusão no mesmo ciclo de trabalho, o plano de implementação deve ordenar as mudanças por dependência:

1. dados/estados/tentativas;
2. API de confirmação e recuperação;
3. listener QZ de PRINTER/JOB;
4. gating físico e semântica `COMPLETE`;
5. recuperação manual de backlog;
6. painel operacional/paginação/ordenação da Issue #36;
7. retenção;
8. testes completos;
9. deploy em staging;
10. homologação física;
11. somente após aprovação explícita, merge/deploy de produção.

Nenhuma etapa pode contornar a confirmação física apenas para acelerar a entrega.
