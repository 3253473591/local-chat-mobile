<script setup lang="ts">
import HeaderBar from '../../components/HeaderBar.vue'
import SettingGroup from '../../components/SettingGroup.vue'
import { useSettingsStore } from '../../stores/settings'

const settingsStore = useSettingsStore()

function onFile(evt: Event, field: 'bgImage' | 'avatar' | 'userAvatar') {
  const input = evt.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    settingsStore.settings[field] = String(reader.result)
  }
  reader.readAsDataURL(file)
  input.value = ''
}

function clearField(field: 'bgImage' | 'avatar' | 'userAvatar') {
  settingsStore.settings[field] = ''
}
</script>

<template>
  <div class="flex h-full flex-col bg-bg">
    <HeaderBar title="外观" back-to="/settings" />

    <main class="flex-1 overflow-y-auto pb-6">
      <SettingGroup title="全局背景">
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <span class="shrink-0 text-[15px] text-ink">背景</span>
          <span class="flex-1"></span>
          <img v-if="settingsStore.settings.bgImage" :src="settingsStore.settings.bgImage" class="h-10 w-10 rounded object-cover" alt="背景" />
          <label class="cursor-pointer text-[15px] text-accent active:opacity-60">
            上传
            <input type="file" accept="image/*" class="hidden" @change="onFile($event, 'bgImage')" />
          </label>
          <button v-if="settingsStore.settings.bgImage" class="text-[15px] text-danger active:opacity-60" @click="clearField('bgImage')">清除</button>
        </div>
      </SettingGroup>

      <SettingGroup title="头像">
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <span class="shrink-0 text-[15px] text-ink">AI 头像</span>
          <span class="flex-1"></span>
          <img v-if="settingsStore.settings.avatar" :src="settingsStore.settings.avatar" class="h-10 w-10 rounded-full object-cover" alt="AI" />
          <label class="cursor-pointer text-[15px] text-accent active:opacity-60">
            上传
            <input type="file" accept="image/*" class="hidden" @change="onFile($event, 'avatar')" />
          </label>
          <button v-if="settingsStore.settings.avatar" class="text-[15px] text-danger active:opacity-60" @click="clearField('avatar')">清除</button>
        </div>
        <div class="setting-row flex min-h-13 items-center gap-3 px-4">
          <span class="shrink-0 text-[15px] text-ink">用户头像</span>
          <span class="flex-1"></span>
          <img v-if="settingsStore.settings.userAvatar" :src="settingsStore.settings.userAvatar" class="h-10 w-10 rounded-full object-cover" alt="用户" />
          <label class="cursor-pointer text-[15px] text-accent active:opacity-60">
            上传
            <input type="file" accept="image/*" class="hidden" @change="onFile($event, 'userAvatar')" />
          </label>
          <button v-if="settingsStore.settings.userAvatar" class="text-[15px] text-danger active:opacity-60" @click="clearField('userAvatar')">清除</button>
        </div>
      </SettingGroup>

      <div class="px-4 py-4 text-xs text-sub">
        头像与背景为全局默认；单个对话可在对话页右上角 AI 头像处单独覆盖
      </div>
    </main>
  </div>
</template>
