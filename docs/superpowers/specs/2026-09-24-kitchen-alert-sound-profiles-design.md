# Alertas sonoros configuráveis — Design

**Data:** 24/09/2026  
**Projeto:** Gestão Delivery / Mesiva  
**Branch:** `feature/kitchen-alert-sound-profiles`  
**Base:** `master@b82406e41ac62560d6ed61acb31c4b18a53d30ae`  
**Referência visual:** Mesiva — Guia oficial de identidade visual e aplicação no produto, v1.0.  
**Produção:** NÃO AUTORIZADA nesta implementação.

## 1. Problema

O alerta atual de novo pedido é curto e discreto demais para uma cozinha real:

- no Admin/Cozinha, o navegador sintetiza dois tons muito curtos;
- na Kitchen TV, o alerta atual é um único tom de cerca de 160 ms;
- em ambiente com exaustor, conversas, louça e equipamentos, o aviso pode passar despercebido.

O objetivo é permitir que cada dispositivo escolha um alerta mais perceptível sem transformar o som em uma regra global do negócio.

## 2. Decisões aprovadas

1. Não adicionar biblioteca externa de áudio.
2. Reutilizar Web Audio / `AudioContext`.
3. Criar um catálogo compartilhado de alertas sintetizados.
4. Manter preferências locais por navegador/dispositivo.
5. Admin e Kitchen TV usam o mesmo catálogo, mas cada dispositivo salva sua própria escolha no `localStorage`.
6. O alerta toca uma vez por chegada detectada; um perfil pode conter várias batidas internas, mas não repete indefinidamente.
7. A lista inicial terá cinco perfis:
   - `bell` — **Campainha**;
   - `kitchen-strong` — **Cozinha forte**;
   - `double-alert` — **Duplo alerta**;
   - `long-call` — **Chamado longo**;
   - `classic` — **Clássico**.
8. Volume local com três níveis:
   - `normal`;
   - `high`;
   - `max`.
9. Padrão do Admin/Cozinha: **Campainha / Alto**.
10. Padrão da Kitchen TV quando ainda não existe preferência salva: **Cozinha forte / Máximo**.
11. O botão de prévia toca o perfil escolhido mesmo quando o alerta automático estiver desligado.
12. O volume físico do navegador/TV continua sendo o limite final; o app não pode ultrapassar o volume configurado no dispositivo.

## 3. Catálogo e síntese

O catálogo é plain-data, sem dependência de React nem APIs de browser. Cada perfil descreve uma sequência de eventos de tom com:

- frequência;
- instante relativo;
- duração;
- tipo de oscilador;
- ganho relativo.

A reprodução usa um único player compartilhado sobre `AudioContext`, com `unlock`, `play` e `close`.

O player deve:

- normalizar perfil e volume desconhecidos para defaults seguros;
- tentar `resume()` quando o contexto estiver suspenso;
- retornar `false` em browser sem Web Audio ou quando o áudio estiver bloqueado;
- não lançar erro para o fluxo operacional;
- limitar ganho para evitar clipping agressivo;
- continuar compatível com o target `chrome69` usado pela Kitchen TV.

## 4. Preferências locais

Preservar a chave existente:

`kitchen-sound-enabled`

Adicionar:

`kitchen-sound-profile`  
`kitchen-sound-volume`

A ausência das novas chaves não invalida instalações existentes.

No Admin:

- perfil default: `bell`;
- volume default: `high`.

Na Kitchen TV:

- se ainda não existir valor salvo, usar fallback `kitchen-strong` / `max`;
- depois da primeira alteração, as mesmas chaves passam a refletir a escolha local daquele navegador.

Falhas de `localStorage` não podem quebrar a operação. No Admin, devem seguir o feedback de erro já existente em Preferências deste dispositivo. Na TV, a seleção pode continuar válida na sessão mesmo se a persistência local falhar.

## 5. Configurações — Preferências deste dispositivo

Na seção **Avisos da cozinha**:

- manter o switch **Som de novos pedidos**;
- adicionar **Toque do alerta** com as cinco opções;
- cada linha mostra nome, descrição curta e botão de prévia com ícone de som;
- selecionar uma linha salva automaticamente;
- tocar a prévia não altera a seleção;
- adicionar **Volume do alerta** com Normal / Alto / Máximo;
- manter o padrão visual de cards, bordas, tokens e responsividade do tema vigente;
- sem biblioteca visual paralela.

A tela continua declarando que essas preferências são locais ao navegador.

## 6. Cozinha administrativa

A detecção de novas chegadas permanece exatamente a atual:

- não alterar polling;
- não alterar critérios de pedido novo;
- não alterar destaque visual;
- não alterar regra de uma execução por nova chegada.

O hook recebe o perfil e o volume locais e chama o mesmo player compartilhado.

O botão atual **Som ativado / Som desligado** continua existindo e sincronizado com a tela de Preferências.

## 7. Kitchen TV

A tela **Painel da cozinha pronto** ganha controles compactos antes de **Iniciar painel da cozinha**:

- seletor do toque;
- seletor/controle do volume;
- ação **Ouvir**.

Requisitos:

- usar controles simples e compatíveis com TV/navegador legado;
- o clique em **Ouvir** pode desbloquear o `AudioContext` por ser gesto do usuário;
- **Iniciar painel da cozinha** continua tentando fullscreen e desbloqueio de áudio;
- a TV não depende do Admin para obter a preferência;
- o alerta de nova chegada usa o perfil/volume local da TV;
- se o áudio estiver bloqueado, preservar o tratamento visual existente;
- pareamento, sessão, API, polling e regras de timing não mudam.

## 8. Compatibilidade

A implementação não pode regredir a correção recém-homologada para Samsung UN32T4300AG / Tizen legado.

Antes de merge:

- build target continua `chrome69`;
- nenhum novo pacote;
- Kitchen TV continua sem importar chunks administrativos pesados;
- teste físico obrigatório na Samsung antiga para pelo menos:
  - abrir a TV;
  - parear;
  - ouvir prévia;
  - trocar toque;
  - trocar volume;
  - iniciar painel;
  - receber um pedido real/fictício de staging e ouvir o alerta;
  - confirmar que fullscreen e renderização continuam funcionais.

## 9. Estados e acessibilidade

- opções de som devem ser operáveis por teclado;
- seleção expõe estado acessível (`radio`, `aria-checked` ou equivalente);
- prévia deve ter rótulo acessível específico;
- controles não dependem apenas de cor;
- em mobile, nomes e botões não podem ficar cortados;
- foco visível deve permanecer nos controles;
- o som não substitui o destaque visual já existente.

## 10. Fora de escopo

- áudio enviado pelo servidor;
- upload de arquivos de som pelo usuário;
- som específico por modalidade/pedido;
- repetição contínua até confirmação;
- sincronização de som entre dispositivos;
- mudança de polling;
- alteração em D1;
- alteração de API;
- mudança de permissões/capabilities;
- deploy de produção nesta tarefa.

## 11. Critérios de aceite

1. Preferências mostra os cinco toques e três volumes.
2. Cada toque pode ser ouvido sem alterar a seleção.
3. Seleção e volume persistem por navegador.
4. Switch existente continua funcionando.
5. Admin/Cozinha usa perfil e volume escolhidos em novas chegadas.
6. Kitchen TV oferece seleção/prévia antes de iniciar o painel.
7. Kitchen TV usa a própria preferência local.
8. Primeiro uso da TV usa Cozinha forte / Máximo.
9. Primeiro uso do Admin usa Campainha / Alto.
10. Browser sem Web Audio não quebra a UI.
11. Samsung Tizen antiga continua funcional.
12. Nenhuma dependência nova.
13. Testes, architecture, lint, build e Worker dry-runs verdes.
14. Staging homologado manualmente antes de merge.
