# Comandas por mesa e feedback visual de seleção

Data: 2026-09-02
Status: auto-revisado; aguardando aprovação deste arquivo antes do plano de implementação
Branch: `feature/table-tabs-round`

## 1. Contexto

A rodada anterior introduziu identificação flexível para `Consumo no local`: Nome, Mesa e Cliente cadastrado. Por segurança, pedidos por Nome e Mesa passaram a ser independentes em `A Receber`, evitando agrupar cobranças apenas por texto.

O teste em produção mostrou um caso operacional legítimo: uma mesma mesa pode fazer vários pedidos durante o mesmo atendimento e esses pedidos precisam aparecer como uma única comanda no momento da cobrança. Agrupar apenas pelo texto `Mesa 04` não é seguro, porque a mesa pode ser reutilizada por outro atendimento depois que a conta anterior for encerrada.

A mesma validação em produção também mostrou que os controles visuais do cadastro de produto já possuem estado lógico selecionado, mas o contraste atual não deixa esse estado evidente o suficiente.

Esta rodada resolve somente esses dois pontos:

1. criar uma comanda persistente e limitada ao ciclo de atendimento de uma mesa;
2. tornar visualmente inequívoco o estado selecionado de Categoria, Apresentação, Tamanho e Unidade no formulário de produto.

## 2. Objetivos

### 2.1 Comanda por mesa

- Uma mesa pode ter no máximo uma comanda ativa por empresa.
- O primeiro pedido de uma mesa sem comanda ativa abre uma nova comanda.
- Novos pedidos para a mesma mesa entram automaticamente na comanda ativa, sem perguntar ao operador.
- `A Receber` mostra uma única cobrança para a comanda, com quantidade de pedidos e saldo total.
- O operador pode abrir a comanda e continuar vendo cada pedido individual que a compõe.
- O pagamento disponível nesta versão quita todo o saldo restante da comanda em uma única ação.
- Quando todos os pedidos da comanda estiverem pagos, a comanda é encerrada.
- O próximo pedido para a mesma mesa cria uma nova comanda, sem se misturar ao atendimento anterior.

### 2.2 Feedback visual de seleção

- Categoria, Apresentação, Tamanho e Unidade devem mostrar um estado selecionado evidente imediatamente após clique/toque.
- A indicação não pode depender apenas de uma mudança sutil de cor.
- O comportamento deve ser consistente no desktop e mobile e manter os `aria-pressed` existentes.

## 3. Fora de escopo

Esta versão não cria um módulo completo de salão. Ficam explicitamente fora:

- pagamento parcial de comanda;
- divisão de conta;
- pagamento de um pedido individual dentro de uma comanda ativa pela UI;
- transferência de mesa;
- juntar ou separar comandas;
- duas comandas simultâneas para a mesma mesa;
- mapa/layout de mesas;
- reserva, ocupação ou disponibilidade de mesas;
- abertura manual de uma segunda comanda para a mesma mesa;
- transformar Nome ou Cliente cadastrado em comanda;
- alterar preços, cálculo do pedido ou regras do Financeiro além do necessário para registrar o pagamento conjunto.

## 4. Alternativas consideradas

### A. Agrupar `A Receber` apenas pelo texto da mesa

Exemplo: todo pedido cujo snapshot seja `Mesa 04` seria agrupado.

Vantagem: implementação pequena.

Problema: pedidos de atendimentos diferentes podem ser misturados se a Mesa 04 for reutilizada enquanto existir uma pendência antiga. O texto da mesa não identifica uma sessão de consumo.

**Rejeitada.**

### B. Criar uma sessão/comanda persistente por mesa

Cada atendimento recebe um identificador de comanda próprio. Os pedidos mantêm seus IDs individuais e apontam para essa comanda.

Vantagens:

- separa corretamente atendimentos sucessivos da mesma mesa;
- preserva histórico dos pedidos;
- permite cobrança consolidada sem remodelar o pedido;
- cria uma base pequena e segura para futuras evoluções de salão sem implementá-las agora.

**Escolhida.**

### C. Criar módulo completo de salão

Incluiria cadastro visual de mesas, estados de ocupação, transferência, divisão e união de contas.

Vantagem: solução completa.

Problema: amplia muito o escopo e adiciona regras que ainda não foram solicitadas.

**Rejeitada nesta rodada.**

## 5. Modelo de dados da comanda

Será adicionada uma entidade persistente de comanda de mesa. Nome técnico recomendado: `table_tabs`.

Campos mínimos:

- `id TEXT PRIMARY KEY`
- `business_id TEXT NOT NULL`
- `table_identifier TEXT NOT NULL`
- `status TEXT NOT NULL` com valores `open` ou `closed`
- `opened_at TEXT NOT NULL`
- `closed_at TEXT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

A tabela pertence à empresa e deve referenciar `businesses(id)` conforme o padrão atual.

### 5.1 Uma comanda ativa por mesa

Deve existir uma restrição de banco que impeça mais de uma comanda `open` para o mesmo par `(business_id, table_identifier)`.

Em D1/SQLite, a solução recomendada é um índice único parcial para registros com `status = 'open'`.

A regra não deve depender somente da UI.

### 5.2 Vínculo do pedido

Adicionar em `orders`:

- `table_tab_id TEXT NULL`

Somente pedidos com `customer_identity_type = 'table'` criados pelo novo fluxo recebem esse vínculo.

O campo existente `client_name_snapshot` continua sendo o rótulo congelado do pedido, por exemplo `Mesa 04`. O campo `customer_identity_type` continua sendo `table`. Nenhum desses campos é substituído pela comanda.

### 5.3 Compatibilidade com histórico

A migration é aditiva e não remove nem reescreve pedidos existentes.

Pedidos antigos de mesa que não possuem `table_tab_id` permanecem independentes em `A Receber`. Não será feito agrupamento automático de histórico apenas pelo texto da mesa, pois não há informação suficiente para provar que pertencem ao mesmo atendimento.

Isso evita unir cobranças antigas incorretamente.

## 6. Identificador da mesa

As regras de validação aprovadas na rodada anterior permanecem:

- 1 a 12 caracteres;
- segmentos alfanuméricos com hífen opcional;
- sem espaços;
- regex `^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$`.

Para localizar a comanda ativa, o servidor deve usar uma forma canônica do identificador:

- remover espaços externos;
- converter letras para maiúsculas;
- não remover zeros à esquerda;
- não converter `04` em `4`.

Assim `a-01` e `A-01` encontram a mesma comanda, mas `04` e `4` continuam sendo identificadores distintos.

A exibição permanece `Mesa <identificador>`.

## 7. Ciclo de vida da comanda

### 7.1 Abrir

Ao receber checkout com:

```js
customerIdentity: { type: 'table', value: '04' }
```

o Worker deve:

1. validar e normalizar o identificador;
2. procurar uma comanda `open` da empresa para essa mesa;
3. se existir, reutilizá-la;
4. se não existir, criar uma nova;
5. gravar o pedido com `table_tab_id` correspondente.

A criação deve ser protegida pela restrição única de banco. Duas requisições concorrentes não podem criar duas comandas abertas para a mesma mesa.

A implementação pode usar uma operação `getOrCreateOpenTableTab` com tratamento de conflito/`INSERT OR IGNORE` seguido de leitura da comanda aberta.

### 7.2 Adicionar pedidos

Todo novo checkout de Mesa 04 enquanto houver comanda aberta entra automaticamente nessa comanda.

Não há prompt de confirmação nesta versão. A velocidade operacional é parte do objetivo.

Cada pedido continua sendo um pedido completo e independente para cozinha, histórico, itens, preço, status e idempotência.

### 7.3 Encerrar

A comanda é encerrada quando não houver saldo pendente em nenhum pedido associado a ela.

O fluxo principal desta versão é o pagamento consolidado em `A Receber`, que paga todos os pedidos ainda pendentes e encerra a comanda na mesma operação lógica.

Como proteção de consistência, qualquer outro fluxo servidor que resulte no último pedido pendente da comanda ficando pago deve também permitir que a comanda seja marcada como `closed`.

Se todos os pedidos de uma comanda forem removidos, ela não deve permanecer aberta indefinidamente; o repositório deve encerrar a comanda quando não restar nenhum pedido associado.

## 8. Checkout e backend

### 8.1 Regras preservadas

Nada muda para:

- Entrega;
- Retirada;
- Consumo local por Nome;
- Consumo local por Cliente cadastrado.

O servidor continua sendo autoridade de preço, snapshots, idempotência e escopo por empresa.

### 8.2 Mesa

Para `customerIdentity.type = 'table'`, além da validação atual o checkout resolve a comanda e persiste `table_tab_id`.

O frontend não envia um ID de comanda autoritativo. A associação é resolvida pelo Worker a partir da empresa autenticada e do identificador da mesa. Isso impede que um cliente escolha uma comanda de outra empresa ou force associação incorreta.

### 8.3 Bootstrap/API

Os pedidos devem expor:

- `tableTabId`

O bootstrap deve retornar também uma coleção explícita `tableTabs`, separada dos pedidos, para representar o ciclo de vida das comandas.

Formato mínimo:

```js
{
  id,
  tableIdentifier,
  status,
  openedAt,
  closedAt
}
```

Somente comandas da empresa autenticada podem ser retornadas. A UI usa `tableTabs` para contexto e apresentação; a resolução autoritativa de associação de um novo pedido continua ocorrendo no Worker.

## 9. A Receber

A regra atual de agrupamento evolui para:

- Cliente cadastrado: continua agrupado por `client_id`;
- Nome avulso: continua independente por pedido;
- Mesa com `table_tab_id`: agrupa por `table_tab_id`;
- Mesa legada sem `table_tab_id`: continua independente por pedido.

### 9.1 Card da comanda

Uma comanda deve aparecer como uma única unidade de cobrança, por exemplo:

**Mesa 04**  
`3 pedidos na comanda`  
`Total a receber R$ 86,00`

A lista interna continua mostrando os pedidos individualmente, incluindo:

- número do pedido;
- data;
- resumo de produtos;
- valor do pedido;
- acesso a `Ver detalhes`.

### 9.2 Pagamento

Para grupos de mesa com comanda ativa, a ação principal deve ser única no nível da comanda:

- `Registrar pagamento da comanda`

Não devem ser apresentados botões de pagamento individual em cada pedido dessa comanda na UI desta versão.

Ao abrir o modal, mostrar:

- `Mesa 04`;
- quantidade de pedidos pendentes;
- saldo total da comanda;
- forma de pagamento;
- aviso de que todos os pedidos pendentes serão quitados juntos.

### 9.3 Operação de pagamento consolidado

Criar uma operação servidor específica para pagamento da comanda, por exemplo:

`POST /api/table-tabs/:id/payment`

Payload:

```js
{ paymentMethod: 'Pix' }
```

O servidor deve:

1. validar sessão e empresa;
2. localizar a comanda aberta da mesma empresa;
3. carregar todos os pedidos ainda não pagos da comanda;
4. calcular o saldo a partir dos valores oficiais persistidos;
5. registrar pagamento para todos os pedidos pendentes;
6. criar as movimentações financeiras correspondentes usando o modelo já existente por pedido;
7. marcar a comanda como `closed`;
8. executar as escritas como uma única operação atômica/batch dentro do padrão atual do repositório;
9. retornar os pedidos atualizados, movimentos criados e a comanda atualizada.

### 9.4 Preservação do Financeiro

Para não remodelar relatórios e histórico nesta rodada, cada pedido continua possuindo seu próprio registro de pagamento e sua própria movimentação financeira automática, mesmo que o operador tenha realizado uma única ação de cobrança da comanda.

Isso preserva:

- total recebido hoje;
- rastreabilidade por pedido;
- idempotência/duplicidade de pagamento existente;
- remoção e histórico financeiros atuais.

A UI apresenta uma cobrança, mas o backend mantém a granularidade atual de cada pedido.

### 9.5 Retentativa e estados incomuns

O endpoint deve ser seguro para retentativa:

- pedidos já pagos não recebem segundo pagamento;
- se parte dos pedidos já estiver paga por um fluxo legado, a ação quita apenas o saldo restante e encerra a comanda quando todos estiverem pagos;
- uma comanda já fechada não pode gerar novas cobranças duplicadas;
- uma comanda de outra empresa retorna 404/erro de escopo equivalente ao padrão atual.

## 10. Novo Pedido

A interface de Novo Pedido continua exatamente como aprovada para Mesa:

- operador seleciona `Consumo no local`;
- escolhe `Mesa`;
- digita o identificador;
- adiciona os itens;
- salva o pedido.

Quando a mesa já possuir uma comanda ativa presente em `tableTabs`, a UI deve mostrar uma mensagem discreta como:

`Mesa 04 · comanda aberta · 2 pedidos`

Isso dá contexto ao operador sem adicionar confirmação extra.

Se `tableTabs` estiver temporariamente indisponível na UI, o checkout ainda pode funcionar porque a resolução autoritativa ocorre no Worker.

## 11. Feedback visual de seleção no produto

O `ProductForm` já aplica classes `.selected` e `aria-pressed`, mas o tratamento atual com `brand-soft` é pouco perceptível em alguns temas/telas.

### 11.1 Controles afetados

- Categoria;
- Apresentação;
- Tamanho;
- Unidade de Volume/Peso.

### 11.2 Estado selecionado obrigatório

A opção ativa deve combinar pelo menos três sinais:

1. fundo preenchido ou claramente mais forte que o estado neutro;
2. borda/contorno de destaque com contraste suficiente;
3. indicador gráfico de seleção, preferencialmente um pequeno ícone de check.

O texto e o ícone da opção precisam manter contraste legível em Claro, Escuro e Automático.

O estado não deve depender apenas de cor. `aria-pressed` permanece como semântica de acessibilidade.

### 11.3 Comportamento

- mudança visual imediata ao clicar/tocar;
- apenas uma opção selecionada por grupo;
- seleção continua visível enquanto o valor estiver ativo;
- foco de teclado continua distinguível do estado selecionado;
- `disabled` continua visualmente distinto;
- alvos mínimos de toque atuais são preservados.

## 12. Migrations

A próxima migration prevista é `0007_table_tabs.sql`.

Ela deve ser aditiva e incluir:

- criação de `table_tabs`;
- índices de consulta por empresa/status/mesa;
- unicidade de uma comanda aberta por mesa;
- coluna `orders.table_tab_id`;
- índices necessários para buscar pedidos por comanda.

Não haverá backfill automático de comandas para pedidos históricos.

A migration deve ser testada localmente e aplicada pelo workflow de produção antes do Worker, seguindo o mecanismo já existente.

## 13. Componentes e responsabilidades

### `shared/`

Adicionar helper pequeno para normalização/validação de identificador de mesa se isso evitar duplicação entre checkout, repositório e testes.

### `worker/repositories.js`

Responsabilidades esperadas:

- criar/buscar comanda aberta;
- associar pedido à comanda;
- mapear comanda para API;
- cobrar comanda inteira;
- encerrar comanda quando apropriado.

Se o arquivo ficar excessivamente grande durante a implementação, é aceitável extrair um `worker/tableTabsRepository.js`; essa extração deve ser limitada a esta funcionalidade.

### `worker/index.js`

- rota de pagamento da comanda;
- autenticação/origin/validação conforme padrões atuais;
- bootstrap inclui `tableTabs`.

### `src/utils/receivables.js`

- agrupamento por `tableTabId` para mesas novas;
- preservação das regras atuais para clientes, nomes avulsos e mesas legadas.

### `src/pages/Receivables.jsx`

- card consolidado da comanda;
- ação de pagamento no nível do grupo;
- detalhamento dos pedidos internos.

### `src/App.jsx`

- estado/modal de pagamento deve aceitar tanto pagamento individual legado quanto pagamento de comanda, ou ser extraído para um pequeno fluxo compartilhado se isso simplificar a responsabilidade;
- atualização local de múltiplos pedidos, movimentos e `tableTabs` após pagamento de comanda.

### `src/components/ProductForm.jsx` e `src/product-form.css`

- indicador visual forte e acessível de seleção;
- nenhuma mudança nas regras de categoria/apresentação já aprovadas.

## 14. Erros e consistência

- Falha ao criar/reusar comanda não pode gravar pedido parcialmente.
- Falha no pagamento consolidado não pode deixar somente parte da comanda paga por causa daquela requisição.
- Erros da API não devem apagar dados do formulário/modal.
- Estado offline/write-disabled atual deve continuar sendo respeitado.
- O Worker nunca aceita `tableTabId` do frontend como autoridade para associar um novo pedido.
- A restrição de uma comanda aberta por mesa é garantida no banco e no repositório.

## 15. Testes / TDD

A implementação deve seguir RED → GREEN → REFACTOR.

Cobertura mínima:

### Comanda e migration

- migration cria tabela e coluna sem apagar dados;
- índice impede duas comandas abertas para a mesma empresa/mesa;
- empresas diferentes podem ter a mesma mesa aberta;
- pedidos legados sem `table_tab_id` continuam legíveis.

### Normalização de mesa

- `a-01` e `A-01` resolvem a mesma comanda;
- `04` não é convertido para `4`;
- identificadores inválidos continuam rejeitados.

### Checkout

- primeiro pedido da Mesa 04 cria comanda;
- segundo pedido da Mesa 04 reutiliza a mesma comanda;
- depois de fechada, novo pedido da Mesa 04 cria outra comanda;
- Nome/cliente cadastrado/Entrega/Retirada não recebem `table_tab_id`;
- concorrência não produz duas comandas abertas;
- idempotência do pedido continua funcionando.

### Bootstrap/API

- bootstrap retorna `tableTabs` somente da empresa autenticada;
- pedidos expõem `tableTabId`;
- UI consegue relacionar pedido e comanda sem usar o vínculo como autoridade de checkout.

### A Receber

- pedidos da mesma `tableTabId` formam um grupo;
- duas comandas históricas da mesma Mesa 04 não se misturam;
- mesa legada sem tab continua por pedido;
- nomes avulsos repetidos continuam separados;
- cliente cadastrado continua agrupado por cliente;
- total da comanda soma apenas saldos pendentes;
- botão de pagamento individual não aparece para pedidos dentro da comanda ativa.

### Pagamento de comanda

- quita todos os pedidos pendentes;
- cria um pagamento/movimento por pedido conforme modelo atual;
- fecha a comanda;
- retentativa não duplica pagamentos/movimentos;
- comanda parcialmente paga quita somente o restante;
- falha no batch não deixa estado parcial;
- comanda de outra empresa não pode ser paga.

### Feedback visual do produto

- controles continuam expondo `aria-pressed`;
- opção selecionada recebe classe/indicador de seleção;
- check/indicador aparece somente na opção ativa de cada grupo;
- estilos selecionados têm tratamento distinto do neutro em desktop/mobile;
- foco e disabled continuam separados do estado selecionado.

### Regressão

- suíte completa;
- lint;
- build;
- Wrangler deploy `--dry-run`;
- migrations D1 locais;
- workflow de produção aplica migration antes do Worker.

## 16. Critérios de aceite

A rodada está pronta quando:

1. Mesa 04 sem comanda aberta cria uma comanda no primeiro pedido.
2. Pedidos seguintes da Mesa 04 entram automaticamente na mesma comanda enquanto ela estiver aberta.
3. `A Receber` mostra essa comanda uma única vez com quantidade de pedidos e total consolidado.
4. Cada pedido continua visível dentro da comanda e mantém seu histórico próprio.
5. O pagamento da comanda quita todo o saldo restante em uma única ação da UI.
6. O backend mantém pagamentos/movimentos por pedido e fecha a comanda sem duplicidades.
7. Depois do encerramento, um novo pedido da Mesa 04 abre uma nova comanda e não se mistura com a anterior.
8. Pedidos antigos de mesa sem vínculo de comanda não são agrupados por texto.
9. Nome avulso e Cliente cadastrado mantêm o comportamento da rodada anterior.
10. Categoria, Apresentação, Tamanho e Unidade exibem estado selecionado forte, imediato e acessível em desktop e mobile.
11. Nenhum dado existente é apagado pela migration.
12. Testes, lint, build, Worker dry-run e migration local ficam verdes antes de integração/deploy.
