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

- prioridade;
- scheduled protegido;
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
12. agendado protegido;
13. mistura de atrasados/em preparo/agendados;
14. fullscreen e fora de fullscreen;
15. confirmar nenhum clipping.

Parar antes de merge e produção.
