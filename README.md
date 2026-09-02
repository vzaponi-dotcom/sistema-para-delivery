# Amor & Sabor — Gestão do Delivery

Aplicação web em React/Vite com backend Cloudflare Worker, persistência central em D1 e acesso protegido por PIN compartilhado.

## Arquitetura

```text
React / Vite
    ↓ HTTPS (mesma origem)
Cloudflare Worker /api/*
    ↓
Cloudflare D1
```

O D1 é a fonte oficial de clientes, produtos, pedidos, pagamentos e movimentações. Dados de negócio não dependem mais de `localStorage`, então computador e celular passam a enxergar a mesma base após carregar os dados do servidor.

## Requisitos

- Node.js 22
- npm
- Conta Cloudflare autenticada no Wrangler para operações locais/remotas de D1 e deploy

## Instalação

```bash
npm ci
```

## Desenvolvimento do frontend

```bash
npm run dev
```

## Banco D1 local

Aplique a migration local:

```bash
npm run d1:migrate:local
```

Para inspecionar as tabelas:

```bash
npx wrangler d1 execute amor-e-sabor-delivery --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

## Configurar um PIN local

O PIN nunca deve ser salvo em arquivo, commitado no Git ou incluído no bundle do frontend. O script imprime somente o verificador PBKDF2.

```bash
read -s AMOR_PIN
PIN="$AMOR_PIN" node scripts/generate-pin-hash.mjs
unset AMOR_PIN
```

Copie apenas o verificador impresso e grave-o na tabela `auth_credentials` do D1 local para `business_id = 'amor-e-sabor'`.

Exemplo SQL:

```sql
INSERT INTO auth_credentials (business_id, pin_hash, created_at, updated_at)
VALUES ('amor-e-sabor', '<COLE_O_VERIFICADOR_AQUI>', datetime('now'), datetime('now'))
ON CONFLICT(business_id) DO UPDATE SET
  pin_hash = excluded.pin_hash,
  updated_at = datetime('now');
```

## Executar SPA + Worker localmente

Primeiro gere o build do frontend:

```bash
npm run build
```

Depois inicie o Worker:

```bash
npm run dev:worker
```

O Wrangler serve a SPA e direciona `/api/*` para o Worker na mesma origem.

## Validação

Antes de qualquer deploy:

```bash
npm test
npm run lint
npm run build
npx wrangler deploy --dry-run
```

O workflow do GitHub Actions executa esse mesmo conjunto de validações sem publicar nada.

## Deploy de produção

### 1. Aplicar a migration remota

```bash
npm run d1:migrate:remote
```

A migration cria o schema e o registro da empresa Amor & Sabor. Ela não importa dados antigos de teste do navegador.

### 2. Gerar o verificador do PIN de produção

Use um PIN definido pelo responsável pela operação. Não reutilize exemplos de documentação.

```bash
read -s AMOR_PIN
PIN="$AMOR_PIN" node scripts/generate-pin-hash.mjs
unset AMOR_PIN
```

Somente o verificador resultante pode ser gravado no D1. O PIN em texto puro nunca deve ser commitado ou salvo em arquivo.

### 3. Gravar o verificador no D1 remoto

No console D1 da Cloudflare, execute o SQL abaixo substituindo somente o placeholder pelo verificador gerado:

```sql
INSERT INTO auth_credentials (business_id, pin_hash, created_at, updated_at)
VALUES ('amor-e-sabor', '<COLE_O_VERIFICADOR_AQUI>', datetime('now'), datetime('now'))
ON CONFLICT(business_id) DO UPDATE SET
  pin_hash = excluded.pin_hash,
  updated_at = datetime('now');
```

Confirme sem imprimir o hash novamente:

```sql
SELECT business_id, length(pin_hash) AS verifier_length
FROM auth_credentials
WHERE business_id = 'amor-e-sabor';
```

### 4. Fazer o deploy

```bash
npm run deploy
```

## Checklist de aceitação em produção

Após o deploy, validar no computador e no celular:

1. Ambos pedem o PIN antes de mostrar os dados.
2. Um cliente criado no computador aparece no celular após atualizar os dados.
3. Um produto criado no celular aparece no computador.
4. Um pedido do dia entra como `Em preparo` nos dois dispositivos.
5. Ao finalizar, o estado atualizado aparece no outro dispositivo após recarregar.
6. Ao registrar pagamento, `A Receber` diminui e o Financeiro recebe uma única entrada automática.
7. Offline, ações de gravação ficam bloqueadas e o aviso de conexão aparece.
8. Após reconectar, os dados carregam normalmente sem duplicar pedido ou pagamento.
9. Após `Sair`, rotas protegidas exigem autenticação novamente.

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run dev:worker
npm run d1:migrate:local
npm run d1:migrate:remote
npm run deploy
npm test
npm run lint
```

## Segurança

- O PIN não existe no código do frontend.
- O D1 guarda apenas o verificador PBKDF2 do PIN.
- Sessões usam token opaco em cookie `HttpOnly`, `Secure` e `SameSite=Strict`.
- O D1 guarda apenas o hash SHA-256 do token de sessão.
- Rotas de negócio derivam `business_id` da sessão autenticada.
- Tentativas de login têm rate limiting no Worker.
- Escritas não são enfileiradas offline.
