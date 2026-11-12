<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef } from 'vue'
import type { Finding, SkippedCheck } from '@/api/report'
import FindingDetail from './FindingDetail.vue'
import StatusIcon from './StatusIcon.vue'
import { entryGroups, type ListEntry } from './findingEntries'

const props = defineProps<{ findings: Finding[]; skipped: SkippedCheck[]; bytes: Uint8Array }>()

const WIDE = '(min-width: 900px)'

const groups = computed(() => entryGroups(props.findings, props.skipped))
const entries = computed(() => groups.value.flatMap((group) => group.entries))
const first = entries.value[0]?.key ?? null

const media = typeof window === 'undefined' ? null : window.matchMedia(WIDE)
const wide = ref(media?.matches ?? false)
const showAll = ref(false)
const selected = ref<string | null>(first)
const open = shallowRef(new Set(first === null ? [] : [first]))

const rows = ref<HTMLButtonElement[]>([])
const detail = useTemplateRef<InstanceType<typeof FindingDetail>>('detail')

const selectedEntry = computed(() => entries.value.find((entry) => entry.key === selected.value) ?? null)
const nextOf = (entry: ListEntry) => entries.value[entries.value.indexOf(entry) + 1] ?? null

function onMediaChange(event: { matches: boolean }) {
  if (event.matches) selected.value = entries.value.find((entry) => open.value.has(entry.key))?.key ?? first
  else open.value = new Set(selected.value === null ? [] : [selected.value])
  wide.value = event.matches
}
media?.addEventListener('change', onMediaChange)
onBeforeUnmount(() => media?.removeEventListener('change', onMediaChange))

async function focusDetail() {
  await nextTick()
  detail.value?.focus()
}

async function select(entry: ListEntry, focus: 'detail' | 'row' = 'detail') {
  selected.value = entry.key
  if (focus === 'row') rowFor(entry)?.focus()
  else await focusDetail()
}

function toggle(entry: ListEntry) {
  const next = new Set(open.value)
  if (!next.delete(entry.key)) next.add(entry.key)
  open.value = next
}

function rowFor(entry: ListEntry) {
  return rows.value.find((row) => row.dataset.key === entry.key)
}

function onRowClick(entry: ListEntry) {
  if (wide.value) void select(entry)
  else toggle(entry)
}

function onRowKeydown(event: KeyboardEvent, entry: ListEntry) {
  const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
  const target = entries.value[entries.value.indexOf(entry) + step]
  if (step === 0 || !target) return
  event.preventDefault()
  if (wide.value) void select(target, 'row')
  else rowFor(target)?.focus()
}

async function goNext(entry: ListEntry) {
  const target = nextOf(entry)
  if (!target) return
  if (wide.value) return select(target)
  open.value = new Set([...open.value, target.key])
  await nextTick()
  const row = rowFor(target)
  row?.scrollIntoView({ block: 'start' })
  row?.focus({ preventScroll: true })
}
</script>

<template>
  <section class="fl" :class="{ 'show-all': showAll, 'fl--wide': wide && !showAll }" aria-labelledby="fl-h">
    <div class="fl__head">
      <h2 id="fl-h">Co znaleźliśmy</h2>
      <button class="btn btn--quiet" type="button" :aria-pressed="showAll" @click="showAll = !showAll">
        {{ showAll ? 'Pokaż listę' : 'Pokaż wszystkie' }}
      </button>
    </div>
    <div v-if="showAll" class="fl__body">
      <section v-for="group in groups" :key="group.sev" class="fl__sec">
        <h3 class="fl__group">{{ group.name }} <span>{{ group.entries.length }}</span></h3>
        <FindingDetail v-for="entry in group.entries" :key="entry.key" :entry="entry" :next="null" :bytes="bytes" />
      </section>
    </div>
    <div v-else class="fl__body">
      <div class="fl__nav">
        <section v-for="group in groups" :key="group.sev" class="fl__sec">
          <h3 class="fl__group">{{ group.name }} <span>{{ group.entries.length }}</span></h3>
          <ul class="fl__rows">
            <li v-for="entry in group.entries" :key="entry.key">
              <button
                ref="rows"
                class="row"
                type="button"
                :data-key="entry.key"
                :data-sev="entry.sev"
                :aria-current="wide && selected === entry.key ? 'true' : undefined"
                :aria-expanded="wide ? undefined : open.has(entry.key)"
                :aria-controls="wide ? 'fl-detail' : open.has(entry.key) ? `fl-${entry.key}` : undefined"
                @click="onRowClick(entry)"
                @keydown="onRowKeydown($event, entry)"
              >
                <span class="sev"><StatusIcon :name="entry.sev" /></span>
                <span class="row__t">{{ entry.title }}</span>
                <span class="row__l mono">{{ entry.line ? `linia ${entry.line}` : 'bez linii' }}</span>
                <StatusIcon class="row__chev" name="chevron" />
              </button>
              <FindingDetail
                v-if="!wide && open.has(entry.key)"
                :entry="entry"
                :next="nextOf(entry)"
                :bytes="bytes"
                @next="goNext(entry)"
              />
            </li>
          </ul>
        </section>
      </div>
      <div v-if="wide" id="fl-detail" class="fl__detail">
        <FindingDetail
          v-if="selectedEntry"
          ref="detail"
          :key="selectedEntry.key"
          :entry="selectedEntry"
          :next="nextOf(selectedEntry)"
          :bytes="bytes"
          @next="goNext(selectedEntry)"
        />
      </div>
    </div>
  </section>
</template>
