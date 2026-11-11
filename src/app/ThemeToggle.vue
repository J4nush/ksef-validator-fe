<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { toggleTheme, type Theme } from './theme'

const HINT = 'Przełącz motyw. Wybór zapamiętamy w tej przeglądarce.'
const MESSAGE_MS = 6000

const announced = ref<Theme | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

function onClick() {
  announced.value = toggleTheme(document)
  clearTimeout(timer)
  timer = setTimeout(() => {
    announced.value = null
  }, MESSAGE_MS)
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="theme">
    <button class="icon-btn" type="button" :aria-label="HINT" :title="HINT" @click="onClick">
      <svg class="theme__moon" width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 9.75A6 6 0 0 1 6.25 2.5a6 6 0 1 0 7.25 7.25z" /></svg>
      <svg class="theme__sun" width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="2.75" /><path d="M8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1.05 1.05M11.35 11.35l1.05 1.05M3.6 12.4l1.05-1.05M11.35 4.65l1.05-1.05" /></svg>
    </button>
    <p class="toast" role="status">
      <template v-if="announced === 'light'">
        Zapamiętaliśmy jasny motyw w tej przeglądarce.
        <a class="link" href="/polityka-prywatnosci#motyw">Jak to działa</a>
      </template>
      <template v-else-if="announced === 'dark'">Wróciliśmy do ciemnego motywu i usunęliśmy zapisany wybór.</template>
    </p>
  </div>
</template>
