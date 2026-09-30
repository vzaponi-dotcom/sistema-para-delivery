# Gestão Delivery — Agendamento multi-dia e reservas de mesa

**Data:** 2026-09-29
**Issue:** #82 — Feature: agendamento multi-dia e reservas de mesa
**Branch documental:** docs/issue-82-multiday-reservations
**Base analisada:** master @ da81fb2be7a754f9296a54d9e44e82372341e20d
**Status:** APPROVED — aprovado pelo usuário em 2026-09-29; plano de implementação autorizado

## 1. Objetivo

Evoluir o agendamento atual do Gestão Delivery sem criar um segundo sistema paralelo de vendas.

A funcionalidade deve:

1. permitir pedidos de Entrega e Retirada agendados para até 90 dias no futuro;
2. permitir pedido Local agendado, tratado operacionalmente como reserva de mesa;
3. manter os itens, preços, observações e demais dados no mesmo fluxo de Novo Pedido;
4. impedir que uma reserva abra uma comanda ou ocupe a mesa dias antes;
5. permitir editar a reserva antes de ela entrar na operação;
6. converter a reserva em uma comanda real quando o cliente chegar;
7. preservar cozinha, TV, impressão, financeiro, relatórios, sincronização e comportamento atual dos pedidos existentes;
8. preservar o layout atual do produto no desktop e no mobile, acrescentando apenas os estados e ações necessários.

Esta spec substitui somente as restrições antigas de “mesmo dia” e “Local não pode ser agendado”. As regras atuais de timing, cozinha e lifecycle continuam sendo a base sempre que não forem explicitamente alteradas aqui.

---

## 2. Fontes de verdade já existentes

O desenho parte dos contratos atuais já presentes na master:

- orders.scheduled_for identifica pedido agendado;
- “Agendado” é estado operacional derivado, não status persistido;
- orders.status continua representando o lifecycle de cozinha, principalmente “Em preparo”, “Finalizado” e “Cancelado”;
- operational_start_at continua derivado de created_at, scheduled_for e da política de timing vigente;
- mesas são entidades persistentes por table_id;
- ocupação continua derivada de table_tabs com status open;
- orders.table_tab_id continua sendo o vínculo de pedido com comanda;
- pedidos Local “Agora” continuam abrindo ou reutilizando comanda;
- pedidos de mesa continuam sem pagamento avulso; o recebimento ocorre pela comanda;
- cópias de impressão de pedidos de mesa usam a política de contexto de mesa;
- o Worker continua sendo autoridade de validação e concorrência;
- o frontend continua tratando validações locais como UX, nunca como garantia final.

A feature não deve duplicar esses conceitos.

---

## 3. Decisões de produto aprovadas

### 3.1 Horizonte

O limite de agendamento é de 90 dias de calendário operacional, inclusive.

Exemplo:

~~~text
Hoje operacional: 29/09/2026
Permitido: 29/09/2026 até 28/12/2026, inclusive
Rejeitado: 29/12/2026 em diante
~~~

O limite é calculado no timezone operacional do estabelecimento, não por 90 × 24 horas no relógio UTC.

### 3.2 Modalidades

- Entrega: Agora ou Agendado.
- Retirada: Agora ou Agendado.
- Local: Agora ou Reserva.

“Reserva” em Local é tecnicamente um pedido Local com scheduled_for preenchido e uma entidade de reserva vinculada.

### 3.3 Itens são obrigatórios na V1

A V1 não cria reserva vazia de mesa.

Uma reserva Local continua usando o fluxo normal de pedido e exige pelo menos um item, como o checkout atual.

Ficam fora desta versão:

- reserva apenas de mesa sem produtos;
- número de pessoas;
- ocasião;
- preferência de localização;
- depósito/sinal;
- duração digitada pelo operador.

### 3.4 Duração operacional da reserva

Cada reserva nasce com uma duração de conflito persistida de 120 minutos.

Esse valor é um snapshot da reserva e não é recalculado retroativamente se a regra vier a ser configurável no futuro.

### 3.5 Edição

Somente reservas Local ativas ganham edição nesta feature.

Pedidos Agendados de Entrega e Retirada continuam sem edição completa na V1 e preservam o fluxo atual de cancelamento.

---

## 4. Separação conceitual: pedido, reserva e comanda

A implementação deve preservar três conceitos diferentes.

### 4.1 Pedido

O pedido contém:

- cliente;
- modalidade;
- data;
- horário agendado;
- itens;
- preços;
- ajustes;
- observações;
- status de cozinha;
- timing operacional;
- impressão;
- cancelamento;
- histórico e relatórios.

### 4.2 Reserva

A reserva contém o compromisso futuro com uma mesa e seu lifecycle de atendimento.

Ela responde perguntas que o pedido não responde:

- qual mesa foi reservada;
- qual intervalo está bloqueado contra outra reserva;
- a reserva ainda está aguardando;
- foi convertida em comanda;
- foi cancelada;
- foi encerrada como não comparecimento;
- qual revisão está sendo editada.

### 4.3 Comanda

A comanda só existe quando há atendimento real na mesa.

Uma reserva não cria table_tab no cadastro.

Quando a chegada é confirmada:

- uma comanda é aberta;
- o pedido da reserva passa a apontar para essa comanda;
- a mesa passa a estar Ocupada pelo mecanismo atual;
- a reserva passa para converted.

Isso evita usar uma comanda aberta como agenda futura.

---

## 5. Modelo de dados

### 5.1 Nova migration

A implementação deve usar a próxima migration disponível após a master analisada:

~~~text
0034_table_reservations.sql
~~~

A numeração deverá ser revalidada imediatamente antes da implementação caso a master avance.

### 5.2 Nova tabela table_reservations

Criar entidade equivalente a:

~~~text
table_reservations
- id TEXT PRIMARY KEY
- business_id TEXT NOT NULL
- order_id TEXT NOT NULL
- table_id TEXT NOT NULL
- table_name_snapshot TEXT NOT NULL
- status TEXT NOT NULL
- scheduled_for TEXT NOT NULL
- ends_at TEXT NOT NULL
- duration_minutes INTEGER NOT NULL
- revision INTEGER NOT NULL DEFAULT 1
- converted_table_tab_id TEXT NULL
- converted_at TEXT NULL
- cancelled_at TEXT NULL
- no_show_at TEXT NULL
- created_at TEXT NOT NULL
- updated_at TEXT NOT NULL
~~~

Status permitidos na V1:

~~~text
reserved
converted
cancelled
no_show
~~~

Restrições esperadas:

- business_id + order_id é único;
- duration_minutes é positivo;
- scheduled_for < ends_at;
- converted exige converted_table_tab_id e converted_at;
- cancelled exige cancelled_at;
- no_show exige no_show_at;
- estados terminais não voltam para reserved.

Índices mínimos:

- business_id + status + scheduled_for;
- business_id + table_id + status + scheduled_for;
- business_id + order_id;
- business_id + converted_table_tab_id quando não nulo.

### 5.3 Por que a reserva é uma tabela própria

Não adicionar “Reservada” ao orders.status.

O status de pedido continua representando cozinha.

Exemplo válido:

~~~text
Reserva: reserved
Pedido: Finalizado
~~~

Isso pode acontecer quando a cozinha concluiu o preparo antes da chegada do cliente.

A reserva continua aguardando a chegada e ainda não existe comanda.

### 5.4 Relação com orders

Uma reserva V1 possui exatamente um order_id.

O pedido Local reservado:

- customer_identity_type = table;
- table_tab_id = NULL enquanto a reserva estiver reserved;
- type = Local;
- scheduled_for preenchido;
- order_date = data operacional de scheduled_for;
- is_backdated = 0.

O read model do pedido deve expor o contexto de mesa mesmo sem table_tab, usando a reserva.

O vínculo inverso pode ser resolvido por join table_reservations.order_id; não é obrigatório adicionar orders.table_reservation_id se a implementação mantiver o relacionamento único e indexado.

### 5.5 Nome da mesa

table_id é a identidade oficial.

table_name_snapshot preserva o nome no momento da criação/última edição da reserva.

Enquanto a reserva estiver ativa, a UI deve usar o nome atual da mesa quando disponível e usar o snapshot como fallback/histórico.

Para evitar documento de impressão desatualizado na V1:

- mesa com reserva ativa não pode ser renomeada;
- mesa com reserva ativa não pode ser desativada;
- reordenação continua permitida.

Mover a reserva para outra mesa é feito por Editar reserva.

---

## 6. Regra de data e order_date

### 6.1 Pedido Agora

Preserva o comportamento existente:

- order_date não pode estar no futuro;
- data passada continua sendo lançamento retroativo;
- lançamento retroativo continua sem agendamento.

### 6.2 Pedido Agendado ou Reserva

Quando scheduled_for estiver preenchido:

- scheduled_for deve ser futuro;
- order_date deve ser exatamente a data operacional de scheduled_for;
- order_date pode ser hoje ou até o 90º dia permitido;
- is_backdated = 0;
- created_at continua sendo a hora real em que o pedido foi registrado.

Portanto, um pedido criado em 29/09 para 03/10 terá:

~~~text
created_at = 29/09, momento real do cadastro
order_date = 03/10
scheduled_for = 03/10, horário desejado
~~~

Essa separação é obrigatória para não contabilizar o pedido futuro como operação do dia do cadastro.

### 6.3 Alteração necessária no domínio compartilhado

A regra atual isFutureSameDaySchedule deixa de ser suficiente.

O domínio deve possuir um helper compartilhado que valide:

- modalidade elegível;
- timestamp válido;
- futuro;
- correspondência entre order_date e scheduled_for;
- horizonte máximo de 90 dias;
- Local reservado permitido;
- backdated incompatível com schedule.

Não espalhar cálculo de 90 dias por componentes.

---

## 7. Criação de Entrega e Retirada futura

O wizard permanece o mesmo.

Ao escolher Agendado:

- a data deixa de estar limitada a hoje;
- max = 90º dia permitido;
- o operador informa data e horário;
- cliente continua obrigatório;
- itens continuam obrigatórios.

O checkout persiste o snapshot normal do pedido.

Pagamento no cadastro continua permitido conforme as regras atuais de Entrega/Retirada.

Se houver pagamento de um pedido futuro:

- pagamento/recebimento usa a data financeira real em que ocorreu;
- order_date permanece a data futura do atendimento;
- os relatórios não devem misturar as duas semânticas.

---

## 8. Criação de reserva Local

### 8.1 Fluxo

Ao selecionar Local:

~~~text
Quando atender?
[ Agora ] [ Reservar ]
~~~

Modo Agora:

- comportamento atual;
- mesa obrigatória;
- mesa ocupada reutiliza comanda atual;
- mesa livre abre comanda no primeiro pedido.

Modo Reservar:

- scheduled_for obrigatório;
- data hoje ou futura até 90 dias;
- mesa ativa obrigatória;
- cliente continua opcional;
- itens obrigatórios;
- expectedTableTabId deve ser nulo;
- nenhuma comanda é criada.

### 8.2 Mesa ocupada hoje

Uma mesa ocupada agora pode receber uma reserva futura, desde que não haja conflito com outra reserva ativa.

A ocupação atual não é usada como previsão de duração futura.

A V1 não tenta estimar quando uma comanda aberta terminará.

### 8.3 Fluxo iniciado de uma comanda aberta

Quando Novo Pedido foi aberto a partir de “Adicionar pedido” de uma comanda e existe expectedTableTabId:

- o modo permanece Agora;
- Reservar não é oferecido;
- o pedido continua sendo adicional à comanda existente.

Isso impede transformar acidentalmente um pedido adicional da Mesa 2 em uma reserva futura independente.

---

## 9. Conflito de reservas

### 9.1 Intervalo

Cada reserva active/reserved ocupa para fins de conflito:

~~~text
[scheduled_for, ends_at)
~~~

Com 120 minutos:

~~~text
20:00 → 22:00
~~~

Uma segunda reserva às 22:00 é permitida.

Uma segunda reserva às 21:59 conflita.

### 9.2 Fórmula

Existe conflito quando, na mesma business_id + table_id:

~~~text
nova.scheduled_for < existente.ends_at
AND existente.scheduled_for < nova.ends_at
~~~

Somente status reserved participa do conflito.

converted, cancelled e no_show não bloqueiam criação futura.

### 9.3 Concorrência

Não basta fazer SELECT no Worker e depois INSERT.

A migration deve proteger contra duas gravações simultâneas por trigger/constraint transacional equivalente, usando os timestamps normalizados persistidos.

O backend traduz a colisão para erro estável:

~~~text
409 TABLE_RESERVATION_CONFLICT
~~~

Mensagem de UX:

~~~text
Esta mesa já possui uma reserva nesse horário. Escolha outra mesa ou outro horário.
~~~

### 9.4 Edição

Ao editar, a própria reserva é excluída da busca de conflito e a nova posição é revalidada atomicamente.

---

## 10. Lifecycle da reserva

### 10.1 reserved

Estado inicial.

Pode:

- aparecer em Comandas;
- aparecer nos pedidos agendados;
- entrar na janela operacional da cozinha;
- ser editada dentro das regras;
- ser cancelada;
- ser marcada como não comparecimento;
- ser convertida em comanda.

### 10.2 converted

Estado terminal da reserva.

Significa:

- chegada confirmada;
- table_tab criado;
- orders.table_tab_id preenchido;
- mesa Ocupada pelo mecanismo já existente.

Não volta para reserved.

### 10.3 cancelled

Estado terminal por cancelamento normal.

O pedido associado também fica Cancelado pelo fluxo oficial.

### 10.4 no_show

Estado terminal para cliente que não compareceu.

O pedido também precisa ser cancelado operacionalmente.

A ação “Não compareceu” deve abrir/reutilizar o mesmo fluxo oficial de motivo de cancelamento, para que a política configurável continue sendo respeitada.

A diferença histórica é preservada em table_reservations.status = no_show.

Não criar um motivo oculto que burle o catálogo de cancelamentos.

### 10.5 Sem no-show automático

A V1 não marca no_show por cron ou relógio.

É uma decisão explícita do operador.

---

## 11. Edição de reserva

### 11.1 Escopo editável

Enquanto permitida, Editar reserva pode alterar:

- cliente opcional;
- mesa;
- data;
- horário;
- itens;
- quantidades;
- observações;
- ajustes que o usuário já tem permissão para aplicar.

O order_id e o número do pedido permanecem os mesmos.

### 11.2 Limite de edição

A reserva pode ser editada somente enquanto:

~~~text
status = reserved
AND now < operational_start_at
~~~

Ao alcançar a janela operacional:

- edição é bloqueada;
- a cozinha passa a ser autoridade operacional do snapshot;
- continuam disponíveis cancelamento/no-show/confirmar chegada conforme o estado.

Mensagem:

~~~text
Esta reserva já entrou na janela de preparo e não pode mais ser editada.
~~~

### 11.3 Preços ao editar

Salvar uma edição cria um novo snapshot lógico do pedido.

No momento do salvar:

- produtos são revalidados;
- itens são precificados novamente pelo catálogo vigente;
- produtos inativos não podem ser reintroduzidos;
- total e ajustes são recalculados;
- a tela de revisão mostra o novo total antes de confirmar;
- a gravação substitui itens/snapshots da reserva de forma atômica.

Não manter silenciosamente preço antigo de produto que foi alterado depois de uma edição do carrinho.

A reserva original continua auditável por timestamps/revision; histórico detalhado de versões de itens fica fora da V1.

### 11.4 Concorrência de edição

table_reservations.revision deve ser enviado como expectedRevision.

Salvar usa comparação otimista:

~~~text
WHERE id = ?
  AND business_id = ?
  AND status = 'reserved'
  AND revision = expectedRevision
~~~

Em sucesso:

~~~text
revision = revision + 1
~~~

Conflito retorna:

~~~text
409 TABLE_RESERVATION_CHANGED
~~~

A UI recarrega a versão oficial e pede nova revisão.

### 11.5 Impressão manual já realizada

Impressão manual antecipada não é apagada nem reimpressa automaticamente após edição.

Se houver registro de impressão manual anterior, a UI deve avisar antes de salvar:

~~~text
Esta reserva já foi impressa manualmente. A alteração atualiza o sistema e a impressão automática futura, mas não altera o papel já impresso.
~~~

Isso evita divergência silenciosa sem criar ticket automático de correção.

---

## 12. Timing operacional

A fórmula atual continua:

~~~text
scheduled_prep_at = scheduled_for - scheduledPrepLeadMinutes
operational_start_at = max(created_at, scheduled_prep_at)
late_at = scheduled_for + scheduledLateGraceMinutes
~~~

Ela já funciona para datas diferentes e deve continuar centralizada no domínio compartilhado.

### 12.1 Reserva Local

Reserva Local usa exatamente a mesma política temporal de um agendado:

- antes de operational_start_at: waiting/scheduled;
- a partir de operational_start_at: participa da operação da cozinha;
- atraso usa scheduled_for + tolerância;
- chegada do cliente não altera scheduled_for;
- conversão para comanda não reinicia relógio da cozinha.

### 12.2 Pedido finalizado antes da chegada

É permitido.

Exemplo:

~~~text
19:10 entra na janela
19:35 cozinha finaliza
20:00 cliente chega
20:02 chegada confirmada
~~~

O pedido pode estar Finalizado e ser ligado à nova comanda em 20:02 para posterior pagamento.

---

## 13. Visibilidade na Cozinha e TV

Permitir 90 dias de agendamento não pode poluir a superfície operacional.

### 13.1 Fila operacional

Pedidos futuros de outros dias não entram antecipadamente em:

- Em preparo;
- atrasados;
- contador operacional ativo;
- TV da cozinha.

### 13.2 Agendados do dia

A superfície operacional pode mostrar como “Agendado” pedidos cuja data agendada é o dia operacional corrente.

Se operational_start_at já foi alcançado, entram normalmente em Em preparo mesmo quando a janela cruza meia-noite.

### 13.3 Próximos dias no Gestor

No Gestor, Pedidos deve manter acesso aos pedidos futuros.

Adicionar uma seção/listagem secundária “Próximos dias” para agendados cuja data operacional é posterior a hoje.

Características:

- não entra nos contadores operacionais de hoje;
- ordena por scheduled_for ASC;
- mostra data e hora, não somente hora;
- permite abrir detalhes;
- permite cancelamento conforme regra atual;
- em reserva Local, permite Editar reserva enquanto elegível.

Essa seção não precisa existir na TV.

### 13.4 TV

A TV não exibe scheduled waiting de dias futuros.

Quando operational_start_at for alcançado, o pedido passa a Em preparo e entra na TV pela prioridade normal.

---

## 14. Som, chegada e realtime

O som de novo pedido agendado continua ligado à entrada na janela operacional, não ao cadastro futuro.

Regras preservadas:

- cadastro fora da janela não toca som;
- entrada na janela pode tocar uma vez por dispositivo/sessão;
- abrir o app depois da transição não exige reproduzir som histórico;
- reserva futura não aumenta contador de pedidos operacionais antes da janela.

A sincronização entre dispositivos continua pelo mecanismo existente de bootstrap/refresh.

---

## 15. Impressão — matriz aprovada

A feature precisa preservar a mudança histórica que tornou agendados do mesmo dia imprimíveis imediatamente, sem imprimir pedidos de outros dias com antecedência excessiva.

### 15.1 Agora

~~~text
available_at = created_at
~~~

Sem mudança.

### 15.2 Entrega/Retirada agendada para o mesmo dia

Preservar comportamento atual:

~~~text
available_at = created_at
~~~

### 15.3 Entrega/Retirada agendada para outro dia

Nova regra:

~~~text
available_at = operational_start_at
~~~

O job pode ser criado no cadastro, mas fica indisponível até a janela.

### 15.4 Reserva Local

Para Local reservado, inclusive no mesmo dia:

~~~text
available_at = operational_start_at
~~~

Motivo: a reserva é editável antes da janela e não deve produzir automaticamente um papel definitivo enquanto ainda pode mudar.

### 15.5 Impressão manual antecipada

Continua disponível.

Ela:

- usa o snapshot atual;
- não muda available_at do job automático;
- não cancela o job automático futuro;
- não congela silenciosamente o cadastro;
- se houver edição posterior, aplica o aviso definido na seção 11.5.

### 15.6 Edição de job automático pendente de reserva

Ao editar uma reserva antes da janela, se existir job automático ainda pending e indisponível:

- preservar o mesmo job;
- preservar copies_requested já snapshotado;
- atualizar document para o novo snapshot;
- atualizar available_at se scheduled_for mudou.

Não criar outro job automático.

Se o job foi descartado manualmente, a edição não faz backfill.

Se a impressão automática estava desligada no cadastro, editar não cria job retroativo.

### 15.7 Jobs antigos

Nenhuma migration reescreve available_at de jobs existentes.

A regra vale somente para novos pedidos/reservas após a implementação.

---

## 16. Confirmar chegada e abrir comanda

### 16.1 Disponibilidade da ação

A reserva precisa estar:

- status reserved;
- não cancelada;
- não no_show;
- vinculada a mesa ativa;
- na data operacional agendada ou já atrasada.

Não permitir conversão em dias anteriores ao dia agendado.

Uma chegada atrasada continua convertível até o operador encerrar a reserva.

### 16.2 Mesa já ocupada

Se existir outra comanda open na mesa:

- não reutilizar automaticamente;
- não fundir comandas;
- não fechar a comanda atual;
- bloquear conversão.

Erro:

~~~text
409 TABLE_OCCUPIED
~~~

Mensagem:

~~~text
A mesa está ocupada. Aguarde a liberação ou edite a reserva para outra mesa.
~~~

### 16.3 Transação

Confirmar chegada deve ser atômico.

No mesmo compromisso:

1. validar reservation status/revision;
2. validar mesa ativa;
3. confirmar ausência de table_tab open;
4. reservar o próximo número de comanda;
5. inserir table_tab open;
6. atualizar orders.table_tab_id;
7. atualizar table_reservations para converted;
8. preencher converted_table_tab_id e converted_at;
9. incrementar revision/updated_at;
10. retornar a comanda e as projeções oficiais.

### 16.4 Idempotência

A operação recebe mutation/idempotency key.

Retry do mesmo sucesso retorna a mesma comanda.

Uma segunda tentativa incompatível não cria outra comanda.

### 16.5 Status do pedido

Confirmar chegada não muda automaticamente orders.status.

Se estiver Em preparo, continua Em preparo.

Se já estiver Finalizado, continua Finalizado.

A comanda pode conter ambos, como já ocorre no lifecycle atual.

---

## 17. Cancelamento e não comparecimento

### 17.1 Cancelar reserva

A ação usa o mesmo diálogo/política de cancelamento de pedido.

O compromisso deve:

- cancelar o pedido;
- marcar reserva cancelled;
- preencher cancelled_at;
- remover job automático pending conforme regra atual;
- preservar jobs já processados como histórico;
- não criar ticket de cancelamento;
- liberar conflito de horário para nova reserva.

### 17.2 Cancelamento por outra superfície

Se o pedido da reserva for cancelado em Pedidos/Cozinha, o backend também precisa encerrar a reserva reserved como cancelled no mesmo compromisso.

Não permitir pedido Cancelado com reserva ainda reserved.

### 17.3 Não compareceu

A ação “Não compareceu”:

- exige a mesma seleção de motivo oficial de cancelamento;
- cancela o pedido;
- marca a reserva no_show;
- preenche no_show_at;
- não abre comanda.

A distinção no_show fica no domínio de reservas.

---

## 18. Projeção de mesas

Livre/Ocupada continua derivado exclusivamente de comanda open.

Reserva não altera occupancy.

O read model de mesa passa a poder incluir:

~~~text
nextReservation:
- id
- orderId
- revision
- scheduledFor
- endsAt
- clientId
- clientName
- itemCount
- totalCents
- status
~~~

Somente a próxima reserva active/reserved por mesa é necessária no bootstrap.

Não carregar 90 dias completos de reservas dentro do bootstrap global.

### 18.1 Mesa livre com reserva

A mesa continua tecnicamente free.

A UI pode apresentar o estado visual “Reservada” como compromisso futuro, sempre acompanhado da data/hora.

### 18.2 Mesa ocupada com reserva futura

O estado primário continua “Ocupada”.

Mostrar uma informação secundária:

~~~text
Próxima reserva · Hoje, 20:00
~~~

O detalhe de comanda permanece a ação primária.

A reserva deve ter affordance explícito para abrir seu detalhe, sem substituir o atendimento atual.

### 18.3 Uso imediato de mesa reservada

A V1 não bloqueia iniciar atendimento Agora somente porque existe reserva futura.

A UI deve mostrar a próxima reserva de forma visível para decisão humana.

O sistema não inventa duração para uma comanda espontânea.

Na hora de confirmar a chegada da reserva, se a mesa ainda estiver ocupada, a conversão é bloqueada conforme seção 16.2.

---

## 19. Tela Comandas — direção visual e comportamento

A tela atual não será redesenhada.

Preservar:

- layout desktop de lista + detalhe;
- layout mobile em lista + detalhe próprio;
- cards atuais;
- menu lateral;
- bottom navigation;
- header;
- tema claro/escuro;
- tipografia e componentes existentes.

Atualizar a descrição para algo equivalente a:

~~~text
Acompanhe mesas, comandas e reservas.
~~~

### 19.1 Card sem comanda e sem reserva

Permanece:

~~~text
Livre
Toque para lançar pedido
~~~

### 19.2 Card com reserva e sem comanda

Mostrar:

- mesa;
- cliente opcional;
- data/hora;
- badge textual Reservada;
- ícone distinto;
- acesso ao detalhe.

Tocar abre Detalhe da reserva.

### 19.3 Card ocupado + reserva futura

Mostrar Ocupada como principal e próxima reserva como informação secundária.

Tocar na área principal continua abrindo a comanda.

Uma ação/linha específica abre a reserva.

### 19.4 Acesso a reservas além da próxima

Comandas é uma visão operacional por mesa e mostra somente a próxima reserva.

A lista completa de agendados permanece em Pedidos > Próximos dias.

A V1 não cria uma nova agenda/calendário de reservas.

---

## 20. Detalhe da reserva

Seguir a hierarquia visual do detalhe atual de comanda.

Mostrar:

- mesa;
- cliente opcional;
- pedido/número quando útil;
- data;
- horário;
- status Reservada;
- itens;
- total previsto;
- observações;
- indicador se já entrou na janela operacional;
- aviso se já houve impressão manual.

Ações antes da janela:

- Confirmar chegada, quando a data permitir;
- Editar reserva;
- Cancelar reserva;
- Não compareceu, quando aplicável ao atendimento;
- Imprimir manualmente, conforme capacidade atual.

Depois da janela:

- Editar desaparece/desabilita com explicação;
- demais ações continuam conforme estado.

Não mostrar um botão independente “Abrir comanda” que burle Confirmar chegada.

A CTA autoritativa é:

~~~text
Confirmar chegada e abrir comanda
~~~

---

## 21. Novo Pedido e modo edição

### 21.1 Criação

Reutilizar o wizard existente.

Mudanças visuais mínimas:

- Local passa a exibir Agora/Reservar;
- data do agendado permite futuro até 90 dias;
- texto Local usa “Reservar” ou “Reserva”, não “Quando preparar?” isoladamente;
- Entrega/Retirada mantêm “Agendado”.

### 21.2 Edição

Não criar um editor paralelo.

O mesmo conjunto de componentes do Novo Pedido deve ser reutilizado em modo edição de reserva.

O controlador precisa saber:

- reservationId;
- orderId;
- expectedRevision;
- snapshot inicial;
- modo edit.

Salvar chama endpoint de edição e não POST /api/orders.

Cancelar a tela de edição não cancela a reserva; apenas descarta alterações locais.

---

## 22. APIs

O plano poderá ajustar nomes, mas a responsabilidade deve permanecer explícita.

### 22.1 POST /api/orders

Estender para aceitar Local + scheduledFor.

Quando Local + scheduledFor:

- cria order;
- cria table_reservation;
- não cria table_tab;
- cria job automático conforme matriz de impressão;
- retorna order + reservation + projeção atualizada das mesas afetadas.

### 22.2 GET /api/table-reservations

Filtros mínimos:

- status;
- from;
- to;
- tableId.

Usado para listagens/gestão futura sem inflar bootstrap.

### 22.3 GET /api/table-reservations/:id

Retorna detalhe oficial da reserva e pedido associado.

### 22.4 PUT /api/table-reservations/:id

Edição completa da reserva ativa.

Body inclui expectedRevision e snapshot editável.

### 22.5 POST /api/table-reservations/:id/confirm-arrival

Converte para comanda.

Body inclui:

- expectedRevision;
- mutation/idempotency key.

### 22.6 POST /api/table-reservations/:id/cancel

Cancela reserva + pedido usando política oficial de cancelamento.

### 22.7 POST /api/table-reservations/:id/no-show

Marca no_show + cancela pedido usando política oficial de cancelamento.

### 22.8 Respostas

Toda mutação retorna as entidades oficiais necessárias para reconciliação imediata, evitando montar estado otimista como fonte de verdade.

---

## 23. Bootstrap e sincronização

O bootstrap global não deve receber uma coleção completa de reservas de 90 dias.

Adicionar apenas nextReservation à projeção de tables.

Detalhes/listagens completas usam endpoint dedicado.

Depois de mutações:

- sessão autora aplica resposta oficial;
- outras sessões convergem pelo refresh/bootstrap atual;
- Comandas atualiza ocupação e próxima reserva;
- Pedidos atualiza o pedido;
- Kitchen/TV derivam o estado pelo relógio.

F5/deep link precisa preservar telas e detalhes conforme a navegação atual.

---

## 24. Financeiro e A Receber

### 24.1 Reserva Local

Enquanto table_tab_id for NULL e houver reserva active:

- não aparece em A Receber;
- não permite pagamento avulso;
- não cria movimento financeiro.

Após converted:

- passa a pertencer à comanda;
- pagamento segue fluxo integral/múltiplas formas da comanda;
- fechamento da comanda libera a mesa.

A regra de A Receber precisa excluir explicitamente pedido de reserva, porque hoje a exclusão de Local depende de table_tab_id.

### 24.2 Entrega/Retirada futura

Sem pagamento:

- continua sendo recebível;
- expected date padrão pode usar order_date futura, preservando forecast.

Pago no cadastro:

- recibo/movimento financeiro ocorre na data real do pagamento;
- não aparece como pendente.

---

## 25. Relatórios

### 25.1 Data do pedido

Pedidos agendados futuros usam order_date = data agendada.

Isso garante que métricas de pedido/venda por data não caiam no dia do cadastro antecipado.

### 25.2 Operação

Tempo operacional continua usando operational_start_at.

Nunca usar created_at para medir horas/dias de antecedência como preparo.

### 25.3 Agendado

Local reservado participa da classificação Agendado.

Filtros por modalidade continuam separando Entrega, Retirada e Local.

### 25.4 Reserva cancelada/no-show

Como o order associado fica Cancelado:

- sai das populações que já excluem cancelados;
- no_show pode ser analisado futuramente pelo domínio de reservas;
- a V1 não adiciona KPIs novos de reserva/no-show ao Centro de Relatórios.

---

## 26. Impressão de documento

O ticket de pedido agendado futuro deve deixar data e horário inequívocos.

Para Local reservado, incluir de forma legível:

- mesa;
- data da reserva;
- horário;
- indicação “RESERVA” ou “AGENDADO”;
- cliente opcional;
- itens e observações.

A cor não é requisito do ticket térmico; informação deve funcionar em monocromático.

---

## 27. Regras de mesa e gestão

Mesa com reserva active:

- pode ser reordenada;
- não pode ser renomeada;
- não pode ser desativada.

Mensagem:

~~~text
Esta mesa possui uma reserva ativa. Mova ou cancele a reserva antes de alterar a mesa.
~~~

Mesa ocupada continua seguindo bloqueios existentes.

Uma mesa pode estar simultaneamente:

~~~text
occupancy = occupied
nextReservation = reserva futura
~~~

Isso não é inconsistência.

---

## 28. Permissões/capabilities

A V1 não cria nova capability.

Reutilizar contratos existentes:

- orders.view para visibilidade de pedidos agendados;
- comandas.view para Comandas/detalhe;
- orders.create para criar reserva e confirmar chegada;
- orders.cancel para cancelar ou marcar no-show;
- orders.discount para ajuste quando aplicável;
- printing.execute para impressão manual;
- capacidades atuais de mesa/comanda continuam para ações já existentes.

Editar reserva exige orders.create e acesso ao pedido/reserva; não introduzir um modelo genérico de edição de todos os pedidos.

O Worker continua validando autorização em todas as rotas.

---

## 29. Códigos de erro estáveis

Prever pelo menos:

~~~text
SCHEDULE_OUT_OF_RANGE
SCHEDULE_IN_PAST
SCHEDULE_DATE_MISMATCH
TABLE_RESERVATION_CONFLICT
TABLE_RESERVATION_NOT_FOUND
TABLE_RESERVATION_CHANGED
TABLE_RESERVATION_NOT_EDITABLE
TABLE_RESERVATION_ALREADY_CLOSED
TABLE_RESERVATION_CONFIRM_TOO_EARLY
TABLE_NOT_FOUND
TABLE_INACTIVE
TABLE_OCCUPIED
POLICY_CHANGED
~~~

Mensagens da UI devem ser acionáveis e não expor detalhes internos.

---

## 30. Migração e compatibilidade

### 30.1 Dados antigos

Nenhum pedido antigo vira reserva por migration.

Pedidos antigos:

- scheduled_for continua como hoje;
- table_tab_id continua como hoje;
- não recebem table_reservation.

### 30.2 Jobs antigos

Não alterar available_at de print_jobs existentes.

### 30.3 table_tabs

Nenhuma comanda antiga é modificada.

### 30.4 Instalação/upgrade

A migration precisa passar:

- banco limpo 0001 → 0034;
- upgrade real 0001 → 0033 → 0034;
- constraints/FKs/indexes;
- testes de conflito e concorrência.

---

## 31. Concorrência e invariantes

Invariantes obrigatórias:

1. no máximo uma comanda open por mesa;
2. no máximo uma reserva active sobreposta por intervalo;
3. reserva converted aponta para exatamente uma comanda;
4. reserva cancelled/no_show nunca converte;
5. pedido de reserva active não tem table_tab_id;
6. pedido converted possui o table_tab_id da conversão;
7. retry de confirmar chegada não cria segunda comanda;
8. edit concorrente não sobrescreve revisão nova;
9. cancelar por qualquer superfície não deixa reserva active;
10. produto/mesa/política alterada durante save não gera gravação parcial.

---

## 32. Acessibilidade e identidade visual

Referência visual oficial:

**Mesiva — Guia oficial de identidade visual e aplicação no produto, v1.0.**

Aplicar sem redesenhar o produto:

- componentes e tokens atuais primeiro;
- Reservada com texto + ícone + cor, nunca apenas cor;
- contraste validado nos dois temas;
- foco visível;
- teclado no desktop;
- targets confortáveis no mobile;
- mensagens curtas em português;
- preservar densidade útil nas telas operacionais;
- sem trocar navegação/menu/bottom bar por causa dos mockups.

Superfícies a homologar:

- Novo Pedido desktop/mobile;
- Comandas desktop/mobile;
- detalhe da reserva;
- edição;
- confirmar chegada;
- Pedidos/Cozinha;
- TV;
- impressão;
- tema claro e escuro.

---

## 33. Fluxos principais

### 33.1 Entrega futura

~~~text
Novo Pedido
→ Entrega
→ Agendado
→ data/hora até +90 dias
→ itens
→ revisão
→ cria pedido
→ aparece em Próximos dias
→ job automático aguarda operational_start_at se for outro dia
→ entra na cozinha na janela
→ lifecycle normal
~~~

### 33.2 Reserva Local

~~~text
Novo Pedido
→ Local
→ Reservar
→ mesa
→ cliente opcional
→ data/hora
→ itens
→ revisão
→ cria order + table_reservation
→ NÃO cria comanda
→ NÃO ocupa mesa
→ entra na cozinha na janela
→ cliente chega
→ Confirmar chegada
→ cria comanda
→ liga order à comanda
→ mesa Ocupada
→ pagamento normal da comanda
~~~

### 33.3 Editar reserva

~~~text
Detalhe da reserva
→ Editar
→ reutiliza wizard
→ valida before operational_start_at
→ valida revision
→ valida conflito
→ repricing/revisão
→ substitui snapshot atomically
→ atualiza job automático pending
~~~

### 33.4 No-show

~~~text
Detalhe da reserva
→ Não compareceu
→ motivo oficial de cancelamento
→ order Cancelado
→ reservation no_show
→ libera intervalo
→ nenhuma comanda
~~~

---

## 34. Cenários obrigatórios de QA

### Agendamento

1. Entrega hoje futura.
2. Retirada hoje futura.
3. Entrega amanhã.
4. Retirada no 90º dia.
5. 91º dia rejeitado.
6. horário passado rejeitado.
7. order_date divergente do scheduled_for rejeitado.
8. timezone operacional preservado.

### Reserva

9. Local Agora em mesa livre abre comanda como hoje.
10. Local Agora em mesa ocupada reutiliza comanda como hoje.
11. Local Reservar não abre comanda.
12. Local Reservar não muda occupancy.
13. reserva em mesa atualmente ocupada é aceita se não conflita com outra reserva.
14. reserva conflitante é rejeitada.
15. reservas 20:00–22:00 e 22:00–00:00 são aceitas.
16. mesa com reserva não pode ser renomeada/desativada.
17. mesma reserva pode mudar para outra mesa livre de conflito.

### Edição

18. trocar item antes da janela.
19. trocar quantidade antes da janela.
20. trocar cliente.
21. trocar mesa.
22. trocar horário.
23. edição causa conflito e falha sem alteração parcial.
24. expectedRevision antigo retorna conflict.
25. edição após operational_start_at é bloqueada.
26. produto desativado entre abrir e salvar exige revisão.
27. job automático pending atualiza documento/available_at sem duplicar.
28. impressão manual anterior mostra aviso.

### Cozinha/TV

29. pedido de 30 dias no futuro não aparece na TV.
30. pedido de amanhã não aumenta contador operacional hoje.
31. pedido entra em preparo ao atingir operational_start_at.
32. som ocorre uma vez na transição.
33. Local reserva usa timing igual a agendado.
34. pedido pode finalizar antes da chegada sem converter reserva.

### Impressão

35. mesmo-dia Entrega/Retirada mantém impressão automática imediata.
36. outro-dia Entrega/Retirada aguarda janela.
37. Local Reservar aguarda janela.
38. impressão manual antecipada funciona.
39. cancelar remove job automático pending.
40. job antigo não tem available_at reescrito.
41. duas vias preservam copies_requested.

### Chegada

42. confirmação no dia correto abre uma comanda.
43. clique/retry duplicado retorna mesma comanda.
44. confirmação antes da data é rejeitada.
45. mesa inativa bloqueia confirmação.
46. mesa ocupada bloqueia confirmação.
47. order Finalizado pode ser convertido.
48. order Cancelado não pode ser convertido.
49. após conversão mesa fica Ocupada.
50. próxima reserva da mesa é recalculada.

### Cancelamento/no-show

51. cancelar pelo detalhe fecha reservation + order.
52. cancelar pelo pedido também fecha reservation.
53. no-show exige motivo oficial.
54. no-show não abre comanda.
55. intervalo fica disponível após cancel/no-show.

### Financeiro/relatórios

56. reserva Local não aparece em A Receber.
57. reserva convertida só recebe via comanda.
58. Entrega futura não paga aparece como upcoming.
59. Entrega futura paga cria movimento na data real do pagamento.
60. relatório operacional não conta antecedência como preparo.
61. Local reservado aparece como Agendado/Local nos filtros.
62. cancel/no-show não entra em população de vendas que exclui cancelados.

### UX

63. desktop tema escuro.
64. desktop tema claro.
65. mobile lista Comandas.
66. mobile detalhe.
67. mobile edição.
68. mobile confirmar chegada.
69. F5/deep link.
70. sincronização em duas sessões.
71. foco/teclado.
72. estados não dependem somente de cor.

---

## 35. Fora do escopo

Não implementar nesta V1:

- reserva sem item;
- número de pessoas;
- mapa visual do salão;
- setores/ambientes;
- duração personalizada;
- capacidade da mesa;
- lista de espera;
- recorrência;
- depósito/sinal;
- confirmação por WhatsApp/SMS;
- lembrete automático ao cliente;
- no-show automático;
- calendário visual completo;
- fusão de comandas;
- duas comandas simultâneas na mesma mesa;
- edição genérica de pedido Entrega/Retirada;
- histórico versionado linha a linha de cada edição;
- mudança da identidade global do app.

---

## 36. Auto-revisão da spec

A revisão desta versão fechou os principais pontos ambíguos da issue:

1. **Reserva não será uma comanda futura.**
   Foi escolhida entidade table_reservations separada.

2. **Reserva não será um novo status de pedido.**
   Orders mantém lifecycle de cozinha e reserva mantém lifecycle de atendimento.

3. **Local reservado sem table_tab precisa continuar fora de A Receber.**
   A exclusão será explícita por contexto de reserva, não somente table_tab_id.

4. **A edição não pode coexistir silenciosamente com preparo já iniciado.**
   Ela bloqueia em operational_start_at.

5. **O mesmo-dia atual não deve regredir.**
   Entrega/Retirada agendadas no mesmo dia continuam com autoimpressão imediata.

6. **Reserva Local precisa permanecer editável.**
   Seu job automático espera operational_start_at, inclusive no mesmo dia.

7. **Uma mesa ocupada pode ter reserva futura.**
   Occupancy e reservation são conceitos simultâneos, não estados mutuamente exclusivos.

8. **O sistema não adivinha duração da comanda atual.**
   Ocupação presente não bloqueia reserva futura; conflito é reserva × reserva e confirmação da chegada valida ocupação real.

9. **Comandas não vira calendário.**
   Mostra a próxima reserva por mesa; a lista completa fica em Pedidos > Próximos dias.

10. **No-show não burla política de cancelamento.**
    Ele usa motivo oficial e preserva a distinção no domínio de reservas.

11. **Preço após edição foi definido.**
    Salvar edição revalida e repricing o snapshot, com revisão visível antes da confirmação.

12. **Rename de mesa com reserva foi bloqueado na V1.**
    Evita divergência entre snapshot e documento automático sem criar sincronização adicional.

13. **Não criar nova capability.**
    A feature reutiliza as capacidades existentes.

Não foram encontrados bloqueios conceituais restantes para escrever o plano, desde que esta spec seja aprovada.

---

## 37. Critério de encerramento da fase de design

Esta spec é considerada aprovada somente após autorização explícita do proprietário do projeto.

Depois da aprovação:

1. criar o plano de implementação TDD;
2. dividir migration/backend/domínio/UI/printing/reporting/QA em tarefas pequenas;
3. executar em branch de feature, nunca em master;
4. publicar staging;
5. homologar desktop/mobile/cozinha/TV/impressão;
6. só então preparar merge;
7. produção continua separada e exige autorização explícita.
