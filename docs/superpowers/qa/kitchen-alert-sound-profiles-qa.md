# Kitchen alert sound profiles — QA / Closure

**Data:** 24/09/2026  
**PR:** #69  
**Branch:** `feature/kitchen-alert-sound-profiles`  
**Base:** `master@b82406e41ac62560d6ed61acb31c4b18a53d30ae`  
**SHA homologado antes do fechamento documental:** `39e8ca3a065d2d228e7d227be9f3c3e3ced7dfa5`  
**Produção:** NÃO DEPLOYADA neste fechamento  
**Merge:** PENDENTE do Validate documental final

## Resultado

A melhoria de alertas sonoros configuráveis foi homologada manualmente em staging pelo responsável do produto.

Resultado manual final:

- **20 PASS**
- **0 FAIL**
- **0 BLOCKED**
- **0 PENDING**

## Evidência automatizada

### RED inicial

- HEAD: `beaa7f02bf9c38c30a4f8ba2a1320aca5e40c5b2`
- Validate #2004 / run `36059234744`
- resultado: **FAILURE esperada**
- motivo: catálogo/player ainda não existiam.

### GREEN executável

- SHA: `37d7bfdb1a24f47e0b43200a5ca5a62e0858f0f8`
- Validate #2025 / run `36060230100` — **SUCCESS**

### GREEN final pré-homologação

- SHA: `39e8ca3a065d2d228e7d227be9f3c3e3ced7dfa5`
- Validate #2026 / run `36060515094` — **SUCCESS**
- 8/8 shards ✅
- architecture ✅
- lint ✅
- build ✅
- Worker production dry-run ✅
- Worker staging dry-run ✅
- D1/gates existentes ✅

## Staging homologado

Deploy staging #296 / run `36060510151` — **SUCCESS**.

- SHA: `39e8ca3a065d2d228e7d227be9f3c3e3ced7dfa5`
- Worker Version ID: `ee796607-6e0a-41b6-b788-cdc91e1c6b1c`
- staging login: HTTP 200
- deep link `/cozinha-tv`: HTTP 200 / SPA shell + assets
- R2 staging: confirmado
- migrations remotas: nenhuma pendente

## Matriz manual

| # | Caso | Resultado |
|---:|---|---|
| 1 | Desktop/mobile — Campainha pode ser ouvida na prévia | PASS |
| 2 | Desktop/mobile — Cozinha forte pode ser ouvida na prévia | PASS |
| 3 | Desktop/mobile — Duplo alerta pode ser ouvido na prévia | PASS |
| 4 | Desktop/mobile — Chamado longo pode ser ouvido na prévia | PASS |
| 5 | Desktop/mobile — Clássico pode ser ouvido na prévia | PASS |
| 6 | Desktop/mobile — seleção do perfil de som funciona | PASS |
| 7 | Desktop/mobile — volumes Normal / Alto / Máximo funcionam | PASS |
| 8 | Desktop/mobile — perfil selecionado persiste após F5 | PASS |
| 9 | Desktop/mobile — volume selecionado persiste após F5 | PASS |
| 10 | Desktop/mobile — chegada real de novo pedido toca uma vez com o perfil escolhido | PASS |
| 11 | Kitchen TV moderna — seleção de perfil funciona | PASS |
| 12 | Kitchen TV moderna — prévia funciona | PASS |
| 13 | Kitchen TV moderna — seleção de volume funciona | PASS |
| 14 | Kitchen TV moderna — Iniciar painel continua funcional | PASS |
| 15 | Kitchen TV moderna — fullscreen continua funcional | PASS |
| 16 | Kitchen TV moderna — novo pedido toca o alerta configurado | PASS |
| 17 | Samsung UN32T4300AG / Tizen legado — pareamento e tela pronta continuam funcionais | PASS |
| 18 | Samsung UN32T4300AG / Tizen legado — seleção, prévia e volume funcionam | PASS |
| 19 | Samsung UN32T4300AG / Tizen legado — iniciar painel/fullscreen e renderização continuam funcionais | PASS |
| 20 | Samsung UN32T4300AG / Tizen legado — chegada de novo pedido toca o alerta configurado | PASS |

## Invariantes confirmados

- nenhum pacote externo de áudio foi adicionado;
- `kitchen-sound-enabled` foi preservado;
- perfil e volume permanecem preferências locais por navegador/dispositivo;
- polling de pedidos não foi alterado;
- regras de chegada operacional não foram alteradas;
- API, D1, capabilities, pareamento e timing não foram alterados;
- Kitchen TV continua no target legado `chrome69`;
- bundle da TV continua isolado do Admin;
- bloqueio de áudio não quebra o painel;
- uma chegada gera uma execução do alerta; o perfil pode conter várias batidas internas sem repetição infinita.

## Gate de merge

Homologação manual: **APROVADA** em 24/09/2026.

O responsável do produto confirmou explicitamente que todos os testes solicitados passaram, incluindo a Samsung/Tizen legado.

Após este commit documental:

1. executar/aguardar Validate no SHA final;
2. se SUCCESS, tirar a PR de DRAFT;
3. mergear em `master`;
4. verificar Validate pós-merge;
5. produção permanece uma etapa separada.
