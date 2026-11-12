import type { ExcerptLine } from '@/domain/xmlExcerpt'

export interface XmlSegment {
  text: string
  tag: boolean
  mark: boolean
}

const TAG = /<[^>]*>?/g

export function xmlSegments(text: string, mark: ExcerptLine['mark']): XmlSegment[] {
  const cuts = new Set([0, text.length])
  const tags: [number, number][] = []
  for (const match of text.matchAll(TAG)) {
    tags.push([match.index, match.index + match[0].length])
    cuts.add(match.index).add(match.index + match[0].length)
  }
  if (mark !== null) cuts.add(mark.start).add(mark.end)

  const points = [...cuts].filter((point) => point >= 0 && point <= text.length).sort((a, b) => a - b)
  const segments: XmlSegment[] = []
  for (let i = 0; i + 1 < points.length; i++) {
    const start = points[i]!
    const end = points[i + 1]!
    if (start === end) continue
    segments.push({
      text: text.slice(start, end),
      tag: tags.some(([from, to]) => start >= from && end <= to),
      mark: mark !== null && start >= mark.start && end <= mark.end,
    })
  }
  return segments
}
