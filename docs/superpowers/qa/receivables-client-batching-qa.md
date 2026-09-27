# QA — Recebíveis agrupados por cliente

**Data:** 2026-09-27  
**Branch:** `feature/receivables-client-batching`  
**HEAD homologado:** `92378b7986df8f98e9507c0034006d184010e020`  
**Validate:** #2283 — SUCCESS  
**Staging:** #489 — SUCCESS  
**Produção:** NO DEPLOY  
**Merge:** NOT EXECUTED

## Homologação manual principal

- PASS — visão `Por cliente` como padrão.
- PASS — agrupamento de vários pedidos do mesmo cliente.
- PASS — expansão inline no mobile.
- PASS — painel lateral no desktop.
- PASS — seleção individual, parcial e todos.
- PASS — total selecionado recalculado corretamente.
- PASS — pagamento conjunto de 2 pedidos.
- PASS — composição com duas formas de pagamento.
- PASS — apenas os pedidos selecionados são quitados.
- PASS — pedidos não selecionados permanecem pendentes.
- PASS — Finance mostra um único recebimento.
- PASS — Finance mostra o breakdown das formas corretamente.
- PASS — Lista de pedidos continua operando.
- PASS — pagamento individual continua operando.
- PASS — previsão continua operando.
- PASS — Quitados continua operando.
- PASS — Reporting não duplica recebido e mantém mix por forma.
- PASS — estorno de um pedido de receipt misto.
- PASS — definir data prometida pela visão agrupada.
- PASS — alterar/remover data prometida pela visão agrupada.
- PASS — recálculo de timing após promessa.
- PASS — desktop claro.
- PASS — desktop escuro.
- PASS — mobile claro.
- PASS — mobile escuro.
- PASS — contraste dos CTAs de recebimento.
- PASS — indicador de expandir/recolher.
- PASS — barra fixa de recebimento permanece fixa após navegação.
- PASS — valores monetários dos cards-resumo ficam contidos no mobile.
- PASS — filtros mobile permanecem contidos no card.

## Cobertura automatizada complementar

- AUTO — mesmo nome com clientIds diferentes não agrupa.
- AUTO — convidados com mesmo nome não agrupam.
- AUTO — table-tab permanece fora de A Receber.
- AUTO — limite de 100 pedidos.
- AUTO — rejeição de 101 pedidos.
- AUTO — soma abaixo/acima do total bloqueada.
- AUTO — método duplicado bloqueado.
- AUTO — método inativo/policy race.
- AUTO — double submit.
- AUTO — offline/capability.
- AUTO — stale response.
- AUTO — corrida de pagamento/cancelamento com rollback integral.
- AUTO — Finance/Reporting/read model/refund para receipt compartilhado.
- AUTO — architecture/lint/build/D1/Worker dry-runs.

## Observações

- Duplicações vistas em screenshot longo do Android eram artefato de stitching da captura; não reproduzidas na UI real.
- Nenhuma migration estrutural nova foi necessária.
- Nenhum deploy de produção foi executado.

## Resultado

**Task 11: COMPLETE / GREEN**

Staging homologado, sem FAIL conhecido.

---

## Task 12 — fechamento documental pós-homologação

### Evidência exata

- Runtime homologado manualmente: `92378b7986df8f98e9507c0034006d184010e020`.
- Validate do runtime homologado: **#2283 / run 36324560121 — SUCCESS**.
- Staging homologado: **#489 / run 36324556352 — SUCCESS**.
- Worker staging homologado — Current Version ID: `097ccc1c-1fd6-4ca6-be3b-ef3092113912`.
- Commit documental da Task 11: `43d72547e4379e06528e287c4bcf093d8a2977f0`.
- Validate do commit documental: **#2284 / run 36331773835 — SUCCESS**.
- O trigger temporário de push da branch em `.github/workflows/deploy-staging.yml` foi removido no commit `e3a8e9455af8e3c5dc5f9426bed9b94e05f30556`, restaurando o workflow à mesma lista de branches da `master`.
- Nenhum arquivo novo ou alterado em `migrations/`.
- QA manual: **30 PASS / 0 FAIL / 0 BLOCKED**.
- Known FAILs: **0**.
- Produção: **NO DEPLOY**.
- Merge: **NOT EXECUTED**.

### Autorrevisão contra a Spec §51 — critérios de aceite

1. PASS — `Por cliente` é o modo padrão de Pendentes.
2. PASS — `Lista de pedidos` continua disponível.
3. PASS — agrupamento usa `clientId`.
4. PASS — convidados iguais não são agrupados por nome.
5. PASS — comandas continuam fora de A Receber avulso.
6. PASS — filtros agregam apenas pedidos do recorte ativo.
7. PASS — grupo mostra total e quantidade corretos.
8. PASS — cliente pode ser expandido.
9. PASS — subset de pedidos pode ser selecionado.
10. PASS — clientes diferentes não podem ser misturados no mesmo recebimento.
11. PASS — um único pedido selecionado continua no fluxo individual comprovado.
12. PASS — múltiplos pedidos usam o editor oficial de composição.
13. PASS — múltiplas formas de pagamento continuam suportadas.
14. PASS — pagamento parcial continua impossível.
15. PASS — backend recalcula o total oficial.
16. PASS — a ação multi-pedido cria um único receipt.
17. PASS — cada pedido recebe exatamente um payment integral.
18. PASS — allocations pertencem ao receipt.
19. PASS — movements pertencem às allocations.
20. PASS — nenhuma allocation é atribuída artificialmente a um pedido.
21. PASS — a operação é atômica.
22. PASS — conflito não deixa pagamento parcial.
23. PASS — Finance mostra o receipt uma vez.
24. PASS — Reporting conta o recebido uma vez.
25. PASS — mix por forma reconcilia.
26. PASS — pedidos não selecionados permanecem pendentes.
27. PASS — promise/forecast permanecem funcionais.
28. PASS — mobile e desktop homologados.
29. PASS — temas claro e escuro homologados.
30. PASS — testes, architecture, lint, build e gates D1 passam.
31. PASS — nenhuma publicação em produção ocorreu sem autorização explícita.

### Estado pré-merge

- PR #74: **OPEN / DRAFT**.
- Base esperada: `master`.
- Review threads conhecidos antes deste commit: **0 unresolved**.
- A validação final deve ser registrada no SHA exato deste fechamento documental.
- Não há necessidade de novo staging por causa deste commit documental/controle; o runtime homologado permanece o do staging #489.

