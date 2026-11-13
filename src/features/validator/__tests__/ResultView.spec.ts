import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Report } from '@/api/report'
import ResultView from '../ResultView.vue'
import { OK_FILE, errorsReport, okReport, sample, stubMatchMedia } from './support'

const createInvoicePdf = vi.hoisted(() => vi.fn<(bytes: Uint8Array, options: object) => Promise<Blob>>())
vi.mock('@/pdf/invoicePdf', () => ({ createInvoicePdf }))

const bytes = sample(OK_FILE)
const hash = okReport.document.sha256Base64Url
const LINK = `https://qr.ksef.mf.gov.pl/invoice/1111111111/06-11-2026/${hash}`
const KSEF_NUMBER = '1111111111-20261106-0A1B2C3D4E5F-65'
const PDF = new Blob(['%PDF-'], { type: 'application/pdf' })

const warningsReport: Report = { ...okReport, result: 'WARNINGS', summary: { ...okReport.summary, warnings: 1 } }
const unsupportedReport: Report = {
  ...okReport,
  result: 'UNSUPPORTED',
  stages: [
    { id: 'security', status: 'passed' },
    { id: 'recognition', status: 'unsupported' },
    { id: 'schema', status: 'not_run' },
    { id: 'rules', status: 'not_run' },
    { id: 'amounts', status: 'not_run' },
  ],
}

let click: ReturnType<typeof vi.spyOn>
let downloads: string[]
let createObjectURL: ReturnType<typeof vi.fn>
let revokeObjectURL: ReturnType<typeof vi.fn>

beforeEach(() => {
  stubMatchMedia(true)
  downloads = []
  click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download)
  })
  createObjectURL = vi.fn(() => 'blob:pdf')
  revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
  createInvoicePdf.mockReset()
})

afterEach(() => {
  click.mockRestore()
  vi.unstubAllGlobals()
})

const mountResult = (report: Report = okReport, fileHash = hash) =>
  mount(ResultView, { props: { report, file: { name: OK_FILE, bytes }, hash: fileHash }, attachTo: document.body })

const pdfButton = (wrapper: ReturnType<typeof mountResult>) =>
  wrapper.findAll('.res__acts button').find((button) => /PDF/.test(button.text()))

describe('ResultView PDF', () => {
  it.each([
    ['PASSED', okReport],
    ['WARNINGS', warningsReport],
  ])('offers the PDF for a %s result', (_, report) => {
    const wrapper = mountResult(report)

    expect(pdfButton(wrapper)?.text()).toBe('Pobierz PDF')
    expect(wrapper.text()).not.toContain('PDF utworzysz po poprawieniu błędów.')
  })

  it.each([
    ['ERRORS', errorsReport],
    ['UNSUPPORTED', unsupportedReport],
  ])('explains instead of offering the PDF for an %s result', (_, report) => {
    const wrapper = mountResult(report)

    expect(pdfButton(wrapper)).toBeUndefined()
    expect(wrapper.text()).toContain('PDF utworzysz po poprawieniu błędów.')
  })

  it('disables the button while the PDF is created and downloads it under the invoice number', async () => {
    let finish: (blob: Blob) => void = () => {}
    createInvoicePdf.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const wrapper = mountResult()

    await pdfButton(wrapper)!.trigger('click')
    await vi.waitFor(() => expect(createInvoicePdf).toHaveBeenCalledOnce())

    expect(pdfButton(wrapper)!.text()).toBe('Tworzę PDF')
    expect(pdfButton(wrapper)!.attributes('disabled')).toBeDefined()
    expect(wrapper.get('.res .say').text()).toBe('Tworzę PDF.')
    expect(createInvoicePdf).toHaveBeenCalledWith(bytes, { link: LINK, ksefNumber: null })

    finish(PDF)
    await flushPromises()

    expect(createObjectURL).toHaveBeenCalledWith(PDF)
    expect(downloads).toEqual(['wizualizacja-FV-2026-11-0001.pdf'])
    expect(pdfButton(wrapper)!.text()).toBe('Pobierz PDF')
    expect(pdfButton(wrapper)!.attributes('disabled')).toBeUndefined()
    expect(wrapper.get('.res .say').text()).toBe('Pobieranie PDF rozpoczęte.')
  })

  it('puts the KSeF number entered in the panel into the PDF', async () => {
    createInvoicePdf.mockResolvedValue(PDF)
    const wrapper = mountResult()

    await wrapper.get('#ksef-nr').setValue(KSEF_NUMBER)
    await wrapper.get('#ksef-nr').trigger('change')
    await pdfButton(wrapper)!.trigger('click')
    await flushPromises()

    expect(createInvoicePdf).toHaveBeenCalledWith(bytes, { link: LINK, ksefNumber: KSEF_NUMBER })
  })

  it('creates the PDF without the QR code when the link is not shown', async () => {
    createInvoicePdf.mockResolvedValue(PDF)
    const wrapper = mountResult(okReport, 'A'.repeat(43))

    await pdfButton(wrapper)!.trigger('click')
    await flushPromises()

    expect(createInvoicePdf).toHaveBeenCalledWith(bytes, { link: null, ksefNumber: null })
  })

  it('says the PDF failed without logging the invoice and keeps the result usable', async () => {
    const consoleError = vi.spyOn(console, 'error')
    createInvoicePdf.mockRejectedValue(new Error('Przykładowy Sprzedawca Sp. z o.o.'))
    const wrapper = mountResult()

    await pdfButton(wrapper)!.trigger('click')
    await flushPromises()

    expect(wrapper.get('.res .say').text()).toBe('Nie udało się utworzyć PDF. Wynik i link działają bez zmian.')
    expect(pdfButton(wrapper)!.attributes('disabled')).toBeUndefined()
    expect(downloads).toEqual([])
    expect(wrapper.get('#vlink').text()).toBe(LINK)
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
