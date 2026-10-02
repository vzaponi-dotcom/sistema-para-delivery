# Verificação multiempresa — 2026-10-02

Branch: `feature/issue-87-multi-company-onboarding`. Base: `003a898bac19958089eabab6aedf876adb231763`, sobre a implementação da PR #85. Ambiente remoto previsto: `https://staging.mesiva.com.br`.

Commit final do código verificado: `97fab10b0d25a314b8a4aac9600e6d744b38fa71`. A `master` remota atual (`aed142da`) está contida na branch.

## Evidência local

- Tasks 1–13 implementadas com testes de contratos, concorrência, autorização, convites, isolamento, sessões e interface.
- Fluxo integrado real de criação de duas empresas, primeira ativação, aceite por conta existente sem trocar senha, perfis diferentes, proteção do último gerente, desativação em uma empresa e recuperação global: passou.
- Continuidade da interface após resposta perdida: uma UUID e um payload; navegação e saída bloqueadas até reconciliação; nenhuma leitura do bootstrap operacional no painel: passou.
- Arquitetura frontend e build: passaram. Lint sem erros; há avisos, inclusive de dependências de hooks e tamanho do bundle.
- Migrações 0038/0039 aplicadas ao D1 local com Wrangler 4.128.0. A tentativa inicial revelou o limite D1 de termos de SELECT composto; o preflight foi dividido sem remover verificações. A repetição executou 85 comandos da 0039 com sucesso.
- O início real do Worker revelou a exportação de uma constante na entrada. `worker/entry.js` expõe somente o handler; o runtime local iniciou em `127.0.0.1:4187`. O contrato da entrada foi testado antes/depois da correção.
- Primeira suíte completa: 3418 testes, 3414 passaram; quatro verificações históricas de nomes no código de impressão falharam. As verificações foram atualizadas para os clientes de contexto mantendo suas regras; os 24 testes relacionados passaram. A segunda execução passou 3418/3418. Após as seis correções da revisão, a execução final passou **3427/3427**, sem skips/cancelamentos (178940.7327 ms); inclui o contrato da entrada do Worker e as novas regressões. Não é a contagem da PR #85.

- Revisão independente única concluída no HEAD `fc4c4b62`: seis Important, nenhum Critical. Os seis foram reproduzidos RED e corrigidos GREEN, com gate completo depois; [relatório e resolução](2026-10-02-multi-company-final-review.md).
- Bundles finais com Wrangler 4.128.0: staging/produção passaram; flags multiempresa e preparo continuam `false`. D1 local: todas as 39 migrações aplicadas, nenhuma restante.
- Interface local com o Worker real e conta sintética: painel desktop, nomes longos e formulário em tela móvel inspecionados; sem rolagem horizontal. A observação móvel final teve largura de conteúdo/viewport 375/375 px. Não substitui homologação de dispositivos físicos.

## Estado remoto na entrega local (histórico)

Nenhum deploy, migração remota 0038/0039 ou corte multiempresa foi realizado por esta implementação até este registro. Flags padrão de staging e produção continuam `false`.

O procedimento privado exige `RESEND_API_KEY`, `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` no processo administrativo. A chave já cadastrada no Worker não fica disponível automaticamente nesse processo e não deve ser extraída. Após configuração privada, seguir [o roteiro](multi-company-staging.md), incluindo backup/bookmark e logins reais antes da finalização.

Envio e recebimento de e-mails reais, TV em duas empresas e impressão física não estão comprovados pelo teste local. Impressão física depende de equipamento; homologação de e-mails usa somente destinatários autorizados. Nenhum e-mail externo foi enviado pelos testes automatizados ou pela demonstração local.

Merge e publicação em produção não fazem parte desta entrega autorizada.

## Entrega revisável

[PR #88](https://github.com/vzaponi-dotcom/sistema-para-delivery/pull/88) aberta em rascunho e empilhada sobre a [PR #85](https://github.com/vzaponi-dotcom/sistema-para-delivery/pull/85). Issue #87 permanece aberta para o aceite remoto. O workspace desta execução é preservado porque o checkpoint remoto da Task 14 ainda está pendente.

## Gate adicional detectado no GitHub

No run `37062660924`, os oito shards passaram; o gate Spec B D1 comparava o schema de impressão completo contra a versão anterior e rejeitou os nove triggers aditivos previstos na 0039. A comparação agora mantém os quatro snapshots de dados e todos os objetos anteriores exatamente iguais, e exige os nove triggers nomeados com SQL correspondente à migração revisada. Testes provam rejeição de histórico/schema alterado e guards ausentes, enfraquecidas ou extras.

Depois da correção: **3429/3429** na suíte completa, zero falhas/skips/cancelamentos, 184661.5527 ms; lint passou. O **gate Spec B no D1 local real** passou instalação limpa, upgrade, preservação de histórico/referências e os nove cenários de persistência. O gate de perfil da operação também passou clean install/upgrade. A mudança está restrita à validação de migrações; o código da aplicação recebeu depois o complemento de retorno da conta descrito abaixo. A validação GitHub é repetida no novo HEAD, com resultados ligados na PR #88.

## Complemento de retorno da conta autora

A regressão I1 foi estendida para outra conta sair do formulário, retirada da permissão de criar e retorno da autora com escopo de identidade. O recibo permanece na memória por conta; sem a permissão, a pessoa pode sair; quando elegível, retorna somente à tela original para selecionar o painel e verificar a mesma UUID/payload. A exceção de navegação exige a autoria, as concessões corretas e ausência de outros efeitos/drafts pendentes. Nenhuma criação é reenviada automaticamente.

RED→GREEN nas duas fases, com uma única empresa persistida. Última suíte completa: **3429/3429**, zero falhas/skips/cancelamentos, 164838.4292 ms. Arquitetura, lint, build e ambos os bundles repetidos passaram. O run GitHub `37063598286` passou todos os shards e validação no commit anterior `6371def2`; a validação do HEAD final é ligada na PR #88. Os checkpoints remotos de staging permanecem pendentes.

## Preparo remoto autorizado — 2026-10-02

O usuário autorizou publicação e homologação. Bundle publicado a partir do HEAD `c59a672997d300d1fa915ebf5b28302dc157ab19`, que passou no [CI manual final](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/37064562184). Build e bundle de staging foram repetidos nesta publicação, com sucesso.

- Versão anterior: `98b04b10-0a97-4bde-a717-de3dd325dfbe`; etag do script e bookmark de Time Travel registrados em checkpoint privado.
- Backup SQL privado: 1.874.619 bytes, hash SHA-256 registrado; importação integral em SQLite em memória passou. Isso confirma a leitura do backup, não uma restauração remota. O retorno exige seu bundle anterior compatível e avaliação das escritas posteriores.
- Staging tinha também a migração 0037 pendente. As migrações 0037, 0038 e 0039 foram aplicadas com sucesso; Wrangler confirmou nenhuma migração restante. Os nove guards de impressão estão presentes.
- Versão de preparo publicada: `a6b73b96-2e83-45c1-b405-a9c57063b034`, no domínio `https://staging.mesiva.com.br`. Metadados remotos confirmam `AUTH_MULTI_COMPANY_ENABLED=false`, `AUTH_MULTI_COMPANY_PREPARE_ENABLED=true` e preservação do binding secreto Resend. Nenhum valor de segredo foi recuperado.
- Contagens após migração conferem com o backup: uma empresa, três usuários, 297 pedidos, 34 produtos, 278 jobs de impressão, 16 tentativas e 16 estações. A empresa existente continua `access_status=legacy`; nenhuma conta global foi criada neste checkpoint.
- Sete páginas públicas/deep links retornaram HTTP 200 e shell SPA. APIs de empresas e painel, inclusive criação sem autenticação, retornaram 401. Inspeção de desafios e convites com origem correta e tokens deliberadamente inválidos retornou 400 com seus códigos específicos; sem origem, a mutação foi recusada com 403.
- Tela de ativação publicada inspecionada no navegador; layout em viewport de 375 px ficou com conteúdo de 375 px, sem rolagem horizontal. Nenhuma credencial foi preenchida no navegador.

**Pendente:** credenciais no processo administrativo privado, preparo do administrador, ativação pelo titular, vínculo do primeiro gerente, readiness, ativação do flag global, logins reais e finalização dos acessos antigos. Um terminal privado com entradas mascaradas está aberto. As credenciais permanecem somente na memória desse processo; o auxiliar executa comandos administrativos fixos e aguarda checkpoints explícitos antes do vínculo e da finalização. Nenhum e-mail foi enviado neste checkpoint. A Task 14 permanece aberta até os testes autenticados e a homologação de dispositivos.

## Preparo do administrador remoto — 2026-10-02

O titular preencheu as credenciais no terminal privado. A conexão administrativa real `getPlatformProxy` com o D1 de staging e o comando `prepare-admin` concluíram com sucesso. As três concessões do painel foram confirmadas no banco. O Resend retornou `accepted` para o convite enviado ao destinatário autorizado; isso confirma aceite pelo provedor, não recebimento na caixa de entrada.

Na conferência após o envio, a conta estava ativa, ainda não verificada e sem credencial global. A ativação e a criação de senha foram entregues ao titular no navegador. O auxiliar privado aguarda o próximo checkpoint; nenhum vínculo de gerente, corte global ou finalização legado foi executado. Não repetir automaticamente o envio aceito enquanto o titular abre o convite.

## Corte global e testes autenticados — 2026-10-02

O titular concluiu a ativação; D1 confirmou conta ativa/verificada com credencial global versão 1. O preparo privado vinculou a mesma conta como gerente de Amor & Sabor sem trocar a senha; `check-ready` retornou `ready=true`.

A versão `08212f2d-24ab-4c04-a74f-ecbfbff3afab` ativou o flag global e desligou preparo. Metadados remotos e `/api/auth/session` confirmaram o modo multiempresa. O titular entrou no navegador do Codex; foram observados `/pedidos` para Amor & Sabor, menu Victor/Gerente e a seleção oficial de Administração Mesiva com lista de empresas. Somente depois dessas observações, `finalize-legacy` concluiu. D1 confirmou bootstrap finalizado, zero usuários históricos ativos e zero credenciais PIN. Credenciais do auxiliar privado foram removidas do processo ao final.

- Login com corpo de PIN foi recusado com 401 e mensagem de e-mail/senha.
- Desativar ou rebaixar o último gerente da primeira empresa pela API oficial retornou 409 `LAST_MANAGER`.
- API operacional no escopo de painel retornou 403; API de painel no escopo operacional retornou 403.
- Cadastro real pelo painel criou `[TESTE87] Cozinha de Homologação`, com vínculo convidado para a identidade já existente: uma conta global, credencial com revisão 1, sem substituição de senha. Empresa pendente não foi listada entre acessos elegíveis; tentativa direta de seleção retornou 403, mantendo escopo e marcador inalterados.
- Duas abas reais: seleção de painel na segunda removeu os dados operacionais da primeira e mudou sua interface para o painel. Leitura de bootstrap com o marcador anterior retornou 409 `SESSION_CONTEXT_CHANGED`.

## Falha de transporte de e-mail encontrada e corrigida

O convite da segunda empresa e uma recuperação autorizada ficaram incertos; o Resend não tinha registro dessas chamadas. A ativação enviada pelo processo Node privado estava entregue. Um probe no runtime local workerd 4.128.0 reproduziu `TypeError` antes de I/O: o runtime aceita `manual`/`follow` e rejeita o modo `error` usado pelo transporte, embora Node o aceite. Isso não era detectado pelos mocks do provedor.

Correção `587b8bef87b112df4ca0cd292f8bf5933d6d664f`: usar `redirect:manual`; respostas 301/302/303/307/308 continuam rejeitadas, sem seguir a localização nem encaminhar autorização/desafio. Seis novas regressões falharam RED e passaram GREEN; 38 testes relacionados passaram e a suíte completa passou **3435/3435**, zero falhas/skips/cancelamentos, 162474.9814 ms. Arquitetura, lint, build e ambos os bundles passaram. O probe real workerd deixou de falhar no transporte e recebeu rejeição normal do provedor com chave propositalmente sintética; nenhum destinatário/chave real nesse probe.

Versão corrigida publicada em staging: `f265e1d0-5c8a-4bcb-b0b3-458536a56d81`, mantendo global ligado/preparo desligado. O reenvio explícito do convite da empresa de teste foi aceito pelo Worker/Resend; o convite anterior foi revogado. O conector Resend confirmou **delivered** para ativação e novo convite. CI manual da correção: [run 37068837287](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/37068837287) **SUCCESS**, no commit `587b8bef87b112df4ca0cd292f8bf5933d6d664f`; todos os oito shards e o job de validação passaram.

No primeiro retorno do titular, D1 e painel ainda mostravam empresa pendente e vínculo convidado. Após a confirmação explícita dentro da Mesiva, o titular mostrou "Acesso confirmado". A atualização do painel mostrou "Acesso ativado / Convite aceito"; D1 confirmou ambos os vínculos e empresas ativos, uma conta global e revisão de credencial ainda 1. O aceite da segunda empresa preservou a senha.

## Seleção, isolamento e TV após o aceite

- Seletor real listou Amor & Sabor e a empresa de homologação como Gerente. Abertura de A, troca pelo menu para B e retorno para A passaram pela seleção oficial.
- Bootstrap/API em A: 297 pedidos e 26 produtos projetados. Em B: zero pedidos e zero produtos; interface exibiu os contadores zerados. A contagem projetada de produtos difere do inventário físico de 34 registros porque este inclui registros fora da projeção operacional.
- Em B, leitura do relatório de um pedido de A retornou 404 `REPORTING_ORDER_NOT_FOUND`; tentativa de desativar o gerente de A retornou 404 `USER_NOT_FOUND`. Bootstrap com o marcador anterior de A retornou 409 `SESSION_CONTEXT_CHANGED`.
- Fila de impressão de B retornou zero jobs. Documento de pedido de A solicitado em B retornou 404 `ORDER_NOT_FOUND`; nenhuma impressão física foi tentada.
- TV fictícia de B: criação do pedido de pareamento 201, aprovação 200, ativação 200 e estado 200 com zero pedidos. A tela real `/cozinha-tv` iniciou e exibiu zero pedidos. Após selecionar A na sessão humana, a TV permaneceu com zero pedidos de B, enquanto a operação A continuava com 19 pedidos em preparo. Isso confirma a independência entre credencial de TV e seleção humana nesse fluxo.
- A TV fictícia de B foi revogada explicitamente ao concluir o teste: estado passou a 401. A TV original de A permaneceu pareada; não foi revogada nem substituída. O teste da tela física de A após o corte ainda precisa ser confirmado pelo titular.
- A tentativa de instrumentar uma aba para bloquear canais antes do carregamento encontrou `Page.addScriptToEvaluateOnNewDocument` indisponível no controle do navegador. Nenhuma instrumentação foi aplicada e a aba temporária foi fechada. Os testes locais do fallback e a rejeição remota de contexto obsoleto passaram; o comportamento completo da interface remota sem canais ainda não foi comprovado.

## Convite do operador

O titular autorizou outro destinatário de homologação. A interface real de Equipe e acessos criou `[TESTE87] Operador de Homologação` em Amor & Sabor, perfil Operador, para esse destinatário. A aplicação confirmou aceite pelo serviço e o conector Resend confirmou **delivered**, envio às 19:01:51 BRT em 2026-10-02. A criação de senha e o aceite foram entregues ao titular; nenhum valor de senha ou link foi solicitado no chat. Não houve envio ao alias sugerido anteriormente.

O titular concluiu a ativação. D1 confirmou vínculo ativo em Amor & Sabor, perfil `operator`, e-mail verificado e revisão da credencial global 1; a equipe real passou a mostrar "Ativa". Foi emitido um segundo convite pela API oficial, após seleção da empresa de homologação, para a mesma identidade com perfil `manager`: resposta 201 e aceite de envio. Resend confirmou **delivered** às 19:15:14 BRT. O aceite desse vínculo e o login real da identidade de teste no navegador do Codex estão com o titular; sua senha atual deve ser preservada. A ação oficial "Trocar usuário" abriu o login para essa verificação. Ainda não se declara comprovada a diferença de permissões no login remoto.

**Pendente:** ativação/login do operador, perfis distintos e desativação de vínculo em somente uma empresa; recuperação concluída/revogação de sessões; interface remota sem canais; TV física da primeira empresa e demais verificações de filas/efeitos de impressão. Impressão física permanece o limite conhecido. A Task 14 continua aberta, assim como merge/produção.

**Ajuste informativo adiado:** na empresa existente vinculada pelo preparo privado, a projeção do painel procura o primeiro gerente somente por convite de empresa. O vínculo já verificado foi feito sem esse convite; a lista/detalhe mostram "ainda não preparado", apesar do acesso ativo. Nome e e-mail aparecem corretamente para a empresa criada pelo painel. Registrado como item menor de apresentação, junto ao contraste do logo no tema escuro; não altera elegibilidade ou concessões.
