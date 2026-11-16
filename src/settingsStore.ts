import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Provider } from './search.ts'
import {
  defaults,
  readSettings,
  settingsFromStorage,
  settingsKey,
  writeSettings,
  type Settings,
} from './settings.ts'

export function editableContent({ quote, groups, wallpaper }: Settings) {
  return { quote, groups, wallpaper }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref(defaults())
  const loadState = ref<'loading' | 'ready' | 'invalid'>('loading')

  function applySettings(value: Settings) {
    settings.value = value
    loadState.value = 'ready'
  }

  function startSync() {
    let active = true
    loadState.value = 'loading'

    function onStorageChanged(
      changes: Record<string, browser.storage.StorageChange>,
      area: string,
    ) {
      if (area !== 'local' || !(settingsKey in changes)) return
      try {
        applySettings(settingsFromStorage(changes[settingsKey].newValue))
      } catch {
        loadState.value = 'invalid'
      }
    }

    browser.storage.onChanged.addListener(onStorageChanged)
    void readSettings().then(
      (saved) => {
        if (active && loadState.value === 'loading') applySettings(saved)
      },
      () => {
        if (active && loadState.value === 'loading') loadState.value = 'invalid'
      },
    )

    return () => {
      active = false
      browser.storage.onChanged.removeListener(onStorageChanged)
    }
  }

  async function chooseProvider(provider: Provider) {
    await writeSettings((current) => ({ ...current, provider }))
  }

  async function saveEdits(content: ReturnType<typeof editableContent>, baseline: string) {
    await writeSettings((current) => {
      if (JSON.stringify(editableContent(current)) !== baseline) {
        throw new Error('Another tab changed these settings. Reopen Edit before saving.')
      }
      return { ...current, ...content }
    })
  }

  async function restore(backup: Settings) {
    await writeSettings(backup)
  }

  return { settings, loadState, startSync, chooseProvider, saveEdits, restore }
})
