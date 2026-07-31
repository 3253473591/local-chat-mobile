<script setup lang="ts">
import { computed } from 'vue'
import HeaderBar from '../components/HeaderBar.vue'
import SettingGroup from '../components/SettingGroup.vue'
import SettingRow from '../components/SettingRow.vue'
import { useSettingsStore } from '../stores/settings'

const settingsStore = useSettingsStore()

const apiKeyLabel = computed(() =>
  settingsStore.settings.apiKey ? `${settingsStore.settings.apiKey.slice(0, 6)}…` : '未设置',
)
</script>

<template>
  <div class="flex h-full flex-col bg-bg">
    <HeaderBar title="设置" back-to="/" />

    <main class="flex-1 overflow-y-auto pb-6">
      <SettingGroup title="API">
        <SettingRow label="API 设置" :value="apiKeyLabel" clickable @click="$router.push('/settings/api')" />
        <SettingRow
          label="模型"
          :value="settingsStore.settings.defaultModel"
          clickable
          @click="$router.push('/settings/model')"
        />
      </SettingGroup>

      <SettingGroup title="AI 增强">
        <SettingRow label="AI 增强默认" clickable @click="$router.push('/settings/ai')" />
      </SettingGroup>

      <SettingGroup title="费用">
        <SettingRow
          label="费用与计费"
          :value="settingsStore.settings.costTracking ? '已开启追踪' : '已关闭追踪'"
          clickable
          @click="$router.push('/settings/cost')"
        />
      </SettingGroup>

      <SettingGroup title="外观">
        <SettingRow label="外观" clickable @click="$router.push('/settings/appearance')" />
      </SettingGroup>

      <div class="px-4 py-4 text-center text-xs text-sub">API Key 仅保存在本机浏览器（IndexedDB），不会外发</div>
    </main>
  </div>
</template>
