<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Editor from './Editor.vue'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { isProvider, providers, searchUrl, type Provider } from './search'
import { readSettings } from './settings'
import { useSettingsStore } from './settingsStore'
import { wallpaperUrl } from './wallpaper'

const store = useSettingsStore()
const { settings, loadState } = storeToRefs(store)
const query = ref('')
const error = ref('')
const pendingProvider = ref<Provider | null>(null)
const selectedProvider = computed(() => pendingProvider.value ?? settings.value.provider)
const searching = ref(false)
const canSearch = computed(
  () => loadState.value === 'ready' && pendingProvider.value === null && !searching.value,
)
let selection = 0
const editing = ref(false)
const editButton = ref<HTMLButtonElement>()

async function closeEditor() {
  editing.value = false
  await nextTick()
  editButton.value?.focus()
}

let stopSync: (() => void) | undefined
onMounted(() => {
  stopSync = store.startSync()
})
onUnmounted(() => stopSync?.())

async function chooseProvider(event: Event) {
  const select = event.target as HTMLSelectElement
  const provider = select.value
  if (loadState.value !== 'ready' || searching.value || !isProvider(provider)) return
  const request = ++selection
  pendingProvider.value = provider
  error.value = ''
  try {
    await store.chooseProvider(provider)
  } catch {
    if (request === selection) error.value = 'Could not save the search engine.'
  } finally {
    if (request === selection) pendingProvider.value = null
  }
}

async function search() {
  const text = query.value.trim()
  if (!text || !canSearch.value) return
  error.value = ''
  searching.value = true
  try {
    const { provider } = await readSettings()
    if (provider === 'firefox') await browser.search.query({ text, disposition: 'CURRENT_TAB' })
    else window.location.assign(searchUrl(provider, text))
  } catch {
    error.value = 'Could not open search results.'
  } finally {
    searching.value = false
  }
}

const placeholder = browser.i18n.getUILanguage().toLowerCase().startsWith('ru')
  ? 'Поиск в интернете'
  : 'Search the web'
</script>

<template>
  <div
    class="wallpaper"
    :class="{ 'wallpaper-custom': settings.wallpaper.kind === 'custom' }"
    aria-hidden="true"
    :style="{ backgroundImage: `url(${wallpaperUrl(settings.wallpaper)})` }"
  ></div>
  <main class="workspace" aria-label="Violet Start">
    <header class="workspace-header">
      <p v-if="settings.quote.trim()" class="quote">{{ settings.quote }}</p>
      <button
        ref="editButton"
        class="edit-button"
        type="button"
        :disabled="loadState === 'loading'"
        @click="editing = true"
      >
        ✎ Edit
      </button>
    </header>
    <form class="search" role="search" @submit.prevent="search">
      <input v-model="query" type="search" :placeholder="placeholder" :aria-label="placeholder" />
      <span class="search-engine" :title="`Search engine: ${providers[selectedProvider].label}`">
        <span aria-hidden="true">{{ providers[selectedProvider].short }} ▾</span>
        <select
          :value="selectedProvider"
          :disabled="loadState !== 'ready' || searching"
          aria-label="Search engine"
          @change="chooseProvider"
        >
          <option v-for="(engine, provider) in providers" :key="provider" :value="provider">
            {{ engine.label }}
          </option>
        </select>
      </span>
      <button type="submit" aria-label="Search" :disabled="!canSearch">↵</button>
    </form>
    <p v-if="loadState === 'invalid'" class="error" role="alert">
      Could not load saved settings. You can restore a backup in Edit.
    </p>
    <p v-else-if="error" class="error" role="alert">{{ error }}</p>
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
  <Editor v-if="editing" @close="closeEditor" />
</template>
