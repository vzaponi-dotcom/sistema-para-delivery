# Spec B — fechamento final de QA

**Branch:** `feature/spec-b-settings-policies`  
**Base de integração:** `master` em `8d2f897154526037606e9fee60f4b9a606089e8a`  
**SHA funcional homologado antes do fechamento documental:** `7c6de7422d4693a9bee34422ff100d155a42af4f`  
**Status:** aplicação e telas de Configurações homologadas em staging; PR pode ser preparado, mas a release de produção continua separada.

## Escopo entregue

A Spec B centraliza e versiona as políticas de negócio e respectivos editores:

- tempos e modalidades de operação;
- formas de pagamento, padrão, ativação e ordenação;
- motivos de cancelamento;
- categorias financeiras;
- política de impressão por contexto e configuração de estação;
- preferências locais de tema e som;
- drafts, descarte, revisão otimista, conflitos e reconciliação de resultado incerto;
- consumo da configuração efetiva nos fluxos de pedidos, cozinha, comandas, impressão e financeiro.

As migrations da Spec B são `0024_business_settings_policies.sql` e `0025_print_context_copies.sql`.

## Evidência automatizada no SHA funcional homologado

No SHA `7c6de7422d4693a9bee34422ff100d155a42af4f`:

- **Validate application #1106** (`34989572799`) — SUCCESS;
- `npm test` — SUCCESS;
- lint — SUCCESS;
- build — SUCCESS;
- dry-run do Worker de produção — SUCCESS;
- dry-run do Worker de staging — SUCCESS;
- migrations D1 locais — SUCCESS;
- **Deploy staging #150** (`34989572808`) — SUCCESS;
- migrations remotas de staging — SUCCESS;
- deploy do Worker de staging — SUCCESS;
- smoke de login em staging — SUCCESS.

O checkpoint T23A também eliminou as falhas históricas de infraestrutura/fixtures que impediam confiar no agregado: a suíte integral daquele checkpoint passou **1514/1514**, sem defeito de produção confirmado.

## Homologação manual/visual

O usuário homologou em staging as telas de Configurações implementadas na Spec B e as correções finais desta rodada.

Pontos finais explicitamente validados durante a homologação:

- **Formas de pagamento:** desktop e mobile; cards/linhas compactados; alinhamento vertical; coluna Padrão sem traços em itens não padrão; menu de três pontos não recortado; fechamento do menu após ações; estado inativo visualmente atenuado;
- **Motivos de cancelamento:** menu de ações sem recorte no desktop;
- **Categorias financeiras:** menu de ações sem recorte no desktop;
- **Comandas:** redesign responsivo homologado em staging, incluindo densidade mobile/desktop e correção do rótulo `COMANDA` em uma linha.

As demais telas de Configurações já haviam sido reportadas como implementadas e testadas antes desta rodada final.

## Migrations e compatibilidade

### 0024

Persiste configurações/políticas tipadas e catálogos com revisão. O desenho preserva histórico e identidades necessárias para uso operacional.

### 0025

Adiciona política/snapshot de vias por contexto de impressão. Jobs existentes precisam conservar `copies_requested`, identidade e histórico quando a política muda.

O gate dedicado `node scripts/infra/spec-b-d1-gate.mjs` é obrigatório no fechamento e valida instalação limpa e upgrade local real de 0024 → 0025 com Wrangler/D1.

## Rollout e rollback

A ordem de produção deve permanecer migrations → aplicação → refresh/smoke. Produção não é autorizada por merge.

Depois que 0024/0025 estiverem em uso e houver personalizações/jobs com duas vias, não presumir que um binário anterior seja compatível. Preferir correção adiante; rollback de código exige prova de compatibilidade com o schema/dados atuais. Rollback de dados usa o mecanismo aprovado de backup/recovery do D1, não down-migration improvisada.

## Pendência física de impressão

A infraestrutura QZ/fila/impressora possui homologações físicas anteriores no projeto, porém **não existe neste repositório evidência de que a matriz completa da nova política de impressão por contexto da Spec B tenha sido executada no mesmo SHA atual**.

Portanto:

- isso **não impede preparar o PR** nem revisar/integrar código sem publicar produção;
- a matriz `docs/superpowers/qa/2026-09-12-spec-b-physical-printing-guide.md` continua sendo bloqueio explícito para autorizar o **Deploy production** da Spec B;
- nenhuma evidência física será inferida por herança de SHA ou por testes automatizados.

## Fechamento documental

Este documento é o registro de fechamento atual e supersede, para status de release, os marcadores `PENDING` históricos de T22 no arquivo `2026-09-12-spec-b-acceptance.md`. O ledger de execução permanece como histórico cronológico das rodadas anteriores.

Após este commit documental, os gates completos devem rodar novamente no SHA final. O PR para `master` deve ser criado sem merge automático e sem deploy de produção.
