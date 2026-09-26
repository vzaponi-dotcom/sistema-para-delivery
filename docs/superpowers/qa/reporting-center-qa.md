# Centro de Relatórios — homologação funcional

Issue #34 · PR #72 · branch `feature/issue-34-reporting-center`
**Código homologado:** `7583882ecad5bfe7a0d9994045c32ca084dbaf8b`
**Ambiente de todas as linhas:** staging autenticado, operação **Amor & Sabor**, em 25/09/2026 (America/Sao_Paulo).
**Base URL de todas as linhas:** `https://sistema-para-delivery-staging.vzaponi.workers.dev` (workflow `.github/workflows/deploy-staging.yml`).
**Recorte M:** `/relatorios?period=current-month&from=2026-09-01&to=2026-09-25`; quando indicada outra aba, acrescentar `view=operation|sales|products|detail`.
**Recorte H:** `/relatorios?period=today&from=2026-09-25&to=2026-09-25`.
Cada evidência abaixo foi observada no staging, exceto onde consta **BLOCKED**. URLs relativas usam a base acima. Após a linha de base, a regressão de pagamentos registrou no staging um teste de R$ 3,00 no pedido #172; valores anteriores e posteriores são identificados para impedir falsa divergência. Não houve alteração de código, merge ou deploy de produção.

## Resultado e limites

**58 PASS · 8 FAIL · 7 BLOCKED** na matriz 1–73. Os FAIL não foram corrigidos. **A exportação CSV/XLSX/PDF é blocker para merge**: está bloqueada no uso normal, e a auditoria cruzada com arquivos não pôde ser concluída. Capabilities reduzidas e negação de `reports.view` não puderam ser simuladas com a conta disponível. Impressão física não pôde ser confirmada porque a estação de staging estava offline.

### Navegação

| # | Estado | URL/recorte; ação, resultado e critério |
|---:|:---:|---|
| 1 | PASS | `/financeiro` → botão Financeiro/Relatórios abriu `/relatorios`; cinco abas e KPIs carregaram, como esperado. |
| 2 | PASS | Acesso direto a `/relatorios` na sessão autenticada abriu o Centro; sem redirecionamento inesperado. |
| 3 | PASS | F5 em M, inclusive com `view=operation`, manteve a rota e carregou novamente 162 pedidos operacionais. |
| 4 | PASS | M → Operação → voltar/avançar restaurou URL e aba coerentes. |
| 5 | BLOCKED | `/relatorios`; só havia sessão com `reports.view` e `reports.export`. Faltam contas de staging com `reports.view` sem `reports.export` e sem `payments.receive` para verificar, respectivamente, ocultação da exportação e leitura independente de baixa; código/teste local não substitui observação integrada. |
| 6 | BLOCKED | `/relatorios`; faltam conta sem `reports.view` ou autorização para ajustar papel no staging. É necessário tentar menu e URL direta com essa conta e verificar 403/ocultação. |

### Filtros e URL

| # | Estado | URL/recorte; ação, resultado e critério |
|---:|:---:|---|
| 7 | PASS | `/relatorios` sem query mostrou M (01–25/09), botão Mês atual pressionado e 167 pedidos comerciais; padrão esperado. |
| 8 | PASS | M → Hoje gerou H; Detalhado retornou 7 pedidos, contra 189 em M. |
| 9 | PASS | M → 7 dias gerou `from=2026-09-19&to=2026-09-25`; Detalhado 60 pedidos. |
| 10 | PASS | M → 30 dias gerou `from=2026-08-27&to=2026-09-25`; Detalhado 189 pedidos. |
| 11 | FAIL | M: grupo Período rápido oferece Hoje, 7 dias, 30 dias e Mês atual, **não Mês anterior**, exigido pelo plano. Agosto pôde ser informado manualmente, mas o atalho não existe. Reproduzir: abrir M e examinar Período rápido. |
| 12 | PASS | Em Detalhado, definir datas 01–31/08 atualizou `period=custom&from=2026-08-01&to=2026-08-31`; população mudou de 189 para 0. |
| 13 | PASS | M/Operação: Modalidade Entrega reduziu 162 para 93; URL `type=Entrega`. No Detalhado, mudança de população na página 2/100 para Entrega voltou a `page=1` e mostrou 107. |
| 14 | PASS | M/Operação: Entrega + Agendado resultou em 19; URL contém `type=Entrega&schedule=scheduled`. |
| 15 | PASS | M/Produtos: clicar [TESTE] Combo Família gerou Detalhado com `product=c28988c0-eb0c-4e2b-af98-a19ccf561e73`, 20 pedidos, coerente com 20 unidades do produto. |
| 16 | PASS | M/Vendas: selecionar Pix gerou `paymentMethod=pix`, 110 pedidos comerciais e R$ 5.870,46 recebidos; mix ficou 100% Pix. |
| 17 | PASS | Reabrir diretamente M com `view=detail&receivable=unpaid&search=Fernanda` restaurou ambos os chips e 16 pedidos/R$ 1.132,00 após a baixa; não perdeu o segundo filtro. |

### Visão geral

| # | Estado | URL/recorte; ação, resultado e critério |
|---:|:---:|---|
| 18 | PASS | M/Visão geral: vendas R$ 10.398,36, iguais a M/Vendas e ao faturamento comercial do Detalhado. |
| 19 | PASS | M: 167 pedidos comerciais; Detalhado lista 189 pedidos ao incluir 22 cancelados, diferença explicada pela regra. |
| 20 | PASS | M: ticket R$ 62,27; R$ 10.398,36 ÷ 167 = R$ 62,2656, arredondado para R$ 62,27. |
| 21 | PASS | M antes da baixa: recebido R$ 7.431,36, igual a Vendas e à soma do mix (Pix 5.870,46 + Dinheiro 1.119,84 + débito 254,56 + crédito 186,50). Depois da baixa: R$ 7.434,36. |
| 22 | PASS | M antes: A receber R$ 2.889,00/38, igual a Vendas, Detalhado filtrado e A Receber. Painel: financeiro R$ 10.320,36 = 7.431,36 + 2.889,00; 72% recebido. Depois: R$ 2.886,00/37. Link Gerenciar em A receber abriu `/financeiro/a-receber`. |
| 23 | PASS | M: taxa 11,64%; 22 cancelados ÷ 189 pedidos = 11,6402%. Clicar KPI abriu Detalhado `status=Cancelado` com 22. |
| 24 | PASS | M: estornos R$ 155,00; Vendas exibiu o mesmo total e série diária de estornos. |
| 25 | PASS | M: dentro do prazo 25,93%; Operação 42 no prazo ÷ 162 elegíveis = 25,9259%. |
| 26 | FAIL | H/Visão geral comparou corretamente vendas 1.102,00 vs 1.047,00 (+5,25%, melhora), pedidos 7 vs 9 (−22,22%, piora), A receber 670 vs 987 (−32,12%, melhora). Porém M/Vendas, M/Produtos, M/Detalhado e mobile mostram `Comparação indisponível · anterior R$ 0,00/0` sem base em agosto; a regra pede indisponível sem zero falso. Reproduzir em M, observar cartão Vendas. |

### Operação

| # | Estado | URL/recorte; ação, resultado e critério |
|---:|:---:|---|
| 27 | PASS | M/Operação: 162 elegíveis, tempo médio 462,27 min; o resumo móvel mostra o mesmo número (com ponto decimal). |
| 28 | PASS | M/Operação: mediana 159,5 min carregada para os mesmos 162 pedidos. |
| 29 | PASS | M/Operação: P90 1.337 min carregado; maior que mediana, sem valor nulo fabricado. |
| 30 | PASS | M/Operação: Entrega 93 + Retirada 13 + Local 56 = 162. Drill-down Entrega retornou 93. |
| 31 | PASS | M/Operação: gráfico de hora apresentou 24 buckets; controle de horas disponível em Mais filtros. |
| 32 | PASS | M/Operação: dias da semana 19+19+33+28+26+26+11 = 162. |
| 33 | PASS | M/Operação: 42 no prazo + 120 fora = 162; com Entrega + Agendado + Atrasado o Detalhado abriu 13 pedidos, igual ao KPI filtrado. |
| 34 | PASS | M/Operação: 19 agendados + 143 imediatos = 162; pontualidade de agendados 31,58%. |
| 35 | BLOCKED | M/Operação: estado normal e distribuições visíveis, mas não há fixture identificada no staging com `timing_policy_snapshot_json` ausente/legacy, pedido retroativo e regra de prazo indisponível. Para concluir, fornecer/autorizar esses casos identificáveis e comparar seus timestamps oficiais; testes locais de regra não comprovam a apresentação integrada. |

### Vendas

| # | Estado | URL/recorte; ação, resultado e critério |
|---:|:---:|---|
| 36 | PASS | M/Vendas: gráficos rotulados “Vendas por dia — Por data do pedido” e “Recebimentos por dia — Por data de pagamento”; baixa do pedido #172 em 25/09 somou R$ 3,00 ao recebido sem alterar vendas R$ 10.398,36. |
| 37 | PASS | `/financeiro/a-receber`, pedido #172: registrar R$ 3,00 como Pix 1,00 + Dinheiro 2,00 exibiu sucesso “Pagamento recebido em 2 formas”. Em M/Vendas, Pix 5.870,46→5.871,46, Dinheiro 1.119,84→1.121,84, recebido 7.431,36→7.434,36; no Detalhado #172 ficou Pago / Pix + Dinheiro. |
| 38 | PASS | M/Vendas: mercadoria R$ 10.328,36 + taxa de entrega R$ 70,00 = vendas R$ 10.398,36; taxa em cartão separado. |
| 39 | PASS | M/Vendas: descontos R$ 24,14 e acréscimos R$ 5,00 em cartões próprios. |
| 40 | PASS | M/Vendas antes: vencidos 2.219,00/32 + hoje 670,00/6 + futuros 0 = 2.889,00/38. Depois: vencidos 2.216,00/31 + hoje 670,00/6 = 2.886,00/37. |
| 41 | PASS | M/Vendas → link Gerenciar em A receber abriu `/financeiro/a-receber`, com as mesmas 37 pendências/R$ 2.886,00 após a baixa. |
| 42 | PASS | M/Vendas e drawer de Relatórios: apenas link para A receber; não há Registrar pagamento ou ação de baixa no Centro. |

### Produtos

| # | Estado | URL/recorte; ação, resultado e critério |
|---:|:---:|---|
| 43 | PASS | M/Produtos: Top 10 por receita exibiu Combo Família 20 un./R$ 1.578,97 (15,29%), Combo Duplo 29/R$ 1.391,36 e Marmita Churrasco 40/R$ 1.280,00; por unidades, Sanduíche de Frango 48 liderou. |
| 44 | PASS | M/Produtos: 127 refeições vendidas; `/financeiro` no mesmo período também mostrou 127. |
| 45 | PASS | M/Produtos: 9 categorias, soma dos valores exibidos (3.500,18 + 3.110,33 + 1.664,19 + 891,68 + 513,97 + 472,52 + 127,99 + 33,50 + 14,00) = R$ 10.328,36, igual à mercadoria de Vendas. |
| 46 | BLOCKED | M/Produtos mostrou apresentações/tamanhos e 456 unidades; porém não foi possível provar no staging a preservação histórica de `size_snapshot` após renomear tamanho, pois não existe caso antes/depois identificado. É necessário fornecer fixture histórica ou autorizar criar/renomear produto de teste e validar seu histórico. |
| 47 | BLOCKED | M/Produtos soma R$ 10.328,36 de receita de mercadoria, excluindo R$ 70,00 de entrega; porém a exigência de produto/categoria renomeados preservarem receita passada não foi exercitada em staging. Fornecer fixture identificável ou autorizar cenário de renomeação controlada. |
| 48 | PASS | M/Produtos → Combo Família abriu Detalhado com `product=c28988c0-eb0c-4e2b-af98-a19ccf561e73`; 20 pedidos, correspondendo às 20 unidades no ranking. Total dos pedidos R$ 3.552,00 é distinto da receita apenas do produto, como esperado para pedidos com múltiplos itens. |

### Detalhado

| # | Estado | URL/recorte; ação, resultado e critério |
|---:|:---:|---|
| 49 | PASS | M/Detalhado: 189 pedidos; pageSize 10 mostrou 1–10 e página seguinte 11–20, anterior voltou; 25, 50 e 100 mostraram 1–N de 189, com 8/4/2 páginas respectivamente. Mudança de população na página 2/100 para Entrega resetou `page=1`. |
| 50 | FAIL | M/Detalhado: Mais recentes #186 (25/09), Mais antigos #18 (04/09), Maior total #183/R$ 432,00 e Maior duração #91/2.995 min funcionaram. **Menor duração** (`sort=duration-asc`) colocou primeiro #186 “Em preparo” com duração `—`; nulo precede durações medidas, contrariando a ordenação. Reproduzir selecionando Menor duração no M. |
| 51 | PASS | M/Detalhado: abrir Colunas, desmarcar Duração removeu `columnheader Duração` e a célula correspondente; seleção persistiu na tela. |
| 52 | PASS | M/Detalhado: busca Fernanda reduziu 189 para 44; somada a status Finalizado deu 39, com página 2/25 exibindo 26–39. |
| 53 | PASS | M/Detalhado com `receivable=unpaid&search=Fernanda`: chips “Recebível: A receber” e “Busca: Fernanda” apareceram; população 16/R$ 1.132,00 após baixa. |
| 54 | PASS | M/Detalhado: Limpar filtros após busca/status removeu chips e restaurou população geral; mudança de status na página 2 voltou à página 1. |
| 55 | FAIL | M/Detalhado: linha #183 e botão “...” abriram drawer somente leitura com status, itens, split Dinheiro+débito e resumo; #186 exibiu link Gerenciar em A receber e nenhuma mutação. Porém uma linha apareceu como `#` / “Abrir pedido null” / “Ver pedido null”; ao abrir carregou UUID `f9a1cb3b-d4fb-405f-b3ad-ca7027fa92a3`, sem número identificável. Reproduzir na população M, localizar “Abrir pedido null”. Identificação/ação acessível do pedido fica defeituosa. Teclado Enter/Espaço e isolamento entre businesses não foram observados em staging. |
| 56 | PASS | M: cancelamentos 22→Detalhado 22; Entrega+Agendado+Atrasado 13→Detalhado 13; Combo Família 20→Detalhado 20; Pix no mix→114 pedidos associados no Detalhado (inclui cancelados, enquanto Vendas conta 110 comerciais); A receber antes 38/R$ 2.889,00→Detalhado 38/R$ 2.889,00. Diferenças de população têm regras distintas identificadas. |

### Exportações

| # | Estado | URL/recorte; ação, resultado e critério |
|---:|:---:|---|
| 57 | FAIL | M/Detalhado → Exportar relatório → CSV: nenhum arquivo baixado; alerta `orderHourFrom inválido.`. Esperado CSV UTF-8 com 189 linhas do recorte/colunas selecionadas. |
| 58 | FAIL | M/Detalhado → XLSX: mesmo alerta, nenhum workbook; abas Resumo/Dados, tipos numéricos e linhas não puderam ser inspecionados. |
| 59 | FAIL | M/Detalhado → PDF: mesmo alerta, nenhum PDF; período/KPIs/avisos de qualidade não puderam ser inspecionados. |
| 60 | FAIL | M/Detalhado com filtros ativos → exportar: solicitação falha antes de produzir arquivo, impedindo paridade de recorte. Código somente leitura confirma causa: `ReportingExportMenu` envia query normalizada com `orderHourFrom: null`; `worker/reporting/api.js` passa objeto a `new URLSearchParams`, que serializa `null` como texto `null`; `worker/reporting/query.js` rejeita `orderHourFrom=null`. Todas as três opções usam o mesmo `exportModel`. |
| 61 | BLOCKED | Staging tem 189 pedidos em M e a exportação já falha antes do limite; não há recorte de >10.000 linhas. É necessário corrigir o bloqueio com autorização posterior e preparar dataset >10.000 para verificar rejeição explícita sem truncamento. Teste local `worker/reporting/exportModel.test.js` cobre 10.000/10.001, mas não o staging. |

### Responsivo e tema

| # | Estado | URL/recorte; ação, resultado e critério |
|---:|:---:|---|
| 62 | PASS | M/Detalhado e Vendas a 1512 px, tema Claro selecionado em Preferências: cartões, filtros e tabela carregaram; fundo `rgb(246,243,241)`, sem rolagem estrutural (`scrollWidth=innerWidth=1512`). |
| 63 | PASS | M/Vendas a 1512 px, tema Escuro: métricas carregaram (R$ 10.398,36/167/recebido R$ 7.434,36), fundo `rgb(21,18,17)`, `scrollWidth=innerWidth=1512`. |
| 64 | PASS | M a 320 px, tema Claro: Resumo do período, tendência, top produtos e ligação A receber renderizaram; `scrollWidth=innerWidth=320`. |
| 65 | PASS | M/Vendas a 320 px, tema Escuro: resumo carregou 167 pedidos/R$ 10.398,36/A receber R$ 2.886,00; fundo `rgb(21,18,17)`, sem overflow estrutural. |
| 66 | PASS | M a 320×700: período, modalidade, abas e Gerenciar em A receber acessíveis. Após erro de exportação, o alerta sobrepôs Vendas/Produtos/Detalhado e interceptou toques; recarregar removeu o alerta e Detalhado abriu. Esse efeito integra o FAIL de exportação, não foi ignorado. |
| 67 | PASS | M/Detalhado a 320 px mostrou “Pedidos detalhados” como lista (#186 etc.) e aviso de colunas avançadas no desktop; não renderizou a tabela desktop comprimida. |

### Regressões

| # | Estado | URL/recorte; ação, resultado e critério |
|---:|:---:|---|
| 68 | PASS | `/financeiro/a-receber`: pedido #172/R$ 3,00 foi recebido; toast “Pagamento recebido em 2 formas”; lista caiu de 38 para 37 e atraso de R$ 2.219,00/32 para R$ 2.216,00/31. |
| 69 | PASS | Mesmo fluxo: Pix 1,00 + Dinheiro 2,00; resumo do formulário total informado 3,00/restante 0,00; Detalhado #172 passou a Pago/Pix + Dinheiro e mix aumentou exatamente em cada alocação. |
| 70 | PASS | `/comandas`: quatro comandas abertas, incluindo comanda 38/Mesa 1/R$ 127,00; `/financeiro/a-receber` listou 37 recebíveis identificados por Pedido e busca “Comanda 38” retornou 0 itens, sem cartão de comanda autônoma. |
| 71 | PASS | `/financeiro`: Visão geral financeira carregou vendas do período R$ 10.398,36, 167 pedidos, ticket R$ 62,27 e 127 refeições, iguais aos relatórios; mix após baixa Pix 5.871,46/Dinheiro 1.121,84. |
| 72 | PASS | `/pedidos`: Cozinha carregou 4 em preparo, 3 fora do prazo e 7 finalizados hoje; abrir #186 exibiu 3 itens/R$ 155,00, status e comandos operacionais, sem erro. Nenhum status foi alterado. |
| 73 | BLOCKED | `/pedidos` → #186 → Visualizar ticket abriu prévia com 3 itens e total R$ 155,00; `/fila-de-impressao` mostrou jobs #185/#186 aguardando 0/2 vias. A estação “Cozinha · Windows” estava **offline**, impedindo verificação de impressão física/consumo da fila. É preciso ligar a estação e imprimir um pedido de teste controlado. |

## Bugs reproduzidos e impacto

1. **Exportação inteira indisponível (bloqueador):** linhas 57–60, erro `orderHourFrom inválido.` para CSV/XLSX/PDF, sem arquivo. Código aponta serialização de `null` como string no POST; nenhuma correção foi aplicada. Em 320 px, o alerta também intercepta toques nas abas até recarregar.
2. **Atalho Mês anterior ausente:** linha 11; período de agosto só acessível manualmente.
3. **Comparação sem base mostra anterior zero:** linha 26; induz interpretação falsa de dado anterior inexistente.
4. **Menor duração põe pedido sem duração primeiro:** linha 50; ordenação perde significado para análise operacional.
5. **Pedido sem número na tabela/drawer:** linha 55; `#`/`null` dificulta identificação e acesso; UUID observado no drawer.

## Auditoria cruzada e combinações

- **Antes da baixa, M:** Visão geral/Vendas/Detalhado reconciliaram vendas R$ 10.398,36, 167 comerciais + 22 cancelados = 189 detalhados, ticket R$ 62,27, recebido R$ 7.431,36 e A receber R$ 2.889,00/38. Produtos = mercadoria R$ 10.328,36; taxa R$ 70,00 fica fora. Operação 42/162 = 25,93% no prazo.
- **Depois da baixa de R$ 3,00:** vendas/pedidos/mercadoria ficaram iguais; recebido = R$ 7.434,36, A receber = R$ 2.886,00/37; Pix e Dinheiro subiram R$ 1,00/R$ 2,00. Detalhado #172 passou a Pago. O painel financeiro de M continua R$ 10.320,36 (= recebido + pendente).
- **Combinações observadas:** período+modalidade (M/Entrega 93 operacionais); período+pagamento (M/Pix 110 comerciais); Entrega+Agendado+Atrasado (13); busca+status (Fernanda+Finalizado 39); A receber+busca Fernanda (16/R$ 1.132,00 após baixa); produto+período (Combo Família/M, 20); filtro+paginação (pageSize100 página2→Entrega página1); filtro+exportação falhou com o mesmo erro.
- **CSV/XLSX/PDF:** nenhum arquivo foi emitido. A comparação de arquivos com o modelo canônico está **BLOCKED** pelo bug das linhas 57–60; não foi inferido PASS a partir de teste unitário.
- **Capabilities:** o código e testes locais registram `reports.view` no acesso e `reports.export` no menu/API, com 403 em teste de API para exportar só com `reports.view`. Isso não substitui contas distintas no staging; linhas 5–6 permanecem BLOCKED. Falta testar também visualização sem `payments.receive`.

## Evidência automatizada e CI

- [Validate run 36210750261](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36210750261) e [Deploy staging run 36210748088](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36210748088): **SUCCESS** no SHA acima; deep-link smoke do deploy também passou. Os HEADs de branch e PR foram conferidos antes da execução.
- Local: suítes focadas Reporting **81/81**, `npm test` **2.438/2.438**, arquitetura PASS, lint exit 0 (**142 warnings**, incluindo três em Reporting), build PASS (chunks `AdminBootstrap` 1.252,25 kB e `exceljs.min` 930,42 kB), D1 local 31 migrações PASS e operation-profile D1 gate PASS.
- Dry-runs locais de Worker production/staging e Spec B D1 gate **não puderam ser confirmados neste sandbox Windows**: Wrangler reportou `Cannot read directory "../../../../../..": Access is denied.` / falha ao resolver `worker/index.js` ou `settingsProbeWorker.js`. O Validate exato-SHA os executou com sucesso em CI. A falha local de infraestrutura não foi tratada como falha funcional da aplicação, nem a revalidação local foi rotulada GREEN integral.
- Auditoria: `git diff --check` limpo antes da documentação, branch correta, sem mudanças de código. A documentação desta homologação é a única edição intencional.
