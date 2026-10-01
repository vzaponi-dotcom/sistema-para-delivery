# Access UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar as cinco telas de acesso aprovadas e validar responsividade.

**Architecture:** Componentes compartilhados para moldura de autenticação e campo de senha. Equipe e atividades mantêm API e hook de ownership, mudando apresentação e adicionando controles locais aprovados. Estilos específicos convivem com os tokens e primitives atuais.

**Tech Stack:** React 19, Vite, CSS, Node test runner e harness existente.

**Spec:** `docs/superpowers/specs/2026-10-01-access-ui-design.md`

## Global Constraints

- Sem dependências novas ou código copiado do 21st.dev; referência visual aprovada.
- Preservar contratos/ownership/permissões; sem Worker ou migrations.
- Token efêmero, sem URL/persistência; sem senha em logs.
- Operador padrão; compartilhado padrão 12h e pessoal sete dias.
- Claro/escuro e 320/390/768/1280px; controles de toque 44px.
- Não executar merge ou deploy de produção.

## Review Focus

- Resposta assíncrona após troca de sessão não revela dados/convite: testes existentes de ownership de TeamAccess/MyAccount.
- Senhas divergentes não enviam mutação: confirmação em InvitationAccept e MyAccount.
- Cancelar desativação/reset não revoga acesso: teste de confirmação de equipe.
- Busca sem resultados e reabrir convite não reaproveitam segredo: filtro e lifecycle em TeamAccess.
- IDs de recurso e filtros paginados não burlam resolvedor: ActivityLog existente + referência recolhida.

### Task 1: Autenticação e minha conta

**Files:** shared/ui/AccessAuthLayout.jsx + CSS; shared/ui/PasswordField.jsx + CSS; app/shell/LoginScreen.jsx; domains/access/ui/InvitationAccept.jsx e MyAccount.jsx; testes adjacentes.

**Interfaces:** Consome props atuais; produz AccessAuthLayout({children,label}) e PasswordField({label,hint,...inputProps}). Login usa link público de ativação, sem exigir router para render isolado. Confirmação nunca enviada à API.

- [ ] Escrever testes de mostrar senha/convite público, confirmação divergente/igual e sucesso de ativação explícito.
- [ ] Executar testes antes do código; esperar falha nos comportamentos ausentes.
- [ ] Implementar componentes e as três telas aprovadas, preservando runtime e modos de login.
- [ ] Executar testes adjacentes; esperar todos passarem. Commit das alterações.

### Task 2: Lista compacta de equipe

**Files:** domains/access/ui/TeamAccess.jsx, access.css e TeamAccess.test.js.

**Interfaces:** Consome listUsers/createUser/updateUser/resetPassword, useAccessRequest; dados autoritativos preservados. Produz filtros locais e confirmação de ações sem endpoint novo.

- [ ] Testar convite por ação explícita, default operador no payload, confirmação/cancelamento, filtro por nome/estado e segredo descartado. Atualizar interação dos testes antigos para abrir convite/confirmar ação.
- [ ] Executar; esperar falha pelos controles ausentes/default anterior.
- [ ] Implementar lista, menu, modal de convite, confirmações e resultado efêmero com cópia e passos.
- [ ] Executar testes de equipe/rotas/sessão; esperar verde. Commit.

### Task 3: Atividades e validação visual

**Files:** domains/access/ui/ActivityLog.jsx, access.css, ActivityLog.test.js; QA de acesso.

**Interfaces:** Mantém filtros e cursor opaco; resolvedor continua único autorizador de abertura de recurso.

- [ ] Testar referência recolhida sem IDs expostos por padrão e abertura autorizada preservada.
- [ ] Executar; esperar falha porque ID aparece diretamente.
- [ ] Implementar filtros compactos, lista agrupada por dia, referência em details e estados vazios/erro.
- [ ] Executar testes de acesso, suite completa, architecture/lint/build; esperar verde.
- [ ] Inspecionar código real com fixtures locais no navegador, claro/escuro desktop/celular e salvar screenshots. Registrar limitações concretas e commit.
- [ ] Revisão independente das mudanças de UI; uma rodada de correção se necessária. Atualizar PR 85 com as mudanças e evidências; sem merge.
