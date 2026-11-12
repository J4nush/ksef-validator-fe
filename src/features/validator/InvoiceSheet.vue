<script setup lang="ts">
import { computed } from 'vue'
import type { InvoiceData, Party } from '@/domain/invoiceReader'
import { formatAmount, formatDate, formatNumber, paymentFormLabel, rateLabel, rateTotalLabel } from '@/domain/format'
import StatusIcon from './StatusIcon.vue'
import { plural } from './wording'
import { xmlSegments } from './xmlSegments'

const props = defineProps<{ invoice: InvoiceData; bytes: Uint8Array; hash: string }>()

const MISSING = 'brak w pliku'
const SHOWN_LINES = 1000
const NET_WITH_VAT = new Set(['1', '2', '3', '4', '5'])

const parties = computed(() => [
  { id: 'h-s', role: 'Sprzedawca', party: props.invoice.seller },
  { id: 'h-n', role: 'Nabywca', party: props.invoice.buyer },
])

function address({ address: { line1, line2, countryCode } }: Party): string | null {
  const parts = [line1, line2, countryCode !== null && countryCode !== 'PL' ? countryCode : null].filter((part) => part !== null)
  return parts.length > 0 ? parts.join(', ') : null
}

const saleDate = computed(() => {
  const { saleDate: date, salePeriod: period } = props.invoice
  if (date !== null) return formatDate(date)
  if (period === null) return null
  const from = period.from === null ? null : `od ${formatDate(period.from)}`
  const to = period.to === null ? null : `do ${formatDate(period.to)}`
  return [from, to].filter((part) => part !== null).join(' ') || null
})

const dates = computed(() => {
  const { number, issueDate, payment } = props.invoice
  const form = payment.form === null ? payment.otherForm : paymentFormLabel(payment.form)
  return [
    { term: 'Numer', value: number ?? MISSING, missing: number === null },
    { term: 'Wystawiono', value: issueDate === null ? MISSING : formatDate(issueDate), missing: issueDate === null },
    { term: 'Sprzedaż', value: saleDate.value, missing: false },
    { term: 'Termin płatności', value: payment.dueDates.map(formatDate).join(', ') || null, missing: false },
    { term: 'Płatność', value: form, missing: false },
  ].filter((row) => row.value !== null)
})

const amount = (value: string | null) => (value === null ? 'brak' : formatAmount(value))

const lines = computed(() =>
  props.invoice.lines.map((line, index) => ({
    key: index,
    number: line.number ?? '',
    name: line.name ?? MISSING,
    quantity: [line.quantity === null ? null : formatNumber(line.quantity), line.unit].filter((part) => part !== null).join(' ') || 'brak',
    price: amount(line.unitNetPrice),
    net: amount(line.netValue),
    rate: line.rate === null ? 'brak' : rateLabel(line.rate),
  })),
)

const sums = computed(() => [
  ...props.invoice.rateTotals.flatMap(({ key, net, vat }) => {
    const label = rateTotalLabel(key)
    const withVat = NET_WITH_VAT.has(key)
    return [
      { term: `${withVat ? 'Netto' : 'Wartość sprzedaży'}, ${label}`, value: amount(net), total: false },
      ...(withVat && vat !== null ? [{ term: `VAT, ${label}`, value: amount(vat), total: false }] : []),
    ]
  }),
  ...(props.invoice.total === null ? [] : [{ term: 'Do zapłaty', value: amount(props.invoice.total), total: true }]),
])

const source = computed(() => {
  const all = new TextDecoder('utf-8').decode(props.bytes).split(/\r\n|\r|\n/)
  if (all.length > 1 && all[all.length - 1] === '') all.pop()
  return { count: all.length, shown: all.slice(0, SHOWN_LINES) }
})
</script>

<template>
  <div class="sheet">
    <div class="parties">
      <section v-for="{ id, role, party } in parties" :key="id" class="party" :aria-labelledby="id">
        <h2 :id="id" class="muted small">{{ role }}</h2>
        <b :class="{ muted: party.name === null }">{{ party.name ?? `Nazwa: ${MISSING}` }}</b>
        <p v-if="address(party)">{{ address(party) }}</p>
        <p v-if="party.nip" class="mono">NIP {{ party.nip }}</p>
      </section>
    </div>
    <section class="sheet__s" aria-labelledby="h-d">
      <h2 id="h-d">Faktura i daty</h2>
      <dl class="meta">
        <div v-for="row in dates" :key="row.term">
          <dt>{{ row.term }}</dt>
          <dd :class="{ muted: row.missing }">{{ row.value }}</dd>
        </div>
      </dl>
    </section>
    <section class="sheet__s" aria-labelledby="h-p">
      <h2 id="h-p">Pozycje i kwoty, {{ invoice.currency ?? 'PLN' }}</h2>
      <table v-if="lines.length > 0" class="rows">
        <thead>
          <tr>
            <th scope="col" class="rows__lp">Lp.</th>
            <th scope="col">Nazwa</th>
            <th scope="col" class="num">Ilość</th>
            <th scope="col" class="num">Cena netto</th>
            <th scope="col" class="num">Wartość netto</th>
            <th scope="col" class="num">VAT</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in lines" :key="line.key">
            <td class="rows__lp">{{ line.number }}</td>
            <th scope="row">{{ line.name }}</th>
            <td class="num" data-l="Ilość">{{ line.quantity }}</td>
            <td class="num" data-l="Cena netto">{{ line.price }}</td>
            <td class="num" data-l="Wartość netto">{{ line.net }}</td>
            <td class="num" data-l="VAT">{{ line.rate }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="small muted">Plik nie ma pozycji faktury.</p>
      <dl v-if="sums.length > 0" class="sums">
        <div v-for="row in sums" :key="row.term" :class="{ sums__total: row.total }">
          <dt>{{ row.term }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
    </section>
    <section class="sheet__s" aria-label="Plik źródłowy">
      <details class="tech">
        <summary>Szczegóły techniczne: plik XML, {{ plural(source.count, ['linia', 'linie', 'linii']) }}<StatusIcon name="chevron" /></summary>
        <div class="tech__body">
          <p class="small muted">SHA-256 pliku, Base64URL: <span class="mono">{{ hash }}</span></p>
          <p v-if="source.count > SHOWN_LINES" class="small muted">Pokazujemy pierwsze {{ SHOWN_LINES }} linii pliku.</p>
          <pre class="xml xml--tall" tabindex="0" role="region" aria-label="Plik XML z numerami linii"><code><span v-for="(text, index) in source.shown" :key="index" class="xml__l"><span class="xml__n">{{ index + 1 }}</span><span><span v-for="(segment, at) in xmlSegments(text, null)" :key="at" :class="segment.tag ? 'xml__t' : 'xml__v'">{{ segment.text }}</span></span></span></code></pre>
        </div>
      </details>
    </section>
  </div>
</template>
