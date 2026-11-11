<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
import ThemeToggle from './ThemeToggle.vue'

const pages = [{ to: '/', label: 'Walidator' }]

const menu = useTemplateRef<HTMLDetailsElement>('menu')

function onDocumentClick(event: MouseEvent) {
  const el = menu.value
  if (el?.open && !el.contains(event.target as Node)) el.open = false
}

function onDocumentKeydown(event: KeyboardEvent) {
  const el = menu.value
  if (event.key !== 'Escape' || !el?.open) return
  el.open = false
  el.querySelector('summary')?.focus()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <header class="bar">
    <div class="wrap bar__in">
      <RouterLink class="brand" to="/" aria-label="Walidator KSeF, strona główna">
        <svg class="brand__mark" viewBox="0 0 613 258" fill="currentColor" aria-hidden="true"><path d="m1 125c0 98.52 0.26 124 1.25 124.02 0.69 0.01 10.79-9.55 22.46-21.25l21.2-21.27c0.08-123.05 0.43-148.5 1.09-148.5 0.55 0 3.59 2.59 6.75 5.75 3.16 3.17 16.77 17.46 30.24 31.75 13.48 14.3 27.88 29.61 32 34.01 4.13 4.41 13.83 14.76 21.57 23 7.73 8.25 19.76 21.18 26.75 28.74 8.42 9.12 13.11 13.5 13.95 13 0.69-0.41 5.08-4.8 9.75-9.75 4.67-4.95 19.05-20.48 31.95-34.5 12.91-14.03 34.06-36.93 47-50.89l23.54-25.4 1 114.12 47.46-49.33 0.04-93.5c124.77 0 161.02 0.11 161.05 0.25 0.02 0.14-7.74 7.45-17.25 16.25-9.51 8.8-28.07 26.13-41.23 38.5-13.17 12.38-27.83 26.1-32.59 30.5-4.76 4.4-11.58 10.7-15.15 14-3.58 3.3-13.44 12.5-21.92 20.45-8.47 7.94-25.76 24.18-38.41 36.08-12.65 11.9-30.2 28.29-39 36.41-8.8 8.12-17.11 15.85-18.48 17.17l-2.47 2.39 289.95-0.02c26.35-24.37 37.38-34.71 41.5-38.7l7.5-7.25c-175.3-0.02-223.39-0.41-223.25-0.91 0.14-0.48 12.63-12.27 27.75-26.19 15.13-13.93 35.38-32.77 45-41.88 9.63-9.1 30.1-28.29 45.5-42.64 15.4-14.36 41.25-38.43 57.44-53.5 16.19-15.08 33.29-30.93 38-35.23 4.71-4.3 8.67-8.24 8.81-8.75 0.15-0.57-60.32-0.94-156.5-0.96l-156.75-0.03c-18.63 19.81-31.67 33.89-40.99 44.06-9.32 10.18-23.04 25.03-30.48 33-7.44 7.98-21.17 22.6-30.52 32.5-9.35 9.9-17.22 18.12-17.5 18.27-0.28 0.14-4.56-4.11-9.51-9.45-4.95-5.34-19.35-20.79-32-34.33-12.65-13.54-33.32-35.62-45.92-49.06-12.61-13.43-25.1-26.79-27.75-29.68l-4.83-5.25h-58z" /></svg>
        <span class="brand__sep" aria-hidden="true"></span>
        <span>Walidator KSeF</span>
      </RouterLink>
      <div class="bar__right">
        <nav class="nav" aria-label="Główna">
          <ul class="nav">
            <li v-for="page in pages" :key="page.to">
              <RouterLink :to="page.to" exact-active-class="" active-class="">{{ page.label }}</RouterLink>
            </li>
          </ul>
        </nav>
        <div class="bar__tools js-only">
          <ThemeToggle />
        </div>
        <details ref="menu" class="menu">
          <summary class="icon-btn" aria-label="Menu">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" /></svg>
          </summary>
          <nav class="menu__panel" aria-label="Główna na telefonie">
            <ul>
              <li v-for="page in pages" :key="page.to">
                <RouterLink :to="page.to" exact-active-class="" active-class="">{{ page.label }}</RouterLink>
              </li>
            </ul>
          </nav>
        </details>
      </div>
    </div>
  </header>
</template>
