# Gestão Delivery — Kitchen TV / KDS para TV 32"

Data: 2026-09-22  
Branch de design: feature/kitchen-tv-display-v2-design  
Base: master em 7d5a9d2507968dd96dae81f5f1d61431a6e42292  
Status: **APPROVED** pelo produto em 2026-09-22; plano detalhado escrito e aguardando aprovação

## 1. Contexto e relação com documentos anteriores

Esta spec define a primeira versão oficial da Kitchen TV do Gestão Delivery: uma visualização de pedidos para permanecer aberta em uma TV da cozinha, sem exigir login humano diário e sem carregar a aplicação administrativa completa.

Existe um design histórico não incorporado à master em feature/kitchen-tv-display-design, datado de 2026-09-09. Esse material foi usado apenas como insumo. A presente spec substitui aquele desenho para qualquer implementação futura porque:

- a arquitetura do frontend mudou com a Spec C;
- Cozinha passou a pertencer a src/domains/orders;
- Configurações e navegação foram modularizadas;
- o subsistema de impressão/QZ foi consolidado;
- políticas operacionais passaram a ser configuráveis;
- o produto aprovou em 2026-09-22 uma nova referência visual específica para TV 32".

A regra central permanece:

> compartilhar as regras operacionais da Cozinha, não reutilizar a interface administrativa inteira.

## 2. Objetivo

Criar um KDS de cozinha dedicado a TV que:

1. possa ficar aberto durante toda a operação;
2. seja legível a alguns metros de distância em uma TV 16:9 de 32";
3. abra sem o PIN administrativo depois de um pareamento inicial;
4. carregue somente dados necessários à produção;
5. tenha frontend e API leves;
6. seja somente leitura;
7. reflita a mesma fila, janela operacional, ordenação e atraso da Cozinha administrativa;
8. destaque o nome do cliente como principal referência operacional;
9. reproduza com alta fidelidade o layout visual aprovado em 2026-09-22;
10. continue segura mesmo sem login humano diário.

## 3. Decisões de produto já fechadas

As decisões abaixo são parte do escopo aprovado e não devem ser reabertas no plano sem motivo técnico comprovado.

### 3.1 Uso e dispositivo alvo

- Uso principal: TV normal 16:9 instalada na cozinha.
- Referência de projeto: TV 32".
- Resolução de referência: 1920x1080.
- Deve continuar funcional e legível em 1280x720.
- A interface não é desenhada para celular.
- A tela não possui navegação administrativa.

### 3.2 Natureza da interface

- Somente leitura.
- Sem criar, finalizar, cancelar, imprimir ou editar pedidos.
- Sem financeiro.
- Sem endereço.
- Sem telefone.
- Sem pagamento.
- Sem informações de cliente além do nome de exibição necessário à cozinha.
- Ações permanecem no sistema administrativo.

### 3.3 Autenticação

- A TV não usa o PIN administrativo.
- A TV não ganha acesso público anônimo aos pedidos.
- O acesso é pareado uma vez a partir de Configurações.
- Depois do pareamento, a TV recebe sessão própria, restrita e persistente.
- A sessão da TV nunca equivale a uma sessão administrativa.

### 3.4 Atualização

- Polling leve.
- Sem WebSocket e sem SSE na v1.
- Cadência alvo aproximada: 2 segundos enquanto o painel estiver ativo e visível.
- O relógio e timers visuais atualizam localmente a cada segundo.
- Nenhuma chamada de rede é feita só para atualizar cronômetro.

### 3.5 Visual

- Tema fixo escuro.
- Fonte principal: Inter, já usada no sistema.
- Sem biblioteca nova de ícones.
- Ícones SVG devem vir do Icon do sistema ou ser adicionados ao mesmo padrão SVG interno.
- Nome do cliente é o texto dominante no card.
- Número do pedido é secundário e pequeno.
- Layout principal de 6 cards em grade 3 colunas x 2 linhas.
- Hora, data e contadores permanecem visíveis no topo.
- O mockup aprovado em 2026-09-22 é referência visual normativa, não inspiração genérica.

## 4. Fora de escopo da v1

Não entregar nesta primeira versão:

- múltiplas TVs por negócio;
- lista de dispositivos;
- nome customizado para TV;
- permissões por TV;
- tema claro;
- configuração de cores;
- configuração de refresh;
- WebSocket/SSE;
- analytics da TV;
- histórico de acessos detalhado;
- ações de produção diretamente pela TV;
- controle remoto por teclado/controle da TV como fluxo principal;
- paginação manual;
- carrossel automático de páginas;
- login administrativo dentro da TV;
- novo lifecycle persistido para “Novo pedido”;
- nova regra de atraso própria da TV;
- segunda cópia das regras de janela operacional;
- dependência de QZ Tray, jsPDF ou stack de impressão;
- novo repositório ou deploy separado.

## 5. Arquitetura atual que deve ser respeitada

A implementação deve partir da arquitetura vigente em master.

### 5.1 Orders é proprietário das regras de Cozinha

Hoje pertencem a src/domains/orders:

- ui/Orders.jsx;
- ui/components/KitchenTicket.jsx;
- domain/kitchenQueue.js;
- domain/kitchenTicket.js;
- domain/orderWorkflow.js;
- domain/orderRealtime.js;
- application/useOrderArrivals.js.

A Kitchen TV pode reutilizar funções puras e contratos públicos de Orders, mas não deve importar a árvore completa de UI administrativa.

### 5.2 Configurações atual

A home de Configurações está em:

- src/app/surfaces/settings/SettingsHome.jsx;
- src/app/navigation/registry.js.

A Kitchen TV deve acrescentar um destino próprio de Configurações, por exemplo TV da Cozinha, sem mover Impressão ou Preferências deste dispositivo.

A UI deve usar as capacidades já existentes do domínio Orders:

- orders.settings.view para visualizar estado;
- orders.settings.manage para gerar, regenerar ou revogar acesso.

A introdução da Kitchen TV não cria uma nova política genérica de perfis/usuários.

### 5.3 Autenticação atual

Hoje worker/index.js encaminha a maior parte de /api/* para a API autenticada.

A Kitchen TV precisa de duas exceções explícitas e estreitas:

- endpoint público de pareamento usando segredo de alta entropia;
- endpoint de estado aceitando apenas cookie da TV.

Essas rotas não podem fazer a sessão da TV passar por getAuthenticatedSession como se fosse admin.

## 6. Arquitetura proposta

### 6.1 Mesmo projeto e mesmo deploy, superfície frontend separada

Rota pública de superfície:

/cozinha-tv

A URL serve a mesma aplicação Cloudflare/Vite, mas o entrypoint precisa decidir o modo antes de importar a aplicação administrativa pesada.

Estrutura conceitual:

- acesso normal → carrega bundle administrativo;
- /cozinha-tv → carrega bundle Kitchen TV.

A implementação deve reorganizar o bootstrap atual para que src/main.jsx não faça import estático de App.jsx antes de conhecer a rota.

Uma direção aceitável:

- main mínimo;
- import dinâmico de um bootstrap admin;
- import dinâmico de um bootstrap TV.

Não é necessário introduzir React Router apenas para esta feature.

### 6.2 Estrutura sugerida

A implementação pode usar:

src/kitchen-display/
- KitchenDisplayRoot.jsx
- KitchenDisplayApp.jsx
- KitchenDisplayBoard.jsx
- KitchenDisplayCard.jsx
- kitchenDisplayApi.js
- kitchenDisplaySession.js
- kitchenDisplayPresentation.js
- kitchen-display.css

O nome exato pode ser refinado no plano, mas a superfície deve continuar isolada da UI administrativa.

### 6.3 Regra de dependência

Permitido:

Kitchen TV → contratos públicos e funções puras de Orders  
Kitchen TV → infraestrutura HTTP mínima  
Kitchen TV → shared/ui/Icon se o custo de bundle permanecer pequeno  
Kitchen TV → React/ReactDOM

Não permitido:

Kitchen TV → App.jsx  
Kitchen TV → Dashboard  
Kitchen TV → Finance  
Kitchen TV → Customers  
Kitchen TV → Catalog UI  
Kitchen TV → Table Service UI  
Kitchen TV → Printing UI/QZ  
Kitchen TV → Settings UI  
Kitchen TV → bootstrap administrativo

## 7. Performance e leveza

Performance em hardware modesto é requisito de produto.

### 7.1 O que a TV não pode carregar

A Kitchen TV não deve carregar ou requisitar:

- /api/bootstrap;
- dashboard;
- financeiro;
- clientes;
- produtos;
- mesas/comandas;
- histórico;
- formulários;
- criação de pedidos;
- modais administrativos;
- manager de impressão;
- QZ Tray;
- jsPDF;
- configurações completas;
- tema da aplicação administrativa.

### 7.2 Bundle dedicado

O build deve gerar chunk próprio para a Kitchen TV.

A homologação precisa verificar no Network do navegador que abrir /cozinha-tv não provoca carregamento inicial dos chunks administrativos pesados.

### 7.3 Renderização

Usar React + CSS.

Não adicionar:

- canvas;
- vídeo;
- background fotográfico;
- animação JS pesada;
- biblioteca de motion;
- biblioteca de UI nova;
- biblioteca de ícones nova.

## 8. Pareamento e segurança

## 8.1 Princípio

“Sem login” significa “sem autenticação humana diária”, não “pedidos públicos”.

### 8.2 Fluxo administrativo

Em Configurações:

Configurações → TV da Cozinha

Estados possíveis:

1. não configurada;
2. link gerado aguardando pareamento;
3. TV ativa;
4. revogada/desconectada.

### 8.3 Geração de acesso

Ação:

Gerar acesso da TV

O servidor deve:

- gerar segredo criptograficamente seguro;
- persistir somente hash;
- definir validade curta do link;
- devolver segredo em texto claro apenas nesta resposta;
- permitir Copiar link;
- opcionalmente apresentar QR Code se for possível sem nova dependência pesada.

Validade do link de pareamento na v1:

30 minutos.

Gerar novo acesso deve invalidar qualquer link anterior e qualquer sessão TV anterior.

### 8.4 Link

Formato conceitual:

https://<host>/cozinha-tv#token=<segredo>

O segredo deve viajar no fragmento da URL, não no query string. Fragmentos não são enviados ao servidor no request HTTP inicial e reduzem exposição em logs/referrers. O token nunca deve permanecer na URL depois do pareamento bem-sucedido.

### 8.5 Pareamento

Ao abrir um link válido:

1. frontend da TV lê o segredo de location.hash e envia ao endpoint de pareamento no corpo do POST;
2. servidor compara hash;
3. valida negócio, revogação e expiração;
4. cria segredo de sessão TV independente;
5. persiste apenas hash da sessão;
6. envia cookie dedicado HttpOnly;
7. invalida o segredo de pareamento;
8. frontend executa history.replaceState para /cozinha-tv;
9. painel passa a carregar somente pelo cookie.

O link é de uso único.

### 8.6 Sessão da TV

Cookie dedicado, separado do cookie administrativo.

Requisitos:

- HttpOnly;
- Secure;
- SameSite restritivo compatível com mesmo host;
- Path apropriado;
- segredo opaco de alta entropia;
- hash armazenado no banco;
- sessão longa com renovação de validade durante uso;
- uso contínuo não deve exigir novo pareamento.

Objetivo operacional:

uma TV usada regularmente continua pareada até revogação, regeneração de acesso ou limpeza dos dados do navegador.

### 8.7 Revogação

Ação administrativa:

Revogar acesso

No próximo refresh de estado:

- API responde não autorizado;
- TV apaga imediatamente pedidos visíveis;
- TV mostra mensagem de acesso revogado;
- dados antigos não ficam expostos como se fossem atuais.

### 8.8 Isolamento

A sessão TV:

- acessa somente seu business_id;
- acessa somente estado da Kitchen TV;
- não acessa /api/bootstrap;
- não acessa /api/orders administrativo;
- não acessa impressão;
- não acessa settings administrativos;
- não escreve pedidos;
- não satisfaz auth admin.

## 9. Persistência

Criar migration numerada para uma estrutura monodispositivo.

Sugestão lógica:

kitchen_tv_access

Campos mínimos:

- business_id — chave única;
- pairing_token_hash — nullable;
- pairing_expires_at — nullable;
- session_token_hash — nullable;
- session_issued_at — nullable;
- paired_at — nullable;
- last_seen_at — nullable;
- revoked_at — nullable;
- created_at;
- updated_at.

Regras:

- nunca armazenar segredo em texto claro;
- um negócio possui no máximo uma sessão Kitchen TV ativa na v1;
- novo acesso invalida anterior;
- pareamento consome pairing_token_hash;
- revogação invalida session_token_hash;
- last_seen_at não pode gerar escrita a cada polling.

Atualização de last_seen_at:

no máximo uma escrita a cada 5 minutos por TV ativa.

## 10. Endpoints

### 10.1 Admin autenticado

GET /api/kitchen-tv/settings

Retorna somente:

- configured;
- waitingPairing;
- paired;
- lastSeenAt;
- pairedAt;
- revokedAt quando relevante.

Nunca retorna hash ou segredo persistido.

POST /api/kitchen-tv/access

Exige orders.settings.manage.

Gera novo link, invalidando sessão/link anteriores.

POST /api/kitchen-tv/revoke

Exige orders.settings.manage.

Revoga sessão atual.

### 10.2 Público restrito de pareamento

POST /api/kitchen-tv/pair

Recebe segredo de pareamento.

Resposta:

- sucesso genérico;
- cookie TV;
- sem bootstrap;
- sem payload de pedidos nesta operação.

Erros devem ser genéricos, sem revelar se token existe, expirou ou já foi usado.

### 10.3 Estado da TV

GET /api/kitchen-tv/state

Aceita somente sessão TV válida.

Read-only.

Retorna contrato mínimo da seção 11.

## 11. Contrato de dados da TV

A TV não recebe representação completa de pedido.

### 11.1 Estrutura conceitual

Resposta:

- serverNow;
- timing;
- orders.

timing contém somente:

- scheduledPrepLeadMinutes;
- scheduledLateGraceMinutes;
- immediateLateAfterMinutes;
- immediateVeryLateAfterMinutes.

orders contém somente pedidos ativos relevantes à Cozinha.

Cada pedido pode conter:

- id estável;
- orderNumber;
- client — nome de exibição;
- type — Entrega, Retirada ou Local;
- createdAt;
- scheduledFor quando existir;
- estado mínimo necessário à classificação ativa;
- items.

Cada item contém somente:

- quantity;
- name ou snapshot de nome de exibição;
- note quando existir.

### 11.2 Dados proibidos

A API TV não deve retornar:

- telefone;
- endereço;
- client_id quando desnecessário;
- perfil completo de cliente;
- preço unitário;
- subtotal;
- total;
- taxa de entrega;
- descontos;
- ajustes;
- forma de pagamento;
- status de recebimento;
- transações;
- movimentos financeiros;
- reembolso;
- dados de cartão/Pix;
- dados de impressão;
- print jobs;
- QZ;
- catálogo de produtos;
- pedidos finalizados históricos;
- comandas completas;
- mesas completas.

A implementação deve preferir query/mapper por allowlist. Não carregar objeto completo para depois “apagar campos”.

## 12. Regras operacionais compartilhadas

### 12.1 Fonte de verdade

A TV usa as mesmas regras de:

- pedido ativo;
- fase preparing/scheduled;
- operational start;
- lateAt;
- ordenação por prazo;
- ordenação de agendados;
- arrival detection.

As funções atuais em Orders/shared devem ser reutilizadas ou extraídas de forma neutra se necessário.

### 12.2 Agendados

scheduledPrepLeadMinutes vem da configuração efetiva atual do negócio.

A TV não fixa 50 minutos se o negócio tiver política diferente.

### 12.3 Atraso

Atraso real continua vindo de getOrderTimingState/getOrderLateAt e configuração atual.

A TV não muda o significado de “atrasado”.

### 12.4 “Próximo do limite”

O mockup aprovado possui estado âmbar “PRÓXIMO DO LIMITE”.

Esse estado é exclusivamente de apresentação.

Regra v1:

- pedido está em preparing;
- ainda não está atrasado;
- faltam 5 minutos ou menos para lateAt.

Constante visual:

KITCHEN_TV_NEAR_LIMIT_MINUTES = 5.

Esse estado:

- não altera status persistido;
- não altera fila;
- não altera ordenação;
- não altera Cozinha administrativa;
- apenas muda label/cor na TV.

### 12.5 Novo pedido

“NOVO PEDIDO” não é status persistido.

Usar a mesma detecção de chegada operacional já utilizada por useOrderArrivals.

Duração do destaque:

2600 ms.

Depois disso o card volta ao estado visual derivado do timing.

Tanto pedido imediato novo quanto agendado que cruza a janela operacional podem receber esse destaque.

No primeiro carregamento, os pedidos já existentes são considerados conhecidos e não devem todos piscar/tocar.

## 13. Atualização e relógio

### 13.1 Polling

Enquanto painel estiver live e document.visibilityState for visible:

- refresh imediato ao entrar;
- polling a cada aproximadamente 2 segundos;
- refresh adicional ao recuperar online;
- refresh adicional ao receber focus;
- refresh adicional ao voltar de hidden para visible.

Quando a aba estiver oculta, pode suspender o polling frequente.

### 13.2 Relógio local

Atualizar now localmente a cada 1 segundo.

Esse now dirige:

- relógio do cabeçalho;
- data;
- timers dos cards;
- transição visual para próximo do limite;
- transição para atraso;
- entrada de agendado na janela operacional quando o conjunto de dados já contém o pedido.

As transições devem ser reconciliadas no próximo polling com o estado oficial.

### 13.3 Timezone

Hora/data devem usar o mesmo timezone operacional já utilizado pelo sistema para regras de negócio.

Não depender silenciosamente do timezone configurado na TV se ele divergir do negócio.

## 14. Contrato visual normativo

## 14.1 Regra de fidelidade

O mockup 32" aprovado em 2026-09-22 é a referência visual oficial.

A implementação deve reproduzir:

- proporção;
- hierarquia;
- densidade;
- grid;
- estilo gráfico;
- tipografia;
- posicionamento;
- contadores;
- relógio;
- data;
- ícones;
- pills;
- linhas/divisores;
- cores de estado;
- tratamento das observações.

Adaptações são permitidas somente para:

- dados reais maiores;
- textos longos;
- acessibilidade;
- resoluções diferentes;
- limitações reais de browser.

Não é permitido substituir o conceito por um dashboard genérico diferente.

## 15. Canvas e viewport

### 15.1 Referência

Design base:

1920x1080, 16:9.

### 15.2 Faixa suportada

Mínimo funcional:

1280x720.

Acima de 1920x1080, conteúdo escala proporcionalmente e preserva largura de leitura.

### 15.3 Scroll

O painel live não deve ter scroll de página na resolução alvo.

Pedidos excedentes são representados por overflow controlado, não por rolagem vertical.

## 16. Tipografia

Fonte:

Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif.

Referência para 1920x1080:

- título Cozinha: 44–52 px, peso 700/800;
- contador numérico: 38–46 px, peso 700/800;
- labels do contador: 16–20 px;
- relógio: 44–52 px;
- data: 18–22 px;
- status do card: 17–20 px, peso 700;
- nome do cliente: 34–42 px, peso 700/800;
- timer do card: 32–40 px, peso 700/800;
- tipo do pedido: 18–22 px;
- item: 22–26 px;
- observação: 18–22 px;
- número do pedido: 17–20 px, peso 500/600 e baixo contraste relativo.

Usar clamp onde necessário para 720p/1080p.

O número do pedido nunca deve competir visualmente com o nome do cliente.

## 17. Ícones

Reutilizar SVGs internos do Icon.

Obrigatórios:

- clock;
- pickup;
- local;
- note;
- alert quando necessário.

Para fidelidade ao mockup, é permitido adicionar sem dependência externa:

- chef-hat — ícone principal do cabeçalho;
- delivery-bike — alternativa visual para Entrega se o atual delivery não reproduzir satisfatoriamente a referência.

Todos continuam:

- inline SVG;
- currentColor;
- stroke compatível com Icon;
- viewBox 24x24;
- sem pacote externo.

## 18. Paleta fixa do KDS

Criar tokens locais em kitchen-display.css.

Direção visual alvo:

- fundo geral: quase preto azul-esverdeado;
- superfícies: azul-preto;
- texto principal: branco quente;
- texto secundário: cinza azulado;
- green: novo pedido;
- blue: em preparo;
- amber: próximo do limite;
- red: atrasado;
- scheduled: cinza/lilás frio.

Valores iniciais sugeridos, sujeitos apenas a ajuste fino de staging para bater com o mockup:

- --kds-bg: #071018;
- --kds-panel: #0b151e;
- --kds-card: #101a23;
- --kds-text: #f6f8fb;
- --kds-muted: #9da9b8;
- --kds-green: #66e88a;
- --kds-blue: #43a9ff;
- --kds-amber: #ffb51f;
- --kds-red: #ff4b55;
- --kds-scheduled: #aab4cc;
- --kds-border: rgba(255,255,255,.14).

Não herdar o tema claro/escuro administrativo.

## 19. Cabeçalho

O cabeçalho ocupa a faixa superior do painel.

### 19.1 Lado esquerdo

- ícone chef-hat;
- texto grande “Cozinha”;
- divisor vertical discreto;
- frase “Boas refeições. Mais histórias.” em texto secundário.

Essa frase faz parte da referência aprovada da v1.

### 19.2 Centro/direita operacional

Exibir três indicadores:

Em preparo  
Atrasados  
Agendados

Contagens:

- Em preparo = todos da fase preparing, incluindo próximo do limite e atrasados;
- Atrasados = subset preparing com timing atrasado;
- Agendados = fase scheduled aguardando janela.

### 19.3 Hora/data

No extremo direito:

- relógio HH:mm;
- data abaixo no formato pt-BR equivalente a “Seg, 26 de mai”.

Atualização a cada segundo para relógio; data acompanha mudança de dia.

## 20. Grid principal

### 20.1 Estrutura

Em 1080p:

- 3 colunas;
- 2 linhas;
- 6 cards;
- gaps uniformes;
- margens amplas para leitura à distância.

### 20.2 Capacidade

Máximo visível simultâneo:

6 cards.

### 20.3 Alocação dos 6 slots

A referência aprovada mostra 5 pedidos operacionais + 1 agendado.

Regra v1:

1. reservar até 5 slots para preparing, pela ordenação oficial atual;
2. se existir scheduled, reservar 1 slot para o agendado mais próximo;
3. se não existir scheduled, o sexto slot pode ser preparing;
4. se houver menos de 5 preparing, scheduled adicionais podem preencher os slots livres em ordem de proximidade;
5. nunca ultrapassar 6 cards.

Isso preserva visão da operação atual sem esconder completamente o próximo agendado.

### 20.4 Overflow

Sem paginação e sem rotação automática.

Quando existirem mais pedidos que slots:

- mostrar indicador discreto no board, por exemplo “+ 3 pedidos aguardando espaço”;
- os cards visíveis continuam obedecendo prioridade oficial;
- quando um pedido sai, o próximo ocupa o slot automaticamente.

Overflow de agendados pode ser incluído no mesmo resumo ou como texto específico se ficar mais claro.

## 21. Card — estrutura normativa

Cada card deve manter a mesma composição visual.

### 21.1 Linha de status

Topo esquerdo:

- ponto colorido;
- label em caixa alta.

Topo direito:

- número do pedido pequeno e secundário.

Exemplos:

NOVO PEDIDO                                         #1042  
EM PREPARO                                          #1041  
PRÓXIMO DO LIMITE                                   #1040  
ATRASADO                                            #1039  
AGENDADO                                            #1043

### 21.2 Linha principal

Nome do cliente:

- maior elemento textual do card;
- negrito;
- máximo contraste;
- ellipsis somente como último recurso.

À direita:

- timer para pedido operational;
- horário desejado para agendado.

### 21.3 Tipo do pedido

Pill com:

- ícone;
- Entrega, Retirada ou Local.

A pill segue a família cromática do status sem superar o nome do cliente.

### 21.4 Itens

Mostrar quantidade + nome.

Exemplo:

1x Burger Clássico  
1x Batata Rústica

Usar getOrderItemDisplayName ou contrato equivalente para preservar snapshot/variação de produto.

### 21.5 Limite de itens

O card nunca cresce além do grid.

Exibir até 4 linhas de itens.

Se ultrapassar:

- preservar as primeiras linhas;
- última indicação mostra “+ N itens”.

A escolha de quatro linhas deve ser validada visualmente em 1080p e 720p sem reduzir fonte a ponto de comprometer distância de leitura.

### 21.6 Observações

Base do card:

- separador discreto;
- ícone note;
- observação de produção.

Fonte menor que itens, porém legível.

Usar observações operacionais existentes dos itens.

Se houver múltiplas:

- mostrar no máximo duas linhas visuais;
- priorizar notas na ordem dos itens visíveis;
- quando houver mais, indicar “+ N observações”.

Nunca mostrar telefone/endereço como observação.

### 21.7 Card sem observação

Manter altura/estrutura estável.

A área pode ficar vazia/discreta sem deslocar toda a grade.

## 22. Timer do card

### 22.1 Preparing

Timer é contado desde o operationalStartAt já definido pelo domínio.

Formato:

- abaixo de 1 hora: MM:SS;
- 1 hora ou mais: H:MM:SS.

Exemplos:

00:02  
08:15  
18:45  
1:03:12

O timer não é duração de entrega e não usa scheduledFor como início quando o pedido já entrou em preparo.

### 22.2 Scheduled

Não mostrar cronômetro crescente.

Mostrar:

- ícone clock;
- horário desejado HH:mm.

## 23. Estados visuais do card

### 23.1 Novo pedido

Condição:

arrival operacional detectado nos últimos 2600 ms.

Visual:

- green;
- label NOVO PEDIDO;
- borda green;
- timer continua normal.

Depois de 2600 ms, recai para próximo do limite ou em preparo conforme timing.

### 23.2 Em preparo

Condição:

preparing, não novo, não near-limit e não atrasado.

Visual:

- blue;
- label EM PREPARO;
- borda blue.

### 23.3 Próximo do limite

Condição:

preparing, não atrasado, faltam no máximo 5 min para lateAt.

Visual:

- amber;
- label PRÓXIMO DO LIMITE;
- borda amber;
- timer amber.

### 23.4 Atrasado

Condição:

timingState late ou very-late segundo regra atual.

Visual:

- red;
- label ATRASADO;
- borda red;
- timer red.

### 23.5 Agendado

Condição:

phase scheduled.

Visual:

- neutral/scheduled;
- label AGENDADO;
- borda cinza/lilás;
- clock + HH:mm;
- sem timer de preparo.

## 24. Prioridade visual x ordenação

Cor/label não pode mudar silenciosamente a ordem oficial.

A ordem continua vindo da fila compartilhada.

O grid apenas apresenta os primeiros itens conforme regra de slots da seção 20.

Novo pedido não “salta” artificialmente para o primeiro slot só por ser novo se isso violar prioridade de prazo.

## 25. Áudio

A TV pode tocar o mesmo alerta curto de chegada operacional da Cozinha.

Regras:

- apenas para arrivals reais;
- nenhum alerta em carga inicial;
- não repetir a cada polling;
- scheduled que entra na janela pode alertar;
- som não é requisito para renderizar o painel.

Por políticas de browser, a primeira execução pode exigir gesto.

## 26. Primeira abertura e fullscreen

Depois de pareamento ou reinício do navegador, quando necessário, apresentar tela simples:

“Iniciar painel da cozinha”

Um clique deve:

1. tentar desbloquear AudioContext;
2. tentar requestFullscreen;
3. entrar no painel mesmo se fullscreen for negado.

Em dispositivos/browsers iniciados em kiosk mode, o painel continua válido sem usar Fullscreen API.

Fullscreen nunca é pré-requisito de autorização.

## 27. Estados de falha

### 27.1 Sem conexão / falha temporária

Manter último snapshot de sucesso visível.

Mostrar faixa clara:

“Sem conexão — aguardando reconexão”

ou, para erro transitório de servidor:

“Atualização interrompida — tentando reconectar”

Também mostrar horário real da última atualização recebida.

Não apagar fila por erro transitório.

### 27.2 Sessão revogada/não autorizada

Diferente de offline.

Ao receber 401/403 definitivo da sessão TV:

- apagar pedidos da memória;
- parar de mostrar snapshot;
- exibir:

“Este painel não está mais autorizado. Gere um novo acesso em Configurações > TV da Cozinha.”

### 27.3 Pareamento inválido/expirado/usado

Mensagem genérica:

“Não foi possível configurar esta TV. Gere um novo acesso no Gestão Delivery.”

Não revelar detalhes do token.

## 28. Estado vazio

Quando não houver pedidos ativos/agendados visíveis:

- manter cabeçalho, relógio e contadores;
- manter identidade visual do painel;
- centralizar estado vazio leve;
- texto:

“Nenhum pedido aguardando preparo.”

Pode usar chef-hat/kitchen discreto.

Sem animação decorativa pesada.

## 29. Configurações administrativas

Adicionar card:

TV da Cozinha

Descrição sugerida:

“Conecte uma TV para acompanhar os pedidos em tempo real.”

Ícone:

system ou chef-hat conforme contrato visual final.

### 29.1 Sem acesso

Mostrar:

- explicação curta;
- Gerar acesso da TV.

### 29.2 Link gerado

Mostrar:

- link;
- Copiar link;
- validade aproximada;
- aviso de uso único;
- Gerar novo acesso.

Não tentar recuperar segredo depois da resposta original.

### 29.3 TV ativa

Mostrar:

- “TV da cozinha ativa”;
- pareada em;
- último acesso;
- Gerar novo acesso;
- Revogar acesso.

Revogação exige confirmação.

### 29.4 Capacidades

orders.settings.view:

- pode ver estado.

orders.settings.manage:

- pode gerar;
- regenerar;
- revogar.

Sessão legada ampla continua seguindo o resolvedor atual do servidor, sem aceitar grants vindos do cliente.

## 30. Privacidade

O nome do cliente é aceito como informação operacional necessária à cozinha.

A tela da TV deve minimizar outras informações pessoais.

Não mostrar:

- sobrenome adicional se o sistema tiver uma política futura de nome reduzido, salvo decisão posterior;
- telefone;
- endereço;
- email;
- documento;
- observação administrativa de cliente.

Nesta v1, usar o display name já existente no pedido.

## 31. Testes obrigatórios

Implementação deve seguir TDD RED → GREEN nas mudanças de comportamento.

### 31.1 Segurança e backend

Cobrir:

1. admin com manage gera acesso;
2. view sem manage não gera;
3. segredo em texto claro não é persistido;
4. token expira em 30 min;
5. token válido pareia;
6. token inválido falha genericamente;
7. link usado não pareia segundo browser;
8. sessão TV é hash-only;
9. sessão TV lê state;
10. sessão TV não lê bootstrap;
11. sessão TV não lê orders admin;
12. sessão TV não acessa printing;
13. sessão TV não acessa settings admin;
14. revogação invalida próxima leitura;
15. regeneração invalida sessão/link anterior;
16. isolamento por business_id;
17. last_seen_at é throttled e não grava a cada 2 s.

### 31.2 Contrato de dados

Cobrir payload não vazio realista.

Provar que inclui:

- nome;
- tipo;
- timestamps necessários;
- itens;
- quantidades;
- notas;
- timing mínimo.

Provar ausência de:

- telefone;
- endereço;
- preço;
- total;
- pagamento;
- financeiro;
- refund;
- impressão;
- histórico finalizado.

### 31.3 Regras operacionais

Cobrir:

- immediate → preparing;
- scheduled futuro → scheduled;
- scheduled cruza scheduledPrepLeadMinutes → preparing;
- ordenação preparing preservada;
- ordenação scheduled preservada;
- atraso igual à Cozinha;
- near-limit apenas visual;
- arrival inicial não alerta;
- immediate novo alerta;
- scheduled entrando na janela alerta;
- highlight 2600 ms.

### 31.4 Frontend/bundle

Cobrir:

- /cozinha-tv seleciona bundle TV;
- bundle TV não importa App;
- TV não chama /api/bootstrap;
- TV não importa QZ/jsPDF;
- grid 3x2;
- até 6 cards;
- regra 5 preparing + 1 scheduled;
- scheduled preenche slots livres;
- overflow correto;
- nome cliente dominante;
- número secundário;
- status labels corretos;
- timers atualizam;
- header mostra hora/data;
- contadores corretos;
- offline mantém snapshot stale;
- unauthorized limpa snapshot;
- sem scroll em viewport alvo;
- tema fixo dark independente do admin.

### 31.5 Regressões

Continuam verdes:

- Cozinha administrativa;
- timing;
- order arrivals;
- printing manager;
- auth admin;
- settings;
- build;
- architecture checker.

## 32. Homologação visual obrigatória

A feature não pode ser considerada pronta apenas por testes automatizados.

Em staging, validar em navegador com viewport 1920x1080 e, se possível, numa TV 32" real.

Checklist:

1. leitura do nome a distância;
2. número do pedido claramente secundário;
3. 6 cards cabem sem scroll;
4. relógio/data legíveis;
5. contadores legíveis;
6. green/blue/amber/red/scheduled distinguíveis;
7. cada estado também possui label textual;
8. Entrega/Retirada/Local legíveis;
9. pedidos com nomes longos;
10. produto longo;
11. quatro linhas de itens;
12. overflow de itens;
13. múltiplas observações;
14. sem observação;
15. 720p;
16. 1080p;
17. fullscreen;
18. navegador em modo kiosk quando disponível;
19. offline/reconnect;
20. revogação;
21. link usado/expirado;
22. Network sem bootstrap/chunks admin pesados.

A comparação visual deve usar o mockup aprovado de 2026-09-22 como alvo.

## 33. Critérios de aceitação

A Kitchen TV v1 está aceita quando:

1. Configurações permite gerar link one-time.
2. A TV pareia sem PIN administrativo.
3. URL perde token após sucesso.
4. Link não pode ser reutilizado.
5. TV permanece conectada durante uso normal sem login diário.
6. Revogação bloqueia a sessão no refresh seguinte.
7. TV session não acessa APIs administrativas.
8. API state retorna somente dados mínimos de cozinha.
9. /cozinha-tv não carrega bootstrap/admin app.
10. TV usa exatamente as regras operacionais atuais de Orders.
11. Timing configurável do negócio é respeitado.
12. Grid 3x2 e linguagem visual do mockup são preservados.
13. Nome do cliente é dominante.
14. Número do pedido é secundário.
15. Header possui chef-hat, Cozinha, frase, contadores, hora e data.
16. Cards mostram tipo, itens e observações.
17. Novo, Em preparo, Próximo do limite, Atrasado e Agendado têm tratamento aprovado.
18. Novo pedido dura 2600 ms e não vira lifecycle novo.
19. Próximo do limite é apenas visual.
20. Até seis pedidos são mostrados sem scroll.
21. Overflow é sinalizado.
22. Polling leve atualiza em ~2 s.
23. Timer local atualiza em 1 s.
24. Offline temporário mantém snapshot sinalizado.
25. Revogado limpa snapshot.
26. TV funciona em 1080p e 720p.
27. Suite focada e suite completa ficam verdes.
28. Arquitetura, lint, build, Workers dry-run e D1 ficam verdes.
29. Staging é homologado antes de merge.
30. Produção exige autorização explícita separada.

## 34. Sequenciamento recomendado para o plano

O plano de implementação deverá ser criado somente depois da aprovação desta spec.

Ordem recomendada:

1. caracterização das regras compartilhadas de Cozinha;
2. migration e repositório Kitchen TV;
3. autenticação de pareamento/sessão TV;
4. endpoint active-only minimal;
5. Configurações > TV da Cozinha;
6. entrypoint code-split;
7. runtime/polling/offline;
8. apresentação visual KDS 32";
9. segurança e bundle-boundary hardening;
10. staging + homologação real.

## 35. Restrições de entrega

- Trabalhar em branch de feature.
- Não implementar diretamente em master.
- Strict TDD para mudanças funcionais.
- Não fazer deploy de produção durante implementação.
- Migration primeiro em local/staging.
- Novo endpoint não pode reutilizar auth admin como atalho.
- Não declarar “leve” sem verificar Network/build.
- Não declarar “fiel ao mockup” sem homologação visual.
- Não misturar redesign da Cozinha administrativa nesta feature.
- Não alterar impressão física.
- Não adicionar ações de pedido à TV por conveniência durante implementação.

## 36. Próximo gate

Este documento precisa de aprovação explícita do produto.

Depois da aprovação:

1. realizar auto-revisão final contra master atual;
2. escrever plano detalhado TDD;
3. mapear tarefas, arquivos, RED/GREEN e gates;
4. somente então iniciar implementação.

A aprovação desta spec não autoriza merge nem deploy de produção.


## 37. Auto-revisão da spec

Revisão executada em 2026-09-22 contra master em 7d5a9d2507968dd96dae81f5f1d61431a6e42292.

Verificações concluídas:

- paths de Orders apontam para src/domains/orders, sem depender do antigo src/pages/Orders.jsx;
- Kitchen TV permanece UI própria e não modo condicional dentro de Orders;
- /cozinha-tv precisa selecionar bundle próprio antes de importar App;
- /api/bootstrap é proibido na TV;
- QZ/jsPDF/printing administrativo são proibidos no bundle TV;
- sessão TV é separada de auth admin;
- segredo de pareamento usa fragmento de URL e POST, evitando query string;
- dados pessoais/financeiros possuem denylist explícita e o endpoint deve usar allowlist;
- timing configurável atual do negócio é preservado;
- “Novo pedido” é apresentação temporária de 2600 ms, não lifecycle;
- “Próximo do limite” é apresentação local e não altera regras de domínio;
- layout alvo está fixado em 3x2 com no máximo 6 cards;
- nome do cliente é dominante e número do pedido secundário;
- fonte Inter e estratégia de ícones são compatíveis com o código atual;
- staging, merge e produção continuam gates separados.

Não foram identificadas decisões de produto obrigatórias pendentes para escrever o plano.

### 37.1 Referência visual versionada

Antes da primeira tarefa de implementação da UI, o plano deve incluir um passo explícito para versionar no repositório uma cópia do mockup 32" aprovado em 2026-09-22, em pasta de referência documental, por exemplo:

docs/superpowers/references/kitchen-tv-32-approved-reference.jpg

A implementação e a homologação visual devem comparar a tela real contra esse asset.

A descrição textual desta spec é normativa mesmo que o asset ainda não tenha sido adicionado na fase de design.


## 38. Aprovação do produto

A spec foi aprovada explicitamente pelo responsável do produto em 2026-09-22.

Essa aprovação autoriza a escrita do plano detalhado de implementação. Não autoriza implementação automática, merge ou deploy de produção.
