# Checklist de aceitação — impressão centralizada MPT-II

Arquitetura: `dispositivo solicitante → Cloudflare/fila → PC Windows da cozinha → QZ Tray → fila Windows → USB → MPT-II`.

Dispositivos móveis e outras plataformas são somente solicitantes; apenas a estação principal Windows executa impressão física.

## Pré-requisitos

- [ ] PASS / FAIL — PC Windows autenticado, online e em HTTPS.
- [ ] PASS / FAIL — QZ Tray instalado, aberto e confiado.
- [ ] PASS / FAIL — MPT-II ligada, com papel 58 mm e USB conectado.
- [ ] PASS / FAIL — Fila `MPT-II` com `Generic / Text Only` e porta correta.
- [ ] PASS / FAIL — Segredos QZ corretos; chave privada ausente do cliente/Git/logs.

## Estação Windows/QZ

- [ ] PASS / FAIL — Tela identifica Windows e QZ Tray.
- [ ] PASS / FAIL — Fila encontrada e salva explicitamente.
- [ ] PASS / FAIL — Estados **Estação Online**, **QZ conectado**, **Fila encontrada** e **Pronta para enviar** são honestos.
- [ ] PASS / FAIL — Apenas a estação principal consome jobs automáticos.
- [ ] PASS / FAIL — Fila pode existir sem USB, sem ser considerada prova de saída física.

## Solicitação remota e vias

- [ ] PASS / FAIL — Celular/tablet cria e acompanha job sem executar impressão física.
- [ ] PASS / FAIL — Segunda via solicitada no celular chega à estação Windows.
- [ ] PASS / FAIL — Mesa/consumo local automático usa exatamente 1 via.
- [ ] PASS / FAIL — Delivery/Retirada respeitam regra central ou quantidade explícita.
- [ ] PASS / FAIL — Primeiro passe de 2 vias imprime `CÓPIA 1/2`.
- [ ] PASS / FAIL — **Imprimir 2ª via** imprime somente `CÓPIA 2/2` no mesmo job.
- [ ] PASS / FAIL — Refresh/foco/sincronização não criam terceira via.

## Falhas e recuperação

- [ ] PASS / FAIL — Pedido/job permanecem salvos offline.
- [ ] PASS / FAIL — Falha conhecida permite retry explícito, sem loop silencioso.
- [ ] PASS / FAIL — Resultado incerto vai para atenção.
- [ ] PASS / FAIL — Descarte preserva histórico.
- [ ] PASS / FAIL — Reprint cria job manual novo e preserva snapshot anterior.
- [ ] PASS / FAIL — Retorno do QZ/fila exige teste controlado antes de claims.
- [ ] PASS / FAIL — “Impresso” é entendido como envio aceito pelo QZ/Windows, não como confirmação de papel.

## Registro

**Modelo:**
**Versões Windows/QZ:**
**Data/responsável:**
**Observações:**

## Checkpoint preservado — Fase 9

- **Data:** 2026-09-09
- **Branch:** `feature/centralized-qz-print-queue`
- **Ambiente:** staging
- **Equipamento:** Windows + QZ Tray + fila MPT-II + USB
- **Resultado:** homologação física aprovada para automática, 1/2 vias, segunda via remota, Mesa de 1 via, offline/retorno, descarte, reprint e retry.

Este checkpoint não autoriza produção.
