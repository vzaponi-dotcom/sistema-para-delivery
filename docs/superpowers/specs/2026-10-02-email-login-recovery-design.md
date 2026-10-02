# Mesiva — Login por e-mail e recuperação de senha

**Data:** 2026-10-02

**Base:** issue #44, PR #85, branch `feature/issue-44-users-profiles-access`, commit `fec31b234a5e8cdd57cca0ffc356d67763df0a2f`.

**Estado:** proposta escrita para revisão; implementação ainda não iniciada.

## 1. Intenção e decisões da conversa

O gerente e o operador devem entrar com e-mail e senha e recuperar a própria senha sem depender de outra pessoa. O envio será feito pelo Resend, começando pelo plano gratuito. O usuário autorizou desenvolver essa direção e esclareceu que as contas atuais são fictícias, somente em staging, e podem ser substituídas por contas novas. Não é necessário desenvolver uma transição para os identificadores atuais.

Esta especificação acrescenta envio de e-mail e substitui os contratos de identificador e recuperação da Spec da issue #44. Perfis, permissões, atribuição de ações, proteção do último gerente e duração das sessões continuam seguindo a implementação existente. A primeira validação será em `https://staging.mesiva.com.br`.

## 2. Abordagem escolhida

| Alternativa | Consequência |
|---|---|
| **Autenticação atual + Resend — recomendada** | Mantém sessões e autorização existentes; envia e-mail em convites e recuperação. Login comum não depende de envio. |
| Link por e-mail em cada login | Elimina a senha, mas depende de acesso à caixa de entrada e de envio a cada entrada durante a operação. |
| Provedor externo de autenticação | Exige adaptar identidades, sessões e integração com permissões já implementadas. Amplia esta entrega. |

A proposta usa e-mail + senha, convite por link e recuperação por link. Login por link, login social, cadastro público e editor de perfis não entram nesta entrega.

## 3. Experiência de uso

### Login

- Preservar o visual Mesiva aprovado e o comportamento responsivo atual.
- Campos **E-mail** e **Senha**, opção **Dispositivo pessoal**, botão **Entrar** e link **Esqueci minha senha**.
- E-mail com preenchimento automático apropriado, teclado de e-mail no celular e tratamento consistente no cliente e no servidor.
- Falha de credencial: **E-mail ou senha inválidos.**
- Remover a instrução de pedir um convite ao gerente para recuperar a própria senha. O fluxo humano de staging usa somente e-mail e senha.

### Convites e equipe

- O gerente informa **Nome**, **E-mail** e **Perfil** ao criar uma conta; operador é o perfil inicial selecionado.
- A conta aparece como **Convite pendente**. O gerente recebe confirmação de aceitação do envio pelo serviço, ou erro de envio com ação **Reenviar convite**. Aceitação pelo provedor não significa entrega na caixa de entrada.
- O e-mail traz identidade Mesiva, nome da operação, finalidade, validade e botão **Ativar minha conta**.
- O link abre uma tela para criar e confirmar a senha. Concluir a ativação confirma o e-mail e habilita a credencial em uma única transação. Depois, a pessoa entra normalmente; não há login automático.
- Convite válido por **24 horas**, de uso único. Reenviar gera outro link e invalida o anterior. A tela orienta usar o convite mais recente.
- Não exibir nem exigir cópia de tokens na interface normal. Links inválidos, expirados ou já utilizados recebem mensagem clara e orientação para solicitar novo convite.
- E-mail identifica a conta e aparece na equipe e em Minha conta. Nesta entrega, é somente leitura depois da criação; editar nome, perfil e estado segue disponível conforme as permissões atuais. Correção de endereço de convite pendente ocorre desativando a conta incorreta e criando outra. Troca de e-mail de uma conta ativada fica para uma evolução com verificação dos dois endereços.

### Esqueci minha senha

1. A pessoa informa seu e-mail na tela **Recuperar senha**.
2. A resposta é sempre: **Se houver uma conta ativa com esse e-mail, enviaremos um link para redefinir sua senha.** A tela orienta verificar spam e oferece voltar ao login.
3. Para conta ativa, com e-mail confirmado e credencial ativa, enviar link válido por **30 minutos**, de uso único.
4. O link abre **Criar nova senha**, com confirmação e as mesmas regras de senha existentes: mínimo de 15 caracteres e máximo de 1.024.
5. Ao concluir, substituir a credencial, invalidar outros links de recuperação e encerrar todas as sessões dessa pessoa de forma atômica. Mostrar **Senha atualizada. Entre com sua nova senha.**

Solicitar o e-mail não modifica a senha nem encerra sessões. O gerente único pode recuperar a própria senha dessa forma, sem deixar a operação temporariamente sem gerente utilizável. Uma conta desativada não pode ser reativada pela recuperação. Conta ainda não ativada depende de reenvio do convite pelo gerente.

### Redefinição iniciada pelo gerente

A ação existente para outro usuário passa a enviar o link ao e-mail confirmado dessa pessoa. Também não revoga credenciais ou sessões antes da conclusão. O gerente não define nem recebe a senha do usuário. Para a própria conta, usa **Esqueci minha senha** ou a troca autenticada de senha já existente.

Se a pessoa perdeu acesso à caixa de e-mail, permanece o procedimento administrativo controlado como exceção. Esse procedimento exige comprovação de titularidade e registro de auditoria; não é um endpoint público nem restaura o PIN.

## 4. Identidade e armazenamento

- O negócio permanece derivado do contexto confiável do Worker, nunca escolhido no corpo das chamadas públicas.
- `users.login_normalized` passa a guardar o e-mail canônico para as novas contas. A chave única `(business_id, login_normalized)` continua garantindo unicidade dentro do negócio.
- Acrescentar `email_verified_at`. Login, recuperação, criação e validação de sessão humana exigem esse campo preenchido nas novas regras. A proteção do último gerente também considera essa condição ao contar gerentes utilizáveis. Convites pendentes não concedem sessão.
- Canonização: remover espaços nas extremidades e converter para minúsculas. Não remover pontos nem sufixos `+`. Aceitar endereços ASCII convencionais, com uma parte local não vazia, domínio válido e limite de 254 caracteres; rejeitar nomes de exibição, espaços internos, controles e listas de destinatários. Endereços internacionalizados e partes locais entre aspas ficam fora desta versão.
- Adicionar armazenamento dedicado a desafios de e-mail, separado do comportamento antigo de `access_invites`. Cada desafio tem negócio, usuário, finalidade (`activation` ou `password_reset`), hash do token, e-mail destinatário, validade, consumo, revogação, emissor quando autenticado e versão da credencial esperada para redefinição.
- Token aleatório de 32 bytes, codificado para URL; persistir somente seu hash SHA-256. Nenhum token, senha, corpo de e-mail ou URL secreta entra em auditoria ou logs.
- Alteração autenticada de senha e recuperação invalidam desafios de recuperação anteriores. Desativação invalida sessões e desafios. A conclusão revalida usuário, perfil, e-mail, validade e versão da credencial dentro da transação; duas conclusões concorrentes não podem ter sucesso com o mesmo token.
- Manter o verificador versionado de senha e os cookies de sessão atuais. Não trocar o algoritmo de senha nesta frente.

## 5. Contratos e componentes

| Interface | Responsabilidade |
|---|---|
| `POST /api/auth/login` | Receber `email`, `password`, `deviceMode`; autenticar conta ativa com e-mail confirmado. |
| `POST /api/auth/password-recovery` | Receber `email`; aplicar limites e responder genericamente, enviando somente quando elegível. |
| `POST /api/auth/email-challenges/inspect` | Receber token no corpo e devolver somente finalidade/validade necessárias à tela; não consumir o desafio nem revelar dados da conta. |
| `POST /api/auth/email-challenges/complete` | Receber token e senha; concluir ativação ou redefinição de forma atômica. |
| APIs autenticadas de equipe | Criar conta com `email`, reenviar convite e enviar recuperação administrativa, exigindo as capabilities existentes. |
| Serviço de desafios no Worker | Emitir, verificar, consumir e revogar desafios; depende de D1 e das regras de credenciais. |
| Adaptador Resend no Worker | Enviar HTML e texto por HTTPS com prazo limite; depende somente da configuração de envio e do cliente HTTP. |
| Telas de autenticação | Login, recuperação e conclusão de desafio usando o layout Mesiva e acessibilidade existentes. |

As novas chamadas de autenticação respondem com `Cache-Control: no-store` e seguem a proteção de origem nas mutações. Endpoints públicos de desafios ficam antes do requisito de sessão, mas sempre vinculados ao negócio confiável.

O link de e-mail usa a origem configurada do ambiente e o token no **fragmento da URL**. O navegador remove o fragmento do histórico assim que o captura, mantém o token apenas em memória e o envia no corpo do POST. Não usar query string, armazenamento persistente, scripts de terceiros ou rastreamento de cliques/aberturas nos e-mails de acesso. Abertura do link por GET não consome o desafio, inclusive quando feita por scanners de segurança de e-mail. Recarregar depois de limpar o fragmento exige reabrir o link do e-mail; a tela informa isso.

## 6. Envio e falhas

- Configuração: `RESEND_API_KEY` como segredo do Worker; `AUTH_EMAIL_FROM`, `AUTH_PUBLIC_ORIGIN` e `AUTH_EMAIL_ENABLED` por ambiente. Nenhuma chave no frontend, Git ou chat.
- Remetente proposto: **Mesiva <acesso@mesiva.com.br>**, depois de verificar o domínio de envio no Resend. Staging identifica **Ambiente de testes** no assunto e no conteúdo.
- Resend por API HTTP, sem dependência de SDK. Usar `Idempotency-Key` própria por desafio e repetir o mesmo payload/chave somente em tentativas limitadas dentro da mesma execução, em falhas transitórias.
- O desafio é persistido antes do envio. Uma rejeição explícita pelo provedor revoga esse desafio; timeout de resultado incerto mantém sua validade porque o envio pode ter sido aceito. Em ambos os casos, credenciais e sessões existentes permanecem válidas.
- A emissão de novo desafio invalida o anterior mesmo se o novo envio falhar. A pessoa pode solicitar novamente após o intervalo; não se promete entrega transacional entre D1 e Resend.
- Sem fila de e-mails ou token em texto puro no banco. Reenvio após a execução terminar gera outro desafio; não tenta reconstruir o token anterior a partir do hash.
- Resposta pública não distingue conta ausente, desativada ou falha de envio específica. Indisponibilidade global de configuração pode responder 503 uniforme para qualquer endereço. APIs de gerente podem informar falha de envio e permitir reenvio.
- Auditoria registra emissão, envio aceito/rejeitado/incerto, consumo e revogação, com IDs e finalidade; falhas do provedor são sanitizadas. Dados sensíveis não aparecem em respostas públicas.
- Limites persistentes, com reserva atômica antes da consulta da conta: até **3 solicitações por e-mail/30 minutos** e **10 por origem/15 minutos** no fluxo público; chaves de e-mail/origem armazenadas como hashes com escopo de negócio. Ao exceder, retornar 429 independente de a conta existir.
- Reenvio autenticado tem intervalo mínimo de 60 segundos por conta. Implementar orçamento global inicial de **80 tentativas de envio por dia UTC** por ambiente, contando todos os tipos e reservando antes de enviar, para reduzir abuso e controlar o uso da cota. O limite pode ser configurado; não garante cota disponível se outros serviços compartilham a conta Resend.
- Sem chave/configuração válida, emissão e envio ficam indisponíveis com erro controlado. Login de contas já ativadas continua funcionando durante indisponibilidade do provedor.

## 7. Recomeço em staging e primeiro gerente

O descarte de contas fictícias é uma operação explícita de preparação de staging, não um efeito automático da migração de esquema ou de qualquer deploy.

1. Verificar conta Resend, domínio remetente, segredo de staging, origem dos links e caixa de entrada escolhida para o primeiro gerente. Fazer um envio de teste ao destinatário autorizado.
2. Em uma janela de preparação de staging, aplicar migração aditiva, disponibilizar a nova versão e preparar a nova conta de gerente por ferramenta administrativa de infraestrutura, com nome e e-mail definidos pelo usuário. Não oferecer cadastro público de gerente.
3. Enviar convite, completar a ativação e verificar credencial/e-mail confirmado da nova conta. Até concluir essa primeira ativação, pode haver indisponibilidade temporária do acesso humano em staging: as contas antigas não têm e-mail confirmado. A ferramenta de bootstrap é restrita a staging e a essa preparação, não uma exceção pública à proteção do último gerente.
4. Após confirmar o novo gerente utilizável, desativar contas fictícias anteriores e revogar suas credenciais, sessões e convites. Preservar IDs e referências históricas de auditoria/pedidos; não apagar banco, pedidos, catálogos ou perfis.
5. Manter `user_only`, criar novo operador pela interface e testar os fluxos completos. O bootstrap deve poder ser retomado sem criar gerentes duplicados ou desativar a nova conta. Falha de envio não dispara o descarte das contas anteriores; corrigir a configuração e retomar a preparação.

As contas fictícias anteriores deixam de entrar. Não implementar aliases de identificador nem importar suas senhas. A migração de esquema não apaga contas em produção. Merge, habilitação do envio e corte em produção exigem decisão própria; esta entrega deve ser validada primeiro em staging.

## 8. Verificação e aceite

- Testes reais de convite, recuperação do operador e recuperação do único gerente em caixas de entrada autorizadas; login por e-mail após ativação e redefinição.
- Testes de conta pendente/desativada, e-mail inválido/duplicado e token expirado, consumido, revogado ou de outro negócio/finalidade.
- Comprovar que pedir recuperação ou receber erro de envio não encerra sessão nem invalida senha; concluir recuperação invalida senha antiga e todas as sessões.
- Testes de concorrência na conclusão, versão da credencial, desativação simultânea, limites de solicitações e orçamento diário. Limites permanecem efetivos em chamadas paralelas e não dependem apenas da memória de um Worker.
- Simular rejeição, timeout e 429 do Resend; garantir confirmação honesta de envio, respostas públicas consistentes e ausência de segredos nos registros.
- Verificar fluxo de scanner GET, captura/remoção do fragmento, origem fixa por ambiente e inexistência de login automático após consumo.
- Exercitar desktop e celular: campos, teclado, mensagens, foco, voltar ao login e retomada de link sem sobreposição de telas.
- Executar os gates do repositório relevantes à autenticação e regressão de permissões; confirmar que operador continua impedido de configurações gerenciais tanto na UI quanto na API. TV e impressão mantêm os contratos existentes.
- Registrar resultado e limitações do ensaio em staging antes de propor merge.

## 9. Configuração externa necessária

São necessários uma conta Resend controlada pelo usuário, acesso ao DNS de `mesiva.com.br`, uma chave de envio instalada como segredo de staging e os endereços autorizados para testar gerente e operador. Esses valores serão fornecidos pela configuração segura na etapa de execução; a proposta não presume que a conta, o domínio ou os segredos já estejam configurados. Não contratar plano pago nem enviar mensagens a terceiros nesta etapa.

Referências oficiais consultadas em 2026-10-02:

- [Cotas do Resend](https://resend.com/docs/knowledge-base/account-quotas-and-limits): plano gratuito com 100 e-mails/dia e 3.000/mês; envios e recebimentos contam para a cota.
- [Domínios de envio](https://resend.com/docs/dashboard/domains/introduction).
- [API de envio](https://resend.com/docs/api-reference/emails/send-email).
- [Idempotência](https://resend.com/docs/dashboard/emails/idempotency-keys): suporte a chaves nos endpoints de envio, retidas por 24 horas.

## 10. Próxima etapa

Revisar e aprovar esta especificação escrita. Depois, elaborar o plano de implementação e revisar a execução no fluxo atual da branch/PR. A aprovação da direção e do uso de contas novas já está registrada; esta revisão cobre os contratos concretos de ativação, recuperação e corte descritos acima.
