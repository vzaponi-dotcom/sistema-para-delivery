# Design: auditoria completa de UX mobile

Data: 2026-09-02

## Objetivo

Consolidar a experiência mobile do sistema Gestão Delivery para funcionar de forma robusta entre 320 px e 480 px de largura, sem depender de um aparelho específico.

A rodada não será limitada a correções visuais. Ela cobrirá layout, ergonomia, navegação, toque, teclado, formulários, modais, selects, rolagem, estados de loading e erro, densidade visual, hierarquia e consistência entre telas.

A identidade visual atual será preservada, mas haverá liberdade para ajustar espaçamentos, tipografia, tamanho de controles, cards, botões e densidade quando isso melhorar a usabilidade mobile.

## Decisões aprovadas

- O suporte mobile alvo será de 320 px a 480 px de largura.
- A solução será baseada em uma fundação mobile compartilhada seguida de auditoria tela por tela.
- Não haverá redesign mobile separado nem duplicação da interface desktop.
- A identidade visual atual será mantida.
- Ajustes visuais são permitidos quando melhorarem a hierarquia, a legibilidade ou a ergonomia.
- A revisão cobrirá comportamento e aparência, não apenas quebras de layout.
- Problemas repetidos em mais de uma tela deverão ser resolvidos por regra, token ou componente compartilhado sempre que possível.
- Correções específicas por aparelho devem ser evitadas.
- O desktop não deve sofrer regressões.
- A execução será feita em blocos pequenos, com validação entre blocos.

## Abordagem escolhida

A estratégia aprovada é **base mobile comum + revisão tela por tela**.

O trabalho começa consolidando regras compartilhadas de viewport, safe area, navegação fixa, touch targets, formulários, modais, bottom sheets, selects, scroll e teclado. Depois, cada tela será auditada sobre essa base.

Essa abordagem foi escolhida porque reduz a repetição de correções locais e evita que problemas de CSS, viewport ou componentes compartilhados reapareçam em aparelhos diferentes.

## Faixa de viewport e referências de teste

A interface deverá funcionar entre 320 px e 480 px de largura.

As larguras de referência para revisão serão:

- 320 px;
- 360 px;
- 390/393 px;
- 480 px.

Essas larguras representam aparelhos compactos, Androids comuns, iPhones modernos e celulares maiores.

A validação não ficará limitada a essas quatro larguras; elas são pontos de referência para detectar problemas de composição e regressão.

## Fundação mobile compartilhada

### Tokens e medidas comuns

Os valores que definem comportamento estrutural mobile devem ser centralizados quando forem compartilhados, especialmente:

- altura efetiva do menu inferior;
- espaçamento de segurança acima do menu;
- safe area inferior;
- espaçamentos horizontais de página;
- raio e padding de controles;
- altura mínima de touch targets;
- limites de altura de modal e bottom sheet;
- z-index de camadas fixas.

O objetivo é reduzir números repetidos e inconsistentes em arquivos diferentes.

### Viewport e overflow

Em mobile:

- nenhuma tela deve criar scroll horizontal no documento;
- animações horizontais não podem deslocar a viewport;
- componentes fixos não devem depender de ancestrais transformados;
- o conteúdo deve respeitar o menu inferior e a safe area;
- componentes flutuantes devem permanecer presos à viewport real.

### Navegação inferior

O menu inferior deve:

- permanecer fixo e estável durante scroll vertical e gestos horizontais;
- ocupar a largura correta da viewport;
- respeitar `env(safe-area-inset-bottom)`;
- manter áreas de toque confortáveis;
- não ser encoberto por FABs, modais ou conteúdo;
- não produzir jitter visual durante animações de página.

### Touch targets

Ações importantes devem ter área de toque de aproximadamente 44–48 px no menor eixo sempre que possível.

Controles adjacentes devem ter espaçamento suficiente para evitar toques acidentais.

Estados de interação devem funcionar por toque e teclado, sem depender exclusivamente de `hover`.

### Formulários

Os formulários mobile devem:

- usar composição de uma coluna quando a largura não comportar duas colunas de forma confortável;
- preservar labels e mensagens de erro legíveis;
- evitar fontes pequenas que causem zoom automático no iPhone;
- usar tipos de input e `inputmode` adequados quando aplicável;
- manter botões de ação alcançáveis mesmo com o teclado aberto;
- evitar que o teclado cubra a ação necessária para concluir o fluxo;
- manter espaço suficiente para rolar o campo ativo para a área visível.

### Modais

Modais devem:

- ser ancorados à viewport real;
- permanecer centralizados independentemente do scroll da página;
- respeitar limites de `dvh`;
- permitir scroll interno quando o conteúdo exceder a altura disponível;
- manter título e ações utilizáveis em telas pequenas;
- não ser recortados por containers ancestrais.

### Bottom sheets

Bottom sheets devem:

- ser renderizados em camada de viewport;
- respeitar a safe area;
- ter altura máxima compatível com `dvh`;
- rolar internamente quando necessário;
- conter o overscroll sem movimentar a página por trás;
- permitir fechar de forma clara e acessível.

### Selects e listas de opções

Seletores devem:

- usar apresentação adequada ao mobile;
- manter todas as opções acessíveis sem exigir scroll da página por trás;
- usar scroll interno quando a lista for longa;
- não abrir fora da área visível;
- preservar foco e acessibilidade.

### Teclado virtual

Fluxos com inputs devem ser revisados considerando a redução real da área visível quando o teclado é aberto.

Nenhuma ação essencial deve ficar inacessível por causa do teclado.

Quando necessário, o layout deve permitir scroll interno ou reposicionamento natural em vez de depender de offsets fixos por aparelho.

### Movimento e gestos

A navegação por swipe deve:

- reconhecer gestos horizontais deliberados;
- não conflitar com scroll vertical;
- ignorar áreas interativas, modais, listas e controles apropriados;
- usar animação curta e suave;
- respeitar `prefers-reduced-motion`.

## Auditoria tela por tela

### 1. Novo Pedido

É a tela de maior prioridade operacional.

A revisão deve cobrir:

- seleção do tipo de pedido;
- identidade de cliente, nome local ou mesa;
- busca e seleção de produtos;
- filtros e catálogo;
- estado de produto adicionado;
- carrinho;
- alteração de quantidade;
- observações por item;
- desconto, acréscimo e taxa de entrega;
- pagamento;
- resumo final;
- botões de finalizar;
- comportamento com teclado aberto;
- redução de altura e espaçamento quando blocos estiverem excessivamente altos;
- legibilidade de textos longos e nomes de produtos.

A ação principal do fluxo deve permanecer clara e alcançável.

### 2. Pedidos / Cozinha

A revisão deve cobrir:

- leitura rápida dos cards;
- cliente/mesa/local;
- itens do pedido;
- observações;
- status;
- tempo decorrido e urgência;
- destaque de pedido novo;
- atualização automática sem deslocamentos inesperados;
- controles de som;
- expansão de detalhes;
- botões operacionais;
- textos longos de entrega e finalização.

A densidade deve favorecer leitura rápida durante operação.

### 3. A Receber

A revisão deve cobrir:

- agrupamento por cliente ou mesa;
- valores pendentes;
- detalhes do pedido;
- modal de pagamento;
- seletor de forma de pagamento;
- pagamento consolidado de mesa;
- botões de cobrança;
- status de pagamento;
- listas longas dentro de overlays;
- teclado quando houver entrada manual.

Nenhum modal ou seletor deve depender da posição de scroll da página.

### 4. Dashboard

A revisão deve cobrir:

- cards de indicadores;
- seletor de período;
- gráficos;
- labels e legendas;
- hierarquia das informações;
- máscara de valores;
- densidade vertical;
- botão flutuante de Novo Pedido;
- relação entre FAB, conteúdo e menu inferior.

Os gráficos devem continuar legíveis em 320 px sem provocar overflow horizontal.

### 5. Clientes

A revisão deve cobrir:

- lista compacta tipo agenda;
- busca;
- leitura de nome, telefone e endereço;
- abertura das ações;
- bottom sheet de ações;
- cadastro;
- edição;
- máscaras de telefone;
- detecção de duplicidade;
- teclado;
- exclusão confirmada.

A lista deve continuar eficiente para uso com uma mão.

### 6. Produtos

A revisão deve cobrir:

- busca;
- filtros;
- categorias e ícones;
- lista de produtos;
- nome, categoria, apresentação e preço;
- cadastro;
- edição;
- categoria;
- unidade/apresentação;
- tamanho, volume ou peso;
- preço;
- preview;
- estados selecionados;
- ações de editar e excluir;
- teclado e selects.

### 7. Financeiro

A revisão deve cobrir:

- resumo financeiro;
- lista de movimentações;
- valores positivos e negativos;
- categorias;
- filtros quando existentes;
- cadastro de movimentação;
- campos monetários;
- teclado numérico;
- ações e confirmações.

### 8. Menu Mais e navegação secundária

A revisão deve cobrir:

- acesso a A Receber e Financeiro;
- seleção de tema;
- logout;
- bottom sheet;
- área de toque;
- safe area;
- consistência com o menu inferior;
- foco e fechamento do overlay.

## Prioridade dos problemas

Todo problema encontrado será classificado em um dos seguintes níveis:

### P0 — bloqueador

Problema que impede uma ação, esconde funcionalidade essencial, causa perda de acesso a controles ou torna um fluxo impossível de concluir.

Exemplos:

- botão final inacessível;
- modal cortado sem possibilidade de scroll;
- seletor cuja opção não pode ser escolhida;
- menu inferior cobrindo uma ação necessária.

### P1 — impacto alto de usabilidade

Problema que não bloqueia totalmente o fluxo, mas atrapalha significativamente a operação.

Exemplos:

- touch targets pequenos;
- teclado cobrindo campos importantes;
- card excessivamente alto;
- texto crítico truncado;
- scroll ou gesto instável.

### P2 — refinamento

Melhoria de consistência, densidade, acabamento visual ou ergonomia que não prejudica o uso principal.

A ordem de execução deve priorizar todos os P0, depois P1, e por último o passe de refinamento P2.

## Estratégia de implementação

A execução será dividida em quatro blocos.

### Bloco 1 — fundação compartilhada

- tokens mobile;
- viewport e overflow;
- safe areas;
- menu inferior;
- componentes fixos e flutuantes;
- modais;
- bottom sheets;
- selects;
- touch targets;
- teclado e formulários;
- testes de regressão da base.

### Bloco 2 — fluxos operacionais críticos

- Novo Pedido;
- Pedidos/Cozinha;
- A Receber.

### Bloco 3 — demais telas

- Dashboard;
- Clientes;
- Produtos;
- Financeiro;
- Menu Mais.

### Bloco 4 — consistência final

- tipografia;
- espaçamentos;
- densidade;
- hierarquia;
- feedback de toque;
- loading;
- erro;
- estados vazios;
- animações;
- revisão cruzada entre 320 e 480 px.

Cada bloco deve ser validado antes de iniciar o próximo.

## Testes e prevenção de regressão

A rodada deve manter e ampliar a cobertura automatizada existente.

Os testes devem proteger, no mínimo:

- menu inferior fixo e safe-area aware;
- ausência de regras conflitantes para elementos fixos críticos;
- FAB acima do menu;
- modal e bottom sheet renderizados fora de containers transformados;
- limites de altura baseados em viewport dinâmica;
- scroll interno de overlays;
- prevenção de overflow horizontal;
- swipe deliberado sem conflito com controles;
- suporte a `prefers-reduced-motion`;
- controles mobile mantendo labels e ações essenciais;
- regras estruturais que forem centralizadas em tokens.

Quando um bug real de aparelho revelar uma lacuna de cobertura, deve ser criado um teste de regressão antes ou junto da correção.

## Critérios de aceite

A rodada mobile será considerada concluída quando:

- não houver scroll horizontal involuntário entre 320 px e 480 px;
- nenhum botão, campo, modal, seletor ou conteúdo essencial ficar escondido pelo menu inferior;
- elementos fixos permanecerem estáveis durante scroll e swipe;
- o teclado não impedir a conclusão de fluxos essenciais;
- modais e selects permanecerem utilizáveis em telas pequenas;
- listas longas em overlays rolarem internamente;
- touch targets importantes forem confortáveis;
- textos críticos não forem cortados de forma que prejudiquem a operação;
- ações principais tiverem hierarquia clara;
- safe areas forem respeitadas;
- o desktop continuar funcional e visualmente consistente;
- testes automatizados estiverem verdes;
- lint estiver sem erros;
- build de produção estiver verde;
- validação do Worker estiver verde.

## Validação manual

Além dos testes automatizados, cada bloco deve passar por revisão manual nas larguras de referência.

A validação manual deve observar:

- primeiro carregamento;
- scroll vertical longo;
- swipe de navegação;
- abertura e fechamento de overlays;
- teclado aberto em campos do topo, meio e final da página;
- rotação não será um alvo prioritário nesta rodada, mas o layout não deve quebrar de forma catastrófica;
- textos longos;
- listas vazias;
- listas com muitos itens;
- estados de loading;
- erros de requisição;
- tema claro e escuro quando relevante.

## Tratamento de problemas compartilhados

Quando um problema aparecer em duas ou mais telas, a primeira opção deve ser corrigir a causa compartilhada.

Exemplos:

- overflow causado pelo container principal deve ser corrigido no shell, não em cada página;
- modais cortados devem ser resolvidos no componente Modal;
- listas de select fora da viewport devem ser resolvidas no SystemSelect/BottomSheet;
- espaçamento do menu inferior deve usar token compartilhado;
- touch targets de botões devem ser tratados no componente ou estilo base quando possível.

Correções locais continuam aceitáveis quando o problema for realmente específico da composição de uma tela.

## Não objetivos

Esta rodada não inclui:

- redesign completo da identidade visual;
- criação de uma aplicação mobile separada;
- PWA/offline como nova funcionalidade;
- novas regras financeiras;
- novos tipos de pagamento;
- novas funcionalidades de pedidos que não sejam necessárias para corrigir usabilidade;
- mudanças de banco de dados sem necessidade direta do trabalho de UX;
- substituição ampla de componentes desktop que já funcionam corretamente.

Novas funcionalidades descobertas durante a auditoria devem ser registradas para uma rodada posterior, salvo quando forem indispensáveis para corrigir um P0 de usabilidade existente.

## Resultado esperado

Ao final, o Gestão Delivery deve oferecer uma experiência mobile consistente e previsível em aparelhos pequenos e grandes, com os principais fluxos operacionais utilizáveis com uma mão, sem sobreposições, cortes, scroll horizontal ou dependência de ajustes específicos por dispositivo.

A base compartilhada deve reduzir o risco de regressões futuras e tornar novas telas e funcionalidades mais simples de adaptar para mobile.