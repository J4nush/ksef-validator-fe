<script setup lang="ts">
import { computed } from 'vue'
import type { Report } from '@/api/report'
import StatusIcon from './StatusIcon.vue'
import { LAYER_ORDER, LAYERS, layerState } from './wording'

const props = defineProps<{ report: Report }>()

const layers = computed(() => LAYER_ORDER.map((id) => ({ id, name: LAYERS[id].name, ...layerState(props.report, id) })))
</script>

<template>
  <ol class="run" aria-label="Pięć warstw kontroli i ich wynik">
    <li v-for="layer in layers" :key="layer.id" :data-sev="layer.sev" :class="{ 'is-stopped': !layer.ran }">
      <span class="run__name">{{ layer.name }}</span>
      <span class="run__state"><StatusIcon :name="layer.sev" />{{ layer.text }}</span>
    </li>
  </ol>
</template>
