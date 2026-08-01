<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import HeaderBar from '../components/HeaderBar.vue'
import ImageCropper from '../components/ImageCropper.vue'
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
const topPChoice = ref('')

function loadCurrent() {
  if (!conv.value) return
  thinkingChoice.value = conv.value.thinkingEnabled === undefined ? '' : String(conv.value.thinkingEnabled)
  effortChoice.value = conv.value.reasoningEffort ?? ''
  tempChoice.value = conv.value.temperature === undefined ? '' : String(conv.value.temperature)
  topPChoice.value = conv.value.topP === undefined ? '' : String(conv.value.topP)
}
loadCurrent()

/** 有效思考模式（对话级优先，undefined 跟随全局）——温度/top_p 仅在关闭时可见 */
const effectiveThinking = computed(() => {
  const choice = conv.value?.thinkingEnabled
  return choice === undefined ? settingsStore.settings.thinkingEnabled : choice
})

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
    topP: topPChoice.value === '' ? undefined : Number(topPChoice.value),
  })
  uiStore.showToast('已保存')
}

/** 正在等待裁剪的图片（背景 9:16 / 头像 1:1） */
const crop = ref<{ file: File; aspect: number; field: 'bgImage' | 'avatar' | 'userAvatar' } | null>(null)

function onFile(evt: Event, field: 'bgImage' | 'avatar' | 'userAvatar') {
  const input = evt.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  crop.value = {
    file,
    aspect: field === 'bgImage' ? 9 / 16 : 1,
    field,
  }
}

function onCropConfirm(dataUrl: string) {
  if (!crop.value) return
  void convStore.setAppearance({ [crop.value.field]: dataUrl })
  crop.value = null
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
            class="min-w-0 flex-1 bg-transparent py-2 text-right text-[15px] outline-none"
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
            <option value="xhigh">xhigh（pro → max）</option>
            <option value="max">max</option>
          </select>
        </div>
        <template v-if="!effectiveThinking">
          <div class="setting-row flex min-h-13 items-center gap-3 px-4">
            <label class="shrink-0 text-[15px] text-ink">温度</label>
            <input
              v-model="tempChoice"
              type="text"
              inputmode="decimal"
              placeholder="跟随全局"
              class="min-w-0 flex-1 bg-transparent py-2 text-right text-[15px] outline-none"
              @change="saveThinking"
            />
          </div>
          <div class="setting-row flex min-h-13 items-center gap-3 px-4">
            <label class="shrink-0 text-[15px] text-ink">top_p</label>
            <input
              v-model="topPChoice"
              type="text"
              inputmode="decimal"
              placeholder="跟随全局（0~1）"
              class="min-w-0 flex-1 bg-transparent py-2 text-right text-[15px] outline-none"
              @change="saveThinking"
            />
          </div>
        </template>
        <div v-else class="setting-row flex min-h-13 items-center gap-3 px-4">
          <span class="shrink-0 text-[15px] text-ink">温度 / top_p</span>
          <span class="flex-1 text-right text-xs text-sub">思考模式下不生效</span>
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

    <ImageCropper
      v-if="crop"
      :file="crop.file"
      :aspect="crop.aspect"
      @confirm="onCropConfirm"
      @cancel="crop = null"
    />
  </div>
</template>
