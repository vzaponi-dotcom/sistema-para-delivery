# Catálogo, pedidos locais e refinamentos operacionais — Design

**Data:** 2026-09-02  
**Branch:** `feature/catalog-local-orders-round`  
**Status:** auto-revisado; aguardando aprovação do arquivo antes do plano de implementação

## 1. Objetivo

Esta rodada reúne melhorias de continuidade de estado, atendimento, catálogo e financeiro sem transformar o sistema em um módulo completo de salão. O foco é reduzir atrito na operação diária, estruturar melhor os produtos e permitir pedidos de consumo no local sem poluir a base de clientes.

A implementação deve preservar os fluxos já estabilizados de autenticação, persistência central no D1, pagamento, idempotência de pedidos, histórico, busca, relatórios, modo offline de leitura e bloqueio de escritas sem conexão.

## 2. Escopo aprovado

A rodada contém cinco blocos:

1. persistência do filtro de período do Dashboard durante a navegação;
2. cancelamento do cadastro rápido de cliente em Nova venda;
3. reformulação do cadastro e da listagem de Produtos;
4. identificação flexível para pedidos de Consumo no local;
5. simplificação dos indicadores da tela A receber.

Não entram nesta rodada: módulo completo de mesas/salão, abertura e transferência de comandas, junção/divisão de contas, categorias de produto personalizáveis pelo usuário, variações agrupadas em um único produto ou persistência do filtro do Dashboard como preferência permanente da conta.

---

## 3. Dashboard — manter período escolhido

### Problema atual

`Dashboard` mantém o período selecionado em estado local. Como a página é desmontada ao navegar para outra aba, ao voltar o período retorna ao padrão de 30 dias.

### Comportamento desejado

- O período selecionado (`Hoje`, `7 dias` ou `30 dias`) deve permanecer ao navegar entre as abas do sistema.
- O estado deve pertencer ao shell/sessão atual da aplicação, não ao componente `Dashboard` isolado.
- Nesta rodada não haverá persistência em `localStorage` nem no D1.
- Ao recarregar a página, sair da conta ou iniciar uma nova sessão, o padrão volta a ser `30 dias`.

### Direção de design

Elevar o estado do período para `App` (ou unidade equivalente de estado da sessão) e tornar `Dashboard` controlado por `period` e `onPeriodChange`. A lógica analítica existente permanece inalterada.

---

## 4. Nova venda — cancelar cadastro rápido de cliente

### Problema atual

Ao abrir `+ Novo cliente` dentro de Nova venda, o formulário rápido oferece a ação de adicionar, mas não uma saída explícita. Um clique acidental obriga o operador a interagir novamente com o toggle ou seguir com o formulário aberto.

### Comportamento desejado

- O formulário rápido deve oferecer `Adicionar cliente` e `Cancelar`.
- `Cancelar` fecha somente o cadastro rápido.
- O carrinho, tipo do pedido, data, descontos/acréscimos, taxa e demais dados da venda em andamento devem permanecer intactos.
- Ao cancelar, limpar nome, telefone, erro de duplicidade e diálogo de duplicidade ligados ao cadastro rápido.
- O cancelamento não cria nem altera qualquer cliente.

---

## 5. Produtos — novo modelo de categoria e apresentação

### 5.1 Princípio

Categoria e apresentação passam a ser conceitos separados.

- **Categoria** responde “que tipo de item é este?”.
- **Apresentação** responde “como esta variação é vendida/apresentada?”.

Cada variação continua sendo um produto independente. Por exemplo, `Marmita P`, `Marmita M` e `Marmita G` continuam sendo três registros com preços independentes. Não haverá produto pai com variações nesta rodada.

### 5.2 Categorias fixas

A lista aprovada é:

- Refeições
- Lanches
- Combos
- Porções
- Bebidas
- Sobremesas
- Adicionais
- Molhos
- Outros

As categorias são definidas pelo sistema e não podem ser criadas, renomeadas ou excluídas pelo usuário nesta rodada.

Cada categoria terá um ícone semântico usando ou estendendo o `Icon` local do projeto. Não serão adicionados emojis como parte da UI nem uma biblioteca externa apenas para esse fim.

### 5.3 Tipos de apresentação

Os tipos aprovados são:

- `unit` — Unidade
- `size` — Tamanho
- `volume` — Volume
- `weight` — Peso

Regras de detalhe:

- **Unidade:** sem valor complementar.
- **Tamanho:** `P`, `M`, `G` ou `Outro`.
- **Tamanho / Outro:** abre campo curto de texto com até 24 caracteres, por exemplo `Família`, `Individual` ou `Grande`.
- **Volume:** valor decimal positivo + unidade `ml` ou `L`.
- **Peso:** valor decimal positivo + unidade `g` ou `kg`.

Para Volume e Peso, a UI aceita vírgula ou ponto como separador decimal. A camada de normalização converte o valor para string decimal canônica com ponto antes de enviar/persistir (por exemplo `1,5` → `1.5`). A apresentação ao usuário continua localizada em pt-BR (`1,5 L`). Zero, negativos, texto não numérico e unidade incompatível são inválidos.

O valor de apresentação não participa de cálculo de preço; ele é dado de catálogo e exibição.

### 5.4 Sugestão automática por categoria

Ao selecionar ou trocar a categoria, o formulário pré-seleciona uma apresentação provável, que pode ser alterada manualmente antes de salvar:

| Categoria | Apresentação sugerida |
| --- | --- |
| Refeições | Tamanho |
| Lanches | Tamanho |
| Combos | Unidade |
| Porções | Tamanho |
| Bebidas | Volume |
| Sobremesas | Unidade |
| Adicionais | Unidade |
| Molhos | Unidade |
| Outros | Unidade |

A sugestão é conveniência de UX, não regra de negócio. O backend aceita qualquer combinação válida de categoria + tipo de apresentação.

Para um produto novo, o estado inicial permanece conceitualmente próximo ao fluxo atual: categoria `Refeições`, apresentação `Tamanho`, valor `P`; o comportamento atual do campo de preço não será alterado nesta rodada além da reorganização visual.

### 5.5 Modelo de persistência

Adicionar ao registro de `products` os campos:

- `presentation_type`
- `presentation_value`
- `presentation_unit`

O campo legado `size` não deve ser removido nesta rodada. Ele permanece temporariamente como compatibilidade para dados históricos e trechos que ainda dependam de uma string pronta de apresentação.

Novas gravações devem derivar `size` a partir dos campos estruturados, com esta regra:

- Unidade → `Un`;
- Tamanho → valor do tamanho (`P`, `M`, `G` ou texto customizado);
- Volume/Peso → `<valor localizado para exibição> <unidade>` como string de compatibilidade.

Os campos estruturados são a fonte de verdade dos produtos novos/editados. A API continua expondo `size` como representação de compatibilidade, mas componentes novos devem usar os campos estruturados e um helper central de formatação.

### 5.6 Migração segura dos produtos existentes

Criar migração D1 aditiva, sem apagar registros existentes.

Categorias legadas conhecidas devem ser normalizadas:

- `Marmita` → `Refeições`
- `Bebida` → `Bebidas`
- `Doce` → `Sobremesas`
- `Adicional` → `Adicionais`

Se existir no banco uma categoria inesperada fora das categorias legadas conhecidas, a migração não deve descartá-la silenciosamente. O valor original permanece no banco; na interface ele entra no fallback visual/filtro `Outros` até que o produto seja editado. Se o operador salvar esse produto mantendo o fallback, a categoria persistida passa explicitamente a `Outros`.

Para apresentação legada:

- `size` vazio, `Un` ou `Unidade` → `unit`;
- `P`, `M` ou `G` → `size` com o mesmo valor;
- qualquer outro `size` legado não vazio → `size` customizado, preservando o texto original.

A migração não tentará adivinhar que textos como `350ml` são Volume ou que `500g` são Peso. Essa correção poderá ocorrer naturalmente ao editar o produto. O objetivo da migração é não perder informação.

### 5.7 Formulário de produto

O formulário atual será reorganizado em uma unidade própria de UI, reutilizada para criar e editar.

Ordem visual:

1. **Identificação** — Nome do produto + Preço.
2. **Categoria** — grade visual com ícone + nome; categoria ativa destacada.
3. **Apresentação** — controle segmentado Unidade / Tamanho / Volume / Peso.
4. **Detalhe da apresentação** — campo dinâmico conforme o tipo.
5. **Prévia** — exemplo do resultado final, como `Coca-Cola · Bebidas · 350 ml` + preço.
6. **Ações** — `Salvar produto`/`Salvar alterações` e `Cancelar`.

Responsividade:

- Desktop: grade de categorias compacta e formulário com colunas quando houver espaço.
- Mobile: categorias em duas colunas, conteúdo rolável dentro da superfície/modal e alvos de toque compatíveis com o padrão existente.
- O formulário continua acessível por teclado e leitor de tela; seleção visual deve ter estado semântico equivalente a radio/pressed selection.

### 5.8 Listagem e filtro

A tela Produtos deve:

- manter a busca atual;
- incluir filtro por categoria com `Todos` + as nove categorias;
- usar o padrão responsivo do sistema: seletor compacto/ancorado no desktop e bottom sheet no mobile, reaproveitando `SystemSelect` quando adequado;
- mostrar ícone da categoria por produto;
- exibir categoria e apresentação de forma legível, sem exigir que o nome do produto carregue tamanho/volume/peso;
- fazer a busca considerar nome, categoria, apresentação e preço como já ocorre conceitualmente hoje;
- incluir categorias legadas desconhecidas no filtro `Outros`, sem ocultar esses produtos.

O filtro de categoria é estado de tela e não precisa persistir entre recarregamentos.

### 5.9 Catálogo dentro de Nova venda

O catálogo usado para montar pedidos deve consumir a mesma função central de apresentação, para que `G`, `350 ml`, `1 L`, `500 g`, `Família` etc. apareçam de modo consistente.

Snapshots de itens de pedido devem continuar preservando a apresentação vista no momento da venda. Nesta rodada, o `size_snapshot` legado continuará funcionando como snapshot textual de compatibilidade, preenchido a partir da apresentação estruturada do produto no momento do checkout. Não é necessário remodelar todo o histórico de `order_items` apenas para este objetivo.

---

## 6. Consumo no local — identificação sem cliente falso

### 6.1 Problema atual

Nova venda exige `clientId` para qualquer tipo de pedido, embora `orders.client_id` já seja anulável no banco. Isso força o operador a selecionar/cadastrar uma pessoa mesmo quando o pedido é apenas de consumo no local.

Criar clientes como `Mesa 01` ou `Refeição local` seria operacionalmente simples, mas contaminaria a base de clientes, histórico, busca e métricas.

### 6.2 Regra por tipo de pedido

**Entrega**
- continua exigindo cliente cadastrado.

**Retirada**
- permanece com a regra atual nesta rodada: exige cliente cadastrado.

**Consumo no local**
- não exige cliente cadastrado;
- oferece três formas de identificação:
  1. `Nome` — padrão para consumo local;
  2. `Mesa`;
  3. `Cliente cadastrado`.

### 6.3 Comportamento de cada identificação

**Nome**
- operador digita um nome com 1 a 80 caracteres após trim, por exemplo `João`;
- não cria registro em `clients`;
- fica apenas no snapshot daquele pedido.

**Mesa**
- operador informa uma identificação curta da mesa, por exemplo `04` ou `A1`;
- aceita de 1 a 12 caracteres alfanuméricos, com hífen opcional, sem espaços (`A1`, `04`, `A-2`);
- a UI apresenta o pedido como `Mesa <identificador>`;
- não cria registro em `clients`.

**Cliente cadastrado**
- usa o seletor existente de clientes;
- preserva vínculo por `client_id` e o snapshot do nome.

### 6.4 Modelo de persistência do pedido

Adicionar em `orders` o campo `customer_identity_type` com os valores:

- `registered_client`
- `guest_name`
- `table`

O campo `client_name_snapshot` continua sendo a string de exibição congelada no momento da venda:

- nome do cliente para `registered_client`;
- nome digitado para `guest_name`;
- `Mesa <identificador>` para `table`.

`client_id`:

- obrigatório logicamente para `registered_client`;
- `NULL` para `guest_name` e `table`.

A API continua expondo `order.client` como alias amigável de `client_name_snapshot`, mantendo compatibilidade com as telas atuais. Também expõe `customerIdentityType` para que telas que precisem diferenciar cliente real, nome avulso e mesa não façam inferência por texto.

### 6.5 Migração dos pedidos existentes

Criar migração D1 aditiva com `customer_identity_type = 'registered_client'` como padrão inicial.

Depois do `ADD COLUMN`, qualquer registro legado com `client_id IS NULL` deve ser atualizado para `guest_name`, preservando `client_name_snapshot`. Nenhum pedido histórico deve ser descartado ou receber cliente artificial.

### 6.6 Payload e validação

O checkout passa a transportar a identificação explicitamente no campo `customerIdentity`:

- cliente cadastrado: `{ type: 'registered_client', clientId: '<id>' }`;
- nome avulso: `{ type: 'guest_name', value: 'João' }`;
- mesa: `{ type: 'table', value: '04' }`.

O Worker deriva `client_name_snapshot`; o frontend não envia snapshot oficial como fonte de verdade.

O Worker deve validar:

- Entrega/Retirada → somente identidade `registered_client` com `clientId` válido do mesmo negócio;
- Local + `registered_client` → `clientId` válido;
- Local + `guest_name` → `value` com 1 a 80 caracteres após trim;
- Local + `table` → `value` seguindo `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$` e no máximo 12 caracteres;
- tipos de identidade desconhecidos → rejeição antes de qualquer escrita no D1.

A criação do pedido continua usando o total calculado no servidor, idempotency key e transação/batch existentes. Esta mudança não altera preço, pagamento ou semântica de finalização.

### 6.7 UX de Nova venda

Dentro da área “Dados da venda”, `Tipo do pedido` deve aparecer antes da identificação do cliente/pessoa/mesa.

Ao selecionar `Consumo no local`, mostrar um seletor simples:

`Nome | Mesa | Cliente cadastrado`

- padrão: `Nome`;
- trocar entre modos não deve apagar carrinho nem demais dados do checkout;
- ao trocar o modo, limpar somente os dados específicos do modo anterior para impedir payload inconsistente;
- ao voltar para Entrega ou Retirada, usar novamente `Cliente cadastrado` como modo obrigatório, sem alterar carrinho ou valores financeiros.

### 6.8 Busca, histórico e A receber

Busca e detalhes de pedido usam `client_name_snapshot`/`order.client`, portanto continuam encontrando `João` e `Mesa 04`.

Na tela A receber, não se deve agrupar pedidos distintos de `guest_name` ou `table` como se fossem o mesmo cliente real. Regras:

- `registered_client`: agrupar por `client_id` (com fallback seguro para snapshot em registros legados inconsistentes);
- `guest_name` e `table`: cada pedido pendente é um grupo independente, mesmo que dois pedidos tenham a mesma string de identificação.

A seção atualmente chamada `Pendências por cliente` passa a se chamar `Pendências em aberto`. O placeholder de busca deve usar linguagem neutra, por exemplo `Buscar identificação, pedido ou produto`.

Isso mantém A receber correta sem introduzir um módulo de comandas abertas.

---

## 7. A receber — simplificação dos cards

Remover o indicador `Clientes devendo`.

Manter três cards:

1. `A receber` — valor total ainda pendente;
2. `Pedidos pendentes` — quantidade de pedidos não pagos;
3. `Recebido hoje` — soma dos pagamentos confirmados no dia.

A remoção reduz redundância porque a própria lista abaixo já mostra as pendências agrupadas quando há cliente cadastrado.

O grid deve se adaptar naturalmente de quatro para três cards no desktop e manter empilhamento/responsividade no mobile.

---

## 8. Componentes e responsabilidades

A implementação deve favorecer unidades pequenas e testáveis:

- `Dashboard`: visualização controlada do período.
- `ProductForm` (novo ou equivalente): estado visual do formulário e seleção de categoria/apresentação.
- módulo/helper de catálogo: constantes de categorias, ícones, apresentação sugerida, normalização e formatação de apresentação.
- `Products`: busca, filtro de categoria e listagem.
- `NewOrder`: escolha de tipo de pedido e modo de identificação; cadastro rápido com Cancelar.
- helpers de checkout: construção/normalização do payload de identidade e snapshots de apresentação.
- Worker validation/repositories: validação de produto e identidade, mapeamento D1/API e criação transacional do pedido.
- `Receivables`: agrupamento correto por identidade e resumo com três cards.

Evitar aumentar `App.jsx` com toda a lógica visual nova. O formulário complexo de produto e helpers de domínio devem ser extraídos para unidades próprias quando isso melhorar testabilidade e leitura.

---

## 9. Compatibilidade e dados existentes

Requisitos obrigatórios:

- nenhuma exclusão de produto, cliente, pedido, item, pagamento ou movimento existente durante as migrações;
- migrações D1 aditivas e executadas apenas pelo mecanismo normal de migrations;
- frontend e Worker devem tolerar registros legados durante a transição;
- snapshots históricos continuam sendo fonte de exibição para pedidos antigos;
- preço oficial de produto continua em centavos no servidor;
- novas informações de apresentação nunca são confiadas para cálculo de preço;
- filtros e ícones não alteram comportamento de soft delete de produtos;
- pedidos locais avulsos não entram na tabela `clients`.

As mudanças de schema devem ser separadas em migrations pequenas (produto/apresentação e identidade de pedido) para facilitar validação e diagnóstico no workflow de produção.

---

## 10. Estados de erro e acessibilidade

- Campos dinâmicos de produto devem mostrar validação próxima do controle inválido.
- Não permitir salvar Volume/Peso sem valor positivo e unidade válida.
- Não permitir Tamanho/Outro sem texto customizado.
- Não permitir pedido local sem identificação válida no modo selecionado.
- Erros retornados pela API permanecem no padrão existente de toast/erro de checkout, sem limpar dados digitados.
- Controles de categoria, apresentação e identidade devem ser navegáveis por teclado e ter nome/estado acessível.
- Ícones são apoio visual; rótulos textuais continuam presentes.
- Estados `disabled` ligados a offline/escrita em andamento devem ser preservados nos novos controles.

---

## 11. Estratégia de testes

A implementação seguirá TDD e deve cobrir, no mínimo:

### Dashboard
- período não reseta ao trocar de aba e voltar;
- padrão após reload/logout continua 30 dias.

### Cadastro rápido
- Cancelar fecha e limpa somente o formulário rápido;
- carrinho e dados da venda permanecem.

### Produtos
- categorias aprovadas e sugestões padrão;
- validação de Unidade/Tamanho/Volume/Peso;
- Tamanho `Outro` exige texto e respeita limite;
- normalização decimal de Volume/Peso e formatação pt-BR;
- formatação consistente de P/M/G, customizado, ml/L e g/kg;
- filtro por categoria combinado com busca;
- categoria legada desconhecida aparece em `Outros` sem desaparecer;
- criação/edição envia campos estruturados;
- mapeamento API/D1 mantém compatibilidade de `size`/apresentação;
- migração preserva dados e mapeia categorias legadas conhecidas.

### Pedidos locais
- Entrega e Retirada continuam exigindo cliente real;
- Local aceita Nome, Mesa e Cliente cadastrado;
- Nome/Mesa não criam cliente;
- limites e regex de identidade são iguais no frontend/helper e no Worker;
- identidade inválida é rejeitada antes de escrita;
- idempotência continua gerando somente um pedido;
- snapshot e busca exibem a identificação correta;
- pedidos avulsos com o mesmo nome/mesa não são agrupados como um único devedor em A receber.

### A receber
- três cards corretos;
- `Clientes devendo` não é mais renderizado;
- agrupamento por cliente cadastrado continua somando seus pedidos;
- identidades avulsas permanecem independentes.

### Regressão
- suíte completa atual;
- lint;
- build;
- Wrangler `deploy --dry-run`;
- migrations locais/remotas via workflow de produção antes do deploy.

---

## 12. Critérios de aceite

A rodada está pronta quando:

- escolher `7 dias` no Dashboard, navegar e voltar mantém `7 dias`;
- cadastro rápido em Nova venda tem Cancelar sem perder o pedido;
- produto pode ser cadastrado com categoria fixa + apresentação estruturada;
- categorias têm ícones e filtro funcional na listagem;
- produtos legados continuam visíveis e editáveis após migração;
- Consumo no local permite Nome, Mesa ou Cliente cadastrado sem criar cliente falso;
- Entrega e Retirada mantêm obrigatoriedade atual de cliente cadastrado;
- histórico, busca, A receber e pagamento exibem corretamente a identidade do pedido;
- A receber mostra somente A receber, Pedidos pendentes e Recebido hoje;
- todos os testes, lint, build e dry-run passam;
- deploy aplica migrations antes de publicar o Worker, como já ocorre no workflow de produção.
