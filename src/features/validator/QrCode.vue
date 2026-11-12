<script setup lang="ts">
import { computed } from 'vue'
import { qrCode } from '@/domain/qrCode'

const props = defineProps<{ value: string; label: string }>()

const code = computed(() => qrCode(props.value))
</script>

<template>
  <svg class="qr__svg" :viewBox="`0 0 ${code.size} ${code.size}`" role="img" :aria-label="label">
    <path class="qrline" stroke="#000" :d="code.path" />
  </svg>
</template>
