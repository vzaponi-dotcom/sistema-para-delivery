# Kitchen TV — densidade dinâmica — QA final

**Data:** 2026-09-27  
**Branch:** `feature/kitchen-tv-dynamic-density`  
**PR:** #77  
**Status:** homologado em staging; pronto para merge mediante autorização explícita.  
**Produção:** não publicada.

## Ambiente homologado

- Runtime homologado em staging: `768673acb96d5a85577aa7829b0135270efd382d`
- Deploy staging: **#502 / run 36356386420 — SUCCESS**
- Validate no mesmo SHA: **#2343 / run 36356389256 — SUCCESS**
- URL: `https://sistema-para-delivery-staging.vzaponi.workers.dev/cozinha-tv`

## Resultado manual

A homologação visual foi conduzida iterativamente em staging com filas reais de teste e screenshots enviados durante a revisão.

Resultado final do usuário após o fix de clipping:

> "Agora ficou ótimo"

### Cenários observados

| Cenário | Resultado |
| --- | --- |
| poucos pedidos mantendo cards confortáveis | PASS |
| 4 colunas em fila maior | PASS |
| pedidos de 1 item simples usando card mínimo | PASS |
| pedido de 1 item com observação preservando espaço extra | PASS |
| nomes longos / quebras de linha sem redução de fonte | PASS |
| pedidos de 2–4 itens com altura intermediária | PASS |
| pedidos maiores usando duas colunas quando vantajoso | PASS |
| pedido grande com várias observações | PASS |
| scheduled visível junto da fila operacional | PASS |
| estados atrasado / em preparo / agendado preservados | PASS |
| counters do header continuam representando a fila completa | PASS |
| overflow `+ N pedidos fora da tela` preservado | PASS |
| nenhuma rolagem interna introduzida | PASS |
| clipping de pedido simples identificado na iteração de 24 trilhas | FAIL observado e corrigido |
| mesmo caso após correção de nano-card | PASS |

## Evolução visual homologada

A solução final mantém três perfis de board:

- `focus`: 3 colunas para filas pequenas;
- `balanced`: 4 colunas em filas intermediárias;
- `compact`: 4 colunas com **24 trilhas verticais internas** em viewport grande.

No perfil compacto:

- 1 item simples, uma linha, sem observação usa nano-card;
- o nano-card mantém a tipografia aprovada e reduz apenas chrome/padding;
- 1 item com observação ou quebra de linha ganha altura adicional;
- 4+ itens podem usar duas colunas antecipadamente quando isso reduz altura;
- cards médios e grandes usam altura proporcional às linhas visuais efetivamente renderizadas;
- conteúdo grande continua recebendo mais espaço antes de qualquer clipping.

## Regressão de clipping

Na penúltima iteração, o nano-card foi reduzido abaixo da altura estrutural mínima necessária para status + cliente/tempo + item. Como o card usa `overflow: hidden`, a linha do item podia ser parcialmente cortada.

Correção aplicada:

- nano-card simples passa a usar espaço vertical seguro;
- métricas expõem estado explícito de nano-card;
- CSS do nano-card é aplicado por esse estado, não apenas pelo número de trilhas;
- cards com nota ou quebra de linha não recebem o chrome mais agressivo;
- tipografia dos itens e observações não foi reduzida.

A correção foi novamente homologada visualmente e aprovada.

## Gates automatizados do runtime homologado

No SHA `768673acb96d5a85577aa7829b0135270efd382d`:

- test shards: PASS;
- architecture: PASS;
- lint: PASS;
- build: PASS;
- production Worker dry-run: PASS;
- staging Worker dry-run: PASS;
- local D1 migrations: PASS;
- Spec B D1 clean install / upgrade: PASS;
- operation profile D1 clean install / upgrade: PASS;
- Validate #2343: **SUCCESS**.

## Contratos preservados

Cobertos pela suíte automatizada e pela implementação sem alteração de domínio/API:

- prioridade da fila;
- primeiro scheduled protegido;
- timing e estados visuais;
- pairing e sessão TV;
- read-only boundary;
- áudio;
- fullscreen / recovery;
- compatibilidade legacy já coberta pela suíte;
- ausência de scroll;
- nenhum Worker/API ou migration novo para esta feature.

## Fechamento

- QA visual final: **PASS**
- regressão conhecida aberta: **0**
- review threads pendentes antes do fechamento: **0**
- staging: **GREEN**
- produção: **NO DEPLOY**
- merge: **a executar somente após autorização explícita**
