# Spec B — aceite integrado T22

**Base testada:** `7ddd1b65f3a865ccb765eab693d2a021074c2ab5`  
**Worktree:** `.worktrees/t22`, detached e limpo na abertura  
**Escopo:** somente T22; T23 não iniciada

## Evidência automatizada

- `node --test src/specBSettingsIntegration.test.js src/settingsResponsive.test.js`: **PASS 6/6**.
- Regressão proporcional de Settings, navegação/drafts/conflitos, capabilities, impressão/recovery, NewOrder, cozinha/histórico, pagamentos, cancelamentos e financeiro: **212/213**; a única falha é o cenário reset/relogin já catalogado em `TEST-INFRA-02`.
- `node --test src/actionCapabilities.test.js`: **PASS 22/22**, incluindo `printing.execute` sem `printing.station.configure` e ausência dos controles de configuração.
- O harness automatiza contratos estruturais de layout fluido/mobile, nomes longos, actions, safe-area e modal. Ele não possui motor de layout: geometria/overflow em 1440, 1024, 768, 390, 360 e 320 px permanece PENDING na homologação real abaixo.

## Evidência visual/manual

Foi iniciado servidor Vite local em `http://127.0.0.1:4175/`. A automação de computador retornou `browsers: []` e `apps: []`; a abertura explícita no Edge retornou `Browser is not available: edge`. Nenhuma screenshot foi produzida. Não há PASS manual ou visual presumido.

| ID | Automatizado | Manual/visual | Evidência e pendência |
|---|---|---|---|
| V01 Home | PASS | PENDING | Cards/capabilities/tema em `SettingsHome.test.js`; conferir desktop/mobile claro/escuro. |
| V02 Operação | PASS | PENDING | Campos, validação, erro e responsividade em `OperationSettings.test.js`; conferir foco/zoom real. |
| V03 Modalidades | PASS | PENDING | Mesmo draft e navegação bidirecional automatizados; conferir composição real. |
| V04 Pagamentos | PASS | PENDING | Lista responsiva, ordem, read-only e ausência de CRUD automatizados. |
| V05 Cancelamentos | PASS | PENDING | Modal, catálogo, first-use, read-only e mobile automatizados. |
| V06 Categorias financeiras | PASS | PENDING | Grupos, histórico, first-use, read-only e mobile automatizados. |
| V07 Impressão | PASS | PENDING | Ownership/capabilities/auto-print/recovery automatizados; QZ e impressão física não executados. |
| V08 Dispositivo | PASS | PENDING | Claro/Escuro/Automático e persistência local automatizados; conferir temas reais. |
| V09 Modal | PASS | PENDING | Validação, primeiro erro, Escape e retorno de foco automatizados; conferir viewport/teclado. |
| V10 Descarte | PASS | PENDING | Guard, decisão única e preservação de draft automatizados. |
| V11 Conflito | PASS | PENDING | Comparação, decisão explícita e proteção de item automatizadas; conferir layout empilhado. |
| V12 Envio incerto | PASS | PENDING | Estados saving/unconfirmed e reconciliação sem reenvio automatizados. |
| V13 Read-only | PASS | PENDING | Dados sem controles de escrita e rotas/capabilities automatizados. |
| V14 Loading/indisponível | PASS | PENDING | App sem policy falha fechado; estados loading/error/reconsulta automatizados. |

## Defeitos demonstrados por RED/GREEN

1. A auditoria inicial mostrou que a decisão não podia parar antes de `claimNextPrintJob`: a mesma fronteira executa jobs manuais/priorizados com autoimpressão desligada. O teste integrado agora prova que o polling alcança a claim segura sem iniciar execução quando ela rejeita o job normal; a claim real do Worker prova separadamente que auto off rejeita job normal e aceita manual/priorizado.
2. App sem configuração efetiva enviava `undefined` ao `NewOrder`, ativando fallback silencioso para Entrega/Retirada/Local. O App agora envia lista explícita vazia e o formulário bloqueia nova venda sem apagar dados; o fallback isolado de `NewOrder` permanece compatível.
3. Nome de catálogo com 80 caracteres não tinha quebra garantida em largura estreita. Adicionado `overflow-wrap:anywhere` ao nome.
4. Badge longo não tinha quebra garantida. Adicionado `overflow-wrap:anywhere` ao badge.

Fixtures de regressão que pretendiam testar outros contratos passaram a declarar policy/catálogo revision 0 legítimos; nenhuma permissão foi ampliada.

## Pendências deliberadas

- Screenshots reais: **PENDING**, navegador indisponível no ambiente.
- Zoom 200%, teclado virtual e inspeção de overflow por motor real: **PENDING** para T23/usuário.
- `TEST-INFRA-01`: **OPEN / causa não confirmada**, não investigado.
- `TEST-INFRA-02`: **OPEN / causa não confirmada**, reproduzido em 1 cenário da seleção proporcional; não investigado.
- Não executados: `npm test` agregado, deploy, migrations remotas, impressão física, merge, release ou PR para master.
