# Teste manual da issue 44 em staging

Ambiente: https://sistema-para-delivery-staging.vzaponi.workers.dev
PR: https://github.com/vzaponi-dotcom/sistema-para-delivery/pull/85

## Preparar as duas contas

1. Após o deploy, abra `/ativar-conta`, cole o convite entregue no terminal privado e defina uma senha de pelo menos 15 caracteres. Não envie senha ou convite pelo chat. A ativação não abre sessão.
2. Entre com o identificador `gerente`. Deixe “Dispositivo pessoal” desmarcado para testar a sessão compartilhada de até 12 horas.
3. Abra `/configuracoes/equipe`. Em “Convidar pessoa”, informe nome, identificador `operador-teste` e perfil **Operador**. Copie o token exibido uma única vez.
4. Em uma janela anônima, abra `/ativar-conta`, aceite esse convite e defina outra senha. Faça login como `operador-teste`.
5. Avise que as duas contas estão ativas. O responsável executará o preflight e o corte autorizado de staging. Antes do corte, contas individuais têm acesso à administração permitida e à própria conta; as operações ainda usam o PIN.

## Conferir os perfis depois do corte

Atualize as duas janelas. Os dados usados nos testes ficam em staging.

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

- Depois do corte, o PIN deve ser recusado. Sessões antigas de PIN devem perder acesso.
- Em duas abas da mesma janela, sair ou trocar usuário deve limpar a identidade e os dados anteriores em ambas; não deve repetir pagamentos ou impressões.
- Teste “Dispositivo pessoal” em uma sessão separada: duração absoluta de até sete dias.
- Observe uma impressão física e teste a TV no dispositivo real. Se uma impressão tiver resultado incerto, reconcilie explicitamente antes de tentar outra; confirme que não ocorreu duplicação.

Registrar resultados, navegador/dispositivo, horário e problemas sem senhas/tokens. Expiração completa, concorrência de cookies, recuperação administrativa e carga de login têm gates adicionais em [QA](../superpowers/qa/2026-09-30-issue-44-access-qa.md). Esta lista orienta o teste; não registra resultados executados.
