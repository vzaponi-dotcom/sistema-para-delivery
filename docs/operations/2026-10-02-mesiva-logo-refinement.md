# Refinamento do logo Mesiva e slogan em português

Revisão de 02/10/2026 aprovada na conversa. O usuário solicitou curvas mais suaves no SVG, corrigiu a entrada na lateral direita e a assimetria do sol, e escolheu o slogan **Pessoas. Sabor. Evolução.**.

## Arquivos canônicos

- `public/brand/mesiva-logo.svg` e `mesiva-logo-dark.svg`: mesma geometria, cores de lettering e slogan adaptadas ao fundo. Contornos Bézier; sem imagem raster, texto SVG ou fonte carregada externamente.
- Sol reconstruído com controles espelhados no eixo x=113. Lateral direita do símbolo é um segmento vertical em x=221 entre y=76 e y=165, com curvas tangentes nas extremidades.
- Lettering redesenhado por letra com curvas contínuas, hastes retas e terminais arredondados, após a revisão visual do usuário. M equilibrado com eixo em x=326.5 e duas hastes de 26 unidades, após nova correção do usuário. Ponto do i regularizado e TM vetorizado a partir de Segoe UI bold.
- Removido o pequeno contorno sem área do traçado anterior. O desenho do garfo e da colher continua integrado ao símbolo.
- Slogan vetorizado em português, com acentos e pontuação. Contornos gerados a partir de Segoe UI regular, 19 unidades, tracking calculado para a assinatura sob o lettering. O SVG publicado contém os contornos; não distribui o arquivo da fonte nem depende dele para renderizar.

## Aplicação

- Logos claro/escuro cobrem as referências existentes no login, convites, recuperação, shell, escolha de empresa e administração.
- PNG do e-mail regenerado do SVG claro, 729×210 com fundo branco. Rodapé e texto alternativo dos e-mails atualizados em português.
- Logo incorporado ao PDF executivo regenerado do mesmo PNG; slogan do rodapé atualizado.
- SVGs de ícone e favicon derivados dos dois paths do símbolo. PNGs 32/180/192/512 e ICO regenerados. O manifesto e as URLs já existentes permanecem válidos.
- Mensagem “Sua operação no ritmo certo.” mantida na tela de acesso, conforme a proposta aprovada.

## Verificação

Inspeção das renderizações clara/escura ampliadas; geometrias das duas versões idênticas; rasterização de todos os recursos; dimensões dos PNGs; PNG do PDF idêntico ao PNG canônico do e-mail. Busca no código e nos recursos ativos confirmou a substituição do slogan inglês. As referências históricas nos documentos não foram reescritas.

Suíte completa local `npm test`: **3454/3454**, zero falhas, skips ou cancelamentos, 179915.94 ms. Lint e arquitetura passaram; permanecem avisos existentes de lint. Build e dry run de staging passaram; permanece o aviso existente de tamanho de chunks. Recursos vetoriais finais conferidos no build após o último ajuste das letras. A publicação usa apenas GitHub Actions. O resultado do run e o SHA público em `/release.json` serão registrados na PR 88 após a publicação, sem um commit posterior que inicie outro deploy.
