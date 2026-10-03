# Gestão Delivery — Usuários, perfis e autorização — Design da issue #44

**Issue:** [#44 — Projetar usuários, perfis e autorização granular](https://github.com/vzaponi-dotcom/sistema-para-delivery/issues/44)

**Data:** 2026-09-30

**Base inspecionada:** `feature/issue-34-reporting-center` em `4c9dc297fdc8f9fcd005aafb67abc823503a55f9`

**Estado:** Spec e plano aprovados; implementação autorizada em 2026-09-30.
**Natureza:** esta Spec define comportamento e contratos. A aprovação do desenho autorizou escrever este documento; implementação, migração remota, merge e deploy exigem suas etapas próprias.

## 1. Resultado pretendido

Substituir o PIN compartilhado por contas individuais para gerente e operador. Cada pessoa deve entrar com sua própria senha, usar somente as funções e os dados concedidos, e aparecer como responsável pelas ações que executou. O mesmo negócio poderá ter vários gerentes e operadores, em dispositivos próprios ou compartilhados.

Na primeira entrega, os perfis **gerente** e **operador** têm permissões fixas. A modelagem deve permitir uma frente futura em que o gerente edite esses perfis e crie outros, sem substituir verificações semânticas por comparações de cargo espalhadas no produto.

O sucesso exige autorização no Worker para consultas, mutações e projeções de dados. Esconder controles na interface é apenas apresentação. A troca de usuário não pode atribuir ações de uma pessoa à seguinte, repetir pagamentos ou reimprimir resultados incertos.

## 2. Estado atual e limites

- `worker/auth.js` cria sessões com `business_id`, sem `user_id`. `worker/index.js` valida um único PIN de `auth_credentials` e usa o `BUSINESS_ID` fixo da operação atual.
- `worker/settingsAccess.js` concede todas as capabilities conhecidas quando não recebe um resolvedor confiável; esse fallback legado não é uma política para contas individuais. Alguns endpoints de configurações e relatórios já chamam `requireCapability`, enquanto diversos endpoints operacionais e de impressão exigem somente sessão.
- `shared/settingsAccess.js` é o catálogo inicial de capabilities. `src/app/navigation/registry.js` e os handlers do frontend já consomem capacidades semânticas, mas essa proteção não torna a API segura por perfil.
- `/api/bootstrap` hoje envia `movements` e `financeSettings` a qualquer sessão autenticada; o operador não deve recebê-los. `GET /api/orders` retorna dados por pedido, inclusive valores e pagamento, que são necessários ao atendimento aprovado.
- A impressão usa em vários caminhos `actorLabel` fornecido pelo navegador. Esse texto não comprova a identidade de quem agiu. A Kitchen TV já tem credencial própria e não será tratada como usuário humano.
- A experiência segue atendendo um único negócio por enquanto. `business_id` permanece derivado de contexto confiável no Worker, nunca de um campo livre enviado pelo cliente. Multiempresa, convites entre negócios e seletor de negócio não entram nesta entrega.
- A Spec C e a navegação com React Router já separam sessão/runtime, domínios e destinos. O plano de implementação deve usar a base integrada mais recente; esta Spec foi escrita sobre a branch da issue #34, ainda não integrada a `master` na data acima.

## 3. Decisões de produto aprovadas

| Tema | Contrato da primeira entrega |
|---|---|
| Perfis | Gerente e operador fixos; vários gerentes permitidos. Nunca deixar o negócio sem gerente ativo com acesso à gestão de contas. |
| Futuro editor | A estrutura de perfis e grants suporta editar perfis existentes e criar outros depois. O editor não é exposto nesta entrega. |
| Credencial humana | Identificador individual e senha para ambos. PIN curto isolado foi descartado; troca rápida por PIN vinculado ao dispositivo fica para outra frente. |
| Alcance do operador | Consulta todos os pedidos, histórico operacional e comandas do negócio, incluindo valores e situação necessários para atender e receber. Não consulta movimentações, saldo, relatórios nem indicadores gerenciais. |
| Ações sensíveis | Cancelar, estornar e transferir comanda são exclusivos do gerente. Operador pode aplicar desconto ou acréscimo durante a criação/edição permitida de pedidos. |
| Clientes | Operador pode consultar, criar e corrigir dados; exclusão é exclusiva do gerente. |
| Impressão | Operador executa, reimprime e resolve tentativas rotineiras. Descarte de jobs, execução forçada, prioridade excepcional e configuração de estação/política são gerenciais. |
| Recuperação | Gerente inicia redefinição de outro usuário por convite de uso único. Recuperação do último gerente usa procedimento administrativo controlado, sem restaurar o PIN compartilhado. |
| Auditoria | Responsável visível nos registros e tela de atividades exclusiva do gerente, com filtros por pessoa, período e tipo. |
| Dispositivos | Sessões individuais podem coexistir em dispositivos diferentes. Trocar usuário encerra a sessão daquele navegador. Impressão automática mantém a dependência atual de sessão humana; não haverá identidade de estação para operar sem login. |
| Sessão | Em dispositivo compartilhado, limite absoluto inicial de 12 horas; em dispositivo pessoal, limite absoluto inicial de sete dias. Trocar usuário e Sair sempre encerram a sessão atual. |
| Migração | Um único corte desativa o PIN compartilhado e revoga sessões legadas; todos entram novamente com credenciais individuais. Eventos antigos permanecem identificados como acesso legado. |

## 4. Modelo de identidade e dados

### 4.1 Entidades

- `users`: ID estável, `business_id`, nome de exibição, identificador de login normalizado e único dentro do negócio, perfil atribuído, estado ativo/desativado, timestamps. Não excluir fisicamente usuários que tenham histórico; desativar preserva a referência.
- `user_credentials`: um verificador de senha por usuário, salt individual, algoritmo e custo versionados, data de troca e estado de ativação. Senha em claro e token de sessão em claro nunca são persistidos.
- `roles`: ID estável, `business_id`, código interno, nome, estado, versão e marca de perfil inicial. `role_capabilities` liga o perfil a chaves de um catálogo semântico conhecido. `users.role_id` basta nesta versão: cada usuário recebe exatamente um perfil.
- `sessions`: evolui a sessão existente com `user_id`, modo compartilhado/pessoal, emissão, expiração absoluta, último uso e revogação. O token continua opaco em cookie seguro; somente hash é guardado. Sessão sem `user_id` é legada e nunca recebe capabilities de perfil após o corte.
- `access_invites`: token aleatório de alta entropia guardado por hash, negócio, usuário, propósito (ativação ou redefinição), validade, consumo e emissor. Vale 24 horas, tem uso único e reemissão invalida o convite anterior. O gerente copia o convite e o entrega fora do aplicativo; não há envio automático. A aceitação usa endpoint público estreito que valida token, expiração e usuário antes de definir a senha; não concede sessão automaticamente. Consumo e definição da credencial são uma única operação.
- `business_auth_state`: estado `legacy`, `enrollment` ou `user_only` e data do corte. A transição para `user_only` desabilita o login compartilhado e revoga todas as sessões sem usuário na mesma operação de mudança de estado.
- `audit_events`: ID, `business_id`, horário, tipo de ator (`user`, `system` ou `legacy`), `actor_user_id` quando houver, nome apresentado no momento do evento, sessão correlacionável sem token bruto, ação, tipo/ID do recurso, resultado e metadados mínimos não secretos. Eventos são acrescentados; não há edição ou exclusão pela interface. Não há expurgo automático nesta V1.

As chaves estrangeiras e consultas incluem `business_id` onde necessário para impedir vínculo entre negócios. O perfil gerente inicial não é um wildcard: recebe um conjunto explícito de capabilities conhecidas. Grants desconhecidos não conferem acesso. A futura edição dos perfis deve preservar a invariante de ao menos um usuário ativo capaz de administrar o acesso; a V1 já impõe essa invariante ao desativar ou reatribuir gerentes, inclusive sob concorrência.

### 4.2 Fronteiras de responsabilidade

`worker/auth` valida credencial, emite e revoga sessões. Um serviço de acesso no Worker carrega usuário ativo, perfil, grants e contexto de negócio para cada requisição; o catálogo de capabilities é compartilhado com o frontend, mas a decisão oficial é do Worker. Os módulos de domínio recebem contexto de ator e capacidades necessárias, sem conhecer formulários de login ou nomes de cargo. Projeções de leitura pertencem aos seus domínios. Auditoria é um contrato comum de escrita, não um depósito de payloads completos.

O frontend mantém a sessão em `app/runtime/session`, recebe `{ user: { id, displayName, roleName }, capabilities, businessId, settingsContextId }` em `/api/auth/session` e limpa dados oficiais ao trocar, revogar ou expirar sessão. Nenhum controle usa `roleName === 'Gerente'` para decidir acesso; usa capability. O nome do perfil serve à apresentação.

## 5. Credenciais, sessões e recuperação

O login recebe identificador e senha. A primeira versão exige senha de pelo menos 15 caracteres, aceita pelo menos 64, permite colar e usar gerenciadores de senha, rejeita valores presentes em lista local versionada de senhas comuns/comprometidas e não impõe regras artificiais de composição. A verificação reutiliza PBKDF2-SHA256 com 100.000 iterações e salt aleatório individual de 16 bytes, em formato versionado, compatível com o limite atual do Worker; o plano mede a latência dessa verificação sob carga de login. Senhas e convites não aparecem em respostas posteriores, logs ou auditoria. Essa escolha segue a orientação atual do [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html) para senha como fator único.

O Worker aplica limitação de tentativas por conta e origem, com erro público que não revela se o identificador existe. O limitador global atual de cinco tentativas por minuto para todo o negócio não pode continuar como única defesa, pois bloquearia toda a equipe por falhas de uma pessoa. Sucesso, falha, bloqueio e redefinição entram em registro de segurança com dados mínimos.

O login emite um novo token de sessão. O modo **compartilhado** é o padrão no formulário, com expiração absoluta em 12 horas; o modo **pessoal** exige escolha explícita e expira em sete dias. Essa escolha ajusta duração, não confere capabilities nem prova a posse física do dispositivo. Expiração e revogação são verificadas no servidor. Mais de uma sessão por usuário é permitida.

Desativar usuário, mudar perfil ou iniciar redefinição revoga todas as sessões dele. Troca voluntária encerra somente a sessão do navegador atual. Uma troca de senha feita pelo próprio usuário renova sua sessão e revoga as demais. O Worker revalida conta ativa e grants antes de responder a cada requisição; nenhuma sessão antiga conserva privilégios após mudança. Requisições já aceitas são reconciliadas pelos fluxos existentes, não reenviadas.

Gerentes criam usuários por convite de uso único; o destinatário define a própria senha. Um gerente pode redefinir outro gerente ou operador, sem conhecer a senha anterior. Qualquer usuário autenticado pode mudar a própria senha após informar a atual. Não há recuperação por email nesta entrega. Para o último gerente inacessível, uma pessoa com acesso administrativo à infraestrutura verifica a titularidade fora do aplicativo e usa um comando operacional auditado para emitir novo convite de uso único; o comando não altera diretamente a senha no banco nem reativa o PIN legado.

## 6. Matriz de capacidades da V1

O perfil gerente recebe as capacidades administrativas e operacionais explícitas do catálogo. O perfil operador recebe inicialmente:

`orders.view`, `orders.history`, `orders.create`, `orders.finalize`, `orders.discount`, `comandas.view`, `payments.receive`, `clients.view`, `clients.create`, `clients.update`, `products.view`, `tables.view`, `printing.queue`, `printing.execute`, `printing.station.view` e `preferences.local`.

`clients.manage` deixa de ser uma concessão única e é substituída por `clients.create`, `clients.update` e `clients.delete`; os consumidores de interface e as rotas devem migrar juntos. `printing.execute` cobre impressão e recuperação rotineiras. Introduzir `printing.force` para forçar job e prioridade excepcional; `printing.discard` continua separado. Introduzir `access.users.view`, `access.users.manage` e `access.audit.view` para equipe e atividades. `orders.backdate` fica com gerente para criação retroativa; `orders.discount` permanece distinto de `orders.create`.

O operador **não** recebe `orders.analysis`, `orders.cancel`, `orders.backdate`, `payments.refund`, `comandas.transfer`, `clients.delete`, `products.manage`, `tables.manage`, `finance.overview`, `finance.receivables`, `finance.movements`, `finance.movements.manage`, `finance.promises.manage`, `reports.view`, `reports.export`, capabilities de gestão de configurações, `printing.force`, `printing.discard`, `printing.station.configure` ou capabilities de gestão de acesso. A ausência de grant é negação. Consultar um pedido com valor e pagamento não concede consulta à carteira financeira ou seus agregados.

Condições compostas são avaliadas no Worker: criar pedido exige `orders.create`; se a requisição inclui recebimento, também `payments.receive`; se inclui ajuste de preço/desconto, também `orders.discount`; se é retroativa, também `orders.backdate`. A tela pode esconder esses campos, mas payload direto não contorna a regra. `payments.receive` não implica estorno, cancelamento ou acesso a movimentos.

## 7. Contrato de API e dados por perfil

Cada rota e método existente deve constar de uma tabela verificável no plano de implementação. O mapa abaixo é o contrato da Spec; uma rota autenticada sem regra explícita não recebe acesso por fallback. A verificação acontece antes de ler, assinar, alterar ou retornar dados sensíveis. IDs de recurso são sempre limitados ao `business_id` da sessão. Verificação de mesma origem continua obrigatória para mutações humanas e administrativas, inclusive aceitação de convite.

| Superfície/rotas atuais | Capacidade e resposta |
|---|---|
| `/api/auth/login`, `/logout`, `/session` | Login individual; status inclui usuário e grants atuais. Logout revoga somente a sessão atual. Nova API `/api/access/users` e ações de ativação, redefinição, desativação e troca de perfil exigem `access.users.view/manage`; `/api/access/activity` exige `access.audit.view`. |
| `GET /api/bootstrap` | Projeção por capability. Operador recebe negócio, clientes, produtos, pedidos/comandas, mesas e configuração operacional necessária; nunca `movements`, `financeSettings`, saldos, agregados ou recibos administrativos. `orders.view` dá pedidos ativos; `orders.history` dá os encerrados; `comandas.view` dá comandas. Gerente recebe a projeção ampla atual. Cache e `effectiveConfigVersion` são segregados por usuário/grants. |
| `GET /api/orders`, detalhe de comanda e documentos operacionais | `orders.view` dá pedidos ativos, `orders.history` dá encerrados; `comandas.view` cobre detalhes de comanda e `printing.execute` cobre documentos de impressão. Operador tem todos esses grants na V1 e vê valores e situação de pagamento; nenhuma dessas leituras vira rota indireta para movimentos gerenciais. |
| `POST /api/orders`, `PATCH /api/orders/:id/status`, `POST /api/orders/:id/payment`, `POST /api/table-tabs/:id/payment` | Respectivamente `orders.create` com verificações compostas, `orders.finalize` e `payments.receive`. Mutações guardam ator do servidor. |
| `POST /api/orders/:id/cancel`, `/refund`; `PATCH /api/orders/:id/payment-promise`; `POST /api/tables/:id/transfer` | `orders.cancel`, `payments.refund`, `finance.promises.manage` e `comandas.transfer`; gerente na V1. |
| `POST /api/clients`, `PATCH/DELETE /api/clients/:id` | `clients.create`, `clients.update`, `clients.delete` separadamente. Cliente pode ser criado no fluxo de novo pedido pelo operador. |
| `POST /api/tables`, `PUT /api/tables/order`, `PATCH /api/tables/:id`; mutações de produtos | `tables.manage` e `products.manage`; gerente. Leitura operacional de mesas/produtos continua disponível ao operador nas projeções adequadas. |
| `POST/PATCH/DELETE /api/movements`, `PUT /api/finance-settings`, `/api/reporting/*` | Capabilities gerenciais de movimentos, configurações, relatórios e exportação. Nenhum dado dessas superfícies entra no bootstrap do operador. |
| `/api/settings/*`, `/api/business/logo`, `/api/printing/settings`, configuração de estações | Preservar capabilities específicas de leitura/gestão. Logo da operação segue legível por usuário autenticado; recibos administrativos exigem o grant da mutação. Operador pode consultar o estado operacional da estação quando necessário aos fluxos de impressão, mas essa leitura não expõe a rota nem o card de **Configurações → Impressão**; política e configuração permanecem administrativas. |
| `/api/printing/jobs*`, `/api/orders/:id/print-*`, `/api/table-tabs/:id/print-*`, QZ certificate/sign, tentativas e recovery | Listagem requer `printing.queue` ou acesso ao documento do pedido. Criação, claim, envio, confirmação, retry, reprint e resolução rotineira requerem `printing.execute` e elegibilidade existente da estação/job. Descarte, inclusive em lote, requer `printing.discard`; force-print e prioridade excepcional exigem `printing.force`. QZ signing não fica acessível apenas por possuir sessão. |
| `/api/kitchen-tv/settings`, `/approve`, `/revoke`; pareamento e `/state` | Administração exige `orders.settings.view/manage`. A sessão pública de TV continua restrita ao protocolo próprio e jamais autentica a API humana. |

Os endpoints de pagamento e escrita que retornam efeitos relacionados devem projetar cada parte da resposta conforme o receptor; por exemplo, o operador pode receber confirmação e situação do pagamento do pedido, sem receber a lista geral de `movements`. `/api/bootstrap` e leituras de pedidos não podem serializar primeiro a versão ampla e confiar que o frontend descarte campos. Projeções devem ser testadas pelo JSON bruto, inclusive após refresh, deep link, troca de usuário e mudança de perfil.

## 8. Auditoria e histórico

Registrar no servidor, para sucessos relevantes: criação/finalização/cancelamento de pedidos, ajuste de preço, recebimento/estorno, transferência de comanda, cadastro sensível, movimento financeiro, mudança de política, criação/desativação/redefinição de usuário, mudança de perfil e ações manuais de impressão/recovery. Falhas de login, bloqueios, revogações e recusas de acesso entram em registro de segurança sem segredo. Leituras comuns não geram evento de negócio.

O evento usa `actor_user_id` da sessão, nunca `actorLabel`, `userId` ou nome enviado pelo cliente. Pode guardar nome de exibição como snapshot para leitura depois de renomear/desativar o usuário. O evento aponta para recurso e ação; não copia endereço, telefone, senha, token, recibo completo ou conteúdo de pedido. Onde mutação e auditoria são ambas oficiais, devem confirmar ou falhar juntas no D1; chamadas com efeito físico registram intenção/resultado observado sem declarar impressão física confirmada quando ela é incerta. O [batch transacional do D1](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) pode sustentar essa atomicidade.

Histórico anterior ao corte é rotulado **Acesso legado** ou **Autor não identificado**, conforme evidência; não é atribuído ao primeiro gerente. Impressão automática é `system` com contexto da estação registrada, não uma afirmação de ação humana nem prova criptográfica de dispositivo. Impressões manuais têm o usuário da sessão. O gerente consulta a tela de atividades paginada, filtrada por usuário, período e tipo, e vê responsáveis nos detalhes de pedido, pagamento e impressão. O operador vê apenas as atribuições presentes nos registros operacionais que já pode consultar; não abre a tela gerencial de atividades.

## 9. Experiência de uso

### 9.1 Entrada e troca

O login pede identificador e senha, informa erro sem confirmar se a conta existe e oferece seleção explícita **Dispositivo pessoal**; o padrão é compartilhado. Após autenticar, o shell mostra o nome da pessoa e as ações **Minha conta**, **Trocar usuário** e **Sair**. `/minha-conta` permite mudar a própria senha mediante senha atual, sem acesso à gestão de outras contas. Antes de trocar, aplicam-se os guardas existentes de rascunho, pagamento aceito e impressão incerta. A troca revoga a sessão atual, invalida respostas assíncronas antigas, limpa dados oficiais e filtros sensíveis, e volta ao login. Nenhum rascunho de um funcionário aparece ao próximo.

Sessão expirada ou revogada gera feedback claro e volta ao login. Um `403` por ação ou rota direta mantém estado seguro sem mostrar conteúdo proibido durante um frame. Alteração de perfil revoga sessões afetadas; a pessoa reentra e recebe a nova home permitida. Dispositivo compartilhado exige novo login até 12 horas após a entrada; não há impressão automática quando ninguém está autenticado, como já ocorre hoje. Na troca voluntária, jobs em andamento são confirmados ou marcados como incertos antes da limpeza; na expiração inesperada, o servidor preserva o estado e a próxima sessão reconcilia. Resultado incerto nunca dispara repetição automática.

### 9.2 Equipe e acessos

Em Configurações, `/configuracoes/equipe` apresenta **Equipe e acessos** somente a quem tem `access.users.view`. O gerente vê usuários, perfil, estado e último acesso; cadastra, desativa, reativa quando cabível, troca perfil e inicia redefinição. A criação exige nome, identificador único e perfil. A lista de capacidades de gerente e operador é somente leitura nesta V1. O convite é mostrado uma vez para cópia; depois a interface exibe apenas validade e estado, sem revelar novamente o token. Não há exclusão de usuário, edição de grants, perfil personalizado ou impersonação.

Ações que retirariam o último gerente ativo são recusadas no Worker, mesmo com duas abas ou duas pessoas agindo ao mesmo tempo. O gerente não pode contornar isso reatribuindo a própria conta. Estados de carregamento, vazio, convite expirado, conflito, `403`, conta desativada e falha de rede têm mensagens recuperáveis. Desktop, mobile, temas claro/escuro e navegação por teclado seguem os componentes existentes.

### 9.3 Atividades

`/configuracoes/atividades` apresenta **Atividades** e exige `access.audit.view`; mostra tempo, ação, responsável e recurso, com filtros por pessoa, período e tipo, paginação no servidor e acesso ao detalhe permitido. Não expõe segredos, payloads completos ou identificadores de sessão. Eventos `legacy` e `system` têm rótulos próprios e não são apresentados como funcionários.

## 10. Migração e implantação

1. Aplicar migration aditiva de usuários, perfis, grants, convites, auditoria, estado de auth e vínculo opcional de sessão. Preservar PIN, sessões e dados legados enquanto o negócio está em `legacy`.
2. Entrar em `enrollment`: gerar fora da aplicação um convite inicial de alta entropia, uso único e validade limitada para o primeiro gerente. O PIN compartilhado sozinho não pode reivindicar essa conta. O novo gerente ativa a senha e cadastra contas; durante a preparação, contas novas só usam administração de acesso e legado continua operando sob a política anterior. A janela de preparação deve ser curta e declarada em staging/produção.
3. Preflight de corte verifica ao menos um gerente ativo, credenciais ativadas, perfis íntegros, rotas cobertas pela matriz, projeções restritas e procedimento de recuperação ensaiado. Se falhar, não alterar o modo de autenticação.
4. Corte único `user_only`: desabilitar login por PIN, revogar sessões legadas e ativar acesso operacional das contas individuais como uma transição atômica. Todas as estações e dispositivos fazem novo login. Nada concede todas as capabilities a uma sessão sem usuário depois do corte.
5. Homologar o estado pós-corte em staging com dispositivos próprios/compartilhados, gerente/operador, TV e estação de impressão. Produção requer aprovação separada; o plano deve incluir comunicação do novo login e recuperação administrativa. Rollback de código não reativa automaticamente o PIN; uma falha usa procedimento de recuperação controlado.

A versão histórica de pedidos, pagamentos e impressões permanece íntegra. Não fazer backfill fictício de `actor_user_id`. Se a base de implementação mudar após integração da issue #34, reavaliar este mapa de rotas e dados antes do plano.

## 11. Validação e aceite

O plano seguirá TDD para autenticação, modelo, políticas e APIs. Testes devem provar, pelo menos:

- login e convite de cada conta; senha inválida, conta inativa, convite usado/expirado, limitação de tentativas e ausência de enumeração;
- seleção compartilhado/pessoal, expiração de 12 horas/sete dias, múltiplas sessões, troca, redefinição, mudança de perfil e revogação imediata no Worker;
- concorrência ao desativar/reclassificar os dois últimos gerentes: nunca zero gerentes ativos com `access.users.manage`;
- cada rota/método do Worker com gerente, operador, sem grant, sessão expirada e negócio alheio; payload composto de pedido não atravessa capabilities por campos escondidos;
- JSON bruto de bootstrap, pedidos, pagamentos, impressão, configurações e relatórios sem vazamento gerencial ao operador; rota direta e frontend não mostram conteúdo proibido;
- auditoria usa ator da sessão e é consistente com mutações; `actorLabel` falsificado não altera autoria; legado e eventos automáticos não fingem usuário;
- pagamento, impressão e transferência preservam idempotência, reconciliação e identidade do recurso sob troca de usuário;
- pareamento/consulta da Kitchen TV continuam isolados da sessão humana; operador não administra TV;
- login, gestão de contas, histórico de atividades, desktop/mobile, teclado e temas em staging; corte e recuperação ensaiados antes de produção.

O aceite exige matriz endpoint por endpoint revisada sem fallback amplo, testes automatizados pertinentes, homologação manual em staging e evidência do corte. Nenhuma implementação parcial com menu oculto e API aberta atende a esta Spec.

## 12. Fora de escopo

- Editor de perfis/grants e perfis personalizados na interface; a estrutura persistida os prepara para uma frente posterior.
- PIN curto para login, troca rápida local por PIN, passkeys, MFA e recuperação por email.
- Identidade autônoma da estação de impressão, impressão sem login humano e mudança do protocolo da Kitchen TV.
- Seletor de negócio, convites entre empresas e qualquer alteração de regra de venda ou cálculo financeiro que não seja necessária à autorização/projeção.
- Atribuir autoria humana a eventos gerados antes do corte.

## 13. Referências de projeto

- Issue #44 e `docs/superpowers/specs/2026-09-15-frontend-modularization-design.md`, §25.2.
- `docs/superpowers/specs/2026-09-11-information-architecture-navigation-design.md`, §10: capabilities semânticas, operador e ausência de segurança real pré-perfis.
- `docs/superpowers/specs/2026-09-01-central-persistence-auth-design.md`: PIN e sessão compartilhados originais.
- `worker/auth.js`, `worker/index.js`, `worker/settingsAccess.js`, `worker/orderPrintingApi.js`, `worker/repositories.js`, `shared/settingsAccess.js`, `src/app/runtime/session/useSessionRuntime.js`.
- [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html), [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) e [Cloudflare D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch), consultados em 2026-09-30 para requisitos de credenciais, sessões e atomicidade.
