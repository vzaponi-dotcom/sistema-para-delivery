# Design: pedidos com múltiplos itens e ajustes de preço

Data: 2026-09-01

## Objetivo

Evoluir o cadastro de pedidos de um modelo de produto único para um pedido composto por vários itens, preservando a operação atual, o histórico, a cobrança e o financeiro.

O novo fluxo deve permitir que um único pedido contenha, por exemplo, marmita, refrigerante e doce. Cada item deve partir do preço cadastrado no produto, mas o atendente poderá ajustar o preço unitário daquele item quando necessário. O pedido também poderá receber desconto ou acréscimo geral, em valor fixo ou percentual, com motivo opcional.

## Decisões aprovadas

- `items` passa a ser a fonte oficial dos produtos de um pedido.
- Pedidos antigos com `productName` e `quantity` serão migrados automaticamente em memória para um array `items` com uma linha.
- O seletor de produto no novo pedido exibirá apenas o nome do produto.
- O preço unitário será preenchido automaticamente pelo preço cadastrado em Produtos.
- O preço unitário de um item poderá ser alterado no pedido.
- O preço original do catálogo continuará salvo no item para manter rastreabilidade histórica.
- O motivo da alteração de preço será opcional.
- O pedido poderá ter desconto ou acréscimo geral.
- O ajuste geral poderá ser em reais ou percentual; reais será o padrão.
- O motivo do ajuste geral será opcional.
- Ao adicionar novamente o mesmo produto pelo preço padrão, a quantidade da linha existente será somada automaticamente.
- Quando o mesmo produto tiver preço unitário diferente, ele permanecerá em uma linha separada.
- O desconto nunca poderá reduzir o total abaixo de zero.
- Pagamento continuará sendo feito sobre o total final do pedido inteiro.
- Nesta primeira versão, pedidos salvos não serão editáveis. Correção posterior de pedido fica fora do escopo.

## Modelo de dados

Um pedido novo terá a seguinte estrutura conceitual:

```js
{
  id,
  clientId,
  client,
  type,
  orderDate,
  createdAt,
  finishedAt,
  status,

  items: [
    {
      lineId,
      productId,
      name,
      category,
      size,
      quantity,
      catalogPrice,
      unitPrice,
      priceReason
    }
  ],

  subtotal,

  adjustment: {
    type: 'none' | 'discount' | 'surcharge',
    mode: 'fixed' | 'percentage',
    value,
    amount,
    reason
  },

  total,

  paymentStatus,
  paymentMethod,
  paidAt,
  paidAmount
}
```

### Por que salvar `catalogPrice` e `unitPrice`

`catalogPrice` registra o preço do produto no momento da venda. `unitPrice` registra o valor efetivamente cobrado naquele item.

Isso evita que uma alteração futura no cadastro de Produtos modifique o significado de um pedido antigo e permite visualizar quando houve preço personalizado.

## Regras de cálculo

### Total por item

```text
lineTotal = quantity × unitPrice
```

### Subtotal

```text
subtotal = soma de todos os lineTotal
```

### Ajuste geral em reais

Desconto:

```text
adjustmentAmount = min(valor informado, subtotal)
total = subtotal - adjustmentAmount
```

Acréscimo:

```text
adjustmentAmount = valor informado
total = subtotal + adjustmentAmount
```

### Ajuste geral em percentual

```text
adjustmentAmount = subtotal × percentual / 100
```

Para desconto, o resultado final nunca poderá ser negativo.

Valores persistidos de `subtotal`, `adjustment.amount` e `total` devem ser calculados pelo sistema, não aceitos diretamente como fonte de verdade do formulário.

## Regras para adicionar itens

Ao escolher um produto:

1. O seletor mostra apenas `product.name`.
2. O sistema preenche `unitPrice` com `product.price`.
3. A quantidade inicial é 1.
4. Ao adicionar, o item entra no resumo do pedido.

Se o mesmo produto for adicionado novamente com o mesmo preço unitário do catálogo e sem ajuste específico, o sistema incrementa a quantidade da linha existente.

Se uma linha do mesmo produto tiver preço personalizado, ela não deve ser mesclada com uma linha de preço diferente.

## UX do modal Novo pedido

O modal mantém no topo:

- Cliente
- Tipo
- Data do pedido

A área de produto passa a ser um pequeno compositor de item, com:

- Produto
- Quantidade
- Preço unitário preenchido automaticamente
- Botão `Adicionar item`

O select de Produto mostra apenas o nome.

### Lista de itens do pedido

Depois de adicionados, os itens aparecem em linhas próprias, por exemplo:

```text
Marmita Pequena
Qtd. 2    Preço unit. R$ 32,00    Total R$ 64,00
[Alterar preço]                               [Remover]

Refrigerante
Qtd. 1    Preço unit. R$ 8,00     Total R$ 8,00
[Alterar preço]                               [Remover]
```

A quantidade de uma linha pode ser ajustada sem recriar o item.

`Alterar preço` libera o preço unitário daquela linha. Quando houver diferença entre `catalogPrice` e `unitPrice`, o formulário pode exibir o campo opcional `Motivo do ajuste`.

O pedido só pode ser salvo com pelo menos um item.

Remover o último item não fecha o modal; o estado volta a pedir a adição de um produto.

## Ajuste geral do pedido

Depois da lista de itens, o formulário mostra um resumo financeiro:

```text
Subtotal                         R$ 84,00

Ajuste geral
[ Desconto ▼ ] [ R$ ▼ ] [ 10,00 ]
Motivo (opcional): Cliente fidelidade

Desconto                         - R$ 10,00
────────────────────────────────────────
TOTAL                             R$ 74,00
```

O tipo de ajuste terá as opções:

- Nenhum
- Desconto
- Acréscimo

O modo terá:

- R$
- %

R$ será o padrão ao selecionar desconto ou acréscimo.

## Migração e compatibilidade

Pedidos existentes não serão regravados em massa.

Na normalização do pedido, quando `items` não existir ou estiver vazio e os campos antigos estiverem presentes, o sistema criará em memória uma linha equivalente, preservando os dados existentes.

Exemplo conceitual:

```js
items: [{
  lineId: `legacy-${order.id}`,
  productId: order.productId,
  name: order.productName || `Marmita ${order.size}`,
  category: order.category,
  size: order.size,
  quantity: Number(order.quantity) || 1,
  catalogPrice: legacyUnitPrice,
  unitPrice: legacyUnitPrice,
  priceReason: ''
}]
```

Para pedidos antigos, o sistema deverá inferir `legacyUnitPrice` a partir do total e quantidade quando não houver preço unitário explícito.

O `total` histórico existente deve ser preservado como referência final durante a migração. A migração não pode recalcular um pedido antigo para um valor diferente do que já estava salvo.

## Operação: fila de Pedidos

A fila continua usando o pedido como unidade operacional. Um pedido com cinco itens continua sendo um único card e um único relógio de preparo.

O card exibe até três linhas de itens de forma compacta:

```text
2× Marmita Pequena
1× Refrigerante
1× Pudim
```

Se houver mais itens, mostrar um resumo como `+2 itens`.

O total mostrado é o total final do pedido, já com preços personalizados e ajuste geral.

O indicador de tempo, status operacional, tipo de entrega e regras de atraso permanecem independentes do número de itens.

## Dashboard

Pedidos recentes deixam de usar `productName` como fonte principal e passam a gerar um resumo com base em `items`.

Para manter a lista compacta, o Dashboard poderá mostrar a primeira linha e uma contagem dos demais itens, por exemplo:

```text
2× Marmita Pequena · +2 itens · Entrega
```

KPIs de vendas, recebido e a receber continuam usando `order.total`.

## Histórico de pedidos

O histórico passa a apresentar um resumo dos itens e o total final.

Quando houver ajuste geral, mostrar uma indicação discreta, por exemplo:

- `Desconto R$ 10,00`
- `Acréscimo 5%`

Nesta versão, a visualização é somente leitura. Não haverá edição do pedido finalizado ou ativo depois de salvo.

## A Receber

A cobrança continua no nível do pedido, não dos itens.

Um pedido com vários produtos gera uma única pendência no valor de `order.total`.

A busca deve considerar os nomes de todos os itens do pedido.

A descrição do pedido na tela deixa de depender de `productName` e usa um resumo de `items`.

## Pagamento e Financeiro

O fluxo de pagamento não muda conceitualmente:

```text
Pedido pendente
→ Registrar pagamento
→ Pedido pago
→ Entrada automática no Financeiro
```

A movimentação financeira automática continua usando `order.total`, que já será o valor final após ajustes.

Não serão criadas movimentações separadas por item.

A descrição da movimentação pode continuar no nível do pedido, sem enumerar todos os produtos, para manter o Financeiro legível.

## Busca

A pesquisa em Pedidos, Dashboard quando aplicável e A Receber deve passar a considerar todos os nomes dentro de `order.items`.

Helpers compartilhados devem gerar uma string de busca ou resumo para evitar lógica duplicada entre telas.

## Componentização recomendada

A regra de domínio de itens e totais deve ficar fora de `App.jsx`.

Criar um módulo dedicado, por exemplo:

```text
src/utils/orderItems.js
```

Responsabilidades sugeridas:

- normalizar itens antigos e novos
- adicionar/mesclar item
- alterar quantidade
- alterar preço
- calcular subtotal
- calcular ajuste geral
- calcular total
- gerar resumo curto de itens
- gerar texto pesquisável dos itens

A interface do modal pode ser extraída para um componente focado, por exemplo:

```text
src/components/OrderItemsEditor.jsx
```

Isso evita que `App.jsx` concentre regras de cálculo e manipulação de linhas.

## Validação e erros

O sistema não deve permitir:

- salvar pedido sem itens
- quantidade menor que 1
- preço unitário negativo
- ajuste geral negativo
- percentual negativo
- desconto que produza total negativo

Campos de motivo são opcionais e não bloqueiam o salvamento.

Se um produto cadastrado for excluído depois de um pedido ter sido salvo, o pedido continua íntegro porque cada item armazena nome e preços próprios.

## Testes

A implementação deverá seguir TDD para as regras de domínio.

Cobertura mínima esperada:

- migração de pedido antigo para `items`
- preservação do total de pedido antigo
- adição do primeiro item
- adição repetida do mesmo produto soma quantidade
- produto igual com preço diferente cria linha separada
- alteração de quantidade
- alteração de preço unitário
- preservação de `catalogPrice`
- subtotal com vários itens
- desconto fixo
- acréscimo fixo
- desconto percentual
- acréscimo percentual
- desconto limitado para não gerar total negativo
- motivo opcional de ajuste por item
- motivo opcional de ajuste geral
- resumo compacto de itens
- busca por qualquer item do pedido
- pagamento continua usando o total final

Depois da integração, o workflow deve passar em:

- `npm test`
- `npm run lint`
- `npm run build`

## Fora do escopo desta versão

- editar pedido depois de salvo
- cancelamento parcial de item de um pedido já salvo
- estorno de pagamento causado por edição do pedido
- pagamento parcial por item
- dividir a conta entre produtos
- controle de estoque
- adicionais ou modificadores de produto estruturados
- composição de combos

Essas evoluções podem ser adicionadas posteriormente sobre o modelo `items` sem alterar a decisão principal deste design.
