import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const EXAMPLE_ERRORS = 'faktura-z-bledami.xml'
export const EXAMPLE_CLEAN = 'faktura-poprawna.xml'
export const MARKER_PREFIX = 'ZNACZNIK'
export const SAMPLE_KSEF_NUMBER = '1111111111-20261106-0A1B2C3D4E5F-65'

export const example = (name: string) => readFileSync(new URL(`../../public/przyklady/${name}`, import.meta.url))
export const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url))
export const fixtureReport = (name: string): unknown => JSON.parse(fixture(name).toString('utf8'))

const PROD_HOST = 'https://qr.ksef.mf.gov.pl'

export function expectedLink(bytes: Buffer, host = PROD_HOST): string {
  const xml = bytes.toString('utf8')
  const seller = /<Podmiot1>[\s\S]*?<NIP>(\d{10})<\/NIP>/.exec(xml)?.[1]
  const issued = /<P_1>(\d{4})-(\d{2})-(\d{2})<\/P_1>/.exec(xml)
  if (!seller || !issued) throw new Error('invoice has no seller NIP or issue date')
  const [, year, month, day] = issued
  const hash = createHash('sha256').update(bytes).digest('base64url')
  return `${host}/invoice/${seller}/${day}-${month}-${year}/${hash}`
}

export function markedInvoice(): { marker: string; name: string; bytes: Buffer } {
  const marker = `${MARKER_PREFIX}-${randomBytes(6).toString('hex')}`
  const xml = example(EXAMPLE_CLEAN).toString('utf8').replace('Usługa przykładowa A', `Usługa ${marker}`)
  return { marker, name: `faktura-${marker}.xml`, bytes: Buffer.from(xml, 'utf8') }
}
