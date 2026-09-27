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
