# QA mobile — Gestão Delivery

Data da auditoria: 2026-09-02/03
Faixa alvo: 320–480 px

## Status

A revisão de código, regressões automatizadas, lint, build e Worker dry-run está verde. A validação visual/manual em navegador ou aparelho real ainda não foi executada neste ambiente; por isso nenhum checkbox visual abaixo foi marcado como concluído.

Nenhum P0/P1 foi detectado pela cobertura automatizada atual. A liberação para produção continua condicionada ao QA visual efetivo desta matriz e à aprovação do usuário.

| Tela/fluxo | 320 | 360 | 390/393 | 480 | Claro | Escuro | Teclado | Resultado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | n/a | QA visual pendente |
| Pedidos/Cozinha | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | n/a | QA visual pendente |
| Novo Pedido | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | QA visual pendente |
| Clientes | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | QA visual pendente |
| Produtos | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | QA visual pendente |
| A Receber | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | QA visual pendente |
| Financeiro | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | QA visual pendente |
| Mais | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | n/a | QA visual pendente |

## Cobertura automatizada já concluída

- Fundação mobile compartilhada: viewport, overflow horizontal, safe area, clearance do menu inferior, camadas e FAB.
- Modal, BottomSheet e SystemSelect: portal para viewport, scroll interno, bloqueio do fundo, foco, Escape/Tab e overlays aninhados.
- Novo Pedido: composição estreita, touch targets, textos longos, checkout empilhado e hints de teclado.
- Pedidos/Cozinha: ações dentro do card, touch targets, quebra de cliente/histórico e prevenção de regressão de cascata.
- A Receber: ações de pagamento, textos longos, resumo de comanda e rodapé de modal.
- Dashboard: seletor de período, FAB, gráficos, eixo monetário compacto e pedidos recentes em telas estreitas.
- Clientes/Produtos: endereço, ações, nomes longos, formulário em coluna única e hints de teclado/autocomplete.
- Financeiro/Mais: textos longos, ações, tema em 320 px, logout e safe area.
- Consistência global: escala de z-index compartilhada, touch feedback sem hover, toast acima do menu e reduced motion.

## Cenários manuais obrigatórios

Em cada largura de referência, revisar também:

- primeiro carregamento;
- scroll longo;
- texto/nome/endereço/descrição longos;
- lista vazia e lista longa;
- loading e erro;
- abertura/fechamento de Modal, BottomSheet e SystemSelect;
- ação principal da tela;
- safe area inferior;
- ausência de scroll horizontal do documento;
- navegação inferior fixa durante scroll e swipe;
- FAB sem encobrir menu, conteúdo ou toast;
- rotação quando aplicável.

## Teclado virtual

Em 360 px, abrir o teclado no topo, meio e fim de:

- Novo Pedido;
- cadastro/edição de Cliente;
- cadastro/edição de Produto;
- pagamento;
- movimento financeiro.

Confirmar que o campo ativo e a ação necessária permanecem alcançáveis por scroll natural/interno e que nenhum overlay fica preso fora da viewport.

## Critério de severidade

- P0: impede operação crítica, perda/corrupção de dados ou tela inutilizável.
- P1: fluxo principal fica bloqueado, ilegível ou exige workaround relevante.
- P2: problema visual/ergonômico sem bloquear o fluxo.

A tela só deve receber `✅` após teste efetivo. O resultado final esperado para cada linha é `Sem P0/P1 aberto`.

## Evidência automatizada mais recente

- Validate application: run `33701298379` — testes, lint, build e Worker dry-run concluídos com sucesso.
- Diff da rodada a partir de `fa36ac7c7a1e22d05e52c1f402efbdd4b0950809`: somente frontend/CSS/testes; nenhuma migration, schema D1, Worker ou regra de negócio alterada.

## Gate de produção

Deploy não faz parte desta rodada sem aprovação explícita do usuário. Antes de publicar:

1. executar e preencher a matriz visual acima;
2. corrigir qualquer P0/P1 com RED → GREEN;
3. repetir suíte, lint, build e Worker dry-run;
4. obter aprovação do usuário para deploy.
