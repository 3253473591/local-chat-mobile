import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getBalance, listModels, type BalanceInfo } from '../api/deepseek'
import { loadSettings as loadSettingsRepo, saveSettings as saveSettingsRepo } from '../db/repository'
import type { GlobalSettings } from '../types'

const DEFAULT_SETTINGS: GlobalSettings = {
  apiKey: '',
  defaultModel: 'deepseek-v4-flash',
  models: [],
  costTracking: true,
  prompt: '',
  regex: '',
  regexReplacement: '',
  xRounds: 8,
  bgImage: '',
  avatar: '',
  userAvatar: '',
  thinkingEnabled: true,
  reasoningEffort: 'high',
  temperature: null,
  peakRule: {
    enabled: false,
    multiplier: 2,
    peaks: [
      { start: '09:00', end: '12:00' },
      { start: '14:00', end: '18:00' },
    ],
  },
  // 内置参考单价（元/百万 token，2026-07 官方平峰价；高峰时段会翻倍，可在设置页修改）
  // deepseek-chat/reasoner 已于 2026-07-24 弃用，旧消息计费由 normalizeModel 映射到 v4-flash
  prices: {
    'deepseek-v4-flash': { in: 1, out: 2, cacheHit: 0.02 },
    'deepseek-v4-pro': { in: 3, out: 6, cacheHit: 0.025 },
  },
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<GlobalSettings>({ ...DEFAULT_SETTINGS })
  const modelsLoading = ref(false)
  const balance = ref<BalanceInfo[] | null>(null)

  async function loadSettings() {
    const s = await loadSettingsRepo()
    if (s) settings.value = { ...DEFAULT_SETTINGS, ...s }
    // 防历史脏数据：模型列表去重
    settings.value.models = [...new Set(settings.value.models)]
    // 迁移 1：已弃用的默认模型 → v4-flash
    if (
      settings.value.defaultModel === 'deepseek-chat' ||
      settings.value.defaultModel === 'deepseek-reasoner'
    ) {
      settings.value.defaultModel = 'deepseek-v4-flash'
    }
    // 迁移 2：移除已弃用模型的价格条目（避免每次刷新"重新出现"）；确保 V4 价格存在
    delete settings.value.prices['deepseek-chat']
    delete settings.value.prices['deepseek-reasoner']
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS.prices)) {
      const cur = settings.value.prices[k]
      if (!cur || (cur.in === 0 && cur.out === 0 && cur.cacheHit === 0)) {
        settings.value.prices[k] = { ...v }
      }
    }
  }

  async function saveSettings() {
    await saveSettingsRepo(settings.value)
  }

  /** 动态拉取模型，未配置默认模型时自动设置为第一个 */
  async function fetchModels() {
    if (!settings.value.apiKey) return
    modelsLoading.value = true
    try {
      const models = await listModels(settings.value.apiKey)
      // 去重：/models 可能返回别名与新模型混杂
      settings.value.models = [...new Set(models)]
      if (!models.includes(settings.value.defaultModel) && models[0]) {
        settings.value.defaultModel = models[0]
      }
      await saveSettings()
    } finally {
      modelsLoading.value = false
    }
  }

  async function fetchBalance(): Promise<BalanceInfo[] | null> {
    if (!settings.value.apiKey) return null
    balance.value = await getBalance(settings.value.apiKey)
    return balance.value
  }

  return { settings, modelsLoading, balance, loadSettings, saveSettings, fetchModels, fetchBalance }
})
