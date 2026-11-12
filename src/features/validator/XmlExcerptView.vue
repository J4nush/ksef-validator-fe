<script setup lang="ts">
import type { XmlExcerpt } from '@/domain/xmlExcerpt'
import { xmlSegments } from './xmlSegments'

const props = defineProps<{ excerpt: XmlExcerpt; highlight: 'is-del' | 'is-warn' | null }>()

const lineClass = (number: number) => (number === props.excerpt.line && props.highlight ? props.highlight : null)
</script>

<template>
  <pre class="xml" tabindex="0" role="region" :aria-label="`Fragment pliku XML, linia ${excerpt.line}`"><code><span v-for="row in excerpt.lines" :key="row.number" class="xml__l" :class="lineClass(row.number)"><span class="xml__n">{{ row.number }}</span><span><span v-if="row.clippedStart" class="xml__t">…</span><template v-for="(segment, index) in xmlSegments(row.text, row.mark)" :key="index"><span :class="segment.tag ? 'xml__t' : 'xml__v'"><mark v-if="segment.mark">{{ segment.text }}</mark><template v-else>{{ segment.text }}</template></span></template><span v-if="row.clippedEnd" class="xml__t">…</span></span></span></code></pre>
</template>
