# Spec B — release ledger

## 2026-09-15 — autorização de produção

**PR:** #42 — `Spec B: configurações, políticas e integração operacional`  
**Branch:** `feature/spec-b-settings-policies`  
**Base:** `master`  
**SHA funcional homologado:** `9381311a76d3ced64bd3dcb5074d7b7363b59554`

### Evidência antes da release

- Validate application #1146 (`35024215026`) — **SUCCESS**;
- Validate application #1147 (`35024219794`) — **SUCCESS**;
- Deploy staging #174 (`35024214926`) — **SUCCESS**;
- homologação manual/visual das telas finais — **PASS**;
- matriz física de impressão por contexto/1-2 vias — **PASS**, confirmada explicitamente pelo usuário em 15/09/2026;
- autorização explícita para homologar a Spec B e publicar em produção — **REGISTRADA**.

### Escopo da homologação física

O usuário confirmou ter testado integralmente os cenários relevantes, incluindo pedido/comanda com 1/2 vias, segunda via, afinidade de dois jobs, recovery/reconexão, impressão de teste, retry/reprint, política alterada com fila pendente e solicitação remota processada apenas pela estação principal.

Nenhuma falha foi reportada. A evidência documental não inventa IDs de jobs, fotografias ou capturas não fornecidas.

### Sequência de release autorizada

1. commit documental de encerramento;
2. gates finais do PR no novo SHA;
3. PR #42 pronto para review;
4. merge em `master`;
5. execução manual do workflow `Deploy production` em `master`;
6. confirmação de migrations, deploy e smoke real de login;
7. registro final do SHA de merge e run de produção.

### Estado

**AUTORIZADO PARA RELEASE — execução de produção ainda não registrada neste ponto do ledger.**
