# GitHub como origem das publicações e ícones Mesiva

O usuário pediu que o GitHub seja a fonte de verdade e o caminho de publicação, e acrescentou a troca dos ícones do navegador e do atalho do celular para a identidade Mesiva.

## Mudanças

- Favicon SVG e PNG próprios da Mesiva; o favicon legado também foi substituído e há fallback ICO.
- Símbolo extraído dos paths oficiais do logo, sem redesenho. Ícones PNG 180 px para Apple e 192/512 px para o manifesto, com fundo branco e margem para recorte. O manifesto identifica Mesiva e abre a raiz da operação.
- Staging publica pelo GitHub Actions a branch da PR 88 enquanto existir uma PR aberta para ela. Após integração, o caminho é master. O workflow desta versão deixou de publicar automaticamente as branches históricas.
- Checkout usa o SHA do evento. Antes das escritas remotas, exige uma PR aberta para a branch de feature e que o SHA ainda seja o mais recente no GitHub. Repete a conferência do SHA imediatamente antes da publicação.
- Multiempresa ligada e preparo desligado em staging agora estão versionados em `wrangler.jsonc`; flags de produção continuam desligados.
- O build publicado inclui `release.json` com commit, branch e link do run. O smoke exige esse commit e o modo `multi_company`, além dos limites públicos de autenticação existentes. Publica o build verificado sem reconstruí-lo após a identificação da release.
- Validação automática alcança também PRs empilhadas; produção continua manual e restrita à master, agora com checkout do SHA exato do evento.

## Verificação local

Dois testes RED demonstraram que o smoke anterior aceitava um commit sem verificação e um modo de login obsoleto. Após a mudança, 35/35 testes focados passaram, incluindo espera limitada pela propagação do commit, recursos isolados, bloqueios de autenticação e deep links.

Suíte completa `npm test`: **3454/3454**, zero falhas, skips ou cancelamentos, 161606.4818 ms. Lint e arquitetura passaram; lint tem avisos existentes. Build e dry run de staging passaram; permanece o aviso existente de tamanho de chunks. YAML dos workflows analisado com js-yaml. Manifesto e referências de ícones conferidos no build; símbolo oficial inspecionado visualmente.

Nenhum deploy direto foi feito nesta rodada. O push inicia a publicação pelo GitHub; o resultado definitivo e o commit publicado devem ser conferidos no run e em `https://staging.mesiva.com.br/release.json`. Sem merge ou publicação em produção. A instalação efetiva do novo atalho no celular depende do dispositivo; atalhos antigos podem precisar ser recriados para usar o novo ícone.
