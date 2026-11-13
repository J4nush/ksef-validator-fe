<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import type { Report } from '@/api/report'
import { formatNumber } from '@/domain/format'
import { readInvoice } from '@/domain/invoiceReader'
import { linkAvailability, verificationLink, type KsefEnvironment } from '@/domain/verificationLink'
import type { InvoiceFile } from '@/domain/validatorMachine'
import { pdfFileName } from '@/pdf/fileName'
import { downloadBlob } from './download'
import FindingList from './FindingList.vue'
import InvoiceSheet from './InvoiceSheet.vue'
import LayerRun from './LayerRun.vue'
import ReportJson from './ReportJson.vue'
import StatusIcon from './StatusIcon.vue'
import VerificationPanel from './VerificationPanel.vue'
import { countErrors, countInfo, countSkipped, countWarnings, headline, skippedCheck } from './wording'

const props = defineProps<{ report: Report; file: InvoiceFile; hash: string }>()
const emit = defineEmits<{ newFile: [] }>()

const heading = useTemplateRef<HTMLHeadingElement>('heading')
const reportJson = useTemplateRef<InstanceType<typeof ReportJson>>('reportJson')
defineExpose({ focusHeading: () => heading.value?.focus() })

const checkedAt = new Date()
const pad = (value: number) => String(value).padStart(2, '0')
const checkedAtText = `${pad(checkedAt.getDate())}.${pad(checkedAt.getMonth() + 1)}.${checkedAt.getFullYear()} ${pad(checkedAt.getHours())}:${pad(checkedAt.getMinutes())}`

const environment = ref<KsefEnvironment>('PROD')
const ksefNumber = ref<string | null>(null)
const creatingPdf = ref(false)
const said = ref('')

const result = computed(() => props.report.result)
const summary = computed(() => props.report.summary)
const title = computed(() => headline(props.report))
const unsupported = computed(() => (result.value === 'UNSUPPORTED' ? (props.report.findings[0] ?? null) : null))
const read = computed(() => readInvoice(props.file.bytes))
const invoice = computed(() => (read.value.ok ? read.value.invoice : null))
const recognised = computed(() => props.report.stages.some((stage) => stage.id === 'recognition' && stage.status === 'passed'))
const showCards = computed(() => result.value !== 'UNSUPPORTED' && recognised.value && invoice.value !== null)
const offersPdf = computed(() => result.value === 'PASSED' || result.value === 'WARNINGS')
const showList = computed(() => result.value !== 'UNSUPPORTED' && props.report.findings.length > 0)
const link = computed(() => {
  const seller = invoice.value?.seller.nip
  const issueDate = invoice.value?.issueDate
  if (linkAvailability(props.report, props.hash) !== 'available' || seller == null || issueDate == null) return null
  return verificationLink({ environment: environment.value, sellerNip: seller, issueDate, hash: props.hash })
})

function selectLink() {
  const target = document.getElementById('vlink')
  const selection = window.getSelection()
  if (!target || !selection) return
  const range = document.createRange()
  range.selectNodeContents(target)
  selection.removeAllRanges()
  selection.addRange(range)
}

async function downloadPdf() {
  if (creatingPdf.value) return
  creatingPdf.value = true
  said.value = 'Tworzę PDF.'
  try {
    const { createInvoicePdf } = await import('@/pdf/invoicePdf')
    const pdf = await createInvoicePdf(props.file.bytes, { link: link.value, ksefNumber: ksefNumber.value })
    downloadBlob(pdf, pdfFileName(invoice.value?.number ?? null))
    said.value = 'Pobieranie PDF rozpoczęte.'
  } catch {
    said.value = 'Nie udało się utworzyć PDF. Wynik i link działają bez zmian.'
  } finally {
    creatingPdf.value = false
  }
}

async function copyLink() {
  if (link.value === null) return
  try {
    await navigator.clipboard.writeText(link.value)
    said.value = 'Link skopiowany.'
  } catch {
    selectLink()
    said.value = 'Nie udało się skopiować. Link jest zaznaczony, skopiuj go ręcznie.'
  }
}
</script>

<template>
  <div class="wrap res-order">
    <div class="res">
      <nav aria-label="Okruszki">
        <ol class="crumbs">
          <li><a href="/" @click.prevent="emit('newFile')">Walidator KSeF</a></li>
          <li><span aria-current="page">Wynik kontroli</span></li>
        </ol>
      </nav>
      <div class="res__top">
        <div>
          <h1 ref="heading" tabindex="-1">{{ title }}</h1>
          <p v-if="result === 'ERRORS'" class="res__lead">
            Popraw dane w programie, w którym powstał plik, i sprawdź nowy plik. Samego XML nie musisz edytować. Zacznij od pierwszego błędu.
          </p>
          <p v-else-if="result === 'WARNINGS'" class="res__lead">
            Ostrzeżenia nie zatrzymały kontroli. Przejrzyj je, zanim wyślesz fakturę.
          </p>
          <p v-else-if="result === 'PASSED'" class="res__lead">Nie znaleźliśmy błędów w sprawdzanym zakresie.</p>
          <template v-else-if="unsupported">
            <p class="res__lead">{{ unsupported.message }}</p>
            <p class="f__do"><b>Co zrobić</b>{{ unsupported.fix }}</p>
          </template>
          <p class="caveat">
            Wynik dotyczy kontroli, które wykonuje to narzędzie. Nie gwarantuje przyjęcia faktury przez KSeF.
            <a class="link" href="/zastrzezenia">Czego nie sprawdzamy</a>
          </p>
        </div>
        <div class="res__acts">
          <button v-if="result === 'ERRORS'" class="btn btn--primary" type="button" @click="emit('newFile')">Sprawdź poprawiony plik</button>
          <template v-else>
            <button v-if="offersPdf" class="btn btn--primary" type="button" :disabled="creatingPdf" @click="downloadPdf">
              {{ creatingPdf ? 'Tworzę PDF' : 'Pobierz PDF' }}
            </button>
            <button v-if="link" class="btn" type="button" @click="copyLink">Skopiuj link</button>
            <button class="btn" :class="{ 'btn--primary': !offersPdf }" type="button" @click="emit('newFile')">Nowy plik</button>
          </template>
          <button class="btn" type="button" @click="reportJson?.open()">Raport JSON</button>
        </div>
      </div>
      <p class="say" role="status">{{ said }}</p>
      <p v-if="!offersPdf" class="res__note small muted">PDF utworzysz po poprawieniu błędów.</p>
      <div class="res__line">
        <span v-if="result === 'PASSED'" class="count sev" data-sev="ok"><StatusIcon name="ok" />{{ countErrors(0) }}, {{ countWarnings(0) }}</span>
        <template v-else>
          <span class="count sev" :class="{ 'count--zero': summary.errors === 0 }" :data-sev="summary.errors > 0 ? 'err' : undefined"><StatusIcon name="err" />{{ countErrors(summary.errors) }}</span>
          <span class="count sev" :class="{ 'count--zero': summary.warnings === 0 }" :data-sev="summary.warnings > 0 ? 'warn' : undefined"><StatusIcon name="warn" />{{ countWarnings(summary.warnings) }}</span>
          <span v-if="summary.info > 0" class="count sev" data-sev="info"><StatusIcon name="info" />{{ countInfo(summary.info) }}</span>
        </template>
        <span v-if="summary.skippedChecks > 0" class="count muted"><StatusIcon name="skip" />{{ countSkipped(summary.skippedChecks) }}</span>
        <span class="res__file mono">
          <span>{{ file.name }}</span>
          <span>{{ formatNumber(String(file.bytes.byteLength)) }} B</span>
          <time :datetime="checkedAt.toISOString()">{{ checkedAtText }}</time>
        </span>
      </div>
    </div>
    <LayerRun :report="report" />
    <FindingList v-if="showList" :findings="report.findings" :skipped="report.skipped" :bytes="file.bytes" />
    <div v-if="showCards && invoice" class="ok">
      <InvoiceSheet :invoice="invoice" :bytes="file.bytes" :hash="hash" />
      <VerificationPanel v-model:environment="environment" v-model:ksef-number="ksefNumber" :report="report" :invoice="invoice" :hash="hash" :file-name="file.name" />
    </div>
  </div>
  <div class="wrap after">
    <section v-if="!showList && report.skipped.length > 0" aria-labelledby="h-skip">
      <h2 id="h-skip">Nie sprawdzono: {{ report.skipped.length }}</h2>
      <div v-for="check in report.skipped" :key="check.id" class="after__row" data-sev="skip">
        <p><b>{{ skippedCheck(check.id).title }}.</b> {{ check.message }} {{ skippedCheck(check.id).fix }}</p>
        <p class="mono muted">{{ check.id }}</p>
      </div>
    </section>
    <ReportJson ref="reportJson" :report="report" />
    <p class="small muted">Pliku nie zapisaliśmy, więc po zamknięciu strony tego wyniku już nie będzie.</p>
  </div>
</template>
