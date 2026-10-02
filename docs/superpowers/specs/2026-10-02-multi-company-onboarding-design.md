# Mesiva — Multiempresa e primeiro acesso pelo painel interno

**Data:** 2026-10-02
**Issue:** [#87 — Implementar multiempresa e onboarding pelo painel interno da Mesiva](https://github.com/vzaponi-dotcom/sistema-para-delivery/issues/87)
**Estado:** desenho conversacional aprovado; Spec escrita para revisão. A implementação depende da aprovação desta Spec e do plano de implementação.
**Base inspecionada:** `550a073fa92ba5213eb9e67b70a1008402626247`, branch da issue #44, PR [#85](https://github.com/vzaponi-dotcom/sistema-para-delivery/pull/85).

## 1. Resultado pretendido

A Mesiva deve conseguir cadastrar uma empresa contratante pelo próprio painel, informar seu primeiro gerente e enviar o convite por e-mail. O gerente define sua senha, entra e prepara sua operação. Cadastrar outro cliente não exige terminal, configuração de DNS ou credenciais de infraestrutura por empresa.

Todas as empresas usam o mesmo endereço do aplicativo. Uma pessoa tem uma conta com e-mail e senha únicos e pode participar de várias empresas, com perfil diferente em cada uma. Quem possui acesso a uma empresa entra diretamente; quem possui vários acessos escolhe qual operação abrir.

O administrador da Mesiva cadastra empresas, acompanha os convites dos primeiros gerentes e os reenvia. Esse acesso não concede consulta aos pedidos, clientes, finanças, equipe ou configurações operacionais das empresas.

O sucesso desta entrega exige provisionamento consistente, convites utilizáveis, autenticação global, autorização por vínculo e isolamento dos dados também na API, na TV, na impressão e nas abas do navegador.

## 2. Decisões aprovadas e alcance

| Tema | Decisão |
|---|---|
| Endereço | Um endereço por ambiente. Não haverá subdomínio por cliente. |
| Conta | E-mail normalizado único globalmente; uma senha por pessoa. |
| Empresas | Uma conta pode ter vários vínculos; cada vínculo possui seu perfil. |
| Entrada | Uma empresa elegível: entrada direta. Várias: seleção após autenticação. |
| Cadastro | Painel privado da Mesiva, com nome da empresa, nome e e-mail do primeiro gerente. |
| Primeiro acesso | Convite por e-mail. Conta nova define senha; conta existente autentica e aceita o novo vínculo. |
| Operação inicial | Cadastros operacionais vazios e configurações padrão próprias. |
| Administração Mesiva | Lista, criação e detalhes da empresa, situação e reenvio do convite inicial. |
| Troca de empresa | Menu da conta; vale para as abas do mesmo navegador e limpa dados da operação anterior. |
| Falha de envio | Cadastro permanece pendente e pode ser reenviado, sem duplicar empresa ou gerente. |
| Infraestrutura | Configuração por ambiente; primeiro administrador preparado uma vez por ambiente. |

Não entram nesta entrega: cadastro público, contratação automática, cobrança, planos, editor de perfis, domínio próprio por cliente, acesso de suporte às operações, suspensão comercial de empresas ou exclusão de históricos. Gerente e operador continuam como perfis iniciais fixos.

## 3. Fundamentos existentes e dependências

- A Spec de persistência central de 2026-09-01 já previa `business_id` nas entidades, mas excluía seletor e gestão de empresas da primeira versão.
- A Spec da issue #44 exclui multiempresa. Seus vínculos, perfis, capacidades, auditoria e proteção do último gerente serão a base desta frente.
- `worker/index.js` ainda usa `BUSINESS_ID = 'amor-e-sabor'` nas entradas de autenticação e no corte de sessão. Muitos repositórios operacionais já recebem `context.businessId`; isso não comprova isolamento completo.
- `users` e `user_credentials` possuem escopo por empresa. O login atual consulta a credencial dentro de um negócio previamente determinado. O fluxo aprovado exige separar identidade global e vínculo empresarial.
- `sessions` e `audit_events` têm referências compostas por empresa. A troca de operação não pode alterar retroativamente a empresa de uma sessão referenciada por eventos anteriores.
- `prepareBuiltinRoles` permite preparar os perfis de uma empresa. As migrações de configurações preenchem somente os negócios existentes no momento da migração; o provisionamento deve inicializar explicitamente os novos negócios.
- A coordenação entre abas e os controles de proprietário de mutações já existem e precisam incorporar a mudança de empresa.
- Login e recuperação por e-mail estão implementados na branch da PR #85. A validação real do envio, o bootstrap e o corte de e-mail em staging permanecem pendentes na data desta Spec.

Esta entrega depende da base de acesso individual e e-mail. O plano será escrito sobre a base integrada mais recente, mantendo explícita a dependência da PR #85. Esta Spec não autoriza seu merge nem transforma testes de e-mail pendentes em concluídos.

## 4. Arquitetura selecionada

Adotar identidades globais e vínculos por empresa no Worker e no banco central existentes. Aplicação, API, banco e serviços de cada ambiente são compartilhados entre empresas; não se provisiona servidor nem deploy por cliente. O isolamento é lógico, com restrições e autorização verificadas no servidor, e precisa ser comprovado antes da liberação multiempresa.

O servidor resolve o contexto empresarial a partir da sessão e de um vínculo válido. O navegador informa uma empresa desejada somente ao selecionar ou trocar a operação; esse ID nunca concede acesso por si só.

Essa estrutura atende ao login antes da seleção e evita configuração de infraestrutura por cliente. Contas independentes por empresa exigiriam identificar o negócio antes de verificar a senha ou manter credenciais divergentes. Implantação independente por cliente acrescentaria provisionamento e manutenção por empresa. Essas alternativas não atendem tão diretamente ao fluxo aprovado.

### 4.1 Responsabilidades

| Unidade | Responsabilidade | Dependências |
|---|---|---|
| Identidade | E-mail, credencial, verificação, login e recuperação globais | Banco, verificadores de senha, limites e e-mail |
| Vínculos | Relação conta–empresa, perfil, aceite e desativação | Identidade, empresa, catálogo de capacidades |
| Sessões e contexto | Identidade autenticada, escopo selecionado, expiração e troca | Conta, vínculo ou concessão administrativa |
| Provisionamento | Criar empresa, padrões, vínculo e convite inicial consistentemente | Banco, perfis, configurações e convites |
| Administração Mesiva | Autorizar lista, criação, detalhe e reenvio inicial | Concessão administrativa e provisionamento |
| Entrega de e-mail | Enviar convite/recuperação e registrar resultado limitado | Resend e configuração global do ambiente |
| Domínios operacionais | Consultar e alterar recursos apenas no contexto autorizado | Contexto empresarial e capacidades semânticas |
| Runtime do navegador | Seleção, coordenação entre abas e descarte de dados/respostas antigos | Sessão oficial e APIs de domínio |

Os handlers delegam essas responsabilidades a serviços focados. A mudança não deve concentrar provisionamento, identidade, seleção e regras operacionais em `worker/index.js`.

## 5. Modelo de identidade e autorização

### 5.1 Conta global

A conta possui ID estável, e-mail normalizado único, nome de apresentação, estado de ativação, verificação do e-mail e timestamps. A credencial global possui verificador versionado, revisão e data de troca. Usar a mesma normalização de e-mail em login, recuperação, convites e unicidade.

Uma conta ainda não ativada não concede acesso. O nome informado no convite preenche o vínculo; um convite de outra empresa não substitui silenciosamente os dados globais de uma conta existente.

### 5.2 Vínculo empresarial

Cada vínculo relaciona conta, empresa e perfil, com estado pendente, ativo ou desativado. Existe no máximo um vínculo da mesma conta com a mesma empresa. Perfis e capacidades continuam locais ao negócio; ser gerente em A não confere capacidades em B.

Os IDs dos usuários empresariais existentes continuam como referência histórica de ator. A evolução de `users` para representar o vínculo pode acrescentar a referência à conta global. Registros antigos desativados podem permanecer sem conta global; nenhum endpoint deve tratá-los como acesso utilizável.

As referências entre vínculo, perfil e recurso precisam incluir o negócio. Não basta comparar IDs globais no frontend ou acrescentar um filtro apenas em listagens.

Desativar vínculo ou mudar perfil revoga as sessões selecionadas nessa empresa. Não altera credencial global nem os vínculos ou sessões em outras empresas. Para empresa ativa, permanece a proteção contra remover o último gerente ativo com acesso à gestão de contas, inclusive sob concorrência.

### 5.3 Administrador da Mesiva

Uma concessão administrativa explícita e revogável associa a conta global às capacidades de cadastro, consulta administrativa e convite inicial. Ela não é um perfil empresarial nem um wildcard operacional.

O contexto administrativo autoriza somente as APIs do painel. Para abrir uma operação, a conta precisa possuir um vínculo empresarial próprio. O painel não cria esse vínculo automaticamente para o administrador.

Auditoria da plataforma registra ator administrativo, empresa alvo, ação, resultado e horário. Fica separada dos registros operacionais que os gerentes consultam. O administrador não consulta a auditoria operacional dos clientes pelo painel desta entrega.

## 6. Login, seleção e sessão

### 6.1 Entrada

O login valida e-mail e senha globalmente, sem exigir empresa. Mantém erro genérico, verificação de senha para identidade inexistente e limites por identidade e origem. A consulta de empresas exige autenticação concluída.

- Um vínculo ativo com empresa ativa: selecionar automaticamente e abrir a operação.
- Vários vínculos elegíveis: mostrar seleção com nome e perfil em cada empresa.
- Nenhum vínculo elegível: mostrar que não há operação liberada, com saída e acesso ao aceite de convite recebido. Não carregar bootstrap operacional.
- Acesso iniciado por `/mesiva`: após autenticação e validação da concessão, abrir o painel administrativo. Quem não tem essa concessão recebe acesso negado.

O login geral apresenta acesso ao painel para uma conta administrativa. Se essa conta não possui empresas elegíveis, pode seguir diretamente ao painel. Se possui vínculos, mantém o comportamento de seleção acima, com um destino explícito para administração.

Não persistir seleção autoritativa no localStorage. Um destino de retorno deve ser interno, permitido e compatível com o contexto selecionado; nunca aceitar redirecionamento arbitrário enviado por link.

### 6.2 Sessões

Manter cookie opaco, seguro, HttpOnly, SameSite, sem credenciais no JavaScript, e armazenamento de token por hash. Adotar nome próprio da Mesiva e expirar o cookie legado no corte. Duração absoluta: 12 horas em dispositivo compartilhado e sete dias em dispositivo pessoal.

Uma sessão tem conta global, revisão da credencial, escopo e contexto. Antes da seleção pode autenticar identidade sem conceder operação. No escopo empresarial, inclui empresa e vínculo; no escopo administrativo, exige a concessão da plataforma.

O contexto empresarial de um registro de sessão é imutável. Ao selecionar ou trocar empresa, revogar a sessão anterior e emitir outra, atomicamente, preservando a referência dos eventos históricos à empresa original. A troca conserva o vencimento absoluto original; não estende a duração a cada seleção. Sessões selecionadas e pré-seleção precisam de restrições que rejeitem formas inconsistentes.

Cada requisição revalida conta, revisão da credencial e, conforme escopo, vínculo/perfil/empresa ou concessão administrativa. Não confiar em capacidades recebidas do navegador.

Cookie tem escopo de host, sem compartilhamento entre staging e produção. Login, sessão, seleção, painel e dados autenticados usam política de cache que impeça reutilização pública de respostas pessoais. Mutações, incluindo login, aceite, recuperação e troca, mantêm validação de origem e os controles de CSRF existentes. Não criar endpoint alternativo sem esses controles.

### 6.3 Troca e abas

`Trocar empresa` aparece no menu quando houver várias empresas elegíveis. O servidor valida a empresa desejada e o vínculo da conta e faz a troca somente sobre a sessão vigente.

O runtime pausa novas ações e impressão automática durante a troca. Se houver mutação ou impressão de resultado incerto, deve reconciliar a tentativa na empresa de origem antes de permitir a troca; não reaplicar a ação na empresa destino. Reaproveitar os controles existentes de saída de sessão e proprietário da mutação.

Após a troca, limpar dados operacionais, filtros específicos, seleções de clientes/pedidos, rascunhos e feedbacks ligados à empresa anterior; carregar novamente sessão, capacidades e bootstrap. Preferências próprias do dispositivo que envolvam estação/impressora precisam incluir empresa e estação na chave; não transportar associação de impressora entre operações.

Todas as requisições operacionais humanas devem levar um marcador não secreto do contexto oficial carregado. O Worker compara esse marcador com a sessão atual; marcadores ausentes ou divergentes não podem executar ações nem consultar dados no contexto recém-selecionado. Retornar conflito de contexto e exigir atualização. O marcador não substitui autenticação ou autorização.

Publicar invalidação entre abas após o sucesso; cada aba descarta o contexto anterior e revalida no servidor. Mesmo sem BroadcastChannel ou eventos de storage, a comparação de contexto impede uma aba antiga de operar silenciosamente na nova empresa.

Respostas antigas devem ser descartadas pelo runtime. Uma requisição já autorizada e executada antes da troca pode concluir na empresa de origem; seu efeito não será movido nem repetido. Testar esse limite explicitamente.

Trocas concorrentes, saídas e mudanças de credencial exigem comparação da sessão/revisão vigente. Apenas uma troca vence; a outra revalida o estado e não cria uma sessão utilizável concorrente a partir da sessão revogada.

## 7. Provisionamento da empresa

### 7.1 Transação inicial

O formulário recebe nome da empresa, nome do primeiro gerente e e-mail. Validar formatos, limites e normalização antes de gravar. Gerar ID e identificador interno únicos; nomes comerciais iguais são permitidos e não identificam o tenant.

Uma transação cria:

1. Empresa no estado de primeiro acesso pendente.
2. Configurações e dados de perfil próprios, a partir dos padrões versionados da aplicação.
3. Perfis gerente e operador com capacidades explícitas.
4. Conta global pendente, se ainda não existir, ou referência à conta existente.
5. Vínculo pendente do primeiro gerente e convite por hash.
6. Registro da tentativa de envio e auditoria administrativa.

O provisionamento precisa inicializar políticas de operação, modalidades, pagamentos, cancelamento, categorias financeiras e estruturas necessárias à impressão, incluindo suas revisões. Usar os padrões compartilhados atuais; não copiar configurações da empresa de staging.

Não copiar pedidos, clientes, produtos, mesas, comandas, movimentos, estações cadastradas ou credenciais de TV. Não criar credencial PIN. A empresa é preparada diretamente para contas individuais.

O primeiro gerente ainda pendente é uma exceção controlada à exigência de gerente ativo. A empresa não abre operação antes do aceite válido. A ativação do primeiro vínculo libera a empresa na mesma transação. Depois disso, a proteção do último gerente se aplica normalmente.

### 7.2 Idempotência

A criação recebe uma chave de idempotência por tentativa do formulário, vinculada ao administrador e ao conteúdo normalizado. Persistir recibo e hash do conteúdo na transação.

Repetição com a mesma chave e conteúdo retorna a mesma empresa. A mesma chave com conteúdo diferente gera conflito. Outra chave representa uma nova criação; o botão deve impedir clique duplicado e a interface deve reconciliar uma resposta perdida antes de permitir uma nova tentativa.

Concorrência ao criar contas para o mesmo e-mail resolve pela unicidade global. Não duplicar identidades nem aproveitar uma conta com senha divergente como resultado de migração automática.

### 7.3 Envio após a gravação

Enviar somente depois da confirmação da transação. Falha do Resend não desfaz a empresa nem o vínculo. Resposta perdida da criação não deve gerar outro negócio.

Token em claro existe apenas no processamento em memória necessário à mensagem; não persiste em recibos, filas, logs ou auditoria. A tentativa inicial pode ser concluída em trabalho de execução do Worker, com estado persistido. Se o processamento não completar, o painel mostra envio pendente ou resultado não confirmado, permitindo reenvio. Não prometer retentativa durável baseada somente no hash do token.

Reaproveitar timeout, tentativas limitadas e chave de idempotência do provedor. Confirmação de aceitação pelo Resend não prova chegada à caixa de entrada. Não habilitar rastreamento de links ou de abertura nos e-mails de acesso.

## 8. Convites e recuperação globais

### 8.1 Convite para conta nova

Convite tem empresa, vínculo, destinatário normalizado, perfil/revisão esperados, emissor, propósito, prazo e token aleatório de pelo menos 32 bytes guardado por hash. Validade inicial: 24 horas; uso único. URL usa fragmento e o frontend o remove do histórico antes de inspecionar; não guardar token em storage ou parâmetros de consulta.

O link apresenta a empresa e permite definir a senha e aceitar o vínculo. Aceite verifica destinatário, conta, empresa, papel vigente, expiração, consumo e revogação. Ativação da identidade, verificação do e-mail, definição da credencial e ativação do vínculo devem ser consistentes e concorrência deve produzir somente um aceite.

Se outra ativação já criou a credencial dessa conta, este convite não pode substituí-la: passa ao fluxo de conta existente, exigindo autenticação correspondente. Outros convites empresariais pendentes podem continuar válidos e exigem seu próprio aceite.

Após definir senha, seguir ao login; não emitir sessão silenciosamente pelo token do convite. Se a conta já estiver autenticada corretamente, o aceite de um vínculo pode retornar à seleção mantendo a sessão, sem selecioná-lo implicitamente.

### 8.2 Convite para conta existente

Não trocar senha, credencial, nome global, concessão administrativa ou outros vínculos. Exigir login na conta do mesmo e-mail e confirmação explícita para aceitar a empresa e o perfil apresentados. Uma sessão de outra conta não aceita o convite.

Antes do aceite, o novo vínculo não aparece como operação elegível. O remetente não recebe detalhes sobre a participação ou credenciais do destinatário em outras empresas. Gerentes seguem podendo convidar a equipe de sua própria empresa por esse mesmo serviço.

### 8.3 Reenvio

O administrador da Mesiva pode reenviar somente o convite inicial da empresa. Gerentes podem reenviar os convites que têm autorização para administrar dentro do próprio negócio.

Se o vínculo estiver ativo, o reenvio é rejeitado e o painel informa que o acesso foi ativado. Não transforma o convite em recuperação de senha. Para vínculo ainda pendente, reenvio cria novo token/prazo e revoga o anterior. Mudança ou desativação do vínculo também invalida o convite correspondente.

Aplicar intervalo mínimo de 60 segundos, quotas persistentes e limite de envio do ambiente. Reenvio concorrente não pode deixar convites inconsistentes; somente o desafio vigente é aceito. Resultado de envio incerto é identificado como não confirmado, preservando a validade do desafio que pode ter sido entregue.

### 8.4 Recuperação e mudança de senha

Recuperação é global por e-mail, sem seleção prévia de empresa. Resposta pública genérica e sem diferença de caminho temporal que revele existência de conta. Persistir quota pública antes da resposta e processar elegibilidade/envio no contexto de execução, preservando a correção já implementada na PR #85.

Desafio de recuperação: 30 minutos, hash, uso único, vinculado à conta e revisão da credencial. Conclusão troca a senha global, incrementa revisão, consome/invalida desafios de credencial e revoga todas as sessões humanas da conta em todos os negócios e no painel. Solicitar recuperação, por si só, não revoga acesso.

Convites pendentes para outras empresas não são desafios de senha e não serão consumidos pela recuperação; seu aceite continua exigindo a identidade correspondente e as verificações empresariais.

Gerente não redefine a senha global de outra pessoa nem força sua revogação em outras empresas. A equipe usa recuperação pelo próprio e-mail. A gestão empresarial pode desativar ou reatribuir somente seu vínculo. Remover o fluxo legado de redefinição administrativa por empresa após o corte.

Manter a política de senha já aprovada para e-mail, com mínimo de 15 caracteres, limite de 1.024 pontos de código e verificador versionado. Limites de login/recuperação passam a ter chave global por identidade e origem; convites também têm escopo de empresa e emissor. Manter quota agregada por ambiente para proteger o provedor.

A mudança voluntária de senha em `Minha conta` exige senha atual e altera somente a própria identidade. Atualiza a revisão e revoga as sessões anteriores; emite uma sucessora para o navegador atual somente se o contexto continuar elegível, conservando seu vencimento absoluto. As outras abas revalidam pelo mecanismo de sessão. Mudança de e-mail global não é exposta nesta entrega.

## 9. Isolamento de todos os recursos

O servidor deriva empresa de contexto oficial e verifica esse contexto antes de acessar um domínio. Nenhum fallback para Amor & Sabor permanece em autenticação, bootstrap, configuração ou rota operacional da entrega multiempresa.

A revisão deve cobrir listagens, consultas por ID, mutações, relações entre recursos, relatórios, histórico, recibos de idempotência, projeções, auditoria, downloads e logos. IDs de outro negócio devem ser rejeitados sem revelar seu conteúdo. Revisões e recibos de uma empresa não validam alterações de outra.

Chaves e consultas precisam vincular pedido, cliente, produto, comanda, pagamento, estação e job ao mesmo negócio. Restrições no banco impedem associações cruzadas onde essas referências são persistidas; testes de API continuam necessários.

Objetos no R2 usam namespace empresarial e leitura/escrita autorizada. Cache de dados, assets de negócio e preferências não pode compartilhar resultados entre tenants sem chave e política de acesso adequadas. Assets genéricos da Mesiva continuam compartilháveis.

TV possui credencial própria, vinculada a uma empresa e ao seu destino autorizado. Trocar a empresa de uma sessão humana não muda a empresa da TV já vinculada. Provisionamento, rotação e leitura da TV não podem inferir empresa fixa ou aceitar negócio livre sem validação.

Estações, filas, tentativas, assinaturas de impressão e reimpressões usam o negócio autorizado. A impressão automática segue dependendo da sessão humana selecionada; não executa jobs da empresa anterior após troca. Não haverá identidade autônoma de estação nesta frente.

O frontend continua usando capacidades semânticas; não usa nome do perfil para conceder acesso. O painel administrativo possui navegação e APIs próprias e não recebe o bootstrap operacional como efeito de autenticação.

### 9.1 Contratos de entrada

| API | Autorização e contrato |
|---|---|
| `POST /api/auth/login` | E-mail, senha e modo do dispositivo; autentica identidade global e resolve entrada conforme seção 6 |
| `GET /api/auth/session` | Retorna identidade, escopo, contexto vigente e capacidades oficiais; sem dados operacionais de outras empresas |
| `GET /api/auth/businesses` | Conta autenticada; lista somente vínculos elegíveis com ID/nome da empresa e perfil |
| `POST /api/auth/select-business` | Conta autenticada; recebe empresa desejada e marcador de contexto atual; valida vínculo e faz troca atômica |
| `POST /api/auth/select-platform` | Conta autenticada com concessão Mesiva; recebe marcador atual e troca para escopo administrativo |
| `POST /api/auth/logout` | Encerra a sessão deste navegador e coordena as abas; não encerra outros dispositivos |
| `POST /api/auth/password-recovery` | E-mail global, quotas e resposta genérica; sem necessidade de empresa |
| `POST /api/auth/email-challenges/inspect` e `/complete` | Desafios de ativação da identidade ou recuperação; finalidade obtida do desafio persistido |
| `POST /api/auth/company-invitations/inspect` e `/accept` | Token do convite empresarial; aceite segue fluxo de conta nova ou autenticação correspondente para conta existente |
| `GET /api/platform/businesses` | Escopo administrativo; busca e paginação com limite; somente dados de cadastro e convite inicial |
| `POST /api/platform/businesses` | Escopo administrativo; três campos do cadastro e chave de idempotência; retorna empresa/recibo e situação de envio |
| `GET /api/platform/businesses/:id` | Escopo administrativo; detalhe do cadastro e convite inicial |
| `POST /api/platform/businesses/:id/first-manager-invitation/resend` | Escopo administrativo; somente primeiro vínculo ainda pendente, sujeito a intervalo e quota |

Sessão distingue conta global e vínculo empresarial; o campo de ator empresarial continua identificando o vínculo, sem substituir IDs históricos pelo ID global. Respostas de contexto incluem marcador não secreto e escopo; capacidades empresariais aparecem somente no escopo empresarial. Operações administrativas também comparam o marcador, impedindo ação enviada por tela antiga após mudar de escopo.

Convites empresariais usam `/aceitar-convite` com fragmento. Ativação administrativa e recuperação continuam em `/ativar-conta` e `/redefinir-senha`. Adaptar cobertura de rotas e deep links à nova página. Tokens legados e endpoints de convite/redefinição por empresa não fornecem caminho alternativo após o corte.

## 10. Interface e estados

### 10.1 Seleção de empresa

Tela responsiva com logo Mesiva, identificação da conta e lista de empresas elegíveis com nome, perfil e ação `Entrar`. Não exibir empresas alheias nem inferir acesso por pesquisa pública de e-mail. Exibir carregamento, lista vazia, falha recuperável e saída. Na troca, destacar a operação atual.

### 10.2 Painel administrativo

- `/mesiva/empresas`: lista paginada com busca por nome, nome da empresa, primeiro gerente, situação do convite/acesso e ação de detalhe; CTA `Nova empresa`.
- `/mesiva/empresas/nova`: três campos com labels explícitos, validação, resumo antes da criação e ação `Criar empresa e enviar convite`.
- `/mesiva/empresas/:id`: identificação da empresa e primeiro gerente, histórico mínimo das tentativas e ação de reenvio quando elegível.

Estados de negócio e entrega são separados. Acesso: `Aguardando ativação` ou `Acesso ativado`. Convite pendente: envio em processamento, enviado ao provedor, falha de envio, envio não confirmado ou expirado. Expiração e revogação prevalecem sobre um resultado de envio anterior. Após aceite, o estado de acesso prevalece e reenvio fica indisponível.

Não mostrar senha, token bruto, chaves de infraestrutura, payload do provedor ou lista de outras empresas do gerente. O detalhe não é uma porta para entrar na operação do cliente.

Usar os componentes e cores da Mesiva aprovados nas melhorias de acesso, layouts responsivos, foco visível, labels e mensagens próximas dos campos. Ações possuem texto curto e contexto no cabeçalho; não concatenar nomes longos nos itens de menus. Abrir um menu por vez, com fechamento por ação, Escape e clique externo.

## 11. Preparação inicial e corte

As chaves de Resend, bindings do banco/R2 e configuração do endereço continuam globais ao ambiente. O cadastro no painel usa os bindings e secrets do Worker; nunca pede essas chaves ao cliente ou ao administrador na interface.

O primeiro administrador exige procedimento privado uma vez por ambiente: verificar titularidade, registrar identidade/concessão pendentes e emitir convite por e-mail. Ativação usa o fluxo global e só libera o painel após verificar a conta. Não haverá endpoint público para criar administrador ou escolher capacidades de plataforma.

O procedimento inicial é auditado, idempotente e não permite mudar a senha de uma conta existente. Reenvio da ativação inicial segue os mesmos contratos de segurança. A recuperação posterior do administrador usa o e-mail global. Emergência continua procedimento privado com verificação de titularidade.

O usuário autorizou começar com contas fictícias novas em staging. A migração desta frente pode revogar/desativar as credenciais e acessos humanos antigos de staging e criar novas identidades pelo processo definido. Preservar empresas, IDs históricos de atores, pedidos e registros; não juntar automaticamente contas antigas com e-mails iguais e senhas diferentes.

Separar migração estrutural, preparação administrativa e corte efetivo. Só ativar o novo fluxo remoto depois de confirmar conta administrativa e meios de acesso à primeira empresa, com backup e roteiro de retorno compatível com as migrações. Falha durante o preparo não pode deixar a aplicação dependente de um convite inexistente.

Manter staging e produção isolados. Esta autorização cobre desenho; não autoriza migração, destruição de contas reais, merge ou rollout de produção. A migração de contas de produção exige desenho e aprovação próprios se houver acessos reais na data do lançamento.

## 12. Critérios de aceitação

| Cenário | Resultado exigido |
|---|---|
| Cadastro normal | Empresa, padrões, perfis e primeiro convite preparados; sem dados de demonstração copiados |
| Resposta perdida e repetição | Mesma chave retorna mesma empresa; conteúdo diferente gera conflito |
| Falha transacional | Não sobra empresa parcialmente provisionada nem concessão sem convite |
| Falha ou incerteza do provedor | Cadastro persiste; painel informa situação correta e permite reenvio elegível |
| E-mail novo | Definição da senha, aceite único e liberação consistente do primeiro gerente |
| E-mail existente | Login e aceite; credencial e vínculos anteriores preservados |
| Convite errado, vencido ou revogado | Não ativa conta/vínculo nem altera senha |
| Convites simultâneos da mesma conta | Uma identidade global; nenhuma segunda ativação sobrescreve a credencial |
| Recuperação | Resposta pública genérica; conclusão revoga sessões globais, sem agir por mera solicitação |
| Uma empresa | Entrada direta com capacidades do vínculo |
| Várias empresas | Seleção mostra só empresas autorizadas; perfil próprio em cada uma |
| Gerente em A, operador em B | Permissões diferentes efetivas na UI e API |
| Nenhuma empresa | Sem bootstrap ou acesso operacional; orientação e saída disponíveis |
| Administrador Mesiva | Cadastro/convites permitidos; dados operacionais negados sem vínculo próprio |
| Gerente empresarial | Painel da plataforma negado, inclusive por URL e API diretas |
| Vínculo desativado em A | Acesso a A revogado; conta e vínculo B preservados |
| Último gerente | Empresa ativa não perde último administrador empresarial, inclusive sob concorrência |
| IDs e referências cruzados | Leituras, alterações, recibos, logos e associações negados para outro negócio |
| Troca em duas abas | Abas revalidam; contexto antigo não lê nem altera a empresa nova |
| Resposta/mutação em voo | Resposta antiga descartada; efeito confirmado permanece na origem, sem repetição |
| Trocas concorrentes | Um novo contexto vence; sessão anterior revogada não gera outra troca válida |
| TV e impressão | Credenciais/jobs permanecem na empresa correta; troca humana não muda uma TV vinculada |
| Sessão e histórico | Troca não prolonga duração nem reatribui empresa de auditorias anteriores |
| Bootstrap administrativo repetido | Não duplica administrador nem sobrescreve credencial ativa |

## 13. Sequência e evidências necessárias

O plano deve organizar a entrega em etapas dependentes: identidade global e migrações; vínculos e convites; sessões/contexto e isolamento; provisionamento e APIs administrativas; UX e coordenação entre abas; homologação remota. São partes de um mesmo resultado, sem liberar clientes multiempresa antes das verificações de isolamento.

Verificação automatizada deve usar pelo menos duas empresas e contas com diferentes combinações de vínculo. Incluir migrações sobre a base atual, integridade de referências, transações concorrentes, autenticação, quotas, convites, domínio administrativo e matriz de endpoints operacionais. Testes precisam tentar trocar IDs, contextos e referências entre empresas, além de conferir respostas normais.

Verificação de interface: desktop e celular, seleção e troca, duas abas, ausência de menus não autorizados, estados vazios e de falha. Homologação em staging: criação pelo painel, e-mail real autorizado, ativação, aceite de conta existente, recuperação, reenvio e isolamento por interface e API, com evidências do commit publicado.

TV deve ser testada com credenciais de cada empresa. A impressão física permanece indisponível para teste pelo usuário; verificar isolamento de fila/estação/assinatura e registrar esse limite, sem afirmar homologação do equipamento.

Depois da revisão desta Spec, escrever plano detalhado com arquivos, migrações, checkpoints, testes e sequência de corte. A implementação só começa após aprovação do plano e escolha do método de execução. Não escrever produto, executar migrações remotas ou publicar esta arquitetura durante a etapa de documentação.
