# QA — gestão administrativa de empresas

Data: 05/10/2026. Branch: `codex/administracao-empresas`.

Escopo: primeira entrega de gestão administrativa, conforme [spec](../specs/2026-10-05-platform-company-management-design.md) e [plano](../plans/2026-10-05-platform-company-management.md). Domínio administrativo, publicação e homologação remota têm etapas próprias; não foram executados.

## Evidências de desenvolvimento

- Schema, grants e audit: testes inicialmente vermelhos pela ausência de ciclo/capabilities/eventos; 20 testes pertinentes verdes e gate clean install/upgrade aprovado. A migration nova preserva empresas/grants/audits; delegados mantêm suas permissões anteriores.
- Sessão, convites e TV: 61 testes pertinentes verdes. A corrida entre suspensão e commit operacional rejeita a gravação. Pareamento aprovado e credencial da TV não reabrem empresa suspensa; emissão/consumo de convite verifica o ciclo na transação.
- Receipts, revisão e grants: replay não avança revisão/audit; payload diferente na mesma chave é rejeitado; grant revogado durante commit produz rollback.
- Ciclo: suspensão/exclusão/restauração/retomada preservam ativação inicial, credenciais globais e outra empresa. Empresa restaurada fica suspensa; retomada de cadastro pendente não ativa seu primeiro acesso.
- Vínculos e convites: 32 testes pertinentes verdes na etapa correspondente. Vínculo revogado afeta só a empresa alvo. Reenvio administrativo de convite de equipe guarda emissor platform real; aceitação exige seus grants atuais. Replay de envio incerto não gera outro e-mail.
- API: consultas sanitizadas, busca por e-mail sem duplicação, cursor associado a query/filtro, grant revalidado após leitura e receipt exclusiva de conta/empresa. Testado também o roteamento completo pelo Worker.
- UI/sessão: 45 testes pertinentes verdes. Testes de regressão cobrem resposta perdida, consulta sem POST, chave original, autor diferente, resposta tardia de outro contexto, confirmação por nome e modal pendente até atualização oficial.
- Integração: 43 testes pertinentes verdes após os ajustes finais de elegibilidade e revisão. A sequência de exclusão/restauração preserva linhas de pedidos, itens, clientes, produtos, recebimentos/alocações, movimentos, comandas/reservas e histórico de impressão. Não houve operação em R2, QZ ou spooler.

## Navegador local

Conferido com build real do frontend, handler real do Worker e adaptador SQLite/D1 em memória. Servidor de QA restrito a `127.0.0.1:4175`, com contas e empresas fictícias, sem copiar banco existente, credenciais remotas ou produção. Esse ambiente não substitui homologação em Cloudflare staging.

- Lista compacta, Nova empresa junto ao título, busca e filtro, página de detalhes e três abas.
- Suspensão de empresa fictícia, exclusão com motivo/nome e restauração mantendo **Suspensa**.
- Histórico com responsável, motivo, data e fuso de São Paulo.
- Temas claro/escuro e viewport de 360 × 780: conteúdo reorganizado sem transbordamento horizontal; largura medida do conteúdo e scroll: 345 px.
- Foco inicial no motivo; foco após excluir retorna a **Restaurar empresa** e após restaurar a **Reativar acesso**. A conferência revelou fechamento prematuro do modal: reproduzido em teste vermelho e corrigido para manter modal/guard até leitura canônica.
- Navegação entre abas por ArrowLeft: seleção e foco acompanharam a ação. Escape, foco preso e scroll usam o Modal compartilhado; validação ampliada no gate de UI.
- Emulação de tema e viewport foram restauradas ao terminar a conferência.

Após o pedido de testes manuais locais, a prévia foi reaberta em `http://127.0.0.1:4175/__qa/start`: build atual, handler real do Worker, SQLite/D1 em memória e dados fictícios. Convites usam provedor simulado, sem requisições externas. O acesso de QA é restrito ao loopback e não altera o login do produto. O servidor temporário fica fora do versionamento; nenhum banco persistente existente foi criado, apagado ou reutilizado. Conferidas por HTTP a sessão platform, a lista e a leitura de pessoas/convite incerto. Os dados dessa prévia são reiniciados ao encerrar o processo.

Não foi enviado e-mail real nem executada impressão física. Procedimentos e decisões de resultados desconhecidos do QZ/spooler permanecem inalterados.

## Gates da entrega

| Verificação | Evidência |
| --- | --- |
| `npm run test:architecture` | Aprovado |
| `npm run lint` | Aprovado; avisos React/hooks registrados, sem erros bloqueantes |
| `npm run build` | Aprovado; aviso de chunk grande já presente no bundle principal |
| `npm test` | Primeira execução: 3598/3599; um stub de navegação ainda recusava a URL com `limit=20`. Stub corrigido, teste afetado 16/16 verde; segunda execução completa aprovada: 3599/3599. Após correções da revisão: suíte inteira com concorrência 4 aprovada, 3606/3606, sem falhas/cancelamentos/skips |
| Wrangler `4.128.0 deploy --dry-run` | Aprovado, sem publicação |
| Wrangler `4.128.0 deploy --dry-run --env staging` | Aprovado, sem publicação |
| `spec-b-d1-gate.mjs` | Aprovado em runtime D1 local Worker, 41 migrations; rollback, concorrência, receipts e preservação de impressão |
| `operation-profile-d1-gate.mjs` | Aprovado: clean install, upgrade de 0029, backfill e foreign keys |
| `company-management-d1-gate.mjs` | Aprovado: clean install e upgrade de 0040, grants seletivos e auditoria histórica |
| `git diff --check` | Aprovado antes do commit |
| Revisão independente | Concluída: nenhum Critical; perda do resultado de envio e cronologia histórica corrigidas em uma rodada TDD, com 31/31 testes pertinentes verdes |

O gate Spec B precisou executar seu supervisor Windows fora do sandbox após falha de permissão no diretório temporário do próprio gate; a repetição autorizada passou usando somente bancos locais de teste. A instalação seguiu `npm ci`, sem alterar dependências/lockfile; o audit do lockfile informou três advisories existentes, sem atualização automática.

Na repetição após a revisão, `npm test` parou de avançar em `src/domains/catalog/ui/ProductForm.test.js`, sem registrar falha de assertion. O arquivo passou isoladamente (4/4); somente os PIDs do runner e desse filho foram encerrados após identificação. A suíte inteira foi reiniciada com `npm test -- --test-concurrency=4`, sem excluir arquivos/testes: 3606/3606 aprovados em aproximadamente 203 segundos. Arquitetura, lint, build, dry-runs de produção/staging e gate Spec B D1 local foram repetidos e aprovados depois das correções; gates de schema/profile não foram invalidados. Os dry-runs usaram o Wrangler 4.128.0 já instalado após o sandbox impedir o acesso do npx ao registry/cache; não houve publicação.

## Decisões de execução

1. Os helpers Bash da skill não encontravam `basename` no ambiente Windows. Usados registros/briefs/logs equivalentes em PowerShell, mantendo isolamento, testes e commits; sem efeito no produto. O risco dessa adaptação é perder rastreabilidade, mitigado pelo ledger e histórico Git.
2. O guard de administrador elegível passou a ser assíncrono para validar e capturar o verifier suportado antes de compor a assertion transacional. Isso cumpre a exigência de credencial utilizável. Se incorreto, uma retomada poderia deixar a empresa sem alguém capaz de entrar; teste vermelho→verde cobre esse caso.
3. A revisão administrativa acompanha também edições da equipe, emissão/aceitação/reenvio de convites e alterações de perfil empresarial pelos owners existentes. Essas mudanças invalidam confirmações antigas do painel sem trocar sua autorização ou seu fluxo. Se incorreto, uma confirmação legítima poderia ser rejeitada ou uma alteração intermediária passar despercebida; testes de integração/perfil/reenvio cobrem isso.
4. O stub de retorno de Minha conta aceita as duas URLs exatas da listagem, incluindo a paginação explícita `limit=20`. O comportamento testado continua impedindo seleção de empresa/bootstrap operacional. Um stub amplo poderia esconder chamadas inesperadas; por isso não se usou correspondência genérica.
5. A cronologia de eventos com timestamps SQLite e ISO foi reclassificada de Minor para Important: a inversão também afetava a paginação e a reconstrução de mudanças de acesso. A correção normaliza a comparação temporal, mantendo desempate por ID. Se a reclassificação fosse excessiva, acrescentaria manutenção de query/teste sem benefício perceptível.
6. Homologação remota, envio real de e-mail e operação física QZ/spooler ficaram fora do julgamento da revisão. Mantida a validação local com dados fictícios e provedores simulados, com aceite desses ambientes na próxima etapa autorizada. Problemas específicos de ambiente, provedor ou hardware podem aparecer somente na homologação.
7. Separação de domínios e publicação ficaram fora do julgamento da revisão. Mantido o escopo aprovado: gestão nas rotas existentes nesta entrega, domínio administrativo em outra entrega e publicação pelo runbook. A entrada atual continua visível até essa segunda entrega.

## Correções da revisão independente

A revisão em contexto separado inspecionou isolamento, receipts, ativação inicial, concorrência, emissor dos convites e consumidores. Não encontrou falha Critical. O achado Important mostrou que um reenvio administrativo de convite de equipe gravava o resultado do provedor apenas na auditoria operacional. O achado de cronologia, inicialmente Minor, mostrou ordem incorreta entre timestamps antigos SQLite e novos ISO.

Sete regressões reproduziram os problemas antes das mudanças. O registro de entrega agora usa o emissor persistido (`issuer_scope`), associa o evento ao convite e mantém o responsável. Consultas posteriores de histórico, membros e receipt preservam accepted/rejected/uncertain; a aba de pessoas apresenta o resultado persistido. O histórico compara datas com `julianday`, inclusive no cursor, e desempata por ID. Testes pertinentes e regressões de convites anteriores: 31/31 aprovados. Não houve segunda revisão nem envio externo.

Não há achados menores adiados; os dois achados entraram na única rodada de correções, após reclassificação pelo impacto de auditoria.

## Ajustes após comentários da prévia local

Os comentários do usuário apontaram um indicador de situação duplicado e distante do conteúdo, ausência de espaço entre voltar/título e a expressão confusa “Acesso anterior”. O indicador permanece somente no card **Acesso da empresa**, com 24 px entre o botão de voltar e o cabeçalho. O estado anterior agora aparece como **Configuração pendente**, explicado por “Acesso por conta Mesiva ainda não configurado.”; regras de acesso e dados não mudaram.

Teste de regressão reproduziu os dois indicadores antes da correção e confirmou apenas um dentro do card depois dela. Testes pertinentes de lista/detalhes/gestão: 13/13. Navegador desktop e mobile 360 × 780: um indicador, respiro medido de 24 px, sem transbordamento horizontal. O viewport foi restaurado; a prévia permanece com o mesmo banco em memória, sem reiniciar o servidor nem perder os testes manuais já realizados. Documentação operacional esclarecida para explicar o novo rótulo.

Validação após esses ajustes: `npm test -- --test-concurrency=4` aprovado, 3607/3607 sem falhas/cancelamentos/skips; arquitetura, lint e build aprovados (avisos já registrados). `git diff --check` aprovado. Apenas apresentação/texto do frontend e documentação foram alterados; schema e Worker mantêm a evidência anterior. Sem push/publicação.

## Publicação e limitações

Código concluído e validado localmente; o usuário pediu explicitamente manter sem push para testes manuais locais antes de prosseguir. CI de PR/master, staging para o SHA da entrega, aceite humano, merge e produção ainda precisam seguir o [runbook](../../release-and-migration-runbook.md). Nenhum deploy/migration remoto, push ou merge foi executado nesta sessão.

Não voltar a um bundle que ignore o ciclo administrativo depois de suspender/excluir empresas. A compatibilidade de rollback de acesso precisa ser revisada junto de bundle/schema/dados. O novo domínio administrativo não integra esta primeira entrega.
