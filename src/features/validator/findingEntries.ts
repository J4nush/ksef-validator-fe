import type { Finding, Severity, SkippedCheck } from '@/api/report'
import { skippedCheck } from './wording'

export type EntrySev = 'err' | 'warn' | 'info' | 'skip'

export interface ListEntry {
  key: string
  sev: EntrySev
  title: string
  line: number | null
  position: number
  of: number
  finding: Finding | null
  skipped: SkippedCheck | null
}

export interface EntryGroup {
  sev: EntrySev
  name: string
  entries: ListEntry[]
}

const GROUPS: { sev: EntrySev; name: string }[] = [
  { sev: 'err', name: 'Błędy' },
  { sev: 'warn', name: 'Ostrzeżenia' },
  { sev: 'info', name: 'Informacje' },
  { sev: 'skip', name: 'Nie sprawdzono' },
]

const SEV: Record<Severity, EntrySev> = { ERROR: 'err', WARNING: 'warn', INFO: 'info' }

export const SEV_WORD: Record<EntrySev, string> = {
  err: 'Błąd',
  warn: 'Ostrzeżenie',
  info: 'Informacja',
  skip: 'Nie sprawdzono',
}

export function entryGroups(findings: Finding[], skipped: SkippedCheck[]): EntryGroup[] {
  const all = [
    ...findings.map((finding, index) => ({
      key: `f${index}`,
      sev: SEV[finding.severity],
      title: finding.title,
      line: finding.line,
      finding,
      skipped: null,
    })),
    ...skipped.map((check, index) => ({
      key: `s${index}`,
      sev: 'skip' as const,
      title: skippedCheck(check.id).title,
      line: null,
      finding: null,
      skipped: check,
    })),
  ]
  return GROUPS.flatMap(({ sev, name }) => {
    const members = all.filter((entry) => entry.sev === sev)
    if (members.length === 0) return []
    const entries = members.map((entry, index) => ({ ...entry, position: index + 1, of: members.length }))
    return [{ sev, name, entries }]
  })
}
