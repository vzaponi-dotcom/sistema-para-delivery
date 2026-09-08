# Plano de Implementação — Fila Centralizada de Impressão com QZ Tray

**Data:** 2026-09-08  
**Branch de design:** `design/centralized-qz-print-queue`  
**Spec de referência:** `docs/superpowers/specs/2026-09-08-centralized-qz-print-queue-design.md`

## Objetivo

Migrar a impressão do Gestão Delivery para uma arquitetura centralizada em que celulares, tablets e computadores apenas criam solicitações de impressão, enquanto **somente o PC da cozinha, com QZ Tray e a impressora USB configurada, executa a impressão física**.

A implementação deve preservar histórico, suportar 1 ou 2 vias, introduzir a tela responsiva **Fila de impressão**, eliminar o fluxo operacional RawBT/Web Serial após homologação física, e manter produção protegida até aprovação explícita.

## Restrições de execução

- Não trabalhar diretamente na `master`.
- Criar uma branch de implementação isolada a partir do HEAD remoto validado da branch de feature/staging apropriada.
- Não fazer deploy de produção durante a execução deste plano.
- Usar **TDD estrito**: teste RED antes de cada mudança relevante, depois implementação mínima GREEN e refactor.
- Rodar testes focados após cada tarefa e a suíte completa nos checkpoints.
- Não remover RawBT/Web Serial antes da homologação física do novo fluxo QZ em staging.
- A semântica de `Impresso` deve ser operacional: aceito/enviado com sucesso pela estação QZ, sem prometer confirmação física do papel além do que o transporte oferece.

---

# Fase 0 — Preparação e baseline

## Tarefa 0.1 — Criar branch/worktree de implementação isolada

**Arquivos:** nenhum.

1. Atualizar refs remotas.
2. Confirmar HEAD da branch base aprovada.
3. Criar branch, por exemplo:
   - `feature/centralized-qz-print-queue`
4. Criar worktree isolada.
5. Confirmar árvore limpa.

**Verificação:**

```bash
git status --short
git branch --show-current
git rev-parse HEAD
```

**Checkpoint:** registrar SHA inicial no ledger da rodada.

## Tarefa 0.2 — Baseline de testes

**Arquivos:** nenhum.

Rodar:

```bash
npm test
npm run lint
npm run build
```

Se houver falha pré-existente, parar e investigar antes de alterar código.

**Commit:** nenhum.

---

# Fase 1 — Modelo de dados central da fila

## Tarefa 1.1 — Escrever migration RED para fila central e auditoria

**Criar:**
- `migrations/0014_centralized_print_queue.sql`

**Atualizar testes:**
- `worker/orderPrintingMigration.test.js`

### RED

Adicionar testes que exijam suporte a:

- prioridade do job;
- estado de atenção/descarte sem apagar histórico;
- vínculo de reimpressão com job anterior;
- timestamps de descarte e ação;
- snapshot da quantidade de vias no job;
- heartbeat/estado da estação principal;
- configuração central de vias do negócio.

Modelo recomendado, ajustável ao schema existente:

- `print_jobs.priority`
- `print_jobs.parent_job_id`
- `print_jobs.discarded_at`
- `print_jobs.attention_reason`
- `print_jobs.action_actor_label` ou campo genérico equivalente de auditoria
- índices para fila ativa e prioridade
- configuração central de vias em tabela de settings do negócio, ou estrutura equivalente compatível com o projeto

Não introduzir tabela de usuários/permissões nesta fase.

### GREEN

Criar migration aditiva e compatível com dados existentes.

### Verificação

```bash
node --test worker/orderPrintingMigration.test.js
```

### Commit sugerido

```bash
git add migrations/0014_centralized_print_queue.sql worker/orderPrintingMigration.test.js
git commit -m "feat: extend print queue data model"
```

## Tarefa 1.2 — Mapear novos campos no repositório

**Alterar:**
- `worker/orderPrintingRepository.js`
- `worker/orderPrintingRepository.test.js`

### RED

Testar que `listPrintJobs()` devolve os novos campos normalizados e mantém compatibilidade com jobs antigos.

Testar ordenação por:

1. jobs priorizados;
2. `available_at`/criação;
3. desempate estável.

### GREEN

Atualizar mapper/queries.

### Verificação

```bash
node --test worker/orderPrintingRepository.test.js
```

### Commit

```bash
git commit -am "feat: expose centralized print queue fields"
```

---

# Fase 2 — Regra automática de vias e criação de jobs

## Tarefa 2.1 — Pedido de mesa sempre cria 1 via automática

**Alterar:**
- `worker/orderAutomaticPrintJob.test.js`
- `worker/repositories.js`

### RED

Adicionar testes cobrindo:

- `customerIdentity.type === 'table'` ou pedido ligado a `table_tab_id` → `copies_requested = 1`;
- configuração central = 2, mas pedido de mesa continua 1;
- Entrega → respeita padrão 1/2;
- Retirada → respeita padrão 1/2;
- mudança da configuração depois da criação não altera job já criado.

### GREEN

No momento da criação do job automático, calcular:

```text
mesa/consumo local => 1
entrega/retirada => configuração central vigente
```

Persistir essa quantidade no job.

### Verificação

```bash
node --test worker/orderAutomaticPrintJob.test.js
```

### Commit

```bash
git commit -am "feat: use one automatic copy for table orders"
```

## Tarefa 2.2 — Configuração central de vias

**Alterar/criar conforme arquitetura atual:**
- `worker/orderPrintingRepository.js`
- `worker/orderPrintingApi.js`
- `worker/orderPrintingHttp.test.js`
- `src/api/client.js`
- `src/api/printingClient.test.js`
- `src/components/PrintingSettings.jsx`
- `src/components/PrintingSettings.test.js`

### RED

Testar:

- GET da configuração central;
- PUT aceitando apenas 1 ou 2;
- qualquer dispositivo autenticado atual pode visualizar/alterar enquanto não existe sistema de permissões;
- comentário/TODO explícito para futura autorização por role, sem criar role agora.

### GREEN

Mover `defaultCopies` do conceito local da estação para configuração central do negócio. Durante migração, preservar valor existente de forma determinística.

### Verificação

```bash
node --test worker/orderPrintingHttp.test.js src/api/printingClient.test.js src/components/PrintingSettings.test.js
```

### Commit

```bash
git commit -am "feat: centralize default print copies"
```

---

# Fase 3 — Estados e ações da fila

## Tarefa 3.1 — Definir máquina de estados canônica

**Criar:**
- `shared/printQueue.js`
- `shared/printQueue.test.js`

Estados de UI aprovados:

- `queued` → Na fila
- `waiting_station` → Aguardando estação
- `printing` → Imprimindo
- `waiting_second_copy` → Aguardando 2ª via
- `printed` → Impresso
- `attention` → Requer atenção
- `discarded` → Descartado

Falhas técnicas podem ser motivo/código dentro de `attention`, evitando estados duplicados na UI. Se o backend atual ainda exigir `failed` durante migração, criar tradução explícita para `attention` e remover o legado depois.

### RED

Testar transições válidas e rejeição de transições impossíveis.

### GREEN

Implementar helpers puros para labels, terminalidade e elegibilidade.

### Verificação

```bash
node --test shared/printQueue.test.js
```

### Commit

```bash
git add shared/printQueue.js shared/printQueue.test.js
git commit -m "feat: define centralized print queue states"
```

## Tarefa 3.2 — Descartar preservando histórico

**Alterar:**
- `worker/orderPrintingRepository.js`
- `worker/orderPrintingRepository.test.js`
- `worker/orderPrintingApi.js`
- `worker/orderPrintingHttp.test.js`
- `src/api/client.js`
- `src/api/printingClient.test.js`

### RED

Testar que descartar:

- não deleta row;
- muda estado para `discarded`;
- grava horário;
- grava rótulo de ator disponível hoje (`Sistema`, dispositivo/estação ou equivalente);
- não volta à fila automática;
- é idempotente ou rejeita repetição com mensagem consistente.

### GREEN

Adicionar endpoint de ação, por exemplo:

```text
POST /api/printing/jobs/:id/discard
```

### Verificação

```bash
node --test worker/orderPrintingRepository.test.js worker/orderPrintingHttp.test.js src/api/printingClient.test.js
```

### Commit

```bash
git commit -am "feat: discard print jobs without deleting history"
```

## Tarefa 3.3 — Priorizar / Imprimir agora

**Alterar:** mesmos arquivos de API/repository da tarefa anterior.

### RED

Testar que `Imprimir agora`:

- não exige impressora no dispositivo solicitante;
- eleva prioridade do job;
- se estação estiver offline, permanece em `waiting_station`;
- quando estação volta, job priorizado é reclamado antes dos demais elegíveis;
- não muda job terminal (`printed`, `discarded`).

### GREEN

Adicionar ação central `prioritize`.

### Commit

```bash
git commit -am "feat: prioritize queued print jobs"
```

## Tarefa 3.4 — Retry e Requer atenção

**Alterar:**
- `worker/orderPrintingRepository.js`
- testes correspondentes.

### RED

Cobrir:

- erro de QZ → `attention` com código/mensagem;
- retry limpa erro operacional e recoloca em fila;
- job de pedido finalizado/cancelado não é retomado automaticamente;
- pedido finalizado/cancelado pendente vai para `attention`.

### GREEN

Centralizar regra de elegibilidade de retomada.

### Commit

```bash
git commit -am "feat: route stale or invalid print jobs to attention"
```

---

# Fase 4 — Reimpressão auditável

## Tarefa 4.1 — Reimprimir cria novo job vinculado

**Alterar:**
- `worker/orderPrintingRepository.js`
- `worker/orderPrintingRepository.test.js`
- `worker/orderPrintingApi.js`
- `worker/orderPrintingHttp.test.js`
- `src/api/client.js`
- `src/api/printingClient.test.js`

### RED

Testar:

- reimpressão de job impresso cria novo ID;
- original permanece `printed` intacto;
- novo job recebe `parent_job_id`;
- origem/trigger é manual/reprint;
- aceita 1 ou 2 vias;
- reimpressão de pedido de mesa pode pedir 2 vias manualmente.

### GREEN

Criar endpoint explícito, por exemplo:

```text
POST /api/printing/jobs/:id/reprint
{ "copies": 1|2 }
```

### Commit

```bash
git commit -am "feat: create linked jobs for reprints"
```

---

# Fase 5 — Estação única QZ e heartbeat

## Tarefa 5.1 — Definir estação física elegível

**Alterar:**
- `src/printing/localPrintStation.js`
- `src/printing/localPrintStation.test.js`
- `worker/orderPrintingRepository.js`
- testes correspondentes.

### RED

Testar que somente a estação principal QZ pode reclamar/executar jobs automáticos.

Dispositivos móveis e estações não-QZ continuam podendo criar/priorizar/descartar/reimprimir jobs via API, mas não executam transporte físico.

### GREEN

Separar claramente:

- **cliente solicitante**;
- **estação executora**.

### Commit

```bash
git commit -am "feat: restrict physical printing to primary qz station"
```

## Tarefa 5.2 — Heartbeat/status operacional da estação

**Alterar:**
- `worker/orderPrintingRepository.js`
- `worker/orderPrintingApi.js`
- `worker/orderPrintingHttp.test.js`
- `src/api/client.js`
- `src/printing/usePrintingManager.js`
- testes do manager.

### RED

Cobrir:

- heartbeat atualiza `last_seen_at`;
- status diferencia estação recente/online vs offline por timeout definido na spec/constante;
- station health informa QZ/printer ready quando disponível;
- jobs exibem `waiting_station` quando estação não está operacional.

### GREEN

Adicionar heartbeat periódico somente no PC executor.

Definir operacionalmente online como combinação suficiente de:

```text
sessão/app da estação ativa + heartbeat recente + QZ disponível + impressora configurada/pronta para transporte
```

### Commit

```bash
git commit -am "feat: track qz kitchen station health"
```

---

# Fase 6 — Executor QZ centralizado

## Tarefa 6.1 — Reescrever manager para enfileirar vs executar

**Alterar:**
- `src/printing/usePrintingManager.js`
- `src/printing/usePrintingManager.test.js`
- `src/printing/printingManagerRegression.test.js`
- `src/printing/printJobRunner.js`
- `src/printing/printJobRunner.test.js`

### RED

Testar:

- celular chama criação de job, nunca transporte local;
- PC principal reclama job central;
- somente depois de sucesso do QZ a etapa é marcada concluída;
- erro do QZ vira `attention`;
- reload não repete job já aceito/concluído;
- runner respeita prioridade e elegibilidade.

### GREEN

Separar APIs do hook:

```text
requestPrint(order/copies) -> servidor
prioritize(job) -> servidor
reprint(job/copies) -> servidor
executeClaimedJob(job) -> somente estação QZ
```

### Commit

```bash
git commit -am "refactor: centralize print execution on qz station"
```

## Tarefa 6.2 — Fluxo de duas vias

**Alterar:**
- `src/printing/printJobRunner.js`
- testes do runner;
- `src/App.jsx` ou componente específico de prompt;
- `src/printing/finalizedOrderSecondCopyPrompt.test.js`

### RED

Cobrir:

- job de 1 via → conclui após primeira impressão;
- job de 2 vias → primeira impressão muda para `waiting_second_copy`;
- somente estação principal vê prompt operacional;
- botão `Depois` fecha o prompt sem alterar para impresso;
- reload não reabre automaticamente prompt antigo;
- `Imprimir 2ª via` executa apenas a segunda etapa e conclui;
- mobile/tablet nunca vê prompt da segunda via;
- pedido de mesa automático nunca entra nesse estado.

### GREEN

Implementar flag/registro de apresentação do prompt por sessão/transition id, mantendo ação também disponível na Fila de impressão.

### Commit

```bash
git commit -am "feat: scope second-copy flow to kitchen qz station"
```

---

# Fase 7 — Tela Fila de impressão

## Tarefa 7.1 — Criar navegação e página base

**Criar:**
- `src/pages/PrintQueue.jsx`
- `src/pages/PrintQueue.test.js`
- `src/printing/print-queue.css`

**Alterar:**
- `src/App.jsx`
- `src/components/Sidebar.jsx`
- `src/components/MobileNavigation.jsx` se aplicável
- testes de navegação correspondentes.

### RED

Testar presença da rota/menu **Fila de impressão** e responsividade básica.

### GREEN

Criar layout aprovado com:

- título/subtítulo;
- cards de resumo;
- filtros;
- lista/tabela desktop;
- cards mobile;
- indicador da estação `Cozinha PC` online/offline.

### Commit

```bash
git add src/pages/PrintQueue.jsx src/pages/PrintQueue.test.js src/printing/print-queue.css src/App.jsx src/components/Sidebar.jsx src/components/MobileNavigation.jsx
git commit -m "feat: add centralized print queue page"
```

## Tarefa 7.2 — Status, filtros e detalhe

**Alterar:**
- `src/pages/PrintQueue.jsx`
- testes da página;
- `src/components/PrintStatusBadge.jsx`
- testes do badge.

### RED

Cobrir filtros por status/origem/estação/busca e detalhe com timeline.

### GREEN

Mostrar, no mínimo:

- pedido/mesa/cliente;
- origem;
- vias solicitadas/impressas;
- estado;
- horário;
- estação;
- motivo de atenção;
- vínculo com reimpressão quando existir.

### Commit

```bash
git commit -am "feat: show print queue filters and job details"
```

## Tarefa 7.3 — Ações da fila

### RED

Testar botões por estado:

- `Imprimir agora` → priorizar;
- `Tentar novamente`;
- `Descartar`;
- `Reimprimir` com escolha 1/2;
- `Imprimir 2ª via` somente quando aplicável;
- `Ver ticket`.

### GREEN

Conectar com API central e usar toasts discretos em vez de pop-ups bloqueantes.

### Commit

```bash
git commit -am "feat: add print queue operational actions"
```

---

# Fase 8 — Remover pop-ups incorretos e UX móvel local

## Tarefa 8.1 — Celular apenas confirma enfileiramento

**Alterar:**
- pontos de UI que hoje chamam impressão direta em `src/App.jsx`, `src/pages/*`, `src/components/*` conforme busca de referências;
- testes de regressão.

### RED

Testar mensagem:

```text
Pedido enviado para a fila da cozinha
```

Sem abrir RawBT, sem modal de impressão física, sem prompt de segunda via.

### GREEN

Substituir callbacks por criação/priorização central.

### Commit

```bash
git commit -am "fix: make mobile printing queue-only"
```

## Tarefa 8.2 — Falhas sem modal bloqueante

### RED

Erro de QZ deve produzir toast discreto e estado `Requer atenção`, não loop de modal.

### GREEN

Remover caminhos de modal de erro de transporte que não são mais necessários.

### Commit

```bash
git commit -am "fix: surface print failures through queue attention"
```

---

# Fase 9 — Compatibilidade e homologação antes da limpeza

## Tarefa 9.1 — Rodar suíte técnica completa

```bash
npm test
npm run lint
npm run build
npm run d1:migrate:local
```

Corrigir apenas regressões da feature, sempre com teste reproduzindo a falha antes da correção.

## Tarefa 9.2 — Deploy em staging

Somente após suíte verde e revisão de código.

Aplicar migration de staging e deploy conforme workflow/runbook existente.

**Não fazer produção.**

## Tarefa 9.3 — Homologação funcional em múltiplos dispositivos

Validar em staging:

1. Pedido Entrega com padrão 2 vias criado no celular → aparece na fila → PC imprime 1ª → prompt só no PC → 2ª via após ação.
2. Pedido Retirada → mesma regra central configurada.
3. Pedido Mesa com padrão central 2 → imprime somente 1 via e nunca pede segunda.
4. Celular com PC offline → job `Aguardando estação`.
5. `Imprimir agora` offline → job priorizado, sem erro.
6. PC volta → job elegível priorizado é processado.
7. Pedido já finalizado/cancelado durante offline → `Requer atenção`, não imprime sozinho.
8. Descartar → some da fila ativa, permanece no histórico.
9. Reimprimir → novo job ligado ao original.
10. Reload do PC → nenhum popup antigo reaparece.

## Tarefa 9.4 — Homologação física obrigatória no PC da cozinha

No hardware real:

- QZ Tray 2.2.6;
- fila Windows `Impressora pedido`;
- MPT-II USB;
- renderer compatível atual;
- acentuação;
- avanço final;
- separação manual entre vias;
- sequência de diversos jobs;
- recuperação após QZ fechado/reaberto;
- recuperação após impressora desconectada/reconectada.

**Gate:** sem aprovação física explícita, **não iniciar remoção de RawBT/Web Serial**.

### Commit/checkpoint

Registrar evidências de homologação no documento de QA/runbook apropriado antes da próxima fase.

---

# Fase 10 — Limpeza do legado RawBT e Web Serial

## Tarefa 10.1 — Inventário de referências legadas

Antes de apagar, executar busca:

```bash
rg -n "rawbt|RawBT|bluetooth|Bluetooth|Web Serial|webSerial|serialTransport" src worker shared docs .github
```

Classificar cada ocorrência como:

- código de produção;
- teste;
- documentação histórica;
- comentário obsoleto;
- referência que ainda é necessária.

## Tarefa 10.2 — Remover transporte RawBT

**Remover após homologação:**
- `src/printing/rawBtTransport.js`
- `src/printing/rawBtTransport.test.js`

**Alterar:**
- `src/printing/usePrintingManager.js`
- `src/components/PrintingSettings.jsx`
- testes/regressões que ainda esperam Android como estação física.

### RED

Antes de remover, criar teste de arquitetura garantindo que código de produção não importe nem despache `rawbt:`.

### GREEN

Remover o legado.

### Commit

```bash
git commit -am "refactor: remove rawbt print transport"
```

## Tarefa 10.3 — Remover Web Serial do fluxo de produção

**Remover após confirmar ausência de dependências úteis:**
- `src/printing/webSerialTransport.js`
- `src/printing/webSerialTransport.test.js`

Criar teste de arquitetura equivalente se necessário.

### Commit

```bash
git commit -am "refactor: remove legacy web serial printing"
```

## Tarefa 10.4 — Simplificar configuração de estação

**Alterar:**
- `src/printing/localPrintStation.js`
- `src/components/PrintingSettings.jsx`
- `worker/orderPrintingApi.js`
- `worker/orderPrintingRepository.js`
- testes.

Eliminar opções específicas de Android/RawBT e transportes antigos. A UX deve falar em **Cozinha PC / QZ Tray / impressora configurada**.

### Commit

```bash
git commit -am "refactor: simplify printing to single qz station"
```

---

# Fase 11 — Reescrever documentação

## Tarefa 11.1 — Atualizar runbook operacional QZ

**Reescrever:**
- `docs/operations/windows-qz-tray-printing.md`

Deve documentar:

```text
Dispositivo solicitante -> Cloudflare/fila -> Cozinha PC -> QZ Tray -> Windows -> USB -> MPT-II
```

Incluir:

- pré-requisitos do PC;
- significado de estação online/offline;
- queue recovery;
- 1/2 vias;
- pedido de mesa = 1 via automática;
- troubleshooting de QZ/impressora;
- sem RawBT no fluxo normal.

## Tarefa 11.2 — Reescrever checklist de aceitação

**Reescrever:**
- `docs/order-printing-mtp5-acceptance.md`

Remover instruções que tratem RawBT/Web Serial como arquitetura atual.

## Tarefa 11.3 — Marcar documentos antigos como superseded

**Atualizar:**
- `docs/superpowers/specs/2026-09-03-order-printing-escpos-design.md`
- `docs/superpowers/plans/2026-09-03-order-printing-escpos-plan.md`
- outros documentos encontrados na busca que ensinem RawBT/Web Serial como caminho atual.

Adicionar banner claro no topo apontando para a spec centralizada de 2026-09-08.

### Commit

```bash
git add docs
git commit -m "docs: replace legacy rawbt printing guidance"
```

---

# Fase 12 — Verificação final do código limpo

## Tarefa 12.1 — Busca obrigatória por legado

Rodar:

```bash
rg -n "rawbt|RawBT|bluetooth|Bluetooth|Web Serial|webSerial|serialTransport" src worker shared .github
```

Resultado esperado: **nenhuma referência no código de produção**.

Em `docs/`, aceitar apenas referências históricas explicitamente marcadas como superseded, se ainda houver motivo para preservá-las.

## Tarefa 12.2 — Suíte completa

```bash
npm test
npm run lint
npm run build
npm run d1:migrate:local
```

Se possível, executar também validações específicas do workflow de impressão.

## Tarefa 12.3 — Revisão de diff

Verificar:

```bash
git status --short
git diff --check
git diff <BASE_SHA>...HEAD --stat
```

Revisar particularmente:

- migrations aditivas;
- compatibilidade com jobs existentes;
- nenhuma mudança acidental de produção/deploy;
- nenhum secret/certificado privado commitado;
- nenhum caminho mobile de impressão física restante.

---

# Fase 13 — Staging final e aceite

## Tarefa 13.1 — Novo deploy de staging após limpeza

Aplicar migration/deploy de staging novamente com código já sem legado.

Repetir homologação física essencial:

- Entrega 2 vias;
- Mesa 1 via;
- offline/retorno;
- falha e retry;
- descarte;
- reimpressão;
- reload sem popup antigo.

## Tarefa 13.2 — Aprovação do usuário

Apresentar:

- URL de staging;
- SHA exato;
- migrations aplicadas;
- resultado dos testes/lint/build;
- checklist de homologação;
- resumo dos arquivos RawBT/Web Serial removidos;
- documentação atualizada.

Aguardar aprovação explícita antes de merge.

---

# Fase 14 — Integração segura

Usar a skill `finishing-a-development-branch`.

Antes de criar/atualizar PR:

```bash
npm test
npm run lint
npm run build
git status --short
```

Criar PR da branch de implementação para a branch de integração definida pelo fluxo atual do projeto. Não promover para produção automaticamente.

Produção só pode ocorrer depois de:

1. PR revisado;
2. CI verde;
3. staging homologado física e funcionalmente;
4. aprovação explícita do usuário;
5. merge controlado para `master`;
6. deploy manual de produção usando o workflow que fixa `master`.

---

# Matriz mínima de testes de regressão

A implementação não está pronta enquanto não existir cobertura automatizada para todos estes contratos:

| Cenário | Resultado esperado |
|---|---|
| Novo pedido Entrega, padrão 2 | Job automático 2 vias |
| Novo pedido Retirada, padrão 1 | Job automático 1 via |
| Novo pedido Mesa, padrão 2 | Job automático 1 via |
| Mudança de padrão após job criado | Job antigo não muda |
| Solicitação mobile | Apenas cria job central |
| Estação offline | `Aguardando estação` |
| Imprimir agora offline | Prioriza e continua aguardando |
| PC QZ reclama job | `Imprimindo` |
| QZ conclui primeira de 2 | `Aguardando 2ª via` |
| Reload após 1ª via | Não reabre popup antigo automaticamente |
| Segunda via executada | `Impresso` |
| Falha QZ | `Requer atenção` + motivo |
| Retry | Volta à fila se elegível |
| Pedido finalizado/cancelado pendente | `Requer atenção`, sem auto print |
| Descartar | Histórico preservado |
| Reimprimir | Novo job com vínculo ao original |
| RawBT/Web Serial pós-limpeza | Nenhum import/caminho em produção |

# Ordem de commits sugerida

1. `feat: extend print queue data model`
2. `feat: expose centralized print queue fields`
3. `feat: use one automatic copy for table orders`
4. `feat: centralize default print copies`
5. `feat: define centralized print queue states`
6. `feat: discard print jobs without deleting history`
7. `feat: prioritize queued print jobs`
8. `feat: route stale or invalid print jobs to attention`
9. `feat: create linked jobs for reprints`
10. `feat: restrict physical printing to primary qz station`
11. `feat: track qz kitchen station health`
12. `refactor: centralize print execution on qz station`
13. `feat: scope second-copy flow to kitchen qz station`
14. `feat: add centralized print queue page`
15. `feat: show print queue filters and job details`
16. `feat: add print queue operational actions`
17. `fix: make mobile printing queue-only`
18. `fix: surface print failures through queue attention`
19. checkpoint de staging/homologação física
20. `refactor: remove rawbt print transport`
21. `refactor: remove legacy web serial printing`
22. `refactor: simplify printing to single qz station`
23. `docs: replace legacy rawbt printing guidance`
24. verificação e staging final

# Critério de conclusão

Esta iniciativa estará pronta para merge somente quando:

- toda criação de impressão for centralizada;
- somente o PC/QZ executar fisicamente;
- pedidos de mesa automáticos gerarem uma via;
- Entrega/Retirada respeitarem configuração central;
- a fila visual estiver funcional em desktop e mobile;
- segunda via não gerar popup fora da estação principal nem loop no reload;
- descarte e reimpressão forem auditáveis;
- jobs inválidos após offline não imprimirem silenciosamente;
- RawBT e Web Serial tiverem sido removidos do código de produção após homologação;
- documentação operacional estiver reescrita;
- `npm test`, `npm run lint` e `npm run build` estiverem verdes;
- staging tiver sido homologado fisicamente no equipamento real;
- o usuário tiver aprovado explicitamente a versão de staging.
