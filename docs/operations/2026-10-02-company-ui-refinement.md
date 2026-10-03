# Refinamento das telas de empresa e conta

Data: 2026-10-02. Continuação da homologação em staging; desenhos do menu e da lista administrativa aprovados pelo usuário nesta sessão.

## Alterações

- Menu: seção “Empresa atual”, nome/logo e troca no mesmo cartão; configurações da empresa em uma ação separada; edição da identidade permanece nas configurações. Administração Mesiva tem seção própria. Preferências locais do operador continuam acessíveis sem conceder configurações empresariais.
- Seletor e Minha conta: fundo e texto usam `--bg` e `--text` do tema, incluindo campos, cartões e títulos. Logo escuro e rótulos de seção acompanham o tema. Conteúdo de conta fica centralizado, com o Voltar alinhado.
- Navegação: abrir Trocar empresa usa `/empresas`, inclusive a partir de Minha conta. A conclusão da navegação admite apenas as rotas de contexto explicitamente fornecidas pela sessão; não desativa a guarda de rotas desconhecidas. O retorno de Minha conta ao seletor e o cancelamento do seletor voltam a funcionar.
- Administração: cabeçalho compacto com logo legível, busca e cadastro na mesma barra, colunas para empresa, gerente, acesso e convite, ação de detalhes e paginação discreta. Em telas menores, cartões identificam cada campo.
- Projeção informativa: empresas sem convite inaugural mostram um gerente ativo de conta verificada já vinculada, quando existente. O vínculo é correlacionado à própria empresa e identificado como `source: membership`. Usa o vínculo elegível mais antigo, sem afirmar que reconstruiu a identidade histórica do primeiro gerente. A interface informa “Vínculo existente” e “Sem convite pendente”. Não cria convite, modifica permissões ou altera contas.

## Evidência antes das correções

- Reprodução no navegador publicado: Seletor → Minha conta → Voltar permanecia em `/minha-conta`.
- No tema escuro, `.company-entry` tinha fundo `rgb(244,247,250)` e texto `rgb(16,44,77)`, enquanto os cartões tinham fundo `rgb(11,32,54)`. A mistura produzia baixo contraste e títulos ilegíveis.
- Testes RED de navegação reproduziram a abertura incorreta a partir de Minha conta e o retorno do contexto de empresas.
- Testes RED da projeção e da lista demonstraram a ausência do gerente vinculado e a afirmação incorreta de convite aceito.

## Verificação local

- Testes focados: 42/42, zero falhas, skips ou cancelamentos.
- Arquitetura: OK. Lint: exit 0, com avisos existentes. Build: exit 0, com aviso de tamanho de chunks. Bundle de staging dry run: OK, com multiempresa explicitamente ligado e preparo desligado.
- A primeira execução completa com concorrência 4 foi interrompida somente no processo filho de `CatalogWorkspace.test.js`, que ficou parado no ambiente de teste. Resultado da execução interrompida: 3444 passaram e 1 falhou por encerramento desse filho. O mesmo arquivo passou isoladamente, 3/3. A suíte completa foi repetida pelo comando normal do projeto.
- Repetição completa: `npm test`, 3445/3445, zero falhas, skips ou cancelamentos, 180159.1571 ms.

## Publicação e verificação remota

Código publicado: `e881a934`. Versão do Worker de staging: `4ad3baa3-e5eb-417d-81b8-45819e51d119`. Flags explícitos: multiempresa true, preparo false. Bundle observado: `/assets/index-_Oih6mnI.js`. Não houve migração, merge nem publicação em produção.

- Menu → Trocar empresa a partir de Minha conta abriu `/empresas` e mostrou as duas empresas.
- Seletor → Minha conta → Voltar retornou a `/empresas`; Voltar à operação abriu Pedidos. Administração → Minha conta → Voltar retornou à lista administrativa.
- Tema escuro: entrada `rgb(7,24,39)` e cartões `rgb(11,32,54)`, ambos com texto `rgb(248,250,252)`. Tema claro: entrada `rgb(245,247,250)` e cartões brancos, ambos com texto `rgb(15,39,71)`.
- Administração observada nos dois temas: logo legível, colunas alinhadas, busca/cadastro juntos e paginação discreta. A empresa existente mostra gerente vinculado e Sem convite pendente; a criada pelo painel mostra o convite efetivamente aceito.
- Viewport móvel solicitado e efetivo: 375 × 900. Largura do conteúdo: administração 360, seletor 375 e conta 360 px, sem overflow horizontal. Cartões administrativos com campos identificados e formulário da conta empilhado foram inspecionados visualmente.
- Capturas privadas: `company-admin-light-desktop.jpg`, `company-admin-dark-desktop.jpg`, `company-admin-dark-mobile.jpg`, `company-selector-{light,dark}-desktop.jpg`, `company-selector-dark-mobile.jpg` e `company-account-{light,dark}-desktop.jpg`, `company-account-dark-mobile.jpg`, no arquivo privado de evidências da homologação. Nenhuma captura com dados da conta foi enviada ao GitHub.

O workflow automático valida PRs para master; esta PR está empilhada sobre uma branch de feature. `gh pr checks 88` não reportou checks novos. A CI anterior continua evidência do código anterior; não se declara CI nova aprovada. A suíte completa e os gates locais acima correspondem a este refinamento.

## Segunda aprovação: ações separadas no menu

O usuário escolheu a proposta “Ações separadas”: identidade da empresa sem cartão interno, logo maior, nome/perfil em destaque, divisor e duas linhas completas para Trocar empresa e Configurações da empresa. Reutiliza as ações oficiais e os bloqueios existentes. Código `2c00de09`, versão de staging `572528b9-cd42-440e-985e-3d60745d26ef`, global true e preparo false.

A primeira suíte desta rodada encontrou uma falha real no teste `registration projection paginates with validated cursor and never includes credentials, tokens or operational data`: 3444 passaram, 1 falhou. O cadastro legado usa `datetime('now')` do SQLite; quando ele aparece na primeira página, o próprio cursor gerado era recusado por exigir uma data ISO canônica. A regressão determinística falhou antes da correção. O leitor agora admite também a data SQLite válida, preservando o texto original na comparação de paginação; formatos inválidos continuam recusados. Não modifica datas armazenadas nem requer migração.

- Baseline do menu/cabeçalho: 22/22. Depois da correção: 28/28 focados, incluindo API e paginação.
- Repetição completa: `npm test`, **3446/3446**, zero falhas/skips/cancelamentos, 181609.8684 ms. Lint, arquitetura, build e bundle de staging passaram; avisos existentes registrados nos logs privados.
- Navegador publicado: configurações abriu `/configuracoes`; troca abriu `/empresas` e carregou as empresas; menu inspecionado nos temas claro e escuro.
- Celular: viewport efetivo 375 px, bloco 328 px sem overflow; ambas as ações mediram 328 × 64.125 px. Capturas privadas `company-menu-separated-desktop.jpg`, `company-menu-separated-light.jpg`, `company-menu-separated-mobile.jpg`.
- Tema original, viewport normal e tela Minha conta restaurados. Sem merge, envio de e-mails, alteração de contas ou publicação em produção.

O usuário solicitou também esboços dos e-mails de convite e recuperação. As prévias usam o logo oficial e dados ilustrativos; foram conferidas em desktop/celular, mas os templates de envio ainda aguardam aprovação desse desenho.

Atualização posterior: o desenho foi aprovado e aplicado. Ver [Identidade visual dos e-mails de acesso](2026-10-02-access-email-branding.md) para os testes e a versão publicada em staging. O aviso de teste é exclusivo de staging e não aparece nos modelos de produção.
