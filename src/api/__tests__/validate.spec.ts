import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Report } from '../report'
import { isReport, validateInvoice, VALIDATE_URL } from '../validate'
import sample from './fixtures/report-errors.json'

if (!isReport(sample)) throw new Error('fixture is not a report of format 1.1')
const report: Report = sample
const bytes = new TextEncoder().encode('<Faktura/>')

const json = (body: unknown, status = 200, contentType = 'application/json', headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType, ...headers } })

const problem = (status: number, title: string, headers: Record<string, string> = {}) =>
  json({ type: '/api/problems/x', title, status, detail: `${title}.` }, status, 'application/problem+json', headers)

const nginx = (status: number) =>
  new Response(`<html><body><center><h1>${status}</h1></center></body></html>`, {
    status,
    headers: { 'Content-Type': 'text/html' },
  })

function respond(response: Response) {
  return vi.fn<typeof globalThis.fetch>().mockResolvedValue(response)
}

describe('validateInvoice', () => {
  it('posts the raw bytes as XML without credentials or cache', async () => {
    const fetch = respond(json(report))

    await validateInvoice(bytes, { fetch })

    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(url).toBe('/api/internal/validate')
    expect(VALIDATE_URL).toBe(url)
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(bytes)
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/xml')
    expect(init?.credentials).toBe('omit')
    expect(init?.cache).toBe('no-store')
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('returns a report of format 1.1', async () => {
    expect(await validateInvoice(bytes, { fetch: respond(json(report)) })).toEqual({ outcome: 'report', report })
  })

  it.each([
    ['format 1.0', { ...report, schemaVersion: '1.0' }],
    ['no stages', { ...report, stages: undefined }],
    ['four stages', { ...report, stages: report.stages.slice(1) }],
    ['a finding with a numeric param', { ...report, findings: [{ ...report.findings[0], params: { value: 1 } }] }],
    ['a list instead of a report', [report]],
  ])('treats a 200 response with %s as unexpected', async (_, body) => {
    expect(await validateInvoice(bytes, { fetch: respond(json(body)) })).toEqual({
      outcome: 'failure',
      failure: { kind: 'unexpected', status: 200 },
    })
  })

  it('treats a 200 response that is not JSON as unexpected', async () => {
    expect(await validateInvoice(bytes, { fetch: respond(nginx(200)) })).toEqual({
      outcome: 'failure',
      failure: { kind: 'unexpected', status: 200 },
    })
  })

  it('reads the problem details of a 413 from the API', async () => {
    expect(await validateInvoice(bytes, { fetch: respond(problem(413, 'Plik jest za duży')) })).toEqual({
      outcome: 'failure',
      failure: {
        kind: 'payload-too-large',
        problem: { type: '/api/problems/x', title: 'Plik jest za duży', status: 413, detail: 'Plik jest za duży.' },
      },
    })
  })

  it('recognises a 413 from nginx by its status alone', async () => {
    expect(await validateInvoice(bytes, { fetch: respond(nginx(413)) })).toEqual({
      outcome: 'failure',
      failure: { kind: 'payload-too-large', problem: null },
    })
  })

  it('maps 415 to an unsupported media type', async () => {
    const outcome = await validateInvoice(bytes, { fetch: respond(problem(415, 'Zły typ pliku')) })

    expect(outcome.outcome === 'failure' && outcome.failure.kind).toBe('unsupported-media-type')
  })

  it('reads Retry-After in seconds from a 429', async () => {
    const fetch = respond(problem(429, 'Za dużo prób', { 'Retry-After': '42' }))
    const outcome = await validateInvoice(bytes, { fetch })

    expect(outcome).toMatchObject({ outcome: 'failure', failure: { kind: 'rate-limited', retryAfterSeconds: 42 } })
  })

  it('reads Retry-After given as an HTTP date', async () => {
    const now = () => Date.parse('2026-11-11T12:00:00Z')
    const fetch = respond(problem(429, 'Za dużo prób', { 'Retry-After': 'Wed, 11 Nov 2026 12:01:30 GMT' }))

    expect(await validateInvoice(bytes, { fetch, now })).toMatchObject({
      failure: { kind: 'rate-limited', retryAfterSeconds: 90 },
    })
  })

  it.each([
    ['nginx without Retry-After', nginx(429)],
    ['an unreadable Retry-After', problem(429, 'Za dużo prób', { 'Retry-After': 'soon' })],
  ])('gives no waiting time for %s', async (_, response) => {
    expect(await validateInvoice(bytes, { fetch: respond(response) })).toMatchObject({
      failure: { kind: 'rate-limited', retryAfterSeconds: null },
    })
  })

  it.each([
    [500, problem(500, 'Błąd serwera')],
    [502, nginx(502)],
    [503, nginx(503)],
  ])('maps %i to a server failure', async (status, response) => {
    expect(await validateInvoice(bytes, { fetch: respond(response) })).toMatchObject({
      failure: { kind: 'server', status },
    })
  })

  it('ignores problem details that do not have the expected fields', async () => {
    const fetch = respond(json({ message: 'x' }, 500, 'application/problem+json'))

    expect(await validateInvoice(bytes, { fetch })).toEqual({
      outcome: 'failure',
      failure: { kind: 'server', status: 500, problem: null },
    })
  })

  it.each([404, 405, 400])('treats %i as unexpected', async (status) => {
    expect(await validateInvoice(bytes, { fetch: respond(problem(status, 'Nie ma')) })).toEqual({
      outcome: 'failure',
      failure: { kind: 'unexpected', status },
    })
  })

  it('maps a rejected fetch to a network failure', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('Failed to fetch'))

    expect(await validateInvoice(bytes, { fetch })).toEqual({ outcome: 'failure', failure: { kind: 'network' } })
  })

  describe('with a request that never answers', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const hanging = () =>
      vi.fn<typeof globalThis.fetch>(
        (_, init) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
          }),
      )

    it('gives up after 30 seconds', async () => {
      const pending = validateInvoice(bytes, { fetch: hanging() })

      await vi.advanceTimersByTimeAsync(29_999)
      let settled = false
      void pending.then(() => (settled = true))
      await Promise.resolve()
      expect(settled).toBe(false)

      await vi.advanceTimersByTimeAsync(1)
      expect(await pending).toEqual({ outcome: 'failure', failure: { kind: 'timeout' } })
    })

    const stalledBody = (status: number, contentType: string) =>
      vi.fn<typeof globalThis.fetch>(async (_, init) => {
        const body = new ReadableStream({
          start(stream) {
            stream.enqueue(new TextEncoder().encode('{"schemaVersion":'))
            init?.signal?.addEventListener('abort', () => stream.error(init.signal?.reason))
          },
        })
        return new Response(body, { status, headers: { 'Content-Type': contentType } })
      })

    it.each([
      [200, 'application/json'],
      [500, 'application/problem+json'],
    ])('gives up when the body of a %i stalls', async (status, contentType) => {
      const pending = validateInvoice(bytes, { fetch: stalledBody(status, contentType) })

      await vi.advanceTimersByTimeAsync(30_000)

      expect(await pending).toEqual({ outcome: 'failure', failure: { kind: 'timeout' } })
    })

    it('reports a cancel while the body is still arriving', async () => {
      const controller = new AbortController()
      const pending = validateInvoice(bytes, { fetch: stalledBody(200, 'application/json'), signal: controller.signal })

      await vi.advanceTimersByTimeAsync(10)
      controller.abort()

      expect(await pending).toEqual({ outcome: 'cancelled' })
    })

    it('reports a cancel by the caller separately from a failure', async () => {
      const controller = new AbortController()
      const pending = validateInvoice(bytes, { fetch: hanging(), signal: controller.signal })

      controller.abort()

      expect(await pending).toEqual({ outcome: 'cancelled' })
    })

    it('does not send at all when the caller already cancelled', async () => {
      const fetch = hanging()

      expect(await validateInvoice(bytes, { fetch, signal: AbortSignal.abort() })).toEqual({ outcome: 'cancelled' })
      expect(fetch).not.toHaveBeenCalled()
    })
  })
})

describe('isReport', () => {
  it('accepts every severity and a skipped check outside the layers', () => {
    const findings = (['ERROR', 'WARNING', 'INFO'] as const).map((severity) => ({ ...report.findings[0], severity }))

    expect(isReport({ ...report, findings })).toBe(true)
    expect(report.skipped[0]?.stage).toBeNull()
  })

  it('rejects stages in a different order', () => {
    expect(isReport({ ...report, stages: [...report.stages].reverse() })).toBe(false)
  })
})
