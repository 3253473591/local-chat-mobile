<script setup lang="ts">
import HeaderBar from '../../components/HeaderBar.vue'
import SettingGroup from '../../components/SettingGroup.vue'
import SettingRow from '../../components/SettingRow.vue'
import { useSettingsStore } from '../../stores/settings'
import { useUIStore } from '../../stores/ui'

const settingsStore = useSettingsStore()
const uiStore = useUIStore()

async function handleFetchModels() {
  if (!settingsStore.settings.apiKey) {
    uiStore.showToast('请先填写 API Key')
    return
  }
  try {
    await settingsStore.fetchModels()
    uiStore.showToast(`已拉取 ${settingsStore.settings.models.length} 个模型`)
  } catch (e) {
    uiStore.showToast(`拉取失败：${e instanceof Error ? e.message : String(e)}`)
  }
}

function choose(m: string) {
  settingsStore.settings.defaultModel = m
}
</script>

<template>
  <div class="flex h-full flex-col bg-bg">
    <HeaderBar title="模型" back-to="/settings" />

    <main class="flex-1 overflow-y-auto pb-6">
      <SettingGroup>
        <SettingRow
          :label="settingsStore.modelsLoading ? '拉取中…' : '刷新模型列表'"
          clickable
          @click="handleFetchModels"
        />
      </SettingGroup>

      <SettingGroup title="默认模型（新对话生效）">
        <SettingRow
          v-for="m in settingsStore.settings.models"
          :key="m"
          :label="m"
          clickable
          :arrow="false"
          @click="choose(m)"
        >
          <span v-if="m === settingsStore.settings.defaultModel" class="text-accent">✓</span>
        </SettingRow>
        <div v-if="settingsStore.settings.models.length === 0" class="px-4 py-3 text-sm text-sub">
          点击「刷新模型列表」拉取
        </div>
      </SettingGroup>
    </main>
  </div>
</template>
