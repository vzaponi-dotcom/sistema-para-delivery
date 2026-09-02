# Design: nova venda com carrinho de múltiplos itens

Data: 2026-09-01

## Objetivo

Transformar o fluxo atual de criação de pedido, hoje limitado a um produto por vez, em uma tela dedicada de **Nova venda** com carrinho de múltiplos itens.

O atendente deve conseguir selecionar ou criar rapidamente o cliente, adicionar todos os produtos da venda, informar quantidades e observações por item, aplicar taxa de entrega opcional, desconto ou acréscimo no pedido e então escolher entre:

- **Salvar pedido**: cria o pedido como `Em preparo` e pagamento `Pendente`.
- **Salvar e receber**: cria o pedido como `Em preparo` e registra imediatamente o pagamento com uma única forma de pagamento.

Pagamento e andamento operacional continuam independentes. Um pedido pago permanece `Em preparo` até ser finalizado na operação.

## Contexto atual

O banco já separa `orders` e `order_items`, e o bootstrap já carrega uma lista `items` por pedido. Porém, a API e a interface de criação ainda recebem somente `productId` + `quantity`, criando apenas uma linha por pedido.

A evolução deve aproveitar a estrutura existente e ser incremental, sem apagar ou recriar o D1 e sem regravar pedidos antigos em massa.

## Decisões aprovadas

- A criação passa a usar uma **tela dedicada**, não o modal atual.
- A tela de Pedidos continua focada na operação/cozinha.
- Um pedido pode conter vários produtos e continua sendo uma única venda e uma única unidade operacional.
- O catálogo da nova venda terá **categorias + busca**.
- O cliente pode ser selecionado por nome/telefone.
- Um cliente novo pode ser criado dentro da venda usando somente os campos **nome e telefone**, sem sair da tela.
- O endereço do cliente não participa do fluxo da venda. O endereço efetivo da entrega continua vindo da conversa no WhatsApp e não será copiado para o pedido nesta fase.
- Cada item pode ter **observação própria**.
- O mesmo produto com a mesma observação é agrupado em uma única linha e tem a quantidade somada.
- O mesmo produto com observação diferente permanece em linha separada.
- O preço unitário do item sempre vem do cadastro de Produtos e **não é editável na venda**.
- Ajustes de preço acontecem somente no nível do pedido.
- O pedido pode ter **desconto ou acréscimo**, em valor fixo ou percentual.
- O motivo do desconto/acréscimo é opcional.
- A **taxa de entrega é um campo próprio**, separado de desconto/acréscimo.
- A taxa é opcional e começa em zero.
- A taxa só se aplica a pedidos do tipo `Entrega`; `Retirada` e `Local` sempre persistem taxa zero.
- O cálculo automático da taxa por bairro/região fica para uma fase futura.
- Pagamento dividido fica fora desta fase. Cada pedido admite uma única forma de pagamento.
- `Salvar e receber` não finaliza a produção: o pedido fica `Em preparo + Pago`.
- Pedidos ativos mostram todos os itens e observações na fila da cozinha, sem esconder linhas atrás de um resumo `+N itens`.
- O histórico pode ser compacto, mas deve permitir abrir o detalhe completo da venda.
- Os status operacionais permanecem, nesta fase, em `Em preparo` e `Finalizado`.

## Abordagem escolhida

Foi escolhida a abordagem de **tela própria de Nova venda**.

Ela oferece espaço suficiente para catálogo, carrinho e fechamento no computador, sem transformar a tela de Pedidos em um PDV e sem sobrecarregar o modal atual.

No computador, a tela pode usar duas áreas principais:

```text
┌──────────────────────────────┬─────────────────────────┐
│ Cliente / tipo               │ Carrinho                │
│ Busca + categorias           │ Itens                   │
│ Catálogo de produtos         │ Fechamento / total      │
│                              │ Ações de salvar         │
└──────────────────────────────┴─────────────────────────┘
```

No celular, as mesmas áreas ficam empilhadas verticalmente:

```text
Cliente
Tipo
Busca / categorias
Produtos
Carrinho
Fechamento
Ações
```

A tela deve ser responsiva e utilizável tanto no computador quanto no celular.

## Fluxo da Nova venda

### 1. Cliente

No topo, o atendente pesquisa cliente por nome ou telefone e seleciona um registro existente.

A ação `+ Novo cliente` abre um formulário rápido dentro do fluxo com:

- nome
- telefone

O nome segue obrigatório como já ocorre no cadastro atual. A criação rápida não introduz endereço obrigatório nem tira o usuário da venda. Depois de salvar, o novo cliente já fica selecionado no pedido em andamento.

### 2. Tipo do pedido

Opções:

- `Entrega`
- `Retirada`
- `Local`

Ao selecionar `Entrega`, a interface mostra `Taxa de entrega`, inicialmente `R$ 0,00`.

Ao selecionar `Retirada` ou `Local`, o campo de taxa é ocultado e o valor efetivo enviado/persistido deve ser zero.

O comportamento atual de `orderDate` deve ser preservado. Se a interface atual permite registrar pedido em data anterior, essa capacidade continua disponível como campo secundário, mantendo as regras existentes para pedidos históricos.

### 3. Catálogo

A área de produtos possui:

- campo `Buscar produto`
- navegação por categorias existentes no cadastro
- lista/cartões de produtos da categoria ou busca atual

Cada produto apresenta pelo menos nome e preço cadastrado. Tocar/clicar adiciona o produto ao carrinho com quantidade inicial 1.

### 4. Carrinho

Cada linha contém:

- produto
- preço unitário de catálogo, somente leitura
- quantidade com controles `-` e `+`
- total da linha
- observação opcional daquele item
- remover item

Exemplo:

```text
Marmita G                         R$ 32,00
[-] 2 [+]                         R$ 64,00
Observação: sem cebola

Marmita G                         R$ 32,00
[-] 1 [+]                         R$ 32,00
Observação: sem salada
```

O pedido não pode ser salvo com carrinho vazio.

### Regra de agrupamento

Para decidir se uma nova adição soma uma linha existente, o sistema compara:

- mesmo `productId`
- mesma observação normalizada

A observação normalizada deve remover espaços externos, reduzir sequências internas de espaços e comparar sem diferença entre maiúsculas/minúsculas. O texto exibido pode preservar a grafia digitada na linha original.

Assim:

- `sem cebola` + `Sem cebola` => mesma linha
- `sem cebola` + `sem salada` => linhas diferentes
- observação vazia + observação vazia => mesma linha

Editar a observação de uma linha pode fazer com que ela se torne equivalente a outra linha. Nesse caso, as duas linhas devem ser consolidadas, somando as quantidades.

A observação é opcional, recebe `trim()` antes da persistência e tem limite de **300 caracteres** por linha.

## Fechamento financeiro

A área de fechamento mostra sempre os valores calculados:

```text
Produtos                         R$ 82,00
Taxa de entrega                   R$ 8,00
Desconto                          R$ 5,00
────────────────────────────────────────
TOTAL                            R$ 85,00
```

### Taxa de entrega

- somente para `Entrega`
- opcional
- valor mínimo zero
- não é representada como acréscimo geral
- fica persistida separadamente para futura automação por bairro/região

### Desconto/acréscimo

O ajuste geral possui:

- tipo: `Nenhum`, `Desconto`, `Acréscimo`
- modo: `R$` ou `%`
- valor
- motivo opcional

O preço individual dos produtos não pode ser alterado nessa tela.

O motivo do ajuste é texto opcional, recebe `trim()` e tem limite de **200 caracteres**.

### Base de cálculo

O percentual de desconto/acréscimo incide **somente sobre o subtotal dos produtos**, não sobre a taxa de entrega.

Isso preserva a taxa como componente separado da venda.

Fórmulas:

```text
itemsSubtotal = soma(quantity × catalogPrice)

fixedAdjustment = valor informado
percentageAdjustment = itemsSubtotal × percentual / 100

adjustedItemsSubtotal = itemsSubtotal - desconto
ou
adjustedItemsSubtotal = itemsSubtotal + acréscimo

total = adjustedItemsSubtotal + deliveryFee
```

O desconto é limitado ao subtotal dos produtos. Portanto, nunca torna `adjustedItemsSubtotal` negativo e nunca consome a taxa de entrega.

Percentuais aceitos ficam entre **0,00% e 100,00%**, inclusive, com no máximo duas casas decimais. Para persistir no campo inteiro `adjustment_value`, percentual usa **basis points**: `10000 = 100,00%` e `750 = 7,50%`. Valor fixo usa centavos no mesmo campo. `adjustment_amount_cents` guarda sempre o valor monetário efetivamente aplicado.

Exemplo aprovado:

```text
Produtos            R$ 96,00
Entrega               R$ 8,00
Desconto 10%          R$ 9,60
Total                 R$ 94,40
```

Todos os valores persistidos são calculados pelo servidor. O frontend pode mostrar a prévia, mas não é a fonte de verdade de preço ou total.

## Ações de conclusão

### Salvar pedido

Cria a venda com:

- status operacional `Em preparo` para pedido de hoje
- pagamento `Pendente`
- todos os itens e observações
- taxa e ajuste financeiro

Pedidos históricos mantêm a semântica atual de status/data já existente no sistema.

### Salvar e receber

Antes de confirmar, a interface solicita uma única forma de pagamento dentre as formas já suportadas.

A operação cria:

- pedido
- itens
- pagamento
- movimento financeiro automático de entrada

O pedido permanece `Em preparo` quando for operacionalmente ativo, mesmo estando `Pago`.

Pedido e recebimento devem ser tratados como uma única operação lógica de checkout. Não deve existir sucesso visual de pagamento se a gravação completa não tiver sido concluída.

## Contrato de API

A rota existente `POST /api/orders` deve evoluir para aceitar um carrinho, mantendo a chave de idempotência no cabeçalho.

Payload conceitual:

```json
{
  "clientId": "...",
  "type": "Entrega",
  "orderDate": "2026-09-01",
  "items": [
    {
      "productId": "...",
      "quantity": 2,
      "note": "sem cebola"
    },
    {
      "productId": "...",
      "quantity": 1,
      "note": "sem salada"
    }
  ],
  "deliveryFee": 8,
  "adjustment": {
    "type": "discount",
    "mode": "percentage",
    "value": 10,
    "reason": ""
  },
  "paymentMethod": "Pix"
}
```

`paymentMethod` é omitido em `Salvar pedido` e enviado em `Salvar e receber`.

A API não aceita preço unitário vindo do cliente como fonte de verdade. Para cada `productId`, o Worker deve buscar o produto ativo no D1 e usar seu `price_cents` atual.

O Worker deve validar:

- cliente existente no mesmo `business_id`
- pelo menos um item
- todos os produtos existentes, ativos e pertencentes ao mesmo negócio
- quantidade inteira >= 1
- observação opcional de até 300 caracteres após `trim()`
- tipo de pedido válido
- data válida e não futura, conforme regra atual
- taxa monetária >= 0 e taxa efetiva = 0 para `Retirada`/`Local`
- ajuste `none`, `discount` ou `surcharge`
- modo `fixed` ou `percentage`
- valor fixo monetário >= 0
- percentual entre 0,00 e 100,00 com até duas casas decimais
- motivo opcional de até 200 caracteres após `trim()`
- forma de pagamento válida quando informada

A resposta deve retornar o pedido já normalizado com `items`, valores finais e estado de pagamento.

## Idempotência e atomicidade

A proteção atual por `idempotency-key` continua obrigatória para criação.

A mesma chave representa o checkout inteiro. Repetir a mesma requisição por clique duplo, timeout ou reconexão não pode criar uma segunda venda nem um segundo pagamento.

Para `Salvar e receber`, a camada de repositório deve montar uma gravação atômica usando a capacidade transacional disponível no D1, incluindo:

- `orders`
- todas as linhas de `order_items`
- `payments`
- `movements`

Se a chave já existir, a API deve carregar e retornar a venda existente em vez de inserir outra. Em uma repetição de checkout pago, o resultado existente deve refletir o pagamento já associado ao pedido.

O frontend gera uma chave por tentativa lógica de venda e deve reutilizá-la enquanto estiver repetindo o mesmo checkout após falha de rede. Uma nova chave só é criada ao iniciar uma nova venda.

## Persistência e migration

A evolução é incremental sobre o D1 existente.

Criar uma nova migration, conceitualmente `0003_order_checkout.sql`, adicionando:

### Em `orders`

```text
delivery_fee_cents INTEGER NOT NULL DEFAULT 0
```

### Em `order_items`

```text
note TEXT NOT NULL DEFAULT ''
```

Os campos atuais de ajuste geral (`adjustment_type`, `adjustment_mode`, `adjustment_value`, `adjustment_amount_cents`, `adjustment_reason`) são reutilizados.

Os campos atuais de preço do item também permanecem por compatibilidade e histórico:

- `catalog_price_cents`
- `unit_price_cents`
- `price_reason`

Nesta fase, para novas vendas, `unit_price_cents` deve ser igual a `catalog_price_cents` e `price_reason` deve permanecer vazio, pois edição de preço individual não faz parte do fluxo aprovado.

Pedidos antigos recebem naturalmente:

- taxa zero pelo `DEFAULT`
- observação vazia pelo `DEFAULT`

Não haverá recriação do banco nem atualização em massa de pedidos antigos.

## Modelo retornado ao frontend

Formato conceitual:

```js
{
  id,
  clientId,
  client,
  type,
  status,
  orderDate,
  createdAt,
  finishedAt,

  items: [
    {
      id,
      productId,
      name,
      category,
      size,
      quantity,
      catalogPrice,
      unitPrice,
      note
    }
  ],

  subtotal,
  deliveryFee,
  adjustment: {
    type,
    mode,
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

No JSON do frontend, `adjustment.value` é sempre exposto na unidade amigável ao usuário: reais quando `fixed` e percentual decimal quando `percentage`. A conversão para centavos/basis points é detalhe de persistência do servidor.

`productName`, `size` e `quantity` no topo do pedido podem continuar temporariamente como campos derivados do primeiro item para compatibilidade durante a transição, mas novas telas não devem tratá-los como fonte oficial do conteúdo da venda.

## Fila da cozinha

A fila continua usando o pedido como unidade operacional.

Um pedido com cinco linhas é um único cartão, um único relógio e um único status.

O cartão ativo mostra:

- número do pedido
- cliente
- tipo
- estado do pagamento
- indicador de tempo
- **todos os itens**
- observação abaixo do item correspondente
- total final
- ação de finalizar

Exemplo:

```text
#4821 · Maria
Entrega · Pago no Pix · há 12 min

2x Marmita G
↳ sem cebola

1x Marmita G
↳ sem salada

2x Coca-Cola

Total R$ 94,40
```

Não truncar itens ativos com `+N itens`. Para a cozinha, o conteúdo completo precisa estar visível no cartão.

O indicador atual `No prazo / Atrasado / Muito atrasado` e as regras de tempo permanecem.

## Detalhe do pedido

Deve existir uma visualização completa, somente leitura nesta fase, acessível a partir do pedido e também útil para o histórico.

Mostrar:

- cliente
- tipo
- data/hora
- status operacional
- status e forma de pagamento
- todos os itens e observações
- subtotal
- taxa de entrega
- desconto/acréscimo e motivo, quando houver
- total final

Essa estrutura prepara uma futura impressão de comanda sem colocar impressão no escopo atual.

## Histórico

Pedidos finalizados permanecem uma linha/venda por pedido.

A lista pode usar resumo compacto, por exemplo:

```text
Maria · 5 itens · Entrega                 R$ 94,40
```

Ao abrir o detalhe, todos os itens e observações ficam disponíveis.

## Dashboard, A Receber e Financeiro

### Dashboard

KPIs continuam usando `order.total`.

Listas de pedidos recentes devem gerar descrição a partir de `items`, não depender apenas de `productName`.

### A Receber

A cobrança permanece no nível do pedido.

Um carrinho com vários produtos cria uma única pendência no valor final da venda.

A busca deve considerar os nomes de todos os itens.

### Financeiro

Um pagamento cria uma única entrada automática com o total final do pedido.

Não criar movimentos separados por item, taxa ou desconto.

## Busca

A pesquisa em Pedidos deve localizar a venda por:

- cliente
- qualquer produto dentro de `items`
- tipo
- status
- situação/forma de pagamento

Helpers compartilhados devem gerar resumo e texto pesquisável de itens para evitar lógica duplicada entre telas.

## Componentização

Evitar concentrar o novo fluxo dentro de `App.jsx`.

Estrutura sugerida:

```text
src/pages/NewOrder.jsx
src/components/OrderProductCatalog.jsx
src/components/OrderCart.jsx
src/components/OrderCheckoutSummary.jsx
src/components/OrderDetail.jsx
src/utils/orderCart.js
```

Responsabilidades de `orderCart.js`:

- normalizar observação
- adicionar/agrupar item
- alterar quantidade
- editar observação e consolidar linhas equivalentes
- remover item
- calcular prévia de subtotal
- calcular prévia de ajuste
- calcular prévia de total
- gerar resumo de itens
- gerar texto pesquisável

A regra definitiva de preço e total permanece também no Worker/repositório, independentemente da prévia do frontend.

## Estado do rascunho e erros

O carrinho só é limpo após confirmação de sucesso do servidor.

Em falha de rede, validação ou servidor:

- manter cliente selecionado
- manter itens e observações
- manter taxa e ajuste
- manter a mesma chave de idempotência para repetir o mesmo checkout
- mostrar erro claro

Ações de gravação continuam bloqueadas quando o navegador está offline, seguindo a política atual do sistema.

Na criação rápida de cliente, uma falha não deve apagar o carrinho já montado.

## Compatibilidade

- O bootstrap continua carregando pedidos antigos e novos.
- Pedidos antigos funcionam com `deliveryFee = 0` e `note = ''`.
- Nenhum dado existente é apagado.
- A exclusão lógica de produto não altera pedidos antigos porque os itens usam snapshots de nome/categoria/tamanho/preço.
- Pagamentos existentes continuam no modelo atual de um pagamento por pedido.
- O fluxo antigo de um item deixa de ser a interface principal, mas a estrutura de leitura continua tolerando campos legados durante a transição.

## Testes

A implementação deve seguir TDD para regras de domínio e repositório.

Cobertura mínima:

### Carrinho

- adicionar primeiro item
- adicionar mesmo produto com mesma observação soma quantidade
- comparação de observação ignora caixa e espaços irrelevantes
- mesmo produto com observação diferente cria linha separada
- editar observação pode consolidar duas linhas
- aumentar/diminuir quantidade
- impedir quantidade menor que 1
- remover item
- impedir checkout vazio

### Cálculos

- subtotal com múltiplos itens
- taxa zero
- taxa de entrega preenchida
- `Retirada` e `Local` forçam taxa zero
- desconto fixo
- acréscimo fixo
- desconto percentual sobre produtos, sem incluir taxa
- acréscimo percentual sobre produtos, sem incluir taxa
- percentual decimal com duas casas
- desconto limitado ao subtotal dos produtos
- motivo opcional
- servidor ignora qualquer tentativa do cliente de definir preço unitário

### API/repositório

- cria pedido com vários itens
- persiste observação por item
- usa snapshot do preço atual de cada produto
- rejeita observação acima de 300 caracteres
- rejeita percentual fora de 0,00% a 100,00%
- rejeita produto inexistente/inativo
- rejeita cliente de outro negócio/inexistente
- `Salvar pedido` cria pendência sem pagamento
- `Salvar e receber` cria pedido + itens + pagamento + movimento
- pedido pago continua `Em preparo`
- idempotência impede pedido duplicado
- idempotência impede pagamento/movimento duplicado
- falha no checkout pago não deixa estado parcial
- pedidos antigos continuam carregando

### Interface

- criação rápida de cliente preserva o carrinho
- categorias e busca filtram catálogo
- todos os itens aparecem no cartão ativo
- observações aparecem associadas ao item correto
- histórico abre detalhe completo
- busca encontra pedido por qualquer item
- falha de salvamento preserva o rascunho

## Validação antes de produção

Antes de deploy:

```text
npm test
npm run lint
npm run build
wrangler deploy --dry-run
```

O deploy segue o workflow de produção já existente, aplicando a nova migration antes da publicação.

Após deploy, realizar teste manual com uma venda fictícia de múltiplos itens:

1. criar/selecionar cliente
2. adicionar itens iguais com mesma observação e confirmar agrupamento
3. adicionar o mesmo produto com outra observação e confirmar linha separada
4. usar taxa de entrega opcional
5. aplicar desconto/acréscimo
6. salvar um pedido pendente
7. salvar outro pedido já recebido
8. confirmar que ambos aparecem corretamente no computador e no celular
9. confirmar que pagamento recebido gera uma única entrada financeira
10. finalizar e conferir o histórico/detalhe

## Fora do escopo desta fase

- pagamento dividido
- pagamento parcial
- edição de preço unitário no pedido
- edição de pedido depois de salvo
- cancelamento parcial de item
- estorno ligado a edição de pedido
- cálculo automático de taxa por bairro/região
- uso do endereço no pedido
- novos status como `Pronto` ou `Saiu para entrega`
- impressão de comanda
- estoque
- adicionais/modificadores estruturados
- combos

Esses itens podem ser evoluídos depois que o novo fluxo de venda estiver estável.

## Critérios de aceitação

A fase é considerada concluída quando:

- uma venda pode conter vários itens e quantidades em um único pedido
- observações individuais são persistidas e exibidas corretamente
- agrupamento respeita produto + observação
- preços vêm exclusivamente do cadastro e totais são recalculados no servidor
- taxa de entrega é opcional e separada do ajuste geral
- desconto/acréscimo funciona em R$ e % com motivo opcional
- cliente pode ser criado rapidamente com nome e telefone durante a venda
- `Salvar pedido` gera pendência
- `Salvar e receber` registra uma única forma de pagamento sem finalizar a produção
- repetição da mesma tentativa não duplica venda nem recebimento
- a cozinha mostra todos os itens e observações do pedido ativo
- o histórico permite consultar o detalhe completo
- pedidos e dados já existentes continuam íntegros após a migration
- testes, lint, build, dry-run, migration e deploy passam antes da liberação
