# Checklist de aceitação — impressão centralizada MPT-II confirmada

Arquitetura: `dispositivo solicitante → Cloudflare/fila → PC Windows da cozinha → QZ Tray → fila Windows → USB → MPT-II`.

Dispositivos móveis apenas solicitam e acompanham jobs. A estação principal Windows é a única que executa vias físicas. Marque cada cenário como PASS ou FAIL e registre a evidência antes de liberar a operação.

## Pré-requisitos

- [ ] PASS / FAIL — PC Windows autenticado, online e usando HTTPS.
- [ ] PASS / FAIL — QZ Tray instalado, aberto e confiado para o ambiente.
- [ ] PASS / FAIL — MPT-II ligada, com papel de 58 mm, USB conectado, driver `Generic / Text Only` e porta correta.
- [ ] PASS / FAIL — A fila `MPT-II` foi selecionada explicitamente e uma impressão direta pelo Windows foi validada.
- [ ] PASS / FAIL — Segredos QZ corretos; chave privada ausente do cliente, D1, bundle, Git e logs.

## Gate físico e confirmação

- [ ] PASS / FAIL — Descobrir a fila e conectar o QZ não é apresentado como prontidão física.
- [ ] PASS / FAIL — Somente `PRINTER OK` permite iniciar uma via.
- [ ] PASS / FAIL — Com a impressora desligada antes de um novo job, `PRINTER OFFLINE` impede claim e envio da via.
- [ ] PASS / FAIL — `JOB COMPLETE` correlacionado conta exatamente uma via; a resolução de `qz.print()` não é tratada como sucesso final.
- [ ] PASS / FAIL — `SPOOLING` sem `COMPLETE` permanece pendente de observação, pois pode imprimir depois; não ocorre reenvio automático.
- [ ] PASS / FAIL — A interface explica que `COMPLETE` do Winspool é a confirmação operacional mais forte, não um sensor independente de papel.

## Recuperação após indisponibilidade

- [ ] PASS / FAIL — Uma transição real `OFFLINE`→`OK` com backlog seguro abre o prompt de recuperação apenas uma vez.
- [ ] PASS / FAIL — Recarregar, focar a página ou receber novo heartbeat enquanto a recuperação já está pendente não duplica o prompt.
- [ ] PASS / FAIL — Cada clique em **Imprimir agora** ou **Imprimir próxima** recupera somente uma via segura.
- [ ] PASS / FAIL — Depois de uma via, nenhuma próxima via é enviada sem nova ação explícita.
- [ ] PASS / FAIL — **Parar por agora** deixa a recuperação adiada e mantém o consumidor automático normal pausado.
- [ ] PASS / FAIL — Um job retido em `SPOOLING` volta a poder concluir/imprimir uma vez após reconectar; não é reenviado automaticamente.
- [ ] PASS / FAIL — Perda de observação/conexão após submissão não aciona retry automático nem descarta o job.

## Resultado desconhecido, vias e reimpressão

- [ ] PASS / FAIL — Via submetida sem confirmação aparece como **Aguardando confirmação**, sem nova via automática.
- [ ] PASS / FAIL — Resultado desconhecido permite uma única resolução manual **A via foi impressa**, que contabiliza a via sem reenvio.
- [ ] PASS / FAIL — Resultado desconhecido permite **Não foi impressa — reenviar** somente após aviso explícito de risco de duplicidade; o reenvio é manual.
- [ ] PASS / FAIL — Mesa/consumo local automático usa exatamente uma via.
- [ ] PASS / FAIL — Delivery/Retirada respeitam regra central ou quantidade explícita; duas vias mostram `CÓPIA 1/2` e `CÓPIA 2/2`.
- [ ] PASS / FAIL — **Imprimir 2ª via** envia somente a segunda via no mesmo job; refresh/foco/sincronização não cria terceira via.
- [ ] PASS / FAIL — Reimpressão histórica cria um job manual novo quando o job terminal antigo já foi removido e mantém o vínculo de auditoria quando ele ainda existe.

## Painel operacional, retenção e responsividade

- [ ] PASS / FAIL — A fila operacional pagina 10 jobs por página e mantém ordenação estável ao trocar página, filtro, busca ou coluna.
- [ ] PASS / FAIL — Os filtros **Impresso** e **Descartado** mostram jobs terminais na tabela principal com paginação, busca e ordenação; não existe painel separado de impressões recentes.
- [ ] PASS / FAIL — Cleanup após 30 dias remove somente jobs terminais seguros, preserva pedidos históricos e não remove jobs submetidos, desconhecidos ou ainda ativos.
- [ ] PASS / FAIL — Em desktop, tabela e indicadores de ordenação mostram pedido, job, estado, origem e horário corretamente.
- [ ] PASS / FAIL — Em mobile, os cards mostram a mesma página/identidade/estado/origem/vias/horário e todas as ações continuam utilizáveis.

## Registro

**Modelo da impressora:**

**Versões Windows/QZ:**

**Data e responsável:**

**Jobs/cenários observados:**

**Observações e evidências:**

Este checklist não autoriza deploy de produção por si só. A liberação exige o processo de staging e aprovação humana aplicáveis.
