import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const kitchenTvOrdersPublicContract = () => ({
  name: 'kitchen-tv-orders-public-contract',
  enforce: 'pre',
  resolveId(source, importer) {
    const normalizedImporter = String(importer || '').replaceAll('\\', '/')
    if (source === '../domains/orders/index.js' && normalizedImporter.includes('/src/kitchen-display/')) {
      return fileURLToPath(new URL('./src/domains/orders/kitchenDisplayPublic.js', import.meta.url))
    }
    return null
  },
})

export default defineConfig({
  plugins: [kitchenTvOrdersPublicContract(), react()],
  base: '/',
  build: {
    manifest: true,
    target: 'chrome69',
    cssTarget: 'chrome69',
  },
  server: {
    host: '0.0.0.0',
    port: 4173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})
