# Amor e Sabor

Aplicação web para gestão de delivery e restaurante.

## Desenvolvimento local

```bash
npm install
npm run dev
```

A aplicação fica disponível em:

- http://localhost:4173/

## Deploy na Cloudflare Pages

Essa aplicação é uma SPA em React/Vite e pode ser hospedada facilmente no Cloudflare Pages.

### Configuração

- Build command: `npm install && npm run build`
- Output directory: `dist`
- Framework preset: `Vite`

### Passo a passo

1. Envie o projeto para um repositório no GitHub.
2. Acesse o Cloudflare Dashboard.
3. Vá em Pages > Create a project > Connect to Git.
4. Escolha o repositório.
5. Configure:
   - Build command: `npm install && npm run build`
   - Output directory: `dist`
6. Clique em Save and Deploy.

### Observações

- A aplicação usa `localStorage`, então os dados ficam no navegador por enquanto.
- Para evoluir para backend real, a melhor estrutura depois é:
  - Cloudflare Pages para a interface
  - Cloudflare Workers para API
  - D1 para banco de dados

## Scripts

```bash
npm run dev
npm run build
npm run preview
```
