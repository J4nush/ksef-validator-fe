import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { vi } from 'vitest'
import type { Report } from '@/api/report'
import { isReport } from '@/api/validate'
import errorsJson from './fixtures/report-errors.json'
import okJson from './fixtures/report-ok.json'

export function asReport(json: unknown): Report {
  if (!isReport(json)) throw new Error('fixture is not a report of format 1.1')
  return json
}

export const errorsReport = asReport(errorsJson)
export const okReport = asReport(okJson)

export const ERRORS_FILE = 'faktura-z-bledami.xml'
export const OK_FILE = 'faktura-poprawna.xml'

export function sample(name: string): Uint8Array<ArrayBuffer> {
  const buffer = readFileSync(resolve(__dirname, '../../../../public/przyklady', name))
  return new Uint8Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
}

export function stubMatchMedia(wide: boolean) {
  const listeners = new Set<(event: { matches: boolean }) => void>()
  const query = {
    matches: wide,
    addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.delete(listener),
  }
  vi.stubGlobal('matchMedia', () => query)
  return {
    change(matches: boolean) {
      query.matches = matches
      for (const listener of listeners) listener({ matches })
    },
  }
}
