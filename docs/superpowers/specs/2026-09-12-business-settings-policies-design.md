# Spec B — Configurações e políticas do negócio

**Projeto:** Gestão Delivery / Amor & Sabor  
**Data:** 12/09/2026  
**Repositório:** `vzaponi-dotcom/sistema-para-delivery`  
**Base de código conferida:** `master` em `8d2f897154526037606e9fee60f4b9a606089e8a`  
**Branch documental:** `docs/spec-b-settings-policies`  
**Revisão:** 1 — decisões da conversa consolidadas e contratos reconciliados com o código.  
**Estado:** aguardando aprovação desta redação antes do plano de implementação.  
**Natureza:** documentação; não autoriza implementação, merge, migrations remotas ou deploy.

## 1. Origem, objetivo e limites

A Spec A foi integrada pelo PR #41. Seu SHA de aplicação homologado foi `7e1fb956908cf3c9efbb5506f7e9e3e152959d45`; o commit seguinte, agora na master, fechou o QA documental. A publicação em produção foi informada pelo usuário na conversa. Esta rodada conferiu código e metadados do GitHub; não constitui nova homologação de produção.

A Spec B torna administráveis somente políticas e catálogos aprovados, com escopo, persistência e domínio responsáveis explícitos. Mantém o monólito modular/serverless React/Vite + Worker + D1. Não cria microserviços nem migra globalmente o frontend para `features/`.

A referência visual principal é a última imagem aprovada: lateral escura, conteúdo claro, acentos vermelhos e cards de acesso às configurações. O contrato visual complementar está em `2026-09-12-business-settings-policies-visual-contract.md` nesta pasta. Imagem é referência de composição, não autorização para funcionalidades fictícias. As decisões funcionais deste documento prevalecem sobre controles ilustrativos das imagens.

### 1.1 Incluído

Políticas operacionais; modalidades nativas habilitadas e padrão; formas de pagamento nativas habilitadas, ordenadas e padrão; motivos de cancelamento; categorias financeiras manuais; vias por contexto; home de Configurações; edição explícita, conflitos, sincronização e recuperação de gravações desses recursos; fronteiras de capabilities para os novos recursos.

### 1.2 Excluído

Spec C: modularização ampla de App.jsx. Spec D: categorias/apresentações/variantes/complementos/precificação de produtos. Também ficam fora: usuários/perfis reais, autorização retroativa de todas as APIs, auditoria completa, editor de identidade visual, seleção de loja, Marketing, novos relatórios, cardápio público, integrações de pagamento, novos transportes de impressão e parâmetros técnicos configuráveis.

Saldo inicial permanece em Financeiro. Tema e som permanecem locais. Não introduzir placeholders de funcionalidades futuras nem atualizar dependências por conveniência.

## 2. Registro das decisões aprovadas

| Decisão | Contrato aprovado |
|---|---|
| D01 — pagamentos, B | Taxonomia nativa; negócio ativa/desativa, ordena e define padrão. Sem criação livre de métodos. |
| D02 — cancelamentos, B | Motivos-base e motivos personalizados; ativação e ordem; histórico preservado; Outro protegido com descrição obrigatória. |
| D03 — tempos, C | Políticas do negócio; vigência sobre pedidos ativos; histórico encerrado não é recalculado por mudanças futuras. |
| D04 — impressão, B+ | Pedidos avulsos: padrão 2; mesas/comandas: padrão 1; configuráveis em 1 ou 2; mudanças somente em novos jobs. Estação/QZ separados. |
| D05 — categorias financeiras, B | Automáticas protegidas; manuais administráveis por negócio e por tipo Entrada/Saída. |
| D06 — modalidades, B | Entrega, Retirada e Local são nativas; habilitação e padrão por negócio; sem CRUD livre. |
| D07 — produtos | Categorias e apresentações pertencem a Cadastro/Catálogo; evolução na Spec D. |
| D08 — duplicidade, A | Telefone normalizado não vazio único por negócio; nome repetido apenas alerta; sem sensibilidade configurável. |
| D09 — persistência, C | Recursos tipados e separados por domínio; sem depósito genérico chave/valor e sem tabela monolítica de todas as regras. |
| DA — autorização | Capabilities de domínio, nunca nomes fixos de cargos; gestão de perfis em fase posterior. |
| D10 — concorrência, B | Revisão por domínio; conflito explícito; nenhuma sobrescrita silenciosa. |
| D11 — migração, B | Backfill compatível com valores atuais; defaults defensivos para ausência legítima; histórico preservado. |
| D12 — distribuição, C | Configuração efetiva para operação; recursos administrativos completos separados. |
| D13 — sincronização, C | Configuração efetiva versionada e atualizada automaticamente; Worker decide a validade final. |
| D14 — parâmetros técnicos | Polling, heartbeat, timeouts, retenção e recovery permanecem internos. |
| D15 — fuso | America/Sao_Paulo permanece fixo nesta fase. |
| D16 — auditoria | Revisões, timestamps e IDs estáveis; sem tela de auditoria ou log genérico de alterações de negócio. |
| D17 — invariantes | Pelo menos um método e uma modalidade ativos; padrão ativo; histórico legível; Outro de cancelamento protegido. |
| D18 — navegação, C | Home de Configurações com acessos por domínio; páginas internas; sem página única extensa ou excesso de abas horizontais. |
| D19 — salvamento | Rascunho e Salvar alterações para políticas/catálogos; tema e som imediatos. |
| D20 — listas, C | Lista responsiva compacta; ações por item; criação em modal quando permitida; ordenação também por teclado/toque. |
| D21 — saída | Confirmação Continuar editando / Descartar alterações; sem Salvar no modal de descarte. |
| D22 — acesso, C | Consulta e gerenciamento distintos; leitura sem controles de edição; área omitida quando não consultável. |
| D23 — conflito, C | Preservar rascunho e apresentar diferenças com a versão atual antes de novo envio. |
| D24 — atomicidade, C | Todo o domínio salva ou nada salva; uma nova revisão por mudança efetiva bem-sucedida. |
| D25 — limites, C | Agendado antecipado 0–240; tolerância 0–120; imediato atrasado 1–180; muito atrasado maior que atrasado e até 240; minutos inteiros. |
| D26 — identidade, B | Nativos não renomeáveis; personalizados renomeáveis somente antes do primeiro uso. |
| D27 — exclusão, B | Somente personalizados nunca usados podem ser excluídos; usados apenas desativados; nativos não excluídos. |
| DV — visual | Último mockup com lateral escura e acentos vermelhos aprovado como direção visual; imagens individuais, não colagem. |

As seções seguintes concretizam essas decisões. Pontos técnicos que não foram votados isoladamente — composição dos recursos, recibo de gravação e preservação de métricas históricas — fazem parte desta redação para aprovação, não de uma implementação já autorizada.

## 3. Inventário e classificação

Escopo define quem é afetado; domínio define quem valida e mantém a regra. Um registro no D1 não é automaticamente global: uma estação continua tendo identidade e configuração próprias.

| Regra/dado | Escopo e persistência | Domínio responsável | Inicialização / UI / impacto |
|---|---|---|---|
| Métodos ativos, ordem e padrão | Negócio; D1 | Pagamentos | Seis nativos, Pix padrão; Configurações/Pagamentos; novos recebimentos e lançamentos. [R3, R4] |
| Motivos de cancelamento | Catálogo do negócio; D1 | Pedidos/cancelamento | Cinco atuais; Configurações/Pedidos; novos cancelamentos. [R5] |
| Antecipação e tolerância de agendados | Negócio; D1 | Operação | 50/15 min; Operação; fila e indicação de tempo, não horário de impressão. [R6, R8] |
| Atraso/muito atraso de imediatos | Negócio; D1 | Operação | 30/40 min; Operação; marcadores e análises compatíveis. [R6, R7] |
| Habilitação e modalidade padrão | Negócio; D1 | Operação/pedidos | Entrega, Retirada, Local; Entrega padrão fora de contexto de mesa. [R10, R15] |
| Vias de pedido avulso | Negócio; D1 | Impressão | Preservar default_copies já salvo; fallback 2; Configurações/Impressão. [R8, R9] |
| Vias de mesa/comanda | Negócio; D1 | Impressão | 1; abrange pedido vinculado a mesa e resumo da comanda; novos jobs. [R8, R9] |
| Estação, automação e principal | Estação/topologia do negócio; D1 | Impressão | Preservar configuração; controles separados da política de vias. [R9, R11] |
| ID local e impressora Windows/QZ | Estação local; armazenamento local | Transporte de impressão | Preservar seleção por estação; não replicar fila Windows para outra máquina. [R11] |
| Tema e som da cozinha | Dispositivo; localStorage | Interface/avisos | Preservar valor existente; Preferências deste dispositivo. [R1, R12] |
| Categorias/apresentações de produtos | Cadastro/Catálogo | Produtos | Constantes atuais preservadas; evolução somente em D. [R3, R4] |
| Categorias financeiras manuais | Catálogo do negócio; D1 | Financeiro | Taxonomia atual como base; Configurações/Financeiro. [R3] |
| Vendas/Estornos automáticos | Invariante de domínio | Financeiro | Sem edição, desativação ou reutilização como categoria manual. [R3, R8] |
| Saldo inicial | Estado financeiro; D1 | Financeiro | Mantido na tela e no contrato financeiro existente. [R10, R12] |
| Telefone único / nome repetido | Integridade / aviso | Clientes | Preservar normalização e triggers; nenhuma tela nova. [R13] |
| Tipos estruturais, status, dinheiro em centavos | Domínio | Respectivo domínio | Não viram listas arbitrárias administráveis. [R4, R8] |
| Polling, heartbeat, timeouts, retenção | Técnico; código | Sincronização/impressão | Sem UI de configuração; não alterar nesta spec. [R9, R12] |
| Fuso, moeda, sessão, limite de login | Contexto técnico/segurança | Infraestrutura | Fuso São Paulo e BRL preservados; sem configuração nova. [R3, R10] |
| Textos/branding do ticket e defaults de formulário de produto | Apresentação/cadastro | Impressão/produtos | Registrados como fora do recorte aprovado; sem novo editor. [R8, R12] |

Este inventário cobre os pontos examinados para o recorte da B, não afirma eliminar toda constante existente no repositório. Encontrar outro número não autoriza aumentar o escopo.

## 4. Organização visual e navegação

### 4.1 Home de Configurações

Usar a composição de cards do último mockup aprovado, com ícone, título, descrição curta e seta. Os sete acessos visuais são: Operação; Formas de pagamento; Modalidades de pedido; Motivos de cancelamento; Categorias financeiras; Impressão; Preferências deste dispositivo.

**Reconciliação entre D18/D19 e o mockup:** Operação e Modalidades são dois acessos ao mesmo domínio operacional, abrindo respectivamente as seções Tempos e Modalidades da sua página. Não criar uma segunda política de modalidades nem dois formulários concorrentes. Os dois blocos compartilham rascunho, revisão e um salvamento atômico. O retorno à home cancela ou confirma o descarte segundo D21. Abrir o outro bloco do mesmo editor não apaga o rascunho.

Os demais cards abrem recursos próprios. `settings-printing` e `settings-device` permanecem destinos válidos; adicionar home e novos destinos ao registro existente, sem duplicar navegação paralela. Somente destinos implementados e autorizados são exibidos. Um conjunto limitado a preferências locais continua encontrando essa opção sem cards vazios.

### 4.2 Estrutura existente que deve continuar

Preservar os grupos da Spec A: Operação (Pedidos, Comandas, Fila de impressão); Financeiro (Visão geral, A receber, Movimentações); Cadastros (Clientes, Produtos e preços, Mesas); Configurações. No mobile: Pedidos, Comandas, Financeiro e Mais, respeitando capabilities. Cozinha/Histórico continuam dentro de Pedidos.

Não copiar dos mockups menus fictícios como Marketing, Relatórios, Minha loja, um segundo acesso independente a Cozinha ou Cardápio no lugar de Produtos e preços. Não adicionar usuário fictício, seletor de loja, notificações ou versão inventada. Não refazer a logo nesta spec. [R1, R2]

### 4.3 Páginas e editores

Cada editor tem retorno a Configurações, título, descrição, indicação de escopo e aviso de vigência. Inputs numéricos usam teclado apropriado no mobile; estados não dependem só de cor. Páginas administrativas têm indicação de alterações pendentes e Salvar alterações / Descartar, em área acessível sem cobrir conteúdo ou navegação mobile.

Listas de pagamentos não têm Adicionar, Renomear ou Excluir. Motivos/categorias têm Adicionar; o modal adiciona ao rascunho, não ao banco. Menus respeitam isSystem e usedEver informados pelo servidor. Itens nativos e já utilizados continuam identificáveis. Reordenar por ações Mover para cima/baixo funciona sem drag-and-drop; arrastar é apenas complemento.

Modalidades têm ativação e padrão; sua ordem nativa permanece Entrega, Retirada, Local. Não introduzir reordenação apenas porque um mockup contém um puxador.

Tema e som salvam imediatamente; falha de armazenamento local não pode ser apresentada como sucesso. Não criar diagnósticos de armazenamento/navegador, controle adicional de animações ou sincronização de preferências entre dispositivos.

### 4.4 Impressão: três recursos, não um botão global

A página mostra blocos visuais para Política do negócio, Esta estação e Impressora local/QZ. Salvar a política é independente de Salvar estação e Salvar impressora. Não prometer transação única entre D1, localStorage e hardware. Tornar principal mantém confirmação explícita; Testar impressão é uma ação física, não salvamento de formulário.

Distinguir QZ conectado, fila Windows encontrada e impressora fisicamente pronta. Encontrar uma fila não prova prontidão física. A UI existente de recovery/atenção permanece disponível. [R9, R11]

### 4.5 Estados obrigatórios

Carregando; pronto; somente leitura; rascunho alterado; erro por campo; salvando; salvo confirmado; conflito com comparação; gravação não confirmada; serviço indisponível; sem permissão; nenhum item ativo; confirmação de descarte/exclusão.

A aprovação da direção desktop não equivale a homologação mobile/escura. Ambos são critérios de aceite. Mockups adicionais, quando solicitados, devem mostrar cada tela individualmente.

## 5. Recursos tipados e responsabilidade

Os nomes abaixo são o desenho de referência. A implementação pode adaptar nomes físicos sem alterar contratos, escopos, revisões ou garantias; mudanças de comportamento exigem revisão da spec.

| Recurso | Conteúdo tipado | Persistência proposta | Revisão |
|---|---|---|---|
| operations | Quatro tempos; modalidades habilitadas; modalidade padrão | business_operation_settings + business_order_modalities | Uma por negócio para o conjunto |
| paymentMethods | Seis códigos nativos; ativo; ordem; padrão | business_payment_settings + business_payment_methods | Uma por negócio |
| cancellationReasons | ID/código, rótulo, ativo, ordem, origem e primeiro uso | business_cancellation_settings + business_cancel_reasons | Uma por catálogo do negócio |
| financeCategories | ID/código, tipo, rótulo, ativo, ordem, origem e primeiro uso | business_finance_category_settings + business_finance_categories | Uma para o catálogo manual Entrada/Saída |
| printingPolicy | orderDefaultCopies e tableTabDefaultCopies | Evoluir business_print_settings | Uma por negócio |
| stationConfiguration | Identidade/nome, automação e configuração administrativa da estação | Evoluir print_stations; eleição da principal é operação própria | Revisão administrativa separada de heartbeat |
| localPrinter | Nome da fila e vínculo ao ID da estação | Armazenamento local existente | Confirmação local, não revisão global do negócio |
| devicePreferences | Tema e som | Armazenamento local existente | Sem revisão de política do negócio |

Cabeçalhos por domínio contêm business_id, revision, created_at e updated_at. Listas pertencem ao mesmo agregado de seu cabeçalho. Uma transação que altera vários itens do catálogo incrementa a revisão uma vez. Ordenação é do catálogo, não de cada componente React.

Não criar um settings.get('qualquer-chave') nem fazer Settings.jsx conhecer SQL ou regras operacionais. Schemas/defaults/códigos puros podem ser compartilhados; persistência e validação de ações permanecem no domínio do Worker. Componentes de formulário/lista podem ser reutilizados sem criar um motor genérico de configuração.

## 6. Contratos funcionais dos domínios

### 6.1 Formas de pagamento

Códigos internos estáveis: cash, pix, debit_card, credit_card, transfer, other. Rótulos nativos: Dinheiro, Pix, Cartão de débito, Cartão de crédito, Transferência, Outro. Nenhum deles é renomeável, criável ou excluível pelo negócio. Inicializar todos ativos, em ordem de operação Pix, Dinheiro, débito, crédito, transferência, outro; Pix padrão.

É obrigatório haver ao menos um ativo; o padrão pertence ao conjunto ativo. Trocar o padrão e desativar o antigo pode ocorrer no mesmo salvamento, validando o estado final. A interface não deixa simplesmente desativar o padrão sem substituto.

Separar código interno de rótulo/valor legado. Preservar a leitura de payments.method e movements.payment_method já gravados e os valores portugueses aceitos pelos endpoints existentes. Mapear entradas nativas para a política central; não fazer migração destrutiva de todo o histórico para novos códigos nem usar lista de ativos para filtrar histórico.

Aplicar a política nos recebimentos avulsos, pagamento de comanda, checkout pago quando suportado, movimentações manuais e registro de estorno. Pagamento e estorno são registros, não integrações bancárias. Novo lançamento precisa de método ativo. Em estorno de pagamento antigo cujo método foi desativado, mostrar a forma original como informação e exigir escolha explícita de uma forma ativa efetivamente utilizada; nunca trocar silenciosamente para Pix. Não inventar exceção para método inativo sem aprovação.

O padrão sugere a seleção em novo recebimento; não marca pedido como pago, não altera formulários já preenchidos e não reescreve pagamentos existentes. Campos que hoje exigem seleção explícita no movimento manual podem continuar vazios inicialmente; a política não transforma uma sugestão em pagamento efetuado.

### 6.2 Motivos de cancelamento

Preservar códigos client_changed_mind, duplicate_order, product_unavailable, entry_error e other, com os rótulos atuais. Todos são nativos, não personalizados; iniciar ativos. other permanece ativo, não renomeável/excluível e exige nota não vazia. A descrição mantém o limite de 240 caracteres da UI, validado também no servidor para novos cancelamentos.

Personalizados recebem ID/código imutável gerado sem colisão com os nativos. Exigir rótulo não vazio, sem duplicidade normalizada no catálogo, com até 80 caracteres. Permitir ativação e ordem; renomeação/exclusão somente antes de primeiro uso. Note/requiresNote de Outro é regra nativa, não campo editável.

Cancelar usa um motivo ativo do próprio negócio, conserva o código e a nota no pedido e mantém os efeitos existentes sobre operação, estorno e impressão. Desativar não impede ler um cancelamento anterior. Não mudar elegibilidade de cancelamento nem criar estorno automático novo.

### 6.3 Categorias financeiras

Categorias automáticas Vendas e Estornos continuam pertencendo ao domínio financeiro. Não estão no conjunto editável de categorias manuais, não podem ser desativadas e não viram escolha para movimento manual.

Inicializar categorias manuais atuais de shared/finance.js: Entrada — Aporte, Outros recebimentos; Saída — Insumos, Embalagens, Delivery / Frete, Gás, Água, Energia, Aluguel, Manutenção, Taxas, Retirada, Outros. Preservar seus códigos e normalização de registros legados. As iniciais são nativas: identidade protegida, ativação e ordem permitidas, exclusão proibida.

Personalizados: ID estável, tipo Entrada ou Saída imutável após criação, nome de 1–80 caracteres, ativo, posição e usedEver. Comparação de nomes é normalizada dentro do mesmo tipo; não aceitar nomes reservados das categorias automáticas. Alterar tipo exige criar outra categoria. Uma lista por tipo pode estar sem ativos: impedir novo lançamento daquele tipo com mensagem explicativa, sem inventar categoria fallback ou interromper movimentos automáticos.

Referências em movimentos atuais, históricos e soft-deleted contam como uso. Uma categoria que já foi usada continua bloqueada para renomear/excluir mesmo que o movimento seja editado ou removido logicamente. Ao editar movimento antigo, permitir manter sua categoria/método original inativo sem tratá-lo como uma nova seleção; uma mudança de referência só aceita opção ativa. Não alterar silenciosamente categoria histórica.

### 6.4 Operação e modalidades

Tempos em minutos inteiros: antecipação agendada 50 (0–240); tolerância agendada 15 (0–120); atraso imediato 30 (1–180); muito atraso imediato 40 (maior que atraso e até 240). Rejeitar vazio, decimal, NaN, negativo e combinação relacional inválida. Zero só é válido nos dois primeiros campos.

A política vigente afeta o cálculo de pedidos ativos, inclusive agendados já criados. Mudança não altera createdAt, scheduledFor, finishedAt, cancelamento, identidade, itens ou valores do pedido. Campos de horário, elegibilidade de agendamento e matemática existente permanecem; unificar origem dos limites não autoriza trocar limites estritos por inclusivos ou arredondamentos sem teste de caracterização. Os defaults devem reproduzir o comportamento da base. [R6, R7]

Uma antecipação menor pode devolver um agendado ainda ativo à seção de espera; uma maior pode fazê-lo entrar na operação. A página avisa isso antes de salvar. Não criar/reabrir jobs nem repetir som de pedido já alertado só porque houve troca de política. Um pedido que se torna operacional pela primeira vez usa a detecção de chegada existente. O horário de disponibilidade da impressão automática permanece o vigente na base, que cria o job disponível na criação; não atrelar impressão novamente à antecedência de preparo. [R8, R12]

**Histórico congelado:** políticas atuais não recalculam pedidos encerrados. Para encerramentos posteriores à B, guardar no pedido um snapshot tipado dos quatro limites vigentes, na mesma escrita do encerramento. Essa evidência serve ao cálculo histórico, não é audit log administrativo. Pedidos já encerrados antes da B e sem snapshot continuam usando os limites legados, sem backfill de tempos/dados de venda. Inclusões retroativas não devem fingir conhecer uma política histórica: usar explicitamente a referência legada. Leitores/relatórios/tempos compartilhados precisam escolher política de ativo versus histórico conscientemente.

Modalidades continuam nativas Entrega, Retirada, Local; todas começam ativas. Padrão geral inicial Entrega. Ao iniciar por uma comanda, contexto Local prevalece sobre padrão geral, somente se Local estiver habilitado. Não criar pedido de entrega vinculado à mesa por aplicar padrão genérico.

Desativar uma modalidade bloqueia somente novas criações nela, inclusive novos pedidos adicionados a uma comanda. Pedidos/comandas existentes ainda podem ser consultados, finalizados, pagos, transferidos ou impressos conforme sua elegibilidade. Não renomear modalidades, excluir históricos ou cancelar pedidos existentes. Garantir pelo menos uma ativa e padrão ativo.

### 6.5 Impressão por contexto

A quantidade não depende da máquina solicitante. Resolver no domínio, usando a identidade real:

| Contexto | Política para novo job sem escolha manual explícita |
|---|---|
| Pedido sem vínculo de mesa/comanda | orderDefaultCopies; inicial preserva o valor existente, fallback 2 |
| Pedido com customerIdentity.type = table ou tableTabId | tableTabDefaultCopies; inicial 1 |
| Resumo da comanda, job type table-tab | tableTabDefaultCopies; inicial 1 |
| Impressão de teste | Continua com uma via; não consome a política comercial |

Um Local legado sem vínculo de mesa não deve ser classificado como comanda apenas pelo texto Local. Na UI atual o novo Local exige mesa; a compatibilidade do legado não pode associá-lo arbitrariamente a outra entidade. Não usar nome da mesa ou texto do cliente para resolver contexto.

Persistir a quantidade resolvida em copies_requested no instante de criação do job. Jobs pendentes, em processamento, com primeira via concluída ou em recovery preservam sua quantidade. Retry/retomada é o mesmo job e não consulta novo default. Uma nova reimpressão com quantidade explicitamente escolhida continua usando a escolha válida; default só preenche ausência de escolha. Não trocar snapshots, documentos, parent_job_id ou afinidade de recovery por mudar política.

**Achado obrigatório para o plano:** repositories.js fixa uma via nos pedidos de mesa; createManualTableTabPrintJob fixa uma via no resumo; a migration 0022 contém CHECK de uma via para type table-tab. Tornar o segundo contexto configurável exige nova migration preservando jobs/tentativas/índices/FKs e adaptar os caminhos de execução/segunda via que pressupõem orderId. Não basta adicionar campo na tela. [R8, R9]

Para table-tab com duas vias, cada via precisa de tentativa e confirmação próprias, sem consultar um orderId inexistente. Aplicar o fluxo manual de duas vias já existente ao documento de comanda; quando houver confirmação/decisão pendente, apresentá-la ao executor e na fila, com identidade do job/comanda. Não criar um popup de origem dependente de um pedido fictício. Recovery mantém afinidade até concluir ou dispensar a segunda via antes de avançar.

Preservar a distinção entre envio ao spooler e impressão física confirmada. Não reimprimir automaticamente resultado desconhecido. Não adicionar autoimpressão de resumo de comanda. Política do negócio usa D1; nome/automação da estação usa configuração de estação; nome de fila QZ continua local.

Manter default_copies de print_stations apenas como campo legado de compatibilidade, sem autoridade ou fallback comercial. Não é necessário removê-lo fisicamente nesta B. Atualizar os consumidores para a única fonte de política e provar por testes que o legado não determina vias.

## 7. Acesso, distribuição e sincronização

### 7.1 Autorização preparada, sem alegar perfis já existentes

Hoje há login por PIN do negócio e capabilities legadas no frontend; autenticar não identifica Gerente João versus Operador Maria. Esta spec não cria esses usuários. [R2, R10]

Definir matriz de acesso dos novos recursos: operations.settings.view/manage; payments.settings.view/manage; orders.settings.view/manage; finance.categories.view/manage; printing.settings.view e printing.settings (gestão existente); printing.station.view/configure; preferences.local (já existente). Nomes de novas capabilities podem ser ajustados ao registro canônico; preservar as existentes e não espalhar verificações de nome de cargo.

Consulta administrativa exige capability de consulta; mutação exige gestão. Os conjuntos destinados à gestão incluem consulta correspondente. Ler configuração efetiva necessária para uma ação operacional não exige administrar Configurações. Ex.: payments.receive precisa das opções de pagamento ativas, não do direito de editá-las.

Criar fronteiras de verificação no Worker para endpoints novos/evoluídos de configurações, derivadas da sessão/contexto confiável do servidor. Preservar validação de origem das mutations e business_id da sessão. Não confiar em businessId, role ou capabilities enviados no corpo pelo navegador.

Na compatibilidade legada, o contexto autenticado continua com as permissões amplas atuais explicitamente resolvidas pelo servidor; ausência de identificação de perfil não transforma um operador em gerente real. Testar os handlers com contextos limitados e negar capabilities desconhecidas. Migrar permissões de todas as APIs/datasets atuais continua sendo escopo da futura fase de autorização; não anunciar segurança global de perfis ao entregar B.

### 7.2 Configuração efetiva versus recurso administrativo

Adicionar effectiveBusinessConfig ao bootstrap e um endpoint de leitura operacional dedicado. Ele expõe apenas dados necessários: tempos; modalidades ativas/padrão; métodos ativos/ordem/padrão; motivos ativos quando aplicáveis; categorias ativas para quem lança movimentos; vias necessárias à impressão. Não distribuir inativos, recibos de mutations ou metadados administrativos sem necessidade.

Recursos administrativos próprios retornam ativos/inativos, origem, restrições de ação, revision e timestamps. Exemplos de rotas: GET/PUT /api/settings/operations; /api/settings/payment-methods; /api/settings/cancellation-reasons; /api/settings/finance-categories. Evoluir /api/printing/settings como recurso de impressão, sem criar uma segunda autoridade. Estação mantém APIs específicas.

Cada GET administrativo retorna resource, revision e data tipado. Cada PUT recebe expectedRevision, mutationId e data completo daquele agregado; o servidor devolve revisão e dados confirmados. A operação é substituição validada do agregado, não comandos arbitrários por chave.

### 7.3 Versões e atualização

A versão efetiva é composição determinística das revisões dos domínios, não um contador global usado para bloquear toda edição. Pode ser representada por vetor de revisões e um identificador opaco derivado. Alterar impressão não faz um formulário de pagamentos conflitar.

Aproveitar o sincronizador existente: transportar versão leve na consulta periódica já realizada; buscar novamente a projeção efetiva quando mudar. Não criar timer em cada página ou componente. Com a aplicação visível/online, detectar no ciclo normal existente de sincronização global; não prometer entrega instantânea por WebSocket. Retorno ao foco/reconexão dispara revalidação. [R12]

Cache em memória é vinculado a negócio, geração da sessão e conjunto de capabilities. Resposta antiga não substitui dados mais novos nem sobrevive a logout/troca de negócio. Atualizar opções não deve apagar itens de carrinho, cliente, valor, rascunho administrativo ou uma escolha ainda válida. Escolha recém-inativada fica marcada e exige revisão explícita; nada é enviado com outra opção silenciosamente.

O Worker valida operações contra a política válida na escrita, mesmo com UI atrasada. Proteger também a corrida entre ler a política e gravar pedido/pagamento/cancelamento/movimento; não basta validar antes de um await e escrever incondicionalmente depois. Conflito retorna erro identificável, sem efeitos parciais, e preserva o formulário.

## 8. Salvamento, concorrência e recuperação

### 8.1 Rascunho e atomicidade

Estado oficial confirmado separado de base da edição e rascunho. Alterações de inputs, listas, ativação, padrão e ordem são locais até Salvar alterações. Validar o agregado inteiro; comparar expectedRevision e avançar revision apenas no mesmo compromisso de persistência que grava os dados. Nenhum estado inválido intermediário pode ficar visível.

No D1, batches oferecem transação e rollback quando uma instrução falha. Um UPDATE condicional que afeta zero linhas não é, por si, uma falha SQL: as demais escritas precisam estar guardadas pela mesma condição ou por um guard que aborte o batch. Nunca usar SELECT de revisão seguido de escritas desprotegidas. O plano deve escolher uma estratégia D1 demonstrável por testes reais de duas gravações concorrentes, incluindo as tabelas filhas. [R16]

usedEver/primeiro uso é metadado de servidor, não editável no payload. Sua marcação pertence à mesma transação do uso operacional e é permanente. Exclusão/renomeação compete atomicamente com primeiro uso: ou a mudança válida vence antes do uso, ou o uso vence e a mudança é recusada. Leituras prévias de contagem não são proteção suficiente.

### 8.2 Conflito de revisão

Responder com 409 e código SETTINGS_REVISION_CONFLICT, sem gravar parcialmente. Preservar rascunho e base original. Consultar a versão atual e comparar três estados: base lida, valor atual e intenção do usuário. Campos que só mudaram remotamente devem permanecer remotos na proposta; não copiar o formulário antigo inteiro sobre uma base nova.

Campos/listas alterados pelos dois lados exigem revisão explícita. Ordem pode ser comparada como lista inteira; exclusão concorrente, item que se tornou usado e novo padrão recebem explicação específica. Mostrar Atual no negócio / Seu ajuste / Escolha para o novo salvamento. Não atualizar expectedRevision e reenviar automaticamente o rascunho antigo. Novo envio ocorre só após revisão e com novo mutationId.

### 8.3 Resultado de gravação desconhecido

Timeout/queda de rede após envio não significa rollback. Mostrar Resultado não confirmado, manter intenção e bloquear novo envio diferente para o mesmo recurso até reconciliar. Uma leitura de valor antigo isolada não prova que a escrita anterior falhou.

Proposta técnica desta redação: recibo operacional de configuração identificado por business_id + recurso + mutationId, com hash canônico do payload, revisão resultante e timestamp, persistido junto da mutação. Repetição da mesma ID/payload recupera o resultado sem nova revisão; mesma ID com payload distinto é rejeitada. Recibos não guardam histórico de valores antes/depois ou inventam autor humano: não substituem audit log futuro.

O cliente mantém ponteiro de envio pendente no sessionStorage, vinculado à sessão/negócio, para reconsultar após reload na mesma sessão. Não persistir token de autenticação ali. Logout/expiração elimina estado local sensível e invalida respostas tardias. Não oferecer fila de gravações administrativas offline nem reenvio invisível ao recuperar conexão. Retenção de recibos: janela técnica de 24 horas; após a janela, não repetir automaticamente operação incerta, carregar estado atual e exigir nova revisão. Esse período é parâmetro técnico, não configuração do gerente.

### 8.4 Navegação e desmontagem

Antes do envio, sair com rascunho abre Continuar editando / Descartar alterações; não salvar dentro dessa confirmação. Navegação só prossegue após descarte e revalidação do destino. Modal único, foco devolvido e suporte a Escape.

Depois do envio, preservar a garantia da Spec A: gravação de configuração não depende da página permanecer aberta. O controlador autenticado mantém a operação, confirma/reconcilia e emite feedback fora da página; não abortar escrita assumindo cancelamento por unmount. Guard de rascunho não se confunde com bloqueio de request em andamento. Recarregar/fechar utiliza o aviso nativo quando disponível, sem prometer impedir todo fechamento do navegador.

### 8.5 Erros e indisponibilidade

400: contrato/campos inválidos; 401: sessão expirada; 403: acesso negado; 404: recurso/referência não pertencente ao negócio; 409: revisão, item em uso ou opção alterada concorrentemente; 503: fonte de configuração indisponível. Retornar mensagens úteis e campos afetados, sem SQL ou segredos.

Defaults são válidos somente para ausência legítima de registro em schema disponível. Falha de rede, erro SQL, migration ausente, registro corrompido ou falha de autorização não podem ser convertidos em defaults permissivos. Sem configuração confirmada, não permitir mutations dependentes dela; consulta previamente carregada pode continuar com aviso de desatualização. Distinguir conexão operacional de falha de salvar um formulário.

## 9. Migração e compatibilidade

Usar migrations novas, posteriores às existentes; não editar migrations já publicadas. Nomear os próximos números somente ao preparar implementação na master então vigente.

Backfill por negócio conhecido no D1, com IDs/códigos estáveis e valores legados. Valores já configurados têm precedência: por exemplo, default_copies existente igual a 1 deve continuar 1, apesar de o fallback do sistema ser 2. Não restaurar indiscriminadamente 2 em todos os negócios. Tema, som, ID da estação, autoimpressão, principal e fila QZ devem ser preservados.

As categorias e motivos iniciais preservam códigos/rótulos da base. Não reescrever valores financeiros, referências de pedido, números de comanda, pagamentos, movimentos, documentos de impressão, status ou decisões de segunda via. Novos snapshots históricos são escritos apenas no encerramento posterior à B; ausência em histórico legado usa regra de leitura documentada.

A reconstrução de print_jobs necessária ao CHECK de table-tab deve preservar também print_job_attempts, índices, unicidades, chaves estrangeiras e colunas de afinidade/recovery introduzidas depois da migration 0022. Reconciliar o schema final incluindo 0023; copiar cegamente a definição antiga perde colunas e é proibido.

Contrato administrativo antigo sem expectedRevision não pode permanecer como bypass de concorrência. GET legado de impressão pode oferecer alias de leitura defaultCopies durante transição; PUT antigo deve pedir atualização do cliente, não sobrescrever sem revisão. Preservar endpoints operacionais existentes por adapters e validação do domínio, sem duplicar regras de negócio.

Recuperar configuração após rollout antes de habilitar gravação na UI nova. Testar tanto banco vazio quanto banco migrado com overrides, histórico, jobs em diferentes estados e registros soft-deleted. Não assumir que reexecutar uma migration já aplicada faz parte do fluxo; verificar a sequência de migrations e o seed defensivo.

Rollback de aplicação deve ser avaliado junto do schema/políticas. Depois de aceitar personalizações ou jobs table-tab de duas vias, o código antigo pode não saber interpretá-los. Não declarar downgrade cego seguro; registrar no runbook a compatibilidade testada e priorizar correção adiante quando o downgrade perder semântica. Sem migration destrutiva para apagar dados novos como rollback automático.

## 10. Fronteiras de implementação futura

Criar módulos pequenos para schemas/defaults/mapeamentos, repositórios e handlers de cada domínio; projeção efetiva; contexto de capabilities do servidor; controladores de configurações e componentes de apresentação. Usar os diretórios existentes como pontos de integração; nenhuma mudança de organização geral de produtos/clientes/financeiro só por tamanho de arquivo.

App.jsx deve apenas integrar o ciclo autenticado, dados efetivos, navegação e feedback necessários. Não duplicar polling nem mover toda a orquestração de pagamentos/Comandas/impressão para um novo framework. Reutilizar hasCapability, registro de destinos, guard de navegação, API client e componentes de diálogo existentes.

Pontos que obrigatoriamente entrarão no plano: shared/finance.js; shared/orderTiming.js; worker/validation.js e validadores específicos; criação/finalização de pedidos; pagamento avulso e de comanda; cancelamento/estorno; movimentos; APIs/repositório/manager de impressão; bootstrap/sync; Settings e consumidores de opções/defaults. A lista é integração, não autorização para refatoração irrestrita.

## 11. Critérios de aceite e testes

### 11.1 Caracterização antes de mudar

Registrar a base e executar testes existentes. Teste RED específico antes de cada comportamento novo, integração ou correção relevante; demonstrar falha pelo motivo esperado antes do código. Preservar uma comparação com os defaults legados, incluindo arredondamentos e fronteiras exatas de tempo.

### 11.2 Matriz mínima

| Área | Evidência exigida |
|---|---|
| Políticas | Defaults; overrides existentes; inteiros/faixas; padrão ativo; pelo menos um método/modalidade; schema inválido não vira fallback. |
| Catálogos | Native/custom; ativo/inativo; Outro protegido; tipos financeiros; histórico e soft-delete; primeiro uso concorrente com renomear/excluir; nomes duplicados. |
| Concorrência D1 | Duas gravações da mesma revisão: exatamente uma aceita; zero escrita parcial da perdedora; independência entre domínios; rollback de falha em item intermediário. |
| Recuperação | Resposta perdida após commit; timeout antes de commit; replay da mesma mutationId; payload diferente; janela expirada; reload; logout e resposta tardia. |
| Configuração efetiva | Bootstrap; versão muda; projeção atualiza; resposta fora de ordem descartada; foco/reconexão; sem vazamento entre negócio/sessão/capabilities; rascunho não apagado. |
| Pagamentos | Todos os caminhos usam a mesma política; padrão só em nova seleção; inativo bloqueia nova seleção; histórico legível; manter referência antiga ao editar; nenhum pagamento/estorno duplicado. |
| Operação | Contexto de mesa prevalece; modalidade desativada não trava encerramento existente; política muda fila ativa; nenhum histórico recalculado; nenhum som/job duplicado. |
| Impressão | Avulso 1/2; pedido de mesa 1/2; resumo table-tab 1/2; teste sempre 1; job antigo congelado; retry e reprint; fila sem ordem/jobId fictício; status físico versus spooler. |
| Estação | default_copies legado sem autoridade; heartbeat não altera revisão administrativa; principal única; seleção local preservada e não propagada. |
| Acesso | Sem sessão; sem consulta; consulta apenas; gestão; contexto legado explícito; rejeição de businessId/capabilities forjados no payload; sem alegar perfis globais. |
| UX | Home filtrada; leitura; edição; criação pendente; ordem por teclado; descarte; conflito comparado; erro; envio incerto; navegação durante envio; claro/escuro/mobile. |
| Regressões da A | Cozinha/Histórico; contexto e seleção; Comandas/transferência; pagamento; Financeiro; fila e afinidade de recovery; impressão física. |

### 11.3 Gates de código e homologação

Na implementação, executar npm test, npm run lint, npm run build, dry-run do Worker sem publicação em ambos os ambientes e npm run d1:migrate:local. Usar versões/commands do repositório no momento, não instalar versões novas fora do plano. Dry-run não é deploy nem teste físico. [R14]

Homologar staging desktop/mobile em claro/escuro e perfis simulados de capabilities. Fazer impressão física/QZ para ambos os contextos, uma e duas vias, impressora desconectada, recuperação, resultado desconhecido e segunda via antes de próximo job. Não aprovar somente com mocks do QZ.

QA deve registrar SHA da aplicação, banco de staging/migrations, cenários/evidências, falhas corrigidas e o que ainda não foi testado. Revisão prioriza regressões demonstráveis e problemas Critical/Important, não ciclos indefinidos de preferência estética.

## 12. Próximos passos e autorização

Esta revisão é submetida à aprovação do usuário. Após aprovação da spec escrita, criar plano detalhado com writing-plans, tarefas verificáveis, caminhos exatos, RED/GREEN e checkpoints de revisão. A aprovação de mockup não equivale à aprovação desse plano nem da implementação.

Ao executar futuramente, partir de master atualizada após a A em branch própria e worktree isolada; incorporar a documentação aprovada sem alterar uma worktree suja. Não usar reset/restore/clean/stash em worktree alheia. Se master avançar, conferir diff de base antes do plano/execução.

Nenhum merge em master ou deploy de produção sem autorização explícita própria. A branch documental pode permanecer aberta até consolidar aprovação/plano; não é uma release implementada.

## 13. Fontes e rastreabilidade

Todos os caminhos abaixo foram auditados nesta conversa na base `8d2f897154526037606e9fee60f4b9a606089e8a` ou constam do inventário anterior da mesma base. São evidência de código, não de dados da produção.

- R1: src/index.css; src/App.css; src/pages/Settings.jsx — tokens, layout, preferências locais.
- R2: src/components/Sidebar.jsx; src/app/navigation.js; src/app/access.js; docs/superpowers/specs/2026-09-11-information-architecture-navigation-design.md — navegação e capacidades.
- R3: shared/finance.js; shared/productCatalog.js — métodos, categorias e catálogo.
- R4: worker/validation.js; worker/financeValidation.js — validações nativas.
- R5: worker/orderCancellation.js; src/components/CancelOrderDialog.jsx — motivos e nota.
- R6: shared/orderTiming.js — 50/15/30 e cálculos de tempo.
- R7: src/utils/orderWorkflow.js — marcador muito atrasado em 40 e comparações existentes.
- R8: worker/repositories.js, especialmente createOrder/updateOrderStatus/loadBootstrap — regras de mesa, política atual e disponibilidade imediata do job.
- R9: worker/orderPrintingApi.js; worker/orderPrintingRepository.js; migrations/0014_centralized_print_queue.sql; migrations/0022_table_tab_print_jobs.sql; migrations/0023_print_recovery_job_affinity.sql — políticas, schema e recovery.
- R10: worker/index.js — sessão, bootstrap, APIs operacionais e impressão de comanda.
- R11: src/app/usePrintingSettingsController.js; src/components/PrintingSettingsContent.jsx; src/printing/localPrintStation.js; src/printing/usePrintingManager.js; src/printing/secondCopyPromptFlow.js — recursos, saúde e segunda via.
- R12: src/App.jsx; src/utils/orderRealtime.js; src/utils/theme.js — sincronização, chegadas e preferências.
- R13: shared/clientIdentity.js; migrations/0004_client_phone_uniqueness.sql — duplicidade.
- R14: package.json; .github/workflows/validate.yml; .github/workflows/deploy-production.yml — gates e release manual.
- R15: src/pages/NewOrder.jsx — Entrega padrão e Local por contexto de mesa.
- R16: documentação primária Cloudflare D1, D1 Database / batch(): https://developers.cloudflare.com/d1/worker-api/d1-database/ — consultada em 12/09/2026; garante rollback do batch diante de falha SQL, não substitui o desenho de guard de revisão.

## 14. Autorrevisão documental

Conferidos: decisões D01–D27 e autorização; fronteiras B/C/D; origem dos defaults; preservação de overrides; distinção entre pedido de mesa e resumo; CHECK de table-tab; snapshots e histórico; assinatura de revisão; operações incertas; fronteira de capabilities legada; reconciliação das imagens com escopo e navegação da A.

Esta autorrevisão não é execução de testes, revisão independente, homologação ou aprovação do usuário. A próxima etapa continua sendo revisar esta redação antes do plano.
