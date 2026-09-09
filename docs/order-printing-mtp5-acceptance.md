# Aceitação da impressão de pedidos — 58 mm ESC/POS

Este checklist valida a impressão física do Ticket Oficial do Gestão Delivery nos transportes suportados pela V1: **Windows + Web Serial** e **Android + RawBT**. O perfil térmico inicial usa 58 mm, 48 mm imprimíveis, 384 pontos por linha e 203 dpi. A unidade Android de homologação atual é a **MPT-II**; o perfil Windows original foi criado para a Goldensky MTP5.

A aprovação de software não substitui estes testes físicos. Marque cada item como `PASS` ou `FAIL` e registre observações, especialmente hardware, versão do navegador, driver e comportamento real da impressora.

## Pré-requisitos

- [ ] PASS [ ] FAIL — Impressora carregada, com bobina térmica 58 mm instalada corretamente.
- [ ] PASS [ ] FAIL — Dispositivo com Bluetooth habilitado.
- [ ] PASS [ ] FAIL — Aplicação Gestão Delivery aberta em conexão HTTPS.
- [ ] PASS [ ] FAIL — Usuário autenticado no Gestão Delivery.
- [ ] PASS [ ] FAIL — Perfil físico configurado para 203 dpi e 384 pontos quando aplicável.

**Modelo da impressora:**

**Observações:**

---

## Windows + Chrome / Web Serial

- [ ] PASS [ ] FAIL — Windows reconhece a impressora após o pareamento Bluetooth.
- [ ] PASS [ ] FAIL — Chrome atual oferece a seleção da porta serial Bluetooth da impressora.
- [ ] PASS [ ] FAIL — Após autorização inicial, o navegador consegue reutilizar a porta autorizada nas próximas sessões.
- [ ] PASS [ ] FAIL — **Pedidos > Impressão** mostra **Driver: Web Serial**.
- [ ] PASS [ ] FAIL — Fechar/reabrir a tela não cria impressão duplicada.

**Versão do Windows:**

**Versão do Chrome:**

**Observações:**

---

## Android + Chrome / RawBT

1. Pareie a MPT-II nas configurações Bluetooth do Android.
2. Abra o RawBT e selecione a `MPT-II_3072` ou o nome correspondente da unidade física.
3. Configure **203 dpi** e **384 pontos** de largura.
4. Confirme que o teste interno do RawBT imprime antes de testar o Gestão Delivery.
5. Abra o Gestão Delivery no Chrome.

- [ ] PASS [ ] FAIL — Android reconhece a MPT-II após o pareamento Bluetooth.
- [ ] PASS [ ] FAIL — RawBT reconhece a MPT-II e imprime o teste próprio.
- [ ] PASS [ ] FAIL — RawBT está configurado em 203 dpi e 384 pontos.
- [ ] PASS [ ] FAIL — **Pedidos > Impressão** mostra **Plataforma: Android**.
- [ ] PASS [ ] FAIL — **Pedidos > Impressão** mostra **Driver: RawBT** e **RawBT pronto**.
- [ ] PASS [ ] FAIL — O Android não abre o seletor Web Serial ao usar o fluxo RawBT.
- [ ] PASS [ ] FAIL — Bloquear/desbloquear ou alternar de aplicativo não cria cópia duplicada por si só.

`RawBT pronto` confirma somente a escolha do driver pelo Gestão Delivery. Não confirma que a impressora está ligada, conectada ou que o papel saiu.

**Modelo/versão do Android:**

**Versão do Chrome:**

**Versão do RawBT:**

**Nome da impressora no RawBT:**

**Observações:**

---

## Pareamento da impressora

1. Ligue a impressora.
2. Abra as configurações Bluetooth do sistema operacional.
3. Localize a impressora e conclua o pareamento.
4. Se o sistema solicitar PIN, use somente a informação fornecida pelo fabricante/dispositivo; o Gestão Delivery não armazena PIN de pareamento.

- [ ] PASS [ ] FAIL — Pareamento concluído no sistema operacional.
- [ ] PASS [ ] FAIL — Impressora permanece disponível depois de desligar e ligar novamente o Bluetooth.

**Nome exibido pelo sistema:**

**Observações:**

---

## Configurar o Gestão Delivery

### Windows

1. Abra **Pedidos > Impressão**.
2. Clique em **Conectar impressora**.
3. Selecione a impressora no seletor do navegador.
4. Confirme o estado **Conectada**.
5. Configure 1 ou 2 cópias.

- [ ] PASS [ ] FAIL — O seletor Web Serial é aberto apenas por ação explícita do usuário.
- [ ] PASS [ ] FAIL — A impressora correta pode ser selecionada.
- [ ] PASS [ ] FAIL — A tela exibe **Conectada** após a verificação da porta.

### Android / RawBT

1. Abra **Pedidos > Impressão**.
2. Confirme **Driver: RawBT** e **RawBT pronto**.
3. Não procure um botão de conexão Web Serial: a seleção da impressora fica no RawBT.
4. Configure 1 ou 2 cópias.

- [ ] PASS [ ] FAIL — Não aparece o fluxo **Conectar impressora** do Web Serial no Android.
- [ ] PASS [ ] FAIL — A tela orienta configurar a MPT-II no RawBT antes do teste.
- [ ] PASS [ ] FAIL — A estação e o número de cópias continuam configuráveis normalmente.

### Ambos

- [ ] PASS [ ] FAIL — A estação principal fica identificada corretamente.
- [ ] PASS [ ] FAIL — Apenas valores de 1 ou 2 cópias podem ser configurados.
- [ ] PASS [ ] FAIL — Impressão automática permanece desligada até a impressão manual ser aprovada.

**Observações:**

---

## Teste de 1 cópia

1. Configure **1 cópia**.
2. Execute **Testar impressão**.
3. Faça uma impressão manual de um pedido de teste autorizado.

- [ ] PASS [ ] FAIL — Sai exatamente uma cópia física.
- [ ] PASS [ ] FAIL — Pedido, itens, valores, pagamento e mensagem final estão legíveis.
- [ ] PASS [ ] FAIL — O papel avança o suficiente para destacar manualmente o ticket.
- [ ] PASS [ ] FAIL — No Windows, o trabalho é registrado após a escrita serial concluir sem erro.
- [ ] PASS [ ] FAIL — No Android, o RawBT recebe o ticket do Gestão Delivery e a MPT-II o imprime fisicamente.

**Observações:**

---

## Teste de 2 cópias

1. Configure **2 cópias**.
2. Imprima um pedido.

- [ ] PASS [ ] FAIL — Saem exatamente duas cópias físicas.
- [ ] PASS [ ] FAIL — As duas cópias possuem o mesmo conteúdo operacional/financeiro.
- [ ] PASS [ ] FAIL — A primeira mostra `CÓPIA 1/2` e a segunda `CÓPIA 2/2`.
- [ ] PASS [ ] FAIL — O número do pedido aparece novamente no rodapé.
- [ ] PASS [ ] FAIL — Não é enviada terceira cópia após refresh, foco ou sincronização.

**Observações:**

---

## Acentos e CP860

Use um pedido contendo, por exemplo: `João`, `Açúcar`, `Coração`, `Pão`, `Café`, `Observação`.

- [ ] PASS [ ] FAIL — `ã`, `á`, `é`, `ç`, `õ` e outros caracteres portugueses são impressos corretamente.
- [ ] PASS [ ] FAIL — Não aparecem símbolos corrompidos no lugar dos acentos.
- [ ] PASS [ ] FAIL — A seleção atual CP860 / `ESC t 3` é compatível com a unidade física.

**Se falhar, caracteres afetados:**

**Observações:**

> A compatibilidade física é a autoridade final. Se a unidade usar outro mapeamento de página de código, a correção deve ficar isolada no perfil/encoder da impressora.

---

## Pedido longo e quebra de linha

Crie um pedido com nome de produto longo, vários complementos/itens, observações extensas e endereço de entrega longo.

- [ ] PASS [ ] FAIL — Nenhuma linha normal ultrapassa a largura útil do papel.
- [ ] PASS [ ] FAIL — Nomes e observações quebram em linhas legíveis.
- [ ] PASS [ ] FAIL — Quantidades continuam fáceis de identificar.
- [ ] PASS [ ] FAIL — Total e pagamento continuam visualmente destacados.
- [ ] PASS [ ] FAIL — Nenhum texto importante é cortado na lateral.

**Observações:**

---

## Impressora desligada

### Windows / Web Serial

1. Deixe a estação ativa e autorizada.
2. Desligue a impressora.
3. Execute uma impressão manual controlada.

- [ ] PASS [ ] FAIL — O pedido continua salvo e utilizável independentemente da impressão.
- [ ] PASS [ ] FAIL — A interface informa falha/desconexão de forma clara.
- [ ] PASS [ ] FAIL — Não existe loop de tentativas automáticas.
- [ ] PASS [ ] FAIL — Novos claims automáticos ficam bloqueados localmente após falha de conexão conhecida.
- [ ] PASS [ ] FAIL — Reconectar/testar com sucesso libera novamente a estação.

### Android / RawBT

- [ ] PASS [ ] FAIL — Desligar a MPT-II não altera nem perde o pedido salvo.
- [ ] PASS [ ] FAIL — O comportamento do RawBT quando a impressora está indisponível fica visível ao operador.
- [ ] PASS [ ] FAIL — O operador não interpreta **RawBT pronto** como confirmação física da impressora.
- [ ] PASS [ ] FAIL — Não ocorre sequência de cópias duplicadas após religar a impressora.

**Observações:**

---

## Impressão automática no Android / RawBT

Este é um **gate físico obrigatório** porque o disparo parte de um job em segundo plano do Gestão Delivery, sem toque direto no botão de impressão. O Chrome/Android pode restringir a abertura de aplicativo externo sem gesto do usuário.

1. Aprove primeiro a impressão manual.
2. Torne o Android a estação principal.
3. Ative a impressão automática.
4. Mantenha o Gestão Delivery visível no Chrome.
5. Crie **um único pedido de teste**.

- [ ] PASS [ ] FAIL — O novo pedido gera no máximo um job automático.
- [ ] PASS [ ] FAIL — RawBT é aberto/acionado automaticamente pelo Chrome.
- [ ] PASS [ ] FAIL — Sai exatamente a quantidade configurada de cópias.
- [ ] PASS [ ] FAIL — Atualizar a página ou voltar do RawBT não imprime o mesmo pedido novamente.
- [ ] PASS [ ] FAIL — Se o Chrome bloquear a abertura automática do RawBT, a plataforma **não** é marcada como aprovada para autoimpressão.

**Observações:**

---

## Queda durante escrita / resultado incerto — Web Serial

Este teste se aplica ao transporte Web Serial. Faça apenas em ambiente controlado.

- [ ] PASS [ ] FAIL — O trabalho fica em **Requer atenção** quando o resultado físico não pode ser conhecido com segurança.
- [ ] PASS [ ] FAIL — O sistema não assume automaticamente que nada foi impresso.
- [ ] PASS [ ] FAIL — O sistema não dispara nova tentativa silenciosa.
- [ ] PASS [ ] FAIL — A ação **Imprimir agora** exige intervenção explícita do operador.

**Observações:**

---

## Retomada manual sem duplicidade

- [ ] PASS [ ] FAIL — Um job com falha conhecida usa **Tentar novamente** no mesmo job/snapshot.
- [ ] PASS [ ] FAIL — Um pedido já impresso usa **Reimprimir** e solicita confirmação.
- [ ] PASS [ ] FAIL — A confirmação informa corretamente se serão 1 ou 2 cópias.
- [ ] PASS [ ] FAIL — Reimprimir cria um novo job manual, preservando o histórico anterior.
- [ ] PASS [ ] FAIL — Finalizar o pedido e acessá-lo no Histórico ainda permite visualizar/PDF/reimprimir usando o mesmo manager de impressão.

**Observações:**

---

## Preview e PDF

- [ ] PASS [ ] FAIL — **Visualizar ticket** apresenta o mesmo Ticket Oficial canônico usado pela impressão.
- [ ] PASS [ ] FAIL — **Gerar PDF** produz arquivo legível com itens, valores, pagamento e mensagem final.
- [ ] PASS [ ] FAIL — Preview/PDF não dependem da impressora estar ligada.
- [ ] PASS [ ] FAIL — Observações dos itens aparecem no preview/PDF quando informadas.
- [ ] PASS [ ] FAIL — Valores usam formatação em Real brasileiro.

**Observações:**

---

## Resultado final Windows

- [ ] PASS [ ] FAIL — Fluxo manual aprovado.
- [ ] PASS [ ] FAIL — Fluxo automático aprovado.
- [ ] PASS [ ] FAIL — 1 cópia aprovado.
- [ ] PASS [ ] FAIL — 2 cópias aprovado.
- [ ] PASS [ ] FAIL — Falha/reconexão aprovado.
- [ ] PASS [ ] FAIL — Acentos e quebra de linha aprovados.

**Responsável:**

**Data:**

**Observações finais:**

---

## Resultado final Android / RawBT

- [ ] PASS [ ] FAIL — RawBT configurado com MPT-II e teste próprio aprovado.
- [ ] PASS [ ] FAIL — Fluxo manual do Gestão Delivery aprovado.
- [ ] PASS [ ] FAIL — Fluxo automático aprovado sem bloqueio de abertura externa e sem duplicidade.
- [ ] PASS [ ] FAIL — 1 cópia aprovado.
- [ ] PASS [ ] FAIL — 2 cópias aprovado.
- [ ] PASS [ ] FAIL — Impressora desligada/religada não causa duplicidade.
- [ ] PASS [ ] FAIL — Acentos e quebra de linha aprovados.

**Responsável:**

**Data:**

**Observações finais:**

---

## Critério de aceite

A funcionalidade só deve ser considerada **fisicamente aprovada** para uma plataforma quando todos os itens críticos daquela plataforma estiverem marcados como `PASS` e qualquer desvio de hardware, driver, página de código ou transporte tiver sido corrigido e revalidado.

Para Android, aprovação manual e aprovação automática são gates separados. Se o fluxo manual funcionar, mas o Chrome bloquear a abertura automática do RawBT, a impressão manual pode ser homologada enquanto a autoimpressão permanece não aprovada.

A aprovação deste checklist não executa deploy de produção, não aplica migrations de produção e não altera a configuração de produção por conta própria.

---

## Checkpoint documental — Fase 9 / aprovação física da fila QZ centralizada

- **Data da homologação:** 2026-09-09
- **Branch:** `feature/centralized-qz-print-queue`
- **SHA aprovado:** `966ac651c8b840a1d2fe9240e1f8fca6d4be41b8`
- **Ambiente:** staging
- **Equipamento:** Windows + QZ Tray + fila MPT-II + USB

### Matriz resumida dos cenários validados

| Cenário | Resultado |
| --- | --- |
| Impressão automática pela estação principal Windows/QZ | Aprovado |
| Pedido Delivery com 2 vias; primeira via automática | Aprovado |
| Popup automático da segunda via no PC | Aprovado |
| Popup remoto da segunda via no celular originador e solicitação pelo celular | Aprovado |
| Conclusão correta 2/2 — Impresso | Aprovado |
| Scroll após modal | Aprovado |
| Pedido Mesa respeita 1 via | Aprovado |
| QZ/estação offline, jobs aguardando e retomada após reabertura do QZ | Aprovado |
| Descarte, reimpressão e sequência de múltiplos jobs | Aprovado |
| Sem popup antigo após reload | Aprovado |
| Semântica de QZ, fila e prontidão | Aprovado |
| Ticket MPT-II, fonte bitmap final, total, rodapé e avanço final | Aprovado |

### Limitação conhecida

A fila MPT-II continua sendo encontrada pelo Windows mesmo sem o USB físico conectado. Isso é uma característica da fila/driver do Windows e não foi tratado como prontidão física isoladamente; a operação permanece condicionada à disponibilidade real do QZ, da estação e da impressora.

### Aprovação e gate

A homologação física em staging foi explicitamente aprovada pelo usuário após a validação integral dos cenários acima. O gate da Fase 9 está liberado para a Fase 10 — inventário e posterior limpeza planejada — sem autorizar, neste checkpoint, a remoção de RawBT/Web Serial nem o início da Tarefa 10.2.
