# Kitchen TV / KDS — implementação e matriz de homologação

Data de preparação: 2026-09-22
Branch: `feature/kitchen-tv-display-v2`
PR: #62 (`DRAFT`)
Spec: `docs/superpowers/specs/2026-09-22-kitchen-tv-display-design.md`
Plano: `docs/superpowers/plans/2026-09-22-kitchen-tv-display-plan.md`
Referência visual aprovada: `docs/superpowers/references/kitchen-tv-32-approved-reference.jpg`
SHA executável local antes do fechamento documental: `42d2d73`
Migration: `0028_kitchen_tv_access.sql`

## Escopo desta entrega

A implementação entrega uma superfície pública pareada em `/cozinha-tv`, somente leitura, com cookie próprio e revogável, payload mínimo por negócio, entrada frontend separada, polling visível a cada 2 s, relógio local a cada 1 s, comportamento offline, alerta sonoro, tentativa de fullscreen e quadro KDS 3×2 de no máximo seis cards.

O handoff de 2026-09-22 substitui a homologação de staging prevista originalmente: esta execução prepara o candidato e aguarda o `Validate application`, mas não publica staging e não converte observações de browser/TV em PASS.

## Evidência automatizada por tarefa

| Task | RED | GREEN / evidência focada |
|---:|---|---|
| 1 | `bde5777` | `eb58253`; 19/19 e arquitetura PASS; referência exata SHA-256 `c25ae0712931260a49e903ad5833861e2237a230b14d5e8a2cfa90a6da43d801` |
| 2 | `c2bc79d` | `5fe3b03`; 6/6 e migration local PASS |
| 3 | `834d877` | `20506f1`; 12/12, incluindo regressão da auth administrativa |
| 4 | `ce40fd2` | `872af31`; 21/21, projeção mínima e timing vigente |
| 5 | `f022395` | `5719a9b`; 18/18, rotas HTTP e isolamento de sessão |
| 6 | `b941c5f` | `ed8a6c4`; 28/28, Settings/capabilities |
| 7 | `50c4b82` | `426dda1`; 2/2, arquitetura e build |
| 8 | `fa9e507` | `af8f89c`; 19/19, sessão ao vivo/offline/áudio/fullscreen |
| 9 | `d9b359d` | `61c3bdc`; 13/13, lint e build |
| 10 | `ec037bc` | `42d2d73`; regressão focada, arquitetura, lint e build PASS |
| 11 | n/a | Gates finais locais e GitHub Validate são registrados no relatório final da execução e no PR #62. |
| 12 | n/a | Este registro e a matriz manual foram preparados; nenhuma observação manual foi inferida. |

## Gate local final

- `npm test`: PASS, 2147/2147;
- `npm run test:architecture`: PASS;
- `npm run lint`: PASS (avisos existentes, sem erro);
- `npm run build`: PASS;
- Wrangler 4.128.0 `deploy --dry-run`: PASS para o ambiente padrão e staging, sem deploy;
- migrations D1 locais: PASS, nenhuma migração pendente;
- gate Spec B D1: PASS, 9/9 checks, preservação de linhas/referências e instalação limpa sobre 28 migrações.

## Bundle e fronteiras

Build medido após a Task 10:

| Artefato | Minificado | gzip |
|---|---:|---:|
| `KitchenDisplayRoot` JS | 10.93 kB | 4.16 kB |
| `kitchenQueue` público/puro JS | 20.76 kB | 7.00 kB |
| Kitchen TV CSS | 6.56 kB | 2.07 kB |

O teste `kitchenDisplayBoundary.test.js` constrói o aplicativo em diretório temporário e percorre o manifest da entrada TV. O grafo rejeita `AdminBootstrap`, UI interna de Orders, Printing/QZ, jsPDF, Finance, Customers, Catalog UI, Table Service UI e Settings. O cliente HTTP da TV contém somente `/api/kitchen-tv/pair` e `/api/kitchen-tv/state`; `/api/bootstrap` é proibido por teste de fonte e pelo verificador de arquitetura.

## Matriz manual de staging

`PENDING-MANUAL` significa que a implementação automatizada existe, mas depende de observação humana no staging oficial. Nenhuma linha abaixo foi executada por Codex.

| # | Cenário | Status | Evidência necessária |
|---:|---|---|---|
| 1 | Settings exibe “TV da Cozinha” com capability de visualização | PENDING-MANUAL | Browser autenticado em staging |
| 2 | Acesso somente leitura vê estado e não vê ações de gerar/revogar | PENDING-MANUAL | Identidade restrita real |
| 3 | Gerar acesso produz link com `#token=` e aviso de expiração/uso único | PENDING-MANUAL | Browser + DevTools |
| 4 | Copiar link funciona | PENDING-MANUAL | Clipboard real do browser |
| 5 | Primeiro browser pareia; fragmento desaparece; refresh permanece pareado | PENDING-MANUAL | Pairing real em browser |
| 6 | Segundo browser não reutiliza o link consumido | PENDING-MANUAL | Dois perfis/browsers |
| 7 | Admin mostra pareamento e atualização de último uso | PENDING-MANUAL | Browser + espera operacional |
| 8 | Revogação confirma, limpa pedidos na TV e mostra não autorizado | PENDING-MANUAL | Revogação visual real |
| 9 | Novo acesso invalida a sessão anterior | PENDING-MANUAL | Dois ciclos de acesso |
| 10 | Network inicial da TV não chama `/api/bootstrap` nem APIs administrativas | PENDING-MANUAL | DevTools Network real |
| 11 | Network inicial não baixa chunks de Admin/QZ/jsPDF | PENDING-MANUAL | DevTools Network real |
| 12 | Pedido imediato aparece dentro da cadência de polling | PENDING-MANUAL | Staging com pedido controlado |
| 13 | Agendado permanece agendado e cruza a janela de preparo no timing vigente | PENDING-MANUAL | Staging em horário controlado |
| 14 | Finalizado/cancelado desaparece no refresh seguinte | PENDING-MANUAL | Staging com pedido controlado |
| 15 | Chegada destaca por aproximadamente 2,6 s e alerta uma vez; fila inicial não alerta em massa | PENDING-MANUAL | Áudio liberado por gesto |
| 16 | Offline preserva snapshot com aviso; reconnect atualiza imediatamente | PENDING-MANUAL | Offline/reconnect real |
| 17 | Fullscreen/kiosk é solicitado e recusa não bloqueia o painel | PENDING-MANUAL | Browser fullscreen/kiosk |
| 18 | 1920×1080: grade 3×2, seis cards, hierarquia, cores, header e nenhum scroll | PENDING-MANUAL | Comparação lado a lado com referência |
| 19 | 1280×720: nomes/produtos longos, quatro itens, overflow, observações e nenhum scroll | PENDING-MANUAL | Browser 1280×720 |
| 20 | TV física 32" 1080p: leitura à distância, contraste, clock/data e ausência de chrome obstrutivo | PENDING-MANUAL | TV 32" real |

Resultado manual desta execução: **0 PASS / 0 FAIL / 20 PENDING-MANUAL**.

## Gates preservados

- staging deploy: **NOT EXECUTED**;
- migration remota de staging: **NOT EXECUTED**;
- merge: **NOT EXECUTED**;
- produção/migration de produção: **NOT EXECUTED**;
- PR permanece: **DRAFT**.

O proprietário do produto executará staging e homologação manual depois que o GitHub Validate do SHA final estiver verde.
