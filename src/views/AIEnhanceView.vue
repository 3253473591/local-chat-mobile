<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import HeaderBar from '../components/HeaderBar.vue'
import SettingGroup from '../components/SettingGroup.vue'
import SettingRow from '../components/SettingRow.vue'
import { useConversationStore } from '../stores/conversation'
import { useSettingsStore } from '../stores/settings'
import { useUIStore } from '../stores/ui'

const route = useRoute()
const convStore = useConversationStore()
const settingsStore = useSettingsStore()
const uiStore = useUIStore()

const conv = computed(() => convStore.conversations.find((c) => c.id === convStore.currentId))

// 对话级三态：'' = 跟随全局
const thinkingChoice = ref('')
const effortChoice = ref('')
const tempChoice = ref('')

function loadCurrent() {
  if (!conv.value) return
  thinkingChoice.value = conv.value.thinkingEnabled === undefined ? '' : String(conv.value.thinkingEnabled)
  effortChoice.value = conv.value.reasoningEffort ?? ''
  tempChoice.value = conv.value.temperature === undefined ? '' : String(conv.value.temperature)
}
loadCurrent()

const modelOptions = computed(() => {
  const list = settingsStore.settings.models
  return list.length > 0 ? list : ['deepseek-v4-flash', 'deepseek-v4-pro']
})

const promptLabel = computed(() => (conv.value?.prompt ? '已设置' : '未设置'))
const regexLabel = computed(() => (conv.value?.regex ? '已设置' : '未设置'))

function chooseModel(m: string) {
  if (conv.value) void convStore.setEnhance({ model: m })
}

function editPrompt() {
  uiStore.openEditor({
    title: '对话提示词',
    value: conv.value?.prompt ?? '',
    mode: 'text',
    onConfirm: (v) => void convStore.setEnhance({ prompt: v }),
  })
}

function editRegex() {
  uiStore.openEditor({
    title: '对话正则',
    value: conv.value?.regex ?? '',
    mode: 'text',
    regexTest: true,
    onConfirm: (v) => void convStore.setEnhance({ regex: v }),
  })
}

function saveThinking() {
  void convStore.setEnhance({
    thinkingEnabled: thinkingChoice.value === '' ? undefined : thinkingChoice.value === 'true',
    reasoningEffort: effortChoice.value === '' ? undefined : effortChoice.value,
    temperature: tempChoice.value === '' ? undefined : Number(tempChoice.value),
  })
  uiStore.showToast('已保存')
}

function onFile(evt: Event, field: 'bgImage' | 'avatar' | 'userAvatar') {
  const input = evt.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    void convStore.setAppearance({ [field]: String(reader.result) })
  }
  reader.readAsDataURL(file)
  input.value = ''
}

function clearField(field: 'bgImage' | 'avatar' | 'userAvatar') {
  void convStore.setAppearance({ [field]: '' })
}
</script>

<template>
  <div class="flex h-full flex-col bg-bg">
    <HeaderBar :title="conv?.title ?? 'AI 增强'" :back-to="`/chat/${route.params.id}`" />

    <main class="flex-1 overflow-y-auto pb-6">
      <!-- 模型 -->
      <SettingGroup title="模型">
        <SettingRow
          v-for="m in modelOptions"
          :key="m"
          :label="m"
          clickable
          :arrow="false"
          @click="chooseModel(m)"
        >
          <span v-if="m === (conv?.model || settingsStore.settings.defaultModel)" class="text-accent">✓</span>
        </SettingRow>
      </SettingGroup>

      <!-- 提示词 / 正则 -->
      <SettingGroup title="提示词与正则">
        <SettingRow label="提示词" :value="promptLabel" clickable @click="editPrompt" />
        <SettingRow label="正则" :value="regexLabel" clickable @click="editRegex" />
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <label class="shrink-0 text-[15px] text-ink">替换为</label>
          <input
            :value="conv?.regexReplacement ?? ''"
            placeholder="留空 = 删除匹配"
            class="min-w-0 flex-1 bg-transparent py-2 text-right text-[15px] outline-none"
            @change="(e) => void convStore.setEnhance({ regexReplacement: (e.target as HTMLInputElement).value })"
          />
        </div>
      </SettingGroup>

      <!-- 上下文与生成 -->
      <SettingGroup title="上下文与生成">
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <label class="shrink-0 text-[15px] text-ink">附带 X 轮</label>
          <input
            :value="conv?.xRounds ?? settingsStore.settings.xRounds"
            type="number"
            min="0"
            max="20"
            class="w-20 bg-transparent py-2 text-right text-[15px] outline-none"
            @change="(e) => void convStore.setEnhance({ xRounds: Number((e.target as HTMLInputElement).value) })"
          />
        </div>
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <label class="shrink-0 text-[15px] text-ink">思考模式</label>
          <select v-model="thinkingChoice" class="min-w-0 flex-1 bg-transparent py-2 text-right text-[15px] outline-none" @change="saveThinking">
            <option value="">跟随全局</option>
            <option value="true">开启（思维链）</option>
            <option value="false">关闭</option>
          </select>
        </div>
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <label class="shrink-0 text-[15px] text-ink">思考深度</label>
          <select v-model="effortChoice" class="min-w-0 flex-1 bg-transparent py-2 text-right text-[15px] outline-none" @change="saveThinking">
            <option value="">跟随全局</option>
            <option value="low">low</option>
            <option value="high">high</option>
            <option value="max">max</option>
          </select>
        </div>
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <label class="shrink-0 text-[15px] text-ink">温度</label>
          <input
            v-model="tempChoice"
            type="text"
            inputmode="decimal"
            placeholder="跟随全局"
            class="w-24 bg-transparent py-2 text-right text-[15px] outline-none"
            @change="saveThinking"
          />
        </div>
      </SettingGroup>

      <!-- 外观 -->
      <SettingGroup title="外观（本对话，留空用全局）">
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <span class="shrink-0 text-[15px] text-ink">背景</span>
          <span class="flex-1"></span>
          <img v-if="conv?.bgImage" :src="conv.bgImage" class="h-10 w-10 rounded object-cover" alt="背景" />
          <label class="cursor-pointer text-[15px] text-accent active:opacity-60">
            上传
            <input type="file" accept="image/*" class="hidden" @change="onFile($event, 'bgImage')" />
          </label>
          <button v-if="conv?.bgImage" class="text-[15px] text-danger active:opacity-60" @click="clearField('bgImage')">清除</button>
        </div>
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <span class="shrink-0 text-[15px] text-ink">AI 头像</span>
          <span class="flex-1"></span>
          <img v-if="conv?.avatar || settingsStore.settings.avatar" :src="conv?.avatar || settingsStore.settings.avatar" class="h-10 w-10 rounded-full object-cover" alt="AI" />
          <label class="cursor-pointer text-[15px] text-accent active:opacity-60">
            上传
            <input type="file" accept="image/*" class="hidden" @change="onFile($event, 'avatar')" />
          </label>
          <button v-if="conv?.avatar" class="text-[15px] text-danger active:opacity-60" @click="clearField('avatar')">清除</button>
        </div>
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <span class="shrink-0 text-[15px] text-ink">用户头像</span>
          <span class="flex-1"></span>
          <img v-if="conv?.userAvatar || settingsStore.settings.userAvatar" :src="conv?.userAvatar || settingsStore.settings.userAvatar" class="h-10 w-10 rounded-full object-cover" alt="用户" />
          <label class="cursor-pointer text-[15px] text-accent active:opacity-60">
            上传
            <input type="file" accept="image/*" class="hidden" @change="onFile($event, 'userAvatar')" />
          </label>
          <button v-if="conv?.userAvatar" class="text-[15px] text-danger active:opacity-60" @click="clearField('userAvatar')">清除</button>
        </div>
      </SettingGroup>
    </main>
  </div>
</template>
