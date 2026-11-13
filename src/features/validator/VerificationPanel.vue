<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Report } from '@/api/report'
import type { InvoiceData } from '@/domain/invoiceReader'
import { checkKsefNumber, ksefNumberFromFileName, type KsefNumberCheck } from '@/domain/ksefNumber'
import { linkAvailability, verificationLink, type KsefEnvironment } from '@/domain/verificationLink'
import QrCode from './QrCode.vue'
import StatusIcon from './StatusIcon.vue'

const props = defineProps<{ report: Report; invoice: InvoiceData | null; hash: string; fileName: string }>()
const environment = defineModel<KsefEnvironment>('environment', { required: true })
const ksefNumber = defineModel<string | null>('ksefNumber', { default: null })

const ENVIRONMENTS: { value: KsefEnvironment; label: string }[] = [
  { value: 'PROD', label: 'Produkcyjne' },
  { value: 'TE', label: 'Testowe (TE)' },
  { value: 'DEMO', label: 'Przedprodukcyjne (DEMO)' },
]
const FORMAT_ERROR = 'Numer KSeF ma postać NIP-RRRRMMDD-12 znaków-2 znaki. Sprawdź go w potwierdzeniu z KSeF.'
const CHECKSUM_ERROR = 'Dwa ostatnie znaki nie zgadzają się z resztą numeru. Sprawdź, czy numer jest przepisany bez pomyłki.'

const entered = ref('')
const checked = ref<KsefNumberCheck | null>(null)

const availability = computed(() => linkAvailability(props.report, props.hash))
const link = computed(() => {
  const { seller, issueDate } = props.invoice ?? { seller: null, issueDate: null }
  if (seller?.nip == null || issueDate === null) return null
  return verificationLink({ environment: environment.value, sellerNip: seller.nip, issueDate, hash: props.hash })
})
const message = computed(() => {
  if (availability.value === 'not-for-result') return 'Link weryfikacyjny i kod QR pokażemy, gdy plik przejdzie kontrolę bez błędów.'
  if (availability.value === 'hash-mismatch') {
    return 'Wystąpił błąd liczenia skrótu pliku: przeglądarka policzyła inny skrót niż serwer. Link i kod QR mogłyby nie pasować do faktury, więc ich nie pokazujemy. Wgraj plik ponownie.'
  }
  if (link.value === null) return 'Link wymaga NIP-u sprzedawcy i daty wystawienia, a w pliku brakuje jednego z nich albo ma zły format.'
  return null
})

const number = computed(() => (checked.value?.valid ? checked.value.value : null))
watch(number, (value) => (ksefNumber.value = value))
const error = computed(() => {
  const check = checked.value
  if (check === null || check.valid || check.reason === 'empty') return null
  return check.reason === 'checksum' ? CHECKSUM_ERROR : FORMAT_ERROR
})
const suggestion = computed(() => {
  const found = ksefNumberFromFileName(props.fileName)
  return found !== null && found !== number.value ? found : null
})
const otherSeller = computed(() => {
  const sellerNip = props.invoice?.seller.nip
  if (number.value === null || sellerNip == null) return null
  const fromNumber = number.value.slice(0, 10)
  return fromNumber === sellerNip ? null : { fromNumber, sellerNip }
})

function check() {
  checked.value = checkKsefNumber(entered.value)
}

function onInput() {
  if (error.value !== null) check()
}

function useSuggestion(value: string) {
  entered.value = value
  check()
}
</script>

<template>
  <section class="sheet side" aria-labelledby="h-q">
    <h2 id="h-q">Kod QR i link weryfikacyjny</h2>
    <p v-if="message" class="side__msg">{{ message }}</p>
    <template v-else-if="link">
      <p v-if="number === null" class="flag"><StatusIcon name="warn" />Wizualizacja pomocnicza</p>
      <figure class="qr">
        <div class="qr__plate"><QrCode :value="link" label="Kod QR z linkiem weryfikacyjnym" /></div>
        <figcaption class="mono muted">
          <template v-if="number">Numer KSeF: {{ number }}</template>
          <template v-else>Numer KSeF: nie podano. KSeF drukuje w tym miejscu napis „OFFLINE”.</template>
        </figcaption>
      </figure>
      <div class="field">
        <label for="ksef-nr">Numer KSeF</label>
        <input
          id="ksef-nr"
          v-model="entered"
          class="input"
          name="ksef"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="1111111111-20261106-0A1B2C3D4E5F-65"
          :aria-invalid="error ? 'true' : undefined"
          :aria-describedby="error ? 'ksef-err ksef-hint' : 'ksef-hint'"
          @change="check"
          @input="onInput"
        />
        <p v-if="error" id="ksef-err" class="err">{{ error }}</p>
        <p id="ksef-hint" class="hint">Znajdziesz go w potwierdzeniu z KSeF. Bez numeru ta wizualizacja jest tylko pomocnicza.</p>
        <button v-if="suggestion" class="link suggest" type="button" @click="useSuggestion(suggestion)">
          Użyj numeru z nazwy pliku: {{ suggestion }}
        </button>
        <p v-if="otherSeller" class="notice" role="status">
          Numer KSeF zaczyna się od NIP {{ otherSeller.fromNumber }}, a sprzedawca w pliku ma NIP {{ otherSeller.sellerNip }}. Sprawdź, czy numer dotyczy tej faktury.
        </p>
      </div>
      <div>
        <code id="vlink" class="vlink">{{ link }}</code>
        <p class="hint">
          Link potwierdzi fakturę tylko wtedy, gdy w KSeF jest dokładnie ten sam plik. Po otwarciu link prowadzi do strony
          Ministerstwa Finansów, która otrzyma NIP sprzedawcy, datę i skrót pliku.
        </p>
      </div>
      <details class="tech">
        <summary>Szczegóły techniczne<StatusIcon name="chevron" /></summary>
        <fieldset class="tech__body envs">
          <legend>Środowisko KSeF</legend>
          <label v-for="option in ENVIRONMENTS" :key="option.value" class="env">
            <input v-model="environment" type="radio" name="ksef-env" :value="option.value" />
            {{ option.label }}
          </label>
          <p class="hint">Środowiska testowe przydają się programistom. Faktury z nich nie mają mocy prawnej.</p>
        </fieldset>
      </details>
    </template>
  </section>
</template>
