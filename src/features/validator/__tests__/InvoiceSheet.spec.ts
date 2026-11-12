import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { readInvoice, type InvoiceData } from '@/domain/invoiceReader'
import InvoiceSheet from '../InvoiceSheet.vue'
import { OK_FILE, okReport, sample } from './support'

const nbsp = ' '
const bytes = sample(OK_FILE)

function invoiceOf(source: Uint8Array): InvoiceData {
  const read = readInvoice(source)
  if (!read.ok) throw new Error(read.reason)
  return read.invoice
}

const mountSheet = (invoice = invoiceOf(bytes), file = bytes) =>
  mount(InvoiceSheet, { props: { invoice, bytes: file, hash: okReport.document.sha256Base64Url } })

const terms = (wrapper: ReturnType<typeof mountSheet>, selector: string) =>
  Object.fromEntries(wrapper.findAll(`${selector} div`).map((row) => [row.get('dt').text(), row.get('dd').text()]))

describe('InvoiceSheet', () => {
  it('shows the seller and the buyer', () => {
    const wrapper = mountSheet()
    const [seller, buyer] = wrapper.findAll('.party')

    expect(seller!.text()).toBe('SprzedawcaPrzykładowy Sprzedawca Sp. z o.o.ul. Przykładowa 1, 00-000 PrzykładowoNIP 1111111111')
    expect(buyer!.text()).toBe('NabywcaPrzykładowy Nabywca Sp. z o.o.ul. Przykładowa 2, 00-000 PrzykładowoNIP 2222222222')
  })

  it('shows the invoice number, dates and payment', () => {
    expect(terms(mountSheet(), '.meta')).toEqual({
      Numer: 'FV/2026/11/0001',
      Wystawiono: '06.11.2026',
      Sprzedaż: '05.11.2026',
      'Termin płatności': '20.11.2026',
      Płatność: 'Przelew',
    })
  })

  it('lists the lines with Polish number formatting', () => {
    const wrapper = mountSheet()

    expect(wrapper.get('#h-p').text()).toBe('Pozycje i kwoty, PLN')
    expect(wrapper.findAll('.rows tbody tr').map((row) => row.findAll('th, td').map((cell) => cell.text()))).toEqual([
      ['1', 'Usługa przykładowa A', '2 usł.', `2${nbsp}150,00`, `4${nbsp}300,00`, '23%'],
      ['2', 'Usługa przykładowa B', '1 usł.', `3${nbsp}500,00`, `3${nbsp}500,00`, '23%'],
    ])
  })

  it('sums the amounts by rate and shows the total due', () => {
    expect(terms(mountSheet(), '.sums')).toEqual({
      'Netto, stawka 23% lub 22%': `7${nbsp}800,00`,
      'VAT, stawka 23% lub 22%': `1${nbsp}794,00`,
      'Do zapłaty': `9${nbsp}594,00`,
    })
  })

  it('names a sale period and sums without tax', () => {
    const source = new TextDecoder()
      .decode(bytes)
      .replace('<P_6>2026-11-05</P_6>', '<OkresFa><P_6_Od>2026-10-01</P_6_Od><P_6_Do>2026-10-31</P_6_Do></OkresFa>')
      .replace('<P_13_1>7800.00</P_13_1>\n    <P_14_1>1794.00</P_14_1>', '<P_13_7>7800.00</P_13_7>')
    const wrapper = mountSheet(invoiceOf(new TextEncoder().encode(source)))

    expect(terms(wrapper, '.meta').Sprzedaż).toBe('od 01.10.2026 do 31.10.2026')
    expect(terms(wrapper, '.sums')).toEqual({
      'Wartość sprzedaży, zwolniona od podatku': `7${nbsp}800,00`,
      'Do zapłaty': `9${nbsp}594,00`,
    })
  })

  it('says when a field is missing instead of leaving it blank', () => {
    const invoice = invoiceOf(bytes)
    const wrapper = mountSheet({ ...invoice, number: null, buyer: { ...invoice.buyer, name: null, nip: null } })

    expect(terms(wrapper, '.meta').Numer).toBe('brak w pliku')
    expect(wrapper.findAll('.party')[1]!.text()).toContain('Nazwa: brak w pliku')
    expect(wrapper.findAll('.party')[1]!.text()).not.toContain('NIP')
  })

  it('never turns addresses or e-mails from the file into links', () => {
    const invoice = invoiceOf(bytes)
    const wrapper = mountSheet({
      ...invoice,
      seller: { ...invoice.seller, address: { countryCode: 'PL', line1: 'https://example.com', line2: 'biuro@example.com' } },
    })

    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.findAll('.party')[0]!.text()).toContain('https://example.com, biuro@example.com')
  })

  it('keeps the whole XML with line numbers and the file hash under technical details', () => {
    const wrapper = mountSheet()
    const tech = wrapper.get('details.tech')

    expect(tech.get('summary').text()).toBe('Szczegóły techniczne: plik XML, 88 linii')
    expect(tech.text()).toContain(`SHA-256 pliku, Base64URL: ${okReport.document.sha256Base64Url}`)
    expect(tech.findAll('.xml__l')).toHaveLength(88)
    const numbers = tech.findAll('.xml__n')
    expect(numbers[numbers.length - 1]!.text()).toBe('88')
  })
})
