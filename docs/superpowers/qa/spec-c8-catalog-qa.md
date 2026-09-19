# C8 — Catalog staging QA

**Date:** 2026-09-19  
**Branch:** `feature/spec-c8-catalog`  
**PR:** #52 draft/open  
**Base:** `a7a8285ee125d90058c739f52daba6c170921adb`  
**Validated code candidate before documentation update:** `ae4d09d44b1012fadf6cabcbe6eb190ef9ef4bfb`  
**Validate:** #1460 / run `35469241957` — SUCCESS, 1,860 tests / 1,859 pass / 0 fail / 1 skipped  
**Staging status:** **BLOCKED BEFORE DEPLOY / NO C8 STAGING RUN YET**  
**Production:** NOT DEPLOYED

## Deployment blocker

Task 9 requires a manual `workflow_dispatch` of `.github/workflows/deploy-staging.yml` on `feature/spec-c8-catalog`. The available GitHub integration can inspect runs/jobs/logs but cannot dispatch workflows, and the isolated execution shell has no GitHub or Cloudflare deployment credentials. The workflow was intentionally not modified to add a temporary push trigger. Until a real staging deployment exists, every manual case remains **PENDING** rather than being inferred from CI.

When dispatch becomes available, the deploy must use the then-current feature HEAD. Any documentation commit after `ae4d09d...` must first receive its own green Validate before staging.

## Manual QA matrix

| Nº | Caso | Resultado esperado | Estado |
|---:|---|---|---|
| 1 | Produtos desktop claro/escuro | Mesma hierarquia visual, textos e ações | PENDING |
| 2 | Buscar nome | Trim/case atuais, sem mudança de acentos | PENDING |
| 3 | Buscar categoria | Categoria visual, inclusive Outros | PENDING |
| 4 | Buscar apresentação | P/Família/350 ml/localização atual | PENDING |
| 5 | Buscar preço | Semântica `String(price)`, não busca BRL nova | PENDING |
| 6 | Filtro Todos | Coleção completa visível | PENDING |
| 7 | Filtro específico + busca | Interseção correta | PENDING |
| 8 | Expandir/recolher | Accordion preservado; busca/filtro expande como antes | PENDING |
| 9 | Criar Unidade | Nome, preço, retorno oficial, mensagem atual | PENDING |
| 10 | Criar Tamanho P/M/G | Presets e preço preservados | PENDING |
| 11 | Tamanho Outro | Texto customizado; até 24 caracteres | PENDING |
| 12 | Volume com vírgula/ponto | ml/L; exibição localizada | PENDING |
| 13 | Peso | g/kg; decimal positivo | PENDING |
| 14 | Apresentação inválida | Submit bloqueado, mensagem atual | PENDING |
| 15 | Editar estruturado | Mantém preço e apresentação; sucesso oficial | PENDING |
| 16 | Legado | Size/categoria fallback; BLOCKED se não existir fixture adequada | PENDING |
| 17 | Excluir/cancelar | Sem request ou efeito de remoção | PENDING |
| 18 | Excluir/confirmar | Remove somente após sucesso; toast atual | PENDING |
| 19 | Seleção desktop | Marcar/desmarcar/cancelar; contador correto | PENDING |
| 20 | Bulk | Sequencial, sem perda indevida da seleção durante pending | PENDING |
| 21 | Long press mobile | 550 ms, sem duplo toggle; scroll/cancel atuais | PENDING |
| 22 | Toolbar mobile 320–640 px | Portal/fixed/sticky e safe area sem clipping | PENDING |
| 23 | Formulário mobile | Decimal, digitação/foco contínuo e preview | PENDING |
| 24 | Offline | Lista/busca/filtro funcionam; writes não são enviados | PENDING |
| 25 | Novo Pedido: busca | Nome/categoria/apresentação sem preço adicionado à busca | PENDING |
| 26 | Novo Pedido: categoria | Inicial vazio; categorias disponíveis; busca prevalece como antes | PENDING |
| 27 | Carrinho | Adicionar, aumentar, diminuir; `Un`/apresentação preservados | PENDING |
| 28 | Sync oficial | Create/update/delete continuam corretos após refresh | PENDING |
| 29 | Logout/login | Editor e seleção não ressuscitam | PENDING |
| 30 | Restricted/read-only | Sem ações de gestão; BLOCKED sem identidade adequada | PENDING |
| 31 | Preço inicial/foco | Novo zero uma vez; edição mantém valor; digitação não perde foco | PENDING |
| 32 | Falha de exclusão controlada | Erro global; dialog/seleção encerram conforme baseline, sem falso sucesso | PENDING |
| 33 | Request lento | Serialização global preservada; sem submissão duplicada pela UI | PENDING |
| 34 | Retorno ao destino | Query preservada; lista reseta estado local conforme baseline | PENDING |
| 35 | Smoke operacional | Criar pedido com produto disponível; demais áreas sem regressão evidente | PENDING |

## Closure rule

Task 9 may only be marked complete after a staging run on the exact recorded feature HEAD succeeds and every case above is recorded as PASS, FAIL or accepted BLOCKED, with **0 FAIL / 0 PENDING**. Any code correction requires its own RED/GREEN, new Validate, new staging deployment and repetition of affected cases. Hardware printing is outside this proportional C8 matrix and must not be inferred from print-queue visibility.
