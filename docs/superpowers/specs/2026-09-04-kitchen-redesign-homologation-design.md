# Gestão Delivery — Redesign da Cozinha e correções de homologação

Data: 2026-09-04
Branch alvo: `feature/scheduled-orders-operational-timing`
Status: auto-revisado; aguardando revisão do usuário antes do plano de implementação

## 1. Objetivo

Redesenhar a tela **Cozinha** para que a operação consiga identificar, em poucos segundos, qual pedido preparar, para quem, qual ação executar, se há atraso e se existe observação de produção.

O redesign deve reproduzir com alta fidelidade a **Opção A aprovada**: fundo escuro quente, topo compacto, indicadores pequenos, tickets claros e separação visual nítida entre pedidos em preparo e agendados. A fidelidade é um requisito, não apenas uma referência de inspiração; responsividade e acessibilidade podem adaptar a composição, mas não devem descaracterizá-la.

Esta rodada também corrige os achados de homologação relacionados a:

- atualização visual na transição temporal do pedido agendado;
- nomenclatura da fila de pedidos agendados;
- hierarquia e espaçamento dos detalhes do pedido;
- consistência da configuração de impressão no tema escuro;
- rótulo de conclusão de impressão sem confirmação física;
- mensagem e ação de impressão de pedido ainda agendado.

## 2. Escopo e limites

Incluído nesta rodada:

- página Cozinha/Pedidos, seus tickets, busca, contadores, estados vazios e responsividade;
- modal de detalhes do pedido, apenas na organização visual e nas informações de tempo/impressão já disponíveis pelo domínio;
- modal de configurações de impressão, para aderir aos tokens de claro/escuro existentes;
- textos e apresentação de estado da impressão;
- atualização temporal determinística da tela da Cozinha;
- testes de UI, domínio temporal e regressão visual/funcional correspondentes.

Fora de escopo:

- redesenhar as demais áreas do sistema ou propagar esta identidade globalmente;
- criar novo lifecycle persistido para `Agendado`;
- mudar regras já aprovadas de janela operacional, atraso, jobs, estação ou transporte de impressão;
- confirmar fisicamente a saída do papel sem suporte comprovado do protocolo da impressora;
- alterar `master`, publicar, aplicar migration ou fazer qualquer ação em produção.

Esta especificação depende das regras de `2026-09-04-scheduled-orders-operational-timing-design.md` e das estruturas de impressão descritas em `2026-09-03-order-printing-escpos-design.md`. Onde houver conflito de texto sobre o rótulo de sucesso da impressão, esta spec prevalece para a interface.

## 3. Princípios operacionais e visuais

1. A Cozinha mostra apenas o que ajuda a agir. Valores, pagamento, endereço, telefone e detalhes extensos não disputam espaço no ticket.
2. A observação de produção é operacional; portanto, aparece no ticket quando existir.
3. Cor reforça significado, mas texto, ícone e estrutura também comunicam o estado.
4. O relógio reclassifica pedidos, mas não persiste um novo status nem exige ação humana.
5. A interface só afirma o que o sistema sabe. Transmissão de bytes concluída não é confirmação de papel físico.
6. Desktop e mobile mantêm a mesma prioridade de informação; o mobile reorganiza o conteúdo, não apenas o reduz.

### 3.1 Linguagem visual

- Fundo: escuro quente, usando tokens existentes do tema em vez de hexadecimais isolados.
- Tickets: superfície clara, contraste alto e recortes sutis de ticket nas bordas; em mobile os recortes podem ser simplificados para preservar área útil.
- Ícones: ampliar o componente SVG interno existente, com traço arredondado consistente. Não adicionar uma biblioteca externa só para este redesign.
- Cores semânticas centralizadas em tokens/classes de estado:
  - âmbar/laranja: em preparo;
  - azul: agendado para preparo;
  - vermelho: fora do prazo;
  - verde: finalizado;
  - neutros: dados secundários e ações não prioritárias.

O mapa mínimo de ícones cobre Cozinha, preparo, relógio/agendamento, alerta, finalização, cliente, entrega, retirada, local, observação, detalhes, impressão, som e cancelamento. Os desenhos podem ser equivalentes ao mockup, mas devem preservar o estilo do conjunto SVG interno.

## 4. Fonte de verdade e classificação temporal

`status` permanece o lifecycle persistido atual. **Agendado para preparo** é somente uma classificação operacional derivada, compatível com a spec de timing:

```text
pedido ativo sem scheduledFor                     => Em preparo
pedido ativo com now < operationalStartAt         => Agendado para preparo
pedido ativo com now >= operationalStartAt        => Em preparo
pedido ativo após lateAt                          => Fora do prazo (sinalização adicional)
```

`operationalStartAt` continua sendo o início operacional definido pela feature de agendamento: para pedido imediato equivale a `createdAt`; para agendado equivale a `max(createdAt, scheduledFor - janela de preparo)`.

**Fora do prazo** não é uma terceira fila nem substitui a classificação principal. O pedido continua em **Em preparo** ou **Agendados para preparo** conforme o relógio; recebe chip e informação de tempo em vermelho quando a regra de atraso aplicável for atingida.

Pedidos cancelados e finalizados não aparecem nas duas filas ativas. A contagem de finalizados mantém a semântica atual de “hoje”, no fuso operacional do negócio.

## 5. Composição da página Cozinha

### 5.1 Cabeçalho e ações

O cabeçalho compacto é:

```text
🍳 Cozinha
Acompanhe os pedidos em preparo e agendados
```

No desktop, à direita:

```text
Som · Impressão · Histórico · Novo pedido
```

`Novo pedido` é a ação primária. Som, Impressão e Histórico são secundárias e discretas. No mobile, o título permanece limpo; ações secundárias podem ir para um menu compacto, mas `Novo pedido` continua de fácil acesso.

### 5.2 Indicadores

Imediatamente abaixo do cabeçalho, exibir quatro cards compactos:

| Indicador | Definição | Tom |
| --- | --- | --- |
| Em preparo | ativos cujo início operacional já chegou | âmbar |
| Agendados | ativos ainda antes do início operacional | azul |
| Fora do prazo | ativos que excederam sua política de atraso | vermelho |
| Finalizados hoje | pedidos finalizados no dia operacional | verde |

Cada card tem ícone, número em destaque e rótulo curto; não deve conter texto auxiliar longo. Em telas largas são quatro colunas. Em telas estreitas passam para uma grade de 2 × 2, sem cards em largura total individual.

### 5.3 Busca e ordenação

A busca fica acima das filas, visualmente discreta, e consulta cliente, número do pedido, produto e tipo de atendimento. Pagamento pode continuar sendo aceito quando a implementação atual já o suporta, mas não é conteúdo prioritário da Cozinha.

Não haverá seletor de ordenação nesta rodada. A ordem é fixa e explícita no cabeçalho de cada fila:

- **Em preparo:** referência operacional mais antiga primeiro;
- **Agendados para preparo:** `scheduledFor` mais próximo primeiro.

## 6. Filas e estados vazios

As duas filas devem existir visualmente mesmo vazias:

```text
🍳 Em preparo (n)                 Mais antigos primeiro
🕒 Agendados para preparo (n)     Mais próximos primeiro
```

O rótulo **“Aguardando janela”** é removido de toda a UI e de mensagens auxiliares. A forma oficial é **“Agendado para preparo”**.

Mensagens vazias:

```text
Em preparo
Nenhum pedido em preparo agora.

Agendados para preparo
Nenhum pedido agendado aguardando preparo.
```

Uma busca sem resultado pode explicar que nenhum pedido ativo corresponde ao termo, sem ocultar a estrutura das filas.

## 7. Ticket operacional

O ticket tem três zonas no desktop/tablet largo: identificação à esquerda, resumo e observação no centro, e estado/tempo à direita; as ações permanecem no rodapé. Ele é compacto, mas nunca comprimido a ponto de dificultar leitura.

### 7.1 Cabeçalho do ticket

Sempre exibir:

- número destacado, por exemplo `#1048`;
- chip textual de estado: `Em preparo`, `Agendado para preparo` ou `Fora do prazo`;
- informação temporal no canto direito.

Para um pedido em preparo:

```text
Em preparo há 18 min
Desejado 20:42        (somente se veio de agendamento)
```

Para um pedido ainda agendado:

```text
Preparo em 25 min
Desejado 21:15
```

O card não mostra data completa. Horários completos pertencem aos detalhes. Para atraso, a informação vira `Fora do prazo há 12 min`; somente elementos de alerta usam vermelho, sem tingir o ticket inteiro.

### 7.2 Corpo

Coluna de identificação:

```text
👤 João Silva
🛵 Entrega
```

Os equivalentes para `Retirada` e `Local` usam seus ícones próprios. A área principal exibe o resumo:

```text
3 itens · Marmita G, Coca 2L, Pudim
5 itens · Marmita G, Coca 2L, Pudim +2
```

Quando existir, a observação geral fica logo abaixo:

```text
💬 Obs: sem cebola e arroz separado
```

A observação ocupa no máximo duas linhas no ticket e recebe reticências após esse limite; o texto integral fica disponível nos detalhes. Não mostrar total, pagamento, taxa, endereço ou telefone nesse nível.

### 7.3 Rodapé e ações

| Estado principal | Ações visíveis |
| --- | --- |
| Em preparo — Entrega | `Exibir detalhes` · `Saiu para entrega` |
| Em preparo — Retirada/Local | `Exibir detalhes` · `Finalizar` |
| Agendado para preparo | `Exibir detalhes` · `Cancelar` |

A ação operacional é visualmente mais forte. Para pedido em preparo, cancelamento fica nos detalhes para reduzir erro acidental na correria. Para agendado, `Cancelar` fica exposto porque ainda é uma ação natural antes do início do preparo.

### 7.4 Mobile

Em celular, empilhar sem perder os elementos críticos:

```text
#1048 — Em preparo
João Silva · Entrega
3 itens · Marmita G, Coca 2L, Pudim
💬 Sem cebola e arroz separado
Em preparo há 18 min
Exibir detalhes | Saiu para entrega
```

Botões têm área de toque apropriada, podem ocupar linhas separadas quando necessário e preservam rótulos por extenso. A largura alvo inclui ao menos 320–480 px, sem rolagem horizontal.

## 8. Atualização em tempo real

A tela recalcula a classificação e os contadores sempre que `orders` mudar: criação, cancelamento, finalização e sincronização de outra sessão devem produzir nova renderização imediatamente.

Além disso, o relógio da Cozinha deve agendar uma atualização **no próximo `operationalStartAt` futuro** entre os pedidos ativos. Ao chegar esse instante, atualiza `now`, deriva novamente as filas e move o ticket de **Agendados para preparo** para **Em preparo**, sem clique, refresh, mudança de aba ou espera de um minuto.

O timer periódico existente permanece somente como fallback de segurança, junto com atualização ao recuperar foco/visibilidade. A implementação deve limpar e recalcular o timeout quando pedidos, próximo horário ou ciclo de vida do componente mudarem, evitando timers duplicados e vazamentos.

O alerta de som e o destaque de nova chegada seguem a mesma fronteira temporal. Cada pedido que atravessar a janela enquanto a sessão estiver aberta é alertado uma única vez por dispositivo/sessão. Ao abrir a tela depois da transição, o pedido apenas aparece em preparo; não há reprodução retroativa obrigatória.

## 9. Detalhes do pedido

O modal usa blocos claros, alinhados e espaçados, na seguinte ordem:

1. **Resumo:** cliente, tipo, status e pagamento;
2. **Horários:** horário desejado, início operacional e, quando concluído, tempo até sair para entrega (Entrega) ou tempo até finalização (Retirada/Local);
3. **Itens:** lista completa, quantidades e observações destacadas;
4. **Valores:** subtotal, taxa, desconto/acréscimo e total;
5. **Impressão:** bloco separado ao final.

Cada dado de horário deve separar semanticamente rótulo e valor, por exemplo:

```text
Horário desejado: 20:42
Início operacional: 04/09/2026 às 19:52
```

Não são aceitáveis texto colado, como `Horário desejado20:42`, hierarquia ambígua ou dependência exclusiva de posicionamento visual para entender o par rótulo/valor.

## 10. Impressão

### 10.1 Aparência da configuração

O modal/tela de impressão deixa de parecer uma superfície isolada no tema escuro. Fundo, cards, inputs, selects, textos, bordas, botões, foco, hover e estados desabilitados devem consumir os mesmos tokens semânticos do sistema, com contraste acessível nos temas claro e escuro. O layout continua utilizável em telas móveis.

### 10.2 Semântica do status

O estado técnico `printed` significa que a estação abriu o transporte, transmitiu os bytes e o fechou sem erro reportado. Em Serial/Bluetooth isso não assegura que o papel tenha saído fisicamente.

Por isso, a interface deve substituir o rótulo **“Impresso”** por **“Enviado para impressão”** para `printed`. Os rótulos oficiais ficam:

| Estado técnico | Rótulo de interface |
| --- | --- |
| `pending` | Pendente de impressão |
| `processing` | Imprimindo |
| `printed` | Enviado para impressão |
| `failed` | Falha na impressão |
| `requires_attention` | Requer atenção |

Não tentar simular confirmação física. Se a MTP-5 ou outro protocolo futuramente fornecer confirmação verificável, uma spec posterior poderá definir um estado distinto e o rótulo correspondente.

### 10.3 Pedido agendado antes da janela

Para job automático ainda antes de `availableAt`, os detalhes exibem:

```text
Impressão programada para 19:52
Imprimir agora
```

`Imprimir agora` cria uma impressão manual independente. Ela não altera, consome ou cancela o job automático futuro; quando `availableAt` chegar, o job automático continua elegível e segue o fluxo normal. Sem hardware, a homologação pode validar estado, data programada, criação de jobs, elegibilidade e erros de conexão; a saída física fica pendente de teste com a impressora real.

## 11. Arquitetura de implementação prevista

Esta seção define fronteiras, não um plano sequencial de tarefas.

- **Domínio temporal:** reutilizar/estender o módulo compartilhado de timing para obter `operationalStartAt`, classificação operacional, atraso e próximo instante de atualização. A página não deve duplicar cálculos de data em JSX.
- **Página Cozinha:** recebe pedidos e estado de sincronização, deriva filas, indicadores e resultado da busca; controla o relógio de apresentação e diálogos locais.
- **Ticket da Cozinha:** componente focado na representação e ações de um pedido já classificado, com layout desktop/mobile em CSS. Não deve consultar API nem decidir regras de tempo.
- **Detalhes e impressão:** continuam consumidores do pedido e do job; recebem helpers de formatação de horários/estado em vez de concatenação visual de strings.
- **Design system local:** `Icon`, badges, `Button`, `StatCard` e tokens de tema são ampliados de forma compatível. Não introduzir uma nova biblioteca ou um segundo sistema de cores.

O backend não precisa gravar transição `Agendado → Em preparo`; a classificação é derivada no cliente sobre os timestamps oficiais já fornecidos. Jobs seguem sendo a fonte oficial do estado de impressão.

## 12. Estratégia de testes

Antes de qualquer implementação, o plano deverá transformar estes critérios em testes RED. A cobertura mínima inclui:

- classificação de pedido imediato e agendado antes/no início/depois da janela;
- seleção e reagendamento do próximo `operationalStartAt`, limpeza de timeout e fallback por foco/visibilidade;
- atualização imediata ao receber nova coleção de pedidos;
- ordenação de cada fila, contadores e busca por cliente, número, produto e tipo;
- ausência de `Aguardando janela` e presença de `Agendado para preparo` nos estados aplicáveis;
- conteúdo e truncamento de observação do ticket;
- ações corretas por tipo e fila, inclusive cancelamento não exposto em preparo;
- layout responsivo dos indicadores e tickets entre 320 e 480 px;
- formatação de rótulo/valor dos horários nos detalhes;
- tema claro/escuro da configuração de impressão, incluindo foco e contraste;
- mapeamento de `printed` para `Enviado para impressão`;
- pedido agendado antes de `availableAt`, impressão manual sem alterar o job automático e elegibilidade normal na hora correta.

## 13. Critérios de aceite

O redesign estará pronto para homologação quando:

1. a Cozinha refletir a composição e hierarquia da Opção A, com tickets claros sobre fundo escuro e quatro indicadores compactos;
2. pedidos ativos estiverem sempre em exatamente uma fila principal, com atraso como sinalização adicional;
3. nenhum texto da UI usar “Aguardando janela”;
4. um pedido mudar de Agendado para Em preparo no instante operacional, sem interação do usuário e sem depender do intervalo de um minuto;
5. a busca, as ordenações fixas e os estados vazios obedecerem esta spec;
6. cada ticket mostrar identificação, tipo, resumo de itens, observação quando houver, tempo e ação adequada sem exibir informação financeira desnecessária;
7. desktop e mobile preservarem legibilidade, áreas de toque e ausência de rolagem horizontal;
8. detalhes mostrarem horários e valores em blocos semanticamente claros;
9. a configuração de impressão estiver visualmente integrada nos temas claro e escuro;
10. `printed` aparecer para o usuário como `Enviado para impressão`;
11. pedido agendado antes da janela mostrar a programação e permitir impressão manual sem cancelar a automática;
12. testes automatizados, lint e build relevantes permanecerem verdes, e a homologação manual confirmar os fluxos temporais sem impressora física.

## 14. Revisão da spec

Auto-revisão concluída em 2026-09-04:

- nenhum placeholder, tarefa pendente ou decisão em aberto foi deixado no texto;
- a classificação derivada é consistente com a feature de timing e não cria status persistido novo;
- a alteração de rótulo de impressão preserva a semântica técnica existente e evita alegar confirmação física;
- o escopo está limitado à Cozinha, detalhes e impressão relacionados, sem expandir o redesign ao restante do produto;
- regras de ordenação, filas, atraso, impressão manual e responsividade têm comportamento explícito.

O próximo passo permitido é a revisão desta spec pelo usuário. O plano de implementação não deve ser criado antes dessa aprovação.
