# Gestão Delivery — Pagamento dividido em múltiplas formas (Issue #30)

**Data:** 2026-09-21  
**Status:** APROVADO pelo usuário em 2026-09-21; plano de implementação escrito e aguardando aprovação  
**Branch:** feature/split-payments  
**Base:** master em 56c693ee505631191d4b09926fb6237d865910f5  
**Base de origem:** merge do PR #55 — Print queue operational UX  
**Issue:** #30 — Permitir pagamento dividido em múltiplas formas na baixa  
**Produção:** não tocar nesta feature sem autorização separada

## 1. Objetivo

Permitir que um recebimento seja quitado usando uma ou várias formas de pagamento no mesmo ato, preservando a composição real do dinheiro recebido.

Exemplo:

- valor a receber: R$ 80,00;
- Dinheiro: R$ 30,00;
- Pix: R$ 50,00;
- total recebido: R$ 80,00;
- pedido/comanda: quitado integralmente.

A feature deve atender pedido avulso, A Receber, pagamento de comanda e Salvar e receber no Novo Pedido, usando uma única regra de domínio e uma única fonte de verdade financeira.

Esta feature não introduz pagamento parcial. O saldo de um pedido/comanda não pode permanecer parcialmente quitado depois de uma confirmação aceita.

## 2. Decisões de produto aprovadas

As decisões abaixo são normativas:

1. Pagamento dividido não significa pagamento parcial.
2. Toda confirmação aceita quita integralmente o valor oficial que está sendo recebido.
3. Um recebimento pode conter uma ou várias alocações por forma.
4. A mesma forma não pode aparecer duas vezes no mesmo recebimento.
5. Valores monetários de mutação usam centavos inteiros.
6. A soma das alocações deve ser exatamente igual ao valor oficial calculado pelo backend.
7. O backend valida todas as regras novamente; a UI não é autoridade financeira.
8. Não será salvo um método sintético como Dinheiro + Pix.
9. O recebimento terá identidade própria para representar corretamente uma ação que pode quitar um ou vários pedidos.
10. Pagamentos antigos continuam equivalentes a um recebimento com uma única alocação.
11. Pagamento de comanda registra a composição do recebimento da comanda, sem inventar qual método pagou qual pedido.
12. Cada alocação do recebimento deve refletir seu valor real no Financeiro.
13. Salvar e receber no Novo Pedido faz parte da V1.
14. Estorno dividido em múltiplas formas fica fora da V1.
15. Impressão/QZ fica fora do escopo funcional e recebe somente testes de não regressão.

## 3. Baseline técnico confirmado

A base desta feature é a master 56c693ee505631191d4b09926fb6237d865910f5.

Na base atual:

- o PR #55 está mergeado;
- o último Validate da branch do PR #55 foi SUCCESS com 1.975 testes / 1.974 pass / 0 fail / 1 skipped;
- a arquitetura pós-Spec C está vigente;
- pagamentos transversais pertencem a src/app/workflows/payments;
- Finance pertence a src/domains/finance;
- Orders pertence a src/domains/orders;
- Table Service pertence a src/domains/table-service;
- App.jsx faz composição, não deve voltar a possuir semântica de pagamento;
- pagamento de pedido usa src/app/workflows/payments/order/useOrderPaymentWorkflow.js;
- pagamento de comanda usa src/app/workflows/payments/table-tab/useTableTabPaymentWorkflow.js;
- os endpoints são adaptados por src/app/workflows/payments/paymentApi.js;
- o Worker ainda recebe um único method;
- payments.order_id é UNIQUE;
- payments contém um único method por pedido;
- o pagamento atual cria um único movimento de entrada por pedido;
- o checkout pago cria pedido + pagamento + movimento na mesma unidade atômica;
- paymentMethod ainda é consumido por badge, detalhe, A Receber, busca/filtros, Dashboard e estorno;
- Dashboard por forma de pagamento ainda deriva valor de order.paymentMethod + valor integral do pedido.

A feature deve corrigir o modelo sem quebrar as garantias atuais de quitação única, idempotência, conflitos, offline, capabilities e reconciliação.

## 4. Regra central: quitação integral com composição

### 4.1 Pedido avulso

Pedido de R$ 80,00:

~~~text
Recebimento R$ 80,00
├─ Dinheiro R$ 30,00
└─ Pix      R$ 50,00

Pedido #123
└─ quitado R$ 80,00
~~~

O pedido não possui saldo residual.

### 4.2 Comanda

Comanda com:

- Pedido A: R$ 20,00;
- Pedido B: R$ 30,00;
- Pedido C: R$ 30,00.

Pagamento:

- Dinheiro: R$ 30,00;
- Pix: R$ 50,00.

Representação conceitual:

~~~text
Recebimento da comanda R$ 80,00
├─ Dinheiro R$ 30,00
├─ Pix      R$ 50,00
└─ quita
   ├─ Pedido A R$ 20,00
   ├─ Pedido B R$ 30,00
   └─ Pedido C R$ 30,00
~~~

Não distribuir artificialmente Dinheiro/Pix entre os pedidos.

## 5. Fora de escopo

Não faz parte desta V1:

- pagamento parcial de pedido;
- saldo remanescente após um recebimento;
- parcelamento;
- crediário;
- múltiplas baixas sucessivas do mesmo pedido;
- estorno parcial;
- estorno dividido em múltiplas formas;
- integração bancária;
- captura automática de Pix/cartão;
- conciliação de adquirente;
- alteração da fila de impressão;
- alteração de QZ Tray;
- implementação do Centro de Relatórios #34;
- redesign geral de Financeiro, Cozinha, Histórico ou Comandas.

## 6. Terminologia

### 6.1 Receipt / recebimento

Representa um único ato aceito de recebimento.

Um receipt:

- pertence a um business;
- possui valor total;
- possui data/hora;
- possui uma ou mais allocations;
- pode quitar um pedido ou vários pedidos;
- pode ter contexto de comanda;
- é a identidade financeira da operação.

### 6.2 Allocation / alocação

Representa a parcela do receipt atribuída a uma forma de pagamento.

Exemplo:

~~~json
[
  {
    "methodCode": "cash",
    "methodLabel": "Dinheiro",
    "amountCents": 3000
  },
  {
    "methodCode": "pix",
    "methodLabel": "Pix",
    "amountCents": 5000
  }
]
~~~

### 6.3 Payment

Continua representando a quitação de um pedido.

A garantia de no máximo uma quitação por pedido deve ser preservada.

### 6.4 Movement

Continua representando efeito no fluxo de caixa.

Para vendas, o valor por forma deve refletir as allocations do receipt, não uma forma sintética por pedido.

## 7. Modelo de persistência alvo

A fonte oficial da composição passa a ser normalizada.

### 7.1 payment_receipts

Criar entidade equivalente a:

~~~text
payment_receipts
- id
- business_id
- total_cents
- table_tab_id nullable
- paid_at
- created_at
~~~

Regras:

- total_cents > 0;
- business_id obrigatório;
- table_tab_id identifica pagamento integral de comanda quando aplicável;
- um receipt não é um substituto do payment por pedido.

### 7.2 payment_allocations

Criar entidade equivalente a:

~~~text
payment_allocations
- id
- business_id
- receipt_id
- method_code
- method_label
- amount_cents
- created_at
~~~

Regras:

- amount_cents > 0;
- receipt obrigatório;
- method_code obrigatório para novas mutações;
- method_label é snapshot de apresentação;
- não pode haver dois métodos canônicos iguais no mesmo receipt;
- a soma das allocations do receipt deve corresponder a payment_receipts.total_cents.

Para histórico legado excepcional que não possa ser mapeado com segurança a um código atual, a migração deve preservar os bytes/label históricos sem reclassificação silenciosa. Nenhum dado histórico deve ser convertido para Outro apenas por conveniência.

### 7.3 payments

Payments continua com uma linha por pedido.

Deve ganhar relação explícita com receipt:

~~~text
payments
- id
- business_id
- order_id UNIQUE
- receipt_id
- amount_cents
- paid_at
- created_at
~~~

payments.method deixa de ser fonte de verdade.

A implementação pode:

- removê-lo fisicamente depois do backfill; ou
- mantê-lo temporariamente como coluna histórica nullable durante a migração.

Em qualquer alternativa:

- nenhuma composição nova pode ser codificada em payments.method;
- não salvar Dinheiro + Pix;
- não salvar Múltiplas formas;
- nenhum consumidor de produção pode depender de payments.method após a feature;
- uma eventual retenção física da coluna deve ser tratada como compatibilidade de schema, não contrato funcional.

### 7.4 movements

Movements deve conseguir apontar para a origem normalizada do recebimento.

Adicionar conceito equivalente a:

- receipt_id;
- payment_allocation_id.

Para movimento automático de venda:

- uma allocation produz um movimento de entrada;
- o valor do movimento é exatamente allocation.amount_cents;
- payment_method continua podendo guardar o snapshot de apresentação da allocation;
- payment_allocation_id identifica a parcela;
- receipt_id identifica o recebimento;
- para receipt de um único pedido, order_id/payment_id podem continuar preenchidos;
- para receipt de comanda com múltiplos pedidos, não inventar um order_id/payment_id arbitrário para a allocation.

O vínculo com receipt/allocation é a fonte de auditoria do movimento automático.

## 8. Migração dos dados existentes

A migration deve ser aditiva/backfill-first e preservar todos os pagamentos históricos.

Para cada payment histórico:

1. criar um receipt equivalente ao valor já pago;
2. criar uma allocation equivalente à forma já persistida;
3. ligar o payment existente ao receipt;
4. ligar o movimento order-payment existente ao receipt/allocation quando houver correspondência segura;
5. preservar paid_at, created_at, amount e forma histórica;
6. não alterar o total do pedido;
7. não duplicar movimento;
8. não duplicar receita;
9. não alterar status de pagamento;
10. não alterar estornos históricos.

Depois do backfill:

- pagamento antigo simples = receipt com uma allocation;
- pagamento novo simples = receipt com uma allocation;
- pagamento novo dividido = receipt com N allocations.

A migração deve passar clean install e upgrade sobre base histórica representativa.

## 9. Invariantes monetários

Todas as mutações usam amountCents.

É proibido usar comparação de floats para fechar a composição.

Backend deve rejeitar:

- allocations ausente;
- array vazio;
- valor zero;
- valor negativo;
- valor não inteiro;
- valor acima de Number safe integer;
- método ausente;
- método desconhecido para nova mutação;
- método inativo;
- método duplicado;
- soma abaixo do valor oficial;
- soma acima do valor oficial.

Regra principal:

~~~text
sum(allocation.amount_cents) = authoritative_amount_cents
~~~

O authoritative_amount_cents vem do banco/servidor, nunca do total informado pelo cliente.

## 10. Política de formas de pagamento

A feature deve continuar usando a configuração efetiva de formas de pagamento do negócio.

Ao confirmar:

- cada allocation deve resolver um método canônico;
- todos os métodos selecionados devem estar ativos;
- os métodos devem ser únicos por código canônico;
- a validação deve ser protegida contra mudança concorrente de policy;
- se qualquer método ficar inválido/inativo antes do commit, toda a operação falha;
- nenhuma escrita parcial pode sobreviver.

Erro de mudança concorrente mantém semântica POLICY_CHANGED / 409 já existente.

Na UI:

- se uma forma selecionada se tornar inativa enquanto o diálogo está aberto, a composição entra em estado de revisão;
- confirmar fica bloqueado;
- o sistema não troca silenciosamente a forma por outra.

## 11. Contrato de API

O contrato novo para recebimentos de pedido/comanda deve usar allocations.

Exemplo:

~~~json
{
  "allocations": [
    {
      "methodCode": "cash",
      "amountCents": 3000
    },
    {
      "methodCode": "pix",
      "amountCents": 5000
    }
  ]
}
~~~

O frontend não envia total autoritativo.

O servidor retorna efeitos oficiais suficientes para atualizar as coleções sem otimismo.

### 11.1 Pedido

POST /api/orders/:id/payment

Entrada:

- allocations.

Saída conceitual:

~~~json
{
  "receipt": {},
  "allocations": [],
  "payment": {},
  "order": {},
  "movements": [],
  "tableTab": null
}
~~~

### 11.2 Comanda

POST /api/table-tabs/:id/payment

Entrada:

- allocations.

Saída conceitual:

~~~json
{
  "receipt": {},
  "allocations": [],
  "orders": [],
  "payments": [],
  "movements": [],
  "tableTab": {},
  "tables": []
}
~~~

### 11.3 Compatibilidade de payload antigo

Não criar uma facade permanente method -> allocations.

Se durante o plano de implementação for comprovada necessidade real de aceitar payload antigo por uma janela de cache/deploy, essa compatibilidade deve:

- ser temporária;
- ser testada;
- ser registrada explicitamente como dívida com remoção programada;
- normalizar internamente para uma allocation;
- não sobreviver silenciosamente como segundo contrato oficial.

A preferência da feature é um único contrato novo.

## 12. Pagamento de pedido avulso

O workflow atual deve continuar owner de:

- tentativa;
- double-submit;
- sync guard;
- request key;
- 409;
- resultado incerto;
- aplicação de efeitos oficiais;
- fechamento/preservação de diálogo;
- capabilities;
- offline.

A mudança semântica é:

~~~text
owner.method
~~~

torna-se composição equivalente a:

~~~text
owner.allocations
~~~

Garantias existentes permanecem:

- double click envia um POST;
- resposta de tentativa antiga não fecha tentativa nova;
- sessão antiga não altera sessão nova;
- 409 faz refresh sem repetir POST;
- rede/5xx faz refresh sem marcar Pago por otimismo;
- Cozinha/Histórico respeitam elegibilidade operacional;
- A Receber continua podendo abrir o mesmo fluxo;
- pagamento aceito pode fechar comanda quando for o último pendente, como hoje.

## 13. A Receber

A Receber reutiliza exatamente o mesmo workflow de pagamento de pedido.

Não criar lógica paralela de composição.

Depois de pago, a apresentação deve conseguir mostrar:

- data da quitação;
- valor total;
- uma forma, quando simples;
- resumo de múltiplas formas;
- detalhe das allocations quando o usuário abre o recebimento/pedido.

Filtros e buscas que hoje dependem de paymentMethod devem encontrar qualquer forma presente nas allocations.

## 14. Pagamento de comanda

O valor oficial a receber é o saldo integral dos pedidos ainda não pagos da comanda naquele momento.

A mutação deve ser atômica:

1. ler comanda aberta;
2. identificar pedidos não cancelados e ainda não pagos;
3. calcular authoritative_amount_cents;
4. validar allocations;
5. validar política de todos os métodos;
6. criar um receipt;
7. criar N allocations;
8. criar uma linha payment para cada pedido pendente, todas ligadas ao mesmo receipt;
9. criar um movimento de entrada por allocation;
10. fechar a comanda;
11. limpar assertions/transação;
12. retornar estado oficial.

Se houver conflito de pedido/comanda, nada é persistido parcialmente.

A reconciliação do frontend continua owner-based e deve provar:

- comanda fechada;
- todos os pedidos retornados pagos;
- movimentos retornados presentes;
- receipt/allocations aceitos presentes quando usados na receipt de autoridade;
- mesa livre ou corretamente reocupada;
- nenhuma repetição automática de POST.

## 15. Novo Pedido — Salvar e receber

Salvar e receber faz parte da V1.

Hoje o checkout aceita paymentMethod e cria pagamento/movimento junto da criação do pedido.

O novo comportamento:

- Salvar pedido sem receber continua sem allocations;
- Salvar e receber abre/usa o mesmo editor de composição;
- o payload pago carrega allocations;
- o backend calcula o total oficial do checkout;
- order + items + table-tab quando necessário + receipt + allocations + payment + movimentos + print job automático permanecem na mesma unidade atômica já exigida pelo checkout;
- replay por idempotency key continua retornando a operação originalmente aceita;
- replay não cria novo receipt;
- replay não cria novos movimentos;
- mudança posterior da policy não invalida replay já confirmado.

Impressão automática continua com a semântica atual e não é redesenhada.

## 16. Editor reutilizável de composição

Criar um componente/contrato compartilhado dentro da camada de workflow de pagamentos, conceitualmente PaymentCompositionEditor.

Responsabilidades:

- receber valor total em centavos;
- receber opções efetivas;
- receber método padrão;
- manter linhas locais;
- expor allocations válidas;
- calcular total informado;
- calcular restante;
- detectar excesso;
- detectar duplicidade;
- detectar seleção inativa;
- adicionar linha;
- remover linha;
- ser reutilizado por pedido, comanda e checkout pago.

Não pertence a Finance UI isoladamente porque é parte de um workflow cross-domain.

## 17. UX aprovada

### 17.1 Fluxo simples

O fluxo com uma forma deve continuar rápido.

Ao abrir:

- existe uma linha;
- usa a forma padrão efetiva;
- o valor inicia com o total integral;
- Confirmar pode estar habilitado imediatamente se não houver outro bloqueio.

### 17.2 Adicionar forma

Ação visível:

Adicionar forma de pagamento

Cada linha contém:

- forma;
- valor;
- remover, quando houver mais de uma linha.

Ao adicionar nova linha:

- não alterar silenciosamente valores já informados;
- nova forma não pode duplicar outra;
- o operador ajusta a composição;
- total/restante atualizam em tempo real.

### 17.3 Resumo

Mostrar sempre:

- Total a receber;
- Total informado;
- Restante.

Estados:

- restante > 0: incompleto;
- restante = 0: composição fechada;
- informado > total: inválido.

### 17.4 Confirmação

Confirmar pagamento fica desabilitado se:

- offline;
- sem capability;
- submitting;
- sem allocation;
- forma ausente;
- forma inativa/revisão;
- método duplicado;
- valor <= 0;
- soma diferente do total.

## 18. Apresentação pós-pagamento

Nenhuma tela deve tratar uma string sintética como forma real.

Introduzir projeção/helper público de apresentação de pagamento.

### 18.1 Pagamento simples

Pode exibir:

~~~text
Pago · Pix
~~~

### 18.2 Pagamento misto compacto

Pode exibir:

~~~text
Pago · 2 formas
~~~

ou, onde houver espaço:

~~~text
Pago · Dinheiro + Pix
~~~

A concatenação é somente apresentação derivada.

### 18.3 Detalhe

Exibir:

~~~text
Pagamento

Dinheiro        R$ 30,00
Pix             R$ 50,00
------------------------
Total           R$ 80,00
~~~

### 18.4 Compatibilidade do read model de Order

O Order oficial deve expor composição estruturada, conceitualmente:

~~~json
{
  "paymentStatus": "Pago",
  "paymentId": "pay-1",
  "paymentReceiptId": "receipt-1",
  "paidAmount": 80,
  "paidAt": "2026-09-21T12:00:00.000Z",
  "paymentAllocations": [
    {
      "methodCode": "cash",
      "methodLabel": "Dinheiro",
      "amount": 30
    },
    {
      "methodCode": "pix",
      "methodLabel": "Pix",
      "amount": 50
    }
  ]
}
~~~

paymentMethod pode permanecer como projeção de compatibilidade somente para recebimento de uma única allocation.

Para múltiplas allocations:

- não retornar Dinheiro + Pix como paymentMethod oficial;
- preferir null/ausência e obrigar consumidores migrados a usar paymentAllocations/helper.

Ao final da feature, nenhum consumidor visual/analítico relevante deve depender de paymentMethod para pagamentos mistos.

## 19. Financeiro

Cada allocation gera um movimento de entrada correspondente.

Exemplo:

- receipt R$ 80;
- Dinheiro R$ 30;
- Pix R$ 50.

Movimentos:

- entrada Vendas / Dinheiro / R$ 30;
- entrada Vendas / Pix / R$ 50.

O total financeiro continua R$ 80.

Regras:

- não gerar R$ 80 por allocation;
- não gerar R$ 80 por pedido em comanda;
- não duplicar receita;
- movimentos automáticos continuam não editáveis manualmente;
- filtros por forma devem encontrar a allocation correta;
- recebido do dia continua somando movimentos reais de venda menos estornos aplicáveis.

## 20. Dashboard e métricas atuais

A quebra por forma de pagamento não pode mais usar:

~~~text
order.paymentMethod + order.total
~~~

Ela deve usar fonte financeira normalizada:

- movements ligados a allocations; ou
- payment_allocations diretamente.

A escolha entre as duas fica para o plano desde que:

- total por forma reconcilie com total recebido;
- não haja duplicidade;
- pagamento de comanda seja contado uma vez por allocation;
- Dashboard e futuro Reporting possam compartilhar a mesma semântica.

Outros KPIs de pedidos não devem ser redesenhados nesta feature.

## 21. Estorno e cancelamento com estorno

A V1 continua com estorno integral em uma única forma escolhida pelo operador.

### 21.1 Pagamento original simples

Pode continuar sugerindo a forma original, sujeito às regras atuais de método inativo/revisão.

### 21.2 Pagamento original misto

Não existe uma única forma original por pedido.

A UI deve:

- mostrar a composição do receipt original;
- não fingir que uma das allocations pertence especificamente ao pedido;
- exigir escolha explícita de uma forma ativa para o estorno;
- não preselecionar silenciosamente Dinheiro/Pix a partir da primeira allocation;
- estornar o valor integral do payment daquele pedido.

Para um payment originado de comanda mista, a composição exibida é a composição do recebimento da comanda e deve ser rotulada como tal.

Estorno dividido fica fora da V1.

## 22. Busca, filtros e histórico

Qualquer busca/filtro que hoje usa order.paymentMethod deve ser migrada.

Para um pagamento misto Dinheiro + Pix:

- busca por Dinheiro encontra;
- busca por Pix encontra;
- busca por forma não depende de uma string concatenada persistida;
- histórico mantém composição mesmo se método for desativado futuramente.

Métodos históricos inativos continuam aparecendo na leitura, sem virar opção válida para nova mutação.

## 23. Runtime e aplicação de efeitos oficiais

O runtime permanece payment-agnostic.

Não reintroduzir bridge de pagamento removido na C6.

applyOfficialEffects pode receber efeitos estruturados já aceitos, por exemplo:

- order;
- orders;
- movement;
- movements;
- tableTab;
- tables.

Se receipt/allocations precisarem virar coleções oficiais de bootstrap, isso deve ser justificado pelo plano.

Preferência:

- Order read model carrega sua composição suficiente para UI;
- movimentos carregam receipt/allocation ids necessários para Finance;
- workflows não criam um novo store paralelo sem necessidade.

Nenhum estado financeiro otimista deve substituir resposta oficial.

## 24. Boundaries arquiteturais

### 24.1 app/workflows/payments

Owner de:

- composição da mutação;
- editor compartilhado;
- tentativa;
- double-submit;
- sync/owner;
- API cross-domain;
- UI de confirmação de pagamento;
- reconciliação de comanda.

### 24.2 domains/finance

Owner de:

- catálogo/projeção de formas;
- configurações de formas;
- regras/projeções financeiras;
- Financeiro;
- A Receber como UI financeira, composta via app quando cruza Orders.

Finance não importa internals de Orders/Table Service.

### 24.3 domains/orders

Owner de:

- ciclo do pedido;
- read model/apresentação pública do pedido;
- checkout;
- detalhe/badge;
- regras order-specific.

### 24.4 domains/table-service

Owner de:

- mesa;
- comanda;
- seleção/detalhe de comanda.

Não passa a possuir semântica financeira.

### 24.5 Worker

A lógica de recebimentos deve ser extraída de repositories.js se isso reduzir o risco e a coesão justificar.

Direção preferida:

~~~text
worker/
  paymentRepository.js
  paymentValidation.js
~~~

Não fazer refatoração ampla do Worker sem relação com #30.

## 25. Capabilities e offline

Preservar capabilities existentes.

A feature não cria permissões novas por padrão.

Onde hoje o usuário pode receber pagamento:

- continua podendo, agora com composição.

Onde hoje não pode:

- continua bloqueado.

Offline:

- não permitir confirmação;
- não criar estado Pago otimista;
- não enfileirar pagamento local para envio posterior.

## 26. Conflitos, idempotência e resultados incertos

Preservar comportamento comprovado pela C6.

### 26.1 Pedido

- duplicate payment continua conflito;
- um pedido já pago não aceita novo receipt;
- network/5xx não permite reenviar automaticamente;
- refresh/reconciliação determina autoridade;
- double-submit = um POST.

### 26.2 Comanda

- alteração concorrente dos pedidos/comanda invalida mutação;
- nenhum payment parcial do batch pode sobreviver;
- nenhuma allocation parcial pode sobreviver;
- nenhum movimento parcial pode sobreviver;
- retry de reconciliação faz leitura, não novo POST.

### 26.3 Checkout

- idempotency key continua protegendo criação;
- replay retorna receipt original;
- não duplica order/payment/allocation/movement/print job.

## 27. Atomicidade

As seguintes operações devem ser atômicas:

### Pedido avulso

- policy assertions;
- receipt;
- allocations;
- payment;
- movements;
- possível fechamento da comanda vinculada;
- assertion cleanup.

### Comanda

- policy assertions;
- receipt;
- allocations;
- payments de todos os pedidos pendentes;
- movements das allocations;
- fechamento da comanda;
- assertion cleanup.

### Checkout pago

- order;
- items;
- table tab quando necessário;
- receipt;
- allocations;
- payment;
- movements;
- automatic print job;
- policy assertions/cleanup.

Falha em qualquer etapa = nenhuma persistência parcial.

## 28. Acessibilidade, mobile e temas

O editor deve funcionar em:

- desktop claro;
- desktop escuro;
- mobile claro;
- mobile escuro.

Requisitos:

- labels explícitos;
- valores com leitura clara;
- botão remover com nome acessível;
- erro/restante não depender apenas de cor;
- foco preservado ao adicionar/remover linha;
- ordem de tabulação coerente;
- touch targets compatíveis com mobile;
- nenhum overflow horizontal;
- teclado numérico apropriado para valor quando aplicável;
- submit acessível via formulário.

## 29. Testes obrigatórios de backend

Cobrir pelo menos:

1. uma allocation simples;
2. Dinheiro + Pix;
3. três formas;
4. soma abaixo;
5. soma acima;
6. zero;
7. negativo;
8. não inteiro;
9. método duplicado;
10. método desconhecido;
11. método inativo;
12. policy muda durante commit;
13. pedido já pago;
14. cancelado não recebe;
15. atomicidade em falha intermediária;
16. receipt + allocations + payment + movements reconciliam;
17. comanda com vários pedidos gera um receipt;
18. comanda não inventa allocation por pedido;
19. comanda com pedido já pago cobra somente saldo pendente;
20. conflito de comanda deixa zero escrita parcial;
21. checkout pago simples;
22. checkout pago misto;
23. replay de checkout não duplica;
24. migration backfill de payment histórico;
25. migration preserva estorno histórico;
26. clean install;
27. upgrade;
28. business scoping em todas as novas queries.

## 30. Testes obrigatórios de frontend/workflows

Cobrir pelo menos:

1. abre com método padrão + total integral;
2. pagamento simples continua rápido;
3. adicionar forma;
4. remover forma;
5. restante recalcula;
6. excesso invalida;
7. duplicidade invalida;
8. zero invalida;
9. método inativo exige revisão;
10. double submit;
11. 409;
12. network/5xx;
13. stale session;
14. tentativa A não fecha B;
15. Cozinha;
16. Histórico;
17. A Receber;
18. comanda;
19. checkout Salvar e receber;
20. badge simples;
21. badge misto;
22. detalhe com allocations;
23. busca por qualquer forma;
24. A Receber pago com composição;
25. refund simples preserva comportamento;
26. refund misto exige escolha explícita;
27. Dashboard por forma usa parcelas reais.

## 31. Não regressão de impressão

A feature não altera Printing.

Mesmo assim os gates devem provar:

- criação paga continua criando o print job automático como hoje;
- pedido pendente continua criando impressão conforme regras atuais;
- receipt/allocation não altera número de vias;
- comanda não muda print-document/print-jobs;
- nenhum import QZ novo aparece fora da infraestrutura autorizada;
- fila central e recovery permanecem intactos.

Não executar mudanças físicas de QZ como parte desta feature.

## 32. Homologação manual mínima em staging

Registrar PASS/FAIL/BLOCKED:

1. Pedido R$ X 100% Pix;
2. Pedido 100% Dinheiro;
3. Pedido Dinheiro + Pix;
4. Pedido com três formas;
5. remover segunda forma;
6. valor abaixo;
7. valor acima;
8. zero;
9. método duplicado;
10. método desativado com modal aberto;
11. double click;
12. offline;
13. Cozinha;
14. Histórico;
15. A Receber;
16. Salvar pedido pendente;
17. Salvar e receber simples;
18. Salvar e receber misto;
19. Comanda com um pedido;
20. Comanda com vários pedidos;
21. Comanda com pedido previamente pago;
22. mesa é liberada após quitação;
23. Financeiro mostra valores por forma corretos;
24. recebido total não duplica;
25. Dashboard por forma reconcilia;
26. detalhe do pedido mostra composição;
27. busca encontra Dinheiro/Pix;
28. estorno de pagamento simples;
29. estorno de pagamento misto;
30. mobile claro;
31. mobile escuro;
32. desktop claro;
33. desktop escuro;
34. console sem novo erro;
35. impressão automática sem regressão observável de software.

Capabilities sem identidade adequada devem permanecer BLOCKED, nunca convertidas em PASS por teste automatizado.

## 33. Critérios de aceite

A feature só pode ser considerada completa quando:

- [ ] pagamento simples continua funcionando;
- [ ] pagamento dividido funciona com duas ou mais formas;
- [ ] pagamento parcial continua impossível;
- [ ] backend exige soma exata;
- [ ] backend usa total oficial;
- [ ] zero/negativo/duplicado são rejeitados;
- [ ] todos os métodos são validados contra policy ativa;
- [ ] receipt é persistido;
- [ ] allocations são persistidas;
- [ ] payments continuam únicos por pedido;
- [ ] comanda usa um receipt para a ação de recebimento;
- [ ] não existe distribuição fictícia de métodos entre pedidos;
- [ ] movimentos refletem cada allocation;
- [ ] total recebido não duplica;
- [ ] histórico antigo é migrado sem perda;
- [ ] nenhum registro histórico recebe método sintético;
- [ ] Order expõe composição estruturada;
- [ ] badge/detalhe/A Receber usam composição;
- [ ] busca encontra qualquer forma;
- [ ] Dashboard deixa de multiplicar o total do pedido por uma forma única;
- [ ] checkout Salvar e receber usa o mesmo conceito;
- [ ] estorno misto não inventa método original do pedido;
- [ ] C6 boundaries permanecem;
- [ ] App.jsx não recupera ownership de pagamento;
- [ ] runtime não recupera bridge de pagamento;
- [ ] impressão/QZ não é alterada funcionalmente;
- [ ] full automated gates passam;
- [ ] staging é homologado;
- [ ] produção não é executada sem autorização explícita.

## 34. Relação com Reporting #34

O issue #34 já depende do #30.

Esta feature deve deixar uma fonte de verdade capaz de responder futuramente:

- recebido total;
- recebido por forma;
- composição de cada receipt;
- drill-down para pedidos/comanda;
- estornos separados de recebimentos.

Reporting não deve precisar inferir forma de pagamento pelo total do pedido.

A fonte preferencial será payment_allocations e/ou movimentos ligados a allocations, conforme consolidado no plano.

## 35. Estratégia de implementação prevista

A especificação não autoriza implementação ainda.

Depois da aprovação escrita deste documento, o plano deve dividir a execução em aproximadamente sete tasks:

1. schema/migration + domínio de composição;
2. backend de pedido;
3. backend de comanda;
4. checkout Salvar e receber;
5. editor reutilizável + pedido/A Receber;
6. comanda + read projections + Finance/Dashboard/refund compatibility;
7. architecture gates + full validation + staging QA.

Cada task comportamental deve seguir TDD RED → GREEN com evidência por SHA.

## 36. Autorrevisão

Esta Spec foi revisada contra a master atual e os seguintes riscos foram explicitamente tratados.

### 36.1 Risco: transformar split em pagamento parcial

Resolvido: a soma precisa fechar o valor integral oficial em uma única mutação.

### 36.2 Risco: quebrar UNIQUE de payment por pedido

Resolvido: payment permanece quitação por pedido; receipt é a entidade da composição.

### 36.3 Risco: inventar qual método pagou qual pedido na comanda

Resolvido: allocations pertencem ao receipt da comanda, não a cada pedido.

### 36.4 Risco: duplicar receita

Resolvido: movements de venda seguem allocations e reconciliam com receipt.total_cents.

### 36.5 Risco: persistir Dinheiro + Pix em texto

Resolvido: composição é estruturada; texto concatenado é apenas apresentação derivada.

### 36.6 Risco: deixar consumidores antigos usando paymentMethod

Resolvido: badge, detalhe, A Receber, busca, Dashboard e estorno entram explicitamente no escopo.

### 36.7 Risco: checkout continuar com contrato antigo

Resolvido: Salvar e receber foi incluído e mantém atomicidade/idempotência.

### 36.8 Risco: estorno de comanda mista assumir método errado

Resolvido: mostrar composição do receipt e exigir escolha explícita de método de estorno.

### 36.9 Risco: voltar lógica ao App/runtime

Resolvido: ownership continua em app/workflows/payments e boundaries pós-C6 permanecem normativos.

### 36.10 Risco: mexer na impressão recém-estabilizada

Resolvido: Printing/QZ ficam fora do escopo; somente regressões de integração são testadas.

### 36.11 Risco: migração histórica perder semântica

Resolvido: backfill 1 payment -> 1 receipt -> 1 allocation preserva bytes, valores e datas; métodos desconhecidos não são silenciosamente reclassificados.

### 36.12 Risco: cálculo monetário por float

Resolvido: payload e validação usam centavos inteiros.

## 37. Gate para o próximo passo

**Plano escrito:** `docs/superpowers/plans/2026-09-21-split-payments-plan.md`


Depois da aprovação explícita desta Spec:

1. escrever plano TDD detalhado;
2. autorrevisar o plano contra todos os critérios;
3. não implementar antes da aprovação do plano;
4. não trabalhar em master;
5. não fazer deploy de produção.
