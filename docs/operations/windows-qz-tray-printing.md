# Runbook operacional — fila centralizada Windows/QZ

## Arquitetura oficial

`Dispositivo solicitante → Cloudflare/fila → PC da cozinha → QZ Tray → Windows → USB → MPT-II`

Celular, tablet e outras plataformas apenas criam/acompanham jobs e solicitam ações remotas. Somente a estação principal Windows executa impressão física.

## Pré-requisitos e instalação

- PC Windows dedicado, autenticado, online e acessando o sistema por HTTPS.
- QZ Tray 2.2.6 instalado, aberto e confiado para o ambiente autorizado.
- MPT-II ligada, com papel térmico de 58 mm e USB conectado.
- Fila Windows `MPT-II`, driver `Generic / Text Only` e porta USB correta.
- Certificado público e chave privada QZ provisionados nos segredos apropriados; a chave privada nunca fica no navegador, D1, bundle, Git ou logs.

No Windows, confirme a fila em **Configurações > Bluetooth e dispositivos > Impressoras e scanners**, valide driver/porta e faça um teste direto pela fila. Abra o QZ Tray e confirme o ícone ativo.

## Configurar a estação principal

Em **Pedidos > Impressão**, confirme **Windows** e **QZ Tray**, use **Configurar impressora**, atualize a lista e selecione explicitamente `MPT-II`. Torne a estação principal e ative a impressão automática somente após o teste manual. A fila escolhida é salva localmente; jobs, estados, vias e ações são centralizados.

Estados:

- **Estação Online:** comunica com o serviço e envia heartbeat.
- **QZ conectado:** sessão local QZ ativa.
- **Fila encontrada:** fila salva localizada pelo QZ.
- **Pronta para enviar:** QZ, fila e prontidão local válidos; só então há claim automático.

Limitação conhecida: o Windows pode manter a fila MPT-II encontrada mesmo sem USB físico. Isso não prova papel, alimentação ou saída física.

## Vias e pedidos

Pedido Mesa/consumo local automático sempre usa 1 via. Delivery/Retirada seguem a regra central ou a quantidade explícita do job. Com 2 vias, o primeiro passe imprime `CÓPIA 1/2`, registra uma via e aguarda; **Imprimir 2ª via** imprime somente `CÓPIA 2/2` no mesmo job. Cancelar o aviso não descarta a segunda via.

“Impresso” significa envio aceito/concluído pelo QZ/Windows, não confirmação de papel.

## Offline, retry, descarte e reprint

Se PC/QZ/fila estiver indisponível, o pedido e o job continuam salvos. Não faça claims paralelos. Após o retorno, abra QZ, atualize a tela, confirme a fila, faça teste controlado e só então retome a operação.

Falha conhecida usa **Tentar novamente**; resultado incerto exige atenção e decisão explícita. Nunca há retry silencioso. **Descartar** preserva histórico. **Reimprimir** cria um job manual vinculado ao histórico. A segunda via pode ser solicitada pelo PC ou remotamente pelo celular.

## Troubleshooting

- **QZ desconectado:** abra QZ, confirme certificado/confiança e recarregue; não desative a segurança.
- **Fila não encontrada:** confira nome, driver, porta USB e teste do Windows; depois atualize a descoberta.
- **Pronta, mas sem papel:** verifique alimentação, papel, cabo e impressão direta; prontidão não é confirmação física.
- **Job parado:** confira estação principal, conectividade, `availableAt` e o estado; use apenas a ação explícita correspondente.
- **Acentos/largura:** valide papel 58 mm, 384 pontos e caracteres portugueses.

Este runbook não autoriza deploy de produção. A homologação física aprovada da Fase 9 permanece o checkpoint operacional.
