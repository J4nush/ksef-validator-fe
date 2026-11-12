import type { Finding } from '@/api/report'

export interface DiffPart {
  text: string
  mark: boolean
}

export type FindingDiff =
  | { kind: 'value'; is: DiffPart[]; should: DiffPart[] }
  | { kind: 'check-digit'; is: DiffPart[]; digit: string }
  | { kind: 'allowed'; is: DiffPart[]; allowed: string }

const CHECK_DIGIT_RULES = new Set(['TECH-NIP-CHECKSUM', 'TECH-INTERNAL-ID-CHECKSUM'])
const NIP_CHECK_DIGIT = 9

function parts(...candidates: DiffPart[]): DiffPart[] {
  return candidates.filter((part) => part.text !== '')
}

function compare(is: string, should: string): FindingDiff | null {
  if (is === should) return null
  let prefix = 0
  while (prefix < is.length && prefix < should.length && is[prefix] === should[prefix]) prefix++
  let suffix = 0
  while (
    suffix < is.length - prefix &&
    suffix < should.length - prefix &&
    is[is.length - 1 - suffix] === should[should.length - 1 - suffix]
  ) {
    suffix++
  }
  const split = (text: string): DiffPart[] =>
    parts(
      { text: text.slice(0, prefix), mark: false },
      { text: text.slice(prefix, text.length - suffix), mark: true },
      { text: text.slice(text.length - suffix), mark: false },
    )
  return { kind: 'value', is: split(is), should: split(should) }
}

export function findingDiff(finding: Pick<Finding, 'id' | 'params'>): FindingDiff | null {
  const { value, expected, allowed } = finding.params
  if (value === undefined) return null

  if (CHECK_DIGIT_RULES.has(finding.id)) {
    if (expected === undefined || !/^\d{10}/.test(value)) return null
    return {
      kind: 'check-digit',
      is: parts(
        { text: value.slice(0, NIP_CHECK_DIGIT), mark: false },
        { text: value.slice(NIP_CHECK_DIGIT, NIP_CHECK_DIGIT + 1), mark: true },
        { text: value.slice(NIP_CHECK_DIGIT + 1), mark: false },
      ),
      digit: expected,
    }
  }
  if (allowed !== undefined) return { kind: 'allowed', is: [{ text: value, mark: true }], allowed }
  if (expected !== undefined && finding.id.startsWith('AMT-')) return compare(value, expected)
  return null
}
