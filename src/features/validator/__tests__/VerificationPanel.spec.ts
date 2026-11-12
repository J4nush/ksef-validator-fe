import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Report } from '@/api/report'
import { readInvoice, type InvoiceData } from '@/domain/invoiceReader'
import { qrCode } from '@/domain/qrCode'
import type { KsefEnvironment } from '@/domain/verificationLink'
import VerificationPanel from '../VerificationPanel.vue'
import { OK_FILE, errorsReport, okReport, sample } from './support'

const read = readInvoice(sample(OK_FILE))
if (!read.ok) throw new Error(read.reason)
const invoice: InvoiceData = read.invoice
const hash = okReport.document.sha256Base64Url
const LINK = `https://qr.ksef.mf.gov.pl/invoice/1111111111/06-11-2026/${hash}`
const KSEF_NUMBER = '1111111111-20261106-0A1B2C3D4E5F-65'
const OTHER_NIP_NUMBER = '2222222222-20261106-0A1B2C3D4E5F-B4'

function mountPanel(props: Partial<{ report: Report; invoice: InvoiceData | null; hash: string; fileName: string }> = {}) {
  const wrapper = mount(VerificationPanel, {
    props: {
      report: okReport,
      invoice,
      hash,
      fileName: OK_FILE,
      environment: 'PROD' as KsefEnvironment,
      'onUpdate:environment': (value: KsefEnvironment) => wrapper.setProps({ environment: value }),
      ...props,
    },
  })
  return wrapper
}

describe('VerificationPanel', () => {
  it('builds the production verification link from the file', () => {
    const wrapper = mountPanel()

    expect(wrapper.get('h2').text()).toBe('Kod QR i link weryfikacyjny')
    expect(wrapper.get('#vlink').text()).toBe(LINK)
    expect(wrapper.text()).toContain(
      'Link potwierdzi fakturę tylko wtedy, gdy w KSeF jest dokładnie ten sam plik. Po otwarciu link prowadzi do strony Ministerstwa Finansów, która otrzyma NIP sprzedawcy, datę i skrót pliku.',
    )
  })

  it('draws the link as a QR code with a quiet zone and no inline styles', () => {
    const wrapper = mountPanel()
    const svg = wrapper.get('svg[role="img"]')
    const code = qrCode(LINK)

    expect(svg.attributes('aria-label')).toBe('Kod QR z linkiem weryfikacyjnym')
    expect(svg.attributes('viewBox')).toBe(`0 0 ${code.size} ${code.size}`)
    expect(svg.get('path').attributes('d')).toBe(code.path)
    expect(wrapper.html()).not.toContain('style=')
  })

  it('marks the code as a helper visualisation without a KSeF number', () => {
    const wrapper = mountPanel()

    expect(wrapper.get('.flag').text()).toBe('Wizualizacja pomocnicza')
    expect(wrapper.get('figcaption').text()).toBe('Numer KSeF: nie podano. KSeF drukuje w tym miejscu napis „OFFLINE”.')
  })

  it('puts a valid KSeF number under the code', async () => {
    const wrapper = mountPanel()
    const input = wrapper.get('input#ksef-nr')

    await input.setValue(KSEF_NUMBER.toLowerCase())
    await input.trigger('change')

    expect(wrapper.get('figcaption').text()).toBe(`Numer KSeF: ${KSEF_NUMBER}`)
    expect(wrapper.find('.flag').exists()).toBe(false)
    expect(input.attributes('aria-invalid')).toBeUndefined()
  })

  it('explains a mistyped KSeF number after leaving the field', async () => {
    const wrapper = mountPanel()
    const input = wrapper.get('input#ksef-nr')

    ;(input.element as HTMLInputElement).value = '1111111111-20261106'
    await input.trigger('input')
    expect(input.attributes('aria-invalid')).toBeUndefined()
    await input.trigger('change')

    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toContain('ksef-err')
    expect(wrapper.get('#ksef-err').text()).toBe(
      'Numer KSeF ma postać NIP-RRRRMMDD-12 znaków-2 znaki. Sprawdź go w potwierdzeniu z KSeF.',
    )
    expect(wrapper.find('.flag').exists()).toBe(true)
  })

  it('tells a checksum mistake apart from a wrong format', async () => {
    const wrapper = mountPanel()
    const input = wrapper.get('input#ksef-nr')

    await input.setValue(KSEF_NUMBER.replace(/-65$/, '-66'))
    await input.trigger('change')

    expect(wrapper.get('#ksef-err').text()).toBe(
      'Dwa ostatnie znaki nie zgadzają się z resztą numeru. Sprawdź, czy numer jest przepisany bez pomyłki.',
    )
  })

  it('warns, without blocking, when the KSeF number belongs to another seller', async () => {
    const wrapper = mountPanel()
    const input = wrapper.get('input#ksef-nr')

    await input.setValue(OTHER_NIP_NUMBER)
    await input.trigger('change')

    expect(wrapper.get('.notice').text()).toBe(
      'Numer KSeF zaczyna się od NIP 2222222222, a sprzedawca w pliku ma NIP 1111111111. Sprawdź, czy numer dotyczy tej faktury.',
    )
    expect(wrapper.get('figcaption').text()).toBe(`Numer KSeF: ${OTHER_NIP_NUMBER}`)
    expect(wrapper.find('svg[role="img"]').exists()).toBe(true)
  })

  it('suggests the KSeF number found in the file name', async () => {
    const wrapper = mountPanel({ fileName: `${KSEF_NUMBER}.xml` })

    const hint = wrapper.get('button.suggest')
    expect(hint.text()).toBe(`Użyj numeru z nazwy pliku: ${KSEF_NUMBER}`)
    expect((wrapper.get('input#ksef-nr').element as HTMLInputElement).value).toBe('')

    await hint.trigger('click')

    expect((wrapper.get('input#ksef-nr').element as HTMLInputElement).value).toBe(KSEF_NUMBER)
    expect(wrapper.get('figcaption').text()).toBe(`Numer KSeF: ${KSEF_NUMBER}`)
    expect(wrapper.find('button.suggest').exists()).toBe(false)
  })

  it('switches the link to a test environment in the technical details', async () => {
    const wrapper = mountPanel()

    expect((wrapper.get('input[value="PROD"]').element as HTMLInputElement).checked).toBe(true)
    await wrapper.get('input[value="TE"]').setValue()

    expect(wrapper.emitted('update:environment')).toEqual([['TE']])
    expect(wrapper.get('#vlink').text()).toBe(LINK.replace('https://qr.ksef', 'https://qr-test.ksef'))
  })

  it('shows neither link nor code when the file has errors', () => {
    const wrapper = mountPanel({ report: errorsReport, hash: errorsReport.document.sha256Base64Url })

    expect(wrapper.find('svg[role="img"]').exists()).toBe(false)
    expect(wrapper.find('#vlink').exists()).toBe(false)
    expect(wrapper.get('.side__msg').text()).toBe('Link weryfikacyjny i kod QR pokażemy, gdy plik przejdzie kontrolę bez błędów.')
  })

  it('shows neither link nor code when the browser hash differs from the server', () => {
    const wrapper = mountPanel({ hash: 'x'.repeat(43) })

    expect(wrapper.find('svg[role="img"]').exists()).toBe(false)
    expect(wrapper.get('.side__msg').text()).toBe(
      'Wystąpił błąd liczenia skrótu pliku: przeglądarka policzyła inny skrót niż serwer. Link i kod QR mogłyby nie pasować do faktury, więc ich nie pokazujemy. Wgraj plik ponownie.',
    )
  })

  it('explains a missing seller NIP or issue date', () => {
    const wrapper = mountPanel({ invoice: { ...invoice, issueDate: null } })

    expect(wrapper.find('svg[role="img"]').exists()).toBe(false)
    expect(wrapper.get('.side__msg').text()).toBe(
      'Link wymaga NIP-u sprzedawcy i daty wystawienia, a w pliku brakuje jednego z nich albo ma zły format.',
    )
  })
})
