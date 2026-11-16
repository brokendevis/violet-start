<script setup lang="ts">
import { onMounted, ref, toRaw } from 'vue'
import type { Group } from './defaults'
import { encodeBackup, maxBackupBytes, parseSettings, readSettings } from './settings'
import { editableContent, useSettingsStore } from './settingsStore'
import { checkWallpaper, readWallpaper, wallpapers, wallpaperUrl } from './wallpaper'

const store = useSettingsStore()
const emit = defineEmits<{ close: [] }>()
const draft = ref(structuredClone(toRaw(store.settings)))
const baseline = JSON.stringify(editableContent(draft.value))
const dialog = ref<HTMLDialogElement>()
const error = ref('')
const busy = ref(false)

onMounted(() => dialog.value?.showModal())

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : 'Could not update settings.'
}

async function save() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const content = structuredClone(editableContent(toRaw(draft.value)))
    await store.saveEdits(content, baseline)
    emit('close')
  } catch (cause) {
    error.value = message(cause)
  } finally {
    busy.value = false
  }
}

function cancel() {
  if (!busy.value) emit('close')
}

async function withSelectedFile(event: Event, action: (file: File) => Promise<void>) {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  if (!file || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await action(file)
  } catch (cause) {
    error.value = message(cause)
  } finally {
    input.value = ''
    busy.value = false
  }
}

function upload(event: Event) {
  return withSelectedFile(event, async (file) => {
    draft.value.wallpaper = await readWallpaper(file)
  })
}

async function exportBackup() {
  error.value = ''
  try {
    const current = await readSettings()
    const backup = new Blob([encodeBackup(current)], { type: 'application/json' })
    const url = URL.createObjectURL(backup)
    const download = document.createElement('a')
    download.href = url
    download.download = 'violet-start-settings.json'
    download.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (cause) {
    error.value = message(cause)
  }
}

function importBackup(event: Event) {
  return withSelectedFile(event, async (file) => {
    if (file.size > maxBackupBytes) throw new Error('Backup is larger than 5 MiB.')
    const imported = parseSettings(JSON.parse(await file.text()))
    await checkWallpaper(imported.wallpaper)
    if (!window.confirm('Replace saved settings and discard any unsaved edits?')) return
    await store.restore(imported)
    emit('close')
  })
}

function addGroup() {
  draft.value.groups.push({ id: crypto.randomUUID(), name: 'New group', links: [] })
}

function addLink(group: Group) {
  group.links.push({ id: crypto.randomUUID(), title: '', url: '' })
}

function move<T>(items: T[], index: number, offset: number) {
  const target = index + offset
  if (target >= 0 && target < items.length) {
    const [item] = items.splice(index, 1)
    items.splice(target, 0, item)
  }
}
</script>

<template>
  <dialog ref="dialog" class="editor" aria-labelledby="editor-title" @cancel.prevent="cancel">
    <form @submit.prevent="save">
      <header class="editor-header">
        <h1 id="editor-title">Edit new tab</h1>
        <button type="button" aria-label="Close editor" :disabled="busy" @click="cancel">×</button>
      </header>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <section class="editor-body" :inert="busy">
        <label class="field"
          >Quote
          <textarea v-model="draft.quote" rows="3" autofocus></textarea>
        </label>

        <fieldset class="editor-wallpapers">
          <legend>Wallpaper</legend>
          <div class="wallpaper-grid">
            <button
              v-for="(label, id) in wallpapers"
              :key="id"
              type="button"
              :aria-pressed="draft.wallpaper.kind === 'preset' && draft.wallpaper.id === id"
              @click="draft.wallpaper = { kind: 'preset', id }"
            >
              <img :src="wallpaperUrl({ kind: 'preset', id })" alt="" />{{ label }}
            </button>
          </div>
          <label class="field"
            >Upload wallpaper <small>PNG, JPEG or WebP, up to 2 MiB and 24 megapixels</small>
            <input type="file" accept="image/png,image/jpeg,image/webp" @change="upload" />
          </label>
          <img
            v-if="draft.wallpaper.kind === 'custom'"
            class="custom-preview"
            :src="wallpaperUrl(draft.wallpaper)"
            alt="Custom wallpaper preview"
          />
        </fieldset>

        <fieldset class="editor-group">
          <legend>Backup</legend>
          <button type="button" @click="exportBackup">Export saved settings</button>
          <label class="field backup-input"
            >Import backup
            <input type="file" accept=".json,application/json" @change="importBackup" />
          </label>
        </fieldset>

        <div class="row groups-heading">
          <h2>Groups</h2>
          <button type="button" @click="addGroup">+ Group</button>
        </div>
        <fieldset v-for="(group, groupIndex) in draft.groups" :key="group.id" class="editor-group">
          <legend>{{ group.name || 'Group' }}</legend>
          <label class="field">Group name <input v-model="group.name" required /></label>
          <div class="row">
            <button
              type="button"
              aria-label="Move group up"
              :disabled="groupIndex === 0"
              @click="move(draft.groups, groupIndex, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Move group down"
              :disabled="groupIndex === draft.groups.length - 1"
              @click="move(draft.groups, groupIndex, 1)"
            >
              ↓
            </button>
            <button type="button" @click="draft.groups.splice(groupIndex, 1)">Remove group</button>
          </div>
          <div v-for="(link, linkIndex) in group.links" :key="link.id" class="editor-link">
            <label class="field">Link title <input v-model="link.title" required /></label>
            <label class="field"
              >Link URL <input v-model="link.url" inputmode="url" required
            /></label>
            <div class="row">
              <button
                type="button"
                aria-label="Move link up"
                :disabled="linkIndex === 0"
                @click="move(group.links, linkIndex, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Move link down"
                :disabled="linkIndex === group.links.length - 1"
                @click="move(group.links, linkIndex, 1)"
              >
                ↓
              </button>
              <button type="button" @click="group.links.splice(linkIndex, 1)">Remove link</button>
            </div>
          </div>
          <button type="button" class="add-link" @click="addLink(group)">+ Link</button>
        </fieldset>
      </section>
      <footer class="editor-footer row">
        <button type="submit" class="primary" :disabled="busy">Save</button>
        <button type="button" :disabled="busy" @click="cancel">Cancel</button>
      </footer>
    </form>
  </dialog>
</template>
