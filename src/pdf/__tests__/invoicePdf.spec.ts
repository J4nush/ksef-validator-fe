import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createInvoicePdf } from '../invoicePdf'
import { bytesOf, compact, encode, examplePath, fixturePath, readPdf } from './support'

const example = readFileSync(examplePath('faktura-poprawna.xml'), 'utf8')
const LINK = 'https://qr.ksef.mf.gov.pl/invoice/1111111111/06-11-2026/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCd'
const NUMBER = '1111111111-20261106-0A1B2C3D4E5F-65'
const TITLE = 'Wizualizacja pomocnicza'
const NOTICE = 'To nie jest dokument pobrany z KSeF. Utworzono w przeglądarce z pliku XML.'
const QR_HEADER = 'Sprawdź, czy Twoja faktura znajduje się w KSeF!'
const NO_NUMBER = 'KSeF drukuje tu numer KSeF albo napis OFFLINE'

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const withPaymentLink = (link: string) =>
  example.replace('</Platnosc>', `<LinkDoPlatnosci>${escapeXml(link)}</LinkDoPlatnosci></Platnosc>`)
const withManyLines = (count: number) => {
  const line = /<FaWiersz>[\s\S]*?<\/FaWiersz>/.exec(example)?.[0] ?? ''
  return example.replace(line, Array.from({ length: count }, () => line).join(''))
}
const occurrences = (text: string, needle: string) => compact(text).split(compact(needle)).length - 1

async function render(xml: string | Uint8Array<ArrayBuffer>, options = { link: null as string | null, ksefNumber: null as string | null }) {
  return readPdf(await createInvoicePdf(typeof xml === 'string' ? encode(xml) : xml, options))
}

describe('createInvoicePdf', () => {
  it('returns a PDF document', async () => {
    const blob = await createInvoicePdf(encode(example), { link: null, ksefNumber: null })

    expect(blob.type).toBe('application/pdf')
    expect(new TextDecoder().decode((await blob.arrayBuffer()).slice(0, 5))).toBe('%PDF-')
  })

  it('keeps all Polish letters in names and line descriptions', async () => {
    const pdf = await render(bytesOf(fixturePath('polskie-znaki.xml')))

    expect(pdf.text).toContain('Przykładowy Sprzedawca Zażółć Gęślą Jaźń Sp. z o.o.')
    expect(pdf.text).toContain('PRZYKŁADOWY NABYWCA ZAŻÓŁĆ GĘŚLĄ JAŹŃ SP. Z O.O.')
    expect(compact(pdf.text)).toContain(compact('Usługa przykładowa: zażółć gęślą jaźń, ZAŻÓŁĆ GĘŚLĄ JAŹŃ'))
    for (const letter of 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ') expect(pdf.text).toContain(letter)
  })

  it('marks every page as an auxiliary visualisation instead of a KSeF document', async () => {
    const pdf = await render(withManyLines(90))

    expect(pdf.pages.length).toBeGreaterThan(1)
    for (const page of pdf.pages) {
      expect(compact(page)).toContain(compact(TITLE))
      expect(compact(page)).toContain(compact(NOTICE))
    }
    expect(compact(pdf.pages[0] ?? '')).toContain(compact(`${TITLE}Numer Faktury:`))
    expect(pdf.text).not.toContain('Krajowy System')
    expect(pdf.text).not.toContain('e-Faktur')
  })

  it('does not name the KSeF taxpayer application when the file does not say which program created it', async () => {
    const pdf = await render(example.replace(/<SystemInfo>[^<]*<\/SystemInfo>/, ''))

    expect(pdf.text).not.toContain('Aplikacja Podatnika')
    expect(compact(pdf.text)).toContain(compact('Wytworzona w: program nie jest podany w pliku'))
  })

  it('describes itself in the document metadata', async () => {
    const { info } = await render(example)

    expect(info.Title).toBe('Wizualizacja pomocnicza faktury')
    expect(info.Creator).toBe('ksef.michal-ziolek.dev')
    expect(String(info.Producer)).toMatch(/ksef-pdf-generator\/1\.1\.48$/)
  })

  it('prints the KSeF number under the QR code and links the code to the verification page', async () => {
    const pdf = await render(example, { link: LINK, ksefNumber: NUMBER })

    expect(pdf.text).toContain(QR_HEADER)
    expect(occurrences(pdf.text, NUMBER)).toBe(2)
    expect(pdf.text).not.toContain(NO_NUMBER)
    expect(pdf.links).toEqual([LINK])
  })

  it('says under the QR code that KSeF prints a number there when none was given', async () => {
    const pdf = await render(example, { link: LINK, ksefNumber: null })

    expect(compact(pdf.text)).toContain(compact(`${TITLE}\n${NO_NUMBER}`))
    expect(pdf.text).not.toContain('Numer KSeF:')
    expect(pdf.links).toEqual([LINK])
  })

  it('leaves out the QR section without a verification link', async () => {
    const pdf = await render(example, { link: null, ksefNumber: NUMBER })

    expect(pdf.text).not.toContain(QR_HEADER)
    expect(pdf.text).not.toContain(NO_NUMBER)
    expect(pdf.links).toEqual([])
  })

  it.each([
    ['https://example.com/zaplac?id=1', 'https://example.com/zaplac?id=1'],
    ['HTTPS://EXAMPLE.COM/ZAPLAC', 'https://example.com/ZAPLAC'],
    ['javascript:alert(1)', null],
    ['http://example.com/zaplac', null],
    ['data:text/html,zaplac', null],
    ['https://example.com/za plac', null],
    ['https://', null],
  ])('shows the payment link %s as text and makes it clickable only for https', async (raw, target) => {
    const pdf = await render(withPaymentLink(raw))

    expect(compact(pdf.text)).toContain(compact(raw))
    expect(pdf.links).toEqual(target === null ? [] : [target])
  })

  it('rejects a file that holds no FA(3) invoice', async () => {
    await expect(createInvoicePdf(encode('<?xml version="1.0"?><Inne/>'), { link: null, ksefNumber: null })).rejects.toThrow()
  })
})
