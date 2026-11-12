import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readInvoice, type InvoiceData } from '../invoiceReader'

const source = readFileSync(resolve(__dirname, 'fixtures/invoice.xml'), 'utf8')
const encode = (text: string) => new TextEncoder().encode(text)

function read(text: string): InvoiceData {
  const result = readInvoice(encode(text))
  if (!result.ok) throw new Error(`refused: ${result.reason}`)
  return result.invoice
}

type Cell = string | null

const line = (
  number: Cell,
  name: Cell,
  unit: Cell,
  quantity: Cell,
  unitNetPrice: Cell,
  netValue: Cell,
  rate: Cell,
) => ({ number, name, unit, quantity, unitNetPrice, netValue, rate })

const minimal = (fa: string, root = 'Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/"') =>
  `<?xml version="1.0" encoding="UTF-8"?><${root}><Fa>${fa}</Fa></${root.split(' ')[0]}>`

describe('readInvoice', () => {
  it('reads the parties, dates, payment, lines and totals as plain strings', () => {
    expect(read(source)).toEqual({
      seller: {
        name: 'Przykładowy Sprzedawca Sp. z o.o.',
        nip: '1111111111',
        address: { countryCode: 'PL', line1: 'ul. Przykładowa 1', line2: '00-000 Przykładowo' },
      },
      buyer: {
        name: 'Przykładowy Nabywca Sp. z o.o.',
        nip: '2222222222',
        address: { countryCode: 'PL', line1: 'ul. Fikcyjna 2', line2: null },
      },
      number: 'FV/2/02/2026',
      issueDate: '2026-02-15',
      saleDate: '2026-02-14',
      salePeriod: null,
      currency: 'PLN',
      payment: { dueDates: ['2026-03-01', '2026-03-15'], form: '6', otherForm: null },
      lines: [
        line('1', 'Przykładowa usługa', 'szt.', '1', '350.00', '350.00', '23'),
        line('2', 'Przykładowy towar', 'kg', '2.5', '40.00', '100.00', '8'),
        line('3', 'Przykładowe szkolenie', null, null, null, '20.00', 'zw'),
      ],
      rateTotals: [
        { key: '1', net: '350.00', vat: '80.50' },
        { key: '2', net: '100.00', vat: '8.00' },
        { key: '7', net: '20.00', vat: null },
      ],
      total: '558.50',
    })
  })

  it('reads a document with a namespace prefix the same way', () => {
    const prefixed = source
      .replace('xmlns=', 'xmlns:fa=')
      .replace(/<(\/?)([A-Za-z])/g, '<$1fa:$2')

    expect(read(prefixed)).toEqual(read(source))
  })

  it('gives null for every missing field instead of failing', () => {
    expect(read(minimal(''))).toEqual({
      seller: { name: null, nip: null, address: { countryCode: null, line1: null, line2: null } },
      buyer: { name: null, nip: null, address: { countryCode: null, line1: null, line2: null } },
      number: null,
      issueDate: null,
      saleDate: null,
      salePeriod: null,
      currency: null,
      payment: { dueDates: [], form: null, otherForm: null },
      lines: [],
      rateTotals: [],
      total: null,
    })
  })

  it('reads the sale period and a described payment form', () => {
    const invoice = read(
      minimal(
        '<OkresFa><P_6_Od>2026-01-01</P_6_Od><P_6_Do>2026-01-31</P_6_Do></OkresFa>' +
          '<Platnosc><PlatnoscInna>1</PlatnoscInna><OpisPlatnosci>Kompensata</OpisPlatnosci></Platnosc>',
      ),
    )

    expect(invoice.salePeriod).toEqual({ from: '2026-01-01', to: '2026-01-31' })
    expect(invoice.saleDate).toBeNull()
    expect(invoice.payment).toEqual({ dueDates: [], form: null, otherForm: 'Kompensata' })
  })

  it('ignores elements from another namespace and empty values', () => {
    const invoice = read(minimal('<x:P_2 xmlns:x="urn:other">FV/1</x:P_2><P_1> </P_1>'))

    expect(invoice.number).toBeNull()
    expect(invoice.issueDate).toBeNull()
  })

  it('reads a file that starts with a byte order mark', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...encode(source)])
    const result = readInvoice(bytes)

    expect(result.ok && result.invoice.number).toBe('FV/2/02/2026')
  })

  it.each([
    ['DOCTYPE', source.replace('<Faktura', '<!DOCTYPE Faktura>\n<Faktura')],
    ['lower case doctype', source.replace('<Faktura', '<!doctype Faktura>\n<Faktura')],
  ])('refuses a document with %s before parsing', (_, text) => {
    expect(readInvoice(encode(text))).toEqual({ ok: false, reason: 'doctype' })
  })

  it('refuses bytes that are not valid UTF-8', () => {
    const latin2 = new Uint8Array([...encode('<Faktura>'), 0xbf, ...encode('</Faktura>')])

    expect(readInvoice(latin2)).toEqual({ ok: false, reason: 'encoding' })
  })

  it.each([
    ['unclosed element', '<Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/"><Fa></Faktura>'],
    ['empty file', ''],
    ['plain text', 'to nie jest XML'],
  ])('refuses a %s', (_, text) => {
    expect(readInvoice(encode(text))).toEqual({ ok: false, reason: 'malformed' })
  })

  it('refuses a document outside the FA(3) namespace', () => {
    const fa2 = minimal('<P_2>FV/1</P_2>', 'Faktura xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/"')

    expect(readInvoice(encode(fa2))).toEqual({ ok: false, reason: 'unrecognized' })
  })
})
