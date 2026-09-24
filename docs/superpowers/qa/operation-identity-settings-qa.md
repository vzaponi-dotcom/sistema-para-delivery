# Mesiva — Identidade da operação — QA / Closure

**Data:** 24/09/2026  
**PR:** #66  
**Branch:** `feature/operation-identity-settings`  
**Base inicial:** `master@75966e5c585c85823e409d5bb7cbb75a557af2fa`  
**Último SHA executável homologado:** `134a6d15cfe375915ceb144a9154e585a66008fb`  
**Produção:** NÃO DEPLOYADA  
**Merge:** NÃO EXECUTADO

## Resultado

A implementação da Identidade da operação está homologada em staging sem FAIL manual conhecido.

Resumo da matriz da spec §24:

- **30 PASS**
- **0 FAIL**
- **4 BLOCKED**
- **0 PENDING**

Os BLOCKEDs são documentais de homologação manual; nenhum deles representa regressão conhecida:

1. upload JPG — não executado manualmente por decisão do responsável do produto; cobertura automatizada permanece ativa;
2. upload WebP — não executado manualmente por decisão do responsável do produto; cobertura automatizada permanece ativa;
3. erro controlado de upload — não reproduzido manualmente em staging; caminhos de formato/bytes inválidos permanecem cobertos por testes automatizados;
4. capability restrita/read-only — staging não possui identidade adequada para reproduzir esse perfil; cobertura automatizada de capability/read-only permanece ativa.

## Evidência TDD por task

| Task | RED | Validate RED | GREEN final | Validate GREEN |
|---|---|---:|---|---:|
| 1 — migration 0030 / D1 gate | `13cecf43dcede152edac0e3a5115a293176951c9` | `35951222938` | `777b5810706308eb35f6d8cee9b2b642d86ef559` | `35951510098` |
| 2 — parser / repository | `cffe30fe8d4e79e74dae59de8bd68fa36b0b8cf5` | `35952206215` | `a68ae4e45f6c5f26bafaa4ba2fdd850b8afcee0e` | `35952375607` |
| 3 — capabilities / GET | `d5c8072790f6c8422845b64ebe0643edfdb06834` | `35953156179` | `3c93a75bd3faa9c46af6645764515de40d2e1571` | `35953263650` |
| 4 — R2 storage / binary validation | `3f8c1ef76b6096715789476dd8a8382aa118e935` | `35954748507` | `5027b5decfa4280c732d993f4b3bc29471cdc688` | `35954923562` |
| 5 — multipart / compensation / logo GET | `52fef0c0d7964e99f8576eff23ac2c3e9a59952e` | `35955481228` | `f9a60d0783b6435607ed700bf3640c79ee073c21` | `35955683084` |
| 6 — bootstrap / print invariants | `2274d110b95a0b5a9d0c4bc8281511c2468a576b` | `36004417830` | `f27c4aecf38206a9a6ee7e2a34fe7308f6634457` | `36005002883` |
| 7 — adapter / imagem / transient | `6250f42754f59768d65677484b1b2721a522e25d` | `36007391833` | `f8dd933dd53d0b0e2e642cbf6aa1680be9266c58` | `36007680659` |
| 8 — navegação / tela | `668e7723ae18a909bf1605e31cb090dc13b87e57` | `36008643328` | `05d07d9ced402ff92fbab83a9d34e1faa1a6c9d0` | `36009211216` |
| 9 — shell / sync sem F5 | `a2f468e039c323e794da667036dab5b51b556bfd` | `36009948050` | `20b275a2c46a21dbd85c6e26ca4d65f6b97206d4` | `36010387366` |
| 10 — conflito / offline / lifecycle | `9d674b55000642f1472412339b51d19ef661de3a` | `36011542596` | `516f099db11a858ef9c3a87f40ecd0a551ad9581` | `36011959965` |
| 11 — bindings / infra gates | `896d064a2106cac0d9ac7cd6ab46ed1215555e67` | `36013069467` | `bc631c399ada251c7643379ebab204bce1eb94f4` | `36013284060` |
| 12 — staging automation | `f3d5d0c3ee99f3bf1caab2a456fba485ebd4c0d6` | `36016020822` | `6ae7fcebff41aba63ad5c97bb2eaf33da9958c68` | `36016221164` |

## Correções encontradas durante homologação

### Botão Voltar compartilhado

- RED: `231ddd9fba556691777c6b3642c6e5d3691123e3`
- Validate RED: `36019378947`
- GREEN: `222d2e5da118ecfe7acb976cbbfec960aad70d93`
- Validate GREEN: `36019533664`
- Deploy staging: `36019526587`
- Resultado manual: PASS

A correção foi aplicada no componente compartilhado de Configurações e não somente na tela de Identidade.

### Máscaras e validações dos campos

- RED: `f43cefe2d4997dc2ab031e4831bb0890453d2f28`
- Validate RED: `36026297314`
- implementação: `7843b066bdee2192552478403491bdc7594637d0`
- alinhamento final de fixtures: `6cce955b293a0f1b7a8a4a2aa0a3fb26d4232763`
- Validate final: `36026772119`
- Deploy staging: `36026764122`
- Resultado manual: PASS

Sem dependência nova. Foram reutilizados `SystemSelect`, `BottomSheet` e formatters existentes.

### Atalho do menu da operação para Identidade

- RED inicial: `35aea9e71ed5d7bebd737aa66e6fa96983e4c591`;
- alinhamento do harness do RED: `0ce3f08d3cec497de5d35dc61b2324fe13908e59`;
- Validate RED corrigido: `36031716898` — FAILURE esperada;
- GREEN: `134a6d15cfe375915ceb144a9154e585a66008fb`;
- Validate GREEN: `36031906190` — SUCCESS;
- Deploy staging: `36031899488` — SUCCESS;
- Resultado manual: PASS.

Com `business.profile.view`, o cabeçalho do menu da operação (nome + “Operação atual”) é um atalho direto para `settings-business-profile`. Sem a capability, permanece somente informativo.

## Staging final homologado

Deploy staging final da implementação:

- run: `36031899488`
- SHA: `134a6d15cfe375915ceb144a9154e585a66008fb`
- Worker Version ID: `cc7bc0cd-39e7-4606-b016-229c70ea6ba1`
- login smoke: HTTP 200
- deep link `/configuracoes/identidade`: HTTP 200 / SPA shell + assets
- R2 staging: `mesiva-business-assets-staging`
- migrations staging: nenhuma pendente nesse redeploy
- produção: intocada

A migration `0030_business_profiles.sql` havia sido aplicada no primeiro deploy da Task 12, run `36016214301`, attempt 2.

## Matriz manual da spec §24

| # | Caso | Resultado | Evidência / observação |
|---:|---|---|---|
| 1 | card Identidade da operação aparece | PASS | acesso manual à nova superfície em staging |
| 2 | abrir por clique e deep link | PASS | navegação manual + deep-link smoke HTTP 200 |
| 3 | nome atual carregado | PASS | nome oficial exibido na tela |
| 4 | salvar somente nome | PASS | homologado manualmente |
| 5 | nome muda no shell sem F5 | PASS | homologado manualmente |
| 6 | reload mantém nome | PASS | homologado manualmente |
| 7 | outro dispositivo vê nome após refresh/focus | PASS | homologado manualmente |
| 8 | upload PNG | PASS | logo PNG utilizado na homologação |
| 9 | upload JPG | BLOCKED | não executado manualmente por decisão do responsável; cobertura automatizada |
| 10 | upload WebP | BLOCKED | não executado manualmente por decisão do responsável; cobertura automatizada |
| 11 | preview antes de salvar | PASS | preview local observado durante fluxo de logo |
| 12 | Cancelar não publica alteração de logo | PASS | descarte/cancelamento preservou estado confirmado |
| 13 | salvar logo | PASS | logo confirmado apareceu no shell/menu |
| 14 | reload mantém logo | PASS | estado confirmado permaneceu disponível durante homologação |
| 15 | remover logo | PASS | homologado manualmente |
| 16 | fallback para iniciais/ícone | PASS | fallback `AS` homologado |
| 17 | telefone | PASS | máscara/validação homologadas |
| 18 | endereço completo | PASS | campos e persistência homologados |
| 19 | endereço parcial | PASS | opcionalidade homologada |
| 20 | conflito em dois dispositivos/abas | PASS | sem overwrite silencioso |
| 21 | offline | PASS | edição/preview permitidos; Save bloqueado |
| 22 | erro controlado de upload quando reproduzível | BLOCKED | não reproduzido manualmente; cobertura automatizada de erros permanece ativa |
| 23 | desktop claro | PASS | homologado |
| 24 | desktop escuro | PASS | homologado |
| 25 | mobile claro | PASS | homologado |
| 26 | mobile escuro | PASS | homologado |
| 27 | tema Clássico | PASS | homologado |
| 28 | tema Mesiva | PASS | homologado |
| 29 | login continua Mesiva | PASS | homologado |
| 30 | Kitchen TV continua funcional | PASS | homologado; logo da operação não foi introduzido |
| 31 | novo ticket usa nome novo | PASS | homologado pela prévia do job |
| 32 | print job existente não é reescrito | PASS | snapshot antigo permaneceu imutável |
| 33 | logout/login não ressuscita draft | PASS | homologado |
| 34 | capability restrita/read-only | BLOCKED | staging sem identidade adequada; não convertido em PASS fictício |

## Invariantes finais

- Mesiva continua sendo a marca do produto.
- A operação continua sendo entidade separada.
- `businesses.name` permanece fonte oficial do nome.
- Logo não entra em ticket/PDF/ESC-POS nem Kitchen TV nesta V1.
- Print jobs existentes mantêm snapshot imutável.
- Nenhum Blob/base64 é persistido no D1 ou em fila offline.
- R2 permanece privado.
- Bucket de staging e produção permanecem isolados.
- Bucket R2 de produção não foi criado por esta implementação.
- Nenhuma migration remota de produção foi executada.
- Nenhum deploy de produção foi executado.

## Gate de merge

Task 13 está fechada com **30 PASS / 0 FAIL / 4 BLOCKED / 0 PENDING**.

Melhoria adicional do atalho no menu da operação: **PASS manual** em staging no SHA executável `134a6d15cfe375915ceb144a9154e585a66008fb`.

O responsável do produto autorizou explicitamente o merge em 24/09/2026. Produção continua separada e não é executada por este fechamento.
