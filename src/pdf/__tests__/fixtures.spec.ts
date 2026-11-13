import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createInvoicePdf } from '../invoicePdf'
import { bytesOf, compact, engineFixtures, examplePath, hasEngineFixtures, readPdf } from './support'

const decodeXml = (text: string) =>
  text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

function field(xml: string, path: string[]): string {
  const pattern = path.map((name) => `<(?:\\w+:)?${name}\\b[^>]*>`).join('[\\s\\S]*?') + '([^<]*)<'
  const found = new RegExp(pattern).exec(xml)?.[1]
  if (found === undefined) throw new Error(`no ${path.join('/')}`)
  return decodeXml(found.trim())
}

function expectations(xml: string) {
  return {
    seller: field(xml, ['Podmiot1', 'Nazwa']),
    buyer: field(xml, ['Podmiot2', 'Nazwa']),
    number: field(xml, ['Fa', 'P_2']),
    total: field(xml, ['Fa', 'P_15']).replace('.', ','),
  }
}

function printable(directory: string): string[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.expected.json'))
    .filter((name) => ['PASSED', 'WARNINGS'].includes(JSON.parse(readFileSync(join(directory, name), 'utf8')).result))
    .map((name) => name.replace('.expected.json', '.xml'))
}

async function render(path: string) {
  const bytes = bytesOf(path)
  const text = compact((await readPdf(await createInvoicePdf(bytes, { link: null, ksefNumber: null }))).text)
  return { text, expected: Object.values(expectations(new TextDecoder().decode(bytes))).map(compact) }
}

describe('invoice data in the PDF', () => {
  it.each(['faktura-poprawna.xml', 'faktura-z-bledami.xml'])('shows the parties, number and total of %s', async (name) => {
    const { text, expected } = await render(examplePath(name))

    for (const value of expected) expect(text).toContain(value)
  })

  describe.skipIf(!hasEngineFixtures)('engine fixtures that pass validation', () => {
    const names = hasEngineFixtures ? printable(engineFixtures) : []

    it('finds the fixtures', () => {
      expect(names.length).toBeGreaterThan(10)
    })

    it.each(names)('shows the parties, number and total of %s', async (name) => {
      const { text, expected } = await render(join(engineFixtures, name))

      for (const value of expected) expect(text).toContain(value)
    })
  })
})
