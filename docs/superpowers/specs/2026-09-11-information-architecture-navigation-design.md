# Spec A — Arquitetura da informação e navegação

**Projeto:** Gestão Delivery / Amor & Sabor  
**Repositório:** `vzaponi-dotcom/sistema-para-delivery`  
**Data:** 11/09/2026  
**Base inspecionada:** `master` em `99c1f04677b54243a43d470b743cdd16ac499154`  
**Estado:** decisões de desenho aprovadas em conversa; documento consolidado para revisão final.  
**Natureza desta entrega:** documentação. Não autoriza implementação, merge ou deploy.

## 1. Objetivo e limite da mudança

Organizar o sistema pela forma como o restaurante trabalha, em vez de apresentar cada funcionalidade como um item independente do menu. A operação diária começa em Pedidos/Cozinha; indicadores gerenciais ficam no Financeiro; entidades ficam em Cadastros; preferências e políticas ficam em Configurações.

A aplicação será única, preparada para adaptar destinos e ações às futuras permissões de acesso, sem manter versões separadas para gerente e operador.

A Spec A permite mudanças de navegação, agrupamento, títulos e posicionamento de controles existentes, além da preservação explícita de contexto entre páginas. Não muda cálculos, políticas comerciais, contratos das APIs, modelo de pagamentos ou mecanismos de segurança da impressão. A regra de refatoração sem mudança visual/funcional continua aplicável à Spec C, não à reorganização de interface descrita aqui.

O sucesso não será medido por redução de linhas do `App.jsx`, mas por destinos claros, menos caminhos desnecessários e ausência de regressões no atendimento.

## 2. Relação com as outras frentes

| Frente | Responsabilidade | Relação com esta spec |
|---|---|---|
| **A — Informação e navegação** | Hierarquia, entradas, navegação interna, Configurações inicial, contexto de navegação e preparação da interface para permissões. | Este documento. |
| **B — Configurações e políticas** | Persistir e validar políticas do negócio; retirar regras selecionadas do código; definir vigência e escopos. | Usa a organização de Configurações definida aqui; não é implementada junto com A. |
| **C — Modularização do frontend** | Separar responsabilidades de `App.jsx` mantendo comportamento e experiência da base escolhida para essa refatoração. | Reaproveita contratos de navegação e fronteiras de domínio, sem copiar a hierarquia do menu para todas as pastas. |
| **D — Cadastros extensíveis** | Categorias de produtos e outros cadastros aprovados separadamente. | Novos destinos só aparecem quando estiverem funcionais. |
| **Futura frente de usuários e acessos** | Identidades, perfis, autorização no servidor, filtragem dos dados e auditoria de ações. | A prepara a interface; não entrega essa barreira de segurança. |

As letras identificam documentos, não uma autorização para executar tudo nem uma ordem obrigatória de implementação. O desenho de A orienta as demais frentes. Qualquer extração técnica necessária a A deve ser pequena, testada e separada das mudanças visuais; não exige concluir toda a Spec C antes de entregar navegação. Não misturar a refatoração ampla de C com a reorganização visual de A no mesmo PR.

## 3. Evidências da base atual

As referências ao código desta seção estão fixadas no commit-base, na seção 16. Elas descrevem a base inspecionada, não uma auditoria de produção ou de worktrees locais.

| Ponto observado | Consequência para o desenho |
|---|---|
| `Sidebar.jsx` e `MobileNavigation.jsx` mantêm listas próprias de destinos; o mobile usa Dashboard, Pedidos, Comandas, Clientes e Mais. [R1, R2] | Centralizar a definição da navegação, sem duplicar hierarquia e decisões de acesso por dispositivo. |
| `AppShell.jsx` usa `key={activeTab}` no conteúdo e recebe o evento `app:navigate`. [R3] | Contextos que devem sobreviver à troca de tela não podem depender da montagem da página; todos os caminhos de navegação precisam passar pela mesma validação. |
| `App.jsx` concentra dados oficiais, navegação, sincronização, pagamentos e coordenação de impressão. [R4] | Separar contexto visual de dados oficiais e preservar a duração dos serviços operacionais. |
| O botão “Impressão” da Cozinha chama `onNavigatePrintQueue`. [R5] | Manter o atalho e usar o nome explícito “Fila de impressão”. |
| `Tables.jsx` reúne cadastro de mesas e transferência de comanda; `Comandas.jsx` é a área de atendimento. [R6, R7] | Transferência passa a ser acessível na operação; cadastro mantém ações administrativas. |
| `PrintingSettings.jsx` já carrega e salva vias do negócio, configura automação da estação e seleciona impressora. [R8] | Reutilizar esses fluxos, distinguindo seus escopos, sem criar uma segunda origem de configuração. |
| `Dashboard.jsx` mistura vendas, recebimentos e gráficos gerenciais com pedidos ativos, pedidos recentes e tempo operacional. [R9] | Separar conteúdos sem recalcular indicadores nem apagar silenciosamente análises existentes. |
| Login e bootstrap não diferenciam gerente de operador; o bootstrap inclui movimentações e configurações financeiras. [R10, R11] | Preparação de menu não pode ser apresentada como controle de acesso efetivo. |

## 4. Arquitetura da informação aprovada

```text
OPERAÇÃO
  Pedidos
    Cozinha                 ← entrada padrão do sistema
    Histórico
  Comandas
  Fila de impressão

FINANCEIRO
  Visão geral
  A receber
  Movimentações

CADASTROS
  Clientes
  Produtos e preços
  Mesas

CONFIGURAÇÕES
  Impressão
  Preferências deste dispositivo
```

“Operação”, “Financeiro” e “Cadastros” são agrupadores na lateral, não páginas intermediárias. “Configurações” é um destino com seções internas.

Novo pedido é uma ação, não um item principal do menu. Agendados continuam integrados à Cozinha; não haverá nova página exclusiva de agendados nesta entrega.

Categorias personalizadas, edição de dados do estabelecimento, políticas de atraso, modalidades e formas de pagamento configuráveis não aparecem como páginas vazias, controles desabilitados ou promessas de “em breve”. Seus destinos serão adicionados pelas respectivas specs.

## 5. Navegação principal e identificação do destino

### 5.1 Computador

A lateral apresenta os grupos da seção 4 abertos por padrão. Os títulos de grupo não exigem clique. Clientes, Produtos e preços, Mesas e as três páginas financeiras permanecem acessíveis diretamente.

Em Pedidos, o item principal abre Cozinha; Histórico é acessado pela navegação interna de Pedidos. Configurações fica visualmente separada dos cadastros, sem criar um agrupador “Gestão” que apenas repita “Financeiro”.

A área de navegação pode rolar quando faltar altura. Nenhum destino, Configurações ou Sair pode ficar inacessível por sobreposição do rodapé.

### 5.2 Celular — opção A aprovada

```text
[ Pedidos ] [ Comandas ] [ Financeiro ] [ Mais ]
```

Pedidos abre Cozinha. Comandas abre o atendimento das mesas. Financeiro abre Visão geral. Se essa subpágina não estiver disponível no conjunto de capacidades recebido, abrir a primeira subpágina financeira autorizada, na ordem Visão geral, A receber, Movimentações; sem nenhuma, ocultar a entrada. A escolha explícita de um desses destinos não apaga filtros ou seleções preservados das outras páginas.

Mais abre um painel com acesso direto à Fila de impressão, Clientes, Produtos e preços, Mesas, Configurações e Sair. Os links podem ser agrupados visualmente, mas o caminho deve continuar sendo “Mais → Clientes”, não “Mais → Cadastros → Clientes”. Não duplicar Histórico ou as três páginas financeiras nesse painel: elas possuem navegação interna própria.

O painel fecha após aceitar uma navegação. Abrir e fechar Mais sem escolher destino não muda a página. Se houver confirmação de descarte de pedido, a mudança de página só ocorre após a decisão do usuário.

A distribuição deve aceitar menos de quatro itens quando permissões forem integradas. Financeiro não autorizado desaparece, sem lacuna, sem botão permanentemente bloqueado e sem promover outro destino automaticamente para sua posição:

```text
[ Pedidos ] [ Comandas ] [ Mais ]
```

A ordem relativa dos itens restantes é estável. Mais continua oferecendo as preferências e ações de sessão disponíveis, mesmo sem cadastros autorizados.

### 5.3 Área ativa e destinos existentes

Manter os identificadores internos atuais quando possível, para reduzir a migração: `orders`, `history`, `new-order`, `comandas`, `print-queue`, `dashboard`, `receivables`, `finance`, `clients`, `products` e `tables`. O nome visível de `dashboard` passa a ser “Visão geral”; `finance` passa a ser “Movimentações”. Identificador interno não determina título ou posição no menu.

O registro de navegação deve associar cada destino à área e à entrada mobile correspondentes:

| Destino | Área | Destaque mobile |
|---|---|---|
| Cozinha / Histórico | Pedidos | Pedidos |
| Novo pedido originado em Pedidos | Fluxo de Pedidos | Pedidos |
| Novo pedido originado em Comandas | Fluxo de atendimento da comanda | Comandas |
| Comandas | Comandas | Comandas |
| Visão geral / A receber / Movimentações | Financeiro | Financeiro |
| Fila de impressão / cadastros / Configurações | Área própria do destino | Mais |

Os mesmos fallbacks de disponibilidade valem para qualquer entrada de área, inclusive Pedidos: preferir Cozinha, depois Histórico, e ocultar o grupo sem filhos disponíveis. Isso não altera a home padrão dos perfis previstos; trata conjuntos reduzidos sem redirecionamento para páginas proibidas.

No desktop, subpáginas destacam seu destino ou área principal sem marcar itens incompatíveis simultaneamente. A tela de novo pedido deve preservar também a origem do retorno; não ganha uma quinta entrada mobile.

Todos os atalhos, abas internas e o evento legado `app:navigate` usam a mesma resolução de destino. Destino desconhecido ou não disponível não monta a página: apresentar feedback e manter o destino atual válido; sem destino atual, usar a primeira entrada autorizada, preferindo Cozinha. Se não houver nenhuma, mostrar estado sem acesso e permitir sair, sem loop de redirecionamento.

Não introduzir roteador, deep links, novo histórico de URLs ou persistência de rota nesta etapa. Um futuro acesso por URL deve reutilizar o mesmo contrato; não se promete navegação por URL já implementada.

## 6. Navegação interna das áreas

### 6.1 Pedidos

Exibir Cozinha e Histórico como destinos internos de Pedidos. Cozinha continua com os tickets, busca, resumo operacional, som, preparação e agendados existentes. Não redesenhar os cards nesta spec.

O botão avulso Histórico é substituído pelo acesso interno. Manter Novo pedido destacado e o atalho Fila de impressão claramente nomeado. O som continua acionável na Cozinha e sincronizado com Preferências deste dispositivo.

Histórico conserva seus filtros, detalhes e ações existentes. Consulta ao histórico, acesso a análises e ações sensíveis podem exigir permissões distintas; entrar na Cozinha não equivale a acesso futuro irrestrito a todo o histórico.

### 6.2 Financeiro

Exibir Visão geral, A receber e Movimentações como destinos internos. A lateral no desktop leva diretamente ao subdestino; o botão principal mobile leva à Visão geral. Links explícitos para A receber e Movimentações mantêm seus destinos.

Registrar recebimento de um pedido ou comanda deve continuar disponível dentro do fluxo de atendimento autorizado, sem exigir entrada na área gerencial Financeiro.

### 6.3 Destino do conteúdo do Dashboard

Aplicar a separação aprovada entre operação e gestão sem eliminar informações existentes. Este detalhamento integra a revisão final deste documento:

| Conteúdo atual | Tratamento em A |
|---|---|
| Vendas hoje, recebido hoje e a receber | Permanecem em Financeiro → Visão geral, com as mesmas fórmulas e escopos atuais. |
| Vendas, quantidade de pedidos e ticket médio do período | Permanecem como análise comercial/gerencial na Visão geral. |
| Vendas por dia, pedidos por dia, top produtos e formas de pagamento | Permanecem na Visão geral. Quantidade vendida não se confunde com fila operacional. |
| Pedidos ativos | O acompanhamento permanece na Cozinha; retirar o cartão duplicado da Visão geral. |
| Pedidos recentes | A consulta permanece em Cozinha/Histórico; retirar a lista duplicada da Visão geral. |
| Tempo operacional histórico, faixas e comparação por tipo | Preservar em uma seção identificada de análise dentro de Pedidos → Histórico, sem poluir o topo da Cozinha nem criar novo item principal. Manter métricas e filtros de período existentes. |
| Botão flutuante de Novo pedido do Dashboard | Retirar da Visão geral; a ação continua disponível na operação. |
| Ocultar valores | Preservar na Visão geral como preferência visual, sem apresentá-la como autorização de acesso. |

Os indicadores fixos de hoje e os indicadores do período continuam rotulados separadamente. Não acrescentar saldo, DRE, fechamento diário ou novos gráficos apenas para preencher espaço. Movimentações mantém seu saldo inicial no contexto financeiro existente.

## 7. Cadastros e ações operacionais de Comandas

Clientes e Produtos e preços preservam suas telas e processos. Não criar landing page de Cadastros nem restringir a consulta de produtos necessária para montar pedidos à futura permissão de editar produtos.

Em Cadastros → Mesas ficam adicionar, renomear, ordenar, ativar e desativar. Ocupação pode continuar visível como contexto, sem transformar o cadastro na central de atendimento.

Transferir comanda passa a estar nas ações da comanda ocupada selecionada em Operação → Comandas. Reutilizar `TableTransferDialog` e o contrato de transferência existente. Não duplicar lógica de transferência, abrir outra comanda, renumerar atendimentos ou mudar validações do servidor.

No cadastro de mesa ocupada, substituir a ação operacional direta por “Abrir comanda”, quando esse destino estiver disponível, preservando a seleção correta. O aviso sobre as restrições de renomear/desativar mesa ocupada permanece.

A transferência deve preservar a identidade da comanda, refletir a mesa de destino e respeitar atualizações concorrentes. Destino ocupado, mesa inativa ou comanda encerrada/alterada seguem sendo erros tratados pelo fluxo atual; não repetir automaticamente a transferência contra outra identidade.

Abrir uma mesa livre para lançar pedido, consultar conta, imprimir e registrar pagamento continuam no atendimento. A futura permissão de transferir não implica permissão de administrar mesas; sua concessão a perfis não é decidida nesta spec.

## 8. Configurações inicial

Configurações é uma página com duas seções funcionais: Impressão e Preferências deste dispositivo. A entrada padrão é Impressão quando disponível; caso contrário, a primeira seção disponível. Um atalho pode abrir a seção específica sem passar por uma página vazia de apresentação.

### 8.1 Impressão

Reutilizar o conteúdo e os fluxos existentes, retirando apenas a dependência de um modal como única entrada. Diálogos de confirmação e seleção continuam podendo ser modais. Não montar outro `usePrintingManager` dentro de Configurações.

Identificar explicitamente os escopos:

| Controle | Escopo / persistência a preservar |
|---|---|
| Vias padrão | Regra do negócio no D1; continua aceitando 1 ou 2 e afetando novos trabalhos elegíveis. |
| Estação principal | Seleção entre estações do negócio, não mera preferência de aparência. |
| Impressão automática | Configuração da estação, com persistência e condições operacionais atuais. |
| Impressora selecionada no QZ | Vínculo local do navegador/estação com a fila do Windows. |
| Diagnóstico, atualização da lista e teste | Ações sobre a estação/dispositivo elegível; não comprovam impressão física apenas por localizar a fila. |

Preservar confirmações, mensagens de erro, carregamento e reversão visual quando uma gravação falhar. Não mudar salvamento imediato para formulário global “Salvar tudo” nesta etapa.

Não alterar a política atual de uma via para pedidos de mesa, o limite de duas vias, a confirmação física, a recuperação, a ordem de execução ou os gatilhos automáticos. A descrição das vias deve evitar sugerir que a regra global se aplica indistintamente a todos os documentos. A revisão dessa política pertence a B.

No celular ou plataforma sem impressão física suportada, manter os controles globais atualmente permitidos e explicar o alcance das ações. Não oferecer seleção de uma impressora Windows como se ela estivesse conectada ao celular.

A Fila de impressão permanece independente em Operação. Ela oferece um atalho explícito para Configurações → Impressão; retornar à fila preserva seu contexto válido.

### 8.2 Preferências deste dispositivo

Tema Claro/Escuro/Automático e som da cozinha reutilizam a mesma origem de preferência local já existente. Não criar cópia em D1, outro storage ou configuração global paralela.

O controle de tema tem sua entrada administrativa em Configurações. O atalho operacional de som permanece na Cozinha. Alterar qualquer uma dessas entradas deve refletir na outra sem atualizar a página.

Logout limpa contexto de atendimento, não as preferências locais de tema/som ou a identidade física da estação já persistidas pelo comportamento atual. Isso não significa manter dados de negócio acessíveis após encerrar a sessão.

## 9. Preservação de contexto e continuidade

### 9.1 O que preservar

Preservar em memória, durante a sessão autenticada, o contexto de consulta das páginas: busca da Cozinha; filtros, busca e período do Histórico; período e preferência visual da Visão geral; filtros de A receber e Movimentações; busca/ordenação de Clientes; busca/filtros de Produtos; filtros/paginação da Fila de impressão; seleção válida de mesa/comanda.

Isso é estado de interface, não uma cópia independente das coleções de pedidos, clientes ou movimentações. Páginas remontadas recebem o contexto preservado e os dados oficiais atuais.

Não preservar cegamente página de resultados inexistente, item excluído ou referência a comanda encerrada. Ajustar paginação inválida; limpar seleções obsoletas. Para comandas, validar a identidade do atendimento, não apenas o ID da mesa: outra comanda aberta na mesma mesa não é o atendimento anterior.

### 9.2 Rascunhos e operações em andamento

Um novo pedido iniciado em Comandas retorna à origem após sucesso ou cancelamento confirmado. Se a origem deixar de ser válida, retornar ao espaço de Comandas com feedback e sem associar o pedido a outra comanda.

Tentativa de sair de pedido com preenchimento relevante deve respeitar a confirmação existente. Cancelar o descarte mantém o rascunho e a página. Confirmar descarta apenas o rascunho, não um pedido já aceito. Nenhuma rota alternativa, aba ou item de Mais pode contornar essa proteção.

Não alterar o bloqueio atual de saída durante o envio do checkout. Não adicionar recuperação de rascunho após recarregar ou fechar o navegador. A garantia de contexto desta spec vale para navegação interna, não para falha de energia ou persistência offline.

Uma navegação permitida não interrompe a reconciliação de um pagamento já aceito. Voltar à página não pode reenviar cobrança/pagamento. Mensagens de sucesso de um atendimento anterior não devem ser atribuídas à nova mesa selecionada.

Modais e estados de envio não são “filtros a restaurar”: não reabrir automaticamente uma confirmação perigosa ao voltar à página.

### 9.3 Sessão e impressão

Logout ou expiração limpam dados oficiais e contexto de atendimento, invalidam respostas assíncronas antigas e não restauram filtros sensíveis em outra sessão. Nova entrada começa em Cozinha, quando autorizada.

Navegar entre páginas não pode remontar o motor de impressão, duplicar timers, reiniciar recuperação ou criar outro consumidor da fila. Prompts globais e feedback operacional continuam associados aos jobs corretos, independentemente da página aberta.

Preservar as condições atuais de autenticação, rede, visibilidade e estação elegível. Esta spec não promete impressão com o aplicativo fechado, nem altera regras do navegador ou de execução em segundo plano.

## 10. Preparação para níveis de acesso

### 10.1 Separação aprovada

Haverá uma única aplicação. O futuro gerente terá acesso amplo às funcionalidades do negócio. O futuro operador poderá consultar valores de seus atendimentos autorizados e registrar recebimentos, mas não consultar faturamento, saldo, despesas, relatórios ou carteira gerencial completa de recebíveis.

“Registrar recebimento” não concede automaticamente “Estornar”, “Cancelar”, “Dar desconto”, “Alterar preço”, “Transferir comanda”, “Consultar todo o histórico” ou “Alterar políticas”. A matriz completa de perfis será definida na futura frente de acessos.

### 10.2 Contrato de interface

O registro de destinos informa identidade estável, área, rótulo, entrada padrão, posição desktop/mobile e capacidade necessária. Ações sensíveis possuem capacidades próprias, não inferidas apenas do acesso à página. Usar identificadores semânticos, não condições espalhadas do tipo `perfil === gerente`.

Exemplos de capacidades para orientar o plano: consultar pedidos, criar pedidos, consultar histórico, consultar análise operacional, registrar recebimento, transferir comanda, consultar visão financeira, consultar recebíveis, consultar movimentações, administrar mesas e alterar configurações. Os nomes finais devem ser únicos e centralizados, sem um editor de permissões nesta entrega.

Menus, abas, atalhos e resolução de destino consomem a mesma política de disponibilidade. Grupos sem filhos permitidos desaparecem. Uma área pode existir mesmo sem todas as subpáginas. Preferências locais não dependem necessariamente da permissão de mudar regras do negócio.

Permissão ausente ou desconhecida não significa acesso total. Para manter o comportamento atual antes dos perfis, a sessão legada autenticada recebe um conjunto explícito das capacidades atuais em um único adaptador de compatibilidade; não inferir “gerente” nem criar fallback genérico de liberação. Esse adaptador é temporário e não pode ser reaproveitado como autorização de servidor.

Testes podem fornecer conjuntos simulados para validar a navegação. Não haverá seletor de gerente/operador, identidade fictícia ou controle de acesso só no navegador apresentado aos usuários.

### 10.3 Limite de segurança e obrigação futura

A não implementa proteção efetiva por perfil. O backend atual continua com as regras de sessão existentes. Esconder um menu não restringe APIs ou dados já enviados.

A frente de acessos deverá verificar identidade, negócio, capacidade, ação e escopo dos registros no servidor, incluindo bootstrap, consultas, mutações, documentos e prévias de impressão. O operador autorizado a receber não deve ganhar todas as movimentações financeiras na resposta da operação.

Qualquer oferta de “acesso restrito de operador” fica bloqueada até essa implementação no backend e seus testes. A auditoria de dados retornados e a eliminação do adaptador legado fazem parte desse gate futuro, não de uma promessa de segurança desta entrega.

## 11. Organização técnica necessária, sem reescrita

Definir um registro único e testável de navegação, um resolvedor de destinos e um controlador de contexto de consulta por sessão. Reutilizar os componentes visuais e a infraestrutura de tema, modais, dados e impressão existentes.

Os limites são: o shell compõe; a navegação escolhe destinos; a página exibe e executa seu fluxo; dados oficiais continuam sob sua coordenação atual; preferências locais continuam em seus mecanismos atuais. Configurações apresenta controles de domínios, mas não absorve os motores de impressão ou financeiro.

O contexto persistente fica acima da região remontada por `activeTab`. Não manter todas as páginas escondidas e montadas apenas para preservar filtros, pois isso pode criar assinaturas e consultas extras. Preservar valores de interface sem duplicar consumidores operacionais.

Pequenas extrações de JSX/controllers para reutilizar Configurações e transferência são permitidas, com testes próprios. A decomposição ampla de autenticação, bootstrap, sincronização, repositories, cálculo monetário e `App.jsx` permanece na Spec C ou em outra mudança específica.

Não adicionar Redux, Zustand, React Router, migração para TypeScript, nova API, migrations ou atualização de dependências como requisito incidental de A.

## 12. Acessibilidade, erros e apresentação

Preservar linguagem visual, tema claro/escuro/automático e comportamento responsivo do projeto. A diferenciação da página ativa não depende apenas de cor.

Destinos devem ser navegáveis por teclado, com rótulos compreensíveis e indicação semântica de página ativa. Se apresentados visualmente como abas, sua implementação deve usar uma única semântica coerente, sem misturar controle de tabs incompleto com links de página. O plano detalhará o componente acessível reutilizável.

Abrir/fechar o painel Mais e os diálogos deve administrar foco e devolver foco a um controle válido. Ao mudar a página, o foco deve chegar a uma região identificável sem roubar o foco em atualizações de dados. Preservar o tratamento existente de retorno lista/detalhe de Comandas ao mudar entre mobile e desktop.

Não encobrir Novo pedido, ações de formulários ou conteúdo pela barra inferior. Testar rótulos longos, zoom, telas estreitas, scroll e redução de movimento. Não acrescentar outra camada de animações.

Sem conexão ou com requisição bloqueada, preservar os bloqueios atuais de gravação, permitindo navegação compatível com dados já carregados. Em falha de configuração, mostrar erro e possibilidade de nova tentativa; não exibir um default como se uma gravação tivesse sido confirmada. Não repetir automaticamente ações sensíveis.

## 13. Critérios de aceitação

| ID | Cenário | Resultado obrigatório |
|---|---|---|
| A01 | Login ou nova sessão | Abre Pedidos/Cozinha; não Dashboard. |
| A02 | Desktop | Grupos abertos; acesso direto aos cadastros e páginas financeiras; sidebar utilizável com pouca altura. |
| A03 | Mobile completo | Pedidos, Comandas, Financeiro e Mais, nessa ordem, sem quinta entrada para Novo pedido. |
| A04 | Abrir Histórico / subpágina financeira | Área principal e subdestino destacados corretamente. |
| A05 | Mais → Clientes / Produtos / Mesas | Apenas dois toques; nenhuma landing page intermediária. |
| A06 | Nova Configurações | Só Impressão e Preferências funcionais; nenhuma política futura editável. |
| A07 | Vias, automação, estação e impressora | Mesma persistência, validação, alcance, erros e confirmações; jobs existentes não são reinterpretados. |
| A08 | Tema / som | Uma origem de preferência; som reflete entre Cozinha e Configurações sem reload. |
| A09 | Dashboard reorganizado | Cálculos e períodos preservados; análises operacionais continuam acessíveis no Histórico; painel financeiro sem fila operacional duplicada. |
| A10 | Voltar a uma página | Busca, filtros e contexto em memória preservados quando válidos; dados oficiais atualizados. |
| A11 | Mesa/comanda transferida, encerrada ou substituída | Seleção acompanha a identidade válida ou é limpa; nunca passa silenciosamente a outro atendimento. |
| A12 | Novo pedido iniciado em comanda | Retorno à origem válida; saída com rascunho exige confirmação; envio não é duplicado. |
| A13 | Transferência operacional | Ação em Comandas reutiliza regras/diálogo; Cadastros mantém administração e atalho Abrir comanda. |
| A14 | Pagamento e mudança de seleção/navegação | Resposta aceita é reconciliada uma vez; sucesso não é atribuído a outra mesa; retorno não repete pagamento. |
| A15 | Navegar durante impressão/recuperação | Não reinicia manager, não duplica consumidores, não troca job do prompt nem altera ordem das vias. |
| A16 | Capacidades simuladas reduzidas | Financeiro desaparece; espaço redistribuído; grupos vazios somem; links diretos internos não contornam o resolvedor. |
| A17 | Destino inválido/sem disponibilidade | Feedback e destino seguro; sem montagem de página indevida, liberação genérica ou loop. |
| A18 | Logout/expiração e resposta antiga | Dados/contexto limpos, resposta obsoleta ignorada; preferências locais permanecem conforme seu escopo. |
| A19 | Teclado, tema, mobile/desktop | Foco, rótulos e seleção corretos; barra inferior e modais não encobrem ações. |
| A20 | Escopo | Nenhuma nova política do negócio, alteração de banco ou alegação de segurança por perfil entregue somente com menu. |

## 14. Validação e entrega

O plano de implementação deve relacionar cada critério aos testes existentes ou novos. Cobrir funções puras de navegação, integração de páginas, ciclo de sessão e regressões de pagamentos/impressão. Preferir testes de comportamento; não apagar proteções só porque um teste procura texto em `App.jsx`. Ao substituir um teste estrutural, preservar explicitamente a garantia que ele representava.

Aplicar TDD às mudanças de comportamento: demonstrar a falha antes da correção e o sucesso depois. Para extrações neutras, preservar testes de caracterização e verificar equivalência. Durante desenvolvimento, usar testes focados; antes de integrar, executar os gates completos do repositório. Não misturar migração do framework de testes ou atualização de React nesta entrega.

Homologar em staging: fluxo de pedido imediato/agendado, histórico, comanda, transferência, recebimento, falha de sincronização, impressão de uma/duas vias e recuperação durante trocas de página. Verificar que entrar em cada página não cria novos timers ou requisições operacionais duplicadas. Executar a homologação física de impressão na estação de testes, sem consumir a fila da produção.

Implementação somente em branch de feature/staging e, quando executada localmente, worktree nova e isolada a partir da base remota validada. Não usar reset, restore, clean ou stash sobre worktrees antigas para realizar esta tarefa. Não trabalhar diretamente em master.

Documentação, plano aprovado, implementação, homologação e liberação são gates distintos. A criação desta spec não altera os ambientes. Não há autorização de deploy ou de merge em produção. A ordem detalhada dos PRs e as dependências mínimas com C serão definidas no plano, sem uma migração visual e estrutural gigante.

## 15. Insumos preservados para B, C, D e acessos

A auditoria anterior identificou prazos fixos/duplicados da cozinha, listas repetidas de pagamentos, categorias codificadas, mensagem fixa do ticket e diferenças entre vias globais e pedidos de mesa. Esses são insumos, não campos novos autorizados por A.

Para B, classificar cada opção como política do negócio, configuração de estação, preferência local, cadastro ou proteção interna. Definir proprietário, validação, valor inicial, migração, permissão, concorrência e momento de vigência de cada alteração. Não assumir que toda configuração atualiza pedidos ativos automaticamente: o efeito em novos pedidos, ativos, histórico e jobs já criados precisa ser decidido por política.

Para C, conservar uma única coordenação dos dados oficiais e a vida útil de operações aceitas. Para D, preservar referências e histórico ao evoluir categorias; não transformar códigos automáticos de vendas/estornos em cadastros apagáveis. Para acessos, aplicar a separação aprovada entre recebimento operacional e consulta financeira gerencial também às APIs e aos documentos.

Nenhuma dessas frentes autoriza expor timeouts, criptografia, invariantes de integridade ou estados internos como preferências comuns do restaurante.

## 16. Referências fixadas no repositório

Todos os links abaixo apontam para a base `99c1f04677b54243a43d470b743cdd16ac499154`:

- [R1 — Sidebar](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/components/Sidebar.jsx)
- [R2 — Navegação mobile](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/components/MobileNavigation.jsx)
- [R3 — AppShell e ciclo do conteúdo](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/components/AppShell.jsx)
- [R4 — App e coordenação dos domínios](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/App.jsx)
- [R5 — Cozinha / Orders](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/pages/Orders.jsx)
- [R6 — Cadastro de mesas e transferência atual](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/pages/Tables.jsx)
- [R7 — Atendimento de comandas](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/pages/Comandas.jsx)
- [R8 — Configuração atual de impressão](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/components/PrintingSettings.jsx)
- [R9 — Dashboard e análises atuais](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/pages/Dashboard.jsx)
- [R10 — API, sessão e login](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/worker/index.js)
- [R11 — Bootstrap e efeitos de negócio](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/worker/repositories.js)
- [R12 — Preferência de tema](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/utils/theme.js)
- [R13 — Estação e impressora local](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/printing/localPrintStation.js)
- [R14 — Políticas de impressão existentes](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/worker/orderPrintingRepository.js)
- [R15 — Processo de liberação](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/docs/release-and-migration-runbook.md)

## 17. Revisão e próximo gate

Revisão documental desta consolidação: sem campos indefinidos; destinos desktop/mobile coerentes; frentes A/B/C/D separadas; conteúdo operacional existente com destino explícito; preparação de permissões distinta de segurança real; fallback definido para áreas sem subpágina padrão disponível. Os critérios A01–A20 constituem o contrato de aceite da futura implementação, não resultados de testes já executados.

O responsável pelo produto deve revisar esta versão escrita, inclusive o detalhamento de destino das análises operacionais do Dashboard. Após sua aprovação, criar o plano de implementação em uma etapa separada. A aprovação do plano também precede qualquer implementação.
