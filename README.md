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
- Conta Cloudflare autenticada para operações locais/remotas de D1 e deploy

O projeto fixa o Wrangler em `4.128.0` nos comandos via `npx --yes`, evitando depender de uma versão global ou de `latest`.

## Instalação

```bash
npm ci
```

## Desenvolvimento do frontend

```bash
npm run dev
```

## Banco D1 local

Aplique as migrations locais:

```bash
npm run d1:migrate:local
```

Para inspecionar as tabelas:

```bash
npx --yes wrangler@4.128.0 d1 execute amor-e-sabor-delivery --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
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
npx --yes wrangler@4.128.0 deploy --dry-run
```

O workflow do GitHub Actions executa esse mesmo conjunto de validações sem publicar nada.

## Nova venda com vários itens

O fluxo de `Novo pedido` permite montar a venda inteira antes de salvar: vários produtos, quantidade, observação por item, taxa de entrega opcional, desconto/acréscimo e fechamento pendente ou já recebido.

Os preços oficiais e o total final são recalculados pelo Worker usando o catálogo salvo no D1. O navegador não é a autoridade de preço. Itens do mesmo produto com a mesma observação normalizada são agrupados; observações diferentes permanecem em linhas separadas.

`Salvar pedido` cria a venda com pagamento pendente. `Salvar e receber` registra a venda e um único pagamento integral no mesmo checkout. O pagamento não finaliza o andamento operacional: um pedido pago do dia continua `Em preparo` até a ação de finalização.

## Deploy de produção

A migration remota e o deploy continuam sendo **passos manuais de release**. Validar a branch não altera o D1 remoto nem publica o Worker.

### 1. Aplicar as migrations remotas pendentes

```bash
npm run d1:migrate:remote
```

As migrations evoluem o schema central sem importar dados antigos de teste do navegador. A migration do checkout multi-itens adiciona taxa de entrega ao pedido e observação por item.

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

## Checklist de aceitação do checkout multi-itens

Após aplicar a migration remota e publicar a versão aprovada:

1. Abra Novo pedido.
2. Selecione ou crie cliente apenas com nome/telefone.
3. Adicione vários produtos; itens iguais com a mesma observação agrupam.
4. Adicione o mesmo produto com outra observação e confirme linha separada.
5. Para Entrega, deixe taxa em R$ 0,00 ou informe a taxa manual.
6. Aplique desconto/acréscimo em R$ ou %, se necessário.
7. Teste Salvar pedido e Salvar e receber.
8. Confirme que pedido pago continua Em preparo.
9. Confirme todos os itens/observações na fila e no detalhe.
10. Confirme uma única pendência ou uma única entrada financeira por venda.

Também mantenha os checks operacionais existentes de autenticação, sincronização entre dispositivos, bloqueio de gravações offline e logout.

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
