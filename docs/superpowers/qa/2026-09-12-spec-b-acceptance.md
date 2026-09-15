# Spec B — aceite integrado e homologação de staging

**SHA funcional final homologado:** `9381311a76d3ced64bd3dcb5074d7b7363b59554`  
**Branch:** `feature/spec-b-settings-policies`  
**Staging:** `https://sistema-para-delivery-staging.vzaponi.workers.dev`  
**Status:** **ACEITE FINAL APROVADO**; homologação visual/funcional e matriz física de impressão concluídas; produção autorizada pelo usuário em 15/09/2026, condicionada aos gates finais e ao workflow oficial de produção.

> O histórico detalhado das rodadas permanece em `2026-09-12-spec-b-execution-ledger.md`. O fechamento atual está consolidado em `2026-09-15-spec-b-final-closure.md` e o evento de release em `2026-09-15-spec-b-release-ledger.md`.

## Evidência automatizada final do SHA funcional

No SHA `9381311a76d3ced64bd3dcb5074d7b7363b59554`:

- **Validate application #1146** (`35024215026`): **PASS**;
- **Validate application #1147** (`35024219794`, evento do PR): **PASS**;
- **Deploy staging #174** (`35024214926`): **PASS**;
- testes: **PASS**;
- lint: **PASS**;
- build: **PASS**;
- Worker de produção em dry-run: **PASS**;
- Worker de staging em dry-run: **PASS**;
- migrations D1 locais: **PASS**;
- gate dedicado da Spec B, incluindo instalação limpa/upgrade: **PASS**;
- migrations do D1 de staging, deploy e smoke real de login: **PASS**.

## Evidência manual/visual em staging

| ID | Automatizado | Manual/visual | Estado final |
|---|---|---|---|
| V01 Home | PASS | PASS | Navegação e cards homologados. |
| V02 Operação | PASS | PASS | Layout, responsividade e edição homologados. |
| V03 Modalidades | PASS | PASS | Draft/controles/composição homologados. |
| V04 Pagamentos | PASS | PASS | Desktop/mobile, reorder, menus, padrão e inativos homologados. |
| V05 Cancelamentos | PASS | PASS | Tela e menu de ações homologados. |
| V06 Categorias financeiras | PASS | PASS | Tela, menu e persistência da ordenação homologados. |
| V07 Impressão | PASS | PASS físico | UI/política/estação e matriz física de 1/2 vias homologadas. |
| V08 Dispositivo | PASS | PASS | Preferências locais/temas homologados. |
| V09 Modal | PASS | coberto | Foco/escape/layout cobertos e exercitados. |
| V10 Descarte | PASS | coberto | Cancelar/descartar e preservação de draft cobertos. |
| V11 Conflito | PASS | coberto | Review/conflito cobertos. |
| V12 Envio incerto | PASS | automatizado | Reconciliação sem reenvio automático coberta. |
| V13 Read-only | PASS | automatizado | Capabilities e ausência de escrita cobertas. |
| V14 Loading/indisponível | PASS | automatizado | Estados fail-closed/reconsulta cobertos. |

## Correções finais homologadas

- ordenação de Categorias financeiras recalcula `sortOrder`, salva e persiste após reload;
- save sem alterações em Operação/Modalidades, Pagamentos, Cancelamentos e Categorias financeiras não grava e informa `Não há alterações para salvar.`;
- menus de ações, estado inativo e densidade de Pagamentos homologados;
- redesign/polish de Comandas homologado em desktop/mobile;
- política de impressão por contexto e estação principal homologadas física e funcionalmente.

## Homologação física de impressão

A matriz de `2026-09-12-spec-b-physical-printing-guide.md` foi reportada como executada integralmente pelo usuário em staging no SHA funcional `9381311...` e aprovada em 15/09/2026.

A aprovação cobre 1 e 2 vias, pedido/comanda, segunda via, dois jobs na fila, recovery/reconexão, impressão de teste, reprint, mudança de política com fila pendente e solicitação remota executada apenas pela estação principal. Nenhuma falha foi reportada.

## Critério de encerramento

Para autorizar a release da Spec B:

1. QA/runbooks atualizados — **PASS**;
2. gates automatizados no SHA funcional homologado — **PASS**;
3. staging publicado e login verificado — **PASS**;
4. homologação manual/visual — **PASS**;
5. matriz física de impressão — **PASS**;
6. autorização explícita do usuário para produção — **PASS em 15/09/2026**;
7. PR deve ficar pronto para review/merge e o workflow oficial de produção deve ser executado somente a partir de `master`.

A produção não deve ser considerada concluída até o workflow `Deploy production` terminar com sucesso e seu smoke final de login passar.
