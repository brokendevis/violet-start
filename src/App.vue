<script setup lang="ts">
import { defaultGroups, defaultQuote } from './defaults'

const placeholder = browser.i18n.getUILanguage().toLowerCase().startsWith('ru')
  ? 'Поиск в интернете'
  : 'Search the web'
</script>

<template>
  <div class="wallpaper" aria-hidden="true" style="background-image: url(wallpapers/shadow.webp)"></div>
  <main class="workspace" aria-label="Violet Start">
    <header class="workspace-header">
      <p class="quote">{{ defaultQuote }}</p>
      <button class="edit-button" type="button" disabled>✎ Edit</button>
    </header>
    <form class="search" role="search" @submit.prevent>
      <input type="search" :placeholder="placeholder" :aria-label="placeholder">
      <button type="submit" aria-label="Search" disabled>↵</button>
    </form>
    <div class="groups">
      <fieldset v-for="group in defaultGroups" :key="group.id" class="group">
        <legend>{{ group.name }}</legend>
        <ul>
          <li v-for="link in group.links" :key="link.id">
            <a :href="link.url"><span class="marker" aria-hidden="true">›</span>{{ link.title }}</a>
          </li>
        </ul>
      </fieldset>
    </div>
  </main>
</template>
