# Gestão Delivery — Pedidos agendados e tempo operacional

Data: 2026-09-04  
Branch: `feature/scheduled-orders-operational-timing`  
Status: auto-revisado; aguardando aprovação do arquivo antes do plano de implementação

## 1. Objetivo

Corrigir a leitura operacional e os relatórios de tempo quando um cliente faz o pedido com antecedência, mantendo a operação simples e sem criar novas etapas manuais para a equipe.

O sistema continua com o fluxo operacional atual:

- `Entrega`: **Em preparo → Saiu para entrega**;
- `Retirada`: **Em preparo → Finalizar**;
- `Consumo no local`: **Em preparo → Finalizar**.

Nesta fase não será criada a etapa `Entregue` e não será exigida nenhuma confirmação adicional depois que o pedido sai da cozinha.

A melhoria introduz:

1. escolha entre **Agora** e **Agendado** na Nova venda;
2. separação automática entre pedidos agendados e pedidos que já devem estar em preparo;
3. janela operacional padrão de **50 minutos antes** do horário desejado pelo cliente;
4. tolerância padrão de **15 minutos depois** do horário desejado antes de marcar o pedido como atrasado;
5. liberação automática de som e impressão somente quando o pedido entra na janela operacional;
6. cálculo correto do tempo operacional nos relatórios, sem contar horas de antecedência como tempo de preparo.

## 2. Princípios aprovados

As decisões aprovadas são:

- o horário agendado representa o **horário desejado pelo cliente**, não uma promessa rígida de entrega;
- a primeira versão aceita agendamento somente para o **mesmo dia**;
- agendamento é permitido apenas para `Entrega` e `Retirada`;
- `Consumo no local` continua sempre como atendimento `Agora`;
- horários desejados que já passaram não podem ser selecionados;
- pedido agendado criado já dentro da janela de 50 minutos entra imediatamente na fila de preparo;
- pedidos agendados fora da janela aparecem separados da fila de preparo;
- pedidos agendados são ordenados pelo horário desejado mais próximo primeiro;
- a mudança de `Agendado` para `Em preparo` é derivada pelo relógio, sem exigir clique da equipe;
- não é necessário criar cron apenas para persistir essa mudança visual/operacional;
- pedidos agendados não tocam o som de novo pedido quando são cadastrados fora da janela;
- o som é disparado quando entram na janela operacional;
- a impressão automática de pedido agendado é liberada somente quando o pedido entra na janela operacional;
- cancelamento antes da liberação impede a impressão futura;
- tolerância de atraso é fixa em 15 minutos nesta versão, mas a regra fica centralizada para futura configuração;
- janela de preparo é fixa em 50 minutos nesta versão, mas a regra fica centralizada para futura configuração.

## 3. Problema atual

Hoje `created_at` é usado ao mesmo tempo como:

- horário real em que o pedido foi registrado;
- referência para o contador de preparo;
- referência para classificação de atraso.

Isso funciona para pedidos feitos para preparo imediato, mas não para pedidos antecipados.

Exemplo atual incorreto:

```text
09:00 pedido registrado
12:00 horário desejado pelo cliente
11:00 sistema já mostra 120 min de preparo
```

O pedido ainda não está atrasado nem deveria ser tratado como tendo duas horas de preparo.

A nova arquitetura separa **momento do cadastro** de **momento em que o pedido entra na operação da cozinha**.

## 4. Modelo de dados

### 4.1 Pedido agendado

A tabela `orders` recebe um campo nullable equivalente a:

```text
scheduled_for TEXT NULL
```

Semântica:

- `NULL` = pedido **Agora**;
- timestamp preenchido = pedido **Agendado**.

Não será criado um campo redundante `schedule_mode`. O modo é derivado de `scheduled_for`.

O timestamp é armazenado em ISO/UTC. Conversão, validação de dia e exibição devem usar o fuso operacional já adotado pelo sistema, e não depender do fuso arbitrário do navegador.

O campo atual `created_at` continua representando exclusivamente a hora real em que o pedido foi registrado.

### 4.2 Identificação de lançamento retroativo

Para impedir que pedidos históricos cadastrados manualmente contaminem métricas de operação, a tabela `orders` recebe uma marca explícita equivalente a:

```text
is_backdated INTEGER NOT NULL DEFAULT 0
```

Novos pedidos com `order_date` anterior ao dia operacional recebem `is_backdated = 1`.

A migration marca registros históricos antigos que seguem exatamente o padrão atual de criação retroativa: pedido finalizado cuja `created_at` e `finished_at` são iguais e correspondem ao timestamp artificial usado pelo fluxo histórico.

Pedidos retroativos continuam permitidos conforme a regra atual, mas nunca podem ser agendados.

### 4.3 Impressão programada

A tabela `print_jobs` recebe um campo equivalente a:

```text
available_at TEXT
```

Após a migration, todo job existente deve ter `available_at` preenchido; novas escritas nunca criam job sem esse valor.

Semântica:

- impressão automática comum: `available_at = created_at`;
- impressão automática agendada: `available_at = operational_start_at`;
- jobs antigos: migration preenche `available_at = created_at`;
- jobs manuais e testes: `available_at = created_at`.

O job pode existir tecnicamente desde o cadastro, mas **não é elegível para claim nem para envelhecimento por espera antes de `available_at`**.

Isso evita o comportamento atual em que um job automático pendente por mais de 10 minutos é considerado problemático.

## 5. Constantes operacionais

As regras ficam centralizadas em um único módulo compartilhável e testável, com valores equivalentes a:

```text
SCHEDULED_PREP_LEAD_MINUTES = 50
SCHEDULED_LATE_GRACE_MINUTES = 15
```

Não devem existir números `50` e `15` espalhados por componentes, repositórios ou relatórios.

No futuro essas constantes podem ser substituídas por configuração persistida sem alterar o modelo conceitual.

## 6. Relógio operacional do pedido

### 6.1 Pedido Agora

Para pedido não agendado:

```text
operational_start_at = created_at
```

O tempo operacional continua sendo contado desde a entrada real do pedido.

### 6.2 Pedido Agendado

Para pedido agendado:

```text
scheduled_prep_at = scheduled_for - 50 minutos
operational_start_at = max(created_at, scheduled_prep_at)
late_at = scheduled_for + 15 minutos
```

Usar `max(created_at, scheduled_prep_at)` é obrigatório.

Exemplo A — pedido antecipado:

```text
09:00 criado
12:00 desejado
11:10 início teórico da janela
11:10 operational_start_at
```

Exemplo B — pedido criado já dentro da janela:

```text
11:45 criado
12:00 desejado
11:10 início teórico da janela
11:45 operational_start_at
```

O sistema nunca pode contar tempo operacional anterior à existência do pedido.

## 7. Estado operacional derivado

O campo persistido `status` continua seguindo o lifecycle existente (`Em preparo`, `Finalizado`, `Cancelado`).

`Agendado` é um **estado operacional derivado**, não um novo status persistido.

Para pedido ativo:

```text
scheduled_for == null
  => Em preparo

scheduled_for != null e agora < operational_start_at
  => Agendado

scheduled_for != null e agora >= operational_start_at
  => Em preparo
```

Essa decisão elimina a necessidade de uma tarefa agendada apenas para alterar o banco quando o relógio chega ao início da janela.

### 7.1 Atraso

Pedido `Agora` preserva a política atual:

- até 30 min: no prazo;
- acima de 30 min: atrasado;
- acima de 40 min: muito atrasado.

Pedido `Agendado` usa o horário desejado como referência:

- até `scheduled_for + 15 min`: não atrasado;
- depois de `scheduled_for + 15 min`: atrasado.

Nesta primeira versão o pedido agendado não recebe uma segunda faixa específica de `Muito atrasado`; permanece como `Atrasado` após a tolerância. Isso evita criar um segundo SLA não aprovado.

## 8. Nova venda

### 8.1 Local da opção

Na etapa **Cliente** da Nova venda, `Entrega` e `Retirada` exibem:

```text
Quando preparar?
[ Agora ] [ Agendado ]
```

`Agora` é o padrão.

Ao selecionar `Agendado`, aparece:

```text
Horário desejado pelo cliente
[ 12:00 ]

Esse horário é uma referência de atendimento.
```

### 8.2 Consumo no local

Para `Consumo no local`, o seletor não é exibido e o rascunho permanece em modo `Agora`.

Se o operador escolher `Agendado` em Entrega/Retirada e depois mudar o tipo para `Local`, o horário agendado é limpo do rascunho para evitar payload inválido oculto.

### 8.3 Validação no frontend

O formulário impede:

- agendamento para outro dia;
- horário anterior ao momento atual;
- agendamento em `Local`;
- avanço com modo `Agendado` sem horário válido.

A seleção deve ser acessível por teclado e touch e não depender apenas de cor.

### 8.4 Validação oficial no Worker

O backend continua sendo autoridade da regra.

O checkout rejeita:

- `scheduled_for` em pedido `Local`;
- `scheduled_for` cuja data operacional não seja o mesmo dia de `order_date` e do cadastro atual;
- `scheduled_for` já passado no momento do checkout;
- `scheduled_for` em lançamento retroativo;
- timestamp inválido.

A validação do frontend é apenas UX; não substitui a validação do Worker.

## 9. Tela Pedidos / Cozinha

### 9.1 Contadores

A área de indicadores passa a distinguir:

- **Em preparo** — pedidos ativos que já entraram na janela operacional;
- **Agendados** — pedidos ativos ainda fora da janela;
- **Com atraso** — pedidos atualmente atrasados conforme a política correspondente;
- **Finalizados hoje** — mantém a semântica existente.

Pedido agendado fora da janela não entra no contador `Em preparo`.

### 9.2 Fila Em preparo

Contém:

- todos os pedidos `Agora` ativos;
- pedidos agendados cujo `agora >= operational_start_at`.

A ordenação usa a referência operacional mais antiga primeiro.

Para pedido agendado dentro da janela, a interface deixa visível o horário desejado, por exemplo:

```text
Desejado 12:00
```

O contador de tempo usa `operational_start_at`.

### 9.3 Lista Agendados

Pedidos fora da janela aparecem em bloco separado `Agendados`, ordenados por `scheduled_for ASC`.

Exemplo:

```text
11:30 · João · Retirada
12:00 · Maria · Entrega
12:30 · Carlos · Entrega
```

O bloco mostra prioritariamente:

- horário desejado;
- cliente;
- tipo;
- quantidade/resumo dos itens;
- acesso aos detalhes;
- cancelamento.

Não mostra contador de preparo correndo enquanto o pedido ainda está fora da janela.

### 9.4 Transição automática

Quando o relógio alcança `operational_start_at`, a UI reclassifica o pedido automaticamente de `Agendado` para `Em preparo`, sem recarregar a página e sem clique da operação.

A implementação pode aproveitar o relógio periódico já existente na tela, desde que a atualização ocorra dentro de tolerância aproximada de um minuto.

## 10. Som de entrada na cozinha

### 10.1 Pedido Agora

Mantém o comportamento existente de novo pedido.

### 10.2 Pedido Agendado fora da janela

No momento do cadastro:

- não tocar som de entrada da cozinha;
- não marcar visualmente como nova chegada na fila de preparo.

Quando atingir `operational_start_at`:

- tocar o mesmo alerta sonoro usado para novo pedido;
- aplicar o destaque temporário de nova chegada, quando disponível;
- evitar repetir o alerta a cada atualização do relógio.

O controle de repetição pode ser local à sessão/dispositivo; não é necessário persistir evento de áudio no backend nesta fase.

Se o sistema for aberto depois que o pedido já entrou na janela, a interface simplesmente o exibe em `Em preparo`; não é requisito reproduzir alertas históricos que ocorreram enquanto o dispositivo estava fechado.

## 11. Impressão automática

### 11.1 Pedido Agora

Mantém a regra atual:

```text
available_at = created_at
```

A estação pode assumir o job imediatamente.

### 11.2 Pedido Agendado

O snapshot oficial do ticket pode ser criado junto com o pedido, preservando preço, cliente e itens daquele momento, porém o job automático recebe:

```text
available_at = operational_start_at
```

A estação principal só pode assumir o job quando:

```text
available_at <= agora
```

### 11.3 Envelhecimento de pendência

A regra de pendência antiga passa a usar `available_at`, não `created_at`.

Portanto, um pedido criado às 09:00 para 12:00, disponível para impressão às 11:10, só pode ser considerado `PENDING_TOO_OLD` depois de permanecer disponível por mais de 10 minutos sem processamento.

O período 09:00–11:10 não conta como espera de impressão.

### 11.4 Cancelamento

Ao cancelar um pedido, qualquer job **automático** ainda em `pending` é removido antes de concluir o cancelamento. Isso vale tanto para pedido agendado quanto para pedido `Agora` que ainda não foi assumido pela estação.

Jobs manuais não são apagados por essa regra.

Jobs automáticos já `processing`, `printed`, `failed` ou `requires_attention` também não são apagados retroativamente; permanecem como histórico técnico.

Além disso, `claim-next` deve filtrar o status do pedido e nunca assumir job automático de pedido `Cancelado`. Essa checagem é obrigatória para proteger contra condição de corrida entre cancelamento e estação de impressão.

Assim, um pedido agendado cancelado antes da janela nunca chega fisicamente à cozinha por impressão automática.

### 11.5 Visualização antes da janela

Se o operador abrir os detalhes de um pedido agendado antes de `available_at`, a UI não apresenta a impressão como erro ou atraso.

Exibe algo equivalente a:

```text
Impressão programada para 11:10
```

A impressão manual continua permitida conforme as regras atuais, porque é uma ação explícita do operador.

## 12. Histórico e detalhes do pedido

Os detalhes passam a mostrar, quando houver agendamento:

- horário em que o pedido foi criado;
- horário desejado pelo cliente;
- horário de entrada operacional na cozinha;
- horário de saída/finalização quando existente.

Para pedidos comuns, mantém-se a apresentação atual com horário de entrada.

No histórico, não é criada nova etapa `Entregue`.

Para `Entrega`, `finished_at` continua significando o momento em que o operador confirmou **Saiu para entrega**.

Para `Retirada` e `Local`, `finished_at` continua significando a finalização operacional atual.

## 13. Métricas de tempo operacional

### 13.1 Duração oficial

Pedido elegível concluído:

```text
operational_duration = finished_at - operational_start_at
```

Pedido `Agora`:

```text
operational_start_at = created_at
```

Pedido `Agendado`:

```text
operational_start_at = max(created_at, scheduled_for - 50 min)
```

A duração nunca pode ser negativa.

### 13.2 Exclusões da média principal

Não entram na média final de tempo operacional:

- pedidos `Cancelado`;
- pedidos com `is_backdated = 1`;
- pedidos ainda ativos;
- registros sem timestamps válidos.

Pedidos ativos podem aparecer em indicadores da operação corrente, mas não na média de pedidos concluídos.

### 13.3 Terminologia

Métrica agregada:

```text
Tempo operacional
```

Ao detalhar por tipo:

- `Entrega`: **Tempo até sair para entrega**;
- `Retirada`: **Tempo até finalização**;
- `Local`: **Tempo até finalização**.

Nunca chamar essa métrica de `tempo de entrega`, porque o sistema ainda não conhece o momento em que o cliente recebeu o pedido.

### 13.4 Indicadores iniciais

A primeira apresentação usa o período já existente no Dashboard (`Hoje`, `7 dias`, `30 dias`) e adiciona uma seção operacional, sem criar nova página de relatórios nesta rodada.

Indicadores:

- tempo operacional médio;
- pedido concluído mais rápido no período;
- pedido concluído mais demorado no período;
- distribuição por faixas:
  - até 20 min;
  - 21–30 min;
  - 31–40 min;
  - acima de 40 min;
- comparação por tipo (`Entrega`, `Retirada`, `Local`) quando houver amostra.

As métricas são calculadas a partir dos timestamps persistidos, não de estados temporários do frontend.

## 14. Pontualidade de pedidos agendados

A arquitetura deixa disponível um cálculo secundário para pedidos agendados concluídos:

```text
schedule_delta = finished_at - scheduled_for
```

Interpretação para `Entrega` nesta fase:

- valor negativo: saiu para entrega antes do horário desejado;
- valor positivo: saiu para entrega depois do horário desejado.

Isso mede **pontualidade de saída da operação**, não horário de recebimento pelo cliente.

Não é necessário transformar essa métrica em SLA complexo nesta rodada.

## 15. Regras de borda

### 15.1 Pedido criado dentro da janela

Exemplo:

```text
agora 11:45
horário desejado 12:00
```

Resultado:

- aceito como agendado;
- classificado imediatamente como `Em preparo`;
- `operational_start_at = 11:45`;
- som toca como nova entrada da cozinha;
- impressão automática fica disponível imediatamente.

### 15.2 Horário desejado já passado

Exemplo:

```text
agora 11:45
horário informado 11:30
```

Resultado: inválido. O operador deve usar `Agora` ou escolher horário futuro.

### 15.3 Alteração de tipo antes do checkout

- `Entrega ↔ Retirada`: mantém o agendamento válido;
- `Entrega/Retirada → Local`: limpa o agendamento;
- `Local → Entrega/Retirada`: inicia como `Agora` e o operador pode selecionar `Agendado` novamente.

### 15.4 Cancelamento antes da janela

- pedido sai das listas ativas conforme lifecycle atual;
- nenhum som futuro é disparado;
- job automático pendente é removido;
- impressão automática futura não pode ocorrer.

### 15.5 Finalização antecipada

Se um pedido agendado for finalizado manualmente antes do horário desejado, o sistema aceita o lifecycle atual.

A duração usa `operational_start_at`, e a pontualidade registra delta negativo.

### 15.6 Lançamento retroativo

Pedido de data passada mantém o comportamento histórico atual e nasce finalizado, porém:

- `is_backdated = 1`;
- `scheduled_for = NULL`;
- não entra em métricas de tempo operacional;
- não cria impressão automática da cozinha.

## 16. Compatibilidade e migration

A migration é aditiva e segura para dados existentes.

Pedidos antigos:

- `scheduled_for = NULL`;
- continuam equivalentes a pedidos `Agora`;
- lifecycle e payloads existentes permanecem compatíveis.

Print jobs antigos:

- `available_at` recebe `created_at`;
- comportamento continua equivalente ao atual.

Clientes, produtos, pagamentos, movimentos, comandas e snapshots não mudam por causa desta feature.

## 17. API e contrato

`POST /api/orders` passa a aceitar campo opcional equivalente a:

```text
scheduledFor: ISO timestamp | null
```

A resposta de pedido passa a expor:

```text
scheduledFor
isBackdated
```

Não é necessário criar endpoint separado para `Agendado → Em preparo`, porque essa mudança é derivada pelo relógio.

Endpoints de leitura/bootstrap devolvem os novos campos necessários para que qualquer dispositivo calcule o mesmo estado operacional.

A API de impressão expõe `availableAt` para diagnóstico e apresentação de impressão programada.

## 18. Sincronização entre dispositivos

`scheduled_for` é persistido no D1 e chega pelo mecanismo oficial de sincronização já existente.

Todos os dispositivos calculam o estado operacional usando as mesmas funções e constantes.

O relógio local só decide a apresentação derivada; não altera preços, pagamento, status financeiro ou lifecycle persistido.

A divergência de alguns segundos entre dispositivos é aceitável. O alvo de atualização operacional é de até aproximadamente um minuto.

## 19. Testes obrigatórios

A implementação deve seguir TDD estrito, com RED antes de cada mudança relevante.

Cobertura mínima:

- cálculo de `scheduled_prep_at` com 50 min;
- cálculo de `operational_start_at` usando `max(created_at, scheduled_prep_at)`;
- tolerância de 15 min;
- pedido comum preservando limites atuais de atraso;
- pedido agendado permanecendo sem atraso antes de `scheduled_for + 15 min`;
- classificação `Agendado` e `Em preparo` pelo relógio;
- pedido criado dentro da janela;
- validação de horário passado;
- bloqueio de agendamento para `Local`;
- bloqueio de agendamento em data diferente/retroativa;
- limpeza de agendamento ao trocar para `Local`;
- separação e ordenação das filas;
- contadores `Em preparo`, `Agendados`, `Com atraso`, `Finalizados hoje`;
- supressão de som no cadastro antecipado;
- disparo único de som ao entrar na janela;
- ausência de replay histórico obrigatório ao abrir depois da transição;
- `available_at` em jobs comuns e agendados;
- `claim-next` ignorando jobs antes de `available_at`;
- envelhecimento de impressão contado a partir de `available_at`;
- cancelamento removendo job automático ainda pendente;
- job de pedido cancelado nunca sendo assumido;
- impressão manual continuando disponível;
- cálculo de duração operacional em pedidos comuns e agendados;
- exclusão de cancelados, retroativos e ativos das médias;
- pontualidade de pedidos agendados;
- compatibilidade de registros antigos sem `scheduled_for`.

Além dos testes focados, continuam obrigatórios lint, build, validação dos bundles Worker e migrations locais conforme o pipeline existente.

## 20. Fora de escopo nesta rodada

Não fazem parte desta implementação:

- confirmação de entrega ao cliente;
- `delivered_at`;
- aplicativo ou fluxo do entregador;
- cálculo de tempo de deslocamento/entrega;
- agendamento para dias futuros;
- agendamento de Consumo no local;
- horário desejado diferente por item do pedido;
- configuração administrativa dos 50/15 minutos pela interface;
- cron dedicado para persistir `Agendado → Em preparo`;
- promessa automática de horário ao cliente;
- otimização de rota ou capacidade de cozinha;
- previsão inteligente de tempo de preparo.

## 21. Critérios de aceite

A rodada estará funcionalmente correta quando for possível demonstrar:

1. criar Entrega/Retirada como `Agora` sem regressão no fluxo atual;
2. criar Entrega/Retirada como `Agendado` para horário futuro do mesmo dia;
3. ver o pedido fora de `Em preparo` enquanto faltarem mais de 50 minutos;
4. ver o pedido em `Agendados`, ordenado pelo horário desejado;
5. observar a entrada automática em `Em preparo` ao atingir a janela;
6. ouvir o alerta apenas nesse momento para pedido antecipado;
7. confirmar que a impressão automática só fica disponível nesse momento;
8. confirmar que cancelamento anterior impede a impressão;
9. confirmar que o pedido não é marcado como atrasado até 15 minutos depois do horário desejado;
10. finalizar normalmente usando `Saiu para entrega` ou `Finalizar`;
11. visualizar tempo operacional sem incluir as horas em que o pedido estava apenas agendado;
12. confirmar que pedidos retroativos e cancelados não distorcem a média;
13. confirmar que nenhuma nova etapa manual foi adicionada à operação.

## 22. Exemplo completo aprovado

Pedido de Entrega criado às 09:00 com horário desejado 12:00:

```text
09:00  Cadastrado como Agendado
       Sem som da cozinha
       Impressão automática ainda indisponível

11:10  Início da janela de 50 min
       Passa automaticamente para Em preparo
       Toca alerta sonoro
       Impressão automática é liberada
       Início do relógio operacional

12:00  Horário desejado pelo cliente
       Continua Em preparo sem ser marcado como atrasado

12:15  Fim da tolerância

12:16  Se ainda ativo, aparece como Atrasado
```

Se o operador marcar `Saiu para entrega` às 11:55:

```text
Tempo operacional = 11:55 - 11:10 = 45 min
Pontualidade de saída = 11:55 - 12:00 = -5 min
```

O sistema não afirma que o cliente recebeu o pedido às 11:55; apenas registra que o pedido saiu da operação nesse momento.
