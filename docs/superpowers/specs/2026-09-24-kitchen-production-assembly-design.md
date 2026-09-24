# Mesiva — Cozinha de Produção + Montagem de Pedidos — Design

**Data:** 24/09/2026  
**Projeto:** Gestão Delivery / Mesiva  
**Branch:** `feature/kitchen-production-assembly`  
**Base inicial:** `master@b82406e41ac62560d6ed61acb31c4b18a53d30ae`  
**Escopo:** reformulação da Kitchen TV para produção consolidada + nova tela mobile de montagem + integração com o encerramento atual dos pedidos.  
**Produção:** NÃO AUTORIZADA por esta spec.

---

## 1. Contexto e problema

A Kitchen TV atual foi desenhada como um KDS por pedido:

- grid fixo de 3 colunas × 2 linhas;
- máximo de 6 cards simultâneos;
- sem paginação;
- sem rotação automática;
- sem interação necessária durante o uso normal;
- pedidos excedentes aparecem somente como “+ N pedidos fora da tela”.

Essas decisões foram intencionais para evitar que a cozinha perca um pedido porque a tela trocou sozinha ou exija uso de controle remoto.

O problema surge em operação de alta demanda. Com 15–20 pedidos simultâneos, a pessoa que está produzindo precisa saber **o volume consolidado de comida que ainda falta preparar**, inclusive o que está em pedidos não visíveis nos seis cards.

Exemplo real de necessidade:

- existem 20 pedidos ativos;
- vários pedidos contêm Parmegiana de frango P/M/G;
- parte desses pedidos não estaria entre os seis cards atuais;
- a cozinha poderia fritar/preparar os itens em lote, mas hoje não sabe que eles existem até o pedido ocupar um dos seis slots.

Ao mesmo tempo, uma tela puramente consolidada deixa de responder outra pergunta essencial:

> “Esses itens prontos pertencem a qual pedido e o que ainda falta para fechar esse pedido?”

A solução aprovada conceitualmente é separar duas responsabilidades:

1. **Kitchen TV — Cozinha de Produção**  
   Passiva, consolidada, sem cliente e sem necessidade de clique. Responde:  
   **“O que ainda precisamos produzir agora?”**

2. **Celular — Montagem de Pedidos**  
   Interativo, orientado por pedido. Responde:  
   **“O que já chegou para este pedido e o que ainda falta antes de liberá-lo?”**

O fluxo oficial já existente de saída/finalização continua depois da montagem.

---

## 2. Objetivos

Esta feature deve:

1. transformar a Kitchen TV em uma tela de **produção consolidada**;
2. consolidar quantidades considerando **todos os pedidos elegíveis**, não somente itens visíveis;
3. manter a TV sem paginação, sem rotação automática e sem interação durante operação normal;
4. criar uma tela **Montagem** otimizada para celular;
5. permitir confirmar itens prontos por pedido;
6. retirar imediatamente da contagem de produção o que já foi confirmado na montagem;
7. permitir concluir a montagem somente quando todos os itens do pedido estiverem prontos;
8. introduzir o estado interno **Pronto para saída** sem remodelar o status comercial atual;
9. impedir que pedidos novos acompanhados por esta feature sejam encerrados oficialmente antes da montagem;
10. preservar cancelamento, pagamentos, impressão, timing, agendamento, Kitchen TV auth e demais invariantes existentes.

---

## 3. Não objetivos

Ficam fora desta primeira versão:

- estações diferentes por setor da cozinha;
- telas separadas para chapa, fritadeira, forno etc.;
- impressão de etiquetas de montagem;
- leitura por código de barras;
- baixa por voz;
- smartwatch;
- tablet dedicado;
- inventário/estoque;
- receita/ficha técnica;
- decompor um prato em ingredientes;
- inferir semanticamente observações como “sem cebola” ou “sem queijo”;
- IA decidindo sequência de preparo;
- usuário editar o pedido a partir da tela Montagem;
- alterar pagamento;
- alterar o modelo oficial de status para criar um status comercial novo “Pronto”;
- adicionar paginação ou carrossel automático à TV.

---

## 4. Invariantes atuais que devem permanecer

### 4.1 Lifecycle oficial

Hoje:

- pedido operacional usa `status = 'Em preparo'`;
- pedidos agendados podem existir como `Agendado`;
- cancelados usam `Cancelado`;
- o endpoint `PATCH /api/orders/:id/status` aceita somente `Finalizado`;
- no frontend, a ação de um pedido do tipo **Entrega** é apresentada como **“Saiu para entrega”**;
- em **Retirada** e **Local**, a ação é apresentada como **“Finalizar”**;
- internamente, essas ações continuam levando o pedido ao status terminal atual `Finalizado`.

Esta spec **não remodela esse contrato**.

### 4.2 Timing

Continuam sendo fonte oficial:

- `scheduledPrepLeadMinutes`;
- `scheduledLateGraceMinutes`;
- `immediateLateAfterMinutes`;
- `immediateVeryLateAfterMinutes`;
- regras existentes de `buildKitchenQueueModel` / timing compartilhado.

### 4.3 Kitchen TV

Continuam:

- rota dedicada `/cozinha-tv`;
- sessão própria e restrita da TV;
- pareamento por código curto;
- polling leve;
- bundle isolado do Admin;
- sem `/api/bootstrap`;
- sem QZ/jsPDF/finance/settings administrativos;
- fullscreen não obrigatório;
- suporte à Samsung/Tizen legado;
- tela live sem scroll;
- sem clique necessário depois de entrar no painel.

### 4.4 Snapshots de produto

Os itens do pedido já preservam:

- `name_snapshot`;
- `category_snapshot`;
- `size_snapshot`;
- `quantity`;
- `note`.

Esses snapshots continuam sendo a referência histórica da venda.

---

## 5. Princípio central: status comercial ≠ status interno da cozinha

A feature cria uma camada interna e paralela.

### 5.1 Status oficial do pedido

Permanece como hoje.

Fluxo conceitual:

```text
Em preparo
   ↓
Entrega  → ação “Saiu para entrega” → Finalizado
Retirada → ação “Finalizar”         → Finalizado
Local    → ação “Finalizar”         → Finalizado
```

### 5.2 Estado interno da cozinha

Novo fluxo:

```text
A produzir
   ↓
itens sendo recebidos/conferidos no celular
   ↓
Montagem
   ↓
todos os itens prontos
   ↓
Finalizar montagem
   ↓
Pronto para saída
```

**Pronto para saída não altera `order.status`.**

Ele apenas libera a ação oficial existente.

---

## 6. Fluxo operacional completo

### 6.1 Pedido entra

Ao criar um novo pedido ativo:

- pedido segue para `Em preparo` conforme contrato atual;
- é criado o controle interno de cozinha;
- todos os itens começam com quantidade pronta igual a zero;
- o pedido passa a contribuir para a TV de produção quando estiver elegível pela regra de timing.

### 6.2 TV de produção

A TV soma apenas as quantidades ainda pendentes.

Exemplo:

```text
Parmegiana de frango
P: 2   M: 3   G: 4
9 pendentes
```

Essa soma considera todos os pedidos elegíveis, mesmo que existam 20 pedidos.

### 6.3 Pessoa da montagem no celular

A tela Montagem exibe pedidos individualmente.

Exemplo:

```text
#231 — João — Entrega

[✓] 2x Parmegiana de frango G
[✓] 1x Arroz
[ ] 1x Batata frita
[✓] 1x Coca-Cola
```

Quando a linha “2x Parmegiana de frango G” é marcada pronta:

- as duas unidades deixam de contar como pendentes na TV;
- o pedido continua `Em preparo`;
- a tela Montagem passa a mostrar essa linha como pronta.

### 6.4 Todos os itens prontos

Quando todas as linhas estiverem prontas:

- o botão **Finalizar montagem** fica habilitado;
- ainda não há alteração do status oficial do pedido.

### 6.5 Finalizar montagem

Ao confirmar:

- estado interno vira **Pronto para saída**;
- `ready_at` é persistido;
- pedido permanece `Em preparo`;
- o card administrativo atual passa a exibir indicação clara **Pronto para saída**;
- a ação oficial fica habilitada.

### 6.6 Saída/finalização

Depois disso:

- Entrega → **Saiu para entrega**;
- Retirada → **Finalizar**;
- Local → **Finalizar**.

Esse fluxo continua usando a operação existente.

---

## 7. Modelo de persistência

A nova operação não deve misturar estado mutável de cozinha com snapshots comerciais de `order_items`.

Criar uma migration dedicada.

Nome sugerido na base atual:

`0031_kitchen_production_assembly.sql`

Se a master receber outra migration antes do início da implementação, o número deve ser ajustado no rebase.

### 7.1 `kitchen_order_progress`

Tabela de controle por pedido.

Campos normativos:

```text
business_id
order_id
status
revision
assembly_started_at
ready_at
updated_at
created_at
```

Chave:

```text
PRIMARY KEY (business_id, order_id)
```

`status` V1:

- `open`;
- `ready`.

Não persistir “producing” e “assembling” como estados redundantes.

A UI deriva:

- **A produzir**: nenhuma quantidade pronta;
- **Montando**: existe quantidade pronta e ainda falta item;
- **Conferência completa**: todos os itens prontos, mas status ainda `open`;
- **Pronto para saída**: status `ready`.

### 7.2 `kitchen_item_progress`

Controle por linha do pedido.

Campos:

```text
business_id
order_id
order_item_id
ready_quantity
updated_at
created_at
```

Chave:

```text
PRIMARY KEY (business_id, order_item_id)
```

Regras:

- `ready_quantity >= 0`;
- `ready_quantity <= order_items.quantity`;
- toda leitura/escrita valida business/order/item;
- não aceitar quantidade proveniente apenas do cliente sem conferir a quantidade oficial.

### 7.3 Quantidade parcial

O schema suporta `ready_quantity` parcial desde V1.

A UI inicial, porém, funciona como checkbox de linha:

- desmarcado → `ready_quantity = 0`;
- marcado → `ready_quantity = quantity`.

Isso preserva espaço para uma evolução futura do tipo “2 de 3 prontos” sem migration nova.

### 7.4 Criação transacional

Pedidos novos que iniciem fluxo operacional devem criar:

- 1 row em `kitchen_order_progress`;
- 1 row em `kitchen_item_progress` por linha.

A criação ocorre na mesma transação lógica do pedido.

Falha no tracking da cozinha não pode deixar um pedido parcialmente criado.

---

## 8. Compatibilidade com pedidos já abertos no deploy

Este é um requisito de segurança operacional.

A migration **não deve bloquear silenciosamente pedidos ativos que existiam antes da feature**.

Regra:

- pedidos sem `kitchen_order_progress` são considerados **legacy/untracked**;
- continuam aparecendo na produção com todas as quantidades pendentes;
- podem ser finalizados pelo fluxo antigo sem o novo gate;
- se a equipe abrir/interagir com esse pedido na Montagem, o backend pode inicializar o tracking de forma explícita e passar a aplicar as novas regras;
- pedidos criados depois da ativação sempre têm tracking.

Assim um deploy não trava pedidos que já estavam na cozinha.

---

## 9. Concorrência e dois celulares

Mais de uma pessoa pode abrir Montagem.

Não usar overwrite silencioso.

`kitchen_order_progress.revision` é incrementado a cada mutação.

Mutations devem receber `expectedRevision`.

Se a revisão mudou:

- responder 409;
- código sugerido: `KITCHEN_PROGRESS_CHANGED`;
- retornar/reconsultar estado oficial;
- UI mostra algo como:
  “Este pedido foi atualizado em outro dispositivo. A montagem foi atualizada.”

Nenhuma mutação deve reduzir/alterar progresso de outro dispositivo usando estado stale sem detectar conflito.

---

## 10. API administrativa de Montagem

Criar contrato dedicado; não transformar o `GET /api/orders` em API de tracking de cozinha por conveniência.

### 10.1 GET

`GET /api/kitchen-assembly`

Autorização:

- sessão Admin;
- `orders.view`.

Retorna somente pedidos ativos relevantes para a tela de montagem.

Por pedido:

```text
id
orderNumber
client
type
status
createdAt
scheduledFor
timing state mínimo
kitchen:
  tracked
  status
  revision
  allItemsReady
  readyAt
items:
  id
  productId (somente Admin)
  name
  category
  size
  quantity
  readyQuantity
  note
```

Não retornar dados financeiros por necessidade da Montagem.

### 10.2 Atualizar item

`PATCH /api/kitchen-assembly/orders/:orderId/items/:itemId`

Body:

```json
{
  "readyQuantity": 2,
  "expectedRevision": 4
}
```

Autorização:

- `orders.finalize`.

Validações:

- pedido pertence ao business;
- pedido está ativo;
- tracking existe ou é inicializado por regra legacy;
- item pertence ao pedido;
- quantidade é inteiro entre zero e quantity oficial;
- revisão confere.

Resposta:

- estado atualizado do pedido;
- revisão nova.

### 10.3 Finalizar montagem

`POST /api/kitchen-assembly/orders/:orderId/ready`

Body:

```json
{
  "expectedRevision": 5
}
```

Requisitos:

- todos os itens com `ready_quantity === quantity`;
- pedido ainda ativo;
- não cancelado;
- não finalizado.

Caso contrário:

- 409/422 controlado;
- código: `KITCHEN_ITEMS_PENDING`.

### 10.4 Reabrir montagem

`POST /api/kitchen-assembly/orders/:orderId/reopen`

Permitido apenas enquanto o pedido oficial ainda estiver ativo.

Requer confirmação explícita na UI.

Efeito:

- `status = open`;
- `ready_at = null`;
- não altera as quantidades já marcadas;
- ação oficial volta a ficar bloqueada para pedido tracked.

Uso esperado: correção de erro antes da saída.

---

## 11. Gate server-side da ação final

Não basta desabilitar botão no frontend.

Ao chamar o endpoint atual de finalização:

- se pedido é legacy/untracked → comportamento atual;
- se tracking existe e `kitchen_order_progress.status !== 'ready'` → rejeitar;
- código sugerido: `KITCHEN_ASSEMBLY_PENDING`;
- mensagem:
  “Conclua a montagem do pedido antes de finalizar.”

Esse gate vale tanto para:

- “Saiu para entrega”;
- “Finalizar”.

Cancelamento não depende da montagem e continua permitido conforme capability e regras atuais.

---

## 12. Efeito de cancelamento

Quando um pedido é cancelado:

- ele deixa imediatamente a TV de produção;
- deixa a lista ativa de Montagem;
- progresso de cozinha pode permanecer persistido como histórico técnico;
- não apagar snapshots;
- não recontar seus itens como pendentes.

Não criar workflow especial de “desfazer produção” de um pedido cancelado nesta V1.

---

## 13. Efeito de finalização oficial

Quando a ação oficial conclui o pedido:

- pedido sai de Montagem;
- sai da Kitchen TV;
- estado interno permanece histórico;
- não apagar `ready_at`;
- analytics atuais continuam baseados no status oficial existente.

---

## 14. Regra de elegibilidade para produção

A TV não soma todos os pedidos do dia.

Usar a mesma noção operacional da Cozinha atual.

Entram:

- pedidos immediate ativos em fase de preparo;
- pedidos agendados somente quando entram na janela `scheduledPrepLeadMinutes`.

Não entram:

- agendado futuro fora da janela;
- Finalizado;
- Cancelado;
- pedidos históricos/backdated terminais;
- qualquer pedido que a fila atual não considere em produção.

A regra deve ser compartilhada/derivada das mesmas funções existentes, sem criar um segundo relógio de negócio divergente.

---

## 15. Cálculo de quantidade pendente

Para cada `order_item` elegível:

```text
pendingQuantity = quantity - readyQuantity
```

Normalizar:

- mínimo 0;
- máximo quantity oficial.

Somente `pendingQuantity > 0` participa da produção.

Atualizar em polling após mutação.

---

## 16. Agrupamento de produtos

A lista real atual possui variantes como:

- Parmegiana de frango P/M/G;
- Tilápia à milanesa P/M/G;
- Virado à paulista P/M/G;
- Strogonoff P/M/G;
- Pernil, sobrecoxa, costelinha, feijoada etc.

A TV precisa consolidar o prato sem perder a apresentação.

### 16.1 Grupo principal

V1 agrupa pelo snapshot do produto:

```text
normalized(category_snapshot) + normalized(name_snapshot)
```

Não depender do catálogo atual para renomear pedido histórico.

### 16.2 Breakdown de apresentação

Dentro do grupo, manter `size_snapshot` separado.

Exemplo:

```text
Parmegiana de frango
P 2 · M 3 · G 4
Total 9
```

Outras apresentações continuam válidas:

- 350 ml;
- 1 L;
- 500 g;
- Família;
- Unidade.

Nunca assumir que toda apresentação será P/M/G.

### 16.3 Nomes iguais ambíguos

Categoria faz parte da chave para reduzir colisão de produtos com mesmo nome em grupos diferentes.

Se ainda houver colisão real de catálogo, ela é tratada como uma limitação V1; uma futura versão pode introduzir `production_group_id` configurável.

---

## 17. Observações de item

Observações continuam fundamentais, mas são texto livre.

Não tentar interpretar automaticamente:

- “sem cebola”;
- “sem queijo”;
- “molho separado”.

Na TV de produção:

- mostrar somente indicador quantitativo, por exemplo:
  **“2 itens com observação”**;
- não transformar texto livre em categoria consolidada.

Na Montagem:

- mostrar a observação exatamente na linha correspondente;
- destaque visual claro.

Isso evita agrupamento semântico incorreto.

---

## 18. Kitchen TV — nova finalidade

A tela live deixa de ser orientada a cliente/pedido.

Não mostrar:

- nome do cliente;
- número do pedido como elemento principal;
- endereço;
- telefone;
- valores;
- pagamento;
- impressão.

Objetivo único:

> **mostrar o saldo consolidado de produção agora.**

---

## 19. Kitchen TV — comportamento passivo

Requisitos obrigatórios:

- sem paginação;
- sem “próxima tela”;
- sem carrossel;
- sem rotação automática;
- sem necessidade de controle remoto durante a operação;
- sem scroll;
- sem hover como requisito;
- atualização somente pelos dados;
- fullscreen e áudio continuam tratados na tela inicial.

A pessoa olha e entende o estado atual.

---

## 20. Kitchen TV — cabeçalho

Manter linguagem visual escura do KDS.

Cabeçalho sugerido:

```text
Cozinha · Produção
20 pedidos em produção
37 unidades pendentes
2 pedidos atrasados
20:18
24 set
```

Contadores:

### Pedidos em produção

Número de pedidos elegíveis que ainda possuem pelo menos uma quantidade pendente.

### Itens pendentes

Soma de `pendingQuantity` de todos os grupos.

### Atrasados

Pedidos fonte em estado late/very-late que ainda possuam quantidade pendente.

---

## 21. Kitchen TV — cards de produção

O layout deve ser baseado no mockup conceitual aprovado, mas adaptado ao catálogo real enviado.

Cada grupo mostra:

- nome do produto grande;
- total pendente grande;
- breakdown por apresentação;
- estado de urgência;
- quantidade com observação quando houver;
- barra/indicador visual secundário apenas se melhorar leitura.

Exemplo:

```text
Parmegiana de frango                          9
P 2 · M 3 · G 4
2 com observação
```

Não usar foto do produto como requisito V1. O catálogo atual não depende de imagens e a leitura textual deve ser suficiente à distância.

---

## 22. Prioridade e ordenação da TV

A TV precisa ajudar lote sem esconder urgência.

Ordem normativa:

1. grupos que participam de pelo menos um pedido atrasado;
2. maior quantidade pendente;
3. menor `lateAt`/prazo operacional entre pedidos fonte;
4. nome como desempate estável.

Estados visuais:

- vermelho: existe quantidade ligada a pedido atrasado;
- âmbar: existe pedido fonte próximo do limite;
- padrão: restante.

Cor nunca é o único indicador; incluir texto/ícone.

---

## 23. Densidade adaptativa sem trocar de tela

A TV deve usar toda a tela disponível.

Meta 1080p:

- até 12 grupos: densidade confortável;
- 13–18 grupos: modo compacto;
- 19–24 grupos: modo denso;
- sem scroll.

O CSS pode alterar:

- colunas;
- gap;
- padding;
- tamanho tipográfico dentro de limites de legibilidade.

Nunca alternar páginas.

### 23.1 Overflow extremo

Se houver mais de 24 grupos distintos pendentes:

- exibir os 24 de maior prioridade;
- faixa permanente de atenção:
  **“+ N tipos pendentes fora da capacidade visual — acompanhe Montagem no celular”**;
- esse estado deve ser raro e explicitamente visível;
- não fingir que a TV representa 100% quando não representa.

A homologação deve testar esse estado.

---

## 24. Scheduled na TV

Pedido agendado fora da janela:

- não entra na produção;
- pode permanecer em contador “Agendados” somente se decidirmos manter esse contexto visual, mas não altera as quantidades.

Quando entra na janela:

- passa a somar;
- dispara o alerta de chegada operacional conforme comportamento vigente;
- aparece nos grupos automaticamente.

---

## 25. Integração com a PR #69 de sons

Esta branch nasce separada da PR #69.

A spec não incorpora commits da #69 na base inicial.

Se a PR #69 for mergeada antes da implementação da Kitchen TV:

1. atualizar esta branch a partir da master;
2. preservar catálogo/seleção de sons aprovado;
3. a tela inicial “Painel da cozinha pronto” continua responsável por desbloquear áudio/fullscreen;
4. a reformulação da tela live não pode remover os alertas configuráveis;
5. Samsung/Tizen legado continua gate obrigatório.

Não duplicar player de áudio dentro desta feature.

---

## 26. Tela Montagem — navegação

Nova destination:

`assembly`

Rota sugerida:

`/pedidos/montagem`

Área:

`orders`

Label:

**Montagem**

A área Pedidos passa a ter:

```text
Cozinha | Montagem | Histórico
```

No mobile:

- a bottom navigation principal continua com **Pedidos**;
- não criar quinto item permanente na barra inferior nesta V1;
- ao entrar em Pedidos, a navegação interna permite ir para Montagem;
- deep link de Montagem deve funcionar.

Isso preserva a arquitetura atual sem redesenhar a bottom nav.

---

## 27. Tela Montagem — objetivo mobile-first

O alvo principal é celular.

A tela deve funcionar confortavelmente em:

- 360 px;
- 390/412 px;
- telas Android/iPhone comuns.

Desktop também funciona, mas não dirige o design.

Não exigir tablet.

---

## 28. Tela Montagem — cabeçalho

Resumo compacto:

- pedidos para montar;
- prontos;
- atrasados.

Filtros:

- Todos;
- Montando;
- Prontos;
- Atrasados.

Os filtros não mudam estado do pedido.

---

## 29. Card de Montagem

Cada pedido mostra:

- número operacional;
- cliente;
- tipo: Entrega / Retirada / Local;
- tempo/atraso;
- progresso “X de Y linhas”;
- barra visual;
- itens;
- observações;
- estado da cozinha;
- ação de finalizar montagem.

Exemplo:

```text
#184 João               Entrega     24 min

3 de 4 itens conferidos

✓ 2x Parmegiana de frango G
✓ 1x Arroz
○ 1x Batata frita
✓ 1x Coca-Cola 350 ml

[ Finalizar montagem ]
```

---

## 30. Linha de item no celular

Mostrar:

- checkbox/tap target grande;
- quantidade;
- nome;
- apresentação;
- observação abaixo quando existir;
- estado “Pronto” / “Faltando”.

Tap:

- V1 alterna a linha completa entre 0 e quantity pronta;
- mutation é confirmada pelo servidor;
- UI não deve manter sucesso fictício se backend falhar.

Touch target mínimo deve seguir os controles atuais do sistema.

---

## 31. Progresso de Montagem

Para uma ordem tracked:

### A produzir

Nenhuma linha pronta.

### Montando

Pelo menos uma linha pronta e existe pendência.

### Completo para conferência

Todas as linhas prontas, mas usuário ainda não confirmou Finalizar montagem.

### Pronto para saída

`kitchen_order_progress.status = ready`.

---

## 32. Finalizar montagem

Botão:

**Finalizar montagem**

Desabilitado até todos os itens estarem prontos.

Ao clicar:

- confirmação curta;
- mutation server-side;
- card muda para **Pronto para saída**;
- aparece na aba/filtro Prontos.

Não chamar `updateOrderStatus`.

Não fechar pedido.

---

## 33. Reabrir montagem

Em card **Pronto para saída**:

ação secundária:

**Reabrir montagem**

Com confirmação:

“Este pedido voltará para montagem e a saída ficará bloqueada até nova conferência.”

Permitido somente se pedido oficial continuar ativo.

Não desfaz checkboxes automaticamente.

---

## 34. Relação da Montagem com a TV

A TV mostra quantidade pendente.

Portanto:

- ao marcar item pronto → TV diminui;
- ao desmarcar → TV aumenta;
- ao cancelar pedido → TV remove saldo;
- ao pedido sair/finalizar → TV remove saldo;
- `Finalizar montagem` não altera quantidade se todos os itens já estavam marcados.

Exemplo:

Antes:

```text
Parmegiana G 4
```

Montagem confirma 2x Parmegiana G do pedido #184.

Depois:

```text
Parmegiana G 2
```

Esse é o elo operacional central da feature.

---

## 35. Cozinha administrativa existente

A tela **Pedidos → Cozinha** não é removida.

Ela continua:

- mostrando pedido/cliente;
- detalhes;
- timing;
- cancelamento;
- impressão;
- ação final.

Mudanças:

1. mostrar badge/estado interno:
   - Montando;
   - Pronto para saída;
2. para pedidos tracked, bloquear a ação final enquanto cozinha não estiver `ready`;
3. tooltip/helper:
   **“Conclua a montagem do pedido antes de finalizar.”**
4. quando `ready`, manter exatamente o label atual:
   - Entrega → Saiu para entrega;
   - Retirada/Local → Finalizar.

---

## 36. Polling e atualização

### Montagem

Pode usar polling operacional aproximado de 2 s, consistente com a Cozinha atual.

Também atualizar em:

- focus;
- visibilitychange;
- online.

### TV

Manter polling atual aproximado de 2 s.

Nenhuma mutation na TV.

### Optimistic UI

Checkbox pode ter feedback imediato apenas se existir estratégia de rollback segura.

Preferência V1:

- estado pending visual;
- confirmar servidor;
- aplicar estado oficial retornado.

Evitar divergência entre dois celulares.

---

## 37. Novo contrato da Kitchen TV state

A sessão TV continua chamando:

`GET /api/kitchen-tv/state`

Mas o payload live evolui para produção consolidada.

Não há necessidade de enviar cliente.

Forma sugerida:

```json
{
  "serverNow": "...",
  "counts": {
    "ordersInProduction": 20,
    "pendingUnits": 37,
    "lateOrders": 2
  },
  "groups": [
    {
      "key": "snapshot-safe-key",
      "name": "Parmegiana de frango",
      "category": "Marmitas",
      "pendingQuantity": 9,
      "lateQuantity": 2,
      "nearLimitQuantity": 3,
      "noteQuantity": 1,
      "presentations": [
        { "label": "P", "quantity": 2 },
        { "label": "M", "quantity": 3 },
        { "label": "G", "quantity": 4 }
      ]
    }
  ]
}
```

Não retornar:

- client;
- phone;
- address;
- price;
- payment;
- order totals;
- printing;
- finance.

A nova TV fica ainda mais privada que a atual.

---

## 38. Onde calcular a consolidação

A regra de consolidação deve ser pura e testável.

Não espalhar soma entre componente React e SQL.

Recomendação normativa:

- backend carrega somente dados mínimos;
- regra compartilhada determina elegibilidade/timing;
- pure function agrega quantidade, apresentações e urgência;
- endpoint serializa projeção final.

O mesmo cálculo deve ser reutilizável em testes e, se necessário, em superfícies administrativas.

---

## 39. Cancelamento e race com Montagem

Se um item está sendo marcado enquanto outro dispositivo cancela o pedido:

- mutation de cozinha deve revalidar estado oficial na transação;
- se pedido já está cancelado/terminal → rejeitar;
- código controlado:
  `ORDER_NOT_ACTIVE`;
- frontend remove/reconsulta.

Não ressuscitar tracking.

---

## 40. Finalização e race

Se dois dispositivos tentarem:

- finalizar montagem;
- finalizar pedido oficial;

o backend deve garantir:

- official finalize só passa se tracking estava ready;
- primeira finalização oficial vence;
- retries seguem idempotência/comportamento já existente;
- montagem em pedido terminal é rejeitada.

---

## 41. Permissões

V1 reutiliza capabilities existentes.

### Ver Montagem

`orders.view`

### Marcar/desmarcar item / finalizar/reabrir montagem

`orders.finalize`

### Cancelar

permanece:

`orders.cancel`

Não criar nova capability nesta primeira versão sem necessidade.

A TV continua usando sua sessão restrita própria, sem capabilities administrativas enviadas pelo cliente.

---

## 42. Offline no celular

Montagem é uma mutation operacional e não deve fingir sucesso offline.

Quando offline:

- lista pode manter último snapshot visível;
- checkboxes/mutations ficam bloqueados;
- texto:
  **“Sem conexão — reconecte para atualizar a montagem.”**
- não criar fila offline de marcação de itens nesta V1.

Isso evita reordenação/race impossível de reconciliar.

---

## 43. Estado stale na TV

Comportamento existente continua:

- último snapshot fica visível em falha transitória;
- faixa de dados desatualizados;
- hora de última atualização;
- quando reconecta, substitui pelo estado oficial.

Não zerar produção por falha de rede.

---

## 44. Estado vazio da TV

Quando não houver quantidade pendente:

Manter cabeçalho.

Centro:

**Produção em dia**

Texto:

“Nenhum item aguardando preparo agora.”

Se existirem pedidos prontos para saída, eles pertencem à Montagem/fluxo operacional e não reaparecem como produção.

---

## 45. Estado vazio de Montagem

Sem pedidos:

**Nenhum pedido aguardando montagem.**

Se há pedidos prontos, filtro Prontos ainda pode exibi-los até finalização oficial.

---

## 46. Itens que não exigem cocção

Nesta V1, todos os itens do pedido entram no tracking.

A TV pode, portanto, incluir:

- bebidas;
- sobremesas;
- acompanhamentos;
- pratos.

Não criar heurística baseada em nome/categoria para esconder itens.

Uma futura versão poderá adicionar configuração de catálogo:

- Produção;
- Somente montagem;
- Ignorar no KDS.

Essa evolução é explicitamente fora do escopo V1 para evitar classificação incorreta automática.

---

## 47. Produtos deletados/inativos

Tracking usa snapshot do pedido.

Se produto for desativado ou apagado do catálogo depois da venda:

- item continua aparecendo;
- produção continua correta;
- apresentação snapshot continua correta.

---

## 48. Alteração de preço/produto após pedido

Não muda produção histórica.

Nunca consultar nome/preço atual para substituir snapshot de item já vendido.

---

## 49. Impressão

Nenhuma mudança funcional na impressão.

Print jobs:

- continuam snapshot-based;
- não são reescritos por checkboxes de montagem;
- finalizar montagem não imprime automaticamente;
- reabrir montagem não reimprime;
- fila de impressão não recebe novo status por esta feature.

---

## 50. Financeiro e pagamentos

Nenhuma mudança.

- montagem não recebe pagamento;
- produção não lê valores;
- finalização comercial existente continua usando regras atuais;
- movimentos/recebíveis não são alterados.

---

## 51. Comandas / consumo local

Pedido Local de comanda também pode participar do tracking quando for um pedido operacional ativo.

A feature não fecha comanda.

Quando montagem fica pronta:

- pedido Local fica Pronto para saída/servir;
- a ação final continua seguindo o fluxo existente;
- pagamento da comanda permanece separado.

Não introduzir pagamento dentro de Montagem.

---

## 52. Agendados

Tracking pode existir desde criação do pedido agendado.

Porém:

- não aparece como produção antes da janela;
- não aparece em Montagem ativa antes da janela, salvo futura decisão;
- ao cruzar `scheduledPrepLeadMinutes`, entra automaticamente;
- nenhum operador precisa “iniciar” manualmente o pedido.

---

## 53. Métricas futuras, sem implementar agora

Persistir timestamps úteis permite futuramente medir:

- tempo até início da montagem;
- tempo até todos os itens prontos;
- tempo entre montagem pronta e saída;
- gargalos.

Esta spec não altera dashboards/analytics existentes.

---

## 54. UX de erro

Erros controlados sugeridos:

- `KITCHEN_PROGRESS_CHANGED`;
- `KITCHEN_ITEMS_PENDING`;
- `KITCHEN_ASSEMBLY_PENDING`;
- `KITCHEN_ORDER_TERMINAL`;
- `KITCHEN_ITEM_NOT_FOUND`.

Mensagens devem ser operacionais e curtas.

Não expor SQL/stack.

---

## 55. Testes de migration

Cobrir:

1. clean install;
2. upgrade da base atual;
3. FK integrity;
4. ready_quantity não excede quantity;
5. rows novas criadas para novo pedido;
6. histórico existente preservado;
7. pedidos legacy existentes continuam sem tracking;
8. rollback em falha de criação do tracking;
9. índices por business/order adequados.

---

## 56. Testes backend — Montagem

Cobrir:

1. `orders.view` lê;
2. sem view recebe 403;
3. `orders.finalize` marca item;
4. sem finalize não muta;
5. item de outro business rejeitado;
6. item de outro pedido rejeitado;
7. quantity negativa rejeitada;
8. quantity acima do oficial rejeitada;
9. expectedRevision stale → 409;
10. sucesso incrementa revision;
11. pedido terminal rejeita item mutation;
12. allItemsReady correto;
13. finalizar montagem antes de todos → erro;
14. finalizar montagem com todos → ready;
15. readyAt persistido;
16. reopen limpa readyAt;
17. cancelamento remove da leitura ativa;
18. pedido legacy inicializa tracking somente quando aplicável.

---

## 57. Testes backend — gate oficial

Cobrir:

1. pedido tracked/open não finaliza;
2. tracked/ready finaliza;
3. legacy/untracked continua finalizando;
4. Entrega mantém comportamento de status atual;
5. Retirada mantém;
6. Local mantém;
7. Cancelado não é ressuscitado;
8. retry de finalize preserva comportamento atual.

---

## 58. Testes — consolidação

Cobrir pure function com:

1. mesmo nome + mesma categoria + P/M/G;
2. quantidade de vários pedidos;
3. readyQuantity subtraída;
4. linha totalmente pronta desaparece;
5. desmarcar adiciona saldo;
6. dois nomes iguais em categorias diferentes não juntam;
7. size vazio;
8. apresentações não P/M/G;
9. produto deletado com snapshot;
10. noteQuantity;
11. lateQuantity;
12. nearLimitQuantity;
13. future scheduled excluído;
14. scheduled entra na janela;
15. cancelado excluído;
16. finalizado excluído;
17. ordem de prioridade;
18. 0 pendente não cria group.

---

## 59. Testes — Kitchen TV

Cobrir:

1. state não contém cliente;
2. não contém contato;
3. não contém financeiro;
4. grupos corretos;
5. counts corretos;
6. 12 grupos standard;
7. 18 compact;
8. 24 dense;
9. >24 overload explícito;
10. sem paginação;
11. sem timer de troca;
12. sem scroll;
13. stale mantém snapshot;
14. unauthorized limpa;
15. Tizen target continua chrome69;
16. bundle continua sem Admin pesado;
17. sound/start/fullscreen preservados quando #69 estiver na master.

---

## 60. Testes — Montagem frontend

Cobrir:

1. rota `/pedidos/montagem`;
2. AreaNavigation mostra Cozinha / Montagem / Histórico;
3. bottom nav mobile não ganha quinto item;
4. lista cards;
5. filtro Todos;
6. Montando;
7. Prontos;
8. Atrasados;
9. checkbox item;
10. note visível;
11. size P/M/G;
12. mutation pending;
13. erro rollback;
14. conflito 409 reconsulta;
15. offline bloqueia;
16. all ready habilita Finalizar montagem;
17. pending mantém desabilitado;
18. ready mostra Pronto para saída;
19. reopen;
20. layout 360 px sem overflow horizontal.

---

## 61. Testes — Cozinha administrativa atual

Regressões:

- card ainda mostra cliente;
- detalhe ainda funciona;
- impressão intacta;
- cancelamento intacto;
- timing intacto;
- scheduled intacto;
- botão final tracked/open desabilitado;
- helper explica montagem;
- tracked/ready habilita;
- legacy continua habilitado conforme comportamento anterior.

---

## 62. Arquitetura frontend

Preservar boundaries fechadas na Spec C.

Não criar owner legado em:

- `src/pages`;
- `src/components`;
- `src/hooks`;
- `src/utils`.

Owners sugeridos:

### Orders domain/application

Regras puras e hooks de montagem sob:

`src/domains/orders/`

### Surface Montagem

UI do domínio Orders:

`src/domains/orders/ui/`

### Kitchen TV

Continua em:

`src/kitchen-display/`

### Browser/API infra

Adapters sob infrastructure/domain infrastructure conforme checker existente.

Não criar bridge/facade temporária sem necessidade.

---

## 63. Arquitetura backend

Separar:

- parsing/validation de rota;
- repository;
- projeção de assembly;
- pure consolidation.

Não colocar toda lógica no `worker/index.js`.

O `index.js` apenas roteia/autentica/compõe.

---

## 64. Referências visuais

Existem dois conceitos visuais aprovados na conversa de design de 24/09/2026:

1. **TV de Produção**
   - dark;
   - cards/linhas consolidados por prato;
   - quantidades grandes;
   - apresentações P/M/G;
   - nenhuma informação de cliente.

2. **Montagem mobile**
   - cards por pedido;
   - número/cliente/tipo;
   - checklist de itens;
   - progresso;
   - Finalizar montagem;
   - Pronto para saída.

A implementação deve preservar identidade visual oficial Mesiva e os tokens do produto.

A homologação visual é contra esses conceitos, não contra pixels exatos gerados pelo mockup.

---

## 65. Homologação obrigatória — TV

Em staging:

1. 0 pedidos;
2. 1 pedido;
3. 6 pedidos;
4. 20 pedidos;
5. mesmo prato espalhado em vários pedidos;
6. P/M/G agregados;
7. observações;
8. item marcado no celular diminui TV;
9. item desmarcado volta;
10. cancelamento remove;
11. finalização remove;
12. scheduled fora da janela não conta;
13. scheduled entrando conta;
14. late destaca;
15. 12/18/24 grupos;
16. overflow >24;
17. 1080p;
18. 720p;
19. fullscreen;
20. reconnect;
21. Samsung UN32T4300AG / Tizen legado.

---

## 66. Homologação obrigatória — celular

Em staging, aparelho real:

1. 360–412 px;
2. abrir Montagem;
3. pedido novo aparece;
4. marcar uma linha;
5. confirmar atualização da TV;
6. marcar todas;
7. botão habilita;
8. Finalizar montagem;
9. badge Pronto para saída;
10. Cozinha habilita ação oficial;
11. Entrega → Saiu para entrega;
12. Retirada → Finalizar;
13. Local → Finalizar;
14. dois celulares simultâneos;
15. conflito;
16. offline;
17. cancelar pedido em paralelo;
18. reabrir montagem.

---

## 67. Gates automatizados

Antes de staging:

- focused tests;
- suite completa;
- architecture;
- lint;
- build;
- Worker production dry-run;
- Worker staging dry-run;
- D1 local;
- migration clean install;
- migration upgrade.

Antes de merge:

- Validate final verde no SHA exato;
- staging verde;
- QA manual fechado;
- Samsung legacy PASS ou BLOCKED explicitamente aceito pelo produto;
- nenhum FAIL aberto.

Produção exige autorização separada.

---

## 68. Estratégia de rollout

### Fase 1 — staging

Aplicar migration.

Validar:

- tracking de pedidos novos;
- pedidos legacy;
- assembly;
- TV produção;
- gate final.

### Fase 2 — produção

Somente após homologação e autorização explícita.

A migration é aditiva.

Rollback de frontend/Worker deve considerar que tabelas novas podem permanecer sem prejudicar código antigo.

Não remover tabelas em rollback emergencial.

---

## 69. Compatibilidade de rollback

Se for necessário voltar Worker/frontend para versão anterior:

- `orders` e `order_items` originais continuam intactos;
- tabelas `kitchen_*` podem permanecer órfãs funcionalmente;
- código antigo ignora essas tabelas;
- status oficial do pedido continua válido;
- não realizar migration destrutiva de rollback.

---

## 70. Critérios de aceitação

A feature só está aceita quando:

1. Kitchen TV live é produção consolidada.
2. TV não mostra cliente.
3. TV não pagina.
4. TV não troca tela automaticamente.
5. TV não exige controle remoto durante operação.
6. Todos pedidos elegíveis participam do consolidado.
7. P/M/G são consolidados sob o prato correto.
8. Quantidade pronta deixa de contar.
9. Montagem funciona no celular.
10. Item pode ser marcado/desmarcado.
11. Observação é visível no pedido correto.
12. Finalizar montagem exige todos itens.
13. Pronto para saída é interno e não finaliza pedido.
14. Ação oficial continua com labels atuais.
15. Pedido tracked não pode sair/finalizar antes da montagem.
16. Pedido legacy do momento do deploy não fica bloqueado.
17. Cancelamento continua independente.
18. Scheduled respeita timing existente.
19. Impressão permanece inalterada.
20. Financeiro permanece inalterado.
21. Comandas permanecem compatíveis.
22. Dois celulares não fazem overwrite silencioso.
23. Offline não finge sucesso.
24. TV segue read-only.
25. Bundle TV segue isolado.
26. Samsung legacy permanece compatível.
27. Tests/architecture/lint/build/dry-runs/D1 verdes.
28. Staging homologado.
29. Merge somente com autorização explícita.
30. Produção somente com autorização separada.

---

## 71. Decisões explicitamente tomadas nesta spec

- TV será **Produção**, não tela híbrida por cliente.
- Montagem será feita **pelo celular**, não tablet.
- TV continua passiva.
- Sem auto-rotação.
- Sem paginação.
- Status oficial não será remodelado.
- “Pronto para saída” é interno.
- Montagem bloqueia saída/finalização somente para pedidos tracked novos.
- Pedidos legacy ficam compatíveis.
- Item readiness é persistido separadamente de `order_items`.
- Modelo suporta quantidade parcial, UI V1 usa linha inteira.
- P/M/G são breakdown, não cards separados.
- Texto livre de observação não é interpretado.
- Todos os produtos participam V1; classificação por estação fica para futuro.
- Montagem entra dentro da área Pedidos; bottom nav não recebe quinto item.
- Nenhuma nova capability V1.

---

## 72. Dependência e isolamento da branch

Esta branch foi criada diretamente de:

`master@b82406e41ac62560d6ed61acb31c4b18a53d30ae`

A PR #69 de alertas sonoros continua separada.

Não misturar implementação da #69 nesta branch manualmente.

Quando a master avançar:

- revisar diff;
- integrar master de forma rastreável;
- resolver especificamente os pontos de `KitchenDisplayApp`, áudio e CSS;
- rodar todos os gates novamente.

---

## 73. Auto-revisão contra o código atual

Revisão feita em 24/09/2026 antes da implementação.

Confirmado no código atual:

- Kitchen TV usa `src/kitchen-display`;
- apresentação atual é 3×2, no máximo 6 cards;
- overflow é somente indicador;
- não há paginação/rotação;
- `kitchenTvReadRepository` retorna apenas pedidos ativos e itens kitchen-safe;
- payload atual da TV exclui telefone, endereço, preço, financeiro, impressão e productId;
- `order_items` preserva name/category/size/quantity/note snapshots;
- a API final atual aceita somente `Finalizado`;
- frontend diferencia o texto da ação final por tipo;
- capabilities existentes incluem `orders.view`, `orders.finalize`, `orders.cancel`;
- área Pedidos atualmente contém Cozinha e Histórico;
- a bottom nav mobile possui Pedidos, Comandas, Financeiro e Mais;
- arquitetura atual não permite criar owners legados fora dos domínios;
- a nova feature exige migration aditiva e backend próprio para tracking.

Nenhuma dessas confirmações autoriza implementação automática além do que for aprovado no próximo gate.

---

## 74. Próximo gate

Após aprovação explícita desta spec:

1. escrever plano de implementação detalhado;
2. dividir em tasks TDD RED → GREEN;
3. mapear migration, repositories, endpoints, domain, Montagem, Kitchen TV, gate final e QA;
4. definir ordem que minimize risco operacional;
5. iniciar implementação somente na branch `feature/kitchen-production-assembly`;
6. não fazer merge;
7. não fazer produção.

A aprovação desta spec autoriza **escrever o plano**, não autoriza merge nem deploy de produção.
