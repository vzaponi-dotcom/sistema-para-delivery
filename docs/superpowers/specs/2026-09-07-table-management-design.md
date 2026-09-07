# Gestão de Mesas e Transferência de Comandas — Design

**Status:** aprovado
**Data:** 2026-09-07
**Branch:** `feature/table-management-and-transfer-v2`
**Base:** `master` @ `2114b9539786fb0528d3ea51adb8e687b5dd3944`

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

Este trabalho deve permanecer isolado do trabalho de impressão/Windows/QZ e de outras funcionalidades.

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
14. Não existe exclusão definitiva de mesa nesta versão.

## 3. Arquitetura de dados

### 3.1 Nova entidade `tables`

Criar uma tabela dedicada para mesas com:

- `id`: identificador interno imutável;
- `business_id`: estabelecimento proprietário;
- `name`: nome exibido ao usuário;
- `name_key`: nome normalizado;
- `sort_order`: ordem de exibição;
- `is_active`: estado configurável;
- `created_at`;
- `updated_at`.

Regras:

- `id` é a identidade operacional e não muda quando o nome muda;
- `name_key` é único por estabelecimento;
- normalização de `name_key`: trim, colapso de espaços internos e comparação sem diferença de caixa;
- mesas inativas permanecem no banco para preservar histórico;
- mesas ocupadas não podem ser renomeadas nem desativadas.

### 3.2 Relação com comandas

A comanda deixa de depender de `table_identifier` textual como identidade principal e passa a apontar para `table_id`.

O campo legado `table_identifier` permanece como snapshot de exibição/histórico e não deve mais ser usado como identidade operacional.

Semântica do snapshot:

- ao abrir uma nova comanda, `table_identifier` recebe o nome atual da mesa;
- enquanto a comanda está aberta, renomear a mesa é bloqueado;
- se a comanda for transferida, `table_id` e `table_identifier` passam a refletir a mesa de destino;
- depois que a comanda é encerrada, `table_identifier` fica congelado e não muda com renomeações futuras.

A primeira versão não cria trilha de auditoria das transferências intermediárias. O histórico da comanda encerrada registra a mesa final e seu nome naquele momento.

A unicidade operacional deve garantir uma única comanda aberta por `business_id + table_id`.

Os pedidos continuam ligados à comanda por `table_tab_id`.

### 3.3 Cliente opcional em pedido local

Pedidos locais continuam tendo a mesa como identidade principal.

- `customer_identity_type` permanece `table` para novos pedidos de consumo no local;
- `orders.client_id` pode ser `NULL` ou apontar para um cliente cadastrado opcional;
- quando houver cliente opcional, `client_name_snapshot` preserva seu nome;
- quando não houver cliente, o snapshot textual deve continuar compatível com o schema atual, mas a UI não deve tratá-lo como identidade primária;
- telas, ticket e resumo devem priorizar a mesa e acrescentar o cliente como informação secundária quando existir, por exemplo `Mesa 4 · Hugo`.

Entrega e retirada continuam exigindo cliente cadastrado.

Pedidos históricos antigos com `guest_name` devem continuar legíveis, mas novas vendas locais não podem criar esse tipo de identidade.

## 4. Migração e compatibilidade

A migração deve ser conservadora e nunca descartar histórico.

Passos esperados:

1. criar `tables`;
2. criar Mesa 1 até Mesa 7 para cada estabelecimento existente, ativas e ordenadas;
3. analisar identificadores de mesa existentes em comandas antigas;
4. mapear identificadores legados equivalentes às mesas iniciais somente quando isso for inequívoco;
5. para qualquer identificador legado não mapeável com segurança, criar uma mesa correspondente em vez de adivinhar;
6. adicionar e preencher `table_id` nas comandas existentes;
7. preservar `table_identifier` como snapshot textual;
8. substituir a unicidade de comanda aberta por texto pela unicidade por `table_id`;
9. somente depois remover a dependência funcional de texto livre para novas operações.

## 5. Fluxo de Nova Venda

Ao selecionar `Consumo no local`:

- remover a opção `Nome` e o campo de mesa livre;
- mostrar uma grade de mesas ativas;
- exigir seleção de uma mesa antes de continuar;
- indicar visualmente `Livre` ou `Ocupada`;
- manter mesa ocupada clicável;
- abaixo da mesa, mostrar `Vincular cliente cadastrado — opcional`.

Mesa livre:

- o pedido envia `tableId`;
- o primeiro pedido abre uma nova comanda;
- a mesa passa a aparecer como ocupada automaticamente.

Mesa ocupada:

- mostrar mensagem como `Comanda aberta — este pedido será adicionado à Mesa 4`;
- o backend localiza a comanda por `table_id`;
- o novo pedido entra na mesma comanda.

Não existe botão manual de ocupar/liberar mesa.

## 6. Cadastro em Mais → Mesas

Criar uma tela própria de gestão de mesas.

Cada mesa deve exibir:

- nome;
- estado operacional `Livre` ou `Ocupada`;
- estado de configuração `Ativa` ou `Inativa`;
- ações permitidas pelo estado.

Mesa livre permite:

- editar nome;
- alterar ordem;
- ativar/desativar;
- visualizar estado.

Mesa ocupada:

- não permite renomear;
- não permite desativar;
- permite `Transferir comanda`.

A interface deve explicar bloqueios em vez de apenas desabilitar silenciosamente.

## 7. Transferência de comanda

Fluxo:

1. operador abre `Mais → Mesas`;
2. escolhe uma mesa ocupada;
3. toca em `Transferir comanda`;
4. o sistema lista somente mesas ativas e livres, excluindo a origem;
5. operador escolhe o destino;
6. o sistema pede uma confirmação única, por exemplo `Transferir Mesa 2 → Mesa 5?`;
7. o backend executa a transferência de forma atômica.

Regras obrigatórias no backend:

- origem deve ter comanda aberta;
- destino deve existir no mesmo estabelecimento;
- destino deve estar ativo;
- destino deve estar livre;
- destino deve ser diferente da origem;
- não pode haver fusão de duas comandas;
- concorrência não pode criar estado inconsistente.

Após sucesso:

- a mesma comanda recebe o `table_id` do destino;
- o snapshot textual da comanda é atualizado para o nome do destino enquanto aberta;
- origem fica livre;
- destino fica ocupado;
- todos os pedidos continuam vinculados à mesma comanda.

## 8. Regras de negócio no backend

O backend deve garantir, independentemente da UI:

- pedido `Local` exige `tableId` de mesa ativa do mesmo estabelecimento;
- cliente é opcional em pedido local;
- cliente opcional, quando informado, deve pertencer ao mesmo estabelecimento;
- entrega/retirada continuam exigindo cliente cadastrado;
- nome de mesa é único por estabelecimento usando `name_key`;
- mesa ocupada não pode ser renomeada;
- mesa ocupada não pode ser desativada;
- mesa inativa não pode receber novo pedido;
- existe no máximo uma comanda aberta por mesa;
- mesa ocupada reutiliza a comanda aberta;
- transferência é atômica e somente para mesa ativa e livre.

## 9. API e bootstrap

O bootstrap deve passar a entregar `tables` junto às coleções existentes.

Operações explícitas mínimas:

- criar mesa;
- editar nome/estado configurável;
- atualizar ordem;
- transferir comanda.

A criação de pedido recebe `tableId` como referência da mesa e, opcionalmente, `clientId` para consumo local.

O backend nunca deve confiar em `tableIdentifier` enviado pelo navegador como identidade operacional.

## 10. Estado derivado Livre/Ocupada

`Livre/Ocupada` não é campo editável da mesa. É derivado da existência de uma comanda aberta ligada ao `table_id`.

- abrir a primeira comanda torna a mesa ocupada;
- adicionar pedido à mesma comanda mantém ocupada;
- pagar/encerrar a comanda torna a mesa livre;
- transferir libera a origem e ocupa o destino.

## 11. UX e acessibilidade

Seleção de mesas:

- botões adequados ao uso mobile;
- estado selecionado evidente;
- selo textual `Ocupada`, não depender apenas de cor;
- ocupadas continuam clicáveis;
- inativas não aparecem na criação de pedido;
- sem overflow horizontal.

Gestão:

- diferenciar claramente `Ativa/Inativa` de `Livre/Ocupada`;
- explicar bloqueios;
- pedir confirmação para transferência e desativação;
- não pedir confirmação extra ao selecionar mesa ocupada durante uma venda;
- reordenação deve ser utilizável em mobile e teclado; drag-and-drop não é requisito.

## 12. Testes obrigatórios em TDD

Cada regra relevante deve ter teste RED antes da mudança de produção.

Cobertura mínima:

### Dados e migração

- criação de `tables`;
- seed Mesa 1 até Mesa 7;
- migração de identificadores legados;
- preservação de snapshots históricos;
- unicidade de `name_key`;
- unicidade de uma comanda aberta por mesa.

### Pedidos locais

- pedido local sem `tableId` é recusado;
- mesa inexistente, de outro estabelecimento ou inativa é recusada;
- cliente pode estar ausente;
- cliente cadastrado opcional é persistido;
- cliente opcional de outro estabelecimento é recusado;
- primeira venda abre comanda;
- novo pedido em mesa ocupada reutiliza a comanda.

### Gestão de mesas

- criar mesa;
- renomear mesa livre;
- impedir renomeação de mesa ocupada;
- desativar mesa livre;
- impedir desativação de mesa ocupada;
- reordenar mesas;
- impedir duplicidade de nome normalizado.

### Transferência

- transferir para mesa livre funciona;
- origem fica livre e destino ocupado;
- pedidos permanecem na mesma comanda;
- snapshot passa a refletir o destino;
- destino ocupado/inativo/de outro estabelecimento é recusado;
- origem sem comanda é recusada;
- transferência para a própria mesa é recusada;
- disputa concorrente não cria duas comandas abertas na mesma mesa.

### UI

- `Nome` e mesa digitada não aparecem mais para novas vendas locais;
- somente mesas ativas aparecem na seleção;
- mesa ocupada exibe indicador e continua selecionável;
- cliente aparece como opcional;
- resumo local prioriza mesa e acrescenta cliente quando existir;
- ações bloqueadas na gestão refletem regras de domínio.

## 13. Homologação em staging

Roteiro físico mínimo:

1. confirmar Mesa 1 até Mesa 7;
2. criar venda local na Mesa 1 sem cliente;
3. confirmar Mesa 1 ocupada;
4. criar segundo pedido na Mesa 1 e confirmar mesma comanda;
5. criar outro pedido com cliente opcional;
6. confirmar que a identificação continua priorizando Mesa 1;
7. tentar renomear e desativar Mesa 1 e confirmar bloqueios;
8. transferir Mesa 1 para Mesa 5;
9. confirmar Mesa 1 livre e Mesa 5 ocupada;
10. confirmar que a mesma comanda manteve todos os pedidos e passou a mostrar Mesa 5;
11. finalizar/pagar a comanda;
12. confirmar Mesa 5 livre;
13. renomear uma mesa livre e confirmar que comandas encerradas não tiveram o snapshot reescrito.

## 14. Fora de escopo

- fusão de comandas;
- auditoria completa de transferências intermediárias;
- divisão de comanda por pessoa;
- reserva de mesa;
- mapa/planta do salão;
- quantidade de lugares;
- múltiplos ambientes/setores;
- exclusão definitiva de mesa;
- alteração do transporte ou do comportamento de impressão além de continuar exibindo a identificação persistida corretamente;
- qualquer trabalho de Windows/QZ.

## 15. Estratégia de entrega

- branch isolada: `feature/table-management-and-transfer-v2`;
- PR próprio;
- TDD estrito;
- revisão completa do diff;
- CI totalmente verde;
- deploy apenas em staging para homologação;
- merge para `master` somente após homologação física e aprovação explícita;
- produção somente após aprovação explícita posterior.
