export interface ExcerptLine {
  number: number
  text: string
  mark: { start: number; end: number } | null
  clippedStart: boolean
  clippedEnd: boolean
}

export interface XmlExcerpt {
  line: number
  lines: ExcerptLine[]
}

export interface XmlExcerptOptions {
  context?: number
  value?: string | null
  maxLineLength?: number
}

const ELLIPSIS = '…'

function needles(value: string | null | undefined): string[] {
  const shown = value ?? ''
  const visible = shown.endsWith(ELLIPSIS) ? shown.slice(0, -1) : shown
  if (visible === '') return []
  const escaped = visible.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped === visible ? [visible] : [visible, escaped]
}

function findMark(text: string, candidates: string[]): ExcerptLine['mark'] {
  for (const needle of candidates) {
    const start = text.indexOf(needle)
    if (start >= 0) return { start, end: start + needle.length }
  }
  return null
}

function clip(line: ExcerptLine, maxLength: number): ExcerptLine {
  if (line.text.length <= maxLength) return line
  const { mark } = line
  const centered = mark === null ? 0 : mark.start - Math.floor(Math.max(0, maxLength - (mark.end - mark.start)) / 2)
  const from = Math.min(Math.max(0, centered), line.text.length - maxLength)
  return {
    number: line.number,
    text: line.text.slice(from, from + maxLength),
    mark: mark === null ? null : { start: mark.start - from, end: Math.min(mark.end - from, maxLength) },
    clippedStart: from > 0,
    clippedEnd: from + maxLength < line.text.length,
  }
}

export function xmlExcerpt(bytes: Uint8Array, line: number, options: XmlExcerptOptions = {}): XmlExcerpt | null {
  const { context = 2, value = null, maxLineLength = 160 } = options
  const all = new TextDecoder('utf-8').decode(bytes).split(/\r\n|\r|\n/)
  if (!Number.isInteger(line) || line < 1 || line > all.length) return null

  const first = Math.max(1, line - context)
  const last = Math.min(all.length, line + context)
  const lines: ExcerptLine[] = all
    .slice(first - 1, last)
    .map((text, index) => ({ number: first + index, text, mark: null, clippedStart: false, clippedEnd: false }))

  const candidates = needles(value)
  const distance = (entry: ExcerptLine) => Math.abs(entry.number - line)
  const byDistance = [...lines].sort((a, b) => distance(a) - distance(b) || a.number - b.number)
  for (const entry of byDistance) {
    entry.mark = findMark(entry.text, candidates)
    if (entry.mark !== null) break
  }

  return { line, lines: lines.map((entry) => clip(entry, maxLineLength)) }
}
