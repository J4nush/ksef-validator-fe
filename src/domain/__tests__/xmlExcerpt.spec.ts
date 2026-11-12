import { describe, expect, it } from 'vitest'
import { xmlExcerpt } from '../xmlExcerpt'

const encode = (text: string) => new TextEncoder().encode(text)

const file = encode(
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Faktura>',
    '  <Podmiot1>',
    '    <DaneIdentyfikacyjne>',
    '      <NIP>1111111112</NIP>',
    '      <Nazwa>Przykładowy Sprzedawca Sp. z o.o.</Nazwa>',
    '    </DaneIdentyfikacyjne>',
    '  </Podmiot1>',
    '</Faktura>',
  ].join('\n'),
)

describe('xmlExcerpt', () => {
  it('returns the lines around the reported line with the value marked', () => {
    expect(xmlExcerpt(file, 5, { value: '1111111112' })).toEqual({
      line: 5,
      lines: [
        { number: 3, text: '  <Podmiot1>', mark: null, clippedStart: false, clippedEnd: false },
        { number: 4, text: '    <DaneIdentyfikacyjne>', mark: null, clippedStart: false, clippedEnd: false },
        {
          number: 5,
          text: '      <NIP>1111111112</NIP>',
          mark: { start: 11, end: 21 },
          clippedStart: false,
          clippedEnd: false,
        },
        {
          number: 6,
          text: '      <Nazwa>Przykładowy Sprzedawca Sp. z o.o.</Nazwa>',
          mark: null,
          clippedStart: false,
          clippedEnd: false,
        },
        { number: 7, text: '    </DaneIdentyfikacyjne>', mark: null, clippedStart: false, clippedEnd: false },
      ],
    })
  })

  it('stops the window at the start and the end of the file', () => {
    expect(xmlExcerpt(file, 1)?.lines.map((line) => line.number)).toEqual([1, 2, 3])
    expect(xmlExcerpt(file, 9, { context: 1 })?.lines.map((line) => line.number)).toEqual([8, 9])
  })

  it('gives nothing for a line outside the file', () => {
    expect(xmlExcerpt(file, 0)).toBeNull()
    expect(xmlExcerpt(file, 10)).toBeNull()
  })

  it('counts CRLF and CR line ends like an XML parser', () => {
    const crlf = encode('<a>\r\n<b>x</b>\r<c>y</c>\n')

    expect(xmlExcerpt(crlf, 3, { context: 0, value: 'y' })?.lines).toEqual([
      { number: 3, text: '<c>y</c>', mark: { start: 3, end: 4 }, clippedStart: false, clippedEnd: false },
    ])
  })

  it('skips a byte order mark so the first line keeps its columns', () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...encode('<P_2>FV/1</P_2>')])

    expect(xmlExcerpt(bom, 1, { value: 'FV/1' })?.lines[0]?.mark).toEqual({ start: 5, end: 9 })
  })

  it('marks a value shortened with an ellipsis by its visible part', () => {
    const long = 'A'.repeat(80)
    const excerpt = xmlExcerpt(encode(`<P_7>${long}</P_7>`), 1, { value: `${'A'.repeat(59)}…` })

    expect(excerpt?.lines[0]?.mark).toEqual({ start: 5, end: 64 })
  })

  it('marks a value written with XML entities in the file', () => {
    const excerpt = xmlExcerpt(encode('<Nazwa>A &amp; B</Nazwa>'), 1, { value: 'A & B' })

    expect(excerpt?.lines[0]?.mark).toEqual({ start: 7, end: 16 })
  })

  it('marks the value on a nearby line when the element spans lines', () => {
    const excerpt = xmlExcerpt(encode('<P_7>\n  Usługa\n</P_7>'), 1, { value: 'Usługa' })

    expect(excerpt?.lines.map((line) => line.mark)).toEqual([null, { start: 2, end: 8 }, null])
  })

  it('leaves the excerpt unmarked when the value is not in the window', () => {
    expect(xmlExcerpt(file, 5, { value: '9999999999' })?.lines.every((line) => line.mark === null)).toBe(true)
  })

  it('clips a very long line around the marked value', () => {
    const filler = '<x>1</x>'.repeat(200)
    const minified = encode(`<Faktura>${filler}<NIP>1111111112</NIP>${filler}</Faktura>`)
    const [line] = xmlExcerpt(minified, 1, { value: '1111111112', maxLineLength: 40 })?.lines ?? []

    expect(line?.text).toHaveLength(40)
    expect(line?.clippedStart).toBe(true)
    expect(line?.clippedEnd).toBe(true)
    expect(line?.text.slice(line.mark?.start, line.mark?.end)).toBe('1111111112')
  })

  it('clips a very long line from its start when nothing is marked', () => {
    const [line] = xmlExcerpt(encode('x'.repeat(500)), 1, { maxLineLength: 40 })?.lines ?? []

    expect(line).toEqual({ number: 1, text: 'x'.repeat(40), mark: null, clippedStart: false, clippedEnd: true })
  })

  it('decodes invalid UTF-8 with replacement characters instead of failing', () => {
    const excerpt = xmlExcerpt(new Uint8Array([0x3c, 0x61, 0x3e, 0xbf, 0x3c, 0x2f, 0x61, 0x3e]), 1)

    expect(excerpt?.lines[0]?.text).toBe('<a>�</a>')
  })
})
