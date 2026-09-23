# Kitchen TV / KDS — implementação e matriz de homologação

Data de preparação: 2026-09-22
Branch: `feature/kitchen-tv-display-v2`
PR: #62 (`DRAFT`)
Spec: `docs/superpowers/specs/2026-09-22-kitchen-tv-display-design.md`
Plano: `docs/superpowers/plans/2026-09-22-kitchen-tv-display-plan.md`
Referência visual aprovada: `docs/superpowers/references/kitchen-tv-32-approved-reference.jpg`
SHA executável local antes do fechamento documental: `32d49c2`
Migrations: `0028_kitchen_tv_access.sql` + `0029_kitchen_tv_pairing_requests.sql`

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

- `npm test`: PASS, 2149/2149;
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
| `KitchenDisplayRoot` JS | 11.14 kB | 4.24 kB |
| `kitchenQueue` público/puro JS | 20.76 kB | 7.00 kB |
| Kitchen TV CSS | 6.60 kB | 2.07 kB |

A revisão independente final encontrou e a implementação corrigiu, antes do push, a preservação de variações/tamanhos dos itens, os limites visuais de itens e observações, o estado persistido “Aguardando pareamento” e a composição nome+tempo na linha principal do card. O conjunto focado correspondente fechou em 40/40 PASS.

O teste `kitchenDisplayBoundary.test.js` constrói o aplicativo em diretório temporário e percorre o manifest da entrada TV. O grafo rejeita `AdminBootstrap`, UI interna de Orders, Printing/QZ, jsPDF, Finance, Customers, Catalog UI, Table Service UI e Settings. O cliente HTTP da TV contém somente `/api/kitchen-tv/pairing-request`, `/api/kitchen-tv/pairing-status` e `/api/kitchen-tv/state`; `/api/bootstrap` é proibido por teste de fonte e pelo verificador de arquitetura.

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


## Staging QA iteration — pairing settings polish

Primeira publicação manual em staging: Deploy staging #213 / run `35794320970`, SHA `acb56ae1695005d7d075566857b954e6b8fc80bb`.

Observação humana:
- fluxo `Configurações > TV da Cozinha` abriu corretamente;
- geração do link one-time funcionou e exibiu fragmento `#token=`;
- a apresentação do estado gerado apresentou overflow horizontal no mobile e hierarquia inadequada das ações;
- o comportamento de segurança/API não foi considerado defeituoso.

Correção aplicada em `aa5c7bdd1f64859f3e93e9c056c32456ae46648b`:
- card dedicado e responsivo para o acesso da TV;
- segredo mascarado na UI, mantendo cópia integral somente pelo botão;
- `Copiar link` como ação primária;
- `Gerar novo link` como ação secundária com aviso de invalidação;
- contenção explícita de conteúdo longo, ellipsis e `min-width: 0`;
- ações empilhadas no mobile;
- estados inicial, pendente e ativo alinhados à mesma hierarquia visual;
- testes de semântica/overflow adicionados.

Os itens manuais permanecem `PENDING-MANUAL` até republicação desse SHA ou posterior em staging.


## Staging QA iteration — short-code pairing

Durante a primeira homologação manual, o produto identificou que transferir um link secreto longo do celular para uma TV comum não era uma experiência adequada.

O fluxo anterior por `#token=` foi substituído antes do merge por pareamento TV-first:

1. a TV abre `/cozinha-tv`;
2. o servidor cria uma solicitação temporária e a TV exibe um código aleatório de 6 dígitos;
3. no celular, `Configurações > TV da Cozinha` recebe esse código;
4. somente uma sessão administrativa com `orders.settings.manage` pode aprová-lo;
5. a TV consulta o status a cada 2 s;
6. após aprovação, a própria TV recebe o cookie final restrito e entra no fluxo normal;
7. o código expira em 30 minutos e a solicitação temporária é consumida.

A credencial real da solicitação continua sendo um segredo opaco de alta entropia em cookie `HttpOnly`; o código de 6 dígitos é somente um identificador temporário para a aprovação administrativa e não autentica APIs da TV sozinho.

Migration aditiva: `0029_kitchen_tv_pairing_requests.sql`. A migration `0028` não foi reescrita.

CI do protocolo novo: Validate application #1766 / run `35798274784` no SHA `998340db27f59f39b7936efb8605d362bba3e07a` — **8/8 shards SUCCESS + validate SUCCESS**.

A homologação manual do protocolo novo permanece `PENDING-MANUAL` até nova publicação em staging.


## Homologação manual final — staging #221

Publicação homologada:

- Deploy staging: **#221** / run `35806780891`;
- branch: `feature/kitchen-tv-display-v2`;
- produto homologado: `370003b71889265aa63fe86a65b283ad1bf4ad3d`;
- Worker staging Version ID: `0f519ee7-0cbd-4075-8bed-6d38860de7fd`;
- staging login: **HTTP 200**;
- D1 remoto: **No migrations to apply** no deploy #221;
- migrations `0028` e `0029` já estavam aplicadas no banco de staging.

A matriz abaixo substitui, para o estado final da homologação, a matriz `PENDING-MANUAL` preparada antes do primeiro staging. As iterações históricas acima permanecem como rastreabilidade.

| # | Cenário final | Status | Evidência |
|---:|---|---|---|
| 1 | `Configurações > TV da Cozinha` aparece no staging correto e permite iniciar o fluxo | **PASS** | Observação humana em celular; regressão temporária explicada por Deploy #220 da branch documental errada e corrigida no #221 |
| 2 | TV abre `/cozinha-tv` sem PIN administrativo e mostra código temporário de 6 dígitos | **PASS** | TV física |
| 3 | Código permanece estável durante o pareamento e não gira prematuramente | **PASS** | TV física; observado por vários minutos |
| 4 | Código digitado no celular autoriza a TV e cria a sessão restrita | **PASS** | Celular + TV física |
| 5 | Reload da TV preserva o pareamento sem novo código/PIN | **PASS** | TV física |
| 6 | Tela exige um único clique em `Iniciar painel da cozinha` para liberar áudio; painel abre normalmente | **PASS** | TV física |
| 7 | Alerta sonoro funciona após o gesto de entrada | **PASS** | Confirmação humana |
| 8 | Viewport da TV física cabe sem arrastar horizontal/verticalmente | **PASS** | TV Toshiba 32" usada na homologação |
| 9 | KDS mantém grade operacional 3×2, header, contadores, relógio e cards legíveis à distância | **PASS** | TV física |
| 10 | Todos os itens do pedido permanecem visíveis; pedidos grandes usam 2 colunas/densidade adaptativa sem truncar em `+ N itens` | **PASS** | TV física, inclusive pedido com nomes longos |
| 11 | Observações de produção aparecem inline no item correspondente e não ficam ocultas num rodapé único | **PASS** | TV física |
| 12 | Hierarquia cliente → divisor → itens ficou legível; cliente usa cor própria | **PASS** | TV física |
| 13 | Tempo operacional aparece em minutos/horas, sem contador de segundos; agendados continuam mostrando horário | **PASS** | TV física |
| 14 | Pedido imediato novo entra pela cadência operacional; pedido finalizado/cancelado some no refresh seguinte | **PASS** | Confirmação humana |
| 15 | Pedido agendado permanece agendado e entra na janela de preparo conforme timing vigente | **PASS** | Confirmação humana |
| 16 | Offline preserva estado e reconnect recupera a atualização; revogação retira o acesso da TV | **PASS** | Confirmação humana |
| 17 | Identidade real com apenas `orders.settings.view` consegue ver estado sem ações de manage | **PENDING-MANUAL** | Exige identidade restrita real; comportamento automatizado coberto |
| 18 | Código inválido/expirado e tentativa concorrente em segundo dispositivo são rejeitados no browser real | **PENDING-MANUAL** | Segurança automatizada coberta; não reproduzido manualmente |
| 19 | DevTools confirma ausência de `/api/bootstrap`, APIs administrativas e chunks Admin/QZ/jsPDF no carregamento inicial | **PENDING-MANUAL** | Build/manifest/boundary automatizados PASS; DevTools real não registrado |
| 20 | Viewports de browser exatos 1920×1080 e 1280×720 comparados lado a lado com a referência | **PENDING-MANUAL** | TV física foi aprovada; comparação exata em browser não registrada |

Resultado manual final: **16 PASS / 0 FAIL / 4 PENDING-MANUAL**.

Os quatro itens pendentes não representam falha conhecida do produto; são checks de identidade restrita, segurança negativa/concorrência ou inspeção de browser que já possuem cobertura automatizada, mas ainda não receberam evidência humana específica.

### Decisões aceitas durante homologação

- manter no momento o indicador `+ N pedidos fora da tela` sem rotação/paginação automática; melhoria futura se a operação demonstrar necessidade;
- manter um clique explícito para entrar no painel a fim de liberar áudio com maior confiabilidade em Smart TVs;
- manter sessão TV persistente após pareamento;
- manter cards sem ações operacionais, somente leitura;
- overflow de itens/observações dentro de um pedido não é aceito: todos devem permanecer visíveis.

### Estado do release candidate homologado

- produto staging homologado: `370003b71889265aa63fe86a65b283ad1bf4ad3d`;
- Validate application #1805: **8/8 shards SUCCESS + validate SUCCESS**;
- Deploy staging #221: **SUCCESS**;
- PR #62: ainda **DRAFT** no momento desta atualização documental;
- merge: **NOT EXECUTED**;
- produção: **NOT EXECUTED**.
