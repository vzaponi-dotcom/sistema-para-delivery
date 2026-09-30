# Mesiva — Cozinha e navegação

Proposta visual aprovada em 29/09/2026. Implementação sobre a versão de staging
`397d3f8db6c6ee33b34d297d221fd1cb16a5ca33`, que inclui as reservas da Issue #82.

## Identidade

- Logo horizontal oficial em `public/brand/mesiva-logo.svg`, sem redesenho ou alteração de cores.
- Variante transparente para fundo escuro em `public/brand/mesiva-logo-dark.svg`:
  lettering `#F1F5F9` e slogan `#A8BBD2`, com geometria e cores do símbolo preservadas.
  O tema resolvido controla a troca via CSS na lateral e no topo mobile,
  incluindo a preferência Automático; o nome acessível da imagem permanece Mesiva.
- Referência: guia Mesiva v1.0 no Drive, arquivo `1YHj8qfsBMhGz7BQCCyTn69iQ8qtMOjKc`;
  SVG oficial `1trjYpwVraEeLslSTsLQ1h8QV6icCCP4T`.
- Ação principal: azul-marinho `#0F2747` com texto branco no tema claro.
- Seleção da navegação: verde discreto; azul identifica agendamentos e reservas;
  coral identifica atraso; verde semântico identifica finalização.
- Mesiva é a preferência inicial. Uma seleção explícita de Clássico é preservada.
- No modo escuro, os tokens de texto, superfícies e ações mantêm contraste.

## Navegação

- Desktop: logo na lateral, indicação da área e identidade da operação no topo.
- Mobile: topbar contínua, logo, notificações e menu da operação; navegação inferior preservada.
- Menus e badges continuam respeitando as permissões e dados oficiais.

## Cozinha

- Título e ações, abas, indicadores e filas organizados nessa ordem.
- A partir de 1101 px, preparo e agendamentos ficam lado a lado.
  Em telas menores, as filas se reorganizam verticalmente.
- “Atrasados” filtra apenas a fila de preparo, combinado com a busca existente.
  Os indicadores gerais e os agendamentos continuam visíveis.
- As observações dos itens permanecem legíveis. Datas, horários, detalhes,
  edição de reserva, cancelamento e confirmações usam os fluxos existentes.
- A implementação não altera contratos de API, regras de prazo, pagamentos,
  persistência, impressão ou a aplicação independente da TV.

## Verificação

Executar `npm test`, `npm run lint`, `npm run test:architecture` e `npm run build`.
Conferir claro/escuro, 1440 px, 390 px e 320 px; busca/filtro, cards com observações,
agendamentos de hoje e futuros, navegação, menus e abertura dos formulários.
Em staging, verificar o SHA do deploy, login e deep links, além dos smokes da UI.
Impressão física exige estação e impressora disponíveis.

## Continuidade

Este é o primeiro conjunto de telas do novo padrão. A navegação e os tokens são
compartilhados; Mesas, Comandas e o formulário de pedido precisam de revisão
específica antes de receber uma reorganização estrutural equivalente.
