# Kitchen TV — best-fit layout — Implementation Plan

**Data:** 2026-09-28  
**Spec:** `docs/superpowers/specs/2026-09-28-kitchen-tv-best-fit-layout-design.md`  
**Branch:** `feature/kitchen-tv-best-fit-layout`  
**Base:** `master@5a557476f1cbc2f6d75d3c93f6799e8ed8f16641`

## Task 1 — RED: candidatos e escolha best-fit

Adicionar testes para:

- lista de perfis disponíveis por viewport;
- 6 pedidos simples → `focus`;
- 7 pedidos simples → `roomy` em 3 colunas;
- 8/9 curtos → `roomy` se couber;
- conteúdo maior que não cabe em 3 colunas → `balanced`;
- fila maior → `compact`;
- nenhum perfil comporta tudo → menor overflow;
- empate → perfil menos denso.

## Task 2 — GREEN: perfil `roomy` + seleção por packing

- adicionar perfil `roomy`;
- remover decisão de apresentação baseada apenas em `queueSize`;
- fatorar `allocateForProfile`;
- simular todos os candidatos disponíveis;
- escolher conforme Spec.

## Task 3 — RED/GREEN: piso anti-clipping

Testes:

- card de 1 item simples em compact usa span seguro;
- nota ou wrap adiciona espaço;
- roomy/focus têm pisos maiores pela tipografia/chrome;
- nenhum gridSpan ultrapassa `gridRows`.

Implementar margem vertical de segurança sem reduzir fonte.

## Task 4 — CSS do roomy e contratos do board

- `data-layout-profile="roomy"`;
- 3 colunas;
- grid vertical granular;
- header/padding entre focus e balanced;
- manter tipografia mais confortável que 4 colunas.

## Task 5 — regressões

Preservar:

- prioridade: na escolha entre perfis, preservar primeiro o maior prefixo contínuo da fila `preparing`; só depois maximizar a quantidade total visível;
- backfill seguro: depois de uma lacuna inevitável, um pedido em preparo que não cabe permanece no overflow, mas não bloqueia pedidos posteriores menores que ainda caibam; a ordem relativa dos exibidos é preservada;
- prioridade de preparo: pedidos ainda aguardando em `scheduled` só ocupam espaço se toda a fila `preparing` já couber;
- counters completos;
- overflow;
- fullscreen/recovery;
- no-scroll;
- pairing/session/audio;
- legacy compatibility.

## Task 6 — full gates

- `npm test`
- `npm run test:architecture`
- `npm run lint`
- `npm run build`
- Worker production/staging dry-run
- D1 local gates

Sem migrations.

## Task 7 — staging + QA

Testar em staging e TV real:

1. 4 pedidos;
2. 6 pedidos;
3. 7 pedidos;
4. 8 pedidos;
5. 9 pedidos;
6. 10–12 pedidos;
7. 1 item simples;
8. 1 item com observação;
9. item com nome longo;
10. 4+ itens;
11. pedido grande;
12. agendado aguardando não desloca pedido já em preparo; ao entrar na janela de preparo, passa à prioridade normal;
13. mistura de atrasados/em preparo/agendados;
14. fullscreen e fora de fullscreen;
15. confirmar nenhum clipping.

Parar antes de merge e produção.


## Task 8 — correção de clipping em TV real

Evidência: staging em TV Toshiba/Regza mostrou 16 cards, porém vários conteúdos cortados verticalmente.

RED:

- `960×540 + compact + 1 item simples` exige span >= 6;
- `960×540 + compact + observação` exige span >= 8;
- card médio em 960×540 não usa duas colunas internas estreitas;
- largura legacy precisa produzir estratégia/altura mais conservadora que desktop;
- fila de 16 itens simples continua cabendo quando cada card usa 6/24 trilhas;
- fila mista pode gerar overflow, mas nenhum card pode ser subdimensionado.

GREEN:

1. propagar `viewportWidth` até `getKitchenCardContentMetrics`;
2. estimar largura útil por perfil;
3. limitar duas colunas internas a card com largura estimada >= 340px;
4. tornar os limites de caracteres por linha conservadores quando a coluna interna estreitar;
5. aplicar pisos de span por `viewportProfile`:
   - spacious: comportamento aprovado no desktop;
   - standard: margem intermediária;
   - constrained: piso 6 para simples, 8 para simples com nota e fórmula proporcional mais conservadora para os demais;
6. preservar fonte;
7. validar novamente em TV real com a mesma fila que reproduziu o clipping.

Stop gate: não mergear até o mesmo aparelho real passar sem corte.
