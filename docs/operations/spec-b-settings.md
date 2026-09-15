# Spec B — operação de configurações e políticas

Este runbook descreve a operação segura das configurações de negócio introduzidas pela Spec B. Ele complementa `docs/release-and-migration-runbook.md` e `docs/operations/windows-qz-tray-printing.md`.

## Escopo

A Spec B centraliza políticas e catálogos que antes estavam dispersos ou implícitos:

- tempos e modalidades de operação;
- formas de pagamento e método padrão;
- motivos de cancelamento;
- categorias financeiras;
- política de impressão por contexto e configuração da estação;
- preferências locais do dispositivo, como tema e som;
- revisões, drafts, conflitos, confirmação de save e recuperação de resultado incerto.

As configurações de negócio são persistidas por estabelecimento e versionadas. Preferências estritamente locais continuam no dispositivo e não devem virar configuração remota por conveniência.

## Modelo operacional

### Configuração confirmada e draft

A tela sempre parte de uma configuração confirmada. Alterações editáveis formam um draft local e só se tornam oficiais após `Salvar alterações`/ação equivalente retornar confirmação do backend.

- navegar dentro do mesmo domínio pode preservar o draft quando previsto pela tela;
- sair de um domínio com alterações pendentes deve respeitar o guard de descarte;
- falha, conflito ou resultado incerto não pode produzir confirmação falsa de sucesso;
- um refresh/reload deve reconstruir o estado a partir da configuração oficial e dos mecanismos de recuperação previstos.

### Revisões e concorrência

Writes remotos usam revisão esperada. Se outro dispositivo salvar antes:

1. o backend rejeita a revisão obsoleta;
2. o cliente reconsulta a configuração oficial;
3. o conflito é apresentado de forma explícita;
4. o operador escolhe o valor oficial ou seu ajuste quando aplicável;
5. após aplicar a decisão, é necessário salvar novamente.

Nunca resolver conflito sobrescrevendo silenciosamente o valor remoto.

### Resultado incerto

Se o cliente não consegue confirmar se o save remoto foi aceito, o estado deve permanecer `unconfirmed`/equivalente e ser reconciliado por leitura. Não reenviar automaticamente a mutação sem prova de idempotência.

## Domínios

### Operação

Os tempos e modalidades ativas alimentam consumidores operacionais. Pedidos já abertos preservam dados que precisam de estabilidade histórica; novas decisões usam a configuração efetiva atual conforme os contratos compartilhados.

Ao desativar uma modalidade em uso por um formulário já aberto, o formulário deve preservar carrinho e cliente e exigir revisão explícita, sem conversão silenciosa.

### Formas de pagamento

Os métodos nativos têm identidade estável. A tela permite ativação, método padrão e ordenação, mas não inventa CRUD para métodos que o domínio define como fechados.

- o método padrão precisa permanecer ativo;
- pelo menos um método deve continuar ativo;
- alterar ordem/status/padrão modifica o draft; o save é explícito;
- o menu de ações precisa continuar acessível em desktop e mobile sem ser recortado pelo contêiner da lista.

### Motivos de cancelamento

Motivos nativos preservam identidade/metadados protegidos. Itens customizados seguem as regras de histórico/uso definidas no catálogo e não podem ser recriados de forma que quebre referências existentes.

### Categorias financeiras

Categorias e grupos respeitam identidades reservadas/automáticas e histórico. Renomear, desativar ou excluir deve obedecer as restrições de uso e às assertions de revisão no mesmo batch da operação financeira quando aplicável.

### Impressão

Há três responsabilidades diferentes:

1. **Política do negócio** — defaults de vias para pedidos avulsos e mesas/comandas;
2. **Esta estação** — identidade/estado da estação, autoimpressão e estação principal;
3. **Impressora local/QZ** — fila Windows/QZ escolhida no dispositivo.

Alterar a política afeta somente novas solicitações. Jobs já criados preservam `copies_requested` e seu snapshot. Impressão de teste permanece sempre com uma via.

A estação Windows/QZ continua sendo a única executora física; celulares/tablets apenas enfileiram. Recovery e resultado desconhecido seguem o runbook de impressão e nunca devem duplicar automaticamente uma via sem confirmação correlacionada.

### Preferências do dispositivo

Tema Claro/Escuro/Automático e som são locais. Falha de armazenamento local não deve produzir mensagem de sucesso nem escrever configuração remota.

## Migrations da Spec B

### 0024 — business settings/policies

Cria/persiste os recursos tipados, catálogos e revisões necessários à Spec B. O rollout foi desenhado para ser forward-compatible e preservar dados/overrides existentes.

### 0025 — print context copies

Adiciona o contrato de cópias por contexto e preservação de snapshot/histórico de impressão. A migration precisa manter jobs históricos e suas referências intactos.

O gate específico `node scripts/infra/spec-b-d1-gate.mjs` valida em D1 local tanto instalação limpa quanto upgrade de 0024 para 0025, incluindo preservação de histórico e referências.

## Rollout

A ordem segura é:

1. obter backup/recovery point aplicável antes de produção;
2. executar gates completos no SHA exato;
3. aplicar migrations no ambiente alvo;
4. publicar o Worker/aplicação compatível;
5. forçar refresh/reload dos clientes quando necessário;
6. executar smoke test de leitura e dos recursos de Settings;
7. para produção, somente depois da homologação física de impressão por contexto.

Staging e produção não compartilham banco nem dados reais.

## Rollback

Não presumir que uma versão antiga do aplicativo é segura depois que usuários personalizaram catálogos ou passaram a criar jobs/comandas com política de 2 vias.

Preferência de recuperação:

1. interromper novas mudanças;
2. identificar se o problema é código, configuração ou dados;
3. aplicar correção adiante quando o schema novo já estiver em uso;
4. só redeployar código antigo após demonstrar compatibilidade com o schema/dados atuais;
5. para dados, usar o mecanismo de recuperação/backup aprovado do D1; não improvisar down-migration destrutiva.

## Checklist de staging

Antes de autorizar merge/release, registrar no SHA exato:

- `npm test`;
- `npm run lint`;
- `npm run build`;
- dry-run Worker produção e staging;
- migrations D1 locais;
- `node scripts/infra/spec-b-d1-gate.mjs`;
- deploy de staging com migrations e smoke de login;
- homologação visual/funcional das telas de Configurações;
- fluxos críticos de pedidos/comandas/financeiro afetados pelas políticas;
- matriz física de impressão descrita em `docs/superpowers/qa/2026-09-12-spec-b-physical-printing-guide.md` antes da release de produção.

## Segurança de release

Merge em `master` e deploy de produção são autorizações distintas. Um PR aprovado/merged não autoriza `Deploy production`. Produção só pode ser publicada por decisão explícita, a partir de `master`, depois de todos os bloqueios de release registrados terem sido resolvidos.
