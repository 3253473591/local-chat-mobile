import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ActionSheetItem {
  label: string
  danger?: boolean
  onClick: () => void
}

export interface EditorState {
  visible: boolean
  title: string
  value: string
  reasoning?: string // assistant 编辑时
  mode: 'text' | 'assistant'
  regexTest?: boolean // 显示正则实时测试区
  onConfirm: (value: string, reasoning?: string) => void
}

export const useUIStore = defineStore('ui', () => {
  const toast = ref<string | null>(null)
  let toastTimer: number | null = null

  const actionSheetVisible = ref(false)
  const actionSheetItems = ref<ActionSheetItem[]>([])

  const editor = ref<EditorState>({
    visible: false,
    title: '',
    value: '',
    mode: 'text',
    onConfirm: () => {},
  })

  function showToast(msg: string, duration = 2000) {
    toast.value = msg
    if (toastTimer) window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => (toast.value = null), duration)
  }

  function openActionSheet(items: ActionSheetItem[]) {
    actionSheetItems.value = items
    actionSheetVisible.value = true
  }
  function closeActionSheet() {
    actionSheetVisible.value = false
  }

  function openEditor(opts: Omit<EditorState, 'visible'>) {
    editor.value = { visible: true, ...opts }
  }
  function closeEditor() {
    editor.value.visible = false
  }

  return {
    toast,
    showToast,
    actionSheetVisible,
    actionSheetItems,
    openActionSheet,
    closeActionSheet,
    editor,
    openEditor,
    closeEditor,
  }
})
