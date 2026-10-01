# Teste manual da issue 44 em staging

Ambiente: https://staging.mesiva.com.br
Endereço alternativo: https://sistema-para-delivery-staging.vzaponi.workers.dev
PR: https://github.com/vzaponi-dotcom/sistema-para-delivery/pull/85

**Estado atual:** Gerente e Operador de teste ativados. Staging usa contas individuais; o PIN é recusado. Após o deploy antigo usado para configurar o domínio, a versão com perfis foi restaurada pelo workflow oficial em 01/10/2026. As contas, senhas e o corte original de 30/09/2026 às 23:36 foram preservados. No novo domínio, entre com identificador e senha. Resultados e gates pendentes estão no [QA](../superpowers/qa/2026-09-30-issue-44-access-qa.md).

**Testes adicionais em 01/10/2026:** recuperação do último Gerente, troca/redefinição de senha, reemissão e uso concorrente de convite passaram. No teste de recuperação, a senha do Gerente foi restabelecida para a fornecida pelo responsável; a senha do Operador foi restaurada após a rotação temporária. As duas contas continuam ativas com os perfis originais. Foram realizados 36 logins válidos com até quatro requisições simultâneas, sem erros e com máximo de 2,81 segundos. Login e logout com resposta atrasada em duas abas terminaram com identidade coerente. Isso não substitui a expiração de 12 horas/sete dias nem todos os cenários de cookies e escritas interrompidas. O QA distingue os resultados e os defeitos de frontend encontrados durante esses testes.

**Correções já publicadas:** o [deploy oficial](https://github.com/vzaponi-dotcom/sistema-para-delivery/actions/runs/36887918691) da versão `8e12361a` passou, com 3157 testes aprovados e um teste exclusivo de Windows ignorado no CI Linux. Modalidades de Nova venda carregam corretamente após login e F5. O rascunho aberto por URL direta agora pede confirmação antes de trocar usuário. A verificação real no navegador passou: manter conserva o rascunho, descartar volta ao login, e a próxima pessoa começa uma venda vazia. Nenhum pedido ou pagamento foi enviado nesses testes de rascunho.

## Fluxo de ativação do Operador já homologado

1. Entre com o identificador `gerente` e a senha definida na ativação. Deixe “Dispositivo pessoal” desmarcado para testar a sessão compartilhada de até 12 horas.
2. Abra `/configuracoes/equipe`. Em “Convidar pessoa”, informe nome, identificador `operador-teste` e perfil **Operador**. Copie o token exibido uma única vez; vale por 24 horas.
3. Em uma janela anônima, abra `/ativar-conta`, cole esse convite e defina outra senha de pelo menos 15 caracteres. A ativação não abre sessão.
4. Abra a raiz de staging e faça login como `operador-teste` com a senha criada. Mantenha o Gerente na janela original para comparar.

Não envie senhas ou convites pelo chat. O token serve para a ativação; o login usa identificador e senha.

## Conferir os perfis

Os dados usados nos testes ficam em staging.

| Teste | Gerente | Operador |
|---|---|---|
| Pedidos, histórico, comandas, criação, finalização e recebimento | Permitido | Permitido |
| Criar/editar cliente e imprimir documentos da operação | Permitido | Permitido |
| Relatórios, configurações gerenciais, equipe e atividades | Permitido | Negado/oculto |
| Cancelar, estornar, dar desconto, usar data passada, transferir pagamento, excluir cliente | Permitido | Negado |
| Descartar/forçar impressão e configurar estação | Permitido | Negado |
| Minha conta | Permitido | Permitido |

No Operador, abra diretamente `/relatorios`, `/configuracoes/equipe` e `/configuracoes/atividades`: não devem mostrar dados gerenciais. Compare também os payloads de rede; ocultar um menu não substitui a autorização da API.

Confira a auditoria no Gerente após ações da conta Operador. Tente desativar/rebaixar o último gerente utilizável: a alteração deve ser recusada.

## Sessões e dispositivos

- O PIN deve ser recusado. Sessões antigas de PIN devem perder acesso.
- Em duas abas da mesma janela, sair ou trocar usuário deve limpar a identidade e os dados anteriores em ambas; não deve repetir pagamentos ou impressões.
- Teste “Dispositivo pessoal” em uma sessão separada: duração absoluta de até sete dias.
- Observe uma impressão física e teste a TV no dispositivo real. Se uma impressão tiver resultado incerto, reconcilie explicitamente antes de tentar outra; confirme que não ocorreu duplicação.

Registrar resultados, navegador/dispositivo, horário e problemas sem senhas/tokens. Expiração completa, concorrência de cookies, recuperação administrativa e carga de login têm gates adicionais em [QA](../superpowers/qa/2026-09-30-issue-44-access-qa.md). Esta lista orienta o teste; não registra esses resultados como executados.

## Teste na TV física após a issue 44

Em 01/10/2026, o responsável informou que não poderá executar a impressão física. Esse teste permanece não executado por indisponibilidade de equipamento; não é convertido em aprovação. Após receber o roteiro abaixo, confirmou que a TV funcionou normalmente, como antes: **aceite funcional informado pelo responsável**, registrado no QA. O roteiro fica disponível para repetição:

1. No navegador da TV, abra https://staging.mesiva.com.br/cozinha-tv. Use esse mesmo domínio no computador/celular. A TV usa pareamento próprio, sem identificador, senha ou PIN humano.
2. No computador/celular, entre como Gerente e abra https://staging.mesiva.com.br/configuracoes/tv-da-cozinha. Digite os seis números exibidos na TV e clique em **Conectar TV**. Mantenha a página da TV aberta até concluir. Se já houver pareamento, teste a revogação no passo 6 e conecte novamente.
3. Inicie o painel pelo controle remoto se solicitado. Crie um pedido imediato fictício, com uma observação fácil de reconhecer; confira sua chegada automática, itens, observação e leitura à distância. Finalize o pedido na operação e confira sua remoção da TV. Confira som e tela cheia conforme o suporte do navegador real.
4. Atualize a página da TV: o pareamento deve continuar. Saia da conta humana no computador/celular: a TV deve continuar operando com sua própria credencial.
5. Compare os perfis no computador/celular: o Gerente pode administrar a TV e usar **Controle da TV**; o Operador não pode parear/revogar nem alterar página, modalidade ou visibilidade. O Operador pode consultar o controle em somente leitura.
6. Como Gerente, use **Revogar acesso** e confirme. Na próxima atualização automática da TV, os pedidos devem desaparecer e o painel deve informar falta de autorização. Atualize a página da TV e faça novo pareamento para deixar o ambiente funcional.

Em futuras execuções, registrar os resultados observados, foto do painel e modelo/navegador da TV. Não enviar códigos de pareamento. O aceite atual foi informado pelo responsável sem foto ou resultados separados por etapa.
