# Gestão Delivery — Cancelamento de agendados e impressão imediata

Data: 2026-09-07  
Branch: `feature/scheduled-cancel-immediate-printing`  
Status: design aprovado em conversa; aguardando revisão final deste arquivo antes do plano TDD

## 1. Objetivo

Corrigir o cancelamento de pedidos agendados e alterar o momento da impressão automática desses pedidos sem mudar a lógica operacional da cozinha.

A nova regra é:

- pedido agendado continua aparecendo em **Agendados** até entrar na janela operacional de 50 minutos;
- ele continua entrando automaticamente em **Em preparo** quando a janela começa;
- o alerta sonoro continua ligado à entrada na janela operacional;
- porém a **impressão automática deixa de esperar a janela** e passa a ficar disponível assim que o pedido é criado;
- pedido agendado pode ser **cancelado** normalmente enquanto está aguardando;
- não haverá edição de pedido agendado nesta versão.

A mudança deve ser aplicada primeiro em staging e só pode chegar à produção após homologação manual e aprovação explícita.

## 2. Decisões aprovadas

As decisões fechadas para esta rodada são:

1. **Não haverá botão nem fluxo de edição de pedido agendado.**
2. Pedido agendado terá opção de **Cancelar pedido** enquanto estiver aguardando a janela operacional.
3. A impressão automática de um **novo** pedido agendado fica disponível no momento do cadastro, e não 50 minutos antes do horário desejado.
4. A janela de 50 minutos continua existindo para a organização da cozinha, métricas operacionais, som e transição visual para `Em preparo`.
5. Cancelar um pedido não imprime ticket adicional de cancelamento.
6. Pedidos agendados já existentes no momento do deploy **não são antecipados nem reprocessados**; seus `print_jobs.available_at` já persistidos continuam exatamente como estão.
7. A alteração vale apenas para jobs automáticos criados depois da nova versão entrar em operação.
8. O fluxo atual da impressora sem guilhotina permanece: 1ª via automática, operador destaca o papel e aciona a 2ª via explicitamente quando configuradas duas cópias.
9. A integração Windows/QZ continua fora desta release; esta rodada deve ser compatível com o fluxo Android/RawBT já em produção.

## 3. Problema atual

### 3.1 Cancelamento

Na lista `Agendados`, o `KitchenTicket` já oferece o botão `Cancelar`.

Porém, ao abrir os detalhes de um pedido que ainda está aguardando a janela operacional, `Orders.jsx` atualmente remove a ação de cancelamento com a condição equivalente a:

```text
isScheduledWaiting(order, now)
  => esconder onRequestCancel
```

Isso cria uma inconsistência de UX: o mesmo pedido pode mostrar cancelamento no card, mas não nos detalhes.

A regra de backend já aceita cancelamento porque `Agendado` é um estado operacional derivado; o `status` persistido continua sendo `Em preparo` até finalização/cancelamento.

### 3.2 Impressão

No checkout atual, o job automático recebe:

```text
available_at = operational_start_at
```

Para pedido agendado, isso significa normalmente:

```text
available_at = scheduled_for - 50 minutos
```

Consequentemente, um pedido criado às 09:00 para 12:00 só se torna elegível para impressão automática às 11:10.

A nova regra separa impressão de preparação: a cozinha deve receber o ticket físico desde o lançamento do pedido, mesmo que o pedido permaneça visualmente em `Agendados` até a janela operacional.

## 4. Comportamento alvo do pedido agendado

Exemplo:

```text
09:00 pedido criado
12:00 horário desejado pelo cliente
11:10 início da janela operacional
```

Com a nova regra:

```text
09:00 pedido é salvo
09:00 job automático já pode ser assumido pela estação
09:00 1ª via é impressa automaticamente se a estação estiver pronta
09:00 pedido continua no bloco Agendados
11:10 pedido entra em Em preparo
11:10 alerta sonoro operacional continua podendo tocar conforme a regra existente
12:15 somente então passa a ser considerado atrasado, conforme a política atual
```

Portanto, `created_at`, `operational_start_at` e `available_at` deixam de apontar necessariamente para o mesmo evento em pedidos agendados.

## 5. Regra de impressão automática

### 5.1 Novos pedidos `Agora`

Nenhuma mudança conceitual:

```text
available_at = created_at
```

### 5.2 Novos pedidos `Agendados`

Passam a usar:

```text
available_at = created_at
```

O horário `operational_start_at` continua sendo calculado e usado por cozinha, métricas, som e classificação operacional, mas não controla mais a elegibilidade inicial de impressão.

### 5.3 Pedidos antigos no momento do deploy

Não haverá migration para alterar `print_jobs.available_at` já existentes.

Isso é obrigatório para evitar que a publicação da nova versão libere simultaneamente uma fila de pedidos agendados antigos.

Exemplo:

```text
pedido criado antes do deploy
available_at persistido = 11:10
```

Após o deploy:

```text
available_at continua = 11:10
```

Somente um checkout executado já com a nova versão cria um job com `available_at = created_at`.

### 5.4 Impressão automática desligada

A política existente permanece:

- se não houver estação primária com impressão automática ativa no momento do checkout, nenhum job automático é criado;
- ativar impressão posteriormente não faz backfill do pedido;
- a nova regra não pode criar jobs retroativos.

### 5.5 Lançamentos retroativos

Pedidos históricos/backdated continuam sem impressão automática.

## 6. Duas vias e impressora sem guilhotina

A mudança de `available_at` não altera o modelo de duas cópias.

Quando a estação estiver configurada para duas vias:

1. o novo pedido agendado fica elegível imediatamente;
2. a estação imprime somente a **1ª via**;
3. o job fica no estado já existente de `1/2`;
4. o sistema mostra o modal global orientando o operador a destacar o papel;
5. a **2ª via** só é impressa após ação explícita `Imprimir 2ª via`;
6. o mesmo job continua sendo usado, sem criar duplicata.

Não será implementada tentativa de imprimir as duas vias continuamente sem intervenção porque a MPT-II usada atualmente não possui corte automático.

## 7. Cancelamento de pedido agendado

### 7.1 Tela da cozinha

Enquanto o pedido estiver no bloco `Agendados`, o card continua oferecendo:

```text
Exibir detalhes
Cancelar
```

Não haverá botão `Editar`.

### 7.2 Detalhes do pedido

Ao abrir um pedido agendado aguardando a janela, a seção de detalhes deve também oferecer:

```text
Cancelar pedido
```

A condição que atualmente esconde `onRequestCancel` quando `isScheduledWaiting(...)` for verdadeiro deve ser removida/reformulada.

O fluxo usa o mesmo `CancelOrderDialog` já existente, com motivo obrigatório e regras de estorno existentes para pedidos pagos.

### 7.3 Depois que entra em preparo

Quando o relógio atingir a janela operacional, o pedido deixa de ser derivadamente `Agendado` e passa a aparecer em `Em preparo`.

O cancelamento continua seguindo a política normal já existente para pedidos ativos; esta spec não cria um lifecycle novo.

### 7.4 Efeito na impressão

O comportamento existente do backend é preservado:

- job automático ainda `pending` é removido no cancelamento;
- `claim-next` deve continuar ignorando pedidos cancelados para proteger contra corrida entre cancelamento e estação;
- job já `processing`, `printed`, `failed` ou `requires_attention` não é apagado retroativamente e permanece como histórico técnico.

Como, na nova regra, a impressão tende a acontecer logo após o cadastro, é esperado que muitos cancelamentos ocorram depois de a 1ª via já existir fisicamente.

Mesmo assim:

- **não** será criado ticket automático de cancelamento;
- o pedido cancelado sai da operação ativa da cozinha conforme o fluxo atual;
- nenhum job novo é criado apenas pelo cancelamento.

Se existir uma 2ª via ainda não impressa no momento em que o pedido for cancelado, a aplicação não deve iniciar essa 2ª via automaticamente. Um prompt global pendente referente a pedido já cancelado não deve provocar nova impressão automática.

## 8. Edição de pedido

Edição de pedido agendado está explicitamente **fora do escopo** desta versão.

Não deve ser criado:

- endpoint de atualização completa de pedido;
- botão `Editar pedido`;
- reaproveitamento do wizard `Nova venda` em modo edição;
- recálculo/estorno financeiro por edição;
- regeneração de snapshot por alteração de itens.

Essas possibilidades foram discutidas durante o brainstorming, mas foram descartadas quando foi aprovada a impressão imediata com fluxo simples de cancelamento.

## 9. Som, cozinha e relógio operacional

Nada muda nestas regras:

- pedido agendado criado fora da janela não toca som no cadastro;
- quando atingir `operational_start_at`, o alerta operacional continua seguindo a lógica atual;
- o pedido permanece em `Agendados` antes da janela;
- entra automaticamente em `Em preparo` ao alcançar a janela;
- o contador de preparo continua usando `operational_start_at`;
- a política de atraso continua usando `scheduled_for + 15 minutos` para pedidos agendados.

A mudança de impressão não pode antecipar visualmente o pedido para `Em preparo`.

## 10. Modelo de dados e migration

Nenhuma nova coluna é necessária.

Não haverá migration para esta feature.

Campos existentes continuam com as mesmas responsabilidades:

```text
orders.created_at
orders.scheduled_for
print_jobs.created_at
print_jobs.available_at
```

A mudança ocorre somente na regra usada para preencher `available_at` ao criar **novos** jobs automáticos de pedidos atuais.

## 11. Pontos de implementação esperados

O plano TDD deverá confirmar os arquivos exatos, mas o desenho atual indica mudanças principalmente em:

- `worker/repositories.js`
  - criação do job automático no checkout;
  - trocar a disponibilidade dos novos jobs agendados de `operational_start_at` para `created_at`;
- `worker/orderAutomaticPrintJob.test.js`
  - contrato da nova disponibilidade imediata;
  - regressão de `Agora`, agendado, backdated e impressão automática desligada;
- `src/pages/Orders.jsx`
  - permitir `onRequestCancel` também nos detalhes do pedido agendado aguardando;
- `src/pages/OrdersScheduled.test.js` e/ou regressão específica de UX
  - provar que card e detalhes permitem cancelamento e não oferecem edição;
- testes de impressão/cancelamento existentes
  - provar que cancelamento de job pending continua removendo o job e que pedidos cancelados não são assumidos pela estação.

Não deve haver alteração no transporte RawBT, renderer bitmap ou integração QZ nesta rodada.

## 12. Concorrência e segurança operacional

Os seguintes cenários precisam continuar seguros:

### Cancelamento antes do claim

```text
pedido criado
job pending imediato
operador cancela antes da estação assumir
```

Resultado:

```text
job pending é removido
pedido não imprime depois
```

### Claim concorrente com cancelamento

```text
estação tenta claim
operador cancela quase ao mesmo tempo
```

A proteção existente que valida o status do pedido durante o claim deve continuar impedindo que um job de pedido cancelado seja assumido indevidamente quando ainda houver possibilidade de abortar a corrida.

Se o job já tiver sido fisicamente enviado à impressora antes do cancelamento, não existe rollback físico; o registro técnico permanece e a UI da cozinha passa a ser a fonte de verdade operacional, conforme decisão aprovada.

## 13. Estratégia TDD

A implementação deve seguir RED → GREEN → REFACTOR, com commits pequenos.

Cobertura mínima:

### Backend — impressão

- pedido `Agora` novo mantém `available_at = created_at`;
- pedido `Agendado` novo passa a `available_at = created_at`;
- `operational_start_at` continua diferente quando aplicável;
- pedido antigo persistido não é alterado por migration ou backfill;
- auto-print desligado não cria job;
- ausência de estação primária não cria job;
- backdated não cria job;
- idempotência continua gerando um único pedido e um único job.

### Backend — cancelamento

- cancelar pedido agendado derivadamente aguardando é permitido pelo lifecycle existente;
- pending automatic job é removido;
- job já impresso não é apagado;
- não é criado ticket/job de cancelamento;
- claim de pedido cancelado permanece bloqueado.

### Frontend

- card agendado mantém `Cancelar`;
- detalhes de agendado aguardando exibem `Cancelar pedido`;
- nenhum botão `Editar pedido` é introduzido;
- cancelamento usa o diálogo atual;
- duas vias e modal global continuam sem regressão;
- pedido continua visualmente em `Agendados` antes da janela, mesmo com job disponível/impressão concluída.

### Gates completos

Antes de staging:

```text
npm test
npm run lint
npm run build
validação do Worker de produção em dry-run
validação do Worker de staging em dry-run
migrations/D1 local conforme gate atual
```

## 14. Homologação em staging

Depois de CI verde, publicar somente em staging e testar manualmente:

1. deixar a estação Android/RawBT configurada como primária e com impressão automática ativa;
2. criar um pedido `Agendado` para horário suficientemente distante da janela de 50 minutos;
3. confirmar que ele aparece no bloco `Agendados`;
4. confirmar que a **1ª via abre/imprime imediatamente**, sem esperar a janela;
5. confirmar que o horário desejado aparece corretamente no ticket;
6. se configuradas duas vias, confirmar o modal global e a 2ª via explícita;
7. criar outro pedido agendado distante e cancelá-lo pelo card antes de imprimir, quando operacionalmente possível, confirmando que pending job não reaparece;
8. criar outro pedido agendado e abrir os detalhes, confirmando `Cancelar pedido`;
9. cancelar um pedido que já teve ticket físico e confirmar que ele some da fila operacional sem gerar ticket de cancelamento;
10. confirmar que o pedido não entra em `Em preparo` antes da janela apenas por ter sido impresso;
11. fazer smoke test de pedido `Agora` para garantir que a impressão normal não regrediu.

Somente após homologação física e aprovação explícita a mudança pode ser considerada para produção.

## 15. Fora de escopo

- edição de pedidos;
- ticket automático de cancelamento;
- reprocessamento/backfill de agendamentos antigos;
- alteração da janela operacional de 50 minutos;
- alteração da tolerância de atraso de 15 minutos;
- alteração do alerta sonoro;
- mudança do renderer ESC/POS/bitmap;
- mudança do RawBT;
- inclusão da integração Windows/QZ nesta release;
- mudança do modelo financeiro de cancelamento/estorno.

## 16. Critérios de sucesso

A feature está pronta quando:

- novos pedidos agendados ficam elegíveis para impressão automática imediatamente no cadastro;
- pedidos antigos mantêm o `available_at` já persistido;
- pedido agendado continua em `Agendados` até a janela operacional;
- som continua associado à janela, não ao cadastro;
- card e detalhes permitem cancelamento do agendado;
- não existe edição nesta versão;
- cancelamento não imprime ticket adicional;
- pending job é removido quando o cancelamento acontece antes do processamento;
- não existe regressão de duas vias, RawBT, pedidos `Agora` ou idempotência;
- CI fica verde;
- staging é homologado fisicamente;
- produção continua intocada até aprovação explícita.