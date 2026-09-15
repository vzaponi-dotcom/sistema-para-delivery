# Spec B — fechamento final de QA

**Branch de origem:** `feature/spec-b-settings-policies`  
**SHA funcional final homologado:** `9381311a76d3ced64bd3dcb5074d7b7363b59554`  
**Commit documental pré-release:** `ee6788176d4f36688a6e9c6f82ee15452dee299f`  
**SHA de merge publicado:** `34897334d74fe6019ab170d4f52c10e8f3d421b8`  
**Status:** **QA FINAL APROVADO / RELEASE DE PRODUÇÃO CONCLUÍDA** em 15/09/2026.

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

## Evidência automatizada

No SHA funcional `9381311...`:

- Validate application #1146 — **SUCCESS**;
- Validate application #1147 — **SUCCESS**;
- Deploy staging #174 — **SUCCESS**.

No commit documental `ee678817...`:

- Validate application #1148 — **SUCCESS**;
- Validate application #1149 — **SUCCESS**;
- Deploy staging #175 — **SUCCESS**.

Após o merge em `master`:

- Validate application #1150 (`35036060895`) no SHA `34897334...` — **SUCCESS**.

Os gates cobriram testes, lint, build, dry-runs dos Workers, migrations D1 locais e gate dedicado da Spec B; staging confirmou migrations remotas, deploy e smoke real de login.

## Homologação manual/visual

O usuário homologou em staging as telas e correções finais da Spec B, incluindo Operação/Modalidades, Formas de pagamento, Motivos de cancelamento, Categorias financeiras, feedback de save sem alterações, Configurações de impressão e Comandas em desktop/mobile.

## Homologação física de impressão

Em 15/09/2026, o usuário informou ter executado toda a matriz física relevante e confirmou funcionamento correto.

Foram homologados os cenários de 1/2 vias, pedido/comanda, confirmação/dispensa de segunda via, dois jobs com afinidade do job atual, recovery/reconexão, impressão de teste, retry/reprint, alteração de política com fila pendente e solicitação remota executada pela estação principal.

A pendência física está encerrada. O documento canônico é `docs/superpowers/qa/2026-09-12-spec-b-physical-printing-guide.md`.

## Produção

O PR #42 foi mergeado em `master` no SHA `34897334d74fe6019ab170d4f52c10e8f3d421b8`.

O workflow manual **Deploy production #48** (`35036339956`) foi executado a partir desse SHA e terminou **SUCCESS**. O job confirmou:

- testes, lint e build;
- dry-run do Worker;
- migrations D1 locais e remotas de produção;
- verificação de credenciais;
- configuração/verificação do PIN;
- deploy do Worker;
- smoke real de login em produção.

Produção publicada em `https://sistema-para-delivery.vzaponi.workers.dev`.

## Migrations e compatibilidade

### 0024

Persiste configurações/políticas tipadas e catálogos com revisão, preservando histórico e identidades necessárias para uso operacional.

### 0025

Adiciona política/snapshot de vias por contexto e amplia o suporte de 1/2 vias preservando jobs/tentativas/relações históricas.

Depois que 0024/0025 estão em uso, não presumir compatibilidade de binário antigo com novos dados. Preferir correção adiante; rollback de dados deve usar backup/recovery aprovado do D1.

## Estado de encerramento

- aplicação/UX homologadas — **PASS**;
- gates automatizados — **PASS**;
- staging — **PASS**;
- impressão física — **PASS**;
- merge em `master` — **PASS**;
- validação pós-merge — **PASS**;
- migrations de produção — **PASS**;
- deploy de produção — **PASS**;
- smoke real de login — **PASS**.

**A Spec B está encerrada e publicada em produção.**

O SHA efetivamente publicado é `34897334d74fe6019ab170d4f52c10e8f3d421b8`. Commits posteriores exclusivamente documentais não representam um novo artefato de produção.
