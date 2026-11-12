import type { Problem, Report } from '@/api/report'

export const MAX_FILE_BYTES = 3_000_000

export interface InvoiceFile {
  name: string
  bytes: Uint8Array<ArrayBuffer>
}

export type RemoteFailure =
  | { kind: 'payload-too-large'; problem: Problem | null }
  | { kind: 'unsupported-media-type'; problem: Problem | null }
  | { kind: 'rate-limited'; retryAfterSeconds: number | null; problem: Problem | null }
  | { kind: 'server'; status: number; problem: Problem | null }
  | { kind: 'unexpected'; status: number | null }
  | { kind: 'network' }
  | { kind: 'timeout' }

export interface LocalFailure {
  kind: 'file-too-large'
  size: number
  limit: number
}

export interface IdleState {
  status: 'idle'
  requests: number
}

export interface SendingState {
  status: 'sending'
  requests: number
  request: number
  file: InvoiceFile
}

export interface ResultState {
  status: 'result'
  requests: number
  file: InvoiceFile
  report: Report
  hash: string
}

export interface RejectedState {
  status: 'failure'
  requests: number
  file: null
  failure: LocalFailure
}

export interface FailedState {
  status: 'failure'
  requests: number
  file: InvoiceFile
  failure: RemoteFailure
}

export type ValidatorState = IdleState | SendingState | ResultState | RejectedState | FailedState

export type SubmitEvent = { type: 'submit'; file: InvoiceFile }
export type ReceivedEvent = { type: 'received'; request: number; report: Report; hash: string }
export type FailedEvent = { type: 'failed'; request: number; failure: RemoteFailure }
export type RetryEvent = { type: 'retry' }
export type ResetEvent = { type: 'reset' }

export type ValidatorEvent = SubmitEvent | ReceivedEvent | FailedEvent | RetryEvent | ResetEvent

export const INITIAL_STATE: IdleState = { status: 'idle', requests: 0 }

function send(requests: number, file: InvoiceFile): SendingState | RejectedState {
  if (file.bytes.byteLength > MAX_FILE_BYTES) {
    return {
      status: 'failure',
      requests,
      file: null,
      failure: { kind: 'file-too-large', size: file.bytes.byteLength, limit: MAX_FILE_BYTES },
    }
  }
  return { status: 'sending', requests: requests + 1, request: requests + 1, file }
}

function afterSending(state: SendingState, event: ReceivedEvent | FailedEvent | ResetEvent): ValidatorState {
  if (event.type === 'reset') return { status: 'idle', requests: state.requests }
  if (event.request !== state.request) return state
  if (event.type === 'received') {
    return { status: 'result', requests: state.requests, file: state.file, report: event.report, hash: event.hash }
  }
  return { status: 'failure', requests: state.requests, file: state.file, failure: event.failure }
}

export function transition(state: Exclude<ValidatorState, IdleState>, event: ResetEvent): IdleState
export function transition(state: IdleState, event: SubmitEvent): SendingState | RejectedState
export function transition(state: SendingState, event: ReceivedEvent | FailedEvent | ResetEvent): ValidatorState
export function transition(state: ResultState | RejectedState, event: SubmitEvent | ResetEvent): ValidatorState
export function transition(state: FailedState, event: SubmitEvent | RetryEvent | ResetEvent): ValidatorState
export function transition(state: ValidatorState, event: ValidatorEvent): ValidatorState {
  switch (state.status) {
    case 'idle':
      return event.type === 'submit' ? send(state.requests, event.file) : state
    case 'sending':
      return event.type === 'received' || event.type === 'failed' || event.type === 'reset'
        ? afterSending(state, event)
        : state
    case 'result':
    case 'failure':
      if (event.type === 'submit') return send(state.requests, event.file)
      if (event.type === 'reset') return { status: 'idle', requests: state.requests }
      if (event.type === 'retry' && state.file !== null) return send(state.requests, state.file)
      return state
  }
}
