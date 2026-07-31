<script setup lang="ts">
import HeaderBar from '../../components/HeaderBar.vue'
import SettingGroup from '../../components/SettingGroup.vue'
import SettingRow from '../../components/SettingRow.vue'
import { useSettingsStore } from '../../stores/settings'
import { useUIStore } from '../../stores/ui'

const settingsStore = useSettingsStore()
const uiStore = useUIStore()

async function handleFetchBalance() {
  if (!settingsStore.settings.apiKey) {
    uiStore.showToast('请先填写 API Key')
    return
  }
  try {
    const b = await settingsStore.fetchBalance()
    if (b && b.length > 0) {
      uiStore.showToast(`余额 ${b[0].currency} ${b[0].totalBalance}`)
    } else {
      uiStore.showToast('无余额信息')
    }
  } catch (e) {
    uiStore.showToast(`查询失败：${e instanceof Error ? e.message : String(e)}`)
  }
}
</script>

<template>
  <div class="flex h-full flex-col bg-bg">
    <HeaderBar title="API 设置" back-to="/settings" />

    <main class="flex-1 overflow-y-auto pb-6">
      <SettingGroup title="凭证">
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <label class="shrink-0 text-[15px] text-ink" for="apiKey">API Key</label>
          <input
            id="apiKey"
            v-model="settingsStore.settings.apiKey"
            type="password"
            placeholder="sk-..."
            class="min-w-0 flex-1 bg-transparent py-2 text-right text-[15px] outline-none"
            autocomplete="off"
          />
        </div>
      </SettingGroup>

      <SettingGroup>
        <SettingRow label="查询余额" clickable @click="handleFetchBalance" />
      </SettingGroup>
    </main>
  </div>
</template>
