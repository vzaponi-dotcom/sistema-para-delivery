# Gestão Delivery — Confirmações, Sincronização e Campos Monetários

Data: 2026-09-03

## Objetivo

Consolidar uma rodada de melhorias de UX, consistência de dados e rastreabilidade com quatro resultados principais:

1. padronizar campos monetários em Real brasileiro;
2. transformar confirmações de ações significativas em regra de negócio/UX;
3. eliminar a necessidade de recarregar a página para refletir alterações locais ou feitas em outros dispositivos;
4. corrigir inconsistências observadas em estornos pendentes e datas de cancelamento.

## 1. Campos monetários em BRL

### Taxa de entrega

O campo de taxa de entrega deve usar máscara brasileira enquanto o usuário digita, por exemplo `R$ 0,00`, `R$ 5,00` e `R$ 12,50`.

### Desconto e acréscimo

Quando o ajuste do pedido estiver no modo fixo (`R$`), o campo Valor deve usar a mesma máscara BRL.

Quando o ajuste estiver no modo percentual (`%`), o campo permanece percentual e não deve receber máscara monetária.

### Contrato de dados

A máscara é apenas de apresentação. O estado enviado para os cálculos e para a API deve continuar convertido para valor numérico válido, sem símbolos de moeda ou formatação local.

A implementação deve reutilizar os helpers BRL já existentes no projeto, evitando regras duplicadas para moeda.

## 2. Regra transversal de confirmação

A partir desta rodada, ações destrutivas, irreversíveis ou com impacto financeiro exigem confirmação antes da execução.

Toda alteração significativa que for concluída com sucesso pelo servidor deve apresentar confirmação visual de sucesso depois da execução.

### Exemplos que exigem confirmação prévia

- cancelamento de pedido;
- exclusões permanentes que ainda existam em outros domínios;
- estornos;
- ajustes financeiros relevantes;
- outras ações futuras que alterem significativamente o estado ou o histórico de um registro.

### Ações que não exigem confirmação

- navegação;
- filtros;
- abertura/fechamento de modal;
- digitação em formulários;
- seleção de opções antes do salvamento;
- ações rotineiras e facilmente reversíveis.

### Padrão pós-sucesso

A confirmação posterior deve utilizar o popup central de sucesso já adotado pelo sistema, em vez de mensagens locais inconsistentes por tela.

Em caso de erro, nenhum popup de sucesso deve aparecer; deve ser exibido apenas o erro correspondente.

## 3. Fluxo de cancelamento de pedido

O fluxo de cancelamento continua coletando motivo, observação quando necessária e decisão de estorno para pedidos pagos.

Antes da chamada definitiva à API, o usuário deve receber uma confirmação final clara, informando que o pedido será cancelado e, quando aplicável, que o estorno será registrado.

Após sucesso do servidor:

- o pedido deve ser atualizado imediatamente no estado central;
- Dashboard, Histórico, Financeiro, A Receber e demais visões derivadas devem refletir a mudança sem reload;
- deve ser exibido popup central com mensagem como `Pedido cancelado com sucesso` ou `Pedido cancelado e estorno registrado`.

## 4. Arquitetura de sincronização automática

A solução adotada é híbrida: atualização local imediata mais reconciliação global periódica.

### 4.1 Atualização imediata no dispositivo que executou a ação

Toda escrita deve aplicar ao estado central os objetos oficiais retornados pela API assim que a operação concluir.

Exemplos:

- criar pedido: atualizar pedido e eventuais movimentos/comanda retornados;
- cancelar pedido: atualizar pedido e eventual movimento de estorno;
- registrar pagamento: atualizar pedido e movimento;
- registrar estorno: atualizar pedido e movimento;
- pagamento de comanda: atualizar pedidos, movimentos e comanda;
- lançamento financeiro: atualizar movimentos;
- clientes/produtos: atualizar as respectivas coleções.

As telas devem derivar seus indicadores desse estado central, evitando cópias locais que possam divergir.

### 4.2 Sincronização entre dispositivos

Enquanto o usuário estiver autenticado e online, o sistema deve executar sincronização global em segundo plano em uma cadência aproximada de 5 segundos.

Também deve sincronizar imediatamente quando:

- a janela ganha foco;
- a aba volta a ficar visível;
- a conexão com a internet é recuperada.

A tela de Pedidos pode manter seu polling especializado mais rápido, atualmente de aproximadamente 2 segundos, por ser operacionalmente mais sensível.

### 4.3 Proteções de concorrência

A sincronização deve impedir:

- duas cargas globais simultâneas;
- resposta antiga sobrescrever estado mais recente;
- falha de polling bloquear ações do usuário;
- sessão expirada permanecer silenciosamente em estado inválido.

Falhas de sincronização em segundo plano podem ser silenciosas quando temporárias, mas erro de escrita solicitado pelo usuário deve continuar visível.

### 4.4 Critério funcional

Depois que uma operação for persistida, o usuário que executou a ação deve vê-la imediatamente. Outros dispositivos abertos devem convergir automaticamente em poucos segundos, sem F5.

## 5. Correção de estornos pendentes

Foi observado um caso em produção em que um estorno foi aceito pelo backend, mas o pedido continuou aparecendo em `Estornos pendentes`. Uma segunda tentativa foi corretamente rejeitada pelo backend com `Este pedido já foi estornado`.

Isso caracteriza divergência entre estado persistido e estado exibido.

### Regra de consistência

Após registrar um estorno:

- a resposta oficial do backend deve atualizar imediatamente o pedido no estado central;
- o movimento de estorno deve ser inserido ou substituído de forma idempotente;
- `getOrderRefundState(order)` deve passar para `refunded` imediatamente;
- o pedido deve desaparecer de `Estornos pendentes` sem reload;
- uma reconciliação global deve confirmar o estado persistido;
- o item não pode reaparecer após troca de tela, foco, polling ou sincronização em outro dispositivo.

A proteção de backend contra estorno duplicado permanece obrigatória e não deve ser relaxada.

## 6. Data de cancelamento e rastreabilidade

Novos cancelamentos devem sempre persistir `cancelled_at` automaticamente usando o horário oficial do servidor.

O backend deve retornar `cancelledAt` em todas as representações de pedido cancelado.

Financeiro e Histórico devem usar a mesma data oficial.

### Datas distintas para relatório

O modelo deve preservar separadamente:

- data do pedido;
- data/hora do cancelamento;
- data/hora do pagamento;
- data/hora do estorno.

Esses campos não devem ser inferidos uns dos outros em relatórios futuros.

### Registros históricos antigos

Registros já existentes que estejam cancelados sem `cancelled_at` não receberão uma data inventada. Permanecem como dados históricos incompletos.

O sistema, porém, deve impedir que novos cancelamentos bem-sucedidos sejam criados sem data.

O fallback visual `Data não informada` pode continuar existindo somente para legado/inconsistência histórica, não como fluxo normal.

## 7. Estado central e responsabilidades das telas

O `App` continua sendo a fonte central das coleções principais: pedidos, movimentos, comandas, clientes e produtos.

Dashboard, Financeiro, A Receber, Histórico e Pedidos devem derivar seus dados dessas coleções.

Componentes de página podem manter apenas estado estritamente visual/local, como filtros, modal aberto e item selecionado. Não devem manter cópias persistentes de pedidos para compensar falta de atualização do estado central quando a página estiver integrada ao App.

## 8. Critérios de aceite

### Campos monetários

- taxa de entrega exibe e edita em formato `R$ 0,00`;
- desconto/acréscimo fixo exibe e edita em BRL;
- percentual continua percentual;
- cálculos continuam corretos;
- payload enviado à API permanece numérico.

### Confirmação de ações

- cancelamento exige confirmação final antes da escrita;
- estorno e demais ações financeiras relevantes seguem o padrão de confirmação quando aplicável;
- sucesso apresenta popup central;
- falha nunca apresenta confirmação de sucesso.

### Atualização em tempo real percebido

- cancelamento atualiza Dashboard imediatamente;
- pagamento atualiza Dashboard/A Receber/Financeiro imediatamente;
- estorno atualiza Dashboard/Financeiro e remove pendência imediatamente;
- lançamento manual atualiza Financeiro e indicadores derivados imediatamente;
- Histórico reflete alterações sem reload;
- outro dispositivo converge automaticamente em poucos segundos;
- foco, retorno de aba e reconexão disparam sincronização;
- polling de Pedidos continua funcional;
- não ocorrem refreshes globais concorrentes.

### Regressão específica do estorno

Cenário obrigatório:

1. criar pedido pago;
2. cancelar deixando estorno pendente;
3. confirmar presença em `Estornos pendentes`;
4. registrar estorno;
5. confirmar que o item desaparece imediatamente;
6. trocar de tela e voltar;
7. aguardar sincronização;
8. validar em outro dispositivo/sessão;
9. confirmar que o item não reaparece;
10. confirmar que tentativa duplicada continua bloqueada no backend.

### Data de cancelamento

- novo pedido cancelado sempre retorna `cancelledAt` válido;
- Financeiro apresenta a data correta;
- Histórico usa a mesma data;
- `refundedAt` continua representando a data do estorno, não a data do cancelamento;
- registro legado sem data não recebe data artificial.

### Responsividade e regressão

- fluxos devem continuar utilizáveis entre 320 e 480 px;
- modais de confirmação e sucesso não podem cortar conteúdo;
- testes existentes de cancelamento, estorno, pedidos, dashboard, financeiro e pagamentos devem continuar verdes.

## 9. Estratégia de testes

A implementação deve seguir TDD.

Cada comportamento novo ou correção de bug deve começar por teste de regressão que falhe pelo motivo esperado e só depois receber a implementação mínima necessária.

A suíte final deve incluir testes de unidade para formatação/conversão monetária, derivação de estado de estorno e sincronização, além de testes de componentes/contratos para confirmação e atualização imediata das visões derivadas.

Antes de considerar a rodada concluída, executar testes, lint, build e Worker dry-run em CI.

## Fora de escopo

- WebSocket, SSE ou infraestrutura push dedicada nesta rodada;
- estorno parcial;
- múltiplos estornos para o mesmo pedido;
- reconstrução artificial de datas históricas ausentes;
- refatorações não relacionadas aos fluxos descritos acima.
