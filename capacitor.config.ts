import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.localchat.mobile',
  appName: '本地对话',
  webDir: 'dist',
  // 网页资源打包进 APK（本地加载，UI 离线可用；DeepSeek API 仍需联网）
  server: {
    androidScheme: 'https',
  },
}

export default config
