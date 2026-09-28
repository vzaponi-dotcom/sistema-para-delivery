# Central de Controle da Cozinha — controle remoto da TV e acompanhamento operacional

**Data:** 2026-09-28  
**Branch:** `feature/kitchen-tv-control-center`  
**Base:** `master@18f37ff68bcad478f9d34800c4378044424cb769`  
**Status:** proposta de produto/arquitetura para aprovação.  
**Produção:** não implementar nem publicar antes da aprovação da spec e do plano TDD.

## 1. Contexto

A TV da Cozinha já funciona como painel passivo: recebe pedidos ativos, calcula best-fit responsivo, aplica prioridade operacional e exibe overflow quando nem todos cabem.

A homologação real mostrou uma necessidade operacional natural: a TV não é touchscreen e usar controle remoto/setas do navegador é lento. Ao mesmo tempo, já existe uma pessoa na cozinha com celular capaz de acompanhar a fila.

A proposta é transformar o celular em um **controle remoto operacional da TV**, sem transformar a TV em uma superfície de escrita e sem misturar esse fluxo com a finalização oficial do pedido.

## 2. Objetivos

Criar uma tela mobile-first chamada **Controle da TV** que permita:

1. ver o estado atual da TV pareada;
2. avançar, voltar e retornar à primeira página da TV;
3. ver uma lista simples dos pedidos em preparo;
4. retirar um pedido apenas da TV, sem alterar seu status oficial;
5. restaurar um pedido retirado da TV;
6. manter a TV responsiva a novas chegadas e às regras de prioridade já homologadas.

A TV continua sendo **somente leitura**. Toda ação parte de uma sessão administrativa autenticada no celular.

## 3. Não objetivos

Esta entrega não deve:

- alterar `orders.status` para a ação de retirada da TV;
- preencher `finished_at`;
- marcar entrega como enviada/despachada;
- marcar retirada/local como finalizado;
- registrar pagamento, impressão, cancelamento ou histórico terminal;
- substituir a tela Pedidos → Cozinha;
- permitir mutações oficiais através da sessão restrita da TV;
- adicionar touchscreen, WebSocket obrigatório ou aplicativo nativo;
- suportar múltiplas TVs por negócio nesta primeira versão.

## 4. Regra crítica: “retirar da TV” não é “finalizar pedido”

Hoje a ação oficial de finalização usa `orders.finalize` e persiste `status = 'Finalizado'` + `finished_at`. Para Entrega isso representa “saiu para entrega”; para Retirada/Local representa finalização operacional.

A nova tela **não pode reutilizar essa mutação**.

A ação da central deve se chamar preferencialmente:

- **Retirar da TV**

e comunicar de forma explícita:

> Remove apenas do painel da TV. O pedido continua em preparo no sistema.

O pedido permanece visível e acionável em Pedidos → Cozinha até a finalização/cancelamento oficial.

## 5. Experiência proposta no celular

Rota proposta:

`/pedidos/controle-da-tv`

A rota pertence à área **Pedidos**, não à área Configurações. Configurações → TV da Cozinha ganha apenas um atalho “Abrir controle da TV”.

Motivo: a tela é operacional e será usada repetidamente por alguém trabalhando na cozinha.

### 5.1 Cabeçalho de controle

Exibir:

- estado da TV: pareada / não pareada;
- última telemetria conhecida;
- página atual: “Tela 1 de 3”;
- botões **Anterior**, **Início**, **Próxima**;
- feedback temporário “Atualizando TV…”.

Os comandos são absolutos por página. O celular não tenta manipular DOM da TV.

### 5.2 Acompanhamento dos pedidos

Abaixo do controle da TV, mostrar grade mobile simples de pedidos **em preparo**.

Cada bloco deve priorizar leitura rápida:

- número do pedido;
- primeiro nome/display name do cliente;
- tom visual do estado atual (normal/próximo do limite/atrasado);
- indicador quando estiver retirado da TV.

Não repetir itens, pagamento, endereço ou detalhes extensos nessa grade.

Exemplo:

```text
#248
Fernanda Albuquerque
ATRASADO

#253
Hugo
EM PREPARO
```

### 5.3 Ação rápida

Ao tocar num pedido visível na TV:

- executar **Retirar da TV**;
- não abrir confirmação destrutiva;
- mostrar snackbar/feedback com **Desfazer**;
- mover o card para estado visual “Retirado da TV”.

Como a ação é reversível e não altera o pedido oficial, o fluxo deve ser rápido.

Um pedido retirado pode ser restaurado com:

- tocar novamente; ou
- ação explícita **Voltar para a TV**.

### 5.4 Pedidos agendados

A central pode mostrar “Agendados” em seção secundária futuramente, mas a V1 operacional deve focar **Em preparo**.

A retirada rápida da TV é oferecida somente para pedidos que já estão na fase operacional `preparing`.

## 6. Paginação da TV

A paginação não será “N pedidos fixos por página”.

A TV deve reutilizar o **mesmo solver best-fit** homologado na PR #79.

Novo contrato conceitual:

`buildKitchenDisplayPages(...)`

1. montar página 1 usando prioridade + packing atuais;
2. remover os IDs realmente exibidos;
3. montar página 2 com os restantes;
4. repetir até não haver pedidos restantes;
5. preservar a ordem relativa da fila em cada página;
6. nunca criar página vazia;
7. nunca aceitar clipping para aumentar contagem.

`buildKitchenDisplayPresentation(...)` permanece compatível como página 1 para não quebrar consumidores/testes atuais.

### 6.1 Indicador na TV

Quando houver mais de uma página, substituir/expandir o resumo de overflow com algo equivalente a:

- `Tela 1 de 2 · +4 na próxima`
- `Tela 2 de 2`

A TV não exibe botões navegáveis.

## 7. Comportamento de segurança operacional

### 7.1 Nova chegada

Se a TV estiver na página 2+ e surgir uma nova chegada operacional:

- tocar o alerta normal;
- voltar automaticamente para **Tela 1**;
- destacar o novo pedido;
- não reaplicar automaticamente o comando antigo sem uma nova revisão de controle.

Assim uma página secundária nunca esconde silenciosamente uma chegada nova.

### 7.2 Página deixa de existir

Se a fila encolher e a página atual ficar acima do total:

- fazer clamp para a última página válida;
- se só restar uma página, voltar para página 1.

### 7.3 Pareamento/reload da TV

Depois de reload/reinício:

- iniciar sempre na página 1;
- comandos antigos já aplicados não devem recolocar a TV em uma página secundária.

## 8. Estado e sincronização

A TV já consulta `GET /api/kitchen-tv/state` aproximadamente a cada 2 s.

A V1 deve reaproveitar esse polling; não há necessidade de WebSocket.

O payload da TV passa a incluir:

```js
control: {
  revision,
  requestedPage
}
```

A TV aplica um comando **somente quando `revision` muda**.

Isso resolve o caso “nova chegada força página 1”: o comando anterior continua com a mesma revisão e não é reaplicado.

## 9. Telemetria da TV

A TV deve reportar apenas quando o estado renderizado mudar de forma relevante, e opcionalmente com heartbeat lento.

Endpoint proposto:

`POST /api/kitchen-tv/report`

Payload mínimo:

```js
{
  appliedRevision,
  currentPage,
  pageCount,
  viewportWidth,
  viewportHeight,
  visibleOrderIds
}
```

A sessão restrita da TV pode enviar essa telemetria, mas **não pode**:

- retirar/restaurar pedidos;
- mudar página desejada;
- alterar status oficial.

A telemetria serve para o celular mostrar o que a TV realmente renderizou.

## 10. Persistência proposta

Nova migration: `0032_kitchen_tv_control.sql`.

### 10.1 `kitchen_tv_display_control`

Uma linha por negócio:

- `business_id` PK;
- `revision`;
- `requested_page`;
- `updated_at`;
- `reported_revision`;
- `reported_page`;
- `reported_page_count`;
- `reported_viewport_width`;
- `reported_viewport_height`;
- `reported_visible_order_ids_json`;
- `reported_at`.

Não colocar esses campos em `kitchen_tv_access`: autenticação/pareamento e controle operacional permanecem separados.

### 10.2 `kitchen_tv_hidden_orders`

Tabela de visibilidade TV-only:

- `business_id`;
- `order_id`;
- `hidden_at`;
- PK composta `(business_id, order_id)`.

Restaurar = remover a linha.

Esses registros não alteram `orders`.

## 11. Leitura da TV

`worker/kitchenTvReadRepository.js` deve continuar carregando apenas pedidos oficiais ativos, mas excluir pedidos presentes em `kitchen_tv_hidden_orders`.

A filtragem ocorre no servidor para que:

- pedido retirado não volte em refresh;
- duas TVs/sessões futuras vejam a mesma decisão operacional;
- a TV continue recebendo payload mínimo;
- o frontend TV não precise interpretar estado administrativo extra.

Pedidos terminalizados oficialmente já ficam fora pela regra existente, independentemente da tabela de ocultos.

## 12. APIs administrativas

Endpoints propostos:

### `GET /api/kitchen-tv/control`

Retorna:

- estado pareado;
- controle atual;
- última telemetria;
- IDs retirados da TV.

### `PATCH /api/kitchen-tv/control/page`

Body:

```json
{ "page": 1 }
```

Incrementa `revision` e persiste página desejada.

### `PUT /api/kitchen-tv/control/orders/:id/hidden`

Retira pedido da TV.

### `DELETE /api/kitchen-tv/control/orders/:id/hidden`

Restaura pedido na TV.

Todas as mutações administrativas:

- exigem sessão administrativa;
- exigem same-origin mutation protection;
- aplicam business scope no servidor;
- são idempotentes.

## 13. Permissões

Proposta de nova capacidade de ação:

`orders.kitchen.control`

Regras:

- `orders.view` permite abrir/ver a tela;
- `orders.kitchen.control` permite navegar TV e retirar/restaurar pedidos;
- `orders.finalize` continua exclusivo para a finalização oficial;
- `orders.settings.manage` continua exclusivo para parear/revogar TV.

Sessões legadas autenticadas recebem a nova capacidade pelo adaptador legado para preservar compatibilidade.

Essa separação evita conceder permissão de finalização oficial só para operar a TV.

## 14. Arquitetura frontend administrativo

Nova superfície sugerida:

`src/app/surfaces/kitchen-tv-control/`

Arquivos iniciais:

- `KitchenTvControlSurface.jsx`;
- `kitchenTvControlApi.js`;
- `kitchenTvControl.css`;
- testes focados.

A superfície pode consumir:

- `orders`, `now`, `currentTiming` já disponíveis no App;
- `buildKitchenQueueModel` do domínio Orders;
- API própria apenas para controle/visibilidade TV.

Não criar segundo polling de todos os pedidos se a coleção oficial já está no App.

## 15. Arquitetura frontend TV

Evoluir:

- `kitchenDisplayPresentation.js`: builder de páginas;
- `KitchenDisplayApp.jsx`: `currentPage`, revisão aplicada, auto-return em chegada;
- `KitchenDisplayBoard.jsx`: render da página selecionada;
- `kitchenDisplayApi.js`: relatório de telemetria.

A lógica de layout continua centralizada; não duplicar packing no Worker nem no celular.

## 16. Concorrência

Duas pessoas podem abrir o controle ao mesmo tempo.

Regra V1:

- navegação: **last write wins** por `revision`;
- ocultar/restaurar: operações idempotentes;
- o celular atualiza estado de controle periodicamente;
- nenhuma dessas ações altera o pedido oficial.

Não implementar lock de operador.

## 17. Falhas e offline

### Celular offline

- controles ficam desabilitados;
- lista oficial mantém o comportamento existente do App;
- nenhuma ação é enfileirada localmente.

### TV offline

- celular mostra última telemetria conhecida;
- comando de página pode ficar persistido no servidor;
- ao voltar, a TV inicia em página 1 e só aplica revisões novas emitidas após a sessão iniciar.

### TV revogada

- controle de navegação fica indisponível;
- esconder/restaurar pedidos pode ser bloqueado enquanto não houver TV pareada, para evitar estado invisível sem painel ativo.

## 18. Entrada de navegação

Adicionar destino:

- id: `kitchen-tv-control`;
- path: `/pedidos/controle-da-tv`;
- area: `orders`;
- label: `Controle da TV`;
- capability de leitura: `orders.view`.

Adicionar ao subnav de Pedidos depois de Cozinha e Histórico.

Em Configurações → TV da Cozinha, quando pareada, mostrar CTA:

**Abrir controle da TV**

## 19. Critérios de aceite

A V1 está aceita quando:

1. celular mostra página atual e total real reportado pela TV;
2. Anterior/Início/Próxima alteram a TV em até o próximo ciclo de polling;
3. TV nunca precisa de interação direta;
4. páginas usam o mesmo best-fit homologado;
5. nova chegada em página secundária volta TV para página 1;
6. pedido em preparo pode ser retirado da TV;
7. retirar não altera status, `finished_at`, pagamento, impressão ou histórico;
8. pedido retirado continua em Pedidos → Cozinha;
9. pedido retirado pode ser restaurado;
10. pedido oficialmente finalizado/cancelado some naturalmente de TV e controle;
11. controller mostra cards simples com número + cliente + estado;
12. duas sessões de celular não corrompem controle;
13. sessão TV continua incapaz de executar mutações administrativas/oficiais;
14. paginação e ocultação são business-scoped;
15. staging é homologado em celular real + TV real antes de merge;
16. produção exige autorização separada.

## 20. Sequenciamento sugerido

Depois da aprovação desta spec:

1. escrever plano TDD detalhado;
2. migration + repository de controle;
3. endpoints administrativos + permissão;
4. filtro TV-only de pedidos retirados;
5. paginação multi-page no solver;
6. controle remoto/revisão na TV;
7. telemetria;
8. nova superfície mobile;
9. integração de navegação/Settings;
10. gates completos;
11. staging + homologação TV/celular;
12. merge separado de produção.

## 21. Decisões de produto a aprovar

Antes de implementar, confirmar explicitamente:

1. nome da tela: **Controle da TV**;
2. ação rápida: **Retirar da TV** em vez de “Finalizar”, para não confundir lifecycle oficial;
3. rota operacional dentro de **Pedidos**, com atalho em Configurações;
4. nova capacidade `orders.kitchen.control`;
5. nova chegada sempre força a TV para a primeira página;
6. pedidos retirados ficam restauráveis enquanto continuarem oficialmente ativos.
