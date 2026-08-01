<script setup lang="ts">
import { ref } from 'vue'
import HeaderBar from '../../components/HeaderBar.vue'
import ImageCropper from '../../components/ImageCropper.vue'
import SettingGroup from '../../components/SettingGroup.vue'
import { useSettingsStore } from '../../stores/settings'

const settingsStore = useSettingsStore()

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
  settingsStore.settings[crop.value.field] = dataUrl
  crop.value = null
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
        头像与背景为全局默认；单个对话可在对话页右上角 AI 头像处单独覆盖。上传后需裁剪（头像 1:1、背景 9:16）。
      </div>
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
