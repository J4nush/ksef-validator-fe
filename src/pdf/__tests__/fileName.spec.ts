import { describe, expect, it } from 'vitest'
import { pdfFileName } from '../fileName'

describe('pdfFileName', () => {
  it.each([
    ['FV/2026/11/0001', 'wizualizacja-FV-2026-11-0001.pdf'],
    ['FV_12-A', 'wizualizacja-FV_12-A.pdf'],
    ['  Faktura nr 7 / ŁÓDŹ  ', 'wizualizacja-Faktura-nr-7-D.pdf'],
    ['../../etc/passwd', 'wizualizacja-etc-passwd.pdf'],
    ['A'.repeat(70), `wizualizacja-${'A'.repeat(60)}.pdf`],
    [`${'A'.repeat(59)}/B`, `wizualizacja-${'A'.repeat(59)}.pdf`],
  ])('names the file after the invoice number %s', (number, name) => {
    expect(pdfFileName(number)).toBe(name)
  })

  it.each([null, '', '///', 'ŻÓŁĆ'])('falls back to a generic name for %s', (number) => {
    expect(pdfFileName(number)).toBe('wizualizacja-faktury.pdf')
  })
})
