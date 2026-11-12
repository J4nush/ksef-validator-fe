import { describe, expect, it } from 'vitest'
import type { Report } from '@/api/report'
import { INITIAL_STATE, MAX_FILE_BYTES, transition, type InvoiceFile } from '../validatorMachine'

const file: InvoiceFile = { name: 'faktura.xml', bytes: new TextEncoder().encode('<Faktura/>') }
const report = { schemaVersion: '1.1', result: 'PASSED' } as Report
const HASH = 'qrs2gCLXnTUy6--AHwHuDxFuCj0BYUGRGtBuGnJwN-c'

function sending() {
  const state = transition(INITIAL_STATE, { type: 'submit', file })
  if (state.status !== 'sending') throw new Error('expected sending')
  return state
}

function failed() {
  const state = transition(sending(), { type: 'failed', request: 1, failure: { kind: 'network' } })
  if (state.status !== 'failure' || state.file === null) throw new Error('expected a retryable failure')
  return state
}

describe('validatorMachine', () => {
  it('starts idle with no request made', () => {
    expect(INITIAL_STATE).toEqual({ status: 'idle', requests: 0 })
  })

  it('sends a file and numbers the request', () => {
    expect(sending()).toEqual({ status: 'sending', requests: 1, request: 1, file })
  })

  it('sends an empty file, because the server explains it', () => {
    const empty = { name: 'pusty.xml', bytes: new Uint8Array(0) }

    expect(transition(INITIAL_STATE, { type: 'submit', file: empty }).status).toBe('sending')
  })

  it('refuses a file over the limit without sending it', () => {
    const big = { name: 'duzy.xml', bytes: new Uint8Array(MAX_FILE_BYTES + 1) }

    expect(transition(INITIAL_STATE, { type: 'submit', file: big })).toEqual({
      status: 'failure',
      requests: 0,
      file: null,
      failure: { kind: 'file-too-large', size: MAX_FILE_BYTES + 1, limit: 3_000_000 },
    })
  })

  it('accepts a file of exactly the limit', () => {
    const edge = { name: 'graniczny.xml', bytes: new Uint8Array(MAX_FILE_BYTES) }

    expect(transition(INITIAL_STATE, { type: 'submit', file: edge }).status).toBe('sending')
  })

  it('shows the result with the file and the browser hash', () => {
    expect(transition(sending(), { type: 'received', request: 1, report, hash: HASH })).toEqual({
      status: 'result',
      requests: 1,
      file,
      report,
      hash: HASH,
    })
  })

  it('keeps the file after a server failure so the user can retry', () => {
    const state = failed()

    expect(state).toEqual({ status: 'failure', requests: 1, file, failure: { kind: 'network' } })
    expect(transition(state, { type: 'retry' })).toEqual({ status: 'sending', requests: 2, request: 2, file })
  })

  it('ignores a response to a request that is no longer pending', () => {
    const second = transition(transition(sending(), { type: 'reset' }), { type: 'submit', file })
    if (second.status !== 'sending') throw new Error('expected sending')

    expect(transition(second, { type: 'received', request: 1, report, hash: HASH })).toBe(second)
    expect(transition(second, { type: 'failed', request: 1, failure: { kind: 'timeout' } })).toBe(second)
  })

  it('goes back to the form on reset and keeps counting requests', () => {
    const result = transition(sending(), { type: 'received', request: 1, report, hash: HASH })
    if (result.status !== 'result') throw new Error('expected result')

    expect(transition(result, { type: 'reset' })).toEqual({ status: 'idle', requests: 1 })
    expect(transition(failed(), { type: 'reset' })).toEqual({ status: 'idle', requests: 1 })
    expect(transition(sending(), { type: 'reset' })).toEqual({ status: 'idle', requests: 1 })
  })

  it('accepts a new file from a result or a failure', () => {
    const result = transition(sending(), { type: 'received', request: 1, report, hash: HASH })
    if (result.status !== 'result') throw new Error('expected result')

    expect(transition(result, { type: 'submit', file })).toEqual({ status: 'sending', requests: 2, request: 2, file })
    expect(transition(failed(), { type: 'submit', file })).toEqual({ status: 'sending', requests: 2, request: 2, file })
  })

  it('does not compile impossible transitions and leaves the state as it was', () => {
    const idle = INITIAL_STATE
    const big = { name: 'duzy.xml', bytes: new Uint8Array(MAX_FILE_BYTES + 1) }
    const tooLarge = transition(idle, { type: 'submit', file: big })
    if (tooLarge.status !== 'failure' || tooLarge.file !== null) throw new Error('expected a local failure')

    // @ts-expect-error a response cannot arrive before anything is sent
    expect(transition(idle, { type: 'received', request: 1, report, hash: HASH })).toBe(idle)
    // @ts-expect-error there is nothing to retry before a request fails
    expect(transition(idle, { type: 'retry' })).toBe(idle)
    // @ts-expect-error a file over the limit is never sent, so it cannot be retried
    expect(transition(tooLarge, { type: 'retry' })).toBe(tooLarge)
    const pending = sending()
    // @ts-expect-error a second file cannot be submitted while one is being sent
    expect(transition(pending, { type: 'submit', file })).toBe(pending)
  })
})
