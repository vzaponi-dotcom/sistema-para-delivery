# Menu organizado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar o menu de conta e operação aprovado e publicá-lo em staging.

**Architecture:** Manter OperationMenu como proprietário de abertura, navegação e callbacks. Compartilhar o conteúdo entre popover e BottomSheet existente usando useMediaQuery, sem alterar componentes compartilhados.

**Tech Stack:** React19, CSS com tokens atuais, node:test/react-test-renderer, Vite.

**Spec:** docs/superpowers/specs/2026-10-01-operation-menu-design.md

## Global Constraints

- Nenhuma nova dependência, API, permissão ou alteração de autenticação.
- Alvos de toque de pelo menos 44px.
- Celular até 820px; desktop popover de até 358px.
- Preservar bloqueio de troca/saída durante gravações e navegação oficial.
- Publicar na PR85 e staging já autorizados. Merge e produção ficam pendentes.

## Review Focus

- Pessoa sem perfil conhecido: não apresentar Gerente por suposição; teste de perfil desconhecido.
- Operador com preferences.local: manter preferências/configurações autorizadas sem identidade; teste de permissões atual e novo fluxo mobile.
- Mudança de largura com painel aberto: manter uma única superfície e fechamento utilizável; teste de transição mobile→desktop.
- Sobre após fechar painel: foco deve voltar ao acionador principal; teste de fechamento e conferência no navegador.
- Nomes longos e janela baixa: conteúdo completo acessível por rolagem e sem estouro; conferência visual 320/390/desktop, ambos os temas.

### Task 1: Menu organizado responsivo

**Files:**
- Modify: src/app/shell/OperationMenu.jsx
- Modify: src/app-top-bar.css
- Test: src/app/shell/OperationMenu.test.js
- Document: docs/superpowers/qa/2026-10-01-operation-menu-qa.md

**Interfaces:**
- Consumes: OperationMenu props existentes; useMediaQuery('(max-width: 820px)'); BottomSheet({open,title,onClose,children}); resolveNavigationEntry; requestNavigation(id).
- Produces: mesmo OperationMenu e mesmos destinos/callbacks, novo conteúdo visual e superfície responsiva.

- [x] Step 1: Adicionar testes que abrem o painel em mobile, navegam pelo dispositivo e fecham o BottomSheet; transição de largura deixa uma superfície; Sobre fecha e restaura foco; perfil desconhecido não vira Gerente. Ajustar seletores antigos para a ação explícita Editar identidade preservando a proibição para não autorizados.
- [x] Step 2: Executar `node --test src/app/shell/OperationMenu.test.js src/app/shell/AppTopBar.test.js`; Expected: novas regressões falham porque ainda não existe painel mobile/ação rotulada.
- [x] Step 3: Implementar conteúdo por seções, cabeçalho pessoal e ação Editar identidade. Popover desktop sem semântica de menu ARIA incompleta, foco inicial e Escape; BottomSheet mobile existente com callbacks estáveis. CSS escopado para cabeçalhos, ações, nomes longos e altura limitada.
- [x] Step 4: Executar comando focado novamente; Expected: todos passam. Conferir visualmente 320/390/desktop, claro/escuro, foco e rolagem. Executar `npm test`, `npm run test:architecture`, `npm run lint`, `npm run build`; Expected: zero falhas, avisos existentes registrados.
- [ ] Step 5: Registrar QA e commit `feat(ui): organize account and operation menu across devices`. Revisar diff com contexto novo, corrigir achados importantes em uma passagem, publicar PR e staging existentes e conferir a superfície publicada.
