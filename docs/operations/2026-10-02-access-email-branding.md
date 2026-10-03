# Identidade visual dos e-mails de acesso

## Escopo aprovado

O usuário aprovou os esboços de convite e recuperação com o logo oficial da Mesiva e pediu que o aviso de staging não apareça em produção. O modelo fica versionado no código da aplicação; o Resend recebe o HTML e o texto simples montados para cada envio. Nenhum template hospedado no painel do Resend foi criado.

- Logo oficial em PNG público, cores da marca, cabeçalho, hierarquia de texto e botão principal de largura completa.
- Convite identifica a empresa e o perfil persistidos no banco. Não usa o perfil fornecido pelo cliente nem dados de outra empresa.
- Recuperação explica que a senha atual continua válida até concluir a troca.
- Validade, horário de Brasília, uso único e recomendação de usar o link mais recente permanecem presentes.
- Aviso de teste é condicional e aparece apenas em staging, no assunto, HTML e texto simples. O envio continua usando a origem pública configurada no ambiente.
- Tabelas de apresentação e estilos inline; logo com texto alternativo; HTML e texto simples. Sem dependências novas ou mudança no fluxo de autenticação.

## Verificação local

- RED observado: ausência do logo público e do perfil no convite enviado. Após implementação, 38/38 testes focados passaram, incluindo transporte, templates, identidade global e convites persistidos.
- Testes verificam que o URL do logo não recebe token, fragmento ou query; os três tipos de e-mail de produção não contêm aviso de staging; os envios de staging mantêm a identificação.
- Lint exit 0 com avisos existentes, arquitetura OK, build exit 0 com aviso existente de tamanho de chunks e bundle de staging dry run OK. Multiempresa explicitamente ligado e preparo desligado.
- Prévia usa o HTML real gerado pelo sistema com dados e token sintéticos. Em 375 px, convite e recuperação mediram 375 px de conteúdo, sem overflow horizontal; botão com 52 px de altura. Também inspecionados em desktop de 800 px.
- A primeira suíte completa ficou presa no processo de `src/domains/catalog/ui/Products.test.js`. Após encerrar somente esse filho, o relatório registrou 3450 aprovados e 1 falha: `EPERM` ao renomear o cache de dependências do Vite em Windows. O build havia rodado em paralelo à suíte; esses comandos compartilham o cache e não devem ser tratados como independentes para esta verificação. O arquivo passou isoladamente, 4/4. A suíte foi repetida pelo comando normal do projeto, sem build simultâneo.
- Repetição completa: `npm test`, **3451/3451**, zero falhas, skips ou cancelamentos, 180416.7181 ms.

Não foi enviado e-mail real nesta verificação. A renderização observada é a prévia no navegador; não equivale a uma validação em todos os clientes de e-mail, incluindo modos escuros automáticos.

## Publicação e evidência

Código `d2dd9e57`, versão do Worker de staging `163bc814-b52f-41a2-87cc-e2328d24686d`. Deploy preservou multiempresa true e preparo false. O asset PNG foi publicado no mesmo domínio de acesso, em `/brand/mesiva-email-logo.png`.

Depois da publicação, as prévias renderizaram esse URL público sem substituição local: logo carregado com largura natural de 729 px. O convite em desktop foi inspecionado com a configuração visual de produção, sem aviso; a recuperação em 375 px foi inspecionada com staging identificado e sem overflow. Capturas privadas `email-branded-invitation-desktop.png` e `email-branded-recovery-mobile.png` no arquivo local de evidências da homologação; contêm somente dados ilustrativos e token sintético. A prévia temporária foi fechada e o viewport normal restaurado.

PR 88 continua empilhada sobre a branch de feature. Não se declara nova CI aprovada. Sem merge, migração ou deploy em produção.
