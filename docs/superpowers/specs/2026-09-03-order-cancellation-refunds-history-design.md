# Design — Cancelamento de pedidos, estornos e histórico separado

Data: 2026-09-03
Status: aprovado em conversa, aguardando revisão final da especificação

## 1. Objetivo

Substituir a exclusão física de pedidos por um fluxo auditável de cancelamento, separar o histórico da fila operacional e tratar corretamente o impacto financeiro de pedidos cancelados, inclusive quando já houver pagamento.

O desenho deve preservar a realidade operacional e financeira: pedidos cancelados continuam existindo para auditoria, pagamentos recebidos não são apagados e devoluções ao cliente são registradas como saídas financeiras vinculadas ao pedido e ao pagamento original.

## 2. Problemas atuais

Hoje a interface expõe uma ação de excluir pedido tanto na fila ativa quanto no histórico. No backend, essa ação executa hard delete do pedido. Itens e pagamentos são removidos por cascata, e a movimentação automática de pagamento é apagada antes da exclusão.

Como consequência, os indicadores financeiros e comerciais recalculam corretamente após a exclusão, mas o sistema passa a representar o pedido como se nunca tivesse existido. Isso impede auditoria de cancelamentos, apaga a trilha do pagamento e não permite distinguir uma venda válida de um pedido que foi cancelado depois.

## 3. Decisões de produto aprovadas

1. A ação de lixeira será substituída por uma ação explícita **Cancelar pedido**.
2. Cancelamento será irreversível.
3. Pedidos em preparo e finalizados poderão ser cancelados.
4. Todo cancelamento exigirá um motivo.
5. Motivos iniciais:
   - Cliente desistiu
   - Pedido duplicado
   - Produto indisponível
   - Erro no lançamento
   - Outro
6. Quando o motivo for **Outro**, uma descrição complementar será obrigatória.
7. Cancelamento de pedido pago implica estorno integral quando a devolução for registrada. Reembolso parcial não faz parte desta versão.
8. Para pedido pago, o sistema perguntará se o valor já foi devolvido ao cliente.
9. Se a devolução já tiver ocorrido, o usuário informará a forma de estorno e o sistema registrará a saída financeira no mesmo fluxo.
10. Se a devolução ainda não tiver ocorrido, o pedido ficará com estorno pendente e será gerenciado pelo painel Financeiro.
11. O Financeiro terá uma seção destacada **Estornos pendentes** no topo da tela.
12. A forma de estorno será registrada explicitamente. A interface sugerirá a mesma forma do pagamento original, mas permitirá alteração.
13. O Histórico de Pedidos será uma tela própria, separada da fila operacional.
14. No desktop, Histórico ficará logo após Pedidos na navegação lateral.
15. No mobile, Histórico ficará dentro de **Mais**. A tela Pedidos terá um atalho discreto **Ver histórico**.
16. O card **Recebido hoje** passará a representar o valor líquido de pagamentos de pedidos no dia: entradas de pagamentos menos estornos realizados naquele dia.

## 4. Abordagem arquitetural escolhida

A solução adotada será **cancelamento persistido no pedido + estorno como movimentação financeira vinculada**.

Não será criada uma tabela específica de estornos nesta versão. O pedido armazenará os dados do cancelamento, enquanto a devolução será representada por uma movimentação financeira de saída com uma origem própria, por exemplo `order-refund`, vinculada ao pedido e ao pagamento original.

Essa abordagem foi escolhida por resolver o problema atual com boa auditabilidade, baixo acoplamento e sem antecipar complexidade de reembolsos parciais ou múltiplos estornos.

## 5. Estados do pedido

Os estados operacionais relevantes passam a ser:

- **Em preparo** — pedido ativo na operação.
- **Finalizado** — pedido concluído operacionalmente.
- **Cancelado** — estado terminal e irreversível.

Regras:

- Em preparo -> pode finalizar ou cancelar.
- Finalizado -> pode cancelar.
- Cancelado -> não pode ser reaberto, finalizado novamente ou cancelado novamente.
- Um pedido cancelado permanece persistido e disponível no Histórico.

## 6. Dados do cancelamento

A tabela de pedidos deverá armazenar, além do `status`, os seguintes dados:

- `cancelled_at` — data e hora do cancelamento.
- `cancel_reason` — código estável do motivo selecionado.
- `cancel_reason_note` — descrição complementar; obrigatória apenas quando o motivo for `Outro`.

Os novos campos serão opcionais para preservar compatibilidade com pedidos existentes. Para pedidos não cancelados, permanecem nulos.

Não será persistido um campo redundante de `refund_status` no pedido.

A situação financeira do cancelamento será derivada dos dados existentes:

- Cancelado + não pago -> sem estorno necessário.
- Cancelado + pago + sem movimentação de estorno -> **Estorno pendente**.
- Cancelado + pago + com movimentação de estorno -> **Estornado**.

A intenção é evitar estados impossíveis, como pedido marcado como estornado sem uma saída financeira correspondente.

## 7. Registro do estorno

O pagamento original nunca será apagado em razão do cancelamento.

Quando houver devolução ao cliente, será criada uma movimentação financeira de saída com:

- valor igual a 100% do valor efetivamente pago do pedido;
- data e hora do registro do estorno;
- forma de devolução;
- origem específica de estorno de pedido, por exemplo `order-refund`;
- vínculo com `order_id`;
- vínculo com o pagamento original, quando a estrutura atual permitir esse relacionamento de forma consistente.

Exemplo de trilha financeira:

- `+ R$ 80,00 — Pagamento pedido #1234 — Pix`
- `- R$ 80,00 — Estorno pedido #1234 — Pix`

O saldo líquido é zero, mas a entrada e a devolução continuam auditáveis.

## 8. Fluxo de cancelamento na interface

### 8.1 Pedido não pago

1. Usuário toca em **Cancelar pedido**.
2. Sistema abre confirmação de cancelamento.
3. Usuário seleciona o motivo obrigatório.
4. Se o motivo for Outro, informa a descrição obrigatória.
5. Confirma.
6. Pedido passa para Cancelado.
7. Pedido sai da fila operacional.
8. Pedido aparece no Histórico.
9. Pedido deixa de participar de vendas, recebíveis e demais indicadores de venda válida.

### 8.2 Pedido pago — valor ainda não devolvido

1. Usuário inicia o cancelamento e informa o motivo.
2. Sistema detecta que existe pagamento.
3. Sistema pergunta: **O valor já foi devolvido ao cliente?**
4. Usuário responde **Não**.
5. Pedido é cancelado.
6. Pagamento e entrada financeira original permanecem intactos.
7. Pedido passa a aparecer como **Estorno pendente**.
8. Pendência é exibida na seção Estornos pendentes do Financeiro.

### 8.3 Pedido pago — valor já devolvido

1. Usuário inicia o cancelamento e informa o motivo.
2. Sistema pergunta se o valor já foi devolvido.
3. Usuário responde **Sim**.
4. Sistema solicita a forma da devolução, pré-selecionando a forma do pagamento original quando possível.
5. Usuário confirma.
6. Backend grava o cancelamento e o estorno como uma única operação lógica.
7. Pedido fica Cancelado e sua situação financeira é derivada como Estornado.

## 9. Tela Pedidos

A tela Pedidos passa a representar somente a operação atual.

Ela deve:

- listar pedidos ainda ativos;
- manter ações operacionais existentes, como finalizar;
- substituir a lixeira por **Cancelar pedido**;
- remover pedidos Finalizados e Cancelados da fila operacional;
- expor um atalho **Ver histórico**;
- não usar exclusão física como ação operacional de usuário.

## 10. Nova tela Histórico de Pedidos

O Histórico será separado da tela Pedidos.

Conteúdo:

- pedidos Finalizados;
- pedidos Cancelados.

Filtros mínimos:

- Todos
- Finalizados
- Cancelados

Busca deve seguir o padrão atual do sistema e permitir localizar pedidos por identificadores e dados úteis ao operador, de acordo com os campos já disponíveis na listagem.

Para pedidos cancelados, exibir:

- badge **Cancelado**;
- motivo do cancelamento;
- descrição do motivo quando houver;
- data/hora do cancelamento;
- situação financeira:
  - sem estorno necessário;
  - Estorno pendente;
  - Estornado.

Pedidos Finalizados ainda poderão ser cancelados a partir desta tela.

Pedidos Cancelados não terão ação de reativação.

## 11. Navegação

### Desktop

Ordem relevante no menu lateral:

- Dashboard
- Pedidos
- Histórico
- Clientes
- Produtos
- A Receber
- Financeiro

### Mobile

A barra inferior não ganhará um novo item direto.

Histórico será acessível por:

- menu **Mais**;
- atalho **Ver histórico** na tela Pedidos.

A navegação deve continuar respeitando os contratos mobile já existentes no projeto.

## 12. Financeiro — Estornos pendentes

No topo do Financeiro haverá uma seção **Estornos pendentes**.

A seção só precisa ocupar destaque quando existirem pendências. Deve mostrar, no mínimo:

- identificação do pedido;
- cliente ou identificação de atendimento local;
- valor integral a devolver;
- data do cancelamento;
- botão **Registrar estorno**.

Ao registrar estorno:

1. sistema abre o fluxo de registro;
2. forma de devolução é obrigatória;
3. forma do pagamento original é sugerida quando disponível;
4. valor é fixo e integral;
5. backend valida que o pedido está cancelado, está pago e ainda não foi estornado;
6. saída financeira é criada;
7. item deixa a lista de pendências;
8. movimentação permanece no histórico financeiro.

## 13. Regras financeiras e indicadores

### 13.1 Indicadores comerciais

Pedidos Cancelados serão excluídos de:

- vendas do dia;
- vendas por período;
- quantidade de pedidos válidos;
- ticket médio;
- produtos mais vendidos;
- composição por forma de pagamento das vendas;
- demais métricas comerciais baseadas em pedidos válidos.

### 13.2 A Receber

Pedidos Cancelados não participarão de A Receber, mesmo que nunca tenham sido pagos.

### 13.3 Pedidos ativos

Cancelados não contarão como pedidos ativos.

### 13.4 Recebido hoje

**Recebido hoje** será calculado a partir da realidade financeira do dia:

`pagamentos de pedidos recebidos no dia - estornos de pedidos registrados no dia`

Consequências:

- pagamento e estorno no mesmo dia -> impacto líquido zero;
- pagamento hoje e estorno amanhã -> hoje registra a entrada, amanhã registra a saída;
- nenhum histórico financeiro anterior é reescrito retroativamente.

### 13.5 Fluxo de caixa

Entradas e saídas continuam sendo calculadas a partir das movimentações financeiras. Estorno é uma saída real e afeta o saldo a partir da data em que foi registrado.

## 14. Comandas e atendimento local

A lógica que determina se uma comanda/mesa ainda possui pedidos pendentes deverá ignorar pedidos Cancelados.

Se um pedido cancelado era o último pedido pendente da comanda, a comanda poderá ser encerrada pela mesma regra de liquidação usada pelo sistema, desde que não exista outro pedido válido pendente.

Cancelamento não deve deixar comandas artificialmente abertas.

## 15. API e responsabilidades do backend

O backend será a fonte de verdade das regras de cancelamento e estorno.

A interface esconderá ações inválidas para boa UX, mas o backend deverá rejeitar explicitamente qualquer operação inconsistente.

### 15.1 Cancelar pedido

Deverá existir uma operação semântica de cancelamento em vez de usar o endpoint de hard delete como ação operacional.

Validações mínimas:

- pedido existe e pertence ao negócio autenticado;
- pedido ainda não está Cancelado;
- estado atual permite cancelamento;
- motivo pertence ao conjunto aceito;
- motivo Outro exige descrição não vazia;
- pedido não pode ser reaberto após cancelamento.

O endpoint deve suportar dois resultados para pedido pago:

- cancelamento sem estorno imediato;
- cancelamento com estorno integral imediato.

Quando houver estorno imediato, cancelamento e criação da saída devem ser atomicamente consistentes. O sistema não deve retornar sucesso parcial.

### 15.2 Registrar estorno

Deverá existir uma operação própria para registrar posteriormente a devolução de um pedido cancelado.

Validações mínimas:

- pedido existe e pertence ao negócio autenticado;
- pedido está Cancelado;
- pedido possui pagamento válido;
- não existe estorno integral anterior para o mesmo pedido;
- forma de devolução é válida e obrigatória;
- valor do estorno é calculado pelo backend e não aceito livremente do cliente.

### 15.3 Idempotência prática

Repetição acidental de clique ou requisição não pode criar dois estornos integrais para o mesmo pedido.

O backend deve verificar a existência de estorno antes da criação e rejeitar uma segunda tentativa com erro de domínio apropriado.

## 16. Hard delete

A exclusão física deixa de fazer parte do fluxo operacional normal do sistema.

O endpoint atual de DELETE não deverá permanecer acessível pela interface para cancelamento.

Durante a implementação, será decidido se o endpoint será removido completamente ou mantido apenas como capacidade interna/administrativa não exposta, desde que isso não crie ambiguidade com o novo fluxo. A opção preferida é remover o uso operacional e os testes que tratam hard delete como comportamento normal de pedido.

Nenhuma rotina de cancelamento poderá apagar automaticamente:

- pedido;
- itens do pedido;
- pagamento original;
- movimentação de entrada do pagamento.

## 17. Compatibilidade e migração

A migração de banco deve ser aditiva.

Pedidos existentes continuam válidos sem transformação de status.

Os novos campos de cancelamento começam nulos para registros antigos.

A introdução de `Cancelado` deve ser compatível com a coluna textual de status já existente.

Qualquer consulta que hoje trate “não finalizado” como sinônimo de “ativo” deverá ser revisada para não incluir Cancelado por acidente.

Também deverão ser revisadas consultas que inferem pendência somente pela ausência de pagamento, especialmente em comandas e A Receber.

## 18. Erros e consistência

Casos que devem gerar erro de domínio, sem alteração parcial:

- cancelar pedido já cancelado;
- cancelar sem motivo;
- motivo Outro sem descrição;
- registrar estorno para pedido não cancelado;
- registrar estorno para pedido não pago;
- registrar segundo estorno integral;
- forma de devolução inválida ou ausente;
- tentativa de alterar valor do estorno no cliente.

Se o cancelamento com estorno imediato falhar na etapa financeira, a operação completa deve ser considerada falha. O usuário poderá tentar novamente sem encontrar o pedido em um estado falso de estorno concluído.

## 19. Componentes e áreas impactadas

A implementação deverá revisar, no mínimo:

- tela Pedidos;
- nova tela Histórico de Pedidos;
- navegação desktop;
- navegação mobile / Mais;
- modais ou bottom sheets de cancelamento e estorno;
- StatusBadge e estilos associados;
- App e estado central de pedidos/movimentações;
- cliente de API de pedidos;
- Worker/router;
- repositório de pedidos no Worker;
- repositório/métodos de movimentações financeiras;
- migrations D1;
- A Receber;
- Financeiro;
- Dashboard e analytics;
- utilitários de status de pedido;
- lógica de fechamento de comandas/mesas;
- testes de regressão e integração existentes afetados.

O plano de implementação deverá mapear os arquivos concretos no estado atual do repositório antes de qualquer edição.

## 20. Estratégia de testes

A implementação seguirá TDD.

Cobertura obrigatória:

1. pedido não pago cancelado permanece no banco;
2. pedido não pago cancelado sai das métricas comerciais;
3. pedido não pago cancelado sai de A Receber;
4. pedido pago cancelado sem devolução resulta em Estorno pendente;
5. pagamento original permanece após cancelamento;
6. entrada financeira original permanece após cancelamento;
7. pedido pago cancelado com devolução cria uma única saída integral;
8. segundo estorno é rejeitado;
9. motivo de cancelamento é obrigatório;
10. Outro exige descrição;
11. Finalizado pode ser cancelado;
12. Cancelado não pode ser reaberto;
13. Cancelado não aparece na fila operacional;
14. Cancelado aparece no Histórico;
15. Histórico filtra Todos, Finalizados e Cancelados;
16. comandas ignoram pedidos Cancelados ao avaliar pendências;
17. Dashboard exclui Cancelados de vendas, ticket, contagem e produtos mais vendidos;
18. A Receber exclui Cancelados;
19. Recebido hoje usa pagamentos menos estornos do dia;
20. Financeiro lista estornos pendentes corretamente;
21. Registrar estorno remove a pendência sem apagar o histórico;
22. forma de estorno é persistida;
23. navegação desktop expõe Histórico após Pedidos;
24. navegação mobile expõe Histórico dentro de Mais;
25. atalho Ver histórico funciona a partir de Pedidos;
26. regressões existentes de criação, finalização, pagamento e comandas continuam passando.

## 21. Validação antes de considerar concluído

A feature só será considerada tecnicamente concluída após validação fresca de:

- suíte completa de testes;
- lint;
- build de produção;
- Worker dry-run;
- migrations validadas;
- regressões de pedidos, pagamentos, Financeiro, Dashboard, A Receber e comandas.

Nenhum deploy é implícito nesta especificação. Deploy de produção permanece uma etapa separada, executada somente após implementação validada e autorização explícita.

## 22. Fora de escopo desta versão

Não fazem parte desta entrega:

- estorno parcial;
- múltiplos estornos para o mesmo pedido;
- reabertura de pedido cancelado;
- aprovação de cancelamento por permissões diferentes;
- auditoria completa por usuário/funcionário;
- entidade genérica de eventos de pedido;
- tabela própria de refunds/reembolsos;
- integração de cancelamento com o futuro cardápio digital;
- automações externas de devolução via Pix, adquirente ou gateway.

Esses itens podem ser evoluídos posteriormente sem invalidar a arquitetura desta versão.

## 23. Critérios de aceite

A mudança estará funcionalmente correta quando:

- nenhum operador precisar excluir um pedido para desfazer uma venda;
- todo cancelamento permanecer visível no histórico;
- motivo de cancelamento for sempre conhecido;
- pagamento original nunca desaparecer por causa de cancelamento;
- estorno pendente for claramente gerenciável no Financeiro;
- devolução registrada gerar saída financeira integral e auditável;
- vendas e métricas comerciais ignorarem cancelados;
- A Receber ignorar cancelados;
- Recebido hoje refletir pagamentos menos estornos do próprio dia;
- comandas não permanecerem abertas por causa de pedidos cancelados;
- fila Pedidos representar apenas a operação ativa;
- Histórico concentrar Finalizados e Cancelados;
- não houver possibilidade de estorno integral duplicado;
- dados antigos permanecerem compatíveis após a migração.
