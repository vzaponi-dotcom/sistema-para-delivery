# Spec A — Arquitetura da informação e navegação

**Projeto:** Gestão Delivery / Amor & Sabor  
**Repositório:** `vzaponi-dotcom/sistema-para-delivery`  
**Data:** 11/09/2026  
**Base inspecionada:** `master` em `99c1f04677b54243a43d470b743cdd16ac499154`  
**Revisão:** 2.1 — consolida os ajustes aprovados e preserva a revisão 2 publicada em `45e6565e7be34c3c07d905f562e8f69dcc85f948`, com a decisão mais recente de permitir navegação durante gravação de configuração.  
**Estado:** desenho e correções aprovados em conversa; redação reconciliada para conferência final antes do plano.  
**Natureza desta entrega:** documentação. Não autoriza implementação, merge ou deploy.

## 1. Objetivo e limite da mudança

Organizar o sistema pela forma como o restaurante trabalha, em vez de apresentar cada funcionalidade como um item independente do menu. A operação diária começa em Pedidos/Cozinha; indicadores gerenciais ficam no Financeiro; entidades ficam em Cadastros; preferências e políticas ficam em Configurações.

A aplicação será única, preparada para adaptar destinos e ações às futuras permissões de acesso, sem manter versões separadas para gerente e operador.

A Spec A permite mudanças de navegação, agrupamento, títulos e posicionamento de controles, a nova entrada de recebimento avulso descrita em 6.4 e os comportamentos de contexto e navegação explicitados neste documento. Não muda fórmulas, políticas comerciais, modelo de pagamentos ou mecanismos de segurança da impressão. As mudanças de A reutilizam as APIs disponíveis na base de implementação, depois de incorporado o pré-requisito de transferência T1 definido em 7.1; A não executa essa alteração de contrato por conta própria. A regra de refatoração sem mudança visual/funcional continua aplicável à Spec C, não à reorganização de interface descrita aqui.

O sucesso não será medido por redução de linhas do `App.jsx`, mas por destinos claros, menos caminhos desnecessários e ausência de regressões no atendimento.

### 1.1 Natureza dos requisitos

| Tipo | Exemplos e limite |
|---|---|
| **Preservar comportamento** | Fórmulas monetárias e de tempo; elegibilidade dos pedidos; pagamento integral de comanda; regras de vias, confirmação física e recuperação; persistências atuais. |
| **Mudar em A** | Home e menus; entrada de transferência em Comandas; recebimento avulso pelos detalhes; períodos operacional/financeiro independentes; contexto de consulta em memória; seleção que não migra silenciosamente para outra comanda; navegação durante gravação de configuração e descarte de rascunho. |
| **Pré-requisito separado T1** | Proteger a identidade da comanda transferida da confirmação até a escrita no servidor, com contrato e testes próprios. Não está implementado por este documento. |
| **Fora de A** | Políticas dinâmicas, cadastros novos, perfis reais, refatoração ampla, pesquisa nova no Histórico e filtros novos em Movimentações. |

Uma garantia nova não deve ser descrita no plano como mera extração de código. A matriz acima evita confundir alteração de interface com regra já garantida pela base.

### 1.2 Vocabulário

| Termo | Uso nesta spec |
|---|---|
| Área | Agrupamento reconhecido pelo usuário, como Pedidos ou Financeiro. |
| Destino | Página ou seção identificável que pode ser aberta pela navegação. |
| Capacidade | Permissão semântica de consulta ou ação; não é o nome de um cargo. |
| Contexto de consulta | Busca, filtro, período ou seleção em memória, sem cópia das coleções oficiais. |
| Identidade do atendimento | ID do pedido ou da comanda; uma mesa pode receber vários atendimentos ao longo do tempo. |
| Operação pendente | Solicitação enviada cuja conclusão/reconciliação não depende da página aberta. |
| Pré-requisito | Mudança separada que precisa de evidência antes do aceite da parte dependente de A. |

## 2. Relação com as outras frentes

| Frente | Responsabilidade | Relação com esta spec |
|---|---|---|
| **A — Informação e navegação** | Hierarquia, entradas, navegação interna, Configurações inicial, contexto de navegação e preparação da interface para permissões. | Este documento. |
| **B — Configurações e políticas** | Persistir e validar políticas do negócio; retirar regras selecionadas do código; definir vigência e escopos. | Usa a organização de Configurações definida aqui; não é implementada junto com A. |
| **C — Modularização do frontend** | Separar responsabilidades de `App.jsx` mantendo comportamento e experiência da base escolhida para essa refatoração. | Reaproveita contratos de navegação e fronteiras de domínio, sem copiar a hierarquia do menu para todas as pastas. |
| **D — Cadastros extensíveis** | Categorias de produtos e outros cadastros aprovados separadamente. | Novos destinos só aparecem quando estiverem funcionais. |
| **T1 — Identidade da transferência** | Correção isolada do contrato e da escrita de transferência. | Dependência obrigatória para homologar a nova entrada de transferência em A; ver 7.1. |
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
| A transferência recebe origem/destino, mas não a identidade esperada na confirmação; a escrita não condiciona o ID da comanda lida. [R16, R17] | Não presumir garantia de identidade sob concorrência; tratar como T1. |
| Recebimento posterior de pedido avulso é ligado a A receber; `OrderDetail` não oferece essa ação. [R4, R18] | Especificar a entrada operacional nova, sem duplicar pagamento. |
| Histórico tem filtro de situação, mas não pesquisa nem período da lista; `Finance.jsx` não expõe filtros de consulta. [R19, R24] | Não criar controles por inferência da expressão “preservar contexto”. |
| O período do Dashboard começa em `30d`; a análise usa elegibilidade própria. [R20, R21] | Separar os períodos de cada relatório sem alterar sua amostra para entradas equivalentes. |

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

Abrir e fechar Mais sem escolher destino não muda a página. Ao escolher um destino, a sequência é determinística:

1. Validar destino/capacidade e os bloqueios de envio do atendimento. Intenção bloqueada mostra o motivo e não fica enfileirada para execução posterior. Gravação pendente de configuração não bloqueia por si só a navegação; segue 8.3.
2. Para um destino válido sem bloqueio, fechar Mais. Se não houver rascunho a descartar, concluir a navegação uma única vez.
3. Se houver rascunho, depois do fechamento abrir a confirmação, mantendo a página e o preenchimento de fundo. Não manter duas armadilhas de foco ativas.
4. “Continuar na venda” ou Escape na confirmação cancela a intenção, mantém o rascunho e devolve foco a um controle válido do atendimento. Não reabrir Mais automaticamente.
5. “Descartar venda” revalida o destino, limpa apenas o rascunho e conclui aquela intenção uma vez. Se o destino deixou de estar disponível, cancelar a intenção com feedback sem descartar o pedido. Nenhum destino pendente pode reaparecer numa ação posterior.

Escape apenas em Mais fecha o painel e devolve foco ao botão Mais. Enquanto a confirmação está aberta, existe no máximo uma intenção de navegação, sem substituição silenciosa por outro clique. Expiração de sessão prevalece, cancela a intenção e limpa o contexto. O comportamento de gravações está em 8.3. O objetivo de dois toques vale para navegação sem bloqueios de atendimento; confirmação obrigatória de descarte não viola esse objetivo.

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

Histórico conserva o filtro de situação Todos/Finalizados/Cancelados, detalhes e ações existentes; recebe a entrada de pagamento descrita em 6.4. Não acrescentar busca ou filtro de período à listagem nesta entrega. Consulta ao histórico, acesso a análises e ações sensíveis podem exigir permissões distintas; entrar na Cozinha não equivale a acesso futuro irrestrito a todo o histórico.

### 6.2 Financeiro

Exibir Visão geral, A receber e Movimentações como destinos internos. A lateral no desktop leva diretamente ao subdestino; o botão principal mobile leva à Visão geral ou ao fallback autorizado de 5.2. Links explícitos para A receber e Movimentações mantêm seus destinos.

Receber uma comanda continua no fluxo existente de Comandas. Receber posteriormente um pedido avulso passa a ter também a entrada operacional de 6.4, sem exigir navegação para a consulta financeira gerencial. Essa entrada é mudança explícita de A, não uma capacidade já exposta hoje em Cozinha/Histórico.

### 6.3 Destino do conteúdo do Dashboard

Aplicar a separação aprovada entre operação e gestão sem eliminar informações existentes:

| Conteúdo atual | Tratamento em A |
|---|---|
| Vendas hoje, recebido hoje e a receber | Permanecem em Financeiro → Visão geral, com as mesmas fórmulas e escopos atuais. |
| Vendas, quantidade de pedidos e ticket médio do período | Permanecem como análise comercial/gerencial na Visão geral. |
| Vendas por dia, pedidos por dia, top produtos e formas de pagamento | Permanecem na Visão geral. Quantidade vendida não se confunde com fila operacional. |
| Pedidos ativos | O acompanhamento permanece na Cozinha; retirar o cartão duplicado da Visão geral. |
| Pedidos recentes | A consulta permanece em Cozinha/Histórico; retirar a lista duplicada da Visão geral. |
| Tempo operacional histórico, faixas e comparação por tipo | Preservar em uma seção identificada de análise dentro de Pedidos → Histórico, sem poluir o topo da Cozinha nem criar novo item principal. Manter fórmulas e elegibilidade; separar o período conforme 6.5. |
| Botão flutuante de Novo pedido do Dashboard | Retirar da Visão geral; a ação continua disponível na operação. |
| Ocultar valores | Preservar na Visão geral como preferência visual, sem apresentá-la como autorização de acesso. |

Os indicadores fixos de hoje e os indicadores do período continuam rotulados separadamente. Não acrescentar saldo, DRE, fechamento diário ou novos gráficos apenas para preencher espaço. Saldo inicial continua pertencendo ao domínio financeiro, não à nova Configurações. Sua persistência/callback já existem, mas o `Finance.jsx` da base não expõe esse controle; A não amplia silenciosamente seu escopo para completar essa ligação. [R4, R11, R24]

### 6.4 Nova entrada operacional de recebimento avulso

Nos detalhes abertos a partir de Cozinha ou Histórico, disponibilizar “Registrar pagamento” para pedido avulso pendente, não cancelado e sem vínculo com mesa/comanda, inclusive quando já finalizado operacionalmente. A ação exige capacidade própria de recebimento e acesso àquele pedido; não exige capacidade de consultar o Financeiro. Reutilizar a identificação de mesa/comanda já existente para também excluir dados legados vinculados a comanda, mesmo que um campo de tipo esteja ausente.

Encaminhar para o diálogo e o controlador central de pagamento já usados por A receber. Fechar os detalhes ao abrir o diálogo; não empilhar dois fluxos de pagamento. Após sucesso, permanecer na página operacional de origem, manter seus filtros e exibir o estado oficial atualizado. Após cancelamento do diálogo, permanecer na origem sem alteração de pagamento. O acesso atual por A receber permanece.

O alvo é o ID do pedido; valor e elegibilidade são resolvidos dos dados oficiais atuais, não de uma cópia antiga guardada pelo modal. Revalidar antes do envio. Pedido já pago/cancelado ou pertencente a mesa não oferece o atalho; indisponibilidade temporária de rede/envio desabilita a ação segundo os bloqueios atuais. Permissão de ação ausente não é substituída pela permissão de consultar a página.

Preservar endpoint, cálculo, forma padrão, bloqueios, tratamento de erro e aplicação dos efeitos oficiais existentes. Bloquear envio duplicado pelo mesmo diálogo. Retorno à página, atualização periódica ou mudança de seleção não submetem pagamento novamente. Em conflito ou resultado incerto, seguir o tratamento existente e reconciliar; não marcar como pago por otimismo nem repetir a mutação automaticamente.

Pedidos de mesa continuam exclusivamente pelo pagamento integral da comanda. Não criar pagamento parcial, divisão de conta, estorno automático, nova carteira operacional de recebíveis nem acesso irrestrito ao histórico. A preparação da interface será testada com capacidades simuladas; autorização por usuário/registro continua na frente futura de acessos.

### 6.5 Contrato dos períodos e da análise operacional

A Visão geral financeira mantém seu período comercial. A análise operacional dentro de Histórico terá um período próprio. Ambos começam em `30d`, oferecem os períodos atuais `today`, `7d` e `30d` e permanecem em memória na sessão, independentemente. Isso é uma mudança explícita de estado de interface; não é mudança de fórmula. [R9, R20, R21]

O seletor “Período da análise” controla somente a seção de tempo operacional. Todos/Finalizados/Cancelados controla somente a listagem de Histórico. A análise recebe a coleção oficial de pedidos disponível para essa consulta e aplica sua própria elegibilidade: período pela data do pedido, exclusão de cancelados/retroativos e finalização/duração válidas segundo o cálculo existente. Não passar a lista previamente filtrada de Histórico ao cálculo.

Alterar filtros da lista não muda amostra, faixas ou médias. Alterar o período operacional não muda o comercial, e vice-versa. Mesma coleção de pedidos, mesmo instante de referência e mesmo período devem produzir os mesmos indicadores antes/depois da extração. Preservar rótulos, faixas e tratamento de amostra vazia. A futura restrição de registros e análise é resolvida pela frente de acessos, nunca por obter dados indevidos só para preencher um gráfico.

## 7. Cadastros e ações operacionais de Comandas

Clientes e Produtos e preços preservam suas telas e processos. Não criar landing page de Cadastros nem restringir a consulta de produtos necessária para montar pedidos à futura permissão de editar produtos.

Em Cadastros → Mesas ficam adicionar, renomear, ordenar, ativar e desativar. Ocupação pode continuar visível como contexto, sem transformar o cadastro na central de atendimento.

Transferir comanda passa a estar nas ações da comanda ocupada selecionada em Operação → Comandas. Reutilizar `TableTransferDialog` e o fluxo protegido depois da dependência T1 de 7.1. Não duplicar a transferência, abrir outra comanda ou renumerar atendimentos. O contrato vulnerável da base não deve ser reutilizado como se já garantisse a identidade esperada.

No cadastro de mesa ocupada, substituir a ação operacional direta por “Abrir comanda”, quando esse destino estiver disponível, preservando a seleção correta. O aviso sobre as restrições de renomear/desativar mesa ocupada permanece.

A transferência deve preservar a identidade da comanda confirmada e refletir a mesa de destino. Destino ocupado e mesa inativa mantêm as validações existentes; rejeição de comanda encerrada/substituída é garantia exigida de T1, não garantia presumida da base. Em conflito, mostrar feedback e atualizar os dados sem repetir a transferência contra outra identidade.

Abrir uma mesa livre para lançar pedido, consultar conta, imprimir e registrar pagamento continuam no atendimento. A futura permissão de transferir não implica permissão de administrar mesas; sua concessão a perfis não é decidida nesta spec.

### 7.1 Pré-requisito T1 — identidade esperada na transferência

**Estado: pendente de implementação e testes, fora da alteração visual de A.** A segunda revisão verificou que o contrato atual informa apenas mesas de origem/destino e que a escrita procura a comanda aberta por mesa. Se A foi encerrada e B ocupa a mesma mesa, uma intenção antiga pode atingir B. Isto descreve um risco identificado pela leitura do código, não um incidente verificado em produção. [R16, R17]

T1 deve ser tratado em tarefa/PR separado, antes da integração e homologação da nova entrada de transferência. Seu contrato mínimo exige:

- Capturar o ID da comanda mostrada ao abrir/revisar a confirmação, junto das mesas de origem e destino; não trocar esse ID silenciosamente quando os dados atualizarem.
- Enviar a identidade esperada e validá-la no servidor contra negócio, mesa de origem e situação aberta. A própria escrita deve condicionar essa identidade, além das condições válidas de destino, e nunca mover outra comanda.
- Rejeitar intenção obsoleta sem efeito sobre B. Validar apenas no frontend ou acrescentar somente o ID descoberto num SELECT tardio não resolve uma intenção que já chegou obsoleta.
- Retornar a identidade efetivamente transferida; tratar conflito sem repetição automática. Definir compatibilidade com consumidores antigos sem um caminho silencioso que dispense a proteção.
- Cobrir substituição entre abertura do diálogo e solicitação, e entre leitura e escrita do servidor; também comanda encerrada/transferida, destino ocupado/inativo e caminho bem-sucedido.

Este documento não especifica nem autoriza a implementação interna de T1. Seu plano próprio deve fechar contrato, testes e integração. O plano de A identifica o commit/PR de T1 incorporado à sua base antes de consumir o fluxo. Etapas independentes de navegação podem avançar, mas A13/A23 e o aceite integral de A ficam bloqueados sem essa evidência. Não marcar o defeito como resolvido por ter sido documentado.

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

Preservar confirmações, mensagens de erro, carregamento e reversão visual para uma falha conclusiva. Gravação pendente ou resultado não confirmado seguem 8.3. Não mudar salvamento imediato para formulário global “Salvar tudo” nesta etapa.

Não alterar a política atual de uma via para pedidos de mesa, o limite de duas vias, a confirmação física, a recuperação, a ordem de execução ou os gatilhos automáticos. A descrição das vias deve evitar sugerir que a regra global se aplica indistintamente a todos os documentos. A revisão dessa política pertence a B.

No celular ou plataforma sem impressão física suportada, manter os controles globais atualmente permitidos e explicar o alcance das ações. Não oferecer seleção de uma impressora Windows como se ela estivesse conectada ao celular.

A Fila de impressão permanece independente em Operação. Ela oferece um atalho explícito para Configurações → Impressão; retornar à fila preserva seu contexto válido.

### 8.2 Preferências deste dispositivo

Tema Claro/Escuro/Automático e som da cozinha reutilizam a mesma origem de preferência local já existente. Não criar cópia em D1, outro storage ou configuração global paralela.

O controle de tema tem sua entrada administrativa em Configurações. O atalho operacional de som permanece na Cozinha. Alterar qualquer uma dessas entradas deve refletir na outra sem atualizar a página.

Logout limpa contexto de atendimento, não as preferências locais de tema/som ou a identidade física da estação já persistidas pelo comportamento atual. Isso não significa manter dados de negócio acessíveis após encerrar a sessão.

### 8.3 Navegação durante gravação de configuração

**Decisão reconciliada: permitir a navegação sem tratar a saída da página como cancelamento da gravação.** Esta regra substitui a alternativa de bloquear a saída descrita na revisão 2. Uma gravação de configuração e um job de impressão são operações diferentes; nenhuma delas deve transformar Configurações na página obrigatória para continuar atendendo.

Manter a pendência e a identificação da operação, da sessão/negócio e do recurso afetado acima da região remontada pela navegação. Reaproveitar a coordenação existente quando possível. O recurso é a configuração de vias do negócio, a configuração da estação ou seu vínculo local de impressora, conforme o controle. Isso não autoriza um gerenciador universal de transações, outro motor de impressão ou cópias paralelas das coleções oficiais.

Na mesma sessão/dispositivo, não iniciar outra gravação conflitante no mesmo recurso enquanto a primeira estiver pendente. Se o usuário sair e voltar antes da resposta, mostrar “Salvando…” e manter a edição conflitante bloqueada, mas permitir navegar novamente. Uma leitura iniciada antes da gravação não pode sobrescrever seu resultado mais recente. Recursos não conflitantes continuam disponíveis, respeitados os bloqueios existentes de atendimento.

Em sucesso, usar o valor confirmado pelo servidor ou uma leitura posterior apropriada, atualizar o estado compartilhado e liberar a edição. Em falha conclusiva, mostrar o erro e recuperar o último valor confirmado. Falha de comunicação não prova que o servidor deixou de gravar: marcar resultado não confirmado, reconsultar o recurso e não repetir a mutação automaticamente. Enquanto essa revalidação não for possível, oferecer nova consulta e manter bloqueada a edição conflitante; não exibir um default como confirmação. A reconsulta não promete cancelamento da escrita no servidor nem ordenação global entre dispositivos.

Se a página estiver fechada ao concluir, publicar feedback identificado da configuração na sessão atual sem forçar retorno ou roubar foco. Reentrar exibe a pendência ou o estado oficial mais recente; não restaura valor antigo, reenvia a gravação ou duplica confirmação de sucesso. Reversão visual, feedback e leitura oficial seguem a mesma coordenação, não uma cópia local por montagem. [R8]

A impressão física e a recuperação continuam independentes da página, com as regras atuais. Não esperar a conclusão física de teste/job para liberar navegação. Tema/som locais conservam o mecanismo existente; diagnóstico não vira uma gravação pendente artificial.

Logout/expiração invalida callbacks e mensagens da sessão antiga, respeitando os bloqueios de atendimento já existentes. Isso não desfaz uma gravação já aceita no servidor: nova sessão carrega o estado oficial. Não prometer impedir fechamento da aba, recarga ou falha de energia. Concorrência entre editores em dispositivos diferentes e recuperação persistente de gravações pertencem à Spec B, não a esta coordenação de navegação.

## 9. Preservação de contexto e continuidade

### 9.1 O que preservar

A matriz abaixo é o inventário de contexto a preservar durante a sessão autenticada. Todas as linhas de consulta são limpas em logout/expiração/nova sessão. Reentrar numa área não significa reabrir a última subpágina: o destino padrão continua definido em 5.2/5.3, com seus filtros preservados.

| Contexto | Campos e valor inicial | Preservação e invalidação |
|---|---|---|
| Cozinha | Busca vazia. | Preservar a string; a atualização dos pedidos não limpa a consulta. |
| Histórico — lista | Situação `all` (Todos); opções `finalized`/`cancelled`. | Preservar o filtro; não criar busca nem período da lista. [R19] |
| Histórico — análise | Período `30d`. | Estado separado do filtro de situação e do Financeiro; novo contrato em 6.5. |
| Visão geral | Período `30d`; valores inicialmente visíveis. | Preservar escolhas na sessão; ocultar valores é só apresentação. [R9, R21] |
| A receber | Busca vazia; visão `pending`; situação `all`; ordem `urgency`; data exata nula; entrada selecionada nula. | Preservar filtros e chave da entrada enquanto ela existir e for válida na visão atual; resolver seu conteúdo a partir dos dados atuais. Não guardar cópia dos pedidos. [R23] |
| Movimentações | Não há filtros de consulta no `Finance.jsx` da base. | Não inventar filtros a preservar; modal/solicitação de estorno não é contexto de consulta. [R24] |
| Clientes | Busca vazia; ordem `name-asc`. | Preservar busca/ordem, sem reabrir edição ou exclusão. [R4] |
| Produtos e preços | Busca vazia; categoria Todos. | Preservar busca/categoria. Expansões de grupos, menus e seleção em lote continuam transitórios e não voltam automaticamente. [R25] |
| Fila de impressão | Query inicial `DEFAULT_PRINT_QUEUE_QUERY`. | Preservar campos de consulta e paginação existentes, não jobs/previews em cache de interface; corrigir página inválida com o resultado atual. [R26, R27] |
| Comandas | Sem seleção; quando escolhida, identidade da comanda e sua mesa. | Acompanhar a mesma comanda transferida; limpar quando encerrada, desaparecida ou substituída. Reabrir outra comanda na mesma mesa exige nova seleção explícita. [R4, R7] |

Padrões acima se referem à base fixada; a query da fila reutiliza a definição existente, sem uma segunda lista de defaults. Nenhuma preservação depende de localStorage novo ou sobrevivência após recarga.

Isso é estado de interface, não uma cópia independente das coleções de pedidos, clientes ou movimentações. Páginas remontadas recebem o contexto preservado e os dados oficiais atuais.

Não preservar cegamente página de resultados inexistente, item excluído ou referência a comanda encerrada. Ajustar paginação inválida; limpar seleções obsoletas. Para comandas, validar a identidade do atendimento, não apenas o ID da mesa: outra comanda aberta na mesma mesa não é o atendimento anterior.

A base pode substituir a identidade selecionada pela nova comanda na mesma mesa em `applyOfficialTables`. A11 exige ajustar explicitamente esse comportamento; não é apenas mover estado de arquivo. Limpar a seleção e fechar detalhes/intenções obsoletos sem limpar a obrigação de reconciliar um pagamento já aceito. Seleção visual e operação aceita possuem durações diferentes. Se a mesma comanda foi transferida, atualizar a localização pelo ID estável; não selecionar automaticamente sua substituta. [R4]

### 9.2 Rascunhos e operações em andamento

Um novo pedido iniciado em Comandas retorna à origem após sucesso ou cancelamento confirmado. Se a origem deixar de ser válida, retornar ao espaço de Comandas com feedback e sem associar o pedido a outra comanda.

Tentativa de sair de pedido com preenchimento relevante deve respeitar a confirmação existente. Cancelar o descarte mantém o rascunho e a página. Confirmar descarta apenas o rascunho, não um pedido já aceito. Nenhuma rota alternativa, aba ou item de Mais pode contornar essa proteção.

Não alterar o bloqueio atual de saída durante o envio do checkout. Não adicionar recuperação de rascunho após recarregar ou fechar o navegador. A garantia de contexto desta spec vale para navegação interna, não para falha de energia ou persistência offline.

Uma navegação permitida não interrompe a reconciliação de um pagamento já aceito. Voltar à página não pode reenviar cobrança/pagamento. Mensagens de sucesso de um atendimento anterior não devem ser atribuídas à nova mesa selecionada. Não duplicar pagamento ou movimento não significa proibir leituras repetidas necessárias à reconciliação oficial.

Modais, menus de ação, confirmações, seleção em lote e formulários de edição não são filtros a restaurar: não reabrir automaticamente ao voltar à página. IDs de consulta preservados não carregam uma intenção antiga de mutação. Estados de operações aceitas permanecem sob a coordenação existente até reconciliar; não são apagados só porque a confirmação fechou. A sequência de Mais está em 5.2 e a coordenação de gravação em 8.3.

### 9.3 Sessão e impressão

Logout ou expiração limpam dados oficiais e contexto de atendimento, invalidam respostas assíncronas antigas e não restauram filtros sensíveis em outra sessão. Nova entrada começa em Cozinha, quando autorizada.

Navegar entre páginas não pode remontar o motor de impressão, reiniciar recuperação ou acumular consumidores/timers duplicados. Efeitos legítimos da página ativa podem iniciar e devem limpar ao sair; o requisito é não acumular assinaturas nem iniciar outra execução física por remontagem. Prompts globais e feedback operacional continuam associados aos jobs corretos, independentemente da página aberta.

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

Testes podem fornecer conjuntos simulados para validar navegação e ações. Cobrir: recebimento permitido sem consulta financeira; leitura de cadastro sem edição; preferências locais sem alteração de políticas; área sem seu subdestino padrão; capacidade desconhecida; conjunto vazio. Este último deve mostrar estado sem acesso e Sair, sem concessão automática nem loop. Uma capacidade desconhecida não concede ação ou destino; outras conhecidas continuam sendo avaliadas normalmente.

A análise operacional é uma seção de Histórico e exige tanto acesso à página quanto capacidade da análise; não cria uma rota alternativa para contornar falta de acesso ao Histórico. “Somente leitura” preserva a consulta e a seleção operacional apropriada, mas retira mutações não concedidas. Os mesmos contratos devem valer para atalhos e diálogo de recebimento, não só para menus.

Não haverá seletor de gerente/operador, identidade fictícia ou controle de acesso só no navegador apresentado aos usuários.

### 10.3 Limite de segurança e obrigação futura

A não implementa proteção efetiva por perfil. O backend atual continua com as regras de sessão existentes. Esconder um menu não restringe APIs ou dados já enviados.

A frente de acessos deverá verificar identidade, negócio, capacidade, ação e escopo dos registros no servidor, incluindo bootstrap, consultas, mutações, documentos e prévias de impressão. O operador autorizado a receber não deve ganhar todas as movimentações financeiras na resposta da operação.

Qualquer oferta de “acesso restrito de operador” fica bloqueada até essa implementação no backend e seus testes. A auditoria de dados retornados e a eliminação do adaptador legado fazem parte desse gate futuro, não de uma promessa de segurança desta entrega.

## 11. Organização técnica necessária, sem reescrita

Definir um registro único e testável de navegação, um resolvedor de destinos e um controlador de contexto de consulta por sessão. Reutilizar os componentes visuais e a infraestrutura de tema, modais, dados e impressão existentes.

Os limites são: o shell compõe; a navegação escolhe destinos; a página exibe e executa seu fluxo; dados oficiais continuam sob sua coordenação atual; preferências locais continuam em seus mecanismos atuais. Configurações apresenta controles de domínios, mas não absorve os motores de impressão ou financeiro.

O contexto persistente fica acima da região remontada por `activeTab`. Não manter todas as páginas escondidas e montadas apenas para preservar filtros, pois isso pode criar assinaturas e consultas extras. Preservar valores de interface sem duplicar consumidores operacionais.

Pequenas extrações de JSX/controllers para reutilizar Configurações, recebimento e transferência protegida são permitidas, com testes próprios. A coordenação mínima da gravação em 8.3 deve sobreviver à página sem criar um store genérico. A decomposição ampla de autenticação, bootstrap, sincronização, repositories, cálculo monetário e `App.jsx` permanece na Spec C ou em outra mudança específica.

Não adicionar Redux, Zustand, React Router, migração para TypeScript, nova API, migrations ou atualização de dependências como requisito incidental de A. A alteração de contrato estritamente necessária a T1 é uma dependência externa explícita, com PR/testes próprios, e não uma exceção implícita no PR de navegação.

## 12. Acessibilidade, erros e apresentação

Preservar linguagem visual, tema claro/escuro/automático e comportamento responsivo do projeto. A diferenciação da página ativa não depende apenas de cor.

A navegação interna de Pedidos, Financeiro e Configurações usa **navegação de páginas com aparência de abas**, não um widget ARIA `tablist`/`tabpanel`. Usar uma região `nav` identificada e controles nativos `button type="button"`, compatíveis com a navegação por estado existente, com `aria-current="page"` somente no destino ativo. Não inventar URLs ou links vazios.

Tab/Shift+Tab percorrem controles; Enter/Espaço acionam a intenção pelo resolvedor. Mover foco não ativa destino automaticamente; não implementar setas/Home/End de um widget de tabs com outra semântica. Após navegação concluída, focar título/região principal identificada; com bloqueio ou descarte cancelado, permanecer na tela e devolver foco a um controle válido. Atualização periódica não rouba foco. Um único componente/contrato cobre as três áreas.

Abrir/fechar o painel Mais e os diálogos deve administrar foco e devolver foco a um controle válido. Ao mudar a página, o foco deve chegar a uma região identificável sem roubar o foco em atualizações de dados. Preservar o tratamento existente de retorno lista/detalhe de Comandas ao mudar entre mobile e desktop.

Não encobrir Novo pedido, ações de formulários ou conteúdo pela barra inferior. Testar rótulos longos, zoom, telas estreitas, scroll e redução de movimento. Não acrescentar outra camada de animações.

Sem conexão ou com requisição bloqueada, preservar os bloqueios atuais de gravação. Permitir navegação compatível com dados carregados, respeitando a guarda de checkout e a confirmação de descarte; tentativas bloqueadas não viram navegação diferida. A gravação pendente de Configurações segue 8.3 e não bloqueia a troca de página. Em falha de configuração, mostrar erro e possibilidade de reconsulta/nova tentativa conforme seu resultado; não exibir um default como se uma gravação tivesse sido confirmada. Não repetir automaticamente ações sensíveis.

## 13. Critérios de aceitação

| ID | Cenário | Resultado obrigatório |
|---|---|---|
| A01 | Login ou nova sessão | Conjunto completo abre Cozinha; conjunto reduzido usa fallback de 5.3, sem montar página não disponível nem fazer loop. |
| A02 | Desktop | Grupos abertos; acesso direto aos cadastros e páginas financeiras; sidebar utilizável com pouca altura. |
| A03 | Mobile completo | Pedidos, Comandas, Financeiro e Mais, nessa ordem, sem quinta entrada para Novo pedido. |
| A04 | Abrir Histórico / subpágina financeira | Área principal e subdestino destacados corretamente. |
| A05 | Mais → Clientes / Produtos / Mesas | Dois toques sem bloqueio de atendimento; nenhuma landing page intermediária; descarte obrigatório segue 5.2. |
| A06 | Nova Configurações | Só Impressão e Preferências funcionais; nenhuma política futura editável. |
| A07 | Vias, automação, estação e impressora | Mesma persistência, validação, alcance, erros e confirmações; jobs existentes não são reinterpretados. |
| A08 | Tema / som | Uma origem de preferência; som reflete entre Cozinha e Configurações sem reload. |
| A09 | Dashboard reorganizado | Fórmulas/elegibilidade preservadas; períodos com opções/defaults atuais, mas independentes conforme 6.5; análise no Histórico; sem fila duplicada no Financeiro. |
| A10 | Voltar a uma página | Cada campo da matriz 9.1 permanece quando válido; defaults e limpeza obedecem à matriz; conteúdo vem dos dados oficiais atuais. |
| A11 | Mesa/comanda transferida, encerrada ou substituída | Seleção acompanha a identidade válida ou é limpa; nunca passa silenciosamente a outro atendimento. |
| A12 | Novo pedido iniciado em comanda | Retorno à origem válida; saída com rascunho exige confirmação; envio não é duplicado. |
| A13 | Transferência operacional | Depois de T1 validado/incorporado, Comandas reutiliza fluxo protegido e confirmação; Cadastros mantém administração e atalho Abrir comanda. |
| A14 | Pagamento e mudança de seleção/navegação | Retorno não duplica pagamento/movimento; leituras de reconciliação podem repetir; sucesso e efeitos permanecem associados ao atendimento correto. |
| A15 | Navegar durante impressão/recuperação | Não reinicia manager, não duplica consumidores, não troca job do prompt nem altera ordem das vias. |
| A16 | Capacidades simuladas reduzidas | Financeiro desaparece; espaço redistribuído; grupos vazios somem; links diretos internos não contornam o resolvedor. |
| A17 | Destino inválido/sem disponibilidade | Feedback e destino seguro; sem montagem de página indevida, liberação genérica ou loop. |
| A18 | Logout/expiração e resposta antiga | Dados/contexto limpos, resposta obsoleta ignorada; preferências locais permanecem conforme seu escopo. |
| A19 | Teclado, tema, mobile/desktop | Foco, rótulos e seleção corretos; barra inferior e modais não encobrem ações. |
| A20 | Escopo | Nenhuma política dinâmica, alteração de banco ou segurança por perfil entregue por menu; T1 permanece PR/dependência separado e não é declarado concluído pelo documento. |
| A21 | Receber pedido avulso sem Financeiro | Em capacidade simulada de recebimento e consulta ao pedido, mas sem consulta financeira, detalhes permitem pagar pedido pendente em preparo ou finalizado e retornar à origem com estado atualizado. |
| A22 | Elegibilidade e duplicidade do recebimento | Pago, cancelado ou vinculado a mesa/comanda não recebe o atalho individual; ausência de capacidade retira a ação; rede/envio bloqueados desabilitam; dois cliques/retorno não duplicam pagamento. |
| A23 | Evidência de T1 sob concorrência | Testes separados cobrem comanda A substituída por B antes da leitura e antes da escrita; B não é movida; conflito atualiza contexto sem retry automático. Sem evidência, não homologar transferência nem A integralmente. |
| A24 | Independência dos relatórios | Filtro Cancelados da lista não modifica a análise; período operacional/comercial não se contaminam; mesma entrada, instante e período mantêm resultados anteriores. |
| A25 | Gravação de configuração adiada/falha | Navegar e voltar conserva pendência; não permite gravação conflitante nem aplica leitura anterior; sucesso/erro são reconciliados e identificados. Resultado incerto exige reconsulta; não repete escrita automaticamente. Expiração invalida retorno antigo. |
| A26 | Mais durante novo pedido preenchido | Fechar Mais antes de confirmar descarte; Continuar/Escape mantém rascunho e limpa intenção; confirmar revalida destino e navega uma vez; foco não fica oculto e não há duas armadilhas ativas. |
| A27 | Contexto inventariado e identidade obsoleta | Não surgem pesquisa no Histórico nem filtros novos em Movimentações; seleção de comanda substituída é limpa sem apagar reconciliação aceita; confirmação/menu/seleção em lote não reaparecem ao retornar. |
| A28 | Navegação interna por teclado | Semântica única de navegação com aparência de abas; Tab/Shift+Tab e Enter/Espaço; foco sozinho não navega; `aria-current` correto; recusa/descarte respeitam foco. |
| A29 | Combinações de capacidades | Leitura sem edição, preferências locais sem políticas, área sem página padrão, capacidade desconhecida e conjunto vazio respeitam 10.2; sem concessão implícita ou alegação de proteção da API. |
| A30 | Ciclos repetidos de navegação | Não acumula consumidores globais/assinaturas nem reenvia mutações; efeitos exclusivos da página são removidos ao sair; timers legítimos da tela ativa continuam permitidos. |

## 14. Validação e entrega

O plano de implementação deve relacionar cada critério aos testes existentes ou novos e classificar cada tarefa pela matriz 1.1. Identificar explicitamente a dependência T1, seu PR/commit e os testes exigidos por A23; não incluí-la escondida numa tarefa de mover botão. Cobrir funções puras de navegação, integração de páginas, ciclo de sessão e regressões de pagamentos/impressão. Preferir testes de comportamento; não apagar proteções só porque um teste procura texto em `App.jsx`. Ao substituir um teste estrutural, preservar explicitamente a garantia que ele representava.

Aplicar TDD às mudanças de comportamento: demonstrar a falha antes da correção e o sucesso depois. Para extrações neutras, preservar testes de caracterização e verificar equivalência. Durante desenvolvimento, usar testes focados; antes de integrar, executar os gates completos do repositório. Não misturar migração do framework de testes ou atualização de React nesta entrega.

Homologar em staging: pedido imediato/agendado, histórico e análise, comanda e transferência protegida, recebimento avulso/comanda, falha de sincronização, configuração com resposta adiada, impressão de uma/duas vias e recuperação durante trocas de página. Usar respostas controladas nos testes de interface para cobrir trocas de estado e sessão, não apenas o caminho de sucesso. Para A25, incluir retorno antes da resposta, conclusão com a página fechada, falha conclusiva, resultado não confirmado e expiração, sem bloquear a navegação por causa do salvamento.

Após ciclos de navegação, cada consumidor global autorizado mantém uma única instância; efeitos de página são limpos ao sair, sem acumular timers, listeners ou requisições que sobrevivam indevidamente. Um timer legítimo da página ativa é permitido. Medir chamadas por função e ações não duplicadas, não impor que todas as páginas façam a mesma quantidade de requisições. Executar a homologação física de impressão na estação de testes, sem consumir a fila da produção.

Implementação somente em branch de feature/staging e, quando executada localmente, worktree nova e isolada a partir da base remota validada. Não usar reset, restore, clean ou stash sobre worktrees antigas para realizar esta tarefa. Não trabalhar diretamente em master.

Documentação, plano aprovado, implementação, homologação e liberação são gates distintos. A criação desta spec não altera os ambientes. Não há autorização de deploy ou de merge em produção. A ordem detalhada dos PRs e as extrações mínimas serão definidas no plano, respeitando T1 antes do consumo/homologação da transferência. A aprovação desta redação não é aprovação do código de T1, nem autoriza uma migração visual e estrutural gigante.

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

- [R16 — Transferência no servidor](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/worker/tableRepository.js)
- [R17 — Confirmação da transferência](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/components/TableTransferDialog.jsx)
- [R18 — Detalhes do pedido](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/components/OrderDetail.jsx)
- [R19 — Histórico e filtro da lista](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/pages/OrderHistory.jsx)
- [R20 — Cálculos de análises](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/utils/dashboardAnalytics.js)
- [R21 — Período inicial do Dashboard](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/components/DashboardPeriodProvider.jsx)
- [R22 — Painel Mais e foco](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/components/BottomSheet.jsx)
- [R23 — Estado de consulta de A receber](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/pages/Receivables.jsx)
- [R24 — Movimentações na base](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/pages/Finance.jsx)
- [R25 — Estado do catálogo](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/pages/Products.jsx)
- [R26 — Estado da fila de impressão](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/pages/PrintQueue.jsx)
- [R27 — Query padrão da fila](https://github.com/vzaponi-dotcom/sistema-para-delivery/blob/99c1f04677b54243a43d470b743cdd16ac499154/src/pages/printQueueQuery.js)

## 17. Revisão, rastreabilidade e próximo gate

### 17.1 Registro desta revisão

A revisão 2 substituiu a redação consolidada em `029f2b7f4d97f20e24f515d96f5fa2f51ae4ff5f`. Esta revisão 2.1 preserva os ajustes publicados em `45e6565e7be34c3c07d905f562e8f69dcc85f948` e os concilia com a última re-revisão autorizada: a decisão de salvamento é permitir navegação, com pendência fora da página, e não bloquear sua saída. Os códigos REV abaixo mantêm a rastreabilidade documental da revisão 2; não se confundem com as referências de arquivos da seção 16.

| Achado tratado | Decisão incorporada | Critérios principais |
|---|---|---|
| **REV-01 — Identidade da transferência** | Dependência externa obrigatória T1, sem presumir proteção atual nem mudar API dentro do PR visual. | A13, A23 |
| **REV-02 — Recebimento avulso** | Nova entrada explícita nos detalhes de Cozinha/Histórico, com pagamento central reutilizado e exclusão de mesa/comanda. | A14, A21, A22 |
| **REV-03 — Contexto real** | Matriz de campos/defaults; sem controles inventados; seleção obsoleta não assume outra comanda; obrigação de pagamento aceita sobrevive. | A10, A11, A18, A27 |
| **REV-04 — Períodos** | Comercial e operacional independentes em 30 dias; lista não filtra análise; equivalência de entradas/resultados. | A09, A24 |
| **REV-05 — Salvamento** | Navegação permitida; pendência por sessão/recurso acima da página; proteção contra edição conflitante/leitura obsoleta; reconsulta de resultado incerto e expiração invalidando callbacks. | A07, A18, A25 |
| **REV-06 — Mais/descarte** | Fechamento do painel antes da confirmação, uma intenção, foco válido e execução única. | A12, A19, A26 |

Os complementos de revisão também foram incorporados: natureza das mudanças em 1.1; glossário em 1.2; semântica única de navegação em 12; cenários de capacidades em 10.2/A29; teste mensurável de consumidores em 14/A30; não duplicar pagamento sem impedir leituras de reconciliação em A14. A matriz de contexto foi confrontada com os controles reais, inclusive a ausência de filtros em `Finance.jsx`; não exige funcionalidades que não existem apenas para preservá-las.

### 17.2 Limites da verificação e condições para avançar

A revisão documental confronta requisitos, evidências fixadas e critérios de aceitação. A01–A30 são obrigações de teste para a implementação, não testes de aplicação executados nesta entrega. Nenhum achado de runtime é declarado corrigido por atualizar este texto. Não foram executados migrations, D1 de produção, homologação física ou deploy nesta revisão documental.

As decisões de produto deste parecer estão incorporadas. A dependência T1 continua pendente e bloqueia o aceite integral da transferência; ela não precisa estar executada para escrever o plano, mas deve constar expressamente de sua ordem de execução. Ajustes de API, segurança real por perfis e políticas dinâmicas não ficam implicitamente aprovados.

O próximo gate é a conferência desta versão escrita pelo responsável pelo produto. Depois da aprovação, criar o plano detalhado em etapa separada, com rastreabilidade A01–A30 e T1; aprovação do plano precede implementação. Sem alterações diretamente em master, sem merge ou deploy automático.
