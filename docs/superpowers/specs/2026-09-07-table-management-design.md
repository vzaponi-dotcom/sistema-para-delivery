# Gestão de Mesas e Transferência de Comandas — Design

Status: aprovado no brainstorming; aguardando revisão do documento
Data: 2026-09-07
Branch: `feature/table-management-and-transfer`
Base: `master` @ `41b693529e61a9aa91f9862b274993b4ccd63d71`

## 1. Objetivo

Transformar mesas em entidades permanentes do sistema, eliminar digitação livre de mesa durante a venda e tornar o fluxo de consumo no local mais seguro.

O escopo inclui:

- cadastro completo de mesas em `Mais → Mesas`;
- criação automática inicial de Mesa 1 até Mesa 7;
- seleção obrigatória de mesa em pedidos de consumo no local;
- cliente cadastrado opcional para consumo no local;
- indicação automática de mesa Livre/Ocupada;
- reutilização da comanda aberta ao adicionar novos pedidos na mesma mesa;
- transferência de uma comanda inteira somente para uma mesa ativa e livre;
- bloqueio de renomeação e desativação enquanto a mesa estiver ocupada;
- preservação de histórico e migração segura dos dados atuais.

Este trabalho deve ser desenvolvido em branch/PR separado do PR #12 de ajustes visuais mobile.

## 2. Decisões de produto aprovadas

1. Em `Consumo no local`, a mesa é obrigatória.
2. Cliente cadastrado é opcional e nunca substitui a mesa como identificação principal.
3. A opção de identificação por nome avulso deixa de existir para novas vendas locais.
4. As mesas são cadastradas previamente; o operador nunca digita o nome/número da mesa na venda.
5. Mesas ocupadas continuam selecionáveis para adicionar novos pedidos à mesma comanda.
6. Ao selecionar uma mesa ocupada, o sistema apenas informa que o pedido será adicionado à comanda existente; não há confirmação extra.
7. O cadastro permite adicionar, renomear, reordenar, ativar e desativar mesas.
8. Mesa ocupada não pode ser renomeada nem desativada.
9. Mesa ocupada pode ter sua comanda transferida.
10. Transferência só pode ter como destino uma mesa ativa e livre.
11. Não haverá fusão de comandas nesta versão.
12. A ação de transferência ficará centralizada em `Mais → Mesas`.
13. O sistema inicia com Mesa 1 até Mesa 7 criadas, ativas e ordenadas.

## 3. Arquitetura de dados

### 3.1 Nova entidade `tables`

Criar uma tabela dedicada para mesas, com pelo menos:

- `id`: identificador interno imutável;
- `business_id`: estabelecimento proprietário;
- `name`: nome exibido ao usuário;
- `name_key`: nome normalizado para garantir unicidade sem depender de maiúsculas/minúsculas ou espaços repetidos;
- `sort_order`: ordem de exibição;
- `is_active`: estado configurável;
- `created_at`;
- `updated_at`.

Regras:

- `id` é a identidade operacional da mesa e não muda quando o nome muda;
- `name_key` deve ser único por estabelecimento;
- normalização de `name_key`: trim, colapso de espaços internos e comparação sem diferença de caixa;
- mesas inativas permanecem no banco para preservar histórico;
- não existe exclusão definitiva de mesa nesta versão;
- mesas ocupadas não podem ser renomeadas nem desativadas.

### 3.2 Relação com comandas

A comanda deixa de depender de `table_identifier` textual como identidade principal e passa a apontar para `table_id`.

O campo textual legado `table_identifier` pode ser preservado como snapshot de exibição da comanda, sem ser usado para identidade ou unicidade operacional. Isso reduz risco de migração e mantém leitura histórica dos registros já existentes.

Semântica do snapshot:

- ao abrir uma nova comanda, `table_identifier` recebe o nome atual da mesa;
- enquanto a comanda está aberta, renomear a mesa é bloqueado;
- se a comanda for transferida, `table_id` e `table_identifier` passam a refletir a mesa de destino;
- depois que a comanda é encerrada, seu `table_identifier` fica congelado e não muda se a mesa for renomeada no futuro.

A primeira versão não cria trilha de auditoria de todas as transferências intermediárias. O histórico da comanda encerrada registra a mesa final e seu nome naquele momento.

A regra de unicidade passa a garantir uma única comanda aberta por `business_id + table_id`.

Os pedidos continuam ligados à comanda por `table_tab_id`, preservando o modelo atual de agrupamento e pagamento.

### 3.3 Cliente opcional em pedido local

Pedidos locais continuam tendo a mesa como identidade principal.

- `customer_identity_type` permanece `table` para pedidos de consumo no local;
- `orders.client_id` pode ser `NULL` ou apontar para um cliente cadastrado opcional;
- quando houver cliente opcional, `client_name_snapshot` preserva seu nome;
- quando não houver cliente, `client_name_snapshot` deve receber um texto de apresentação compatível com o schema atual, mas a UI não deve tratá-lo como identidade primária;
- telas, ticket e resumo do pedido local devem priorizar a mesa e, se houver, acrescentar o cliente como informação secundária, por exemplo `Mesa 4 · Hugo`.

Essa separação evita voltar ao modelo anterior de escolher entre mesa ou cliente.

## 4. Migração e compatibilidade

A migração deve ser conservadora e nunca descartar histórico.

Passos esperados:

1. criar a tabela `tables`;
2. criar Mesa 1 até Mesa 7 para cada estabelecimento existente, ativas e ordenadas;
3. analisar identificadores de mesa existentes em comandas antigas;
4. mapear identificadores legados equivalentes às mesas iniciais quando isso for inequívoco;
5. para qualquer identificador legado não mapeável com segurança, criar uma mesa correspondente em vez de adivinhar;
6. adicionar e preencher `table_id` nas comandas existentes;
7. preservar `table_identifier` como snapshot textual legado/histórico;
8. criar a nova unicidade de comanda aberta por `table_id`;
9. somente depois remover a dependência funcional de texto livre para novas operações.

Novas vendas locais não devem criar mesa por texto digitado.

## 5. Fluxo de Nova Venda

### 5.1 Consumo no local

Ao selecionar `Consumo no local`:

- remover a opção `Nome`;
- mostrar grade de mesas ativas;
- exigir seleção de uma mesa antes de continuar;
- indicar visualmente `Livre` ou `Ocupada`;
- manter mesa ocupada clicável;
- abaixo da mesa, mostrar `Vincular cliente cadastrado — opcional`.

### 5.2 Mesa livre

Quando uma mesa livre for selecionada:

- o pedido usa `tableId`;
- no primeiro pedido, o backend cria uma nova comanda aberta para essa mesa;
- a mesa passa a aparecer como ocupada automaticamente.

### 5.3 Mesa ocupada

Quando uma mesa ocupada for selecionada:

- mostrar mensagem como `Comanda aberta — este pedido será adicionado à Mesa 4`;
- o backend deve localizar a comanda aberta por `table_id`;
- o novo pedido é adicionado à mesma comanda.

Não existe botão manual de ocupar/liberar mesa.

## 6. Cadastro em Mais → Mesas

Criar uma tela própria de gestão de mesas.

Cada mesa deve exibir:

- nome;
- estado operacional `Livre` ou `Ocupada`;
- estado de configuração `Ativa` ou `Inativa`;
- ações permitidas pelo estado.

### 6.1 Mesa livre

Permitir:

- editar nome;
- alterar ordem;
- ativar/desativar;
- visualizar estado.

### 6.2 Mesa ocupada

Bloquear:

- renomear;
- desativar.

Permitir:

- `Transferir comanda`.

A interface deve explicar o bloqueio em vez de apenas desabilitar silenciosamente.

## 7. Transferência de comanda

A transferência é uma operação de domínio, não apenas uma alteração visual.

Fluxo:

1. operador abre `Mais → Mesas`;
2. escolhe uma mesa ocupada;
3. toca em `Transferir comanda`;
4. o sistema lista apenas mesas ativas e livres, excluindo a origem;
5. operador escolhe o destino;
6. sistema mostra confirmação única, por exemplo `Transferir Mesa 2 → Mesa 5?`;
7. backend executa a transferência de forma atômica.

Regras obrigatórias no backend:

- origem deve ter comanda aberta;
- destino deve existir no mesmo estabelecimento;
- destino deve estar ativo;
- destino deve estar livre;
- destino deve ser diferente da origem;
- não pode haver fusão de duas comandas;
- em caso de disputa simultânea, a operação e a constraint devem impedir estado inconsistente.

Após sucesso:

- a mesma comanda recebe o `table_id` da mesa de destino;
- o snapshot textual da comanda é atualizado para o nome da mesa de destino enquanto ela ainda está aberta;
- mesa de origem fica livre;
- mesa de destino fica ocupada;
- todos os pedidos permanecem vinculados à mesma comanda.

## 8. Regras de negócio no backend

As validações não podem existir apenas no frontend.

O backend deve garantir:

- pedido `Local` exige `tableId` de uma mesa ativa do mesmo estabelecimento;
- cliente é opcional em pedido local;
- se houver cliente opcional, ele deve pertencer ao mesmo estabelecimento;
- entrega/retirada continuam exigindo cliente cadastrado conforme regra atual;
- nome de mesa é único por estabelecimento usando `name_key`;
- mesa ocupada não pode ser renomeada;
- mesa ocupada não pode ser desativada;
- mesa inativa não pode receber novo pedido;
- no máximo uma comanda aberta por mesa;
- seleção de mesa ocupada reutiliza a comanda aberta;
- transferência é atômica e somente para mesa livre e ativa.

## 9. API e bootstrap

O bootstrap deve passar a entregar as mesas junto às demais coleções necessárias ao app.

As operações devem ser explícitas e separadas por responsabilidade, incluindo pelo menos:

- listar/carregar mesas;
- criar mesa;
- editar nome;
- atualizar ordem;
- ativar/desativar;
- transferir comanda.

A criação de pedido deve evoluir para receber `tableId` como referência de mesa e, opcionalmente, `clientId` para consumo local.

Não confiar em `tableIdentifier` vindo do cliente como identidade operacional.

## 10. Estado derivado Livre/Ocupada

`Livre/Ocupada` não é um campo editável da mesa.

O estado é derivado da existência de uma comanda aberta vinculada ao `table_id`.

Consequências:

- criar a primeira comanda torna a mesa ocupada;
- adicionar pedido à mesma comanda mantém ocupada;
- pagar/encerrar a comanda torna a mesa livre;
- transferir a comanda libera origem e ocupa destino.

## 11. UX e acessibilidade

Na seleção de mesas:

- usar botões grandes, adequados ao uso mobile;
- deixar estado selecionado evidente;
- mostrar selo textual `Ocupada`, não depender apenas de cor;
- manter mesas ocupadas clicáveis;
- mesas inativas não aparecem na criação de pedido;
- impedir overflow horizontal em telas pequenas.

Na gestão:

- diferenciar claramente `Ativa/Inativa` de `Livre/Ocupada`;
- explicar bloqueios de ação;
- pedir confirmação para transferência e desativação;
- evitar confirmação extra ao simplesmente selecionar uma mesa ocupada durante uma venda.

## 12. Testes obrigatórios em TDD

Implementar cada regra relevante com teste RED antes da mudança de produção.

Cobertura mínima:

### Dados e migração

- criação da tabela `tables`;
- seed Mesa 1 até Mesa 7;
- migração de identificadores legados;
- preservação de snapshots históricos;
- unicidade de `name_key`;
- unicidade de uma comanda aberta por mesa.

### Pedidos locais

- pedido local sem `tableId` é recusado;
- mesa inexistente é recusada;
- mesa de outro estabelecimento é recusada;
- mesa inativa é recusada;
- cliente pode estar ausente;
- cliente cadastrado opcional é persistido quando informado;
- cliente opcional de outro estabelecimento é recusado;
- primeira venda abre comanda;
- novo pedido em mesa ocupada reutiliza a comanda.

### Gestão de mesas

- criar mesa;
- renomear mesa livre;
- impedir renomeação de mesa ocupada;
- desativar mesa livre;
- impedir desativação de mesa ocupada;
- ordenar mesas;
- impedir duplicidade de nome normalizado.

### Transferência

- transferir para mesa livre funciona;
- origem fica livre;
- destino fica ocupado;
- pedidos permanecem na mesma comanda;
- snapshot da comanda passa a refletir o destino;
- destino ocupado é recusado;
- destino inativo é recusado;
- destino de outro estabelecimento é recusado;
- origem sem comanda é recusada;
- transferência para a própria mesa é recusada;
- disputa concorrente não cria duas comandas abertas na mesma mesa.

### UI

- `Nome` não aparece mais como identificação local;
- apenas mesas ativas aparecem na seleção;
- mesa ocupada exibe indicador e continua selecionável;
- cliente aparece como opcional;
- resumo de pedido local prioriza mesa e acrescenta cliente quando existir;
- ações bloqueadas na gestão refletem as regras de domínio.

## 13. Homologação em staging

Roteiro físico mínimo:

1. confirmar que Mesa 1 até Mesa 7 existem;
2. criar venda local na Mesa 1 sem cliente;
3. confirmar Mesa 1 como ocupada;
4. criar segundo pedido na Mesa 1 e confirmar que entrou na mesma comanda;
5. criar outro pedido vinculando cliente cadastrado opcionalmente;
6. confirmar que a identificação continua priorizando Mesa 1;
7. tentar renomear Mesa 1 e confirmar bloqueio;
8. tentar desativar Mesa 1 e confirmar bloqueio;
9. transferir Mesa 1 para Mesa 5;
10. confirmar Mesa 1 livre e Mesa 5 ocupada;
11. confirmar que a comanda manteve todos os pedidos e passou a mostrar Mesa 5;
12. finalizar/pagar a comanda;
13. confirmar Mesa 5 livre;
14. renomear uma mesa livre e confirmar que comandas já encerradas não tiveram o snapshot reescrito.

## 14. Fora de escopo

Não fazer nesta versão:

- fusão de comandas;
- trilha de auditoria completa de transferências intermediárias;
- divisão de comanda por pessoa;
- reserva de mesa;
- mapa visual/planta do salão;
- capacidade/quantidade de lugares;
- múltiplos ambientes ou setores;
- exclusão definitiva de mesa;
- mudança no fluxo de impressão além do necessário para continuar exibindo corretamente a identificação já persistida;
- qualquer trabalho de Windows/QZ.

## 15. Estratégia de entrega

- branch isolada: `feature/table-management-and-transfer`;
- PR próprio, separado do PR #12;
- TDD estrito;
- revisão completa de diff;
- CI totalmente verde;
- deploy apenas em staging para homologação;
- merge para `master` somente após homologação física e aprovação explícita;
- produção somente após aprovação explícita posterior.
