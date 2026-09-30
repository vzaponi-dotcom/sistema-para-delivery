# Mesiva — Cozinha, Comandas e navegação

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
- Atalho sol/lua ao lado das notificações alterna Claro/Escuro e salva a preferência
  existente no dispositivo. Segue o tema efetivo quando Automático está ativo;
  ao clicar, escolhe explicitamente Claro ou Escuro. Automático continua disponível
  nas preferências. O atalho respeita `preferences.local` e informa falhas ao salvar.
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

## Comandas

- A barra superior de resumo do salão foi removida após o refinamento solicitado.
  Os contadores permanecem nos filtros; ocupação e reserva são independentes.
- Busca por mesa, cliente da reserva ou número da comanda, sem distinção de acentos,
  combinada aos filtros Todas, Ocupadas, Livres e Reservas.
- Lista com indicação independente da ocupação atual e faixa azul para reserva,
  com nome, data e horário na mesma linha. Nomes longos usam reticências, mantendo
  o nome completo no título acessível e no detalhe da reserva.
  Seleção controlada permanece aberta quando sai do filtro, acompanhada de aviso.
- Detalhe destaca a mesa, o consumo e o pagamento; transferência, ticket e impressão
  preservam os fluxos, permissões e valores oficiais existentes.
- Reserva tem data, horário, total previsto e explicação da ocupação atual.
  Chegada, edição, cancelamento e não comparecimento mantêm suas regras e confirmações.
- Mesa livre sem reserva continua abrindo novo pedido; mesa livre com reserva abre
  o detalhe da reserva. Essa compatibilidade é intencional em relação ao protótipo.
- Desktop amplo usa duas colunas; tablet usa painéis empilhados; mobile alterna
  lista/detalhe, abre no topo e restaura a rolagem externa e interna ao voltar.
- Validação local: temas claro/escuro e larguras 1440, 1280, 900, 390 e 320 px.
  Revisão independente levou à correção da herança de grid e da rolagem mobile.
  Melhoria opcional futura: voltar pelo botão inferior de reserva em mesa livre
  pode restaurar foco à linha principal equivalente, em vez do mesmo botão inferior.

## Continuidade

Este é o primeiro conjunto de telas do novo padrão. A navegação e os tokens são
compartilhados; o formulário de pedido precisa de revisão
específica antes de receber uma reorganização estrutural equivalente.

## Mesas

- Cadastro em modal, busca por nome sem distinção de acentos e filtros Todas,
  Ativas e Inativas. Não há barra de indicadores do salão.
- Lista compacta com situação atual, reserva em azul (nome/data/hora na mesma
  linha, horário de São Paulo) e menus de ações. Inativas não aparecem como livres.
- Organizar ordem mostra alças de arraste usando `@dnd-kit/react`, como nas
  configurações. Alt + setas e ações do menu são alternativas ao gesto.
  Ao organizar, a busca é limpa e todos os IDs, inclusive inativos, são mantidos.
- Cada movimento salva pela API existente; Concluir ordem apenas encerra o modo.
  A mesa ocupada não pode iniciar um arraste, mas pode ser destino de inserção.
  Leituras oficiais continuam determinando a ordem; falhas ou atualização da
  lista durante o gesto não deixam a ordenação otimista do DOM como confirmada.
- A lista é reconstruída após o drop e restaura o foco à alça. Pedidos de escrita
  duplicados ficam bloqueados. Permissões, offline e operações pendentes são respeitados.
- Renomear/desativar revalidam ocupação e reserva mesmo com o formulário aberto.
  Desativação mantém confirmação e histórico; reativação usa o comando existente.
  Ver comanda mantém a identidade exata de mesa/comanda e a permissão correspondente.
- O layout compacto entra até 1000 px para acomodar a lateral em tablets.
  Validação local: 1440, 834, 390 e 320 px; temas claro/escuro; criação e busca;
  DnD real com sucesso/falha e restauração de foco; regras cobertas por testes.
