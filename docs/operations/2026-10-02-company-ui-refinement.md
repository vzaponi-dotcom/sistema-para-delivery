# Refinamento das telas de empresa e conta

Data: 2026-10-02. Continuação da homologação em staging; desenhos do menu e da lista administrativa aprovados pelo usuário nesta sessão.

## Alterações

- Menu: seção “Empresa atual”, nome/logo e troca no mesmo cartão; configurações da empresa em uma ação separada; edição da identidade permanece nas configurações. Administração Mesiva tem seção própria. Preferências locais do operador continuam acessíveis sem conceder configurações empresariais.
- Seletor e Minha conta: fundo e texto usam `--bg` e `--text` do tema, incluindo campos, cartões e títulos. Logo escuro e rótulos de seção acompanham o tema. Conteúdo de conta fica centralizado, com o Voltar alinhado.
- Navegação: abrir Trocar empresa usa `/empresas`, inclusive a partir de Minha conta. A conclusão da navegação admite apenas as rotas de contexto explicitamente fornecidas pela sessão; não desativa a guarda de rotas desconhecidas. O retorno de Minha conta ao seletor e o cancelamento do seletor voltam a funcionar.
- Administração: cabeçalho compacto com logo legível, busca e cadastro na mesma barra, colunas para empresa, gerente, acesso e convite, ação de detalhes e paginação discreta. Em telas menores, cartões identificam cada campo.
- Projeção informativa: empresas sem convite inaugural mostram um gerente ativo de conta verificada já vinculada, quando existente. O vínculo é correlacionado à própria empresa e identificado como `source: membership`. Usa o vínculo elegível mais antigo, sem afirmar que reconstruiu a identidade histórica do primeiro gerente. A interface informa “Vínculo existente” e “Sem convite pendente”. Não cria convite, modifica permissões ou altera contas.

## Evidência antes das correções

- Reprodução no navegador publicado: Seletor → Minha conta → Voltar permanecia em `/minha-conta`.
- No tema escuro, `.company-entry` tinha fundo `rgb(244,247,250)` e texto `rgb(16,44,77)`, enquanto os cartões tinham fundo `rgb(11,32,54)`. A mistura produzia baixo contraste e títulos ilegíveis.
- Testes RED de navegação reproduziram a abertura incorreta a partir de Minha conta e o retorno do contexto de empresas.
- Testes RED da projeção e da lista demonstraram a ausência do gerente vinculado e a afirmação incorreta de convite aceito.

## Verificação local

- Testes focados: 42/42, zero falhas, skips ou cancelamentos.
- Arquitetura: OK. Lint: exit 0, com avisos existentes. Build: exit 0, com aviso de tamanho de chunks. Bundle de staging dry run: OK, com multiempresa explicitamente ligado e preparo desligado.
- A primeira execução completa com concorrência 4 foi interrompida somente no processo filho de `CatalogWorkspace.test.js`, que ficou parado no ambiente de teste. Resultado da execução interrompida: 3444 passaram e 1 falhou por encerramento desse filho. O mesmo arquivo passou isoladamente, 3/3. A suíte completa foi repetida pelo comando normal do projeto.
- Repetição completa: `npm test`, 3445/3445, zero falhas, skips ou cancelamentos, 180159.1571 ms.

O resultado final da repetição e a verificação no navegador remoto serão registrados após a publicação autorizada em staging. Não houve merge nem publicação em produção.
