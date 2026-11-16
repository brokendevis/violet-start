<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Group } from './defaults'
import {
  checkWallpaper, editableContent, encodeBackup, maxBackupBytes, parseSettings, readSettings, readWallpaper, type Settings,
  wallpapers, wallpaperUrl, writeSettings,
} from './settings'

const props = defineProps<{ settings: Settings }>()
const emit = defineEmits<{ close: []; saved: [settings: Settings] }>()
const draft = ref(parseSettings(props.settings))
const baseline = JSON.stringify(editableContent(draft.value))
const dialog = ref<HTMLDialogElement>()
const error = ref('')
const busy = ref(false)

onMounted(() => dialog.value?.showModal())

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : 'Could not update settings.'
}

async function save() {
  busy.value = true
  error.value = ''
  try {
    const content = editableContent(draft.value)
    const saved = await writeSettings(current => {
      if (JSON.stringify(editableContent(current)) !== baseline) {
        throw new Error('Another tab changed these settings. Reopen Edit before saving.')
      }
      return { ...current, ...content }
    })
    emit('saved', saved)
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

async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  busy.value = true
  error.value = ''
  try {
    draft.value.wallpaper = await readWallpaper(file)
  } catch (cause) {
    error.value = message(cause)
  } finally {
    input.value = ''
    busy.value = false
  }
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

async function importBackup(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  busy.value = true
  error.value = ''
  try {
    if (file.size > maxBackupBytes) throw new Error('Backup is larger than 5 MiB.')
    const imported = parseSettings(JSON.parse(await file.text()))
    await checkWallpaper(imported.wallpaper)
    if (!window.confirm('Replace saved settings and discard any unsaved edits?')) return
    const saved = await writeSettings(imported)
    emit('saved', saved)
    emit('close')
  } catch (cause) {
    error.value = message(cause)
  } finally {
    input.value = ''
    busy.value = false
  }
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
      <section class="editor-body">
        <label class="field">Quote
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
              :disabled="busy"
              @click="draft.wallpaper = { kind: 'preset', id }"
            ><img :src="wallpaperUrl({ kind: 'preset', id })" alt="">{{ label }}</button>
          </div>
          <label class="field">Upload wallpaper <small>PNG, JPEG or WebP, up to 2 MiB</small>
            <input type="file" accept="image/png,image/jpeg,image/webp" :disabled="busy" @change="upload">
          </label>
          <img v-if="draft.wallpaper.kind === 'custom'" class="custom-preview" :src="wallpaperUrl(draft.wallpaper)" alt="Custom wallpaper preview">
        </fieldset>

        <fieldset class="editor-group">
          <legend>Backup</legend>
          <button type="button" :disabled="busy" @click="exportBackup">Export saved settings</button>
          <label class="field backup-input">Import backup
            <input type="file" accept=".json,application/json" :disabled="busy" @change="importBackup">
          </label>
        </fieldset>

        <div class="row groups-heading">
          <h2>Groups</h2>
          <button type="button" @click="addGroup">+ Group</button>
        </div>
        <fieldset v-for="(group, groupIndex) in draft.groups" :key="group.id" class="editor-group">
          <legend>{{ group.name || 'Group' }}</legend>
          <label class="field">Group name <input v-model="group.name" required></label>
          <div class="row">
            <button type="button" aria-label="Move group up" :disabled="groupIndex === 0" @click="move(draft.groups, groupIndex, -1)">↑</button>
            <button type="button" aria-label="Move group down" :disabled="groupIndex === draft.groups.length - 1" @click="move(draft.groups, groupIndex, 1)">↓</button>
            <button type="button" @click="draft.groups.splice(groupIndex, 1)">Remove group</button>
          </div>
          <div v-for="(link, linkIndex) in group.links" :key="link.id" class="editor-link">
            <label class="field">Link title <input v-model="link.title" required></label>
            <label class="field">Link URL <input v-model="link.url" inputmode="url" required></label>
            <div class="row">
              <button type="button" aria-label="Move link up" :disabled="linkIndex === 0" @click="move(group.links, linkIndex, -1)">↑</button>
              <button type="button" aria-label="Move link down" :disabled="linkIndex === group.links.length - 1" @click="move(group.links, linkIndex, 1)">↓</button>
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
