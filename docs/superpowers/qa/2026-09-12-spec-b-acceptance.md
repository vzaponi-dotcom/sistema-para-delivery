# Spec B — aceite integrado e homologação

**SHA funcional final homologado:** `9381311a76d3ced64bd3dcb5074d7b7363b59554`  
**SHA de merge publicado:** `34897334d74fe6019ab170d4f52c10e8f3d421b8`  
**Staging:** `https://sistema-para-delivery-staging.vzaponi.workers.dev`  
**Produção:** `https://sistema-para-delivery.vzaponi.workers.dev`  
**Status:** **ACEITE FINAL APROVADO E RELEASE DE PRODUÇÃO CONCLUÍDA** em 15/09/2026.

> O histórico detalhado das rodadas permanece em `2026-09-12-spec-b-execution-ledger.md`. O fechamento está consolidado em `2026-09-15-spec-b-final-closure.md` e o evento de release em `2026-09-15-spec-b-release-ledger.md`.

## Evidência automatizada final

SHA funcional `9381311...`:

- Validate application #1146 (`35024215026`) — **PASS**;
- Validate application #1147 (`35024219794`) — **PASS**;
- Deploy staging #174 (`35024214926`) — **PASS**.

Commit documental `ee678817...`:

- Validate application #1148 (`35035835097`) — **PASS**;
- Validate application #1149 (`35035838713`) — **PASS**;
- Deploy staging #175 (`35035835023`) — **PASS**.

`master` após o merge:

- Validate application #1150 (`35036060895`) no SHA `34897334...` — **PASS**;
- Deploy production #48 (`35036339956`) no SHA `34897334...` — **PASS**.

Os gates cobriram testes, lint, build, dry-run, migrations D1 locais, gate dedicado da Spec B, migrations remotas de staging/produção, deploy e smoke real de login.

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

A aprovação cobre 1 e 2 vias, pedido/comanda, segunda via, dois jobs na fila, recovery/reconexão, impressão de teste, retry/reprint, mudança de política com fila pendente e solicitação remota executada apenas pela estação principal. Nenhuma falha foi reportada.

## Critério de encerramento

1. QA/runbooks atualizados — **PASS**;
2. gates no SHA funcional — **PASS**;
3. staging publicado e login verificado — **PASS**;
4. homologação manual/visual — **PASS**;
5. matriz física de impressão — **PASS**;
6. autorização explícita para produção — **PASS**;
7. gates documentais finais — **PASS**;
8. merge do PR #42 — **PASS**;
9. validação pós-merge em `master` — **PASS**;
10. workflow `Deploy production` — **PASS**;
11. migrations remotas, deploy e smoke real de login — **PASS**.

**Aceite encerrado: Spec B publicada em produção com sucesso.**
