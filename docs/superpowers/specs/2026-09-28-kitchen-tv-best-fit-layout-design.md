# Kitchen TV — best-fit layout e margem anti-clipping

**Data:** 2026-09-28  
**Branch:** `feature/kitchen-tv-best-fit-layout`  
**Base:** `master@5a557476f1cbc2f6d75d3c93f6799e8ed8f16641`  
**Status:** direção aprovada pelo responsável do produto.  
**Produção:** não publicar sem homologação em staging e autorização explícita.

## 1. Problemas observados em TV real

A homologação em TV real mostrou dois pontos:

1. alguns cards muito curtos ainda podem cortar parcialmente a primeira linha do item, mesmo que o navegador de desenvolvimento pareça caber;
2. a escolha de densidade ainda depende demais da quantidade de pedidos: ao passar de 6 para 7, o painel pode mudar cedo demais de 3 para 4 colunas, reduzindo desnecessariamente os cards e deixando área vertical ociosa.

## 2. Objetivo

Transformar a escolha do layout em **best fit real**.

O painel deve tentar, em ordem, layouts progressivamente mais densos e usar o menos compacto que consiga representar a fila visível sem overflow.

Regra de produto:

> primeiro tentar manter todos os pedidos na tela com os maiores cards possíveis; somente aumentar o número de colunas/densidade quando o layout anterior não comportar a fila.

Se nenhum layout conseguir exibir todos os pedidos, escolher o que exibe a maior quantidade respeitando prioridade. Só então mostrar `+ N pedidos fora da tela`.

## 3. Perfis candidatos

### `focus`
- 3 colunas;
- cards mais amplos;
- ideal para filas pequenas;
- preserva a experiência atual de até aproximadamente 6 pedidos simples.

### `roomy`
- 3 colunas;
- grid vertical mais granular;
- padding/header moderadamente mais compactos que `focus`;
- permite acomodar 7–9 pedidos curtos sem migrar prematuramente para 4 colunas.

### `balanced`
- 4 colunas;
- densidade intermediária;
- usada quando 3 colunas não conseguem comportar a fila.

### `compact`
- 4 colunas;
- maior granularidade vertical;
- usada quando o layout balanced não é suficiente e o viewport suporta densidade maior.

A disponibilidade de cada perfil continua dependente do viewport. Não forçar layout compacto em TV/resolução que comprometa leitura.

## 4. Algoritmo de seleção

A seleção não pode usar apenas `queueSize`.

Para cada perfil disponível:

1. calcular métricas de conteúdo dos pedidos naquele perfil;
2. executar o mesmo packing que preserva a prioridade operacional;
3. priorizar todos os pedidos que já estão em `preparing`; pedidos ainda em `scheduled` só usam capacidade realmente livre depois que toda a fila em preparo couber;
4. calcular quantos pedidos caberam e o overflow.

Escolha:

1. se algum perfil comportar a fila inteira, usar o **primeiro / menos denso** que conseguiu;
2. se nenhum comportar, usar o perfil com **menor overflow**;
3. em empate de overflow, preferir o perfil menos denso.

Isso faz 7 pedidos permanecerem em 3 colunas quando realmente couberem, sem transformar “7” em um breakpoint rígido.

## 5. Anti-clipping

O menor card não pode ser calculado no limite matemático do conteúdo.

A TV real pode variar na rasterização da fonte e no scaling. Portanto:

- cards simples devem ganhar uma margem vertical mínima de segurança;
- 1 item curto/sem observação não pode usar um span que deixe status + cliente/tempo + divisor + item encostados no limite;
- item com observação ou quebra de linha sempre recebe margem adicional;
- nunca reduzir tipografia para resolver clipping;
- `overflow: hidden` permanece como proteção do board, mas não deve ser usado para esconder conteúdo válido.

No perfil `compact`, o card mínimo simples passa a ter piso de segurança maior que a versão anterior.

## 6. Preenchimento vertical

Cards continuam ocupando uma coluna por vez e empilhando do topo.

O packing deve:

- minimizar buracos verticais;
- não reordenar a fila para promover pedido inferior;
- não pular pedido prioritário só porque um posterior é menor;
- manter posições determinísticas;
- manter backtracking limitado à disposição física dos cards já selecionados.

## 7. Critérios de aceite

- [ ] 6 pedidos simples continuam grandes/confortáveis;
- [ ] 7 pedidos simples em viewport grande permanecem em 3 colunas quando couberem;
- [ ] 8–9 pedidos simples tentam 3 colunas antes de 4;
- [ ] 4 colunas só entram quando o candidato de 3 colunas não comportar a fila;
- [ ] quando nenhum perfil comportar tudo, vence o perfil com menor overflow;
- [ ] pedidos fora da tela só aparecem quando nenhum candidato consegue acomodá-los;
- [ ] 1 item simples não corta texto na TV real;
- [ ] observações e nomes quebrados ganham altura suficiente;
- [ ] tipografia atual de produção é preservada;
- [ ] prioridade operacional preservada: nenhum pedido ainda aguardando em `scheduled` desloca pedido já em `preparing`; ao entrar na janela de preparo, o agendado passa a `preparing` pela regra de domínio e recebe prioridade normal;
- [ ] desktop/browser e TV real ficam visualmente coerentes;
- [ ] staging homologado antes de merge;
- [ ] produção permanece bloqueada até autorização separada.

## 8. Fora de escopo

- rotação/paginação automática;
- interação para avançar página;
- mudança de lifecycle/timing;
- Worker/API/migrations;
- áudio/pareamento;
- impressão;
- alterações de domínio de pedidos.


## 9. Correção após teste em TV real 960×540

O primeiro best-fit ainda falhou em uma TV Toshiba/Regza real: o navegador expôs um viewport CSS de classe aproximadamente 960×540. A primeira correção liberou os perfis densos nesse viewport e passou a mostrar todos os cards, porém revelou um segundo problema: os spans verticais calculados para o perfil `compact` eram pequenos demais para a altura física real de status + cliente/tempo + itens, causando clipping de vários pedidos.

A correção final deve obedecer também aos seguintes contratos:

- viewports de TV a partir de aproximadamente 900×500 recebem todos os candidatos `focus → roomy → balanced → compact`; o CSS responsivo continua responsável pela escala visual;
- o cálculo de conteúdo recebe **largura e altura** do viewport;
- duas colunas internas de itens só podem ser usadas quando a largura estimada do card for suficiente (piso atual de 340px por card);
- em cards estreitos, o cálculo de linhas deve ser mais conservador para refletir quebra real de texto;
- no perfil `compact` com altura `constrained`, um card simples de 1 item tem piso de **6/24 trilhas**;
- 1 item com observação tem piso de **8/24 trilhas**;
- demais cards constrained usam span proporcional mais conservador às linhas efetivas e às observações;
- em altura `standard`, os pisos também são maiores que no desktop spacious;
- nenhuma tentativa de mostrar mais pedidos pode aceitar clipping como trade-off;
- se os 16 pedidos não couberem com segurança por causa do conteúdo real, o comportamento correto é mostrar menos e informar overflow.

O objetivo do best-fit é maximizar **pedidos íntegros e legíveis**, não maximizar a contagem às custas de conteúdo cortado.
