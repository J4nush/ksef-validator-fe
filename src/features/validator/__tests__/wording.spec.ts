import { describe, expect, it } from 'vitest'
import type { Finding, Layer, LayerStatus, Report } from '@/api/report'
import {
  countErrors,
  countSkipped,
  countWarnings,
  failureMessage,
  headline,
  layerState,
  skippedCheck,
} from '../wording'
import { errorsReport, okReport } from './support'

const report = (patch: Partial<Report>): Report => ({ ...okReport, ...patch })
const finding = (severity: Finding['severity'], stage: Layer): Finding => ({
  id: 'X',
  severity,
  stage,
  title: 't',
  field: null,
  line: null,
  message: 'm',
  fix: 'f',
  docsUrl: '/',
  params: {},
})
const withStage = (id: Layer, status: LayerStatus, findings: Finding[] = []) =>
  report({
    stages: okReport.stages.map((stage) => (stage.id === id ? { id, status } : stage)) as Report['stages'],
    findings,
  })

describe('counts', () => {
  it.each([
    [0, '0 błędów'],
    [1, '1 błąd'],
    [2, '2 błędy'],
    [4, '4 błędy'],
    [5, '5 błędów'],
    [12, '12 błędów'],
    [22, '22 błędy'],
  ])('counts %i errors as %s', (count, text) => {
    expect(countErrors(count)).toBe(text)
  })

  it.each([
    [0, '0 ostrzeżeń'],
    [1, '1 ostrzeżenie'],
    [3, '3 ostrzeżenia'],
    [14, '14 ostrzeżeń'],
  ])('counts %i warnings as %s', (count, text) => {
    expect(countWarnings(count)).toBe(text)
  })

  it('counts skipped checks without changing the word', () => {
    expect(countSkipped(2)).toBe('2 nie sprawdzono')
  })
})

describe('headline', () => {
  it('counts errors to fix', () => {
    expect(headline(errorsReport)).toBe('Faktura ma 1 błąd do poprawienia')
    expect(headline(report({ result: 'ERRORS', summary: { errors: 3, warnings: 0, info: 0, skippedChecks: 0 } }))).toBe(
      'Faktura ma 3 błędy do poprawienia',
    )
  })

  it('says the file passed', () => {
    expect(headline(okReport)).toBe('Plik przeszedł kontrolę techniczną')
  })

  it('says the file passed with warnings', () => {
    expect(headline(report({ result: 'WARNINGS', summary: { errors: 0, warnings: 2, info: 0, skippedChecks: 1 } }))).toBe(
      'Plik przeszedł kontrolę techniczną, ale ma 2 ostrzeżenia',
    )
  })

  it('names an unsupported file by its finding', () => {
    const fa2 = { ...finding('INFO', 'recognition'), title: 'Faktura w starszym wzorze FA(2)' }
    expect(headline(report({ result: 'UNSUPPORTED', findings: [fa2] }))).toBe('Faktura w starszym wzorze FA(2)')
    expect(headline(report({ result: 'UNSUPPORTED', findings: [] }))).toBe('Tego pliku nie sprawdzimy')
  })
})

describe('layerState', () => {
  it('names the recognised schema', () => {
    expect(layerState(okReport, 'recognition')).toEqual({ sev: 'ok', text: 'FA(3), 1-0E', ran: true })
  })

  it('says a clean layer has nothing to report', () => {
    expect(layerState(okReport, 'schema')).toEqual({ sev: 'ok', text: 'bez uwag', ran: true })
  })

  it('counts errors and warnings of the layer', () => {
    expect(layerState(errorsReport, 'rules')).toEqual({ sev: 'err', text: '1 błąd, 1 ostrzeżenie', ran: true })
    expect(layerState(errorsReport, 'amounts')).toEqual({ sev: 'warn', text: '1 ostrzeżenie', ran: true })
  })

  it('reports an error status even without a counted finding', () => {
    expect(layerState(withStage('security', 'errors'), 'security')).toEqual({ sev: 'err', text: 'błędy', ran: true })
  })

  it('says which layers did not run or did not check', () => {
    expect(layerState(withStage('schema', 'not_run'), 'schema')).toEqual({ sev: 'skip', text: 'nie wykonano', ran: false })
    expect(layerState(withStage('amounts', 'not_checked'), 'amounts')).toEqual({
      sev: 'skip',
      text: 'nie sprawdzono',
      ran: true,
    })
  })

  it('marks an unsupported document', () => {
    expect(layerState(withStage('recognition', 'unsupported'), 'recognition')).toEqual({
      sev: 'warn',
      text: 'nieobsługiwany wzór',
      ran: true,
    })
  })
})

describe('failureMessage', () => {
  it('explains a file over the limit without sending it', () => {
    expect(failureMessage({ kind: 'file-too-large', size: 3_500_000, limit: 3_000_000 })).toBe(
      'Plik ma 3\u00a0500\u00a0000 B, a limit to 3\u00a0000\u00a0000 B. KSeF nie przyjmie faktury tej wielkości, nawet z załącznikiem. Nie wysłaliśmy pliku.',
    )
  })

  it('uses the rate limit text with the time to wait', () => {
    const problem = null
    expect(failureMessage({ kind: 'rate-limited', retryAfterSeconds: 45, problem })).toBe(
      'Za dużo sprawdzeń w krótkim czasie. Spróbuj ponownie za 45 sekund.',
    )
    expect(failureMessage({ kind: 'rate-limited', retryAfterSeconds: 1, problem })).toBe(
      'Za dużo sprawdzeń w krótkim czasie. Spróbuj ponownie za 1 sekundę.',
    )
    expect(failureMessage({ kind: 'rate-limited', retryAfterSeconds: 120, problem })).toBe(
      'Za dużo sprawdzeń w krótkim czasie. Spróbuj ponownie za 2 minuty.',
    )
    expect(failureMessage({ kind: 'rate-limited', retryAfterSeconds: 61, problem })).toBe(
      'Za dużo sprawdzeń w krótkim czasie. Spróbuj ponownie za 2 minuty.',
    )
    expect(failureMessage({ kind: 'rate-limited', retryAfterSeconds: null, problem })).toBe(
      'Za dużo sprawdzeń w krótkim czasie. Spróbuj ponownie za minutę.',
    )
  })

  it('prefers the server explanation for a rejected upload', () => {
    const problem = { type: '/api/problems/x', title: 'Za duży plik', status: 413, detail: 'Plik ma ponad 3 000 000 bajtów.' }
    expect(failureMessage({ kind: 'payload-too-large', problem })).toBe('Plik ma ponad 3 000 000 bajtów.')
    expect(failureMessage({ kind: 'payload-too-large', problem: null })).toBe(
      'Serwer nie przyjął pliku, bo jest za duży. Limit to 3\u00a0000\u00a0000 B.',
    )
  })

  it.each([
    [{ kind: 'unsupported-media-type', problem: null } as const, 'Serwer nie przyjął pliku jako XML. Spróbuj ponownie.'],
    [{ kind: 'server', status: 503, problem: null } as const, 'Serwer nie mógł teraz sprawdzić pliku (błąd 503). Spróbuj ponownie za chwilę.'],
    [{ kind: 'unexpected', status: 200 } as const, 'Serwer odpowiedział w nieoczekiwany sposób. Spróbuj ponownie za chwilę.'],
    [{ kind: 'network' } as const, 'Nie udało się połączyć z serwerem. Sprawdź połączenie z internetem i spróbuj ponownie.'],
    [{ kind: 'timeout' } as const, 'Serwer nie odpowiedział w ciągu 30 sekund. Spróbuj ponownie.'],
  ])('explains %o', (failure, text) => {
    expect(failureMessage(failure)).toBe(text)
  })
})

describe('skippedCheck', () => {
  it('names known skipped checks and tells what to do', () => {
    expect(skippedCheck('KSEF-DUPLICATE')).toEqual({
      title: 'Duplikat w KSeF',
      fix: 'Przed wysyłką upewnij się, że ta faktura nie została już wysłana. KSeF odrzuca duplikaty.',
    })
    expect(skippedCheck('AMT-NOT-CHECKED').title).toBe('Kwoty nie zostały sprawdzone')
  })

  it('falls back to the id for an unknown check', () => {
    expect(skippedCheck('NEW-CHECK')).toEqual({ title: 'NEW-CHECK', fix: null })
  })
})
