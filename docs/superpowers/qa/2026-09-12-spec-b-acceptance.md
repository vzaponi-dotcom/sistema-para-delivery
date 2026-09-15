# Spec B — aceite integrado e homologação de staging

**Base funcional homologada:** `7c6de7422d4693a9bee34422ff100d155a42af4f`  
**Branch:** `feature/spec-b-settings-policies`  
**Staging:** `https://sistema-para-delivery-staging.vzaponi.workers.dev`  
**Status:** telas e fluxos de Configurações homologados em staging; fechamento documental em andamento; produção não autorizada.

> O histórico detalhado das rodadas permanece em `2026-09-12-spec-b-execution-ledger.md`. O fechamento atual está consolidado em `2026-09-15-spec-b-final-closure.md`.

## Evidência automatizada atual

No SHA funcional homologado `7c6de7422d4693a9bee34422ff100d155a42af4f`:

- **Validate application #1106** (`34989572799`): **PASS**;
- `npm test`: **PASS**;
- `npm run lint`: **PASS**;
- `npm run build`: **PASS**;
- Worker de produção em dry-run: **PASS**;
- Worker de staging em dry-run: **PASS**;
- migrations D1 locais: **PASS**;
- **Deploy staging #150** (`34989572808`): **PASS**;
- migrations do D1 de staging: **PASS**;
- deploy do Worker de staging: **PASS**;
- verificação real de login em staging: **PASS**.

O checkpoint T23A corrigiu as falhas históricas de fixtures/harness que impediam confiar no agregado; a suíte integral naquele checkpoint passou **1514/1514**, sem defeito de produção confirmado.

O fechamento final adiciona também o gate D1 específico da Spec B (`node scripts/infra/spec-b-d1-gate.mjs`) ao workflow de validação. O resultado desse gate deve ficar verde no SHA documental final antes de considerar o PR pronto para revisão final.

## Evidência manual/visual em staging

A homologação manual reportada pelo usuário cobre as telas de Configurações implementadas pela Spec B. As rodadas finais incluíram ajustes observados diretamente em desktop e mobile.

| ID | Automatizado | Manual/visual | Estado atual |
|---|---|---|---|
| V01 Home | PASS | PASS | Navegação e cards de Configurações homologados. |
| V02 Operação | PASS | PASS | Layout/responsividade, claro/escuro e fluxos de edição já homologados nas rodadas anteriores. |
| V03 Modalidades | PASS | PASS | Mesmo domínio/draft de Operação, controles e composição homologados. |
| V04 Pagamentos | PASS | PASS | Desktop/mobile homologados; densidade, alinhamento, padrão, menus, inativos e reorder preservados. |
| V05 Cancelamentos | PASS | PASS | Tela homologada; correção final do menu de três pontos validada. |
| V06 Categorias financeiras | PASS | PASS | Tela homologada; correção final do menu de três pontos validada. |
| V07 Impressão | PASS | PASS UI/fluxo | Tela/política/estação homologadas funcionalmente; matriz física específica da nova política por contexto continua separada abaixo. |
| V08 Dispositivo | PASS | PASS | Preferências locais e temas homologados. |
| V09 Modal | PASS | coberto por rodadas | Foco/escape/layout possuem regressões automatizadas e foram exercitados nas correções de telas. |
| V10 Descarte | PASS | coberto por rodadas | Cancelar/descartar e preservação de draft exercitados nas telas homologadas. |
| V11 Conflito | PASS | coberto por rodadas | Review de conflito recebeu rodada própria de correção e regressões. |
| V12 Envio incerto | PASS | automatizado | Reconciliação sem reenvio automático permanece coberta por testes. |
| V13 Read-only | PASS | automatizado | Capabilities e ausência de ações de escrita permanecem cobertas. |
| V14 Loading/indisponível | PASS | automatizado | Estados fail-closed/reconsulta permanecem cobertos. |

## Correções finais homologadas

### Formas de pagamento

- menu dos três pontos não é mais recortado pelo contêiner;
- ações fecham o menu quando aplicadas;
- itens inativos ficam visualmente atenuados sem desabilitar o menu;
- coluna Padrão não renderiza `—` nos demais métodos;
- desktop usa uma única linha de grid para status, padrão e ações;
- linhas desktop ficaram compactas e verticalmente centralizadas;
- mobile foi preservado após a compactação aprovada.

### Motivos de cancelamento e categorias financeiras

O menu dos três pontos deixou de ser recortado no desktop, inclusive nas últimas linhas da lista.

### Comandas na mesma branch de homologação

O redesign de Comandas foi homologado em desktop/mobile, incluindo a compactação responsiva e a correção do rótulo `COMANDA` para permanecer em uma linha no celular.

## Pendência física de impressão por contexto

A infraestrutura de impressão QZ/fila possui homologações físicas anteriores no projeto. Entretanto, a Spec B introduz/centraliza defaults de **1/2 vias por contexto** e snapshot em `0025_print_context_copies.sql`.

Não há evidência documental suficiente para afirmar que a matriz completa de `2026-09-12-spec-b-physical-printing-guide.md` foi repetida no mesmo SHA atual. Por isso:

- a preparação e revisão do PR podem prosseguir;
- merge em `master` continua uma decisão separada;
- **Deploy production permanece bloqueado** até a matriz física por contexto ser concluída ou formalmente reavaliada com evidência equivalente;
- nenhum PASS físico será presumido por herança de homologações antigas.

## Critério de encerramento

Para o fechamento documental da branch:

1. QA/runbooks atualizados;
2. gate D1 específico adicionado ao CI;
3. todos os gates finais verdes no SHA exato de fechamento;
4. staging publicado e login verificado nesse SHA;
5. PR para `master` criado sem merge automático;
6. produção mantida sem deploy.

A autorização de produção continuará exigindo decisão explícita e a resolução da pendência física acima.
