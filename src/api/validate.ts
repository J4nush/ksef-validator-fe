import type { RemoteFailure } from '@/domain/validatorMachine'
import type { Finding, Layer, Problem, Report, SkippedCheck } from './report'

export const VALIDATE_URL = '/api/internal/validate'
export const TIMEOUT_MS = 30_000

export type ValidateOutcome =
  | { outcome: 'report'; report: Report }
  | { outcome: 'failure'; failure: RemoteFailure }
  | { outcome: 'cancelled' }

export interface ValidateOptions {
  fetch?: typeof fetch
  signal?: AbortSignal
  timeoutMs?: number
  now?: () => number
}

const LAYERS: readonly Layer[] = ['security', 'recognition', 'schema', 'rules', 'amounts']
const LAYER_STATUSES = ['passed', 'warnings', 'errors', 'unsupported', 'not_run', 'not_checked']
const RESULTS = ['PASSED', 'WARNINGS', 'ERRORS', 'UNSUPPORTED']
const SEVERITIES = ['ERROR', 'WARNING', 'INFO']

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)
const isString = (value: unknown): value is string => typeof value === 'string'
const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0
const isLayer = (value: unknown): value is Layer => LAYERS.includes(value as Layer)
const oneOf = (values: readonly string[], value: unknown) => isString(value) && values.includes(value)
const orNull = (check: (value: unknown) => boolean) => (value: unknown) => value === null || check(value)

function isFinding(value: unknown): value is Finding {
  return (
    isObject(value) &&
    isString(value.id) &&
    oneOf(SEVERITIES, value.severity) &&
    isLayer(value.stage) &&
    [value.title, value.message, value.fix, value.docsUrl].every(isString) &&
    orNull(isString)(value.field) &&
    orNull(isCount)(value.line) &&
    isObject(value.params) &&
    Object.values(value.params).every(isString)
  )
}

function isSkippedCheck(value: unknown): value is SkippedCheck {
  return isObject(value) && isString(value.id) && isString(value.message) && orNull(isLayer)(value.stage)
}

export function isReport(value: unknown): value is Report {
  if (!isObject(value) || value.schemaVersion !== '1.1' || !oneOf(RESULTS, value.result)) return false
  const { document, summary, stages, findings, skipped } = value
  return (
    isObject(document) &&
    isCount(document.sizeBytes) &&
    isString(document.sha256Base64Url) &&
    isObject(summary) &&
    [summary.errors, summary.warnings, summary.info, summary.skippedChecks].every(isCount) &&
    Array.isArray(stages) &&
    stages.length === LAYERS.length &&
    stages.every(
      (stage, index) => isObject(stage) && stage.id === LAYERS[index] && oneOf(LAYER_STATUSES, stage.status),
    ) &&
    Array.isArray(findings) &&
    findings.every(isFinding) &&
    Array.isArray(skipped) &&
    skipped.every(isSkippedCheck)
  )
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function readProblem(response: Response): Promise<Problem | null> {
  if (!(response.headers.get('Content-Type') ?? '').startsWith('application/problem+json')) return null
  const body = parseJson(await response.text())
  if (!isObject(body) || typeof body.status !== 'number') return null
  const { type, title, status, detail } = body
  return isString(type) && isString(title) && isString(detail) ? { type, title, status, detail } : null
}

function retryAfterSeconds(header: string | null, now: number): number | null {
  if (header === null) return null
  if (/^\d+$/.test(header.trim())) return Number(header.trim())
  const date = Date.parse(header)
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - now) / 1000))
}

async function interpret(response: Response, now: () => number): Promise<ValidateOutcome> {
  const fail = (failure: RemoteFailure): ValidateOutcome => ({ outcome: 'failure', failure })
  const { status } = response

  if (status === 200) {
    const body = parseJson(await response.text())
    return isReport(body) ? { outcome: 'report', report: body } : fail({ kind: 'unexpected', status })
  }
  if (status === 413) return fail({ kind: 'payload-too-large', problem: await readProblem(response) })
  if (status === 415) return fail({ kind: 'unsupported-media-type', problem: await readProblem(response) })
  if (status === 429) {
    return fail({
      kind: 'rate-limited',
      retryAfterSeconds: retryAfterSeconds(response.headers.get('Retry-After'), now()),
      problem: await readProblem(response),
    })
  }
  if (status >= 500 && status <= 599) return fail({ kind: 'server', status, problem: await readProblem(response) })
  return fail({ kind: 'unexpected', status })
}

export async function validateInvoice(
  bytes: Uint8Array<ArrayBuffer>,
  options: ValidateOptions = {},
): Promise<ValidateOutcome> {
  const { fetch: send = globalThis.fetch, signal, timeoutMs = TIMEOUT_MS, now = Date.now } = options
  if (signal?.aborted) return { outcome: 'cancelled' }

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const cancel = () => controller.abort()
  signal?.addEventListener('abort', cancel, { once: true })

  try {
    const response = await send(VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml', Accept: 'application/json, application/problem+json' },
      body: bytes,
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    })
    return await interpret(response, now)
  } catch {
    if (timedOut) return { outcome: 'failure', failure: { kind: 'timeout' } }
    if (signal?.aborted) return { outcome: 'cancelled' }
    return { outcome: 'failure', failure: { kind: 'network' } }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
}
