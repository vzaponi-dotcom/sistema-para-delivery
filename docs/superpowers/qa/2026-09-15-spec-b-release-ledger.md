# Spec B — release ledger

## 2026-09-15 — release de produção concluída

**PR:** #42 — `Spec B: configurações, políticas e integração operacional`  
**Branch de origem:** `feature/spec-b-settings-policies`  
**SHA funcional homologado:** `9381311a76d3ced64bd3dcb5074d7b7363b59554`  
**Commit documental pré-release:** `ee6788176d4f36688a6e9c6f82ee15452dee299f`  
**SHA de merge publicado:** `34897334d74fe6019ab170d4f52c10e8f3d421b8`  
**Produção:** `https://sistema-para-delivery.vzaponi.workers.dev`

### Evidência antes da release

- Validate application #1146 (`35024215026`) — **SUCCESS**;
- Validate application #1147 (`35024219794`) — **SUCCESS**;
- Deploy staging #174 (`35024214926`) — **SUCCESS**;
- homologação manual/visual das telas finais — **PASS**;
- matriz física de impressão por contexto/1-2 vias — **PASS**, confirmada explicitamente pelo usuário em 15/09/2026;
- commit documental de encerramento — `ee678817...`, contendo apenas QA/documentação;
- Validate application #1148 (`35035835097`) — **SUCCESS**;
- Validate application #1149 (`35035838713`) — **SUCCESS**;
- Deploy staging #175 (`35035835023`) — **SUCCESS**;
- merge do PR #42 em `master` — `34897334d74fe6019ab170d4f52c10e8f3d421b8`;
- Validate application #1150 em `master` (`35036060895`) — **SUCCESS**.

### Homologação física

O usuário confirmou a execução integral dos cenários relevantes de impressão física, incluindo pedido/comanda com 1/2 vias, segunda via, afinidade de dois jobs, recovery/reconexão, impressão de teste, retry/reprint, política alterada com fila pendente e solicitação remota processada apenas pela estação principal.

Nenhuma falha foi reportada. A evidência documental registra a declaração explícita do operador e não inventa IDs de jobs, fotografias ou capturas não fornecidas.

### Deploy production

**Workflow:** Deploy production #48  
**Run ID:** `35036339956`  
**Evento:** `workflow_dispatch`  
**Branch:** `master`  
**Head SHA:** `34897334d74fe6019ab170d4f52c10e8f3d421b8`  
**Resultado:** **SUCCESS**  
**Início:** 15/09/2026 23:35:23 UTC  
**Conclusão:** 15/09/2026 23:37:30 UTC

Etapas confirmadas com sucesso no job `Deploy Cloudflare Worker`:

- checkout de `master`;
- instalação de dependências;
- testes;
- lint;
- build;
- dry-run do Worker;
- migrations D1 locais;
- verificação de credenciais Cloudflare;
- listagem de migrations pendentes;
- aplicação de migrations D1 remotas de produção;
- configuração do PIN quando fornecido;
- verificação da linha do PIN em produção;
- deploy;
- smoke real de login com o PIN configurado.

### Estado final

**RELEASE DA SPEC B CONCLUÍDA EM PRODUÇÃO — PASS.**

O artefato publicado corresponde ao SHA `34897334d74fe6019ab170d4f52c10e8f3d421b8`. Qualquer commit documental criado depois desta publicação não altera o binário em produção e não deve ser confundido com um novo deploy.
