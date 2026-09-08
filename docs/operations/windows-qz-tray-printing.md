# Operação da impressão Windows — MPT-II + QZ Tray

Este runbook descreve a configuração e recuperação da estação Windows usada pelo Gestão Delivery para impressão térmica automática. Ele se aplica ao fluxo **Windows + USB + QZ Tray** e deve ser homologado primeiro em **staging**.

## Arquitetura validada

Fluxo esperado:

`Gestão Delivery -> fila de impressão -> navegador -> QZ Tray -> fila Windows MPT-II -> USB001 -> MPT-II`

Configuração física validada na estação alvo:

- Dispositivo USB detectado pelo Windows: `YICHIP - printer demo`
- Fila de impressora no Windows: `MPT-II`
- Driver: `Generic / Text Only`
- Porta: `USB001`
- QZ Tray: `2.2.6`
- Transporte do Gestão Delivery: RAW / ESC-POS em Base64 para o QZ Tray
- Renderização da MPT-II: `mpt2-bitmap`, 384 pontos por linha
- Avanço final do ticket: 1 linha

O Windows **não** expõe esta MPT-II como porta COM. Portanto, o caminho operacional desta estação não usa Web Serial.

## 1. Verificar a fila do Windows

Antes de abrir o Gestão Delivery:

1. Ligue a MPT-II e confirme que há papel térmico de 58 mm.
2. Conecte o cabo USB ao computador.
3. Abra **Configurações > Bluetooth e dispositivos > Impressoras e scanners**.
4. Confirme a existência da impressora `MPT-II`.
5. Abra as propriedades da impressora e confirme:
   - driver `Generic / Text Only`;
   - porta `USB001`.
6. Faça uma impressão de teste simples pela fila do Windows e confirme que o papel sai fisicamente.

Se a fila estiver apontando para `LPT1`, `COM1` ou outra porta, não avance até corrigir a associação para a porta USB virtual correta.

## 2. Verificar o QZ Tray

1. Abra o **QZ Tray 2.2.6** no Windows.
2. Confirme que o ícone do QZ Tray permanece ativo na área de notificação.
3. Abra a página de exemplo/sample do QZ Tray.
4. Confirme que a conexão local com o QZ funciona.
5. Liste as impressoras e confirme que `MPT-II` aparece exatamente com esse nome.
6. Faça um teste RAW controlado pelo QZ, quando necessário, e confirme que a MPT-II imprime.

O QZ Tray deve permanecer aberto enquanto a impressão automática estiver em uso.

## 3. Provisionar certificado e confiança do QZ

A impressão automática sem confirmação por pedido depende da configuração assinada do QZ.

Na estação Windows alvo:

1. Abra o QZ Tray.
2. Acesse **Advanced > Site Manager**.
3. Gere ou instale o certificado demo/custom aprovado para esta estação.
4. Configure a confiança do site/staging usando os controles fornecidos pelo Site Manager.
5. Não desative globalmente os avisos de segurança do QZ como atalho.
6. Guarde o material privado fora do navegador, do Git e de arquivos públicos.

A primeira implantação é intencionalmente vinculada à estação Windows homologada. Outra estação Windows deve ser provisionada explicitamente; não assuma que a confiança local desta máquina será compartilhada automaticamente.

## 4. Configurar os secrets de staging

O Worker de **staging** precisa de dois valores:

- `QZ_DIGITAL_CERTIFICATE` — certificado público usado pelo navegador/QZ.
- `QZ_SIGNING_PRIVATE_KEY` — chave privada PKCS#8 usada somente no Worker para assinar as requisições do QZ.

Regras obrigatórias:

- configure estes valores somente no ambiente de staging durante a homologação;
- nunca coloque `QZ_SIGNING_PRIVATE_KEY` no código-fonte, `localStorage`, D1 ou bundle do frontend;
- nunca publique a chave privada em commit, issue, pull request, screenshot ou log;
- nunca cole a chave privada em conversas ou mensagens de suporte;
- não configure secrets de produção antes da homologação física e da aprovação explícita para produção.

Se o certificado e a chave não formarem o par esperado ou o certificado não estiver confiado no QZ da estação, o Gestão Delivery deve permanecer sem prontidão para impressão automática em vez de consumir a fila.

## 5. Configurar a impressora no Gestão Delivery

Com o QZ Tray aberto e o usuário autenticado no staging:

1. Abra **Pedidos > Impressão**.
2. Confirme:
   - Plataforma: `Windows`;
   - Driver: `QZ Tray`.
3. Clique em **Configurar impressora** ou **Trocar impressora**.
4. Atualize a lista, se necessário.
5. Selecione `MPT-II` explicitamente.
6. Salve a seleção.
7. Confirme que a tela apresenta a fila configurada e o transporte como pronto.
8. Clique em **Testar impressão**.
9. Só continue se o ticket de teste sair corretamente na impressora física.

A fila escolhida é armazenada localmente nesta estação. O sistema não deve selecionar silenciosamente outra impressora apenas porque ela é a padrão do Windows.

## 6. Ativar a estação principal e a impressão automática

Depois do teste manual aprovado:

1. Em **Pedidos > Impressão**, torne esta estação a **estação principal**.
2. Ative **Imprimir novos pedidos automaticamente**.
3. Configure **1 cópia** ou **2 cópias**, conforme a operação desejada.
4. Mantenha o QZ Tray aberto.
5. Crie um único pedido controlado em staging.

A estação só pode consumir automaticamente a fila quando o QZ estiver conectado, a assinatura estiver disponível, a fila `MPT-II` salva existir e a estação estiver principal/pronta.

## 7. Homologação física obrigatória em staging

Para um pedido de teste representativo, valide:

- impressão automática sem confirmação QZ por pedido;
- valores monetários completos, por exemplo `R$ 18,00`;
- acentos e caracteres portugueses, por exemplo `João`, `Sanduíche`, `Endereço`, `Acréscimo`, `Observação`;
- largura correta do ticket em 58 mm;
- avanço final de exatamente 1 linha;
- ausência de comando de corte automático;
- nenhuma impressão duplicada após refresh/foco;
- comportamento seguro se o QZ estiver indisponível.

### Fluxo de duas cópias

Com `2 cópias` configuradas:

1. O primeiro passe imprime somente `CÓPIA 1/2`.
2. O sistema registra a primeira via sem concluir a segunda.
3. O modal global orienta destacar o papel na serrilha.
4. Destaque o ticket fisicamente.
5. Clique em **Imprimir 2ª via**.
6. Deve sair somente `CÓPIA 2/2`.
7. Se o modal for cancelado, a segunda via deve continuar disponível nos detalhes do pedido.

Não aceite a homologação se a segunda ação repetir a primeira via ou criar um job diferente para o mesmo pedido.

## 8. Recuperação quando o QZ Tray estiver fechado

Sintoma esperado: Gestão Delivery mostra o QZ indisponível/desconectado e **não deve consumir novos jobs automáticos**.

Recuperação:

1. Abra o QZ Tray novamente.
2. Volte ao Gestão Delivery.
3. Abra **Pedidos > Impressão**.
4. Atualize a lista de impressoras se necessário.
5. Confirme que `MPT-II` voltou a aparecer.
6. Execute **Testar impressão**.
7. Só depois do teste bem-sucedido retome a operação automática.

Se um job já tiver sido claimado antes da falha, use o estado e as ações explícitas do próprio job. Não crie uma reimpressão paralela para contornar a falha.

## 9. Recuperação quando a fila MPT-II desaparecer

Se o QZ estiver aberto, mas `MPT-II` não aparecer:

1. Verifique se a impressora está ligada.
2. Reconecte o cabo USB.
3. Confirme no Windows que a fila `MPT-II` ainda existe.
4. Confirme que ela continua em `Generic / Text Only` e `USB001`.
5. Confirme que uma impressão simples pelo Windows funciona.
6. Reabra/atualize a descoberta de impressoras do QZ.
7. No Gestão Delivery, use **Trocar impressora** somente se o nome da fila realmente tiver mudado.
8. Execute **Testar impressão** antes de reativar o fluxo automático.

Não substitua `MPT-II` por `Microsoft Print to PDF`, `Fax`, `LPT1` ou outra fila apenas para remover o aviso de configuração.

## 10. Recuperação de erro de certificado/assinatura

Se o QZ estiver aberto e a fila existir, mas a aplicação não conseguir estabelecer o fluxo confiável:

1. Confirme que o usuário está autenticado no Gestão Delivery.
2. Confirme que o certificado confiado no QZ corresponde ao provisionamento de staging.
3. Confirme no ambiente de staging a presença de `QZ_DIGITAL_CERTIFICATE` e `QZ_SIGNING_PRIVATE_KEY`.
4. Não registre nem exiba o conteúdo da chave privada durante o diagnóstico.
5. Reabra o QZ Tray e recarregue o staging após corrigir a configuração.
6. Faça uma nova impressão de teste.

Uma falha de assinatura deve bloquear a prontidão local; não deve ser contornada desabilitando a segurança do QZ.

## 11. Falha de impressão e resultado físico

Quando o QZ rejeitar o envio antes de concluir o spool, o job deve seguir o fluxo de falha conhecido e não pode ser marcado como impresso.

Quando houver dúvida sobre o resultado físico, não faça tentativa silenciosa. Use somente as ações explícitas apresentadas pelo Gestão Delivery para **Tentar novamente**, **Imprimir agora**, **Imprimir 2ª via** ou **Reimprimir**, conforme o estado do mesmo job.

O pedido comercial continua salvo independentemente do estado da impressão.

## 12. Smoke test Android após alteração Windows

Depois de homologar o Windows/QZ em staging, faça um smoke test no Android para garantir que a alteração não afetou o caminho existente:

1. RawBT aberto/configurado para a MPT-II.
2. Gestão Delivery mostra `Driver: RawBT` e `RawBT pronto`.
3. Teste de impressão chega ao RawBT.
4. Pedido controlado imprime pela MPT-II.
5. Acentos, valores e fluxo de segunda via permanecem corretos.

O Android continua usando RawBT; QZ é exclusivo do Windows nesta implementação.

## 13. Gate para produção

Este runbook não autoriza produção.

Somente considerar merge/deploy de produção depois de:

1. CI completo verde no HEAD exato da branch;
2. deploy da branch em staging;
3. homologação física do Windows/QZ concluída;
4. smoke test Android/RawBT concluído;
5. confirmação explícita do responsável autorizando o caminho de produção.

Até essa aprovação, mantenha o PR aberto e a `master`/produção intactas.
