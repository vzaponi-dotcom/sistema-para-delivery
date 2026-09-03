# Financeiro — Fluxo de Caixa: Design

**Data:** 2026-09-03  
**Status:** design aprovado em conversa; aguardando revisão da especificação escrita  
**Escopo:** evolução do módulo Financeiro existente para um fluxo de caixa confiável, simples de operar e preparado para crescimento futuro.

## 1. Contexto

O Financeiro atual registra movimentos em `movements`, soma entradas e saídas no cliente e recebe automaticamente pagamentos de pedidos como entradas. Estornos de pedidos também geram movimentos automáticos. O formulário manual, porém, usa a mesma lista de categorias para entrada e saída e oferece `Vendas`, o que permite duplicar receita que já é criada automaticamente pelo fluxo de pagamento.

Além disso, o módulo atual não possui período de análise, saldo inicial, meio de pagamento estruturado para movimentos manuais, data de movimento escolhida pelo usuário, edição ou exclusão de lançamentos manuais.

A evolução seguirá uma abordagem híbrida: o banco e a API representarão corretamente os dados e protegerão as regras de integridade; cálculos leves, filtros e apresentação continuam no cliente por enquanto. Regras financeiras reutilizáveis devem ficar em módulos de domínio/utilitários próprios, em vez de crescerem dentro de `App.jsx` ou de componentes visuais.

## 2. Objetivos

- Tratar o Financeiro como **fluxo de caixa realizado**, não como contas a pagar/receber futuras.
- Impedir duplicação manual de vendas e alterações indevidas em movimentos automáticos.
- Permitir lançamentos manuais úteis para fatos financeiros externos ao fluxo de pedidos.
- Oferecer visão por período, saldo atual desde uma data de abertura e filtros de histórico.
- Permitir correção segura de movimentos manuais por edição ou exclusão lógica.
- Manter atualização imediata no dispositivo que fez a alteração e sincronização automática nos demais dispositivos.
- Preservar compatibilidade com os movimentos já existentes.
- Deixar a estrutura preparada para, no futuro, receber fechamento de caixa, contas a pagar/receber e conciliação, sem implementar essas funções agora.

## 3. Fora de escopo

Não serão implementados nesta rodada:

- contas a pagar;
- contas a receber futuras;
- vencimentos e projeções financeiras;
- fechamento diário de caixa;
- conferência de valor esperado versus valor contado;
- conciliação bancária;
- múltiplas contas/saldos independentes por banco, Pix ou caixa físico;
- relatórios contábeis ou DRE.

## 4. Modelo conceitual

O módulo terá três conceitos separados.

### 4.1. Movimentos automáticos

São criados exclusivamente pelos fluxos operacionais do sistema.

Fontes atuais:

- `order-payment`: venda/pedido recebido;
- `order-refund`: estorno de pedido.

Regras:

- não podem ser editados pelo Financeiro;
- não podem ser excluídos pelo Financeiro;
- a proteção deve existir no backend, não apenas pela ausência de botões;
- mantêm vínculo com pedido e pagamento quando aplicável;
- podem oferecer a ação **Ver pedido**;
- continuam participando normalmente dos cálculos de caixa e filtros.

`Vendas` e `Estornos` são categorias automáticas e não aparecem no formulário de novo movimento manual.

### 4.2. Movimentos manuais

Representam fatos financeiros que não nasceram do fluxo de pedidos.

Campos editáveis:

- tipo: Entrada ou Saída;
- categoria;
- descrição;
- valor;
- data do movimento;
- forma/meio.

`created_at` representa quando o registro entrou de fato no sistema. `movement_date` representa a data financeira escolhida pelo usuário e é a data usada nos períodos e cálculos.

Movimentos manuais podem ser editados e excluídos. Exclusão é lógica, preservando rastreabilidade interna.

### 4.3. Configuração de abertura do caixa

Saldo inicial não é uma entrada operacional e não deve ser armazenado como movimento.

O Financeiro terá uma configuração própria por negócio contendo:

- saldo inicial;
- data de abertura;
- data de criação;
- data da última alteração.

O saldo inicial representa o valor disponível **no início da data de abertura**, antes dos movimentos daquele dia. Portanto, movimentos com `movement_date >= opening_date` entram no saldo atual; movimentos anteriores permanecem no histórico, mas não alteram esse saldo.

Saldo inicial pode ser positivo, zero ou negativo.

## 5. Categorias

Novos movimentos usarão identificadores internos estáveis, com rótulos de interface separados. Valores legados continuam aceitos para leitura e serão normalizados pelo domínio sem reescrever artificialmente o histórico.

### 5.1. Entrada manual

| Código interno | Rótulo |
| --- | --- |
| `contribution` | Aporte |
| `other_income` | Outros recebimentos |

### 5.2. Saída manual

| Código interno | Rótulo |
| --- | --- |
| `supplies` | Insumos |
| `packaging` | Embalagens |
| `delivery_costs` | Delivery / Frete |
| `gas` | Gás |
| `water` | Água |
| `electricity` | Energia |
| `rent` | Aluguel |
| `maintenance` | Manutenção |
| `fees` | Taxas |
| `owner_draw` | Retirada |
| `other_expense` | Outros |

### 5.3. Automáticas

| Código normalizado | Rótulo |
| --- | --- |
| `sales` | Vendas |
| `refunds` | Estornos |

O domínio deve reconhecer também os valores legados (`Vendas`, `Estornos` e categorias manuais antigas) para exibição e filtros.

Ao trocar o tipo no formulário manual, uma categoria que não seja válida para o novo tipo deve ser limpa e o usuário precisa selecionar outra.

## 6. Formas / meios

Novos movimentos manuais usam as mesmas opções já reconhecidas pelo sistema para pagamentos:

- Dinheiro;
- Pix;
- Cartão de débito;
- Cartão de crédito;
- Transferência;
- Outro.

A tela mantém um único saldo geral; não haverá saldo independente por meio nesta etapa.

Para vendas automáticas, o meio vem do pagamento do pedido. Para novos estornos automáticos, o meio armazenado deve ser o **meio efetivamente escolhido no registro do estorno**, que pode ser diferente do meio de pagamento original.

Movimentos antigos que não tenham um meio estruturado exibem `Não informado`. Vendas automáticas antigas podem ser enriquecidas a partir do pagamento relacionado quando isso for seguro; estornos antigos não devem inferir um meio diferente do que foi realmente usado apenas a partir do pagamento original.

## 7. Períodos e filtros

### 7.1. Período principal

O Financeiro abre por padrão em **Hoje**.

Atalhos:

- Hoje;
- 7 dias;
- 30 dias;
- Personalizado.

Definições:

- Hoje: data atual;
- 7 dias: hoje e os 6 dias anteriores;
- 30 dias: hoje e os 29 dias anteriores;
- Personalizado: data inicial e final inclusivas.

As datas financeiras usam o fuso `America/Sao_Paulo`.

O período principal controla:

- Entradas;
- Saídas;
- Resultado;
- lista de movimentações.

O período **não** altera o Saldo atual.

### 7.2. Filtros secundários

O histórico terá:

- busca textual;
- tipo: Todos / Entradas / Saídas;
- categoria;
- forma/meio.

Esses filtros são combináveis e afetam somente a lista de movimentações, não os cards de resumo. A busca procura ao menos por descrição e, quando disponível, referência do pedido/cliente já presente nos dados do movimento.

Estornos pendentes são uma pendência operacional e não são escondidos pelo período nem pelos filtros do histórico.

## 8. Resumo financeiro

O topo terá quatro indicadores.

### Entradas

Soma das entradas ativas no período selecionado.

### Saídas

Soma das saídas ativas no período selecionado.

### Resultado

`Entradas do período - Saídas do período`.

Esse indicador representa movimentação líquida do período, não lucro contábil.

### Saldo atual

`Saldo inicial + Entradas desde a abertura - Saídas desde a abertura`.

Somente movimentos ativos com `movement_date >= opening_date` entram nesse cálculo.

Se o saldo inicial ainda não estiver configurado, o card mostra um estado de configuração em vez de um valor enganoso.

## 9. Organização da tela

### 9.1. Cabeçalho

- título `Fluxo de caixa`;
- seletor de período;
- ação `+ Novo movimento`.

### 9.2. Cards

Quatro cards:

1. Entradas;
2. Saídas;
3. Resultado;
4. Saldo atual.

No mobile, os quatro indicadores devem usar grade 2 × 2, evitando quatro cards grandes empilhados.

### 9.3. Estornos pendentes

O bloco de estornos pendentes permanece antes do histórico e continua oferecendo `Registrar estorno`.

### 9.4. Histórico

A área de movimentações exibe:

- quantidade de registros no período;
- busca;
- filtros compactos;
- lista de movimentos.

Em telas pequenas, filtros detalhados podem abrir em um bottom sheet/modal para não ocupar espaço permanente.

Cada registro deve destacar:

- descrição;
- categoria;
- forma/meio;
- data do movimento;
- valor assinado;
- origem automática quando aplicável.

Movimento manual: menu com `Editar` e `Excluir`.

Movimento automático: sem edição/exclusão; quando houver pedido relacionado, ação `Ver pedido`.

## 10. Fluxos de interação

### 10.1. Novo movimento

`Novo movimento → preencher → Revisar movimento → confirmação → salvar`.

O formulário contém:

- tipo;
- categoria dependente do tipo;
- descrição;
- valor com máscara em Real brasileiro;
- data do movimento preenchida com hoje por padrão;
- forma/meio.

A data pode ser retroativa, mas não futura.

### 10.2. Editar movimento manual

`Editar → alterar → Revisar alterações → confirmação → salvar`.

Todos os campos manuais podem ser corrigidos, respeitando as mesmas validações de criação.

### 10.3. Excluir movimento manual

`Excluir → confirmação destrutiva → exclusão lógica → feedback`.

A confirmação deve mostrar descrição, valor e data para reduzir exclusões acidentais.

### 10.4. Saldo inicial

Primeira configuração:

`Configurar saldo inicial → informar valor/data → revisar → confirmar → salvar`.

Alteração posterior:

`Editar saldo inicial → revisar valor/data atuais e novos → confirmação forte → salvar`.

A confirmação deve alertar que a alteração recalcula o saldo atual. Quando possível, deve mostrar o saldo atual antes e o saldo projetado depois da mudança.

O valor usa formatação em Real e aceita valores negativos, por exemplo `-R$ 100,00`.

## 11. Persistência

### 11.1. Evolução de `movements`

A tabela deve ganhar campos equivalentes a:

- `payment_method TEXT` — meio estruturado;
- `updated_at TEXT` — última alteração;
- `deleted_at TEXT` — exclusão lógica.

Campos existentes continuam válidos:

- `type`;
- `category`;
- `description`;
- `value_cents`;
- `source`;
- `order_id`;
- `payment_id`;
- `movement_date`;
- `created_at`.

Consultas normais de movimentos ativos devem excluir `deleted_at IS NOT NULL`.

### 11.2. Configuração financeira

Criar uma tabela singleton por negócio, por exemplo `finance_settings`, contendo:

- `business_id` como chave/foreign key;
- `opening_balance_cents`;
- `opening_date`;
- `created_at`;
- `updated_at`.

Ausência da linha significa saldo inicial ainda não configurado.

## 12. API e proteção de domínio

### Movimentos

- `POST /api/movements` — cria movimento manual;
- `PATCH /api/movements/:id` — edita movimento manual;
- `DELETE /api/movements/:id` — executa exclusão lógica de movimento manual.

PATCH e DELETE devem consultar o registro e rejeitar qualquer movimento cujo `source !== 'manual'`, mesmo que uma chamada seja feita diretamente fora da interface.

Criação e edição validam categoria conforme tipo e rejeitam códigos automáticos como categoria manual.

### Configuração financeira

- `PUT /api/finance-settings` — cria ou substitui a configuração de abertura do negócio.

A resposta devolve o estado oficial persistido.

### Bootstrap/sincronização

O bootstrap deve incluir:

- somente movimentos ativos;
- `financeSettings`, quando configurado.

Os fluxos de sincronização devem reconciliar a coleção de movimentos de forma autoritativa para que uma exclusão feita em outro dispositivo desapareça sem F5. Alterações de `financeSettings` também precisam chegar pelo mesmo mecanismo de sincronização global.

## 13. Validações

Backend e frontend devem aplicar regras consistentes, com o backend como autoridade final.

Movimentos manuais:

- valor maior que zero;
- data válida;
- data não futura no fuso da operação;
- tipo válido;
- categoria válida para o tipo;
- descrição não vazia;
- forma/meio válida;
- `source` sempre definido pelo servidor como `manual`.

Saldo inicial:

- valor monetário válido, podendo ser positivo, zero ou negativo;
- data de abertura válida;
- data de abertura não futura.

Movimentos automáticos:

- não editáveis;
- não excluíveis pelo endpoint de movimentos.

## 14. Atualização imediata e concorrência

Persistências seguem o padrão já adotado no projeto:

- a resposta de escrita devolve o estado oficial;
- o dispositivo que executou a ação atualiza o estado local imediatamente, sem recarregar a página;
- outros dispositivos recebem a alteração pelo sincronismo automático;
- respostas antigas de leitura não podem sobrescrever uma escrita mais nova.

Para exclusão lógica, o dispositivo autor remove o movimento ativo assim que recebe a confirmação oficial; dispositivos remotos o removem na próxima reconciliação autoritativa.

## 15. Erros e feedback

- falha de validação mantém o formulário aberto e mostra mensagem específica;
- falha de persistência não aplica atualização otimista definitiva;
- tentativa de editar/excluir movimento automático retorna erro de domínio claro;
- conflito por movimento inexistente/excluído retorna estado coerente e não duplica lançamentos;
- sucesso de criação, edição, exclusão e alteração do saldo inicial usa o padrão de feedback visual centralizado já adotado no sistema.

## 16. Compatibilidade e migração

A migração deve ser aditiva e preservar todos os movimentos existentes.

- nenhum movimento antigo será apagado ou reescrito apenas para adequar rótulos;
- `deleted_at` inicia nulo;
- `updated_at` pode ser inicializado a partir de `created_at` para registros antigos;
- movimentos sem meio estruturado exibem `Não informado`;
- vendas automáticas antigas podem obter meio a partir do `payment_id` relacionado quando seguro;
- estornos antigos sem meio estruturado permanecem `Não informado`, porque o meio real do estorno pode ter sido diferente do pagamento original;
- categorias legadas continuam reconhecidas pela camada de normalização;
- movimentos anteriores à data de abertura continuam pesquisáveis, mas não entram no Saldo atual.

Nenhuma migração remota será executada fora do fluxo de deploy aprovado do projeto.

## 17. Testes obrigatórios

A implementação seguirá TDD estrito, com teste RED antes de cada alteração relevante.

Cobertura mínima:

### Domínio/cálculos

- Hoje, 7 dias, 30 dias e período personalizado inclusivo;
- cálculo de Entradas, Saídas e Resultado;
- cálculo do Saldo atual;
- movimento na própria data de abertura incluído no saldo;
- movimento anterior à abertura excluído do saldo atual;
- movimento excluído logicamente fora de todos os cálculos ativos;
- filtros secundários sem alterar cards;
- normalização de categorias legadas.

### Backend

- criação manual com data, meio e categoria válida;
- rejeição de valor zero/negativo;
- rejeição de data futura;
- rejeição de categoria incompatível com tipo;
- edição de movimento manual;
- exclusão lógica de movimento manual;
- bloqueio de PATCH/DELETE para `order-payment`;
- bloqueio de PATCH/DELETE para `order-refund`;
- criação/alteração de configuração de abertura;
- saldo inicial negativo permitido;
- bootstrap sem movimentos excluídos;
- bootstrap incluindo configuração financeira;
- compatibilidade com movimentos legados.

### Frontend

- máscara BRL de valor manual;
- categorias mudam conforme tipo;
- mudança de tipo limpa categoria incompatível;
- data padrão Hoje;
- revisão antes de criar/editar;
- confirmação destrutiva antes de excluir;
- confirmação forte ao alterar saldo inicial;
- atualização imediata após respostas oficiais;
- sincronização de exclusão/edição por reconciliação;
- estornos pendentes independentes do período;
- movimentos automáticos sem ações de edição/exclusão;
- regressão mobile com cards 2 × 2 e filtros utilizáveis entre 320 e 480 px.

## 18. Critérios de aceite

A funcionalidade está concluída quando:

1. o usuário não consegue criar `Vendas` manualmente;
2. categorias de entrada e saída são distintas e validadas;
3. todo novo movimento manual registra valor, data e forma/meio estruturados;
4. movimentos manuais podem ser editados e excluídos com confirmação;
5. movimentos automáticos não podem ser editados/excluídos nem pela API;
6. a tela abre em Hoje e permite 7 dias, 30 dias e período personalizado;
7. período altera Entradas, Saídas, Resultado e histórico, mas não Saldo atual;
8. filtros secundários alteram somente a lista;
9. saldo inicial/data de abertura podem ser configurados e alterados com confirmação forte;
10. Saldo atual inclui somente movimentos ativos desde o início da data de abertura;
11. movimentos antigos continuam acessíveis sem perda de dados;
12. estornos pendentes continuam visíveis independentemente do filtro de período;
13. toda escrita reflete imediatamente no dispositivo autor;
14. outros dispositivos convergem automaticamente sem F5;
15. a interface mobile permanece legível e operável;
16. toda a suíte de testes, lint, build e dry-run do Worker permanece verde antes de qualquer deploy.
