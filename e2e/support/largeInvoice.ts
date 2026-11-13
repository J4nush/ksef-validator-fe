import { example, EXAMPLE_CLEAN } from './invoice'

const MIN_BYTES = 2_900_000
const MAX_BYTES = 3_000_000
const ROWS_PER_TABLE = 1000

const row = (number: number) =>
  `\n        <Wiersz><WKom>${number}</WKom><WKom>Pozycja przykładowa ${number}, usługa fikcyjna</WKom><WKom>${(number % 9) + 1}</WKom><WKom>${(number % 500) + 10}.00</WKom></Wiersz>`

const table = (from: number, count: number) =>
  `\n      <Tabela><Opis>Wykaz pozycji przykładowych od ${from}</Opis><TNaglowek>` +
  '<Kol Typ="int"><NKom>Lp.</NKom></Kol><Kol Typ="txt"><NKom>Nazwa</NKom></Kol>' +
  '<Kol Typ="int"><NKom>Ilość</NKom></Kol><Kol Typ="dec"><NKom>Cena netto</NKom></Kol></TNaglowek>' +
  Array.from({ length: count }, (_, index) => row(from + index)).join('') +
  '\n      </Tabela>'

export function largeInvoice(): Buffer {
  const base = example(EXAMPLE_CLEAN).toString('utf8')
  const target = (MIN_BYTES + MAX_BYTES) / 2
  const blocks: string[] = []
  let size = Buffer.byteLength(base) + 64
  let next = 1
  while (size < target) {
    const remaining = Math.ceil((target - size) / Buffer.byteLength(row(next)))
    const block = `\n    <BlokDanych><ZNaglowek>Załącznik z pozycjami przykładowymi</ZNaglowek><MetaDane><ZKlucz>Część</ZKlucz><ZWartosc>${blocks.length + 1}</ZWartosc></MetaDane>${table(next, Math.min(ROWS_PER_TABLE, Math.max(remaining, 1)))}\n    </BlokDanych>`
    blocks.push(block)
    size += Buffer.byteLength(block)
    next += ROWS_PER_TABLE
  }
  const xml = base.replace('</Faktura>', `  <Zalacznik>${blocks.join('')}\n  </Zalacznik>\n</Faktura>`)
  const bytes = Buffer.from(xml, 'utf8')
  if (bytes.length < MIN_BYTES || bytes.length > MAX_BYTES) throw new Error(`large invoice has ${bytes.length} B`)
  return bytes
}
