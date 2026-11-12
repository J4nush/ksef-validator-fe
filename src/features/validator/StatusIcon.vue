<script setup lang="ts">
export type IconName = 'ok' | 'err' | 'warn' | 'skip' | 'info' | 'wait' | 'chevron' | 'minus' | 'plus'

withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 16 })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'ok'"><circle cx="8" cy="8" r="6.25" /><path d="M5.25 8.25l2 2 3.5-4" /></template>
    <template v-else-if="name === 'err'"><circle cx="8" cy="8" r="6.25" /><path d="M5.75 5.75l4.5 4.5M10.25 5.75l-4.5 4.5" /></template>
    <template v-else-if="name === 'warn'"><path d="M8 2.25 14.5 13.5h-13z" /><path d="M8 6.5v3.25M8 11.5v.25" /></template>
    <template v-else-if="name === 'skip'"><circle cx="8" cy="8" r="6.25" /><path d="M5.25 8h5.5" /></template>
    <template v-else-if="name === 'info'"><circle cx="8" cy="8" r="6.25" /><path d="M8 7.25v4M8 4.75v.25" /></template>
    <template v-else-if="name === 'wait'"><circle cx="8" cy="8" r="2.25" /></template>
    <template v-else-if="name === 'chevron'"><path d="M4 6l4 4 4-4" /></template>
    <template v-else-if="name === 'minus'"><path d="M4 8h8" /></template>
    <template v-else><path d="M4 8h8M8 4v8" /></template>
  </svg>
</template>
