# QA — Menu organizado

## Escopo aprovado

Menu de conta e operação da issue44; opção Menu organizado aprovada nesta conversa. Sem alterações de API, autenticação, permissões ou dependências.

## Testes de regressão

- Baseline shell16/16 no HEAD fdc24875, com suite completa3169/3169 verificada no turno anterior nesse mesmo HEAD.
- RED observado para painel mobile ausente, mudança de largura, transição Sobre, perfil desconhecido e ação explícita de identidade.
- GREEN shell20/20: navegação do operador por preferences.local sem identidade, uma superfície após resize, liberação de rolagem, fechamento de Sobre com foco restaurado, perfil externo sem rótulo Gerente, ações/permissões e bloqueio de gravações existentes.
- Ajuste no teste de resize: BottomSheet usa aria-modal como string "true", corrigida a expectativa de tipo sem modificar o componente compartilhado.

## Conferência no navegador

Componente real em fixture local que injeta somente callbacks sem efeitos externos.

- Desktop: foco inicial em Minha conta, conteúdo por seções, popover e tema escuro.
- Mobile390×844 claro: BottomSheet, nomes/ações visíveis; Tab do último botão retorna a Fechar.
- Mobile320×680 escuro com nomes longos: largura da página e do painel320px, sem transbordamento horizontal; alvos de toque mínimos44px; corpo com rolagem (700px de conteúdo em504px disponíveis).
- Sobre substitui o painel, existe exatamente um diálogo e foco inicial em Fechar. Ao fechar, foco retorna ao acionador da operação e a rolagem do fundo é liberada.
- Resize com painel aberto desktop→mobile mantém uma superfície e inicializa foco no fechamento.
- Operador: Configurações e Este dispositivo presentes, Editar identidade ausente; dispositivo navega para settings-device e fecha o menu.
- Os overrides de viewport serão restaurados antes da entrega. Publicação e revisão são registradas na PR85.

## Gates locais

Suite completa3173/3173, zero falhas/skips. Architecture, lint e build exit0. Lint mantém avisos existentes no gerenciador de impressão; build mantém aviso de chunks acima de500kB. git diff --check aprovado.
