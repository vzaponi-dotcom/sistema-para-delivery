# Design: persistência central, autenticação por PIN e preparação multiempresa

Data: 2026-09-01

## Objetivo

Substituir o armazenamento isolado por navegador (`localStorage`) por uma persistência central compartilhada entre computador, celular e outros dispositivos.

A primeira versão continuará atendendo apenas a Amor & Sabor, mas o modelo de dados será preparado para uma futura evolução multiempresa através de `business_id`.

A autenticação inicial será feita por um único PIN da Amor & Sabor, com sessão persistente e segura. Não haverá migração dos dados de teste atuais do `localStorage`; o novo sistema começará com banco limpo.

## Decisões aprovadas

- A persistência central será prioridade antes da implementação do novo fluxo de pedidos com múltiplos itens.
- A arquitetura recomendada é React + Cloudflare Worker/API + Cloudflare D1.
- O sistema será single-tenant na experiência inicial, mas as entidades de negócio terão `business_id` desde o início.
- Haverá uma única empresa inicial: Amor & Sabor.
- O acesso será protegido por um PIN compartilhado.
- O PIN não será armazenado nem exposto em texto puro no frontend.
- O login gerará uma sessão segura persistida no navegador.
- Não haverá importação automática nem manual dos dados existentes em `localStorage`.
- O banco central começa vazio.
- A primeira versão não permitirá gravações offline.
- Quando o navegador estiver sem conexão, ações de escrita serão bloqueadas com feedback claro.
- Cliques duplicados em ações de escrita, como `Salvar pedido`, serão prevenidos enquanto a requisição estiver em andamento.
- Pagamentos, pedidos, produtos, clientes e movimentações passarão a usar a API como fonte oficial.

## Arquitetura

Fluxo principal:

```text
React / Vite
    ↓ HTTPS
Cloudflare Worker
    ↓
Cloudflare D1
```

O frontend será responsável por interface, estado temporário da tela, validações de experiência e chamadas HTTP.

O Worker será responsável por autenticação, autorização, validação de entrada, regras de persistência e acesso ao D1.

O D1 será a fonte oficial dos dados operacionais.

## Fonte de verdade

Após a migração arquitetural:

- `localStorage` deixa de ser fonte de verdade de produtos.
- `localStorage` deixa de ser fonte de verdade de clientes.
- `localStorage` deixa de ser fonte de verdade de pedidos.
- `localStorage` deixa de ser fonte de verdade de movimentações.

O navegador poderá manter apenas informações locais não críticas, como preferências de interface ou marcadores de sessão quando apropriado.

Todos os dados de negócio deverão ser carregados da API.

## Preparação multiempresa

Mesmo com apenas uma empresa na primeira versão, as principais tabelas terão `business_id`.

Exemplo conceitual:

```text
businesses
  id = amor-e-sabor
  name = Amor & Sabor
```

Todas as entidades operacionais relacionadas à empresa apontam para esse registro.

Isso permite que uma futura versão multiempresa adicione usuários, convites, permissões e várias empresas sem reconstruir o modelo central de pedidos.

Nesta primeira versão não haverá seletor de empresa nem gerenciamento de tenants na interface.

## Entidades iniciais

### businesses

Representa a empresa dona dos dados.

Campos conceituais:

```text
id
slug
name
created_at
updated_at
```

### auth_credentials

Armazena a credencial compartilhada da empresa.

Campos conceituais:

```text
business_id
pin_hash
created_at
updated_at
```

O PIN deve ser armazenado apenas como hash seguro.

### sessions

Representa sessões autenticadas.

Campos conceituais:

```text
id
business_id
token_hash
created_at
expires_at
last_seen_at
revoked_at
```

O token bruto de sessão nunca deve ser persistido diretamente no banco.

### clients

```text
id
business_id
name
phone
address
created_at
updated_at
```

### products

```text
id
business_id
category
size
name
price
active
created_at
updated_at
```

### orders

A tabela de pedidos será preparada para o modelo de múltiplos itens já aprovado.

Campos conceituais:

```text
id
business_id
client_id
client_name_snapshot
type
order_date
status
subtotal
adjustment_type
adjustment_mode
adjustment_value
adjustment_amount
adjustment_reason
total
created_at
finished_at
```

### order_items

```text
id
business_id
order_id
product_id
name_snapshot
category_snapshot
size_snapshot
quantity
catalog_price
unit_price
price_reason
created_at
```

O uso de snapshots impede que alterações futuras em cliente ou produto mudem o significado histórico de um pedido.

### payments

```text
id
business_id
order_id
amount
method
paid_at
created_at
```

Na primeira versão, um pedido continua tendo pagamento integral, não parcial.

### movements

```text
id
business_id
type
category
description
value
source
order_id
payment_id
movement_date
created_at
```

Movimentações automáticas de recebimento continuam relacionadas ao pedido e, quando aplicável, ao pagamento.

## Identificadores

Para evitar colisões entre dispositivos, IDs criados no cliente com `Date.now()` não devem continuar sendo a estratégia oficial.

A API deve gerar identificadores estáveis. A implementação poderá usar UUIDs ou identificadores equivalentes compatíveis com D1.

O frontend trata IDs como strings opacas e não deve depender de sequência numérica.

Para exibição operacional curta do pedido, poderá ser mantido um identificador ou número legível separado caso seja necessário.

## Autenticação por PIN

### Login

Fluxo:

```text
Usuário abre o sistema
→ frontend consulta estado da sessão
→ se não houver sessão válida, mostra tela de acesso
→ usuário informa PIN
→ Worker valida PIN
→ Worker cria sessão
→ frontend entra no sistema
```

### Armazenamento do PIN

O PIN nunca deve ser incluído no bundle do frontend.

A configuração inicial do hash poderá ser feita por configuração segura do Worker ou procedimento administrativo documentado.

O Worker compara o PIN informado com o hash armazenado/configurado.

### Sessão

A preferência é usar cookie seguro com características adequadas à aplicação web:

- `HttpOnly`
- `Secure`
- `SameSite` apropriado
- prazo de expiração definido

Isso reduz a exposição do token ao JavaScript do frontend.

A sessão poderá durar alguns dias para evitar pedir o PIN a cada abertura do sistema.

O usuário terá uma ação explícita `Sair`, que revoga a sessão atual.

## Autorização

Toda rota de negócio deve exigir uma sessão válida.

O `business_id` usado nas consultas não deve ser confiado ao frontend como autoridade. Ele deve ser derivado da sessão autenticada.

Mesmo na versão single-tenant, essa regra deverá existir desde o começo para preparar isolamento correto de dados.

Exemplo:

```text
sessão autenticada
→ business_id = amor-e-sabor
→ SELECT ... WHERE business_id = ?
```

Uma futura versão multiempresa poderá manter o mesmo padrão.

## API

A API deve ser versionada ou organizada de maneira que o frontend não acesse D1 diretamente.

Estrutura conceitual:

```text
/api/auth/session
/api/auth/login
/api/auth/logout

/api/clients
/api/products
/api/orders
/api/payments
/api/movements
```

Operações de escrita devem validar os dados novamente no servidor, mesmo que o frontend já tenha validado a interface.

## Pedidos e atomicidade

Criar um pedido com múltiplos itens envolve vários registros:

```text
orders
+ order_items
```

Essa criação deve ser tratada como uma operação lógica única.

O servidor deve validar todos os itens e calcular subtotal, ajuste e total antes de concluir a gravação.

O frontend pode exibir os cálculos para o atendente, mas o servidor deve recalcular os valores para não confiar em totais enviados pelo navegador.

Se a criação falhar no meio, não deve ficar um pedido parcial sem seus itens.

A estratégia exata de atomicidade deverá respeitar as capacidades do D1 adotadas na implementação.

## Regras de preço no servidor

Para um pedido novo:

1. A API busca ou valida o produto informado.
2. `catalog_price` registra o preço atual do catálogo no momento da venda.
3. `unit_price` representa o preço efetivamente cobrado.
4. Alterações de preço negativo são rejeitadas.
5. Quantidade deve ser inteira e maior ou igual a 1.
6. O servidor recalcula o subtotal.
7. O servidor recalcula desconto/acréscimo.
8. O total final nunca pode ser negativo.

A existência de preço personalizado é permitida e não exige motivo, pois o motivo foi definido como opcional.

## Pagamento e financeiro

O registro de pagamento continua no nível do pedido inteiro.

Fluxo:

```text
POST pagamento
→ validar pedido e sessão
→ criar payment
→ marcar/representar pedido como pago conforme modelo adotado
→ criar movement de entrada
```

Pagamento e movimentação financeira associada devem ser consistentes entre si.

O valor cobrado deve vir do total oficial do pedido no banco, e não de um valor arbitrário enviado pelo frontend.

## Concorrência entre dispositivos

Como computador e celular poderão alterar os mesmos dados, a API passa a ser autoridade final.

Para a primeira versão:

- após criar/alterar um registro, o frontend atualiza o estado usando a resposta oficial da API;
- ao entrar em uma tela, os dados são carregados do servidor;
- não haverá sincronização offline;
- não haverá mecanismo complexo de edição concorrente, porque pedidos salvos ainda não serão editáveis nesta fase.

Esse escopo reduz conflitos significativamente.

## Atualização entre dispositivos

A primeira versão não precisa necessariamente de WebSocket ou atualização em tempo real contínua.

O requisito mínimo é que os dispositivos usem a mesma fonte central e consigam recarregar dados atuais.

A experiência poderá usar estratégias como reconsulta ao focar a janela, ao navegar para a página ou após ações importantes.

Polling leve poderá ser adotado se necessário para a fila de pedidos, mas deve ser decidido na implementação de acordo com custo e experiência.

## Estado offline

Não haverá fila local de mutações.

Quando uma ação de escrita falhar por ausência de conexão:

- o sistema não assume que o dado foi salvo;
- a interface informa a falha claramente;
- o botão pode ser habilitado novamente para nova tentativa após reconexão;
- não será salvo um pedido ocultamente em `localStorage` para sincronizar depois.

Isso evita duplicidade e divergência entre dispositivos.

## Prevenção de duplicidade

No frontend, botões de envio ficam desabilitados durante a requisição.

Para operações críticas, especialmente criação de pedido e registro de pagamento, a implementação deverá considerar uma chave de idempotência ou proteção equivalente no servidor para evitar duplicação causada por repetição de requisição.

Esse cuidado é especialmente importante em redes móveis instáveis.

## Carregamento e erros

As telas deverão diferenciar:

- carregando dados;
- dados carregados;
- lista vazia;
- erro de conexão;
- sessão expirada.

Sessão expirada deve levar o usuário de volta para o acesso por PIN sem apagar dados do servidor.

Erros de API não devem ser tratados como lista vazia.

## Bootstrap inicial

Como o sistema começará do zero, o primeiro deploy do banco deverá criar:

- schema D1;
- empresa Amor & Sabor;
- credencial/PIN inicial de forma segura.

Clientes, produtos, pedidos e movimentações de demonstração atuais não serão migrados.

Os produtos e clientes reais deverão ser cadastrados novamente após a virada.

## Remoção do localStorage de negócio

Após a integração completa com a API, o código de inicialização que atualmente lê as chaves:

```text
amor-e-sabor-products
amor-e-sabor-clients
amor-e-sabor-orders
amor-e-sabor-movements
```

deve ser removido do fluxo oficial.

Não é necessário apagar fisicamente os valores antigos do navegador para que o sistema funcione, mas eles não poderão mais influenciar a aplicação.

Opcionalmente, uma versão posterior poderá limpar essas chaves explicitamente.

## Ordem de implementação

A execução deve ser dividida em duas grandes fases.

### Fase 1 — Persistência central e autenticação

- configuração do Worker;
- configuração D1;
- migrations/schema;
- bootstrap da empresa;
- autenticação por PIN;
- sessão;
- cliente HTTP no React;
- CRUD de clientes;
- CRUD de produtos;
- persistência de pedidos;
- persistência de pagamentos;
- persistência de movimentações;
- remoção do `localStorage` como fonte de verdade;
- estados de carregamento/conexão.

### Fase 2 — Pedidos com múltiplos itens

Executar a especificação:

```text
docs/superpowers/specs/2026-09-01-multi-item-orders-design.md
```

O novo modelo de pedidos deve ser implementado diretamente sobre a API e o D1, evitando construir uma solução complexa nova sobre `localStorage` para depois migrá-la novamente.

## Testes

A implementação deverá usar TDD para regras de domínio e API.

Cobertura mínima esperada:

- login com PIN válido;
- rejeição de PIN inválido;
- criação e validação de sessão;
- rejeição de rota sem sessão;
- logout/revogação;
- isolamento por `business_id` na camada de dados;
- criação, leitura, atualização e exclusão de cliente;
- criação, leitura, atualização e exclusão de produto;
- criação de pedido;
- recálculo de total no servidor;
- rejeição de preço/quantidade inválidos;
- registro de pagamento usando total oficial;
- criação da movimentação financeira associada;
- prevenção de duplicidade em operação crítica;
- tratamento de erro de rede no frontend;
- sessão expirada no frontend;
- ausência de dependência do `localStorage` para dados de negócio.

O workflow final deverá validar frontend e backend conforme os scripts que forem adicionados ao projeto.

## Segurança

Requisitos mínimos:

- PIN fora do bundle do frontend;
- PIN armazenado como hash seguro;
- sessão não baseada em um segredo fixo exposto no cliente;
- cookie de sessão seguro quando aplicável;
- rotas de negócio autenticadas;
- `business_id` derivado da sessão;
- validação de entrada no Worker;
- queries parametrizadas no D1;
- respostas da API sem dados sensíveis desnecessários;
- limite de tentativas de login ou proteção equivalente contra força bruta do PIN.

A implementação deve incluir algum mecanismo de rate limiting/backoff para tentativas incorretas de PIN, ainda que simples na primeira versão.

## Observabilidade mínima

Erros importantes do Worker devem ser registrados sem incluir PIN, token de sessão ou outras credenciais.

Falhas de login podem ser contabilizadas de forma segura para diagnóstico e proteção, sem registrar o PIN informado.

## Fora do escopo desta versão

- contas individuais por funcionário;
- permissões por função;
- convite de usuários;
- recuperação de senha;
- várias empresas operando pela interface;
- planos ou cobrança SaaS;
- migração dos testes existentes de `localStorage`;
- funcionamento offline com sincronização posterior;
- edição concorrente de pedidos salvos;
- WebSockets obrigatórios;
- aplicativo nativo.

Esses itens podem ser adicionados depois sem alterar a decisão central de Worker + D1 + `business_id`.

## Critérios de sucesso

A mudança será considerada bem-sucedida quando:

1. um produto cadastrado no computador aparecer no celular após recarregar/atualizar os dados;
2. um pedido criado no celular aparecer no computador;
3. pagamentos e financeiro reflitam os mesmos dados em todos os dispositivos;
4. limpar o armazenamento local do navegador não apague os dados do negócio;
5. sem PIN/sessão válida, os dados não sejam acessíveis pela API;
6. o sistema suporte a futura inclusão de outra empresa sem precisar adicionar `business_id` retroativamente às entidades principais;
7. o fluxo de pedidos com múltiplos itens possa ser construído diretamente sobre esse backend central.
