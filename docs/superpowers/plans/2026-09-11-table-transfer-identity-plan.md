# T1 — Plano isolado de identidade da transferência de comanda

> **For agentic workers:** Use `superpowers:executing-plans`. Execute somente T1, com os checkboxes abaixo; não iniciar a reorganização visual. Uma conferência final e uma revisão do PR, sem rodadas adicionais preventivas.

**Goal:** Uma confirmação de transferência só pode mover a comanda originalmente apresentada; nunca outra comanda que ocupe depois a mesma mesa.
**Architecture:** Capturar identidade na abertura do diálogo, transportá-la pelo callback/API e validá-la na escrita condicionada por negócio, origem, ID e situação aberta. Manter a resposta e as demais validações existentes.
**Tech Stack:** Stack/lockfile atuais; Node 22, `node:test`, SQLite em memória do teste existente e harness React atual.
**Spec:** seção 7.1 e A23 da `docs/superpowers/specs/2026-09-11-information-architecture-navigation-design.md`, revisão 2, commit `45e6565e7be34c3c07d905f562e8f69dcc85f948`.
**Base de código:** `99c1f04677b54243a43d470b743cdd16ac499154`. **Estado:** planejado; não implementado.

## Restrições globais

- PR exclusivo `fix/table-transfer-identity` → `integration/spec-a-navigation`. Preparação/worktree isolada conforme plano principal; nunca master ou worktree antiga.
- Somente transferência. Não alterar pagamento, fechamento de conta, cadastro, nomes/números, impressão, políticas ou navegação.
- Sem nova tabela, migration, biblioteca, rota ou serviço. Ajustar apenas o payload da rota existente. Sem merge/deploy automático.
- Falha externa é registrada, não corrigida incidentalmente. Testes de mudança de assinatura podem ser atualizados, mantendo as asserções originais.

## Contrato fechado para esta tarefa

| Camada | Contrato |
|---|---|
| Diálogo / App | `onTransfer(sourceTableId, destinationTableId, expectedTableTabId)`; ID capturado ao abrir a confirmação de A, não substituído por B num refresh. |
| Cliente HTTP | `transferTableTab(sourceTableId, destinationTableId, expectedTableTabId)` no endpoint existente `POST /api/tables/:sourceTableId/transfer`. |
| Payload | `{destinationTableId, expectedTableTabId}`. Ambos obrigatórios e não vazios. |
| Repositório | `transferOpenTableTab(db, businessId, sourceTableId, destinationTableId, now = new Date(), expectedTableTabId)`; preserva a posição atual do relógio para os testes. O novo argumento é obrigatório em comportamento. |
| Ausente/vazio | HTTP 400, `EXPECTED_TABLE_TAB_REQUIRED`, mensagem para atualizar a página e selecionar novamente; nenhuma mutação. Clientes antigos não recebem fallback inseguro. |
| Identidade obsoleta | HTTP 409, `TABLE_TAB_CHANGED`; não mover outra comanda nem recriar o atendimento. Atualizar a leitura na UI, sem repetir o POST. |
| Sucesso | Resposta atual `{tables, tableTab}`; `tableTab.id` igual ao esperado; mesma numeração/itens, nova mesa. |

Compatibilidade: entregar cliente e servidor juntos na mesma versão de teste. Navegador antigo que omite o ID recebe erro com instrução de recarregar; não inferir a intenção consultando a mesa no servidor. Isso é rejeição segura de cliente antigo, não compatibilidade transparente.

## Única tarefa T1

**Alterar:** `worker/tableRepository.js`, `worker/index.js`, `src/api/client.js`, `src/App.jsx`, `src/components/TableTransferDialog.jsx`, `worker/tableRepository.test.js`, `worker/index.test.js`.
**Criar:** `src/tableTransferIdentityUi.test.js`.
**Ajustes limitados de testes:** testes que chamam diretamente a assinatura alterada, localizados por `git grep -n -E 'transferOpenTableTab|transferTableTab|onTransfer' -- '*.test.js'`; somente fixture/payload/assinatura, sem remoção de cenários. Nenhum outro arquivo de produção.
**Consome:** `sourceTable.openTableTab.id`, sessão/negócio e SQL existentes. **Produz:** contrato acima protegido e evidência exigida por A23; nada de menu novo.

- [ ] Na nova worktree, executar a preparação e a linha de base do plano principal. Registrar HEAD; ler somente transferência, callers e seus testes.
- [ ] Acrescentar RED em `worker/tableRepository.test.js`, reutilizando `D1Sqlite`, `insertTable`, `insertOpenTableTab` e `now` já definidos nesse arquivo. Exemplo que falha por transferir B na implementação anterior:
```js
test('confirmação de A não transfere B que a substituiu', async () => {
  const db = new D1Sqlite()
  try {
    insertTable(db, {id:'s', name:'Mesa 1', sortOrder:1})
    insertTable(db, {id:'d', name:'Mesa 2', sortOrder:2})
    insertOpenTableTab(db, {id:'A', tableId:'s', tableIdentifier:'Mesa 1', tabNumber:37})
    db.exec("UPDATE table_tabs SET status='closed' WHERE id='A'")
    insertOpenTableTab(db, {id:'B', tableId:'s', tableIdentifier:'Mesa 1', tabNumber:38})
    await assert.rejects(
      transferOpenTableTab(db, 'biz-a', 's', 'd', now, 'A'),
      error => error.status === 409 && error.code === 'TABLE_TAB_CHANGED',
    )
    assert.equal(db.sqlite.prepare('SELECT table_id FROM table_tabs WHERE id=?').get('B').table_id, 's')
  } finally { db.sqlite.close() }
})
```
- [ ] Cobrir também a troca A→B **entre SELECT e UPDATE**, com interceptação apenas no adapter SQLite de teste antes do `.run()` da transferência. Não introduzir hooks de teste em produção. Acrescentar HTTP sem ID/vazio/ID de outro negócio e UI com prop de mesa atualizada após abrir o diálogo.
- [ ] Executar `node --test worker/tableRepository.test.js worker/index.test.js src/tableTransferIdentityUi.test.js`; guardar os casos RED. Infraestrutura que não inicia não vale como evidência do bug.
- [ ] Implementar captura estável de `expectedTableTabId` no diálogo e transportar pela mesma cadeia de callbacks, sem consultar “a comanda atual” no clique final. Desabilitar confirmação obsoleta; mesmo que escape do cliente, o servidor rejeita. Evitar duplo envio; exibir conflito e exigir nova intenção explícita.
- [ ] Validar payload e identidade na rota/repositório. Na escrita, conservar condições atuais e acrescentar vínculo ao ID esperado; condições de mesa de destino ativa/livre devem valer na escrita, usando a proteção existente e predicado quando necessário. Predicado obrigatório de origem:
```sql
WHERE business_id = ? AND table_id = ? AND id = ? AND status = 'open'
```
  Os binds são negócio autenticado, origem confirmada e `expectedTableTabId`. Não basta usar o ID encontrado por um SELECT tardio. Ausência do esperado/alteração de origem não tenta outra comanda. Retornar a identidade escrita; zero linhas é conflito, não sucesso.
- [ ] GREEN dos mesmos testes, cobrindo sucesso, encerramento, substituição em ambos os momentos, já transferida, origem/destino iguais, destino ocupado/inativo inclusive alteração concorrente e negócio incorreto. A UI envia exatamente o ID mostrado e não faz retry automático em 409.
- [ ] Executar `npm test`, `npm run lint`, `npm run build`, ambos os dry-runs do Worker e `npm run d1:migrate:local`, como no gate final do plano principal. Nenhuma chamada ao D1 remoto. Conferir uma vez o diff e os arquivos permitidos.
- [ ] Commit `fix: bind table transfer to expected tab identity`; push e abrir PR draft para integração. Reportar HEAD, testes e quebra segura de compatibilidade. Após uma revisão de código satisfatória, pedir autorização para integrar; não iniciar A1 nem fazer merge por conta própria.

## Evidência de conclusão

T1 só está concluído quando os testes demonstram a preservação de identidade e o PR/commit está disponível. Registrar no handoff o SHA incorporado à integração; A6/A23 não podem ser aprovados apenas porque o plano existe. Um teste de SQLite em memória não substitui a verificação HTTP nem a homologação de duas sessões em staging antes da liberação da funcionalidade.

Fora desta tarefa: implementar a Spec A, reformular auth, reescrever repositories, modificar políticas de comanda ou adicionar fila de transferências. Sem uma dessas mudanças como pré-condição, concluir e parar.
