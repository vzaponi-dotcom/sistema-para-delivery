# Spec C9 — Printing and QZ separation

**Data:** 2026-09-19  
**Status:** **READY FOR WRITTEN REVIEW** — design consolidado e aprovado em conversa; documento autorrevisado, aguardando aprovação explícita desta spec escrita  
**Branch:** `feature/spec-c9-printing`  
**Base:** `master` em `91fb5581cea1616f438c13dfac28cfb38345fa59`  
**Base validation:** Validate application #1464 / run `35471894412` — SUCCESS no merge SHA exato da C8  
**Produção:** não tocar nesta slice sem autorização separada

## 1. Objetivo

A C9 estabelece `printing` como domínio operacional explícito do frontend e separa QZ Tray como adapter de infraestrutura física.

A slice deve:

- criar um boundary público em `src/domains/printing/`;
- mover para Printing o ownership frontend da fila, regras operacionais, coordenação de execução, recovery, segunda via, retry/reprint, resultado desconhecido, política de impressão e UI específica;
- retirar de `App.jsx` o ownership de prompts, recovery/affinity, detalhes de QZ e decisões de prontidão física;
- mover APIs frontend específicas de impressão para `src/domains/printing/infrastructure/printingApi.js`;
- criar `src/infrastructure/qz/` como único owner de produção de `qz-tray`;
- retirar a exceção atual de import direto de QZ do architecture allowlist;
- preservar `shared/printQueue.js`, `shared/printQueueActions.js` e `shared/printContextPolicy.js` como contratos cross-runtime realmente compartilhados com o Worker;
- preservar integralmente fila central, estação principal, queue-only remoto, auto print, 1/2 vias, segunda via, recovery affinity, retry/reprint, resultado desconhecido, heartbeat, estado físico e segurança QZ;
- preservar visual, responsividade, textos funcionais, polling, storage keys, capabilities, endpoints e payloads atuais;
- exigir homologação física proporcional com QZ/impressora real antes do merge.

A C9 é uma refatoração arquitetural. Ela não troca a impressora atual nem cria um novo sistema de impressão.

## 2. Resultado esperado

Ao final da C9:

1. `src/domains/printing` é o owner frontend do domínio operacional de impressão;
2. `src/infrastructure/qz` é o único owner de `qz-tray`;
3. `App.jsx` não decide segunda via, recovery, affinity, QZ readiness ou heartbeat;
4. `src/api/client.js` não exporta APIs específicas de Printing;
5. `src/pages/PrintQueue.jsx`, `src/components/PrintingSettings*.jsx` e `src/printing/**` deixam de ser owners legados de produção;
6. consumidores externos usam somente `src/domains/printing/index.js`;
7. o allowlist não contém exceção para import direto de QZ;
8. nenhuma regra atual de fila ou impressão física é alterada;
9. a política atual de cópias continua independente para pedidos e mesas/comandas;
10. a homologação funcional e a rodada física obrigatória passam antes do merge;
11. produção permanece intocada.

## 3. Base técnica validada

A base da C9 é o merge da C8:

`91fb5581cea1616f438c13dfac28cfb38345fa59`

O merge foi produzido pelo PR #52.

Evidência validada:

- PR #52 — merged/closed;
- merge/master SHA: `91fb5581cea1616f438c13dfac28cfb38345fa59`;
- post-merge Validate #1464 / run `35471894412` — SUCCESS;
- 1.860 testes / 1.859 pass / 0 fail / 1 skipped;
- architecture, lint, build, Worker production dry-run, Worker staging dry-run, D1 local e Spec B D1 verdes;
- produção não foi implantada pela C8.

A C9 parte exatamente dessa `master`.

## 4. Fontes de autoridade e reconciliação histórica

A C9 deve obedecer, em ordem de autoridade prática:

1. comportamento atual comprovado no código e testes da `master`;
2. Spec C de modularização e rollout da C9;
3. política atual da Spec B;
4. homologação física aprovada em 15/09/2026;
5. documentos históricos anteriores, somente quando não contradisserem o estado atual.

### 4.1 Regra histórica superseded sobre mesa/comanda

A antiga spec `2026-09-08-centralized-qz-print-queue-design.md` descrevia uma fase em que mesa/consumo local usava sempre 1 via automática.

Essa regra foi superada.

O contrato vigente é `shared/printContextPolicy.js`:

- `orderDefaultCopies` governa pedidos de Entrega/Retirada e também pedidos Local **sem vínculo de mesa/comanda**;
- `tableTabDefaultCopies` governa pedidos ligados à mesa e jobs `table-tab`;
- ambos aceitam 1 ou 2 vias;
- `explicitCopies`, quando fornecido por fluxo manual/reprint, tem precedência;
- job de teste usa exatamente 1 via.

A homologação física atual de 15/09/2026 confirma esse comportamento.

A C9 não pode reintroduzir a regra antiga de mesa fixa em 1 via.

## 5. Restrições globais

A C9 deve preservar as regras gerais da Spec C:

- não implementar diretamente em `master`;
- trabalhar em `feature/spec-c9-printing`;
- TDD RED → GREEN para mudanças de ownership/fronteira;
- Worker/backend continuam autoridade da fila e jobs;
- não criar store oficial paralelo de impressão;
- não alterar endpoints, payloads, migrations ou schema por conveniência;
- não introduzir WebSocket/SSE;
- não alterar React Router/navegação;
- não criar novo modelo de usuários/capabilities;
- não redesenhar Fila de impressão nem Configurações → Impressão;
- não trocar QZ, driver Windows ou impressora;
- não antecipar C10;
- produção somente com autorização explícita separada.

## 6. Ownership do domínio Printing

Printing é domínio operacional, não mera infraestrutura.

Printing é dono, no frontend, de:

- regras de elegibilidade de execução;
- regras da estação principal;
- coordenação de auto print;
- fila operacional e suas ações;
- estado de 1/2 vias;
- segunda via;
- acknowledgment/prompt de segunda via no frontend;
- retry;
- reprint;
- force print;
- resultado desconhecido e decisões humanas de resolução;
- recovery;
- recovery affinity;
- exclusividade de operação física;
- heartbeat enquanto regra operacional;
- projeção de estado físico para estado operacional;
- policy específica de Printing;
- comandos de impressão;
- UI da fila;
- UI específica de Printing Settings;
- renderização de documentos/bytes de impressão;
- API frontend específica de Printing.

Printing não é dono de:

- `qz-tray`;
- conexão QZ concreta;
- descoberta concreta de filas Windows;
- envio concreto de bytes via QZ;
- listeners concretos do spooler QZ;
- armazenamento local concreto de preferência da fila;
- mecanismo genérico de policy editing;
- sessão/auth;
- capabilities globais;
- navegação global;
- feedback global;
- lifecycle de Orders/Table Service/Finance;
- Worker/backend.

## 7. Estado atual na base C9

### 7.1 `src/printing` mistura responsabilidades

Na base pós-C8, `src/printing/` contém conjuntamente:

- `usePrintingManager.js` com React, regras operacionais, API, browser e QZ;
- `qzTrayTransport.js`;
- `qzStatusMonitor.js`;
- `qzPrintAttemptController.js`;
- `printJobRunner.js`;
- `printRecoveryFlow.js`;
- `secondCopyPromptFlow.js`;
- `localPrintStation.js`;
- renderers/encoders ESC/POS/PDF;
- CSS e testes.

O principal debt é que `usePrintingManager.js` importa diretamente:

`qz-tray`

e também conhece APIs específicas, browser globals e regras de negócio.

### 7.2 Legacy owners fora de `src/printing`

Também existem owners de Printing fora do domínio alvo:

- `src/pages/PrintQueue.jsx`;
- `src/pages/printQueueDetails.js`;
- `src/pages/printQueueFilters.js`;
- `src/pages/printQueueQuery.js`;
- `src/pages/printQueueSummary.js`;
- `src/components/PrintingSettings.jsx`;
- `src/components/PrintingSettingsContent.jsx`;
- `src/app/surfaces/settings/printingSettingsAdapter.js`.

### 7.3 App ownership

`App.jsx` ainda conhece diretamente:

- `usePrintingManager` de path legado;
- `secondCopyPromptFlow`;
- `canPresentSecondCopyPrompt`;
- `canKeepSecondCopyPromptOpen`;
- `secondCopyPromptJobId`;
- busy state do prompt;
- busca de job corrente para prompt;
- recovery prompt;
- `recoveryJobId`;
- `transportKind === 'qz'`;
- decisões de abrir/fechar prompt;
- defer/resume/next/discard recovery;
- execução física de segunda via;
- coordenação de origin second-copy prompts.

Esses são debts explícitos da C9.

### 7.4 API legado

`src/api/client.js` ainda exporta as APIs específicas de Printing, incluindo:

- settings;
- stations;
- heartbeat;
- queue/jobs/summary;
- attempts/events;
- result resolution;
- recovery;
- create/claim/complete/fail/retry/discard/prioritize/force/reprint;
- print documents;
- QZ certificate/sign endpoints.

Esses exports devem sair de `src/api/client.js` na C9.

## 8. Estrutura alvo

Direção conceitual:

```text
src/domains/printing/
  domain/
  application/
  infrastructure/
  ui/
  index.js

src/infrastructure/qz/
```

Uma distribuição esperada é:

```text
src/domains/printing/
  domain/
    printingEligibility.js
    printRecovery.js
    secondCopy.js
    stationHealth.js
    rendering/
      cp860.js
      mtp5Profile.js
      escpos58mm.js
      manualPrintDocument.js
      pdfOrderRenderer.js

  application/
    usePrintingManager.js
    printJobRunner.js
    printingCommands.js

  infrastructure/
    printingApi.js

  ui/
    PrintQueue.jsx
    PrintingSettingsContent.jsx
    PrintingOverlays.jsx
    printQueueDetails.js
    printQueueFilters.js
    printQueueQuery.js
    printQueueSummary.js
    printing.css

  index.js

src/infrastructure/qz/
  qzTransport.js
  qzStatusMonitor.js
  qzPrintAttemptController.js
  qzLocalPreferences.js
```

Os nomes finais podem ser refinados no plano conforme dependências reais. A direção de ownership não é opcional.

## 9. Public entry

Consumidores externos usam somente:

`src/domains/printing/index.js`

O public entry deve ser mínimo e baseado em consumidores reais.

A base auditada indica necessidade provável de:

- `PrintQueue`;
- `PrintingSettingsContent`;
- `PrintingOverlays`;
- `usePrintingManager`.

`PrintingSettings.jsx` não deve virar contrato público por inércia. Se o inventário completo provar ausência de consumidor de produção, ele deve ser removido.

Internals que não devem ser públicos:

- QZ adapter;
- status monitor;
- attempt controller;
- job runner;
- recovery helpers;
- second-copy helpers;
- renderers;
- API adapter;
- storage helpers.

## 10. Shared cross-runtime preservado

Os arquivos abaixo continuam em `shared/` porque possuem responsabilidade cross-runtime real:

- `shared/printQueue.js`;
- `shared/printQueueActions.js`;
- `shared/printContextPolicy.js`.

Eles não são facades temporárias.

### 10.1 `shared/printQueue.js`

Continua owner do vocabulário cross-runtime de estados e labels normalizados da fila.

### 10.2 `shared/printQueueActions.js`

Continua owner das ações possíveis derivadas do estado persistido do job e motivos compartilhados.

### 10.3 `shared/printContextPolicy.js`

Continua owner da decisão pura de quantidade de cópias por contexto, compartilhada com Worker.

A C9 não duplica essas regras dentro do domínio frontend.

## 11. Printing x QZ

QZ é infraestrutura física.

Direção obrigatória:

```text
domains/printing/application
        ↓
small transport contract
        ↓
src/infrastructure/qz
        ↓
qz-tray
```

Somente `src/infrastructure/qz/**` pode importar `qz-tray` em produção.

O contrato não precisa usar classes.

Conceitualmente pode fornecer:

```text
connect()
isConnected()
listPrinters()
resolvePrinter(name)
print(bytes, metadata)
startStatusMonitor(...)
stopStatusMonitor()
```

QZ conhece:

- `qz-tray`;
- configuração de segurança no browser;
- certificate/sign callbacks;
- conexão websocket QZ;
- descoberta de impressora;
- envio de bytes;
- status do spooler/impressora;
- detalhes concretos Windows/QZ.

QZ não conhece:

- Orders;
- mesa/comanda;
- quantidade de vias;
- retry/reprint como regra;
- recovery;
- fila central;
- capabilities;
- prompt de segunda via.

## 12. Segurança QZ

A separação arquitetural não pode enfraquecer a segurança existente.

Preservar:

- certificate obtido pelo endpoint atual;
- assinatura obtida pelo endpoint atual;
- chave privada somente no backend/segredo;
- nada de chave privada em browser, D1, bundle, Git ou log;
- mesma confiança/callback de assinatura do QZ;
- mesmos endpoints e payloads.

A C9 muda ownership do cliente; não redesenha o mecanismo criptográfico.

## 13. Plataforma e transporte

Regra operacional atual:

- Windows elegível → transporte físico QZ;
- Android → queue-only;
- outras plataformas → queue-only.

Queue-only não significa ausência de fila. Significa:

- pode criar/consultar/acionar jobs conforme capability e conectividade;
- não inicializa QZ;
- não envia bytes;
- não se torna executor físico;
- não simula sucesso físico.

Somente a estação Windows principal executa fisicamente.

## 14. Elegibilidade de consumo automático

O consumidor automático continua exigindo, cumulativamente:

- sessão autenticada;
- aplicação online;
- browser online;
- ambiente visível/elegível conforme comportamento atual;
- plataforma suportada;
- nenhuma operação física concorrente;
- transporte não bloqueado;
- transporte pronto;
- QZ conectado quando aplicável;
- impressora fisicamente pronta;
- estação local principal;
- recovery state `normal`;
- `autoPrintEnabled`.

A extração não pode relaxar esses guards.

## 15. Exclusividade de operação física

A application layer deve continuar garantindo uma única operação física por vez.

Isso cobre:

- job automático;
- teste de impressão;
- impressão manual;
- segunda via;
- retry;
- recovery;
- reprint quando resultar em execução local;
- qualquer caminho futuro que use o executor físico atual.

A proteção não pode depender só de botão desabilitado.

O erro `PRINT_OPERATION_BUSY` ou contrato equivalente deve continuar distinguível.

## 16. Política de vias

Printing é owner da política de UI/aplicação, mas o resolver cross-runtime permanece em `shared/printContextPolicy.js`.

Preservar exatamente:

### 16.1 Entrega/Retirada

`orderDefaultCopies`

- 1 ou 2;
- usado para pedido sem contexto de mesa/comanda;
- mudança afeta somente novos jobs.

### 16.2 Mesa/Comanda

`tableTabDefaultCopies`

- 1 ou 2;
- usado para pedido associado a mesa/comanda;
- usado por job `table-tab`;
- mudança afeta somente novos jobs.

### 16.3 Local sem vínculo de mesa

Usa `orderDefaultCopies`.

### 16.4 Quantidade explícita

`explicitCopies` válido em 1/2 tem precedência nos fluxos que hoje o aceitam.

### 16.5 Teste físico

Job de teste continua em exatamente 1 via.

### 16.6 Jobs existentes

Alterar a policy nunca reescreve `copies_requested` de jobs já existentes.

## 17. Segunda via

Elegibilidade permanece baseada no job:

```text
status = awaiting_second_copy
copies_requested = 2
copies_printed = 1
```

O prompt/coordenação frontend deve:

- estar associado ao job;
- respeitar station principal;
- exigir transporte/printer ready;
- respeitar bloqueio físico;
- usar acknowledgment persistente do backend;
- não reaparecer indefinidamente;
- permitir reabertura somente no cenário atual de recovery affinity;
- nunca contabilizar a via 2 antes da confirmação correta.

A C9 move essa coordenação para Printing. `App.jsx` deixa de decidir essas regras.

## 18. Recovery e affinity

Preservar estados atuais, incluindo:

- normal;
- active;
- deferred;
- demais estados existentes na implementação atual.

Enquanto recovery não está normal:

- consumidor automático normal fica pausado;
- recuperação usa os endpoints próprios;
- `station.recoveryJobId` mantém a afinidade durável;
- o job corrente não é intercalado indevidamente com outro job;
- em job de 2 vias, 2/2 do mesmo trabalho é resolvida antes de avançar;
- “Depois”/defer preserva backlog;
- retorno do hardware não despeja backlog de forma insegura.

A regressão já observada historicamente de alternar jobs entre 1/2 e 2/2 deve permanecer explicitamente protegida.

## 19. Resultado físico desconhecido

Resolver `qz.print()` não significa, por si só, via fisicamente confirmada.

Fluxo preservado:

```text
persist attempt
    ↓
mark submitting
    ↓
send via QZ
    ↓
observe spooler
    ├─ COMPLETE → confirmed
    ├─ known failure → failed / requires_attention
    └─ lost/uncertain observation → unknown / requires_attention
```

Se existe risco de a via ter sido enviada e a observação foi perdida:

- nenhum retry automático;
- nenhum reenvio silencioso;
- evento tardio não converte automaticamente a decisão;
- operador resolve explicitamente:
  - “A via foi impressa”;
  - “Não foi impressa — reenviar”.

## 20. Retry, reprint e force print

### 20.1 Retry

Retry continua operando sobre o mesmo contexto/job quando a falha conhecida é retryable.

Não repete via já confirmada.

### 20.2 Reprint

Reprint é nova solicitação deliberada.

Preservar:

- novo job;
- vínculo/histórico com o anterior;
- escolha explícita de 1 ou 2 vias;
- snapshot/documento imutável apropriado.

### 20.3 Force print

Continua ação explícita somente nos estados previstos.

Não vira retry genérico.

## 21. Heartbeat e estado físico

Heartbeat continua limitado à estação física elegível.

Preservar distinção entre:

```text
QZ conectado
≠ fila Windows encontrada
≠ impressora fisicamente pronta
```

Somente prontidão física pode liberar claim/envio.

Estados observáveis atuais, como:

- ready;
- verifying;
- printer_offline;
- printer_attention;

continuam semanticamente distintos.

Respostas velhas de heartbeat não podem sobrescrever estado mais novo.

## 22. Polling

Preservar intervalos e semântica atuais.

Na base C9:

- `PRINT_JOB_POLL_MS = 2_000`;
- `PRINT_STATE_POLL_MS = 5_000`;
- `STATION_HEARTBEAT_MS = 15_000`.

A C9 pode mover onde esses timers vivem, mas não altera frequências nem troca polling por push.

## 23. Storage local

Identidade local da estação e impressora/fila escolhida continuam locais à máquina.

A C9 deve retirar acesso concreto a `localStorage` das regras puras e isolá-lo em adapter pequeno.

Preservar chaves atuais, incluindo:

`delivery-qz-printer-name:<stationId>`

Não “resetar” a impressora configurada só por mudança de path.

Não criar framework genérica de storage.

## 24. Settings e policy editing

Configurações continua uma surface de composição.

### 24.1 Printing é owner de

- schema/regras específicas da policy de impressão;
- UI específica de Printing;
- ações específicas de printer/station quando pertencem a Printing.

### 24.2 `app/policy-editing` continua owner de

- load;
- draft;
- dirty;
- expected revision;
- save;
- conflict;
- conflict review;
- unknown result;
- pending recovery;
- reconcile;
- guards genéricos.

A C9 não duplica esse engine.

### 24.3 `SettingsSurface`

Continua compondo a rota `settings-printing`.

Após C9, deve consumir Printing somente pelo public entry.

`printingSettingsAdapter.js` pode permanecer como ponte fina na surface ou mudar para Printing application se o plano provar que isso reduz acoplamento sem mover o engine genérico. A decisão deve ser documentada no plano.

## 25. Capabilities

A C9 não cria autorização nova.

Preservar capabilities atuais e comportamento fail-closed.

A superfície deve continuar distinguindo permissões como:

- visualizar fila;
- visualizar policy/settings;
- configurar estação;
- executar impressão;
- descartar/dispensar;
- outras capabilities já existentes na base.

Printing recebe permissões já resolvidas e aplica bloqueios.

Ausência de identity adequada em staging pode resultar em caso manual BLOCKED, nunca PASS inferido.

## 26. Offline

Offline não pode:

- apagar job;
- marcar sucesso;
- fazer claim;
- enviar bytes;
- reprocessar automaticamente estado incerto.

Na estação principal, perda de rede/QZ/printer readiness pausa novos claims/envios e preserva fila.

Queue-only continua sem execução física.

## 27. Tratamento de erros

A taxonomia atual deve permanecer distinguível.

Exemplos relevantes:

- QZ connection failed;
- printer not configured;
- printer not found;
- QZ print failed;
- operation busy;
- station not ready;
- observation lost;
- unknown physical outcome.

A C9 não reduz todos os casos a um erro genérico.

Direção:

```text
QZ/API infra
  ↓ typed technical error
Printing application
  ↓ operational state/action
Printing UI
  ↓ current feedback
```

Erro conhecido não deve ser reclassificado como unknown sem motivo.

Unknown não deve ser tratado como falha segura para retry automático.

## 28. App boundary

Ao final da C9, `App.jsx` pode fornecer:

- authenticated;
- isOnline;
- capabilities;
- orders oficiais quando necessários à apresentação;
- navigation callbacks;
- feedback global.

`App.jsx` não deve possuir:

- second-copy prompt state;
- second-copy eligibility;
- recovery prompt state;
- recovery affinity;
- QZ readiness;
- transport kind decision;
- heartbeat rules;
- printer selection/storage;
- physical attempt coordination.

Printing deve expor um workspace/overlay/manager público que encapsule essa coordenação.

## 29. Orders, History e Table Service

Esses consumidores podem continuar oferecendo ações de impressão existentes.

Regras:

- consomem somente contratos públicos de Printing;
- não importam internals;
- não importam QZ;
- não executam transporte físico;
- não duplicam regras de retry/reprint/segunda via.

C9 não transfere lifecycle de pedidos para Printing.

## 30. PrintQueue UI

A tela Fila de impressão mantém comportamento atual.

Preservar:

- header e navegação para Settings;
- station status;
- offline/attention banner;
- recovery banner;
- summary cards;
- filtros;
- busca;
- ordenação;
- paginação;
- tabela desktop;
- cards mobile;
- detalhe modal;
- ticket preview;
- action ordering;
- priorizar;
- retry;
- discard;
- force print;
- request/skip second copy;
- unknown outcome resolution;
- reprint 1/2;
- recovery actions;
- toasts atuais;
- UTF-8;
- CSS/responsividade/light/dark.

Nenhum redesign visual faz parte da C9.

## 31. Printing Settings UI

Preservar três responsabilidades visuais independentes:

1. política do negócio;
2. estação;
3. impressora local QZ / fila central.

Preservar:

- `orderDefaultCopies`;
- `tableTabDefaultCopies`;
- save/cancel independentes;
- confirmação explícita para tornar principal;
- auto print somente quando aplicável;
- status QZ/fila/printer distintos;
- testar impressão;
- trocar impressora;
- queue-only sem controles físicos fictícios;
- conflict/reconcile do engine atual;
- mesmos tokens CSS e responsividade.

## 32. Renderers e codecs

Arquivos como:

- `cp860`;
- `mtp5Profile`;
- `escpos58mm`;
- `manualPrintDocument`;
- `pdfOrderRenderer`;

pertencem a Printing, não ao adapter QZ.

Eles transformam documento em representação imprimível.

QZ transporta o resultado; não conhece conteúdo de pedido/comanda.

## 33. API frontend de Printing

Criar owner em:

`src/domains/printing/infrastructure/printingApi.js`

Migrar os endpoints atuais sem mudar URL, method ou payload.

`src/api/client.js` deixa de exportar APIs específicas de Printing.

O HTTP genérico continua em `src/infrastructure/api/httpClient.js`.

## 34. Worker, schema e migrations

C9 não deve alterar funcionalmente:

- Worker printing routes;
- Worker printing repository;
- QZ signing backend;
- migrations;
- D1 schema;
- bootstrap;
- política persistida.

Se um bloqueador real tornar impossível a separação sem mudança backend, isso deve ser tratado como ruling explícito antes da alteração, com teste e revisão proporcional.

Não antecipar mudança backend por estética.

## 35. CSS

C9 é estrutural.

CSS pode mudar de path/ownership somente quando necessário para acompanhar owner.

Preservar:

- ordem efetiva da cascade;
- tokens;
- layout;
- breakpoints;
- interaction states;
- light/dark.

Nenhum polish visual não autorizado.

## 36. Compatibility/facades

O estado final da C9 deve ter **zero facade temporária de Printing**.

Legacy owners a eliminar:

- `src/printing/**`;
- `src/pages/PrintQueue.jsx`;
- `src/pages/printQueue*.js`;
- `src/components/PrintingSettings.jsx`;
- `src/components/PrintingSettingsContent.jsx`.

Se uma facade intermediária for indispensável durante TDD:

- entra no compatibility ledger no mesmo commit;
- registra consumidor real;
- registra task de remoção;
- é removida antes do fechamento da C9.

Não deixar reexport “por segurança”.

## 37. Architecture enforcement

Ao final, o checker deve impedir:

### 37.1 Deep imports

Consumidor externo não pode importar internals de `domains/printing`.

Somente:

`src/domains/printing/index.js`

é public entry.

### 37.2 Domain purity

`src/domains/printing/domain/**` não pode importar:

- React;
- `qz-tray`;
- `src/infrastructure/**`;
- `domains/*/infrastructure/**`;
- UI;
- browser globals;
- `fetch`.

### 37.3 Cross-domain

Printing não pode importar internals de:

- Orders;
- Finance;
- Table Service;
- Customers;
- Catalog.

Quando um contrato público legítimo for necessário, o plano deve justificar o uso do public entry do outro domínio.

### 37.4 QZ

Import de produção de `qz-tray` permitido somente em:

`src/infrastructure/qz/**`

A exceção atual do allowlist:

```json
"qzDirectImports": [
  "src/printing/usePrintingManager.js"
]
```

deve desaparecer.

Não substituir por nova exceção de domínio.

### 37.5 QZ infra purity

`src/infrastructure/qz/**` não deve conhecer:

- regras de Orders;
- policy de vias;
- recovery business state;
- capabilities;
- UI;
- domínio Printing internals desnecessários.

A direção é application → infra adapter, não infra → domain internals.

### 37.6 App

Checker/contract tests devem impedir retorno de ownership de:

- second-copy prompt;
- recovery;
- QZ;
- physical attempt rules;
- Printing API CRUD-like orchestration;

para `App.jsx`.

### 37.7 Legacy API

Checker deve rejeitar retorno das APIs específicas de Printing em `src/api/client.js`.

### 37.8 Legacy owners

Checker deve rejeitar reintrodução dos paths legados removidos.

### 37.9 Fixtures positivas

Testes do checker devem provar que continuam permitidos:

- App → Printing public entry;
- SettingsSurface → Printing public entry;
- Printing internal → Printing internal;
- Printing → shared print contracts;
- Printing application → adapter QZ permitido;
- QZ infra → HTTP callbacks/infrastructure permitidos quando necessários.

## 38. TDD e estratégia de implementação

A implementação deve ser incremental.

Cada fronteira deve seguir:

1. characterization/architecture test;
2. RED pelo motivo arquitetural esperado;
3. menor movimento/extração funcional;
4. GREEN focado;
5. full proportional gate antes de encerrar task.

Não aceitar RED por parser, path inexistente errado ou harness quebrado como prova da regra desejada.

Testes existentes devem ser movidos/alinhados ao novo owner, não apagados para fazer a suíte passar.

## 39. Cobertura automática obrigatória

Preservar/fortalecer testes para:

- transport kind;
- queue-only;
- auto-consumer eligibility;
- primary station;
- physical readiness;
- operation exclusivity;
- QZ close/readiness invalidation;
- stale generation;
- heartbeat sequencing;
- second-copy eligibility;
- second-copy acknowledgment;
- deferred recovery affinity;
- recovery one-copy execution;
- retry/reprint;
- print attempt persistence;
- spooler events;
- unknown result;
- queue UI;
- Settings UI;
- policy 1/2 por contexto;
- local no-table uses order default;
- table-linked uses table default;
- explicit copies precedence;
- test job = 1;
- App boundary;
- architecture boundary.

## 40. Gate automático completo

Antes de staging, executar e registrar:

```text
npm ci
npm test
npm run test:architecture
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
npm run d1:migrate:local
node scripts/infra/spec-b-d1-gate.mjs
```

O diff deve ser auditado para:

- endpoints;
- payloads;
- polling intervals;
- storage keys;
- error codes;
- copy defaults;
- capabilities;
- CSS;
- Worker;
- migrations;
- workflows;
- QZ signing/security.

## 41. Staging

Depois do candidate SHA GREEN:

- dispatch manual de `deploy-staging.yml`;
- usar branch C9;
- registrar run;
- confirmar SHA exato;
- confirmar migrations;
- confirmar Worker deploy;
- confirmar readiness;
- confirmar login smoke;
- executar QA funcional;
- depois executar QA física.

Commit documental posterior não substitui o SHA realmente homologado.

## 42. QA funcional manual

A matriz detalhada será fechada no plano, mas deve incluir pelo menos:

- PrintQueue desktop claro/escuro;
- PrintQueue mobile;
- busca;
- filtros;
- sort;
- paginação;
- detalhe;
- ticket preview;
- prioridade;
- discard;
- retry;
- force print;
- request/skip segunda via;
- unknown outcome — printed;
- unknown outcome — resend;
- reprint 1/2;
- recovery banner/actions;
- Settings policy;
- Settings station;
- Settings local printer;
- order default 1/2;
- table default 1/2;
- policy change não altera job antigo;
- queue-only;
- offline;
- logout/login;
- capabilities/restricted quando fixture existir.

Sem fixture apropriada: BLOCKED, nunca PASS inferido.

## 43. QA física obrigatória

C9 exige hardware real antes do merge.

A matriz mínima:

1. Entrega/Retirada default 1 → exatamente 1 via;
2. Entrega/Retirada default 2 → 1/2 + decisão + 2/2;
3. Local sem vínculo de mesa → usa `orderDefaultCopies`;
4. Pedido ligado à mesa default 1 → 1 via;
5. Pedido ligado à mesa default 2 → 1/2 + decisão + 2/2;
6. resumo/comanda default 1 e 2 → `tableTabDefaultCopies`;
7. quantidade explícita 1/2 vence default;
8. teste físico → exatamente 1 via;
9. dispensar segunda via → sem saída 2/2;
10. retry conhecido → não repete via confirmada;
11. resultado desconhecido → nenhum reenvio automático;
12. reprint → novo job, 1 ou 2 conforme escolha;
13. alterar policy com fila pendente → job antigo preserva `copies_requested`;
14. QZ fechado/offline → jobs seguros na fila;
15. retorno QZ/printer → sem despejo inseguro do backlog;
16. recovery com dois jobs → mantém afinidade no job corrente até resolver 2/2/dispensa;
17. solicitação remota → somente PC principal imprime;
18. physical state não-ready → nenhum novo claim/envio;
19. SPOOLING sem COMPLETE → sem retry silencioso/duplicação.

Os casos físicos centrais não podem ser aceitos como BLOCKED para merge da C9.

## 44. Não objetivos

Fora de escopo:

- impressora profissional;
- novo transport de rede;
- troca de QZ;
- upgrade de QZ Tray;
- troca do driver Windows;
- WebSocket/SSE;
- novo modelo de usuários/perfis;
- React Router;
- nova UI/UX;
- nova regra de vias;
- alteração de endpoints;
- alteração de schema/migrations;
- refactor amplo do Worker;
- C10 cleanup;
- deploy de produção.

## 45. Compatibilidade futura

A fronteira criada deve permitir, no futuro:

```text
Printing application
       ↓
Print transport contract
       ├─ QZ adapter
       └─ future professional printer adapter
```

A C9 não implementa o segundo adapter.

Não criar framework genérica de transportes apenas para antecipar esse futuro.

## 46. Critérios formais de aceite

C9 só está pronta para merge quando:

1. `domains/printing` existe como owner real;
2. `src/infrastructure/qz` é o único owner de `qz-tray`;
3. qz allowlist exception foi removida;
4. App não possui regras de segunda via/recovery/QZ;
5. `src/api/client.js` não possui Printing APIs;
6. legacy owners foram removidos;
7. public entry foi reduzido a consumidores reais;
8. zero facade temporária de Printing sobrevive;
9. shared cross-runtime contracts permanecem únicos;
10. order/table copy defaults permanecem independentes e equivalentes;
11. retry/reprint/force print permanecem distintos;
12. unknown outcome mantém resolução manual;
13. recovery affinity permanece durável;
14. operação física continua exclusiva;
15. heartbeat/readiness continuam fail-closed;
16. polling intervals são preservados;
17. storage keys são preservadas;
18. UI/UX atual é preservada;
19. CI completo passa;
20. architecture enforcement passa;
21. staging no SHA exato passa;
22. QA funcional termina com 0 FAIL / 0 PENDING;
23. QA física central termina PASS;
24. compatibility ledger e execution ledger estão atualizados;
25. merge recebe autorização explícita;
26. produção não é deployada pela C9.

## 47. Decisões deliberadas do design

### 47.1 Extração por responsabilidade, não só pasta

Rejeitado o caminho de apenas mover `src/printing` para `domains/printing` mantendo o manager monolítico.

Motivo: isso deixaria QZ, browser e domínio misturados e não cumpriria a Spec C.

### 47.2 Sem framework genérica de PrintTransport

Rejeitado criar abstração ampla para múltiplos transports futuros.

Motivo: YAGNI. Um objeto/adapter pequeno é suficiente para proteger a fronteira atual.

### 47.3 Shared real permanece shared

`printQueue`, `printQueueActions` e `printContextPolicy` não são movidos por estética.

Motivo: Worker e frontend têm consumidores reais.

### 47.4 Policy editing genérico permanece no App

Printing é owner da policy específica, não do engine genérico de revisão/conflito.

### 47.5 Regra atual de vias vence documento histórico

O design histórico que fixa mesa em 1 via está superseded pelo contrato atual e pela homologação física vigente.

## 48. Autorrevisão formal — 2026-09-19

Revisão feita contra:

- Spec C de modularização;
- rollout C9;
- `master` pós-C8 `91fb5581cea1616f438c13dfac28cfb38345fa59`;
- `src/printing/**`;
- `App.jsx`;
- `PrintQueue`;
- Printing Settings;
- SettingsSurface;
- `src/api/client.js`;
- architecture checker e allowlist;
- `shared/printQueue.js`;
- `shared/printQueueActions.js`;
- `shared/printContextPolicy.js`;
- Worker printing repository/API para conferir fronteiras sem propor alteração;
- spec histórica da fila central;
- runbook Windows/QZ;
- homologação física da Spec B de 15/09/2026.

### 48.1 Placeholder scan

- nenhum TBD/TODO de requisito;
- nenhum path essencial ficou indefinido;
- nomes internos podem ser refinados no plano, mas ownership e direção estão fechados.

### 48.2 Consistência

- política de vias está alinhada ao código atual;
- mesa/comanda não é fixada em 1 via;
- Local sem mesa usa order default;
- shared cross-runtime não contradiz domínio frontend;
- engine de policy editing permanece fora de Printing;
- QZ fica fora do domínio;
- Worker permanece inalterado por padrão.

### 48.3 Escopo

A C9 continua uma única fatia arquitetural coerente: Printing + separação do transport QZ.

A complexidade é alta, mas todas as mudanças compartilham a mesma fronteira operacional e a mesma homologação física. Não há subsistema independente que justifique nova spec separada.

### 48.4 Ambiguidades resolvidas

- `PrintingSettings.jsx`: não é automaticamente public API; manter/remover depende de consumidor real confirmado no plano;
- `printingSettingsAdapter.js`: pode ficar na Settings surface ou migrar para Printing application, desde que o engine genérico não migre;
- renderers ficam em Printing, não em QZ;
- certificate/sign endpoints continuam Printing API callbacks para QZ infra, sem mudança backend;
- cases físicos centrais não podem ser aceitos BLOCKED no merge gate.

### 48.5 Estado deste documento

O design foi aprovado em conversa, mas **esta versão escrita ainda requer aprovação explícita do usuário** antes da criação do plano de implementação.

Nenhuma implementação, staging, merge ou produção é autorizada por este documento.
