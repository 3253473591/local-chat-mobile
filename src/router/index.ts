import { createRouter, createWebHashHistory } from 'vue-router'
import AIEnhanceView from '../views/AIEnhanceView.vue'
import ChatView from '../views/ChatView.vue'
import HomeView from '../views/HomeView.vue'
import SettingsView from '../views/SettingsView.vue'
import AiDefaults from '../views/settings/AiDefaults.vue'
import ApiSettings from '../views/settings/ApiSettings.vue'
import AppearanceSettings from '../views/settings/AppearanceSettings.vue'
import CostSettings from '../views/settings/CostSettings.vue'
import ModelSettings from '../views/settings/ModelSettings.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/chat/:id', name: 'chat', component: ChatView },
    { path: '/chat/:id/enhance', name: 'chat-enhance', component: AIEnhanceView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/settings/api', name: 'settings-api', component: ApiSettings },
    { path: '/settings/model', name: 'settings-model', component: ModelSettings },
    { path: '/settings/ai', name: 'settings-ai', component: AiDefaults },
    { path: '/settings/cost', name: 'settings-cost', component: CostSettings },
    { path: '/settings/appearance', name: 'settings-appearance', component: AppearanceSettings },
  ],
})
