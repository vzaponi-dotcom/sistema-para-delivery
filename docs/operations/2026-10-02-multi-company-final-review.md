# Revisão independente final — multiempresa e onboarding

Data: 2026-10-02. Revisor único, sem delegação e sem alterações em arquivos de produto.

- Base: `003a898bac19958089eabab6aedf876adb231763`.
- HEAD revisado: `fc4c4b62080bd600efc46c5bf52d88530e634187`.
- Pacote: `.superpowers/sdd/2026-10-02-multi-company-onboarding-plan/review-003a898b..fc4c4b62.diff`.
- Requisitos: plano e Spec `2026-10-02-multi-company-onboarding`; consideradas as linhas `Ruling:` deste plano. Não foi consultado o ledger da frente de e-mail.
- O HEAD e a ausência de alterações de produto foram conferidos novamente ao concluir a leitura.

## Pontos fortes

- A separação entre identidade, vínculo empresarial e concessão da plataforma está presente no servidor e nos contratos da interface. A administração não ganha capacidades operacionais por consequência do papel administrativo.
- A emissão de convites resolve a identidade por e-mail dentro da transação. O aceite de uma identidade ainda sem senha exige novamente a ausência da credencial; uma segunda ativação não pode sobrescrever a primeira.
- O provisionamento grava padrões, recibo, vínculo, convite e auditoria atomicamente; a repetição do recibo precede a quota de um novo envio. A entrega ocorre depois da gravação e as projeções não expõem o token.
- As guardas aditivas cobrem as 19 referências simples entre tabelas empresariais identificadas por inspeção de `PRAGMA foreign_key_list`, preservando referências nulas e snapshots. O marcador de contexto é verificado antes do acesso operacional e a TV conserva autenticação própria.
- Os flags permanecem desligados por padrão e o roteiro distingue migração, preparo, corte, login efetivo e finalização.

## Achados

### Critical

Nenhum achado confirmado nesta categoria.

### Important

#### I1 — A invalidação externa perde a tentativa de criação incerta e permite duplicar a empresa

Local principal: `src/domains/platform/ui/NewCompany.jsx:10`. Integração: `src/app/shell/AppRoot.jsx:12`, `src/app/runtime/session/useSessionRuntime.js:48` e `src/App.jsx:716`.

A chave e o conteúdo da tentativa vivem apenas no `useRef` do formulário. Uma notificação de sessão de outra aba chama `refreshSession`, passa por `checking` e desmonta esse formulário. Ao retornar ao mesmo administrador, a tela reaparece vazia, sem a ação de reconciliar a tentativa anterior. `platformPending` continua no componente pai, mas só bloqueia navegação/saída; o formulário novo aceita outra criação.

Reprodução executada com o App, runtime e formulário reais, junto ao `createBusiness` real em SQLite: o primeiro POST gravou a empresa e o transporte lançou uma falha de resposta; um evento `storage` de `session-change`, com a descoberta temporariamente retida, desmontou a tela; após a descoberta, havia três campos vazios, nenhum botão “Verificar cadastro” e “Sair” ainda desabilitado. Reenviar os mesmos três campos gerou outra UUID e duas empresas distintas no banco. Isso ocorre até quando a descoberta devolve a mesma conta e o mesmo contexto.

Correção: manter a tentativa, vinculada à conta autora, acima do ciclo de montagem da tela e liquidar o resultado HTTP independentemente dela. Retomar a reconciliação com a mesma chave e o mesmo conteúdo após revalidação; não apresentar o conteúdo de uma tentativa a outra conta nem reenviá-la como novo cadastro. Cobrir invalidação externa antes e depois da resposta incerta, além de perda do corpo após commit.

#### I2 — Uma exportação atrasada baixa dados da empresa anterior depois da troca ou saída

Local: `src/domains/reporting/ui/ReportingExportMenu.jsx:50` e `src/domains/reporting/ui/ReportingExportMenu.jsx:69`.

O cliente captura corretamente o contexto da requisição, mas o fluxo de exportação não verifica se ainda pertence à tela/conta atual após os `await`. Ele chama `onDownload` mesmo depois do unmount. Uma resposta autorizada na origem pode chegar tarde, ou a geração de XLSX/PDF pode terminar depois da troca; nessa situação o download contém dados da operação anterior, inclusive em dispositivo compartilhado já ocupado por outra pessoa.

Reprodução executada: iniciar CSV com `exportModel` retido, desmontar `ReportingExportMenu`, liberar o modelo de A. O callback de download foi chamado uma vez após o unmount, e o Blob continha `Private client A`. O servidor não consegue impedir o caso em que a resposta já foi autorizada antes da troca.

Correção: capturar a identidade da operação e verificar montagem/contexto antes de aceitar o modelo e imediatamente antes do download, incluindo após geração assíncrona do arquivo. Descartar resposta e efeitos quando o proprietário mudar.

#### I3 — Entrar no painel a partir de uma sessão existente sempre recebe `400 INVALID_JSON`

Local: `src/infrastructure/auth/sessionApi.js:29`; a mesma forma existe em `src/domains/companies/infrastructure/companiesApi.js:8`. Contrato do servidor: `worker/identity/authApi.js:85`.

Os dois clientes de `select-platform` enviam `{ method: 'POST' }` sem corpo. O handler lê JSON de todo POST exceto logout. A seleção falha antes de verificar a sessão, impedindo a ação “Administração Mesiva” e a seleção automática de escopo ao abrir `/mesiva` com uma sessão empresarial existente. O login iniciado diretamente no painel usa outro caminho, por isso a validação desse login não detecta o defeito.

Reprodução executada: login global real da fixture, cookie e marcador oficiais encaminhados pelo `createSessionApi` real ao `handleGlobalAuthApi`. Resultado: corpo ausente e resposta `400`, `INVALID_JSON`, “Envie um JSON válido.”

Correção: alinhar os dois clientes e o handler quanto ao corpo de seleção de plataforma; cobrir o cliente real contra a API real, sem um mock que sempre aceite o POST.

#### I4 — A impressão de comanda conserva o cliente da primeira renderização

Local: `src/domains/printing/application/usePrintingManager.js:865`.

`printTableTab` usa `useCallback(..., [])` e fecha sobre `api`. Na montagem normal de `ApplicationRuntime`, a sessão ainda está em descoberta e esse primeiro cliente não tem marcador. Depois do login ou da troca, o callback continua usando o cliente anterior; imprimir a comanda envia marcador ausente/antigo e recebe conflito, embora o restante da tela já pertença à sessão atual.

Reprodução executada com o hook real: renderizar com `oldApi`, atualizar para `newApi` e chamar o `printTableTab` retornado pela renderização atual. A única chamada foi `oldApi.createManualTableTabPrintJob('tab-B')`.

Correção: atualizar esse callback quando o cliente capturado mudar, mantendo os callbacks antigos associados ao contexto antigo. Cobrir a passagem de descoberta sem sessão para sessão empresarial e A → B.

#### I5 — Editar um vínculo pode gravar depois do vencimento da sessão do gerente

Local: `worker/tenancy/memberships.js:50` e `worker/tenancy/memberships.js:73`.

`updateMembership` reutiliza `issuer.statement`, preparada com o horário inicial, depois de várias leituras assíncronas. Embora a guarda seja executada dentro da transação, a comparação de expiração usa aquele horário antigo. O cuidado com tempo decorrido já usado em seleção, provisionamento e reenvio não foi aplicado aqui.

Reprodução executada no serviço real com SQLite: iniciar a edição com 10 ms restantes de sessão, atrasar a leitura do usuário por 50 ms e desativar Bob. A operação terminou após aproximadamente 58 ms e persistiu `active=false`. A validação posterior da resposta não desfaz essa alteração caso detecte o vencimento.

Correção: reconstruir a assertion a partir do snapshot original e do horário de commit que inclua a preparação assíncrona, preservando a comparação de permissões/revisão. Adicionar caso de vencimento durante edição de perfil/desativação, verificando rollback da mutação e da auditoria.

#### I6 — O preparo privado pode marcar a empresa como ativa com a conta do gerente já desativada

Local: `worker/platform/bootstrap.js:88` e `worker/platform/bootstrap.js:90`.

O ramo de identidade já verificada revalida apenas a credencial do gerente no batch. O estado ativo/verificado da conta foi lido antes, em `usable(credential)`, e não é repetido para o destinatário. Se essa conta for desativada entre leitura e commit, a transação ativa o vínculo e a empresa e retorna `activated: true`, apesar de esse primeiro gerente não poder entrar.

Reprodução executada: preparar o administrador, iniciar `prepareExistingBusinessManager` para a conta verificada Alice e definir `accounts.active=0` imediatamente antes do segundo batch. O resultado foi `activated:true`, empresa `active`, vínculo `active`, conta `active=0`, e `readMultiCompanyReadiness` devolveu `ready:false`.

O checkpoint de readiness ainda bloqueia um corte correto; este achado não concede acesso à conta desativada. O problema é persistir uma empresa ativada sem o gerente utilizável prometido, exigindo reparação do preparo em vez de rollback.

Correção: repetir na mesma transação os predicados de elegibilidade da conta destinatária, junto da revisão/verificador; impedir as ativações quando a condição mudar. Verificar que a empresa e o vínculo permanecem no estado anterior ao batch rejeitado.

### Minor

Nenhum achado cosmético adicional foi aprofundado nesta passagem.

## Verificação executada pelo revisor

Comando focado, no HEAD indicado:

```text
node --test --test-concurrency=4 worker/identity/accounts.test.js worker/identity/authApi.test.js worker/identity/challenges.test.js worker/identity/sessions.test.js worker/tenancy/companyInvitations.test.js worker/tenancy/memberships.test.js worker/tenancy/scopeSelection.test.js worker/tenancy/referenceGuards.test.js worker/tenancy/isolationApi.test.js worker/tenancy/deviceIsolation.test.js worker/platform/businessProvisioning.test.js worker/platform/businessesApi.test.js worker/platform/bootstrap.test.js
```

Resultado: **78/78 passaram**, zero falhas, cancelamentos ou skips. Isso confirma a cobertura existente, mas não cobre as seis reproduções acima. As reproduções foram executadas por scripts temporários em stdin, com fixtures sintéticas em memória; nenhuma mensagem foi enviada nem banco remoto alterado.

O autor informou a execução completa de 3418/3418, o teste separado do entry e o início real do Worker local. Esses são resultados do autor, não nova execução integral pelo revisor. Nenhum deles certifica rollout remoto.

## Review Focus

1. Convites concorrentes e senha global: leitura do serviço e testes reais de concorrência/aceite não mostraram sobrescrita da primeira senha.
2. IDs estrangeiros, nullable e snapshots: guardas e APIs exercitadas; as referências simples identificadas na estrutura possuem guardas correspondentes.
3. Commit com resposta perdida, quota e reenvio: serviço de provisionamento/reenvio preserva recibos e unicidade; I1 impede considerar a reconciliação completa na interface.
4. Abas e respostas antigas: marcador rejeita acesso operacional com contexto antigo; I2 e I4 mostram lacunas em efeitos/callbacks do frontend. I1 também cruza esta fronteira.
5. Revogação/revisão/vencimento: seleção e ações da plataforma têm assertions transacionais; I5 e I6 mostram condições faltantes em ações administrativas empresariais e preparo privado.

## Recomendações para a única passagem de correção

Transformar cada reprodução em um caso RED, corrigir no módulo responsável e rodar os casos relacionados, seguidos do gate completo. No caso I1, a tentativa precisa continuar vinculada à conta que a iniciou; o recibo do servidor é por conta administrativa. Não solucionar a perda da tentativa apenas destravando a navegação ou gerando outra UUID.

## Declined to judge / limites não comprovados

- Migração e corte remotos de staging, bootstrap pela conexão real `getPlatformProxy`, readiness/login/finalização remotos: não executados nesta revisão; faltam credenciais e evidência remota. Os testes de serviços/portas injetadas não substituem essa comprovação.
- Entrega real de Resend, chegada à caixa e aceite/recuperação com destinatários autorizados: nenhum e-mail foi enviado nesta revisão.
- Saída física QZ/impressora e TV em equipamento real: foram revisados contratos, persistência e testes de isolamento; nenhum equipamento foi homologado.
- Pausa física de impressão durante toda a janela de troca e comportamento de canais reais do navegador em dois dispositivos: não comprovados por reprodução física/browser nesta passagem. Não inferir homologação destes casos a partir dos testes unitários de marcador.
- Reload/fechamento integral do navegador durante criação incerta: não reproduzido; I1 foi comprovado sem reload, apenas com a invalidação suportada entre abas. O guard de `beforeunload` não resolve I1.
- Contraste cosmético do logotipo no tema escuro: observação visual comunicada pelo autor; não foi tratada como falha de autorização nem aprofundada como gate material.
- Migração de identidades reais de produção, cobrança, suporte operacional da plataforma e suspensão comercial: explicitamente fora desta entrega.

## Avaliação

**Pronto para merge? Não, antes de corrigir os achados Important.**

A fundação de isolamento e as transações principais estão bem estruturadas, mas há falhas verificadas de duplicação no onboarding, efeitos tardios com dados anteriores e integração de seleção/impressão, além das duas condições administrativas não revalidadas. Este relatório é a única revisão independente final; não constitui aprovação de release, migração remota ou impressão física.


## Resolução pelo autor — commit 8396b5f2

Os seis achados Important foram corrigidos em uma única passagem após classificação. Cada reprodução teve um teste RED antes da correção e GREEN depois. Não foi realizada segunda revisão independente.

| Achado | Correção e evidência |
|---|---|
| I1 | Registro de tentativa por conta acima da descoberta da sessão; resposta liquidada mesmo com formulário desmontado; mesmo UUID/payload no replay; cenário real App + SQLite antes/depois da resposta, outra conta e retorno; somente uma empresa criada. |
| I2 | Proprietário, montagem, permissão e cancelamento conferidos após a resposta e antes do download; exportações atrasadas descartadas. |
| I3 | Comando de seleção de plataforma aceita POST sem corpo e exige cookie/marcador oficial; cliente real contra API real em escopos identidade e empresa. |
| I4 | Callback atual captura o cliente atual; callback antigo conserva o contexto antigo; teste de render A → B. |
| I5 | Assertion do snapshot original usa o tempo decorrido até commit; edição e auditoria rejeitadas atomicamente após vencimento. |
| I6 | Batch exige conta destinatária ativa/verificada junto da credencial; desativação ou perda da verificação faz rollback. |

Suite completa do código corrigido: **3427/3427**, zero falhas, skips ou cancelamentos, 178940.7327 ms. Arquitetura, lint, build, D1 local e bundles de staging/produção passaram. Lint contém avisos e build contém aviso de tamanho.

Os limites remotos e físicos do relatório permanecem pendentes; este registro não certifica deploy/corte ou entrega de e-mail. O logo escuro foi classificado como ajuste visual menor e adiado. Tentativas ficam na memória desta aba com aviso antes de recarregar/fechar; forçar o encerramento perde esse estado e exige inspecionar o cadastro existente antes de criar novamente.

## Verificação adicional do CI

Após os oito shards passarem, o gate de migração detectou que sua comparação histórica não aceitava os nove triggers aditivos. A regra foi atualizada para verificar dados e schema anteriores sem alterações e validar exatamente os nove triggers revisados. Regressões 2/2, gate D1 real clean/upgrade e suíte final 3429/3429 passaram. Decisão/custo registrados no documento de decisões; não foi disparada outra revisão independente.

## Continuidade I1 complementada — 97fab10b

O teste real App/SQLite agora cobre retorno após outra conta sair do formulário, retirada da permissão de criar e retorno com escopo de identidade. A tentativa permanece da autora e só pode ser reconciliada no destino original autorizado; sem as concessões necessárias, saída continua disponível sem apagar o recibo. Duas fases RED→GREEN; suíte final 3429/3429 e demais gates locais passaram. Nenhuma revisão adicional foi disparada.
