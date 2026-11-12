import { createHead } from '@unhead/vue/client'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Report } from '@/api/report'
import ValidatorPage from '../ValidatorPage.vue'
import { ERRORS_FILE, OK_FILE, errorsReport, okReport, sample, stubMatchMedia } from './support'

type Reply = () => Response

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

let replies: Reply[] = []
let fetchMock: ReturnType<typeof vi.fn>

function apiCalls() {
  return fetchMock.mock.calls.filter(([url]) => url === '/api/internal/validate')
}

beforeEach(() => {
  stubMatchMedia(true)
  replies = []
  fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith('/przyklady/')) return new Response(sample(url.slice('/przyklady/'.length)))
    const reply = replies.shift()
    if (!reply) throw new TypeError('no reply')
    return reply()
  })
  vi.stubGlobal('fetch', fetchMock)
  history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

function mountPage() {
  return mount(ValidatorPage, { global: { plugins: [createHead()] }, attachTo: document.body })
}

async function choose(wrapper: ReturnType<typeof mountPage>, file: File) {
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await vi.waitFor(() => {
    const message = wrapper.find('.drop__msg')
    const settled = !wrapper.find('.drop').exists() || (message.exists() && !message.text().startsWith('Sprawdzamy'))
    expect(settled).toBe(true)
  })
  await flushPromises()
}

const fileOf = (name: string) => new File([sample(name)], name, { type: 'text/xml' })
const status = () => document.querySelector('.announce')?.textContent ?? ''

describe('ValidatorPage', () => {
  it('starts with the upload form, the five layers waiting and the file notice', () => {
    const wrapper = mountPage()

    expect(wrapper.get('h1').text()).toBe('Walidator XML faktur KSeF: sprawdź plik FA(3) bez konta')
    expect(wrapper.get('label[for="plik"]').text()).toBe('Wybierz plik')
    expect(wrapper.get('input#plik').attributes('accept')).toBe('.xml,text/xml,application/xml')
    expect(wrapper.findAll('.drop__actions button').map((button) => button.text())).toEqual([
      'Wypróbuj na przykładzie',
      'Przykład bez błędów',
    ])
    expect(wrapper.findAll('.layer .layer__state').map((state) => state.text())).toEqual(Array(5).fill('czeka'))
    expect(wrapper.get('#co-z-plikiem').text()).toContain('Sprawdzamy go w pamięci, nie zapisujemy go na dysku')
    expect(wrapper.text()).toContain('Czego walidator nie sprawdza')
    expect(wrapper.text()).not.toMatch(/Cloudflare|mikrofirm/i)
  })

  it('sends the chosen file and shows the result with focus on its heading', async () => {
    replies.push(() => json(errorsReport))
    const wrapper = mountPage()

    await choose(wrapper, fileOf(ERRORS_FILE))
    await vi.waitFor(() => expect(wrapper.get('h1').text()).toBe('Faktura ma 1 błąd do poprawienia'))

    const [url, init] = apiCalls()[0]!
    expect(url).toBe('/api/internal/validate')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/xml')
    expect((init.body as Uint8Array).byteLength).toBe(errorsReport.document.sizeBytes)

    const heading = wrapper.get('h1')
    expect(heading.text()).toBe('Faktura ma 1 błąd do poprawienia')
    expect(document.activeElement).toBe(heading.element)
    expect(status()).toBe('Faktura ma 1 błąd do poprawienia')
    expect(wrapper.get('.res__line').text()).toContain('1 błąd2 ostrzeżenia1 nie sprawdzono')
    expect(wrapper.get('.res__file').text()).toContain(ERRORS_FILE)
    expect(wrapper.findAll('.run li').map((layer) => layer.text())).toEqual([
      'Bezpieczeństwobez uwag',
      'RozpoznanieFA(3), 1-0E',
      'Schemat XSDbez uwag',
      'Reguły techniczne1 błąd, 1 ostrzeżenie',
      'Spójność kwot1 ostrzeżenie',
    ])
    expect(wrapper.find('.fl').exists()).toBe(true)
    expect(wrapper.get('.party').text()).toContain('1111111112')
    expect(wrapper.find('svg[role="img"]').exists()).toBe(false)
  })

  it('does not send a file over the limit', async () => {
    const wrapper = mountPage()

    await choose(wrapper, new File([new Uint8Array(3_000_001)], 'duza.xml'))

    expect(apiCalls()).toHaveLength(0)
    expect(wrapper.get('.drop__msg').text()).toContain('Nie wysłaliśmy pliku.')
    expect(wrapper.find('.drop__msg button').exists()).toBe(false)
  })

  it('explains the rate limit and retries without choosing the file again', async () => {
    replies.push(
      () => new Response('', { status: 429, headers: { 'Retry-After': '30' } }),
      () => json(okReport),
    )
    const wrapper = mountPage()

    await choose(wrapper, fileOf(OK_FILE))
    await vi.waitFor(() => expect(wrapper.find('.drop__msg').exists()).toBe(true))

    expect(wrapper.get('.drop__msg').text()).toContain('Za dużo sprawdzeń w krótkim czasie. Spróbuj ponownie za 30 sekund.')
    expect(status()).toBe('Za dużo sprawdzeń w krótkim czasie. Spróbuj ponownie za 30 sekund.')

    await wrapper.get('.drop__msg button').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('h1').text()).toBe('Plik przeszedł kontrolę techniczną'))

    expect(apiCalls()).toHaveLength(2)
    expect(wrapper.get('h1').text()).toBe('Plik przeszedł kontrolę techniczną')
  })

  it('checks the clean example and shows the cards, the link and the QR code', async () => {
    replies.push(() => json(okReport))
    const wrapper = mountPage()

    await wrapper.findAll('.drop__actions button')[1]!.trigger('click')
    await vi.waitFor(() => expect(wrapper.get('h1').text()).toBe('Plik przeszedł kontrolę techniczną'))

    expect(fetchMock.mock.calls[0]![0]).toBe('/przyklady/faktura-poprawna.xml')
    expect(wrapper.get('h1').text()).toBe('Plik przeszedł kontrolę techniczną')
    expect(wrapper.get('.res__top').text()).toContain('Nie znaleźliśmy błędów w sprawdzanym zakresie.')
    expect(wrapper.get('.res__top').text()).toContain(
      'Wynik dotyczy kontroli, które wykonuje to narzędzie. Nie gwarantuje przyjęcia faktury przez KSeF.',
    )
    expect(wrapper.get('.party').text()).toContain('Przykładowy Sprzedawca Sp. z o.o.')
    expect(wrapper.get('#vlink').text()).toContain('/invoice/1111111111/06-11-2026/')
    expect(wrapper.find('svg[role="img"]').exists()).toBe(true)
    expect(wrapper.find('.fl').exists()).toBe(false)
    expect(wrapper.get('.after').text()).toContain('Duplikat w KSeF')
  })

  it('returns to the form with the back button and with "Nowy plik"', async () => {
    replies.push(() => json(okReport), () => json(okReport))
    const wrapper = mountPage()

    await choose(wrapper, fileOf(OK_FILE))
    expect(history.state?.validatorResult).toBe(true)

    window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
    await flushPromises()
    expect(wrapper.find('.drop').exists()).toBe(true)

    await choose(wrapper, fileOf(OK_FILE))
    history.replaceState(null, '', '/')
    const newFile = wrapper.findAll('.res__acts button').find((button) => button.text() === 'Nowy plik')!
    await newFile.trigger('click')
    await flushPromises()
    expect(wrapper.find('.drop').exists()).toBe(true)
    expect(document.activeElement).toBe(wrapper.get('input#plik').element)
  })

  it('says why an unsupported file was not checked, without cards or link', async () => {
    const fa2: Report = {
      ...okReport,
      result: 'UNSUPPORTED',
      document: { ...okReport.document, type: null, variant: null, schema: null },
      summary: { errors: 0, warnings: 0, info: 1, skippedChecks: 0 },
      stages: [
        { id: 'security', status: 'passed' },
        { id: 'recognition', status: 'unsupported' },
        { id: 'schema', status: 'not_run' },
        { id: 'rules', status: 'not_run' },
        { id: 'amounts', status: 'not_run' },
      ],
      findings: [
        {
          id: 'DOC-FA2-UNSUPPORTED',
          severity: 'INFO',
          stage: 'recognition',
          title: 'Faktura w starszym wzorze FA(2)',
          field: null,
          line: null,
          message: 'To faktura we wzorze FA(2).',
          fix: 'Wygeneruj fakturę we wzorze FA(3).',
          docsUrl: '/ksef/bledy/faktura-fa2',
          params: {},
        },
      ],
      skipped: [],
    }
    replies.push(() => json(fa2))
    const wrapper = mountPage()

    await choose(wrapper, fileOf(OK_FILE))

    expect(wrapper.get('h1').text()).toBe('Faktura w starszym wzorze FA(2)')
    expect(wrapper.get('.res__top').text()).toContain('To faktura we wzorze FA(2).')
    expect(wrapper.get('.res__top').text()).toContain('Wygeneruj fakturę we wzorze FA(3).')
    expect(wrapper.find('.party').exists()).toBe(false)
    expect(wrapper.find('.side').exists()).toBe(false)
    expect(wrapper.find('.fl').exists()).toBe(false)
  })

  it('offers the JSON report to read and to download', async () => {
    replies.push(() => json(okReport))
    const createObjectURL = vi.fn(() => 'blob:report')
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    const wrapper = mountPage()
    await choose(wrapper, fileOf(OK_FILE))

    const report = wrapper.get('#raport')
    expect(JSON.parse(report.get('pre code').text())).toEqual(okReport)

    await report.findAll('button').find((button) => button.text() === 'Pobierz raport')!.trigger('click')
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    click.mockRestore()
  })
})
