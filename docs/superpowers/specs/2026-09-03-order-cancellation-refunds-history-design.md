# Design — Cancelamento de pedidos, estornos e histórico separado

Data: 2026-09-03
Status: aprovado em conversa, aguardando revisão final da especificação

## 1. Objetivo

Substituir a exclusão física de pedidos por um fluxo auditável de cancelamento, separar o Histórico da fila operacional e tratar corretamente pedidos cancelados que já tenham pagamento.

Princípio central: um cancelamento altera o estado do pedido; ele não apaga o que aconteceu. Pagamentos recebidos permanecem registrados e devoluções ao cliente são novas saídas financeiras vinculadas ao pedido e ao pagamento original.

## 2. Problema atual

Hoje a interface permite excluir pedidos ativos e finalizados. O backend executa hard delete: o pedido desaparece, itens e pagamento são removidos por cascata e a movimentação automática de pagamento é apagada.

Os totais recalculam de forma coerente após a exclusão, mas o sistema perde a trilha de auditoria e passa a representar o pedido como se nunca tivesse existido.

## 3. Decisões aprovadas

- A lixeira será substituída por **Cancelar pedido**.
- Cancelamento é irreversível.
- Pedidos **Em preparo** e **Finalizados** podem ser cancelados.
- Todo cancelamento exige motivo.
- Motivos iniciais: Cliente desistiu, Pedido duplicado, Produto indisponível, Erro no lançamento e Outro.
- **Outro** exige uma descrição complementar.
- Cancelamento de pedido pago trabalha apenas com estorno integral nesta versão.
- Ao cancelar pedido pago, o sistema pergunta se o valor já foi devolvido.
- Se já foi devolvido, o usuário informa a forma de estorno e a saída é registrada no mesmo fluxo.
- Se ainda não foi devolvido, o pedido fica com **Estorno pendente**.
- Estornos pendentes serão gerenciados no topo do **Financeiro**.
- A forma de estorno será registrada; a mesma forma do pagamento original será apenas uma sugestão inicial.
- O **Histórico de Pedidos** será uma tela separada.
- Desktop: Histórico logo após Pedidos. Mobile: Histórico em Mais, com atalho **Ver histórico** em Pedidos.
- **Recebido hoje** passa a representar pagamentos de pedidos recebidos no dia menos estornos registrados no dia.

## 4. Arquitetura escolhida

Adotaremos **soft cancel no pedido + estorno como movimentação financeira vinculada**.

Não haverá tabela específica de estornos nesta versão. O pedido guarda os dados do cancelamento. A devolução é uma movimentação financeira de saída com origem `order-refund`, vinculada por `order_id` e `payment_id` ao pedido e ao pagamento original.

Não será criado `refund_status` redundante no pedido. A situação será derivada:

- Cancelado + não pago -> sem estorno necessário.
- Cancelado + pago + sem `order-refund` -> **Estorno pendente**.
- Cancelado + pago + com `order-refund` -> **Estornado**.

## 5. Estados do pedido

Estados operacionais relevantes:

- **Em preparo** — ativo na operação.
- **Finalizado** — concluído operacionalmente.
- **Cancelado** — terminal e irreversível.

Transições permitidas:

- Em preparo -> Finalizado.
- Em preparo -> Cancelado.
- Finalizado -> Cancelado.
- Cancelado -> nenhuma transição de retorno.

## 6. Persistência do cancelamento

A tabela `orders` receberá campos aditivos:

- `cancelled_at` — data/hora do cancelamento;
- `cancel_reason` — código estável do motivo;
- `cancel_reason_note` — descrição complementar, obrigatória quando o motivo for Outro.

Pedidos existentes continuam válidos; os novos campos ficam nulos para registros não cancelados.

## 7. Estorno financeiro

O pagamento original e sua movimentação de entrada nunca são apagados pelo cancelamento.

Quando a devolução ocorrer, será criada uma movimentação de saída com:

- `source = 'order-refund'`;
- valor = 100% do valor efetivamente pago;
- data/hora do registro;
- forma de devolução;
- `order_id` do pedido cancelado;
- `payment_id` do pagamento original.

Exemplo:

- `+ R$ 80,00 — Pagamento pedido #1234 — Pix`
- `- R$ 80,00 — Estorno pedido #1234 — Pix`

## 8. Fluxos de cancelamento

### 8.1 Pedido não pago

1. Usuário toca em **Cancelar pedido**.
2. Seleciona motivo obrigatório.
3. Se escolher Outro, informa a descrição.
4. Confirma.
5. Pedido vira Cancelado, sai da operação e permanece no Histórico.
6. Não há movimentação financeira de estorno.

### 8.2 Pedido pago, ainda não devolvido

1. Usuário informa o motivo.
2. Sistema pergunta se o valor já foi devolvido.
3. Usuário responde Não.
4. Pedido vira Cancelado.
5. Pagamento e entrada financeira permanecem.
6. O pedido passa a ser derivado como **Estorno pendente**.
7. A pendência aparece no Financeiro.

### 8.3 Pedido pago, já devolvido

1. Usuário informa o motivo.
2. Responde Sim à pergunta sobre devolução.
3. Informa a forma de estorno.
4. Backend grava cancelamento e saída `order-refund` como uma única operação consistente.
5. O pedido passa a ser derivado como **Estornado**.

## 9. Tela Pedidos

A tela Pedidos fica dedicada à operação atual.

Ela deve:

- listar apenas pedidos ativos;
- manter ações operacionais como finalizar;
- substituir a lixeira por **Cancelar pedido**;
- não listar Finalizados ou Cancelados na fila operacional;
- oferecer **Ver histórico**;
- não expor exclusão física de pedido.

## 10. Histórico de Pedidos

Nova tela própria contendo Finalizados e Cancelados.

Filtros mínimos:

- Todos;
- Finalizados;
- Cancelados.

A busca seguirá o padrão já existente e deverá localizar pedidos pelos dados relevantes disponíveis na listagem.

Pedido cancelado deve mostrar:

- badge Cancelado;
- motivo;
- descrição, quando houver;
- data/hora do cancelamento;
- situação financeira: sem estorno necessário, Estorno pendente ou Estornado.

Pedidos Finalizados ainda podem ser cancelados no Histórico. Pedidos Cancelados não podem ser reativados.

## 11. Navegação

Desktop:

1. Dashboard
2. Pedidos
3. Histórico
4. Clientes
5. Produtos
6. A Receber
7. Financeiro

Mobile:

- Histórico fica em **Mais**;
- Pedidos expõe o atalho **Ver histórico**;
- a barra inferior não recebe um novo item.

## 12. Financeiro — Estornos pendentes

No topo do Financeiro haverá uma seção **Estornos pendentes**, destacada apenas quando houver itens.

Cada item deve mostrar pelo menos:

- pedido;
- cliente ou identificação do atendimento local;
- valor integral a devolver;
- data do cancelamento;
- ação **Registrar estorno**.

Ao registrar:

1. forma de devolução é obrigatória;
2. forma do pagamento original é sugerida;
3. valor é calculado e fixado pelo backend;
4. backend valida elegibilidade;
5. cria a saída `order-refund`;
6. a pendência desaparece da seção;
7. a movimentação permanece no histórico financeiro.

## 13. Regras de indicadores

Pedidos Cancelados ficam fora de:

- vendas do dia e por período;
- quantidade de pedidos válidos;
- ticket médio;
- produtos mais vendidos;
- composição por forma de pagamento das vendas;
- A Receber;
- pedidos ativos;
- demais métricas comerciais que representam venda válida.

### Recebido hoje

Passa a ser:

`pagamentos de pedidos recebidos no dia - estornos de pedidos registrados no dia`

Assim:

- pagamento e estorno no mesmo dia -> líquido zero;
- pagamento hoje e estorno amanhã -> entrada hoje e saída amanhã;
- nenhum dia anterior é reescrito retroativamente.

O Fluxo de Caixa continua baseado nas movimentações financeiras reais.

## 14. Comandas e atendimento local

Consultas que identificam pedidos pendentes de uma comanda devem ignorar status Cancelado.

Se o pedido cancelado era o último pedido pendente, a comanda poderá ser encerrada pela regra normal de liquidação, desde que não exista outro pedido válido pendente.

## 15. API

O backend será a fonte de verdade das regras.

### 15.1 Cancelar pedido

Será criada uma operação semântica de cancelamento.

Validações:

- pedido existe e pertence ao negócio autenticado;
- estado atual permite cancelamento;
- pedido ainda não está Cancelado;
- motivo é válido;
- Outro exige descrição;
- em estorno imediato, forma de devolução é válida.

O backend deverá suportar:

- cancelamento sem estorno imediato;
- cancelamento com estorno integral imediato.

Cancelamento + estorno imediato devem ter consistência atômica: não pode existir sucesso parcial.

### 15.2 Registrar estorno posterior

Operação própria para pedido cancelado com devolução pendente.

Validações:

- pedido existe e pertence ao negócio autenticado;
- pedido está Cancelado;
- existe pagamento válido;
- ainda não existe `order-refund` para o pedido;
- forma de devolução é válida;
- valor é calculado pelo backend e não aceito livremente do cliente.

Uma segunda tentativa de estorno integral será rejeitada com erro de domínio.

## 16. Fim do hard delete operacional

O endpoint público atual de `DELETE /api/orders/:id` será removido como parte desta mudança, juntamente com o cliente de API e as ações de interface que o utilizam.

Não haverá capacidade administrativa de hard delete de pedidos nesta entrega. Caso isso seja necessário futuramente, será uma funcionalidade separada e deliberadamente restrita.

Cancelamento nunca apaga:

- pedido;
- itens;
- pagamento original;
- movimentação de entrada do pagamento.

## 17. Compatibilidade e migração

A migração será aditiva.

Pedidos existentes não terão status alterado. Os novos campos começam nulos.

Como `status` já é textual, Cancelado será introduzido sem reescrever os pedidos antigos.

Toda consulta que hoje use “não finalizado” como sinônimo de ativo deverá ser revisada para não incluir Cancelado. O mesmo vale para consultas que inferem pendência apenas pela ausência de pagamento, especialmente em A Receber e comandas.

## 18. Erros e consistência

Devem falhar sem alteração parcial:

- cancelar pedido já cancelado;
- cancelar sem motivo;
- Outro sem descrição;
- estornar pedido não cancelado;
- estornar pedido não pago;
- registrar segundo estorno integral;
- forma de devolução ausente ou inválida;
- tentativa do cliente de definir valor diferente do estorno integral.

Falha durante cancelamento com estorno imediato não pode deixar o sistema marcando estorno concluído sem a correspondente saída financeira.

## 19. Áreas impactadas

O plano de implementação deverá mapear os arquivos concretos no estado atual do repositório para, no mínimo:

- Pedidos;
- nova tela Histórico;
- navegação desktop e mobile;
- fluxo/modal de cancelamento;
- fluxo/modal de estorno;
- StatusBadge;
- App/estado central;
- cliente de API;
- Worker/router;
- repositórios de pedidos, pagamentos e movimentos;
- migrations D1;
- A Receber;
- Financeiro;
- Dashboard/analytics;
- utilitários de status;
- fechamento de comandas;
- testes afetados.

Não haverá refatoração não relacionada ao objetivo desta feature.

## 20. Estratégia de testes

A implementação seguirá TDD.

Cobertura obrigatória:

1. cancelado não pago permanece no banco;
2. cancelado não pago sai das métricas e de A Receber;
3. cancelado pago sem devolução gera Estorno pendente;
4. pagamento e entrada originais permanecem;
5. cancelado pago com devolução cria uma única saída integral;
6. segundo estorno é rejeitado;
7. motivo é obrigatório;
8. Outro exige descrição;
9. Finalizado pode ser cancelado;
10. Cancelado não pode ser reaberto;
11. Cancelado não aparece em Pedidos ativos;
12. Cancelado aparece no Histórico;
13. filtros do Histórico funcionam;
14. comandas ignoram Cancelados ao avaliar pendências;
15. Dashboard exclui Cancelados de métricas comerciais;
16. Recebido hoje desconta estornos registrados no dia;
17. Financeiro lista e resolve estornos pendentes;
18. forma de estorno é persistida;
19. navegação desktop e mobile para Histórico funciona;
20. regressões existentes de criação, finalização, pagamento e comandas continuam passando.

## 21. Validação técnica

Antes de considerar a implementação concluída, será exigida validação fresca de:

- suíte completa de testes;
- lint;
- build de produção;
- Worker dry-run;
- migrations;
- regressões de pedidos, pagamentos, Financeiro, Dashboard, A Receber e comandas.

Deploy não faz parte implicitamente desta especificação. Produção só será alterada após implementação validada e autorização explícita.

## 22. Fora de escopo

- estorno parcial;
- múltiplos estornos para o mesmo pedido;
- reabertura de cancelado;
- permissões diferenciadas para aprovação de cancelamento;
- auditoria por funcionário/usuário;
- tabela própria de refunds;
- sistema genérico de eventos de pedido;
- integração do cancelamento com o futuro cardápio digital;
- devolução automática via Pix, adquirente ou gateway.

## 23. Critérios de aceite

A feature estará correta quando:

- cancelar não apagar nenhum pedido;
- todo cancelamento permanecer no Histórico;
- todo cancelamento possuir motivo válido;
- Outro exigir descrição;
- pagamentos originais permanecerem auditáveis;
- estornos pendentes forem gerenciáveis no Financeiro;
- devolução registrada gerar uma saída integral vinculada ao pedido e pagamento;
- cancelados não entrarem em vendas, ticket, produtos mais vendidos, A Receber ou pedidos ativos;
- Recebido hoje representar o líquido diário de pagamentos menos estornos;
- comandas não ficarem abertas por causa de pedidos cancelados;
- Pedidos representar apenas operação ativa;
- Histórico concentrar Finalizados e Cancelados;
- estorno integral duplicado ser impossível;
- dados existentes continuarem compatíveis após a migração.
