# T1 — Plano isolado de identidade da transferência de comanda

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`. Executar somente T1. Uma conferência do diff e uma revisão do PR; sem rodadas preventivas adicionais. Não iniciar A1 automaticamente.

**Goal:** Transferir somente a comanda originalmente confirmada, nunca a substituta que passou a ocupar a mesma mesa.
**Architecture:** Capturar o ID ao abrir o diálogo, transportá-lo na API existente e condicionar a escrita por identidade, negócio, origem aberta e destino ativo/livre. Preservar a resposta atual.
**Tech Stack:** Stack/lockfile atuais; Node 22, `node:test`, `D1Sqlite` em memória e harness React existentes.
**Spec:** seção 7.1 e A23 de `docs/superpowers/specs/2026-09-11-information-architecture-navigation-design.md`, revisão **2.1**, commit `cc43a6914f92a8af722d413d7e06c256ba68b88d`.
**Base:** `99c1f04677b54243a43d470b743cdd16ac499154`. **Estado:** plano para aprovação; não implementado.

## 1. Limites

- PR exclusivo `fix/table-transfer-identity` → `integration/spec-a-navigation`; worktree nova conforme plano principal. Nunca master ou worktree antiga suja.
- Somente identidade da transferência. Não mudar pagamento, fechamento, cadastro, números, itens, impressão ou navegação.
- Sem migration, tabela, biblioteca, rota ou serviço novo. A única alteração externa é o payload da rota existente. Sem merge/deploy automático.
- Testes de assinatura podem ser adaptados sem remover cenários. Descoberta fora do escopo: registrar evidência/impacto e parar o dependente, sem correção oportunista.

## 2. Contrato fechado

| Camada / resultado | Contrato |
|---|---|
| Diálogo/App | `onTransfer(sourceTableId,destinationTableId,expectedTableTabId)`; ID capturado ao abrir o diálogo, não descoberto no clique final. |
| Cliente HTTP | `transferTableTab(sourceTableId,destinationTableId,expectedTableTabId)`. |
| Rota existente | `POST /api/tables/:sourceTableId/transfer`, body `{destinationTableId,expectedTableTabId}`. Strings não vazias obrigatórias. |
| Repositório | `transferOpenTableTab(db,businessId,sourceTableId,destinationTableId,now = new Date(),expectedTableTabId)`. Preservar a posição do relógio, mas exigir o novo argumento em runtime. |
| Identidade ausente/vazia/tipo inválido | HTTP 400, `EXPECTED_TABLE_TAB_REQUIRED`; orientar recarregar a página e selecionar novamente. Não escrever. |
| Comanda não corresponde à origem/negócio/estado aberto | HTTP 409, `TABLE_TAB_CHANGED`; não revelar outro negócio nem procurar substituta. |
| Destino inválido | Manter os códigos atuais de destino ocupado, inativo, inexistente ou igual à origem; revalidar condições na escrita. |
| Sucesso | `{tables,tableTab}`, com `tableTab.id` igual ao esperado; mesmos número, itens e vínculos. |

Entregar cliente e servidor juntos em staging. Cliente antigo sem ID recebe recusa com instrução de recarregar; não usar fallback inseguro. Não implementar modo de compatibilidade que transfira “a comanda atual”. Atualizar todos os callers existentes, não só o botão novo da futura Spec A.

## 3. Única tarefa T1

**Alterar produção:** `worker/tableRepository.js`, `worker/index.js`, `src/api/client.js`, `src/App.jsx`, `src/components/TableTransferDialog.jsx`.
**Alterar testes:** `worker/tableRepository.test.js`, `worker/index.test.js`, `src/api/tableTabClient.test.js`.
**Criar:** `src/tableTransferIdentityUi.test.js`.
**Exceção de testes:** localizar callers com `git grep -n -E 'transferOpenTableTab|transferTableTab|onTransfer' -- '*.test.js'`; ajustar somente fixtures, assinatura e expectativas do novo contrato. Nenhum outro arquivo de produção.

- [ ] Fazer preparação da worktree/linha de base do plano principal. Registrar HEAD e ler transferência/callers/testes. Não fazer outra auditoria do sistema.
- [ ] RED em `worker/tableRepository.test.js`, reutilizando `D1Sqlite`, `insertTable`, `insertOpenTableTab` e `now` já definidos:
```js
test('confirmação de A não transfere B que a substituiu', async () => {
  const db = new D1Sqlite()
  try {
    insertTable(db, {id:'s',name:'Mesa 1',sortOrder:1})
    insertTable(db, {id:'d',name:'Mesa 2',sortOrder:2})
    insertOpenTableTab(db, {id:'A',tableId:'s',tableIdentifier:'Mesa 1',tabNumber:37})
    db.exec("UPDATE table_tabs SET status='closed' WHERE id='A'")
    insertOpenTableTab(db, {id:'B',tableId:'s',tableIdentifier:'Mesa 1',tabNumber:38})
    await assert.rejects(
      transferOpenTableTab(db,'biz-a','s','d',now,'A'),
      error => error.status === 409 && error.code === 'TABLE_TAB_CHANGED',
    )
    assert.equal(db.sqlite.prepare('SELECT table_id FROM table_tabs WHERE id=?').get('B').table_id,'s')
  } finally { db.sqlite.close() }
})
```
- [ ] Cobrir a substituição também entre SELECT e UPDATE: interceptar somente o adapter SQLite de teste antes do `.run()` da transferência. Nenhum hook de teste no código de produção. Teste de UI atualiza props para B depois de abrir A e verifica que não é enviada uma intenção de B. Teste HTTP cobre ID ausente/vazio/incorreto; cliente envia exatamente o ID capturado.
- [ ] Rodar `node --test worker/tableRepository.test.js worker/index.test.js src/api/tableTabClient.test.js src/tableTransferIdentityUi.test.js`; registrar os novos casos RED. Falha de ambiente não é demonstração do bug.
- [ ] Capturar identidade estável no diálogo e transportar pela cadeia atual. Verificar se ainda é a comanda exibida antes de confirmar; invalidar intenção obsoleta, sem retarget. Bloquear clique duplo por ref enquanto envia. Erro 409 atualiza leitura existente no App e exige nova intenção; não reenviar POST.
- [ ] Validar payload na rota e argumento no repositório. Manter validações atuais; a própria escrita acrescenta vínculo ao esperado:
```sql
WHERE business_id = ? AND table_id = ? AND id = ? AND status = 'open'
```
  Esses binds são negócio da sessão, mesa de origem e **ID recebido da intenção**. Somar predicado de destino existente, pertencente ao mesmo negócio e ativo na escrita; conservar `NOT EXISTS`/índice de comanda aberta para destino livre. Um SELECT prévio ou ID consultado tardiamente não basta.
- [ ] Zero linhas alteradas é conflito/condição inválida, não sucesso. Carregar a resposta pelo ID esperado, nunca pela nova ocupante da origem. Não alterar comanda/itens/número para compensar erro. GREEN nos mesmos testes e em callers adaptados.

## 4. Casos obrigatórios de aceite

| Caso | Resultado necessário |
|---|---|
| Comanda A válida, destino livre/ativo | A transferida; ID/número/itens preservados; resposta identifica A. |
| A substituída por B antes da requisição | 409; B continua na origem; nenhum efeito em outro atendimento. |
| Substituição entre leitura e escrita | B não se move; nenhum sucesso falso. |
| Origem encerrada, transferida ou ID de outro negócio | Recusa; não inferir alvo alternativo. |
| Destino ocupado ou inativado antes da escrita | Recusa sem mover A; manter códigos correspondentes. |
| ID ausente/vazio/inválido e cliente antigo | 400 explicativo; zero mutações. |
| UI recebe refresh após abrir diálogo; clique duplo | Não troca identidade capturada; no máximo uma solicitação por intenção. |

- [ ] Rodar gates: `npm test`, `npm run lint`, `npm run build`, ambos os dry-runs do Worker e `npm run d1:migrate:local`, nos comandos da A9. Nenhum D1 remoto. Uma conferência do diff/arquivos permitidos.
- [ ] Commit `fix: bind table transfer to expected tab identity`; push. Abrir PR draft para integração e reportar HEAD, RED/GREEN e quebra segura do cliente antigo. CI não dispara automaticamente em todo PR para integração: registrar gates locais ou dispatch autorizado existente, nunca presumir CI verde.
- [ ] Uma revisão do PR; corrigir somente falha concreta. Pedir autorização para incorporar à integração. Registrar o SHA incorporado no handoff. Não iniciar A1 nem publicar em produção.

**Concluído** exige testes e commit disponíveis; **incorporado** exige commit na base de A; **homologado** exige duas sessões de staging na A9. Esses estados não são intercambiáveis. A23 não é aceito apenas com mocks de UI ou este documento. Fora de T1: engine nova, fila de transferências, auth, perfis, refatoração de repositories e Spec A visual.
