<script setup lang="ts">
import { computed } from 'vue'
import HeaderBar from '../../components/HeaderBar.vue'
import SettingGroup from '../../components/SettingGroup.vue'
import SettingRow from '../../components/SettingRow.vue'
import { useSettingsStore } from '../../stores/settings'
import { useUIStore } from '../../stores/ui'

const settingsStore = useSettingsStore()
const uiStore = useUIStore()

const tempInput = computed({
  get: () => (settingsStore.settings.temperature === null ? '' : String(settingsStore.settings.temperature)),
  set: (v: string) => {
    settingsStore.settings.temperature = v === '' ? null : Number(v)
  },
})

function editPrompt() {
  uiStore.openEditor({
    title: '全局提示词',
    value: settingsStore.settings.prompt,
    mode: 'text',
    onConfirm: (v) => (settingsStore.settings.prompt = v),
  })
}

function editRegex() {
  uiStore.openEditor({
    title: '全局正则',
    value: settingsStore.settings.regex,
    mode: 'text',
    regexTest: true,
    onConfirm: (v) => (settingsStore.settings.regex = v),
  })
}
</script>

<template>
  <div class="flex h-full flex-col bg-bg">
    <HeaderBar title="AI 增强默认" back-to="/settings" />

    <main class="flex-1 overflow-y-auto pb-6">
      <SettingGroup title="提示词与正则">
        <SettingRow
          label="提示词"
          :value="settingsStore.settings.prompt ? '已设置' : '未设置'"
          clickable
          @click="editPrompt"
        />
        <SettingRow
          label="正则"
          :value="settingsStore.settings.regex ? '已设置' : '未设置'"
          clickable
          @click="editRegex"
        />
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <label class="shrink-0 text-[15px] text-ink">替换为</label>
          <input
            v-model="settingsStore.settings.regexReplacement"
            placeholder="留空 = 删除匹配"
            class="min-w-0 flex-1 bg-transparent py-2 text-right text-[15px] outline-none"
          />
        </div>
      </SettingGroup>

      <SettingGroup title="上下文与生成">
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <label class="shrink-0 text-[15px] text-ink">附带 X 轮</label>
          <input
            v-model.number="settingsStore.settings.xRounds"
            type="number"
            min="0"
            max="20"
            class="w-20 bg-transparent py-2 text-right text-[15px] outline-none"
          />
        </div>
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <span class="shrink-0 text-[15px] text-ink">思考模式</span>
          <span class="flex-1 text-right text-[13px] text-sub">{{ settingsStore.settings.thinkingEnabled ? '开启' : '关闭' }}</span>
          <input v-model="settingsStore.settings.thinkingEnabled" type="checkbox" class="h-5 w-5" />
        </div>
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <label class="shrink-0 text-[15px] text-ink">思考深度</label>
          <select
            v-model="settingsStore.settings.reasoningEffort"
            class="min-w-0 flex-1 bg-transparent py-2 text-right text-[15px] outline-none"
          >
            <option value="low">low（浅）</option>
            <option value="high">high（默认）</option>
            <option value="max">max（深）</option>
          </select>
        </div>
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <label class="shrink-0 text-[15px] text-ink">温度</label>
          <input
            v-model="tempInput"
            type="number"
            min="0"
            max="2"
            step="0.1"
            placeholder="默认"
            class="w-20 bg-transparent py-2 text-right text-[15px] outline-none"
          />
          <span class="text-xs text-sub">留空 = 默认</span>
        </div>
      </SettingGroup>
    </main>
  </div>
</template>
