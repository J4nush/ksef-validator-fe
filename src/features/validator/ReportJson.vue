<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import type { Report } from '@/api/report'
import StatusIcon from './StatusIcon.vue'

const props = defineProps<{ report: Report }>()

const details = useTemplateRef<HTMLDetailsElement>('details')
const said = ref('')
const text = computed(() => JSON.stringify(props.report, null, 2))

defineExpose({
  open() {
    if (!details.value) return
    details.value.open = true
    details.value.querySelector('summary')?.focus()
  },
})

function download() {
  const url = URL.createObjectURL(new Blob([text.value], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'raport-walidacji.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  said.value = 'Pobieranie raportu rozpoczęte.'
}

async function copy() {
  try {
    await navigator.clipboard.writeText(text.value)
    said.value = 'Raport JSON skopiowany.'
  } catch {
    said.value = 'Nie udało się skopiować. Zaznacz raport i skopiuj go ręcznie.'
  }
}
</script>

<template>
  <details id="raport" ref="details" class="tech">
    <summary>Raport JSON dla integracji<StatusIcon name="chevron" /></summary>
    <div class="tech__body">
      <p class="small muted">SHA-256 pliku, Base64URL: <span class="mono">{{ report.document.sha256Base64Url }}</span></p>
      <div class="tech__acts">
        <button class="btn" type="button" @click="download">Pobierz raport</button>
        <button class="btn" type="button" @click="copy">Skopiuj raport</button>
      </div>
      <p class="say" role="status">{{ said }}</p>
      <pre class="xml xml--plain xml--tall" tabindex="0" role="region" aria-label="Raport JSON"><code>{{ text }}</code></pre>
    </div>
  </details>
</template>
