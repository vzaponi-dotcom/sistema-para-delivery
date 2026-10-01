# QA da UI de acesso — 01/10/2026

## Escopo e aprovação

Refinamento aprovado pelo Victor: lista compacta de equipe, atividades, Minha conta, login Mesiva inspirado no Sign In Split Screen e ativação. Sem importação do código pago do 21st.dev ou dependências adicionais.

## Evidências locais

- Baseline: 32 testes de acesso/shell passaram.
- Login/senhas: três testes novos falharam antes da implementação e passaram depois. Confirmações divergentes não chamam API/coordenador; segredo apagado no sucesso; ativação requer ação explícita de voltar ao login.
- Equipe: três testes novos RED → GREEN. Convite abre sob demanda, payload usa Operador, filtro é local, reset só envia após confirmação, cancelar não envia, último gerente utilizável protegido na UI. Testes anteriores continuam verificando conflito autoritativo e ownership.
- Atividades: referência começa recolhida; contrato dos filtros, cursor e abertura permitida preservado. Seis testes passaram.
- Integração de sessão: cenário existente de rotação foi atualizado para preencher a nova confirmação, mantendo asserções de bloqueio da troca durante rotação/verificação. Suite focada: 45 testes passaram.
- Suite completa: **3.165 passaram, zero falhas**, zero skips, 134,7s. Primeiro run encontrou somente fixture de rotação sem a nova confirmação; corrigida no segundo run.
- Architecture OK. Lint sem erros (avisos já existentes em runtime/testes). Build passou; aviso existente de chunks grandes.

## Inspeção visual do código real

Fixtures e API injetada exclusivamente locais, sem requisições a staging ou mutação de dados externos.

- 1280px: login, equipe compacta e atividades, tema claro.
- 390px: convite em modal, Minha conta, login e ativação. Login escuro: largura útil/content ambos 375px; logo carregado; sem overflow de componentes.
- 320px: atividades; campos de data passaram a uma coluna no limite de 400px e respeitam largura do contêiner. No navegador desktop com scrollbar, a largura mínima global de 320px preexistente é maior que a área útil de 305px; isso não foi alterado por esta UI. Em 390px a largura do documento coincide com a área útil.
- 768px: ativação em duas colunas, tema escuro; área útil/content ambos 753px.
- Rótulos dos selects são visíveis e usam SystemSelect existente (inclui seletor móvel). Senhas têm controles de 44px e campos de 16px no celular. Modal existente mantém foco/Escape.

Screenshots locais na pasta de visualizações da conversa: `mesiva-login-implementado-desktop.png` e `mesiva-login-implementado-celular.png`.

## Limites

Esta validação visual usa Chrome do navegador local; não substitui aparelhos físicos/Safari nem os testes operacionais de impressão registrados na QA original. Minha conta mostra nome/perfil retornados pela sessão; identificador só aparece se disponível no contexto, sem inventar ou obter dados gerenciais para um operador.

## Integração

Revisão independente do delta `5871b49..0a6b623c`: nenhum achado Critical/Important; um achado de tamanho de fonte móvel inicialmente classificado como Minor. Reclassificado pelo executor para correção: campos herdavam 13,44px, prejudicando legibilidade e podendo acionar zoom no Safari móvel. A regra de 16px foi movida depois do shorthand genérico.

Regressão visual `mobile invitation field retains 16px`, usando `getComputedStyle` no campo Nome do modal em 390px: RED `13.44px`, GREEN `16px`, após recarregar a página. Fechar o modal devolve foco a Convidar pessoa. Suite completa executada novamente após o ajuste: **3.165 passaram, zero falhas/skips**, 207,0s. Architecture, lint e build novamente aprovados, com os mesmos avisos existentes.

PR 85 recebe este delta; publicação usa o workflow existente Deploy staging. A descrição da PR registra o SHA executável e a execução de deploy confirmada. Sem merge ou produção.

## Decisões de execução e escopo da revisão

- Execução inline com aprovação existente: evitar nova etapa de aprovação duplicada, pois o desenho e a implementação já foram autorizados. Custo se errado: rever a UI na PR antes do merge.
- Renderização/foco deixados pelo revisor para a QA: inspeção local do código real cobre os tamanhos/temas acima e fechamento do convite; não afirma validação independente em aparelhos/Safari. Custo se errado: ajustes específicos de navegador podem ser necessários.
- Endpoints, migrations e grants anteriores fora do delta: contratos reais foram conferidos pelo revisor e a suite existente foi executada; a homologação original continua na QA da issue 44. Custo se errado: uma regressão anterior não reproduzida pela suite exigirá investigação própria.

Achados menores adiados desta revisão: nenhum; o único achado foi reclassificado e corrigido por seu efeito no uso móvel.

## Correção dos menus de ações da equipe

Relato posterior do Victor: vários menus abertos se sobrepondo e nomes longos repetidos nos botões. Reprodução no navegador com código real e fixtures locais: abrir a linha inferior e depois a superior deixava **dois** `details` de ações abertos. Causa: abertura nativa independente, sem estado exclusivo; cada botão também repetia todo o nome da pessoa.

- Abertura agora controlada por um único ID no estado da autoridade atual; abrir outro menu fecha o anterior. Fecha também por clique fora, Esc, atualização da lista, convite e escolha de ação. Esc devolve foco ao acionador.
- Nome completo aparece no cabeçalho; ações visíveis curtas. Labels acessíveis continuam identificando a pessoa. `[TESTE ISSUE44]` é parte do nome da conta fictícia, mantido no contexto.
- Dois testes novos RED → GREEN: exclusividade/dismissal/ação e nome longo sem repetir a identidade em cada botão. Equipe: 14/14 testes. Suite completa: **3167/3167**, zero falhas/skips, 173,3s. Architecture/lint/build passaram com os avisos existentes.
- Navegador local: sequência de dois acionadores deixa somente um menu aberto; Esc deixa zero e mantém foco no acionador correto. Nenhuma mutação de conta foi enviada na inspeção visual.

O redesenho do menu global de conta/operação permanece como proposta separada aguardando aprovação; este patch corrige apenas a regressão da equipe já aprovada.
