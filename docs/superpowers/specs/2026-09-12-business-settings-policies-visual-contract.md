# Spec B — Contrato visual e referência para o Codex

**Data:** 12/09/2026  
**Spec funcional:** `2026-09-12-business-settings-policies-design.md`, nesta pasta.  
**Base:** `8d2f897154526037606e9fee60f4b9a606089e8a`  
**Estado:** direção visual aprovada em conversa; tradução para implementação aguardando aprovação junto da spec escrita.  
**Natureza:** desenho de referência, não implementação nem plano TDD executável.

## 1. Qual imagem é a referência principal

O usuário aprovou por último o mockup da home de Configurações com lateral escura, área central clara, ícones vermelhos em caixas suaves e sete cards. Essa imagem deve guiar proporções, hierarquia e tratamento visual dos novos conteúdos.

Arquivo da imagem disponibilizada nesta conversa: `a_clean_modern_web_app_dashboard_ui_screen_in_the.png`.

SHA-256 do arquivo conferido: `aae2d5176fce3b891e38f92b11710d757df5603f3a33112d1fddd4913dad252f`.

A imagem não está incorporada ao GitHub por este documento. O usuário a anexará ao Codex. O nome/hash acima identifica a referência exata, evitando confundir com a colagem inicial ou com os mockups azuis. As outras imagens individuais são apoio de composição dos formulários, sujeito às correções desta seção.

### Hierarquia de autoridade

1. Decisões funcionais aprovadas e spec escrita aprovada.
2. Estrutura de navegação e invariantes entregues pela Spec A.
3. Tokens/componentes reais do repositório.
4. Último mockup aprovado como direção visual.
5. Mockups individuais anteriores como apoio, nunca fonte de novas funcionalidades.

O layout aprovado não autoriza copiar dados fictícios, menus incorretos ou controles que contradizem decisões. Havendo conflito, preservar a intenção visual e aplicar o contrato funcional, documentando a adaptação no PR.

## 2. Identidade visual a reutilizar

| Elemento | Referência do código |
|---|---|
| Tipografia | Inter com os fallbacks de src/index.css; nenhuma troca de família global |
| Fundo claro | --bg: #f6f3f1 |
| Superfície clara | --surface: #ffffff; --surface-soft: #fbf8f6 |
| Texto claro | --text: #25211f; --muted: #7d746f |
| Cor principal clara | --primary: #b7192b; suave #fbecee |
| Lateral | Base escura #211b1a de src/App.css; item ativo vermelho |
| Fundo/superfície escuros | --bg: #151211; --surface: #211d1b |
| Texto/cor principal escuros | --text: #f7f2ef; --primary: #e34b5d |
| Bordas/raios/sombras | --border, --radius-sm/md/lg/xl, --shadow-sm/md existentes |
| Controles | Button, SystemSelect, Modal, ConfirmationDialog e Icon já usados no sistema |
| Marca | sidebar-brand e símbolo atual; não introduzir uma nova versão da logo |

Usar variáveis de tema, não copiar esses hexadecimais em cada componente. O azul permanece cor semântica informativa quando apropriado, não cor principal dos botões do produto. Em tema escuro, verificar contraste dos textos/estados, não apenas inverter fundo. Mensagens de sucesso, atenção, erro e seleção usam cor mais texto/ícone.

## 3. Estrutura da home

Preservar lateral agrupada da Spec A e preencher a área de conteúdo com título Configurações, descrição curta e grade de cards. Não adicionar topbar de loja/usuário fictício só porque aparece na ilustração.

| Card visual | Descrição sugerida | Destino funcional |
|---|---|---|
| Operação | Tempos da cozinha e critérios de atraso. | Editor operacional, seção Tempos |
| Formas de pagamento | Métodos aceitos, ordem e padrão. | Política de pagamentos |
| Modalidades de pedido | Entrega, retirada e consumo no local. | Mesmo editor operacional, seção Modalidades |
| Motivos de cancelamento | Motivos disponíveis ao cancelar pedidos. | Catálogo de cancelamentos |
| Categorias financeiras | Categorias dos lançamentos manuais. | Catálogo financeiro manual |
| Impressão | Vias do negócio, estação e impressora local. | settings-printing |
| Preferências deste dispositivo | Tema e som de novos pedidos. | settings-device |

Operação e Modalidades são atalhos para blocos de um único agregado: mesma revisão, mesmo rascunho e mesmo Salvar alterações. Essa composição preserva a home de sete cards da referência sem contradizer o salvamento conjunto aprovado no exemplo de Operação. Não manter duas cópias independentes de modalidades.

Cards inteiros são acionáveis, com foco visível e título como nome acessível. Ícones não são botões separados. Omissão por capability/implementação reorganiza a grade sem lacunas; não mostrar controles desativados anunciando recursos futuros.

### Responsividade

Manter lateral desktop na largura/estrutura existente. A grade comporta até quatro colunas quando houver espaço real no conteúdo; reduzir progressivamente, sem comprimir títulos ou impor quatro colunas em tablet. No celular, uma coluna de linhas/cards compactos evita rolagem horizontal. Respeitar os breakpoints e safe areas já usados no aplicativo.

Mobile mantém Pedidos / Comandas / Financeiro / Mais. Configurações continua acessível em Mais. Botão Voltar fica no conteúdo interno; não substituir a navegação inferior por outra arquitetura. Footer de salvamento não cobre itens, teclado, botões ou a navegação.

## 4. Contrato por tela

### V01 — Home de Configurações

Tela de entrada conforme seção 3. Sem busca vazia, novos relatórios, contador fictício de notificações, seletor de loja ou nome de usuário inventado. Busca global de configurações não faz parte do recorte aprovado.

### V02 — Operação / Tempos da cozinha

Cabeçalho com retorno e identificação Para todo o negócio. Mostrar quatro campos numéricos com unidade min, descrição sem ambiguidade e limites: antecipação 50; tolerância 15; atrasado 30; muito atrasado 40 nos dados iniciais sem overrides. Esses são exemplos de default, não valores fixados na UI.

Diferenciar claramente Antes do horário agendado de Após o horário agendado. Aviso de vigência: Alterações afetam os pedidos ainda ativos. Pedidos encerrados mantêm seu histórico. Não prometer alterar horário da impressão.

Campos organizados em duas colunas quando couberem e uma no celular; não usar sliders como única entrada. Validação relacional aparece perto de muito atrasado e mantém valores digitados. Rascunho e barra de salvamento pertencem ao recurso operacional inteiro.

### V03 — Operação / Modalidades

Entradas nativas Entrega, Retirada, Local. Cada linha tem nome, estado e possibilidade de definir padrão. Sem botão Adicionar, editar nome, excluir ou arrastar ordem. Não apresentar modalidade como recurso de cardápio público ao cliente; esta spec é do aplicativo de gestão.

Atalho Modalidades da home abre esse bloco do mesmo editor de V02. Ao salvar, considerar os dois blocos e mostrar pendências mesmo quando o outro bloco estiver fora da área visível. O usuário pode mudar o padrão e desligar o antigo no mesmo salvamento válido.

Aviso: vale para novos pedidos; atendimentos existentes não serão cancelados. Explicar quando uma modalidade padrão precisa ser substituída antes da desativação.

### V04 — Formas de pagamento

Seis métodos nativos, lista compacta, estado Ativo/Inativo e badge Padrão. Ações: ativar/desativar; definir como padrão quando ativo; mover para cima/baixo. Não há criação, renomeação ou exclusão de forma de pagamento. Não incluir Vale-refeição por inferência de mockup.

Rótulos/descritivos não inventam integração bancária, bandeiras suportadas ou obrigação de pagamento na entrega. O sistema registra o meio utilizado; não processa Pix/cartão nesta spec.

Exibir mudanças como pendentes até Salvar alterações. Não usar verde de sucesso para um clique que apenas alterou rascunho. Padrão global não substitui o meio já escolhido num pagamento aberto.

### V05 — Motivos de cancelamento

Lista dos cinco nativos e personalizados reais. Todos os cinco iniciais são nativos; Outro é adicionalmente protegido contra desativação e exige descrição na operação. Não reproduzir a imagem que marcou os quatro primeiros como Personalizado.

Adicionar motivo abre modal com Nome e ativo inicial. Confirmar modal adiciona ao rascunho. Antes de salvar o catálogo, mostrar Novo / Alteração pendente. Menu de item respeita uso e origem fornecidos pelo servidor. Excluir item personalizado não usado exige confirmação e só se efetiva com o salvamento do catálogo; remoção de item recém-criado apenas o retira do rascunho.

### V06 — Categorias financeiras

Agrupar Entradas manuais e Saídas manuais de forma clara; salvar é do catálogo inteiro. Quando uma seção não estiver visível, sua contagem de alterações pendentes continua indicada. Usar rótulos Entrada/Saída, sem converter o sistema em plano de contas contábil.

Categorias automáticas Vendas/Estornos aparecem como explicação de regras do sistema, não linhas editáveis do catálogo manual. Saldo inicial não aparece nesta tela.

Adicionar categoria pede nome e tipo; a pessoa não altera o tipo de uma categoria existente. Ações de rename/delete somente para personalizados nunca usados. Não mostrar Excluir onde a API não permite.

### V07 — Impressão

Três blocos visualmente separados:

- Política do negócio: Pedidos avulsos e Mesas/comandas, seletores de 1/2 vias; Salvar política. Descrição de vigência: Apenas novas solicitações de impressão. A fila existente mantém suas vias.
- Esta estação: identificação real, plataforma, principal, autoimpressão e controles próprios; Salvar estação e ação confirmada Tornar principal quando aplicável.
- Impressora local: conexão QZ, fila selecionada, estado físico, seleção/salvamento local e Testar impressão. Os controles físicos só aparecem no contexto suportado.

O texto Pedidos avulsos evita a ambiguidade do mockup que chama também consumo no local de Pedidos e, logo abaixo, Mesas/comandas. A spec funcional define a resolução pela identidade/vínculo, não apenas pelo nome da modalidade.

Não usar um único Salvar alterações prometendo salvar atomicamente esses três recursos. Não fixar EPSON, MTP ou qualquer fila como se tivesse sido detectada. Fila encontrada não é sinônimo de pronta para imprimir. Exibir erro, estado não confirmado e reconsulta de forma localizada.

### V08 — Preferências deste dispositivo

Somente Tema (Claro, Escuro, Automático) e Som de novos pedidos. O tema muda imediatamente e utiliza o provider existente; som é a mesma preferência usada na Cozinha. Texto explícito: afeta apenas este navegador/dispositivo. Sem Salvar alterações de política do negócio.

Não incluir reduzir animações, dados fictícios do navegador, uso de armazenamento ou sincronização remota de preferências. Confirmação Salvo localmente somente após sucesso real no armazenamento quando necessário.

## 5. Estados e interações a entregar

### V09 — Adicionar item permitido

Modal de motivo/categoria, nunca de forma de pagamento. Labels claros, erro de nome vazio/duplicado, foco inicial e retorno ao disparador. Botões Cancelar e Adicionar à lista. A mensagem após confirmação explica que falta Salvar alterações na página. Escape não envia nem persiste.

### V10 — Descarte e exclusão

Descarte de rascunho: título Descartar alterações?, explicação e Continuar editando / Descartar alterações. Não colocar Salvar no modal. Excluir item tem contexto/nome do item e ação destrutiva explícita; o servidor continua sendo autoridade sobre primeiro uso.

A navegação de fundo não deve executar duas vezes. No mobile, fechar Mais antes de abrir a confirmação; não empilhar duas armadilhas de foco.

### V11 — Conflito de edição

Mensagem: As configurações foram alteradas em outro dispositivo. Suas alterações foram mantidas para revisão. Comparação do valor atual com a intenção do usuário, distinguindo itens removidos/alterados e ordem de listas.

Usar tabela de comparação quando houver espaço e linhas empilhadas no celular. Nenhum botão Sobrescrever tudo sem revisão, nenhuma perda automática de rascunho e nenhum reenvio só por atualizar a revisão. Se um item passou a ser utilizado, remover as ações que deixaram de ser válidas e explicar por quê.

### V12 — Salvando / não confirmado

Durante envio, bloquear repetição do mesmo recurso, indicar Salvando e permitir navegação conforme a Spec A. O controlador externo à página acompanha o resultado. Sucesso exige confirmação de servidor/recibo, não só alteração otimista da tela.

Resultado incerto: Resultado da gravação não confirmado. Estamos consultando o estado atual. Se a consulta falhar, oferecer Reconsultar sem criar reenvio concorrente. Não dizer Não foi salvo sem evidência. Não converter timeout em restauração de defaults.

### V13 — Somente leitura / acesso restrito

Somente leitura mostra os dados como informações, indicação Somente leitura e nenhuma ação de escrita. Não deixar formulário inteiro cinzento com tabulação por dezenas de controles desabilitados. Sem consulta, o card/destino não é acessível; tentativa de rota direta passa pela validação de acesso.

Não preencher Gerente João ou Operador Maria com dados fictícios no produto. A simulação de capabilities em testes não é administração real de perfis.

### V14 — Carregamento / indisponível / lista sem ativos

Carregamento não deve exibir defaults falsamente confirmados. Falha mantém mensagem de indisponibilidade e ação de consulta. Rascunho continua separado de valores efetivos.

Sem categorias manuais ativas de um tipo: explicar por que não é possível fazer aquele lançamento; oferecer acesso à administração apenas para quem tem a capability correspondente. Não criar categorias automaticamente por uma ação operacional.

## 6. Critérios visuais de aceite

Verificar cada página nova em desktop claro, desktop escuro e celular; conferir 360–390 px, largura de tablet e desktop usual sem rolagem horizontal acidental. Testar teclado, foco, Escape, alvos de toque, zoom, textos longos e visibilidade de ações com teclado virtual aberto.

Cards, inputs, badges, listas e diálogos devem compartilhar a linguagem do sistema. Não basta aplicar vermelho a um template azul; conservar espaçamento, fundo quente, hierarquia e agrupamento da aplicação atual.

Não considerar estados de erro/conflito/readonly concluídos por existir apenas a tela feliz. Não considerar impressão concluída por mockup ou teste de snapshot: seguir a homologação física da spec.

## 7. Orientação de passagem ao Codex

Esta seção não substitui o plano de implementação. Enquanto a spec escrita e o plano não forem aprovados, o Codex pode apenas ler, revisar e apontar incompatibilidades.

Quando receber as imagens, usar a última imagem vermelha como principal; não misturar o azul dos estudos anteriores. Ler a spec funcional e este contrato antes de sugerir tarefas. Relacionar cada imagem à tela correspondente e ignorar controles explicitamente excluídos acima.

O plano futuro deve manter tarefas pequenas por domínio e checkpoints: base/contratos e migrations; policies/catalogs; projeção e validação operacional; editores e estados; impressão e recovery; QA e gates. Isso é uma orientação de decomposição, não um roteiro executável nem autorização para começar uma dessas fases.

Antes de código, conferir master e trabalhar em branch própria/worktree isolada. Registrar o SHA inicial e preservar trabalho local existente. Não usar reset/restore/clean/stash para limpar worktree alheia. Documentação desta branch deve acompanhar a branch de implementação aprovada; não trabalhar diretamente na master.

Usar TDD RED antes de alterações relevantes, revisar entre tarefas e manter evidências. Não declarar sucesso por commit/PR criado. Staging e produção permanecem separados; merge e deploy de produção só por autorização explícita.

### Texto para anexar às imagens na etapa de revisão

> Estas imagens são referências visuais da Spec B do Gestão Delivery. A principal é a home com lateral escura e acentos vermelhos, identificada no contrato visual. Leia `docs/superpowers/specs/2026-09-12-business-settings-policies-design.md` e `docs/superpowers/specs/2026-09-12-business-settings-policies-visual-contract.md` na branch `docs/spec-b-settings-policies`. Preserve os tokens/componentes atuais e a navegação da Spec A. A spec prevalece sobre controles ilustrativos: não existe Adicionar forma de pagamento, novos menus, perfis fictícios ou salvamento global de política/estação/QZ. Nesta etapa, revise os documentos; não implemente, não faça merge e não publique produção. O plano detalhado e sua execução terão aprovação separada.

## 8. Verificação documental

Referência principal identificada pelo conteúdo, nome e hash; tokens conferidos no código; menus da Spec A preservados; sete cards reconciliados com o agregado operacional; correções dos mockups registradas; telas e estados enumerados; artefatos não apresentados como screenshots do sistema implementado.

O usuário aprovou a direção visual em conversa. A aprovação desta tradução escrita e a homologação visual/funcional da implementação continuam sendo etapas distintas.
