# Aceitação da impressão de pedidos — Goldensky MTP5

Este checklist valida a impressão física do Ticket Oficial do Gestão Delivery na mini impressora térmica Goldensky MTP5 (58 mm, ESC/POS, Bluetooth Classic SPP/RFCOMM).

A aprovação de software não substitui estes testes físicos. Marque cada item como `PASS` ou `FAIL` e registre observações, especialmente modelo/versão do navegador e comportamento real da impressora.

## Pré-requisitos

- [ ] PASS [ ] FAIL — MTP5 carregada, com bobina térmica 58 mm instalada corretamente.
- [ ] PASS [ ] FAIL — Dispositivo com Bluetooth habilitado.
- [ ] PASS [ ] FAIL — Aplicação Gestão Delivery aberta em conexão HTTPS.
- [ ] PASS [ ] FAIL — Usuário autenticado no Gestão Delivery.
- [ ] PASS [ ] FAIL — Nenhuma outra aplicação está mantendo a conexão da impressora aberta.

**Observações:**

---

## Windows + Chrome

- [ ] PASS [ ] FAIL — Windows reconhece a MTP5 após o pareamento Bluetooth.
- [ ] PASS [ ] FAIL — Chrome atual oferece a seleção da porta serial Bluetooth da MTP5.
- [ ] PASS [ ] FAIL — Após autorização inicial, o navegador consegue reutilizar a porta autorizada nas próximas sessões.
- [ ] PASS [ ] FAIL — Fechar/reabrir a tela não cria impressão duplicada.

**Versão do Windows:**

**Versão do Chrome:**

**Observações:**

---

## Android + Chrome 138+

- [ ] PASS [ ] FAIL — Android reconhece a MTP5 após o pareamento Bluetooth.
- [ ] PASS [ ] FAIL — Chrome 138+ disponibiliza a impressora no fluxo de conexão do Gestão Delivery.
- [ ] PASS [ ] FAIL — A autorização da impressora pode ser reutilizada sem criar novos trabalhos de impressão.
- [ ] PASS [ ] FAIL — Bloquear/desbloquear ou alternar de aplicativo não produz cópias duplicadas.

**Modelo/versão do Android:**

**Versão do Chrome:**

**Observações:**

---

## Pareamento MTP5

1. Ligue a MTP5.
2. Abra as configurações Bluetooth do sistema operacional.
3. Localize a impressora MTP5 e conclua o pareamento.
4. Se o sistema solicitar PIN, use somente a informação fornecida pelo fabricante/dispositivo; o Gestão Delivery não armazena PIN de pareamento.

- [ ] PASS [ ] FAIL — Pareamento concluído no sistema operacional.
- [ ] PASS [ ] FAIL — MTP5 permanece disponível depois de desligar e ligar novamente o Bluetooth.

**Nome exibido pelo sistema:**

**Observações:**

---

## Conectar impressora no Gestão Delivery

1. Abra **Pedidos > Impressão**.
2. Clique em **Conectar impressora**.
3. Selecione a MTP5 no seletor do navegador.
4. Confirme o estado **Conectada**.
5. Defina este dispositivo como estação principal, caso seja a estação operacional escolhida.
6. Configure 1 ou 2 cópias.
7. Ative a impressão automática somente após o teste manual ser aprovado.

- [ ] PASS [ ] FAIL — O seletor é aberto apenas por ação explícita do usuário.
- [ ] PASS [ ] FAIL — A MTP5 correta pode ser selecionada.
- [ ] PASS [ ] FAIL — A tela exibe **Conectada** após a verificação da porta.
- [ ] PASS [ ] FAIL — A estação principal fica identificada corretamente.
- [ ] PASS [ ] FAIL — Apenas valores de 1 ou 2 cópias podem ser configurados.

**Observações:**

---

## Teste de 1 cópia

1. Configure **1 cópia**.
2. Execute **Testar impressão**.
3. Faça uma impressão manual de um pedido real/de teste autorizado.

- [ ] PASS [ ] FAIL — Sai exatamente uma cópia física.
- [ ] PASS [ ] FAIL — Pedido, itens, valores, pagamento e mensagem final estão legíveis.
- [ ] PASS [ ] FAIL — O papel avança o suficiente para destacar manualmente o ticket.
- [ ] PASS [ ] FAIL — O trabalho é registrado como impresso após a escrita serial concluir sem erro.

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
- [ ] PASS [ ] FAIL — A seleção atual CP860 / `ESC t 3` é compatível com esta unidade física da MTP5.

**Se falhar, caracteres afetados:**

**Observações:**

> A compatibilidade física é a autoridade final. Se esta MTP5 usar outro mapeamento de página de código, a correção deve ficar isolada no perfil/encoder da impressora.

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

1. Deixe a estação principal ativa e autorizada.
2. Desligue a MTP5.
3. Execute uma impressão manual ou provoque uma tentativa automática controlada.

- [ ] PASS [ ] FAIL — O pedido continua salvo e utilizável independentemente da impressão.
- [ ] PASS [ ] FAIL — A interface informa falha/desconexão de forma clara.
- [ ] PASS [ ] FAIL — Não existe loop de tentativas automáticas.
- [ ] PASS [ ] FAIL — Novos claims automáticos ficam bloqueados localmente após falha de conexão conhecida.
- [ ] PASS [ ] FAIL — Reconectar/testar com sucesso libera novamente a estação.

**Observações:**

---

## Queda durante escrita / resultado incerto

Este teste deve ser feito apenas em ambiente controlado. Interrompa a conexão durante uma impressão longa, sem repetir várias vezes desnecessariamente.

- [ ] PASS [ ] FAIL — O trabalho fica em **Requer atenção** quando o resultado físico não pode ser conhecido com segurança.
- [ ] PASS [ ] FAIL — O sistema não assume automaticamente que nada foi impresso.
- [ ] PASS [ ] FAIL — O sistema não dispara nova tentativa silenciosa.
- [ ] PASS [ ] FAIL — A ação **Imprimir agora** exige intervenção explícita do operador.

**Observações:**

---

## Retomada manual sem duplicidade

- [ ] PASS [ ] FAIL — Um job com falha conhecida usa **Tentar novamente** no mesmo job/snapshot.
- [ ] PASS [ ] FAIL — Um job com resultado incerto usa intervenção explícita antes de tentar novamente.
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

## Resultado final Android

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

## Critério de aceite

A funcionalidade só deve ser considerada **fisicamente aprovada** para uma plataforma quando todos os itens críticos daquela plataforma estiverem marcados como `PASS` e qualquer desvio de hardware (principalmente página de código, pareamento ou acesso serial) tiver sido corrigido e revalidado.

A aprovação deste checklist não executa deploy, não aplica migrations remotas e não altera a configuração de produção por conta própria.
