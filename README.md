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
npm run d1:migrate:local
```

O gate de validação não publica o Worker nem aplica migrations remotas.

## Nova venda com vários itens

O fluxo de `Novo pedido` permite montar a venda inteira antes de salvar: vários produtos, quantidade, observação por item, taxa de entrega opcional, desconto/acréscimo e fechamento pendente ou já recebido.

Os preços oficiais e o total final são recalculados pelo Worker usando o catálogo salvo no D1. O navegador não é a autoridade de preço. Itens do mesmo produto com a mesma observação normalizada são agrupados; observações diferentes permanecem em linhas separadas.

`Salvar pedido` cria a venda com pagamento pendente. `Salvar e receber` registra a venda e um único pagamento integral no mesmo checkout. O pagamento não finaliza o andamento operacional: um pedido pago do dia continua `Em preparo` até a ação de finalização.

## Impressão térmica de pedidos — MTP5 58 mm

O sistema possui um **Ticket Oficial** único para cozinha, embalagem/cliente, visualização e PDF. A integração física inicial usa a Goldensky MTP5 de 58 mm via ESC/POS e conexão serial Bluetooth autorizada pelo navegador.

A configuração fica em **Pedidos > Impressão**.

### Configuração inicial

1. Faça o pareamento da MTP5 nas configurações Bluetooth do Windows ou Android.
2. Abra o Gestão Delivery em uma origem HTTPS usando Chrome compatível.
3. Entre em **Pedidos > Impressão**.
4. Clique em **Conectar impressora** e selecione a MTP5 no seletor do navegador.
5. Execute **Testar impressão**.
6. Se este for o computador/tablet responsável pela impressão automática, marque-o como **estação principal**.
7. Escolha **1** ou **2 cópias**; o padrão operacional é 2.
8. Ative a **impressão automática** somente depois de aprovar o teste físico.

A seleção inicial da impressora precisa de uma ação explícita do usuário. Depois da autorização, o sistema tenta reutilizar somente a porta que já foi autorizada para aquele dispositivo.

### Comportamento operacional

- Um pedido novo gera no máximo um job automático, apenas se a estação principal estiver com impressão automática ativa no momento da criação.
- Atualizar a página, sincronizar outro dispositivo, trocar de aba ou recuperar foco não cria um novo job de impressão.
- Apenas a estação principal consome jobs automáticos.
- **Reimprimir** cria um novo job manual e pede confirmação, preservando o histórico anterior.
- **Tentar novamente** reutiliza o mesmo job e o mesmo snapshot quando houve falha conhecida.
- Se o resultado físico for incerto, o job fica em **Requer atenção** e depende de intervenção explícita.
- Não há loop de retry automático depois de uma falha.
- `Impresso` significa que a escrita serial terminou sem erro reportado; impressoras portáteis simples nem sempre conseguem confirmar que o papel saiu fisicamente.
- Preview e PDF continuam disponíveis mesmo sem a impressora conectada.
- Pedidos finalizados continuam permitindo preview, PDF e reimpressão pelo Histórico.

### Compatibilidade e limites da V1

- Alvo desktop: Chrome com Web Serial e Windows com a MTP5 pareada pelo sistema operacional.
- Alvo Android: Chrome 138+ em dispositivo que exponha o fluxo serial necessário para a MTP5; a aceitação física é obrigatória antes de considerar a plataforma aprovada.
- Safari e Firefox não possuem garantia de compatibilidade com este fluxo.
- Não há envio automático do ticket por WhatsApp.
- Não há failover automático para uma segunda estação de impressão.
- Não há roteamento por setor/cozinha nem múltiplas impressoras na V1.
- Não há comando de corte automático na V1.
- A página de código inicial para português é CP860 (`ESC t 3`); o comportamento da unidade física da MTP5 é a autoridade final.

O checklist completo de validação física está em `docs/order-printing-mtp5-acceptance.md` e deve ser preenchido separadamente para Windows e Android.

## Deploy de produção

A migration remota e o deploy continuam sendo **passos manuais de release**. Validar a branch não altera o D1 remoto nem publica o Worker.

### 1. Aplicar as migrations remotas pendentes

```bash
npm run d1:migrate:remote
```

As migrations evoluem o schema central sem importar dados antigos de teste do navegador. A migration do checkout multi-itens adiciona taxa de entrega ao pedido e observação por item; migrations posteriores também evoluem outros domínios, incluindo a persistência central de impressão.

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
- O navegador não persiste PIN de pareamento Bluetooth nem objetos de permissão serial.
