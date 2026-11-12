<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { findingDiff } from '@/domain/findingDiff'
import { xmlExcerpt } from '@/domain/xmlExcerpt'
import StatusIcon from './StatusIcon.vue'
import XmlExcerptView from './XmlExcerptView.vue'
import { SEV_WORD, type ListEntry } from './findingEntries'
import { skippedCheck } from './wording'

const props = defineProps<{ entry: ListEntry; next: ListEntry | null; bytes: Uint8Array }>()
const emit = defineEmits<{ next: [] }>()

const heading = useTemplateRef<HTMLHeadingElement>('heading')
defineExpose({ focus: () => heading.value?.focus({ preventScroll: true }) })

const finding = computed(() => props.entry.finding)
const id = computed(() => props.entry.finding?.id ?? props.entry.skipped?.id ?? '')
const headingId = computed(() => `fl-${props.entry.key}-h`)
const message = computed(() => props.entry.finding?.message ?? props.entry.skipped?.message ?? '')
const fix = computed(() => props.entry.finding?.fix ?? skippedCheck(id.value).fix)
const place = computed(() => props.entry.finding?.params.label ?? 'Cała faktura')
const diff = computed(() => (props.entry.finding ? findingDiff(props.entry.finding) : null))
const excerpt = computed(() => {
  const line = props.entry.finding?.line
  return line ? xmlExcerpt(props.bytes, line, { value: props.entry.finding?.params.value ?? null }) : null
})
const highlight = computed(() => (props.entry.sev === 'err' ? 'is-del' : props.entry.sev === 'warn' ? 'is-warn' : null))
</script>

<template>
  <article :id="`fl-${entry.key}`" class="f" :data-sev="entry.sev" :aria-labelledby="headingId">
    <p class="f__meta">
      <span class="f__sev"><StatusIcon :name="entry.sev" />{{ SEV_WORD[entry.sev] }} {{ entry.position }} z {{ entry.of }}</span>
      <span>{{ place }}</span>
      <span class="mono">{{ entry.line ? `Linia ${entry.line}` : 'Bez linii' }}</span>
    </p>
    <h4 :id="headingId" ref="heading" tabindex="-1">{{ entry.title }}</h4>
    <p class="f__why">{{ message }}</p>
    <dl v-if="diff" class="diff">
      <div class="diff__row diff__row--is">
        <dt><span class="diff__sign"><StatusIcon name="minus" :size="14" /></span><span class="diff__label">Jest</span></dt>
        <dd><template v-for="(part, index) in diff.is" :key="index"><del v-if="part.mark">{{ part.text }}</del><template v-else>{{ part.text }}</template></template></dd>
      </div>
      <div class="diff__row diff__row--to">
        <dt><span class="diff__sign"><StatusIcon name="plus" :size="14" /></span><span class="diff__label">Powinno być</span></dt>
        <dd v-if="diff.kind === 'check-digit'">cyfra kontrolna <ins>{{ diff.digit }}</ins><span class="diff__note">Wynika z pierwszych dziewięciu cyfr. Pomyłka może być też w nich, więc nie zmieniaj samej końcówki.</span></dd>
        <dd v-else-if="diff.kind === 'allowed'">jedna z wartości: {{ diff.allowed }}</dd>
        <dd v-else><template v-for="(part, index) in diff.should" :key="index"><ins v-if="part.mark">{{ part.text }}</ins><template v-else>{{ part.text }}</template></template></dd>
      </div>
    </dl>
    <p v-if="fix" class="f__do"><b>Co zrobić</b>{{ fix }}</p>
    <details class="tech">
      <summary>Szczegóły techniczne<StatusIcon name="chevron" /></summary>
      <div class="tech__body">
        <dl class="kv">
          <template v-if="finding">
            <dt>Pole</dt>
            <dd>{{ finding.field ?? 'nie dotyczy' }}</dd>
            <dt>Linia</dt>
            <dd>{{ finding.line ?? 'bez linii' }}</dd>
          </template>
          <dt>Reguła</dt>
          <dd>{{ id }}</dd>
        </dl>
        <XmlExcerptView v-if="excerpt" :excerpt="excerpt" :highlight="highlight" />
      </div>
    </details>
    <div v-if="next" class="f__links">
      <button class="link f__next" type="button" @click="emit('next')">Następne: {{ next.title }}</button>
    </div>
  </article>
</template>
