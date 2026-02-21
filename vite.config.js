import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Для GitHub Pages: base должен совпадать с именем репозитория (например /podcast/)
const base = process.env.GITHUB_PAGES === 'true' ? '/podcast/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        id: 'https://asorocking.github.io/podcast/',
        name: 'Podcast',
        short_name: 'Podcast',
        description: 'Podcast PWA: воспроизведение подкастов с текстом и переводом слов',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          {
            src: `${base}icon.svg`,
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: `${base}icon.svg`,
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: `${base}index.html`
      }
    })
  ]
})
