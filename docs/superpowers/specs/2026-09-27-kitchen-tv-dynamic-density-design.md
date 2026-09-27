# Kitchen TV — densidade dinâmica e maior aproveitamento da tela

**Data:** 2026-09-27  
**Branch:** `feature/kitchen-tv-dynamic-density`  
**Base:** `master@f624f0c74e0c82965e9d024b7a2ac0ee506ec7ff`  
**Status:** direção aprovada na conversa; esta Spec formaliza o comportamento antes da implementação.  
**Produção:** proibida até homologação e autorização explícita.  
**Referência visual:** Mesiva — Guia oficial de identidade visual e aplicação no produto, v1.0. A Kitchen TV é uma superfície operacional escura; densidade útil, leitura rápida e estados claros têm prioridade sobre ornamentação.

## 1. Problema

A Kitchen TV já possui layout adaptativo para conteúdo grande, mas a capacidade visual continua presa a um grid fixo de **3 colunas × 2 linhas**, com no máximo **6 slots**.

Isso gera duas limitações:

1. quando há muitos pedidos curtos, como pedidos com uma única marmita, cada card continua ocupando uma célula grande;
2. mesmo em telas 1080p ou janelas altas, a TV não aproveita o espaço adicional para mostrar mais pedidos simultaneamente.

O resultado é operacionalmente ruim em picos: pedidos simples ficam fora da tela apesar de haver espaço suficiente para uma grade mais densa.

## 2. Objetivo

Permitir que a Kitchen TV adapte a **densidade do board** de acordo com:

- quantidade de pedidos na fila;
- largura e altura úteis do viewport;
- complexidade real do conteúdo de cada pedido.

A meta principal é:

> em uma tela semelhante à referência enviada pelo usuário, aproximadamente 1640 × 924 px, exibir **até 10–12 pedidos curtos simultaneamente** sem prejudicar a leitura.

O ganho de densidade não pode ocorrer à custa de clipping silencioso, scroll interno ou redução excessiva de fonte.

## 3. Estado atual a preservar

A implementação atual já possui:

- entrada independente da Kitchen TV;
- polling próprio;
- pareamento/autorização;
- alerta sonoro;
- estados NOVO / ATRASADO / PRÓXIMO DO LIMITE / EM PREPARO / AGENDADO;
- classificação de conteúdo comfortable / compact / dense;
- promoção de pedidos grandes para card tall de duas linhas;
- regra de proteção do primeiro agendado;
- contador de overflow;
- adaptação por altura de viewport;
- ação segura de recuperação de fullscreen.

Esses contratos permanecem.

## 4. Nova ideia central: perfis de board

A Kitchen TV deixa de ter apenas um grid fixo e passa a escolher um dos perfis abaixo.

### 4.1 Perfil amplo — `focus`

Uso esperado:

- fila pequena;
- até 6 pedidos;
- ou viewport que não comporte uma grade mais densa com boa leitura.

Grid:

- **3 colunas × 2 linhas**
- capacidade base: **6 células**

Objetivo: manter a leitura grande e confortável quando não existe pressão por espaço.

### 4.2 Perfil intermediário — `balanced`

Uso esperado:

- aproximadamente 7–8 pedidos;
- viewport com largura suficiente, mas sem altura confortável para 3 linhas;
- telas 720p/1366×768 ou similares.

Grid:

- **4 colunas × 2 linhas**
- capacidade base: **8 células**

Objetivo: aumentar capacidade sem reduzir demais a altura dos cards.

### 4.3 Perfil denso — `compact`

Uso esperado:

- 9 ou mais pedidos;
- viewport suficientemente grande para 3 linhas;
- referência principal: 1600×900 / 1640×924 / 1920×1080 e equivalentes.

Grid:

- **4 colunas × 3 linhas**
- capacidade base: **12 células**

Objetivo: permitir **10–12 pedidos pequenos** simultaneamente.

## 5. Escolha do perfil

A escolha deve ser feita por função pura e considerar:

- `viewportWidth`;
- `viewportHeight`;
- número total de pedidos operacionais visíveis;
- custo de leitura mínimo definido nesta Spec.

Direção inicial:

- até 6 pedidos → `focus`;
- 7–8 pedidos → `balanced`;
- 9+ pedidos:
  - usar `compact` quando largura e altura úteis forem suficientes;
  - caso contrário, usar `balanced`.

A decisão não pode depender apenas de fullscreen. O que importa é o espaço real disponível.

A implementação deve aceitar ajustes finos de threshold durante homologação sem alterar a semântica dos perfis.

## 6. Cards continuam adaptativos por conteúdo

O perfil do board não torna todos os pedidos iguais.

Cada card recebe um `rowSpan` de acordo com o conteúdo e o perfil atual.

Conceitualmente:

- pedido curto → **1 linha**;
- pedido médio/grande → **2 linhas**;
- pedido extremo em perfil `compact` → pode usar **3 linhas** se necessário.

O cálculo deve continuar reutilizando:

- quantidade de itens;
- estimativa de linhas visuais;
- comprimento de nomes;
- observações;
- possibilidade de duas colunas.

Não duplicar regras em CSS e JavaScript.

## 7. Regra de legibilidade

A densidade pode reduzir:

- padding;
- gaps;
- tamanho do header;
- tamanho de elementos secundários.

Mas deve preservar como informação primária:

1. status;
2. nome/identificação;
3. tempo;
4. modalidade;
5. número do pedido;
6. itens e observações.

Itens e observações não podem desaparecer silenciosamente.

A implementação deve preferir:

1. duas colunas;
2. maior `rowSpan`;
3. menos pedidos simultâneos;

antes de esconder conteúdo.

Fallback com `+ N itens` somente pode existir para um caso extremo comprovado e deve ser explícito. Não é o comportamento normal da V1.

## 8. Header adaptativo

O header atual continua com:

- Cozinha;
- assinatura;
- contadores;
- relógio/data.

Nos perfis `balanced` e `compact`, ele pode ficar visualmente mais enxuto para liberar altura útil.

Não remover contadores nem relógio.

Em telas estreitas, a assinatura secundária já pode desaparecer como ocorre hoje.

## 9. Ordem e prioridade operacional

A mudança é somente de apresentação.

Continuam prevalecendo as regras de `buildKitchenQueueModel`.

Invariantes:

- pedido mais prioritário não pode ser descartado para mostrar um de prioridade inferior apenas porque o inferior é menor;
- estado de atraso não muda;
- agendados mantêm a proteção já existente;
- contadores descrevem a fila completa, não só os cards visíveis;
- overflow continua indicando quantos pedidos estão fora da tela.

## 10. Packing e posicionamento

O packing deve ser determinístico e funcionar para grids variáveis.

Entrada conceitual:

```js
{
  columns,
  rows,
  cards: [
    { rowSpan: 1 | 2 | 3, ... }
  ]
}
```

Regras:

- cada card ocupa exatamente uma coluna;
- `rowSpan` nunca ultrapassa o número de linhas do perfil;
- não criar linhas implícitas fora do grid;
- não usar scroll;
- não pular um card prioritário para preencher buraco com card posterior;
- se um card prioritário não cabe no espaço restante, os posteriores ficam fora da tela.

A posição visual deve ser explícita.

## 11. Fullscreen e viewport

A tela deve recalcular o perfil ao:

- iniciar o painel;
- redimensionar a janela;
- entrar/sair de fullscreen;
- aparecer/desaparecer a toolbar de recuperação.

O cálculo deve usar a área efetiva disponível ao board, descontando a safe-area quando aplicável.

## 12. Compatibilidade esperada por resolução

### 1920×1080 / 1600×900 / aproximadamente 1640×924

- `compact` permitido;
- até 12 cards curtos;
- meta de pelo menos 10 cards curtos legíveis.

### 1366×768 / 720p equivalente

- priorizar `balanced`;
- até 8 cards curtos;
- não forçar 3 linhas se isso comprometer leitura.

### Viewport reduzido

- cair para `balanced` ou `focus`;
- preservar legibilidade;
- nunca cortar itens silenciosamente.

## 13. Exemplos esperados

### 2 pedidos de 1 item

Perfil: `focus`.

Resultado: 2 cards grandes e confortáveis. Não há motivo para reduzir apenas para preencher espaço vazio.

### 6 pedidos curtos

Perfil: `focus`.

Resultado: 6 cards.

### 8 pedidos curtos

Perfil: `balanced`.

Resultado: 8 cards em 4×2.

### 10 pedidos curtos em 1640×924

Perfil: `compact`.

Resultado esperado: os 10 cards visíveis.

### 12 pedidos curtos em 1920×1080

Perfil: `compact`.

Resultado esperado: 12 cards visíveis.

### 10 pedidos com 1 pedido grande

Perfil: `compact`.

O pedido grande pode consumir 2 linhas. O número total visível pode cair, mas nenhum conteúdo deve ser cortado.

### Pedido extremo

Pode consumir a coluna inteira no perfil `compact`. Pedidos inferiores podem ir para overflow.

## 14. Fora de escopo

Não faz parte desta mudança:

- paginação;
- rotação automática de páginas;
- scroll da tela;
- interação para avançar fila;
- mudanças no lifecycle do pedido;
- mudanças de timing;
- alterações no Worker/API;
- mudanças no pareamento;
- mudanças no áudio;
- banco/migrations;
- impressão;
- tela administrativa de Cozinha.

## 15. Critérios de aceite

A feature estará pronta quando:

- [ ] 1–6 pedidos mantêm experiência confortável;
- [ ] 7–8 pedidos curtos podem usar 4×2;
- [ ] 9+ pedidos curtos em viewport grande podem usar 4×3;
- [ ] referência ~1640×924 mostra pelo menos 10 pedidos curtos;
- [ ] 1920×1080 pode mostrar até 12 pedidos curtos;
- [ ] 1366×768 não força densidade ilegível;
- [ ] cards grandes ganham altura antes de reduzir texto excessivamente;
- [ ] pedido extremo pode ocupar 3 linhas em modo compacto;
- [ ] nenhum item é cortado silenciosamente;
- [ ] prioridade operacional não muda;
- [ ] primeiro agendado continua protegido;
- [ ] overflow continua correto;
- [ ] counters continuam representando a fila completa;
- [ ] fullscreen/recovery continuam funcionais;
- [ ] resize recalcula o layout;
- [ ] nenhum scroll é introduzido;
- [ ] TV/Chrome legado continua compatível;
- [ ] áudio e pareamento não regressam;
- [ ] testes, architecture, lint e build passam;
- [ ] staging é homologado antes do merge;
- [ ] produção não é publicada sem autorização separada.

## 16. Métrica de sucesso operacional

A mudança é considerada bem-sucedida se aumentar a informação simultaneamente visível nos picos sem transformar a Kitchen TV em uma grade difícil de ler.

O objetivo não é maximizar matematicamente o número de cards. O objetivo é:

> **mostrar mais pedidos quando eles são simples e dar mais espaço quando eles são complexos.**

## 17. Refinamento aprovado na homologação — compactação vertical inteligente

A primeira versão 4×3 melhorou a largura, mas a homologação visual mostrou espaço vertical excessivo dentro de pedidos curtos.

Direção aprovada:

- manter o número de colunas do perfil;
- subdividir verticalmente os perfis em trilhas menores;
- cards curtos ocupam apenas a altura necessária;
- cards médios e grandes consomem mais trilhas;
- em `compact`, a malha usa 12 trilhas verticais;
- pedido curto típico usa 3 trilhas, permitindo até 4 faixas de cards curtos;
- pedidos maiores usam 4, 6, 9 ou 12 trilhas conforme conteúdo;
- packing preserva prioridade e usa backtracking apenas para encontrar uma disposição válida, sem promover pedidos inferiores;
- 1–4 pedidos continuam em `focus`;
- 5–8 passam para `balanced`;
- 9+ podem usar `compact` em viewport grande.

O ganho de espaço é reinvestido em legibilidade no modo de 4 colunas:

- fonte de itens aumenta aproximadamente 1 px;
- fonte de observações também aumenta aproximadamente 1 px;
- não reduzir fonte para atingir capacidade;
- observações continuam visualmente secundárias, porém legíveis à distância.

Meta revisada para viewport grande:

- até 16 pedidos realmente curtos podem caber;
- a quantidade real visível continua dependendo do conteúdo;
- cards complexos reduzem naturalmente essa capacidade.

A meta continua sendo densidade inteligente, não atingir 16 a qualquer custo.

### Micro-card para pedido de uma linha

Refinamento aprovado após a segunda homologação visual:

No perfil `compact`, um pedido pode usar o menor card da grade quando **todas** as condições abaixo forem verdadeiras:

- existe exatamente 1 item;
- o nome formatado do item cabe em uma única linha visual;
- não existe observação;
- o conteúdo não exige duas colunas nem promoção para `tall/full`.

Esse micro-card usa **2 das 12 trilhas verticais** do perfil compacto, em vez das 3 trilhas do card curto comum.

Pedidos de um item **não** viram micro-card quando:

- o nome quebra linha;
- há observação, como `Sem cebola`;
- qualquer outra métrica de conteúdo exigir mais altura.

A fonte não deve ser reduzida para produzir o micro-card. O ganho vem exclusivamente da remoção do espaço vazio inferior.

Comportamento esperado:

- 1 item simples, 1 linha, sem nota → 2 trilhas;
- 1 item com nota → 3 trilhas;
- 1 item com nome quebrado → 3 trilhas;
- demais cards continuam usando a classificação de altura já aprovada.
