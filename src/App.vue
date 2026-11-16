<script setup lang="ts">
import Editor from './Editor.vue'
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { isProvider, providers, searchUrl } from './search'
import { defaults, readSettings, settingsKey, wallpaperUrl, writeSettings } from './settings'

const settings = ref(defaults())
const query = ref('')
const error = ref('')
const choosingProvider = ref(false)
const editing = ref(false)
const editButton = ref<HTMLButtonElement>()

async function closeEditor() {
  editing.value = false
  await nextTick()
  editButton.value?.focus()
}

async function refreshSettings() {
  try {
    settings.value = await readSettings()
  } catch {
    error.value = 'Could not load saved settings.'
  }
}

function onStorageChanged(changes: Record<string, browser.storage.StorageChange>, area: string) {
  if (area === 'local' && settingsKey in changes) void refreshSettings()
}

onMounted(() => {
  browser.storage.onChanged.addListener(onStorageChanged)
  void refreshSettings()
})
onUnmounted(() => browser.storage.onChanged.removeListener(onStorageChanged))

async function chooseProvider(event: Event) {
  const select = event.target as HTMLSelectElement
  const provider = select.value
  if (!isProvider(provider)) return
  choosingProvider.value = true
  error.value = ''
  try {
    settings.value = await writeSettings(current => ({ ...current, provider }))
  } catch {
    select.value = settings.value.provider
    error.value = 'Could not save the search engine.'
  } finally {
    choosingProvider.value = false
  }
}

async function search() {
  const text = query.value.trim()
  if (!text || choosingProvider.value) return
  error.value = ''
  try {
    const provider = settings.value.provider
    if (provider === 'firefox') await browser.search.query({ text, disposition: 'CURRENT_TAB' })
    else window.location.assign(searchUrl(provider, text))
  } catch {
    error.value = 'Could not open search results.'
  }
}

const placeholder = browser.i18n.getUILanguage().toLowerCase().startsWith('ru')
  ? 'Поиск в интернете'
  : 'Search the web'
</script>

<template>
  <div class="wallpaper" :class="{ 'wallpaper-custom': settings.wallpaper.kind === 'custom' }" aria-hidden="true" :style="{ backgroundImage: `url(${wallpaperUrl(settings.wallpaper)})` }"></div>
  <main class="workspace" aria-label="Violet Start">
    <header class="workspace-header">
      <p v-if="settings.quote.trim()" class="quote">{{ settings.quote }}</p>
      <button ref="editButton" class="edit-button" type="button" @click="editing = true">✎ Edit</button>
    </header>
    <form class="search" role="search" @submit.prevent="search">
      <select :value="settings.provider" aria-label="Search engine" :disabled="choosingProvider" @change="chooseProvider">
        <option v-for="(label, provider) in providers" :key="provider" :value="provider">{{ label }}</option>
      </select>
      <input v-model="query" type="search" :placeholder="placeholder" :aria-label="placeholder">
      <button type="submit" aria-label="Search" :disabled="choosingProvider">↵</button>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div class="groups">
      <fieldset v-for="group in settings.groups" :key="group.id" class="group">
        <legend>{{ group.name }}</legend>
        <ul>
          <li v-for="link in group.links" :key="link.id">
            <a :href="link.url"><span class="marker" aria-hidden="true">›</span>{{ link.title }}</a>
          </li>
        </ul>
      </fieldset>
    </div>
  </main>
  <Editor v-if="editing" :settings="settings" @saved="settings = $event" @close="closeEditor" />
</template>
