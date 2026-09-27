# Kitchen TV — densidade dinâmica — Implementation Plan

**Data:** 2026-09-27  
**Spec:** `docs/superpowers/specs/2026-09-27-kitchen-tv-dynamic-density-design.md`  
**Branch:** `feature/kitchen-tv-dynamic-density`  
**Base:** `master@f624f0c74e0c82965e9d024b7a2ac0ee506ec7ff`  
**Fluxo:** TDD, staging antes de merge, produção separada.

## 1. Estratégia

Evoluir o layout adaptativo já existente em vez de reescrever a Kitchen TV.

Hoje:

- `KITCHEN_TV_SLOT_LIMIT = 6`;
- grid CSS 3×2;
- cards normal/tall;
- viewport tracking apenas por altura.

Novo modelo:

- resolver perfil de board: `focus | balanced | compact`;
- perfil define `columns`, `rows`, capacidade e densidade;
- content metrics passam a considerar o perfil;
- cards podem usar rowSpan 1/2/3;
- packing e posicionamento funcionam com grid variável;
- Board recebe o perfil e expõe classe/data attribute para CSS.

## 2. Task 1 — RED: resolver perfil de board

### Arquivos

Modificar:

- `src/kitchen-display/kitchenDisplayContentLayout.test.js`.

### Casos

Criar testes para função pura conceitual:

```js
resolveKitchenBoardProfile({
  viewportWidth,
  viewportHeight,
  queueSize,
})
```

Cobrir:

- 1920×1080, 4 pedidos → focus / 3×2;
- 1920×1080, 8 pedidos → balanced / 4×2;
- 1920×1080, 10 pedidos → compact / 4×3;
- 1640×924, 10 pedidos → compact / 4×3;
- 1366×768, 10 pedidos → balanced / 4×2;
- viewport reduzido → focus/balanced;
- valores ausentes usam fallback seguro.

Esperado RED: função inexistente.

## 3. Task 2 — GREEN: perfil + viewport width

### Arquivos

Modificar:

- `src/kitchen-display/kitchenDisplayContentLayout.js`;
- `src/kitchen-display/KitchenDisplayApp.jsx`;
- testes correspondentes.

Implementar perfil puro.

`KitchenDisplayApp` passa a acompanhar:

- width;
- height.

Preferir objeto único de viewport para evitar estados divergentes.

Manter compatibilidade com browsers alvo.

## 4. Task 3 — RED/GREEN: content metrics dependentes do perfil

Hoje a capacidade de linhas depende principalmente da altura global.

Alterar para que o cálculo conheça o perfil do board.

Cobrir:

- pedido de 1–3 itens continua rowSpan 1 em compact;
- pedido médio pode pedir rowSpan 2 em compact;
- mesmo pedido pode ser rowSpan 1 em focus e 2 em compact;
- pedido extremo pode pedir rowSpan 3 em compact;
- duas colunas são tentadas antes de aumentar rowSpan;
- não exceder rows do perfil.

Manter API de compatibilidade quando perfil não for informado.

## 5. Task 4 — RED/GREEN: packing genérico

Generalizar:

- `packKitchenDisplaySlots`;
- `positionKitchenDisplayGrid`.

Novo contrato conceitual:

```js
packKitchenDisplayGrid(entries, {
  profile,
  viewportWidth,
  viewportHeight,
})
```

Pode manter wrappers antigos para reduzir diff se isso ajudar testes existentes.

Cobrir:

- 6 cards focus;
- 8 cards balanced;
- 12 cards compact;
- 10 cards compact;
- tall/rowSpan2;
- full/rowSpan3;
- sem terceira/quarta linha implícita;
- não pular prioridade;
- overflow correto;
- posição sempre dentro da matriz.

## 6. Task 5 — scheduled

Atualizar a alocação de `kitchenDisplayPresentation.js`.

Preservar:

- primeiro scheduled protegido;
- preparing priorizados pela fila;
- scheduled adicionais só entram em espaço realmente livre.

Os limites deixam de ser constantes 6/5 e passam a derivar do perfil.

Testes:

- focus 5 preparing + 1 scheduled;
- balanced 7 preparing + 1 scheduled;
- compact 11 preparing + 1 scheduled;
- scheduled grande;
- preparing grande + scheduled protegido;
- overflow completo.

## 7. Task 6 — Board/render

Modificar:

- `KitchenDisplayBoard.jsx`;
- `KitchenDisplayCard.jsx`;
- `kitchen-display.css`.

Board:

- `data-layout-profile="focus|balanced|compact"`;
- CSS vars opcionais para columns/rows;
- sem implicit rows.

Card:

- data row span;
- classes para tall/full se necessário;
- manter estados e conteúdo.

## 8. Task 7 — CSS de densidade

### Focus

Manter aparência atual o mais próximo possível.

### Balanced

- 4 colunas × 2 linhas;
- header um pouco menor;
- padding/gap moderadamente reduzidos;
- itens permanecem legíveis.

### Compact

- 4 colunas × 3 linhas;
- header compacto;
- card chrome mais enxuto;
- status/timing/cliente ainda fortes;
- itens não menores que o necessário para leitura em TV.

Não esconder informações funcionais apenas para atingir 12.

## 9. Task 8 — viewport e fullscreen regressions

Testar:

- resize;
- fullscreen;
- recovery toolbar;
- effective board height;
- mudança de perfil sem recarregar a página.

## 10. Task 9 — regressões Kitchen TV

Rodar focados:

```bash
node --test src/kitchen-display/*.test.js
```

Preservar:

- pairing;
- session;
- read-only boundary;
- audio;
- arrivals;
- timing;
- stale;
- fullscreen;
- legacy compatibility;
- entry isolation.

## 11. Task 10 — full gates

```bash
npm test
npm run test:architecture
npm run lint
npm run build
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

Sem migration.

## 12. Task 11 — staging + QA manual

Homologar pelo menos:

1. 2 pedidos de 1 item;
2. 6 pedidos pequenos;
3. 7 pedidos pequenos;
4. 8 pedidos pequenos;
5. 10 pedidos pequenos;
6. 12 pedidos pequenos;
7. 10 pedidos com 1 grande;
8. 8 pedidos com 2 grandes;
9. pedido extremo;
10. scheduled em focus;
11. scheduled em balanced;
12. scheduled em compact;
13. 1920×1080;
14. referência aproximada 1640×924;
15. 1366×768;
16. janela fora de fullscreen;
17. fullscreen;
18. sair e reentrar em fullscreen;
19. nenhum item cortado;
20. nenhum scroll;
21. overflow correto;
22. áudio;
23. pairing/session;
24. Tizen/TV legado quando disponível.

Registrar QA em:

`docs/superpowers/qa/kitchen-tv-dynamic-density-qa.md`.

## 13. Stop gate

Depois da homologação:

- atualizar PR e QA;
- não mergear sem autorização explícita;
- não publicar produção.

## 14. Arquivos previstos

Modificar:

- `src/kitchen-display/KitchenDisplayApp.jsx`
- `src/kitchen-display/KitchenDisplayBoard.jsx`
- `src/kitchen-display/KitchenDisplayCard.jsx`
- `src/kitchen-display/kitchenDisplayContentLayout.js`
- `src/kitchen-display/kitchenDisplayPresentation.js`
- `src/kitchen-display/kitchen-display.css`
- testes associados

Criar:

- Spec desta feature;
- este plano;
- QA ao final.

Não tocar:

- migrations;
- Worker API;
- auth/pairing semantics;
- Orders lifecycle;
- Finance;
- Printing.

## 15. Regra de decisão

Se, durante a implementação, atingir 10–12 cards exigir fonte considerada pequena na homologação, reduzir a densidade antes de reduzir a legibilidade.

O objetivo é densidade inteligente, não uma meta rígida de 12 a qualquer custo.

## 16. Iteração pós-homologação — micro-grid vertical + tipografia

A homologação com 9 pedidos confirmou que 4 colunas funcionam, mas mostrou excesso de altura em cards curtos.

Implementar:

1. `focus`: 6 trilhas internas, card curto = 3;
2. `balanced`: 8 trilhas internas, card curto = 4;
3. `compact`: 12 trilhas internas, card curto = 3;
4. spans maiores derivados de content metrics;
5. packing com ocupação explícita e backtracking para evitar fragmentação que esconda o scheduled protegido;
6. preenchimento por prioridade, sem pular pedido superior;
7. fonte de itens +~1 px nos perfis de 4 colunas;
8. fonte de observações +~1 px;
9. gaps verticais próprios para a micro-grid;
10. testes para 16 pedidos de 1 item, mistura de alturas, scheduled protegido e ausência de linhas implícitas.

Critério visual principal: cards de 1–2 itens devem terminar pouco depois do conteúdo, deixando a área restante disponível para outros cards, sem diminuir a fonte.

## 17. Refinamento final — micro-card de 1 item

Adicionar RED/GREEN específico para o último polish visual aprovado:

RED:

- compact + 1 item curto + sem observação → `gridSpan = 2`;
- compact + 1 item + observação → `gridSpan = 3`;
- compact + 1 nome que quebra linha → `gridSpan = 3`;
- 16 pedidos micro continuam cabendo com folga sem reduzir tipografia.

GREEN:

- derivar a decisão das métricas reais de conteúdo;
- não usar apenas `itemCount === 1`;
- não alterar fonte/peso/line-height do item;
- manter packing, scheduled protegido, overflow e prioridade.

Homologar novamente no cenário real de 9 pedidos usado nos prints anteriores.


## 18. Último polish — 16 trilhas e nano-card estrutural

Motivação: a homologação com fila mista ainda mostrou altura sobrando em alguns cards de 1 item simples.

Implementação:

1. aumentar `compact.gridRows` de 12 para 16;
2. aumentar o budget do perfil para 64 trilhas-coluna;
3. manter nano-card simples em 2 trilhas;
4. 1 item com nota/nome quebrado passa a 4 trilhas;
5. 2 itens curtos usam 3 trilhas;
6. conteúdo normal usa 4–5 trilhas;
7. tall/full escalam para 8/12–16;
8. adicionar CSS específico para `data-grid-span="2"` reduzindo apenas padding/min-height/margens;
9. manter o tamanho de fonte de item e observação já aprovado;
10. scheduled simples herda a mesma regra de nano-card.

TDD:

- RED para `gridRows = 16`, `maxSlots = 64`, nota/nome quebrado = 4;
- RED para contrato CSS de nano-card;
- GREEN de layout/content metrics;
- GREEN de CSS;
- regressões de packing, scheduled protegido, prioridade e overflow;
- full Validate;
- staging;
- homologação visual no mesmo cenário de 15–16 pedidos.
