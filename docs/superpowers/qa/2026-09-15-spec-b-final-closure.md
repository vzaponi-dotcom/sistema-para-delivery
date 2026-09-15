# Spec B — fechamento final de QA

**Branch:** `feature/spec-b-settings-policies`  
**Base de integração:** `master` em `8d2f897154526037606e9fee60f4b9a606089e8a`  
**SHA funcional final homologado:** `9381311a76d3ced64bd3dcb5074d7b7363b59554`  
**Status:** **QA FINAL APROVADO / RELEASE AUTORIZADA** em 15/09/2026. A execução de produção continua condicionada ao merge em `master` e ao sucesso do workflow oficial `Deploy production`.

## Escopo entregue

A Spec B centraliza e versiona as políticas de negócio e respectivos editores:

- tempos e modalidades de operação;
- formas de pagamento, padrão, ativação e ordenação;
- motivos de cancelamento;
- categorias financeiras;
- política de impressão por contexto e configuração de estação;
- preferências locais de tema e som;
- drafts, descarte, revisão otimista, conflitos e reconciliação de resultado incerto;
- consumo da configuração efetiva nos fluxos de pedidos, cozinha, comandas, impressão e financeiro;
- refinamentos de UI/UX homologados em Configurações e Comandas.

As migrations da Spec B são `0024_business_settings_policies.sql` e `0025_print_context_copies.sql`.

## Evidência automatizada no SHA funcional final

No SHA `9381311a76d3ced64bd3dcb5074d7b7363b59554`:

- **Validate application #1146** (`35024215026`) — SUCCESS;
- **Validate application #1147** (`35024219794`) — SUCCESS;
- **Deploy staging #174** (`35024214926`) — SUCCESS;
- testes, lint e build — SUCCESS;
- dry-run dos Workers de produção/staging — SUCCESS;
- migrations D1 locais — SUCCESS;
- gate D1 da Spec B (clean install + upgrade) — SUCCESS;
- migrations remotas de staging, deploy e smoke real de login — SUCCESS.

## Homologação manual/visual

O usuário homologou em staging as telas e correções finais da Spec B, incluindo:

- Operação/Modalidades;
- Formas de pagamento, reorder, padrão, ativação e estados visuais;
- Motivos de cancelamento;
- Categorias financeiras, incluindo persistência da nova ordenação;
- feedback de save sem alterações;
- Configurações de impressão;
- Comandas em desktop/mobile e seus refinamentos finais.

## Homologação física de impressão

Em 15/09/2026, o usuário informou ter executado **toda a matriz física relevante** e confirmou funcionamento correto.

Foram homologados os cenários de 1/2 vias, pedido/comanda, confirmação/dispensa de segunda via, dois jobs com afinidade do job atual, recovery/reconexão, impressão de teste, retry/reprint, alteração de política com fila pendente e solicitação remota executada pela estação principal.

A pendência física anteriormente registrada está **encerrada**. O documento canônico é `docs/superpowers/qa/2026-09-12-spec-b-physical-printing-guide.md`.

## Migrations e compatibilidade

### 0024

Persiste configurações/políticas tipadas e catálogos com revisão, preservando histórico e identidades necessárias para uso operacional.

### 0025

Adiciona política/snapshot de vias por contexto e amplia o suporte de 1/2 vias preservando jobs/tentativas/relações históricas.

Depois que 0024/0025 estiverem em uso, não presumir compatibilidade de binário antigo com novos dados. Preferir correção adiante; rollback de dados deve usar backup/recovery aprovado do D1.

## Decisão de release

Todos os bloqueios conhecidos da Spec B foram encerrados para fins de release:

- aplicação/UX homologadas — **PASS**;
- gates automatizados — **PASS**;
- staging — **PASS**;
- impressão física — **PASS**;
- autorização explícita do usuário para produção — **PASS**.

A sequência autorizada é:

1. registrar este fechamento documental;
2. rodar/confirmar gates finais após o commit documental;
3. marcar o PR #42 como pronto;
4. merge em `master`;
5. executar `Deploy production` a partir de `master`;
6. exigir sucesso de testes/lint/build/dry-run/migrations/deploy/smoke de login;
7. registrar SHA de merge e run de produção no ledger de release.

Um commit exclusivamente documental após o SHA funcional `9381311...` não altera a aplicação homologada; qualquer mudança executável posterior exige nova validação proporcional antes da release.
