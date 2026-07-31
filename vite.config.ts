import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages 子路径部署（仓库名 local-chat-mobile）
// 若改用自定义域名或 user.github.io 仓库，改为 '/' 并重新 build
const BASE = '/local-chat-mobile/'

export default defineConfig({
  base: BASE,
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '本地对话',
        short_name: '对话',
        description: '个人自用本地对话程序（DeepSeek）',
        lang: 'zh-CN',
        theme_color: '#EDEDED',
        background_color: '#EDEDED',
        display: 'standalone',
        // manifest 不会自动拼接 base，路径需手动带上前缀
        start_url: BASE,
        icons: [
          { src: `${BASE}icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${BASE}icon-512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${BASE}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: `${BASE}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            // DeepSeek API 请求一律不走缓存
            urlPattern: /^https:\/\/api\.deepseek\.com\/.*/,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    host: true, // 局域网可访问，方便手机真机调试
    port: 5173,
  },
})
