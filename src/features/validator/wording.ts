import type { Layer, Report } from '@/api/report'
import { formatNumber } from '@/domain/format'
import { MAX_FILE_BYTES, type LocalFailure, type RemoteFailure } from '@/domain/validatorMachine'

export type Sev = 'ok' | 'err' | 'warn' | 'skip'

type Forms = readonly [one: string, few: string, many: string]

export function plural(count: number, [one, few, many]: Forms): string {
  if (count === 1) return `${count} ${one}`
  const last = count % 10
  const lastTwo = count % 100
  return `${count} ${last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many}`
}

export const countErrors = (count: number) => plural(count, ['błąd', 'błędy', 'błędów'])
export const countWarnings = (count: number) => plural(count, ['ostrzeżenie', 'ostrzeżenia', 'ostrzeżeń'])
export const countInfo = (count: number) => plural(count, ['informacja', 'informacje', 'informacji'])
export const countSkipped = (count: number) => `${count} nie sprawdzono`

export const LAYERS: Record<Layer, { name: string; description: string }> = {
  security: { name: 'Bezpieczeństwo', description: 'Rozmiar pliku, DOCTYPE, poprawność XML' },
  recognition: { name: 'Rozpoznanie', description: 'Czy to FA(3) i która wersja schematu' },
  schema: { name: 'Schemat XSD', description: 'Zgodność z oficjalnym schematem 1-0E' },
  rules: { name: 'Reguły techniczne', description: 'NIP, data wystawienia, numery wierszy' },
  amounts: { name: 'Spójność kwot', description: 'Sumy pozycji i podsumowań faktury VAT' },
}

export const LAYER_ORDER: readonly Layer[] = ['security', 'recognition', 'schema', 'rules', 'amounts']

export interface LayerState {
  sev: Sev
  text: string
  ran: boolean
}

export function layerState(report: Report, layer: Layer): LayerState {
  const status = report.stages.find((stage) => stage.id === layer)?.status ?? 'not_run'
  const findings = report.findings.filter((finding) => finding.stage === layer)
  const errors = findings.filter((finding) => finding.severity === 'ERROR').length
  const warnings = findings.filter((finding) => finding.severity === 'WARNING').length
  const counted = [errors > 0 ? countErrors(errors) : null, warnings > 0 ? countWarnings(warnings) : null]
    .filter((text) => text !== null)
    .join(', ')

  switch (status) {
    case 'passed': {
      const { variant, schema } = report.document
      const recognised = layer === 'recognition' && variant !== null && schema !== null
      return { sev: 'ok', text: recognised ? `FA(${variant}), ${schema}` : 'bez uwag', ran: true }
    }
    case 'errors':
      return { sev: 'err', text: counted === '' ? 'błędy' : counted, ran: true }
    case 'warnings':
      return { sev: 'warn', text: counted === '' ? 'ostrzeżenia' : counted, ran: true }
    case 'unsupported':
      return { sev: 'warn', text: 'nieobsługiwany wzór', ran: true }
    case 'not_checked':
      return { sev: 'skip', text: 'nie sprawdzono', ran: true }
    case 'not_run':
      return { sev: 'skip', text: 'nie wykonano', ran: false }
  }
}

export function headline(report: Report): string {
  switch (report.result) {
    case 'ERRORS':
      return `Faktura ma ${countErrors(report.summary.errors)} do poprawienia`
    case 'WARNINGS':
      return `Plik przeszedł kontrolę techniczną, ale ma ${countWarnings(report.summary.warnings)}`
    case 'PASSED':
      return 'Plik przeszedł kontrolę techniczną'
    case 'UNSUPPORTED':
      return report.findings[0]?.title ?? 'Tego pliku nie sprawdzimy'
  }
}

function waitTime(seconds: number | null): string {
  if (seconds === null) return 'minutę'
  if (seconds < 60) return plural(Math.max(1, seconds), ['sekundę', 'sekundy', 'sekund'])
  return plural(Math.ceil(seconds / 60), ['minutę', 'minuty', 'minut'])
}

export function failureMessage(failure: LocalFailure | RemoteFailure): string {
  switch (failure.kind) {
    case 'file-too-large':
      return `Plik ma ${formatNumber(String(failure.size))} B, a limit to ${formatNumber(String(failure.limit))} B. KSeF nie przyjmie faktury tej wielkości, nawet z załącznikiem. Nie wysłaliśmy pliku.`
    case 'payload-too-large':
      return failure.problem?.detail ?? `Serwer nie przyjął pliku, bo jest za duży. Limit to ${formatNumber(String(MAX_FILE_BYTES))} B.`
    case 'unsupported-media-type':
      return failure.problem?.detail ?? 'Serwer nie przyjął pliku jako XML. Spróbuj ponownie.'
    case 'rate-limited':
      return `Za dużo sprawdzeń w krótkim czasie. Spróbuj ponownie za ${waitTime(failure.retryAfterSeconds)}.`
    case 'server':
      return `Serwer nie mógł teraz sprawdzić pliku (błąd ${failure.status}). Spróbuj ponownie za chwilę.`
    case 'unexpected':
      return 'Serwer odpowiedział w nieoczekiwany sposób. Spróbuj ponownie za chwilę.'
    case 'network':
      return 'Nie udało się połączyć z serwerem. Sprawdź połączenie z internetem i spróbuj ponownie.'
    case 'timeout':
      return 'Serwer nie odpowiedział w ciągu 30 sekund. Spróbuj ponownie.'
  }
}

const SKIPPED_CHECKS: Record<string, { title: string; fix: string }> = {
  'KSEF-DUPLICATE': {
    title: 'Duplikat w KSeF',
    fix: 'Przed wysyłką upewnij się, że ta faktura nie została już wysłana. KSeF odrzuca duplikaty.',
  },
  'AMT-NOT-CHECKED': {
    title: 'Kwoty nie zostały sprawdzone',
    fix: 'Narzędzie sprawdza kwoty tylko w zwykłej fakturze VAT zgodnej ze wzorem FA(3). Pozostałe kwoty sprawdź w programie do fakturowania.',
  },
}

export function skippedCheck(id: string): { title: string; fix: string | null } {
  return SKIPPED_CHECKS[id] ?? { title: id, fix: null }
}
