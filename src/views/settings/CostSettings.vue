<script setup lang="ts">
import HeaderBar from '../../components/HeaderBar.vue'
import SettingGroup from '../../components/SettingGroup.vue'
import SettingRow from '../../components/SettingRow.vue'
import { useSettingsStore } from '../../stores/settings'

const settingsStore = useSettingsStore()

function addPeak() {
  settingsStore.settings.peakRule.peaks.push({ start: '09:00', end: '12:00' })
}
function removePeak(index: number) {
  settingsStore.settings.peakRule.peaks.splice(index, 1)
}
function addPrice() {
  const name = window.prompt('模型 ID（如 deepseek-v4-flash）：')
  if (!name || !name.trim()) return
  settingsStore.settings.prices[name.trim()] = { in: 0, out: 0, cacheHit: 0 }
}
function removePrice(model: string) {
  if (!window.confirm(`删除模型 ${model} 的单价配置？`)) return
  delete settingsStore.settings.prices[model]
}
</script>

<template>
  <div class="flex h-full flex-col bg-bg">
    <HeaderBar title="费用与计费" back-to="/settings" />

    <main class="flex-1 overflow-y-auto pb-6">
      <SettingGroup title="追踪">
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <span class="shrink-0 text-[15px] text-ink">费用追踪</span>
          <span class="flex-1 text-right text-[13px] text-sub">{{ settingsStore.settings.costTracking ? '开启' : '关闭' }}</span>
          <input v-model="settingsStore.settings.costTracking" type="checkbox" class="h-5 w-5" />
        </div>
      </SettingGroup>

      <SettingGroup title="分时段计费（高峰翻倍）">
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <span class="shrink-0 text-[15px] text-ink">启用</span>
          <span class="flex-1 text-right text-[13px] text-sub">{{ settingsStore.settings.peakRule.enabled ? '开启' : '关闭' }}</span>
          <input v-model="settingsStore.settings.peakRule.enabled" type="checkbox" class="h-5 w-5" />
        </div>
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <label class="shrink-0 text-[15px] text-ink">高峰乘数 ×</label>
          <input
            v-model.number="settingsStore.settings.peakRule.multiplier"
            type="number"
            min="1"
            step="0.5"
            class="w-16 bg-transparent py-2 text-right text-[15px] outline-none"
          />
        </div>
        <div
          v-for="(p, i) in settingsStore.settings.peakRule.peaks"
          :key="i"
          class="setting-row flex min-h-13 items-center gap-3 px-4"
        >
          <span class="text-[15px] text-ink">高峰时段</span>
          <span class="flex-1"></span>
          <input v-model="p.start" type="time" class="bg-transparent text-[15px] outline-none" />
          <span class="text-sub">至</span>
          <input v-model="p.end" type="time" class="bg-transparent text-[15px] outline-none" />
          <button class="text-xs text-danger active:opacity-60" @click="removePeak(i)">✕</button>
        </div>
        <SettingRow label="＋ 添加时段" clickable :arrow="false" @click="addPeak" />
      </SettingGroup>

      <SettingGroup title="单价（元 / 百万 token）">
        <div v-for="(price, model) in settingsStore.settings.prices" :key="model" class="setting-row px-4 py-2.5">
          <div class="mb-1.5 flex items-center justify-between">
            <span class="truncate text-[15px] text-ink">{{ model }}</span>
            <button class="text-xs text-danger active:opacity-60" @click="removePrice(model)">删除</button>
          </div>
          <div class="flex gap-2 text-xs text-sub">
            <label class="min-w-0 flex-1">
              输入
              <input v-model.number="price.in" type="number" min="0" step="0.01" class="mt-0.5 w-full rounded bg-bg px-2 py-1.5 text-sm outline-none" />
            </label>
            <label class="min-w-0 flex-1">
              输出
              <input v-model.number="price.out" type="number" min="0" step="0.01" class="mt-0.5 w-full rounded bg-bg px-2 py-1.5 text-sm outline-none" />
            </label>
            <label class="min-w-0 flex-1">
              缓存命中
              <input v-model.number="price.cacheHit" type="number" min="0" step="0.01" class="mt-0.5 w-full rounded bg-bg px-2 py-1.5 text-sm outline-none" />
            </label>
          </div>
        </div>
        <SettingRow label="＋ 添加模型单价" clickable :arrow="false" @click="addPrice" />
      </SettingGroup>
    </main>
  </div>
</template>
