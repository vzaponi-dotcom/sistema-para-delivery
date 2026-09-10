# Feature 15 — Tela Operacional de Comandas

**Status:** aprovado
**Data:** 2026-09-10
**Issue:** [#15 — Feature: tela própria de Comandas separada de A Receber](https://github.com/vzaponi-dotcom/sistema-para-delivery/issues/15)
**Branch:** `feature/issue-15-comandas`
**Base:** `origin/master` @ `8ddfd95f850d1e0903818409f225378d4d909a04`

## 1. Objetivo

Transformar Comandas em uma área operacional própria, separada de `A Receber`, na qual o operador possa identificar mesas livres e ocupadas, abrir e consultar comandas, lançar pedidos, visualizar e imprimir uma pré-conta consolidada e registrar o pagamento integral.

O trabalho deve ser entregável isoladamente. Ele não pode incorporar nem depender da branch de segurança operacional de impressão que já foi publicada em staging e ainda não foi promovida para produção.

## 2. Decisões de produto aprovadas

1. A aplicação terá uma navegação própria chamada `Comandas`.
2. A tela mostrará todas as mesas ativas, inclusive as livres.
3. Mesa livre abre o fluxo do primeiro pedido com a mesa preselecionada.
4. Mesa ocupada abre a comanda atual da mesa.
5. O primeiro pedido cria a comanda; pedidos posteriores reutilizam a mesma comanda aberta.
6. Cada comanda recebe um número sequencial próprio, independente da mesa.
7. O número da comanda permanece igual após transferência para outra mesa.
8. A tela permite adicionar pedidos a uma comanda aberta.
9. A tela permite visualizar o ticket consolidado sem imprimir.
10. A tela permite imprimir uma via da comanda consolidada como pré-conta.
11. Visualizar ou imprimir não altera o estado da comanda e pode ser repetido.
12. Somente `Registrar pagamento` fecha a comanda e libera a mesa.
13. O pagamento da comanda continua integral e reutiliza o fluxo financeiro oficial já existente.
14. A impressão automática de cada pedido continua com o comportamento atual de produção.
15. Comandas abertas deixam de aparecer na lista principal de `A Receber`.
16. Transferir comanda continua sendo uma ação da tela `Mesas`.
17. Não haverá impressão automática da comanda consolidada nesta versão.

## 3. Experiência da tela

### 3.1 Desktop

Usar o layout aprovado `lista + detalhe`:

- coluna esquerda com mesas ativas, status textual `Livre` ou `Ocupada`, número da comanda quando houver, contagem de itens e total atual;
- coluna direita com o detalhe da mesa/comanda selecionada;
- seleção de outra mesa troca apenas o detalhe, sem abandonar a tela;
- a lista deve preservar posição e seleção durante atualizações em tempo real sempre que a entidade ainda existir.

### 3.2 Celular

Usar navegação em duas etapas:

1. lista de mesas;
2. detalhe da comanda em tela completa.

Regras:

- tocar em mesa ocupada abre o detalhe consolidado;
- tocar em mesa livre abre o fluxo do primeiro pedido;
- voltar retorna à mesma posição da lista;
- ações devem ter áreas de toque confortáveis e não gerar rolagem horizontal;
- o detalhe deve priorizar itens e total, mantendo ações acessíveis.

### 3.3 Conteúdo de cada mesa

Mesa ocupada exibe, no mínimo:

- nome atual da mesa;
- status `Ocupada`;
- número da comanda;
- quantidade total de itens;
- total acumulado.

Mesa livre exibe:

- nome da mesa;
- status `Livre`;
- indicação de que um toque inicia um pedido.

Status nunca pode depender somente de cor.

### 3.4 Detalhe da comanda

O detalhe deve exibir:

- `Comanda <número>`;
- mesa atual;
- horário de abertura;
- quantidade de pedidos;
- itens consolidados;
- complementos e observações relevantes;
- total oficial da comanda;
- ações `Adicionar pedido`, `Ver ticket`, `Imprimir comanda` e `Registrar pagamento`.

O usuário não precisa navegar pela separação interna entre pedidos para apresentar a conta ao cliente. A composição por pedido continua preservada no backend e pode ser usada para diagnóstico e histórico, mas a visão principal é consolidada por item.

## 4. Fluxos operacionais

### 4.1 Primeiro pedido em mesa livre

1. O operador toca em uma mesa livre na tela `Comandas`.
2. A aplicação abre `Novo pedido` com tipo local e mesa preselecionados.
3. O operador monta e confirma o pedido pelo fluxo atual.
4. O backend valida que a mesa está ativa e busca uma comanda aberta.
5. Se ainda não existir, o backend cria uma comanda e reserva seu número sequencial atomicamente.
6. O pedido é vinculado ao novo `table_tab_id`.
7. A mesa passa a aparecer como ocupada em todas as sessões conectadas.

### 4.2 Pedido adicional

1. O operador abre uma comanda ocupada.
2. Toca em `Adicionar pedido`.
3. A aplicação abre `Novo pedido` com a mesa e a comanda preselecionadas.
4. O backend resolve a comanda aberta oficial da mesa e vincula o novo pedido ao mesmo `table_tab_id`.
5. A impressão automática do pedido segue o comportamento atual.
6. Total, quantidade e itens da comanda são atualizados em tempo real.

O navegador nunca pode escolher livremente um `table_tab_id` sem validação. O backend deve confirmar que a comanda está aberta, pertence ao mesmo estabelecimento e corresponde à mesa selecionada.

### 4.3 Ver ticket

`Ver ticket` busca do backend o mesmo documento consolidado usado pela impressão e abre a pré-visualização já familiar ao operador.

- não cria trabalho físico;
- não altera a comanda;
- não altera pagamento;
- não incrementa número;
- pode ser aberto repetidamente;
- reflete o snapshot atual obtido no momento da solicitação.

### 4.4 Imprimir comanda

`Imprimir comanda` solicita o documento consolidado atual e imprime uma via na impressora configurada no dispositivo.

- é uma ação manual;
- pode ser repetida;
- não fecha nem marca a comanda;
- não cria outra impressão automática dos pedidos;
- não altera a quantidade padrão de vias dos pedidos;
- uma falha não interfere em pedido, pagamento ou ocupação;
- o usuário recebe sucesso ou erro claro e pode tentar novamente.

### 4.5 Registrar pagamento

O botão reaproveita a forma de pagamento e o fluxo transacional oficial já existente em `A Receber`.

Após confirmação bem-sucedida:

- todos os pedidos pendentes da comanda são quitados;
- a comanda é fechada;
- a mesa fica livre;
- a comanda desaparece da lista de abertas;
- movimentos financeiros e histórico mantêm o comportamento atual.

Impressão da pré-conta e pagamento são ações independentes. Pagar não exige imprimir e imprimir não exige pagar.

## 5. Modelo de dados e numeração

### 5.1 Número da comanda

Adicionar `tab_number` a `table_tabs`.

Propriedades:

- inteiro positivo;
- único por `business_id`;
- imutável depois de atribuído;
- crescente dentro do estabelecimento;
- independente de `table_id` e do nome da mesa;
- preservado para comandas fechadas e transferidas;
- nunca reutilizado.

Usar um contador dedicado por estabelecimento para reservar o próximo número de forma atômica. Não usar apenas `MAX(tab_number) + 1` fora de uma transação, pois dois operadores podem abrir comandas ao mesmo tempo.

### 5.2 Migração e backfill

A migração desta feature deve usar o prefixo `0020`, posterior às migrações `0014` a `0019` já aplicadas em staging. A lacuna em produção é aceitável: a migração deve ser autocontida e não pode depender das estruturas de impressão dessas versões.

O backfill deve:

1. numerar comandas existentes por estabelecimento, em ordem determinística de `opened_at`, `created_at` e `id`;
2. manter números únicos mesmo quando datas coincidirem;
3. inicializar o contador de cada estabelecimento com o maior número atribuído;
4. criar a restrição de unicidade por `business_id + tab_number`;
5. preservar todos os vínculos e dados históricos existentes.

### 5.3 Fonte de verdade

- `table_tabs` continua sendo a fonte oficial de abertura, fechamento e mesa atual;
- `orders.table_tab_id` continua sendo o vínculo entre pedido e comanda;
- ocupação é derivada da existência de comanda aberta para a mesa;
- totais e composição são calculados pelo backend a partir dos pedidos oficiais;
- a UI não envia total consolidado para ser aceito como verdade.

## 6. Consolidação de itens

O backend deve devolver uma projeção consolidada específica para a comanda.

Itens só podem ser somados na mesma linha quando forem semanticamente iguais. A chave de agrupamento deve considerar, no mínimo:

- identidade do produto;
- nome exibido;
- preço unitário efetivo;
- complementos/opções normalizados;
- observação normalizada;
- demais atributos que alterem preço ou preparo.

Exemplos:

- dois `X-Bacon` normais, com mesmo preço, resultam em uma linha `2x X-Bacon`;
- `X-Bacon sem cebola` permanece separado de `X-Bacon`;
- itens de mesmo nome com preços diferentes permanecem separados;
- observações com diferenças relevantes permanecem separadas.

O total consolidado deve ser o total oficial dos pedidos, sem ser recalculado a partir de textos formatados na UI.

## 7. API e sincronização

Adicionar operações explícitas para:

- listar mesas ativas com o resumo da comanda aberta, quando houver;
- obter o detalhe oficial de uma comanda aberta;
- obter o documento consolidado para pré-visualização e impressão.

Reutilizar operações existentes para:

- criar pedido local;
- pagar comanda;
- transferir comanda;
- sincronizar mesas, comandas, pedidos e movimentos.

As respostas devem incluir identificadores internos para consistência e números amigáveis apenas para apresentação.

Eventos já usados no bootstrap/realtime devem atualizar:

- ocupação das mesas;
- número e total da comanda;
- itens e contagens;
- fechamento após pagamento;
- mesa atual após transferência.

## 8. Impressão e compatibilidade

### 8.1 Documento consolidado

Criar um documento específico para a pré-conta da comanda contendo:

- identificação do estabelecimento já disponível no sistema;
- título `COMANDA` ou `PRÉ-CONTA`;
- número da comanda;
- mesa atual;
- data e hora de abertura;
- data e hora de emissão;
- itens agrupados, quantidades, preços e observações;
- total;
- indicação de que não é comprovante de pagamento, quando compatível com o layout atual.

`Ver ticket` e `Imprimir comanda` devem consumir exatamente o mesmo documento.

### 8.2 Isolamento da impressão automática

A feature não deve alterar o ciclo de criação automática de trabalhos de impressão por pedido.

Para manter compatibilidade entre produção e staging:

- não modificar o schema de `print_jobs` para representar a pré-conta;
- não depender das migrações `0014` a `0019`;
- obter o documento consolidado por endpoint próprio;
- reutilizar somente as camadas de renderização e transporte físico já presentes na `master`;
- executar a impressão consolidada como ação manual de uma via;
- manter intactos os caminhos automáticos de pedido e segunda via.

Se for necessário extrair uma função comum de transporte para imprimir um documento manual, essa extração deve ser coberta por testes de regressão do comportamento existente.

### 8.3 Compatibilidade de ambientes

A implementação deve ser testada em dois estados de banco:

1. schema equivalente à produção, com migrações da `master` e a nova `0020`;
2. schema de staging, contendo `0014` a `0019` e a nova `0020`.

O deploy da branch da Feature 15 em staging substitui temporariamente o código do outro trabalho, mas não desfaz migrações já aplicadas. O código da Feature 15 deve tolerar as colunas e tabelas adicionais existentes em staging.

## 9. Separação entre áreas

### 9.1 Comandas

Responsável pela operação de mesas e comandas abertas:

- localizar mesa;
- iniciar pedido;
- consultar consumo;
- adicionar pedido;
- visualizar/imprimir pré-conta;
- receber a comanda.

### 9.2 A Receber

Deixa de listar entradas do tipo `table_tab` entre os pendentes. Continua responsável por pedidos de entrega/retirada e outros recebíveis atuais, sem mudanças não relacionadas.

### 9.3 Mesas

Continua responsável pelo cadastro, ativação, ordenação e transferência de comandas. O status ocupado permanece derivado do backend.

## 10. Concorrência e tratamento de erros

O backend deve garantir:

- no máximo uma comanda aberta por mesa;
- número de comanda único por estabelecimento;
- criação/reutilização atômica ao receber o primeiro pedido;
- pagamento idempotente ou conflito controlado;
- recusa de pedido para comanda fechada;
- validação de estabelecimento em todas as referências;
- preservação da mesma comanda durante transferência.

Comportamentos da UI:

- se outra sessão ocupar uma mesa enquanto o operador inicia o pedido, o backend reutiliza a comanda oficial quando válido e a tela informa o resultado atualizado;
- se a comanda for fechada antes de adicionar um pedido, a operação é recusada e a lista é atualizada;
- se a comanda for transferida, o detalhe passa a mostrar a mesa atual;
- sem conexão, dados carregados podem continuar visíveis, mas adicionar, pagar, visualizar ticket atualizado e imprimir ficam indisponíveis;
- falha de pré-visualização ou impressão mostra mensagem acionável sem modificar estado;
- falha no pagamento mantém a comanda aberta e permite nova tentativa segura.

## 11. Navegação e acessibilidade

- incluir `Comandas` na navegação desktop e mobile;
- manter o número de toques baixo para adicionar pedido e receber;
- fornecer rótulos textuais, foco de teclado e estados selecionados perceptíveis;
- manter contraste compatível com temas claro e escuro;
- anunciar carregamento, ausência de mesas e erros;
- impedir ações duplicadas enquanto uma requisição estiver em andamento;
- preservar a posição da lista ao voltar do detalhe no celular.

## 12. Estratégia de testes

Aplicar TDD para cada comportamento novo.

### 12.1 Migração e domínio

- backfill determinístico das comandas existentes;
- unicidade de `business_id + tab_number`;
- contador inicializado no maior número existente;
- concorrência na reserva de número;
- número preservado após transferência e fechamento;
- compatibilidade da `0020` nos dois estados de schema.

### 12.2 Backend e API

- listagem contém mesas ativas livres e ocupadas;
- resumo usa apenas a comanda aberta correta;
- detalhe impede acesso cruzado entre estabelecimentos;
- primeiro pedido abre comanda numerada;
- pedido posterior reutiliza o mesmo `table_tab_id`;
- comanda fechada não aceita pedido;
- agrupamento respeita produto, preço, complementos e observação;
- total vem da composição oficial;
- documento de ticket contém snapshot atual;
- pagamento integral fecha a comanda e libera a mesa;
- disputa concorrente não duplica comanda ou pagamento.

### 12.3 Interface

- navegação `Comandas` disponível em desktop e mobile;
- layout desktop lista + detalhe;
- layout mobile lista → detalhe → retorno preservado;
- mesa livre inicia pedido preselecionado;
- mesa ocupada abre detalhe;
- ações bloqueadas offline;
- estados de carregamento, vazio e erro;
- fechamento remove comanda e muda mesa para livre;
- transferência atualiza a mesa exibida;
- comandas não aparecem em `A Receber`.

### 12.4 Ticket e impressão

- itens iguais são agrupados;
- variações relevantes permanecem separadas;
- `Ver ticket` não imprime nem altera estado;
- prévia e impressão usam o mesmo documento;
- `Imprimir comanda` solicita uma via manual;
- falha permite tentar novamente;
- pedido novo continua criando sua impressão automática como antes;
- quantidade de vias e segunda via dos pedidos não mudam;
- testes dos transportes atuais permanecem verdes.

### 12.5 Verificação final

- suíte completa de testes;
- lint;
- build de produção;
- revisão do diff contra `origin/master` para confirmar isolamento;
- teste responsivo em larguras desktop e mobile;
- teste de migração nos dois schemas;
- homologação física da pré-conta e da impressão automática de pedido com a impressora real antes da produção.

## 13. Homologação em staging

Roteiro mínimo:

1. confirmar que todas as mesas ativas aparecem;
2. abrir uma mesa livre e lançar o primeiro pedido;
3. conferir número da comanda e status ocupado;
4. adicionar outro pedido pela própria comanda;
5. confirmar a impressão automática normal de cada pedido;
6. conferir agrupamento, observações e total no detalhe;
7. abrir `Ver ticket` e comparar com o conteúdo atual;
8. imprimir a pré-conta mais de uma vez e confirmar que a comanda permanece aberta;
9. transferir a comanda e confirmar que o número permanece e a mesa muda;
10. registrar o pagamento e confirmar fechamento, movimento financeiro e mesa livre;
11. confirmar que comandas abertas não aparecem em `A Receber`;
12. repetir os fluxos essenciais em celular;
13. validar fisicamente legibilidade, corte, acentos e largura do papel.

## 14. Fora de escopo

- pagamento parcial ou divisão da conta;
- impressão automática da comanda consolidada;
- fechamento provocado por impressão;
- fusão de comandas;
- transferência dentro da tela `Comandas`;
- edição de produtos ou pedidos já lançados pelo detalhe consolidado;
- mapa visual/planta do salão;
- reserva de mesa;
- auditoria nova de impressões consolidadas;
- adoção das mudanças da branch de segurança operacional de impressão;
- publicação direta em produção sem homologação e aprovação explícita.

## 15. Estratégia de entrega

- branch isolada `feature/issue-15-comandas`, criada de `origin/master` @ `8ddfd95`;
- implementação e testes apenas nessa branch/worktree;
- PR próprio para a Feature 15;
- deploy do commit exato da branch em staging;
- nenhuma promoção da branch de impressão anterior;
- homologação funcional, responsiva, financeira e física em staging;
- integração somente da Feature 15 à `master` após aprovação;
- deploy em produção a partir do commit aprovado da `master`;
- mudanças futuras de impressão deverão reconciliar conflitos explicitamente, sem merge implícito nesta entrega.
