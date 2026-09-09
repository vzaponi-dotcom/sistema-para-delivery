# Gestão Delivery — Impressão Térmica de Pedidos e Ticket Digital

> **SUPERSEDED (2026-09-08):** Documento histórico substituído pela arquitetura QZ centralizada. Consulte `docs/superpowers/specs/2026-09-08-centralized-qz-print-queue-design.md` e `docs/superpowers/plans/2026-09-08-centralized-qz-print-queue-plan.md`.

Data: 2026-09-03

## Objetivo

Adicionar ao Gestão Delivery um subsistema confiável de impressão de pedidos para cozinha e embalagem, compatível com impressora térmica ESC/POS de 58 mm, inicialmente validado com a Goldensky MTP5, sem acoplar o domínio de pedidos a um modelo específico de impressora.

A primeira versão deve entregar:

1. um único Ticket Oficial do Pedido, com valores e dados customer-safe;
2. impressão manual e automática para pedidos de qualquer origem;
3. duas cópias por padrão, uma para cozinha e outra para acompanhar a embalagem;
4. uma única Estação de Impressão Principal responsável pelos trabalhos automáticos;
5. impressão ESC/POS via Web Serial sobre Bluetooth Classic/RFCOMM/SPP em Chrome compatível no Windows e Android;
6. pré-visualização do ticket no sistema;
7. geração de PDF do mesmo documento lógico para uso digital futuro;
8. rastreabilidade por trabalhos de impressão persistidos no backend;
9. tratamento explícito de falhas, sem retentativas automáticas que possam produzir duplicidade.

## 1. Premissas do hardware alvo

A impressora inicial é a Goldensky MTP5 com as seguintes características relevantes:

- papel de 58 mm;
- largura efetiva de impressão de 48 mm;
- 384 dots por linha;
- 203 DPI / 8 dots por mm;
- protocolo ESC/POS;
- Bluetooth 2.0 com Serial Port Profile (SPP) / RFCOMM;
- USB disponível como alternativa física em plataformas compatíveis;
- tabelas de caracteres que incluem páginas capazes de representar texto em português.

O sistema não deve assumir que toda impressora futura terá exatamente as mesmas capacidades. A MTP5 será representada por um perfil 58 mm/ESC-POS específico atrás de interfaces reutilizáveis.

## 2. Decisão de arquitetura

A solução adotada é uma arquitetura em camadas:

`Pedido -> OrderPrintDocument -> Renderer -> PrinterTransport`

### 2.1 OrderPrintDocument

É a representação canônica e independente de dispositivo do conteúdo que será mostrado ou impresso.

Nenhum renderer deve ler diretamente campos dispersos do pedido para decidir conteúdo de negócio. A transformação de pedido para documento acontece uma única vez.

### 2.2 Renderers

O mesmo `OrderPrintDocument` alimenta três saídas:

- `EscPos58mmRenderer`: gera bytes/comandos ESC/POS;
- `TicketPreviewRenderer`: gera a pré-visualização HTML no sistema;
- `PdfOrderRenderer`: gera o arquivo PDF digital.

Os três renderers devem preservar o mesmo conteúdo oficial. Diferenças permitidas são apenas de apresentação e aproveitamento de espaço.

### 2.3 PrinterTransport

O envio físico não faz parte do renderer ESC/POS. O renderer gera bytes; um `PrinterTransport` é responsável por entregá-los ao dispositivo.

A V1 terá um transporte Web Serial capaz de trabalhar com Bluetooth RFCOMM/SPP em Chrome compatível.

A abstração deve permitir outros transportes no futuro sem alterar o documento ou o renderer, por exemplo USB, agente local, wrapper nativo ou outro protocolo ESC/POS.

## 3. Compatibilidade Web Serial

A V1 será um único aplicativo web para Windows e Android, sem wrapper Android obrigatório.

A premissa técnica validada é:

- Chrome desktop oferece Web Serial sobre Bluetooth Classic RFCOMM/SPP desde o Chrome 117;
- Chrome Android oferece Web Serial sobre Bluetooth RFCOMM desde o Chrome 138;
- Web Serial exige contexto seguro (HTTPS);
- a primeira escolha de dispositivo via `navigator.serial.requestPort()` exige interação explícita do usuário;
- depois da autorização, `navigator.serial.getPorts()` pode recuperar portas às quais aquela origem já possui acesso.

A interface deve detectar suporte a `navigator.serial` e apresentar incompatibilidade de forma clara em navegadores não suportados, sem quebrar o restante do sistema.

Referências técnicas:

- Chrome for Developers, “Serial over Bluetooth on the web”: https://developer.chrome.com/blog/serial-over-bluetooth
- Chrome for Developers, Chrome 138 release notes: https://developer.chrome.com/release-notes/138
- MDN, Web Serial API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API

## 4. Ticket Oficial do Pedido

Haverá um único formato lógico oficial para cozinha, embalagem e versão digital.

As duas cópias físicas têm o mesmo conteúdo. Não existem nesta V1 modelos separados “cozinha” e “cliente”.

### 4.1 Conteúdo

O documento deve suportar:

- nome da loja (`Amor & Sabor`);
- número/identificação amigável do pedido em destaque;
- data e hora;
- tipo: Entrega, Retirada ou Local;
- nome do cliente ou identificação local aplicável;
- telefone quando disponível e aplicável;
- endereço quando o tipo exigir entrega;
- itens com quantidade destacada;
- nome do produto;
- apresentação/tamanho/unidade quando aplicável;
- complementos, modificadores ou observações por item quando existirem no modelo do pedido;
- observação geral do pedido;
- subtotal;
- taxa de entrega quando aplicável;
- desconto ou acréscimo quando aplicável;
- total em destaque;
- forma de pagamento quando disponível;
- estado de pagamento, por exemplo Pago ou Pendente;
- identificação da cópia (`CÓPIA 1/2`, `CÓPIA 2/2`);
- identificação do pedido novamente no rodapé;
- mensagem final: `Obrigado pela compra! Agradecemos a preferência.`

### 4.2 Conteúdo customer-safe

A V1 considera as observações atuais do pedido seguras para serem vistas pelo cliente.

Nenhuma anotação exclusivamente interna, financeira administrativa, custo, margem ou comentário privado deve ser introduzido no Ticket Oficial sem futura separação explícita entre observação pública e nota interna.

### 4.3 Layout térmico

O perfil MTP5 deve considerar 48 mm úteis e 384 dots por linha.

O renderer deve priorizar legibilidade sobre densidade:

- quantidade e produto com maior destaque;
- observações claramente separadas;
- total em destaque;
- quebras automáticas de linhas longas;
- endereço e observações nunca devem ser truncados silenciosamente;
- caracteres portugueses devem ser preservados por uma code page compatível do firmware.

A implementação deve ter testes determinísticos para largura lógica das linhas. O número exato de caracteres por linha depende da fonte ESC/POS utilizada; o perfil da MTP5 deve declarar essa capacidade em vez de espalhar números mágicos pelo código.

## 5. Impressão automática e manual

### 5.1 Regra geral

Todo novo pedido elegível para cozinha usa o mesmo subsistema de impressão, independentemente da origem.

Isso inclui:

- pedidos criados manualmente no sistema;
- pedidos que futuramente forem criados pelo cardápio digital;
- outras origens futuras que usem o contrato oficial de criação de pedidos.

Sincronização, reload, retorno de aba ou polling nunca podem criar um novo trabalho automático para um pedido que já possui o trabalho inicial correspondente.

### 5.2 Configuração e criação do job automático

- impressão automática é configurável na Estação Principal;
- quantidade de cópias é configurável entre 1 e 2;
- padrão recomendado: 2 cópias;
- quando existir Estação Principal com impressão automática ativa no momento da criação do pedido, o backend cria o job automático inicial;
- quando a impressão automática estiver desligada, ou não houver Estação Principal apta, nenhum job automático retroativo deve ser criado para aquele pedido;
- reativar a impressão automática afeta apenas pedidos novos criados depois da ativação;
- pedidos criados enquanto a automação estava desligada continuam podendo ser impressos manualmente.

Essa regra impede que ligar a automação posteriormente descarregue silenciosamente uma fila histórica de pedidos.

### 5.3 Impressão manual

Pedidos devem oferecer ação `Imprimir pedido`.

Quando já houver impressão concluída, a ação é tratada como reimpressão e deve usar confirmação simples antes de gerar novo trabalho.

Reimpressão nunca reutiliza nem altera o job histórico anterior; cria um novo `printJob`.

## 6. Trabalhos de impressão persistidos

A impressão automática não deve depender apenas do frontend “detectar pedido novo”.

O backend deve persistir trabalhos de impressão em uma entidade `print_jobs` associada ao negócio e ao pedido.

### 6.1 Campos conceituais

A modelagem deve contemplar no mínimo:

- `id`;
- `business_id`;
- `order_id` quando o job for de pedido;
- `type`: `order` ou `test`;
- `trigger`: `automatic` ou `manual`;
- `status`;
- `copies_requested`;
- `copies_printed` ou quantidade transmitida com sucesso;
- `station_id` quando assumido;
- snapshot imutável do `OrderPrintDocument`;
- `created_at`;
- `processing_started_at`;
- `processed_at`;
- `last_error`/código de falha quando aplicável.

### 6.2 Estados

Os estados funcionais são:

- `pending`: aguardando estação principal;
- `processing`: assumido por uma estação;
- `printed`: bytes do trabalho transmitidos com sucesso ao transporte;
- `failed`: falha conhecida na conexão ou escrita;
- `requires_attention`: estado incerto ou trabalho automático antigo que não deve ser retomado silenciosamente.

### 6.3 Idempotência do job automático

Quando a configuração exigir impressão automática, a criação de pedido e a criação de seu job automático inicial devem fazer parte da mesma operação lógica do backend, com proteção de idempotência.

Para cada pedido deve existir no máximo um job automático inicial. Repetição da requisição de criação, polling ou reconciliação não pode produzir jobs automáticos duplicados.

Quando a automação não estiver ativa no momento da criação, o pedido não recebe job automático inicial e não deve ganhá-lo retroativamente.

Jobs manuais são eventos deliberadamente novos e podem coexistir em qualquer quantidade no histórico.

### 6.4 Claim e concorrência

A estação principal precisa “assumir” um job antes de imprimir. O claim deve ser decidido pelo backend de forma atômica.

Dois dispositivos nunca podem obter simultaneamente autorização para processar o mesmo job.

Se uma estação desaparecer enquanto um job estiver em `processing`, o sistema não deve simplesmente reimprimir ao expirar um lease, porque existe a possibilidade de os bytes já terem chegado à impressora antes da queda. Nesse caso, o job deve migrar para `requires_attention` e exigir decisão manual.

A prioridade é evitar duplicidade física em cenários de resultado incerto.

## 7. Snapshot imutável

Cada `printJob` armazena o snapshot exato do `OrderPrintDocument` que deve processar.

### 7.1 Nova tentativa do mesmo job

Quando uma falha conhecida permite ao usuário escolher `Tentar novamente`, o sistema usa o mesmo snapshot daquele job.

Essa tentativa é sempre iniciada manualmente; nunca existe retry automático de um job `failed`.

### 7.2 Reimpressão

Quando o usuário escolhe `Reimprimir pedido`, o sistema cria novo job e novo snapshot a partir do estado oficial atual do pedido.

Isso permite que uma reimpressão posterior reflita, por exemplo, um pagamento que passou de Pendente para Pago, sem alterar o registro histórico do que foi tentado originalmente.

## 8. Estações de impressão

O backend terá uma entidade `print_stations` separada por `business_id`.

Campos conceituais:

- `id`;
- `business_id`;
- `name`;
- `platform`: `windows`, `android` ou valor equivalente detectado/selecionado;
- `is_primary`;
- `auto_print_enabled`;
- `default_copies`;
- `last_seen_at`;
- `created_at`;
- `updated_at`.

### 8.1 Estação Principal

Existe no máximo uma Estação de Impressão Principal por negócio.

Somente ela pode assumir jobs automáticos.

Outros dispositivos podem:

- visualizar estado de impressão;
- gerar PDF;
- abrir pré-visualização;
- criar trabalhos manuais de impressão/reimpressão, quando autorizados pelo fluxo atual do sistema.

A unicidade da estação principal deve ser protegida também no backend/banco, não apenas por UI.

### 8.2 Pareamento físico local

O servidor não deve armazenar detalhes frágeis da permissão Bluetooth.

Responsabilidades centrais:

- saber qual estação é principal;
- configurações operacionais;
- histórico e jobs.

Responsabilidades locais do navegador/dispositivo:

- permissão Web Serial;
- porta autorizada;
- associação da estação com a impressora selecionada;
- estado de conexão atual.

Na inicialização, a estação tenta localizar entre `navigator.serial.getPorts()` uma porta previamente autorizada. Se a associação estiver ausente ou ambígua, exige nova seleção explícita pelo usuário.

## 9. Instalação e configuração

A interface de impressão deve oferecer um fluxo simples:

1. parear a MTP5 no sistema operacional;
2. abrir Configurações de Impressão;
3. clicar em `Conectar impressora`;
4. selecionar a porta/dispositivo no prompt do Chrome;
5. executar `Testar impressão`;
6. após teste válido, opcionalmente `Definir como estação principal`;
7. configurar impressão automática e quantidade padrão de cópias.

### 9.1 Tela de configuração

Deve mostrar de forma clara:

- nome da estação;
- plataforma;
- estação principal: sim/não;
- impressão automática: ligada/desligada;
- quantidade de cópias;
- impressora/porta disponível quando identificável;
- estado atual: conectada, desconectada, não configurada ou incompatível;
- botão Conectar/Trocar impressora;
- botão Testar impressão;
- último teste/erro relevante.

## 10. Trabalho de teste

`Testar impressão` não cria pedido falso.

Ele pode criar um job `type = test` ou executar caminho controlado equivalente que passe pelo mesmo renderer/transporte relevante.

Conteúdo sugerido:

```text
AMOR & SABOR

TESTE DE IMPRESSÃO

Impressora configurada
com sucesso.

<data/hora>
```

O teste deve validar pelo menos conexão, escrita ESC/POS básica, quebra de linha e caracteres acentuados usados pelo sistema.

## 11. Falhas e alertas

Falha de impressão nunca bloqueia:

- criação do pedido;
- visualização na cozinha;
- mudança de status;
- pagamento;
- cancelamento;
- demais operações do pedido.

### 11.1 Sem retentativa automática após falha

Quando conexão ou escrita falhar:

- job passa para `failed`;
- erro é persistido em forma segura e útil para diagnóstico;
- UI exibe alerta visível;
- usuário recebe ação manual de tentar novamente/reimprimir conforme o caso;
- o sistema não fica tentando sozinho repetidamente.

### 11.2 Jobs antigos

Um job automático `pending` por mais de 10 minutos não deve ser impresso silenciosamente quando a estação voltar.

Ele passa para `requires_attention` e oferece ação manual `Imprimir agora`.

O limiar de 10 minutos é regra da V1 e deve ficar centralizado/configurável em código, não duplicado por telas.

### 11.3 Significado de “Impresso”

Para a V1, `printed` significa que o sistema abriu o transporte e concluiu a transmissão dos bytes do trabalho sem erro reportado.

Não deve afirmar que existe confirmação física absoluta de papel impresso quando o hardware/protocolo não fornece esse nível de feedback.

A UI pode usar o rótulo amigável `Impresso`, mas logs e testes devem respeitar essa semântica.

## 12. Experiência no pedido

O card/detalhe do pedido deve apresentar estado discreto de impressão, sem competir com o status operacional do preparo.

Estados amigáveis esperados:

- `Pendente de impressão`;
- `Imprimindo`;
- `Impresso`;
- `Falha na impressão`;
- `Requer atenção`.

Detalhes opcionais ao expandir:

- horário da última tentativa;
- cópias solicitadas;
- estação;
- mensagem de erro resumida;
- histórico de reimpressões.

Ações:

- `Visualizar ticket`;
- `Imprimir pedido` ou `Reimprimir`;
- `Gerar PDF`;
- `Tentar novamente`/`Imprimir agora` quando o estado exigir intervenção.

A confirmação de reimpressão deve informar a quantidade de cópias que será gerada.

## 13. PDF e pré-visualização

A V1 inclui arquivo digital, mas não envio automático ao cliente.

### 13.1 Pré-visualização

A prévia deve representar o mesmo `OrderPrintDocument` e permitir conferência antes de impressão manual ou download.

Não é requisito que ela seja pixel-perfect em relação ao mecanismo térmico; o conteúdo e a hierarquia devem ser equivalentes.

### 13.2 PDF

O PDF:

- usa o mesmo documento canônico;
- contém valores e pagamento, como o ticket físico aprovado;
- pode usar largura/layout digital mais confortável, sem simular obrigatoriamente 58 mm;
- deve ser legível em celular;
- deve ter nome de arquivo estável e amigável, por exemplo `pedido-184.pdf`.

O arquivo será preparado para futura integração com envio ao cliente, mas nenhuma automação de WhatsApp faz parte desta V1.

## 14. Integração com o estado atual do sistema

O `App` continua sendo a fonte central das coleções de negócio já existentes.

O módulo de impressão deve seguir as regras já aprovadas de sincronização:

- alterações locais relevantes aparecem imediatamente após resposta oficial da API;
- outros dispositivos convergem por sincronização em segundo plano;
- detectar um pedido via polling não equivale a criar um novo job;
- a lista de jobs/estado de impressão pode ter sincronização própria adequada à operação da estação, sem duplicar a coleção de pedidos.

O processo de impressão automática deve consumir jobs oficiais do backend, não inferir “novo pedido” comparando arrays locais.

## 15. Persistência e migração

Uma nova migration D1 deve criar as estruturas necessárias para `print_stations` e `print_jobs`, seguindo o padrão atual de separação por `business_id`.

Requisitos de integridade:

- foreign keys para negócio, pedido e estação quando aplicável;
- índices para consulta de jobs pendentes por negócio/status/data;
- índice para histórico por pedido;
- proteção de unicidade do job automático inicial;
- proteção para no máximo uma estação principal por negócio;
- timestamps oficiais do servidor;
- snapshot imutável depois que o job é criado.

A implementação pode escolher os nomes físicos finais de colunas, desde que preserve este contrato funcional.

## 16. Segurança e privacidade

- endpoints de impressão, stations e jobs exigem a mesma autenticação do negócio;
- todas as leituras/escritas são escopadas por `business_id` da sessão, nunca por valor confiado do cliente;
- snapshot não deve incluir dados além dos necessários para o ticket aprovado;
- mensagens de erro persistidas não devem registrar tokens, credenciais, PINs ou conteúdo sensível do navegador;
- o backend nunca recebe a senha de pareamento Bluetooth da MTP5.

## 17. Estratégia de testes

A implementação deve seguir TDD estrito: teste RED antes de cada alteração relevante, implementação mínima, depois refatoração segura.

### 17.1 Domínio/documento

Testar:

- pedido Entrega, Retirada e Local;
- campos opcionais ausentes;
- valores em BRL;
- desconto e acréscimo;
- estado de pagamento;
- observações;
- snapshot estável;
- mensagem de agradecimento.

### 17.2 Renderer 58 mm

Testar:

- largura lógica;
- quebra de nomes/endereço/observações;
- duas cópias com identificação correta;
- 1 cópia configurada;
- total em destaque no modelo de comandos;
- code page/acentuação escolhida pelo perfil;
- bytes ESC/POS determinísticos para fixture conhecida.

### 17.3 Jobs/backend

Testar:

- criação idempotente do job automático junto ao pedido quando a automação estiver ativa;
- ausência de job automático quando automação estiver desligada;
- reativação não cria jobs retroativos;
- polling/repetição não duplica job;
- reimpressão cria novo job;
- claim concorrente permite apenas uma estação;
- apenas estação principal assume automático;
- transições válidas de estado;
- falha não é retomada automaticamente;
- job antigo vira `requires_attention`;
- processing abandonado/incerto não é reimpresso automaticamente;
- isolamento por `business_id`.

### 17.4 Transporte

Criar `FakePrinterTransport` para testes sem hardware.

Testar:

- sucesso de escrita;
- falha ao abrir porta;
- desconexão durante escrita;
- porta não autorizada;
- Web Serial ausente;
- erro de transmissão propagado para o job sem afetar o pedido.

### 17.5 UI

Testar:

- estados de impressão no pedido;
- confirmação de reimpressão;
- alerta de falha;
- configuração de estação;
- quantidade de cópias;
- suporte/incompatibilidade de navegador;
- preview;
- geração do PDF;
- responsividade mobile entre 320 e 480 px.

### 17.6 Aceitação com hardware real

Antes de considerar a funcionalidade concluída, executar teste manual com a MTP5 real em:

- Chrome atualizado no Windows;
- Chrome Android versão 138 ou superior.

Validar:

- pareamento;
- seleção via Web Serial;
- reconexão/autorização previamente concedida;
- impressão de 1 e 2 cópias;
- acentos;
- quebra de linhas;
- texto em negrito/tamanho quando suportado;
- impressão de pedido longo;
- falha por impressora desligada/desconectada;
- retomada manual sem duplicidade;
- PDF e preview equivalentes ao conteúdo físico.

## 18. Critérios de aceite

A V1 está funcionalmente aceita quando:

1. pedido criado com automação ativa cria no máximo um job automático inicial;
2. pedido criado com automação desligada não recebe job automático retroativo;
3. somente a estação principal pode processar jobs automáticos;
4. a MTP5 imprime o ticket aprovado com 2 cópias por padrão;
5. impressão manual e reimpressão funcionam com confirmação adequada;
6. falha de impressão nunca bloqueia o pedido;
7. nenhuma falha dispara loop de retentativa automática;
8. trabalhos antigos/incertos exigem ação humana antes de nova impressão;
9. histórico de jobs permite identificar sucesso, falha, estação e horário;
10. preview e PDF saem do mesmo documento canônico;
11. ticket contém valores, pagamento, observações e mensagem de agradecimento;
12. Chrome/Windows e Chrome/Android compatíveis conseguem utilizar a mesma aplicação web;
13. navegador incompatível recebe orientação clara sem quebrar o restante do Gestão Delivery;
14. testes automatizados, lint e build permanecem verdes;
15. a aceitação com a MTP5 física é concluída nos dois ambientes alvo.

## 19. Fora de escopo

- envio automático do PDF por WhatsApp;
- integração com API oficial do WhatsApp;
- múltiplas impressoras por setor/cozinha;
- roteamento de itens por praça ou categoria;
- impressão em impressora fiscal;
- NFC-e, SAT ou documento fiscal;
- impressão automática por dispositivo secundário como failover;
- reexecução automática de jobs com resultado físico incerto;
- aplicativo Android nativo obrigatório;
- agente local de impressão;
- edição livre de templates pelo usuário;
- notas internas privadas separadas de observações do pedido.

## 20. Evoluções futuras previstas pela arquitetura

Sem fazer parte da V1, a separação escolhida permite posteriormente:

- enviar o PDF ao cliente;
- introduzir mais de um template;
- separar ticket de cozinha e cliente se surgir necessidade real;
- imprimir por praça/setor;
- adicionar outros perfis ESC/POS;
- usar USB ou agente local;
- criar failover explícito entre estações;
- introduzir notas internas fora do Ticket Oficial.

Essas evoluções não devem ser implementadas antecipadamente.
