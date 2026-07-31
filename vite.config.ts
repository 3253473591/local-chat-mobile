import { defineConfig, type PluginOption } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  // APK（Capacitor 本地加载）用根路径；GitHub Pages 用子路径部署
  const isApk = mode === 'apk'
  const BASE = isApk ? '/' : '/local-chat-mobile/'

  const plugins: PluginOption[] = [vue(), tailwindcss()]

  // PWA 只用于浏览器安装；APK 里 WebView 不需要 service worker，避免缓存问题
  if (!isApk) {
    plugins.push(
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
    )
  }

  return {
    base: BASE,
    plugins,
    server: {
      host: true, // 局域网可访问，方便手机真机调试
      port: 5173,
    },
  }
})
