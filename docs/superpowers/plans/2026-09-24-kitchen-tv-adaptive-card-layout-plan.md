# Kitchen TV — Adaptive large-card layout — Implementation Plan

**Data:** 24/09/2026  
**Branch:** `feature/kitchen-tv-adaptive-card-layout`  
**Base:** `master@f7103fc65793396fb852320c696700d4283e4571`  
**Escopo:** corrigir clipping de pedidos grandes na Kitchen TV sem paginação, sem rotação automática e sem mudar o fluxo operacional.

## 1. Problema confirmado no código atual

A Kitchen TV usa:

- grid fixo `3 × 2`;
- até 6 cards;
- `overflow: hidden` no board e nos cards;
- densidade de conteúdo já adaptativa:
  - comfortable;
  - compact;
  - dense;
- itens acima de 4 linhas já usam duas colunas;
- pedidos grandes continuam mantendo todos os itens no DOM.

O clipping ocorre porque a densidade reduz fonte/espaço, mas o card continua limitado a **uma única célula de altura**.

Isso explica o comportamento observado: em fullscreen o mesmo pedido pode caber; fora de fullscreen, a altura útil menor pode esconder as últimas linhas.

## 2. Direção aprovada

Trocar o conceito de “6 pedidos fixos” por **6 slots visuais**.

Cada card passa a consumir:

- pedido normal = **1 slot**;
- pedido grande = **2 slots verticais**.

Um card de 2 slots ocupa uma coluna inteira do grid, equivalente às duas células verticais.

Exemplos:

- 6 pedidos normais → 6 cards;
- 1 grande + 4 normais → 5 cards;
- 2 grandes + 2 normais → 4 cards;
- 3 grandes → 3 cards.

Isso generaliza a ideia aprovada e também resolve o caso em que existam dois pedidos grandes simultaneamente.

## 3. O que define “pedido grande”

Reutilizar a regra já existente de densidade de conteúdo.

Hoje `KitchenDisplayCard.jsx` calcula aproximadamente:

- linhas de nome por tamanho do texto;
- linhas adicionais por observação;
- quantidade total de itens.

Regra inicial:

- `comfortable` → 1 slot;
- `compact` → 1 slot;
- `dense` → candidato a 2 slots.

A implementação deve extrair esse cálculo para uma função pura compartilhada entre:

- apresentação/layout;
- card.

Não duplicar threshold em dois arquivos.

### Refinamento por viewport

O comportamento deve considerar a altura útil real.

Em viewport reduzida, um conteúdo que normalmente seria apenas `compact` poderá ser promovido para expandido.

A V1 pode usar uma regra simples e estável baseada em:

- `window.innerHeight`;
- score/visualLines já calculado.

Não adicionar dependência externa.

Não depender apenas de `document.fullscreenElement`, porque o objetivo é adaptar à área disponível e não ao estado formal da Fullscreen API.

## 4. Modelo de layout

Criar uma pure function, por exemplo:

`buildKitchenDisplayLayout(cards, options)`

Entrada:

- cards já ordenados pela fila;
- densidade/content weight de cada card;
- viewport profile;
- presença de scheduled.

Saída por card:

- `layoutSize: 'normal' | 'tall'`;
- posição visual determinística;
- slotCost 1 ou 2.

A capacidade total é sempre:

`6 slots`.

## 5. Preservação de prioridade

A mudança de tamanho **não pode alterar a seleção operacional da fila**.

A ordem base continua vindo de `buildKitchenQueueModel`.

Regras:

1. selecionar por prioridade atual;
2. consumir slots na ordem operacional;
3. quando os 6 slots acabarem, os demais entram no `overflow`;
4. conteúdo grande nunca ganha prioridade apenas por ser grande;
5. conteúdo grande pode consumir o espaço que seria usado por um pedido de prioridade inferior.

Exemplo:

```text
P1 grande = 2 slots
P2 normal = 1
P3 normal = 1
P4 normal = 1
P5 normal = 1
total = 6
P6 → fora da tela
```

Resultado: 5 pedidos visíveis.

## 6. Scheduled

Preservar a regra atual de manter visibilidade para scheduled quando existir.

Hoje:

- até 5 preparing;
- 1 slot reservado ao primeiro scheduled;
- scheduled adicionais preenchem espaços livres.

Com slot weight:

- o primeiro scheduled continua protegido;
- se for necessário liberar espaço por causa de um card tall, remover primeiro o preparing de menor prioridade entre os candidatos;
- scheduled adicional não protegido pode ser removido antes do primeiro scheduled;
- o contador do header continua mostrando a fila completa.

Essa regra terá testes próprios para evitar regressão silenciosa.

## 7. Renderização

O board continuará visualmente com 3 colunas × 2 linhas.

Novo estado CSS:

`kds-card--tall`

Card tall:

- ocupa duas linhas;
- mantém largura de uma coluna;
- usa o mesmo status/color system;
- continua com itens em duas colunas quando necessário;
- pode usar fonte `dense`, mas ganha altura antes de reduzir ainda mais a legibilidade.

Não criar scroll interno.

## 8. Posicionamento determinístico

Não confiar apenas em `grid-row: span 2` com auto-placement, pois um tall card colocado tarde pode gerar terceira linha implícita.

O layout deve devolver posição explícita:

- grid-column;
- grid-row;
- row-span.

O DOM pode continuar na ordem lógica da fila, enquanto a posição visual é definida pelo layout calculado.

A seleção de pedidos não muda por causa da posição.

## 9. Múltiplos pedidos grandes

A V1 deve suportar até 3 tall cards simultâneos, um por coluna.

Isto é importante porque o exemplo real enviado contém dois pedidos grandes ao mesmo tempo.

Não limitar artificialmente a apenas um tall card.

## 10. Fallback para pedido extremo

Mesmo um card de duas alturas pode receber conteúdo anormalmente grande.

A prioridade é nunca cortar silenciosamente.

Primeiro:

- tall;
- duas colunas;
- dense spacing.

Se ainda exceder a capacidade homologada, criar fallback explícito apenas para caso extremo:

`+ N itens não exibidos`

Esse fallback deve:

- ser visualmente forte;
- manter os primeiros itens na ordem original;
- contar corretamente os ocultos;
- nunca esconder conteúdo sem indicador.

A meta de homologação é que pedidos realistas de até aproximadamente 12–16 linhas/observações caibam no tall sem fallback.

## 11. Fullscreen e modo reduzido

Fullscreen continua recomendado, mas não obrigatório.

A mesma TV deve se reorganizar quando:

- entra em fullscreen;
- sai de fullscreen;
- viewport muda;
- browser chrome altera altura útil;
- resolução muda.

Usar listener de `resize` simples.

Evitar solução dependente de API moderna não suportada pelo target legado.

## 12. Botão “Entrar em tela cheia”

Hoje ele é `position: fixed` no canto inferior esquerdo.

Um tall card pode ocupar a área de baixo.

Nesta task, garantir que o botão nunca cubra card:

- preferencialmente mover a ação para uma área segura do header/shell quando o painel está live; ou
- reservar uma safe-area consistente.

Não deixar overlay sobre conteúdo.

A solução visual deve ser discreta porque o botão é secundário ao conteúdo de produção.

## 13. TDD — Task 1: extrair content metrics

### RED

Adicionar testes para uma função pura que classifique:

- 3 itens curtos → normal;
- 5 itens médios → compact;
- 8+ itens → dense/tall;
- 6 itens com nomes longos → dense/tall;
- várias observações → dense/tall.

### GREEN

Extrair de `KitchenDisplayCard.jsx`:

- item display name;
- note normalization;
- visualLines/content score;
- density/layout demand.

Card e presentation usam a mesma regra.

## 14. TDD — Task 2: packing de slots

### RED

Cobrir:

- 6 normais → 6;
- 1 tall + 4 normais → 5;
- 2 tall + 2 normais → 4;
- 3 tall → 3;
- overflow correto;
- prioridade preservada;
- tall nunca promove pedido inferior.

### GREEN

Adicionar layout model puro.

Nenhum CSS ainda.

## 15. TDD — Task 3: scheduled + slot budget

### RED

Cobrir:

- 5 preparing normais + 1 scheduled → 6;
- 1 preparing tall + scheduled → scheduled continua visível;
- múltiplos scheduled;
- overflow global continua correto;
- counters continuam completos.

### GREEN

Integrar slot budget a `buildKitchenDisplayPresentation`.

## 16. TDD — Task 4: board/render

### RED

Testes do board:

- classes tall;
- posições explícitas;
- nenhum terceiro row implícito;
- número de cards varia conforme slot consumption;
- overflow textual correto.

### GREEN

Atualizar:

- `KitchenDisplayBoard.jsx`;
- `KitchenDisplayCard.jsx`;
- `kitchen-display.css`.

## 17. TDD — Task 5: viewport adaptation

### RED

Cobrir perfis:

- viewport amplo;
- 720p;
- altura reduzida semelhante ao navegador fora de fullscreen.

O mesmo conteúdo pode:

- normal em viewport amplo;
- tall em viewport reduzido.

### GREEN

Adicionar pequeno hook/helper local para viewport profile.

Sem polling novo.

Sem dependência.

## 18. TDD — Task 6: fullscreen control safe-area

### RED

Contrato CSS/DOM prova que a ação de fullscreen não fica sobre a região do grid.

### GREEN

Reposicionar a ação em área segura.

## 19. Regressões obrigatórias

Continuam verdes:

- Kitchen TV pairing;
- Kitchen TV session;
- Kitchen TV read-only boundary;
- Kitchen TV Chrome69 build target;
- áudio configurável da PR #69;
- start/fullscreen;
- arrival/highlight;
- scheduled timing;
- offline/stale snapshot;
- admin Cozinha;
- architecture;
- lint;
- build;
- Worker dry-runs;
- D1.

## 20. Homologação staging

Testar em navegador e TV:

1. 6 pedidos pequenos;
2. 1 grande + 4 pequenos;
3. 2 grandes simultâneos;
4. 3 grandes;
5. grande com observações;
6. grande com nomes longos;
7. scheduled + tall;
8. overflow correto;
9. janela normal;
10. fullscreen;
11. alternar fullscreen e voltar;
12. 720p;
13. 1080p;
14. botão fullscreen sem sobreposição;
15. nenhum scroll;
16. nenhum item cortado silenciosamente;
17. Samsung UN32T4300AG / Tizen legado;
18. alerta sonoro configurável continua funcional.

## 21. Arquivos previstos

Modificar:

- `src/kitchen-display/KitchenDisplayBoard.jsx`
- `src/kitchen-display/KitchenDisplayBoard.test.js`
- `src/kitchen-display/KitchenDisplayCard.jsx`
- `src/kitchen-display/KitchenDisplayCard.test.js`
- `src/kitchen-display/kitchenDisplayPresentation.js`
- `src/kitchen-display/kitchenDisplayPresentation.test.js`
- `src/kitchen-display/kitchen-display.css`

Criar, se a extração se mantiver útil:

- `src/kitchen-display/kitchenDisplayContentLayout.js`
- `src/kitchen-display/kitchenDisplayContentLayout.test.js`

Não tocar:

- D1;
- Worker API;
- auth/pairing;
- Orders lifecycle;
- printing;
- finance.

## 22. Gates

Ordem:

1. RED Task 1;
2. GREEN Task 1;
3. RED/GREEN Task 2;
4. RED/GREEN Task 3;
5. RED/GREEN Task 4;
6. RED/GREEN Task 5;
7. RED/GREEN Task 6;
8. focused tests;
9. suite completa;
10. architecture;
11. lint;
12. build;
13. Worker production/staging dry-run;
14. staging;
15. homologação manual;
16. merge somente com autorização explícita;
17. produção somente com autorização separada.

## 23. Restrições

- sem paginação;
- sem auto-rotação;
- sem scroll no board;
- sem interação obrigatória;
- sem mudança de prioridade de negócio;
- sem migration;
- sem backend novo;
- sem nova dependência;
- não reduzir fonte indefinidamente para “fazer caber”;
- não cortar conteúdo silenciosamente.

## 24. Próximo passo

Com este plano aprovado, iniciar pela **Task 1 — RED de content metrics/layout demand**.

A criação deste plano não autoriza merge nem deploy de produção.
