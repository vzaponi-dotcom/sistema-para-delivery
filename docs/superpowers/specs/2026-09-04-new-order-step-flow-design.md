# Gestão Delivery — Nova venda em fluxo por etapas

Data: 2026-09-04  
Branch: `feature/new-order-step-flow`  
Status: design aprovado em conversa; auto-revisão pendente

## 1. Objetivo

Reorganizar a tela **Nova venda** em um fluxo guiado de três etapas para reduzir a sensação de formulário longo, melhorar a leitura da operação e facilitar o uso principalmente no celular, sem alterar as regras de negócio já aprovadas para pedidos, catálogo, consumo local, pagamentos ou persistência.

O novo fluxo será:

1. **Cliente** — cliente/identificação, tipo do pedido e data;
2. **Produtos** — seleção dos itens do pedido;
3. **Finalizar** — carrinho completo, taxa, desconto/acréscimo, total e conclusão.

A mudança é de arquitetura de interface e navegação interna da Nova venda. O pedido continua sendo um único rascunho no frontend e só é persistido quando o operador conclui a etapa 3.

## 2. Princípios e restrições

A implementação deve preservar integralmente os comportamentos já estabilizados:

- D1 continua sendo a fonte oficial dos dados persistidos;
- o frontend nunca se torna autoridade de preço ou total;
- o Worker continua recalculando os valores oficiais no checkout;
- `POST /api/orders` continua sendo chamado somente na conclusão da venda;
- a chave de idempotência do checkout continua sendo usada;
- nenhuma etapa intermediária cria pedido parcial no banco;
- o carrinho continua aceitando múltiplos itens e observações por item;
- itens iguais com mesma observação normalizada continuam agrupados;
- `Entrega`, `Retirada` e `Local` mantêm as regras atuais;
- consumo no local continua aceitando Nome, Mesa ou Cliente cadastrado;
- comanda aberta de mesa continua recebendo o pedido conforme a integração existente;
- taxa de entrega continua exclusiva de `Entrega`;
- desconto/acréscimo continua no nível do pedido;
- valores fixos continuam formatados em Real brasileiro;
- percentual continua numérico, sem máscara monetária;
- `Salvar pedido` e `Salvar e receber` mantêm sua semântica atual;
- escritas continuam bloqueadas offline ou enquanto houver requisição incompatível em andamento;
- falha de salvamento nunca descarta o rascunho local;
- nenhuma migration D1 ou mudança de contrato da API é necessária para esta rodada.

## 3. Abordagem escolhida

Foi escolhida a abordagem de **wizard interno dentro da própria tela Nova venda**, mantendo a página como uma única experiência e um único rascunho.

Não serão criadas rotas separadas como `/nova-venda/cliente`, `/nova-venda/produtos` e `/nova-venda/finalizar`.

Também não será usado modal de tela cheia sobre o restante do sistema.

A página `NewOrder` continua sendo montada quando `activeTab === 'new-order'`, mas passa a controlar a etapa ativa e delegar a renderização de cada etapa a unidades menores de UI.

Motivos:

- evita persistência intermediária desnecessária;
- preserva o modelo atual de checkout;
- reduz risco de perda de dados ao avançar/voltar;
- permite navegação responsiva sem duplicar regras de negócio;
- melhora o isolamento e a testabilidade do `NewOrder`, que hoje concentra cliente, operação, catálogo, carrinho e fechamento em uma única árvore extensa.

## 4. Estado do rascunho

`NewOrder` permanece como proprietário do rascunho da venda durante as três etapas.

O estado conceitual continua contendo:

```text
clientId
clientSearch
type
localIdentityType
localIdentityValue
orderDate
items
deliveryFee
adjustment
quickClient
quickClientError
duplicateClient
checkoutError
```

Será adicionado estado de navegação equivalente a:

```text
currentStep = 1 | 2 | 3
```

O estado do rascunho não será copiado para cada etapa. Os componentes de etapa receberão valores e callbacks controlados.

Avançar ou voltar altera somente `currentStep`.

Nenhuma navegação entre etapas pode limpar automaticamente:

- cliente já escolhido;
- identificação local;
- data;
- produtos;
- quantidades;
- observações;
- desconto/acréscimo;
- motivo do ajuste.

Exceção já existente: ao sair de `Entrega` para `Retirada` ou `Local`, a taxa de entrega efetiva é zerada.

## 5. Indicador de progresso

A Nova venda exibirá no topo um indicador de três etapas:

```text
1 Cliente  →  2 Produtos  →  3 Finalizar
```

Estados visuais:

- etapa atual: destaque principal;
- etapa concluída: aparência de concluída, preferencialmente com marca de confirmação;
- etapa futura: aparência inativa.

Regras de interação:

- etapa atual não precisa executar navegação ao ser clicada;
- etapas anteriores já concluídas podem ser clicadas diretamente;
- etapas futuras não podem ser puladas;
- a semântica deve ser acessível por teclado e leitor de tela;
- o estado visual não pode depender apenas de cor.

Exemplo na etapa 3:

```text
✓ Cliente  →  ✓ Produtos  →  3 Finalizar
```

## 6. Etapa 1 — Cliente e atendimento

### 6.1 Conteúdo

A primeira etapa deve ser enxuta e conter apenas:

- tipo do pedido;
- cliente ou identificação local;
- criação rápida de cliente quando aplicável;
- data do pedido.

Não aparecem nesta etapa:

- catálogo;
- carrinho;
- taxa de entrega;
- desconto/acréscimo;
- forma de pagamento;
- totais financeiros.

### 6.2 Tipo do pedido

Continuam disponíveis:

- `Entrega`;
- `Retirada`;
- `Consumo no local`.

A seleção deve ter destaque claro e continuar compatível com teclado/touch.

### 6.3 Entrega e Retirada

Continuam exigindo cliente cadastrado conforme a regra atual.

A interface preserva:

- busca por cliente;
- seleção de cliente;
- `+ Novo cliente`;
- cadastro rápido com nome e telefone;
- detecção de duplicidade existente.

### 6.4 Consumo no local

Continuam disponíveis:

- `Nome`;
- `Mesa`;
- `Cliente cadastrado`.

As validações permanecem as já definidas:

- Nome: 1 a 80 caracteres após trim;
- Mesa: identificador válido de até 12 caracteres conforme contrato existente;
- Cliente cadastrado: `clientId` válido.

Se uma mesa já possuir comanda aberta, a indicação de comanda existente continua visível na etapa 1.

### 6.5 Data

O campo de data permanece nesta etapa e preserva a capacidade atual de registrar venda em data permitida pelo sistema.

### 6.6 Navegação

Rodapé lógico:

```text
Cancelar venda                         Continuar →
```

`Continuar` só fica habilitado quando a identificação do atendimento e a data forem válidas.

Ao continuar, a etapa ativa passa para Produtos.

## 7. Etapa 2 — Produtos

### 7.1 Objetivo visual

A segunda etapa deve concentrar atenção no catálogo e reduzir distrações financeiras.

No topo do conteúdo será exibido um resumo curto do atendimento, por exemplo:

```text
Maria Silva · Entrega
```

ou:

```text
Mesa 04 · Consumo no local
```

Esse resumo é informativo e não substitui a possibilidade de voltar à etapa Cliente.

### 7.2 Catálogo

O catálogo preserva integralmente:

- busca de produto;
- categorias existentes;
- apresentação estruturada dos produtos;
- preço de catálogo somente leitura;
- estado `Adicionado` ligado ao carrinho;
- regra atual em que nenhuma categoria começa selecionada;
- busca global ignorando o filtro de categoria quando houver texto;
- categoria selecionada permanece ativa ao adicionar produto.

### 7.3 Comportamento no mobile

No celular, o catálogo ocupa a área principal e o carrinho completo não fica permanentemente aberto.

Uma barra/ação fixa próxima ao rodapé mostra uma síntese:

```text
3 itens · R$ 72,00                 Ver carrinho →
```

Essa ação avança para a etapa Finalizar.

Também deve existir acesso claro a `← Voltar` para retornar à etapa Cliente.

A barra fixa não pode ficar escondida atrás da navegação inferior do aplicativo, considerando o ajuste de área segura já adotado no projeto.

### 7.4 Comportamento no desktop

No desktop, o layout é adaptativo:

- catálogo: aproximadamente 70% da área útil;
- mini resumo do carrinho: aproximadamente 30%.

O mini carrinho não é o fechamento financeiro completo. Ele mostra somente o necessário para conferência rápida:

- itens adicionados;
- quantidades;
- quantidade total de itens;
- prévia do subtotal/total exibível naquele momento;
- ação `Revisar pedido`.

Taxa, desconto/acréscimo, forma de pagamento e ações definitivas ficam exclusivamente na etapa 3.

### 7.5 Validação da etapa

A etapa Produtos só pode avançar para Finalizar com pelo menos um item no carrinho.

Se o carrinho estiver vazio, a ação de avançar permanece desabilitada ou apresenta orientação não destrutiva sem chamar a API.

## 8. Etapa 3 — Carrinho e finalização

### 8.1 Resumos de contexto

No início da etapa, mostrar informações compactas suficientes para o operador conferir o contexto sem voltar:

- cliente/identificação;
- tipo do pedido;
- quantidade de itens.

Exemplo:

```text
Cliente
Maria Silva · Entrega

Pedido
3 itens
```

### 8.2 Carrinho completo

A etapa preserva o `OrderCart` existente e suas capacidades:

- produto;
- apresentação;
- preço unitário;
- quantidade com `-` e `+`;
- total da linha;
- observação opcional;
- edição/commit da observação;
- remoção do item.

Alterar o carrinho nesta etapa atualiza imediatamente a mesma fonte de estado usada pela etapa Produtos.

Se todos os itens forem removidos na etapa 3, as ações de salvar ficam desabilitadas e o usuário pode voltar aos produtos.

### 8.3 Fechamento financeiro

A etapa contém o fechamento completo já existente:

- subtotal de produtos;
- taxa de entrega quando o tipo for `Entrega`;
- desconto/acréscimo;
- motivo opcional;
- total.

A taxa permanece formatada em BRL e começa em `R$ 0,00`.

Ajuste fixo permanece em BRL.

Ajuste percentual permanece numérico.

O frontend calcula somente prévia; o Worker continua recalculando os valores oficiais.

### 8.4 Conclusão

A etapa mantém as duas ações atuais:

- `Salvar pedido` — cria pedido com pagamento pendente;
- `Salvar e receber` — solicita uma única forma de pagamento e conclui o checkout pago.

A forma de pagamento só precisa aparecer/ser solicitada quando o operador escolhe o fluxo de recebimento.

O pedido pago continua operacionalmente `Em preparo` quando aplicável.

Ações disponíveis:

```text
← Voltar aos produtos
Salvar pedido
Salvar e receber
```

## 9. Navegação reversível

Voltar nunca descarta o rascunho.

Cenários obrigatórios:

- etapa 2 → etapa 1 preserva itens já adicionados;
- etapa 3 → etapa 2 preserva taxa e ajustes já preenchidos;
- etapa 3 → etapa 1 preserva carrinho e ajustes;
- alterar cliente preserva carrinho;
- alterar identificação local preserva carrinho;
- alterar `Entrega` para `Retirada`/`Local` preserva carrinho e zera taxa;
- alterar `Local` para `Entrega`/`Retirada` preserva carrinho, mas o usuário não pode voltar a avançar sem cliente cadastrado válido.

A etapa exibida deve ser corrigida apenas pelas validações de avanço, não por efeitos que eliminem dados silenciosamente.

## 10. Cancelamento e proteção contra perda de rascunho

### 10.1 Cancelar venda

`Cancelar venda` permanece disponível durante o fluxo.

Se o rascunho estiver efetivamente vazio/prístino, cancelar pode sair diretamente.

Se houver dados relevantes alterados, a saída exige confirmação explícita antes do descarte.

Dados relevantes incluem pelo menos:

- cliente/identificação alterada pelo operador;
- tipo do pedido alterado em relação ao estado inicial;
- data alterada;
- item adicionado;
- taxa diferente de zero;
- desconto/acréscimo configurado;
- observação de item;
- formulário rápido de cliente em andamento com conteúdo digitado.

A confirmação deve usar o padrão visual já adotado pelo sistema para ações que descartam informação significativa.

### 10.2 Saída pelo menu do sistema

Ao tentar navegar para outra aba pelo `AppShell` enquanto existir rascunho sujo na Nova venda, a mesma confirmação de descarte deve ser apresentada.

A navegação só ocorre depois da confirmação.

Não será implementado nesta rodada um salvamento automático permanente do rascunho em D1 ou `localStorage`.

### 10.3 Recarregar/fechar o navegador

Persistência de rascunho entre reloads, fechamento de aba ou reinício do navegador fica fora de escopo.

Se for tecnicamente simples manter um aviso nativo de `beforeunload` apenas para rascunho sujo, isso pode ser considerado no plano, mas não é requisito obrigatório desta rodada e não deve substituir a confirmação interna de navegação.

## 11. Estado prístino e seleção inicial

Para que a confirmação de descarte não seja disparada apenas por valores padrão do formulário, a detecção de `dirty` deve comparar o rascunho com um snapshot inicial normalizado ou usar uma função central equivalente.

A implementação não deve considerar automaticamente o rascunho sujo apenas porque existem defaults técnicos, como:

- tipo inicial `Entrega`;
- data inicial de hoje;
- taxa inicial `R$ 0,00`;
- ajuste inicial `Nenhum`.

A regra atual de seleção inicial de cliente não deve ser alterada incidentalmente apenas por causa do wizard. Qualquer mudança futura para iniciar sem cliente pré-selecionado deve ser tratada como decisão de UX separada.

## 12. Arquitetura de componentes

A responsabilidade deve ser dividida de forma focada, sem duplicar estado de negócio.

Direção recomendada:

```text
NewOrder
├── NewOrderStepIndicator
├── NewOrderCustomerStep
├── NewOrderProductsStep
└── NewOrderReviewStep
    ├── OrderCart
    └── OrderCheckoutSummary
```

O catálogo existente `OrderProductCatalog` continua reutilizado na etapa 2.

O carrinho existente `OrderCart` continua reutilizado no mini resumo quando adequado ou na etapa 3; se o mini resumo exigir uma visualização muito diferente, deve existir uma unidade compacta dedicada em vez de encher `OrderCart` de condicionais de layout não relacionadas.

`OrderCheckoutSummary` continua responsável pelo fechamento financeiro e ações de checkout, podendo receber pequenos ajustes de composição para funcionar somente na etapa 3.

`NewOrder` permanece responsável por:

- estado do rascunho;
- cálculo de `customerIdentity`;
- validações de transição;
- montagem de `draft`/`numericDraft`;
- cálculo da prévia;
- criação rápida de cliente;
- salvamento;
- dirty state;
- etapa ativa.

Componentes de etapa não devem chamar diretamente a API de pedidos.

## 13. Integração com App e navegação global

Hoje `App` renderiza `NewOrder` quando `activeTab === 'new-order'` e o `AppShell` recebe navegação global.

Para proteger rascunhos, a integração deve permitir que a Nova venda sinalize se há mudanças não descartadas.

A implementação pode usar callback/controlador equivalente a:

```text
onDraftDirtyChange(dirty)
onRequestExit(targetTab)
```

ou uma solução local de responsabilidade equivalente.

A regra importante é:

- `App` continua sendo dono de `activeTab`;
- `NewOrder` continua sendo dono do rascunho;
- a confirmação de saída coordena esses dois domínios sem mover todo o rascunho para `App`.

Não deve ser criado estado duplicado de carrinho em `App` apenas para resolver a navegação.

## 14. Tratamento de erros e concorrência

### 14.1 Falha ao salvar

Se `onSubmit` falhar:

- permanecer na etapa 3;
- preservar todo o rascunho;
- mostrar erro de checkout existente ou equivalente;
- não mostrar popup de sucesso;
- permitir nova tentativa quando a condição de bloqueio terminar.

### 14.2 Requisição em andamento

Enquanto houver checkout em andamento:

- bloquear nova submissão;
- bloquear ações que possam gerar checkout duplicado;
- manter o indicador visual de processamento adotado pelo sistema;
- idempotência de backend continua sendo a proteção final.

### 14.3 Dados sincronizados durante o rascunho

Sincronização global de produtos/clientes continua funcionando enquanto a Nova venda está aberta.

O rascunho não deve ser sobrescrito por bootstrap/polling.

Se um produto já adicionado mudar de preço no catálogo antes do checkout, o frontend pode continuar exibindo a prévia com os dados locais disponíveis, mas o Worker permanece autoridade e pode retornar o valor oficial conforme as regras já existentes.

Não será adicionada nesta rodada uma experiência especial de reconciliação de preço além do tratamento de erro/resultado oficial já suportado.

## 15. Responsividade

### Mobile — 320 a 480 px

- uma etapa por vez;
- indicador de progresso compacto sem cortar rótulos essenciais;
- alvos de toque compatíveis com padrões já adotados;
- etapa Produtos com catálogo em largura total;
- barra de resumo/avançar respeita navegação inferior e safe area;
- etapa Finalizar empilha carrinho e fechamento;
- nenhum conteúdo horizontal obrigatório.

### Desktop

- etapa 1 permanece compacta, evitando largura excessiva dos campos;
- etapa 2 usa catálogo + mini carrinho lado a lado quando houver espaço;
- etapa 3 pode usar composição em colunas para carrinho e fechamento se isso mantiver boa legibilidade;
- não transformar o wizard em três páginas visualmente desconectadas.

## 16. Acessibilidade

- indicador de etapas deve expor qual etapa está ativa;
- etapas clicáveis devem ser elementos interativos reais;
- etapas futuras bloqueadas devem comunicar indisponibilidade;
- foco deve ser movido de forma previsível ao mudar de etapa, preferencialmente para o título/conteúdo principal da nova etapa;
- validações não devem depender apenas de cor;
- botões fixos mobile precisam manter ordem de foco coerente;
- controles existentes de combobox, lista, observação e pagamento preservam seus papéis semânticos.

## 17. Estratégia de testes — TDD obrigatório

Toda mudança relevante começa com teste RED que falhe pelo motivo esperado.

A implementação deve preservar os testes atuais de `NewOrder`, carrinho, catálogo, mobile, identidade local, formatação monetária e checkout.

Novos cenários mínimos:

### Navegação

1. inicia na etapa Cliente;
2. não avança com identificação inválida;
3. avança para Produtos com etapa 1 válida;
4. não avança para Finalizar com carrinho vazio;
5. avança para Finalizar após adicionar item;
6. volta para etapa anterior preservando rascunho;
7. etapa concluída anterior é navegável;
8. etapa futura não pode ser pulada.

### Preservação de estado

1. adicionar produtos → voltar ao Cliente → avançar → produtos continuam no carrinho;
2. preencher taxa/ajuste na Finalização → voltar a Produtos → retornar → valores continuam;
3. trocar cliente mantém itens;
4. trocar Entrega para Retirada/Local mantém itens e zera taxa;
5. Local para Entrega exige cliente válido antes de avançar.

### Mobile/desktop

1. mobile apresenta ação fixa com quantidade e valor;
2. ação fixa não conflita com navegação inferior;
3. desktop apresenta mini carrinho na etapa Produtos;
4. fechamento financeiro não aparece na etapa Produtos;
5. carrinho completo e fechamento aparecem somente na etapa Finalizar.

### Proteção contra descarte

1. rascunho prístino pode sair sem confirmação;
2. rascunho sujo exige confirmação ao cancelar;
3. rascunho sujo exige confirmação ao navegar pelo menu;
4. cancelar a confirmação mantém usuário e rascunho na Nova venda;
5. confirmar descarte navega e elimina o rascunho desmontado.

### Checkout

1. salvar continua usando `buildOrderPayload(numericDraft, paymentMethod)`;
2. falha mantém etapa 3 e rascunho;
3. ação duplicada fica bloqueada durante requisição;
4. `Salvar pedido` continua pendente;
5. `Salvar e receber` continua usando uma forma de pagamento;
6. payload e API não ganham campos específicos de etapa.

## 18. Gate de validação antes de staging

Antes de publicar esta mudança no ambiente de staging, executar os gates normais do projeto:

```bash
npm test
npm run lint
npm run build
npm run d1:migrate:local
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

Como esta rodada não exige migration, `d1:migrate:local` funciona como regressão de integridade das migrations existentes, não como aplicação de schema novo.

Depois dos gates verdes, a branch pode ser publicada no ambiente isolado `sistema-para-delivery-staging` para homologação humana antes de qualquer merge/release de produção.

## 19. Critérios de aceite

A rodada será considerada funcionalmente aprovada quando:

- Nova venda não apresentar mais cliente, catálogo, carrinho e fechamento em uma única página longa;
- o fluxo tiver exatamente três etapas principais: Cliente, Produtos e Finalizar;
- avançar/voltar nunca perder o rascunho;
- etapa Cliente exigir somente os dados de atendimento relevantes;
- etapa Produtos focar no catálogo;
- mobile usar resumo fixo do carrinho em vez de carrinho lateral permanente;
- desktop usar resumo lateral compacto na etapa Produtos;
- etapa Finalizar centralizar carrinho completo e ajustes financeiros;
- etapas anteriores concluídas forem navegáveis e futuras não forem puláveis;
- troca de tipo respeitar a regra da taxa sem apagar produtos;
- saída de rascunho sujo exigir confirmação;
- falha de checkout preservar integralmente o pedido montado;
- contrato da API permanecer compatível;
- Worker continuar autoridade de preço e total;
- fluxo de comanda local continuar funcionando;
- testes, lint, build e dry-runs ficarem verdes;
- homologação no ambiente de staging confirmar boa experiência em desktop e mobile.

## 20. Fora de escopo

- salvar rascunho no D1;
- recuperar rascunho após reload/reabertura do navegador;
- múltiplos pedidos em rascunho simultâneos;
- rotas URL separadas por etapa;
- mudança do contrato de `POST /api/orders`;
- migration de banco;
- cálculo automático de taxa de entrega;
- pagamento dividido;
- mudanças no modelo de catálogo/produtos;
- redesign da tela Pedidos/cozinha;
- mudança da regra de seleção inicial de cliente;
- mudanças na impressão térmica;
- alterações em produção antes da homologação em staging.
