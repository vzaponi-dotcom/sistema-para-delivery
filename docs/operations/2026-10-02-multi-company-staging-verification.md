# Verificação multiempresa — 2026-10-02

Branch: `feature/issue-87-multi-company-onboarding`. Base: `003a898bac19958089eabab6aedf876adb231763`, sobre a implementação da PR #85. Ambiente remoto previsto: `https://staging.mesiva.com.br`.

Commit do código verificado: `8396b5f242a252d0836d024de3f8699bdc8ccd99`. A `master` remota atual (`aed142da`) está contida na branch.

## Evidência local

- Tasks 1–13 implementadas com testes de contratos, concorrência, autorização, convites, isolamento, sessões e interface.
- Fluxo integrado real de criação de duas empresas, primeira ativação, aceite por conta existente sem trocar senha, perfis diferentes, proteção do último gerente, desativação em uma empresa e recuperação global: passou.
- Continuidade da interface após resposta perdida: uma UUID e um payload; navegação e saída bloqueadas até reconciliação; nenhuma leitura do bootstrap operacional no painel: passou.
- Arquitetura frontend e build: passaram. Lint sem erros; há avisos, inclusive de dependências de hooks e tamanho do bundle.
- Migrações 0038/0039 aplicadas ao D1 local com Wrangler 4.128.0. A tentativa inicial revelou o limite D1 de termos de SELECT composto; o preflight foi dividido sem remover verificações. A repetição executou 85 comandos da 0039 com sucesso.
- O início real do Worker revelou a exportação de uma constante na entrada. `worker/entry.js` expõe somente o handler; o runtime local iniciou em `127.0.0.1:4187`. O contrato da entrada foi testado antes/depois da correção.
- Primeira suíte completa: 3418 testes, 3414 passaram; quatro verificações históricas de nomes no código de impressão falharam. As verificações foram atualizadas para os clientes de contexto mantendo suas regras; os 24 testes relacionados passaram. A segunda execução passou 3418/3418. Após as seis correções da revisão, a execução final passou **3427/3427**, sem skips/cancelamentos (178940.7327 ms); inclui o contrato da entrada do Worker e as novas regressões. Não é a contagem da PR #85.

- Revisão independente única concluída no HEAD `fc4c4b62`: seis Important, nenhum Critical. Os seis foram reproduzidos RED e corrigidos GREEN, com gate completo depois; [relatório e resolução](2026-10-02-multi-company-final-review.md).
- Bundles finais com Wrangler 4.128.0: staging/produção passaram; flags multiempresa e preparo continuam `false`. D1 local: todas as 39 migrações aplicadas, nenhuma restante.
- Interface local com o Worker real e conta sintética: painel desktop, nomes longos e formulário em tela móvel inspecionados; sem rolagem horizontal. A observação móvel final teve largura de conteúdo/viewport 375/375 px. Não substitui homologação de dispositivos físicos.

## Checkpoints remotos pendentes

Nenhum deploy, migração remota 0038/0039 ou corte multiempresa foi realizado por esta implementação até este registro. Flags padrão de staging e produção continuam `false`.

O procedimento privado exige `RESEND_API_KEY`, `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` no processo administrativo. A chave já cadastrada no Worker não fica disponível automaticamente nesse processo e não deve ser extraída. Após configuração privada, seguir [o roteiro](multi-company-staging.md), incluindo backup/bookmark e logins reais antes da finalização.

Envio e recebimento de e-mails reais, TV em duas empresas e impressão física não estão comprovados pelo teste local. Impressão física depende de equipamento; homologação de e-mails usa somente destinatários autorizados. Nenhum e-mail externo foi enviado pelos testes automatizados ou pela demonstração local.

Merge e publicação em produção não fazem parte desta entrega autorizada.

## Entrega revisável

[PR #88](https://github.com/vzaponi-dotcom/sistema-para-delivery/pull/88) aberta em rascunho e empilhada sobre a [PR #85](https://github.com/vzaponi-dotcom/sistema-para-delivery/pull/85). Issue #87 permanece aberta para o aceite remoto. O workspace desta execução é preservado porque o checkpoint remoto da Task 14 ainda está pendente.

## Gate adicional detectado no GitHub

No run `37062660924`, os oito shards passaram; o gate Spec B D1 comparava o schema de impressão completo contra a versão anterior e rejeitou os nove triggers aditivos previstos na 0039. A comparação agora mantém os quatro snapshots de dados e todos os objetos anteriores exatamente iguais, e exige os nove triggers nomeados com SQL correspondente à migração revisada. Testes provam rejeição de histórico/schema alterado e guards ausentes, enfraquecidas ou extras.

Depois da correção: **3429/3429** na suíte completa, zero falhas/skips/cancelamentos, 184661.5527 ms; lint passou. O **gate Spec B no D1 local real** passou instalação limpa, upgrade, preservação de histórico/referências e os nove cenários de persistência. O gate de perfil da operação também passou clean install/upgrade. A mudança está restrita à validação de migrações; o código da aplicação continua o verificado em `8396b5f2`. A validação GitHub é repetida no novo HEAD, com resultados ligados na PR #88.
