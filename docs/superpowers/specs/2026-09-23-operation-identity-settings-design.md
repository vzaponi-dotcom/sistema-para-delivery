# Mesiva — Identidade da operação — Design Spec

**Data:** 23/09/2026  
**Projeto:** Mesiva  
**Repositório:** `vzaponi-dotcom/sistema-para-delivery`  
**Base conferida:** `master` em `75966e5c585c85823e409d5bb7cbb75a557af2fa` — merge do PR #65 (tema Mesiva e limpeza de branding)  
**Branch documental:** `docs/operation-identity-settings`  
**Estado:** aguardando aprovação desta redação antes do plano de implementação.  
**Natureza:** documentação. Esta spec não autoriza implementação, merge, criação de bucket R2, migration remota ou deploy.

---

## 1. Objetivo

Criar em **Configurações** uma área própria para a identidade do estabelecimento que usa o Mesiva.

A separação normativa é:

- **Mesiva** é o produto;
- **operação** é o restaurante/empresa atendido pelo produto;
- a marca Mesiva não é substituída pela marca da operação;
- o nome/logo da operação não deve voltar a ser hardcoded no frontend;
- configurações locais de aparência continuam pertencendo ao dispositivo, não à identidade do negócio.

A V1 deve permitir administrar:

1. nome da operação;
2. logo da operação;
3. telefone/WhatsApp;
4. endereço estruturado.

O nome já existe em `businesses.name` e continua sendo a fonte oficial. Não criar um segundo `display_name` concorrente.

---

## 2. Decisões de produto já aprovadas

| Tema | Contrato |
|---|---|
| Produto x operação | Mesiva é o produto; o estabelecimento é a operação. |
| Nome | `businesses.name` continua como fonte oficial. |
| Logo | Opcional; se ausente, a UI usa os fallbacks atuais de ícone/iniciais. |
| Tipo de imagem | Conceitualmente é “Logo da operação”, não foto de perfil pessoal. |
| Contato | Telefone/WhatsApp opcional. |
| Endereço | Opcional e estruturado. |
| Tema | Clássico/Mesiva e Claro/Escuro/Sistema continuam em Preferências deste dispositivo. |
| Persistência de imagem | Arquivo em Cloudflare R2; D1 guarda somente metadados/referência. |
| Permissões | Novas capabilities de domínio: `business.profile.view` e `business.profile.manage`. |
| Campos excluídos da V1 | CNPJ, razão social, Instagram, horários, fuso, moeda, taxas e dados fiscais. |
| Infra | Não armazenar imagem em base64/BLOB no D1. |
| Branding Mesiva | Login, favicon/app icon e branding do produto continuam Mesiva; a operação não os substitui. |

---

## 3. Estado atual relevante

### 3.1 Banco

Hoje `businesses` contém:

```text
id
slug
name
created_at
updated_at
```

Não existe tabela de perfil/identidade da operação.

O `business_id` já é a fronteira de isolamento usada pelo sistema e continua sendo derivado da sessão, nunca de um campo confiado ao cliente.

### 3.2 Frontend

A home atual de Configurações é `src/app/surfaces/settings/SettingsHome.jsx`.

O shell já recebe `business.name` e o usa como identidade operacional. O PR #65 removeu hardcodes visíveis de “Gestão Delivery”/“Amor & Sabor” onde não representavam a operação real.

### 3.3 Capabilities

O catálogo canônico está em `shared/settingsAccess.js`.

A V1 atual de Configurações usa o padrão `.view` / `.manage`, com `manage` implicando `view`. A nova identidade deve seguir a mesma regra.

### 3.4 Armazenamento de arquivo

Não existe binding R2 nem subsistema de upload no código atual. A feature deve introduzir isso de forma isolada, sem transformar o Worker em um gerenciador genérico de arquivos.

---

## 4. Navegação

Adicionar um novo destino:

```text
id: settings-business-profile
path: /configuracoes/identidade
area: settings
label: Identidade da operação
capability: business.profile.view
```

Na home de Configurações, o card deve aparecer **antes de Operação**:

**Identidade da operação**  
“Nome, logo e informações do estabelecimento.”

O card só aparece quando:

- o destino está implementado; e
- a sessão possui `business.profile.view`.

`settings-home` deve considerar `business.profile.view` entre suas capabilities de acesso.

Não criar uma segunda área de navegação, aba horizontal global ou item na sidebar principal.

---

## 5. Composição da tela

### 5.1 Cabeçalho

```text
← Configurações

IDENTIDADE DA OPERAÇÃO
Dados do estabelecimento
```

A página segue o mesmo sistema visual e os mesmos estados de edição das demais Configurações.

### 5.2 Bloco “Identidade”

Contém:

- prévia do logo;
- nome da operação;
- ação “Alterar logo”;
- ação “Remover logo” quando houver logo atual ou logo selecionado;
- orientação curta de formato.

Copy recomendada:

> Logo da operação  
> PNG, JPG ou WebP. Recomendamos uma imagem quadrada e, quando possível, com fundo transparente.

A prévia deve reagir imediatamente ao arquivo selecionado, mas **nenhuma gravação acontece antes de Salvar alterações**.

### 5.3 Bloco “Contato”

Campo:

- Telefone / WhatsApp.

É opcional. A V1 não valida existência real, conta de WhatsApp ou DDD contra serviço externo.

### 5.4 Bloco “Endereço”

Campos:

- Logradouro;
- Número;
- Complemento;
- Bairro;
- Cidade;
- UF;
- CEP.

Todos são opcionais na V1.

Não adicionar geocoding, autocomplete de endereço, mapa ou consulta automática de CEP.

### 5.5 Prévia operacional

Exibir uma pequena prévia da identidade:

```text
PRÉVIA

[logo/iniciais]  Amor & Sabor
                 Operação atual
```

Enquanto o usuário edita, a prévia usa o rascunho local.

O restante do aplicativo só muda depois de uma gravação confirmada.

### 5.6 Footer

Reutilizar o padrão:

```text
[Cancelar] [Salvar alterações]
```

Não reintroduzir nome de produto ou número de versão no rodapé.

---

## 6. Modelo de dados

Criar migration aditiva **0030**.

Tabela proposta:

```sql
CREATE TABLE business_profiles (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),

  phone TEXT NOT NULL DEFAULT '',
  address_line TEXT NOT NULL DEFAULT '',
  address_number TEXT NOT NULL DEFAULT '',
  address_complement TEXT NOT NULL DEFAULT '',
  neighborhood TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',

  logo_object_key TEXT,
  logo_content_type TEXT,
  logo_sha256 TEXT,
  logo_size_bytes INTEGER,
  logo_updated_at TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 6.1 Nome da operação

O nome **não** é duplicado em `business_profiles`.

Salvar a identidade pode atualizar, no mesmo commit D1:

- `businesses.name`;
- `businesses.updated_at`;
- `business_profiles`;
- revisão;
- recibo da mutação.

### 6.2 Backfill

A migration deve criar um `business_profiles` para cada negócio existente com:

- `revision = 1`;
- contato/endereço vazios;
- logo nulo;
- timestamps válidos.

Nenhum `id`, `slug`, histórico, pedido, print job ou sessão é renomeado.

### 6.3 Ausência defensiva

Mesmo com backfill, o repository deve tratar ausência legítima do perfil de forma fail-safe:

- leitura pode sintetizar revisão 0 + campos vazios para um negócio válido;
- primeiro save inicializa a linha;
- inconsistência parcial deve produzir erro de indisponibilidade, não defaults silenciosos sobre estado corrompido.

---

## 7. Validação do perfil

### 7.1 Nome

- obrigatório;
- trim antes de persistir;
- 1–120 caracteres;
- rejeitar somente whitespace;
- rejeitar caracteres de controle;
- não alterar `slug` ao renomear.

### 7.2 Telefone

- opcional;
- até 32 caracteres;
- armazenado como texto de apresentação;
- não criar unicidade;
- não reutilizar a regra de telefone de clientes.

### 7.3 Endereço

Limites de V1:

| Campo | Limite |
|---|---:|
| Logradouro | 120 |
| Número | 30 |
| Complemento | 80 |
| Bairro | 80 |
| Cidade | 80 |
| UF | vazio ou 2 letras |
| CEP | vazio ou 8 dígitos |

O frontend pode formatar CEP como `00000-000`, mas o valor persistido deve ser normalizado para dígitos.

UF persistida em uppercase.

---

## 8. Logo: entrada, normalização e formato

### 8.1 Formatos aceitos pelo seletor

- PNG;
- JPEG/JPG;
- WebP.

Não aceitar:

- SVG;
- GIF;
- HEIC/HEIF;
- arquivos arbitrários renomeados como imagem.

### 8.2 Normalização no navegador

Antes do save, o frontend deve:

1. decodificar a imagem;
2. preservar proporção;
3. limitar o maior lado a 1024 px;
4. reencodar para WebP com transparência quando aplicável;
5. remover metadados do arquivo original por reencode;
6. produzir preview a partir do rascunho.

O usuário não precisa conhecer o formato final interno.

### 8.3 Limites

- arquivo normalizado enviado ao Worker: máximo 1 MiB;
- dimensões máximas após normalização: 1024 × 1024;
- uma imagem não quadrada é permitida;
- UI usa `object-fit: contain`, sem crop automático.

Se a normalização falhar, não enviar o arquivo e apresentar erro local.

### 8.4 Validação no Worker

O Worker não confia apenas no `Content-Type`.

Deve validar:

- tamanho;
- MIME final aceito;
- assinatura/magic bytes compatível;
- presença do arquivo quando `logoAction = replace`.

O cliente nunca fornece a chave final do R2.

---

## 9. R2

### 9.1 Buckets separados

Staging e produção não podem compartilhar bucket.

Nomes propostos:

```text
mesiva-business-assets-staging
mesiva-business-assets
```

Binding proposto:

```text
BUSINESS_ASSETS
```

A criação física dos buckets é pré-requisito de infraestrutura da implementação; migration D1 não cria R2.

### 9.2 Privacidade

O bucket não é público.

A aplicação acessa o logo através do Worker.

Não expor URL pública direta, chave interna do objeto ou nome do arquivo original.

### 9.3 Chave

O Worker gera chave opaca, por exemplo:

```text
businesses/<businessId>/logo/<uuid>.webp
```

O cliente não pode enviar path/chave R2.

### 9.4 Metadados no R2

Definir `httpMetadata.contentType` corretamente.

Não depender de metadata customizada para autorização; a autoridade é D1 + sessão.

---

## 10. Contrato HTTP administrativo

### 10.1 Ler

```http
GET /api/settings/business-profile
Capability: business.profile.view
```

Resposta conceitual:

```json
{
  "resource": "businessProfile",
  "revision": 3,
  "data": {
    "name": "Amor & Sabor",
    "phone": "(19) 99999-9999",
    "address": {
      "line": "Rua Exemplo",
      "number": "123",
      "complement": "",
      "neighborhood": "Centro",
      "city": "Monte Mor",
      "state": "SP",
      "postalCode": "13190000"
    },
    "logo": {
      "present": true,
      "version": "2026-09-23T23:30:00.000Z"
    }
  },
  "meta": {
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

A resposta nunca contém `logo_object_key` ou hash interno.

### 10.2 Salvar

```http
PUT /api/settings/business-profile
Content-Type: multipart/form-data
Capability: business.profile.manage
Same-origin mutation required
```

Partes:

```text
payload = JSON
logo    = arquivo normalizado, somente quando replace
```

Payload:

```json
{
  "expectedRevision": 3,
  "mutationId": "uuid/opaque-id",
  "data": {
    "name": "Amor & Sabor",
    "phone": "...",
    "address": {
      "line": "...",
      "number": "...",
      "complement": "",
      "neighborhood": "...",
      "city": "...",
      "state": "SP",
      "postalCode": "13190000"
    }
  },
  "logoAction": "keep"
}
```

`logoAction` aceita somente:

- `keep`;
- `replace`;
- `remove`.

### 10.3 Recibo/reconciliação

Reutilizar o mecanismo de `settings_mutation_receipts`.

O resource key é:

```text
businessProfile
```

A consulta de recibo usa o endpoint já existente:

```http
GET /api/settings/receipts/:mutationId?resource=businessProfile
```

Adicionar `businessProfile -> business.profile.manage` à tabela de capability do recibo.

---

## 11. Atomicidade D1 x R2

D1 e R2 não oferecem uma transação distribuída única. A spec não deve fingir atomicidade impossível.

### 11.1 Salvar sem substituir logo

Nome, contato, endereço, revisão e receipt são gravados no mesmo batch D1 protegido por revisão esperada.

### 11.2 Substituir logo

Fluxo normativo:

1. validar todo o perfil e o arquivo antes de escrever;
2. calcular SHA-256 do arquivo final;
3. se o hash for igual ao logo atual e nenhum outro dado mudou, tratar como no-op;
4. escrever novo objeto R2 em chave nova;
5. executar batch D1 protegido por `expectedRevision`, apontando para a chave nova;
6. gravar receipt no mesmo batch;
7. após confirmação D1, apagar o objeto antigo em best effort;
8. se o batch D1 falhar, apagar o objeto novo em best effort.

Falha ao apagar objeto antigo depois do commit não reverte o perfil. O objeto antigo torna-se órfão e não é mais referenciado.

### 11.3 Remover logo

1. batch D1 zera os metadados/chave e confirma a revisão;
2. depois do commit, apagar objeto antigo em best effort.

A UI considera remoção concluída quando D1 está confirmado, mesmo se a limpeza física do objeto antigo precisar ficar órfã.

### 11.4 Resultado HTTP incerto

Nunca repetir automaticamente uma mutação multipart após timeout/erro de rede.

Seguir o padrão já aprovado de Configurações:

- estado “gravação não confirmada”;
- consultar receipt;
- se confirmado, carregar estado oficial;
- se não confirmado, manter ação explícita de reconsulta;
- não duplicar upload em background.

---

## 12. Leitura do logo pelo shell

O logo é identidade visual operacional, não uma configuração secreta.

Adicionar endpoint autenticado:

```http
GET /api/business/logo
```

Regras:

- requer sessão administrativa válida;
- `business_id` vem da sessão;
- não exige `business.profile.view`, porque qualquer usuário autenticado pode ver a identidade da própria operação;
- 404 quando não existe logo;
- `ETag` quando disponível;
- `Cache-Control: private`;
- nunca aceita businessId do cliente.

A query `?v=<logoVersion>` pode ser usada apenas para cache bust; não participa da autorização.

---

## 13. Bootstrap e sincronização

O bootstrap deve continuar pequeno.

Expandir somente a projeção segura de `business`:

```json
{
  "business": {
    "id": "amor-e-sabor",
    "name": "Amor & Sabor",
    "hasLogo": true,
    "logoVersion": "2026-09-23T23:30:00.000Z"
  }
}
```

Não incluir telefone/endereço no bootstrap global.

Após save confirmado:

1. aplicar a resposta oficial na tela;
2. disparar a atualização oficial do contexto/bootstrap já existente, ou patch equivalente do owner oficial;
3. atualizar nome/logo do shell sem reload manual.

Outros dispositivos recebem a alteração pelos mecanismos existentes de bootstrap/focus/reconnect. A feature não cria WebSocket/SSE novo.

---

## 14. Onde nome e logo aparecem na V1

### 14.1 Desktop

No bloco de identidade à esquerda da top bar:

- se houver logo: usar logo;
- sem logo: manter o ícone operacional atual;
- nome vem de `business.name`.

### 14.2 Mobile

A marca principal da top bar continua **Mesiva**.

No menu da operação:

- com logo: o gatilho/heading pode exibir o logo;
- sem logo: manter iniciais derivadas do nome.

Isso preserva a distinção produto x operação.

### 14.3 Login

Continua Mesiva e genérico.

Não mostrar nome/logo da operação antes de autenticar na V1.

### 14.4 Impressão

O **nome** atualizado passa a ser usado por novos documentos gerados após a gravação.

Print jobs que já possuem snapshot imutável não são reescritos.

O **logo não entra em ESC/POS/PDF na V1**, para não acoplar esta feature a rasterização de impressão e não alterar o layout físico já homologado.

Telefone/endereço também não são adicionados automaticamente ao ticket na V1.

Essa escolha é deliberada: cadastro central agora; evolução de documento/recibo em mudança separada.

### 14.5 Kitchen TV

Não adicionar logo da operação à Kitchen TV nesta V1.

A sessão restrita da TV não deve ganhar acesso administrativo apenas para consumir a imagem. Isso pode ser tratado posteriormente por uma projeção específica da sessão TV.

---

## 15. Capabilities

Adicionar ao catálogo canônico:

```text
business.profile.view
business.profile.manage
```

E a relação:

```text
business.profile.manage -> business.profile.view
```

Regras:

- GET administrativo exige `business.profile.view`;
- PUT exige `business.profile.manage`;
- settings-home/card respeitam `view`;
- read-only renderiza dados sem botões de alterar/remover logo e sem footer de save;
- sessões com `manage` recebem `view`;
- o endpoint visual `GET /api/business/logo` exige sessão válida, não capability administrativa.

O resolver atual de capabilities da fase single-tenant deve ser atualizado explicitamente para não esconder a feature de sessões administrativas amplas.

Não introduzir nomes de cargos.

---

## 16. Integração com o sistema de edição de Configurações

A identidade deve reaproveitar:

- estados loading/ready/error;
- dirty draft;
- read-only;
- save/discard;
- conflito de revisão;
- gravação não confirmada;
- receipt/reconcile;
- guarda de saída com rascunho.

Pode existir um adapter específico `businessProfile` porque o save é multipart, mas ele deve implementar o mesmo contrato do owner de edição. Não duplicar um segundo sistema de drafts/conflitos.

A UI pode reutilizar `SettingsEditorShell`, desde que o uploader continue específico do domínio.

---

## 17. Concorrência

O recurso usa revisão otimista.

Cenário:

1. dispositivo A e B carregam revision 4;
2. A salva e produz revision 5;
3. B tenta salvar revision 4;
4. Worker responde conflito;
5. rascunho B é preservado;
6. usuário revisa diferenças antes de novo save.

O review deve comparar pelo menos:

- nome;
- telefone;
- endereço;
- presença/alteração de logo.

Não sobrescrever silenciosamente.

---

## 18. Offline

Não existe fila offline.

Sem conexão:

- leitura já carregada pode continuar visível;
- selecionar/preview de arquivo local pode funcionar;
- Salvar alterações permanece bloqueado pelo mecanismo global de writes;
- não gravar perfil/logo em localStorage como fila para depois;
- não apresentar sucesso sem resposta/receipt confirmado.

---

## 19. Segurança e privacidade

Requisitos:

- businessId sempre derivado da sessão;
- same-origin em mutações;
- queries D1 parametrizadas;
- R2 não público;
- object key gerada no Worker;
- nunca confiar em nome de arquivo;
- rejeitar SVG para eliminar conteúdo ativo;
- reencode no browser remove metadata do arquivo de origem;
- servidor valida corpo final;
- logs não devem registrar bytes da imagem, payload completo de endereço ou tokens;
- respostas não expõem object key;
- nenhuma rota permite ler logo de outro business via parâmetro.

---

## 20. Erros funcionais

Códigos propostos:

```text
BUSINESS_PROFILE_INVALID
BUSINESS_PROFILE_REVISION_CONFLICT
BUSINESS_PROFILE_UNAVAILABLE
BUSINESS_LOGO_INVALID
BUSINESS_LOGO_TOO_LARGE
BUSINESS_LOGO_STORAGE_UNAVAILABLE
```

Erros de storage R2 não podem ser convertidos em save parcial silencioso.

Mensagens de UI devem ser funcionais e em português; não exibir stack, SQL, bucket ou key.

---

## 21. Infraestrutura e staging

### 21.1 Wrangler

Adicionar binding R2 em produção e staging, com buckets distintos.

### 21.2 Segurança de ambiente

O workflow de staging deve verificar que o binding de staging não aponta para bucket de produção.

Produção continua sem deploy automático por esta spec.

### 21.3 Pré-requisitos antes do primeiro deploy staging

- bucket staging criado;
- binding staging validado;
- migration 0030 aplicada somente em staging;
- nenhum objeto de produção acessível;
- credenciais/conta Cloudflare existentes continuam sendo as usadas pelos workflows oficiais.

---

## 22. Migração e compatibilidade

A migration é aditiva.

Não alterar:

- `businesses.id`;
- `businesses.slug`;
- foreign keys existentes;
- `business_id` histórico;
- sessões;
- pedidos;
- pagamentos;
- comandas;
- filas de impressão;
- print snapshots existentes.

Renomear a operação altera somente `businesses.name`.

O sistema deve continuar funcionando quando:

- logo for nulo;
- todos os campos opcionais estiverem vazios;
- bucket estiver temporariamente indisponível para logo já cacheado/fallback visual;
- perfil não tiver sido editado desde a migration.

---

## 23. Testes automatizados obrigatórios

### 23.1 Migration / repository

- clean install com 0030;
- upgrade 0029 -> 0030;
- backfill do negócio existente;
- revision inicial;
- nome permanece em `businesses`;
- profile ausente inicializa com segurança;
- isolamento por businessId;
- update atômico D1 de nome + perfil + receipt;
- conflito de revisão;
- mutationId replay;
- mutationId reutilizado com payload diferente rejeitado.

### 23.2 Logo / R2

- replace válido;
- remove válido;
- keep não toca R2;
- PNG/JPEG/WebP de entrada normalizado pelo cliente;
- Worker rejeita MIME/assinatura inválidos;
- Worker rejeita > limite;
- key é server-generated;
- outro negócio não consegue ler logo;
- falha R2 antes do commit não muda D1;
- falha D1 após upload tenta remover objeto novo;
- sucesso D1 + falha ao limpar objeto antigo preserva perfil confirmado;
- resultado incerto consulta receipt e não auto-reenvia.

### 23.3 API/capabilities

- view permitido;
- view negado;
- manage permitido;
- manage negado;
- manage implica view;
- GET logo exige sessão, mas não capability administrativa;
- same-origin na mutação;
- businessId do payload, se tentado, é rejeitado/ignorado conforme contrato — nunca autoridade.

### 23.4 Frontend

- card aparece/omite por capability;
- rota direta autorizada;
- rota direta negada;
- loading/read-only/error;
- nome obrigatório;
- campos opcionais;
- preview logo local;
- remover logo só altera draft até Save;
- Cancelar desfaz preview/remoção;
- save multipart correto;
- conflito preserva draft;
- unconfirmed não reenvia;
- offline bloqueia save;
- fallback de iniciais/ícone;
- desktop usa logo da operação;
- mobile mantém Mesiva e usa identidade da operação no menu;
- clear/dark e Clássico/Mesiva sem regressão.

### 23.5 Não regressão

Rodar suites de:

- sessão/bootstrap;
- navegação;
- settings;
- impressão;
- Kitchen TV;
- shell/topbar;
- deep links;
- arquitetura;
- D1 clean install/upgrade;
- build/lint/dry-runs.

---

## 24. Homologação manual de staging

Matriz mínima:

1. card Identidade da operação aparece;
2. abrir por clique e deep link;
3. nome atual carregado;
4. salvar somente nome;
5. nome muda na topbar sem F5;
6. reload mantém nome;
7. outro dispositivo vê nome após refresh/focus;
8. upload PNG;
9. upload JPG;
10. upload WebP;
11. preview antes de salvar;
12. Cancelar após selecionar logo não publica imagem;
13. salvar logo;
14. reload mantém logo;
15. remover logo;
16. fallback de logo -> iniciais/ícone;
17. telefone;
18. endereço completo;
19. endereço parcial;
20. conflito em dois dispositivos;
21. offline;
22. erro controlado de upload quando reproduzível;
23. desktop claro;
24. desktop escuro;
25. mobile claro;
26. mobile escuro;
27. tema Clássico;
28. tema Mesiva;
29. login continua Mesiva;
30. Kitchen TV continua funcional;
31. novo ticket usa nome novo;
32. print job já existente não é reescrito;
33. logout/login não ressuscita draft;
34. restricted capability quando houver identidade adequada; caso staging continue sem fixture restrita, registrar BLOCKED, não PASS fictício.

Nenhum deploy de produção antes da homologação e autorização explícita.

---

## 25. Fora do escopo

- CNPJ;
- razão social;
- inscrição estadual;
- dados fiscais;
- Instagram/redes sociais;
- horários;
- cardápio público;
- múltiplas filiais;
- seleção de empresa;
- usuários/perfis individuais;
- upload de foto de funcionário;
- tema por negócio;
- cor personalizada por operação;
- domínio personalizado por operação;
- logo em ESC/POS/PDF;
- logo na Kitchen TV;
- CDN/bucket público;
- biblioteca genérica de mídia;
- crop/editor avançado de imagem;
- histórico/auditoria visual de versões do logo;
- geocoding/CEP externo.

---

## 26. Evoluções futuras possíveis

Após esta V1, sem compromisso automático:

- dados fiscais;
- horários;
- logo em documentos customer-facing;
- logo na Kitchen TV por projeção restrita;
- múltiplas unidades;
- domínio público/cardápio;
- perfil comercial mais completo.

Essas evoluções não devem inflar a implementação atual.

---

## 27. Sequência de implementação esperada

Após aprovação desta spec, escrever plano TDD em tarefas pequenas, aproximadamente:

1. migration e repository do perfil;
2. capabilities e API JSON;
3. R2 + contrato de logo;
4. adapter/controlador frontend;
5. navegação + home de Configurações;
6. tela Identidade da operação;
7. projeção bootstrap + shell desktop/mobile;
8. reconciliação/erros/offline;
9. gates e staging;
10. homologação manual;
11. fechamento/merge somente com autorização explícita.

A ordem exata pertence ao plano de implementação, não a esta spec.

---

## 28. Auto-revisão da spec

A redação foi reconciliada com a base atual:

- `businesses.name` já existe e continua autoridade;
- não foi criado nome duplicado;
- a home de Configurações e o registro de rotas existentes são reutilizados;
- o padrão de capabilities `.view/.manage` é preservado;
- o sistema atual de revision/receipt/conflito é reutilizado;
- imagem fica fora do D1;
- R2 staging/produção são isolados;
- a ausência de transação distribuída R2+D1 é tratada explicitamente;
- não há upload imediato ao escolher arquivo;
- não há auto retry de mutação incerta;
- Mesiva continua produto e a operação continua entidade separada;
- impressão física, Kitchen TV e tema local não foram acoplados sem necessidade;
- nenhuma renomeação de IDs/slugs/infra histórica é exigida.

Não há decisão funcional indispensável em aberto para escrever o plano.

---

## 29. Gate de aprovação

Aprovar esta spec autoriza **somente** a escrita do plano detalhado de implementação.

Não autoriza:

- criar migration na master;
- criar buckets;
- implementar código;
- deploy staging;
- merge;
- deploy production.
