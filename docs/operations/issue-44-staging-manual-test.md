# Teste manual da issue 44 em staging

Ambiente: https://staging.mesiva.com.br
Endereço alternativo: https://sistema-para-delivery-staging.vzaponi.workers.dev
PR: https://github.com/vzaponi-dotcom/sistema-para-delivery/pull/85

**Estado atual:** Gerente e Operador de teste ativados. Staging usa contas individuais; o PIN é recusado. Após o deploy antigo usado para configurar o domínio, a versão com perfis foi restaurada pelo workflow oficial em 01/10/2026. As contas, senhas e o corte original de 30/09/2026 às 23:36 foram preservados. No novo domínio, entre com identificador e senha. Resultados e gates pendentes estão no [QA](../superpowers/qa/2026-09-30-issue-44-access-qa.md).

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
