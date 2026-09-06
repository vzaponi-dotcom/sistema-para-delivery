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

Antes de abrir/atualizar um PR, valide sem escrever em nenhum banco remoto:

```bash
npm test
npm run lint
npm run build
npm run d1:migrate:local
npx --yes wrangler@4.128.0 deploy --dry-run
npx --yes wrangler@4.128.0 deploy --dry-run --env staging
```

O workflow `.github/workflows/validate.yml` executa esse gate em Pull Requests para `master`. Ele não publica Workers nem aplica migrations remotas.

## Ambientes e fluxo de release

O projeto possui dois ambientes persistentes e isolados:

- **staging:** Worker `sistema-para-delivery-staging` + D1 `amor-e-sabor-delivery-staging`, somente com dados fictícios;
- **produção:** Worker `sistema-para-delivery` + D1 `amor-e-sabor-delivery`, com dados reais.

Dados reais de produção nunca devem ser copiados para staging.

O fluxo oficial é:

```text
feature/fix branch
-> Pull Request para master
-> Validate application verde
-> Deploy staging
-> homologação humana
-> merge em master
-> Deploy production explícito
-> smoke test
```

O procedimento completo, incluindo migrations e rollback, está em `docs/release-and-migration-runbook.md`.

## Nova venda com vários itens

O fluxo de `Novo pedido` permite montar a venda inteira antes de salvar: vários produtos, quantidade, observação por item, taxa de entrega opcional, desconto/acréscimo e fechamento pendente ou já recebido.

Os preços oficiais e o total final são recalculados pelo Worker usando o catálogo salvo no D1. O navegador não é a autoridade de preço. Itens do mesmo produto com a mesma observação normalizada são agrupados; observações diferentes permanecem em linhas separadas.

`Salvar pedido` cria a venda com pagamento pendente. `Salvar e receber` registra a venda e um único pagamento integral no mesmo checkout. O pagamento não finaliza o andamento operacional: um pedido pago do dia continua `Em preparo` até a ação de finalização.

## Impressão térmica de pedidos — 58 mm ESC/POS

O sistema possui um **Ticket Oficial** único para cozinha, embalagem/cliente, visualização e PDF. O mesmo renderizador ESC/POS de 58 mm é usado nos dois transportes físicos homologáveis:

- **Windows:** Chrome + Web Serial para impressora Bluetooth Classic/serial compatível;
- **Android:** Chrome + aplicativo RawBT, que recebe os bytes ESC/POS do Gestão Delivery e cuida da conexão Bluetooth com a impressora.

O perfil inicial continua com 203 dpi, 384 pontos por linha, largura imprimível de 48 mm e página de código CP860. A MPT-II usada na homologação Android deve ser configurada no RawBT com **203 dpi** e **384 pontos**.

A configuração fica em **Pedidos > Impressão**.

### Configuração inicial no Windows

1. Pareie a impressora nas configurações Bluetooth do Windows.
2. Abra o Gestão Delivery em uma origem HTTPS usando Chrome compatível.
3. Entre em **Pedidos > Impressão**.
4. Clique em **Conectar impressora** e selecione a porta da impressora no seletor do navegador.
5. Execute **Testar impressão**.
6. Se este computador for responsável pela impressão automática, marque-o como **estação principal**.
7. Escolha **1** ou **2 cópias**.
8. Ative a impressão automática somente depois de aprovar o teste físico.

A seleção inicial no Windows precisa de uma ação explícita do usuário. Depois da autorização, o sistema tenta reutilizar somente a porta já autorizada naquele navegador.

### Configuração inicial no Android com RawBT

1. Pareie a impressora nas configurações Bluetooth do Android.
2. Instale e abra o RawBT.
3. No RawBT, selecione a impressora e confirme que uma impressão de teste do próprio aplicativo funciona.
4. Para a MPT-II homologada, configure **203 dpi** e **384 pontos** de largura de impressão.
5. Abra o Gestão Delivery no Chrome e entre em **Pedidos > Impressão**.
6. Confirme **Plataforma: Android**, **Driver: RawBT** e o estado **RawBT pronto**.
7. Não haverá seletor Web Serial nem botão de conexão Bluetooth do navegador no Android; a impressora é escolhida no RawBT.
8. Escolha **1 cópia** e execute **Testar impressão** antes de testar pedidos reais.
9. Depois de validar impressão manual, marque a estação como principal e teste a impressão automática de forma controlada antes de mantê-la ativa.

`RawBT pronto` significa que o Gestão Delivery selecionou o transporte RawBT para Android; não é confirmação de que a impressora física está ligada ou conectada. A impressão de teste é a validação operacional.

### Comportamento operacional

- Um pedido novo gera no máximo um job automático, apenas se a estação principal estiver com impressão automática ativa no momento da criação.
- Atualizar a página, sincronizar outro dispositivo, trocar de aba ou recuperar foco não cria um novo job de impressão.
- Apenas a estação principal consome jobs automáticos.
- **Reimprimir** cria um novo job manual e pede confirmação, preservando o histórico anterior.
- **Tentar novamente** reutiliza o mesmo job e o mesmo snapshot quando houve falha conhecida.
- Não há loop de retry automático depois de uma falha.
- No Web Serial, `Impresso` significa que a escrita serial terminou sem erro reportado; a impressora simples não confirma necessariamente a saída física do papel.
- No Android/RawBT, o navegador só consegue confirmar que entregou o comando ao esquema do RawBT; a saída física precisa ser validada operacionalmente.
- Preview e PDF continuam disponíveis mesmo sem a impressora conectada.
- Pedidos finalizados continuam permitindo preview, PDF e reimpressão pelo Histórico.

### Compatibilidade e limites da V1

- Alvo desktop: Chrome com Web Serial e Windows com impressora serial Bluetooth compatível pareada pelo sistema operacional.
- Alvo Android: Chrome + RawBT configurado para a impressora ESC/POS; a MPT-II é o hardware de homologação atual.
- A abertura automática do RawBT a partir de um job sem gesto do usuário depende do comportamento do Android/Chrome e deve ser validada fisicamente em staging antes de aprovar a impressão automática.
- Safari e Firefox não possuem garantia de compatibilidade com este fluxo.
- Não há envio automático do ticket por WhatsApp.
- Não há failover automático para uma segunda estação de impressão.
- Não há roteamento por setor/cozinha nem múltiplas impressoras na V1.
- Não há comando de corte automático na V1.
- A página de código inicial para português é CP860 (`ESC t 3`); o comportamento da unidade física é a autoridade final.

O checklist completo de validação física está em `docs/order-printing-mtp5-acceptance.md` e deve ser preenchido separadamente para Windows e Android/RawBT.

## Deploy de staging

Staging é o ambiente usado para testar alterações antes de produção. O deploy oficial é feito pelo workflow:

`.github/workflows/deploy-staging.yml` — **Deploy staging**

Ele valida a aplicação, aplica migrations somente no D1 `amor-e-sabor-delivery-staging`, configura a credencial exclusiva de staging, publica `sistema-para-delivery-staging` e executa um smoke test de login.

Não copie clientes, pedidos, pagamentos, endereços, telefones ou qualquer outro dado real de produção para staging.

## Deploy de produção

Produção não é publicada por comandos rotineiros de desenvolvimento. Depois de PR aprovado, CI verde, homologação em staging e merge em `master`, use exclusivamente o workflow:

`.github/workflows/deploy-production.yml` — **Deploy production**

Esse workflow é manual e restrito a `master`. Ele executa testes, lint, build, migration local, dry-run, lista/aplica migrations de produção, preserva/configura a credencial oficial e só então publica o Worker e executa o smoke test de login.

Os scripts `d1:migrate:production` e `deploy:production` existem para uso pelo fluxo de release. Eles não devem ser tratados como comandos comuns de desenvolvimento nem executados a partir de branches de feature.

Migrations destrutivas ou que transformem dados reais exigem estratégia de restauração revisada antes da autorização. Consulte `docs/release-and-migration-runbook.md`.

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

Comandos normais de desenvolvimento e validação:

```bash
npm run dev
npm run build
npm run preview
npm run dev:worker
npm run d1:migrate:local
npm test
npm run lint
```

Comandos de ambiente controlado/release:

```bash
npm run d1:migrate:staging
npm run deploy:staging
npm run d1:migrate:production
npm run deploy:production
```

Os dois comandos de produção são reservados ao workflow **Deploy production** no processo normal.

## Segurança

- O PIN não existe no código do frontend.
- O D1 guarda apenas o verificador PBKDF2 do PIN.
- Sessões usam token opaco em cookie `HttpOnly`, `Secure` e `SameSite=Strict`.
- O D1 guarda apenas o hash SHA-256 do token de sessão.
- Rotas de negócio derivam `business_id` da sessão autenticada.
- Tentativas de login têm rate limiting no Worker.
- Escritas não são enfileiradas offline.
- O navegador não persiste PIN de pareamento Bluetooth nem objetos de permissão serial.
