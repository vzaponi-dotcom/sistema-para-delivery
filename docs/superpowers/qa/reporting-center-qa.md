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

## Re-homologação funcional focada — 26/09/2026

**Aplicação re-homologada:** `b330fd66e43fd8f720363ed57da6933eac08d2df`, branch `feature/issue-34-reporting-center`, PR #72, staging autenticado da operação Amor & Sabor. Esta seção é uma nova rodada; a matriz histórica 1–73 acima permanece integralmente referente a `7583882ecad5bfe7a0d9994045c32ca084dbaf8b` e aos seus **58 PASS / 8 FAIL / 7 BLOCKED**.

- [Validate 36214127508](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36214127508) e [Deploy staging 36214125203](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36214125203): **SUCCESS**, ambos com `headSha=b330fd66e43fd8f720363ed57da6933eac08d2df`; o HEAD do PR #72 e da branch foi conferido nesse mesmo SHA antes dos testes. Não se executou deploy de produção.
- O calendário avançou para 26/09. Para repetir exatamente o recorte histórico de 01–25/09, usou-se `period=custom&from=2026-09-01&to=2026-09-25`. Os atalhos dinâmicos `today`, `7-days`, `30-days` e `current-month` terminam em 26/09 nesta rodada; a URL antiga `current-month&to=2026-09-25` já não representa o preset atual.
- A sessão de navegador automatizado aceitou ativação por Enter/Espaço dos controles. Os cliques de mouse do controlador não alteraram a página, logo as verificações de abertura e seleção abaixo foram feitas por teclado, com URL e estado da interface confirmados após cada ação.

### Retestes das correções sem dependência de arquivo

| Linha histórica | Estado no novo SHA | Evidência integrada no staging |
|---:|:---:|---|
| 11 | **PASS** | Em `/relatorios`, o grupo de período agora contém **Mês anterior**. Acioná-lo atualizou URL para `period=previous-month&from=2026-08-01&to=2026-08-31`, datas e botão pressionado. Visão geral mudou de 167 pedidos/R$ 10.398,36 em setembro para 0/R$ 0,00 em agosto. F5 e abertura direta da URL preservaram agosto e o estado selecionado. |
| 26 | **PASS** | Com `7-days&from=2026-09-20&to=2026-09-26`, Visão geral mostrou vendas R$ 4.264,00 versus R$ 1.436,50, +196,83%/Melhora; pedidos 51 versus 32, +59,38%/Melhora; dentro do prazo 17,39% versus 21,88%, −20,52%/Piora. Vendas preservou valores, anterior e direção. No recorte customizado 01–25/09, Vendas (R$ 10.398,36/167/R$ 62,27/R$ 7.434,36), Produtos (456 unidades/R$ 10.328,36/127 refeições), Detalhado (189/R$ 10.398,36/R$ 62,27/11,64%) e resumo móvel em 320 px exibiram **Comparação indisponível**, sem `anterior R$ 0,00` ou `anterior 0`; Visão geral mostrou **Sem base anterior**. PDF da Visão geral 01–26/09, inspecionado separadamente, também mostrou `Sem base comparável` sem fabricar anterior zero. |
| 50 | **PASS** | Detalhado 01–25/09, 189 pedidos: `sort=duration-asc` colocou #159 com **0 min** primeiro; os pedidos sem duração vieram depois dos medidos. Com 100 por página, o primeiro sem duração foi #186 na **posição global 163** (página 2, posição 63), após 162 durações numéricas. `sort=duration-desc` voltou à página 1 com #91/**2.995 min** primeiro. Paginação e ordenação permaneceram coerentes. |
| 55 | **PASS** | Com filtro de produto Combo Família, a linha do UUID `f9a1cb3b-d4fb-405f-b3ad-ca7027fa92a3` mostrou **Sem nº · f9a1cb3b**, ação acessível **Abrir pedido sem número f9a1cb3b** e botão **Ver pedido sem número f9a1cb3b**; não havia `#null` nem ação com `null`. Enter e Espaço na linha e Enter no botão abriram o mesmo UUID. O drawer exibiu **Pedido sem número**, **ID f9a1cb3b**, Mesa 1 e R$ 193,00. No resumo móvel de 320 px, a identificação permaneceu **Sem nº · f9a1cb3b**. |

### Regressão curta relacionada

- Hoje gerou `period=today&from=2026-09-26&to=2026-09-26`, 0 pedidos/R$ 0,00; 7 dias gerou 20–26/09, 51 pedidos/R$ 4.264,00; 30 dias gerou 28/08–26/09, 167 pedidos comerciais/R$ 10.398,36; Mês atual gerou 01–26/09, 167/R$ 10.398,36. As quatro respostas foram aguardadas após mudança de URL; a amostra de dados é consistente com não haver pedidos novos em 26/09.
- Detalhado 01–25/09 preservou 189 pedidos ao alternar 10/25/50/100 itens por página (`Mostrando 1–N de 189`); **Mais recentes** mostrou #186 primeiro. O drawer normal do #183 abriu com **Pedido #183**, status Finalizado, 21 itens, total/recebido R$ 432,00 e Dinheiro + Cartão de débito. O pedido sem número também abriu, conforme linha 55.
- Vendas mostrou A receber R$ 2.886,00/37; o link **Gerenciar em A receber** abriu `/financeiro/a-receber`, que mostrou 37 pendências/R$ 2.886,00. Não apareceu ação de registro de pagamento dentro de Reporting. A sessão atual exibe o menu de exportação, coerente com `reports.export`; sem usuário de papel reduzido, as linhas históricas 5–6 continuam BLOCKED.

### Linha 61 e demais limites da rodada

- **61 — BLOCKED:** o staging contém 189 pedidos no recorte de referência (também 189 no recorte de 30 dias observado), muito abaixo dos 10.000/10.001 necessários para exercitar a rejeição integrada sem truncamento. A cobertura automatizada de `worker/reporting/exportModel.test.js` não substitui a execução em staging. Não se criaram milhares de registros. A classificação da exportação normal e filtrada está registrada separadamente abaixo; o motivo desta linha é a ausência de dataset suficiente.
- **5, 6, 35, 46, 47 e 73 — BLOCKED mantidos:** seguem faltando as contas com capacidades reduzidas/sem `reports.view` (5–6), casos de timing legado identificados (35), histórico controlado de tamanho e renomeação de produto/categoria (46–47) e estação de impressão online para prova física (73). Esta rodada não gerou as contas, fixtures nem impressões necessárias.

### Exportações do Detalhado, sem filtros avançados

No recorte `view=detail&period=custom&from=2026-09-01&to=2026-09-25`, a tela mostrou **189 pedidos**, faturamento **R$ 10.398,36**, ticket **R$ 62,27** e cancelamento **11,64%**. CSV, XLSX e PDF foram baixados e inspecionados, sem o antigo alerta `orderHourFrom inválido.`. A auditoria normalizou data e moeda e comparou as **189 linhas CSV × 189 linhas XLSX, 11 colunas**, encontrando **zero divergências nas células**. O pedido #183 é R$ 432,00, recebido R$ 432,00, Dinheiro + Cartão de débito em ambos; a tela e o drawer confirmaram o mesmo valor. Três pedidos sem `order_number` aparecem como `Indisponível` nos dados de ambos os formatos, inclusive o de Mesa 1/R$ 193,00; isso não inventa um número, mas os arquivos não carregam o identificador curto mostrado na UI e, portanto, perdem rastreabilidade individual desses três pedidos.

| Linha histórica | Estado no novo SHA | Evidência e reprodução |
|---:|:---:|---|
| 57 — CSV | **PASS** | Detalhado 01–25/09 → Exportar relatório → CSV gerou `relatorio-detail-2026-09-01-2026-09-25.csv` (19.288 bytes). Os primeiros bytes são `EF BB BF` (BOM UTF-8); metadados incluem período, fuso `America/Sao_Paulo` e `sort=date-desc`; cabeçalhos em português `Pedido, Data, Cliente, Modalidade, Status, Total, Recebido, Pendente, Pagamento, Duração (min), Prazo`; **189 linhas de dados**. #183/R$ 432,00 e #186/R$ 155,00 conferem com a tela. Nenhum alerta `orderHourFrom inválido.`. A perda de referência curta para pedidos sem número fica registrada acima como defeito adicional de rastreabilidade. |
| 58 — XLSX | **FAIL** | Reproduzir: Detalhado 01–25/09 → Exportar relatório → XLSX → abrir `relatorio-detail-2026-09-01-2026-09-25.xlsx` → aba **Resumo**. O workbook abre com abas **Resumo** e **Dados**; Dados tem 189 linhas, datas como células de data, valores monetários numéricos (ex.: #183 = 432), e zero divergências por célula contra o CSV. Porém Resumo só contém `total=189`, `page=1`, `pageSize=25`, `totalPages=8`; **não contém os KPIs faturamento R$ 10.398,36, ticket R$ 62,27 e cancelamento 11,64%** exibidos na tela e no PDF. O requisito de KPIs no XLSX e a paridade do resumo continuam falhando, apesar do download funcional. O mesmo defeito foi observado em XLSX do Detalhado 28/08–26/09 gerado após o deploy. |
| 59 — PDF | **FAIL** | Reproduzir: Detalhado 01–25/09 → Exportar relatório → PDF → abrir `relatorio-detail-2026-09-01-2026-09-25.pdf`. O PDF tem uma página, período/fuso corretos, nenhum filtro adicional, 189 pedidos, R$ 10.398,36, R$ 62,27 e 11,64%; a comparação diz **Sem base comparável**, sem anterior zero, e a tabela completa não foi despejada. Porém a página identifica somente **Centro de Relatórios**, sem **Amor & Sabor**: a operação/identidade exigida em `docs/superpowers/specs/2026-09-25-reporting-center-design.md` §22.4 está ausente. O formato foi gerado, mas este requisito funcional não passou. |

### Exportações do Detalhado com dois filtros ativos

URL integrada: `view=detail&period=custom&from=2026-09-01&to=2026-09-25&receivable=unpaid&search=Fernanda`. A tela mostrou chips **Recebível: A receber** e **Busca: Fernanda**, **16 pedidos**, faturamento **R$ 1.132,00**, ticket **R$ 70,75** e cancelamento **0%**. Os arquivos com sufixo `(1)` foram gerados desse estado. O CSV tem metadados `receivable=unpaid` e `search=Fernanda` e 16 linhas; o XLSX tem `A receber=unpaid` e `Busca=Fernanda` e 16 linhas em Dados; o PDF tem uma página, 16 pedidos e os quatro KPIs iguais aos da tela. Todas as 16 linhas do CSV contêm Fernanda e pendência positiva; a soma de Total e Pendente é R$ 1.132,00. A comparação célula a célula CSV × XLSX, normalizando datas/moeda, teve **zero divergências**. Portanto, nenhum dos dois filtros foi ignorado na seleção dos pedidos.

| Linha histórica | Estado no novo SHA | Evidência e reprodução |
|---:|:---:|---|
| 60 — paridade de exportação filtrada | **FAIL** | Reproduzir: abrir a URL filtrada acima, confirmar 16/R$ 1.132,00 e os dois chips; exportar os três formatos e abrir `relatorio-detail-2026-09-01-2026-09-25 (1).*`. A seleção de 16 pedidos e R$ 1.132,00 **passa** nos três; porém a paridade integral de resumo/metadados **falha**: o XLSX mantém apenas `total/page/pageSize/totalPages` e omite R$ 1.132,00/R$ 70,75/0% que a tela e o PDF mostram; o PDF e o XLSX expõem o enum técnico `unpaid`, enquanto a tela apresenta **A receber**. O PDF também não identifica a operação. Pela regra desta rodada, download e população corretos não bastam para PASS se há divergência entre formatos/tela. O antigo erro `orderHourFrom inválido.` não apareceu. |

### Resultado consolidado e bugs ainda abertos

**63 PASS · 3 FAIL · 7 BLOCKED** na matriz 1–73 para o SHA novo: os FAIL históricos **11, 26, 50, 55 e 57** viraram PASS; **58, 59 e 60 permanecem FAIL por novos defeitos observados nos arquivos**; **5, 6, 35, 46, 47, 61 e 73** seguem BLOCKED pelos motivos concretos acima e na matriz histórica. Os demais PASS históricos não foram repetidos sem relação com as correções. A linha 61 continua BLOCKED **somente pela falta de dataset integrado acima de 10.000 pedidos**, não pelo antigo erro `orderHourFrom`, pois arquivos normais e filtrados foram gerados no staging.

**Bugs registrados, sem correção:** (1) Resumo XLSX do Detalhado sem KPIs, com chaves técnicas de paginação; (2) PDF sem identidade da operação exigida pela especificação; (3) enum técnico `unpaid` exposto nos resumos XLSX/PDF em vez do rótulo de recebível da tela; (4) três pedidos sem número perdem o identificador curto/UUID nos dados CSV/XLSX, embora não recebam número artificial. Os três primeiros mantêm a **exportação como blocker funcional para merge**, inclusive a auditoria cruzada completa da linha 60. Nenhum código, Spec ou plano foi alterado; não houve merge, PR ready nem produção.

## Re-homologação final focada das exportações — 26/09/2026

**SHA da aplicação homologada:** `a9d8c33937a11022f9e308a6b5bedf48cea66b64`, branch `feature/issue-34-reporting-center`, PR #72, staging da operação **Amor & Sabor**. Esta seção acrescenta evidência para as linhas 58–61; não reexecuta as demais linhas 1–73 nem reescreve os resultados das rodadas anteriores. [Validate application 36247093889](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36247093889) passou no SHA exato. [Deploy staging 36247090546](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36247090546) passou na **attempt 2**, no mesmo SHA; a attempt 1 teve timeout do smoke de propagação de asset após o deploy. Não houve deploy de produção.

### Recortes e arquivos inspecionados

- **Sem filtros avançados:** `/relatorios?view=detail&period=custom&from=2026-09-01&to=2026-09-25`. A tela mostrou **189 pedidos**, faturamento **R$ 10.398,36**, ticket **R$ 62,27**, cancelamento **11,64%** e comparação indisponível. Os arquivos novos com sufixo `(2)` foram gerados às 11:13, horário de São Paulo, após o deploy do SHA acima. CSV: 189 registros e 11 colunas, com BOM UTF-8; XLSX: abas Resumo e Dados, 189 registros em Dados; PDF: uma página executiva. A soma dos totais das 189 linhas é R$ 11.236,36 porque inclui 22 cancelados/R$ 838,00; os **167 pedidos comerciais somam R$ 10.398,36**, exatamente o KPI da tela.
- **Dois filtros ativos:** `/relatorios?view=detail&period=custom&from=2026-09-01&to=2026-09-25&receivable=unpaid&search=Fernanda`. A tela exibiu os chips **Recebível: A receber** e **Busca: Fernanda**, **11 pedidos**, **R$ 836,00**, ticket **R$ 76,00**, cancelamento **0%** e comparação indisponível. Os arquivos novos com sufixo `(3)` foram gerados às 11:14. O estado atual é diferente dos 16 pedidos/R$ 1.132,00 da rodada anterior; os valores históricos continuam documentados acima e não foram usados como expectativa para o staging atual. Os 11 pedidos exportados são de Fernanda, todos com pendência positiva; seus totais e pendências somam R$ 836,00.
- Os seis arquivos foram abertos e inspecionados localmente após o download manual na sessão autenticada. O navegador automatizado acionou a exportação, mas não entregou os Blobs ao inspetor; por isso, os arquivos novos foram baixados pela pessoa usuária. CSV × XLSX foi comparado em **todas as 189 e 11 linhas, 11 colunas, sem divergência semântica** após normalizar data, moeda e a representação de duração zero (`"0"` no CSV, `0` numérico no XLSX). Os dois PDFs foram extraídos e renderizados visualmente. Os arquivos não integram o commit documental.

| Recorte e formato | Bytes | SHA-256 do arquivo verificado |
|---|---:|---|
| Sem filtros `(2).csv` | 19.251 | `37997fa10e546c717244c3a74479551fc5e13d3aa53bf6a819a2b849bc9a1a6e` |
| Sem filtros `(2).xlsx` | 16.468 | `c7c7abe566ccd38d534acebb829a5f6c79f4494ad7d44f43bc41100cb4873e02` |
| Sem filtros `(2).pdf` | 5.189 | `ab36e22b987cdf7d23bced2ab25955884d473530748f30a4e312f6ae08c12acd` |
| Filtrado `(3).csv` | 1.623 | `9940d6c3dd8189491ab7a3bf30f77383905c2b107d6db2ea2404f56b2991067a` |
| Filtrado `(3).xlsx` | 8.304 | `48869075574271d1e12439b2ce6565f4ff7791e029efaf68b552c8fee9c71202` |
| Filtrado `(3).pdf` | 5.269 | `bb4b75f4364a5f1d65619bd4f60d1c7248d6f8bc7fcdbf51a6e8011246b6862c` |

### Reteste das linhas 58–61

| Linha | Estado neste SHA | Evidência integrada e reprodução |
|---:|:---:|---|
| 58 — XLSX | **PASS** | Abrir Detalhado 01–25/09 → Exportar relatório → XLSX → abrir `(2).xlsx`: workbook íntegro, abas **Resumo** e **Dados**, 189 linhas em Dados; datas são células de data com formato `dd/mm/yyyy`, Total/Recebido/Pendente são números com formato monetário. Resumo contém **Operação = Amor & Sabor**, **Pedidos no período = 189**, **Faturamento total = 10398,36**, **Ticket médio = 62,27**, **Taxa de cancelamento = 11,64**; não contém `total`, `page`, `pageSize` nem `totalPages` como KPIs. Repetir com os dois filtros e abrir `(3).xlsx`: Resumo identifica **Recebível = A receber**, **Busca = Fernanda**, 11/R$ 836,00/R$ 76,00/0%; Dados tem as mesmas 11 linhas do CSV. Nos dois recortes, paridade de 11 colunas com CSV sem divergência semântica. |
| 59 — PDF | **PASS** | Nos mesmos dois recortes, Exportar relatório → PDF → abrir e renderizar `(2).pdf` e `(3).pdf`. Cada PDF tem uma página com **Centro de Relatórios**, **Operação: Amor & Sabor**, período 01–25/09, data/hora de geração e fuso. O primeiro registra nenhum filtro adicional e KPIs 189/R$ 10.398,36/R$ 62,27/11,64%; o segundo registra **Recebível: A receber**, **Busca: Fernanda** e 11/R$ 836,00/R$ 76,00/0%. Ambos mostram **Sem base comparável**, sem anterior zero; resumo executivo informa a quantidade e remete as linhas completas ao CSV/XLSX, sem despejar a tabela. Não havia observação de qualidade adicional aplicável nesses recortes. |
| 60 — paridade filtrada | **PASS** | Abrir a URL filtrada acima, conferir os dois chips e 11/R$ 836,00/R$ 76,00/0% na tela; exportar CSV, XLSX e PDF novos `(3)`. Os três apresentam **Amor & Sabor**, período 01–25/09, **Recebível: A receber** e **Busca: Fernanda**; o enum `unpaid` não aparece como valor apresentado. CSV e XLSX contêm os **mesmos 11 IDs** (#182, #180, #176, #175, #173, #169, #166, #163, #157, #143, #135), todos de Fernanda e pendentes, com soma R$ 836,00 e zero divergência semântica nas 11 colunas. O Resumo XLSX e o PDF repetem os quatro KPIs da tela. |
| 61 — limite >10.000 | **BLOCKED** | As seis exportações comuns foram geradas e inspecionadas; o recorte integrado disponível continua com apenas **189** pedidos, muito abaixo de 10.000/10.001. Sem dataset de staging acima do limite, não é possível provar a rejeição explícita sem truncamento. Nenhum pedido em massa foi criado; teste unitário não substitui o ensaio integrado. |

### Regressão dos pedidos sem número e smoke relacionado

- Na UI com filtro de produto Combo Família, a linha do UUID `f9a1cb3b-d4fb-405f-b3ad-ca7027fa92a3` mostrou **Sem nº · f9a1cb3b**; o botão **Ver pedido sem número f9a1cb3b** abriu drawer **Pedido sem número**, **ID f9a1cb3b**, Mesa 1 e R$ 193,00. No CSV e na coluna Pedido do XLSX sem filtros, a mesma linha de Mesa 1/R$ 193,00 mostra **Sem nº · f9a1cb3b**. As outras duas linhas sem `order_number` também trazem referências estáveis **Sem nº · 66902e3c** e **Sem nº · 36433d67** nos dois arquivos. Não foi inventado número nem apareceu `#null` ou `Indisponível` como identificador.
- O drawer do pedido numerado **#183** abriu com 21 itens, total/recebido R$ 432,00 e pagamento Dinheiro + Cartão de débito. Reporting continuou somente leitura, sem comando de baixa. Em Vendas, **Gerenciar em A receber** navegou para `/financeiro/a-receber`; nesse momento, a tela de recebíveis mostrava 29 pendências/R$ 2.460,00, outro estado atual distinto do histórico. Nenhum pedido ou pagamento foi alterado neste smoke.

**Resultado vigente da matriz 1–73 no SHA `a9d8c33937a11022f9e308a6b5bedf48cea66b64`: 66 PASS / 0 FAIL / 7 BLOCKED.** Somente os FAIL 58, 59 e 60 da rodada anterior mudaram para PASS com arquivos e interface verificados. Permanecem BLOCKED **5, 6, 35, 46, 47, 61 e 73**, com os motivos concretos documentados nas seções anteriores; a linha 61 foi reavaliada acima. **Não há blocker funcional de exportação para merge** nesta rodada; os sete BLOCKED continuam como limites de homologação, sem conversão para PASS. Os bugs históricos permanecem registrados, sem correção de código nesta atividade. Não houve alteração de Spec/plano, merge, PR ready ou produção.
