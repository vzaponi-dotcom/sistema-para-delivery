# Abertura Mesiva — Pulso

## Escopo aprovado

- Substituir os cartões de verificação da sessão e sincronização por uma abertura com a identidade Mesiva.
- Símbolo com pulso breve; nome e slogan `Pessoas. Sabor. Evolução.` entram juntos, com aproximação e nitidez gradual.
- Mensagem de carregamento seguida de uma barra indeterminada contínua.
- Uma única versão de movimento, conforme solicitado pelo usuário.
- Publicar na branch da PR #88 e em staging pelo GitHub Actions.

## Integração

`AppRoot` mantém a decisão de exibir autenticação, contexto da empresa, erro ou operação. `StartupScreen` é apenas a apresentação dos estados de espera.

A abertura usa CSS, sem bibliotecas adicionais, vídeo, temporizadores de espera ou porcentagem fictícia. O estado `ready` libera a operação imediatamente; não há duração mínima obrigatória. Em conexões rápidas, apenas parte da abertura pode aparecer. Erro e nova tentativa mantêm o fluxo existente.

Os recortes de símbolo e nome reutilizam os SVGs oficiais em `/brand/mesiva-logo.svg` e `/brand/mesiva-logo-dark.svg`. Não há uma segunda cópia dos contornos da marca.

Tempos da apresentação, enquanto houver espera:

- Símbolo: 760 ms; halo: 950 ms, iniciado em 240 ms.
- Nome e slogan: 1.100 ms, iniciados juntos em 550 ms.
- Status: 500 ms, iniciado em 2.200 ms.
- Barra: ciclos de 1.150 ms, alternando a direção, até sair do estado de espera.

## Revisão independente

Dois achados foram corrigidos e conferidos novamente pelo revisor:

1. A regra global de movimento reduzido de `App.css` interrompia a barra após um ciclo. Duração e contagem agora são explícitas somente nos cinco elementos da abertura; a regra dos demais componentes permanece existente.
2. `aria-busy` no próprio status poderia adiar seus anúncios até a desmontagem. O status usa `role="status"` e `aria-live="polite"`, sem esse bloqueio.

## Verificação

- Teste de `AppRoot` falhou antes da implementação e passou depois.
- Regressão de acessibilidade falhou com `aria-busy` e passou após sua remoção.
- Seis testes direcionados de `AppRoot` e neutralidade da marca passaram.
- Navegador: desktop claro e celular escuro (390 × 844), logo e slogan sem cortes, barra visível, erro, nova tentativa e entrada imediata quando os dados estão prontos.
- Com preferência de movimento reduzido emulada e CSS real da aplicação, a barra manteve duração computada de `1.15s` e repetição `infinite`, conforme a versão única aprovada.
- Arquitetura: passou. Lint: zero erros, com avisos já existentes no projeto.
- `npm test`: 3.454 testes passaram; zero falhas, skips e cancelamentos (182 s).
- `npm run build`: passou; mantém o aviso existente sobre tamanho de alguns chunks.

## Publicação

O push na branch `feature/issue-87-multi-company-onboarding` dispara `Deploy staging`. A identidade publicada deve ser conferida em `https://staging.mesiva.com.br/release.json` contra o SHA do commit no GitHub. Nenhum deploy direto local é necessário.
