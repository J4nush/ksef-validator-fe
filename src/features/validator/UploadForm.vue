<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import type { ValidatorState } from '@/domain/validatorMachine'
import StatusIcon from './StatusIcon.vue'
import { EXAMPLES } from './useValidator'
import { LAYER_ORDER, LAYERS, failureMessage } from './wording'

const props = defineProps<{ state: ValidatorState; exampleError: boolean }>()
const emit = defineEmits<{ file: [file: File]; example: [name: (typeof EXAMPLES)[keyof typeof EXAMPLES]]; retry: [] }>()

const input = useTemplateRef<HTMLInputElement>('input')
const over = ref(false)
defineExpose({ focus: () => input.value?.focus() })

const sending = computed(() => props.state.status === 'sending')
const message = computed(() => {
  const { state } = props
  if (state.status === 'sending') return { text: `Sprawdzamy plik ${state.file.name}.`, error: false, retry: false }
  if (state.status === 'failure') return { text: failureMessage(state.failure), error: true, retry: state.file !== null }
  if (props.exampleError) return { text: 'Nie udało się wczytać pliku przykładowego. Spróbuj ponownie.', error: true, retry: false }
  return null
})

function onChange() {
  const file = input.value?.files?.[0]
  if (file) emit('file', file)
  if (input.value) input.value.value = ''
}

function onDrop(event: DragEvent) {
  over.value = false
  const file = event.dataTransfer?.files[0]
  if (file && !sending.value) emit('file', file)
}
</script>

<template>
  <div class="tool__grid">
    <form
      class="drop"
      :class="{ 'is-over': over }"
      @submit.prevent
      @dragenter.prevent="over = true"
      @dragover.prevent="over = true"
      @dragleave.prevent="over = false"
      @drop.prevent="onDrop"
    >
      <span class="drop__frame" aria-hidden="true"></span>
      <div>
        <p class="drop__t drop__t--mouse">Przeciągnij tu plik XML faktury</p>
        <p class="drop__t drop__t--touch">Wybierz plik XML faktury</p>
        <p id="plik-info" class="drop__limits">
          Plik z programu do faktur, w strukturze FA(3). Do 1 MB, z załącznikiem do 3 MB. Przykłady zawierają fikcyjne dane.
        </p>
      </div>
      <div>
        <div class="drop__actions">
          <input
            id="plik"
            ref="input"
            class="drop__file"
            name="plik"
            type="file"
            accept=".xml,text/xml,application/xml"
            aria-describedby="plik-info"
            :disabled="sending"
            @change="onChange"
          />
          <label class="btn btn--primary js-only" for="plik">Wybierz plik</label>
          <button id="przyklad" class="btn js-only" type="button" :disabled="sending" @click="emit('example', EXAMPLES.errors)">
            Wypróbuj na przykładzie
          </button>
          <button class="btn btn--quiet js-only" type="button" :disabled="sending" @click="emit('example', EXAMPLES.clean)">
            Przykład bez błędów
          </button>
        </div>
        <p class="no-js-only small muted">Sprawdzanie pliku wymaga włączonego JavaScriptu.</p>
        <div v-if="message" class="drop__msg" :class="{ 'is-err': message.error }">
          <p>{{ message.text }}</p>
          <button v-if="message.retry" class="btn" type="button" @click="emit('retry')">Spróbuj ponownie</button>
        </div>
      </div>
    </form>
    <ol class="layers" :class="{ 'is-sending': sending }" aria-label="Pięć warstw kontroli">
      <li v-for="layer in LAYER_ORDER" :key="layer" class="layer">
        <span class="layer__dot"><StatusIcon name="wait" /></span>
        <span class="layer__name">{{ LAYERS[layer].name }}</span>
        <span class="layer__state">{{ sending ? 'w toku' : 'czeka' }}</span>
        <span class="layer__desc">{{ LAYERS[layer].description }}</span>
      </li>
    </ol>
  </div>
</template>
