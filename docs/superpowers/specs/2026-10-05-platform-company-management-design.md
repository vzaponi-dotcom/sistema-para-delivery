# Gestão administrativa de empresas Mesiva

Data: 05/10/2026. Branch: `codex/administracao-empresas`.

Estado: especificação aprovada pelo usuário em 05/10/2026. O usuário escolheu o layout de lista com página dedicada de detalhes e a exclusão recuperável. Este documento define a primeira entrega; não descreve funcionalidades já publicadas. O [plano de implementação](../plans/2026-10-05-platform-company-management.md) foi aprovado e concluído localmente, com revisão independente e evidências no [QA](../qa/2026-10-05-platform-company-management.md). Publicação aguarda os testes manuais e autorização posterior.

## 1. Objetivo e limites

Permitir que a administração Mesiva acompanhe as empresas, suspenda seu acesso, administre vínculos e convites e exclua/restaure cadastros sem perder o histórico operacional. A pessoa administradora precisa identificar a situação atual, compreender o alcance de uma ação e verificar seu resultado.

A primeira entrega reúne a interface e as regras de gestão, mantendo o painel nas rotas atuais `/mesiva/empresas`. A segunda entrega será a separação em `admin.mesiva.com.br` e uma versão administrativa de homologação, com especificação própria. Não alterar DNS, origens de autenticação, cookies ou workflows de deploy nesta entrega.

O painel administrativo opera no contexto `platform`. Ele não concede acesso operacional implícito a pedidos, clientes, financeiro ou impressão. Homologação continua ligada somente ao Worker/D1/R2 de staging, com dados fictícios; gestão real usa os cadastros da produção.

Ficam fora desta entrega: exclusão física ou automática de dados, alteração de preços ou faturamento da plataforma, edição genérica de perfis, transferência de contas, redefinição de senhas pela administração, exportações e mudanças nos fluxos de preparo/recebimento/impressão.

## 2. Evidências do estado atual

- `src/domains/platform/ui/CompanyList.jsx` oferece busca por nome, paginação, cadastro e abertura de detalhes; `CompanyDetail.jsx` mostra o primeiro gerente, convite e histórico.
- `worker/platform/businessesApi.js` permite consultar, cadastrar e reenviar o convite inicial. As permissões canônicas são somente `platform.businesses.view`, `platform.businesses.create` e `platform.invitations.resend`.
- A migration aplicada `0038_global_identity_tenancy.sql` restringe `businesses.access_status` a `legacy`, `pending` e `active`. Esse campo representa ativação inicial e compatibilidade, não o ciclo administrativo de suspensão/exclusão.
- `worker/identity/sessions.js`, `worker/tenancy/eligibleBusinesses.js` e `worker/tenancy/companyInvitations.js` verificam ativação e vínculos. As assertions transacionais já protegem mudanças concorrentes de sessão e permissões.
- `worker/tenancy/memberships.js` revoga sessões/convites de um vínculo e protege a última pessoa com `access.users.manage`, mas seu fluxo exige contexto operacional.
- TV usa credenciais próprias em `worker/kitchenTvApi.js` e `worker/kitchenTvRepository.js`. Bloquear apenas sessões humanas deixaria esse caminho incompleto.
- `companyStatus.js` hoje pode apresentar acesso ativado a partir de convite aceito. O histórico do convite não poderá prevalecer sobre uma suspensão ou exclusão.

## 3. Modelo de situação da empresa

Preservar `access_status` e acrescentar `lifecycle_status`, com valores `enabled`, `suspended` e `deleted`, default `enabled`. Assim, a migration não precisa recriar `businesses` nem modificar a migration aplicada. Empresas existentes mantêm seu comportamento; novas empresas começam com `access_status = pending` e `lifecycle_status = enabled`.

Acrescentar `management_revision`, inteiro não negativo com default zero. Ela muda a cada mutation administrativa da empresa, de seus vínculos ou convites. A mesma revisão protege as confirmações contra alterações concorrentes de estado, nome, pessoa ou convite.

Situação apresentada, nesta prioridade:

| Condição | Situação |
| --- | --- |
| `lifecycle_status = deleted` | Excluída |
| `lifecycle_status = suspended` | Suspensa |
| `lifecycle_status = enabled` e `access_status = pending` | Aguardando ativação |
| `lifecycle_status = enabled` e `access_status = active` | Ativa |
| `lifecycle_status = enabled` e `access_status = legacy` | Acesso anterior / preparação pendente |

Convite e vínculo têm estados independentes. A empresa pode estar ativa e a pessoa originalmente convidada ter seu acesso revogado. A interface não transforma a pessoa do cadastro em um proprietário imutável nem procura autorização pelo nome do perfil.

Persistir UTC e mostrar datas em português, com fuso `America/Sao_Paulo` explícito no histórico. Não apresentar envio aceito pelo provedor como confirmação de entrega ao destinatário.

## 4. Ações e efeitos

Todas as novas mutations de gestão exigem motivo de 3 a 500 caracteres Unicode, após trim, e `expectedRevision`. A exclusão exige também `confirmationName`, comparado ao nome atual com trim e normalização NFC, respeitando maiúsculas/minúsculas. Validação do formulário não substitui validação no Worker. O cadastro existente conserva seu contrato; não exigir motivo para criar uma empresa.

### Suspender empresa

Permitida para empresas habilitadas, incluindo cadastros ainda aguardando ativação. Mudar apenas o ciclo administrativo para `suspended`, revogar sessões operacionais humanas da empresa, convites empresariais não consumidos e credenciais/pareamentos aprovados da TV. Preservar contas globais, senhas, perfis, grants, vínculos e todos os dados.

Bloquear novas leituras/escritas operacionais, seleção da empresa, logos privados, criação/aceitação/reenvio de convites e autorização de TV nessa empresa. Uma pessoa com vínculos em outras empresas continua podendo usá-los; não revogar suas famílias globais ou sessões de outros contextos.

### Retomar acesso ou ativação

Permitida somente para empresa suspensa. Mudar `lifecycle_status` para `enabled`, preservando `access_status`.

Para `access_status = active`, exigir pelo menos uma pessoa elegível com `access.users.manage`, considerando conta verificada/ativa, credencial válida, vínculo ativo, perfil ativo e grant persistido. Mostrar a ação como “Reativar acesso”.

Para `access_status = pending`, mostrar “Retomar ativação”: a empresa volta a aguardar o convite e não passa a estar ativa. O convite revogado exige reenvio explícito depois da retomada. Para `legacy`, manter o estado de preparação; esta ação não contorna o fluxo de compatibilidade.

Não ressuscitar sessões, links ou pareamentos anteriores. Vínculos revogados individualmente continuam revogados. TV exige novo pareamento.

### Excluir empresa de forma recuperável

Permitida para empresa habilitada ou suspensa. Mudar o ciclo para `deleted`, aplicar as mesmas revogações da suspensão e retirar o cadastro da consulta padrão. Não executar `DELETE` de empresa, conta, pedidos, financeiro, auditoria, impressões ou objetos R2; não impor prazo de purga.

A confirmação mostra nome, alcance e preservação dos dados, exige o motivo e a digitação do nome. A empresa permanece acessível à administração autorizada pelo filtro “Excluídas” e por seu endereço de detalhes.

### Restaurar empresa

Permitida somente para empresa excluída. Voltar a `suspended`, preservando ativação inicial, vínculos e dados. Retomar acesso/ativação exige uma ação separada e suas próprias verificações.

### Revogar ou reativar vínculo

Revogar uma pessoa afeta somente seu vínculo na empresa alvo: desativar vínculo, revogar suas sessões operacionais e convites não consumidos. Para vínculo já aceito, usar `membership_state = inactive`; manter a indicação de convite nunca aceito quando aplicável. Não alterar conta global, senha, role ou vínculos em outras empresas.

Uma empresa habilitada e operacional não pode perder a última pessoa elegível com `access.users.manage`. Conferir a regra dentro da transação para impedir duas revogações concorrentes. A administração pode suspender a empresa e então revogar esse vínculo.

Permitir reativar vínculo anteriormente aceito, sem mudar seu perfil/grants, enquanto a empresa estiver habilitada ou suspensa. Essa ação não reativa uma empresa suspensa e não recupera sessões/convites. Para vínculo nunca aceito e desativado, a mesma operação administrativa recebe o rótulo “Permitir novo convite”: habilita o vínculo, preserva `membership_state = invited` e exige reenvio explícito separado quando a empresa estiver habilitada. Nunca transformar esse vínculo em `active` antes da aceitação. Empresas excluídas permitem somente consulta e restauração; bloquear mudanças de vínculos e convites até restaurá-las.

### Cancelar e reenviar convite

Cancelar exige que o convite pertença à empresa informada e não esteja consumido ou já revogado. Revogar seu token e preservar cadastro/vínculo. Permitir cancelamento de convite expirado ainda não consumido. Replay da mesma operação não cria um novo evento.

Reusar o reenvio existente para vínculos convidados ativos e empresas habilitadas, com verificação de revisão e permissões. Cada envio invalida os links anteriores; respeitar cooldown e limites do provedor. Não enviar e-mail ao suspender, excluir, restaurar ou revogar vínculo.

## 5. Interface aprovada

Manter a identidade Mesiva, temas existentes, peso de títulos/valores e tokens de badges. Reusar `Button`, `Modal`, `ConfirmationDialog`, `SystemSelect`, `StatusBadge` e o shell atual conforme seus contratos, sem mudanças genéricas desnecessárias nesses componentes.

### Lista de empresas

- Título “Empresas”, descrição curta e “Nova empresa” junto ao título, condicionado à permissão existente.
- Busca por nome da empresa ou e-mail de pessoa vinculada, com submit por botão/Enter. A busca não gera uma requisição por tecla e não duplica empresas que tenham vários vínculos correspondentes.
- Filtro “Todas, exceto excluídas” como padrão, além de “Ativas”, “Aguardando ativação”, “Suspensas”, “Excluídas” e “Todas, incluindo excluídas”. Incluir empresas `legacy` no padrão/todas, preservando seu badge de compatibilidade.
- Colunas “Empresa”, “Gerente do cadastro”, “Situação” e “Ações”; “Gerenciar” abre a página dedicada. E-mail, cadastro e estado do convite entram como informação secundária, sem competir com a situação da empresa.
- Paginação por cursor, com busca e filtro associados ao cursor. Não usar uma contagem da página como total de todas as empresas.
- No celular, usar linhas/cartões reorganizados e ações visíveis, sem depender de hover ou rolagem horizontal para ações essenciais.

### Página de gestão

Cabeçalho com retorno à lista, nome e situação. Abas “Visão geral”, “Pessoas e convites” e “Histórico”, acessíveis por teclado. Manter o endereço canônico da empresa; alternar aba não concede outro contexto.

“Visão geral” reúne dados de cadastro e controle de acesso. Separar “Excluir empresa” em ações administrativas, com texto de impacto. Empresas excluídas mostram “Restaurar empresa”. Ações disponíveis dependem do ciclo e das capabilities, com explicação quando a última pessoa administradora impede revogação.

“Pessoas e convites” apresenta todos os vínculos associados a contas, com nome, e-mail, perfil, estado do vínculo e convite atual. Oferecer revogar, reativar, cancelar e reenviar conforme elegibilidade. Não permitir edição de perfil ou e-mail nesta entrega. Mostrar a pessoa do primeiro cadastro como referência histórica, não como a única pessoa administrável.

“Histórico” apresenta eventos administrativos recentes com ação, responsável, data, motivo e recurso afetado. Usar ordem decrescente e paginação para eventos mais antigos. Eventos antigos sem motivo/responsável exibível continuam visíveis sem inventar informação. Exibir resultado de envio em linguagem humana, sem identificadores confidenciais.

### Confirmação e feedback

Confirmações usam modal real, com foco preso, retorno ao botão de origem e fechamento por Escape antes de enviar. Exibir alcance e efeitos, motivo obrigatório e nome na exclusão. Enquanto a mutation estiver em curso, bloquear fechamento, repetição e troca de contexto conforme os owners atuais.

Após sucesso, recarregar situação e revisão oficiais, anunciar feedback acessível e atualizar lista/abas afetadas. Em conflito, mostrar que o cadastro mudou e exigir revisão de dados e nova confirmação. Em timeout ou perda de resposta, consultar o resultado antes de repetir; não mostrar sucesso presumido nem repetir uma mutation automaticamente. Em erro ou perda de permissão, manter controles coerentes com o contexto oficial.

## 6. Permissões, contratos e transações

Preservar as três capabilities existentes e acrescentar:

| Capability | Alcance |
| --- | --- |
| `platform.businesses.manage` | Suspender, retomar acesso/ativação e restaurar |
| `platform.businesses.delete` | Exclusão recuperável |
| `platform.memberships.view` | Consultar pessoas e convites |
| `platform.memberships.manage` | Revogar/reativar vínculos |
| `platform.invitations.cancel` | Cancelar convites |

Cada ação exige também `platform.businesses.view`. Não inferir grants pelo nome “Administrador Mesiva”. A migration precisa ampliar a restrição de `platform_grants` preservando registros. Conceder as novas capabilities somente às contas administrativas identificadas por `platform_bootstraps`; não ampliar automaticamente permissões de toda conta com view/create. O provisionamento futuro do administrador usa a lista canônica atualizada; assertions de bootstrap e scripts administrativos devem permanecer compatíveis.

Contratos sob `/api/platform/businesses/:businessId`:

| Método e sufixo | Operação |
| --- | --- |
| `POST /suspend` | Suspender |
| `POST /resume` | Retomar ciclo habilitado |
| `POST /delete` | Excluir de forma recuperável |
| `POST /restore` | Restaurar como suspensa |
| `GET /memberships` | Consultar pessoas/convites |
| `POST /memberships/:userId/revoke` | Revogar vínculo |
| `POST /memberships/:userId/reactivate` | Reativar vínculo aceito ou permitir novo convite sem ativar acesso |
| `POST /invitations/:invitationId/cancel` | Cancelar convite |
| `POST /invitations/:invitationId/resend` | Reenviar convite elegível |
| `GET /history` | Histórico com cursor |
| `GET /management-attempts/:key` | Consultar o resultado de uma tentativa do próprio emissor, sem repetir mutation |

Preservar as rotas e respostas existentes, inclusive o reenvio inicial `/first-manager-invitation/resend`, delegando-o às mesmas regras de elegibilidade e bloqueio de ciclo. Seu contrato anterior sem body continua aceito, com assertions do estado atual; a nova interface usa o endpoint genérico com revisão, motivo e receipt. Novas respostas de lista/detalhe acrescentam `lifecycleStatus` e `managementRevision`. O filtro usa parâmetro `status`; busca mantém `query`. Consultas respondem com `cache-control: no-store` e revalidam o grant após carregar os dados. Atualizar `routePolicy.js` para classificar todos os novos endpoints explicitamente como `platform`.

Novas mutations recebem `Idempotency-Key` UUID, motivo, revisão e nome quando aplicável. Uma receipt administrativa preserva conta emissora, empresa, operação, chave, hash do payload e resultado de revisão. Repetir a mesma chave/payload retorna o resultado sem novo evento; reutilizar a chave com payload diferente retorna conflito. Conferir permissão atual mesmo no replay. O resultado replayed não substitui a consulta atual da empresa. No reenvio, persistir token, receipt e revisão na mesma transação antes de entregar ao provedor: replay não prepara token nem dispara outro e-mail. Preservar o resultado de entrega incerto sem repetição automática.

Precisão do contrato no planejamento: a consulta `/management-attempts/:key` implementa a reconciliação por leitura já prevista. Exigir view e a capability correspondente à ação, verificar conta emissora e empresa e retornar 404 para receipt ausente ou de outro alvo. Ausência de receipt não prova falha de uma chamada em andamento; uma repetição só pode ocorrer por ação explícita, usando a mesma chave e payload. Essa precisão será revisada junto ao plano antes de implementar.

O estado, a revisão, revogações, receipt e evento são persistidos no mesmo batch D1 com assertions. Dentro da transação, revalidar sessão, grants persistidos, revisão, estado e regra da última pessoa administradora. Toda consulta/mutation de membro ou convite inclui o `business_id` alvo; IDs de outra empresa retornam 404, sem revelar dados.

Reusar os padrões de `prepareSessionSnapshotAssertion` e `commitIdentityStatements`. Os helpers compartilhados das regras de vínculo não devem fabricar um contexto operacional para a administração: receber alvo e autorização explícitos de seu owner, mantendo o fluxo operacional atual protegido.

Auditoria amplia `platform_audit_events` com motivo, tipo/ID do recurso e detalhes JSON de antes/depois sem secrets, tokens, payloads pessoais desnecessários ou erro bruto de provedor. Manter referências, eventos anteriores e identidade da conta emissora. Incluir eventos de suspensão, retomada, exclusão, restauração, mudança de vínculo e cancelamento. Uma ação efetivada gera exatamente um evento, inclusive após replay.

## 7. Bloqueio operacional e concorrência

Elegibilidade operacional exige `access_status = active` e `lifecycle_status = enabled`. Aplicar essa regra à autenticação, criação/troca de contexto, lista de empresas elegíveis, acesso a logos privados, assertions que autorizam mutations e emissão/consumo de convites.

Suspensão/exclusão revoga somente credenciais associadas à empresa. A autenticação e o pareamento da TV também verificam o ciclo dentro de suas operações, incluindo ativação de solicitação já aprovada. Uma aprovação ou convite preparado antes do bloqueio não pode ser efetivado depois dele.

Para escritas iniciadas antes do bloqueio, a decisão é transacional: se a escrita efetivar primeiro, ela pertence ao histórico preservado; se a suspensão efetivar primeiro, a assertion impede a escrita. Manter a revalidação de contexto/resposta e os bloqueios do frontend. Após rejeição da sessão ou do acesso ao destino, limpar o conteúdo operacional apresentado e permitir login/seleção de outro contexto pelo fluxo existente.

A suspensão não promete recolher dados já recebidos por um dispositivo desconectado, desfazer efeitos externos concluídos nem parar papel já entregue ao QZ/spooler. Bloquear novas ações de impressão no servidor, preservar filas/histórico e os resultados desconhecidos; não reenviar automaticamente após reativação. Pedidos e pagamentos não são cancelados pela mudança administrativa.

## 8. Organização da implementação

Manter composição de UI em `src/domains/platform`, clientes no adaptador `platformApi.js` e uso externo pelo `index.js` do domínio. Separar regras puras de apresentação/estado em módulos pequenos; regras comuns entre frontend/Worker pertencem a `shared/`.

No Worker, manter autorização e coordenação administrativas em `worker/platform`; extrair apenas helpers de vínculo/convite efetivamente compartilhados em `worker/tenancy`. Não criar owners legados nem enfraquecer o checker de arquitetura.

Criar migrations novas para o ciclo/revisão, grants e auditoria/receipts, sem editar migrations aplicadas. Testar instalação limpa e upgrade com empresas ativas, pendentes, legadas, vários vínculos, convites e histórico. Dados de negócio e objetos R2 permanecem intactos.

Atualizar o runbook de produção multiempresa na entrega que implementar as ações, explicando alcance, última pessoa administradora e restauração. README só muda onde as funcionalidades correntes mudarem. O desenho de domínios terá seu próprio plano e gates; não alterar o endereço oficial antecipadamente.

## 9. Critérios de aceite e verificação

1. Lista e detalhes seguem a primeira alternativa aprovada, em desktop/celular e ambos os temas, com teclado, foco, scroll e estados vazios/loading/erro.
2. A administração autorizada suspende e retoma empresas sem alterar ativação inicial, vínculos ou dados de outras empresas.
3. Sessão humana, convites e TV não permitem novo acesso à empresa suspensa/excluída; a restauração não recupera credenciais anteriores.
4. Exclusão retira a empresa do padrão, permite encontrá-la no filtro e preserva pedidos, clientes, catálogo, financeiro, histórico de impressão e R2. Restaurar sempre resulta em suspensão.
5. Revogação individual preserva conta global e outras empresas. A última pessoa administradora de uma operação habilitada fica protegida, inclusive sob concorrência.
6. Empresa suspensa pode recuperar um vínculo aceito para então reativar. Empresa pendente retomada continua pendente e exige convite novo explícito.
7. Grants ausentes/revogados, contextos operacional/identity, origens inválidas e IDs de outra empresa não autorizam mutations administrativas.
8. Revisão desatualizada e ação incompatível não produzem mudanças parciais. Replays preservam resultado/auditoria e chave reutilizada com outro payload é rejeitada.
9. Uma suspensão concorrente à emissão/aceitação de convite, escrita operacional ou pareamento aprovado não permite reabrir o acesso.
10. Convite aceito historicamente nunca mascara suspensão/exclusão. Histórico identifica ação, responsável, data e motivo sem secrets.

Durante desenvolvimento, rodar `node --test` nos testes pertinentes de plataforma, identity/tenancy, TV, UI e contratos. Antes de entregar código, executar `npm run test:architecture`, `npm run lint`, `npm run build`, dry-runs Worker de produção/staging com a versão fixada nos scripts de release e os gates D1 pertinentes. A suíte completa `npm test` deve estar verde para integrar/publicar, conforme os oito shards do CI.

Homologar em staging com dados fictícios os caminhos de suspensão, convites, revogação, exclusão/restauração e outra empresa ainda acessível. Não diagnosticar a funcionalidade em produção. Staging, merge e produção seguem o [runbook de release](../../release-and-migration-runbook.md); branch/implementação não autorizam publicação em produção.

## 10. Referências

- [Operação multiempresa corrente](../../operations/multi-company-production.md).
- [Instalação e ambiente local](../../../README.md).
- [Guia de trabalho](../../../AGENTS.md).
- [Impressão Windows/QZ](../../operations/windows-qz-tray-printing.md).
- A especificação histórica `2026-10-02-multi-company-onboarding-design.md` continua documentando o onboarding. Este desenho a estende somente na gestão administrativa; não substitui login, isolamento, recuperação ou o primeiro acesso.
