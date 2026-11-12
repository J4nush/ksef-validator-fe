import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { validateInvoice } from '@/api/validate'
import { sha256Base64Url } from '@/domain/hash'
import { INITIAL_STATE, transition, type InvoiceFile, type SendingState, type ValidatorState } from '@/domain/validatorMachine'

export const EXAMPLES = {
  errors: 'faktura-z-bledami.xml',
  clean: 'faktura-poprawna.xml',
} as const

async function hashOf(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  try {
    return await sha256Base64Url(bytes)
  } catch {
    return ''
  }
}

export function useValidator() {
  const state = shallowRef<ValidatorState>(INITIAL_STATE)
  const exampleError = ref(false)
  let controller: AbortController | null = null

  async function send(sending: SendingState) {
    state.value = sending
    controller?.abort()
    controller = new AbortController()
    const [outcome, hash] = await Promise.all([
      validateInvoice(sending.file.bytes, { signal: controller.signal }),
      hashOf(sending.file.bytes),
    ])
    const current = state.value
    if (current.status !== 'sending' || outcome.outcome === 'cancelled') return
    state.value =
      outcome.outcome === 'report'
        ? transition(current, { type: 'received', request: sending.request, report: outcome.report, hash })
        : transition(current, { type: 'failed', request: sending.request, failure: outcome.failure })
  }

  async function submit(file: InvoiceFile) {
    const current = state.value
    if (current.status === 'sending') return
    exampleError.value = false
    const event = { type: 'submit', file } as const
    let next: ValidatorState
    if (current.status === 'idle') next = transition(current, event)
    else if (current.status === 'result' || current.file === null) next = transition(current, event)
    else next = transition(current, event)
    if (next.status === 'sending') await send(next)
    else state.value = next
  }

  async function submitFile(file: File) {
    await submit({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })
  }

  async function submitExample(name: (typeof EXAMPLES)[keyof typeof EXAMPLES]) {
    try {
      const response = await fetch(`/przyklady/${name}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(String(response.status))
      await submit({ name, bytes: new Uint8Array(await response.arrayBuffer()) })
    } catch {
      exampleError.value = true
    }
  }

  async function retry() {
    const current = state.value
    if (current.status !== 'failure' || current.file === null) return
    const next = transition(current, { type: 'retry' })
    if (next.status === 'sending') await send(next)
  }

  function reset() {
    controller?.abort()
    controller = null
    const current = state.value
    if (current.status !== 'idle') state.value = transition(current, { type: 'reset' })
  }

  onBeforeUnmount(() => controller?.abort())

  return { state, exampleError, submitFile, submitExample, retry, reset }
}
